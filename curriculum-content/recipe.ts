import type { ArtifactVersion, Clause } from "../content-registry/index.ts";
import type { CommissionRecipe } from "../engineering-workbench/index.ts";
import { deepFreeze } from "../simulation/index.ts";
import { CURRICULUM_ARTIFACT_REFS } from "./artifacts.ts";

function clause(input: Clause): Clause { return input; }

const reviewedClauses: readonly Clause[] = deepFreeze([
  clause({ id: "clause.curriculum-commission.v3.return", sourceText: "Return to Gamma service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 5 }, priority: 20 }),
  clause({ id: "clause.curriculum-commission.v3.close", sourceText: "Close Gate Gamma.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 6 }, priority: 20, semanticKey: "containment.close" }),
  clause({ id: "clause.curriculum-commission.v3.lock", sourceText: "Lock Gate Gamma.", type: "ACTION", action: { tool: "lock_gate", gateId: "gate.gamma", order: 7 }, priority: 20, semanticKey: "containment.lock" }),
  clause({ id: "clause.curriculum-commission.v3.verify", sourceText: "Verify Rex containment after feeding.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 100, semanticKey: "containment.verify" }),
]);

export const CURRICULUM_SAFE_FEEDING_RECIPE: CommissionRecipe = deepFreeze({
  ref: { artifactId: "workbench.recipe.curriculum-safe-feeding", version: 1 },
  family: "SKILL",
  output: {
    artifactId: CURRICULUM_ARTIFACT_REFS.safeFeedingV1.artifactId,
    version: 3,
    type: "SKILL",
    title: "Safe Carnivore Feeding Skill · commissioned candidate",
    sourceText: "Return to Gamma service. Close and lock Gate Gamma. Verify Rex containment after feeding.",
    clauses: reviewedClauses,
    dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "close_gate", "lock_gate"],
  },
  baseRef: CURRICULUM_ARTIFACT_REFS.safeFeedingV1,
  goal: "Commission a reviewable safe-feeding candidate, expose its missing jam escalation through Evals, then revise it.",
  author: "Park Developer",
  capabilityRequirement: "capability.skill.basic",
  requiredPhase: 1,
  prerequisites: ["capability.prompt.basic"],
  costCredits: 450,
  unlockConditions: ["Complete onboarding and observe the containment specification gap."],
  choices: [{ id: "containment-contract", label: "Containment contract", required: true, options: [{ id: "close-lock-verify", label: "Close, lock, verify", description: "Create the first review candidate; the jammed-gate Eval will expose its missing escalation." }] }],
  choiceOutputs: [{ choiceId: "containment-contract", optionId: "close-lock-verify", sourceText: "Return to Gamma service. Close and lock Gate Gamma. Verify Rex containment after feeding.", clauses: reviewedClauses }],
  expectedImpact: { sourceChanges: ["Adds explicit return, closure, and verification."], clauseChanges: ["Adds containment postcondition."], dependencyChanges: ["Reuses the explicit feeding Prompt."], toolChanges: ["Adds close and lock."], contextNote: "The first candidate remains intentionally incomplete for gate-jam escalation coverage." },
});

export function createCurriculumSafeFeedingRevision(): ArtifactVersion {
  return deepFreeze({
    artifactId: CURRICULUM_ARTIFACT_REFS.safeFeedingV1.artifactId,
    version: 4,
    type: "SKILL",
    title: "Safe Carnivore Feeding Skill · reviewed escalation revision",
    sourceText: "Return to Gamma service. Close and lock Gate Gamma. Verify Rex containment after feeding. Alert security when closure fails.",
    clauses: [...reviewedClauses, clause({ id: "clause.curriculum-commission.v4.escalate", sourceText: "Alert security when closure fails.", type: "ESCALATION", conditions: { failureCode: ["JAMMED", "ZONE_OCCUPIED", "UNAVAILABLE", "PREREQUISITE_FAILED"] }, action: { tool: "alert_security", severity: 4, targetZoneId: "zone.gamma.service" }, priority: 200 })],
    dependencies: [CURRICULUM_ARTIFACT_REFS.explicitPrompt],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "close_gate", "lock_gate", "alert_security"],
    status: "REVIEW",
    authoredByCapability: "capability.skill.basic",
    createdAtGameTime: 0,
  });
}
