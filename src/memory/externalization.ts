import { memoryExternalizationRuleSchema } from "./schemas.js";
import { canWriteMemoryStore } from "./authority.js";
import { cloneFreeze, diagnostic } from "./diagnostics.js";
import type {
  MemoryEntry,
  MemoryExternalizationRequest,
  MemoryExternalizationResult,
  MemoryMutationFailure,
  MemoryStore,
  MemoryRepositoryAccess,
  MemorySourceReference,
} from "./types.js";

const sanitize = (value: string): string => value.replace(/[^A-Za-z0-9._-]/gu, "-");

const sourceReference = (request: MemoryExternalizationRequest): MemorySourceReference => ({
  id: request.contextItem.id,
  version: request.contextItem.sourceVersion.version,
  itemId: request.contextItem.id,
  sourceVersion: { id: request.contextItem.sourceVersion.id, version: request.contextItem.sourceVersion.version },
});

const failure = (code: MemoryMutationFailure["code"], message: string, entryIds: readonly string[] = []): MemoryMutationFailure => ({
  ok: false,
  code,
  diagnostics: [diagnostic(code === "MEMORY_EXTERNALIZATION_FAILED" ? "MEMORY_INVALID" : code === "MEMORY_NOT_ELIGIBLE" ? "MEMORY_MISSING_ROUTE" : code === "MEMORY_WRITE_UNAUTHORIZED" ? "MEMORY_WRITE_UNAUTHORIZED" : code === "MEMORY_STORE_UNAVAILABLE" ? "MEMORY_STORE_UNAVAILABLE" : "MEMORY_INVALID", code === "MEMORY_WRITE_UNAUTHORIZED" ? "authority" : code === "MEMORY_STORE_UNAVAILABLE" ? "missing" : "boundary", entryIds, message)],
});

export const externalizeContextItem = (
  request: MemoryExternalizationRequest,
  access: MemoryRepositoryAccess & { readonly getStore: (id: string) => MemoryStore | undefined },
): MemoryExternalizationResult => {
  const parsedRule = memoryExternalizationRuleSchema.safeParse(request.rule);
  if (!parsedRule.success) return failure("MEMORY_INVALID", "Externalization rule failed schema validation.");
  const rule = parsedRule.data;
  const item = request.contextItem;
  if (!item.retentionEligible || !rule.eligibleCategories.includes(item.category)) return failure("MEMORY_NOT_ELIGIBLE", `Context item ${item.id} is not eligible for this Externalize and Retrieve rule.`, [item.id]);
  const store = access.getStore(rule.targetStoreId);
  if (store === undefined || !store.enabled) return failure("MEMORY_STORE_UNAVAILABLE", `Memory store ${rule.targetStoreId} is unavailable.`, [item.id]);
  if (!canWriteMemoryStore(store, request.principal)) return failure("MEMORY_WRITE_UNAUTHORIZED", `Principal ${request.principal.id} cannot externalize into ${store.id}.`, [item.id]);

  const source = sourceReference(request);
  const facts: Record<string, typeof item.payload.facts[string]> = {};
  const factPaths = rule.mode === "full-item" ? Object.keys(item.payload.facts).sort() : [...(rule.factPaths ?? [])].sort();
  for (const path of factPaths) {
    const value = item.payload.facts[path];
    if (value !== undefined) facts[path] = value;
  }
  const entryId = request.entryId ?? `memory:${sanitize(rule.targetStoreId)}-${sanitize(item.id)}`;
  const entryVersion = request.entryVersion ?? rule.version;
  const entry: MemoryEntry = cloneFreeze({
    id: entryId,
    version: entryVersion,
    storeId: rule.targetStoreId,
    scope: rule.scope,
    scopeId: rule.scopeId,
    sourceItems: [source],
    sourceLineage: [source],
    createdTick: request.createdTick,
    ...(request.observedWorldTick === undefined ? {} : { observedWorldTick: request.observedWorldTick }),
    author: rule.author,
    producer: rule.producer,
    confidence: rule.confidence ?? "medium",
    priority: rule.priority ?? item.priority,
    tags: [...new Set(rule.tags)].sort(),
    facts,
    routing: rule.routing ?? { routeIds: [item.provenance.routeId] },
    provenance: {
      source: item.provenance.source,
      sourceItems: [source],
      transformation: { kind: "externalize", rule: { id: rule.id, version: rule.version }, sources: [source], createdTick: request.createdTick, producer: rule.producer },
      author: rule.author,
    },
    contextCost: rule.contextCost ?? item.cost,
  });
  const stored = access.append(entry, request.principal);
  if (!stored.ok) return stored.code === "MEMORY_WRITE_UNAUTHORIZED" ? stored : failure("MEMORY_EXTERNALIZATION_FAILED", `Memory storage failed for ${entry.id}@${entry.version}; Context must retain ${item.id}.`, [item.id]);
  return cloneFreeze({
    ok: true,
    status: "externalized",
    entry: stored.entry,
    contextRetention: { kind: "externalized", contextItemIds: [item.id], reasonCode: "MEMORY_EXTERNALIZED", memoryEntries: [{ id: stored.entry.id, version: stored.entry.version }] },
    ...(request.sourceManifestId === undefined ? {} : { sourceManifestId: request.sourceManifestId }),
  });
};

export const externalizeAndRetrievePort = (access: MemoryRepositoryAccess & { readonly getStore: (id: string) => MemoryStore | undefined }): {
  readonly externalize: (request: MemoryExternalizationRequest) => MemoryExternalizationResult;
} => Object.freeze({ externalize: (request: MemoryExternalizationRequest) => externalizeContextItem(request, access) });
