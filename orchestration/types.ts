import type { ArtifactRef, ContentRegistry } from "../content-registry/index.ts";
import type { ContextRequest, ContextService, ContextSnapshot } from "../context/index.ts";
import type { DelegationRequest } from "../instruction/index.ts";
import type { JobApplicationService } from "../park-operations/index.ts";
import type { TraceSink } from "../trace-replay/index.ts";

/** The four authored priority bands are deliberately ordered independently of
 * a job's numeric priority. A throughput job with priority 10 cannot outrank
 * an active containment incident with priority 0. */
export type OrchestrationPriorityClass =
  | "SAFETY_INCIDENT"
  | "CONTAINMENT"
  | "ANIMAL_HEALTH"
  | "GUEST_THROUGHPUT"
  | "ROUTINE";

export type WorkerRole = "KEEPER" | "SECURITY" | "MAINTENANCE" | "OBSERVER" | string;

/** The small read shape consumed by the pure scheduler. It intentionally
 * accepts projections from Park Operations as well as test fixtures. */
export interface SchedulingJob {
  readonly id: string;
  readonly type: string;
  readonly targetRefs: readonly string[];
  readonly priority: number;
  readonly dueTime?: number;
  readonly priorityClass?: OrchestrationPriorityClass;
  readonly severity?: 0 | 1 | 2 | 3 | 4;
  readonly safetyCritical?: boolean;
  readonly requiredRole?: WorkerRole;
  readonly requiredToolIds?: readonly string[];
  readonly requiredContextRefs?: readonly string[];
  readonly requiredContextLoad?: number;
  readonly queueCapacity?: number;
  readonly assignedAgentId?: string;
  readonly status?: string;
  readonly active?: boolean;
  readonly expectedVersion?: number;
}

export interface SchedulingWorker {
  readonly id: string;
  readonly role?: WorkerRole;
  readonly status?: string;
  readonly tools?: readonly string[];
  readonly toolIds?: readonly string[];
  readonly contextBudget: number;
  readonly contextLoad?: number;
  readonly queueLength?: number;
  readonly queueCapacity?: number;
  readonly managerId?: string;
  readonly enabled?: boolean;
  readonly load?: number;
  readonly sourceId?: string;
  /** Undefined means routing has not inspected context yet; an explicit empty
   * list means the worker is known to have none of the required refs. */
  readonly loadedContextRefs?: readonly string[];
}

export interface DelegationRule {
  readonly id: string;
  readonly priority: number;
  readonly taskTypes?: readonly string[];
  readonly roles?: readonly WorkerRole[];
  readonly targetWorkerIds?: readonly string[];
  readonly requiredToolIds?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly maxQueueLength?: number;
  readonly maxContextLoad?: number;
  readonly enabled?: boolean;
}

export interface PriorityPolicy {
  readonly safetyIncidents?: number;
  readonly containment?: number;
  readonly animalHealth?: number;
  readonly guestThroughput?: number;
  readonly routine?: number;
  readonly safetyFloor?: 0 | 1 | 2 | 3 | 4;
}

export interface AuthorityBoundary {
  readonly allowedTaskTypes?: readonly string[];
  readonly allowedWorkerRoles?: readonly WorkerRole[];
  readonly allowedToolIds?: readonly string[];
  readonly maxEscalationSeverity?: 0 | 1 | 2 | 3 | 4;
  readonly canDispatchSecurity?: boolean;
  readonly canAssign?: boolean;
}

export interface RoutingPolicy {
  readonly id: string;
  readonly priority: number;
  readonly taskTypes?: readonly string[];
  readonly workerRoles?: readonly WorkerRole[];
  readonly artifactRefs?: readonly ArtifactRef[];
  readonly knowledgeRefs?: readonly ArtifactRef[];
  readonly memoryRefs?: readonly string[];
  readonly toolIds?: readonly string[];
  readonly includeRefs?: readonly string[];
  readonly omitRefs?: readonly string[];
  readonly maxContextLoad?: number;
  readonly required?: boolean;
}

export interface EscalationPolicy {
  readonly severityThreshold: 0 | 1 | 2 | 3 | 4;
  readonly fallbackAttempts: number;
  readonly dispatchRoles?: readonly WorkerRole[];
  readonly immediate?: boolean;
}

/** Application PRD aliases. Authored content can use either the concise
 * orchestration names above or the AgentDefinition managerConfig names. */
export interface EscalationRule extends EscalationPolicy {
  readonly id?: string;
  readonly condition?: string;
}

export interface ReportingRule extends ReportingPolicy {
  readonly id?: string;
}

export interface ReportingPolicy {
  readonly routineBatchSize: number;
  readonly exceptionImmediate: boolean;
  readonly includeTraceLinks: boolean;
}

export type ManagerConfigStatus = "DRAFT" | "REVIEW" | "DEPLOYED" | "RETIRED";

/** Exact, reviewable Manager configuration. `workerPool` and
 * `configurationVersion` are aliases retained for adapters authored against
 * the application PRD wording. */
export interface ManagerConfig {
  readonly id: string;
  readonly managerId?: string;
  readonly version: number;
  readonly configurationVersion?: number;
  readonly status?: ManagerConfigStatus;
  readonly missionPromptRef: ArtifactRef;
  readonly workerIds: readonly string[];
  readonly workerPool?: readonly string[];
  readonly workerAgentIds?: readonly string[];
  readonly maxWorkers: number;
  readonly maxConcurrentWorkers?: number;
  readonly maxTier: number;
  readonly contextBudget?: number;
  readonly rules: readonly DelegationRule[];
  readonly delegationRules?: readonly DelegationRule[];
  readonly priorityPolicy: PriorityPolicy;
  readonly authority: AuthorityBoundary;
  readonly routingPolicies: readonly RoutingPolicy[];
  readonly contextRoutingPolicyId?: string;
  readonly contextRoutingPolicy?: RoutingPolicy;
  readonly escalation: EscalationPolicy;
  readonly escalationRules?: readonly EscalationRule[];
  readonly reporting: ReportingPolicy;
  readonly reportingRules?: readonly ReportingRule[];
  readonly artifactRefs?: readonly ArtifactRef[];
}

export type ManagerValidationCode =
  | "INVALID_ID"
  | "INVALID_VERSION"
  | "MISSING_MISSION_PROMPT"
  | "MISSING_ARTIFACT"
  | "DUPLICATE_WORKER"
  | "WORKER_NOT_FOUND"
  | "WORKER_UNAVAILABLE"
  | "WORKER_ALREADY_MANAGED"
  | "INVALID_MAX_WORKERS"
  | "INVALID_MAX_TIER"
  | "DUPLICATE_RULE"
  | "INVALID_RULE_TARGET"
  | "RULE_TARGET_NOT_IN_POOL"
  | "RULE_MISSING_TOOL"
  | "DUPLICATE_ROUTING_POLICY"
  | "ROUTING_POLICY_TARGET_NOT_IN_POOL"
  | "ROUTING_POLICY_OVERLAP"
  | "ROUTING_CONTEXT_OVERFLOW"
  | "INVALID_ESCALATION_POLICY"
  | "INVALID_REPORTING_POLICY"
  | "AUTHORITY_DENIED"
  | "CONFIG_VERSION_CONFLICT";

export interface ManagerValidationError {
  readonly code: ManagerValidationCode;
  readonly path: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number>>;
}

export interface ManagerValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ManagerValidationError[];
  readonly warnings: readonly string[];
  readonly exactRef: string;
}

export interface ManagerConfigurationService {
  validate(config: ManagerConfig, workers?: readonly SchedulingWorker[], activeManagerByWorker?: Readonly<Record<string, string>>): ManagerValidationResult;
  save(config: ManagerConfig, workers?: readonly SchedulingWorker[], activeManagerByWorker?: Readonly<Record<string, string>>): { readonly ok: true; readonly value: ManagerConfig } | { readonly ok: false; readonly errors: readonly ManagerValidationError[] };
  get(id: string, version?: number): ManagerConfig | undefined;
  list(): readonly ManagerConfig[];
  exactRef(config: ManagerConfig): string;
}

export type DelegationFailure =
  | "NO_MATCHING_RULE"
  | "NO_ELIGIBLE_WORKER"
  | "MISSING_TOOL"
  | "WORKER_CONTEXT_OVERFLOW"
  | "AUTHORITY_DENIED"
  | "MANAGER_NOT_ACTIVE"
  | "WORKER_MANAGER_CONFLICT"
  | "ALREADY_ASSIGNED"
  | "INVALID_REQUEST";

export interface EligibilityFact {
  readonly workerId: string;
  readonly eligible: boolean;
  readonly role: string;
  readonly status: string;
  readonly queueLength: number;
  readonly queueCapacity: number;
  readonly contextLoad: number;
  readonly contextBudget: number;
  readonly missingToolIds: readonly string[];
  readonly missingContextRefs: readonly string[];
  readonly reasons: readonly string[];
  readonly matchedRuleId?: string;
}

export type SchedulingDecision =
  | {
      readonly status: "ASSIGNED";
      readonly workerId: string;
      readonly matchedRuleId: string;
      readonly eligibility: readonly EligibilityFact[];
      readonly tieBreak: string;
      readonly priorityClass: OrchestrationPriorityClass;
    }
  | {
      readonly status: "UNASSIGNED";
      readonly reason: DelegationFailure;
      readonly eligibility: readonly EligibilityFact[];
      readonly priorityClass: OrchestrationPriorityClass;
    };

export interface SchedulingInput {
  readonly job: SchedulingJob;
  readonly workers: readonly SchedulingWorker[];
  readonly manager?: ManagerConfig;
  readonly activeManagerByWorker?: Readonly<Record<string, string>>;
  readonly activeAssignments?: Readonly<Record<string, string>>;
  readonly rules?: readonly DelegationRule[];
  readonly priorityPolicy?: PriorityPolicy;
}

export interface OrchestrationScheduler {
  decide(input: SchedulingInput): SchedulingDecision;
  order(jobs: readonly SchedulingJob[], policy?: PriorityPolicy): readonly SchedulingJob[];
}

export interface RoutingInput {
  readonly managerId: string;
  readonly managerConfig: ManagerConfig;
  readonly worker: SchedulingWorker;
  readonly job: SchedulingJob;
  readonly logicalTime?: number;
  readonly baseContext?: Partial<ContextRequest>;
}

export interface RoutingResult {
  readonly status: "ROUTED" | "BLOCKED";
  readonly managerId: string;
  readonly workerId: string;
  readonly jobId: string;
  readonly policyId?: string;
  readonly snapshot?: ContextSnapshot;
  readonly includedRefs: readonly string[];
  readonly omittedRefs: readonly string[];
  readonly blockedInputs: readonly string[];
  readonly projectedLoad: number;
  readonly budget: number;
  readonly diagnostics: readonly string[];
  readonly request?: ContextRequest;
}

export interface RoutingService {
  route(input: RoutingInput): RoutingResult;
  managerSummary(managerId: string, config: ManagerConfig, workers: readonly SchedulingWorker[], logicalTime?: number, summary?: ManagerParkSummary): RoutingResult;
}

export interface ManagerParkSummary {
  readonly park: Readonly<Record<string, unknown>>;
  readonly incidents: readonly Readonly<Record<string, unknown>>[];
  readonly schedules: readonly Readonly<Record<string, unknown>>[];
  readonly workers: readonly Readonly<Record<string, unknown>>[];
}

export interface OrchestrationDelegationRequest extends DelegationRequest {
  readonly kind?: "DELEGATION";
  readonly managerId?: string;
  readonly task?: SchedulingJob;
  readonly expectedJobVersion?: number;
  readonly contextRequest?: Partial<ContextRequest>;
  readonly childTraceId?: string;
}

export interface EscalationRequest {
  readonly kind: "ESCALATION";
  readonly managerId?: string;
  readonly executionId?: string;
  readonly jobId: string;
  readonly childTraceId?: string;
  readonly severity: 0 | 1 | 2 | 3 | 4;
  readonly reason: string;
  readonly failureCode?: string;
  readonly fallbackAttempts?: number;
  readonly targetRefs?: readonly string[];
  readonly taskType?: string;
}

export interface ReportEvent {
  readonly kind: "REPORT";
  readonly managerId?: string;
  readonly executionId?: string;
  readonly jobId: string;
  readonly status: string;
  readonly severity?: 0 | 1 | 2 | 3 | 4;
  readonly exception?: boolean;
  readonly message?: string;
  readonly childTraceId?: string;
  readonly facts?: Readonly<Record<string, unknown>>;
}

export type OrchestrationRequest = OrchestrationDelegationRequest | EscalationRequest | ReportEvent;

export type OrchestrationCommand =
  | {
      readonly type: "ASSIGN_JOB";
      readonly commandId: string;
      readonly managerId: string;
      readonly jobId: string;
      readonly workerId: string;
      readonly matchedRuleId: string;
      readonly priorityClass: OrchestrationPriorityClass;
      readonly expectedJobVersion?: number;
      readonly routing: RoutingResult;
      readonly accepted: boolean;
      readonly error?: string;
    }
  | {
      readonly type: "DISPATCH_SECURITY";
      readonly commandId: string;
      readonly managerId: string;
      readonly parentJobId: string;
      readonly workerId?: string;
      readonly accepted: boolean;
      readonly reason: string;
      readonly decision: SchedulingDecision;
      readonly childTraceId?: string;
    }
  | {
      readonly type: "ESCALATE";
      readonly commandId: string;
      readonly managerId: string;
      readonly jobId: string;
      readonly severity: 0 | 1 | 2 | 3 | 4;
      readonly reason: string;
      readonly immediate: boolean;
      readonly childTraceId?: string;
    }
  | {
      readonly type: "REPORT";
      readonly commandId: string;
      readonly managerId: string;
      readonly jobIds: readonly string[];
      readonly immediate: boolean;
      readonly status: string;
      readonly childTraceIds: readonly string[];
      readonly facts?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly type: "REJECT";
      readonly commandId: string;
      readonly managerId: string;
      readonly jobId?: string;
      readonly reason: DelegationFailure | ManagerValidationCode;
      readonly diagnostics: readonly string[];
    };

export type OrchestrationEventType =
  | "MANAGER_ACTIVATED"
  | "DECISION"
  | "ELIGIBILITY"
  | "CONTEXT_ROUTED"
  | "CONTEXT_BLOCKED"
  | "ASSIGNMENT_REQUESTED"
  | "ASSIGNED"
  | "ASSIGNMENT_REJECTED"
  | "ESCALATION"
  | "SECURITY_DISPATCH"
  | "REPORT";

export interface OrchestrationEvent {
  readonly id: string;
  readonly sequence: number;
  readonly managerId: string;
  readonly type: OrchestrationEventType;
  readonly logicalTime: number;
  readonly jobId?: string;
  readonly workerId?: string;
  readonly childTraceId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ManagerAssignmentView {
  readonly jobId: string;
  readonly workerId: string;
  readonly status: "REQUESTED" | "ASSIGNED" | "REJECTED" | "COMPLETED";
  readonly matchedRuleId?: string;
  readonly childTraceId?: string;
  readonly priorityClass?: OrchestrationPriorityClass;
  readonly decision?: SchedulingDecision;
  readonly routing?: RoutingResult;
}

export interface ManagerOperationsView {
  readonly id: string;
  readonly status: "ACTIVE" | "INACTIVE" | "INVALID";
  readonly configurationVersion: number;
  readonly missionPromptRef?: ArtifactRef;
  readonly workerIds: readonly string[];
  readonly workerCount: number;
  readonly maxWorkers: number;
  readonly maxConcurrentWorkers: number;
  readonly assignments: readonly ManagerAssignmentView[];
  readonly queuePressure: Readonly<Record<string, number>>;
  readonly context: {
    readonly budget: number;
    readonly projectedLoad: number;
    readonly routed: number;
    readonly blocked: number;
    readonly includedRefs: readonly string[];
    readonly omittedRefs: readonly string[];
    readonly summaryStatus: "ROUTED" | "BLOCKED";
    readonly summarySections: readonly (keyof ManagerParkSummary)[];
  };
  readonly escalation: {
    readonly open: number;
    readonly immediateReports: number;
    readonly securityDispatches: number;
  };
  readonly reports: {
    readonly pendingRoutine: number;
    readonly sent: number;
    readonly recent: readonly string[];
  };
  readonly recentEvents: readonly OrchestrationEvent[];
  readonly sourceId: string;
  readonly eligibility: ManagerEligibility;
  readonly availableJobs: readonly SchedulingJob[];
  readonly incidents: readonly Readonly<Record<string, unknown>>[];
}

export interface OrchestrationJobPort {
  assign(jobId: string, agentId: string, commandId: string, expectedVersion?: number): unknown;
}

export interface OrchestrationDependencies {
  readonly context?: ContextService;
  readonly content?: ContentRegistry;
  readonly jobs?: OrchestrationJobPort | JobApplicationService;
  readonly traces?: TraceSink;
  readonly workers?: readonly SchedulingWorker[] | (() => readonly SchedulingWorker[]);
  readonly configs?: readonly ManagerConfig[];
  readonly configuration?: ManagerConfigurationService;
  readonly logicalTime?: number | (() => number);
  readonly activeManagerByWorker?: Readonly<Record<string, string>>;
  /** Active exact Manager configuration is resolved by Review/Deployment;
   * orchestration only consumes this read port. */
  readonly deployment?: { readonly resolveActive: (artifactId: string) => ArtifactRef | undefined };
  readonly eligibility?: () => ManagerEligibility;
  readonly parkSummary?: () => ManagerParkSummary;
}

export interface ManagerEligibility {
  readonly eligible: boolean;
  readonly code: "AVAILABLE" | "PRESSURE_REQUIRED" | "PURCHASE_REQUIRED" | "REVIEW_REQUIRED" | "ACTIVE";
  readonly reason: string;
  readonly workerCount?: number;
  readonly interventions?: number;
  readonly purchased?: boolean;
  readonly reviewed?: boolean;
}

export interface ManagerEvaluationResult {
  readonly passed: boolean;
  readonly exact: boolean;
  readonly configRef: string;
  readonly canonical: string;
  readonly assertions: readonly {
    readonly id: string;
    readonly passed: boolean;
    readonly message: string;
  }[];
}

export interface OrchestrationService {
  decide(input: SchedulingInput): SchedulingDecision;
  handle(request: OrchestrationRequest): readonly OrchestrationCommand[];
  activate(config: ManagerConfig): { readonly ok: true; readonly config: ManagerConfig } | { readonly ok: false; readonly errors: readonly ManagerValidationError[] };
  getManager(id: string): ManagerOperationsView;
  managers(): readonly ManagerOperationsView[];
  events(managerId?: string): readonly OrchestrationEvent[];
  assignments(managerId?: string): readonly ManagerAssignmentView[];
  manifest(managerId?: string): OrchestrationReplayManifest;
  eligibility(config?: ManagerConfig): ManagerEligibility;
  validateConfiguration(config: ManagerConfig): ManagerValidationResult;
  evaluateConfiguration(config: ManagerConfig): ManagerEvaluationResult;
  configurations(): readonly ManagerConfig[];
  subscribe(listener: () => void): () => void;
  refresh(): void;
}

export interface OrchestrationReplayManifest {
  readonly schemaVersion: 1;
  readonly manager: ManagerConfig;
  readonly workers: readonly SchedulingWorker[];
  readonly jobs?: readonly SchedulingJob[];
  readonly queuedJobsByRequest?: readonly (readonly SchedulingJob[])[];
  readonly jobPortAvailable?: boolean;
  readonly jobListAvailable?: boolean;
  readonly assignmentOutcomes?: readonly {
    readonly jobId: string;
    readonly workerId: string;
    readonly commandId: string;
    readonly accepted: boolean;
  }[];
  readonly expectedAssignments?: readonly ManagerAssignmentView[];
  readonly requestLogicalTimes?: readonly number[];
  readonly activationLogicalTime?: number;
  readonly requests: readonly OrchestrationRequest[];
  readonly expectedEvents?: readonly OrchestrationEvent[];
  readonly expectedCanonical?: string;
}

export interface OrchestrationReplayResult {
  readonly status: "EXACT" | "DIVERGED" | "UNAVAILABLE";
  readonly isolated: true;
  readonly events: readonly OrchestrationEvent[];
  readonly canonical: string;
  readonly firstDifference?: { readonly index?: number; readonly field?: string; readonly expected?: unknown; readonly actual?: unknown; readonly message: string };
  readonly unavailableReason?: string;
}
