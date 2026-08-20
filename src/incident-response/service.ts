import type { ParkIncident } from "../park-operations/public.js";
import type { StableId, WorldCommand, WorldState } from "../simulation/public.js";
import type { IncidentResponseOptions, IncidentResponseRecord, IncidentResponseService, ResponseActionEvidence, ResponseCapabilityPlan, ResponseDiagnostic, ResponseOutcome, ResponsePlan, ResponseResult, ResponseStatus } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);
const freeze = <T>(value: T): T => { if (value !== null && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; };
const ok = <T>(value: T, idempotent = false): ResponseResult<T> => freeze({ ok: true, value: clone(value), idempotent });
const fail = <T>(code: ResponseDiagnostic["code"], message: string): ResponseResult<T> => freeze({ ok: false, diagnostics: [{ code, message }] });
const byId = (left: { readonly id: string }, right: { readonly id: string }): number => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
const responseId = (incidentId: StableId): StableId => `response:${incidentId.split(":")[1] ?? "incident"}` as StableId;
const planId = (incidentId: StableId): StableId => `response-plan:${incidentId.split(":")[1] ?? "incident"}` as StableId;
const commandId = (response: StableId, capability: string): StableId => `response-command:${response.split(":")[1] ?? "incident"}-${capability}` as StableId;

const capabilityPlans = (incident: ParkIncident, world: WorldState, options: IncidentResponseOptions): readonly ResponseCapabilityPlan[] => {
  const rules = options.rules;
  const visitor = [...world.visitors].sort(byId).find((entry) => incident.entityIds.includes(entry.id) && entry.locationId === incident.locationId && entry.locationId !== rules.safeZoneId);
  const gate = world.gates.find((entry) => entry.id === rules.containmentGateId && (entry.locationA === incident.locationId || entry.locationB === incident.locationId));
  const robot = [...world.robots].sort(byId).find((entry) => incident.entityIds.includes(entry.id) && entry.locationId === incident.locationId);
  const evacuationActor = world.robots.find((entry) => entry.id === rules.evacuationActorId && entry.action !== "disabled" && entry.health > 0 && entry.toolRefs.some((tool) => tool.id === rules.evacuationTool.id && tool.version === rules.evacuationTool.version));
  const containmentActor = world.robots.find((entry) => entry.id === rules.containmentActorId && entry.action !== "disabled" && entry.health > 0 && entry.toolRefs.some((tool) => tool.id === rules.containmentTool.id && tool.version === rules.containmentTool.version));
  const containmentAccess = gate !== undefined && containmentActor !== undefined && (gate.accessZones.length === 0 || gate.accessZones.some((zone) => containmentActor.accessZones.includes(zone)));
  const recoveryEdge = robot === undefined ? undefined : world.navigationEdges.find((entry) => (entry.from === robot.locationId && entry.to === rules.recoveryDestinationId) || (entry.to === robot.locationId && entry.from === rules.recoveryDestinationId));
  return freeze([
    { capability: "visitor-evacuation", entityId: visitor?.id ?? incident.locationId, destinationId: rules.safeZoneId, available: visitor !== undefined && visitor.size <= rules.maxEvacuationGroupSize && evacuationActor !== undefined, limitation: visitor === undefined ? "No incident-linked visitor group requires evacuation at this location." : visitor.size > rules.maxEvacuationGroupSize ? `Group size ${visitor.size} exceeds response capacity ${rules.maxEvacuationGroupSize}.` : evacuationActor === undefined ? "The authored evacuation actor or exact tool is unavailable." : undefined },
    { capability: "temporary-containment", entityId: gate?.id ?? rules.containmentGateId, available: gate !== undefined && gate.position === "open" && !gate.jammed && containmentActor !== undefined && containmentAccess, limitation: gate === undefined ? "No authored containment gate bounds this incident location." : gate.jammed ? "The containment gate is jammed." : gate.position === "closed" ? "The containment gate is already closed." : containmentActor === undefined ? "The authored containment actor or exact tool is unavailable." : !containmentAccess ? "The response actor lacks access to the containment gate." : undefined },
    { capability: "stranded-robot-recovery", entityId: robot?.id ?? incident.locationId, destinationId: rules.recoveryDestinationId, available: robot !== undefined && robot.action !== "disabled" && robot.health > 0 && recoveryEdge !== undefined, limitation: robot === undefined ? "No incident-linked robot is stranded at this location." : robot.action === "disabled" || robot.health === 0 ? "The robot is physically disabled and cannot use the authored recovery route." : recoveryEdge === undefined ? "No direct authored recovery route reaches the service location." : undefined },
  ]);
};

const eligibleIncident = (incident: ParkIncident | undefined, world: WorldState): incident is ParkIncident => {
  if (incident === undefined || !["detected", "active", "engineering-unresolved"].includes(incident.status) || incident.risk <= 0) return false;
  if (!world.locations.some((entry) => entry.id === incident.locationId)) return false;
  return incident.entityIds.some((id) => [...world.visitors, ...world.robots, ...world.dinosaurs, ...world.gates, ...world.hazards].some((entity) => entity.id === id));
};

export function createIncidentResponse(options: IncidentResponseOptions): IncidentResponseService {
  const plans = new Map<StableId, ResponsePlan>();
  const records = new Map<StableId, IncidentResponseRecord>();
  let currentTick = options.ports.parkOperations.snapshot().tick;

  const replaceRecord = (record: IncidentResponseRecord): void => { records.set(record.id, freeze(clone(record))); };
  const transition = (record: IncidentResponseRecord, status: ResponseStatus, tick: number): IncidentResponseRecord => ({ ...record, status, transitions: [...record.transitions, { status, tick }] });

  const plan = (incidentId: StableId): ResponseResult<ResponsePlan> => {
    const existing = plans.get(planId(incidentId));
    if (existing !== undefined) return ok(existing, true);
    const incident = options.ports.parkOperations.snapshot().incidents.find((entry) => entry.id === incidentId);
    const world = options.ports.simulation.snapshot();
    if (!eligibleIncident(incident, world)) return fail("RESPONSE_INELIGIBLE", "The exact grouped incident and world state are not eligible for external response.");
    const capabilities = capabilityPlans(incident, world, options);
    const selected = capabilities.filter((entry) => entry.available).map((entry) => entry.capability);
    if (selected.length === 0) return fail("RESPONSE_INELIGIBLE", "No authored response capability can act on the exact current world state.");
    const id = planId(incident.id);
    const amount = options.rules.baseCalloutCost + incident.risk * options.rules.riskCostPerPoint;
    const quoteResult = options.ports.economy.quote({ id: `quote:${id.split(":")[1] ?? "incident"}`, category: "response", day: options.ports.parkOperations.snapshot().day, tick: currentTick, amount, source: { kind: "system", id: incident.id, label: "Incident Response callout" }, incidentIds: [incident.id], entityIds: incident.entityIds, description: "External safety stabilization callout." });
    if (!quoteResult.ok) return fail("RESPONSE_ECONOMY_REJECTED", quoteResult.diagnostics[0]?.message ?? "Economy rejected the response quote.");
    const dispatchTick = currentTick + 1; const arrivalTick = currentTick + options.rules.arrivalDelayTicks;
    const created: ResponsePlan = { id, incidentId: incident.id, locationId: incident.locationId, immediateRisks: [...incident.consequence, ...incident.immediateGap], capabilities, selectedCapabilities: selected, requestedTick: currentTick, dispatchTick, arrivalTick, estimatedDurationTicks: options.rules.operatingDurationTicks, expectedCompleteTick: arrivalTick + options.rules.operatingDurationTicks, quote: quoteResult.value, closures: [`Close ${incident.locationId} through tick ${arrivalTick + options.rules.operatingDurationTicks}.`], preconditions: ["The grouped incident remains active.", "Authored response access and capacity remain available."], expectedStabilizationBoundaries: ["Evacuate exposed visitors to the authored safe zone.", "Close the authored containment gate temporarily.", "Move an operational stranded robot to the authored service location.", "Do not alter Context, artifacts, routes, Retention Policy, reviews, or deployments."], limitations: capabilities.flatMap((entry) => entry.limitation === undefined ? [] : [entry.limitation]) };
    plans.set(id, freeze(clone(created))); return ok(created);
  };

  const activate = (id: StableId, expectedTick: number): ResponseResult<IncidentResponseRecord> => {
    const existing = [...records.values()].find((entry) => entry.plan.id === id);
    if (existing !== undefined) return ok(existing, true);
    if (expectedTick !== currentTick) return fail("RESPONSE_TICK_STALE", `Expected response tick ${expectedTick}; current tick is ${currentTick}.`);
    const selectedPlan = plans.get(id); if (selectedPlan === undefined) return fail("RESPONSE_PLAN_NOT_FOUND", "The exact response plan was not found.");
    const incident = options.ports.parkOperations.snapshot().incidents.find((entry) => entry.id === selectedPlan.incidentId);
    if (!eligibleIncident(incident, options.ports.simulation.snapshot())) return fail("RESPONSE_ACTIVATION_REJECTED", "The incident is no longer eligible under the exact current world state.");
    const reservationResult = options.ports.economy.reserve({ quote: selectedPlan.quote, reservationId: `reservation:${id.split(":")[1] ?? "incident"}`, commandId: `activate:${id.split(":")[1] ?? "incident"}` });
    if (!reservationResult.ok) return fail("RESPONSE_ECONOMY_REJECTED", reservationResult.diagnostics[0]?.message ?? "Economy rejected the response reservation.");
    const record: IncidentResponseRecord = { id: responseId(selectedPlan.incidentId), plan: selectedPlan, status: "requested", transitions: [{ status: "requested", tick: currentTick }], reservation: reservationResult.value, actionEvidence: [], traceLinks: incident.traceIds, engineeringBoundaryBefore: clone(options.engineeringBoundary), engineeringBoundaryAfter: clone(options.engineeringBoundary), engineeringUnresolved: true };
    replaceRecord(record); return ok(record);
  };

  const executeActions = (record: IncidentResponseRecord): IncidentResponseRecord => {
    const actions: ResponseActionEvidence[] = [];
    for (const capability of record.plan.capabilities.filter((entry) => entry.available)) {
      const world = options.ports.simulation.snapshot(); let command: WorldCommand;
      if (capability.capability === "visitor-evacuation") command = { id: commandId(record.id, "evacuate"), kind: "evacuate", expectedTick: world.tick, actorId: options.rules.evacuationActorId, visitorId: capability.entityId, destinationId: options.rules.safeZoneId, tool: options.rules.evacuationTool };
      else if (capability.capability === "temporary-containment") command = { id: commandId(record.id, "contain"), kind: "operate-gate", expectedTick: world.tick, actorId: options.rules.containmentActorId, gateId: options.rules.containmentGateId, operation: "close", tool: options.rules.containmentTool };
      else command = { id: commandId(record.id, "recover"), kind: "move", expectedTick: world.tick, actorId: capability.entityId, destinationId: options.rules.recoveryDestinationId };
      const result = options.ports.simulation.execute(command);
      actions.push({ capability: capability.capability, commandId: command.id, accepted: result.accepted, deltas: result.deltas, evidence: result.evidence, diagnosticCodes: result.accepted ? [] : result.diagnostics.map((entry) => entry.code) });
    }
    const accepted = actions.filter((entry) => entry.accepted).length;
    let next: IncidentResponseRecord = { ...record, actionEvidence: actions };
    if (accepted === 0) next = transition(next, "failed", currentTick);
    else if (accepted < actions.length) next = transition(next, "limited", currentTick);
    return next;
  };

  const stabilizeIncident = (record: IncidentResponseRecord): IncidentResponseRecord => {
    const ops = options.ports.parkOperations; const incident = ops.snapshot().incidents.find((entry) => entry.id === record.plan.incidentId);
    if (incident?.status === "detected") ops.execute({ id: commandId(record.id, "activate-incident"), kind: "activate-incident", expectedTick: ops.snapshot().tick, incidentId: incident.id });
    if (ops.snapshot().incidents.find((entry) => entry.id === record.plan.incidentId)?.status === "active") ops.execute({ id: commandId(record.id, "stabilize-incident"), kind: "stabilize-incident", expectedTick: ops.snapshot().tick, incidentId: record.plan.incidentId });
    if (ops.snapshot().incidents.find((entry) => entry.id === record.plan.incidentId)?.status === "stabilized") ops.execute({ id: commandId(record.id, "unresolved"), kind: "mark-engineering-unresolved", expectedTick: ops.snapshot().tick, incidentId: record.plan.incidentId });
    return transition(record, "stabilized", currentTick);
  };

  const complete = (record: IncidentResponseRecord): ResponseResult<IncidentResponseRecord> => {
    const committed = options.ports.economy.commit(record.reservation.id, { commandId: commandId(record.id, "settle"), tick: currentTick, day: options.ports.parkOperations.snapshot().day });
    if (!committed.ok) return fail("RESPONSE_ECONOMY_REJECTED", committed.diagnostics[0]?.message ?? "Economy rejected response settlement.");
    const before = options.ports.simulation.snapshot();
    const casualties = before.visitors.reduce((total, visitor) => total + (visitor.safety === "casualty" ? visitor.size : 0), 0);
    const outcome: ResponseOutcome = { closures: record.plan.closures, downtimeTicks: currentTick - record.plan.requestedTick, cost: record.plan.quote.amount, ratingEffect: -options.rules.ratingPenalty, casualtiesAvoided: record.actionEvidence.some((entry) => entry.capability === "visitor-evacuation" && entry.accepted) ? before.visitors.reduce((total, visitor) => total + (visitor.evacuating ? visitor.size : 0), 0) : 0, casualtiesIncurred: casualties };
    return ok({ ...transition(record, "complete", currentTick), settlement: committed.value, outcome, engineeringBoundaryAfter: clone(options.engineeringBoundary), engineeringUnresolved: true });
  };

  const advanceToTick = (tick: number): ResponseResult<readonly IncidentResponseRecord[]> => {
    if (!Number.isInteger(tick) || tick < currentTick) return fail("RESPONSE_TICK_STALE", `Response tick ${tick} cannot precede current tick ${currentTick}.`);
    for (let nextTick = currentTick + 1; nextTick <= tick; nextTick += 1) {
      currentTick = nextTick;
      for (const current of [...records.values()].sort(byId)) {
        let record = current;
        if (record.status === "requested" && currentTick >= record.plan.dispatchTick) record = transition(record, "dispatched", currentTick);
        else if (record.status === "dispatched" && currentTick < record.plan.arrivalTick) record = transition(record, "en-route", currentTick);
        else if ((record.status === "dispatched" || record.status === "en-route") && currentTick >= record.plan.arrivalTick) { record = transition(record, "operating", currentTick); record = executeActions(record); }
        const mayStabilize = record.status === "operating" || record.status === "limited";
        if (mayStabilize && currentTick >= record.plan.arrivalTick + record.plan.estimatedDurationTicks - 1) record = stabilizeIncident(record);
        if (record.status === "stabilized" && currentTick >= record.plan.expectedCompleteTick) { const result = complete(record); if (!result.ok) return result; record = result.value; }
        if (record.status === "failed" && currentTick >= record.plan.expectedCompleteTick) { const result = complete(record); if (!result.ok) return result; record = result.value; }
        replaceRecord(record);
      }
    }
    return ok([...records.values()].sort(byId));
  };

  return { plan, activate, advanceToTick, project: () => freeze([...records.values()].sort(byId).map(clone)) };
}
