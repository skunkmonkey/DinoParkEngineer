import type {
  ContentReference,
  ContentRegistry,
  ResolvedContentManifest,
} from "../content-registry/public.js";
import type {
  ContextItem,
  ContextManifest,
  ContextRoute,
  RetentionPolicy,
} from "../context/public.js";
import type {
  FactValue,
  InstructionArtifactClass,
  InstructionDecision,
  InstructionEvidence,
  ResolvedInstructionArtifact,
} from "../instruction/public.js";
import type {
  CommandResult,
  ScenarioFixture,
  StableId,
  ToolEvidence,
  WorldCommand,
  WorldState,
} from "../simulation/public.js";
import type {
  Trace,
  TraceComparisonResult,
  TraceLink,
} from "../trace-replay/public.js";

export type EvalId = StableId;
export type EvalRisk = "low" | "medium" | "high" | "critical";
export type EvalAvailability = "available" | "unavailable" | "hidden";
export type EvalStatus = "completed" | "passed" | "failed" | "invalid" | "timed-out" | "interrupted";
export type EvalAssertionSubject = "world" | "job" | "context" | "trace" | "tool" | "message" | "outcome";
export type EvalAssertionOperator =
  | "equals"
  | "not-equals"
  | "in"
  | "contains"
  | "exists"
  | "not-exists"
  | "gte"
  | "lte"
  | "count-equals";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface EvalCostReference {
  readonly id: EvalId;
  readonly kind: "build" | "run";
  readonly units: number;
  readonly label: string;
}

export interface EvalJobFixture {
  readonly id: EvalId;
  readonly taskId: EvalId;
  readonly agentId: EvalId;
  readonly targetId: EvalId;
  readonly goal: string;
}

/**
 * A serializable Context boundary for an Eval. Runtime ports are deliberately
 * absent: an Eval can assemble a fresh Context, but cannot reach production
 * Memory, Economy, or Persistence.
 */
export interface EvalContextFixture {
  readonly agentId: EvalId;
  readonly jobId: EvalId;
  readonly decisionTick: number;
  readonly capacity: number;
  readonly routes: readonly ContextRoute[];
  readonly availableSources: readonly ContextItem[];
  readonly priorRetained: readonly ContextItem[];
  readonly additions: readonly ContextItem[];
  readonly retentionPolicy: RetentionPolicy;
}

export interface EvalCandidateInjection {
  readonly point: "instruction-artifacts";
  readonly requiredArtifactClasses: readonly InstructionArtifactClass[];
}

export interface EvalCandidate {
  readonly reference: ContentReference;
  readonly artifactReferences: readonly ContentReference[];
  /** Direct artifacts are useful for offline fixtures and remain declarative. */
  readonly artifacts?: readonly ResolvedInstructionArtifact[];
}

export interface EvalFixture {
  readonly schemaVersion: "1";
  readonly id: EvalId;
  readonly version: string;
  readonly scenario: ScenarioFixture;
  readonly job: EvalJobFixture;
  readonly context: EvalContextFixture;
  readonly candidateInjection: EvalCandidateInjection;
  readonly facts: Readonly<Record<string, FactValue>>;
  readonly evidence: readonly InstructionEvidence[];
  readonly retryCounts?: Readonly<Record<string, number>>;
  readonly maxTicks: number;
}

export interface EvalAssertion {
  readonly id: EvalId;
  readonly subject: EvalAssertionSubject;
  /** Dotted path. Array segments may be numeric or stable entity IDs. */
  readonly path: string;
  readonly operator: EvalAssertionOperator;
  readonly expected?: JsonValue;
  readonly evidenceKinds?: readonly string[];
}

export interface EvalCase {
  readonly schemaVersion: "1";
  readonly id: EvalId;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly risk: EvalRisk;
  readonly availability: EvalAvailability;
  readonly availabilityReason?: string;
  readonly oneTime: boolean;
  readonly fixture: EvalFixture;
  readonly assertions: readonly EvalAssertion[];
  readonly timeoutTicks: number;
  readonly cost: {
    readonly build: EvalCostReference;
    readonly run: EvalCostReference;
  };
  readonly defaultCandidate?: EvalCandidate;
  readonly previousResultIds: readonly EvalId[];
}

export interface EvalSuite {
  readonly schemaVersion: "1";
  readonly id: EvalId;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly availability: EvalAvailability;
  readonly caseReferences: readonly ContentReference[];
}

export interface EvalCatalog {
  readonly cases: readonly EvalCase[];
  readonly suites: readonly EvalSuite[];
}

export interface EvalSelectionRequest {
  readonly caseReferences?: readonly ContentReference[];
  readonly suiteReferences?: readonly ContentReference[];
}

export interface EvalSelectionItem {
  readonly caseReference: ContentReference;
  readonly source: "case" | "suite";
  readonly suiteReference?: ContentReference;
  readonly title?: string;
  readonly risk?: EvalRisk;
  readonly availability: EvalAvailability;
  readonly availabilityReason?: string;
  readonly previousResultIds: readonly EvalId[];
  readonly estimatedRunCost: EvalCostReference;
}

export interface EvalSelectionPlan {
  readonly schemaVersion: "1";
  readonly items: readonly EvalSelectionItem[];
  readonly selectedCases: readonly ContentReference[];
  readonly unavailableCases: readonly EvalSelectionItem[];
  readonly includedRisks: readonly EvalRisk[];
  readonly estimatedCost: {
    readonly buildUnits: number;
    readonly runUnits: number;
    readonly totalUnits: number;
    readonly references: readonly EvalCostReference[];
  };
  readonly diagnostics: readonly EvalDiagnostic[];
}

export interface EvalDependencyManifest {
  readonly schemaVersion: "1";
  readonly runnerSchemaVersion: "1";
  readonly traceSchemaVersion: "1";
  readonly case: ContentReference;
  readonly fixture: ContentReference;
  readonly candidate: ContentReference;
  readonly dependencies: readonly ContentReference[];
  readonly resolvedContent?: ResolvedContentManifest;
  readonly fingerprint: string;
}

export interface EvalAssertionEvidence {
  readonly traceEventIds: readonly StableId[];
  readonly links: readonly TraceLink[];
}

export interface EvalMismatch {
  readonly path: string;
  readonly expected: JsonValue | undefined;
  readonly observed: JsonValue | undefined;
  readonly reasonCode: string;
}

export interface EvalAssertionResult {
  readonly id: EvalId;
  readonly subject: EvalAssertionSubject;
  readonly path: string;
  readonly operator: EvalAssertionOperator;
  readonly expected?: JsonValue;
  readonly observed?: JsonValue;
  readonly passed: boolean;
  readonly evidence: EvalAssertionEvidence;
  readonly mismatch?: EvalMismatch;
}

export interface EvalContextObservation {
  readonly before: ContextManifest;
  readonly after: ContextManifest;
  readonly diagnostics: readonly string[];
}

export interface EvalToolObservation {
  readonly command: WorldCommand;
  readonly result: CommandResult;
  readonly evidence: readonly (ToolEvidence | InstructionEvidence)[];
}

export interface EvalMessageObservation {
  readonly id: EvalId;
  readonly type: "report" | "request" | "escalation" | "handoff" | "notice";
  readonly summary: string;
}

export interface EvalOutcomeObservation {
  readonly kind: "complete" | "failure" | "stop" | "escalate" | "interrupted";
  readonly reasonCode: string;
  readonly expected?: string;
  readonly observed?: string;
}

export interface EvalExecutionObservation {
  readonly world: WorldState;
  readonly job: EvalJobFixture;
  readonly context: EvalContextObservation;
  readonly trace: Trace;
  readonly tools: readonly EvalToolObservation[];
  readonly messages: readonly EvalMessageObservation[];
  readonly outcome: EvalOutcomeObservation;
  readonly decision?: InstructionDecision;
}

export interface EvalReplayReference {
  readonly sessionId: EvalId;
  readonly traceId: EvalId;
  readonly mode: "historical-replay";
  readonly available: boolean;
  readonly firstMismatchEventId?: StableId;
  readonly firstMismatchTick?: number;
}

export interface EvalSurfaceProjection {
  readonly mode: "simulation";
  readonly label: "SIMULATION";
  readonly production: false;
  readonly paused: boolean;
  readonly caseReference: ContentReference;
  readonly traceReference: ContentReference;
  readonly replayReference: EvalReplayReference;
  readonly accessibleNotice: string;
}

export interface EvalCaseResult {
  readonly schemaVersion: "1";
  readonly resultId: EvalId;
  readonly mode: "simulation";
  readonly caseReference: ContentReference;
  readonly fixtureReference: ContentReference;
  readonly candidateReference: ContentReference;
  readonly dependencyManifest: EvalDependencyManifest;
  readonly fixtureFingerprint: string;
  readonly cost: {
    readonly buildUnits: number;
    readonly runUnits: number;
    readonly totalUnits: number;
  };
  readonly status: EvalStatus;
  readonly reasonCode: string;
  readonly assertions: readonly EvalAssertionResult[];
  readonly assertionSummary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly executed: number;
  };
  readonly observation?: EvalExecutionObservation;
  readonly trace?: Trace;
  readonly replay: EvalReplayReference;
  readonly surface: EvalSurfaceProjection;
  readonly diagnostics: readonly EvalDiagnostic[];
}

export interface EvalSuiteResult {
  readonly schemaVersion: "1";
  readonly resultId: EvalId;
  readonly mode: "simulation";
  readonly suiteReference?: ContentReference;
  readonly selectedCases: readonly ContentReference[];
  readonly results: readonly EvalCaseResult[];
  readonly progress: readonly EvalProgress[];
  readonly summary: {
    readonly totalSelected: number;
    readonly completed: number;
    readonly passed: number;
    readonly failed: number;
    readonly invalid: number;
    readonly timedOut: number;
    readonly interrupted: number;
    readonly passRate?: number;
  };
  readonly surface: {
    readonly mode: "simulation";
    readonly label: "SIMULATION";
    readonly production: false;
    readonly accessibleNotice: string;
  };
  readonly diagnostics: readonly EvalDiagnostic[];
}

export interface EvalProgress {
  readonly caseReference: ContentReference;
  readonly index: number;
  readonly total: number;
  readonly status: "queued" | "running" | "completed" | "passed" | "failed" | "invalid" | "timed-out" | "interrupted";
}

export interface EvalDiagnostic {
  readonly code:
    | "EVAL_INVALID"
    | "EVAL_DUPLICATE"
    | "EVAL_UNAVAILABLE"
    | "EVAL_CONTENT_MISSING"
    | "EVAL_CONTENT_MISMATCH"
    | "EVAL_TIMEOUT"
    | "EVAL_INTERRUPTED"
    | "EVAL_ASSERTION_FAILED"
    | "EVAL_ISOLATION"
    | "EVAL_COMPARISON_BLOCKED";
  readonly path: string;
  readonly message: string;
}

export interface EvalRunOptions {
  readonly registry?: Pick<ContentRegistry, "resolveExact">;
  readonly candidate?: EvalCandidate;
  readonly resultId?: EvalId;
  readonly shouldInterrupt?: () => boolean;
  readonly onProgress?: (progress: EvalProgress) => void;
}

export interface EvalSuiteRunOptions extends EvalRunOptions {
  readonly suiteReference?: ContentReference;
}

export interface EvalComparisonDifference {
  readonly category: "assertion" | "outcome" | "context" | "action" | "cost" | "trace" | "dependency";
  readonly path: string;
  readonly left: JsonValue;
  readonly right: JsonValue;
}

export interface EvalComparison {
  readonly schemaVersion: "1";
  readonly compatible: boolean;
  readonly leftResultId: EvalId;
  readonly rightResultId: EvalId;
  readonly changedAssertions: readonly EvalId[];
  readonly differences: readonly EvalComparisonDifference[];
  readonly traceComparison?: TraceComparisonResult;
}

export type EvalRerunResult =
  | { readonly ok: true; readonly prior: EvalCaseResult; readonly rerun: EvalCaseResult; readonly comparison: EvalComparison }
  | { readonly ok: false; readonly prior: EvalCaseResult; readonly diagnostics: readonly EvalDiagnostic[] };

export interface EvalValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly EvalDiagnostic[];
}
