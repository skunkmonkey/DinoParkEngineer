import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerAudioAdapter } from "../../src/player-experience/public.js";

test("optional audio unlocks after a user gesture and preserves bounded mute and volume state", async (context) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  let closed = false;
  class FakeAudioContext {
    state: AudioContextState = "suspended";
    async resume(): Promise<void> {
      this.state = "running";
    }
    async close(): Promise<void> {
      closed = true;
      this.state = "closed";
    }
  }
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeAudioContext });
  context.after(() => {
    if (original === undefined) delete (globalThis as { AudioContext?: unknown }).AudioContext;
    else Object.defineProperty(globalThis, "AudioContext", original);
  });

  const audio = createPlayerAudioAdapter();
  assert.equal(await audio.unlock(), true);
  audio.setMuted(true);
  audio.setVolume(2);
  assert.deepEqual(audio.getSnapshot(), { muted: true, volume: 1, unlocked: true });
  audio.setVolume(-1);
  assert.equal(audio.getSnapshot().volume, 0);
  audio.dispose();
  assert.equal(closed, true);
  assert.equal(audio.getSnapshot().unlocked, false);
});
