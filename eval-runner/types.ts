import type { ArtifactRef, EvalAssertion, EvalCaseDefinition, EvalSubjectType, JsonValue } from "../content-registry/index.ts";
import type { CreditBalance, CreditCommand, CreditResult } from "../economy-progression/index.ts";
import type { AgentDefinition, JobOutcome } from "../instruction/index.ts";
import type { ReplayManifest, TraceRecord, TraceSink } from "../trace-replay/index.ts";
import type { WorldEvent, WorldFixture, WorldSnapshot } from "../simulation/index.ts";

/** A stable identity for an authored eval version. Eval ids are a separate
 * namespace from artifact ids, so they intentionally use `id` rather than
 * `artifactId`. */
export interface EvalRef {
  readonly id: string;
  readonly version: number;
}

export function evalRefKey(ref: EvalRef): string {
  return `${ref.id}@${ref.version}`;
}

export function evalRefFromDefinition(definition: EvalCaseDefinition): EvalRef {
  return { id: definition.id, version: definition.version };
}

export type EvalBuildStatus = "UNBUILT" | "BUILT";

export interface EvalCatalogQuery {
  readonly id?: string;
  readonly version?: number;
  readonly tag?: string;
  readonly severity?: number;
  readonly subjectType?: EvalSubjectType;
  readonly built?: boolean;
  readonly search?: string;
}

export interface EvalCatalogEntry {
  readonly ref: EvalRef;
  readonly definition: EvalCaseDefinition;
  readonly buildStatus: EvalBuildStatus;
  readonly built: boolean;
  readonly buildCostCredits: number;
  readonly runCostCredits: number;
  readonly severityCoverage: number;
  readonly lastResult?: EvalCaseResult;
}

export type EvalBuildErrorCode =
  | "UNKNOWN_EVAL"
  | "ALREADY_BUILT"
  | "INVALID_TRANSACTION"
  | "TRANSACTION_FAILED"
  | "INSUFFICIENT_FUNDS"
  | "BALANCE_VERSION_CONFLICT"
  | "CONTENT_UNAVAILABLE"
  | "INVALID_DEFINITION";

export interface EvalBuildError {
  readonly code: EvalBuildErrorCode;
  readonly message: string;
  readonly ref?: EvalRef;
  readonly transactionId?: string;
}

export interface BuiltEval {
  readonly ref: EvalRef;
  readonly definition: EvalCaseDefinition;
  readonly buildTransactionId: string;
  readonly builtAtLogicalTime: number;
  readonly canonicalHash: string;
  readonly replayManifest?: ReplayManifest;
  readonly sourceIncidentId?: string;
  readonly artifactRefs?: readonly ArtifactRef[];
}

export interface EvalSubject {
  readonly type: EvalSubjectType;
  readonly ref?: ArtifactRef;
  readonly agentDefinition?: AgentDefinition;
}

export interface EvalSuiteInput {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly evalRefs: readonly EvalRef[];
}

export interface EvalSuite extends EvalSuiteInput {
  readonly version: number;
}

export interface EvalSuiteUpdate {
  readonly title?: string;
  readonly description?: string;
  readonly evalRefs?: readonly EvalRef[];
}

export interface ValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type EvalSuiteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

export interface EvalRunOverrides {
  readonly add?: readonly EvalRef[];
  readonly remove?: readonly EvalRef[];
}

export interface EvalRunRequest {
  /** Stable idempotency scope for all per-case run charges. */
  readonly transactionId?: string;
  readonly suiteId?: string;
  readonly suiteRef?: string;
  readonly evalRefs?: readonly EvalRef[];
  /** Alias used by callers that call selections `caseRefs`. */
  readonly caseRefs?: readonly EvalRef[];
  readonly overrides?: EvalRunOverrides;
  readonly addRefs?: readonly EvalRef[];
  readonly removeRefs?: readonly EvalRef[];
  readonly subject?: EvalSubject;
  readonly subjectType?: EvalSubjectType;
  readonly subjectRef?: ArtifactRef;
  readonly agentDefinition?: AgentDefinition;
  readonly logicalTime?: number;
}

export type EvalCaseRunStatus =
  | "PASSED"
  | "FAILED"
  | "BLOCKED_UNBUILT"
  | "BLOCKED_CREDIT"
  | "BLOCKED_INPUT"
  | "UNAVAILABLE"
  | "ISOLATION_FAILED";

export interface EvalAssertionResult {
  readonly type: EvalAssertion["type"];
  readonly expected: JsonValue | undefined;
  readonly observed: JsonValue | undefined;
  readonly passed: boolean;
  readonly evidenceRefs: readonly string[];
  readonly message: string;
}

export interface EvalExecutionOutput {
  readonly outcome?: JobOutcome;
  readonly finalSnapshot?: WorldSnapshot;
  readonly events?: readonly WorldEvent[];
  readonly trace?: TraceRecord;
  readonly traceRef?: string;
  readonly replayManifest?: ReplayManifest;
  readonly contextLoad?: number;
  readonly contextBudget?: number;
  readonly durationLogicalTime?: number;
  readonly toolCalls?: readonly string[];
  readonly error?: string;
  readonly reasonCode?: string;
}

export interface EvalCaseResult {
  readonly id: string;
  readonly ref: EvalRef;
  readonly caseRef: EvalRef;
  readonly subject: EvalSubject;
  readonly status: EvalCaseRunStatus;
  readonly passed: boolean;
  readonly assertions: readonly EvalAssertionResult[];
  readonly expectedAssertions: readonly EvalAssertion[];
  readonly fixtureId: string;
  readonly seed: number;
  readonly subjectRef?: ArtifactRef;
  readonly buildCostCredits: number;
  readonly runCostCredits: number;
  readonly runTransactionId: string;
  readonly traceRef?: string;
  readonly replayManifest?: ReplayManifest;
  readonly canonicalHash: string;
  readonly startLogicalTime: number;
  readonly completionLogicalTime: number;
  readonly error?: string;
  /** Stable machine-readable explanation for blocked/unavailable cases. */
  readonly reasonCode?: string;
  readonly output?: EvalExecutionOutput;
}

export interface EvalBatchResult {
  readonly ok: boolean;
  readonly requestId: string;
  readonly evalRefs: readonly EvalRef[];
  readonly results: readonly EvalCaseResult[];
  readonly totalRunCostCredits: number;
  readonly chargedRunCostCredits: number;
  readonly partial: boolean;
  readonly startedAtLogicalTime: number;
  readonly completedAtLogicalTime: number;
}

export interface IncidentEvalInput {
  readonly incidentId: string;
  readonly title?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly severity?: number;
  readonly fixture?: WorldFixture;
  readonly seed?: number;
  readonly manifest?: ReplayManifest;
  readonly subjectType: EvalSubjectType;
  readonly subjectRef?: ArtifactRef;
  readonly assertions: readonly EvalAssertion[];
  readonly buildCostCredits?: number;
  readonly runCostCredits?: number;
  readonly transactionId?: string;
  readonly logicalTime?: number;
}

export type IncidentEvalErrorCode =
  | "INVALID_INCIDENT"
  | "INCIDENT_NOT_RECONSTRUCTABLE"
  | "CONTENT_UNAVAILABLE"
  | "ASSERTIONS_REQUIRED"
  | "INVALID_ASSERTION"
  | EvalBuildErrorCode;

export interface IncidentEvalError {
  readonly code: IncidentEvalErrorCode;
  readonly message: string;
  readonly incidentId?: string;
}

export interface EvalResultRepository {
  readonly get: (id: string) => EvalCaseResult | undefined;
  readonly list: (ref?: EvalRef) => readonly EvalCaseResult[];
  readonly put: (result: EvalCaseResult) => void;
}

export interface IsolatedRuntime {
  run(manifest: ReplayManifest): Promise<EvalExecutionOutput> | EvalExecutionOutput;
}

export interface EvalExecutionPorts {
  /** Must create a new runtime per call. The live simulation is never passed. */
  readonly createIsolatedRuntime?: (manifest: ReplayManifest) => IsolatedRuntime | Promise<IsolatedRuntime>;
  readonly charge?: (command: CreditCommand) => CreditResult;
  readonly balance?: () => CreditBalance;
  readonly recordTrace?: TraceSink;
}

export interface EvalServiceOptions {
  readonly catalog?: readonly EvalCaseDefinition[];
  readonly registry?: EvalRegistryPort;
  readonly execution?: EvalExecutionPorts;
  /** Alias accepted by callers using the plan's port name. */
  readonly executionPorts?: EvalExecutionPorts;
  readonly openingCredits?: number;
  readonly logicalTime?: number;
  readonly engineVersion?: string;
  readonly contentManifestVersion?: string;
  readonly contextSchemaVersion?: number | string;
}

export interface EvalRegistryPort {
  queryEvals(query?: { readonly id?: string; readonly version?: number; readonly tag?: string }): readonly EvalCaseDefinition[];
  getArtifact?(ref: ArtifactRef): unknown;
}

export interface EvalService {
  catalog(query?: EvalCatalogQuery): readonly EvalCatalogEntry[];
  build(ref: EvalRef, transactionId: string, logicalTime?: number): { readonly ok: true; readonly value: BuiltEval } | { readonly ok: false; readonly error: EvalBuildError };
  run(request: EvalRunRequest): Promise<EvalBatchResult>;
  preview(request: EvalRunRequest): { readonly evalRefs: readonly EvalRef[]; readonly cases: readonly EvalCatalogEntry[]; readonly totalRunCostCredits: number; readonly behavior: readonly string[]; readonly errors: readonly ValidationError[] };
  createSuite(input: EvalSuiteInput): EvalSuiteResult<EvalSuite>;
  renameSuite(id: string, title: string): EvalSuiteResult<EvalSuite>;
  updateSuite(id: string, update: EvalSuiteUpdate): EvalSuiteResult<EvalSuite>;
  removeSuite(id: string): boolean;
  suite(id: string): EvalSuite | undefined;
  suites(): readonly EvalSuite[];
  results(ref?: EvalRef): readonly EvalCaseResult[];
  fromIncident(input: IncidentEvalInput, transactionId?: string): { readonly ok: true; readonly value: BuiltEval } | { readonly ok: false; readonly error: IncidentEvalError };
  persistenceSnapshot(): EvalPersistenceState;
  restorePersistence(state: EvalPersistenceState): void;
}

export interface EvalPersistenceState {
  readonly definitions: readonly { readonly key: string; readonly definition: EvalCaseDefinition; readonly built: boolean; readonly builtEval?: BuiltEval }[];
  readonly suites: readonly EvalSuite[];
  readonly results: readonly EvalCaseResult[];
  readonly incidentManifests: readonly { readonly key: string; readonly manifest: ReplayManifest }[];
  readonly buildTransactions: readonly { readonly key: string; readonly value: string }[];
  readonly incidentConversions: readonly { readonly key: string; readonly ref: EvalRef; readonly fingerprint: string }[];
  readonly incidentTransactions: readonly { readonly key: string; readonly value: string }[];
  readonly requestSequence: number;
}

/** Public aliases kept deliberately close to the plan language. */
export type EvalRunnerService = EvalService;
