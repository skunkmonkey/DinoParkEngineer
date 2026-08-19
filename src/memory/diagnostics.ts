import type { MemoryDiagnostic, MemoryDiagnosticCode, MemoryDiagnosticKind, MemoryDiagnosticsInput, MemoryEntry, MemoryReference } from "./types.js";

export const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const cloneFreeze = <T>(value: T): T => {
  const clone = structuredClone(value);
  const freeze = (entry: unknown): void => {
    if (entry !== null && typeof entry === "object") {
      Object.freeze(entry);
      for (const child of Object.values(entry)) freeze(child);
    }
  };
  freeze(clone);
  return clone;
};

export const referenceKey = (reference: MemoryReference): string => `${reference.id}@${reference.version}`;

export const entryKey = (entry: Pick<MemoryEntry, "id" | "version">): string => `${entry.id}@${entry.version}`;

export const diagnostic = (
  code: MemoryDiagnosticCode,
  kind: MemoryDiagnosticKind,
  entryIds: readonly string[],
  message: string,
  references?: readonly MemoryReference[],
): MemoryDiagnostic => cloneFreeze({
  code,
  kind,
  entryIds: [...new Set(entryIds)].sort(lexical),
  ...(references === undefined ? {} : { references: [...references].sort((left, right) => referenceKey(left).localeCompare(referenceKey(right), "en", { sensitivity: "variant" })) }),
  message,
});

export const sortEntries = <T extends Pick<MemoryEntry, "id" | "version">>(entries: readonly T[]): T[] =>
  [...entries].sort((left, right) => lexical(entryKey(left), entryKey(right)));

export const normalizeScope = (scope: MemoryEntry["scope"]): string => scope.toLowerCase();

export const immutableEntries = (entries: readonly MemoryEntry[]): readonly MemoryEntry[] =>
  cloneFreeze(sortEntries(entries));

export const immutableState = <T>(value: T): T => cloneFreeze(value);

/**
 * Inspect a store without retrieving anything. This projection is useful for
 * history/diagnostic surfaces and deliberately does not grant Agent access to
 * any entry.
 */
export const memoryDiagnostics = (input: MemoryDiagnosticsInput): readonly MemoryDiagnostic[] => {
  const output: MemoryDiagnostic[] = [];
  const entries = [...input.entries].sort((left, right) => lexical(entryKey(left), entryKey(right)));
  const known = new Set((input.knownReferences ?? entries.map((entry) => ({ id: entry.id, version: entry.version }))).map(referenceKey));
  const duplicates = new Map<string, string[]>();
  const conflicts = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    if (input.currentTick !== undefined && ((entry.staleAtTick !== undefined && input.currentTick >= entry.staleAtTick) || (entry.observedWorldTick !== undefined && input.currentTick > entry.observedWorldTick))) output.push(diagnostic("MEMORY_STALE", "stale", [entry.id], `Memory entry ${entryKey(entry)} is stale at tick ${input.currentTick}.`));
    if (entry.supersededBy !== undefined) output.push(diagnostic("MEMORY_SUPERSEDED", "superseded", [entry.id], `Memory entry is superseded by ${referenceKey(entry.supersededBy)}.`, [entry.supersededBy]));
    if (entry.routing.locationIds === undefined && entry.routing.entityIds === undefined && entry.routing.taskIds === undefined) output.push(diagnostic("MEMORY_BROAD_ROUTE", "broad", [entry.id], "Memory entry declares no task, location, or entity route."));
    if (entry.duplicateKey !== undefined) duplicates.set(entry.duplicateKey, [...(duplicates.get(entry.duplicateKey) ?? []), entry.id]);
    if (entry.conflictKey !== undefined) conflicts.set(entry.conflictKey, [...(conflicts.get(entry.conflictKey) ?? []), entry]);
    for (const source of entry.sourceLineage) if (!known.has(referenceKey(source))) output.push(diagnostic("MEMORY_SOURCES_UNAVAILABLE", "missing", [entry.id], `Source lineage ${referenceKey(source)} is unavailable.`, [source]));
  }
  for (const ids of duplicates.values()) if (ids.length > 1) output.push(diagnostic("MEMORY_DUPLICATE", "duplicate", ids, "Memory entries share an authored duplicate key."));
  for (const group of conflicts.values()) if (group.length > 1 && new Set(group.map((entry) => JSON.stringify(entry.facts))).size > 1) output.push(diagnostic("MEMORY_CONFLICT", "conflict", group.map((entry) => entry.id), "Memory entries share an authored conflict key but disagree."));
  return cloneFreeze(output.sort((left, right) => lexical(`${left.code}:${left.entryIds.join(",")}`, `${right.code}:${right.entryIds.join(",")}`)));
};

