import { z } from "zod";

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
  createSimulationFoundationFixture,
  loadScenarioFixture,
  replaySimulation,
  scenarioFixtureSchema,
  type ReplayResult,
  type ScenarioFixture,
  type StableId,
  type WorldCommand,
} from "../simulation/public.js";

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
