import { createStarterFixture } from "../simulation/index.ts";
import type { ContentPack } from "./types.ts";

const prompt = {
  artifactId: "fixture.registry.prompt.feed-intent",
  version: 1,
  type: "PROMPT" as const,
  title: "Fixture Feed Intent",
  sourceText: "Feed the dinosaur and report the observed outcome.",
  clauses: [{
    id: "fixture.registry.clause.feed-goal",
    sourceText: "The dinosaur is fed.",
    type: "GOAL" as const,
    assert: { fact: "DINOSAUR_FED" },
    priority: 10,
  }],
  dependencies: [],
  applicabilityTags: ["task:feeding"],
  requiredToolIds: ["dispense_food"],
  status: "DEPLOYED" as const,
  authoredByCapability: "fixture.registry.author",
  createdAtGameTime: 0,
};

const skill = {
  artifactId: "fixture.registry.skill.safe-feed",
  version: 1,
  type: "SKILL" as const,
  title: "Fixture Safe Feeding Skill",
  sourceText: "Feed safely and report the resulting state.",
  clauses: [{
    id: "fixture.registry.clause.safe-feed",
    sourceText: "Use the food dispenser only after the target is reachable.",
    type: "ACTION" as const,
    action: { tool: "dispense_food" },
    priority: 20,
  }],
  dependencies: [{ artifactId: prompt.artifactId, version: prompt.version }],
  applicabilityTags: ["task:feeding", "safety:standard"],
  requiredToolIds: ["dispense_food"],
  status: "DRAFT" as const,
  authoredByCapability: "fixture.registry.author",
  createdAtGameTime: 0,
};

const clauseCategories = [
  "GOAL",
  "PRECONDITION",
  "ACTION",
  "SEQUENCE",
  "CONSTRAINT",
  "POSTCONDITION",
  "FALLBACK",
  "ESCALATION",
  "DELEGATION",
  "REPORTING",
  "RETRIEVAL",
  "PRIORITY",
] as const;

const clauseCoverage = {
  artifactId: "fixture.registry.system.clause-coverage",
  version: 1,
  type: "SYSTEM_PROMPT" as const,
  title: "Fixture Clause Category Coverage",
  sourceText: "Apply deterministic safety and reporting rules.",
  clauses: clauseCategories.map((type, index) => ({
    id: `fixture.registry.clause.${type.toLowerCase()}`,
    sourceText: `Fixture ${type.toLowerCase()} rule.`,
    type,
    priority: index,
    ...(type === "ACTION" ? { action: { tool: "fixture.registry.tool.audit-state" } } : {}),
  })),
  dependencies: [],
  applicabilityTags: ["fixture:contract"],
  requiredToolIds: ["fixture.registry.tool.audit-state"],
  status: "DRAFT" as const,
  authoredByCapability: "fixture.registry.author",
  createdAtGameTime: 0,
};

/** A small namespaced pack used by contract tests and docs. It is not MVP
 * curriculum prose; curriculum-content owns authored gameplay packs. */
export function createValidReferencePack(): ContentPack {
  return {
    schemaVersion: 1,
    packId: "fixture.registry.reference",
    packVersion: 1,
    artifacts: [prompt, skill, clauseCoverage],
    toolDescriptions: [{
      id: "fixture.registry.tool.audit-state",
      title: "Fixture Audit State",
      description: "Returns a deterministic fixture state audit.",
      action: "audit_state",
      requiredCapability: "fixture.registry.capability.audit",
      tags: ["fixture:contract"],
    }],
    evals: [{
      id: "fixture.registry.eval.safe-feed",
      version: 1,
      title: "Fixture Feed Goal",
      description: "The deterministic fixture reaches the feed goal.",
      tags: ["risk:low", "task:feeding"],
      buildCostCredits: 10,
      runCostCredits: 1,
      built: false,
      fixture: createStarterFixture(),
      seed: 7,
      subjectType: "SKILL",
      subjectRef: { artifactId: skill.artifactId, version: skill.version },
      assertions: [{ type: "TOOL_CALLED", toolId: "dispense_food" }],
    }],
    scenarios: [{
      id: "fixture.registry.scenario.feeding",
      version: 1,
      title: "Fixture Feeding Scenario",
      description: "A namespaced registry contract scenario.",
      tags: ["task:feeding"],
      fixture: createStarterFixture(),
      seed: 7,
      entryObjective: "Feed a dinosaur.",
      successCriteria: ["The feed tool is called."],
      recoveryCriteria: ["Escalate if containment cannot be verified."],
      artifactRefs: [{ artifactId: skill.artifactId, version: skill.version }],
    }],
    dinosaurProfiles: [{
      id: "fixture.registry.dinosaur.docile",
      version: 1,
      title: "Fixture Docile Herbivore",
      speciesId: "fixture.registry.species.docile",
      archetype: "DOCILE_HERBIVORE",
      movementProfile: {
        archetype: "DOCILE_HERBIVORE",
        wanderChanceBasisPoints: 1000,
        preferredZoneIds: ["zone.alpha.interior"],
        escapeRiskBasisPoints: 100,
      },
      tags: ["species:herbivore"],
    }],
    enclosures: [{
      id: "fixture.registry.enclosure.alpha",
      version: 1,
      title: "Fixture Alpha Enclosure",
      speciesAllowed: ["fixture.registry.species.docile"],
      hazardLevel: 1,
      tags: ["hazard:low"],
    }],
    progressions: [{
      id: "fixture.registry.progression.prompt",
      version: 1,
      title: "Fixture Prompt Foundation",
      phase: 0,
      pressure: "A task needs an explicit goal.",
      lesson: "Intent must be observable.",
      unlocks: ["fixture.registry.prompt.feed-intent"],
    }],
  };
}

export function createInvalidDiagnosticPack(): ContentPack {
  const pack = createValidReferencePack();
  return {
    ...pack,
    packId: "fixture.registry.invalid",
    artifacts: [
      { ...prompt, sourceText: "", clauses: [] },
      { ...skill, dependencies: [{ artifactId: "fixture.registry.missing", version: 1 }] },
    ],
  };
}
