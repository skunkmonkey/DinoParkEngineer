import { z } from "zod";

import { assembleContext, contextFacts, createContextFoundationFixture } from "../context/public.js";

import {
  createInstructionFoundationFixture,
  executeInstruction,
  executeInstructionTool,
  type InstructionDecision,
  type ResolvedInstructionArtifact,
} from "../instruction/public.js";
import {
  CONTENT_REGISTRY_FOUNDATION_REFERENCES,
  createContentRegistry,
  createContentRegistryFoundationFixture,
  createInvalidContentRegistryFoundationPackage,
  fingerprintCatalogPackage,
  type CatalogPackage,
  type ContentRecord,
  type ContentRegistry,
  type RegistryDiagnostic,
  type RegistryInspectionProjection,
} from "../content-registry/public.js";
import {
  createSimulation,
  createSimulationFoundationFixture,
  loadScenarioFixture,
  replaySimulation,
  scenarioFixtureSchema,
  type ReplayResult,
  type ScenarioFixture,
  type StableId,
  type WorldCommand,
} from "../simulation/public.js";
import {
  captureTrace,
  createReplaySession,
  projectTrace,
  verifyTraceRerun,
  type Trace,
  type TraceEventDraft,
} from "../trace-replay/public.js";

const toolDataSchema = z.strictObject({
  capability: z.enum(["bait", "evacuate", "feed", "gate-control", "gate-observation"]),
});

const toolCapabilityById = {
  "tool:bait": "bait",
  "tool:evacuate": "evacuate",
  "tool:feed": "feed",
  "tool:gate-control": "gate-control",
  "tool:gate-observe": "gate-observation",
} as const;

const signPackage = (value: Omit<CatalogPackage, "fingerprint">): CatalogPackage => ({
  ...value,
  fingerprint: fingerprintCatalogPackage(value),
});

const contentEnvelope = (
  fixture: ScenarioFixture,
  version: string,
  displayName: string,
): ContentRecord => ({
  id: fixture.scenario.id,
  version,
  class: "SimulationScenario",
  schemaVersion: "1",
  displayName,
  author: "Simulation Foundation",
  provenance: {
    source: "built-in",
    path: `content/scenarios/simulation-foundation-${version}.json`,
    author: "Simulation Foundation",
  },
  contextCost: 0,
  dependencies: fixture.exactContent,
  tags: ["foundation", "simulation"],
  availability: version === "1.0.0" ? "available" : "hidden",
  data: fixture,
});

const toolRecords = (fixture: ScenarioFixture): readonly ContentRecord[] => fixture.exactContent.map((reference) => ({
  ...reference,
  class: "SimulationTool",
  schemaVersion: "1",
  displayName: reference.id.replace("tool:", "").replaceAll("-", " "),
  author: "Simulation Foundation",
  provenance: {
    source: "built-in",
    path: `content/tools/${reference.id.replace("tool:", "")}.json`,
    author: "Simulation Foundation",
  },
  contextCost: 0,
  dependencies: [],
  tags: ["simulation", "tool"],
  availability: "available",
  data: {
    capability: toolCapabilityById[reference.id as keyof typeof toolCapabilityById],
  },
}));

const createScenarioRegistry = (): ContentRegistry => createContentRegistry({
  registrySchemaVersion: "1",
  classDefinitions: [
    { class: "SimulationScenario", schemaVersion: "1", schema: scenarioFixtureSchema },
    { class: "SimulationTool", schemaVersion: "1", schema: toolDataSchema },
  ],
});

export interface RegistryLabProjection {
  readonly selected: RegistryInspectionProjection;
  readonly history: readonly RegistryInspectionProjection[];
  readonly manifestFingerprint: string;
  readonly invalidDiagnostics: readonly RegistryDiagnostic[];
}

export interface SimulationRegistryProof {
  readonly fixture: ScenarioFixture;
  readonly pinnedFingerprintBefore: string;
  readonly pinnedFingerprintAfter: string;
  readonly newerVersion: string;
}

export const createRegistryLabProjection = (version = "1.0.0"): RegistryLabProjection => {
  const registry = createContentRegistryFoundationFixture();
  const selected = registry.inspect(CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt.id, version);
  if (selected === undefined) throw new Error(`Missing foundation Prompt ${version}.`);
  const manifest = registry.resolveExact(CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt.id, version);
  if (!manifest.ok) throw new Error(`Could not resolve foundation Prompt ${version}.`);
  const invalid = registry.loadPackages([createInvalidContentRegistryFoundationPackage()]);
  const history = registry.history(CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt.id).map((record) => {
    const projection = registry.inspect(record.id, record.version);
    if (projection === undefined) throw new Error(`Missing history projection ${record.version}.`);
    return projection;
  });
  return {
    selected,
    history,
    manifestFingerprint: manifest.manifest.fingerprint,
    invalidDiagnostics: invalid.diagnostics,
  };
};

export const createSimulationRegistryProof = (): SimulationRegistryProof => {
  const fixture = createSimulationFoundationFixture();
  const basePackage = signPackage({
    packageId: "scenario-package:simulation-foundation",
    packageVersion: "1.0.0",
    registrySchemaVersion: "1",
    requirement: "required",
    entries: [...toolRecords(fixture), contentEnvelope(fixture, "1.0.0", "Simulation Foundation")],
  });
  const baseLoad = createScenarioRegistry().loadPackages([basePackage]);
  if (baseLoad.status !== "ready" || baseLoad.diagnostics.length > 0) {
    throw new Error("The base Simulation package is invalid.");
  }
  const before = baseLoad.registry.resolveExact(fixture.scenario.id, fixture.scenario.version);
  if (!before.ok) throw new Error("The pinned Simulation fixture did not resolve.");

  const newerFixture: ScenarioFixture = {
    ...fixture,
    scenario: { ...fixture.scenario, version: "2.0.0" },
    initialState: {
      ...fixture.initialState,
      scenario: { ...fixture.scenario, version: "2.0.0" },
    },
  };
  const historyPackage = signPackage({
    packageId: "scenario-package:simulation-history",
    packageVersion: "1.0.0",
    registrySchemaVersion: "1",
    requirement: "required",
    entries: [contentEnvelope(newerFixture, "2.0.0", "Simulation Foundation (revised)")],
  });
  const extended = baseLoad.registry.loadPackages([historyPackage]);
  if (extended.status !== "ready" || extended.diagnostics.length > 0) {
    throw new Error("The Simulation history package is invalid.");
  }
  const after = extended.registry.resolveExact(fixture.scenario.id, fixture.scenario.version);
  const loadedFixture = loadScenarioFixture({
    registry: extended.registry,
    reference: { ...fixture.scenario, expectedClass: "SimulationScenario", expectedSchemaVersion: "1" },
  });
  if (!after.ok || !loadedFixture.ok) throw new Error("The exact Simulation fixture could not be loaded after extension.");
  return {
    fixture: loadedFixture.fixture,
    pinnedFingerprintBefore: before.manifest.fingerprint,
    pinnedFingerprintAfter: after.manifest.fingerprint,
    newerVersion: newerFixture.scenario.version,
  };
};

const id = (value: string): StableId => value as StableId;
const ref = (value: string) => ({ id: value, version: "1.0.0" });

export const escapeReplayCommands = (): readonly WorldCommand[] => [
  {
    id: id("command:open-for-replay"),
    kind: "operate-gate",
    expectedTick: 0,
    actorId: id("robot:alpha"),
    gateId: id("gate:alpha"),
    operation: "open",
    tool: ref("tool:gate-control"),
  },
  {
    id: id("command:bait-for-replay"),
    kind: "bait",
    expectedTick: 0,
    actorId: id("robot:alpha"),
    dinosaurId: id("dinosaur:tria"),
    destinationId: id("location:path"),
    itemId: id("item:food"),
    tool: ref("tool:bait"),
  },
];

export const runFoundationReplay = (fixture: ScenarioFixture): ReplayResult => replaySimulation({
  snapshot: fixture.initialState,
  exactContent: fixture.exactContent,
  allowedCommandKinds: fixture.allowedCommandKinds,
  commands: escapeReplayCommands().map((command) => ({ decisionTick: 0, command })),
  finalTick: 3,
});

export interface Phase4IntegrationProof {
  readonly trace: Trace;
  readonly decision: InstructionDecision;
  readonly replayEquivalent: boolean;
  readonly productionIsolated: boolean;
  readonly proseIndependent: boolean;
  readonly missingMaintenanceUnavailable: boolean;
  readonly contextUsed: number;
  readonly eventCount: number;
  readonly cycleCount: number;
}

const captureDecisionCycle = (artifact: ResolvedInstructionArtifact): { readonly trace: Trace; readonly decision: InstructionDecision } => {
  const simulationProof = createSimulationRegistryProof();
  const context = assembleContext(createContextFoundationFixture().base);
  if (!context.ok || context.status !== "ready") throw new Error("The Phase 4 Context fixture did not produce a ready snapshot.");
  const decision = executeInstruction({ artifacts: [artifact], facts: contextFacts(context.afterRetention), evidence: [], currentTick: 0 });
  if (decision.outcome.kind !== "tool-request") throw new Error("The Phase 4 Instruction fixture did not select a tool request.");
  const command = decision.outcome.command;
  const simulation = createSimulation(simulationProof.fixture);
  const execution = executeInstructionTool(simulation, decision);
  if (execution === undefined) throw new Error("The Phase 4 Instruction fixture did not request a Simulation tool.");
  const links = [{ kind: "job" as const, id: id("job:feeding-alpha") }, { kind: "agent" as const, id: id("agent:worker-alpha") }, { kind: "entity" as const, id: id("gate:alpha") }];
  const events: TraceEventDraft[] = [
    { schemaVersion: "1", kind: "task", tick: 0, entityLinks: links, causalParentIds: [], payload: { taskId: id("task:feeding-alpha"), jobId: id("job:feeding-alpha"), artifactReferences: [artifact.reference], exactContentManifest: { schemaVersion: "1", entries: [{ reference: artifact.reference }], fingerprint: "fnv1a64:74b2c8d8d7f7a30b" } } },
    { schemaVersion: "1", kind: "context-assembly", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { beforeManifest: context.beforeRetention, afterManifest: context.afterRetention, entries: context.afterRetention.entries.map((entry) => ({ itemId: entry.itemId, availability: entry.lifecycle === "included" ? "available" as const : entry.lifecycle === "unavailable-required" ? "unavailable" as const : entry.lifecycle === "excluded" ? "excluded" as const : "never-routed" as const, used: entry.lifecycle === "included", sourceVersion: entry.item?.sourceVersion, reasonCode: entry.reasonCode })), diagnostics: context.diagnostics.map((entry) => entry.code) } },
    ...decision.provenance.map((entry): TraceEventDraft => ({ schemaVersion: "1", kind: "clause-applicability", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { clauseId: entry.clauseId, source: entry.source, sourceClass: entry.sourceClass, status: entry.status, reasonCode: entry.reasonCode } })),
    { schemaVersion: "1", kind: "decision", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { outcome: decision.outcome, provenance: decision.provenance, compositionFindings: decision.compositionFindings, availableContextItemIds: context.afterRetention.entries.filter((entry) => entry.lifecycle === "included").map((entry) => entry.itemId), unavailableContextItemIds: context.afterRetention.entries.filter((entry) => entry.lifecycle !== "included").map((entry) => entry.itemId) } },
    { schemaVersion: "1", kind: "tool-request", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { command, tool: artifact.requiredTools[0] } },
    { schemaVersion: "1", kind: "tool-result", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { commandResult: execution.commandResult } },
    { schemaVersion: "1", kind: "evidence", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { evidence: execution.evidence } },
    ...execution.commandResult.deltas.map((delta): TraceEventDraft => ({ schemaVersion: "1", kind: "world-delta", tick: delta.tick, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { delta } })),
    { schemaVersion: "1", kind: "outcome", tick: 0, cycleId: id("cycle:feeding-0"), entityLinks: links, causalParentIds: [], payload: { outcome: { kind: "complete", reasonCode: "FEEDING_GATE_OPENED", expected: "Gate opens for feeding", observed: "Gate opened", consequence: "Robot may enter the enclosure", immediateCausalGap: "none" } } },
  ];
  const captured = captureTrace({
    id: id("trace:phase4-cycle"), mode: "production", root: { taskId: id("task:feeding-alpha"), jobId: id("job:feeding-alpha") },
    contentManifest: [artifact.reference, ...simulationProof.fixture.exactContent], seed: simulationProof.fixture.initialState.seed, startTick: 0,
    initialState: simulationProof.fixture.initialState, events,
    authority: { initialState: simulationProof.fixture.initialState, exactContent: simulationProof.fixture.exactContent, allowedCommandKinds: simulationProof.fixture.allowedCommandKinds, commands: [{ decisionTick: 0, command }], commandResults: [execution.commandResult], worldEvents: execution.commandResult.events, worldDeltas: execution.commandResult.deltas },
    finalState: simulation.snapshot(), outcome: { kind: "complete", reasonCode: "FEEDING_GATE_OPENED", expected: "Gate opens for feeding", observed: "Gate opened", consequence: "Robot may enter the enclosure", immediateCausalGap: "none" },
  });
  if (!captured.ok) throw new Error(captured.fault.message);
  return { trace: captured.trace, decision };
};

export const createPhase4IntegrationProof = (): Phase4IntegrationProof => {
  const instruction = createInstructionFoundationFixture();
  const original = captureDecisionCycle(instruction.selfContained);
  const proseOnly = captureDecisionCycle({ ...instruction.selfContained, readableSource: "Different readable prose with the same exact executable clauses." });
  const replay = createReplaySession(original.trace);
  const productionBefore = structuredClone(original.trace.authority.initialState);
  replay.play(); replay.advance(1); replay.pause();
  const missing = assembleContext(createContextFoundationFixture().missingMaintenance);
  const projection = projectTrace(original.trace);
  return Object.freeze({
    trace: original.trace,
    decision: original.decision,
    replayEquivalent: verifyTraceRerun(original.trace).status === "equivalent",
    productionIsolated: JSON.stringify(original.trace.authority.initialState) === JSON.stringify(productionBefore),
    proseIndependent: JSON.stringify(original.trace) === JSON.stringify(proseOnly.trace),
    missingMaintenanceUnavailable: missing.ok && missing.afterRetention.entries.some((entry) => entry.itemId === "context:maintenance-policy" && entry.lifecycle === "unavailable-required"),
    contextUsed: Math.max(0, ...projection.detailed.cycles.map((cycle) => cycle.cost ?? 0)),
    eventCount: projection.concise.eventCount,
    cycleCount: projection.concise.cycleCount,
  });
};
