import assert from "node:assert/strict";
import test from "node:test";

import { createIncidentResponse, createIncidentResponseFoundationFixture } from "../../src/incident-response/public.js";
import type { StableId } from "../../src/simulation/public.js";

const id = (value: string): StableId => value as StableId;

test("eligibility and the plan derive from exact grouped incident/world state with an exact Economy quote", () => {
  const fixture = createIncidentResponseFoundationFixture(); const service = createIncidentResponse(fixture.options);
  const result = service.plan(fixture.incident.id); assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.locationId, id("location:path"));
  assert.deepEqual(result.value.selectedCapabilities, ["visitor-evacuation", "temporary-containment", "stranded-robot-recovery"]);
  assert.equal(result.value.arrivalTick, 13); assert.equal(result.value.estimatedDurationTicks, 2); assert.equal(result.value.expectedCompleteTick, 15);
  assert.equal(result.value.quote.amount, 180); assert.equal(result.value.quote.category, "response");
  assert.match(result.value.closures[0] ?? "", /location:path/); assert.equal(result.value.limitations.length, 0);
  const missing = service.plan(id("incident:missing")); assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.diagnostics[0]?.code, "RESPONSE_INELIGIBLE");
});

test("manual activation is explicit and idempotent and reserves then settles through Economy", () => {
  const fixture = createIncidentResponseFoundationFixture(); const service = createIncidentResponse(fixture.options);
  const planned = service.plan(fixture.incident.id); assert.equal(planned.ok, true); if (!planned.ok) return;
  assert.equal(fixture.options.ports.economy.project().reservedBalance, 0);
  const stale = service.activate(planned.value.id, 9); assert.equal(stale.ok, false); assert.equal(fixture.options.ports.economy.project().reservedBalance, 0);
  const first = service.activate(planned.value.id, 10); assert.equal(first.ok, true); if (!first.ok) return;
  assert.equal(first.value.status, "requested"); assert.equal(fixture.options.ports.economy.project().reservedBalance, 180);
  const duplicate = service.activate(planned.value.id, 10); assert.equal(duplicate.ok, true); if (!duplicate.ok) return;
  assert.equal(duplicate.idempotent, true); assert.equal(duplicate.value.id, first.value.id); assert.equal(fixture.options.ports.economy.project().reservations.length, 1);
  const advanced = service.advanceToTick(15); assert.equal(advanced.ok, true);
  assert.equal(fixture.options.ports.economy.project().reservedBalance, 0); assert.equal(fixture.options.ports.economy.project().balance, 820);
  assert.equal(fixture.options.ports.economy.project().transactions[0]?.category, "response");
});

test("deterministic lifecycle performs only authoritative Simulation commands and leaves the cause unresolved", () => {
  const fixture = createIncidentResponseFoundationFixture(); const service = createIncidentResponse(fixture.options);
  const plan = service.plan(fixture.incident.id); assert.equal(plan.ok, true); if (!plan.ok) return;
  assert.equal(service.activate(plan.value.id, 10).ok, true); const advanced = service.advanceToTick(15); assert.equal(advanced.ok, true); if (!advanced.ok) return;
  const record = advanced.value[0]!;
  assert.deepEqual(record.transitions.map((entry) => `${entry.status}@${entry.tick}`), ["requested@10", "dispatched@11", "en-route@12", "operating@13", "stabilized@14", "complete@15"]);
  assert.deepEqual(record.actionEvidence.map((entry) => [entry.capability, entry.accepted]), [["visitor-evacuation", true], ["temporary-containment", true], ["stranded-robot-recovery", true]]);
  const world = fixture.options.ports.simulation.snapshot();
  assert.equal(world.visitors[0]?.locationId, id("location:safe")); assert.equal(world.visitors[0]?.safety, "safe");
  assert.equal(world.gates[0]?.position, "closed"); assert.equal(world.robots.find((robot) => robot.id === id("robot:alpha"))?.locationId, id("location:service"));
  assert.equal(fixture.options.ports.parkOperations.snapshot().incidents[0]?.status, "engineering-unresolved");
  assert.equal(record.engineeringUnresolved, true); assert.deepEqual(record.engineeringBoundaryAfter, record.engineeringBoundaryBefore);
  assert.deepEqual(record.traceLinks, [id("trace:strict-stop")]); assert.equal(record.outcome?.downtimeTicks, 5); assert.equal(record.outcome?.cost, 180); assert.equal(record.outcome?.ratingEffect, -8);
});

test("capability capacity and physical limits are explicit and partial command rejection enters limited state", () => {
  const fixture = createIncidentResponseFoundationFixture();
  const limitedOptions = { ...fixture.options, rules: { ...fixture.options.rules, maxEvacuationGroupSize: 5 } };
  const service = createIncidentResponse(limitedOptions); const plan = service.plan(fixture.incident.id); assert.equal(plan.ok, true); if (!plan.ok) return;
  assert.equal(plan.value.capabilities.find((entry) => entry.capability === "visitor-evacuation")?.available, false);
  assert.match(plan.value.limitations[0] ?? "", /exceeds response capacity/);
  const routeChanged = fixture.options.ports.simulation.execute({ id: id("command:external-move"), kind: "move", expectedTick: 10, actorId: id("robot:alpha"), destinationId: id("location:service") });
  assert.equal(routeChanged.accepted, true);
  service.activate(plan.value.id, 10); const operating = service.advanceToTick(13); assert.equal(operating.ok, true); if (!operating.ok) return;
  const record = operating.value[0]!; assert.equal(record.status, "limited");
  assert.equal(record.actionEvidence.find((entry) => entry.capability === "temporary-containment")?.accepted, true);
  assert.equal(record.actionEvidence.find((entry) => entry.capability === "stranded-robot-recovery")?.accepted, false);
});

test("the public dependency boundary exposes no Context, artifact, route, Retention Policy, review, or deployment mutation port", () => {
  const fixture = createIncidentResponseFoundationFixture(); const boundaryBefore = structuredClone(fixture.options.engineeringBoundary);
  assert.deepEqual(Object.keys(fixture.options.ports).sort(), ["economy", "parkOperations", "simulation"]);
  const service = createIncidentResponse(fixture.options); const plan = service.plan(fixture.incident.id); assert.equal(plan.ok, true); if (!plan.ok) return;
  service.activate(plan.value.id, 10); service.advanceToTick(15);
  assert.deepEqual(fixture.options.engineeringBoundary, boundaryBefore);
  assert.deepEqual(service.project()[0]?.engineeringBoundaryAfter, boundaryBefore);
});
