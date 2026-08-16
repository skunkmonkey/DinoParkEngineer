import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import { createContextService } from "../context/index.ts";
import { createManagerConfigurationService } from "./configuration.ts";
import { createOrchestrationScheduler, classifyPriority } from "./scheduler.ts";
import { createRoutingService } from "./routing.ts";
import type {
  DelegationFailure,
  EscalationRequest,
  ManagerAssignmentView,
  ManagerConfig,
  ManagerConfigurationService,
  ManagerEligibility,
  ManagerEvaluationResult,
  ManagerOperationsView,
  ManagerParkSummary,
  ManagerValidationResult,
  ManagerValidationError,
  OrchestrationCommand,
  OrchestrationDependencies,
  OrchestrationEvent,
  OrchestrationDelegationRequest,
  OrchestrationReplayManifest,
  OrchestrationRequest,
  OrchestrationService,
  ReportEvent,
  SchedulingDecision,
  SchedulingJob,
  SchedulingWorker,
} from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function workersFrom(options: OrchestrationDependencies): readonly SchedulingWorker[] {
  const value = typeof options.workers === "function" ? options.workers() : options.workers;
  return (value ?? []).map((worker) => freeze({ ...worker, tools: worker.tools ?? worker.toolIds ?? [], toolIds: worker.toolIds ?? worker.tools ?? [] }));
}

function logicalTimeOf(options: OrchestrationDependencies): number {
  const value = typeof options.logicalTime === "function" ? options.logicalTime() : options.logicalTime;
  return Number.isInteger(value) && value !== undefined && value >= 0 ? value : 0;
}

function managerWorkers(config: ManagerConfig): readonly string[] {
  return config.workerIds?.length ? config.workerIds : config.workerPool?.length ? config.workerPool : config.workerAgentIds ?? [];
}

function configVersion(config: ManagerConfig): number {
  return config.configurationVersion ?? config.version;
}

function managerIdOf(config: ManagerConfig): string {
  return config.managerId ?? config.id;
}

function managerRules(config: ManagerConfig) {
  return config.rules?.length ? config.rules : config.delegationRules ?? [];
}

function managerRoutingPolicies(config: ManagerConfig) {
  return config.routingPolicies?.length ? config.routingPolicies : config.contextRoutingPolicy ? [config.contextRoutingPolicy] : [];
}

function managerEscalation(config: ManagerConfig) {
  return config.escalation ?? config.escalationRules?.[0] ?? { severityThreshold: 2 as const, fallbackAttempts: 1, immediate: true };
}

function managerReporting(config: ManagerConfig) {
  return config.reporting ?? config.reportingRules?.[0] ?? { routineBatchSize: 5, exceptionImmediate: true, includeTraceLinks: true };
}

function asSchedulingJob(request: OrchestrationDelegationRequest, existing?: SchedulingJob): SchedulingJob {
  if (request.task) return request.task;
  if (existing) return existing;
  return {
    id: request.jobId,
    type: request.taskType ?? "ROUTINE",
    targetRefs: request.targetRefs,
    priority: 0,
    ...(request.taskType && ["SECURITY", "EVACUATE", "RESCUE"].includes(request.taskType.toUpperCase()) ? { requiredRole: "SECURITY" } : {}),
    requiredToolIds: [],
    expectedVersion: request.expectedJobVersion,
  };
}

function assignResultAccepted(result: unknown): boolean {
  if (!result || typeof result !== "object") return true;
  const candidate = result as { readonly ok?: unknown };
  return candidate.ok === undefined || candidate.ok === true;
}

function failureMessage(reason: DelegationFailure): string {
  switch (reason) {
    case "NO_MATCHING_RULE": return "No authored delegation rule matches this task.";
    case "NO_ELIGIBLE_WORKER": return "No worker satisfies role, queue, authority, and context requirements.";
    case "MISSING_TOOL": return "Every matching worker is missing a required Tool.";
    case "WORKER_CONTEXT_OVERFLOW": return "Every matching worker would exceed its Context Budget.";
    case "AUTHORITY_DENIED": return "Manager authority does not include this task type.";
    case "WORKER_MANAGER_CONFLICT": return "A candidate worker is already controlled by another Manager.";
    case "ALREADY_ASSIGNED": return "The job already has an active assignee.";
    case "MANAGER_NOT_ACTIVE": return "No deployed Manager configuration is active.";
    case "INVALID_REQUEST": return "The delegation request is malformed.";
  }
}

export const DEFAULT_MANAGER_CONFIG: ManagerConfig = Object.freeze({
  id: "manager.operations.default",
  managerId: "manager.operations.default",
  version: 2,
  configurationVersion: 2,
  status: "DEPLOYED",
  missionPromptRef: { artifactId: "park.operations.prompt.manager-mission", version: 1 },
  workerIds: ["agent.keeper01"],
  workerPool: ["agent.keeper01"],
  maxWorkers: 1,
  maxConcurrentWorkers: 1,
  maxTier: 1,
  contextBudget: 12000,
  artifactRefs: [{ artifactId: "manager.operations.default", version: 2 }, { artifactId: "park.operations.prompt.manager-mission", version: 1 }],
  rules: [
    { id: "rule.default.safety", priority: 100, taskTypes: ["SECURITY", "EVACUATE", "RESCUE", "CONTAINMENT"] },
    { id: "rule.default.routine", priority: 10 },
  ],
  priorityPolicy: { safetyIncidents: 400, containment: 300, animalHealth: 200, guestThroughput: 100, routine: 0, safetyFloor: 2 as const },
  authority: { canAssign: true, canDispatchSecurity: true, maxEscalationSeverity: 4 as const },
  routingPolicies: [{ id: "route.default", priority: 1, taskTypes: ["FEED", "SECURITY", "EVACUATE", "RESCUE", "ROUTINE"], toolIds: [] }],
  escalation: { severityThreshold: 2 as const, fallbackAttempts: 1, dispatchRoles: ["SECURITY"], immediate: true },
  reporting: { routineBatchSize: 5, exceptionImmediate: true, includeTraceLinks: true },
});

export interface OrchestrationRuntimeOptions extends OrchestrationDependencies {
  readonly configuration?: ManagerConfigurationService;
  readonly initialManager?: ManagerConfig;
  readonly jobLookup?: (jobId: string) => SchedulingJob | undefined;
  readonly jobList?: () => readonly SchedulingJob[];
}

class OrchestrationRuntime implements OrchestrationService {
  private readonly options: OrchestrationRuntimeOptions;
  private readonly scheduler = createOrchestrationScheduler();
  private readonly context;
  private readonly routing;
  private readonly configuration: ManagerConfigurationService;
  private readonly active = new Map<string, ManagerConfig>();
  private readonly eventsByManager = new Map<string, OrchestrationEvent[]>();
  private readonly assignmentsByManager = new Map<string, ManagerAssignmentView[]>();
  private readonly assignedJobs = new Map<string, string>();
  private readonly assignedWorkers = new Map<string, string>();
  private readonly pendingReports = new Map<string, ReportEvent[]>();
  private readonly sentReports = new Map<string, string[]>();
  private readonly escalationCounts = new Map<string, { open: number; immediateReports: number; securityDispatches: number }>();
  private readonly sequenceByManager = new Map<string, number>();
  private readonly requestLog: OrchestrationRequest[] = [];
  private readonly requestLogicalTimes: number[] = [];
  private readonly queuedJobsByRequest: SchedulingJob[][] = [];
  private readonly jobSnapshots = new Map<string, SchedulingJob>();
  private readonly assignmentOutcomeLog: { jobId: string; workerId: string; commandId: string; accepted: boolean }[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly initialWorkers: readonly SchedulingWorker[];
  private readonly activationLogicalTime: number;

  constructor(options: OrchestrationRuntimeOptions = {}) {
    this.options = options;
    this.initialWorkers = workersFrom(options);
    this.activationLogicalTime = logicalTimeOf(options);
    this.context = options.context ?? createContextService();
    this.routing = createRoutingService({ context: this.context, content: options.content });
    this.configuration = options.configuration ?? createManagerConfigurationService({ content: options.content, initial: [...(options.configs ?? []), ...(options.initialManager ? [options.initialManager] : [])] });
    for (const config of options.configs ?? []) {
      if (config.status === "DEPLOYED") this.activate(config);
    }
    if (options.initialManager) this.activate(options.initialManager);
  }

  private workers(): readonly SchedulingWorker[] {
    return workersFrom(this.options);
  }

  private workersWithAssignmentPressure(managerId: string, source: readonly SchedulingWorker[] = this.workers()): readonly SchedulingWorker[] {
    const activeAssignments = (this.assignmentsByManager.get(managerId) ?? []).filter((assignment) => assignment.status === "ASSIGNED");
    return source.map((worker) => {
      const assigned = activeAssignments.filter((assignment) => assignment.workerId === worker.id).length;
      return freeze({ ...worker, queueLength: Math.max(worker.queueLength ?? 0, assigned) });
    });
  }

  private parkSummary(): ManagerParkSummary {
    return this.options.parkSummary?.() ?? { park: {}, incidents: [], schedules: (this.options.jobList?.() ?? []).map((job) => ({ ...job })), workers: this.workers().map((worker) => ({ id: worker.id, role: worker.role ?? "UNKNOWN", status: worker.status ?? "IDLE", queueLength: worker.queueLength ?? 0, contextBudget: worker.contextBudget })) };
  }

  private availableJobs(): readonly SchedulingJob[] {
    if (this.options.jobList) return freeze(this.options.jobList());
    return freeze(this.parkSummary().schedules.filter((item): item is Readonly<Record<string, unknown>> & { readonly id: string; readonly type: string; readonly targetRefs: readonly string[]; readonly priority: number } => typeof item.id === "string" && typeof item.type === "string" && Array.isArray(item.targetRefs) && typeof item.priority === "number").map((item) => ({ id: item.id, type: item.type, targetRefs: item.targetRefs, priority: item.priority, ...(typeof item.dueTime === "number" ? { dueTime: item.dueTime } : {}), ...(typeof item.observedVersion === "number" ? { expectedVersion: item.observedVersion } : {}) })));
  }

  private activeManager(id?: string): ManagerConfig | undefined {
    if (id) return this.active.get(id) ?? [...this.active.values()].find((config) => managerIdOf(config) === id);
    return [...this.active.values()].sort((a, b) => managerIdOf(a).localeCompare(managerIdOf(b)))[0];
  }

  private nextEvent(managerId: string, type: OrchestrationEvent["type"], payload: Readonly<Record<string, unknown>>, fields: Partial<Pick<OrchestrationEvent, "jobId" | "workerId" | "childTraceId">> = {}): OrchestrationEvent {
    const sequence = (this.sequenceByManager.get(managerId) ?? 0) + 1;
    this.sequenceByManager.set(managerId, sequence);
    const event = freeze({ id: `orchestration.${managerId}.${sequence}`, sequence, managerId, type, logicalTime: logicalTimeOf(this.options), ...fields, payload });
    const list = this.eventsByManager.get(managerId) ?? [];
    list.push(event);
    this.eventsByManager.set(managerId, list);
    for (const listener of this.listeners) listener();
    return event;
  }

  private emitTrace(event: OrchestrationEvent): void {
    const traceId = event.childTraceId;
    if (!traceId || !this.options.traces) return;
    this.options.traces.append(traceId, {
      id: event.id,
      sequence: event.sequence,
      executionId: `orchestration.${event.managerId}`,
      jobId: event.jobId ?? `manager.${event.managerId}`,
      type: event.type === "DECISION" ? "DELEGATION_REQUEST" : event.type === "REPORT" ? "REPORT" : "STATUS",
      logicalTime: event.logicalTime,
      payload: event.payload,
    });
  }

  private addAssignment(managerId: string, assignment: ManagerAssignmentView): void {
    const list = this.assignmentsByManager.get(managerId) ?? [];
    const index = list.findIndex((item) => item.jobId === assignment.jobId);
    if (index >= 0) list[index] = assignment;
    else list.push(assignment);
    list.sort((a, b) => a.jobId.localeCompare(b.jobId));
    this.assignmentsByManager.set(managerId, list);
  }

  private assignThroughPort(jobId: string, workerId: string, commandId: string, expectedVersion?: number): boolean {
    const accepted = assignResultAccepted(this.options.jobs?.assign(jobId, workerId, commandId, expectedVersion));
    this.assignmentOutcomeLog.push(freeze({ jobId, workerId, commandId, accepted }));
    return accepted;
  }

  decide(input: import("./types.ts").SchedulingInput) {
    const manager = input.manager ?? this.activeManager();
    if (!manager) return { status: "UNASSIGNED" as const, reason: "MANAGER_NOT_ACTIVE" as const, eligibility: [], priorityClass: classifyPriority(input.job, input.priorityPolicy) };
    const activeAssignments = { ...(input.activeAssignments ?? {}) };
    for (const [jobId, workerId] of this.assignedJobs.entries()) activeAssignments[jobId] = workerId;
    const managerId = managerIdOf(manager);
    let workers = this.workersWithAssignmentPressure(managerId, input.workers.length ? input.workers : this.workers());
    const activeWorkers = new Set((this.assignmentsByManager.get(managerId) ?? []).filter((assignment) => assignment.status === "ASSIGNED").map((assignment) => assignment.workerId));
    const maxConcurrent = manager.maxConcurrentWorkers ?? manager.maxWorkers;
    if (activeWorkers.size >= maxConcurrent) workers = workers.filter((worker) => activeWorkers.has(worker.id));
    return this.scheduler.decide({ ...input, manager, workers, activeAssignments, rules: input.rules ?? managerRules(manager), priorityPolicy: input.priorityPolicy ?? manager.priorityPolicy });
  }

  private handleDelegation(request: OrchestrationDelegationRequest): readonly OrchestrationCommand[] {
    const manager = this.activeManager(request.managerId);
    if (!manager) {
      const managerId = request.managerId ?? "manager.unconfigured";
      const event = this.nextEvent(managerId, "ASSIGNMENT_REJECTED", { reason: "MANAGER_NOT_ACTIVE", request });
      this.emitTrace(event);
      return [freeze({ type: "REJECT", commandId: `${event.id}.reject`, managerId, jobId: request.jobId, reason: "MANAGER_NOT_ACTIVE", diagnostics: [failureMessage("MANAGER_NOT_ACTIVE")] })];
    }
    const managerId = managerIdOf(manager);
    const job = asSchedulingJob(request, this.options.jobLookup?.(request.jobId));
    this.jobSnapshots.set(job.id, freeze(job));
    const childTraceId = request.childTraceId;
    let candidates = this.workersWithAssignmentPressure(managerId);
    let lastDecision: SchedulingDecision | undefined;
    let lastRouting: import("./types.ts").RoutingResult | undefined;
    while (candidates.length > 0) {
      const decision = this.decide({ job, workers: candidates, manager, activeManagerByWorker: this.options.activeManagerByWorker });
      lastDecision = decision;
      const decisionEvent = this.nextEvent(managerId, "DECISION", { decision, request }, { jobId: job.id, childTraceId });
      this.emitTrace(decisionEvent);
      for (const fact of decision.eligibility) {
        const factEvent = this.nextEvent(managerId, "ELIGIBILITY", fact as unknown as Readonly<Record<string, unknown>>, { jobId: job.id, workerId: fact.workerId, childTraceId });
        this.emitTrace(factEvent);
      }
      if (decision.status === "UNASSIGNED") break;
      const worker = candidates.find((candidate) => candidate.id === decision.workerId);
      if (!worker) break;
      const routing = this.routing.route({ managerId, managerConfig: { ...manager, routingPolicies: managerRoutingPolicies(manager) }, worker, job, logicalTime: logicalTimeOf(this.options), baseContext: request.contextRequest });
      lastRouting = routing;
      const routingEvent = this.nextEvent(managerId, routing.status === "ROUTED" ? "CONTEXT_ROUTED" : "CONTEXT_BLOCKED", routing as unknown as Readonly<Record<string, unknown>>, { jobId: job.id, workerId: worker.id, childTraceId });
      this.emitTrace(routingEvent);
      if (routing.status === "BLOCKED") {
        this.addAssignment(managerId, { jobId: job.id, workerId: worker.id, status: "REJECTED", matchedRuleId: decision.matchedRuleId, priorityClass: decision.priorityClass, decision, routing });
        candidates = candidates.filter((candidate) => candidate.id !== worker.id);
        continue;
      }
      const commandId = `orchestration.assign.${managerId}.${job.id}`;
      const before = this.nextEvent(managerId, "ASSIGNMENT_REQUESTED", { matchedRuleId: decision.matchedRuleId, tieBreak: decision.tieBreak }, { jobId: job.id, workerId: worker.id, childTraceId });
      this.emitTrace(before);
      const accepted = this.assignThroughPort(job.id, worker.id, commandId, request.expectedJobVersion);
      const assignment: ManagerAssignmentView = { jobId: job.id, workerId: worker.id, status: accepted ? "ASSIGNED" : "REJECTED", matchedRuleId: decision.matchedRuleId, priorityClass: decision.priorityClass, decision, routing, ...(childTraceId ? { childTraceId } : {}) };
      this.addAssignment(managerId, assignment);
      if (accepted) {
        this.assignedJobs.set(job.id, worker.id);
        this.assignedWorkers.set(worker.id, managerId);
        const event = this.nextEvent(managerId, "ASSIGNED", { matchedRuleId: decision.matchedRuleId, tieBreak: decision.tieBreak, routing: routing.snapshot?.id, accepted: true }, { jobId: job.id, workerId: worker.id, childTraceId });
        this.emitTrace(event);
      } else {
        const event = this.nextEvent(managerId, "ASSIGNMENT_REJECTED", { reason: "JOB_PORT_REJECTED", accepted: false }, { jobId: job.id, workerId: worker.id, childTraceId });
        this.emitTrace(event);
      }
      return [freeze({ type: "ASSIGN_JOB", commandId, managerId, jobId: job.id, workerId: worker.id, matchedRuleId: decision.matchedRuleId, priorityClass: decision.priorityClass, ...(request.expectedJobVersion !== undefined ? { expectedJobVersion: request.expectedJobVersion } : {}), routing, accepted, ...(accepted ? {} : { error: "Job application port rejected assignment." }) })];
    }
    const reason: DelegationFailure = lastRouting?.status === "BLOCKED" ? "WORKER_CONTEXT_OVERFLOW" : lastDecision?.status === "UNASSIGNED" ? lastDecision.reason : "NO_ELIGIBLE_WORKER";
    const diagnostics = lastRouting?.diagnostics.length ? lastRouting.diagnostics : [failureMessage(reason)];
    const event = this.nextEvent(managerId, "ASSIGNMENT_REJECTED", { reason, diagnostics, blockedInputs: lastRouting?.blockedInputs ?? [] }, { jobId: job.id, childTraceId });
    this.emitTrace(event);
    if (!(this.assignmentsByManager.get(managerId) ?? []).some((assignment) => assignment.jobId === job.id)) this.addAssignment(managerId, { jobId: job.id, workerId: "", status: "REJECTED", priorityClass: classifyPriority(job, manager.priorityPolicy), ...(lastDecision ? { decision: lastDecision } : {}), ...(lastRouting ? { routing: lastRouting } : {}) });
    return [freeze({ type: "REJECT", commandId: `${event.id}.reject`, managerId, jobId: job.id, reason, diagnostics })];
  }

  private handleEscalation(request: EscalationRequest): readonly OrchestrationCommand[] {
    const manager = this.activeManager(request.managerId);
    const managerId = manager ? managerIdOf(manager) : request.managerId ?? "manager.unconfigured";
    if (!manager) return [freeze({ type: "REJECT", commandId: `orchestration.reject.${request.jobId}`, managerId, jobId: request.jobId, reason: "MANAGER_NOT_ACTIVE", diagnostics: [failureMessage("MANAGER_NOT_ACTIVE")] })];
    const policy = managerEscalation(manager);
    const thresholdMet = request.severity >= policy.severityThreshold;
    const fallbackMet = (request.fallbackAttempts ?? 0) >= policy.fallbackAttempts;
    const immediate = Boolean(policy.immediate ?? true) && (thresholdMet || fallbackMet);
    const counts = this.escalationCounts.get(managerId) ?? { open: 0, immediateReports: 0, securityDispatches: 0 };
    counts.open += 1;
    if (immediate) counts.immediateReports += 1;
    this.escalationCounts.set(managerId, counts);
    const escalationEvent = this.nextEvent(managerId, "ESCALATION", { severity: request.severity, reason: request.reason, failureCode: request.failureCode, thresholdMet, fallbackMet }, { jobId: request.jobId, childTraceId: request.childTraceId });
    this.emitTrace(escalationEvent);
    const commands: OrchestrationCommand[] = [freeze({ type: "ESCALATE", commandId: `${escalationEvent.id}.escalate`, managerId, jobId: request.jobId, severity: request.severity, reason: request.reason, immediate, ...(request.childTraceId ? { childTraceId: request.childTraceId } : {}) })];
    if (immediate) {
      const reportEvent = this.nextEvent(managerId, "REPORT", { exception: true, status: "ESCALATED", reason: request.reason, failureCode: request.failureCode }, { jobId: request.jobId, childTraceId: request.childTraceId });
      this.emitTrace(reportEvent);
      const sent = this.sentReports.get(managerId) ?? [];
      sent.push(request.jobId);
      this.sentReports.set(managerId, sent);
      commands.push(freeze({ type: "REPORT", commandId: `${reportEvent.id}.report`, managerId, jobIds: [request.jobId], immediate: true, status: "ESCALATED", childTraceIds: request.childTraceId ? [request.childTraceId] : [], facts: { reason: request.reason, failureCode: request.failureCode ?? "UNKNOWN" } }));
    }
    if (immediate && manager.authority.canDispatchSecurity !== false && request.severity <= (manager.authority.maxEscalationSeverity ?? 4)) {
      const existingSecurityJob = this.options.jobList?.().find((job) => !this.assignedJobs.has(job.id) && ["SECURITY", "EVACUATE", "RESCUE", "CONTAINMENT"].some((type) => job.type.toUpperCase().includes(type)));
      const dispatchRole = managerEscalation(manager).dispatchRoles?.[0] ?? "SECURITY";
      const securityJob: SchedulingJob = existingSecurityJob ? { ...existingSecurityJob, requiredRole: existingSecurityJob.requiredRole ?? dispatchRole, safetyCritical: true } : { id: `security.${request.jobId}`, type: request.taskType ?? "SECURITY", targetRefs: request.targetRefs ?? [], priority: Number.MAX_SAFE_INTEGER, priorityClass: "SAFETY_INCIDENT", safetyCritical: true, requiredRole: dispatchRole, requiredToolIds: ["alert_security"] };
      this.jobSnapshots.set(securityJob.id, freeze(securityJob));
      const decision = this.decide({ job: securityJob, workers: this.workers(), manager });
      const selected = decision.status === "ASSIGNED" ? decision.workerId : undefined;
      const dispatchCommandId = `${escalationEvent.id}.dispatch`;
      let accepted = Boolean(selected);
      if (selected && this.options.jobs) accepted = Boolean(existingSecurityJob) && this.assignThroughPort(securityJob.id, selected, dispatchCommandId, securityJob.expectedVersion);
      if (accepted && selected) {
        this.assignedJobs.set(securityJob.id, selected);
        this.assignedWorkers.set(selected, managerId);
        this.addAssignment(managerId, { jobId: securityJob.id, workerId: selected, status: "ASSIGNED", matchedRuleId: decision.status === "ASSIGNED" ? decision.matchedRuleId : undefined, priorityClass: "SAFETY_INCIDENT", decision, ...(request.childTraceId ? { childTraceId: request.childTraceId } : {}) });
        counts.securityDispatches += 1;
      }
      const dispatchEvent = this.nextEvent(managerId, "SECURITY_DISPATCH", { accepted, decision, reason: request.reason, childJobId: securityJob.id }, { jobId: request.jobId, workerId: selected, childTraceId: request.childTraceId });
      this.emitTrace(dispatchEvent);
      commands.push(freeze({ type: "DISPATCH_SECURITY", commandId: dispatchCommandId, managerId, parentJobId: request.jobId, ...(selected ? { workerId: selected } : {}), accepted, reason: accepted ? "Eligible security worker dispatched." : this.options.jobs && !existingSecurityJob ? "No queued security job exists in Park Operations." : failureMessage(decision.status === "UNASSIGNED" ? decision.reason : "NO_ELIGIBLE_WORKER"), decision, ...(request.childTraceId ? { childTraceId: request.childTraceId } : {}) }));
    } else if (immediate) {
      const denied: SchedulingDecision = { status: "UNASSIGNED", reason: "AUTHORITY_DENIED", eligibility: [], priorityClass: "SAFETY_INCIDENT" };
      commands.push(freeze({ type: "DISPATCH_SECURITY", commandId: `${escalationEvent.id}.dispatch.denied`, managerId, parentJobId: request.jobId, accepted: false, reason: "Manager authority denies this escalation dispatch.", decision: denied, ...(request.childTraceId ? { childTraceId: request.childTraceId } : {}) }));
    }
    return commands;
  }

  private handleReport(request: ReportEvent): readonly OrchestrationCommand[] {
    const manager = this.activeManager(request.managerId);
    const managerId = manager ? managerIdOf(manager) : request.managerId ?? "manager.unconfigured";
    if (!manager) return [freeze({ type: "REJECT", commandId: `orchestration.reject.report.${request.jobId}`, managerId, jobId: request.jobId, reason: "MANAGER_NOT_ACTIVE", diagnostics: [failureMessage("MANAGER_NOT_ACTIVE")] })];
    if (["SUCCEEDED", "FAILED", "ESCALATED", "BLOCKED", "CANCELLED"].includes(request.status)) {
      this.assignedJobs.delete(request.jobId);
      const existing = (this.assignmentsByManager.get(managerId) ?? []).find((assignment) => assignment.jobId === request.jobId);
      if (existing) this.addAssignment(managerId, { ...existing, status: "COMPLETED", ...(request.childTraceId ? { childTraceId: request.childTraceId } : {}) });
    }
    const list = this.pendingReports.get(managerId) ?? [];
    list.push(request);
    this.pendingReports.set(managerId, list);
    const escalation = managerEscalation(manager);
    const reporting = managerReporting(manager);
    const exception = Boolean(request.exception) || (request.severity ?? 0) >= escalation.severityThreshold || ["FAILED", "ESCALATED", "BLOCKED"].includes(request.status);
    const ready = exception && reporting.exceptionImmediate !== false || list.length >= reporting.routineBatchSize;
    if (!ready) return [];
    const batch = exception ? [request] : list.splice(0, reporting.routineBatchSize);
    if (exception) this.pendingReports.set(managerId, list.filter((item) => item !== request));
    const reportId = this.nextEvent(managerId, "REPORT", { exception, count: batch.length, statuses: batch.map((item) => item.status) }, { jobId: request.jobId, childTraceId: request.childTraceId });
    this.emitTrace(reportId);
    const sent = this.sentReports.get(managerId) ?? [];
    sent.push(...batch.map((item) => item.jobId));
    this.sentReports.set(managerId, sent);
    return [freeze({ type: "REPORT", commandId: `${reportId.id}.report`, managerId, jobIds: batch.map((item) => item.jobId).sort(), immediate: exception, status: exception ? request.status : "BATCHED", childTraceIds: batch.map((item) => item.childTraceId).filter((id): id is string => Boolean(id)).sort(), ...(request.facts ? { facts: request.facts } : {}) })];
  }

  handle(request: OrchestrationRequest): readonly OrchestrationCommand[] {
    if (!request || typeof request !== "object") return [];
    this.requestLog.push(freeze(request));
    this.requestLogicalTimes.push(logicalTimeOf(this.options));
    this.queuedJobsByRequest.push(freeze([...(this.options.jobList?.() ?? [])]));
    if ((request as ReportEvent).kind === "REPORT") return this.handleReport(request as ReportEvent);
    if ((request as EscalationRequest).kind === "ESCALATION") return this.handleEscalation(request as EscalationRequest);
    return this.handleDelegation(request as OrchestrationDelegationRequest);
  }

  activate(config: ManagerConfig): { readonly ok: true; readonly config: ManagerConfig } | { readonly ok: false; readonly errors: readonly ManagerValidationError[] } {
    const managerId = managerIdOf(config);
    const eligible = this.eligibility(config);
    if (!eligible.eligible) return { ok: false, errors: [{ code: "AUTHORITY_DENIED", path: "eligibility", message: eligible.reason }] };
    const deployedRef = this.options.deployment?.resolveActive(config.id);
    if (this.options.deployment && (!deployedRef || deployedRef.version !== configVersion(config))) {
      return { ok: false, errors: [{ code: "CONFIG_VERSION_CONFLICT", path: "version", message: deployedRef ? `Deployment resolves ${config.id}@${deployedRef.version}; refusing to activate ${config.id}@${configVersion(config)}.` : `Review/Deployment has no active exact ref for ${config.id}@${configVersion(config)}.` }] };
    }
    const currentOwners: Record<string, string> = { ...(this.options.activeManagerByWorker ?? {}) };
    for (const [id, existing] of this.active.entries()) if (id !== managerId) for (const workerId of managerWorkers(existing)) currentOwners[workerId] ??= managerIdOf(existing);
    const validation = this.configuration.validate(config, this.workers(), currentOwners);
    if (!validation.valid) return { ok: false, errors: validation.errors };
    if (config.status !== "DEPLOYED") {
      return { ok: false, errors: [{ code: "AUTHORITY_DENIED", path: "status", message: "Only a reviewed and deployed Manager configuration can be activated." }] };
    }
    const saved = this.configuration.save(config, this.workers(), currentOwners);
    if (!saved.ok) return saved;
    this.active.set(managerId, saved.value);
    this.nextEvent(managerId, "MANAGER_ACTIVATED", { exactRef: this.configuration.exactRef(saved.value), workerIds: managerWorkers(saved.value) });
    return { ok: true, config: saved.value };
  }

  getManager(id: string): ManagerOperationsView {
    const activeManager = this.activeManager(id);
    const manager = activeManager ?? this.configuration.get(id) ?? this.configuration.list().find((config) => managerIdOf(config) === id);
    const eligibility = this.eligibility(manager);
    const summary = this.parkSummary();
    if (!manager) return freeze({ id, status: "INACTIVE", configurationVersion: 0, workerIds: [], workerCount: 0, maxWorkers: 0, maxConcurrentWorkers: 0, assignments: [], queuePressure: {}, context: { budget: 0, projectedLoad: 0, routed: 0, blocked: 0, includedRefs: [], omittedRefs: [], summaryStatus: "BLOCKED", summarySections: ["park", "incidents", "schedules", "workers"] }, escalation: { open: 0, immediateReports: 0, securityDispatches: 0 }, reports: { pendingRoutine: 0, sent: 0, recent: [] }, recentEvents: [], sourceId: `manager:${id}`, eligibility, availableJobs: this.availableJobs(), incidents: summary.incidents });
    const managerId = managerIdOf(manager);
    const workers = this.workersWithAssignmentPressure(managerId).filter((worker) => managerWorkers(manager).includes(worker.id));
    const assignments = this.assignmentsByManager.get(managerId) ?? [];
    const events = this.eventsByManager.get(managerId) ?? [];
    const routed = assignments.filter((item) => item.routing?.status === "ROUTED");
    const blocked = assignments.filter((item) => item.routing?.status === "BLOCKED");
    const summaryRoute = this.routing.managerSummary(managerId, { ...manager, routingPolicies: managerRoutingPolicies(manager) }, workers, logicalTimeOf(this.options), summary);
    const budget = summaryRoute.budget;
    const projectedLoad = summaryRoute.projectedLoad;
    const includedRefs = [...new Set([...summaryRoute.includedRefs, ...routed.flatMap((item) => item.routing?.includedRefs ?? [])])].sort();
    const omittedRefs = [...new Set([...summaryRoute.omittedRefs, ...routed.flatMap((item) => item.routing?.omittedRefs ?? [])])].sort();
    const pending = this.pendingReports.get(managerId) ?? [];
    const sent = this.sentReports.get(managerId) ?? [];
    const escalation = this.escalationCounts.get(managerId) ?? { open: 0, immediateReports: 0, securityDispatches: 0 };
    const validation = this.configuration.validate(manager, this.workers(), this.options.activeManagerByWorker);
    return freeze({ id: managerId, status: activeManager ? "ACTIVE" : validation.valid ? "INACTIVE" : "INVALID", configurationVersion: configVersion(manager), missionPromptRef: manager.missionPromptRef, workerIds: managerWorkers(manager), workerCount: workers.length, maxWorkers: manager.maxWorkers, maxConcurrentWorkers: manager.maxConcurrentWorkers ?? manager.maxWorkers, assignments, queuePressure: Object.fromEntries(workers.map((worker) => [worker.id, worker.queueLength ?? 0])), context: { budget, projectedLoad, routed: routed.length, blocked: blocked.length + (summaryRoute.status === "BLOCKED" ? 1 : 0), includedRefs, omittedRefs, summaryStatus: summaryRoute.status, summarySections: ["park", "incidents", "schedules", "workers"] }, escalation, reports: { pendingRoutine: pending.length, sent: sent.length, recent: sent.slice(-10) }, recentEvents: events.slice(-20), sourceId: `manager:${managerId}@${configVersion(manager)}`, eligibility: activeManager ? { ...eligibility, eligible: true, code: "ACTIVE", reason: "Reviewed Manager configuration is active." } : eligibility, availableJobs: this.availableJobs(), incidents: summary.incidents });
  }

  managers(): readonly ManagerOperationsView[] {
    const ids = [...new Set([...this.active.keys(), ...this.configuration.list().map((config) => managerIdOf(config))])].sort();
    return freeze(ids.map((id) => this.getManager(id)));
  }

  events(managerId?: string): readonly OrchestrationEvent[] {
    if (managerId) return freeze([...(this.eventsByManager.get(managerId) ?? [])]);
    return freeze([...this.eventsByManager.values()].flat().sort((a, b) => a.logicalTime - b.logicalTime || a.managerId.localeCompare(b.managerId) || a.sequence - b.sequence));
  }

  assignments(managerId?: string): readonly ManagerAssignmentView[] {
    if (managerId) return freeze([...(this.assignmentsByManager.get(managerId) ?? [])]);
    return freeze([...this.assignmentsByManager.values()].flat().sort((a, b) => a.jobId.localeCompare(b.jobId)));
  }

  manifest(managerId?: string): OrchestrationReplayManifest {
    const manager = this.activeManager(managerId);
    if (!manager) throw new Error("Cannot create an orchestration replay manifest without an active Manager.");
    const jobs = [...new Map([...this.jobSnapshots.values(), ...this.queuedJobsByRequest.flat()].map((job) => [job.id, job])).values()].sort((a, b) => a.id.localeCompare(b.id));
    return freeze({ schemaVersion: 1, manager, workers: this.initialWorkers, jobs, queuedJobsByRequest: this.queuedJobsByRequest, jobPortAvailable: Boolean(this.options.jobs), jobListAvailable: Boolean(this.options.jobList), assignmentOutcomes: this.assignmentOutcomeLog.slice(), expectedAssignments: this.assignments(managerId), requestLogicalTimes: this.requestLogicalTimes.slice(), activationLogicalTime: this.activationLogicalTime, requests: this.requestLog.slice(), expectedEvents: this.events(managerId) });
  }

  eligibility(config?: ManagerConfig): ManagerEligibility {
    const external = this.options.eligibility?.() ?? { eligible: true, code: "AVAILABLE" as const, reason: "Manager eligibility is available." };
    if (!external.eligible) return freeze(external);
    if (config) {
      if (config.status !== "DEPLOYED") return freeze({ ...external, eligible: false, code: "REVIEW_REQUIRED", reason: "Manager configuration must complete Review and Deployment." });
      if (this.options.deployment) {
        const exact = this.options.deployment.resolveActive(config.id);
        if (!exact || exact.version !== configVersion(config)) return freeze({ ...external, eligible: false, code: "REVIEW_REQUIRED", reason: `Review/Deployment must activate exact Manager configuration ${config.id}@${configVersion(config)}.`, reviewed: false });
      }
    }
    return freeze({ ...external, reviewed: config ? true : external.reviewed });
  }

  validateConfiguration(config: ManagerConfig): ManagerValidationResult {
    return this.configuration.validate(config, this.workers(), this.options.activeManagerByWorker);
  }

  evaluateConfiguration(config: ManagerConfig): ManagerEvaluationResult {
    const validation = this.validateConfiguration(config);
    const requests: readonly OrchestrationRequest[] = [
      { kind: "DELEGATION", managerId: managerIdOf(config), executionId: "manager.eval.delegation", jobId: "manager.eval.feed", clauseId: "manager.eval.delegate", taskType: "FEED", targetRefs: ["dino.rex"], task: { id: "manager.eval.feed", type: "FEED", targetRefs: ["dino.rex"], priority: 1 } },
      { kind: "ESCALATION", managerId: managerIdOf(config), jobId: "manager.eval.gate-jam", severity: 2, reason: "Pinned Manager evaluation gate jam", failureCode: "GATE_JAM", fallbackAttempts: 1, taskType: "SECURITY" },
    ];
    const run = () => {
      const isolated = new OrchestrationRuntime({ workers: this.initialWorkers, initialManager: config, logicalTime: 0 });
      for (const request of requests) isolated.handle(request);
      return { events: isolated.events(managerIdOf(config)), assignments: isolated.assignments(managerIdOf(config)) };
    };
    const first = run();
    const second = run();
    const canonical = canonicalSerialize(first);
    const exact = canonical === canonicalSerialize(second);
    const security = first.events.find((event) => event.type === "SECURITY_DISPATCH");
    const securityDecision = security?.payload.decision as SchedulingDecision | undefined;
    const assertions = freeze([
      { id: "manager.config.valid", passed: validation.valid, message: validation.valid ? "Executable Manager configuration is structurally valid." : validation.errors.map((error) => error.message).join(" ") },
      { id: "manager.eval.exact", passed: exact, message: exact ? "Two isolated runs produced the same canonical events and assignments." : "Isolated Manager runs diverged." },
      { id: "manager.safety.precedence", passed: securityDecision?.priorityClass === "SAFETY_INCIDENT", message: `Gate-jam dispatch classified as ${securityDecision?.priorityClass ?? "unavailable"}.` },
      { id: "manager.escalation.report", passed: first.events.some((event) => event.type === "REPORT" && event.jobId === "manager.eval.gate-jam"), message: "Severity-2 gate jam emits an immediate Manager report." },
      { id: "manager.explainability", passed: first.events.some((event) => event.type === "DECISION") && first.events.some((event) => event.type === "ELIGIBILITY"), message: "Delegation records decision and worker eligibility evidence." },
    ]);
    return freeze({ passed: assertions.every((assertion) => assertion.passed), exact, configRef: this.configuration.exactRef(config), canonical, assertions });
  }

  configurations(): readonly ManagerConfig[] {
    return this.configuration.list();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  refresh(): void {
    for (const listener of this.listeners) listener();
  }
}

export function createOrchestrationService(options: OrchestrationRuntimeOptions = {}): OrchestrationService {
  return new OrchestrationRuntime(options);
}

export const createManagerRuntime = createOrchestrationService;
