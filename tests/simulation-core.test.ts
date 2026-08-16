import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalSerialize,
  createSimulationEngine,
  createStarterFixture,
  type Gate,
  type RobotAgent,
  type WorldFixture,
  validateFixture,
} from "../simulation/index.ts";

function clonedFixture(overrides: Partial<WorldFixture> = {}): WorldFixture {
  return structuredClone({ ...createStarterFixture(), ...overrides });
}

function loadEngine(fixture: WorldFixture = createStarterFixture(), seed = 7) {
  const engine = createSimulationEngine();
  const loaded = engine.load(fixture, seed);
  assert.equal(loaded.ok, true);
  return engine;
}

function commandAndAdvance(engine: ReturnType<typeof createSimulationEngine>, command: Parameters<ReturnType<typeof createSimulationEngine>["command"]>[0]) {
  const result = engine.command(command);
  assert.equal(result.ok, true);
  if (result.ok) engine.advanceTo(engine.snapshot().logicalTime + 10);
  return result;
}

test("starter fixture is referentially valid and includes the required world content", () => {
  const engine = createSimulationEngine();
  const result = engine.load(createStarterFixture(), 1);
  assert.equal(result.ok, true);
  const snapshot = engine.snapshot();
  assert.equal(snapshot.enclosures.length, 3);
  assert.deepEqual(new Set(snapshot.dinosaurs.map((dino) => dino.archetype)), new Set(["DOCILE_HERBIVORE", "LARGE_HERBIVORE", "CARNIVORE"]));
  assert.equal(Object.isFrozen(snapshot), true);
  assert.throws(() => (snapshot.gates as Gate[]).push(snapshot.gates[0]));
});

test("fixture validation reports dangling references without replacing the loaded world", () => {
  const engine = loadEngine();
  const before = engine.canonicalSnapshot();
  const invalid = clonedFixture({ gates: [{ ...createStarterFixture().gates[0], enclosureId: "missing-enclosure" }] });
  const result = engine.load(invalid, 2);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.some((error) => error.code === "DANGLING_REFERENCE"));
  assert.equal(engine.canonicalSnapshot(), before);
});

test("safe gate/feed sequence is deterministic and exactly replayable", () => {
  const fixture = createStarterFixture();
  const run = () => {
    const engine = loadEngine(fixture, 1234);
    commandAndAdvance(engine, { action: "move_to", commandId: "move-gamma", agentId: "agent.keeper01", zoneId: "zone.gamma.service" });
    commandAndAdvance(engine, { action: "observe", commandId: "observe-rex", agentId: "agent.keeper01", targetId: "dino.rex" });
    commandAndAdvance(engine, { action: "bait_dinosaur", commandId: "bait-rex", agentId: "agent.keeper01", dinosaurId: "dino.rex", zoneId: "zone.gamma.service" });
    commandAndAdvance(engine, { action: "open_gate", commandId: "open-gamma", agentId: "agent.keeper01", gateId: "gate.gamma" });
    commandAndAdvance(engine, { action: "dispense_food", commandId: "feed-rex", agentId: "agent.keeper01", dinosaurId: "dino.rex" });
    commandAndAdvance(engine, { action: "close_gate", commandId: "close-gamma", agentId: "agent.keeper01", gateId: "gate.gamma" });
    commandAndAdvance(engine, { action: "lock_gate", commandId: "lock-gamma", agentId: "agent.keeper01", gateId: "gate.gamma" });
    return { events: engine.canonicalEvents(), snapshot: engine.canonicalSnapshot() };
  };
  assert.deepEqual(run(), run());
});

test("invalid commands preserve the authoritative snapshot and typed failures cover every code", () => {
  const immutable = loadEngine();
  const before = immutable.canonicalSnapshot();
  const invalid = immutable.command({ action: "open_gate", commandId: "bad-target", agentId: "agent.keeper01", gateId: "missing" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, "INVALID_TARGET");
  assert.equal(immutable.canonicalSnapshot(), before);

  const unauthorizedFixture = clonedFixture({ agents: [{ ...createStarterFixture().agents[0], tools: [] }] });
  const unauthorized = loadEngine(unauthorizedFixture).command({ action: "move_to", commandId: "not-authorized", agentId: "agent.keeper01", zoneId: "zone.alpha.service" });
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) assert.equal(unauthorized.code, "NOT_AUTHORIZED");

  const outOfRange = loadEngine().command({ action: "open_gate", commandId: "range", agentId: "agent.keeper01", gateId: "gate.alpha" });
  assert.equal(outOfRange.ok, false);
  if (!outOfRange.ok) assert.equal(outOfRange.code, "OUT_OF_RANGE");

  const prereq = loadEngine(clonedFixture({ agents: [{ ...createStarterFixture().agents[0], location: "zone.alpha.service" }] })).command({ action: "close_gate", commandId: "prereq", agentId: "agent.keeper01", gateId: "gate.alpha" });
  assert.equal(prereq.ok, false);
  if (!prereq.ok) assert.equal(prereq.code, "PREREQUISITE_FAILED");

  const busyEngine = loadEngine();
  assert.equal(busyEngine.command({ action: "move_to", commandId: "busy-first", agentId: "agent.keeper01", zoneId: "zone.gamma.service" }).ok, true);
  const busy = busyEngine.command({ action: "observe", commandId: "busy-second", agentId: "agent.keeper01", targetId: "dino.rex" });
  assert.equal(busy.ok, false);
  if (!busy.ok) assert.equal(busy.code, "TOOL_BUSY");

  const occupiedAgent: RobotAgent = { ...createStarterFixture().agents[0], id: "agent.keeper00", location: "zone.alpha.service" };
  const occupiedFixture = clonedFixture({ agents: [{ ...createStarterFixture().agents[0], location: "zone.outside" }, occupiedAgent] });
  const occupiedEngine = loadEngine(occupiedFixture);
  assert.equal(occupiedEngine.command({ action: "move_to", commandId: "occupied-first", agentId: "agent.keeper01", zoneId: "zone.alpha.service" }).ok, true);
  const occupied = occupiedEngine.advanceTo(10).find((event) => event.commandId === "occupied-first");
  assert.equal(occupied?.type, "TOOL_FAILED");
  assert.equal(occupied?.payload.code, "ZONE_OCCUPIED");

  const maintenance = loadEngine(clonedFixture({ agents: [{ ...createStarterFixture().agents[0], location: "zone.alpha.service" }], gates: [{ ...createStarterFixture().gates[0], maintenanceLock: true }, ...createStarterFixture().gates.slice(1)] })).command({ action: "open_gate", commandId: "maintenance", agentId: "agent.keeper01", gateId: "gate.alpha" });
  assert.equal(maintenance.ok, false);
  if (!maintenance.ok) assert.equal(maintenance.code, "MAINTENANCE_LOCKED");

  const jammed = loadEngine(clonedFixture({ agents: [{ ...createStarterFixture().agents[0], location: "zone.gamma.service" }], gates: [...createStarterFixture().gates.slice(0, 2), { ...createStarterFixture().gates[2], state: "JAMMED" }] })).command({ action: "open_gate", commandId: "jammed", agentId: "agent.keeper01", gateId: "gate.gamma" });
  assert.equal(jammed.ok, false);
  if (!jammed.ok) assert.equal(jammed.code, "JAMMED");

  const unavailable = loadEngine(clonedFixture({ agents: [{ ...createStarterFixture().agents[0], location: "zone.alpha.service" }], devices: createStarterFixture().devices.map((device) => device.type === "FEEDER" && device.enclosureId === "enclosure.alpha" ? { ...device, available: false } : device) })).command({ action: "dispense_food", commandId: "unavailable", agentId: "agent.keeper01", dinosaurId: "dino.fern" });
  assert.equal(unavailable.ok, false);
  if (!unavailable.ok) assert.equal(unavailable.code, "UNAVAILABLE");
});

test("same-time contention uses priority, agent id, and event id ordering", () => {
  const base = createStarterFixture();
  const second: RobotAgent = { ...base.agents[0], id: "agent.keeper00", location: "zone.alpha.service" };
  const fixture = clonedFixture({ agents: [{ ...base.agents[0], location: "zone.alpha.service" }, second] });
  const engine = loadEngine(fixture);
  assert.equal(engine.command({ action: "open_gate", commandId: "open-a", agentId: "agent.keeper01", gateId: "gate.alpha" }).ok, true);
  assert.equal(engine.command({ action: "open_gate", commandId: "open-b", agentId: "agent.keeper00", gateId: "gate.alpha" }).ok, true);
  const completions = engine.advanceTo(1).filter((event) => event.type === "TOOL_COMPLETED" || event.type === "TOOL_FAILED");
  assert.equal(completions[0]?.agentId, "agent.keeper00");
  assert.equal(completions[1]?.payload.code, "TOOL_BUSY");
  assert.equal(engine.snapshot().gates.find((gate) => gate.id === "gate.alpha")?.state, "OPEN");
});

test("seeded autonomy and restore preserve results across save boundaries and display cadence", () => {
  const fixture = { ...createStarterFixture(), enableAutonomy: true };
  const oneShot = loadEngine(fixture, 77);
  oneShot.advanceTo(20);
  const oneShotSnapshot = oneShot.canonicalSnapshot();

  const stepped = loadEngine(fixture, 77);
  for (let time = 1; time <= 20; time += 1) stepped.advanceTo(time);
  assert.equal(stepped.canonicalSnapshot(), oneShotSnapshot);

  const saved = loadEngine(fixture, 77);
  saved.advanceTo(8);
  const saveState = saved.snapshot();
  const restored = createSimulationEngine();
  assert.equal(restored.restore(saveState).ok, true);
  restored.advanceTo(20);
  assert.equal(restored.canonicalSnapshot(), oneShotSnapshot);

  const differentSeed = loadEngine(fixture, 78);
  differentSeed.advanceTo(20);
  assert.notEqual(differentSeed.canonicalSnapshot(), oneShotSnapshot);
});

test("save and restore preserve all resource reservations before and during same-time contention", () => {
  const base = createStarterFixture();
  const second: RobotAgent = { ...base.agents[0], id: "agent.keeper00", location: "zone.alpha.service" };
  const fixture = clonedFixture({ agents: [{ ...base.agents[0], location: "zone.alpha.service" }, second] });
  const createContended = () => {
    const engine = loadEngine(fixture, 91);
    assert.equal(engine.command({ action: "open_gate", commandId: "restore-open-a", agentId: "agent.keeper01", gateId: "gate.alpha" }).ok, true);
    assert.equal(engine.command({ action: "open_gate", commandId: "restore-open-b", agentId: "agent.keeper00", gateId: "gate.alpha" }).ok, true);
    return engine;
  };

  const original = createContended();
  const preDispatchSave = original.snapshot();
  assert.ok(preDispatchSave.pendingEvents.every((event) => event.resourceKeys.includes("gate:gate.alpha")));
  const restored = createSimulationEngine();
  assert.equal(restored.restore(preDispatchSave).ok, true);
  const originalEvents = original.advanceTo(1).filter((event) => event.type === "TOOL_COMPLETED" || event.type === "TOOL_FAILED");
  const restoredEvents = restored.advanceTo(1).filter((event) => event.type === "TOOL_COMPLETED" || event.type === "TOOL_FAILED");
  assert.equal(canonicalSerialize(restoredEvents), canonicalSerialize(originalEvents));
  assert.equal(restored.canonicalSnapshot(), original.canonicalSnapshot());

  const partiallyProcessed = createContended();
  assert.equal(partiallyProcessed.runNext()?.type, "TOOL_COMPLETED");
  const midContentionSave = partiallyProcessed.snapshot();
  assert.ok(midContentionSave.resourceReservations.some((reservation) => reservation.resourceKey === "gate:gate.alpha"));
  const midRestored = createSimulationEngine();
  assert.equal(midRestored.restore(midContentionSave).ok, true);
  const originalLoser = partiallyProcessed.runNext();
  const restoredLoser = midRestored.runNext();
  assert.equal(canonicalSerialize(restoredLoser), canonicalSerialize(originalLoser));
  assert.equal(restoredLoser?.payload.code, "TOOL_BUSY");
  assert.equal(midRestored.canonicalSnapshot(), partiallyProcessed.canonicalSnapshot());
});

test("fixture diagnostics cover every nested authored reference requested by the core contract", () => {
  const base = createStarterFixture();
  const invalid = clonedFixture({
    gates: base.gates.map((gate, index) => index === 0 ? { ...gate, transitionZoneOccupants: ["missing-occupant"] } : gate),
    dinosaurs: base.dinosaurs.map((dino, index) => index === 0 ? { ...dino, movementProfile: { ...dino.movementProfile, preferredZoneIds: ["missing-zone"] } } : dino),
    visitors: base.visitors.map((visitor, index) => index === 0 ? { ...visitor, destination: "missing-destination" } : visitor),
    jobs: [{ id: "job.invalid", type: "feeding", targetRefs: ["missing-target"], priority: 1, dueTime: 10, assignedAgentId: "agent.keeper01", status: "QUEUED" }],
  });
  const errors = validateFixture(invalid);
  const paths = new Set(errors.filter((error) => error.code === "DANGLING_REFERENCE").map((error) => error.path));
  assert.ok(paths.has("gates[0].transitionZoneOccupants[0]"));
  assert.ok(paths.has("dinosaurs[0].movementProfile.preferredZoneIds[0]"));
  assert.ok(paths.has("visitors[0].destination"));
  assert.ok(paths.has("jobs[0].targetRefs[0]"));
  assert.equal(loadEngine().load(invalid, 9).ok, false);
});

test("malformed fixtures return diagnostics and never throw", () => {
  const base = structuredClone(createStarterFixture()) as unknown as Record<string, unknown>;
  const malformedNested = structuredClone(base) as Record<string, unknown>;
  (malformedNested.enclosures as Array<Record<string, unknown>>)[0].gateIds = null;
  (malformedNested.dinosaurs as Array<Record<string, unknown>>)[0].movementProfile = null;
  malformedNested.gates = [null];
  malformedNested.jobs = [null];
  const cases: unknown[] = [null, undefined, [], {}, { id: "bad", zones: null }, malformedNested];
  for (const [index, fixture] of cases.entries()) {
    let errors: readonly unknown[] = [];
    assert.doesNotThrow(() => { errors = validateFixture(fixture); }, `validator threw for malformed case ${index}`);
    assert.ok(errors.length > 0, `malformed case ${index} returned no diagnostics`);
    const engine = createSimulationEngine();
    let result: ReturnType<typeof engine.load> | undefined;
    assert.doesNotThrow(() => { result = engine.load(fixture as WorldFixture, index); }, `load threw for malformed case ${index}`);
    assert.equal(result?.ok, false);
  }
});

test("evacuation and rescue resolve an authored safe zone instead of a hard-coded id", () => {
  const base = createStarterFixture();
  const customSafeFixture = clonedFixture({
    zones: base.zones.map((zone) => zone.id === "zone.safe" ? { ...zone, id: "zone.refuge" } : zone),
  });
  const engine = loadEngine(customSafeFixture);
  commandAndAdvance(engine, { action: "evacuate_visitors", commandId: "evacuate-custom-safe", agentId: "agent.keeper01", zoneId: "zone.outside" });
  assert.equal(engine.snapshot().visitors[0]?.location, "zone.refuge");
  commandAndAdvance(engine, { action: "rescue_visitors", commandId: "rescue-custom-safe", agentId: "agent.keeper01", visitorGroupId: "visitors.group01" });
  assert.equal(engine.snapshot().visitors[0]?.destination, "zone.refuge");
  assert.equal(engine.snapshot().zones.some((zone) => zone.id === "zone.safe"), false);

  const missingSafeFixture = clonedFixture({ zones: base.zones.filter((zone) => zone.kind !== "SAFE") });
  const missingSafe = createSimulationEngine().load(missingSafeFixture, 1);
  assert.equal(missingSafe.ok, false);
  if (!missingSafe.ok) assert.ok(missingSafe.error.some((error) => error.path === "zones" && error.code === "INVALID_VALUE"));
});

test("scheduled faults are deterministic and permanently jammed gates never recover by retry", () => {
  const fixture = clonedFixture({
    agents: [{ ...createStarterFixture().agents[0], location: "zone.alpha.service" }],
    faults: [{ id: "fault.jam", logicalTime: 1, type: "GATE_JAM", targetId: "gate.alpha" }],
  });
  const engine = loadEngine(fixture, 10);
  engine.advanceTo(1);
  assert.equal(engine.snapshot().gates.find((gate) => gate.id === "gate.alpha")?.state, "JAMMED");
  const attempt = engine.command({ action: "open_gate", commandId: "retry-jammed", agentId: "agent.keeper01", gateId: "gate.alpha" });
  assert.equal(attempt.ok, false);
  if (!attempt.ok) assert.equal(attempt.code, "JAMMED");
});

test("radio, evacuation, and rescue tools produce inspectable non-graphic recovery state", () => {
  const engine = loadEngine();
  commandAndAdvance(engine, { action: "alert_security", commandId: "alert-visitors", agentId: "agent.keeper01", targetZoneId: "zone.outside", severity: 3 });
  commandAndAdvance(engine, { action: "evacuate_visitors", commandId: "evacuate-visitors", agentId: "agent.keeper01", zoneId: "zone.outside" });
  commandAndAdvance(engine, { action: "rescue_visitors", commandId: "rescue-visitors", agentId: "agent.keeper01", visitorGroupId: "visitors.group01" });
  const visitor = engine.snapshot().visitors.find((item) => item.id === "visitors.group01");
  assert.equal(visitor?.safetyState, "SAFE_ZONE");
  assert.equal(visitor?.panic, 0);
  assert.ok(engine.snapshot().incidents.some((incident) => incident.trigger === "security-alert"));
});

test("10,000 simple queued events pass the documented performance gate", () => {
  const engine = loadEngine();
  const start = performance.now();
  for (let index = 0; index < 10_000; index += 1) {
    const result = engine.command({ action: "observe", commandId: `observe-${index}`, agentId: "agent.keeper01", targetId: "dino.rex" });
    assert.equal(result.ok, true);
    engine.runNext();
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1000, `10,000 events took ${elapsed.toFixed(1)}ms`);
  assert.equal(engine.events().filter((event) => event.type === "OBSERVATION").length, 10_000);
});
