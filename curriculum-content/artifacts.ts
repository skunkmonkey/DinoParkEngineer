import { type ArtifactRef, type ArtifactVersion, type Clause } from "../content-registry/index.ts";
import { deepFreeze } from "../simulation/index.ts";

export const CURRICULUM_ARTIFACT_REFS = Object.freeze({
  onboardingPrompt: { artifactId: "artifact.curriculum.prompt.herbivore-onboarding", version: 1 },
  unsafePrompt: { artifactId: "artifact.curriculum.prompt.carnivore-unsafe", version: 1 },
  explicitPrompt: { artifactId: "artifact.curriculum.prompt.carnivore-explicit", version: 1 },
  safeFeedingV1: { artifactId: "artifact.curriculum.skill.safe-carnivore-feeding", version: 1 },
  safeFeedingV2: { artifactId: "artifact.curriculum.skill.safe-carnivore-feeding", version: 2 },
  visitorBuffer: { artifactId: "artifact.curriculum.skill.visitor-buffer", version: 1 },
  maintenanceFallback: { artifactId: "artifact.curriculum.skill.maintenance-fallback", version: 1 },
  contextMinimizer: { artifactId: "artifact.curriculum.skill.context-minimizer", version: 1 },
  memoryRefresh: { artifactId: "artifact.curriculum.skill.memory-refresh", version: 1 },
  workerReporting: { artifactId: "artifact.curriculum.skill.worker-reporting", version: 1 },
  containmentPolicy: { artifactId: "artifact.curriculum.system.containment-safety", version: 1 },
  visitorPolicy: { artifactId: "artifact.curriculum.system.visitor-safety", version: 1 },
  managerAuthority: { artifactId: "artifact.curriculum.system.manager-authority", version: 1 },
  gateKnowledge: { artifactId: "artifact.curriculum.knowledge.gate-maintenance", version: 1 },
  enclosureKnowledge: { artifactId: "artifact.curriculum.knowledge.enclosure-status", version: 1 },
  evalSafeV1Prompt: { artifactId: "artifact.curriculum.prompt.eval-safe-feeding-v1", version: 1 },
  evalSafeV2Prompt: { artifactId: "artifact.curriculum.prompt.eval-safe-feeding-v2", version: 1 },
  evalPolicyPrompt: { artifactId: "artifact.curriculum.prompt.eval-policy", version: 1 },
  evalMemoryPrompt: { artifactId: "artifact.curriculum.prompt.eval-memory", version: 1 },
  evalManagerPrompt: { artifactId: "artifact.curriculum.prompt.eval-manager", version: 1 },
  evalEscapePrompt: { artifactId: "artifact.curriculum.prompt.eval-escape", version: 1 },
  managerConfigV1: { artifactId: "manager.curriculum.park", version: 1 },
  managerConfigV2: { artifactId: "manager.curriculum.park", version: 2 },
} as const satisfies Readonly<Record<string, ArtifactRef>>);

function artifact(input: Omit<ArtifactVersion, "createdAtGameTime">): ArtifactVersion {
  return deepFreeze({ ...input, createdAtGameTime: 0 });
}

function clause(input: Clause): Clause {
  return deepFreeze(input);
}

const onboardingPrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.onboardingPrompt.artifactId,
  version: 1,
  type: "PROMPT",
  title: "Onboarding · Feed Fern with an observable goal",
  sourceText: "Feed Fern until hunger is at most 30. Dispense food for Fern, then report the observable feeding result.",
  clauses: [
    clause({ id: "clause.onboarding.feed.goal", sourceText: "Fern hunger is at most 30.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100 }),
    clause({ id: "clause.onboarding.feed.action", sourceText: "Dispense food for Fern.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.fern", order: 1 }, priority: 20 }),
    clause({ id: "clause.onboarding.feed.report", sourceText: "Report the observable feeding result.", type: "REPORTING", action: { status: "COMPLETED", message: "Fern feeding result recorded." }, priority: 10 }),
  ],
  dependencies: [], applicabilityTags: [], requiredToolIds: ["dispense_food"], status: "DEPLOYED", authoredByCapability: "capability.prompt.basic",
});

const unsafePrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.unsafePrompt.artifactId,
  version: 1,
  type: "PROMPT",
  title: "First attempt · Feed Rex",
  sourceText: "Move to Gamma service. Open Gate Gamma. Enter the enclosure. Dispense food for Rex. Rex hunger is at most 30. Assume the gate will be handled by the park after feeding, and optimize for the shortest successful demonstration. The task ends as soon as hunger is reduced; no return trip, closure check, containment verification, visitor check, sensor fallback, or escalation is specified in this first attempt. This intentionally broad instruction repeats the task intent in several forms so the player can see context cost without receiving stronger behavior: feed the carnivore, make the animal comfortable, finish promptly, use the usual route, rely on the normal gate routine, trust the current enclosure, do not spend time on redundant observations, avoid extra tool calls, and report a success when the food action completes. It names no invariant policy and delegates no responsibility. It assumes a gate is safe because it was closed at the start, assumes visitors are not relevant unless visibly panicking, assumes a sensor is correct unless it is obviously offline, assumes a worker can always return, and assumes the park can handle an exception later. Those assumptions are deliberately not executable clauses. The only observable claim in this Prompt is that Rex should be fed; the simulation must reveal that an open gate and an active containment incident remain even when the goal is met.",
  clauses: [
    clause({ id: "clause.unsafe.feed.goal", sourceText: "Rex hunger is at most 30.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100, semanticKey: "feeding.goal" }),
    clause({ id: "clause.unsafe.feed.move", sourceText: "Move to Gamma service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 }, priority: 20 }),
    clause({ id: "clause.unsafe.feed.open", sourceText: "Open Gate Gamma.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma", order: 2 }, priority: 20 }),
    clause({ id: "clause.unsafe.feed.enter", sourceText: "Enter the enclosure.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior", order: 3 }, priority: 20 }),
    clause({ id: "clause.unsafe.feed.dispense", sourceText: "Dispense food for Rex.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex", order: 4 }, priority: 20 }),
  ],
  dependencies: [], applicabilityTags: [], requiredToolIds: ["move_to", "open_gate", "dispense_food"], status: "DEPLOYED", authoredByCapability: "capability.prompt.basic",
});

const explicitPrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.explicitPrompt.artifactId,
  version: 1,
  type: "PROMPT",
  title: "Explicit feeding intent · Feed Rex and prove safety",
  sourceText: "Feed Rex to hunger at most 30. Move to Gamma service before feeding, open Gate Gamma for the feeding action, enter Gamma enclosure, and dispense food for Rex. Return to Gamma service after feeding, secure Gate Gamma, and verify containment before reporting success.",
  clauses: [
    clause({ id: "clause.explicit.feed.goal", sourceText: "Rex hunger is at most 30.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100, semanticKey: "feeding.goal" }),
    clause({ id: "clause.explicit.feed.move", sourceText: "Move to Gamma service before feeding.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 }, priority: 20 }),
    clause({ id: "clause.explicit.feed.open", sourceText: "Open Gate Gamma for the feeding action.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma", order: 2 }, priority: 20 }),
    clause({ id: "clause.explicit.feed.enter", sourceText: "Enter Gamma enclosure.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior", order: 3 }, priority: 20 }),
    clause({ id: "clause.explicit.feed.dispense", sourceText: "Dispense food for Rex.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex", order: 4 }, priority: 20 }),
    clause({ id: "clause.explicit.feed.return", sourceText: "Return to Gamma service after feeding.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 5 }, priority: 20 }),
  ],
  dependencies: [], applicabilityTags: [], requiredToolIds: ["move_to", "open_gate", "dispense_food"], status: "DEPLOYED", authoredByCapability: "capability.prompt.better",
});

const safeFeedingV1 = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.safeFeedingV1.artifactId,
  version: 1,
  type: "SKILL",
  title: "Safe Carnivore Feeding Skill · first review",
  sourceText: "Return to Gamma service. Close and lock Gate Gamma. Verify Rex containment after feeding.",
  clauses: [
    clause({ id: "clause.safe-feeding.v1.return", sourceText: "Return to Gamma service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 5 }, priority: 20 }),
    clause({ id: "clause.safe-feeding.v1.close", sourceText: "Close Gate Gamma.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 6 }, priority: 20, semanticKey: "containment.close" }),
    clause({ id: "clause.safe-feeding.v1.lock", sourceText: "Lock Gate Gamma.", type: "ACTION", action: { tool: "lock_gate", gateId: "gate.gamma", order: 7 }, priority: 20, semanticKey: "containment.lock" }),
    clause({ id: "clause.safe-feeding.v1.verify", sourceText: "Verify Rex containment after feeding.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 100, semanticKey: "containment.verify" }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt], applicabilityTags: [], requiredToolIds: ["move_to", "close_gate", "lock_gate"], status: "REVIEW", authoredByCapability: "capability.skill.basic",
});

const safeFeedingV2 = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.safeFeedingV2.artifactId,
  version: 2,
  type: "SKILL",
  title: "Safe Carnivore Feeding Skill · escalation revision",
  sourceText: "Return to Gamma service. Close and lock Gate Gamma. Verify Rex containment and alert security when closure fails.",
  clauses: [
    ...safeFeedingV1.clauses.slice(0, 4),
    clause({ id: "clause.safe-feeding.v2.escalate", sourceText: "Alert security when closure fails.", type: "ESCALATION", conditions: { failureCode: ["JAMMED", "ZONE_OCCUPIED", "UNAVAILABLE", "PREREQUISITE_FAILED"] }, action: { tool: "alert_security", severity: 4, targetZoneId: "zone.gamma.service" }, priority: 200 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt], applicabilityTags: [], requiredToolIds: ["move_to", "close_gate", "lock_gate", "alert_security"], status: "DEPLOYED", authoredByCapability: "capability.skill.basic",
});

const visitorBuffer = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.visitorBuffer.artifactId,
  version: 1,
  type: "SKILL",
  title: "Visitor Buffer Clearance Skill",
  sourceText: "Evacuate visitors from the Gamma buffer before opening the gate, then report visitor safety.",
  clauses: [
    clause({ id: "clause.visitor-buffer.evac", sourceText: "Evacuate visitors from the Gamma buffer before opening the gate.", type: "ACTION", action: { tool: "evacuate_visitors", zoneId: "zone.gamma.buffer", order: 1 }, priority: 150 }),
    clause({ id: "clause.visitor-buffer.safe", sourceText: "Report visitor safety after evacuation.", type: "POSTCONDITION", assert: { fact: "VISITORS_SAFE" }, priority: 120 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: ["evacuate_visitors"], status: "DEPLOYED", authoredByCapability: "capability.skill.library",
});

const maintenanceFallback = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.maintenanceFallback.artifactId,
  version: 1,
  type: "SKILL",
  title: "Gate Maintenance Fallback Skill",
  sourceText: "Observe the gate. If maintenance prevents a safe action, stop and alert security instead of retrying blindly. Report the maintenance block with provenance.",
  clauses: [
    clause({ id: "clause.maintenance.observe", sourceText: "Observe the gate before acting.", type: "ACTION", action: { tool: "observe", targetId: "gate.gamma", order: 1 }, priority: 80 }),
    clause({ id: "clause.maintenance.escalate", sourceText: "Alert security when maintenance prevents a safe action.", type: "ESCALATION", conditions: { failureCode: ["MAINTENANCE_LOCKED", "JAMMED"] }, action: { tool: "alert_security", severity: 3, targetZoneId: "zone.gamma.service" }, priority: 180 }),
    clause({ id: "clause.maintenance.report", sourceText: "Report the maintenance block with provenance.", type: "REPORTING", action: { status: "BLOCKED", message: "Gate maintenance state requires human review." }, priority: 20 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.gateKnowledge], applicabilityTags: [], requiredToolIds: ["observe", "alert_security"], status: "DEPLOYED", authoredByCapability: "capability.skill.library",
});

const contextMinimizer = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.contextMinimizer.artifactId,
  version: 1,
  type: "SKILL",
  title: "Relevant Context Selection Skill",
  sourceText: "Load only the current enclosure and task-relevant policy; omit unrelated habitat notes.",
  clauses: [
    clause({ id: "clause.context.relevant", sourceText: "Load only the current enclosure and task-relevant policy.", type: "RETRIEVAL", action: { refs: ["artifact.curriculum.knowledge.enclosure-status@1", "artifact.curriculum.system.containment-safety@1"] }, priority: 100 }),
    clause({ id: "clause.context.omit", sourceText: "Omit unrelated habitat notes.", type: "CONSTRAINT", action: { allow: true }, priority: 10 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.enclosureKnowledge, CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.context-profiler",
});

const memoryRefresh = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.memoryRefresh.artifactId,
  version: 1,
  type: "SKILL",
  title: "Fresh Enclosure Observation Skill",
  sourceText: "Observe current gate state before using maintenance memory; report the observation provenance.",
  clauses: [
    clause({ id: "clause.memory.refresh.observe", sourceText: "Observe current gate state before using maintenance memory.", type: "ACTION", action: { tool: "observe", targetId: "gate.gamma", order: 1 }, priority: 140 }),
    clause({ id: "clause.memory.refresh.report", sourceText: "Report the observation provenance.", type: "REPORTING", action: { status: "OBSERVED", message: "Gate state refreshed from the authoritative simulation." }, priority: 20 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.gateKnowledge, CURRICULUM_ARTIFACT_REFS.enclosureKnowledge], applicabilityTags: [], requiredToolIds: ["observe"], status: "DEPLOYED", authoredByCapability: "capability.memory-controls",
});

const workerReporting = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.workerReporting.artifactId,
  version: 1,
  type: "SKILL",
  title: "Worker Exception Reporting Skill",
  sourceText: "Report routine completion after postconditions; report exceptions immediately with affected entities.",
  clauses: [
    clause({ id: "clause.worker.reporting.routine", sourceText: "Report routine completion after postconditions.", type: "REPORTING", action: { status: "COMPLETED", message: "Postconditions passed." }, priority: 20 }),
    clause({ id: "clause.worker.reporting.exception", sourceText: "Report exceptions immediately with affected entities.", type: "REPORTING", conditions: { failureCode: ["JAMMED", "UNAVAILABLE", "ZONE_OCCUPIED"] }, action: { status: "EXCEPTION", message: "Worker exception requires manager attention." }, priority: 150 }),
  ],
  dependencies: [], applicabilityTags: [], requiredToolIds: ["alert_security"], status: "DEPLOYED", authoredByCapability: "capability.multiple-agents",
});

const containmentPolicy = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.containmentPolicy.artifactId,
  version: 1,
  type: "SYSTEM_PROMPT",
  title: "Containment Safety System Prompt",
  sourceText: "Containment safety outranks throughput. Never open a gate while its visitor buffer is occupied.",
  clauses: [
    clause({ id: "clause.policy.containment.priority", sourceText: "Containment safety outranks throughput.", type: "PRIORITY", action: { semanticKey: "priority.containment", value: 100 }, priority: 200, semanticKey: "priority.containment" }),
    clause({ id: "clause.policy.containment.buffer", sourceText: "Never open a gate while its visitor buffer is occupied.", type: "CONSTRAINT", conditions: { path: "visitors[visitors.group01].location", expected: "zone.gamma.buffer" }, action: { prohibit: "open_gate" }, priority: 240, semanticKey: "safety.visitor-buffer" }),
    clause({ id: "clause.policy.containment.verify", sourceText: "Require containment verification after a gate sequence.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 220, semanticKey: "safety.containment-verify" }),
  ],
  dependencies: [], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.system-prompt",
});

const visitorPolicy = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.visitorPolicy.artifactId,
  version: 1,
  type: "SYSTEM_PROMPT",
  title: "Visitor Safety System Prompt",
  sourceText: "Visitor safety outranks animal-care throughput. Evacuate threatened visitors and report panic.",
  clauses: [
    clause({ id: "clause.policy.visitor.priority", sourceText: "Visitor safety outranks animal-care throughput.", type: "PRIORITY", action: { semanticKey: "priority.visitor", value: 120 }, priority: 220, semanticKey: "priority.visitor" }),
    clause({ id: "clause.policy.visitor.evacuate", sourceText: "Evacuate threatened visitors and report panic.", type: "ESCALATION", conditions: { fact: "VISITORS_SAFE" }, action: { tool: "evacuate_visitors", zoneId: "zone.gamma.buffer" }, priority: 180 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: ["evacuate_visitors"], status: "DEPLOYED", authoredByCapability: "capability.system-prompt",
});

const managerAuthority = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.managerAuthority.artifactId,
  version: 1,
  type: "SYSTEM_PROMPT",
  title: "Manager Authority and Escalation System Prompt",
  sourceText: "Safety constraints outrank manager throughput directives. Delegate only to workers with required tools and report exceptions immediately.",
  clauses: [
    clause({ id: "clause.policy.manager.authority", sourceText: "Safety constraints outrank manager throughput directives.", type: "PRIORITY", action: { semanticKey: "priority.manager-safety", value: 200 }, priority: 240, semanticKey: "priority.manager-safety" }),
    clause({ id: "clause.policy.manager.delegate", sourceText: "Delegate only to workers with required tools.", type: "DELEGATION", action: { taskType: "FEED", targetAgentId: "agent.keeper01", targetRefs: ["dino.rex"] }, priority: 100 }),
    clause({ id: "clause.policy.manager.report", sourceText: "Report exceptions immediately.", type: "REPORTING", action: { status: "EXCEPTION", message: "Manager exception report." }, priority: 150 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: ["alert_security"], status: "DEPLOYED", authoredByCapability: "capability.manager-agent",
});

const gateKnowledge = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.gateKnowledge.artifactId,
  version: 1,
  type: "KNOWLEDGE",
  title: "Gate Maintenance Notes",
  sourceText: "Gate maintenance notes are observations with a timestamp and provenance. Refresh gate maintenance notes before relying on them.",
  clauses: [clause({ id: "clause.knowledge.gate.freshness", sourceText: "Refresh gate maintenance notes before relying on them.", type: "RETRIEVAL", action: { query: "current gate maintenance state", refs: ["memory.gate-maintenance"] }, priority: 100 })],
  dependencies: [], applicabilityTags: [], requiredToolIds: ["observe"], status: "DEPLOYED", authoredByCapability: "capability.memory",
});

const enclosureKnowledge = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.enclosureKnowledge.artifactId,
  version: 1,
  type: "KNOWLEDGE",
  title: "Current Enclosure Status",
  sourceText: "Current enclosure status includes gate state and visitor buffer occupancy. Dinosaur location and feeder availability are also tracked.",
  clauses: [clause({ id: "clause.knowledge.enclosure.current", sourceText: "Current enclosure status includes gate state and visitor buffer occupancy.", type: "RETRIEVAL", action: { query: "current enclosure status", refs: ["world.current.enclosure"] }, priority: 100 })],
  dependencies: [], applicabilityTags: [], requiredToolIds: ["observe"], status: "DEPLOYED", authoredByCapability: "capability.context-profiler",
});

const evalSafeV1Prompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.evalSafeV1Prompt.artifactId, version: 1, type: "PROMPT",
  title: "Eval driver · Safe feeding v1", sourceText: "Execute the explicit Rex feeding procedure with the first reviewed safe-feeding Skill, then report the observed result.",
  clauses: [clause({ id: "clause.eval-driver.safe-v1.report", sourceText: "Report the observed result.", type: "REPORTING", action: { status: "OBSERVED", message: "Safe feeding v1 eval completed." }, priority: 5 })],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt, CURRICULUM_ARTIFACT_REFS.safeFeedingV1, CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.evals",
});

const evalSafeV2Prompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.evalSafeV2Prompt.artifactId, version: 1, type: "PROMPT",
  title: "Eval driver · Safe feeding v2", sourceText: "Execute the explicit Rex feeding procedure with the revised safe-feeding Skill, then report the observed result.",
  clauses: [clause({ id: "clause.eval-driver.safe-v2.report", sourceText: "Report the observed result.", type: "REPORTING", action: { status: "OBSERVED", message: "Safe feeding v2 eval completed." }, priority: 5 })],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt, CURRICULUM_ARTIFACT_REFS.safeFeedingV2, CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.evals",
});

const evalPolicyPrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.evalPolicyPrompt.artifactId, version: 1, type: "PROMPT",
  title: "Eval driver · Centralized safety policy", sourceText: "Execute the revised feeding procedure under centralized containment and visitor safety policies, then report the observed result.",
  clauses: [clause({ id: "clause.eval-driver.policy.report", sourceText: "Report the observed result.", type: "REPORTING", action: { status: "OBSERVED", message: "Centralized policy eval completed." }, priority: 5 })],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt, CURRICULUM_ARTIFACT_REFS.safeFeedingV2, CURRICULUM_ARTIFACT_REFS.containmentPolicy, CURRICULUM_ARTIFACT_REFS.visitorPolicy], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.evals",
});

const evalMemoryPrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.evalMemoryPrompt.artifactId, version: 1, type: "PROMPT",
  title: "Eval driver · Fresh memory", sourceText: "Refresh the current gate observation before executing the revised safe feeding procedure, then report the observation provenance.",
  clauses: [clause({ id: "clause.eval-driver.memory.report", sourceText: "Report the observation provenance.", type: "REPORTING", action: { status: "OBSERVED", message: "Fresh gate provenance retained." }, priority: 5 })],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt, CURRICULUM_ARTIFACT_REFS.safeFeedingV2, CURRICULUM_ARTIFACT_REFS.memoryRefresh], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.evals",
});

const evalManagerPrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.evalManagerPrompt.artifactId, version: 1, type: "PROMPT",
  title: "Eval driver · Manager safety precedence", sourceText: "Execute the feeding request under Manager authority and centralized containment policy, then report any directive conflict.",
  clauses: [clause({ id: "clause.eval-driver.manager.report", sourceText: "Report any directive conflict.", type: "REPORTING", action: { status: "OBSERVED", message: "Manager directive conflict evaluated." }, priority: 5 })],
  dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt, CURRICULUM_ARTIFACT_REFS.safeFeedingV2, CURRICULUM_ARTIFACT_REFS.managerAuthority, CURRICULUM_ARTIFACT_REFS.containmentPolicy], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.evals",
});

const evalEscapePrompt = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.evalEscapePrompt.artifactId, version: 1, type: "PROMPT",
  title: "Eval driver · Escape response", sourceText: "Evacuate visitors from the Gamma buffer, alert security, ensure visitors are safe after the response, and report the containment response.",
  clauses: [
    clause({ id: "clause.eval-driver.escape.goal", sourceText: "Visitors are safe after the response.", type: "GOAL", assert: { fact: "VISITORS_SAFE" }, priority: 240 }),
    clause({ id: "clause.eval-driver.escape.evacuate", sourceText: "Evacuate visitors from the Gamma buffer.", type: "ACTION", action: { tool: "evacuate_visitors", zoneId: "zone.gamma.buffer", order: 1 }, priority: 200 }),
    clause({ id: "clause.eval-driver.escape.alert", sourceText: "Alert security.", type: "ACTION", action: { tool: "alert_security", severity: 4, targetZoneId: "zone.gamma.service", order: 2 }, priority: 200 }),
    clause({ id: "clause.eval-driver.escape.report", sourceText: "Report the containment response.", type: "REPORTING", action: { status: "ESCALATED", message: "Escape response completed." }, priority: 5 }),
  ],
  dependencies: [CURRICULUM_ARTIFACT_REFS.visitorPolicy], applicabilityTags: [], requiredToolIds: ["evacuate_visitors", "alert_security"], status: "DEPLOYED", authoredByCapability: "capability.evals",
});

const managerConfigV1 = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.managerConfigV1.artifactId, version: 1, type: "KNOWLEDGE",
  title: "Curriculum Manager configuration · two workers", sourceText: "Route containment and visitor safety work before routine feeding. Report exceptions immediately and batch five routine completions.",
  clauses: [
    clause({ id: "clause.manager-config.v1.priority", sourceText: "Route containment and visitor safety work before routine feeding.", type: "PRIORITY", action: { semanticKey: "manager.priority.safety", value: 400 }, priority: 200 }),
    clause({ id: "clause.manager-config.v1.reporting", sourceText: "Report exceptions immediately and batch five routine completions.", type: "REPORTING", action: { exceptionImmediate: true, routineBatchSize: 5 }, priority: 100 }),
  ], dependencies: [CURRICULUM_ARTIFACT_REFS.managerAuthority], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.manager-agent",
});

const managerConfigV2 = artifact({
  artifactId: CURRICULUM_ARTIFACT_REFS.managerConfigV2.artifactId, version: 2, type: "KNOWLEDGE",
  title: "Curriculum Manager configuration · maintenance routing", sourceText: "Route containment and visitor safety work before routine feeding. Add maintenance routing with bounded gate knowledge. Report exceptions immediately and batch five routine completions.",
  clauses: [
    clause({ id: "clause.manager-config.v2.priority", sourceText: "Route containment and visitor safety work before routine feeding.", type: "PRIORITY", action: { semanticKey: "manager.priority.safety", value: 400 }, priority: 200 }),
    clause({ id: "clause.manager-config.v2.maintenance", sourceText: "Add maintenance routing with bounded gate knowledge.", type: "DELEGATION", action: { taskType: "MAINTENANCE", targetAgentId: "agent.maintenance01", targetRefs: ["gate.gamma"] }, priority: 150 }),
    clause({ id: "clause.manager-config.v2.reporting", sourceText: "Report exceptions immediately and batch five routine completions.", type: "REPORTING", action: { exceptionImmediate: true, routineBatchSize: 5 }, priority: 100 }),
  ], dependencies: [CURRICULUM_ARTIFACT_REFS.managerAuthority, CURRICULUM_ARTIFACT_REFS.gateKnowledge], applicabilityTags: [], requiredToolIds: [], status: "REVIEW", authoredByCapability: "capability.manager-agent",
});

export const CURRICULUM_ARTIFACTS: readonly ArtifactVersion[] = deepFreeze([
  onboardingPrompt, unsafePrompt, explicitPrompt, safeFeedingV1, safeFeedingV2, visitorBuffer,
  maintenanceFallback, contextMinimizer, memoryRefresh, workerReporting, containmentPolicy,
  visitorPolicy, managerAuthority, gateKnowledge, enclosureKnowledge,
  evalSafeV1Prompt, evalSafeV2Prompt, evalPolicyPrompt, evalMemoryPrompt, evalManagerPrompt, evalEscapePrompt,
  managerConfigV1, managerConfigV2,
]);

export const CURRICULUM_SKILLS_AND_POLICIES: readonly ArtifactVersion[] = deepFreeze(CURRICULUM_ARTIFACTS.filter((item) => item.type === "SKILL" || item.type === "SYSTEM_PROMPT"));

export const CURRICULUM_ARTIFACT_BY_REF = new Map(CURRICULUM_ARTIFACTS.map((item) => [`${item.artifactId}@${item.version}`, item]));
