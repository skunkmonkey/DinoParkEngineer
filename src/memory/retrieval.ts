import { memoryRetrievalQuerySchema } from "./schemas.js";
import { canReadMemoryStore } from "./authority.js";
import { cloneFreeze, diagnostic, entryKey, lexical, normalizeScope, referenceKey } from "./diagnostics.js";
import type {
  MemoryDiagnostic,
  MemoryEntry,
  MemoryPredicate,
  MemoryReference,
  MemoryResultRecord,
  MemoryRetrievalQuery,
  MemoryRetrievalResult,
  MemoryState,
  MemoryRankingRule,
} from "./types.js";

const confidenceValue: Record<MemoryEntry["confidence"], number> = { unknown: 0, low: 1, medium: 2, high: 3 };

const record = (entry: MemoryEntry | undefined, reference: MemoryReference, reasonCode: string, reason: string, rank?: number): MemoryResultRecord => ({
  ...(entry === undefined ? {} : { entry }),
  reference,
  contextCost: entry?.contextCost ?? 0,
  reasonCode,
  reason,
  ...(rank === undefined ? {} : { rank }),
});

const inRange = (value: number | undefined, min: number | undefined, max: number | undefined): boolean =>
  value !== undefined && (min === undefined || value >= min) && (max === undefined || value <= max);

const routeIncludes = (values: readonly string[] | undefined, expected: string): boolean => values?.includes(expected) === true;

const predicateResult = (entry: MemoryEntry, predicate: MemoryPredicate): { readonly ok: boolean; readonly code: string; readonly reason: string } => {
  switch (predicate.kind) {
    case "task": return { ok: routeIncludes(entry.routing.taskIds, predicate.taskId), code: "MEMORY_MISSING_ROUTE", reason: `Task route ${predicate.taskId} was not declared.` };
    case "agent": return { ok: routeIncludes(entry.routing.agentIds, predicate.agentId), code: "MEMORY_MISROUTED", reason: `Agent route ${predicate.agentId} was not declared.` };
    case "location": return { ok: routeIncludes(entry.routing.locationIds, predicate.locationId), code: "MEMORY_MISROUTED", reason: `Location route ${predicate.locationId} was not declared.` };
    case "entity": return { ok: routeIncludes(entry.routing.entityIds, predicate.entityId), code: "MEMORY_MISROUTED", reason: `Entity route ${predicate.entityId} was not declared.` };
    case "tag": {
      const has = entry.tags.includes(predicate.tag);
      const ok = predicate.mode === "missing" ? !has : has;
      return { ok, code: "MEMORY_MISROUTED", reason: predicate.mode === "missing" ? `Tag ${predicate.tag} is present.` : `Tag ${predicate.tag} is absent.` };
    }
    case "scope": return {
      ok: normalizeScope(entry.scope) === normalizeScope(predicate.scope) && (predicate.scopeId === undefined || entry.scopeId === predicate.scopeId),
      code: "MEMORY_MISROUTED",
      reason: `Memory scope ${String(entry.scope)}:${entry.scopeId} does not match the requested scope.`,
    };
    case "created-tick": return { ok: inRange(entry.createdTick, predicate.min, predicate.max), code: "MEMORY_MISROUTED", reason: "Creation tick is outside the requested range." };
    case "observed-world-tick": return { ok: inRange(entry.observedWorldTick, predicate.min, predicate.max), code: "MEMORY_MISROUTED", reason: "Observed world tick is outside the requested range." };
    case "exact-version": return { ok: entry.id === predicate.id && entry.version === predicate.version, code: "MEMORY_EXACT_VERSION_UNAVAILABLE", reason: `Exact Memory version ${predicate.id}@${predicate.version} was requested.` };
    case "fact-equals": return { ok: entry.facts[predicate.path] === predicate.value, code: "MEMORY_MISROUTED", reason: `Fact ${predicate.path} does not equal the requested value.` };
  }
};

const queryMatches = (entry: MemoryEntry, query: MemoryRetrievalQuery): { readonly ok: boolean; readonly code: string; readonly reason: string } => {
  const direct: readonly MemoryPredicate[] = [
    ...(query.taskId === undefined ? [] : [{ kind: "task", taskId: query.taskId } as const]),
    ...(query.agentId === undefined ? [] : [{ kind: "agent", agentId: query.agentId } as const]),
    ...(query.locationId === undefined ? [] : [{ kind: "location", locationId: query.locationId } as const]),
    ...(query.entityId === undefined ? [] : [{ kind: "entity", entityId: query.entityId } as const]),
    ...(query.tags ?? []).map((tag) => ({ kind: "tag", tag } as const)),
    ...(query.scopes ?? []).map((scope) => ({ kind: "scope", scope: scope.scope, ...(scope.scopeId === undefined ? {} : { scopeId: scope.scopeId }) } as const)),
  ];
  for (const predicate of [...direct, ...(query.predicates ?? [])]) {
    const result = predicateResult(entry, predicate);
    if (!result.ok) return result;
  }
  return { ok: true, code: "CONSIDERED", reason: "All explicit retrieval predicates matched." };
};

const stale = (entry: MemoryEntry, query: MemoryRetrievalQuery): boolean => {
  const tick = query.currentTick ?? query.currentWorldTick;
  if (tick === undefined) return false;
  if (entry.staleAtTick !== undefined && tick >= entry.staleAtTick) return true;
  return entry.observedWorldTick !== undefined && query.staleAfterTicks !== undefined && tick - entry.observedWorldTick >= query.staleAfterTicks;
};

const routeBroad = (entry: MemoryEntry, query: MemoryRetrievalQuery): boolean => {
  if (query.locationId !== undefined && (entry.routing.locationIds === undefined || entry.routing.locationIds.length === 0)) return true;
  if (query.entityId !== undefined && (entry.routing.entityIds === undefined || entry.routing.entityIds.length === 0)) return true;
  return false;
};

const rankingValue = (entry: MemoryEntry, field: MemoryRankingRule["field"], query: MemoryRetrievalQuery): number | string => {
  switch (field) {
    case "priority": return entry.priority;
    case "confidence": return confidenceValue[entry.confidence];
    case "createdTick": return entry.createdTick;
    case "observedWorldTick": return entry.observedWorldTick ?? -1;
    case "scopeSpecificity": return (entry.routing.locationIds?.length ?? 0) + (entry.routing.entityIds?.length ?? 0) + (entry.routing.taskIds?.length ?? 0);
    case "tagMatchCount": return (query.tags ?? []).filter((tag) => entry.tags.includes(tag)).length;
  }
};

const compareEntries = (left: MemoryEntry, right: MemoryEntry, query: MemoryRetrievalQuery): number => {
  const rules = query.ranking ?? [
    { field: "priority", direction: "desc" },
    { field: "observedWorldTick", direction: "desc" },
    { field: "createdTick", direction: "desc" },
  ] as const;
  for (const rule of rules) {
    const leftValue = rankingValue(left, rule.field, query);
    const rightValue = rankingValue(right, rule.field, query);
    const compared = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : lexical(String(leftValue), String(rightValue));
    if (compared !== 0) return rule.direction === "asc" ? compared : -compared;
  }
  return lexical(entryKey(left), entryKey(right));
};

const exactVersionUnavailable = (entries: readonly MemoryEntry[], query: MemoryRetrievalQuery): MemoryResultRecord[] => {
  const output: MemoryResultRecord[] = [];
  for (const requested of query.exactVersions ?? []) {
    const exact = entries.some((entry) => entry.id === requested.id && entry.version === requested.version);
    if (!exact) output.push(record(undefined, requested, "MEMORY_EXACT_VERSION_UNAVAILABLE", `Exact Memory version ${referenceKey(requested)} is unavailable.`));
  }
  return output;
};

const conflictGroups = (entries: readonly MemoryEntry[]): MemoryEntry[][] => {
  const groups = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    // Facts from different observations are allowed to change over time. An
    // authored conflict key is the explicit declaration that two entries are
    // competing claims; we never infer conflict merely from a changed fact.
    if (entry.conflictKey !== undefined) groups.set(`key:${entry.conflictKey}`, [...(groups.get(`key:${entry.conflictKey}`) ?? []), entry]);
    const routeIdentity = JSON.stringify({ scope: entry.scope, scopeId: entry.scopeId, taskIds: entry.routing.taskIds ?? [], locationIds: entry.routing.locationIds ?? [], entityIds: entry.routing.entityIds ?? [] });
    for (const path of Object.keys(entry.facts)) {
      const key = `fact:${routeIdentity}:${path}`;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
  }
  return [...groups.entries()]
    .filter(([key, group]) => group.length > 1 && (key.startsWith("key:") || new Set(group.map((entry) => entry.facts[key.slice(key.lastIndexOf(":") + 1)])).size > 1))
    .map(([, group]) => group);
};

const duplicateGroups = (entries: readonly MemoryEntry[]): MemoryEntry[][] => {
  const groups = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    if (entry.duplicateKey !== undefined) groups.set(entry.duplicateKey, [...(groups.get(entry.duplicateKey) ?? []), entry]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
};

const diagnosticSort = (left: MemoryDiagnostic, right: MemoryDiagnostic): number => lexical(`${left.code}:${left.entryIds.join(",")}`, `${right.code}:${right.entryIds.join(",")}`);

export const retrieveMemory = (state: MemoryState, rawQuery: MemoryRetrievalQuery): MemoryRetrievalResult => {
  const parsed = memoryRetrievalQuerySchema.safeParse(rawQuery);
  if (!parsed.success) return cloneFreeze({ ok: false, query: rawQuery, selected: [], considered: [], rejected: [], unavailable: [], conflicting: [], diagnostics: [diagnostic("MEMORY_INVALID", "boundary", [], "Memory retrieval query failed schema validation.")], contextCost: 0 });
  const query = { ...parsed.data, principal: parsed.data.principal ?? { id: parsed.data.agentId ?? "agent:anonymous" } };
  const requestedStores = query.storeIds === undefined ? undefined : new Set(query.storeIds);
  const allowedEntries: MemoryEntry[] = [];
  const unavailable: MemoryResultRecord[] = [];
  for (const entry of [...state.entries].sort((left, right) => lexical(entryKey(left), entryKey(right)))) {
    if (requestedStores !== undefined && !requestedStores.has(entry.storeId)) continue;
    const store = state.stores.find((candidate) => candidate.id === entry.storeId);
    if (store === undefined || !canReadMemoryStore(store, query.principal)) {
      unavailable.push(record(entry, { id: entry.id, version: entry.version }, store === undefined ? "MEMORY_STORE_UNAVAILABLE" : "MEMORY_READ_UNAUTHORIZED", store === undefined ? `Memory store ${entry.storeId} is unavailable.` : `Principal ${query.principal.id} cannot read Memory store ${entry.storeId}.`));
      continue;
    }
    const exactIds = new Set((query.exactVersions ?? []).map((reference) => reference.id));
    if (exactIds.size > 0 && !query.exactVersions?.some((reference) => reference.id === entry.id && reference.version === entry.version)) {
      unavailable.push(record(entry, { id: entry.id, version: entry.version }, "MEMORY_EXACT_VERSION_UNAVAILABLE", `A different exact version of ${entry.id} was requested.`));
      continue;
    }
    allowedEntries.push(entry);
  }
  unavailable.push(...exactVersionUnavailable(state.entries, query));

  const considered = allowedEntries.map((entry) => record(entry, { id: entry.id, version: entry.version }, "CONSIDERED", "Memory entry was readable and considered."));
  const rejected: MemoryResultRecord[] = [];
  const matched: MemoryEntry[] = [];
  for (const entry of allowedEntries) {
    const match = queryMatches(entry, query);
    if (!match.ok) rejected.push(record(entry, { id: entry.id, version: entry.version }, match.code, match.reason));
    else if (query.includeSuperseded === false && entry.supersededBy !== undefined) rejected.push(record(entry, { id: entry.id, version: entry.version }, "MEMORY_SUPERSEDED", `Memory entry is superseded by ${referenceKey(entry.supersededBy)}.`));
    else matched.push(entry);
  }
  const diagnostics: MemoryDiagnostic[] = [];
  const conflicting = new Set<string>();
  for (const group of conflictGroups(matched)) {
    const ids = group.map((entry) => entry.id);
    group.forEach((entry) => conflicting.add(entryKey(entry)));
    diagnostics.push(diagnostic("MEMORY_CONFLICT", "conflict", ids, "Readable Memory entries contain conflicting facts."));
  }
  for (const group of duplicateGroups(matched)) diagnostics.push(diagnostic("MEMORY_DUPLICATE", "duplicate", group.map((entry) => entry.id), "Multiple readable Memory entries share an authored duplicate key."));
  for (const entry of matched) {
    if (stale(entry, query)) diagnostics.push(diagnostic("MEMORY_STALE", "stale", [entry.id], `Memory entry ${entryKey(entry)} is stale at the requested tick.`));
    if (entry.supersededBy !== undefined) diagnostics.push(diagnostic("MEMORY_SUPERSEDED", "superseded", [entry.id], `Memory entry is superseded by ${referenceKey(entry.supersededBy)}.`));
    if (routeBroad(entry, query)) diagnostics.push(diagnostic("MEMORY_BROAD_ROUTE", "broad", [entry.id], "Readable Memory route is broader than the requested location or entity."));
  }
  const ranked = matched.filter((entry) => !conflicting.has(entryKey(entry))).sort((left, right) => compareEntries(left, right, query));
  const selected: MemoryResultRecord[] = [];
  ranked.forEach((entry, index) => {
    if (index < query.limit) selected.push(record(entry, { id: entry.id, version: entry.version }, "SELECTED", "Selected by deterministic retrieval ranking and limit.", index + 1));
    else rejected.push(record(entry, { id: entry.id, version: entry.version }, "MEMORY_LIMIT_EXCEEDED", "Entry matched but exceeded the retrieval limit."));
  });
  const conflictingRecords = [...conflicting].map((key) => matched.find((entry) => entryKey(entry) === key)).filter((entry): entry is MemoryEntry => entry !== undefined).sort((left, right) => compareEntries(left, right, query)).map((entry) => record(entry, { id: entry.id, version: entry.version }, "MEMORY_CONFLICT", "Entry was withheld because a matching fact conflicts."));
  return cloneFreeze({
    ok: true,
    query,
    selected,
    considered,
    rejected: rejected.sort((left, right) => lexical(referenceKey(left.reference), referenceKey(right.reference))),
    unavailable: unavailable.sort((left, right) => lexical(referenceKey(left.reference), referenceKey(right.reference))),
    conflicting: conflictingRecords,
    diagnostics: diagnostics.sort(diagnosticSort),
    contextCost: selected.reduce((sum, item) => sum + item.contextCost, 0),
  });
};

export const memoryRetrievalPredicates = (query: MemoryRetrievalQuery): readonly MemoryPredicate[] => cloneFreeze(query.predicates ?? []);
