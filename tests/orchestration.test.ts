import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MANAGER_CONFIG,
  createManagerConfigurationService,
  createOrchestrationContentPack,
  createOrchestrationScheduler,
  createOrchestrationService,
  createRoutingService,
  replayOrchestration,
  type ManagerConfig,
  type SchedulingJob,
  type SchedulingWorker,
} from "../orchestration/index.ts";
import { createContextService } from "../context/index.ts";
import { createContentRegistry } from "../content-registry/index.ts";
import { createEconomyProgressionService } from "../economy-progression/index.ts";
import { createOperationsContentPack, createParkOperationsService, DEFAULT_OPERATIONS_ARTIFACTS } from "../park-operations/index.ts";
import { createOrchestrationProvider } from "../src/orchestration/runtime.ts";
import { createProductionReviewProvider } from "../src/review-deployment/runtime.ts";
import { createTraceReplayProvider } from "../src/trace-replay/runtime.ts";
import { createMvpEvalContentPack } from "../eval-runner/index.ts";

const worker = (id: string, overrides: Partial<SchedulingWorker> = {}): SchedulingWorker => ({ id, role: "KEEPER", status: "IDLE", tools: ["dispense_food", "alert_security", "evacuate_visitors"], contextBudget: 8000, queueLength: 0, queueCapacity: 2, ...overrides });
const baseConfig = (workers: readonly string[]): ManagerConfig => ({ ...DEFAULT_MANAGER_CONFIG, id: `manager.${workers.join(".")}`, managerId: `manager.${workers.join(".")}`, workerIds: workers, workerPool: workers, maxWorkers: workers.length, maxConcurrentWorkers: workers.length, rules: [{ id: "rule.feed", priority: 10, taskTypes: ["FEED"] }, { id: "rule.security", priority: 100, taskTypes: ["SECURITY", "EVACUATE"] }], routingPolicies: [{ id: "route.all", priority: 1, taskTypes: ["FEED", "SECURITY", "EVACUATE"], toolIds: [] }] });

test("slice 1 assigns two workers independently with stable contention", () => {
  const scheduler = createOrchestrationScheduler();
  const workers = [worker("agent.a"), worker("agent.b")];
  const job: SchedulingJob = { id: "job.feed.1", type: "FEED", targetRefs: ["dino.rex"], priority: 1, requiredToolIds: ["dispense_food"] };
  const first = scheduler.decide({ job, workers, rules: [{ id: "feed", priority: 10, taskTypes: ["FEED"] }] });
  assert.equal(first.status, "ASSIGNED");
  if (first.status === "ASSIGNED") assert.equal(first.workerId, "agent.a");
  const second = scheduler.decide({ job: { ...job, id: "job.feed.2" }, workers: [worker("agent.a", { queueLength: 1 }), worker("agent.b")], rules: [{ id: "feed", priority: 10, taskTypes: ["FEED"] }] });
  assert.equal(second.status, "ASSIGNED");
  if (second.status === "ASSIGNED") assert.equal(second.workerId, "agent.b");
  const conflict = scheduler.decide({ job: { ...job, id: "job.feed.3", requiredToolIds: ["missing_tool"] }, workers, rules: [{ id: "feed", priority: 10, taskTypes: ["FEED"] }] });
  assert.equal(conflict.status, "UNASSIGNED");
  if (conflict.status === "UNASSIGNED") assert.equal(conflict.reason, "MISSING_TOOL");
});

test("slice 2 validates a reviewed exact Manager configuration", () => {
  const configuration = createManagerConfigurationService();
  const config = baseConfig(["agent.a", "agent.b"]);
  const valid = configuration.validate(config, [worker("agent.a"), worker("agent.b")]);
  assert.equal(valid.valid, true, valid.errors.map((error) => error.message).join(" "));
  const duplicate = configuration.validate({ ...config, workerIds: ["agent.a", "agent.a"], workerPool: ["agent.a", "agent.a"] }, [worker("agent.a")]);
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.errors.some((error) => error.code === "DUPLICATE_WORKER"));
  const unknown = configuration.validate({ ...config, workerIds: ["agent.missing"], workerPool: ["agent.missing"], maxWorkers: 1 }, [worker("agent.a")]);
  assert.equal(unknown.valid, false);
  assert.ok(unknown.errors.some((error) => error.code === "WORKER_NOT_FOUND"));
});

test("slice 3 delegates feeding and evacuation with exact tie explanations and bounded context", () => {
  const jobs: string[] = [];
  const config = baseConfig(["agent.a", "agent.security"]);
  const service = createOrchestrationService({ workers: [worker("agent.a"), worker("agent.security", { role: "SECURITY", tools: ["alert_security", "evacuate_visitors"] })], initialManager: config, jobs: { assign: (jobId) => { jobs.push(jobId); return { ok: true }; }, }, context: createContextService() });
  const feeding = service.handle({ kind: "DELEGATION", executionId: "trace.feed", jobId: "job.feed", clauseId: "delegate.feed", taskType: "FEED", targetRefs: ["dino.rex"], managerId: config.id });
  assert.equal(feeding[0]?.type, "ASSIGN_JOB");
  if (feeding[0]?.type === "ASSIGN_JOB") {
    assert.equal(feeding[0].accepted, true);
    assert.equal(feeding[0].workerId, "agent.a");
    assert.equal(feeding[0].routing.status, "ROUTED");
  }
  const evacuation = service.handle({ kind: "DELEGATION", executionId: "trace.evac", jobId: "job.evac", clauseId: "delegate.evac", taskType: "EVACUATE", targetRefs: ["zone.gamma.buffer"], managerId: config.id });
  assert.equal(evacuation[0]?.type, "ASSIGN_JOB");
  if (evacuation[0]?.type === "ASSIGN_JOB") assert.equal(evacuation[0].workerId, "agent.security");
  assert.deepEqual(jobs, ["job.feed", "job.evac"]);
  const assignments = service.assignments(config.id);
  assert.equal(new Set(assignments.map((assignment) => assignment.jobId)).size, assignments.length);
});

test("slice 4 escalates failed gate immediately and batches routine reports", () => {
  const config = baseConfig(["agent.a", "agent.security"]);
  const service = createOrchestrationService({ workers: [worker("agent.a"), worker("agent.security", { role: "SECURITY" })], initialManager: config });
  const escalation = service.handle({ kind: "ESCALATION", managerId: config.id, jobId: "job.gate", severity: 3, reason: "Gate tool failed", failureCode: "GATE_JAM", fallbackAttempts: 1, targetRefs: ["gate.gamma"], taskType: "SECURITY" });
  assert.equal(escalation[0]?.type, "ESCALATE");
  assert.equal(escalation.some((command) => command.type === "DISPATCH_SECURITY"), true);
  for (let index = 1; index <= 4; index += 1) assert.deepEqual(service.handle({ kind: "REPORT", managerId: config.id, jobId: `job.routine.${index}`, status: "SUCCEEDED" }), []);
  const report = service.handle({ kind: "REPORT", managerId: config.id, jobId: "job.routine.5", status: "SUCCEEDED" });
  assert.equal(report[0]?.type, "REPORT");
  if (report[0]?.type === "REPORT") assert.equal(report[0].immediate, false);
});

test("slice 5 preserves safety precedence, at-most-one assignment, and exact replay", () => {
  const config = baseConfig(["agent.a", "agent.security"]);
  const service = createOrchestrationService({ workers: [worker("agent.a"), worker("agent.security", { role: "SECURITY" })], initialManager: config });
  service.handle({ kind: "DELEGATION", executionId: "trace.feed", jobId: "job.feed", clauseId: "delegate.feed", taskType: "FEED", targetRefs: ["dino.rex"], managerId: config.id });
  const manifest = { ...service.manifest(config.id), requests: [{ kind: "DELEGATION" as const, executionId: "trace.feed", jobId: "job.feed", clauseId: "delegate.feed", taskType: "FEED", targetRefs: ["dino.rex"], managerId: config.id }] };
  const replay = replayOrchestration(manifest);
  assert.equal(replay.status, "EXACT");
  const safety = createOrchestrationService({ workers: [worker("agent.a"), worker("agent.security", { role: "SECURITY" })], initialManager: config });
  const low = safety.decide({ job: { id: "job.guest", type: "GUEST_THROUGHPUT", targetRefs: [], priority: 100 }, workers: [worker("agent.a"), worker("agent.security", { role: "SECURITY" })], manager: config });
  const high = safety.decide({ job: { id: "job.incident", type: "INCIDENT", targetRefs: [], priority: 0, safetyCritical: true }, workers: [worker("agent.a"), worker("agent.security", { role: "SECURITY" })], manager: config });
  assert.equal(low.status, "UNASSIGNED");
  assert.equal(high.status, "UNASSIGNED");
  if (low.status === "UNASSIGNED") assert.equal(low.reason, "NO_MATCHING_RULE");
  if (high.status === "UNASSIGNED") assert.equal(high.reason, "NO_MATCHING_RULE");
});

test("adversarial routing reports missing required refs from an empty load and caps policy budget", () => {
  const config = { ...baseConfig(["agent.a"]), routingPolicies: [{ id: "route.required", priority: 1, taskTypes: ["FEED"], includeRefs: ["context.required"], maxContextLoad: 50_000 }] };
  const routing = createRoutingService({ context: createContextService() });
  const result = routing.route({ managerId: config.id, managerConfig: config, worker: worker("agent.a", { contextBudget: 100 }), job: { id: "job.required", type: "FEED", targetRefs: [], priority: 1, requiredContextRefs: ["job.required.ref"] } });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.budget, 100);
  assert.deepEqual(result.blockedInputs, ["context.required", "job.required.ref"]);
});

test("adversarial delegation retries the next eligible worker after actual routed context overflow", () => {
  const content = createContentRegistry();
  const loaded = content.loadPack(createOrchestrationContentPack());
  assert.equal(loaded.ok, true);
  const config: ManagerConfig = { ...baseConfig(["agent.a", "agent.b"]), missionPromptRef: { artifactId: "park.operations.prompt.manager-mission", version: 1 }, artifactRefs: [{ artifactId: "manager.operations.default", version: 2 }], routingPolicies: [{ id: "route.mission", priority: 1, taskTypes: ["FEED"], artifactRefs: [{ artifactId: "park.operations.prompt.manager-mission", version: 1 }], required: true }] };
  const service = createOrchestrationService({ content, workers: [worker("agent.a", { contextBudget: 10 }), worker("agent.b", { contextBudget: 8000 })], initialManager: config });
  const commands = service.handle({ kind: "DELEGATION", executionId: "execution.retry", jobId: "job.retry", clauseId: "retry", taskType: "FEED", targetRefs: ["dino.rex"], managerId: config.id });
  assert.equal(commands[0]?.type, "ASSIGN_JOB");
  if (commands[0]?.type === "ASSIGN_JOB") assert.equal(commands[0].workerId, "agent.b");
  assert.ok(service.events(config.id).some((event) => event.type === "CONTEXT_BLOCKED" && event.workerId === "agent.a"));
});

test("adversarial queue and maxConcurrentWorkers limits include runtime assignments", () => {
  const config: ManagerConfig = { ...baseConfig(["agent.a", "agent.b"]), maxConcurrentWorkers: 1 };
  const service = createOrchestrationService({ workers: [worker("agent.a", { queueCapacity: 1 }), worker("agent.b", { queueCapacity: 1 })], initialManager: config });
  const first = service.handle({ kind: "DELEGATION", executionId: "execution.one", jobId: "job.one", clauseId: "one", taskType: "FEED", targetRefs: [], managerId: config.id });
  assert.equal(first[0]?.type, "ASSIGN_JOB");
  const second = service.handle({ kind: "DELEGATION", executionId: "execution.two", jobId: "job.two", clauseId: "two", taskType: "FEED", targetRefs: [], managerId: config.id });
  assert.equal(second[0]?.type, "REJECT");
  assert.equal(service.assignments(config.id).filter((assignment) => assignment.status === "ASSIGNED").length, 1);
});

test("Manager assignment authority is a hard delegation boundary", () => {
  const config: ManagerConfig = { ...baseConfig(["agent.a"]), authority: { ...baseConfig(["agent.a"]).authority, canAssign: false } };
  const service = createOrchestrationService({ workers: [worker("agent.a")], initialManager: config });
  const result = service.handle({ kind: "DELEGATION", managerId: config.id, executionId: "authority.denied", jobId: "job.denied", clauseId: "denied", taskType: "FEED", targetRefs: [] });
  assert.equal(result[0]?.type, "REJECT");
  if (result[0]?.type === "REJECT") assert.equal(result[0].reason, "AUTHORITY_DENIED");
  const assignment = service.getManager(config.id).assignments[0];
  assert.equal(assignment?.decision?.status, "UNASSIGNED");
});

test("hard safety classification and ordering cannot be lowered by authored labels or weights", () => {
  const scheduler = createOrchestrationScheduler();
  const safety: SchedulingJob = { id: "job.safety", type: "INCIDENT", targetRefs: [], priority: 0, safetyCritical: true, priorityClass: "GUEST_THROUGHPUT" };
  const throughput: SchedulingJob = { id: "job.throughput", type: "GUEST_THROUGHPUT", targetRefs: [], priority: Number.MAX_SAFE_INTEGER };
  const ordered = scheduler.order([throughput, safety], { safetyIncidents: -1000, containment: -1000, animalHealth: -1000, guestThroughput: 1000000, routine: 1000000 });
  assert.equal(ordered[0]?.id, safety.id);
  const decision = scheduler.decide({ job: safety, workers: [worker("agent.a")], rules: [{ id: "incident", priority: 1, taskTypes: ["INCIDENT"] }] });
  assert.equal(decision.priorityClass, "SAFETY_INCIDENT");
  const immutableThreshold = scheduler.decide({ job: { id: "job.severity-two", type: "ROUTINE", targetRefs: [], priority: 0, severity: 2 }, workers: [worker("agent.a")], rules: [{ id: "routine", priority: 1 }], priorityPolicy: { safetyFloor: 4 } });
  assert.equal(immutableThreshold.priorityClass, "SAFETY_INCIDENT");
  const belowThreshold = scheduler.decide({ job: { id: "job.severity-one", type: "ROUTINE", targetRefs: [], priority: 0, severity: 1 }, workers: [worker("agent.a")], rules: [{ id: "routine", priority: 1 }], priorityPolicy: { safetyFloor: 0 } });
  assert.equal(belowThreshold.priorityClass, "ROUTINE");
});

test("scheduler distinguishes explicitly empty loaded Context from unknown Context", () => {
  const decision = createOrchestrationScheduler().decide({ job: { id: "job.context", type: "FEED", targetRefs: [], priority: 1, requiredContextRefs: ["required.ref"] }, workers: [worker("agent.a", { loadedContextRefs: [] })], rules: [{ id: "feed", priority: 1, taskTypes: ["FEED"] }] });
  assert.equal(decision.status, "UNASSIGNED");
  assert.ok(decision.eligibility[0]?.reasons.includes("MISSING_CONTEXT:required.ref"));
});

test("job required Context refs remain mandatory when a routing policy is optional", () => {
  const routing = createRoutingService({ context: createContextService() });
  const config: ManagerConfig = { ...baseConfig(["agent.a"]), routingPolicies: [{ id: "optional.policy", priority: 1, taskTypes: ["FEED"], required: false }] };
  const result = routing.route({ managerId: config.id, managerConfig: config, worker: worker("agent.a"), job: { id: "job.mandatory", type: "FEED", targetRefs: [], priority: 1, requiredContextRefs: ["job.context.required"] } });
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockedInputs, ["job.context.required"]);
});

test("gate jam escalation emits an immediate linked report and linked security provenance", () => {
  const config: ManagerConfig = { ...baseConfig(["agent.security"]), workerIds: ["agent.security"], workerPool: ["agent.security"], rules: [{ id: "security", priority: 100, taskTypes: ["SECURITY"] }] };
  const service = createOrchestrationService({ workers: [worker("agent.security", { role: "SECURITY" })], initialManager: config });
  const commands = service.handle({ kind: "ESCALATION", managerId: config.id, jobId: "job.jam", severity: 3, reason: "Gate jam", failureCode: "GATE_JAM", fallbackAttempts: 1, taskType: "SECURITY", childTraceId: "trace.child.jam" });
  const report = commands.find((command) => command.type === "REPORT");
  const dispatch = commands.find((command) => command.type === "DISPATCH_SECURITY");
  assert.equal(report?.type, "REPORT");
  if (report?.type === "REPORT") assert.deepEqual(report.childTraceIds, ["trace.child.jam"]);
  assert.equal(dispatch?.type, "DISPATCH_SECURITY");
  if (dispatch?.type === "DISPATCH_SECURITY") assert.equal(dispatch.childTraceId, "trace.child.jam");
  assert.ok(service.events(config.id).some((event) => event.type === "REPORT" && event.childTraceId === "trace.child.jam"));
  assert.ok(service.events(config.id).some((event) => event.type === "SECURITY_DISPATCH" && event.childTraceId === "trace.child.jam"));
});

test("replay pins real queued security jobs, assignment outcomes, and final assignment state", () => {
  const config: ManagerConfig = { ...baseConfig(["agent.security"]), workerIds: ["agent.security"], workerPool: ["agent.security"], rules: [{ id: "security", priority: 100, taskTypes: ["SECURITY"] }] };
  const securityJob: SchedulingJob = { id: "job.security.queued", type: "SECURITY", targetRefs: ["gate.gamma"], priority: 100, expectedVersion: 3, requiredRole: "SECURITY", requiredToolIds: ["alert_security"] };
  const service = createOrchestrationService({ workers: [worker("agent.security", { role: "SECURITY" })], initialManager: config, jobList: () => [securityJob], jobLookup: (jobId) => jobId === securityJob.id ? securityJob : undefined, jobs: { assign: () => ({ ok: true }) } });
  service.handle({ kind: "ESCALATION", managerId: config.id, jobId: "job.gate.jam", severity: 3, reason: "Gate jam", failureCode: "GATE_JAM", fallbackAttempts: 1, taskType: "SECURITY", childTraceId: "trace.gate.jam" });
  const manifest = service.manifest(config.id);
  assert.deepEqual(manifest.jobs?.map((job) => job.id), [securityJob.id]);
  assert.equal(manifest.assignmentOutcomes?.[0]?.accepted, true);
  assert.equal(manifest.expectedAssignments?.[0]?.jobId, securityJob.id);
  const replay = replayOrchestration(manifest);
  assert.equal(replay.status, "EXACT");
});

test("replay preserves synthetic security dispatch when no Park job port exists", () => {
  const config: ManagerConfig = { ...baseConfig(["agent.security"]), workerIds: ["agent.security"], workerPool: ["agent.security"], rules: [{ id: "security", priority: 100, taskTypes: ["SECURITY"] }] };
  const service = createOrchestrationService({ workers: [worker("agent.security", { role: "SECURITY" })], initialManager: config });
  service.handle({ kind: "ESCALATION", managerId: config.id, jobId: "job.synthetic.jam", severity: 3, reason: "Synthetic gate jam", failureCode: "GATE_JAM", fallbackAttempts: 1, taskType: "SECURITY" });
  const manifest = service.manifest(config.id);
  assert.equal(manifest.jobPortAvailable, false);
  assert.equal(replayOrchestration(manifest).status, "EXACT");
});

test("replay starts from initial worker pressure rather than a post-assignment live snapshot", () => {
  const config = baseConfig(["agent.a"]);
  let queueLength = 1;
  const service = createOrchestrationService({ workers: () => [worker("agent.a", { queueLength, queueCapacity: 2 })], initialManager: config, jobs: { assign: () => { queueLength = 2; return { ok: true }; } } });
  service.handle({ kind: "DELEGATION", managerId: config.id, executionId: "queue.mutation", jobId: "job.queue.mutation", clauseId: "queue", taskType: "FEED", targetRefs: [] });
  const manifest = service.manifest(config.id);
  assert.equal(manifest.workers[0]?.queueLength, 1);
  assert.equal(replayOrchestration(manifest).status, "EXACT");
});

test("Manager summary routes park, incidents, schedules, and workers inside its own budget", () => {
  const config: ManagerConfig = { ...baseConfig(["agent.a"]), contextBudget: 2000 };
  const service = createOrchestrationService({ workers: [worker("agent.a")], initialManager: config, parkSummary: () => ({ park: { logicalTime: 12 }, incidents: [{ id: "incident.1", severity: 2 }], schedules: [{ id: "job.1", type: "FEED", targetRefs: [], priority: 1 }], workers: [{ id: "agent.a", status: "IDLE" }] }) });
  const view = service.getManager(config.id);
  assert.equal(view.context.summaryStatus, "ROUTED");
  assert.deepEqual(view.context.summarySections, ["park", "incidents", "schedules", "workers"]);
  assert.ok(view.context.includedRefs.includes(`manager-summary:${config.id}`));
  assert.ok(view.context.projectedLoad <= view.context.budget);
});

test("configuration validates Manager, routing include, artifact, and Knowledge exact refs", () => {
  const content = createContentRegistry();
  assert.equal(content.loadPack(createOrchestrationContentPack()).ok, true);
  const configuration = createManagerConfigurationService({ content });
  const config: ManagerConfig = { ...baseConfig(["agent.a"]), missionPromptRef: { artifactId: "park.operations.prompt.manager-mission", version: 1 }, artifactRefs: [{ artifactId: "missing.manager", version: 1 }], routingPolicies: [{ id: "missing.refs", priority: 1, includeRefs: ["missing.include@1"], knowledgeRefs: [{ artifactId: "missing.knowledge", version: 1 }] }] };
  const result = configuration.validate(config, [worker("agent.a")]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.path.startsWith("artifactRefs")));
  assert.ok(result.errors.some((error) => error.path.includes("includeRefs")));
  assert.ok(result.errors.some((error) => error.path.includes("knowledgeRefs")));
});

test("production user can evaluate and deploy the exact Manager config before activation", () => {
  const content = createContentRegistry();
  const context = createContextService();
  assert.equal(content.loadPack(createOperationsContentPack()).ok, true);
  assert.equal(content.loadPack(createMvpEvalContentPack()).ok, true);
  const traces = createTraceReplayProvider({ content, context });
  const park = createParkOperationsService({ content, context, traces: traces.repository });
  const economy = createEconomyProgressionService({ openingBalance: 10_000 });
  const review = createProductionReviewProvider({ registry: content, context });
  const service = createOrchestrationProvider({ park, economy, review, traces });
  const managerId = DEFAULT_MANAGER_CONFIG.managerId ?? DEFAULT_MANAGER_CONFIG.id;
  assert.equal(service.getManager(managerId).status, "INACTIVE");
  assert.equal(service.activate(service.configurations()[0]!).ok, false);
  for (const [index, signal] of ["containment.pressure", "repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure", "review.pressure", "memory.pressure"].entries()) economy.process({ id: `orchestration-phase-${index}`, type: "METRIC", logicalTime: index, signal });
  economy.process({ id: "orchestration-workers", type: "METRIC", logicalTime: 20, workerCount: 4 });
  const purchase = economy.purchase({ transactionId: "orchestration-manager-purchase", itemId: "manager.agent", type: "MANAGER", amount: 3500, expectedBalanceVersion: economy.balance().version, expectedStateVersion: economy.snapshot().stateVersion });
  assert.equal(purchase.ok, true);
  assert.equal(service.activate(service.configurations()[0]!).ok, false);
  const proposal = review.reviews.submit({ id: "review.manager.operations.default.v2", baseRef: { artifactId: DEFAULT_MANAGER_CONFIG.id, version: 1 }, proposedRef: { artifactId: DEFAULT_MANAGER_CONFIG.id, version: 2 }, author: "Park Developer", goal: "Evaluate and deploy Manager orchestration.", createdAtGameTime: 21 });
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  const evaluation = service.evaluateConfiguration(service.configurations()[0]!);
  assert.equal(evaluation.exact, true);
  assert.equal(evaluation.passed, true, evaluation.assertions.map((item) => item.message).join(" "));
  const running = review.reviews.transition(proposal.value.reviewId, "EVALS_RUNNING", proposal.value.version, "Manager evaluator", 21);
  assert.equal(running.ok, true);
  if (!running.ok) return;
  const ready = review.reviews.transition(proposal.value.reviewId, "READY", running.value.version, "Manager evaluator", 21);
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  const assessment = review.deployments.validate(proposal.value.reviewId);
  assert.equal(assessment.valid, true);
  const deployed = review.deployments.deploy({ reviewId: proposal.value.reviewId, expectedReviewVersion: ready.value.version, acknowledgeWarningCodes: assessment.warnings.map((warning) => warning.code), transactionId: "deploy.manager.review.v2" });
  assert.equal(deployed.ok, true);
  const activated = service.activate(service.configurations()[0]!);
  assert.equal(activated.ok, true);
  const created = park.create({ templateId: "job-template.feed", type: "FEED", targetRefs: ["dino.rex"], priority: 5, dueTime: 120, promptRef: DEFAULT_OPERATIONS_ARTIFACTS.promptRef, skillRefs: [], systemPromptRefs: [] }, "production.manager.job");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const delegated = service.handle({ kind: "DELEGATION", managerId, executionId: "production.delegate", jobId: created.job.id, clauseId: "production", taskType: created.job.type, targetRefs: created.job.targetRefs, expectedJobVersion: created.job.observedVersion });
  assert.equal(delegated[0]?.type, "ASSIGN_JOB", JSON.stringify(delegated));
  assert.equal(service.getManager(managerId).availableJobs.some((job) => job.id === created.job.id), true);
});
