import type { ContextCategory, ContextItem } from "../context/public.js";
import type { FactValue } from "../instruction/public.js";

/** Memory is deliberately a data contract, rather than an opaque cache. */
export type MemoryScope =
  | "Agent" | "Team" | "Enclosure" | "Park" | "Scenario"
  | "agent" | "team" | "enclosure" | "park" | "scenario";

export type MemoryConfidence = "unknown" | "low" | "medium" | "high";

export interface MemoryReference {
  readonly id: string;
  readonly version: string;
}

export interface MemorySourceReference extends MemoryReference {
  /** The Context item that produced this memory, when it is a Context item. */
  readonly itemId?: string;
  readonly sourceVersion?: MemoryReference;
}

export interface MemoryRouting {
  readonly taskIds?: readonly string[];
  readonly agentIds?: readonly string[];
  readonly locationIds?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly routeIds?: readonly string[];
}

export interface MemoryTransformation {
  readonly kind: "externalize" | "compact-history" | "manual";
  readonly rule?: MemoryReference;
  readonly sources: readonly MemorySourceReference[];
  readonly createdTick: number;
  readonly producer: string;
}

export interface MemoryProvenance {
  readonly source: string;
  readonly sourceItems: readonly MemorySourceReference[];
  readonly transformation: MemoryTransformation;
  readonly author: string;
}

export interface MemorySummary {
  readonly rule: MemoryReference;
  readonly sourceReferences: readonly MemorySourceReference[];
  readonly sourceRange?: { readonly firstTick: number; readonly lastTick: number };
  readonly preservedFactPaths: readonly string[];
  readonly preservedFacts: Readonly<Record<string, FactValue>>;
  readonly lostDetailClasses: readonly string[];
  readonly contextCostBefore: number;
  readonly contextCostAfter: number;
  readonly lineage: readonly MemoryReference[];
}

export interface MemoryEntry {
  readonly id: string;
  readonly version: string;
  readonly storeId: string;
  readonly scope: MemoryScope;
  readonly scopeId: string;
  readonly sourceItems: readonly MemorySourceReference[];
  readonly sourceLineage: readonly MemorySourceReference[];
  readonly createdTick: number;
  readonly observedWorldTick?: number;
  readonly author: string;
  readonly producer: string;
  readonly confidence: MemoryConfidence;
  readonly priority: number;
  readonly tags: readonly string[];
  readonly facts: Readonly<Record<string, FactValue>>;
  readonly routing: MemoryRouting;
  readonly staleAtTick?: number;
  readonly supersedes?: MemoryReference;
  readonly supersededBy?: MemoryReference;
  readonly provenance: MemoryProvenance;
  readonly contextCost: number;
  readonly summary?: MemorySummary;
  /** Optional authored key used to report duplicate/conflict diagnostics. */
  readonly duplicateKey?: string;
  readonly conflictKey?: string;
}

export interface MemoryAuthorityRule {
  readonly principalId: string;
  readonly scopes?: readonly MemoryScope[];
  readonly storeIds?: readonly string[];
}

export interface MemoryStore {
  readonly id: string;
  readonly version: string;
  readonly scope: MemoryScope;
  readonly scopeId: string;
  readonly readers: readonly MemoryAuthorityRule[];
  readonly writers: readonly MemoryAuthorityRule[];
  readonly publicRead: boolean;
  readonly publicWrite: boolean;
  readonly enabled: boolean;
  readonly entries: readonly MemoryEntry[];
}

export interface MemoryStoreInput extends Omit<MemoryStore, "entries" | "readers" | "writers"> {
  readonly readers?: readonly MemoryAuthorityRule[];
  readonly writers?: readonly MemoryAuthorityRule[];
  /** Naming aliases accepted at import boundaries for authored policies. */
  readonly readAuthority?: readonly MemoryAuthorityRule[];
  readonly writeAuthority?: readonly MemoryAuthorityRule[];
  readonly entries?: readonly MemoryEntry[];
}

export interface MemoryState {
  readonly stores: readonly MemoryStore[];
  readonly entries: readonly MemoryEntry[];
}

export interface MemoryPrincipal {
  readonly id: string;
  readonly roles?: readonly string[];
}

export interface MemoryExternalizationRule {
  readonly id: string;
  readonly version: string;
  readonly eligibleCategories: readonly ContextCategory[];
  readonly targetStoreId: string;
  readonly mode: "full-item" | "facts";
  readonly factPaths?: readonly string[];
  readonly scope: MemoryScope;
  readonly scopeId: string;
  readonly tags: readonly string[];
  readonly routing?: MemoryRouting;
  readonly contextCost?: number;
  readonly priority?: number;
  readonly confidence?: MemoryConfidence;
  readonly author: string;
  readonly producer: string;
  readonly failurePolicy: "retain-in-context" | "block";
}

export interface ContextRetentionEvent {
  readonly kind: "externalized" | "compacted";
  readonly contextItemIds: readonly string[];
  readonly reasonCode: "MEMORY_EXTERNALIZED" | "MEMORY_COMPACTED";
  readonly memoryEntries: readonly MemoryReference[];
}

export interface MemoryDiagnostic {
  readonly code: MemoryDiagnosticCode;
  readonly kind: MemoryDiagnosticKind;
  readonly entryIds: readonly string[];
  readonly references?: readonly MemoryReference[];
  readonly message: string;
}

export type MemoryDiagnosticKind =
  | "stale" | "superseded" | "conflict" | "broad" | "duplicate" | "missing" | "routing" | "authority" | "boundary";

export type MemoryDiagnosticCode =
  | "MEMORY_STALE"
  | "MEMORY_SUPERSEDED"
  | "MEMORY_CONFLICT"
  | "MEMORY_BROAD_ROUTE"
  | "MEMORY_DUPLICATE"
  | "MEMORY_MISSING_ROUTE"
  | "MEMORY_MISROUTED"
  | "MEMORY_READ_UNAUTHORIZED"
  | "MEMORY_WRITE_UNAUTHORIZED"
  | "MEMORY_EXACT_VERSION_UNAVAILABLE"
  | "MEMORY_INVALID"
  | "MEMORY_STORE_UNAVAILABLE"
  | "MEMORY_SOURCES_UNAVAILABLE"
  | "MEMORY_SOURCES_OUT_OF_ORDER"
  | "MEMORY_FACT_CONFLICT";

export type MemoryPredicate =
  | { readonly kind: "task"; readonly taskId: string }
  | { readonly kind: "agent"; readonly agentId: string }
  | { readonly kind: "location"; readonly locationId: string }
  | { readonly kind: "entity"; readonly entityId: string }
  | { readonly kind: "tag"; readonly tag: string; readonly mode?: "has" | "missing" }
  | { readonly kind: "scope"; readonly scope: MemoryScope; readonly scopeId?: string }
  | { readonly kind: "created-tick"; readonly min?: number; readonly max?: number }
  | { readonly kind: "observed-world-tick"; readonly min?: number; readonly max?: number }
  | { readonly kind: "exact-version"; readonly id: string; readonly version: string }
  | { readonly kind: "fact-equals"; readonly path: string; readonly value: FactValue };

export type MemoryRankingField =
  | "priority" | "confidence" | "createdTick" | "observedWorldTick" | "scopeSpecificity" | "tagMatchCount";

export interface MemoryRankingRule {
  readonly field: MemoryRankingField;
  readonly direction: "asc" | "desc";
}

export interface MemoryRetrievalQuery {
  readonly requestId?: string;
  readonly principal?: MemoryPrincipal;
  readonly taskId?: string;
  readonly agentId?: string;
  readonly locationId?: string;
  readonly entityId?: string;
  readonly tags?: readonly string[];
  readonly predicates?: readonly MemoryPredicate[];
  readonly storeIds?: readonly string[];
  readonly scopes?: readonly { readonly scope: MemoryScope; readonly scopeId?: string }[];
  readonly exactVersions?: readonly MemoryReference[];
  readonly currentTick?: number;
  readonly currentWorldTick?: number;
  readonly staleAfterTicks?: number;
  readonly ranking?: readonly MemoryRankingRule[];
  readonly limit: number;
  readonly includeSuperseded?: boolean;
}

export interface MemoryResultRecord {
  readonly entry?: MemoryEntry;
  readonly reference: MemoryReference;
  readonly contextCost: number;
  readonly reasonCode: string;
  readonly reason: string;
  readonly rank?: number;
}

export interface MemoryRetrievalResult {
  readonly ok: boolean;
  readonly query: MemoryRetrievalQuery;
  readonly selected: readonly MemoryResultRecord[];
  readonly considered: readonly MemoryResultRecord[];
  readonly rejected: readonly MemoryResultRecord[];
  readonly unavailable: readonly MemoryResultRecord[];
  readonly conflicting: readonly MemoryResultRecord[];
  readonly diagnostics: readonly MemoryDiagnostic[];
  readonly contextCost: number;
}

export interface MemoryDiagnosticsInput {
  readonly entries: readonly MemoryEntry[];
  readonly currentTick?: number;
  readonly knownReferences?: readonly MemoryReference[];
}

export interface MemoryExternalizationRequest {
  readonly contextItem: ContextItem;
  readonly rule: MemoryExternalizationRule;
  readonly createdTick: number;
  readonly observedWorldTick?: number;
  readonly sourceManifestId?: string;
  readonly principal: MemoryPrincipal;
  readonly entryId?: string;
  readonly entryVersion?: string;
}

export type MemoryMutationFailureCode =
  | "MEMORY_INVALID"
  | "MEMORY_STORE_UNAVAILABLE"
  | "MEMORY_WRITE_UNAUTHORIZED"
  | "MEMORY_NOT_ELIGIBLE"
  | "MEMORY_DUPLICATE_ENTRY"
  | "MEMORY_EXTERNALIZATION_FAILED"
  | "MEMORY_SOURCES_UNAVAILABLE"
  | "MEMORY_SOURCES_OUT_OF_ORDER"
  | "MEMORY_FACT_CONFLICT";

export interface MemoryMutationFailure {
  readonly ok: false;
  readonly code: MemoryMutationFailureCode;
  readonly diagnostics: readonly MemoryDiagnostic[];
  readonly contextRetention?: undefined;
}

export interface MemoryExternalizationSuccess {
  readonly ok: true;
  readonly status: "externalized";
  readonly entry: MemoryEntry;
  readonly contextRetention: ContextRetentionEvent;
  readonly sourceManifestId?: string;
}

export type MemoryExternalizationResult = MemoryExternalizationSuccess | MemoryMutationFailure;

export interface CompactHistoryRule {
  readonly id: string;
  readonly version: string;
  readonly preserveFactPaths: readonly string[];
  readonly lostDetailClasses: readonly string[];
  readonly contextCost: number;
  readonly author: string;
  readonly producer: string;
  readonly summaryScope?: MemoryScope;
  readonly summaryScopeId?: string;
  readonly tags?: readonly string[];
}

export interface CompactHistoryRequest {
  readonly sourceEntries?: readonly MemoryEntry[];
  readonly sourceReferences?: readonly MemoryReference[];
  readonly rule: CompactHistoryRule;
  readonly storeId: string;
  readonly createdTick: number;
  readonly observedWorldTick?: number;
  readonly principal: MemoryPrincipal;
  readonly summaryId?: string;
  readonly summaryVersion?: string;
}

export interface CompactHistorySuccess {
  readonly ok: true;
  readonly status: "compacted";
  readonly summary: MemoryEntry;
  readonly sourceEntries: readonly MemoryEntry[];
  readonly preservedFacts: Readonly<Record<string, FactValue>>;
  readonly lostDetailClasses: readonly string[];
  readonly contextCostBefore: number;
  readonly contextCostAfter: number;
  readonly lineage: readonly MemoryReference[];
  readonly contextRetention: ContextRetentionEvent;
}

export type CompactHistoryResult = CompactHistorySuccess | MemoryMutationFailure;

export interface MemoryRepository {
  readonly snapshot: () => MemoryState;
  readonly getExact: (id: string, version: string) => MemoryEntry | undefined;
  readonly history: (id: string) => readonly MemoryEntry[];
  readonly stores: () => readonly MemoryStore[];
  readonly append: (entry: MemoryEntry, principal?: MemoryPrincipal) => MemoryMutationResult;
  readonly externalize: (request: MemoryExternalizationRequest) => MemoryExternalizationResult;
  readonly retrieve: (query: MemoryRetrievalQuery) => MemoryRetrievalResult;
  readonly compactHistory: (request: CompactHistoryRequest) => CompactHistoryResult;
}

export interface MemoryExternalizePort {
  readonly externalize: (request: MemoryExternalizationRequest) => MemoryExternalizationResult;
}

export interface MemoryRetrievePort {
  readonly retrieve: (query: MemoryRetrievalQuery) => MemoryRetrievalResult;
}

export interface MemoryLifecyclePorts extends MemoryExternalizePort, MemoryRetrievePort {
  readonly compactHistory: (request: CompactHistoryRequest) => CompactHistoryResult;
}

export interface MemoryRepositoryAccess {
  readonly append: (entry: MemoryEntry, principal?: MemoryPrincipal) => MemoryMutationResult;
  readonly getStore: (id: string) => MemoryStore | undefined;
}

export type MemoryMutationResult =
  | { readonly ok: true; readonly entry: MemoryEntry }
  | MemoryMutationFailure;
