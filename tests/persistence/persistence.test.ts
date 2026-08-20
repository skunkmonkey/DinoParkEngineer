import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleContext,
  createContextFoundationFixture,
} from "../../src/context/public.js";
import {
  createParkOperations,
  createParkOperationsFoundationFixture,
} from "../../src/park-operations/public.js";
import {
  captureTrace,
  verifyTraceRerun,
} from "../../src/trace-replay/public.js";
import {
  createSimulation,
  createSimulationFoundationFixture,
} from "../../src/simulation/public.js";
import type { ContentReference } from "../../src/content-registry/public.js";
import {
  createInMemorySaveRepository,
  createPersistenceContentManifest,
  createPersistenceCoordinator,
  createSaveEnvelope,
  createMemorySessionPort,
  saveEnvelopeSchema,
  validateSaveEnvelope,
  type PersistenceSession,
  type SaveEnvelope,
  type SaveRepository,
} from "../../src/persistence/public.js";

const ref = (id: string, version = "1.0.0"): ContentReference => ({ id, version });

const makeSession = (): { readonly session: PersistenceSession; readonly references: readonly ContentReference[] } => {
  const simulationFixture = createSimulationFoundationFixture();
  const simulation = createSimulation(simulationFixture);
  const operationFixture = createParkOperationsFoundationFixture();
  const operations = createParkOperations(operationFixture.state, {
    resolver: operationFixture.resolver,
    knownAgentIds: operationFixture.knownAgentIds,
  });
  operations.advanceToTick(0);
  const contextFixture = createContextFoundationFixture();
  const assembled = assembleContext(contextFixture.base);
  assert.equal(assembled.ok, true);
  if (!assembled.ok) throw new Error("Context fixture did not assemble.");
  const openGate = {
    id: "command:persistence-open",
    kind: "operate-gate" as const,
    expectedTick: 0,
    actorId: "robot:alpha" as const,
    gateId: "gate:alpha" as const,
    operation: "open" as const,
    tool: ref("tool:gate-control"),
  };
  const commandResult = simulation.execute(openGate);
  assert.equal(commandResult.accepted, true);
  const world = simulation.snapshot();
  const traceResult = captureTrace({
    id: "trace:persistence-opening",
    mode: "production",
    root: { taskId: "task:feed-triceratops", jobId: "job:feeding-001" },
    contentManifest: simulationFixture.exactContent,
    seed: simulationFixture.initialState.seed,
    startTick: 0,
    initialState: simulationFixture.initialState,
    authority: {
      initialState: simulationFixture.initialState,
      exactContent: simulationFixture.exactContent,
      allowedCommandKinds: simulationFixture.allowedCommandKinds,
      commands: [{ decisionTick: 0, command: openGate }],
      commandResults: [commandResult],
      worldEvents: commandResult.accepted ? commandResult.events : [],
      worldDeltas: commandResult.accepted ? commandResult.deltas : [],
    },
    finalState: world,
    outcome: { kind: "complete", reasonCode: "GATE_OPENED" },
  });
  assert.equal(traceResult.ok, true);
  if (!traceResult.ok) throw new Error(traceResult.fault.message);
  const session: PersistenceSession = {
    world,
    operations: operations.snapshot(),
    context: {
      schemaVersion: "1",
      manifests: [assembled.afterRetention],
      retentionAudits: assembled.retention === undefined ? [] : [assembled.retention],
    },
    traces: [traceResult.trace],
    preferences: { reducedMotion: true, highContrast: false, textScale: 1.25, soundSubstitution: true },
  };
  const references = [
    world.scenario,
    ...world.tools.map((tool) => tool.reference),
    ...world.robots.flatMap((robot) => robot.toolRefs),
    ...operations.snapshot().schedules.flatMap((schedule) => [schedule.task, ...schedule.artifactVersions]),
    ...operations.snapshot().jobs.flatMap((job) => [job.task, ...job.exactDeployedVersions.map((pin) => pin.reference)]),
    ...assembled.afterRetention.entries.flatMap((entry) => entry.item === undefined ? [] : [entry.item.sourceVersion]),
    ...traceResult.trace.authority.exactContent,
  ];
  return { session, references };
};

const createFixtureSave = (): { readonly envelope: SaveEnvelope; readonly session: PersistenceSession } => {
  const fixture = makeSession();
  const contentManifest = createPersistenceContentManifest({ references: fixture.references });
  const envelope = createSaveEnvelope({
    id: "save:opening",
    applicationVersion: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    contentManifest,
    session: fixture.session,
  });
  return { envelope, session: fixture.session };
};

test("versioned envelope is canonical, complete, and data-only", () => {
  const { envelope } = createFixtureSave();
  assert.equal(envelope.schemaVersion, "1");
  assert.equal(envelope.saveSchemaVersion, "1");
  assert.equal(envelope.completionMarker, "SAVE_COMPLETE");
  assert.equal(envelope.sections.simulation.schemaVersion, "1");
  assert.equal(envelope.sections.traceReplay.data.traces.length, 1);
  assert.equal(saveEnvelopeSchema.safeParse(envelope).success, true);
  assert.equal(validateSaveEnvelope(envelope).ok, true);
  const json = JSON.stringify(envelope);
  assert.equal(json.includes("function"), false);
  assert.equal(json.includes("pixi"), false);
});

test("manual save/load round-trips world, jobs, versions, context, trace, and preferences", () => {
  const { envelope, session } = createFixtureSave();
  const repository = createInMemorySaveRepository();
  const active = createMemorySessionPort({ ...session, preferences: { ...session.preferences, highContrast: true } });
  const coordinator = createPersistenceCoordinator({ repository, session: active, now: () => "2026-01-01T00:00:00.000Z" });
  const saved = coordinator.save({ id: envelope.id, contentManifest: envelope.contentManifest, session });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const changed = active.snapshot();
  active.replace({ ...changed, world: { ...changed.world, tick: changed.world.tick + 1 } });
  const loaded = coordinator.load(envelope.id);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.session.world, session.world);
  assert.deepEqual(loaded.session.operations, session.operations);
  assert.deepEqual(loaded.session.context, session.context);
  assert.deepEqual(loaded.session.traces, session.traces);
  assert.deepEqual(loaded.session.preferences, session.preferences);
  assert.deepEqual(active.snapshot(), session);
});

test("historical trace replay remains equivalent after save reload", () => {
  const { envelope } = createFixtureSave();
  const trace = envelope.sections.traceReplay.data.traces[0];
  assert.ok(trace);
  if (trace === undefined) return;
  const verification = verifyTraceRerun(trace, { availableContent: envelope.contentManifest.references });
  assert.equal(verification.status, "equivalent");
  const repository = createInMemorySaveRepository();
  const fixture = makeSession();
  const active = createMemorySessionPort(fixture.session);
  const coordinator = createPersistenceCoordinator({ repository, session: active });
  assert.equal(coordinator.save({ id: envelope.id, contentManifest: envelope.contentManifest, session: fixture.session }).ok, true);
  assert.equal(coordinator.replay(envelope.id, trace.id).ok, true);
});

test("missing exact content blocks load without floating to a newer version", () => {
  const { envelope, session } = createFixtureSave();
  const repository = createInMemorySaveRepository();
  const active = createMemorySessionPort(session);
  const coordinator = createPersistenceCoordinator({
    repository,
    session: active,
    contentResolver: { resolveExact: (id, version) => ({ ok: id !== "tool:gate-control" || version !== "1.0.0" }) },
  });
  const saved = coordinator.save({ id: envelope.id, contentManifest: envelope.contentManifest, session });
  assert.equal(saved.ok, false);
  assert.equal(repository.read(envelope.id), undefined);
  assert.deepEqual(active.snapshot(), session);
});

test("invalid domain data leaves current session and known-good save unchanged", () => {
  const { envelope, session } = createFixtureSave();
  const repository = createInMemorySaveRepository();
  const active = createMemorySessionPort(session);
  const validCoordinator = createPersistenceCoordinator({ repository, session: active, applicationVersion: "test", now: () => "2026-01-01T00:00:00.000Z" });
  assert.equal(validCoordinator.save({ id: envelope.id, contentManifest: envelope.contentManifest, session }).ok, true);
  const before = active.snapshot();
  const corrupt = structuredClone(envelope) as SaveEnvelope;
  const corruptWorld = { ...corrupt.sections.simulation.data, dinosaurs: corrupt.sections.simulation.data.dinosaurs.map((dinosaur) => ({ ...dinosaur, hunger: 101 })) };
  corrupt.sections = { ...corrupt.sections, simulation: { ...corrupt.sections.simulation, data: corruptWorld } };
  const corruptRepository: SaveRepository = {
    stage: () => ({ ok: true, diagnostics: [] }),
    promote: () => ({ ok: true, diagnostics: [] }),
    read: () => corrupt,
    list: () => [],
    remove: () => ({ ok: true, diagnostics: [] }),
    knownGoodId: () => corrupt.id,
  };
  const loadCoordinator = createPersistenceCoordinator({ repository: corruptRepository, session: active });
  const loaded = loadCoordinator.load(corrupt.id);
  assert.equal(loaded.ok, false);
  assert.deepEqual(active.snapshot(), before);
  assert.deepEqual(repository.read(envelope.id), envelope);
});

test("in-memory repository promotes complete stages atomically and protects explicit delete", () => {
  const { envelope } = createFixtureSave();
  const repository = createInMemorySaveRepository();
  assert.equal(repository.stage(envelope).ok, true);
  assert.equal(repository.read(envelope.id), undefined);
  assert.equal(repository.promote(envelope.id).ok, true);
  assert.equal(repository.knownGoodId(), envelope.id);
  assert.equal(repository.remove(envelope.id, false).ok, false);
  assert.equal(repository.read(envelope.id)?.id, envelope.id);
  assert.equal(repository.remove(envelope.id, true).ok, true);
  assert.equal(repository.read(envelope.id), undefined);
});
