import type { ContentReference } from "../content-registry/public.js";
import type { ContextFault } from "../context/public.js";
import type { StableId } from "../simulation/public.js";
import { operationalSignalSchema, parkOperationsCommandSchema, parkOperationsStateSchema } from "./schemas.js";
import type { ExactVersionPin, IncidentStatus, JobStatus, OperationalAlert, OperationalDaySummary, OperationalSignal, OperationalSignalResult, ParkIncident, ParkJob, ParkOperationsCommand, ParkOperationsCommandResult, ParkOperationsDiagnostic, ParkOperationsPorts, ParkOperationsService, ParkOperationsState, ParkPhase, ProductionVersionResolver, RegistryResolverSource, ScheduleOccurrence } from "./types.js";

const jobFrom: Readonly<Record<string, readonly JobStatus[]>> = { "assign-job": ["queued", "assigned"], "start-job": ["assigned"], "pause-job": ["running"], "resume-job": ["paused"], "cancel-job": ["queued", "assigned", "running", "paused"], "complete-job": ["running"], "fail-job": ["running"], "stop-job": ["assigned", "running", "paused"], "escalate-job": ["assigned", "running", "paused"] };
const jobTo: Readonly<Record<string, JobStatus>> = { "assign-job": "assigned", "start-job": "running", "pause-job": "paused", "resume-job": "running", "cancel-job": "cancelled", "complete-job": "completed", "fail-job": "failed", "stop-job": "stopped", "escalate-job": "escalated" };
const phaseTo: Readonly<Record<ParkPhase, ParkPhase>> = { "pre-opening": "open", open: "closing", closing: "engineering", engineering: "pre-opening" };
const incidentFrom: Readonly<Record<string, readonly IncidentStatus[]>> = { "activate-incident": ["detected"], "stabilize-incident": ["active"], "mark-engineering-unresolved": ["stabilized"], "resolve-incident": ["engineering-unresolved"], "close-incident": ["resolved"] };
const incidentTo: Readonly<Record<string, IncidentStatus>> = { "activate-incident": "active", "stabilize-incident": "stabilized", "mark-engineering-unresolved": "engineering-unresolved", "resolve-incident": "resolved", "close-incident": "closed" };
const clone = <T>(value: T): T => structuredClone(value);
const cmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const uniq = <T extends string>(values: readonly T[]): readonly T[] => [...new Set(values)].sort(cmp);
const freeze = <T>(value: T): Readonly<T> => { if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); };
const sortJobs = (values: readonly ParkJob[]): readonly ParkJob[] => [...values].sort((a, b) => b.priority - a.priority || a.dueTick - b.dueTick || cmp(a.id, b.id));
const sortAlerts = (values: readonly OperationalAlert[]): readonly OperationalAlert[] => [...values].sort((a, b) => Number(b.severity === "emergency") - Number(a.severity === "emergency") || b.risk - a.risk || a.tick - b.tick || cmp(a.id, b.id));
const diag = (code: ParkOperationsDiagnostic["code"], path: string, rule: string, message: string): ParkOperationsDiagnostic => ({ code, path, rule, message });
const derivedId = (prefix: string, source: StableId): StableId => `${prefix}:${source.replace(":", "-")}` as StableId;
const occurrenceId = (id: StableId, day: number, tick: number): StableId => `occurrence:${id.replace(":", "-")}-day-${day}-tick-${tick}` as StableId;
const scheduledJobId = (id: StableId, day: number, tick: number): StableId => `job:${id.replace(":", "-")}-day-${day}-tick-${tick}` as StableId;

function resolvePins(resolver: ProductionVersionResolver, references: readonly ContentReference[]): readonly ExactVersionPin[] | undefined {
  const pins: ExactVersionPin[] = [];
  for (const reference of [...references].sort((a, b) => cmp(a.id, b.id) || cmp(a.version, b.version))) { const result = resolver.resolve(reference); if (!result.ok) return undefined; pins.push(result.pin); }
  return pins;
}

export function createRegistryProductionResolver(registry: RegistryResolverSource): ProductionVersionResolver {
  return { resolve(reference) { const result = registry.resolveExact(reference.id, reference.version); return result.ok ? { ok: true, pin: { reference: clone(reference), manifestFingerprint: result.manifest.fingerprint } } : { ok: false }; } };
}

export function createParkOperations(initial: unknown, options: { readonly resolver: ProductionVersionResolver; readonly knownAgentIds: readonly StableId[]; readonly ports?: ParkOperationsPorts }): ParkOperationsService {
  const parsed = parkOperationsStateSchema.safeParse(initial);
  if (!parsed.success) throw new Error("OPS_STATE_INVALID");
  let state = clone(parsed.data) as ParkOperationsState;
  const knownAgents = new Set(options.knownAgentIds);
  const project = (): Readonly<ParkOperationsState> => freeze(clone(state));
  const reject = (id: StableId, issue: ParkOperationsDiagnostic): ParkOperationsCommandResult => ({ accepted: false, commandId: id, state: project(), diagnostics: [issue], createdJobIds: [] });
  const accept = (id: StableId, createdJobIds: readonly StableId[] = [], pauseRequested = false): ParkOperationsCommandResult => ({ accepted: true, commandId: id, state: project(), createdJobIds, pauseRequested });
  const intervene = (id: StableId): void => { state = { ...state, interventionCommandIds: uniq([...state.interventionCommandIds, id]) }; };

  const scheduleThrough = (tick: number): { ok: true; ids: readonly StableId[] } | { ok: false; id: StableId } => {
    const jobs = [...state.jobs], occurrences = [...state.occurrences], ids: StableId[] = [];
    for (const schedule of [...state.schedules].sort((a, b) => cmp(a.id, b.id))) {
      const due = state.dayStartedTick + schedule.dueTickOffset;
      const occurrence: ScheduleOccurrence = { id: occurrenceId(schedule.id, state.day, due), scheduleId: schedule.id, day: state.day, dueTick: due, jobId: scheduledJobId(schedule.id, state.day, due) };
      if (!schedule.enabled || due > tick || occurrences.some((item) => item.id === occurrence.id)) continue;
      const pins = resolvePins(options.resolver, [schedule.task, ...schedule.artifactVersions]); if (!pins) return { ok: false, id: schedule.id };
      occurrences.push(occurrence); ids.push(occurrence.jobId);
      jobs.push({ id: occurrence.jobId, occurrenceId: occurrence.id, task: clone(schedule.task), targetId: schedule.targetId, priority: schedule.priority, scheduleId: schedule.id, source: "schedule", status: "queued", exactDeployedVersions: pins, createdTick: due, dueTick: due, requiredForOpening: schedule.requiredForOpening, resultLinks: [] });
    }
    state = { ...state, tick, jobs: sortJobs(jobs), occurrences: occurrences.sort((a, b) => a.dueTick - b.dueTick || cmp(a.id, b.id)) }; return { ok: true, ids };
  };

  const changePhase = (id: StableId, target: ParkPhase): ParkOperationsCommandResult => {
    if (phaseTo[state.phase] !== target) return reject(id, diag("OPS_PHASE_INVALID", "phase", "sequential-phase-transition", `Park phase ${state.phase} cannot transition directly to ${target}.`));
    if (target === "open" && state.jobs.some((job) => job.requiredForOpening && job.status !== "completed")) return reject(id, diag("OPS_PHASE_INVALID", "phase", "opening-readiness", "The park stayed closed because required pre-opening jobs are incomplete."));
    if (target === "engineering" && state.visitorsPresent > 0) return reject(id, diag("OPS_VISITOR_PHASE_INVALID", "visitorsPresent", "closing-departure", "Engineering cannot begin until all visitors have departed."));
    if (target === "engineering") {
      const summary: OperationalDaySummary = { id: `summary:day-${state.day}` as StableId, day: state.day, startTick: state.dayStartedTick, endTick: state.tick, attendance: state.totalAttendance, departedVisitors: state.departedVisitors, completedJobIds: uniq(state.jobs.filter((j) => j.status === "completed").map((j) => j.id)), failedJobIds: uniq(state.jobs.filter((j) => j.status === "failed").map((j) => j.id)), incidentIds: uniq(state.incidents.map((i) => i.id)), interventionCommandIds: uniq([...state.interventionCommandIds, id]) };
      state = { ...state, phase: target, daySummaries: [...state.daySummaries.filter((entry) => entry.day !== state.day), summary] };
    } else if (target === "pre-opening") state = { ...state, phase: target, day: state.day + 1, dayStartedTick: state.tick, totalAttendance: 0, departedVisitors: 0, interventionCommandIds: [] };
    else state = { ...state, phase: target };
    intervene(id); return accept(id);
  };

  const ingestSignal = (input: unknown): OperationalSignalResult => {
    const parsedSignal = operationalSignalSchema.safeParse(input);
    if (!parsedSignal.success) return { accepted: false, state: project(), diagnostics: [diag("OPS_SIGNAL_INVALID", "signal", "schema", "The operational signal was rejected before state changed.")] };
    const signal = parsedSignal.data as OperationalSignal;
    if (signal.tick !== state.tick || state.signals.some((item) => item.id === signal.id)) return { accepted: false, state: project(), diagnostics: [diag("OPS_SIGNAL_INVALID", "signal", "current-unique-signal", "The signal must use the current tick and a unique stable ID.")] };
    if (signal.classification === "ambient") { state = { ...state, signals: [...state.signals, clone(signal)] }; return { accepted: true, state: project(), classification: "ambient", pauseRequested: false }; }
    const existing = state.incidents.filter((item) => item.status !== "closed" && state.tick - item.updatedTick <= 5 && (item.causalKeys.includes(signal.causalKey) || item.spatialKeys.includes(signal.spatialKey))).sort((a, b) => a.detectedTick - b.detectedTick || cmp(a.id, b.id))[0];
    const incidentId = existing?.id ?? derivedId("incident", signal.id), alertId = derivedId("alert", signal.id), emergency = signal.classification === "emergency";
    const alert: OperationalAlert = { id: alertId, signalId: signal.id, tick: signal.tick, severity: signal.classification, status: existing ? "grouped" : emergency ? "interrupted" : "queued", locationId: signal.locationId, immediateRisk: signal.consequence, risk: signal.risk, entityIds: uniq(signal.entityIds), traceIds: uniq(signal.traceIds), incidentId, pauseRequested: emergency };
    const incidents: readonly ParkIncident[] = existing ? state.incidents.map((item): ParkIncident => item.id === existing.id ? { ...item, updatedTick: signal.tick, risk: Math.max(item.risk, signal.risk), causalKeys: uniq([...item.causalKeys, signal.causalKey]), spatialKeys: uniq([...item.spatialKeys, signal.spatialKey]), observed: uniq([...item.observed, signal.observed]), consequence: uniq([...item.consequence, signal.consequence]), immediateGap: uniq([...item.immediateGap, signal.immediateGap]), entityIds: uniq([...item.entityIds, ...signal.entityIds]), traceIds: uniq([...item.traceIds, ...signal.traceIds]), alertIds: uniq([...item.alertIds, alertId]) } : item) : [...state.incidents, { id: incidentId, status: "detected", detectedTick: signal.tick, updatedTick: signal.tick, causalKeys: [signal.causalKey], spatialKeys: [signal.spatialKey], locationId: signal.locationId, risk: signal.risk, expected: signal.expected, observed: [signal.observed], consequence: [signal.consequence], immediateGap: [signal.immediateGap], entityIds: uniq(signal.entityIds), traceIds: uniq(signal.traceIds), alertIds: [alertId] }];
    if (emergency) options.ports?.time?.setPaused(true);
    state = { ...state, paused: emergency || state.paused, signals: [...state.signals, clone(signal)], alerts: sortAlerts([...state.alerts, alert]), incidents: [...incidents].sort((a, b) => a.detectedTick - b.detectedTick || cmp(a.id, b.id)) };
    return { accepted: true, state: project(), classification: signal.classification, alertId, incidentId, pauseRequested: emergency };
  };

  return { snapshot: () => clone(state), project,
    advanceToTick(tick) { if (!Number.isInteger(tick) || tick < state.tick) return reject("command:advance-tick" as StableId, diag("OPS_TICK_STALE", "tick", "monotonic-tick", "Park Operations cannot advance to an earlier or invalid tick.")); const result = scheduleThrough(tick); return result.ok ? accept("command:advance-tick" as StableId, result.ids) : reject("command:advance-tick" as StableId, diag("OPS_CONTENT_UNRESOLVED", "schedules", "exact-resolution", `Schedule ${result.id} could not resolve exact production content.`)); },
    execute(input) {
      const parsedCommand = parkOperationsCommandSchema.safeParse(input); if (!parsedCommand.success) return reject("command:invalid" as StableId, diag("OPS_COMMAND_INVALID", "command", "schema", "The operational command was rejected before state changed."));
      const command = parsedCommand.data as ParkOperationsCommand; if (command.expectedTick !== state.tick) return reject(command.id, diag("OPS_TICK_STALE", "expectedTick", "exact-current-tick", "The operational command used a stale park tick."));
      if (command.kind === "create-job") { if (state.jobs.some((j) => j.id === command.job.id)) return reject(command.id, diag("OPS_JOB_DUPLICATE", "job.id", "unique-job-id", "A job with this stable ID already exists.")); const pins = resolvePins(options.resolver, [command.job.task, ...command.artifactVersions]); if (!pins) return reject(command.id, diag("OPS_CONTENT_UNRESOLVED", "artifactVersions", "exact-resolution", "The job stayed uncreated because exact production content is unavailable.")); const job: ParkJob = { ...clone(command.job), status: "queued", exactDeployedVersions: pins, resultLinks: [] }; state = { ...state, jobs: sortJobs([...state.jobs, job]) }; return accept(command.id, [job.id]); }
      if (command.kind === "transition-phase") return changePhase(command.id, command.phase);
      if (command.kind === "open-park") return changePhase(command.id, "open"); if (command.kind === "begin-closing") return changePhase(command.id, "closing"); if (command.kind === "enter-engineering") return changePhase(command.id, "engineering"); if (command.kind === "start-next-day") return changePhase(command.id, "pre-opening");
      if (command.kind === "set-time-control") { options.ports?.time?.setPaused(command.paused); options.ports?.time?.setSpeed(command.speed); state = { ...state, paused: command.paused, speed: command.speed }; intervene(command.id); return accept(command.id); }
      if (command.kind === "admit-visitors" || command.kind === "depart-visitors") { const admit = command.kind === "admit-visitors"; if ((admit && state.phase !== "open") || (!admit && state.phase !== "closing" && !state.paused)) return reject(command.id, diag("OPS_VISITOR_PHASE_INVALID", "phase", "visitor-phase-permission", "Visitors may enter only while open and depart only during closing or emergency pause.")); if (!admit && command.count > state.visitorsPresent) return reject(command.id, diag("OPS_VISITOR_PHASE_INVALID", "count", "available-visitors", "Cannot depart more visitors than are present.")); const allowed = admit ? options.ports?.visitors?.admit(command.count) : options.ports?.visitors?.depart(command.count); if (allowed === false) return reject(command.id, diag("OPS_PORT_REJECTED", "visitors", "authoritative-port", "The authoritative visitor operation was rejected.")); state = admit ? { ...state, visitorsPresent: state.visitorsPresent + command.count, totalAttendance: state.totalAttendance + command.count } : { ...state, visitorsPresent: state.visitorsPresent - command.count, departedVisitors: state.departedVisitors + command.count }; intervene(command.id); return accept(command.id); }
      if (command.kind === "acknowledge-alert") { const index = state.alerts.findIndex((a) => a.id === command.alertId); if (index < 0) return reject(command.id, diag("OPS_COMMAND_INVALID", "alertId", "existing-alert", "The requested alert does not exist.")); const alerts = [...state.alerts]; alerts[index] = { ...alerts[index]!, status: "acknowledged" }; state = { ...state, alerts: sortAlerts(alerts) }; intervene(command.id); return accept(command.id); }
      if ("incidentId" in command) { const index = state.incidents.findIndex((i) => i.id === command.incidentId); if (index < 0) return reject(command.id, diag("OPS_INCIDENT_NOT_FOUND", "incidentId", "existing-incident", "The requested incident does not exist.")); const current = state.incidents[index]!; if (!incidentFrom[command.kind]?.includes(current.status)) return reject(command.id, diag("OPS_INCIDENT_TRANSITION_INVALID", "kind", "incident-state-machine", `Incident ${current.id} cannot ${command.kind} from ${current.status}.`)); const status = incidentTo[command.kind]!; const replacement: ParkIncident = { ...current, status, updatedTick: state.tick, ...(status === "stabilized" ? { stabilizedTick: state.tick } : {}), ...(status === "resolved" ? { resolvedTick: state.tick } : {}), ...(status === "closed" ? { closedTick: state.tick } : {}) }; const incidents = [...state.incidents]; incidents[index] = replacement; state = { ...state, incidents }; intervene(command.id); return accept(command.id); }
      if (!("jobId" in command)) return reject(command.id, diag("OPS_COMMAND_INVALID", "kind", "implemented-command", "The operational command is unavailable."));
      const index = state.jobs.findIndex((j) => j.id === command.jobId); if (index < 0) return reject(command.id, diag("OPS_JOB_NOT_FOUND", "jobId", "existing-job", "The requested job does not exist.")); const current = state.jobs[index]!; if (!jobFrom[command.kind]?.includes(current.status)) return reject(command.id, diag("OPS_JOB_TRANSITION_INVALID", "kind", "job-state-machine", `Job ${current.id} cannot ${command.kind} from ${current.status}.`)); if (command.kind === "assign-job" && !knownAgents.has(command.agentId)) return reject(command.id, diag("OPS_AGENT_NOT_FOUND", "agentId", "known-agent", "The Agent is unavailable.")); const resultLink = "resultLink" in command ? command.resultLink : undefined; const replacement: ParkJob = { ...current, status: jobTo[command.kind]!, ...(command.kind === "assign-job" ? { assignedAgentId: command.agentId } : {}), ...(resultLink ? { resultLinks: [...current.resultLinks, resultLink] } : {}) }; const jobs = [...state.jobs]; jobs[index] = replacement; state = { ...state, jobs: sortJobs(jobs) }; intervene(command.id); return accept(command.id);
    }, ingestSignal,
    reportContextFault(fault: ContextFault) { const clean = (value: string): string => value.toLowerCase().replace(/[^a-z0-9-]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown"; return ingestSignal({ id: `signal:context-${clean(fault.id)}`, tick: fault.decisionTick, classification: "emergency", source: "context", causalKey: fault.code, spatialKey: `agent-${clean(fault.agentId)}`, locationId: "location:park", risk: 100, expected: "Agent Context fits its explicit capacity and Retention Policy.", observed: `${fault.code} exceeded capacity by ${fault.excess}.`, consequence: "The Agent decision stopped before unsafe partial execution.", immediateGap: "Context capacity or Retention Policy must be repaired.", entityIds: [`agent:${clean(fault.agentId)}`, `job:${clean(fault.jobId)}`], traceIds: [] }); }
  };
}
