import { assembleContext, createContextFoundationFixture } from "../context/public.js";
import type { ContentReference } from "../content-registry/public.js";
import { createParkOperations, createParkOperationsFoundationFixture } from "../park-operations/public.js";
import { createSimulation, createSimulationFoundationFixture, type WorldCommand } from "../simulation/public.js";
import { captureTrace } from "../trace-replay/public.js";

import { createPersistenceContentManifest } from "./engine.js";
import type { PersistenceContentManifest, PersistenceSession } from "./types.js";

export interface PersistenceFoundationFixture {
  readonly session: PersistenceSession;
  readonly contentManifest: PersistenceContentManifest;
  readonly traceId: string;
}

/** The first-playable park checkpoint used by persistence tests and browser proof. */
export function createPersistenceFoundationFixture(): PersistenceFoundationFixture {
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
  if (!assembled.ok) throw new Error("The persistence Context fixture did not assemble.");
  const openGate: WorldCommand = {
    id: "command:persistence-open",
    kind: "operate-gate" as const,
    expectedTick: 0,
    actorId: "robot:alpha" as const,
    gateId: "gate:alpha" as const,
    operation: "open" as const,
    tool: { id: "tool:gate-control", version: "1.0.0" },
  };
  const commandResult = simulation.execute(openGate);
  if (!commandResult.accepted) throw new Error("The persistence Simulation fixture command was rejected.");
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
      worldEvents: commandResult.events,
      worldDeltas: commandResult.deltas,
    },
    finalState: world,
    outcome: { kind: "complete", reasonCode: "GATE_OPENED" },
  });
  if (!traceResult.ok) throw new Error(traceResult.fault.message);
  const operationState = operations.snapshot();
  const session: PersistenceSession = {
    world,
    operations: operationState,
    context: {
      schemaVersion: "1",
      manifests: [assembled.afterRetention],
      retentionAudits: assembled.retention === undefined ? [] : [assembled.retention],
    },
    traces: [traceResult.trace],
    preferences: { reducedMotion: false, highContrast: false, textScale: 1, soundSubstitution: true },
  };
  const references: readonly ContentReference[] = [
    world.scenario,
    ...world.tools.map((tool) => tool.reference),
    ...world.robots.flatMap((robot) => robot.toolRefs),
    ...operationState.schedules.flatMap((schedule) => [schedule.task, ...schedule.artifactVersions]),
    ...operationState.jobs.flatMap((job) => [job.task, ...job.exactDeployedVersions.map((pin) => pin.reference)]),
    ...assembled.afterRetention.entries.flatMap((entry) => entry.item === undefined ? [] : [entry.item.sourceVersion]),
    ...traceResult.trace.authority.exactContent,
  ];
  return Object.freeze({ session, contentManifest: createPersistenceContentManifest({ references }), traceId: traceResult.trace.id });
}
