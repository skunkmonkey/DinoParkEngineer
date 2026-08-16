import { createContentRegistry, type ArtifactVersion, type ContentPack, type ContentRegistry } from "../content-registry/index.ts";
import { createStarterFixture, type WorldFixture } from "../simulation/index.ts";
import type { JobDraft, JobTemplate } from "./types.ts";

const prompt: ArtifactVersion = {
  artifactId: "park.operations.prompt.feed-rex",
  version: 1,
  type: "PROMPT",
  title: "Feed Rex",
  sourceText: "Feed Rex and report the observable outcome.",
  clauses: [
    { id: "park.feed.goal", sourceText: "Rex hunger is reduced.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 10 },
    { id: "park.feed.move", sourceText: "Move to the selected enclosure service gate.", type: "ACTION", action: { tool: "move_to", zoneId: "$serviceZone", order: 1 }, priority: 10 },
    { id: "park.feed.open", sourceText: "Open the selected enclosure access gate.", type: "ACTION", action: { tool: "open_gate", gateId: "$gate", order: 2 }, priority: 10 },
    { id: "park.feed.enter", sourceText: "Enter the selected enclosure.", type: "ACTION", action: { tool: "move_to", zoneId: "$interiorZone", order: 3 }, priority: 10 },
    { id: "park.feed.food", sourceText: "Dispense food to the selected dinosaur.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "$target", order: 4 }, priority: 10 },
  ],
  dependencies: [],
  applicabilityTags: ["task:feeding"],
  requiredToolIds: ["move_to", "open_gate", "dispense_food"],
  status: "DEPLOYED",
  authoredByCapability: "park.operations.fixture",
  createdAtGameTime: 0,
};

const safeSkill: ArtifactVersion = {
  artifactId: "park.operations.skill.safe-feeding",
  version: 1,
  type: "SKILL",
  title: "Safe Feeding Skill",
  sourceText: "Feed, secure the gate, verify containment, and escalate if safety cannot be confirmed.",
  clauses: [
    { id: "park.safe-feed.return", sourceText: "Return to the selected service gate before securing it.", type: "ACTION", action: { tool: "move_to", zoneId: "$serviceZone", order: 5 }, priority: 20 },
    { id: "park.safe-feed.close", sourceText: "Secure the selected gate after feeding.", type: "ACTION", action: { tool: "close_gate", gateId: "$gate", order: 6 }, priority: 20 },
    { id: "park.safe-feed.lock", sourceText: "Lock the selected closed gate.", type: "ACTION", action: { tool: "lock_gate", gateId: "$gate", order: 7 }, priority: 20 },
    { id: "park.safe-feed.post", sourceText: "Verify selected-dinosaur containment.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED", target: "$target" }, priority: 20 },
    { id: "park.safe-feed.escalate", sourceText: "Alert security when containment is not verified.", type: "ESCALATION", action: { tool: "alert_security", severity: 3, targetZoneId: "$serviceZone" }, priority: 30 },
  ],
  dependencies: [],
  applicabilityTags: ["task:feeding", "safety:standard"],
  requiredToolIds: ["close_gate", "lock_gate", "alert_security"],
  status: "DEPLOYED",
  authoredByCapability: "park.operations.fixture",
  createdAtGameTime: 0,
};

const safetyPrompt: ArtifactVersion = {
  artifactId: "park.operations.system.containment",
  version: 1,
  type: "SYSTEM_PROMPT",
  title: "Containment Safety System Prompt",
  sourceText: "Visitor safety and containment outrank throughput.",
  clauses: [{ id: "park.safety.priority", sourceText: "Containment outranks throughput.", type: "PRIORITY", action: { semanticKey: "containment-priority", value: 100 }, priority: 100 }],
  dependencies: [],
  applicabilityTags: ["task:feeding"],
  requiredToolIds: [],
  status: "DEPLOYED",
  authoredByCapability: "park.operations.fixture",
  createdAtGameTime: 0,
};

export const DEFAULT_OPERATIONS_TEMPLATES: readonly JobTemplate[] = Object.freeze([
  Object.freeze({
    id: "job-template.feed",
    title: "Feed a dinosaur",
    type: "FEED",
    description: "Run an authored feeding Prompt against a selected dinosaur.",
    targetKinds: ["DINOSAUR"],
    promptRefs: [{ artifactId: prompt.artifactId, version: prompt.version }],
    skillRefs: [{ artifactId: safeSkill.artifactId, version: safeSkill.version }],
    systemPromptRefs: [{ artifactId: safetyPrompt.artifactId, version: safetyPrompt.version }],
    defaultPriority: 5,
    dueOffsetSeconds: 120,
  }),
]);

export function createOperationsContentPack(): ContentPack {
  return {
    schemaVersion: 1,
    packId: "park.operations.defaults",
    packVersion: 1,
    artifacts: [prompt, safeSkill, safetyPrompt],
  };
}

export function createOperationsContentRegistry(): ContentRegistry {
  const registry = createContentRegistry();
  const result = registry.loadPack(createOperationsContentPack());
  if (!result.ok) throw new Error(`Default Park Operations content failed validation: ${result.error.map((item) => item.message).join("; ")}`);
  return registry;
}

export function createOperationsFixture(): WorldFixture {
  const fixture = createStarterFixture();
  // The default lesson makes the first under-specified feed incident
  // deterministic: Rex is already at the service threshold when the gate opens.
  return {
    ...fixture,
    dinosaurs: fixture.dinosaurs.map((dinosaur) => dinosaur.id === "dino.rex" ? { ...dinosaur, currentZone: "zone.gamma.service" } : dinosaur),
  };
}

export const DEFAULT_OPERATIONS_ARTIFACTS = Object.freeze({
  promptRef: { artifactId: prompt.artifactId, version: prompt.version },
  skillRef: { artifactId: safeSkill.artifactId, version: safeSkill.version },
  systemPromptRef: { artifactId: safetyPrompt.artifactId, version: safetyPrompt.version },
});

export interface DefaultFeedingJobDraftOptions {
  readonly targetRef: string;
  readonly agentId: string;
  readonly priority: number;
  readonly logicalTime: number;
  readonly expectedParkVersion: number;
  readonly useSafeSkill: boolean;
  readonly useSystemPrompt: boolean;
}

/** Canonical draft used by the production Park UI and integration tests. */
export function createDefaultFeedingJobDraft(options: DefaultFeedingJobDraftOptions): JobDraft {
  return {
    templateId: "job-template.feed",
    type: "FEED",
    targetRefs: [options.targetRef],
    priority: options.priority,
    dueTime: options.logicalTime + 120,
    promptRef: DEFAULT_OPERATIONS_ARTIFACTS.promptRef,
    skillRefs: options.useSafeSkill ? [DEFAULT_OPERATIONS_ARTIFACTS.skillRef] : [],
    systemPromptRefs: options.useSystemPrompt ? [DEFAULT_OPERATIONS_ARTIFACTS.systemPromptRef] : [],
    assignedAgentId: options.agentId,
    expectedParkVersion: options.expectedParkVersion,
  };
}
