/** Deterministic JSON helpers used by replay, tests, and persistence adapters. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)) as T;
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item !== undefined) result[key] = canonicalize(item);
    }
    return result as T;
  }
  return value;
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Freeze recursively so consumers cannot mutate an authoritative result. */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

/** Locale-independent UTF-16 code-unit ordering for replay-stable ids. */
export function compareStable(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortById<T extends { id: string }>(values: readonly T[]): T[] {
  return values.slice().sort((a, b) => compareStable(a.id, b.id));
}
