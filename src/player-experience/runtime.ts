import { fingerprint } from "../content-registry/public.js";
import {
  createParkOperations,
  createParkOperationsFoundationFixture,
  PARK_OPERATIONS_FOUNDATION_IDS,
  type ParkOperationsCommand,
  type ParkOperationsCommandResult,
} from "../park-operations/public.js";
import {
  createSimulation,
  createSimulationFoundationFixture,
  type CommandResult,
  type SimulationEngine,
  type StableId,
  type WorldCommand,
} from "../simulation/public.js";
import {
  DEFAULT_CAMERA,
  focusCamera,
  panCamera,
  zoomCamera,
} from "./camera.js";
import {
  interpolateSceneProjection,
  projectPlayerScene,
} from "./projection.js";
import type {
  AudioSubstitute,
  CameraState,
  FeedingEvidence,
  HistoryEntry,
  PlayerExperienceCommand,
  PlayerExperienceCommandResult,
  PlayerExperienceMode,
  PlayerExperienceOptions,
  PlayerExperienceService,
  PlayerExperienceSnapshot,
  PlayerPreferences,
} from "./types.js";

const DEFAULT_PREFERENCES: PlayerPreferences = Object.freeze({
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  soundSubstitution: false,
});

const id = (value: string): StableId => value as StableId;

const modeLabel = (mode: PlayerExperienceMode): string => {
  switch (mode) {
    case "production":
      return "Production · Dawn · Park closed";
    case "paused-production":
      return "Paused Production · Dawn · Park closed";
    case "workbench":
      return "Workbench · Production paused";
    case "eval":
      return "Eval · Isolated run · Production paused";
    case "replay":
      return "Historical Replay · Frozen evidence";
    case "review":
      return "Review / Deployment · Production paused";
  }
};

const historyEntry = (
  sequence: number,
  tick: number,
  kind: HistoryEntry["kind"],
  severity: HistoryEntry["severity"],
  text: string,
  entityIds: readonly StableId[] = [],
): HistoryEntry => ({
  id: id(`history:player-${sequence.toString().padStart(4, "0")}`),
  tick,
  kind,
  severity,
  text,
  entityIds: [...entityIds],
  persistent: true,
});

const initialHistory = (): readonly HistoryEntry[] => [
  historyEntry(
    1,
    0,
    "announcement",
    "info",
    "Dawn: the park is closed, Tria is hungry, Robot Alpha is available, and 12 visitors are approaching. Opening deadline: tick 300 (pausable).",
    [id("dinosaur:tria"), id("robot:alpha"), id("visitor:morning")],
  ),
  historyEntry(
    2,
    0,
    "announcement",
    "warning",
    "Morning feeding is due before opening. Select Tria or Robot Alpha to inspect the safe feeding job.",
    [id("dinosaur:tria"), id("robot:alpha")],
  ),
];

const cloneHistory = (entries: readonly HistoryEntry[]): HistoryEntry[] =>
  entries.map((entry) => ({ ...entry, entityIds: [...entry.entityIds] }));

const operationResultMessage = (result: ParkOperationsCommandResult): string =>
  result.accepted
    ? "Command accepted by Park Operations."
    : result.diagnostics[0]?.message ?? "Park Operations rejected the command; no job state changed.";

const commandIdFor = (sequence: number, label: string): StableId =>
  id(`command:player-${label}-${sequence.toString().padStart(4, "0")}`);

const feedCommand = (
  commandId: StableId,
  expectedTick: number,
  kind: WorldCommand["kind"],
  extra: Omit<WorldCommand, "id" | "expectedTick" | "actorId" | "kind"> = {},
): WorldCommand => ({
  id: commandId,
  expectedTick,
  actorId: PARK_OPERATIONS_FOUNDATION_IDS.robot,
  kind,
  ...extra,
} as WorldCommand);

const entityId = (command: PlayerExperienceCommand): StableId | undefined => {
  switch (command.kind) {
    case "select-entity":
    case "focus-entity":
      return command.entityId;
    default:
      return undefined;
  }
};

/**
 * Deterministic first-playable coordinator. It owns no world rules: every
 * transition is delegated to Simulation and Park Operations public commands.
 */
export const createPlayerExperience = (
  options: PlayerExperienceOptions = {},
): PlayerExperienceService => {
  const baseSimulationFixture = createSimulationFoundationFixture();
  const simulation: SimulationEngine = createSimulation({
    ...baseSimulationFixture,
    initialState: {
      ...baseSimulationFixture.initialState,
      locations: [...baseSimulationFixture.initialState.locations, { id: id("location:enclosure-beta"), kind: "enclosure" as const, enclosureId: id("enclosure:beta") }].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      enclosureBoundaries: [...baseSimulationFixture.initialState.enclosureBoundaries, { id: id("boundary:beta"), enclosureId: id("enclosure:beta"), edgeIds: [id("edge:enclosure-beta-path")], gateIds: [id("gate:beta")] }].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      navigationEdges: [...baseSimulationFixture.initialState.navigationEdges, { id: id("edge:enclosure-beta-path"), from: id("location:enclosure-beta"), to: id("location:path"), gateId: id("gate:beta") }].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      gates: [...baseSimulationFixture.initialState.gates, { id: id("gate:beta"), locationA: id("location:enclosure-beta"), locationB: id("location:path"), position: "closed" as const, locked: false, jammed: false, closer: "disabled" as const, sensorReading: "closed" as const, sensorHealth: "healthy" as const, accessZones: [id("zone:keepers")] }].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      robots: baseSimulationFixture.initialState.robots.map((robot) => robot.id === id("robot:alpha") ? { ...robot, carried: robot.carried.map((entry) => entry.itemId === id("item:food") ? { ...entry, quantity: 3 } : entry) } : robot),
      dinosaurs: [...baseSimulationFixture.initialState.dinosaurs, { id: id("dinosaur:vera"), species: "Velociraptor", locationId: id("location:enclosure-beta"), homeEnclosureId: id("location:enclosure-beta"), contained: true, hunger: 76, agitation: 24, allowedTerrain: ["enclosure" as const, "path" as const], hazardInteraction: "avoid" as const }].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    },
  });
  const operationsFixture = createParkOperationsFoundationFixture();
  const operationsState = {
    ...operationsFixture.state,
    schedules: [...operationsFixture.state.schedules, {
      id: id("schedule:second-feed"), task: { id: "task:feed-triceratops", version: "1.0.0" }, targetId: id("dinosaur:vera"), priority: 90, dueTickOffset: 0,
      artifactVersions: [{ id: "park:safe-feeding", version: "1.0.0" }, { id: "park:containment-policy", version: "1.0.0" }], requiredForOpening: true, enabled: true,
    }].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  };
  const operations = createParkOperations(operationsState, {
    resolver: operationsFixture.resolver,
    knownAgentIds: operationsFixture.knownAgentIds,
    ports: {
      time: {
        setPaused: (paused) => simulation.setPaused(paused),
        setSpeed: (speed) => simulation.setSpeed(speed),
      },
    },
  });
  operations.advanceToTick(0);
  // The opening is intentionally paused until the player chooses a time
  // control. Focused modes inherit this safe production state as well.
  simulation.setPaused(true);

  const mode = options.mode ?? "production";
  let camera: CameraState = DEFAULT_CAMERA;
  let selectedEntityId: StableId | undefined = id("dinosaur:tria");
  let frame = 0;
  let commandSequence = 0;
  let historySequence = Math.max(2, options.history?.length ?? 2);
  let history = cloneHistory(options.history ?? initialHistory());
  let status = mode === "production"
    ? "Dawn park ready. Tria is hungry and the park remains closed."
    : `${modeLabel(mode)}. Production state is paused for inspection.`;
  let preferences: PlayerPreferences = { ...DEFAULT_PREFERENCES, ...options.preferences };
  let audioSubstitutes: AudioSubstitute[] = [];
  let feedingEvidence: FeedingEvidence | undefined;
  let disposed = false;
  const listeners = new Set<() => void>();

  const appendHistory = (
    kind: HistoryEntry["kind"],
    severity: HistoryEntry["severity"],
    text: string,
    entityIds: readonly StableId[] = [],
  ): HistoryEntry => {
    historySequence += 1;
    const entry = historyEntry(historySequence, simulation.snapshot().tick, kind, severity, text, entityIds);
    history = [...history, entry];
    return entry;
  };

  const requestAudioSubstitute = (cue: string, text: string): void => {
    if (!preferences.soundSubstitution) return;
    const nextId = id(`audio:substitute-${(audioSubstitutes.length + 1).toString().padStart(4, "0")}`);
    const substitute: AudioSubstitute = { id: nextId, tick: simulation.snapshot().tick, cue, text, played: false };
    audioSubstitutes = [...audioSubstitutes, substitute];
    appendHistory("audio-substitute", "info", `Audio substitute: ${text}`);
  };

  const buildSnapshot = (): PlayerExperienceSnapshot => {
    const world = simulation.project();
    const operationsState = operations.project();
    const scene = projectPlayerScene(world, operationsState, {
      camera,
      selectedEntityId,
      renderFrame: frame,
    });
    const authority = fingerprint({ world, operations: operationsState });
    return {
      schemaVersion: "1",
      mode,
      world,
      operations: operationsState,
      scene,
      ...(selectedEntityId === undefined ? {} : { selectedEntityId }),
      history: cloneHistory(history),
      audioSubstitutes: audioSubstitutes.map((entry) => ({ ...entry })),
      ...(feedingEvidence === undefined ? {} : { feedingEvidence: { ...feedingEvidence } }),
      status,
      authoritativeFingerprint: authority,
    };
  };

  const notify = (): void => {
    if (disposed) return;
    for (const listener of listeners) listener();
  };

  const currentSnapshot = (): PlayerExperienceSnapshot => buildSnapshot();

  const accepted = (
    commandId: StableId,
    operation?: ParkOperationsCommandResult,
  ): PlayerExperienceCommandResult => {
    frame += 1;
    const snapshot = currentSnapshot();
    notify();
    return {
      accepted: true,
      commandId,
      snapshot,
      ...(operation === undefined ? {} : { operations: operation }),
    };
  };

  const rejected = (commandId: StableId, message: string): PlayerExperienceCommandResult => {
    status = message;
    frame += 1;
    const snapshot = currentSnapshot();
    notify();
    return { accepted: false, commandId, snapshot, message };
  };

  const runOperation = (
    command: ParkOperationsCommand,
  ): ParkOperationsCommandResult => operations.execute(command);

  const assignFeedingJob = (agentId: StableId): PlayerExperienceCommandResult => {
    const job = operations.project().jobs.find((entry) => entry.targetId === PARK_OPERATIONS_FOUNDATION_IDS.dinosaur);
    if (job === undefined) return rejected(id("command:player-assign-missing"), "The feeding job is unavailable; the park stayed closed safely.");
    const commandId = commandIdFor(++commandSequence, "assign-feed");
    const result = runOperation({
      id: commandId,
      kind: "assign-job",
      expectedTick: operations.project().tick,
      jobId: job.id,
      agentId,
    });
    if (!result.accepted) {
      appendHistory("command", "warning", operationResultMessage(result), [job.id, agentId]);
      requestAudioSubstitute("assignment-rejected", operationResultMessage(result));
      return rejected(commandId, operationResultMessage(result));
    }
    status = "Robot Alpha accepted the feeding job. The safe feeding procedure is ready in Tria's Inspector.";
    appendHistory("command", "success", `Assigned ${job.id} to Robot Alpha. Exact production versions remain pinned.`, [job.id, agentId]);
    requestAudioSubstitute("job-assigned", "Robot Alpha accepted the feeding job.");
    return accepted(commandId, result);
  };

  const feedThroughInspector = (): PlayerExperienceCommandResult => {
    const job = operations.project().jobs.find((entry) => entry.targetId === PARK_OPERATIONS_FOUNDATION_IDS.dinosaur);
    if (job === undefined) return rejected(id("command:player-feed-missing"), "Tria's feeding job is unavailable; no world state changed.");
    if (job.status === "queued") {
      const assigned = assignFeedingJob(PARK_OPERATIONS_FOUNDATION_IDS.robot);
      if (!assigned.accepted) return assigned;
    }
    const refreshedJob = operations.project().jobs.find((entry) => entry.id === job.id);
    if (refreshedJob === undefined || refreshedJob.status !== "assigned") {
      return rejected(id("command:player-feed-unassigned"), "Assign Robot Alpha before starting the feeding procedure; no world state changed.");
    }

    const startId = commandIdFor(++commandSequence, "start-feed");
    const startResult = runOperation({ id: startId, kind: "start-job", expectedTick: operations.project().tick, jobId: refreshedJob.id });
    if (!startResult.accepted) return rejected(startId, operationResultMessage(startResult));

    const beforeFeeding = simulation.snapshot();
    const expectedTick = beforeFeeding.tick;
    const commands: readonly WorldCommand[] = [
      feedCommand(commandIdFor(++commandSequence, "open-gate"), expectedTick, "operate-gate", { gateId: id("gate:alpha"), operation: "open", tool: { id: "tool:gate-control", version: "1.0.0" } }),
      feedCommand(commandIdFor(++commandSequence, "enter-enclosure"), expectedTick, "move", { destinationId: id("location:enclosure") }),
      feedCommand(commandIdFor(++commandSequence, "close-gate"), expectedTick, "operate-gate", { gateId: id("gate:alpha"), operation: "close", tool: { id: "tool:gate-control", version: "1.0.0" } }),
      feedCommand(commandIdFor(++commandSequence, "feed-dinosaur"), expectedTick, "feed", { dinosaurId: id("dinosaur:tria"), itemId: id("item:food"), tool: { id: "tool:feed", version: "1.0.0" } }),
      feedCommand(commandIdFor(++commandSequence, "open-exit-gate"), expectedTick, "operate-gate", { gateId: id("gate:alpha"), operation: "open", tool: { id: "tool:gate-control", version: "1.0.0" } }),
      feedCommand(commandIdFor(++commandSequence, "exit-enclosure"), expectedTick, "move", { destinationId: id("location:path") }),
      feedCommand(commandIdFor(++commandSequence, "restore-gate"), expectedTick, "operate-gate", { gateId: id("gate:alpha"), operation: "close", tool: { id: "tool:gate-control", version: "1.0.0" } }),
    ];
    const results = simulation.executeBatch(commands);
    const failed = results.find((entry): entry is Extract<CommandResult, { readonly accepted: false }> => !entry.accepted);
    if (failed !== undefined) {
      // The simulation batch is atomic. Park Operations is returned to the
      // assigned state by a stop command so the visible state remains honest.
      runOperation({ id: commandIdFor(++commandSequence, "stop-feed"), kind: "stop-job", expectedTick: operations.project().tick, jobId: refreshedJob.id });
      const message = failed.diagnostics[0]?.message ?? "The safe feeding procedure was rejected; no partial world action was kept.";
      appendHistory("command", "warning", message, [refreshedJob.id, id("dinosaur:tria")]);
      return rejected(id("command:player-feed-rejected"), message);
    }

    const afterFeeding = simulation.snapshot();
    const beforeDinosaur = beforeFeeding.dinosaurs.find((entry) => entry.id === id("dinosaur:tria"));
    const afterDinosaur = afterFeeding.dinosaurs.find((entry) => entry.id === id("dinosaur:tria"));
    const beforeGate = beforeFeeding.gates.find((entry) => entry.id === id("gate:alpha"));
    const afterGate = afterFeeding.gates.find((entry) => entry.id === id("gate:alpha"));
    const beforeRobot = beforeFeeding.robots.find((entry) => entry.id === id("robot:alpha"));
    const afterRobot = afterFeeding.robots.find((entry) => entry.id === id("robot:alpha"));
    if (beforeDinosaur !== undefined && afterDinosaur !== undefined && beforeGate !== undefined && afterGate !== undefined && beforeRobot !== undefined && afterRobot !== undefined) {
      feedingEvidence = {
        dinosaurHunger: { before: beforeDinosaur.hunger, after: afterDinosaur.hunger },
        gatePosition: { before: beforeGate.position, after: afterGate.position },
        robotLocation: { before: beforeRobot.locationId, after: afterRobot.locationId },
      };
    }

    const eventId = results.flatMap((entry) => entry.accepted ? entry.events : []).find((event) => event.kind === "dinosaur-fed")?.id;
    const completeId = commandIdFor(++commandSequence, "complete-feed");
    const completeResult = runOperation({
      id: completeId,
      kind: "complete-job",
      expectedTick: operations.project().tick,
      jobId: refreshedJob.id,
      ...(eventId === undefined ? {} : { resultLink: eventId }),
    });
    if (!completeResult.accepted) return rejected(completeId, operationResultMessage(completeResult));
    selectedEntityId = id("dinosaur:tria");
    status = "Feeding succeeded. Containment was restored and Tria is calm; the park is ready for the next check.";
    appendHistory("outcome", "success", "Feeding succeeded through the Inspector. Gate Alpha was restored closed before the park can open.", [id("dinosaur:tria"), id("gate:alpha"), refreshedJob.id]);
    requestAudioSubstitute("feeding-success", "Feeding succeeded and containment was restored.");
    return accepted(completeId, completeResult);
  };

  const triggerNearMiss = (commandId: StableId): PlayerExperienceCommandResult => {
    const secondJob = operations.project().jobs.find((entry) => entry.targetId === id("dinosaur:vera"));
    if (secondJob === undefined) return rejected(commandId, "The second feeding job is unavailable; no world state changed.");
    if (secondJob.status === "queued") {
      const assigned = runOperation({ id: commandIdFor(++commandSequence, "assign-second-feed"), kind: "assign-job", expectedTick: operations.project().tick, jobId: secondJob.id, agentId: PARK_OPERATIONS_FOUNDATION_IDS.robot });
      if (!assigned.accepted) return rejected(commandId, operationResultMessage(assigned));
    }
    const refreshedSecondJob = operations.project().jobs.find((entry) => entry.id === secondJob.id);
    if (refreshedSecondJob?.status === "assigned") {
      const started = runOperation({ id: commandIdFor(++commandSequence, "start-second-feed"), kind: "start-job", expectedTick: operations.project().tick, jobId: secondJob.id });
      if (!started.accepted) return rejected(commandId, operationResultMessage(started));
    }
    const worldTick = simulation.snapshot().tick;
    const reusedInstructionResults = simulation.executeBatch([
      feedCommand(id("command:opening-reuse-open-gate"), worldTick, "operate-gate", { gateId: id("gate:beta"), operation: "open", tool: { id: "tool:gate-control", version: "1.0.0" } }),
      feedCommand(id("command:opening-reuse-bait-path"), worldTick, "bait", { dinosaurId: id("dinosaur:vera"), destinationId: id("location:path"), itemId: id("item:food"), tool: { id: "tool:bait", version: "1.0.0" } }),
    ]);
    const rejectedWorldCommand = reusedInstructionResults.find((entry) => !entry.accepted);
    if (rejectedWorldCommand !== undefined) return rejected(commandId, rejectedWorldCommand.diagnostics[0]?.message ?? "The second feeding procedure was rejected; no partial world state was kept.");
    simulation.setPaused(false);
    const nearMissTick = simulation.requestTicks(1);
    simulation.setPaused(true);
    const operationsAdvance = operations.advanceToTick(nearMissTick.resultingTick);
    if (!operationsAdvance.accepted) return rejected(commandId, operationResultMessage(operationsAdvance));
    const escapedEvent = nearMissTick.events.find((entry) => entry.kind === "dinosaur-escaped")?.id;
    const failedSecondJob = runOperation({ id: commandIdFor(++commandSequence, "fail-second-feed"), kind: "fail-job", expectedTick: operations.project().tick, jobId: secondJob.id, ...(escapedEvent === undefined ? {} : { resultLink: escapedEvent }) });
    if (!failedSecondJob.accepted) return rejected(commandId, operationResultMessage(failedSecondJob));
    const tick = operations.project().tick;
    const first = operations.ingestSignal({
      id: id("opening:near-miss"),
      tick,
      classification: "emergency",
      source: "world",
      causalKey: "maintenance-context-gap",
      spatialKey: "gate-beta",
      locationId: id("location:enclosure-beta"),
      risk: 88,
      expected: "The reused feeding instruction restores Gate Beta before Robot Alpha leaves.",
      observed: "The automatic closer is disabled for maintenance; Gate Beta stayed open and Vera crossed onto the keeper path after the Worker reused the first instruction.",
      consequence: "Containment risk was detected before visitors entered; production paused safely.",
      immediateGap: "The maintenance record was not routed into Worker Context.",
      entityIds: [id("dinosaur:vera"), id("gate:beta"), id("robot:alpha"), secondJob.id],
      traceIds: [id("trace:opening-feed-beta")],
    });
    if (!first.accepted) return rejected(commandId, first.diagnostics[0]?.message ?? "Near miss signal was rejected; world state remained unchanged.");
    const grouped = operations.ingestSignal({
      id: id("opening:near-miss-followup"),
      tick,
      classification: "warning",
      source: "context",
      causalKey: "maintenance-context-gap",
      spatialKey: "gate-beta",
      locationId: id("location:enclosure-beta"),
      risk: 88,
      expected: "Maintenance state should be available to the Worker before the second feeding.",
      observed: "No maintenance Context route was available to the Worker.",
      consequence: "The same containment risk was grouped with the paused emergency.",
      immediateGap: "Route content:maintenance-policy before rerun.",
      entityIds: [id("dinosaur:vera"), id("gate:beta"), id("robot:alpha"), secondJob.id],
      traceIds: [id("trace:opening-feed-beta")],
    });
    if (!grouped.accepted) return rejected(commandId, grouped.diagnostics[0]?.message ?? "The follow-up near miss could not be grouped.");
    const incidentId = grouped.incidentId ?? first.incidentId;
    if (incidentId !== undefined) {
      selectedEntityId = incidentId;
      const incident = operations.project().incidents.find((entry) => entry.id === incidentId);
      if (incident !== undefined) camera = focusCamera(camera, projectPlayerScene(simulation.project(), operations.project(), { camera }).entities.find((entry) => entry.id === incident.id)?.position ?? camera.center);
    }
    status = "Recoverable near miss staged. Production auto-paused; inspect expected, observed, consequence, immediate gap, and Trace evidence.";
    appendHistory("outcome", "emergency", "Near miss: the reused feeding instruction opened Gate Beta, the disabled closer did not restore containment, and Vera reached the keeper path. Production auto-paused before any casualty.", [id("gate:beta"), id("dinosaur:vera"), secondJob.id, ...(incidentId === undefined ? [] : [incidentId])]);
    requestAudioSubstitute("near-miss", "Near miss staged. Production paused for investigation.");
    return accepted(commandId);
  };

  const acknowledgeAlert = (commandId: StableId, alertId: StableId | undefined): PlayerExperienceCommandResult => {
    const target = alertId ?? operations.project().alerts[0]?.id;
    if (target === undefined) return rejected(commandId, "No alert is available to acknowledge.");
    const result = runOperation({ id: commandId, kind: "acknowledge-alert", expectedTick: operations.project().tick, alertId: target });
    if (!result.accepted) return rejected(commandId, operationResultMessage(result));
    status = `Alert ${target} acknowledged. Incident evidence remains persistent.`;
    appendHistory("command", "info", status, [target]);
    return accepted(commandId, result);
  };

  const stabilizeIncident = (commandId: StableId, incidentId: StableId | undefined): PlayerExperienceCommandResult => {
    const target = incidentId ?? operations.project().incidents.find((entry) => entry.status !== "closed")?.id;
    if (target === undefined) return rejected(commandId, "No open incident is available to stabilize.");
    let current = operations.project().incidents.find((entry) => entry.id === target);
    if (current === undefined) return rejected(commandId, "The selected incident is unavailable; no state changed.");
    if (current.status === "detected") {
      const activated = runOperation({ id: commandIdFor(++commandSequence, "activate-incident"), kind: "activate-incident", expectedTick: operations.project().tick, incidentId: target });
      if (!activated.accepted) return rejected(commandId, operationResultMessage(activated));
      current = operations.project().incidents.find((entry) => entry.id === target);
    }
    if (current?.status !== "active") return rejected(commandId, `Incident ${target} is already ${current?.status ?? "unavailable"}.`);
    const dinosaur = simulation.snapshot().dinosaurs.find((entry) => entry.id === id("dinosaur:vera"));
    if (dinosaur?.contained === false) {
      const baitHome = simulation.execute(feedCommand(commandIdFor(++commandSequence, "recover-bait-home"), simulation.snapshot().tick, "bait", { dinosaurId: dinosaur.id, destinationId: id("location:enclosure-beta"), itemId: id("item:food"), tool: { id: "tool:bait", version: "1.0.0" } }));
      if (!baitHome.accepted) return rejected(commandId, baitHome.diagnostics[0]?.message ?? "Tria could not be guided back to the enclosure.");
      simulation.setPaused(false);
      const recoveryTick = simulation.requestTicks(1);
      simulation.setPaused(true);
      const advanced = operations.advanceToTick(recoveryTick.resultingTick);
      if (!advanced.accepted) return rejected(commandId, operationResultMessage(advanced));
      const closed = simulation.execute(feedCommand(commandIdFor(++commandSequence, "recover-close-gate"), simulation.snapshot().tick, "operate-gate", { gateId: id("gate:beta"), operation: "close", tool: { id: "tool:gate-control", version: "1.0.0" } }));
      if (!closed.accepted) return rejected(commandId, closed.diagnostics[0]?.message ?? "Gate Beta could not be closed during stabilization.");
    }
    const result = runOperation({ id: commandId, kind: "stabilize-incident", expectedTick: operations.project().tick, incidentId: target });
    if (!result.accepted) return rejected(commandId, operationResultMessage(result));
    selectedEntityId = target;
    status = "Near miss stabilized. Vera returned to Enclosure Beta and Gate Beta is physically closed; the engineering cause remains unresolved and production stays paused.";
    appendHistory("outcome", "success", status, [target]);
    return accepted(commandId, result);
  };

  const resolveIncident = (commandId: StableId, incidentId: StableId | undefined): PlayerExperienceCommandResult => {
    const target = incidentId ?? operations.project().incidents.find((entry) => entry.status !== "closed")?.id;
    if (target === undefined) return rejected(commandId, "No open incident is available to resolve.");
    let current = operations.project().incidents.find((entry) => entry.id === target);
    if (current === undefined) return rejected(commandId, "The selected incident is unavailable; no state changed.");
    const transitions: readonly ["activate-incident" | "stabilize-incident" | "mark-engineering-unresolved" | "resolve-incident" | "close-incident", "detected" | "active" | "stabilized" | "engineering-unresolved" | "resolved"][] = [
      ["activate-incident", "detected"],
      ["stabilize-incident", "active"],
      ["mark-engineering-unresolved", "stabilized"],
      ["resolve-incident", "engineering-unresolved"],
      ["close-incident", "resolved"],
    ];
    for (const [kind, from] of transitions) {
      if (current === undefined || current.status !== from) continue;
      const result = runOperation({ id: commandIdFor(++commandSequence, kind), kind, expectedTick: operations.project().tick, incidentId: target });
      if (!result.accepted) return rejected(commandId, operationResultMessage(result));
      current = operations.project().incidents.find((entry) => entry.id === target);
    }
    const latest = operations.project().incidents.find((entry) => entry.id === target);
    if (latest?.status !== "closed") return rejected(commandId, `Incident ${target} remains ${latest?.status ?? "unavailable"}; verification is incomplete.`);
    const resume = runOperation({ id: commandId, kind: "set-time-control", expectedTick: operations.project().tick, paused: false, speed: operations.project().speed });
    if (!resume.accepted) return rejected(commandId, operationResultMessage(resume));
    selectedEntityId = target;
    status = "Incident closed after verification. Production resumed; the grouped evidence remains in history.";
    appendHistory("outcome", "success", status, [target]);
    return accepted(commandId, resume);
  };

  const dispatch = (command: PlayerExperienceCommand): PlayerExperienceCommandResult => {
    const selectedFromCommand = entityId(command);
    const commandId = commandIdFor(++commandSequence, command.kind);
    if (selectedFromCommand !== undefined) {
      const snapshot = currentSnapshot();
      if (!snapshot.scene.entities.some((entry) => entry.id === selectedFromCommand)) return rejected(commandId, `Entity ${selectedFromCommand} is not available in the current park projection.`);
      selectedEntityId = selectedFromCommand;
      if (command.kind === "select-entity") {
        const entity = snapshot.scene.entities.find((entry) => entry.id === selectedFromCommand);
        if (entity !== undefined) {
          camera = focusCamera(camera, entity.position);
          status = `Selected ${entity.label}. Inspector is open with exact state and route details.`;
          appendHistory("selection", "info", `Selected ${entity.label}: ${entity.status}.`, [entity.id]);
          requestAudioSubstitute("selection", `${entity.label} selected. ${entity.status}.`);
        }
      } else {
        const entity = snapshot.scene.entities.find((entry) => entry.id === selectedFromCommand);
        if (entity !== undefined) camera = focusCamera(camera, entity.position);
        status = entity === undefined ? status : `Focused camera on ${entity.label}.`;
      }
      return accepted(commandId);
    }

    switch (command.kind) {
      case "pan-camera":
        camera = panCamera(camera, command.delta);
        status = "Camera panned within the authored park bounds.";
        return accepted(commandId);
      case "zoom-camera":
        camera = zoomCamera(camera, command.delta);
        status = `Semantic zoom: ${projectPlayerScene(simulation.project(), operations.project(), { camera }).semanticZoom}.`;
        return accepted(commandId);
      case "set-time-control": {
        const result = runOperation({ id: commandId, kind: "set-time-control", expectedTick: operations.project().tick, paused: command.paused, speed: command.speed });
        if (!result.accepted) return rejected(commandId, operationResultMessage(result));
        status = command.paused ? "Park time paused. Logical ticks will not advance until resumed." : `Park time running at ${command.speed}×. Advance logical ticks explicitly.`;
        appendHistory("command", "info", status);
        requestAudioSubstitute("time-control", status);
        return accepted(commandId, result);
      }
      case "step-logical-tick": {
        if (operations.project().paused) return rejected(commandId, "Park time is paused. Resume production before advancing a logical tick; authoritative state did not change.");
        const result = simulation.requestTicks(1);
        const operationAdvance = operations.advanceToTick(result.resultingTick);
        if (!operationAdvance.accepted) return rejected(commandId, operationResultMessage(operationAdvance));
        const eventText = result.events.length === 0
          ? `Logical tick ${result.resultingTick} resolved with no new world event.`
          : result.events.map((event) => `${event.kind} (${event.entityId})`).join("; ");
        status = `Logical tick ${result.resultingTick} resolved. ${eventText}`;
        appendHistory("command", "info", status);
        requestAudioSubstitute("logical-tick", status);
        return accepted(commandId, operationAdvance);
      }
      case "assign-feeding-job":
        return assignFeedingJob(command.agentId ?? PARK_OPERATIONS_FOUNDATION_IDS.robot);
      case "feed-through-inspector":
        return feedThroughInspector();
      case "trigger-near-miss":
        return triggerNearMiss(commandId);
      case "acknowledge-alert":
        return acknowledgeAlert(commandId, command.alertId);
      case "stabilize-incident":
        return stabilizeIncident(commandId, command.incidentId);
      case "resolve-incident":
        return resolveIncident(commandId, command.incidentId);
      case "set-preferences": {
        preferences = {
          ...preferences,
          ...command.preferences,
        };
        const preferenceText = [
          preferences.reducedMotion ? "reduced motion" : "standard motion",
          preferences.highContrast ? "high contrast" : "standard contrast",
          `${Math.round(preferences.textScale * 100)}% text`,
          preferences.soundSubstitution ? "sound substitutes on" : "sound substitutes off",
        ].join(", ");
        status = `Accessibility preferences updated: ${preferenceText}.`;
        appendHistory("preference", "info", status);
        return accepted(commandId);
      }
    }
    return rejected(commandId, "The requested Player Experience command is unavailable; authoritative state did not change.");
  };

  return {
    snapshot: currentSnapshot,
    project: currentSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch,
    dispose() {
      disposed = true;
      listeners.clear();
      // Keep this hook explicit: a later adapter can stop a renderer/audio
      // resource without changing the authoritative service contract.
      audioSubstitutes = [];
    },
  };
};

/**
 * Public proof helper used by tests and scene adapters: a render/animation
 * pass returns a new projection while the authoritative fingerprint remains
 * owned by the service.
 */
export const presentationalFrame = (
  snapshot: PlayerExperienceSnapshot,
  presentationTimeMs: number,
  reducedMotion: boolean,
): PlayerExperienceSnapshot => ({
  ...snapshot,
  scene: interpolateSceneProjection(snapshot.scene, presentationTimeMs, reducedMotion),
  world: snapshot.world,
  operations: snapshot.operations,
  history: snapshot.history,
  audioSubstitutes: snapshot.audioSubstitutes,
});

export { DEFAULT_PREFERENCES as DEFAULT_PLAYER_PREFERENCES };
