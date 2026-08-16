import { deepClone, deepFreeze, canonicalSerialize } from "../simulation/index.ts";
import type { MemoryRecord, MemoryRepository } from "./types.ts";

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

/** Small deterministic repository used by the MVP and unit tests. */
export function createMemoryRepository(initial: readonly MemoryRecord[] = []): MemoryRepository {
  const records = new Map<string, MemoryRecord>();
  for (const record of initial.toSorted(compareMemory)) records.set(record.id, cloneFreeze(record));

  return {
    get: (id) => records.get(id),
    list: () => cloneFreeze([...records.values()].sort(compareMemory)),
    put: (record) => records.set(record.id, cloneFreeze(record)),
    replace: (next) => {
      records.clear();
      for (const record of [...next].sort(compareMemory)) records.set(record.id, cloneFreeze(record));
    },
  };
}

export function compareMemory(a: Pick<MemoryRecord, "id" | "observedAt">, b: Pick<MemoryRecord, "id" | "observedAt">): number {
  // Newer observations first makes direct observation precedence and retrieval
  // diagnostics easy to inspect; the id tie-break makes it replay-stable.
  return b.observedAt - a.observedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function canonicalMemory(record: MemoryRecord): string {
  return canonicalSerialize(record);
}
