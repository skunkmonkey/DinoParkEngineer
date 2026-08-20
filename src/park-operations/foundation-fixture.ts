import type { StableId } from "../simulation/public.js";
import type { ParkOperationsState, ProductionVersionResolver } from "./types.js";

export const PARK_OPERATIONS_FOUNDATION_IDS = Object.freeze({ robot: "robot:alpha" as StableId, schedule: "schedule:morning-feed" as StableId, dinosaur: "dinosaur:tria" as StableId });

export function createParkOperationsFoundationFixture(): { readonly state: ParkOperationsState; readonly resolver: ProductionVersionResolver; readonly knownAgentIds: readonly StableId[] } {
  const available = new Set(["task:feed-triceratops@1.0.0", "park:safe-feeding@1.0.0", "park:containment-policy@1.0.0"]);
  return {
    knownAgentIds: [PARK_OPERATIONS_FOUNDATION_IDS.robot],
    resolver: { resolve(reference) { return available.has(`${reference.id}@${reference.version}`) ? { ok: true, pin: { reference: structuredClone(reference), manifestFingerprint: `fixture-${reference.id.replace(":", "-")}-${reference.version}` } } : { ok: false }; } },
    state: { schemaVersion: "1", day: 1, dayStartedTick: 0, tick: 0, phase: "pre-opening", paused: true, speed: 1, visitorsPresent: 0, totalAttendance: 0, departedVisitors: 0, jobs: [], occurrences: [], signals: [], alerts: [], incidents: [], interventionCommandIds: [], daySummaries: [], schedules: [{ id: PARK_OPERATIONS_FOUNDATION_IDS.schedule, task: { id: "task:feed-triceratops", version: "1.0.0", expectedClass: "Task", expectedSchemaVersion: "1" }, targetId: PARK_OPERATIONS_FOUNDATION_IDS.dinosaur, priority: 100, dueTickOffset: 0, artifactVersions: [{ id: "park:safe-feeding", version: "1.0.0", expectedClass: "Skill", expectedSchemaVersion: "1" }, { id: "park:containment-policy", version: "1.0.0", expectedClass: "Policy", expectedSchemaVersion: "1" }], requiredForOpening: true, enabled: true }] },
  };
}
