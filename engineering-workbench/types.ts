import type {
  ArtifactRef,
  ArtifactStatus,
  ArtifactType,
  ArtifactVersion,
  Clause,
  ContentRef,
  ContentRegistry,
  Result,
  ToolDescriptionDefinition,
  VersionedRef,
} from "../content-registry/index.ts";
import type { ContextBlock, ContextService, ContextSnapshot } from "../context/index.ts";
import type { CreditBalance, CreditResult, ProgressSnapshot } from "../economy-progression/index.ts";
import type { EvalCatalogEntry, EvalCaseResult, EvalService } from "../eval-runner/index.ts";
import type { ReviewProposal, ReviewService } from "../review-deployment/index.ts";

export type WorkbenchArtifactType = ArtifactType | "MEMORY" | "TOOL" | "EVAL";

export interface AssetQuery {
  readonly type?: ArtifactType | readonly ArtifactType[];
  readonly title?: string;
  readonly search?: string;
  readonly tag?: string;
  readonly status?: ArtifactStatus;
  readonly capability?: string;
  readonly toolId?: string;
  readonly deployed?: boolean;
  readonly deploymentState?: "DEPLOYED" | "HISTORICAL" | "REVIEW" | "DRAFT" | "RETIRED";
}

export interface ContextProjectionProfile {
  readonly id: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly budget: number;
  readonly toolIds?: readonly string[];
  readonly applicabilityTags?: readonly string[];
  readonly logicalTime?: number;
}

export interface AssetContextProjection {
  readonly profileId: string;
  readonly totalLoad: number;
  readonly budget: number;
  readonly blocked: boolean;
  readonly mode: "PROJECTED" | "ACTUAL";
  readonly items: readonly ContextSnapshot["items"][number][];
  readonly diagnostics: readonly string[];
}

export interface ClauseSummary {
  readonly id: string;
  readonly type: Clause["type"];
  readonly sourceText: string;
  readonly semanticKey?: string;
  readonly priority?: number;
  readonly behavior: readonly string[];
}

export interface EvalCoverageEntry {
  readonly ref: { readonly id: string; readonly version: number };
  readonly title: string;
  readonly description: string;
  readonly built: boolean;
  readonly buildCostCredits: number;
  readonly runCostCredits: number;
  readonly lastResult?: EvalCaseResult;
  readonly status: "UNBUILT" | "BUILT" | "PASSED" | "FAILED" | "BLOCKED" | "UNAVAILABLE";
}

export interface AssetSummary {
  readonly ref: ArtifactRef;
  readonly artifactId: string;
  readonly version: number;
  readonly type: ArtifactType;
  readonly title: string;
  readonly status: ArtifactStatus;
  readonly authoredByCapability: string;
  readonly applicabilityTags: readonly string[];
  readonly requiredToolIds: readonly string[];
  readonly contextCost: number;
  readonly contextBlocked: boolean;
  readonly deployed: boolean;
  readonly current: boolean;
  readonly evalCount: number;
  readonly usedByCount: number;
}

export interface AssetDetail extends AssetSummary {
  readonly sourceText: string;
  readonly clauses: readonly ClauseSummary[];
  readonly dependencies: readonly ArtifactRef[];
  readonly transitiveDependencies: readonly ArtifactRef[];
  readonly tools: readonly ToolDescriptionDefinition[];
  readonly missingTools: readonly string[];
  readonly context: readonly AssetContextProjection[];
  readonly evalCoverage: readonly EvalCoverageEntry[];
  readonly history: readonly AssetSummary[];
  readonly usedBy: readonly ContentRef[];
  readonly reviews: readonly AssetReviewLink[];
  readonly createdAtGameTime: number;
}

export interface AssetReviewLink {
  readonly reviewId: string;
  readonly state: string;
  readonly version: number;
  readonly revision: number;
  readonly href: string;
}

export interface CapabilityPresentation {
  readonly id: string;
  readonly label: string;
  readonly area: "PROMPT" | "SKILL" | "CONTEXT" | "TOOL" | "EVAL" | "MEMORY" | "AGENT_ORCHESTRATION";
  readonly unlocked: boolean;
  readonly level: number;
  readonly reason: string;
  readonly phase?: number;
  readonly prerequisites: readonly string[];
}

export interface StructuredChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface StructuredChoiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly options: readonly StructuredChoiceOption[];
  readonly required?: boolean;
}

export interface StructuredChoice {
  readonly id: string;
  readonly optionId: string;
}

export interface StructuredChoiceOutput {
  readonly choiceId: string;
  readonly optionId: string;
  /** Source and semantic clauses are always replaced as one authored pair. */
  readonly sourceText: string;
  readonly clauses: readonly Clause[];
  readonly title?: string;
  readonly dependencies?: readonly ArtifactRef[];
  readonly applicabilityTags?: readonly string[];
  readonly requiredToolIds?: readonly string[];
}

export interface CommissionRecipe {
  readonly ref: VersionedRef;
  readonly family?: WorkbenchArtifactType;
  readonly output: {
    readonly artifactId: string;
    readonly version: number;
    readonly type: ArtifactType;
    readonly title: string;
    readonly sourceText: string;
    readonly clauses: readonly Clause[];
    readonly dependencies: readonly ArtifactRef[];
    readonly applicabilityTags: readonly string[];
    readonly requiredToolIds: readonly string[];
  };
  readonly baseRef: ArtifactRef;
  readonly goal: string;
  readonly author: string;
  readonly capabilityRequirement?: string;
  readonly requiredPhase?: number;
  readonly prerequisites: readonly string[];
  readonly costCredits: number;
  readonly unlockConditions: readonly string[];
  readonly choices: readonly StructuredChoiceDefinition[];
  readonly choiceOutputs?: readonly StructuredChoiceOutput[];
  readonly expectedImpact: {
    readonly sourceChanges: readonly string[];
    readonly clauseChanges: readonly string[];
    readonly dependencyChanges: readonly string[];
    readonly toolChanges: readonly string[];
    readonly contextNote: string;
  };
}

export type CommissionStatus = "AVAILABLE" | "LOCKED" | "COMPLETED";

export interface CommissionOffer extends CommissionRecipe {
  readonly status: CommissionStatus;
  readonly reason: string;
  readonly balance: CreditBalance;
  readonly existingProposalRef?: ArtifactRef;
}

export interface ChangeIntent {
  readonly reviewId?: string;
  readonly baseRef: ArtifactRef;
  readonly goal: string;
  readonly author: string;
  readonly createdAtGameTime: number;
  readonly affectedDependencies?: readonly ArtifactRef[];
  readonly affectedConsumers?: readonly string[];
}

export interface ReviewIntakePort {
  submit(proposal: ArtifactVersion, meta: ChangeIntent): Result<{ readonly reviewId: string }, ReviewIntakeError>;
}

export interface ReviewIntakeError {
  readonly code: string;
  readonly message: string;
}

export interface CommissionEconomyPort {
  balance(): CreditBalance;
  transact(command: {
    readonly transactionId: string;
    readonly type: "COMMISSION";
    readonly amount: number;
    readonly sourceRef: string;
    readonly expectedBalanceVersion: number;
    readonly logicalTime?: number;
  }): CreditResult;
}

export interface WorkbenchProgressPort {
  snapshot(): ProgressSnapshot;
}

export interface WorkbenchDeploymentPort {
  resolveActive?(artifactId: string): ArtifactRef | undefined;
  active?(): readonly { readonly artifactId: string; readonly ref: ArtifactRef }[];
}

export interface WorkbenchHistoryPort {
  list?(): readonly { readonly reviewId: string; readonly artifactId: string; readonly proposedRef: ArtifactRef; readonly state: string; readonly version: number; readonly revision: number }[];
}

export interface WorkbenchServiceOptions {
  readonly registry: ContentRegistry;
  readonly context?: ContextService;
  readonly contextProfiles?: readonly ContextProjectionProfile[];
  readonly economy?: CommissionEconomyPort;
  readonly progress?: WorkbenchProgressPort;
  readonly evals?: EvalService;
  readonly reviews?: ReviewService | WorkbenchHistoryPort;
  readonly reviewIntake?: ReviewIntakePort;
  readonly deployment?: WorkbenchDeploymentPort;
  readonly recipes?: readonly CommissionRecipe[];
  readonly logicalTime?: number;
  readonly author?: string;
  readonly transactionCoordinator?: { run<T>(work: () => T): T };
  readonly compensate?: (transactionId: string, amount: number, reason: string) => void;
}

export interface CommissionResult {
  readonly transactionId: string;
  readonly recipeRef: VersionedRef;
  readonly artifact: ArtifactVersion;
  readonly proposalRef: ArtifactRef;
  readonly reviewId: string;
  readonly chargedCredits: number;
  readonly choices: readonly StructuredChoice[];
  readonly duplicate?: boolean;
}

export type CommissionErrorCode =
  | "INVALID_TRANSACTION"
  | "UNKNOWN_RECIPE"
  | "INVALID_CHOICE"
  | "CAPABILITY_LOCKED"
  | "PREREQUISITE_LOCKED"
  | "PHASE_LOCKED"
  | "INSUFFICIENT_FUNDS"
  | "BALANCE_VERSION_CONFLICT"
  | "TRANSACTION_FAILED"
  | "REGISTRY_VALIDATION_FAILED"
  | "REVIEW_INTAKE_FAILED"
  | "DUPLICATE_PROPOSAL"
  | "INVALID_RECIPE";

export interface CommissionError {
  readonly code: CommissionErrorCode;
  readonly message: string;
  readonly transactionId?: string;
  readonly diagnostics?: readonly string[];
  readonly compensated?: boolean;
}

export interface WorkbenchService {
  listAssets(query?: AssetQuery): readonly AssetSummary[];
  getAsset(ref: ArtifactRef): AssetDetail | undefined;
  listCommissions(progress?: ProgressSnapshot): readonly CommissionOffer[];
  commission(recipeRef: VersionedRef, choices: readonly StructuredChoice[], transactionId: string): Result<CommissionResult, CommissionError>;
  capabilities(progress?: ProgressSnapshot): readonly CapabilityPresentation[];
  recipes(): readonly CommissionRecipe[];
}

export interface WorkbenchRuntime {
  readonly service: WorkbenchService;
  readonly registry: ContentRegistry;
}

/** Public adapter shape for callers that only need exact source/detail reads. */
export interface WorkbenchAssetCatalog {
  listAssets(query?: AssetQuery): readonly AssetSummary[];
  getAsset(ref: ArtifactRef): AssetDetail | undefined;
}

export type WorkbenchContextValue = ContextSnapshot | ContextBlock;
export type WorkbenchEvalValue = EvalCatalogEntry;
export type WorkbenchReviewProposal = ReviewProposal;
