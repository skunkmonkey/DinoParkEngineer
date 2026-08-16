import {
  createStarterFixture,
  deepClone,
  deepFreeze,
  type WorldFixture,
} from "../simulation/index.ts";
import type { ArtifactRef, DinosaurProfileDefinition, EnclosureDefinition, ToolDescriptionDefinition } from "../content-registry/index.ts";

/** The authored park intentionally starts from the public simulation fixture.
 * Content owns the names/copy and fixture deltas; simulation owns validation and
 * adjudication. */
export const CURRICULUM_FIXTURE_ID = "fixture.curriculum.mvp";

export function createCurriculumFixture(): WorldFixture {
  const starter = createStarterFixture();
  return deepFreeze({
    ...deepClone(starter),
    id: CURRICULUM_FIXTURE_ID,
    // Rex starts at the service threshold so the under-specified Prompt
    // creates a deterministic, inspectable containment incident.
    dinosaurs: starter.dinosaurs.map((dinosaur) => dinosaur.id === "dino.rex"
      ? { ...dinosaur, currentZone: "zone.gamma.service", containmentState: "CONTAINED" as const }
      : dinosaur),
    visitors: starter.visitors.map((visitor) => ({ ...visitor, location: "zone.outside", safetyState: "SAFE" as const, panic: 0 })),
    enableAutonomy: false,
  });
}

export function withFixtureDelta(fixture: WorldFixture, delta: "visitor-buffer" | "gate-jam" | "sensor-degraded" | "bait-offline" | "feeder-offline" | "battery-critical" | "maintenance-lock" | "context-overflow" | "escaped-response"): WorldFixture {
  const next = deepClone(fixture) as { -readonly [K in keyof WorldFixture]: WorldFixture[K] };
  if (delta === "visitor-buffer") {
    next.visitors = next.visitors.map((visitor) => visitor.id === "visitors.group01" ? { ...visitor, location: "zone.gamma.buffer" } : visitor);
  } else if (delta === "gate-jam") {
    next.faults = [{ id: "fault.curriculum.gate-jam", logicalTime: 8, type: "GATE_JAM", targetId: "gate.gamma" }];
  } else if (delta === "sensor-degraded") {
    next.faults = [{ id: "fault.curriculum.sensor-degraded", logicalTime: 0, type: "SENSOR_DEGRADE", targetId: "gate.gamma" }];
  } else if (delta === "bait-offline") {
    next.devices = next.devices.map((device) => device.id === "device.bait" ? { ...device, available: false, state: "OFFLINE" as const } : device);
  } else if (delta === "feeder-offline") {
    next.devices = next.devices.map((device) => device.id === "feeder.gamma" ? { ...device, available: false, state: "OFFLINE" as const } : device);
  } else if (delta === "battery-critical") {
    next.agents = next.agents.map((agent) => agent.id === "agent.keeper01" ? { ...agent, battery: 0 } : agent);
  } else if (delta === "maintenance-lock") {
    next.gates = next.gates.map((gate) => gate.id === "gate.gamma" ? { ...gate, maintenanceLock: true } : gate);
  } else if (delta === "context-overflow") {
    next.agents = next.agents.map((agent) => agent.id === "agent.keeper01" ? { ...agent, contextBudget: 1 } : agent);
  } else if (delta === "escaped-response") {
    next.enableAutonomy = true;
    next.gates = next.gates.map((gate) => gate.id === "gate.gamma" ? { ...gate, state: "OPEN" as const, sensorState: "OPEN" as const } : gate);
  }
  return deepFreeze(next);
}

export const CURRICULUM_DINOSAUR_PROFILES: readonly DinosaurProfileDefinition[] = deepFreeze([
  {
    id: "dinosaur.profile.docile-herbivore",
    version: 1,
    title: "Docile herbivore · Triceratops",
    speciesId: "species.triceratops",
    archetype: "DOCILE_HERBIVORE",
    movementProfile: { archetype: "DOCILE_HERBIVORE", wanderChanceBasisPoints: 1500, preferredZoneIds: ["zone.alpha.interior", "zone.alpha.service"], escapeRiskBasisPoints: 1500 },
    tags: ["archetype:docile-herbivore", "lesson:onboarding"],
  },
  {
    id: "dinosaur.profile.large-herbivore",
    version: 1,
    title: "Large herbivore · Brachiosaurus",
    speciesId: "species.brachiosaurus",
    archetype: "LARGE_HERBIVORE",
    movementProfile: { archetype: "LARGE_HERBIVORE", wanderChanceBasisPoints: 2500, preferredZoneIds: ["zone.beta.interior", "zone.beta.service"], escapeRiskBasisPoints: 4500 },
    tags: ["archetype:large-herbivore", "lesson:parallelism"],
  },
  {
    id: "dinosaur.profile.carnivore",
    version: 1,
    title: "Carnivore · Tyrannosaurus",
    speciesId: "species.tyrannosaurus",
    archetype: "CARNIVORE",
    movementProfile: { archetype: "CARNIVORE", wanderChanceBasisPoints: 3500, preferredZoneIds: ["zone.gamma.interior", "zone.gamma.service"], escapeRiskBasisPoints: 8500 },
    tags: ["archetype:carnivore", "risk:containment", "lesson:containment"],
  },
] as DinosaurProfileDefinition[]);

export const CURRICULUM_ENCLOSURES: readonly EnclosureDefinition[] = deepFreeze([
  { id: "enclosure.alpha", version: 1, title: "Garden Walk · Alpha", speciesAllowed: ["species.triceratops"], hazardLevel: 1, tags: ["risk:low", "archetype:docile-herbivore"], fixtureId: CURRICULUM_FIXTURE_ID },
  { id: "enclosure.beta", version: 1, title: "Canopy Range · Beta", speciesAllowed: ["species.brachiosaurus"], hazardLevel: 2, tags: ["risk:medium", "archetype:large-herbivore"], fixtureId: CURRICULUM_FIXTURE_ID },
  { id: "enclosure.gamma", version: 1, title: "High Security · Gamma", speciesAllowed: ["species.tyrannosaurus"], hazardLevel: 4, tags: ["risk:critical", "archetype:carnivore"], fixtureId: CURRICULUM_FIXTURE_ID },
] as EnclosureDefinition[]);

export const CURRICULUM_TOOL_DESCRIPTIONS: readonly ToolDescriptionDefinition[] = deepFreeze([
  { id: "move_to", title: "Move", description: "Move one robot along an authored route.", action: "move_to", tags: ["movement", "deterministic"] },
  { id: "observe", title: "Observe", description: "Read current world state and create a fresh observation.", action: "observe", tags: ["context", "memory"] },
  { id: "bait_dinosaur", title: "Bait", description: "Attract a dinosaur to a named zone for a deterministic window.", action: "bait_dinosaur", tags: ["containment", "feeding"] },
  { id: "open_gate", title: "Open gate", description: "Open a healthy, unlocked gate after transition safety checks.", action: "open_gate", tags: ["containment", "risk"] },
  { id: "close_gate", title: "Close gate", description: "Close a gate when its transition zone is clear.", action: "close_gate", tags: ["containment", "risk"] },
  { id: "lock_gate", title: "Lock gate", description: "Lock a closed gate and restore containment.", action: "lock_gate", tags: ["containment", "safety"] },
  { id: "dispense_food", title: "Dispense food", description: "Feed one dinosaur from its enclosure feeder.", action: "dispense_food", tags: ["animal-care"] },
  { id: "alert_security", title: "Alert security", description: "Create or close a security incident through the radio channel.", action: "alert_security", tags: ["escalation", "safety"] },
  { id: "evacuate_visitors", title: "Evacuate visitors", description: "Route visitors in a zone to the safe zone.", action: "evacuate_visitors", tags: ["visitors", "safety"] },
  { id: "rescue_visitors", title: "Rescue visitors", description: "Move one visitor group to the safe zone.", action: "rescue_visitors", tags: ["visitors", "safety"] },
]);

export const CURRICULUM_AGENT_REFS: readonly ArtifactRef[] = deepFreeze([
  { artifactId: "agent.definition.keeper", version: 1 },
  { artifactId: "agent.definition.security", version: 1 },
  { artifactId: "agent.definition.manager", version: 1 },
]);
