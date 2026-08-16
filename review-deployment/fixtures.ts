import type { ContentPack } from "../content-registry/index.ts";

const tools = ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"] as const;

/** A small v3/v4 pair used by the Reviews route and contract tests. The
 * records are immutable registry content; the review service owns workflow
 * state, eval associations, and deployment history. */
export function createReviewDemoContentPack(): ContentPack {
  return {
    schemaVersion: 1,
    packId: "review-deployment.demo",
    packVersion: 1,
    artifacts: [
      {
        artifactId: "review.skill.carnivore-feeding",
        version: 3,
        type: "SKILL",
        title: "Carnivore Feeding Skill",
        sourceText: "Feed Rex.",
        clauses: [{ id: "review.feed.v3.goal", sourceText: "The dinosaur is fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100 }],
        dependencies: [],
        applicabilityTags: ["task:feeding"],
        requiredToolIds: [...tools],
        status: "DEPLOYED",
        authoredByCapability: "review-demo",
        createdAtGameTime: 3,
      },
      {
        artifactId: "review.skill.carnivore-feeding",
        version: 4,
        type: "SKILL",
        title: "Carnivore Feeding Skill",
        sourceText: "Feed Rex, secure the gate, verify containment, and escalate a failed closure.",
        clauses: [
          { id: "review.feed.v4.goal", sourceText: "The dinosaur is fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 100 },
          { id: "review.feed.v4.postcondition", sourceText: "After feeding, verify the dinosaur remains contained.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 120 },
          { id: "review.feed.v4.escalation", sourceText: "Escalate when the gate cannot be secured.", type: "ESCALATION", conditions: { failureCode: "JAMMED" }, action: { tool: "alert_security", severity: 4 }, priority: 200 },
        ],
        dependencies: [{ artifactId: "curriculum.prompt.standard-feeding", version: 1 }],
        applicabilityTags: ["task:feeding", "safety:standard"],
        requiredToolIds: [...tools],
        status: "REVIEW",
        authoredByCapability: "review-demo",
        createdAtGameTime: 4,
      },
    ],
  };
}

