import assert from "node:assert/strict";
import test from "node:test";

import { createParkOperations, createParkOperationsFoundationFixture, type ParkOperationsCommand, type ParkOperationsState } from "../../src/park-operations/public.js";
import type { StableId } from "../../src/simulation/public.js";

const id = (value: string): StableId => value as StableId;
const setup = () => { const fixture = createParkOperationsFoundationFixture(); return { fixture, service: createParkOperations(fixture.state, { resolver: fixture.resolver, knownAgentIds: fixture.knownAgentIds }) }; };
const execute = (service: ReturnType<typeof setup>["service"], command: ParkOperationsCommand) => service.execute(command);

test("due schedules create one exact pinned occurrence and remain idempotent", () => {
  const { service } = setup();
  const first = service.advanceToTick(0); const again = service.advanceToTick(0);
  assert.equal(first.accepted, true); assert.equal(first.createdJobIds.length, 1); assert.equal(again.createdJobIds.length, 0);
  const state = service.snapshot(); assert.equal(state.jobs.length, 1); assert.equal(state.occurrences.length, 1);
  assert.deepEqual(state.jobs[0]?.exactDeployedVersions.map((pin) => `${pin.reference.id}@${pin.reference.version}`), ["park:containment-policy@1.0.0", "park:safe-feeding@1.0.0", "task:feed-triceratops@1.0.0"]);
  assert.equal(Object.isFrozen(service.project()), true); assert.equal(Object.isFrozen(service.project().jobs), true);
});

test("queue order uses priority, due tick, then stable ID without insertion-order dependence", () => {
  const fixture = createParkOperationsFoundationFixture();
  const lower: ParkOperationsState = { ...fixture.state, schedules: [
    { ...fixture.state.schedules[0]!, id: id("schedule:zeta"), priority: 5 },
    { ...fixture.state.schedules[0]!, id: id("schedule:alpha"), priority: 10 },
    { ...fixture.state.schedules[0]!, id: id("schedule:beta"), priority: 10 },
  ] };
  const service = createParkOperations(lower, { resolver: fixture.resolver, knownAgentIds: fixture.knownAgentIds }); service.advanceToTick(0);
  assert.deepEqual(service.snapshot().jobs.map((job) => job.scheduleId), [id("schedule:alpha"), id("schedule:beta"), id("schedule:zeta")]);
});

test("job transitions validate atomically and preserve pins across assignment and execution", () => {
  const { service } = setup(); service.advanceToTick(0); const job = service.snapshot().jobs[0]!; const beforePins = structuredClone(job.exactDeployedVersions);
  const unavailable = execute(service, { id: id("command:no-agent"), kind: "assign-job", expectedTick: 0, jobId: job.id, agentId: id("robot:nope") });
  assert.equal(unavailable.accepted, false); assert.equal(service.snapshot().jobs[0]?.status, "queued");
  assert.equal(execute(service, { id: id("command:start-too-soon"), kind: "start-job", expectedTick: 0, jobId: job.id }).accepted, false);
  assert.equal(execute(service, { id: id("command:assign"), kind: "assign-job", expectedTick: 0, jobId: job.id, agentId: id("robot:alpha") }).accepted, true);
  assert.equal(execute(service, { id: id("command:start"), kind: "start-job", expectedTick: 0, jobId: job.id }).accepted, true);
  assert.equal(execute(service, { id: id("command:pause"), kind: "pause-job", expectedTick: 0, jobId: job.id }).accepted, true);
  assert.equal(execute(service, { id: id("command:resume"), kind: "resume-job", expectedTick: 0, jobId: job.id }).accepted, true);
  assert.equal(execute(service, { id: id("command:complete"), kind: "complete-job", expectedTick: 0, jobId: job.id, resultLink: id("trace:feeding") }).accepted, true);
  assert.equal(service.snapshot().jobs[0]?.status, "completed"); assert.deepEqual(service.snapshot().jobs[0]?.exactDeployedVersions, beforePins); assert.deepEqual(service.snapshot().jobs[0]?.resultLinks, [id("trace:feeding")]);
  assert.equal(execute(service, { id: id("command:restart"), kind: "start-job", expectedTick: 0, jobId: job.id }).accepted, false);
});

test("all terminal job commands and stale or malformed commands fail or transition explicitly", () => {
  for (const kind of ["cancel-job", "stop-job", "escalate-job"] as const) {
    const { service } = setup(); service.advanceToTick(0); const job = service.snapshot().jobs[0]!;
    if (kind !== "cancel-job") execute(service, { id: id("command:assign"), kind: "assign-job", expectedTick: 0, jobId: job.id, agentId: id("robot:alpha") });
    const result = execute(service, { id: id(`command:${kind}`), kind, expectedTick: 0, jobId: job.id }); assert.equal(result.accepted, true);
  }
  const { service } = setup(); service.advanceToTick(1); const before = service.snapshot();
  assert.equal(service.execute({ id: "bad" }).accepted, false); assert.equal(execute(service, { id: id("command:stale"), kind: "transition-phase", expectedTick: 0, phase: "open" }).accepted, false); assert.deepEqual(service.snapshot(), before);
});

test("phase state machine is sequential, opening blocks on unfinished required work, and next day is exact", () => {
  const { service } = setup(); service.advanceToTick(0); const job = service.snapshot().jobs[0]!;
  assert.equal(execute(service, { id: id("command:open-early"), kind: "transition-phase", expectedTick: 0, phase: "open" }).accepted, false);
  execute(service, { id: id("command:assign"), kind: "assign-job", expectedTick: 0, jobId: job.id, agentId: id("robot:alpha") }); execute(service, { id: id("command:start"), kind: "start-job", expectedTick: 0, jobId: job.id }); execute(service, { id: id("command:finish"), kind: "complete-job", expectedTick: 0, jobId: job.id });
  assert.equal(execute(service, { id: id("command:open"), kind: "transition-phase", expectedTick: 0, phase: "open" }).accepted, true);
  assert.equal(execute(service, { id: id("command:skip"), kind: "transition-phase", expectedTick: 0, phase: "engineering" }).accepted, false);
  assert.equal(execute(service, { id: id("command:close"), kind: "transition-phase", expectedTick: 0, phase: "closing" }).accepted, true);
  assert.equal(execute(service, { id: id("command:engineer"), kind: "transition-phase", expectedTick: 0, phase: "engineering" }).accepted, true);
  assert.equal(execute(service, { id: id("command:next-day"), kind: "transition-phase", expectedTick: 0, phase: "pre-opening" }).accepted, true); assert.equal(service.snapshot().day, 2);
  assert.equal(service.advanceToTick(0).createdJobIds.length, 1); assert.equal(service.snapshot().occurrences.length, 2);
});

test("unresolved exact content rejects manual job creation without partial mutation", () => {
  const { service } = setup(); const before = service.snapshot();
  const result = execute(service, { id: id("command:create"), kind: "create-job", expectedTick: 0, job: { id: id("job:manual"), task: { id: "task:missing", version: "1.0.0" }, targetId: id("dinosaur:tria"), priority: 1, source: "player", createdTick: 0, dueTick: 0, requiredForOpening: false }, artifactVersions: [{ id: "park:safe-feeding", version: "1.0.0" }] });
  assert.equal(result.accepted, false); if (!result.accepted) assert.equal(result.diagnostics[0]?.code, "OPS_CONTENT_UNRESOLVED"); assert.deepEqual(service.snapshot(), before);
});

test("an unresolved scheduled version blocks visibly without advancing or partially creating jobs", () => {
  const fixture = createParkOperationsFoundationFixture();
  const state: ParkOperationsState = { ...fixture.state, schedules: [{ ...fixture.state.schedules[0]!, artifactVersions: [{ id: "park:missing", version: "1.0.0" }] }] };
  const service = createParkOperations(state, { resolver: fixture.resolver, knownAgentIds: fixture.knownAgentIds }); const before = service.snapshot(); const result = service.advanceToTick(0);
  assert.equal(result.accepted, false); if (!result.accepted) assert.equal(result.diagnostics[0]?.code, "OPS_CONTENT_UNRESOLVED"); assert.deepEqual(service.snapshot(), before);
});

test("time, opening, visitor, closing, and summary commands enforce park-day permissions", () => {
  const fixture = createParkOperationsFoundationFixture();
  const timeCalls: string[] = [], visitorCalls: string[] = [];
  const service = createParkOperations(fixture.state, { resolver: fixture.resolver, knownAgentIds: fixture.knownAgentIds, ports: { time: { setPaused: (value) => timeCalls.push(`paused:${value}`), setSpeed: (value) => timeCalls.push(`speed:${value}`) }, visitors: { admit: (count) => { visitorCalls.push(`admit:${count}`); return true; }, depart: (count) => { visitorCalls.push(`depart:${count}`); return true; } } } });
  service.advanceToTick(0); const job = service.snapshot().jobs[0]!;
  execute(service, { id: id("command:assign"), kind: "assign-job", expectedTick: 0, jobId: job.id, agentId: id("robot:alpha") });
  execute(service, { id: id("command:start"), kind: "start-job", expectedTick: 0, jobId: job.id });
  execute(service, { id: id("command:finish"), kind: "complete-job", expectedTick: 0, jobId: job.id });
  assert.equal(execute(service, { id: id("command:admit-early"), kind: "admit-visitors", expectedTick: 0, count: 3 }).accepted, false);
  assert.equal(execute(service, { id: id("command:open"), kind: "open-park", expectedTick: 0 }).accepted, true);
  execute(service, { id: id("command:clock"), kind: "set-time-control", expectedTick: 0, paused: false, speed: 2 });
  execute(service, { id: id("command:admit"), kind: "admit-visitors", expectedTick: 0, count: 3 });
  assert.equal(execute(service, { id: id("command:engineering-early"), kind: "enter-engineering", expectedTick: 0 }).accepted, false);
  execute(service, { id: id("command:closing"), kind: "begin-closing", expectedTick: 0 });
  execute(service, { id: id("command:depart"), kind: "depart-visitors", expectedTick: 0, count: 3 });
  execute(service, { id: id("command:engineering"), kind: "enter-engineering", expectedTick: 0 });
  const state = service.snapshot();
  assert.deepEqual(timeCalls, ["paused:false", "speed:2"]); assert.deepEqual(visitorCalls, ["admit:3", "depart:3"]);
  assert.equal(state.daySummaries[0]?.attendance, 3); assert.equal(state.daySummaries[0]?.departedVisitors, 3); assert.deepEqual(state.daySummaries[0]?.completedJobIds, [job.id]);
});

test("ambient stays quiet while warnings queue and correlated emergency evidence forms one pausing incident", () => {
  const fixture = createParkOperationsFoundationFixture(); const paused: boolean[] = [];
  const service = createParkOperations(fixture.state, { resolver: fixture.resolver, knownAgentIds: fixture.knownAgentIds, ports: { time: { setPaused: (value) => paused.push(value), setSpeed: () => undefined } } });
  const base = { tick: 0, source: "world" as const, causalKey: "gate-latch", spatialKey: "north-paddock", locationId: id("location:north-paddock"), expected: "Gate remains latched.", observed: "Latch sensor disagrees.", consequence: "Containment confidence is reduced.", immediateGap: "Inspect gate latch.", entityIds: [id("gate:north")], traceIds: [id("trace:gate")] };
  const ambient = service.ingestSignal({ ...base, id: id("signal:wind"), classification: "ambient", risk: 5 });
  const warning = service.ingestSignal({ ...base, id: id("signal:latch-warning"), classification: "warning", risk: 45 });
  const emergency = service.ingestSignal({ ...base, id: id("signal:containment"), classification: "emergency", risk: 95, observed: "Gate opened while visitors are nearby." });
  assert.equal(ambient.accepted && ambient.alertId, undefined); assert.equal(warning.accepted && warning.pauseRequested, false); assert.equal(emergency.accepted && emergency.pauseRequested, true);
  const state = service.snapshot(); assert.equal(state.signals.length, 3); assert.equal(state.alerts.length, 2); assert.equal(state.alerts[0]?.severity, "emergency"); assert.equal(state.incidents.length, 1); assert.equal(state.incidents[0]?.alertIds.length, 2); assert.equal(state.incidents[0]?.observed.length, 2); assert.deepEqual(paused, [true]);
});

test("incident lifecycle separates stabilization from engineering repair and rejects skipped transitions", () => {
  const { service } = setup();
  const result = service.ingestSignal({ id: id("signal:incident"), tick: 0, classification: "warning", source: "system", causalKey: "power", spatialKey: "hub", locationId: id("location:hub"), risk: 70, expected: "Power remains stable.", observed: "Voltage sagged.", consequence: "Automation may stop.", immediateGap: "Restore redundant supply.", entityIds: [id("system:power")], traceIds: [id("trace:power")] });
  assert.equal(result.accepted, true); if (!result.accepted || !result.incidentId) return;
  const incidentId = result.incidentId;
  assert.equal(execute(service, { id: id("command:skip-resolution"), kind: "resolve-incident", expectedTick: 0, incidentId }).accepted, false);
  for (const [kind, status] of [["activate-incident", "active"], ["stabilize-incident", "stabilized"], ["mark-engineering-unresolved", "engineering-unresolved"], ["resolve-incident", "resolved"], ["close-incident", "closed"]] as const) {
    assert.equal(execute(service, { id: id(`command:${kind}`), kind, expectedTick: 0, incidentId }).accepted, true); assert.equal(service.snapshot().incidents[0]?.status, status);
  }
  assert.equal(service.snapshot().incidents[0]?.stabilizedTick, 0); assert.equal(service.snapshot().incidents[0]?.resolvedTick, 0);
});

test("Strict context faults are detected by the park monitor without Agent execution context", () => {
  const { service } = setup();
  const result = service.reportContextFault({ id: "fault:capacity", agentId: "alpha", jobId: "feeding", decisionTick: 0, code: "CONTEXT_CAPACITY_STRICT_STOP", excess: 12 });
  assert.equal(result.accepted, true); assert.equal(result.accepted && result.classification, "emergency"); assert.equal(service.snapshot().paused, true); assert.equal(service.snapshot().signals[0]?.source, "context"); assert.equal(service.snapshot().incidents[0]?.immediateGap[0], "Context capacity or Retention Policy must be repaired.");
});
