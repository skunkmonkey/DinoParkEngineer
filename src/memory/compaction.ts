import { compactHistoryRequestSchema } from "./schemas.js";
import { canReadMemoryStore, canWriteMemoryStore } from "./authority.js";
import { cloneFreeze, diagnostic, entryKey, lexical, referenceKey } from "./diagnostics.js";
import type {
  CompactHistoryRequest,
  CompactHistoryResult,
  MemoryEntry,
  MemoryMutationFailure,
  MemoryPrincipal,
  MemoryReference,
  MemoryState,
  MemoryStore,
  MemoryMutationResult,
} from "./types.js";

export interface CompactHistoryAccess {
  readonly state: () => MemoryState;
  readonly append: (entry: MemoryEntry, principal?: MemoryPrincipal) => MemoryMutationResult;
  readonly getExact: (id: string, version: string) => MemoryEntry | undefined;
  readonly getStore: (id: string) => MemoryStore | undefined;
}

const fail = (code: MemoryMutationFailure["code"], diagnosticCode: "MEMORY_INVALID" | "MEMORY_SOURCES_UNAVAILABLE" | "MEMORY_SOURCES_OUT_OF_ORDER" | "MEMORY_FACT_CONFLICT" | "MEMORY_STORE_UNAVAILABLE" | "MEMORY_WRITE_UNAUTHORIZED", kind: "boundary" | "missing" | "authority" | "conflict", message: string, ids: readonly string[] = []): MemoryMutationFailure => ({
  ok: false,
  code,
  diagnostics: [diagnostic(diagnosticCode, kind, ids, message)],
});

const uniqueRefs = (references: readonly MemoryReference[]): MemoryReference[] => {
  const output: MemoryReference[] = [];
  const keys = new Set<string>();
  for (const reference of references) {
    if (!keys.has(referenceKey(reference))) {
      keys.add(referenceKey(reference));
      output.push(reference);
    }
  }
  return output;
};

const sourceRefs = (entries: readonly MemoryEntry[]): MemoryReference[] => entries.map((entry) => ({ id: entry.id, version: entry.version }));

const sourceLineage = (entries: readonly MemoryEntry[]): MemoryReference[] => uniqueRefs([
  ...sourceRefs(entries),
  ...entries.flatMap((entry) => entry.sourceLineage.map((reference) => ({ id: reference.id, version: reference.version }))),
  ...entries.flatMap((entry) => entry.summary?.lineage ?? []),
]);

const routeValues = (entries: readonly MemoryEntry[], key: "taskIds" | "agentIds" | "locationIds" | "entityIds" | "routeIds"): readonly string[] | undefined => {
  const values = [...new Set(entries.flatMap((entry) => entry.routing[key] ?? []))].sort(lexical);
  return values.length === 0 ? undefined : values;
};

export const compactHistory = (rawRequest: CompactHistoryRequest, access: CompactHistoryAccess): CompactHistoryResult => {
  const parsed = compactHistoryRequestSchema.safeParse(rawRequest);
  if (!parsed.success) return fail("MEMORY_INVALID", "MEMORY_INVALID", "boundary", "Compact History request failed schema validation.");
  const request = parsed.data;
  const store = access.getStore(request.storeId);
  if (store === undefined || !store.enabled) return fail("MEMORY_STORE_UNAVAILABLE", "MEMORY_STORE_UNAVAILABLE", "missing", `Memory store ${request.storeId} is unavailable.`);
  if (!canReadMemoryStore(store, request.principal)) return fail("MEMORY_WRITE_UNAUTHORIZED", "MEMORY_WRITE_UNAUTHORIZED", "authority", `Principal ${request.principal.id} cannot read Memory store ${request.storeId}.`);
  if (!canWriteMemoryStore(store, request.principal)) return fail("MEMORY_WRITE_UNAUTHORIZED", "MEMORY_WRITE_UNAUTHORIZED", "authority", `Principal ${request.principal.id} cannot write Memory store ${request.storeId}.`);

  const refs = request.sourceReferences ?? request.sourceEntries?.map((entry) => ({ id: entry.id, version: entry.version })) ?? [];
  const entries: MemoryEntry[] = [];
  for (const reference of refs) {
    const supplied = request.sourceEntries?.find((entry) => entry.id === reference.id && entry.version === reference.version);
    const exact = supplied ?? access.getExact(reference.id, reference.version);
    if (exact === undefined || exact.storeId !== request.storeId) return fail("MEMORY_SOURCES_UNAVAILABLE", "MEMORY_SOURCES_UNAVAILABLE", "missing", `Exact Compact History source ${referenceKey(reference)} is unavailable in ${request.storeId}.`, [reference.id]);
    entries.push(exact);
  }
  if (entries.length === 0) return fail("MEMORY_SOURCES_UNAVAILABLE", "MEMORY_SOURCES_UNAVAILABLE", "missing", "Compact History requires at least one exact source entry.");
  const order = [...entries].sort((left, right) => left.createdTick - right.createdTick || lexical(entryKey(left), entryKey(right)));
  if (order.some((entry, index) => entryKey(entry) !== entryKey(entries[index]!))) return fail("MEMORY_SOURCES_OUT_OF_ORDER", "MEMORY_SOURCES_OUT_OF_ORDER", "boundary", "Compact History sources must be supplied in deterministic creation order.", entries.map((entry) => entry.id));

  const preserved: Record<string, MemoryEntry["facts"][string]> = {};
  const preservePaths = [...new Set(request.rule.preserveFactPaths)].sort(lexical);
  for (const path of preservePaths) {
    for (const entry of entries) {
      const value = entry.facts[path];
      if (value === undefined) continue;
      if (preserved[path] !== undefined && preserved[path] !== value) return fail("MEMORY_INVALID", "MEMORY_FACT_CONFLICT", "conflict", `Fact ${path} conflicts while compacting exact sources.`, entries.map((entryValue) => entryValue.id));
      preserved[path] = value;
    }
  }
  const before = entries.reduce((sum, entry) => sum + entry.contextCost, 0);
  if (request.rule.contextCost >= before) return fail("MEMORY_INVALID", "MEMORY_INVALID", "boundary", "Compact History must produce a smaller context cost than its source history.", entries.map((entry) => entry.id));

  const lineage = sourceLineage(entries);
  const summaryId = request.summaryId ?? `memory:summary-${request.rule.id.replace(/[^A-Za-z0-9._-]/gu, "-")}-${request.rule.version}-${entries.map((entry) => `${entry.id.replace(/[^A-Za-z0-9._-]/gu, "-")}-${entry.version}`).join("-")}`;
  const summaryVersion = request.summaryVersion ?? request.rule.version;
  const existing = access.getExact(summaryId, summaryVersion);
  if (existing !== undefined) return cloneFreeze({
    ok: true,
    status: "compacted",
    summary: existing,
    sourceEntries: entries,
    preservedFacts: existing.facts,
    lostDetailClasses: existing.summary?.lostDetailClasses ?? request.rule.lostDetailClasses,
    contextCostBefore: before,
    contextCostAfter: existing.contextCost,
    lineage: existing.summary?.lineage ?? lineage,
    contextRetention: { kind: "compacted", contextItemIds: entries.flatMap((entry) => entry.sourceItems.map((source) => source.itemId ?? source.id)), reasonCode: "MEMORY_COMPACTED", memoryEntries: [{ id: existing.id, version: existing.version }] },
  });
  const first = entries[0]!;
  const summary: MemoryEntry = cloneFreeze({
    id: summaryId,
    version: summaryVersion,
    storeId: request.storeId,
    scope: request.rule.summaryScope ?? first.scope,
    scopeId: request.rule.summaryScopeId ?? first.scopeId,
    sourceItems: sourceRefs(entries),
    sourceLineage: lineage.map((reference) => ({ id: reference.id, version: reference.version })),
    createdTick: request.createdTick,
    ...(request.observedWorldTick === undefined ? {} : { observedWorldTick: request.observedWorldTick }),
    author: request.rule.author,
    producer: request.rule.producer,
    confidence: "medium",
    priority: Math.max(...entries.map((entry) => entry.priority)),
    tags: [...new Set(request.rule.tags ?? entries.flatMap((entry) => entry.tags))].sort(lexical),
    facts: preserved,
    routing: {
      ...(routeValues(entries, "taskIds") === undefined ? {} : { taskIds: routeValues(entries, "taskIds") }),
      ...(routeValues(entries, "agentIds") === undefined ? {} : { agentIds: routeValues(entries, "agentIds") }),
      ...(routeValues(entries, "locationIds") === undefined ? {} : { locationIds: routeValues(entries, "locationIds") }),
      ...(routeValues(entries, "entityIds") === undefined ? {} : { entityIds: routeValues(entries, "entityIds") }),
      ...(routeValues(entries, "routeIds") === undefined ? {} : { routeIds: routeValues(entries, "routeIds") }),
    },
    provenance: {
      source: "memory:compact-history",
      sourceItems: sourceRefs(entries),
      transformation: { kind: "compact-history", rule: { id: request.rule.id, version: request.rule.version }, sources: sourceRefs(entries), createdTick: request.createdTick, producer: request.rule.producer },
      author: request.rule.author,
    },
    contextCost: request.rule.contextCost,
    summary: {
      rule: { id: request.rule.id, version: request.rule.version },
      sourceReferences: sourceRefs(entries),
      sourceRange: { firstTick: Math.min(...entries.map((entry) => entry.createdTick)), lastTick: Math.max(...entries.map((entry) => entry.createdTick)) },
      preservedFactPaths: preservePaths,
      preservedFacts: preserved,
      lostDetailClasses: [...new Set(request.rule.lostDetailClasses)].sort(lexical),
      contextCostBefore: before,
      contextCostAfter: request.rule.contextCost,
      lineage,
    },
  });
  const stored = access.append(summary, request.principal);
  if (!stored.ok) return stored;
  return cloneFreeze({
    ok: true,
    status: "compacted",
    summary: stored.entry,
    sourceEntries: entries,
    preservedFacts: preserved,
    lostDetailClasses: [...new Set(request.rule.lostDetailClasses)].sort(lexical),
    contextCostBefore: before,
    contextCostAfter: stored.entry.contextCost,
    lineage,
    contextRetention: { kind: "compacted", contextItemIds: entries.flatMap((entry) => entry.sourceItems.map((source) => source.itemId ?? source.id)), reasonCode: "MEMORY_COMPACTED", memoryEntries: [{ id: stored.entry.id, version: stored.entry.version }] },
  });
};

export const compactHistoryReducer = (entries: readonly MemoryEntry[], rule: CompactHistoryRequest["rule"]): Readonly<Record<string, MemoryEntry["facts"][string]>> => {
  const result: Record<string, MemoryEntry["facts"][string]> = {};
  for (const path of [...new Set(rule.preserveFactPaths)].sort(lexical)) {
    const found = entries.map((entry) => entry.facts[path]).find((value) => value !== undefined);
    if (found !== undefined) result[path] = found;
  }
  return cloneFreeze(result);
};

