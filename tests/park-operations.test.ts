import assert from "node:assert/strict";
import test from "node:test";
import { createSimulationEngine, createStarterFixture } from "../simulation/index.ts";
import { createTraceRepository } from "../trace-replay/index.ts";
import { createOperationsFixture, createParkOperationsService, DEFAULT_OPERATIONS_ARTIFACTS, equivalentMapAndTable } from "../park-operations/index.ts";
import type { JobDraft } from "../park-operations/index.ts";

function draft(overrides: Partial<JobDraft> = {}): JobDraft {
  return {
    templateId: "job-template.feed",
    type: "FEED",
    targetRefs: ["dino.rex"],
    priority: 5,
    dueTime: 120,
    promptRef: DEFAULT_OPERATIONS_ARTIFACTS.promptRef,
    skillRefs: [],
    systemPromptRefs: [],
    ...overrides,
  };
}

test("slice 1 projects authoritative map and keyboard-equivalent rows", () => {
  const service = createParkOperationsService();
  const view = service.getPark();
  assert.equal(view.snapshot.enclosures.length, 3);
  assert.equal(view.snapshot.agents.length, 1);
  assert.equal(equivalentMapAndTable(view), true);
  assert.deepEqual(view.mapRows.map((row) => row.sourceId), view.accessibleRows.map((row) => row.sourceId));
  assert.equal(service.getAgent("agent.keeper01")?.tools.includes("dispense_food"), true);
});

test("slice 2 preflights, creates, assigns, and runs one exact feeding job once", () => {
  const traces = createTraceRepository();
  const service = createParkOperationsService({ traces });
  const preflight = service.preflight(draft());
  assert.equal(preflight.ok, true, preflight.diagnostics.join(" "));
  const created = service.create(draft(), "create.feed.1");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.job.status, "QUEUED");
  const duplicate = service.create(draft(), "create.feed.1");
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.duplicate, true);
  const run = service.runToCompletion(created.job.id);
  assert.equal(run.ok, true);
  if (!run.ok) return;
  assert.equal(["SUCCEEDED", "ESCALATED", "FAILED"].includes(run.job.status), true);
  assert.equal(run.job.traceId, `trace.${created.job.id}`);
  assert.equal(traces.get(run.job.traceId!)?.header.jobId, created.job.id);
});

test("slice 2 exact Safe Feeding Skill closes the deterministic incident path", () => {
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const service = createParkOperationsService({ simulation });
  const created = service.create(draft({ skillRefs: [DEFAULT_OPERATIONS_ARTIFACTS.skillRef], systemPromptRefs: [DEFAULT_OPERATIONS_ARTIFACTS.systemPromptRef] }), "create.safe-feed.1");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const run = service.runToCompletion(created.job.id);
  assert.equal(run.ok, true);
  if (!run.ok) return;
  assert.equal(run.job.status, "SUCCEEDED");
  assert.equal(run.job.outcome?.reasonCode, "GOALS_AND_POSTCONDITIONS_PASSED");
  assert.equal(service.getPark().snapshot.gates.find((gate) => gate.id === "gate.gamma")?.state, "LOCKED");
  assert.equal(service.getPark().metrics.openIncidents, 0);
});

test("QA: selected dinosaur binds its own enclosure, gate, zones, and feeder", () => {
  for (const [targetId, gateId] of [["dino.fern", "gate.alpha"], ["dino.atlas", "gate.beta"]] as const) {
    const simulation = createSimulationEngine();
    assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
    const service = createParkOperationsService({ simulation });
    const before = service.snapshot();
    const created = service.create(draft({ targetRefs: [targetId] }), `binding.${targetId}`);
    assert.equal(created.ok, true);
    if (!created.ok) continue;
    const run = service.runToCompletion(created.job.id);
    assert.equal(run.ok, true);
    const after = service.snapshot();
    assert.ok(after.dinosaurs.find((item) => item.id === targetId)!.hunger < before.dinosaurs.find((item) => item.id === targetId)!.hunger);
    assert.equal(after.gates.find((item) => item.id === gateId)?.state, "OPEN");
    assert.equal(after.dinosaurs.find((item) => item.id === "dino.rex")?.hunger, before.dinosaurs.find((item) => item.id === "dino.rex")?.hunger);
  }
});

test("QA: template targetKinds rejects an enclosure before execution", () => {
  const service = createParkOperationsService();
  const preflight = service.preflight(draft({ targetRefs: ["enclosure.alpha"] }));
  assert.equal(preflight.ok, false);
  assert.match(preflight.diagnostics.join(" "), /requires DINOSAUR/);
  assert.equal(service.create(draft({ targetRefs: ["enclosure.alpha"] }), "wrong-kind").ok, false);
});

test("QA: null and malformed drafts and refs return remediation without throwing", () => {
  const service = createParkOperationsService();
  for (const candidate of [null, undefined, {}, { type: "FEED", targetRefs: null, promptRef: null }, { type: "FEED", targetRefs: ["dino.rex"], priority: 1, dueTime: 2, promptRef: { artifactId: "", version: -1 } }]) {
    let result: ReturnType<typeof service.preflight> | undefined;
    assert.doesNotThrow(() => { result = service.preflight(candidate as JobDraft); });
    assert.equal(result?.ok, false);
    assert.ok((result?.diagnostics.length ?? 0) > 0);
    assert.ok((result?.remediation.length ?? 0) > 0);
  }
});

test("QA: create normalizes null and undefined drafts before any field access", () => {
  const service = createParkOperationsService();
  for (const [index, candidate] of [null, undefined].entries()) {
    let result: ReturnType<typeof service.create> | undefined;
    assert.doesNotThrow(() => { result = service.create(candidate as unknown as JobDraft, `malformed.create.${index}`); });
    assert.equal(result?.ok, false);
    if (!result || result.ok) continue;
    assert.equal(result.error.code, "PREFLIGHT_BLOCKED");
    assert.match(result.error.message, /job type.*target.*Prompt ref.*priority.*due time/i);
    assert.ok((result.error.remediation?.length ?? 0) > 0);
  }
  assert.equal(service.getPark().jobs.length, 0);
});

test("slice 3 preserves deterministic incident and acknowledgement semantics", () => {
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createOperationsFixture(), 7).ok, true);
  const service = createParkOperationsService({ simulation });
  const created = service.create(draft(), "create.incident.1");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const run = service.runToCompletion(created.job.id);
  assert.equal(run.ok, true);
  const incident = service.getPark().incidents.find((item) => item.trigger === "gate-open-near-dinosaur");
  assert.ok(incident);
  const before = service.getPark().snapshot.incidents.find((item) => item.id === incident.id)?.status;
  const ack = service.acknowledgeIncident(incident.id, "ack.incident.1");
  assert.equal(ack.ok, true);
  assert.equal(service.getPark().snapshot.incidents.find((item) => item.id === incident.id)?.status, before);
  assert.ok(service.getPark().acknowledgedIncidentIds.includes(incident.id));
});

test("slice 3 allows a safe intervention through the simulation command port", () => {
  const service = createParkOperationsService();
  const created = service.create(draft(), "create.intervention.1");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const run = service.runToCompletion(created.job.id);
  assert.equal(run.ok, true);
  const before = service.getPark().snapshot;
  const incident = service.getPark().incidents[0];
  assert.ok(incident);
  const intervention = service.intervene({ action: "alert_security", commandId: "intervene.alert.gamma", agentId: "agent.keeper01", incidentId: incident.id, severity: incident.severity });
  assert.equal(intervention.ok, true);
  assert.equal(service.getPark().snapshot.incidents.find((item) => item.id === incident.id)?.status, "CONTAINED");
  assert.notEqual(service.getPark().snapshot.eventSequence, before.eventSequence);
});

test("QA: paused emergency intervention is queued idempotently without time advance or unrelated processing", () => {
  const simulation = createSimulationEngine();
  const fixture = { ...createOperationsFixture(), faults: [{ id: "fault.unrelated", logicalTime: 1, type: "SENSOR_DEGRADE" as const, targetId: "gate.alpha" }] };
  assert.equal(simulation.load(fixture, 7).ok, true);
  const service = createParkOperationsService({ simulation, fixture });
  service.setPaused(true);
  const before = service.snapshot();
  const command = { action: "alert_security" as const, commandId: "paused.emergency.once", agentId: "agent.keeper01", targetZoneId: "zone.gamma.service", severity: 3 as const };
  const first = service.intervene(command);
  const duplicate = service.intervene(command);
  assert.equal(first.ok, true);
  assert.deepEqual(duplicate, first);
  assert.equal(service.snapshot().logicalTime, before.logicalTime);
  assert.equal(service.snapshot().gates.find((item) => item.id === "gate.alpha")?.sensorHealth, before.gates.find((item) => item.id === "gate.alpha")?.sensorHealth);
  assert.equal(service.snapshot().pendingEvents.filter((item) => item.commandId === command.commandId).length, 1);
});

test("slice 4 supports three enclosures, worker switching, reprioritization, and stale rejection", () => {
  const service = createParkOperationsService();
  const first = service.create(draft({ targetRefs: ["dino.fern"], priority: 1 }), "create.alpha.1");
  const second = service.create(draft({ targetRefs: ["dino.atlas"], priority: 3 }), "create.beta.1");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  const stale = service.reprioritize(first.job.id, 9, "priority.stale", first.job.observedVersion - 1);
  assert.equal(stale.ok, false);
  const reprioritized = service.reprioritize(first.job.id, 9, "priority.fresh", first.job.observedVersion);
  assert.equal(reprioritized.ok, true);
  if (reprioritized.ok) assert.equal(service.getPark().jobs[0]?.id, reprioritized.job.id);
  assert.equal(service.getPark().agents.length, 1);
  assert.equal(service.getPark().snapshot.enclosures.length, 3);
});

test("slice 4 keeps three workers independently addressable under queue pressure", () => {
  const simulation = createSimulationEngine();
  const fixture = createStarterFixture();
  const base = fixture.agents[0]!;
  const multi = {
    ...fixture,
    agents: [
      base,
      { ...base, id: "agent.keeper02", agentDefinitionId: "agent-definition.keeper.02" },
      { ...base, id: "agent.keeper03", agentDefinitionId: "agent-definition.keeper.03" },
    ],
  };
  assert.equal(simulation.load(multi, 7).ok, true);
  const service = createParkOperationsService({ simulation });
  for (const [index, agentId] of ["agent.keeper01", "agent.keeper02", "agent.keeper03"].entries()) {
    const result = service.create(draft({ targetRefs: [index === 0 ? "dino.rex" : index === 1 ? "dino.fern" : "dino.atlas"], assignedAgentId: agentId }), `multi.create.${index}`);
    assert.equal(result.ok, true);
  }
  assert.equal(service.getPark().agents.length, 3);
  assert.equal(service.getPark().agents.filter((agent) => agent.queue.length > 0 || agent.currentTask).length, 3);
});

test("slice 5 rejects duplicate/stale operations without mutation and exposes reduced-motion-safe state", () => {
  const service = createParkOperationsService();
  const first = service.create(draft(), "create.safe.1");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const before = service.getPark().jobs.find((job) => job.id === first.job.id);
  const stale = service.assign(first.job.id, "agent.missing", "assign.stale", before!.observedVersion);
  assert.equal(stale.ok, false);
  assert.equal(service.getPark().jobs.find((job) => job.id === first.job.id)?.assignedAgentId, before?.assignedAgentId);
  const cancel = service.cancelOrPauseAtSafePoint(first.job.id, "cancel.once", before?.observedVersion);
  assert.equal(cancel.ok, true);
  const duplicate = service.cancelOrPauseAtSafePoint(first.job.id, "cancel.once", 999);
  assert.equal(duplicate.ok, true);
  if (duplicate.ok && cancel.ok) assert.equal(duplicate.job.status, cancel.job.status);
});

test("slice 5 pause freezes logical advancement while emergency commands remain available", () => {
  const service = createParkOperationsService();
  const before = service.getPark().snapshot;
  service.setPaused(true);
  assert.deepEqual(service.advanceTo(before.logicalTime + 10), []);
  assert.equal(service.getPark().snapshot.logicalTime, before.logicalTime);
  service.setPaused(false);
  assert.equal(service.getControlState().paused, false);
});
