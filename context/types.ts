import type { ArtifactRef, ArtifactVersion, Clause, ContentRegistry } from "../content-registry/index.ts";
import type {
  FreshnessPolicy,
  FreshnessStatus,
  MemoryAccess,
  MemoryFact,
  MemoryJsonValue,
  MemoryQuery,
  MemoryRecord,
  MemoryService,
} from "../memory/index.ts";

export type ContextItemKind = "PROMPT" | "SKILL" | "SYSTEM_PROMPT" | "MEMORY" | "KNOWLEDGE" | "TOOL" | "WORKING_STATE";
export type ContextMode = "PROJECTED" | "ACTUAL";

export interface ContextItem {
  readonly ref: string;
  readonly kind: ContextItemKind;
  readonly version?: number;
  readonly contextCost: number;
  readonly provenance?: string;
  /** Baseline shape uses a number; status/reason are added for explainability. */
  readonly freshness?: number;
  readonly freshnessStatus?: FreshnessStatus;
  readonly applicabilityMatched: boolean;
  readonly semanticKeys?: readonly string[];
  /** Canonical signatures aligned with semanticKeys for conflict analysis. */
  readonly semanticSignatures?: readonly string[];
  readonly clauseIds?: readonly string[];
  readonly clauseSignatures?: readonly string[];
  readonly sourceArtifactRef?: string;
}

export type ContextFindingCode =
  | "DUPLICATE_EXACT_REF"
  | "DUPLICATE_SEMANTIC_KEY"
  | "CONFLICTING_CLAUSES"
  | "STALE_MEMORY"
  | "APPLICABILITY_MISMATCH"
  | "UNUSED_MODULE"
  | "OVER_BROAD_DEPENDENCY";

export type FindingSeverity = "INFO" | "WARNING" | "ERROR";
export type RemediationCategory = "DEDUPLICATE" | "RECONCILE_CONFLICT" | "REFRESH_MEMORY" | "NARROW_SCOPE" | "REMOVE_UNUSED" | "REVIEW";

export interface ContextFinding {
  readonly code: ContextFindingCode;
  readonly findingId: string;
  readonly involvedRefs: readonly string[];
  readonly cuImpact: number;
  readonly severity: FindingSeverity;
  readonly evidence: readonly string[];
  readonly question: string;
  readonly remediationCategory: RemediationCategory;
  readonly semanticKey?: string;
}

export interface ContextConflict {
  readonly refs: readonly string[];
  readonly semanticKey?: string;
  readonly reason: string;
}

export interface ContextDuplicate {
  readonly refs: readonly string[];
  readonly semanticKey?: string;
  readonly contextCost: number;
  readonly reason: string;
}

export interface AuthoritativeFact {
  readonly key: string;
  readonly value: MemoryJsonValue;
  readonly subjectRef?: string;
  readonly observedAt: number;
  readonly source: "DIRECT_OBSERVATION" | "MEMORY";
  readonly provenance: string;
  readonly supersedes?: readonly string[];
}

export interface ContextSnapshot {
  readonly id: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly budget: number;
  readonly totalLoad: number;
  readonly items: readonly ContextItem[];
  readonly conflicts: readonly ContextConflict[];
  readonly duplicates: readonly ContextDuplicate[];
  readonly createdAtLogicalTime: number;
  readonly mode: ContextMode;
  readonly authoritativeFacts: readonly AuthoritativeFact[];
  readonly blocked?: false;
}

export type ContextBlockCode = "BLOCKED_CONTEXT_OVERFLOW" | "MISSING_ARTIFACT" | "INVALID_CONTEXT_REQUEST";

export interface ContextBlock {
  readonly blocked: true;
  readonly code: ContextBlockCode;
  readonly id: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly budget: number;
  readonly totalLoad: number;
  readonly items: readonly ContextItem[];
  readonly message: string;
  readonly diagnostics: readonly string[];
}

export type ContextResult =
  | { readonly ok: true; readonly value: ContextSnapshot }
  | { readonly ok: false; readonly error: ContextBlock };

export interface ContextToolInput {
  readonly id: string;
  readonly contextCost?: number;
  readonly description?: string;
  readonly title?: string;
  readonly provenance?: string;
  readonly applicabilityMatched?: boolean;
}

export interface WorkingStateObservation {
  readonly key: string;
  readonly value: MemoryJsonValue;
  readonly subjectRef?: string;
  readonly observedAt: number;
  readonly provenance?: string;
}

export interface WorkingStateInput {
  readonly ref?: string;
  readonly contextCost?: number;
  readonly content?: string;
  readonly provenance?: string;
  readonly applicabilityMatched?: boolean;
  readonly observations?: readonly WorkingStateObservation[];
  readonly facts?: readonly MemoryFact[] | Readonly<Record<string, MemoryJsonValue>>;
}

export interface WorkingStateQuery {
  getWorkingState?: (agentId: string, jobId: string, logicalTime: number) => WorkingStateInput | readonly WorkingStateInput[] | undefined;
  query?: (agentId: string, jobId: string, logicalTime: number) => WorkingStateInput | readonly WorkingStateInput[] | undefined;
}

export interface ArtifactRegistryPort {
  getArtifact(ref: ArtifactRef): ArtifactVersion | undefined;
  dependencies?(ref: ArtifactRef, transitive?: boolean): readonly ArtifactRef[];
}

export interface ContextRequest {
  readonly id?: string;
  readonly snapshotId?: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly budget: number;
  readonly logicalTime?: number;
  readonly promptRef?: ArtifactRef;
  readonly prompt?: ArtifactRef;
  readonly skillRefs?: readonly ArtifactRef[];
  readonly skills?: readonly ArtifactRef[];
  readonly systemPromptRefs?: readonly ArtifactRef[];
  readonly systemPrompts?: readonly ArtifactRef[];
  readonly knowledgeRefs?: readonly ArtifactRef[];
  readonly knowledge?: readonly ArtifactRef[];
  /** Generic explicitly selected artifacts are classified from their registry type. */
  readonly artifactRefs?: readonly ArtifactRef[];
  readonly selectedArtifacts?: readonly ArtifactRef[];
  readonly tools?: readonly (string | ContextToolInput)[];
  readonly toolIds?: readonly string[];
  readonly toolSchemas?: readonly ContextToolInput[];
  readonly memoryQuery?: MemoryQuery;
  readonly memoryAccess?: MemoryAccess;
  readonly memoryRefs?: readonly string[];
  readonly memoryRecords?: readonly MemoryRecord[];
  readonly memoryService?: MemoryService;
  readonly freshnessPolicy?: FreshnessPolicy;
  readonly workingState?: WorkingStateInput | readonly WorkingStateInput[];
  readonly workingStateQuery?: WorkingStateQuery;
  readonly stateQuery?: WorkingStateQuery;
  readonly applicabilityTags?: readonly string[];
  readonly contextTags?: readonly string[];
  readonly registry?: ArtifactRegistryPort | ContentRegistry;
  readonly artifactRegistry?: ArtifactRegistryPort | ContentRegistry;
}

export interface ContextUsageEvidence {
  readonly usedRefs?: readonly string[];
  readonly usedItemRefs?: readonly string[];
  readonly usedClauseIds?: readonly string[];
  readonly selectedRefs?: readonly string[];
}

export type ProfilerLevel = "BASIC" | "ADVANCED";

export interface ProfilerResult {
  readonly level: ProfilerLevel;
  readonly findings: readonly ContextFinding[];
  readonly snapshot: ContextSnapshot;
}

export interface ContextService {
  project(request: ContextRequest): ContextResult;
  buildActual(request: ContextRequest, logicalTime: number): ContextResult;
  analyze(snapshot: ContextSnapshot, evidence?: ContextUsageEvidence): readonly ContextFinding[];
  profiler(snapshot: ContextSnapshot, level: ProfilerLevel, evidence?: ContextUsageEvidence): ProfilerResult;
}

/** Public semantic helpers used by tests and downstream engine consumers. */
export type ContextClause = Clause;
