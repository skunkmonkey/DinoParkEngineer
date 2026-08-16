"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { DataTable, Meter, Panel, StatusBadge } from "../platform/public.ts";
import { formatContextUnits } from "../platform/public.ts";
import { createOrchestrationService, DEFAULT_MANAGER_CONFIG, type ManagerEvaluationResult, type OrchestrationService, type SchedulingWorker } from "../../orchestration/index.ts";
import { getActiveOrchestrationService } from "./runtime.ts";
import { getActiveReviewDeploymentRuntime } from "../review-deployment/public.ts";
import "./ManagerRoute.css";

const fallbackWorkers: readonly SchedulingWorker[] = Object.freeze([{
  id: "agent.keeper01",
  role: "KEEPER",
  status: "IDLE",
  tools: ["move_to", "open_gate", "close_gate", "lock_gate", "dispense_food", "alert_security", "evacuate_visitors"],
  contextBudget: 8000,
  contextLoad: 0,
  queueLength: 0,
  queueCapacity: 5,
}]);

function createFallbackService(): OrchestrationService {
  return createOrchestrationService({ workers: fallbackWorkers, configs: [DEFAULT_MANAGER_CONFIG], eligibility: () => ({ eligible: false, code: "PRESSURE_REQUIRED", reason: "Production Economy/Progression provider is not connected." }) });
}

export function ManagerRoute({ params, navigate }: ShellRouteProps) {
  const service = useMemo(() => getActiveOrchestrationService() ?? createFallbackService(), []);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [managerEvaluation, setManagerEvaluation] = useState<ManagerEvaluationResult | null>(null);
  const [acknowledgeReviewWarnings, setAcknowledgeReviewWarnings] = useState(false);
  const authoredConfig = service.configurations().toSorted((left, right) => right.version - left.version)[0] ?? DEFAULT_MANAGER_CONFIG;
  const managerId = params.managerId ?? authoredConfig.managerId ?? authoredConfig.id;
  void version;
  const manager = service.getManager(managerId);
  const config = service.configurations().filter((candidate) => (candidate.managerId ?? candidate.id) === managerId).toSorted((left, right) => right.version - left.version)[0] ?? authoredConfig;
  const [selectedJobId, setSelectedJobId] = useState(manager.availableJobs[0]?.id ?? "");
  const [selectedIncidentId, setSelectedIncidentId] = useState(typeof manager.incidents[0]?.id === "string" ? manager.incidents[0].id : "");
  useEffect(() => service.subscribe(() => setVersion((value) => value + 1)), [service]);
  const validate = () => {
    if (!config) return;
    const result = service.validateConfiguration(config);
    setMessage(result.valid ? `Configuration ${result.exactRef} is structurally valid.` : result.errors.map((error) => `${error.code}: ${error.message}`).join(" "));
  };
  const activate = () => {
    if (!config) return;
    const result = service.activate(config);
    setMessage(result.ok ? `Activated ${result.config.id}@${result.config.version}.` : result.errors.map((error) => `${error.code}: ${error.message}`).join(" "));
  };
  const ensureManagerReview = () => {
    const reviewRuntime = getActiveReviewDeploymentRuntime();
    if (!reviewRuntime) {
      setMessage("Review / Deployment is unavailable. Reload after production providers initialize.");
      return undefined;
    }
    if (!config) return undefined;
    const existing = reviewRuntime.reviews.list().find((review) => review.proposedRef.artifactId === config.id && review.proposedRef.version === config.version);
    if (existing) return existing;
    const submitted = reviewRuntime.reviews.submit({
        id: `review.${config.id}.v${config.version}`,
        baseRef: { artifactId: config.id, version: 1 },
        proposedRef: { artifactId: config.id, version: config.version },
        author: "Park Developer",
        goal: "Evaluate bounded delegation, safety precedence, escalation, and reporting before Manager activation.",
        createdAtGameTime: 0,
      });
    if (!submitted.ok) {
      setMessage(`${submitted.error.code}: ${submitted.error.message}`);
      return undefined;
    }
    return submitted.value;
  };
  const openManagerReview = () => {
    if (!ensureManagerReview()) return;
    navigate("/reviews");
  };
  const evaluateManagerReview = () => {
    if (!config) return;
    const reviewRuntime = getActiveReviewDeploymentRuntime();
    const review = ensureManagerReview();
    if (!reviewRuntime || !review) return;
    const evaluation = service.evaluateConfiguration(config);
    setManagerEvaluation(evaluation);
    if (!evaluation.passed) {
      setMessage(`Manager evaluation failed: ${evaluation.assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.message).join(" ")}`);
      return;
    }
    let current = review;
    if (current.state === "PENDING" || current.state === "CHANGES_REQUESTED") {
      const running = reviewRuntime.reviews.transition(current.reviewId, "EVALS_RUNNING", current.version, "Manager evaluator", 0);
      if (!running.ok) { setMessage(running.error.message); return; }
      current = running.value;
    }
    if (current.state === "EVALS_RUNNING") {
      const ready = reviewRuntime.reviews.transition(current.reviewId, "READY", current.version, "Manager evaluator", 0);
      if (!ready.ok) { setMessage(ready.error.message); return; }
      current = ready.value;
    }
    setMessage(`Manager evaluation passed ${evaluation.assertions.length}/${evaluation.assertions.length} deterministic assertions; review ${current.reviewId} is ${current.state}.`);
  };
  const deployManagerReview = () => {
    const reviewRuntime = getActiveReviewDeploymentRuntime();
    const review = ensureManagerReview();
    if (!reviewRuntime || !review) return;
    const current = reviewRuntime.reviews.get(review.reviewId) ?? review;
    if (current.state !== "READY") { setMessage(`Review is ${current.state}; run the Manager evaluation before deployment.`); return; }
    const assessment = reviewRuntime.deployments.validate(current.reviewId);
    if (!assessment.valid) { setMessage(assessment.hardGates.map((gate) => gate.message).join(" ")); return; }
    if (assessment.warnings.length > 0 && !acknowledgeReviewWarnings) { setMessage(`Acknowledge deployment warnings: ${assessment.warnings.map((warning) => warning.code).join(", ")}.`); return; }
    const result = reviewRuntime.deployments.deploy({ reviewId: current.reviewId, expectedReviewVersion: current.version, acknowledgeWarningCodes: assessment.warnings.map((warning) => warning.code), transactionId: `manager.deploy.${current.reviewId}.${current.version}`, actor: "player", gameTime: 0 });
    setMessage(result.ok ? `Deployed exact ${result.value.ref.artifactId}@${result.value.ref.version}; activate it to begin delegation.` : result.error.message);
  };
  const delegate = () => {
    const job = manager.availableJobs.find((candidate) => candidate.id === selectedJobId);
    if (!job) return;
    const commands = service.handle({ kind: "DELEGATION", managerId, executionId: `ui.delegation.${job.id}`, jobId: job.id, clauseId: "ui.manager.delegate", taskType: job.type, targetRefs: job.targetRefs, task: job, expectedJobVersion: job.expectedVersion });
    setMessage(commands.map((command) => command.type === "REJECT" ? `${command.reason}: ${command.diagnostics.join(" ")}` : `${command.type} ${"accepted" in command ? command.accepted ? "accepted" : "rejected" : "issued"}`).join(" · ") || "No command emitted.");
  };
  const escalate = () => {
    const incident = manager.incidents.find((candidate) => candidate.id === selectedIncidentId);
    if (!incident || typeof incident.id !== "string") return;
    const severity = typeof incident.severity === "number" && incident.severity >= 0 && incident.severity <= 4 ? incident.severity as 0 | 1 | 2 | 3 | 4 : 2;
    const commands = service.handle({ kind: "ESCALATION", managerId, jobId: typeof incident.responsibleJobId === "string" ? incident.responsibleJobId : `incident-response.${incident.id}`, severity, reason: typeof incident.trigger === "string" ? incident.trigger : "Park incident", failureCode: typeof incident.trigger === "string" && incident.trigger.toLowerCase().includes("jam") ? "GATE_JAM" : "INCIDENT", fallbackAttempts: 1, targetRefs: Array.isArray(incident.affectedEntityIds) ? incident.affectedEntityIds.filter((id): id is string => typeof id === "string") : [], childTraceId: typeof incident.traceId === "string" ? incident.traceId : undefined });
    setMessage(commands.map((command) => command.type).join(" → "));
  };
  const assignmentRows = manager.assignments.map((assignment) => [
    assignment.jobId,
    assignment.workerId || "Unassigned",
    assignment.status,
    `${assignment.priorityClass ?? "—"} · ${assignment.matchedRuleId ?? "no rule"}`,
    assignment.decision?.status === "ASSIGNED" ? assignment.decision.tieBreak : assignment.decision?.status === "UNASSIGNED" ? `Rejected: ${assignment.decision.reason}` : "—",
    assignment.decision?.eligibility.map((fact) => `${fact.workerId}: ${fact.eligible ? "eligible" : fact.reasons.join(", ")}`).join(" · ") || "No eligibility facts",
    assignment.decision?.eligibility.flatMap((fact) => fact.reasons.filter((reason) => reason.startsWith("AUTHORITY") || reason.startsWith("WORKER_MANAGED_BY"))).join(", ") || "Admitted by Manager authority",
    assignment.routing ? `${assignment.routing.policyId ?? "default policy"} · ${formatContextUnits(assignment.routing.projectedLoad)} / ${formatContextUnits(assignment.routing.budget)} · ${assignment.routing.blockedInputs.length ? `Blocked: ${assignment.routing.blockedInputs.join(", ")}` : "Routed"}` : "No Context route",
  ]);
  const eventRows = manager.recentEvents.slice(-12).reverse().map((event) => [event.sequence, event.type, event.jobId ?? "—", event.workerId ?? "—", event.logicalTime]);

  return (
    <div className="manager-route" data-testid="manager-orchestration">
      <div className="manager-route__header">
        <div>
          <p className="manager-route__eyebrow">Manager Agent · Orchestration</p>
          <h1>{manager.id}</h1>
          <p>Delegation is explicit architecture: every worker, rule, context route, and escalation remains inspectable.</p>
        </div>
        <StatusBadge label={manager.status} status={manager.status === "ACTIVE" ? "success" : "warning"} />
      </div>

      <nav className="foundation-actions" aria-label="Agent orchestration navigation"><button type="button" onClick={() => navigate("/agents")}>Worker Agents</button><button type="button" onClick={openManagerReview}>Open Manager review / evaluate / deploy</button><button type="button" onClick={() => navigate("/progress")}>Manager unlock / purchase</button></nav>
      {message ? <p role="status" className="foundation-notice">{message}</p> : null}

      {manager.status !== "ACTIVE" ? <Panel eyebrow={`Eligibility · ${manager.eligibility.code}`} title="Manager is intentionally inactive"><p>{manager.eligibility.reason}</p><p>Pressure/unlock, purchase, and exact reviewed deployment are independent gates. Manual worker assignment remains available.</p><div className="foundation-actions"><button type="button" onClick={validate} disabled={!config}>Validate configuration</button><button type="button" onClick={activate} disabled={!config}>Activate exact deployed config</button></div></Panel> : null}

      <Panel eyebrow="Manager change control" title="Review, evaluate, and deploy the executable configuration">
        <p>The production workflow compares exact {config.id} v1 → v{config.version}, runs deterministic delegation and gate-jam assertions, then deploys the same executable configuration.</p>
        <div className="foundation-actions"><button type="button" onClick={openManagerReview}>Inspect exact review</button><button type="button" onClick={evaluateManagerReview} disabled={!config}>Run deterministic Manager evaluation</button><label><input type="checkbox" checked={acknowledgeReviewWarnings} onChange={(event) => setAcknowledgeReviewWarnings(event.target.checked)} /> Acknowledge displayed deployment warnings</label><button type="button" onClick={deployManagerReview} disabled={!managerEvaluation?.passed}>Deploy evaluated Manager config</button></div>
        {managerEvaluation ? <ul>{managerEvaluation.assertions.map((assertion) => <li key={assertion.id}><StatusBadge label={assertion.passed ? "PASS" : "FAIL"} status={assertion.passed ? "success" : "error"} /> {assertion.message}</li>)}</ul> : <p>No Manager evaluation has run in this session.</p>}
      </Panel>

      <div className="manager-route__grid">
        <Panel eyebrow="Mission / version" title="Exact configuration">
          <dl><div><dt>Mission Prompt</dt><dd><code>{manager.missionPromptRef ? `${manager.missionPromptRef.artifactId}@${manager.missionPromptRef.version}` : "—"}</code></dd></div><div><dt>Configuration</dt><dd>v{manager.configurationVersion}</dd></div><div><dt>Worker pool</dt><dd>{manager.workerCount} / {manager.maxWorkers}</dd></div><div><dt>Concurrency</dt><dd>{manager.maxConcurrentWorkers}</dd></div></dl>
          <Meter label="Worker capacity" value={manager.workerCount} max={Math.max(1, manager.maxWorkers)} detail={`${manager.workerCount} configured workers`} />
          <p><strong>Priority policy:</strong> safety {config?.priorityPolicy?.safetyIncidents ?? 400} &gt; containment {config?.priorityPolicy?.containment ?? 300} &gt; animal health {config?.priorityPolicy?.animalHealth ?? 200} &gt; guest throughput {config?.priorityPolicy?.guestThroughput ?? 100} &gt; routine {config?.priorityPolicy?.routine ?? 0}. Severity 2+ is an immutable safety boundary.</p>
          <p><strong>Authority:</strong> assign {config?.authority.canAssign === false ? "denied" : "allowed"}; security dispatch {config?.authority.canDispatchSecurity === false ? "denied" : "allowed"}; roles {config?.authority.allowedWorkerRoles?.join(", ") || "configured worker pool"}; Tools {config?.authority.allowedToolIds?.join(", ") || "worker-owned only"}.</p>
        </Panel>
        <Panel eyebrow="Context routing" title="Bounded Context">
          <Meter label="Routed context" value={manager.context.projectedLoad} max={Math.max(1, manager.context.budget)} detail={`${formatContextUnits(manager.context.projectedLoad)} / ${formatContextUnits(manager.context.budget)}`} />
          <p>{manager.context.routed} routed · {manager.context.blocked} blocked</p>
          <p><strong>Manager summary:</strong> {manager.context.summaryStatus} · {manager.context.summarySections.join(", ")}</p>
          <p><strong>Included:</strong> {manager.context.includedRefs.join(", ") || "None yet"}</p>
          <p><strong>Omitted:</strong> {manager.context.omittedRefs.join(", ") || "None"}</p>
        </Panel>
        <Panel eyebrow="Escalation" title="Safety response"><dl><div><dt>Open escalations</dt><dd>{manager.escalation.open}</dd></div><div><dt>Immediate reports</dt><dd>{manager.escalation.immediateReports}</dd></div><div><dt>Security dispatches</dt><dd>{manager.escalation.securityDispatches}</dd></div></dl><p>Hard safety precedence remains authoritative; the Manager cannot fabricate tools or bypass Context Budgets.</p></Panel>
        <Panel eyebrow="Reporting" title="Child-job reports"><dl><div><dt>Pending routine</dt><dd>{manager.reports.pendingRoutine}</dd></div><div><dt>Reports sent</dt><dd>{manager.reports.sent}</dd></div></dl><p>Exceptions report immediately. Routine completions batch according to the deployed reporting policy.</p></Panel>
      </div>

      <Panel eyebrow="Live controls" title="Delegate and escalate through public ports">
        <div className="foundation-actions"><label>Queued Park job <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}><option value="">No queued job</option>{manager.availableJobs.map((job) => <option key={job.id} value={job.id}>{job.id} · {job.type}</option>)}</select></label><button type="button" onClick={delegate} disabled={manager.status !== "ACTIVE" || !selectedJobId}>Delegate selected job</button></div>
        <div className="foundation-actions"><label>Park incident <select value={selectedIncidentId} onChange={(event) => setSelectedIncidentId(event.target.value)}><option value="">No incident</option>{manager.incidents.map((incident) => typeof incident.id === "string" ? <option key={incident.id} value={incident.id}>{incident.id} · severity {String(incident.severity ?? "?")}</option> : null)}</select></label><button type="button" onClick={escalate} disabled={manager.status !== "ACTIVE" || !selectedIncidentId}>Escalate selected incident</button></div>
      </Panel>

      <Panel eyebrow="Live graph" title="Assignments and worker pressure">
        <DataTable caption="Manager assignment explanations" columns={[{ id: "job", label: "Child job" }, { id: "worker", label: "Worker" }, { id: "status", label: "Status" }, { id: "policy", label: "Priority class / policy" }, { id: "tie", label: "Tie-break / rejection" }, { id: "eligibility", label: "Eligibility facts" }, { id: "authority", label: "Authority" }, { id: "context", label: "Context policy / blockers" }]} rows={assignmentRows.length ? assignmentRows : [["No delegated jobs", "—", "—", "—", "—", "—", "—", "—"]]} />
        <DataTable caption="Worker queue pressure" columns={[{ id: "worker", label: "Worker" }, { id: "queued", label: "Queued jobs" }]} rows={Object.entries(manager.queuePressure).map(([workerId, queue]) => [workerId, queue])} />
      </Panel>

      <Panel eyebrow="Manager trace" title="Recent observable orchestration events"><DataTable caption="Manager events" columns={[{ id: "sequence", label: "#" }, { id: "type", label: "Event" }, { id: "job", label: "Job" }, { id: "worker", label: "Worker" }, { id: "time", label: "Logical time" }]} rows={eventRows.length ? eventRows : [["—", "No events", "—", "—", "—"]]} /></Panel>
    </div>
  );
}
