import type {
  ContentReference,
  ContentRegistry,
  ResolvedContentManifest,
} from "../content-registry/public.js";
import type {
  ArtifactCandidate,
  EngineeringWorkbenchService,
  SemanticComparison,
  WorkRequest,
} from "../engineering-workbench/public.js";
import type {
  EvalCaseResult,
  EvalRisk,
  EvalSelectionPlan,
  EvalStatus,
  EvalSuiteResult,
} from "../eval-runner/public.js";
import type { ResolvedInstructionArtifact } from "../instruction/public.js";

export type ReviewStatus =
  | "open"
  | "changes-requested"
  | "retained"
  | "deployed"
  | "reverted"
  | "superseded";

export type ReviewDecisionKind = "request-changes" | "retain" | "deploy" | "revert";

export type ReviewEvidenceStatus = EvalStatus | "omitted";

export type ReviewDiagnosticCode =
  | "REVIEW_INVALID"
  | "REVIEW_DUPLICATE"
  | "REVIEW_NOT_FOUND"
  | "REVIEW_STALE_CANDIDATE"
  | "REVIEW_STALE_BASE"
  | "REVIEW_EVIDENCE_MISSING"
  | "REVIEW_EVIDENCE_MISMATCH"
  | "REVIEW_EVIDENCE_DUPLICATE"
  | "REVIEW_EVIDENCE_UNDIAGNOSED"
  | "REVIEW_DEPLOYMENT_BLOCKED"
  | "REVIEW_CONFIRMATION_REQUIRED"
  | "REVIEW_CONFIRMATION_MISMATCH"
  | "REVIEW_DEPENDENCY_UNRESOLVED"
  | "REVIEW_DEPENDENCY_UNAVAILABLE"
  | "REVIEW_DEPENDENCY_MISMATCH"
  | "REVIEW_DEPLOYMENT_DUPLICATE"
  | "REVIEW_DEPLOYMENT_NOT_FOUND"
  | "REVIEW_SLOT_INVALID"
  | "REVIEW_DECISION_INVALID"
  | "REVIEW_COMMAND_DUPLICATE"
  | "REVIEW_JOB_DUPLICATE"
  | "REVIEW_NO_ACTIVE_DEPLOYMENT"
  | "REVIEW_HISTORY_INVALID";

export interface ReviewDiagnostic {
  readonly code: ReviewDiagnosticCode;
  readonly path: string;
  readonly rule: string;
  readonly message: string;
}

export interface ReviewCausalLink {
  readonly kind:
    | "review"
    | "candidate"
    | "workbench"
    | "feedback"
    | "eval"
    | "suite"
    | "result"
    | "trace"
    | "replay"
    | "deployment"
    | "job"
    | "incident"
    | "revert";
  readonly id: string;
  readonly version?: string;
}

export interface ReviewRiskArea {
  readonly id: string;
  readonly kind: "safety" | "coverage" | "context" | "dependency" | "tool" | "behavior" | "tradeoff" | "replay";
  readonly summary: string;
  readonly evidenceIds: readonly string[];
  readonly severity: "low" | "medium" | "high" | "critical";
}

export interface ReviewDeltaEntry {
  readonly id: string;
  readonly change: "added" | "removed" | "changed";
  readonly summary: string;
  readonly evidenceIds: readonly string[];
  readonly left?: string;
  readonly right?: string;
}

export interface ReviewContextDelta {
  readonly baseCost: number;
  readonly candidateCost: number;
  readonly delta: number;
  readonly composition: ReviewDeltaEntry[];
}

export interface ReviewDependencyDelta {
  readonly base: readonly ContentReference[];
  readonly candidate: readonly ContentReference[];
  readonly changes: readonly ReviewDeltaEntry[];
}

export interface ReviewToolDelta {
  readonly base: readonly ContentReference[];
  readonly candidate: readonly ContentReference[];
  readonly changes: readonly ReviewDeltaEntry[];
}

export interface ReviewDiffProjection {
  readonly readable: readonly ReviewDeltaEntry[];
  readonly behavioral: readonly ReviewDeltaEntry[];
  readonly context: readonly ReviewDeltaEntry[];
  readonly dependency: readonly ReviewDeltaEntry[];
  readonly tool: readonly ReviewDeltaEntry[];
  readonly verification: readonly ReviewDeltaEntry[];
  readonly failure: readonly ReviewDeltaEntry[];
  readonly tradeoff: readonly ReviewDeltaEntry[];
  readonly findings: SemanticComparison["findings"];
}

export interface ReviewArtifactSnapshot {
  readonly reference: ContentReference;
  readonly class: ResolvedInstructionArtifact["class"];
  readonly author: string;
  readonly readableSource: string;
  readonly contextCost: number;
  readonly dependencies: readonly ContentReference[];
  readonly requiredTools: readonly ContentReference[];
  readonly clauses: ResolvedInstructionArtifact["clauses"];
  readonly knownTradeoffs: readonly string[];
  readonly fingerprint: string;
}

export interface ChangeRequest {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly status: ReviewStatus;
  readonly author: string;
  readonly goal: string;
  readonly owningArtifact: ContentReference;
  readonly baseVersion: ContentReference;
  readonly candidateVersion: ContentReference;
  readonly candidateId: string;
  readonly candidate: ArtifactCandidate;
  readonly baseSnapshot: ReviewArtifactSnapshot;
  readonly candidateSnapshot: ReviewArtifactSnapshot;
  readonly createdTick: number;
  readonly completedTick?: number;
  readonly sourceFingerprint: string;
  readonly workbenchLinks: readonly ReviewCausalLink[];
  readonly diff: ReviewDiffProjection;
  readonly contextDelta: ReviewContextDelta;
  readonly dependencyDelta: ReviewDependencyDelta;
  readonly toolDelta: ReviewToolDelta;
  readonly expectedEffect: string;
  readonly tradeoffs: readonly string[];
  readonly risks: readonly ReviewRiskArea[];
  readonly selection?: EvalSelectionSnapshot;
  readonly evidence: readonly EvalEvidence[];
  readonly decisionIds: readonly string[];
  readonly feedbackIds: readonly string[];
  readonly causalLinks: readonly ReviewCausalLink[];
}

export interface EvalSelectionSnapshot {
  readonly schemaVersion: "1";
  readonly caseReferences: readonly ContentReference[];
  readonly suiteReferences: readonly ContentReference[];
  readonly selectedCases: readonly ContentReference[];
  readonly includedRisks: readonly EvalRisk[];
  readonly estimatedCost: EvalSelectionPlan["estimatedCost"];
  readonly items: EvalSelectionPlan["items"];
  readonly diagnostics: readonly string[];
  readonly selectedTick: number;
}

export interface EvalEvidence {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly reviewId: string;
  readonly caseReference: ContentReference;
  readonly suiteReference?: ContentReference;
  readonly resultId?: string;
  readonly status: ReviewEvidenceStatus;
  readonly reasonCode: string;
  readonly candidateReference: ContentReference;
  readonly fixtureReference?: ContentReference;
  readonly dependencyFingerprint?: string;
  readonly result?: EvalCaseResult;
  readonly replay?: {
    readonly sessionId: string;
    readonly traceId: string;
    readonly available: boolean;
    readonly firstMismatchEventId?: string;
    readonly firstMismatchTick?: number;
  };
  readonly diagnosisLinks: readonly ReviewCausalLink[];
  readonly attachedTick: number;
  readonly omittedReason?: string;
}

export interface EvalSuiteEvidence {
  readonly id: string;
  readonly reviewId: string;
  readonly suiteReference: ContentReference;
  readonly resultId: string;
  readonly selectedCases: readonly ContentReference[];
  readonly evidenceIds: readonly string[];
  readonly attachedTick: number;
}

export interface ReviewRationale {
  readonly selection?: "evidence-sufficient" | "accepted-risk" | "recovery" | "no-production-change" | "revision-needed" | "other";
  readonly note?: string;
}

export interface DeploymentSlot {
  readonly slot: string;
  readonly scope: string;
}

export interface DeploymentDependencyManifest {
  readonly schemaVersion: "1";
  readonly root: ContentReference;
  readonly dependencies: readonly ContentReference[];
  readonly resolvedContent?: ResolvedContentManifest;
  readonly source: "registry" | "candidate-snapshot";
  readonly fingerprint: string;
}

export interface DeploymentConfirmation {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly reviewId: string;
  readonly candidateReference: ContentReference;
  readonly slot: DeploymentSlot;
  readonly manifestFingerprint: string;
  readonly evidenceIds: readonly string[];
  readonly actor: string;
  readonly confirmed: true;
  readonly confirmedTick: number;
}

export interface DeploymentRecord {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly kind: "deploy" | "revert";
  readonly slot: DeploymentSlot;
  readonly rootArtifact: ContentReference;
  readonly manifest: DeploymentDependencyManifest;
  readonly sourceReviewId: string;
  readonly priorDeploymentId?: string;
  readonly revertedDeploymentId?: string;
  readonly actor: string;
  readonly effectiveTick: number;
  readonly confirmation: DeploymentConfirmation;
  readonly evidenceIds: readonly string[];
  readonly causalLinks: readonly ReviewCausalLink[];
}

export interface ExactDeploymentPin {
  readonly reference: ContentReference;
  readonly manifestFingerprint: string;
}

export interface JobDeploymentPin {
  readonly schemaVersion: "1";
  readonly jobId: string;
  readonly deploymentId: string;
  readonly slot: DeploymentSlot;
  readonly pinnedTick: number;
  readonly manifestFingerprint: string;
  readonly exactDeployedVersions: readonly ExactDeploymentPin[];
  readonly causalLinks: readonly ReviewCausalLink[];
}

export type GovernanceEventKind =
  | "review-created"
  | "eval-selected"
  | "eval-attached"
  | "eval-omitted"
  | "decision-recorded"
  | "feedback-linked"
  | "deployment-activated"
  | "job-pinned"
  | "causal-link";

export interface GovernanceHistoryEvent {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly sequence: number;
  readonly kind: GovernanceEventKind;
  readonly tick: number;
  readonly actor?: string;
  readonly subject: ReviewCausalLink;
  readonly links: readonly ReviewCausalLink[];
  readonly summary: string;
}

export interface ReviewDecisionRecord {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly reviewId: string;
  readonly kind: ReviewDecisionKind;
  readonly actor: string;
  readonly tick: number;
  readonly rationale: ReviewRationale;
  readonly evidenceIds: readonly string[];
  readonly feedbackId?: string;
  readonly deploymentId?: string;
  readonly targetDeploymentId?: string;
  readonly causalLinks: readonly ReviewCausalLink[];
}

export interface ReviewDeploymentState {
  readonly schemaVersion: "1";
  readonly sequence: number;
  readonly reviews: readonly ChangeRequest[];
  readonly suiteEvidence: readonly EvalSuiteEvidence[];
  readonly decisions: readonly ReviewDecisionRecord[];
  readonly feedback: readonly WorkRequest[];
  readonly deployments: readonly DeploymentRecord[];
  readonly activeDeployments: readonly DeploymentRecord[];
  readonly jobPins: readonly JobDeploymentPin[];
  readonly history: readonly GovernanceHistoryEvent[];
}

export interface CreateChangeRequestInput {
  readonly id: string;
  readonly author: string;
  readonly goal: string;
  readonly owningArtifact?: ContentReference;
  readonly baseVersion: ContentReference;
  readonly candidate: ArtifactCandidate;
  readonly baseArtifact: ResolvedInstructionArtifact;
  readonly candidateArtifact: ResolvedInstructionArtifact;
  readonly createdTick: number;
  readonly expectedEffect?: string;
  readonly riskAreas?: readonly ReviewRiskArea[];
}

export interface SelectEvalInput {
  readonly reviewId: string;
  readonly caseReferences?: readonly ContentReference[];
  readonly suiteReferences?: readonly ContentReference[];
  readonly plan?: EvalSelectionPlan;
  readonly tick: number;
}

export interface AttachEvalResultInput {
  readonly reviewId: string;
  readonly result: EvalCaseResult;
  readonly suiteReference?: ContentReference;
  readonly tick: number;
}

export interface AttachEvalSuiteInput {
  readonly reviewId: string;
  readonly suiteReference: ContentReference;
  readonly result: EvalSuiteResult;
  readonly tick: number;
}

export interface OmitEvalInput {
  readonly reviewId: string;
  readonly caseReference: ContentReference;
  readonly reason: string;
  readonly tick: number;
}

export interface RequestChangesFeedbackInput {
  readonly id?: string;
  readonly goal: string;
  readonly baseVersion?: ContentReference;
  readonly capability?: WorkRequest["capability"];
  readonly inputs?: readonly string[];
  readonly quote?: WorkRequest["quote"];
}

export interface ReviewDecisionInput {
  readonly id?: string;
  readonly reviewId: string;
  readonly kind: ReviewDecisionKind;
  readonly actor: string;
  readonly tick: number;
  readonly rationale?: ReviewRationale;
  readonly acceptRisk?: boolean;
  readonly confirmation?: DeploymentConfirmation;
  readonly slot?: DeploymentSlot;
  readonly historicalDeploymentId?: string;
  readonly feedback?: RequestChangesFeedbackInput;
  readonly recoveryEvidenceIds?: readonly string[];
}

export interface ConfirmDeploymentInput {
  readonly reviewId: string;
  readonly actor: string;
  readonly tick: number;
  readonly slot: DeploymentSlot;
  readonly evidenceIds?: readonly string[];
  readonly confirmationId?: string;
  readonly historicalDeploymentId?: string;
}

export interface ActivateDeploymentInput {
  readonly commandId?: string;
  readonly confirmation: DeploymentConfirmation;
  readonly actor?: string;
  readonly tick?: number;
  readonly kind?: "deploy" | "revert";
  readonly historicalDeploymentId?: string;
  readonly acceptRisk?: boolean;
}

export interface PinJobInput {
  readonly jobId: string;
  readonly slot: DeploymentSlot;
  readonly tick: number;
}

export interface CausalLinkInput {
  readonly id?: string;
  readonly tick: number;
  readonly actor?: string;
  readonly subject: ReviewCausalLink;
  readonly links: readonly ReviewCausalLink[];
  readonly summary: string;
}

export type ReviewCommandResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly ReviewDiagnostic[] };

export interface DeploymentManifestInput {
  readonly root: ContentReference;
  readonly dependencies?: readonly ContentReference[];
  readonly registry?: Pick<ContentRegistry, "resolveExact">;
  readonly allowCandidateSnapshot?: boolean;
}

export type DeploymentManifestResult = ReviewCommandResult<DeploymentDependencyManifest>;

export interface ReviewDeploymentOptions {
  readonly registry?: Pick<ContentRegistry, "resolveExact">;
  readonly workbench?: EngineeringWorkbenchService;
  readonly evalCatalog?: import("../eval-runner/public.js").EvalCatalog;
  readonly mandatoryEvalReferences?: readonly ContentReference[];
  readonly candidateResolver?: (candidateId: string) => ArtifactCandidate | undefined;
  readonly artifactResolver?: (reference: ContentReference) => ResolvedInstructionArtifact | undefined;
  readonly initialState?: ReviewDeploymentState;
}

export interface ReviewDeploymentService {
  readonly snapshot: () => ReviewDeploymentState;
  readonly createChangeRequest: (input: CreateChangeRequestInput) => ReviewCommandResult<ChangeRequest>;
  readonly openReview: (input: CreateChangeRequestInput) => ReviewCommandResult<ChangeRequest>;
  readonly getReview: (reviewId: string) => ChangeRequest | undefined;
  readonly listReviews: () => readonly ChangeRequest[];
  readonly selectEvals: (input: SelectEvalInput) => ReviewCommandResult<ChangeRequest>;
  readonly attachEvalResult: (input: AttachEvalResultInput) => ReviewCommandResult<EvalEvidence>;
  readonly attachEvalSuite: (input: AttachEvalSuiteInput) => ReviewCommandResult<readonly EvalEvidence[]>;
  readonly omitEval: (input: OmitEvalInput) => ReviewCommandResult<EvalEvidence>;
  readonly listEvidence: (reviewId: string) => readonly EvalEvidence[];
  readonly evaluateEligibility: (reviewId: string, acceptRisk?: boolean) => DeploymentEligibility;
  readonly confirmDeployment: (input: ConfirmDeploymentInput) => ReviewCommandResult<DeploymentConfirmation>;
  readonly activateDeployment: (input: ActivateDeploymentInput) => ReviewCommandResult<DeploymentRecord>;
  readonly decide: (input: ReviewDecisionInput) => ReviewCommandResult<ReviewDecisionRecord>;
  readonly requestChanges: (input: ReviewDecisionInput) => ReviewCommandResult<ReviewDecisionRecord>;
  readonly retainProduction: (input: ReviewDecisionInput) => ReviewCommandResult<ReviewDecisionRecord>;
  readonly deploy: (input: ReviewDecisionInput) => ReviewCommandResult<ReviewDecisionRecord>;
  readonly revert: (input: ReviewDecisionInput) => ReviewCommandResult<ReviewDecisionRecord>;
  readonly getDeployment: (deploymentId: string) => DeploymentRecord | undefined;
  readonly listDeployments: (slot?: DeploymentSlot) => readonly DeploymentRecord[];
  readonly getActiveDeployment: (slot: DeploymentSlot) => DeploymentRecord | undefined;
  readonly pinJob: (input: PinJobInput) => ReviewCommandResult<JobDeploymentPin>;
  readonly getJobPin: (jobId: string) => JobDeploymentPin | undefined;
  readonly addCausalLink: (input: CausalLinkInput) => ReviewCommandResult<GovernanceHistoryEvent>;
  readonly governanceHistory: (filter?: GovernanceHistoryFilter) => readonly GovernanceHistoryEvent[];
  readonly historyFor: (id: string) => readonly GovernanceHistoryEvent[];
  readonly createProductionResolver: (slot: DeploymentSlot) => { readonly resolve: (reference: ContentReference) => { readonly ok: true; readonly pin: ExactDeploymentPin } | { readonly ok: false } };
}

export interface DeploymentEligibility {
  readonly allowed: boolean;
  readonly reviewId: string;
  readonly requiredCases: readonly ContentReference[];
  readonly selectedCases: readonly ContentReference[];
  readonly evidenceIds: readonly string[];
  readonly missingCases: readonly ContentReference[];
  readonly failedCases: readonly ContentReference[];
  readonly invalidCases: readonly ContentReference[];
  readonly interruptedCases: readonly ContentReference[];
  readonly omittedCases: readonly ContentReference[];
  readonly unresolvedCases: readonly ContentReference[];
  readonly acceptedRisk: boolean;
  readonly diagnostics: readonly ReviewDiagnostic[];
}

export interface GovernanceHistoryFilter {
  readonly reviewId?: string;
  readonly deploymentId?: string;
  readonly jobId?: string;
  readonly incidentId?: string;
  readonly kind?: GovernanceEventKind;
}
