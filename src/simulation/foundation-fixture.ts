import { createRandomStreams } from "./random.js";
import type { ScenarioFixture, StableId } from "./types.js";

const ref = (id: string, version = "1.0.0") => ({ id, version });

/** App-importable exact fixture used by the foundation lab and contract tests. */
export const createSimulationFoundationFixture = (): ScenarioFixture => ({
  schemaVersion: "1", scenario: ref("scenario:simulation-foundation"),
  exactContent: [ref("tool:bait"), ref("tool:evacuate"), ref("tool:feed"), ref("tool:gate-control"), ref("tool:gate-observe")],
  allowedCommandKinds: ["bait", "evacuate", "feed", "move", "observe-gate", "operate-gate", "release", "reserve"],
  initialState: {
    schemaVersion: "1", scenario: ref("scenario:simulation-foundation"), tick: 0, paused: false, speed: 1, seed: 12345,
    randomStreams: createRandomStreams(12345, ["behavior", "weather"]), eventSequence: 0,
    locations: [
      { id: "location:enclosure" as StableId, kind: "enclosure", enclosureId: "enclosure:alpha" as StableId },
      { id: "location:path" as StableId, kind: "path" },
      { id: "location:safe" as StableId, kind: "safe-zone" },
      { id: "location:service" as StableId, kind: "service" },
    ],
    enclosureBoundaries: [{ id: "boundary:alpha" as StableId, enclosureId: "enclosure:alpha" as StableId, edgeIds: ["edge:enclosure-path" as StableId], gateIds: ["gate:alpha" as StableId] }],
    navigationEdges: [
      { id: "edge:enclosure-path" as StableId, from: "location:enclosure" as StableId, to: "location:path" as StableId, gateId: "gate:alpha" as StableId },
      { id: "edge:path-safe" as StableId, from: "location:path" as StableId, to: "location:safe" as StableId },
      { id: "edge:path-service" as StableId, from: "location:path" as StableId, to: "location:service" as StableId },
    ],
    gates: [{ id: "gate:alpha" as StableId, locationA: "location:enclosure" as StableId, locationB: "location:path" as StableId, position: "closed", locked: false, jammed: false, closer: "enabled", sensorReading: "closed", sensorHealth: "healthy", accessZones: ["zone:keepers" as StableId] }],
    robots: [
      { id: "robot:alpha" as StableId, locationId: "location:path" as StableId, toolRefs: [ref("tool:bait"), ref("tool:evacuate"), ref("tool:feed"), ref("tool:gate-control"), ref("tool:gate-observe")], carried: [{ itemId: "item:food" as StableId, quantity: 2 }], battery: 100, health: 100, action: "idle", accessZones: ["zone:keepers" as StableId] },
      { id: "robot:beta" as StableId, locationId: "location:path" as StableId, toolRefs: [ref("tool:gate-control")], carried: [], battery: 100, health: 100, action: "idle", accessZones: ["zone:keepers" as StableId] },
    ],
    dinosaurs: [{ id: "dinosaur:tria" as StableId, species: "Triceratops", locationId: "location:enclosure" as StableId, homeEnclosureId: "location:enclosure" as StableId, contained: true, hunger: 80, agitation: 30, allowedTerrain: ["enclosure", "path"], hazardInteraction: "avoid" }],
    visitors: [{ id: "visitor:morning" as StableId, locationId: "location:path" as StableId, size: 12, panic: 0, evacuating: false, safety: "safe" }],
    hazards: [{ id: "hazard:mud" as StableId, locationId: "location:service" as StableId, severity: 10, active: true }],
    weather: { condition: "clear", intensity: 0 },
    tools: [
      { reference: ref("tool:bait"), capability: "bait", batteryCost: 2, requiresSameLocation: false },
      { reference: ref("tool:evacuate"), capability: "evacuate", batteryCost: 3, requiresSameLocation: false },
      { reference: ref("tool:feed"), capability: "feed", batteryCost: 2, requiresSameLocation: true },
      { reference: ref("tool:gate-control"), capability: "gate-control", batteryCost: 1, requiresSameLocation: true },
      { reference: ref("tool:gate-observe"), capability: "gate-observation", batteryCost: 1, requiresSameLocation: true },
    ],
    scheduled: [], activeActions: [],
  },
});
