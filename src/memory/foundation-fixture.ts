import type { ContextItem } from "../context/public.js";
import { createMemoryRepository, createMemoryStore } from "./repository.js";
import type {
  CompactHistoryRequest,
  MemoryEntry,
  MemoryExternalizationRule,
  MemoryRetrievalQuery,
  MemoryStore,
} from "./types.js";

const source = (id: string, version = "1.0.0") => ({ id, version, itemId: id, sourceVersion: { id: `content:${id.split(":")[1] ?? "item"}`, version } });

const entry = (input: Pick<MemoryEntry, "id" | "version" | "storeId" | "scope" | "scopeId" | "createdTick" | "facts" | "tags" | "routing"> & Partial<Pick<MemoryEntry, "observedWorldTick" | "supersededBy" | "supersedes" | "conflictKey" | "duplicateKey" | "contextCost" | "priority" | "confidence">>): MemoryEntry => {
  const sourceItem = source(input.id);
  return {
    id: input.id,
    version: input.version,
    storeId: input.storeId,
    scope: input.scope,
    scopeId: input.scopeId,
    sourceItems: [sourceItem],
    sourceLineage: [sourceItem],
    createdTick: input.createdTick,
    ...(input.observedWorldTick === undefined ? {} : { observedWorldTick: input.observedWorldTick }),
    author: "Park Developer",
    producer: "fixture",
    confidence: input.confidence ?? "high",
    priority: input.priority ?? 0,
    tags: input.tags,
    facts: input.facts,
    routing: input.routing,
    ...(input.supersededBy === undefined ? {} : { supersededBy: input.supersededBy }),
    ...(input.supersedes === undefined ? {} : { supersedes: input.supersedes }),
    ...(input.conflictKey === undefined ? {} : { conflictKey: input.conflictKey }),
    ...(input.duplicateKey === undefined ? {} : { duplicateKey: input.duplicateKey }),
    contextCost: input.contextCost ?? 2,
    provenance: {
      source: "fixture:memory",
      sourceItems: [sourceItem],
      transformation: { kind: "manual", sources: [sourceItem], createdTick: input.createdTick, producer: "fixture" },
      author: "Park Developer",
    },
  };
};

const store = (input: Omit<MemoryStore, "entries"> & { entries?: readonly MemoryEntry[] }): MemoryStore => createMemoryStore(input);

export interface MemoryFoundationFixture {
  readonly stores: readonly MemoryStore[];
  readonly entries: readonly MemoryEntry[];
  readonly repository: ReturnType<typeof createMemoryRepository>;
  readonly contextItem: ContextItem;
  readonly externalization: MemoryExternalizationRule;
  readonly retrieval: MemoryRetrievalQuery;
  readonly retrievalMiss: MemoryRetrievalQuery;
  readonly staleSharedMemory: MemoryRetrievalQuery;
  readonly compaction: CompactHistoryRequest;
}

export const createMemoryFoundationFixture = (): MemoryFoundationFixture => {
  const gate = entry({ id: "memory:gate-note", version: "1.0.0", storeId: "memory:enclosure-gate", scope: "enclosure", scopeId: "enclosure:gate", createdTick: 2, observedWorldTick: 2, facts: { "gate.position": "closed", "gate.maintenance": "closer-disabled" }, tags: ["gate", "maintenance"], routing: { locationIds: ["location:gate"], entityIds: ["entity:triceratops"], taskIds: ["task:feeding"] }, priority: 80, contextCost: 2 });
  const staleV1 = entry({ id: "memory:shared-gate", version: "1.0.0", storeId: "memory:team", scope: "team", scopeId: "team:park", createdTick: 1, observedWorldTick: 1, facts: { "gate.position": "open" }, tags: ["gate", "shared"], routing: { locationIds: ["location:gate"] }, conflictKey: "shared-gate", supersededBy: { id: "memory:shared-gate", version: "2.0.0" }, contextCost: 2 });
  const staleV2 = entry({ id: "memory:shared-gate", version: "2.0.0", storeId: "memory:team", scope: "team", scopeId: "team:park", createdTick: 5, observedWorldTick: 5, facts: { "gate.position": "closed" }, tags: ["gate", "shared"], routing: { locationIds: ["location:gate"] }, conflictKey: "shared-gate", supersedes: { id: staleV1.id, version: staleV1.version }, contextCost: 2 });
  const historyA = entry({ id: "memory:history-observation", version: "1.0.0", storeId: "memory:park", scope: "park", scopeId: "park:main", createdTick: 3, observedWorldTick: 3, facts: { "gate.position": "closed", "dinosaur.mood": "calm" }, tags: ["history", "gate"], routing: { locationIds: ["location:gate"] }, contextCost: 4 });
  const historyB = entry({ id: "memory:history-tool-result", version: "1.0.0", storeId: "memory:park", scope: "park", scopeId: "park:main", createdTick: 4, observedWorldTick: 4, facts: { "gate.position": "closed", "tool.result": "accepted" }, tags: ["history", "tool"], routing: { locationIds: ["location:gate"] }, contextCost: 4 });
  const conflictA = entry({ id: "memory:conflict-a", version: "1.0.0", storeId: "memory:team", scope: "team", scopeId: "team:park", createdTick: 6, observedWorldTick: 6, facts: { "gate.position": "open" }, tags: ["gate", "conflict"], routing: { locationIds: ["location:gate"] }, conflictKey: "current-gate", contextCost: 2 });
  const conflictB = entry({ id: "memory:conflict-b", version: "1.0.0", storeId: "memory:team", scope: "team", scopeId: "team:park", createdTick: 7, observedWorldTick: 7, facts: { "gate.position": "closed" }, tags: ["gate", "conflict"], routing: { locationIds: ["location:gate"] }, conflictKey: "current-gate", contextCost: 2 });
  const enclosure = store({ id: "memory:enclosure-gate", version: "1.0.0", scope: "enclosure", scopeId: "enclosure:gate", readers: [{ principalId: "agent:worker-alpha" }], writers: [{ principalId: "agent:worker-alpha" }], publicRead: false, publicWrite: false, enabled: true, entries: [gate] });
  const team = store({ id: "memory:team", version: "1.0.0", scope: "team", scopeId: "team:park", readers: [{ principalId: "agent:worker-alpha" }, { principalId: "agent:manager" }], writers: [{ principalId: "agent:manager" }], publicRead: false, publicWrite: false, enabled: true, entries: [staleV1, staleV2, conflictA, conflictB] });
  const park = store({ id: "memory:park", version: "1.0.0", scope: "park", scopeId: "park:main", readers: [{ principalId: "agent:worker-alpha" }, { principalId: "agent:manager" }], writers: [{ principalId: "agent:worker-alpha" }, { principalId: "agent:manager" }], publicRead: false, publicWrite: false, enabled: true, entries: [historyA, historyB] });
  const stores = [enclosure, team, park];
  const repository = createMemoryRepository({ stores });
  const contextItem: ContextItem = {
    id: "context:gate-observation",
    category: "Observation",
    provenance: { source: "simulation:gate", routeId: "route:gate-observation" },
    sourceVersion: { id: "knowledge:gate-observation", version: "1.0.0" },
    cost: 3,
    createdTick: 2,
    priority: 70,
    retentionEligible: true,
    pinned: false,
    payload: { reference: "observation:gate", facts: { "gate.position": "closed", "gate.maintenance": "closer-disabled" } },
    quality: { relevance: "relevant" },
  };
  const principal = { id: "agent:worker-alpha" };
  const retrieval: MemoryRetrievalQuery = { principal, locationId: "location:gate", tags: ["gate"], limit: 3, currentWorldTick: 8, staleAfterTicks: 4, ranking: [{ field: "observedWorldTick", direction: "desc" }] };
  const retrievalMiss: MemoryRetrievalQuery = { ...retrieval, locationId: "location:feeding-yard", tags: ["maintenance"], limit: 3 };
  const staleSharedMemory: MemoryRetrievalQuery = { principal, exactVersions: [{ id: staleV1.id, version: staleV1.version }], locationId: "location:gate", limit: 1, currentWorldTick: 8, staleAfterTicks: 3 };
  const compaction: CompactHistoryRequest = {
    sourceReferences: [{ id: historyA.id, version: historyA.version }, { id: historyB.id, version: historyB.version }],
    rule: { id: "rule:compact-gate-history", version: "1.0.0", preserveFactPaths: ["gate.position"], lostDetailClasses: ["tool-results", "dinosaur-mood"], contextCost: 2, author: "Park Developer", producer: "fixture", summaryScope: "park", summaryScopeId: "park:main", tags: ["history", "summary"] },
    storeId: park.id,
    createdTick: 8,
    observedWorldTick: 8,
    principal,
  };
  const externalization: MemoryExternalizationRule = { id: "rule:externalize-observation", version: "1.0.0", eligibleCategories: ["Observation"], targetStoreId: enclosure.id, mode: "full-item", scope: "enclosure", scopeId: enclosure.scopeId, tags: ["gate", "maintenance"], routing: { locationIds: ["location:gate"], entityIds: ["entity:triceratops"] }, author: "Park Developer", producer: "fixture", failurePolicy: "retain-in-context" };
  return Object.freeze({ stores, entries: stores.flatMap((candidate) => candidate.entries), repository, contextItem, externalization, retrieval, retrievalMiss, staleSharedMemory, compaction });
};
