import { deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactVersion, ContentPack } from "../content-registry/index.ts";
import type { CommissionRecipe, StructuredChoice } from "./types.ts";

const standardPrompt = { artifactId: "curriculum.prompt.standard-feeding", version: 1 } as const;
const feedingTools = ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"] as const;

export const SAFE_FEEDING_SKILL_RECIPE: CommissionRecipe = deepFreeze({
  ref: { artifactId: "workbench.recipe.safe-feeding-skill", version: 1 }, family: "SKILL",
  output: {
    artifactId: "review.skill.carnivore-feeding", version: 5, type: "SKILL", title: "Safe Carnivore Feeding Skill",
    sourceText: "Bait the dinosaur away from the gate, open only after the service zone is clear, feed, exit, close and lock the gate, verify containment, and escalate any failed closure.",
    clauses: [
      { id: "workbench.safe-feed.v5.goal", sourceText: "The target dinosaur is fed without compromising containment.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100, semanticKey: "feeding.goal" },
      { id: "workbench.safe-feed.v5.bait", sourceText: "Bait the target away from the containment gate before opening it.", type: "PRECONDITION", conditions: { dinosaurAwayFromGate: true }, action: { tool: "move_to", zoneId: "zone.gamma.service" }, priority: 120, semanticKey: "containment.bait-before-open" },
      { id: "workbench.safe-feed.v5.open", sourceText: "Open the gate only after the target is away and the service zone is clear.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma" }, priority: 130, semanticKey: "containment.open-after-bait" },
      { id: "workbench.safe-feed.v5.feed", sourceText: "Dispense food, exit, then secure the gate.", type: "SEQUENCE", action: { tool: "dispense_food", dinosaurId: "dino.rex", then: "close_gate" }, priority: 150 },
      { id: "workbench.safe-feed.v5.verify", sourceText: "Verify containment and alert security if closure cannot be verified.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, onFail: { tool: "alert_security", severity: 4 }, priority: 190, semanticKey: "containment.verify-after-feed" },
    ], dependencies: [standardPrompt], applicabilityTags: ["task:feeding", "safety:standard", "architecture:skill"], requiredToolIds: [...feedingTools],
  },
  baseRef: { artifactId: "review.skill.carnivore-feeding", version: 3 }, goal: "Replace the under-specified feeding procedure with a reusable Skill that makes baiting, closure verification, and escalation explicit.", author: "Park Developer",
  capabilityRequirement: "capability.skill.basic", requiredPhase: 1, prerequisites: ["capability.prompt.basic"], costCredits: 450,
  unlockConditions: ["Skill Design is unlocked after a containment specification gap is observed."],
  choices: [{ id: "verification-mode", label: "Verification strategy", required: true, options: [{ id: "safe-containment", label: "Safe containment + escalation", description: "Use the authored bait, close, lock, verify, and escalate clause set." }] }],
  choiceOutputs: [{ choiceId: "verification-mode", optionId: "safe-containment", sourceText: "Bait the dinosaur away from the gate, open only after the service zone is clear, feed, exit, close and lock the gate, verify containment, and escalate any failed closure.", clauses: [
    { id: "workbench.safe-feed.v5.goal", sourceText: "The target dinosaur is fed without compromising containment.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100, semanticKey: "feeding.goal" },
    { id: "workbench.safe-feed.v5.bait", sourceText: "Bait the target away from the containment gate before opening it.", type: "PRECONDITION", conditions: { dinosaurAwayFromGate: true }, action: { tool: "move_to", zoneId: "zone.gamma.service" }, priority: 120, semanticKey: "containment.bait-before-open" },
    { id: "workbench.safe-feed.v5.open", sourceText: "Open the gate only after the target is away and the service zone is clear.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma" }, priority: 130, semanticKey: "containment.open-after-bait" },
    { id: "workbench.safe-feed.v5.feed", sourceText: "Dispense food, exit, then secure the gate.", type: "SEQUENCE", action: { tool: "dispense_food", dinosaurId: "dino.rex", then: "close_gate" }, priority: 150 },
    { id: "workbench.safe-feed.v5.verify", sourceText: "Verify containment and alert security if closure cannot be verified.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, onFail: { tool: "alert_security", severity: 4 }, priority: 190, semanticKey: "containment.verify-after-feed" },
  ] }],
  expectedImpact: { sourceChanges: ["Adds bait-before-open sequencing and closure verification."], clauseChanges: ["Adds structured containment semantics."], dependencyChanges: ["Reuses the standard feeding Prompt."], toolChanges: ["Retains feeding and security Tools."], contextNote: "Adds small reusable context while removing duplicated safety prose." },
} as CommissionRecipe);

export const MEMORY_CONFIGURATION_RECIPE: CommissionRecipe = deepFreeze({
  ref: { artifactId: "workbench.recipe.memory-retention", version: 1 }, family: "MEMORY",
  output: { artifactId: "workbench.memory.shared-retention", version: 2, type: "SYSTEM_PROMPT", title: "Shared Observation Retention", sourceText: "Share verified observations for 30 minutes with provenance and freshness checks.", clauses: [{ id: "memory.shared-30", sourceText: "Retrieve only verified observations newer than 30 minutes and preserve provenance.", type: "RETRIEVAL", conditions: { scope: "shared", maxAgeMinutes: 30, provenanceRequired: true }, priority: 100, semanticKey: "memory.shared-ttl" }], dependencies: [], applicabilityTags: ["memory:shared", "safety:freshness"], requiredToolIds: [] },
  baseRef: { artifactId: "workbench.memory.shared-retention", version: 1 }, goal: "Configure an authored memory retention policy with explicit scope, freshness, and provenance.", author: "Park Developer", capabilityRequirement: "capability.memory", requiredPhase: 7, prerequisites: ["capability.review"], costCredits: 700, unlockConditions: ["Memory Controls unlock after stale observations become operationally risky."],
  choices: [{ id: "memory-policy", label: "Retention policy", required: true, options: [{ id: "shared-ttl-30", label: "Shared · 30 minute TTL", description: "Verified shared observations with provenance." }, { id: "local-session", label: "Local · session only", description: "Keep observations local to the current session." }] }],
  choiceOutputs: [
    { choiceId: "memory-policy", optionId: "shared-ttl-30", sourceText: "Share verified observations for 30 minutes with provenance and freshness checks.", clauses: [{ id: "memory.shared-30", sourceText: "Retrieve only verified observations newer than 30 minutes and preserve provenance.", type: "RETRIEVAL", conditions: { scope: "shared", maxAgeMinutes: 30, provenanceRequired: true }, priority: 100, semanticKey: "memory.shared-ttl" }], applicabilityTags: ["memory:shared", "safety:freshness"] },
    { choiceId: "memory-policy", optionId: "local-session", sourceText: "Keep observations local to the current work session and discard them when the session ends.", clauses: [{ id: "memory.local-session", sourceText: "Retrieve only observations from the current agent session.", type: "RETRIEVAL", conditions: { scope: "agent-local", lifetime: "session" }, priority: 100, semanticKey: "memory.local-session" }], applicabilityTags: ["memory:local", "safety:freshness"] },
  ],
  expectedImpact: { sourceChanges: ["Selects one authored retention policy."], clauseChanges: ["Pairs scope and freshness semantics with its source."], dependencyChanges: ["No new dependencies."], toolChanges: ["No Tools required."], contextNote: "A bounded policy controls what observations may enter context." },
} as CommissionRecipe);

export const TOOL_CONFIGURATION_RECIPE: CommissionRecipe = deepFreeze({
  ref: { artifactId: "workbench.recipe.tool-observation", version: 1 }, family: "TOOL",
  output: { artifactId: "workbench.tool.gate-observation", version: 2, type: "TOOL_DESCRIPTION", title: "Gate Observation Tool Contract", sourceText: "Observe a gate and return its state, fixture id, and diagnostic details.", clauses: [{ id: "tool.observe.diagnostic", sourceText: "Report gate state, fixture id, and diagnostics as structured fields.", type: "REPORTING", action: { tool: "observe", fields: ["gateState", "fixtureId", "diagnostics"] }, priority: 100, semanticKey: "tool.observe.schema" }], dependencies: [], applicabilityTags: ["tool:observe", "fixture:gate"], requiredToolIds: ["observe"] },
  baseRef: { artifactId: "workbench.tool.gate-observation", version: 1 }, goal: "Configure a readable Tool contract with one authored structured output schema.", author: "Park Developer", capabilityRequirement: "capability.source-inspection", requiredPhase: 2, prerequisites: ["capability.skill.basic"], costCredits: 350, unlockConditions: ["Tool configuration unlocks when repeated work needs reusable contracts."],
  choices: [{ id: "tool-schema", label: "Observation schema", required: true, options: [{ id: "diagnostic", label: "Diagnostic", description: "State, fixture identity, and diagnostics." }, { id: "minimal", label: "Minimal", description: "State and fixture identity only." }] }],
  choiceOutputs: [
    { choiceId: "tool-schema", optionId: "diagnostic", sourceText: "Observe a gate and return its state, fixture id, and diagnostic details.", clauses: [{ id: "tool.observe.diagnostic", sourceText: "Report gate state, fixture id, and diagnostics as structured fields.", type: "REPORTING", action: { tool: "observe", fields: ["gateState", "fixtureId", "diagnostics"] }, priority: 100, semanticKey: "tool.observe.schema" }], requiredToolIds: ["observe"] },
    { choiceId: "tool-schema", optionId: "minimal", sourceText: "Observe a gate and return only its state and fixture id.", clauses: [{ id: "tool.observe.minimal", sourceText: "Report gate state and fixture id as structured fields.", type: "REPORTING", action: { tool: "observe", fields: ["gateState", "fixtureId"] }, priority: 100, semanticKey: "tool.observe.schema" }], requiredToolIds: ["observe"] },
  ],
  expectedImpact: { sourceChanges: ["Selects an authored observation contract."], clauseChanges: ["Changes the exact REPORTING field schema."], dependencyChanges: ["No new dependencies."], toolChanges: ["Requires observe."], contextNote: "The selected contract makes Tool context explicit and bounded." },
} as CommissionRecipe);

export const EVAL_CONFIGURATION_RECIPE: CommissionRecipe = deepFreeze({
  ref: { artifactId: "workbench.recipe.eval-risk-suite", version: 1 }, family: "EVAL",
  output: { artifactId: "workbench.eval.feeding-risk-suite", version: 2, type: "KNOWLEDGE", title: "Feeding Risk Eval Configuration", sourceText: "Run the containment-core feeding eval set before deployment.", clauses: [{ id: "eval.containment-core", sourceText: "Require the authored containment-core eval references.", type: "CONSTRAINT", assert: { evalRefs: ["eval.gate-secured@1", "eval.dinosaur-contained@1"] }, priority: 100, semanticKey: "eval.required-suite" }], dependencies: [], applicabilityTags: ["eval:feeding", "risk:containment"], requiredToolIds: [] },
  baseRef: { artifactId: "workbench.eval.feeding-risk-suite", version: 1 }, goal: "Configure which authored Eval references are required for a feeding change.", author: "Park Developer", capabilityRequirement: "capability.evals", requiredPhase: 5, prerequisites: ["capability.context-meter"], costCredits: 600, unlockConditions: ["Eval configuration unlocks after a production edge case reveals coverage risk."],
  choices: [{ id: "risk-profile", label: "Risk profile", required: true, options: [{ id: "containment-core", label: "Containment core", description: "Gate secured and dinosaur contained." }, { id: "edge-risk", label: "Containment + edge risk", description: "Adds jammed-gate escalation coverage." }] }],
  choiceOutputs: [
    { choiceId: "risk-profile", optionId: "containment-core", sourceText: "Run the containment-core feeding eval set before deployment.", clauses: [{ id: "eval.containment-core", sourceText: "Require the authored containment-core eval references.", type: "CONSTRAINT", assert: { evalRefs: ["eval.gate-secured@1", "eval.dinosaur-contained@1"] }, priority: 100, semanticKey: "eval.required-suite" }], applicabilityTags: ["eval:feeding", "risk:containment"] },
    { choiceId: "risk-profile", optionId: "edge-risk", sourceText: "Run containment and jammed-gate escalation evals before deployment.", clauses: [{ id: "eval.edge-risk", sourceText: "Require containment and jammed-gate escalation eval references.", type: "CONSTRAINT", assert: { evalRefs: ["eval.gate-secured@1", "eval.dinosaur-contained@1", "eval.jammed-gate-escalation@1"] }, priority: 100, semanticKey: "eval.required-suite" }], applicabilityTags: ["eval:feeding", "risk:containment", "risk:edge"] },
  ],
  expectedImpact: { sourceChanges: ["Selects one authored Eval risk profile."], clauseChanges: ["Changes the exact required Eval references."], dependencyChanges: ["No runtime dependency is invented."], toolChanges: ["No Tools required."], contextNote: "The configuration records coverage intent without executing arbitrary prose." },
} as CommissionRecipe);

export const DEFAULT_COMMISSION_RECIPES: readonly CommissionRecipe[] = deepFreeze([SAFE_FEEDING_SKILL_RECIPE, TOOL_CONFIGURATION_RECIPE, EVAL_CONFIGURATION_RECIPE, MEMORY_CONFIGURATION_RECIPE]);

export function createWorkbenchBaselineContentPack(): ContentPack {
  const base = (recipe: CommissionRecipe): ArtifactVersion => ({ artifactId: recipe.output.artifactId, version: 1, type: recipe.output.type, title: `${recipe.output.title} · Baseline`, sourceText: "Baseline configuration. Commission a reviewed authored version before changing production behavior.", clauses: [{ id: `${recipe.output.artifactId}.baseline`, sourceText: "Preserve the baseline until an exact reviewed version is deployed.", type: "CONSTRAINT", assert: { baseline: true }, priority: 100 }], dependencies: [], applicabilityTags: ["workbench:baseline"], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "capability.prompt.basic", createdAtGameTime: 0 });
  return deepFreeze({ schemaVersion: 1, packId: "engineering-workbench.baselines", packVersion: 1, artifacts: [base(TOOL_CONFIGURATION_RECIPE), base(EVAL_CONFIGURATION_RECIPE), base(MEMORY_CONFIGURATION_RECIPE)] });
}

export function recipeArtifact(recipe: CommissionRecipe, choices: readonly StructuredChoice[] = []): ArtifactVersion {
  let selected = { title: recipe.output.title, sourceText: recipe.output.sourceText, clauses: recipe.output.clauses, dependencies: recipe.output.dependencies, applicabilityTags: recipe.output.applicabilityTags, requiredToolIds: recipe.output.requiredToolIds };
  for (const choice of choices) {
    const variant = recipe.choiceOutputs?.find((item) => item.choiceId === choice.id && item.optionId === choice.optionId);
    if (variant) selected = { title: variant.title ?? selected.title, sourceText: variant.sourceText, clauses: variant.clauses, dependencies: variant.dependencies ?? selected.dependencies, applicabilityTags: variant.applicabilityTags ?? selected.applicabilityTags, requiredToolIds: variant.requiredToolIds ?? selected.requiredToolIds };
  }
  return deepFreeze({ artifactId: recipe.output.artifactId, version: recipe.output.version, type: recipe.output.type, title: selected.title, sourceText: selected.sourceText, clauses: deepClone(selected.clauses), dependencies: deepClone(selected.dependencies), applicabilityTags: deepClone(selected.applicabilityTags), requiredToolIds: deepClone(selected.requiredToolIds), status: "REVIEW", authoredByCapability: recipe.capabilityRequirement ?? "capability.prompt.basic", createdAtGameTime: 0 });
}
