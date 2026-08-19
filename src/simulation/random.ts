import type { RandomStreamState } from "./types.js";

const hashName = (seed: number, name: string): number => { let value = seed >>> 0; for (let index = 0; index < name.length; index += 1) value = Math.imul(value ^ name.charCodeAt(index), 16777619) >>> 0; return value === 0 ? 0x9e3779b9 : value; };
export const createRandomStreams = (seed: number, names: readonly string[]): readonly RandomStreamState[] => [...new Set(names)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((name) => ({ name, state: hashName(seed, name), consumed: 0 }));
export const consumeRandom = (stream: RandomStreamState): { readonly value: number; readonly stream: RandomStreamState } => { let state = stream.state >>> 0; state ^= state << 13; state ^= state >>> 17; state ^= state << 5; const next = state >>> 0; return { value: next, stream: { ...stream, state: next, consumed: stream.consumed + 1 } }; };
