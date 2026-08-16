import type { ArtifactRef, ArtifactStatus, ArtifactType, ContentLifecycleSnapshot } from "../content-registry/index.ts";
import type { ContextBlock, ContextService, ContextSnapshot } from "../context/index.ts";
import type { EvalBatchResult, EvalCaseResult, EvalRef, EvalService } from "../eval-runner/index.ts";
import type { CreditBalance, CreditCommand, CreditResult } from "../economy-progression/index.ts";

export type ReviewState = "PENDING" | "EVALS_RUNNING" | "CHANGES_REQUESTED" | "READY" | "DEPLOYED" | "CLOSED";

export interface ReviewProposal {
  readonly id?: string;
  readonly reviewId?: string;
  readonly artifactId?: string;
  readonly baseRef: ArtifactRef;
  readonly proposedRef: ArtifactRef;
  readonly author: string;
  readonly goal: string;
  readonly createdAtGameTime: number;
  readonly affectedDependencies?: readonly ArtifactRef[];
  readonly affectedConsumers?: readonly string[];
  readonly expectedVersion?: number;
}

export interface ReviewHistoryEntry {
  readonly id: string;
  readonly action: string;
  readonly state: ReviewState;
  readonly revision: number;
  readonly gameTime: number;
  readonly actor: string;
  readonly expectedVersion: number;
  readonly baseRef: ArtifactRef;
  readonly proposedRef: ArtifactRef;
  readonly detail?: string;
}

export interface ReviewRevision {
  readonly revision: number;
  readonly baseRef: ArtifactRef;
  readonly proposedRef: ArtifactRef;
  readonly reason?: RevisionRequest;
  readonly createdAtGameTime: number;
}

export interface EvalAssociation {
  readonly id: string;
  readonly reviewId: string;
  readonly revision: number;
  readonly evalRef: EvalRef;
  readonly result?: EvalCaseResult;
  readonly status: "SELECTED" | "PASSED" | "FAILED" | "BLOCKED" | "STALE";
  readonly stale: boolean;
  readonly applicable: boolean;
  readonly subjectRef?: ArtifactRef;
  readonly attachedAtGameTime: number;
  readonly reason?: string;
}

export interface ReviewRecord {
  readonly reviewId: string;
  readonly artifactId: string;
  readonly baseRef: ArtifactRef;
  readonly proposedRef: ArtifactRef;
  readonly author: string;
  readonly goal: string;
  readonly createdAtGameTime: number;
  readonly state: ReviewState;
  readonly version: number;
  readonly revision: number;
  readonly revisions: readonly ReviewRevision[];
  readonly evalSelection: readonly EvalRef[];
  readonly evalAssociations: readonly EvalAssociation[];
  readonly staleEvalResultIds: readonly string[];
  readonly affectedDependencies: readonly ArtifactRef[];
  readonly affectedConsumers: readonly string[];
  readonly history: readonly ReviewHistoryEntry[];
  readonly revisionRecipe?: { readonly reasonCode: string; readonly reason: string; readonly requestedAtGameTime: number };
}

export interface ReviewServiceCheckpoint {
  readonly records: readonly ReviewRecord[];
}

export interface ReviewConflict {
  readonly code: "REVIEW_VERSION_CONFLICT" | "INVALID_STATE" | "STALE_RESULT" | "DUPLICATE_ACTION";
  readonly message: string;
  readonly reviewId: string;
  readonly expectedVersion?: number;
  readonly actualVersion?: number;
}

export type ReviewErrorCode =
  | "INVALID_PROPOSAL"
  | "UNKNOWN_REVIEW"
  | "DUPLICATE_REVIEW"
  | "MISSING_BASE"
  | "MISSING_PROPOSED"
  | "NO_CHANGE"
  | "INVALID_REF"
  | "CONFLICT"
  | "INVALID_STATE"
  | "EVAL_UNAVAILABLE"
  | "INVALID_EVAL_SUBJECT";

export interface ReviewError {
  readonly code: ReviewErrorCode;
  readonly message: string;
  readonly reviewId?: string;
  readonly conflict?: ReviewConflict;
}

export interface SourceDiffLine {
  readonly kind: "ADDED" | "REMOVED" | "UNCHANGED";
  readonly oldLine?: number;
  readonly newLine?: number;
  readonly text: string;
}

export interface ClauseDiffEntry {
  readonly id: string;
  readonly kind: "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";
  readonly before?: unknown;
  readonly after?: unknown;
}

export interface RefDelta {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
}

export interface ContextDeltaProfile {
  readonly profileId: string;
  readonly base: ContextSnapshot | ContextBlock | undefined;
  readonly proposed: ContextSnapshot | ContextBlock | undefined;
  readonly baseTotal: number;
  readonly proposedTotal: number;
  readonly delta: number;
  readonly reconciled: boolean;
  readonly diagnostics: readonly string[];
}

export interface ChangeAnalysis {
  readonly reviewId: string;
  readonly revision: number;
  readonly baseRef?: ArtifactRef;
  readonly proposedRef: ArtifactRef;
  readonly baseMissing: boolean;
  readonly proposedMissing: boolean;
  readonly noChange: boolean;
  readonly baseType?: ArtifactType;
  readonly proposedType?: ArtifactType;
  readonly sourceDiff: readonly SourceDiffLine[];
  /** Alias for consumers that call the default source view `source`. */
  readonly source: readonly SourceDiffLine[];
  readonly clauseDiff: readonly ClauseDiffEntry[];
  /** Alias for consumers that call semantic behavior `clauses`. */
  readonly clauses: readonly ClauseDiffEntry[];
  readonly dependencies: RefDelta;
  readonly transitiveDependencies: RefDelta;
  readonly tools: RefDelta;
  readonly tags: RefDelta;
  readonly usedBy: RefDelta;
  readonly transitiveUsedBy: RefDelta;
  readonly contextProfiles: readonly ContextDeltaProfile[];
  readonly contextTotalDelta: number;
  readonly contextDelta: { readonly totalDelta: number; readonly profiles: readonly ContextDeltaProfile[]; readonly reconciled: boolean };
  readonly contextOverflowProfiles: readonly string[];
  readonly warnings: readonly string[];
  readonly hardGateCodes: readonly string[];
}

export interface ReviewJobProfile {
  readonly id: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly budget: number;
  readonly promptRef?: ArtifactRef;
  readonly skillRefs?: readonly ArtifactRef[];
  readonly systemPromptRefs?: readonly ArtifactRef[];
  readonly knowledgeRefs?: readonly ArtifactRef[];
  readonly artifactRefs?: readonly ArtifactRef[];
  readonly toolIds?: readonly string[];
  readonly logicalTime?: number;
  readonly applicabilityTags?: readonly string[];
}

export interface ReviewRegistryPort {
  readonly getArtifact: (ref: ArtifactRef) => { readonly artifactId: string; readonly version: number; readonly type?: ArtifactType; readonly title?: string; readonly sourceText?: string; readonly clauses?: readonly unknown[]; readonly dependencies?: readonly ArtifactRef[]; readonly requiredToolIds?: readonly string[]; readonly applicabilityTags?: readonly string[]; readonly status?: ArtifactStatus } | undefined;
  readonly dependencies?: (ref: ArtifactRef, transitive?: boolean) => readonly ArtifactRef[];
  readonly usedBy?: (ref: ArtifactRef) => readonly { readonly artifactId: string; readonly version: number }[];
  readonly getToolDescription?: (toolId: string) => unknown;
  readonly transition?: (ref: ArtifactRef, expectedStatus: ArtifactStatus, nextStatus: ArtifactStatus) => { readonly ok: boolean; readonly error?: readonly { readonly message: string }[] };
  readonly checkpointLifecycle?: () => ContentLifecycleSnapshot;
  readonly restoreLifecycle?: (snapshot: ContentLifecycleSnapshot) => void;
}

export interface ReviewServiceOptions {
  readonly registry?: ReviewRegistryPort;
  readonly context?: ContextService;
  readonly evals?: EvalService;
  readonly economy?: {
    readonly transact: (command: CreditCommand) => CreditResult;
    readonly balance: () => CreditBalance;
  };
  readonly jobProfiles?: readonly ReviewJobProfile[];
  readonly contextProfiles?: readonly ReviewJobProfile[];
  readonly logicalTime?: number;
  readonly initialActiveRefs?: readonly ArtifactRef[];
}

export interface EvalSelectionCommand {
  readonly reviewId: string;
  readonly expectedReviewVersion: number;
  readonly evalRefs?: readonly EvalRef[];
  readonly suiteId?: string;
  /** Alias used by callers that address an immutable suite selection. */
  readonly suiteRef?: string;
  readonly add?: readonly EvalRef[];
  readonly remove?: readonly EvalRef[];
  readonly actor?: string;
  readonly gameTime?: number;
}

export interface AttachEvalRunCommand {
  readonly reviewId: string;
  readonly expectedReviewVersion: number;
  readonly result?: EvalCaseResult;
  readonly batch?: EvalBatchResult;
  /** Alias for a single/batch result returned by an Eval Service adapter. */
  readonly run?: EvalCaseResult | EvalBatchResult;
  readonly results?: readonly EvalCaseResult[];
  readonly actor?: string;
  readonly gameTime?: number;
}

export interface RevisionRequest {
  readonly reviewId?: string;
  readonly expectedReviewVersion?: number;
  readonly reasonCode: string;
  readonly reason: string;
  readonly actor?: string;
  readonly gameTime?: number;
  readonly proposedRef?: ArtifactRef;
}

export interface DeploymentWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: "INFO" | "WARNING";
  readonly acknowledgementRequired: boolean;
}

export interface DeploymentAssessment {
  readonly valid: boolean;
  readonly reviewId: string;
  readonly reviewVersion: number;
  readonly proposedRef?: ArtifactRef;
  readonly warnings: readonly DeploymentWarning[];
  readonly hardGates: readonly DeploymentWarning[];
  readonly acknowledgedWarningCodes: readonly string[];
}

export interface DeploymentCommand {
  readonly reviewId: string;
  readonly expectedReviewVersion: number;
  readonly acknowledgeWarningCodes?: readonly string[];
  readonly transactionId: string;
  readonly actor?: string;
  readonly gameTime?: number;
}

export interface RevertCommand {
  readonly artifactId: string;
  readonly targetRef: ArtifactRef;
  readonly transactionId: string;
  readonly expectedDeploymentVersion: number;
  readonly actor?: string;
  readonly gameTime?: number;
}

export type DeploymentErrorCode =
  | "UNKNOWN_REVIEW"
  | "REVIEW_VERSION_CONFLICT"
  | "REVIEW_NOT_READY"
  | "HARD_GATE"
  | "WARNING_ACK_REQUIRED"
  | "INVALID_TRANSACTION"
  | "IDEMPOTENCY_CONFLICT"
  | "DEPLOYMENT_CONFLICT"
  | "REGISTRY_CONFLICT"
  | "ATOMIC_COMMIT_FAILED"
  | "UNKNOWN_ARTIFACT"
  | "INVALID_TARGET";

export interface DeploymentError {
  readonly code: DeploymentErrorCode;
  readonly message: string;
  readonly reviewId?: string;
  readonly warningCodes?: readonly string[];
}

export interface DeploymentRecord {
  readonly id: string;
  readonly version: number;
  readonly artifactId: string;
  readonly ref: ArtifactRef;
  readonly previousRef?: ArtifactRef;
  readonly reviewId?: string;
  readonly reviewRevision?: number;
  readonly kind: "DEPLOY" | "REVERT";
  readonly actor: string;
  readonly transactionId: string;
  readonly gameTime: number;
  readonly audit: readonly string[];
}

export interface ActiveArtifact {
  readonly artifactId: string;
  readonly ref: ArtifactRef;
  readonly deploymentId: string;
  readonly version: number;
}

export interface DeploymentTransactionPort {
  readonly run: <T>(work: () => T) => T;
}

export interface DeploymentServiceOptions {
  readonly registry?: ReviewRegistryPort;
  readonly reviews?: ReviewService;
  readonly transaction?: DeploymentTransactionPort;
  readonly logicalTime?: number;
  readonly hardGateCodes?: readonly string[];
  readonly failureInjector?: (point: "before-commit" | "after-registry" | "after-active") => void;
  readonly initialActiveRefs?: readonly ArtifactRef[];
}

export interface ReviewService {
  readonly submit: (input: ReviewProposal) => { readonly ok: true; readonly value: ReviewRecord } | { readonly ok: false; readonly error: ReviewError };
  readonly get: (reviewId: string) => ReviewRecord | undefined;
  readonly list: () => readonly ReviewRecord[];
  readonly analyze: (reviewId: string) => ChangeAnalysis;
  readonly selectEvals: (command: EvalSelectionCommand) => { readonly ok: true; readonly value: ReviewRecord } | { readonly ok: false; readonly error: ReviewConflict | ReviewError };
  readonly attachRun: (command: AttachEvalRunCommand) => { readonly ok: true; readonly value: ReviewRecord } | { readonly ok: false; readonly error: ReviewConflict | ReviewError };
  readonly requestRevision: (command: RevisionRequest) => { readonly ok: true; readonly value: ReviewRecord } | { readonly ok: false; readonly error: ReviewConflict | ReviewError };
  readonly transition: (reviewId: string, next: ReviewState, expectedVersion: number, actor?: string, gameTime?: number) => { readonly ok: true; readonly value: ReviewRecord } | { readonly ok: false; readonly error: ReviewConflict | ReviewError };
  readonly checkpoint: () => ReviewServiceCheckpoint;
  readonly restore: (checkpoint: ReviewServiceCheckpoint) => void;
}

export interface DeploymentService {
  readonly validate: (reviewId: string, acknowledgedWarningCodes?: readonly string[]) => DeploymentAssessment;
  readonly deploy: (command: DeploymentCommand) => { readonly ok: true; readonly value: DeploymentRecord } | { readonly ok: false; readonly error: DeploymentError };
  readonly revert: (command: RevertCommand) => { readonly ok: true; readonly value: DeploymentRecord } | { readonly ok: false; readonly error: DeploymentError };
  readonly resolveActive: (artifactId: string) => ArtifactRef | undefined;
  readonly active: () => readonly ActiveArtifact[];
  readonly records: () => readonly DeploymentRecord[];
  readonly checkpoint: () => DeploymentServiceCheckpoint;
  readonly restore: (checkpoint: DeploymentServiceCheckpoint) => void;
}

export interface DeploymentServiceCheckpoint {
  readonly review: ReviewServiceCheckpoint;
  readonly registry?: ContentLifecycleSnapshot;
  readonly active: readonly (readonly [string, ActiveArtifact])[];
  readonly records: readonly DeploymentRecord[];
  readonly knownRefs: readonly string[];
  readonly version: number;
  readonly transactions: readonly { readonly id: string; readonly fingerprint: string; readonly record: DeploymentRecord }[];
  readonly bindings: readonly { readonly id: string; readonly fingerprint: string }[];
}

export interface ReviewDeploymentRuntime {
  readonly reviews: ReviewService;
  readonly deployments: DeploymentService;
}
