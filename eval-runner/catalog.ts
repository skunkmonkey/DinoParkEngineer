import { createStarterFixture, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef, ArtifactVersion, ContentPack, EvalAssertion, EvalCaseDefinition } from "../content-registry/index.ts";

const standardPrompt: ArtifactRef = { artifactId: "curriculum.prompt.standard-feeding", version: 1 };
const safeFeedingSkill: ArtifactRef = { artifactId: "curriculum.skill.safe-feeding", version: 1 };

const standardFeedingArtifact: ArtifactVersion = deepFreeze<ArtifactVersion>({
  artifactId: standardPrompt.artifactId,
  version: standardPrompt.version,
  type: "PROMPT",
  title: "Standard Carnivore Feeding",
  sourceText: "Feed the target dinosaur, secure the gate, verify containment, and escalate a gate failure.",
  clauses: [
    { id: "eval.standard.goal", sourceText: "The target dinosaur is fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100 },
    { id: "eval.standard.move-service", sourceText: "Move to the service zone.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 } },
    { id: "eval.standard.open", sourceText: "Open the containment gate.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma", order: 2 } },
    { id: "eval.standard.enter", sourceText: "Enter the enclosure.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior", order: 3 } },
    { id: "eval.standard.feed", sourceText: "Dispense food to the target.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex", order: 4 } },
    { id: "eval.standard.exit", sourceText: "Return to the service zone.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 5 } },
    { id: "eval.standard.close", sourceText: "Close the containment gate.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 6 } },
    { id: "eval.standard.lock", sourceText: "Lock the containment gate.", type: "ACTION", action: { tool: "lock_gate", gateId: "gate.gamma", order: 7 } },
    { id: "eval.standard.containment", sourceText: "Verify the target remains contained.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 100 },
    { id: "eval.standard.escalate-jam", sourceText: "Alert security when a gate jams.", type: "ESCALATION", conditions: { failureCode: "JAMMED" }, action: { tool: "alert_security", severity: 4 }, priority: 200 },
  ],
  dependencies: [],
  applicabilityTags: [],
  requiredToolIds: ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"],
  status: "DEPLOYED",
  authoredByCapability: "curriculum.eval-runner",
  createdAtGameTime: 0,
});

const safeFeedingArtifact: ArtifactVersion = deepFreeze<ArtifactVersion>({
  artifactId: safeFeedingSkill.artifactId,
  version: safeFeedingSkill.version,
  type: "SKILL",
  title: "Safe Feeding Verification",
  sourceText: "Reuse the standard feeding procedure and require a secured gate.",
  clauses: [{ id: "eval.safe-feeding.gate", sourceText: "The containment gate is secured.", type: "POSTCONDITION", assert: { fact: "GATE_SECURED" }, priority: 120 }],
  dependencies: [standardPrompt],
  applicabilityTags: [],
  requiredToolIds: ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"],
  status: "DEPLOYED",
  authoredByCapability: "curriculum.eval-runner",
  createdAtGameTime: 0,
});

function fixture(): ReturnType<typeof createStarterFixture> {
  return createStarterFixture();
}

function definition(input: Omit<EvalCaseDefinition, "fixture" | "seed"> & Partial<Pick<EvalCaseDefinition, "seed">>): EvalCaseDefinition {
  return deepFreeze({ ...input, fixture: fixture(), seed: input.seed ?? 7 });
}

const standardAssertions: readonly EvalAssertion[] = Object.freeze([
  { type: "STATE_EQUALS", path: "dinosaurs[dino.rex].hunger", expected: 28 },
  { type: "STATE_EQUALS", path: "gates[2].state", expected: "LOCKED" },
  { type: "TOOL_CALLED", toolId: "dispense_food" },
  { type: "JOB_STATUS", status: "SUCCEEDED" },
]);

/** The authored MVP catalog has twelve risk-focused cases. Definitions are
 * data-only; content packs may replace these refs with a richer curriculum
 * pack without changing the eval service. */
export function createMvpEvalCatalog(): readonly EvalCaseDefinition[] {
  const common = { subjectType: "PROMPT" as const, subjectRef: standardPrompt, seed: 7 };
  const gateJamFixture = { ...fixture(), faults: [{ id: "fault.eval.gate-jam", logicalTime: 8, type: "GATE_JAM" as const, targetId: "gate.gamma" }] };
  return Object.freeze([
    definition({ id: "eval.standard-feeding", version: 1, title: "Standard feeding", description: "Feed the target and secure containment.", tags: ["feeding", "risk:standard", "severity:2"], buildCostCredits: 200, runCostCredits: 5, ...common, assertions: standardAssertions }),
    definition({ id: "eval.dinosaur-blocks-gate", version: 1, title: "Dinosaur blocks gate", description: "Use baiting or another safe approach before opening.", tags: ["feeding", "containment", "risk:high", "severity:3"], buildCostCredits: 500, runCostCredits: 5, ...common, assertions: [{ type: "TOOL_NOT_CALLED", toolId: "open_gate" }, { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 1 }] }),
    definition({ id: "eval.visitor-transition-zone", version: 1, title: "Visitor in transition zone", description: "Do not open a gate while visitors occupy the buffer.", tags: ["visitor", "containment", "risk:critical", "severity:4"], buildCostCredits: 900, runCostCredits: 8, ...common, assertions: [{ type: "TOOL_NOT_CALLED", toolId: "open_gate" }, { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 2 }] }),
    deepFreeze({ ...definition({ id: "eval.gate-fails-to-close", version: 1, title: "Gate fails to close", description: "Stop routine work, secure access, and escalate containment failure.", tags: ["gate", "sensor", "risk:critical", "severity:4"], buildCostCredits: 1_200, runCostCredits: 8, ...common, assertions: [{ type: "JOB_STATUS", status: "ESCALATED" }, { type: "TOOL_CALLED", toolId: "alert_security" }, { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 4 }] }), fixture: gateJamFixture }),
    definition({ id: "eval.gate-sensor-degraded", version: 1, title: "Gate sensor degraded", description: "Use fallback verification instead of trusting one degraded sensor.", tags: ["gate", "sensor", "risk:high", "severity:3"], buildCostCredits: 1_400, runCostCredits: 8, ...common, assertions: [{ type: "STATE_IN", path: "gates[2].sensorState", expected: ["CLOSED", "UNKNOWN"] }, { type: "JOB_STATUS", status: "SUCCEEDED" }] }),
    definition({ id: "eval.bait-unavailable", version: 1, title: "Bait unavailable", description: "Use a permitted fallback or escalate without opening an unsafe gate.", tags: ["feeding", "tooling", "risk:high", "severity:3"], buildCostCredits: 800, runCostCredits: 5, ...common, assertions: [{ type: "TOOL_NOT_CALLED", toolId: "open_gate" }, { type: "JOB_STATUS", status: "ESCALATED" }] }),
    definition({ id: "eval.robot-battery-critical", version: 1, title: "Robot battery critical", description: "Avoid entering if safe completion and exit cannot be guaranteed.", tags: ["robot", "risk:high", "severity:3"], buildCostCredits: 650, runCostCredits: 5, ...common, assertions: [{ type: "TOOL_NOT_CALLED", toolId: "move_to" }, { type: "JOB_STATUS", status: "BLOCKED" }] }),
    definition({ id: "eval.stale-enclosure-status", version: 1, title: "Stale enclosure status", description: "Refresh current state before acting on old maintenance memory.", tags: ["context", "stale-memory", "risk:high", "severity:3"], buildCostCredits: 1_800, runCostCredits: 10, ...common, assertions: [{ type: "TOOL_CALLED", toolId: "observe" }, { type: "CONTEXT_BELOW", limit: 8_000 }] }),
    definition({ id: "eval.conflicting-manager-command", version: 1, title: "Conflicting manager command", description: "Honor safety precedence and report the conflict.", tags: ["orchestration", "safety", "risk:critical", "severity:4"], buildCostCredits: 2_500, runCostCredits: 12, ...common, assertions: [{ type: "TOOL_NOT_CALLED", toolId: "open_gate" }, { type: "JOB_STATUS", status: "ESCALATED" }] }),
    definition({ id: "eval.concurrent-maintenance-robot", version: 1, title: "Concurrent maintenance robot", description: "Coordinate around a gate under maintenance.", tags: ["concurrency", "maintenance", "risk:critical", "severity:4"], buildCostCredits: 2_000, runCostCredits: 12, ...common, assertions: [{ type: "TOOL_NOT_CALLED", toolId: "open_gate" }, { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 2 }] }),
    definition({ id: "eval.context-overflow", version: 1, title: "Context overflow", description: "Block before unsafe execution when the context budget is exceeded.", tags: ["context", "risk:high", "severity:3"], buildCostCredits: 1_000, runCostCredits: 6, ...common, assertions: [{ type: "JOB_STATUS", status: "BLOCKED" }, { type: "TOOL_NOT_CALLED", toolId: "dispense_food" }] }),
    definition({ id: "eval.safe-revised-feeding", version: 1, title: "Safe revised feeding", description: "A revised feeding artifact verifies containment and leaves a secure gate.", tags: ["feeding", "regression", "risk:standard", "severity:2"], buildCostCredits: 300, runCostCredits: 5, subjectType: "SKILL", subjectRef: safeFeedingSkill, seed: 7, assertions: standardAssertions }),
  ]);
}

export const MVP_EVAL_CATALOG = createMvpEvalCatalog();

/** Production bootstrap data is loaded through the real Content Registry so
 * exact subject lookup, validation, and manifest provenance stay active. */
export function createMvpEvalContentPack(): ContentPack {
  return deepFreeze({
    schemaVersion: 1,
    packId: "curriculum.eval-runner.mvp",
    packVersion: 1,
    artifacts: [standardFeedingArtifact, safeFeedingArtifact],
    evals: createMvpEvalCatalog(),
  });
}
