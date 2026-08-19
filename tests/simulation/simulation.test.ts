import assert from "node:assert/strict";
import test from "node:test";
import { consumeRandom, createRandomStreams, createSimulation, createSimulationFoundationFixture, loadScenarioFixture, replaySimulation, validateScenarioFixture, type ScenarioFixture, type StableId, type WorldCommand } from "../../src/simulation/public.js";
import { simulationGoldens } from "../fixtures/simulation/goldens.js";

const id = (value: string): StableId => value as StableId;
const ref = (value: string) => ({ id: value, version: "1.0.0" });
const command = <T extends WorldCommand>(value: T): T => value;
const parkFixture = createSimulationFoundationFixture;

test("loads a structured-clone-compatible exact fixture with stable state order and immutable projections", () => {
  const fixture = parkFixture(); const result = validateScenarioFixture(structuredClone(fixture)); assert.equal(result.ok, true);
  const engine = createSimulation(fixture); const projection = engine.project();
  assert.deepEqual(structuredClone(engine.snapshot()), engine.snapshot()); assert.equal(Object.isFrozen(projection), true); assert.equal(Object.isFrozen(projection.robots), true);
  assert.throws(() => { (projection.robots[0] as { battery: number }).battery = 0; }, TypeError); assert.equal(engine.snapshot().robots[0]?.battery, 100);
  const invalid = structuredClone(fixture); (invalid.initialState.locations as { id: StableId }[]).reverse(); assert.equal(validateScenarioFixture(invalid).ok, false);
});

test("pause and requested speed alter tick requests but never logical tick semantics", () => {
  const normal = createSimulation(parkFixture()); const fast = createSimulation(parkFixture()); fast.setSpeed(4); assert.equal(fast.requestedTicksPerFrame(), 4);
  normal.requestTicks(8); fast.requestTicks(8); assert.deepEqual(fast.snapshot(), { ...normal.snapshot(), speed: 4 });
  const unevenFrames = createSimulation(parkFixture()); for (const requested of [1, 3, 1, 2, 1]) unevenFrames.requestTicks(requested); assert.deepEqual(unevenFrames.snapshot(), normal.snapshot());
  fast.setPaused(true); const before = fast.snapshot(); assert.equal(fast.requestedTicksPerFrame(), 0); assert.deepEqual(fast.requestTicks(20), { resultingTick: 8, deltas: [], events: [] }); assert.deepEqual(fast.snapshot(), before);
});

test("movement is graph-bound and stale, invalid, unauthorized, and impossible commands reject atomically", () => {
  const engine = createSimulation(parkFixture()); const before = engine.snapshot();
  const blocked = engine.execute(command({ id: id("command:blocked"), kind: "move", expectedTick: 0, actorId: id("robot:alpha"), destinationId: id("location:enclosure") })); assert.equal(blocked.accepted, false); assert.deepEqual(engine.snapshot(), before);
  const stale = engine.execute(command({ id: id("command:stale"), kind: "move", expectedTick: 1, actorId: id("robot:alpha"), destinationId: id("location:safe") })); assert.equal(stale.accepted, false); if (!stale.accepted) assert.equal(stale.diagnostics[0]?.code, "SIM_COMMAND_STALE");
  const malformed = engine.execute({ id: "bad", kind: "move" }); assert.equal(malformed.accepted, false);
  const unknown = engine.execute(command({ id: id("command:unknown"), kind: "move", expectedTick: 0, actorId: id("robot:nope"), destinationId: id("location:safe") })); assert.equal(unknown.accepted, false);
  const moved = engine.execute(command({ id: id("command:move"), kind: "move", expectedTick: 0, actorId: id("robot:alpha"), destinationId: id("location:safe") })); assert.equal(moved.accepted, true); const movedState = engine.snapshot(); assert.deepEqual({ locationId: movedState.robots[0]?.locationId, battery: movedState.robots[0]?.battery, eventSequence: movedState.eventSequence }, simulationGoldens.movement);
});

test("gate physics, degraded sensor evidence, jams, closers, and atomic batches remain explicit", () => {
  const fixture = parkFixture(); const degraded: ScenarioFixture = { ...fixture, initialState: { ...fixture.initialState, gates: [{ ...fixture.initialState.gates[0]!, position: "open", sensorReading: "closed", sensorHealth: "degraded", closer: "disabled" }] } };
  const engine = createSimulation(degraded); const observed = engine.execute(command({ id: id("command:observe"), kind: "observe-gate", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha"), tool: ref("tool:gate-observe") })); assert.equal(observed.accepted, true); if (observed.accepted) assert.deepEqual(observed.evidence.map((entry) => [entry.source, entry.value, entry.reliability]), [["gate-sensor", "closed", "degraded"], ["physical-gate", "open", "direct"]]);
  const jammed: ScenarioFixture = { ...fixture, initialState: { ...fixture.initialState, gates: [{ ...fixture.initialState.gates[0]!, position: "open", jammed: true }] } }; const jamEngine = createSimulation(jammed); const before = jamEngine.snapshot(); const result = jamEngine.execute(command({ id: id("command:close"), kind: "operate-gate", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha"), operation: "close", tool: ref("tool:gate-control") })); assert.equal(result.accepted, false); assert.deepEqual(jamEngine.snapshot(), before);
  const batch = engine.executeBatch([command({ id: id("command:reserve"), kind: "reserve", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha") }), command({ id: id("command:bad-release"), kind: "release", expectedTick: 0, actorId: id("robot:beta"), gateId: id("gate:alpha") })]); assert.equal(batch.every((entry) => !entry.accepted), true); assert.equal(engine.snapshot().gates[0]?.reservedBy, undefined);
  const normal = createSimulation(parkFixture()); normal.execute(command({ id: id("command:golden-open"), kind: "operate-gate", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha"), operation: "open", tool: ref("tool:gate-control") })); const state = normal.snapshot(); assert.deepEqual({ position: state.gates[0]?.position, sensorReading: state.gates[0]?.sensorReading, battery: state.robots[0]?.battery, eventSequence: state.eventSequence }, simulationGoldens.gate);
  const unauthorizedFixture = parkFixture(); const unauthorized = createSimulation({ ...unauthorizedFixture, initialState: { ...unauthorizedFixture.initialState, robots: unauthorizedFixture.initialState.robots.map((robot) => robot.id === "robot:alpha" ? { ...robot, accessZones: [] } : robot) } }); const noAccess = unauthorized.execute(command({ id: id("command:no-zone"), kind: "reserve", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha") })); assert.equal(noAccess.accepted, false); if (!noAccess.accepted) assert.equal(noAccess.diagnostics[0]?.code, "SIM_COMMAND_UNAUTHORIZED");
});

test("scheduler applies due transitions while a disabled closer leaves physical state unchanged", () => {
  const fixture = parkFixture(); const scheduled: ScenarioFixture = { ...fixture, initialState: { ...fixture.initialState, gates: [{ ...fixture.initialState.gates[0]!, position: "open", sensorReading: "open" }], scheduled: [{ id: id("schedule:auto-close"), tick: 2, priority: 10, kind: "gate-auto-close", entityId: id("gate:alpha") }] } }; const engine = createSimulation(scheduled); assert.equal(engine.requestTicks(1).events.length, 0); assert.equal(engine.requestTicks(1).events[0]?.kind, "gate-auto-closed"); assert.equal(engine.snapshot().gates[0]?.position, "closed");
  const disabled: ScenarioFixture = { ...scheduled, initialState: { ...scheduled.initialState, gates: [{ ...scheduled.initialState.gates[0]!, closer: "disabled" }] } }; const disabledEngine = createSimulation(disabled); assert.equal(disabledEngine.requestTicks(2).events.length, 0); assert.equal(disabledEngine.snapshot().gates[0]?.position, "open");
  const arrivals = parkFixture(); const arrivalEngine = createSimulation({ ...arrivals, initialState: { ...arrivals.initialState, visitors: [{ ...arrivals.initialState.visitors[0]!, movingTo: id("location:safe") }], scheduled: [{ id: id("schedule:visitor-arrival"), tick: 1, priority: 5, kind: "visitor-arrival", entityId: id("visitor:morning") }] } }); const arrival = arrivalEngine.requestTicks(1); assert.equal(arrivalEngine.snapshot().visitors[0]?.locationId, "location:safe"); assert.equal(arrival.events[0]?.kind, "visitors-arrived");
});

test("reservations produce a stable contention winner and release restores access", () => {
  const engine = createSimulation(parkFixture()); const first = engine.execute(command({ id: id("command:a"), kind: "reserve", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha") })); const second = engine.execute(command({ id: id("command:b"), kind: "reserve", expectedTick: 0, actorId: id("robot:beta"), gateId: id("gate:alpha") })); assert.equal(first.accepted, true); assert.equal(second.accepted, false); if (!second.accepted) assert.equal(second.diagnostics[0]?.code, "SIM_RESOURCE_RESERVED"); assert.equal(engine.execute(command({ id: id("command:release"), kind: "release", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha") })).accepted, true); assert.equal(engine.snapshot().gates[0]?.reservedBy, undefined);
  const contender = createSimulation(parkFixture()); contender.execute(command({ id: id("command:golden-reserve"), kind: "reserve", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha") })); const lost = contender.execute(command({ id: id("command:golden-lose"), kind: "reserve", expectedTick: 0, actorId: id("robot:beta"), gateId: id("gate:alpha") })); assert.equal(lost.accepted, false); if (!lost.accepted) assert.deepEqual({ reservedBy: contender.snapshot().gates[0]?.reservedBy, loserCode: lost.diagnostics[0]?.code, eventSequence: contender.snapshot().eventSequence }, simulationGoldens.contention);
});

test("feeding, baited escape, visitor exposure/casualty, evacuation, and exact replay use one transition engine", () => {
  const fixture = parkFixture(); const commands: WorldCommand[] = [
    command({ id: id("command:open"), kind: "operate-gate", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha"), operation: "open", tool: ref("tool:gate-control") }),
    command({ id: id("command:bait"), kind: "bait", expectedTick: 0, actorId: id("robot:alpha"), dinosaurId: id("dinosaur:tria"), destinationId: id("location:path"), itemId: id("item:food"), tool: ref("tool:bait") }),
  ];
  const escaped = replaySimulation({ snapshot: fixture.initialState, exactContent: fixture.exactContent, allowedCommandKinds: fixture.allowedCommandKinds, commands: commands.map((entry) => ({ decisionTick: 0, command: entry })), finalTick: 1 }); assert.deepEqual({ locationId: escaped.state.dinosaurs[0]?.locationId, contained: escaped.state.dinosaurs[0]?.contained, hunger: escaped.state.dinosaurs[0]?.hunger, agitation: escaped.state.dinosaurs[0]?.agitation, visitorSafety: escaped.state.visitors[0]?.safety, visitorPanic: escaped.state.visitors[0]?.panic }, simulationGoldens.escape);
  const replay = replaySimulation({ snapshot: fixture.initialState, exactContent: fixture.exactContent, allowedCommandKinds: fixture.allowedCommandKinds, commands: commands.map((entry) => ({ decisionTick: 0, command: entry })), finalTick: 3 }); assert.equal(replay.state.dinosaurs[0]?.contained, false); assert.deepEqual({ safety: replay.state.visitors[0]?.safety, panic: replay.state.visitors[0]?.panic, exposedTo: replay.state.visitors[0]?.exposedTo }, simulationGoldens.visitors);
  const again = replaySimulation({ snapshot: fixture.initialState, exactContent: fixture.exactContent, allowedCommandKinds: fixture.allowedCommandKinds, commands: commands.map((entry) => ({ decisionTick: 0, command: entry })), finalTick: 3 }); assert.deepEqual(again, replay);
  const restricted = replaySimulation({ snapshot: fixture.initialState, exactContent: fixture.exactContent, allowedCommandKinds: ["move"], commands: [{ decisionTick: 0, command: commands[0]! }], finalTick: 0 }); assert.equal(restricted.commandResults[0]?.accepted, false); if (restricted.commandResults[0]?.accepted === false) assert.equal(restricted.commandResults[0].diagnostics[0]?.code, "SIM_COMMAND_UNAUTHORIZED");
  const engine = createSimulation({ ...fixture, initialState: replay.state }); const evacuated = engine.execute(command({ id: id("command:evacuate"), kind: "evacuate", expectedTick: 3, actorId: id("robot:alpha"), visitorId: id("visitor:morning"), destinationId: id("location:safe"), tool: ref("tool:evacuate") })); assert.equal(evacuated.accepted, true); assert.equal(engine.snapshot().visitors[0]?.locationId, "location:safe");
  const feedFixture: ScenarioFixture = { ...fixture, initialState: { ...fixture.initialState, robots: fixture.initialState.robots.map((robot) => robot.id === "robot:alpha" ? { ...robot, locationId: id("location:enclosure") } : robot) } }; const feedEngine = createSimulation(feedFixture); const fed = feedEngine.execute(command({ id: id("command:feed"), kind: "feed", expectedTick: 0, actorId: id("robot:alpha"), dinosaurId: id("dinosaur:tria"), itemId: id("item:food"), tool: ref("tool:feed") })); assert.equal(fed.accepted, true); const fedState = feedEngine.snapshot(); assert.deepEqual({ hunger: fedState.dinosaurs[0]?.hunger, agitation: fedState.dinosaurs[0]?.agitation, foodQuantity: fedState.robots[0]?.carried[0]?.quantity, battery: fedState.robots[0]?.battery, eventSequence: fedState.eventSequence }, simulationGoldens.feeding);
});

test("named seeded streams are stable, isolated, serializable, and record consumption", () => {
  const streams = createRandomStreams(9, ["weather", "behavior", "weather"]); assert.deepEqual(streams.map((entry) => entry.name), ["behavior", "weather"]); const first = consumeRandom(streams[0]!); const again = consumeRandom(createRandomStreams(9, ["behavior"])[0]!); assert.deepEqual(first, again); assert.equal(first.stream.consumed, 1); assert.deepEqual(structuredClone(first), first);
});

test("registry loading pins exact scenario and dependency versions", () => {
  const fixture = parkFixture(); const records = [{ id: fixture.scenario.id, version: fixture.scenario.version, class: "SimulationScenario", schemaVersion: "1", data: fixture }, ...fixture.exactContent.map((entry) => ({ ...entry, class: "Tool", schemaVersion: "1", data: {} }))]; const registry = { resolveExact: () => ({ ok: true as const, manifest: { root: records[0]!, dependencies: records.slice(1), schemaVersions: [], fingerprint: "test" } }) };
  assert.equal(loadScenarioFixture({ registry, reference: { ...fixture.scenario, expectedClass: "SimulationScenario", expectedSchemaVersion: "1" } }).ok, true);
  assert.equal(loadScenarioFixture({ registry, reference: { ...fixture.scenario, expectedClass: "Prompt" } }).ok, false);
});
