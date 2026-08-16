import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { TraceEventRecord, TraceIntegrityResult, TraceRecord } from "./types.ts";

/** Stable non-cryptographic digest for local integrity checks. It is
 * intentionally synchronous and available in browser, worker, and Node
 * runtimes; canonical serialization provides the ordering guarantee. */
export function stableHash(value: unknown): string {
  const text = typeof value === "string" ? value : canonicalSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function canonicalTraceEvent(event: TraceEventRecord): string {
  return canonicalSerialize(event);
}

export function canonicalTraceEvents(events: readonly TraceEventRecord[]): string {
  return canonicalSerialize(events);
}

export function traceEventsHash(events: readonly TraceEventRecord[]): string {
  return stableHash(canonicalTraceEvents(events));
}

export function snapshotHash(snapshot: unknown): string {
  return stableHash(snapshot);
}

export function canonicalTrace(record: TraceRecord): string {
  return canonicalSerialize(record);
}

export function traceHash(record: TraceRecord): string {
  const withoutCanonicalHash = { ...record } as Record<string, unknown>;
  delete withoutCanonicalHash.canonicalHash;
  return stableHash(canonicalSerialize(withoutCanonicalHash));
}

/** Recompute stored hashes without trusting persisted hash fields. This is the
 * corruption check used by persistence adapters and trace diagnostics. */
export function verifyTraceIntegrity(record: TraceRecord): TraceIntegrityResult {
  const expectedEventHash = traceEventsHash(record.events);
  const actualEventHash = record.canonicalEventHash;
  const withExpectedEventHash = { ...record, canonicalEventHash: expectedEventHash } as TraceRecord;
  const expectedCanonicalHash = traceHash(withExpectedEventHash);
  const actualCanonicalHash = record.canonicalHash;
  const reason = expectedEventHash !== actualEventHash ? "EVENT_HASH_MISMATCH" : expectedCanonicalHash !== actualCanonicalHash ? "TRACE_HASH_MISMATCH" : undefined;
  return { ok: reason === undefined, expectedEventHash, expectedCanonicalHash, actualEventHash, actualCanonicalHash, ...(reason ? { reason } : {}) };
}

export function cloneFrozen<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

/** Find the first observable canonical difference. The returned path is
 * intentionally a field path, never a hidden reasoning explanation. */
export function firstCanonicalDifference(expected: unknown, actual: unknown, path = "$", index?: number): { readonly field: string; readonly expected: unknown; readonly actual: unknown; readonly index?: number } | undefined {
  if (Object.is(expected, actual)) return undefined;
  if (typeof expected !== typeof actual || expected === null || actual === null) return { field: path, expected, actual, ...(index === undefined ? {} : { index }) };
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return { field: path, expected, actual, ...(index === undefined ? {} : { index }) };
    const length = Math.max(expected.length, actual.length);
    for (let childIndex = 0; childIndex < length; childIndex += 1) {
      if (childIndex >= expected.length || childIndex >= actual.length) return { field: `${path}[${childIndex}]`, expected: expected[childIndex], actual: actual[childIndex], index: childIndex };
      const difference = firstCanonicalDifference(expected[childIndex], actual[childIndex], `${path}[${childIndex}]`, childIndex);
      if (difference) return difference;
    }
    return undefined;
  }
  if (typeof expected === "object" && typeof actual === "object") {
    const expectedRecord = expected as Record<string, unknown>;
    const actualRecord = actual as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)])].sort();
    for (const key of keys) {
      const difference = firstCanonicalDifference(expectedRecord[key], actualRecord[key], `${path}.${key}`, index);
      if (difference) return difference;
    }
    return undefined;
  }
  return { field: path, expected, actual, ...(index === undefined ? {} : { index }) };
}
