/** The sole downstream import surface for versioned external Memory. */
export {
  canReadMemoryStore,
  canWriteMemoryStore,
} from "./authority.js";
export {
  createMemoryRepository,
  createMemoryPorts,
  createMemoryStore,
  stateFromStores,
} from "./repository.js";
export type { MemoryRepositoryOptions } from "./repository.js";
export {
  externalizeContextItem,
  externalizeAndRetrievePort,
} from "./externalization.js";
export {
  retrieveMemory,
  memoryRetrievalPredicates,
} from "./retrieval.js";
export {
  compactHistory,
  compactHistoryReducer,
} from "./compaction.js";
export { memoryDiagnostics } from "./diagnostics.js";
export { createMemoryFoundationFixture } from "./foundation-fixture.js";
export type { MemoryFoundationFixture } from "./foundation-fixture.js";
export {
  memoryAuthorityRuleSchema,
  memoryConfidenceSchema,
  memoryEntrySchema,
  memoryExternalizationRuleSchema,
  memoryPredicateSchema,
  memoryPrincipalSchema,
  memoryProvenanceSchema,
  memoryRankingRuleSchema,
  memoryReferenceSchema,
  memoryRetrievalQuerySchema,
  memoryRoutingSchema,
  memoryScopeSchema,
  memorySourceReferenceSchema,
  memoryStoreInputSchema,
  memoryStoreSchema,
  memorySummarySchema,
  memoryTransformationSchema,
  compactHistoryRequestSchema,
  compactHistoryRuleSchema,
} from "./schemas.js";
export type {
  CompactHistoryRequest,
  CompactHistoryResult,
  CompactHistoryRule,
  CompactHistorySuccess,
  ContextRetentionEvent,
  MemoryAuthorityRule,
  MemoryConfidence,
  MemoryDiagnostic,
  MemoryDiagnosticCode,
  MemoryDiagnosticKind,
  MemoryDiagnosticsInput,
  MemoryEntry,
  MemoryExternalizationRequest,
  MemoryExternalizationResult,
  MemoryExternalizationRule,
  MemoryExternalizationSuccess,
  MemoryExternalizePort,
  MemoryLifecyclePorts,
  MemoryMutationFailure,
  MemoryMutationFailureCode,
  MemoryMutationResult,
  MemoryPrincipal,
  MemoryProvenance,
  MemoryReference,
  MemoryRetrievePort,
  MemoryRepository,
  MemoryRepositoryAccess,
  MemoryResultRecord,
  MemoryRetrievalQuery,
  MemoryRetrievalResult,
  MemoryRouting,
  MemoryScope,
  MemorySourceReference,
  MemoryState,
  MemoryStore,
  MemoryStoreInput,
  MemorySummary,
  MemoryTransformation,
  MemoryPredicate,
  MemoryRankingField,
  MemoryRankingRule,
} from "./types.js";
