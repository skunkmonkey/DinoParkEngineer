import type { ArtifactVersion, ContentPack } from "../content-registry/index.ts";

/** Reviewable Manager configuration artifacts. Version 1 is the historical
 * baseline; version 2 is the candidate represented by DEFAULT_MANAGER_CONFIG. */
export function createOrchestrationContentPack(): ContentPack {
  const managerV1: ArtifactVersion = {
    artifactId: "manager.operations.default",
    version: 1,
    type: "SYSTEM_PROMPT" as const,
    title: "Habitat Operations Manager Configuration v1",
    sourceText: "Coordinate routine habitat work. Report failures to the player.",
    clauses: [
      { id: "manager.v1.delegate", sourceText: "Delegate routine habitat work to an available keeper.", type: "DELEGATION" as const, priority: 10, action: { taskTypes: ["FEED"] } },
      { id: "manager.v1.report", sourceText: "Report worker failures.", type: "REPORTING" as const, priority: 10, action: { exceptionImmediate: true } },
    ],
    dependencies: [{ artifactId: "park.operations.prompt.manager-mission", version: 1 }],
    applicabilityTags: ["agent:manager"],
    requiredToolIds: [],
    status: "DEPLOYED" as const,
    authoredByCapability: "capability.manager-agent",
    createdAtGameTime: 0,
  };
  const managerV2: ArtifactVersion = {
    ...managerV1,
    version: 2,
    title: "Habitat Operations Manager Configuration v2",
    sourceText: "Maintain safe habitat operations. Delegate by role, route bounded task context, escalate Severity 2 incidents, and batch routine completion reports every five jobs.",
    clauses: [
      { id: "manager.v2.safety", sourceText: "Safety incidents outrank containment, animal health, and guest throughput.", type: "PRIORITY" as const, priority: 100, action: { order: ["SAFETY_INCIDENT", "CONTAINMENT", "ANIMAL_HEALTH", "GUEST_THROUGHPUT"] } },
      { id: "manager.v2.feed", sourceText: "Delegate feeding to an eligible keeper with the required tools and context.", type: "DELEGATION" as const, priority: 20, action: { taskTypes: ["FEED"], role: "KEEPER" } },
      { id: "manager.v2.evac", sourceText: "Delegate evacuation and rescue to Security.", type: "DELEGATION" as const, priority: 90, action: { taskTypes: ["EVACUATE", "RESCUE", "SECURITY"], role: "SECURITY" } },
      { id: "manager.v2.escalate", sourceText: "Escalate Severity 2 incidents or a tool failure after one safe fallback.", type: "ESCALATION" as const, priority: 100, action: { severityThreshold: 2, fallbackAttempts: 1 } },
      { id: "manager.v2.report", sourceText: "Report exceptions immediately and routine completions every five jobs.", type: "REPORTING" as const, priority: 50, action: { exceptionImmediate: true, routineBatchSize: 5 } },
    ],
    status: "REVIEW" as const,
  };
  const mission: ArtifactVersion = {
    artifactId: "park.operations.prompt.manager-mission",
    version: 1,
    type: "PROMPT" as const,
    title: "Habitat Operations Mission",
    sourceText: "Maintain safe habitat operations and complete scheduled animal care.",
    clauses: [{ id: "manager.mission.goal", sourceText: "Maintain safe habitat operations.", type: "GOAL" as const, priority: 100, assert: { fact: "PARK_OPERATIONS_SAFE" } }],
    dependencies: [],
    applicabilityTags: ["agent:manager"],
    requiredToolIds: [],
    status: "DEPLOYED" as const,
    authoredByCapability: "capability.manager-agent",
    createdAtGameTime: 0,
  };
  return { schemaVersion: 1, packId: "multi-agent-orchestration.defaults", packVersion: 1, artifacts: [managerV1, managerV2, mission] };
}
