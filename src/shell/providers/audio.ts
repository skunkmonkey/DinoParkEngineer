export const AUDIO_DIAGNOSTIC_CODES = {
  INVALID_VOLUME: "SHELL_AUDIO_VOLUME_INVALID",
  INVALID_CUE: "SHELL_AUDIO_CUE_INVALID",
  AUTOPLAY_LOCKED: "SHELL_AUDIO_AUTOPLAY_LOCKED",
} as const;

export interface AudioSnapshot {
  readonly muted: boolean;
  readonly volume: number;
  readonly autoplayUnlocked: boolean;
  readonly lastCueId: string | undefined;
}

export interface AudioCueRequest {
  readonly cueId: string;
  readonly semanticLabel: string;
  readonly substituteText?: string;
}

export interface AudioCueResult {
  readonly ok: boolean;
  readonly played: boolean;
  readonly substituted: boolean;
  readonly code?: string;
  readonly snapshot: AudioSnapshot;
}

export interface AudioPort {
  readonly getSnapshot: () => AudioSnapshot;
  readonly setMuted: (muted: boolean) => AudioSnapshot;
  readonly setVolume: (volume: number) => AudioUpdateResult;
  readonly unlockAutoplay: () => AudioSnapshot;
  readonly playCue: (request: AudioCueRequest) => AudioCueResult;
}

export type AudioUpdateResult =
  | { readonly ok: true; readonly snapshot: AudioSnapshot }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly snapshot: AudioSnapshot;
    };

export const DEFAULT_AUDIO_SNAPSHOT: AudioSnapshot = Object.freeze({
  muted: false,
  volume: 1,
  autoplayUnlocked: false,
  lastCueId: undefined,
});

/**
 * This adapter intentionally performs no audio I/O.  A browser adapter can
 * consume the command methods while the shell remains deterministic and tests
 * can inspect the semantic cue projection without an AudioContext.
 */
export function createAudioPort(): AudioPort {
  let snapshot = DEFAULT_AUDIO_SNAPSHOT;

  const setMuted = (muted: boolean): AudioSnapshot => {
    snapshot = Object.freeze({ ...snapshot, muted });
    return snapshot;
  };

  const setVolume = (volume: number): AudioUpdateResult => {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      return {
        ok: false,
        code: AUDIO_DIAGNOSTIC_CODES.INVALID_VOLUME,
        message: "Audio volume must be a finite number between 0 and 1.",
        snapshot,
      };
    }

    snapshot = Object.freeze({ ...snapshot, volume });
    return { ok: true, snapshot };
  };

  const unlockAutoplay = (): AudioSnapshot => {
    snapshot = Object.freeze({ ...snapshot, autoplayUnlocked: true });
    return snapshot;
  };

  const playCue = (request: AudioCueRequest): AudioCueResult => {
    const cueId = request.cueId.trim();
    const label = request.semanticLabel.trim();
    if (cueId.length === 0 || label.length === 0) {
      return {
        ok: false,
        played: false,
        substituted: false,
        code: AUDIO_DIAGNOSTIC_CODES.INVALID_CUE,
        snapshot,
      };
    }

    if (snapshot.muted) {
      snapshot = Object.freeze({ ...snapshot, lastCueId: cueId });
      return {
        ok: true,
        played: false,
        substituted: request.substituteText !== undefined,
        snapshot,
      };
    }

    if (!snapshot.autoplayUnlocked) {
      return {
        ok: false,
        played: false,
        substituted: request.substituteText !== undefined,
        code: AUDIO_DIAGNOSTIC_CODES.AUTOPLAY_LOCKED,
        snapshot,
      };
    }

    snapshot = Object.freeze({ ...snapshot, lastCueId: cueId });
    return {
      ok: true,
      played: snapshot.volume > 0,
      substituted: false,
      snapshot,
    };
  };

  return Object.freeze({
    getSnapshot: (): AudioSnapshot => snapshot,
    setMuted,
    setVolume,
    unlockAutoplay,
    playCue,
  });
}
