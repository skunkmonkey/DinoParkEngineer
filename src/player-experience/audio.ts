import type { AudioSubstitute } from "./types.js";

export interface PlayerAudioCue {
  readonly id: string;
  readonly text: string;
  readonly severity: "info" | "warning" | "emergency" | "success";
}

export interface PlayerAudioAdapter {
  readonly requestCue: (cue: PlayerAudioCue) => AudioSubstitute;
  readonly unlock: () => Promise<boolean>;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (volume: number) => void;
  readonly getSnapshot: () => { readonly muted: boolean; readonly volume: number; readonly unlocked: boolean };
  readonly dispose: () => void;
}

/**
 * Audio stays behind a replaceable port. The MVP adapter deliberately emits a
 * persistent semantic substitute instead of calling Web Audio directly, so
 * autoplay policy, mute, and reduced-motion settings cannot hide meaning.
 */
export const createPlayerAudioAdapter = (): PlayerAudioAdapter => {
  let sequence = 0;
  let disposed = false;
  let muted = false;
  let volume = 0.35;
  let context: AudioContext | undefined;
  let unlocked = false;

  const ensureContext = (): AudioContext | undefined => {
    if (context !== undefined) return context;
    const Constructor = globalThis.AudioContext;
    if (typeof Constructor !== "function") return undefined;
    try {
      context = new Constructor();
      return context;
    } catch {
      return undefined;
    }
  };

  const playCueTone = (cue: PlayerAudioCue): void => {
    if (!unlocked || muted || volume <= 0) return;
    const activeContext = ensureContext();
    if (activeContext === undefined || activeContext.state !== "running") return;
    try {
      const oscillator = activeContext.createOscillator();
      const gain = activeContext.createGain();
      const frequency = cue.severity === "emergency" ? 660 : cue.severity === "warning" ? 520 : cue.severity === "success" ? 440 : 320;
      oscillator.frequency.setValueAtTime(frequency, activeContext.currentTime);
      gain.gain.setValueAtTime(Math.min(0.12, volume * 0.25), activeContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, activeContext.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(activeContext.destination);
      oscillator.start();
      oscillator.stop(activeContext.currentTime + 0.13);
    } catch {
      // Browser audio can become unavailable between user gesture and cue.
      // The semantic substitute returned below remains authoritative.
    }
  };

  return {
    requestCue(cue) {
      playCueTone(cue);
      if (disposed) {
        return {
          id: `audio:substitute-disposed-${cue.id}` as `${string}:${string}`,
          tick: 0,
          cue: cue.id,
          text: cue.text,
          played: false,
        };
      }
      sequence += 1;
      return {
        id: `audio:substitute-${sequence.toString().padStart(4, "0")}` as `${string}:${string}`,
        tick: sequence,
        cue: cue.id,
        text: cue.text,
        played: false,
      };
    },
    async unlock() {
      if (disposed) return false;
      const activeContext = ensureContext();
      if (activeContext === undefined) return false;
      try {
        await activeContext.resume();
        unlocked = activeContext.state === "running";
      } catch {
        unlocked = false;
      }
      return unlocked;
    },
    setMuted(value) {
      muted = value;
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      volume = Math.min(1, Math.max(0, value));
    },
    getSnapshot() {
      return { muted, volume, unlocked };
    },
    dispose() {
      disposed = true;
      if (context !== undefined) void context.close();
      context = undefined;
      unlocked = false;
    },
  };
};
