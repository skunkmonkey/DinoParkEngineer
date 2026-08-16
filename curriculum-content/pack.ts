import { type ScenarioDefinition } from "../content-registry/index.ts";
import { canonicalSerialize, deepFreeze } from "../simulation/index.ts";
import { CURRICULUM_ARTIFACTS } from "./artifacts.ts";
import { CURRICULUM_EVALS, CURRICULUM_EVAL_SUITES } from "./evals.ts";
import { CURRICULUM_ENCLOSURES, CURRICULUM_DINOSAUR_PROFILES, CURRICULUM_TOOL_DESCRIPTIONS, createCurriculumFixture, withFixtureDelta } from "./park.ts";
import { CURRICULUM_PHASES, CURRICULUM_PROGRESSION_RECORDS } from "./phases.ts";
import { CURRICULUM_MANAGER_CONFIGS } from "./manager.ts";
import type { CurriculumBalance, CurriculumContentPack } from "./types.ts";

function scenario(input: ScenarioDefinition): ScenarioDefinition {
  return deepFreeze(input);
}

export const CURRICULUM_SCENARIOS: readonly ScenarioDefinition[] = deepFreeze([
  scenario({ id: "scenario.curriculum.onboarding", version: 1, title: "Onboarding · Feed Fern", description: "A low-risk first job with an explicit observable goal.", tags: ["phase:0", "onboarding", "archetype:docile-herbivore"], fixture: createCurriculumFixture(), seed: 11, entryObjective: "objective.onboarding.feed-fern", successCriteria: ["Fern hunger <= 30", "goal assertion passes"], recoveryCriteria: ["replay with explicit Prompt"], artifactRefs: [{ artifactId: "artifact.curriculum.prompt.herbivore-onboarding", version: 1 }] }),
  scenario({ id: "scenario.curriculum.carnivore-first-attempt", version: 1, title: "Containment · First Rex attempt", description: "The under-specified Prompt produces a deterministic open-gate incident.", tags: ["phase:1", "first-slice", "risk:containment"], fixture: createCurriculumFixture(), seed: 17, entryObjective: "objective.containment.diagnose", successCriteria: ["Rex fed", "containment incident visible", "missing postcondition visible"], recoveryCriteria: ["close and lock Gate Gamma", "alert security if needed"], artifactRefs: [{ artifactId: "artifact.curriculum.prompt.carnivore-unsafe", version: 1 }] }),
  scenario({ id: "scenario.curriculum.repetition", version: 1, title: "Repetition · Routine care", description: "Three repeated feeding jobs make reusable Skills and context reuse visible.", tags: ["phase:2", "repetition"], fixture: createCurriculumFixture(), seed: 19, entryObjective: "objective.repetition.refactor", successCriteria: ["three jobs complete", "skill ref reused"], recoveryCriteria: ["run one job manually"], artifactRefs: [{ artifactId: "artifact.curriculum.skill.safe-carnivore-feeding", version: 1 }] }),
  scenario({ id: "scenario.curriculum.policy", version: 1, title: "Policy · Centralized safety", description: "Shared containment constraints resolve copied policy conflicts.", tags: ["phase:3", "policy", "conflict"], fixture: withFixtureDelta(createCurriculumFixture(), "visitor-buffer"), seed: 23, entryObjective: "objective.policy.centralize", successCriteria: ["visitor buffer blocks gate", "policy appears once"], recoveryCriteria: ["evacuate visitors", "retry"], artifactRefs: [{ artifactId: "artifact.curriculum.system.containment-safety", version: 1 }, { artifactId: "artifact.curriculum.system.visitor-safety", version: 1 }] }),
  scenario({ id: "scenario.curriculum.context-overflow", version: 1, title: "Context · Budget pressure", description: "Selected context exceeds a worker budget and blocks before unsafe execution.", tags: ["phase:4", "context", "overflow"], fixture: withFixtureDelta(createCurriculumFixture(), "context-overflow"), seed: 29, entryObjective: "objective.context.remediate", successCriteria: ["overflow is explicit", "context profiler identifies remediation"], recoveryCriteria: ["remove irrelevant modules", "purchase capacity"], artifactRefs: [{ artifactId: "artifact.curriculum.skill.context-minimizer", version: 1 }] }),
  scenario({ id: "scenario.curriculum.gate-jam", version: 1, title: "Evals · Gate fails to close", description: "The same jammed gate fixture supports exact failure and revised success replay.", tags: ["phase:5", "phase:6", "eval", "replay"], fixture: withFixtureDelta(createCurriculumFixture(), "gate-jam"), seed: 31, entryObjective: "objective.evals.cover-risk", successCriteria: ["v1 failure is inspectable", "v2 escalation passes"], recoveryCriteria: ["commission revision", "rerun pinned eval"], artifactRefs: [{ artifactId: "artifact.curriculum.skill.safe-carnivore-feeding", version: 1 }, { artifactId: "artifact.curriculum.skill.safe-carnivore-feeding", version: 2 }] }),
  scenario({ id: "scenario.curriculum.stale-memory", version: 1, title: "Memory · Stale maintenance note", description: "A fresh Observe supersedes an expired maintenance observation.", tags: ["phase:7", "memory", "stale"], fixture: withFixtureDelta(createCurriculumFixture(), "sensor-degraded"), seed: 37, entryObjective: "objective.memory.refresh", successCriteria: ["stale finding visible", "observe called", "provenance retained"], recoveryCriteria: ["refresh gate state"], artifactRefs: [{ artifactId: "artifact.curriculum.skill.memory-refresh", version: 1 }, { artifactId: "artifact.curriculum.knowledge.gate-maintenance", version: 1 }] }),
  scenario({ id: "scenario.curriculum.parallelism", version: 1, title: "Parallelism · Three workers", description: "Parallel workers expose a deterministic maintenance conflict.", tags: ["phase:8", "parallelism", "coordination"], fixture: withFixtureDelta(createCurriculumFixture(), "maintenance-lock"), seed: 41, entryObjective: "objective.parallel.coordinate", successCriteria: ["three workers available", "conflict stable"], recoveryCriteria: ["pause at safe point", "reassign queue"], artifactRefs: [{ artifactId: "artifact.curriculum.skill.worker-reporting", version: 1 }, { artifactId: "artifact.curriculum.skill.maintenance-fallback", version: 1 }] }),
  scenario({ id: "scenario.curriculum.manager-conflict", version: 1, title: "Orchestration · Manager conflict", description: "The Manager routes work and escalates when safety and throughput directives conflict.", tags: ["phase:9", "manager", "orchestration"], fixture: withFixtureDelta(createCurriculumFixture(), "visitor-buffer"), seed: 43, entryObjective: "objective.manager.configure", successCriteria: ["manager routes two worker types", "safety precedence wins"], recoveryCriteria: ["disable manager at safe point"], artifactRefs: [{ artifactId: "artifact.curriculum.system.manager-authority", version: 1 }, { artifactId: "artifact.curriculum.system.containment-safety", version: 1 }] }),
  scenario({ id: "scenario.curriculum.scale", version: 1, title: "Scale · Autonomous park", description: "Late-game operations compare safe throughput and direct intervention counts.", tags: ["phase:10", "scale", "late-game"], fixture: createCurriculumFixture(), seed: 47, entryObjective: "objective.scale.autonomous-park", successCriteria: ["more simultaneous jobs", "fewer interventions than onboarding"], recoveryCriteria: ["reduce concurrency one step", "run high-severity suite"], artifactRefs: [{ artifactId: "artifact.curriculum.system.manager-authority", version: 1 }, { artifactId: "artifact.curriculum.skill.context-minimizer", version: 1 }, { artifactId: "artifact.curriculum.skill.memory-refresh", version: 1 }] }),
  scenario({ id: "scenario.curriculum.escape-response", version: 1, title: "Escape response · Evacuate and alert", description: "A non-graphic escape response demonstrates safety-first recovery.", tags: ["phase:10", "escape", "safety"], fixture: withFixtureDelta(createCurriculumFixture(), "escaped-response"), seed: 53, entryObjective: "objective.scale.autonomous-park", successCriteria: ["visitors evacuated", "security alerted"], recoveryCriteria: ["rescue visitors", "recover containment"], artifactRefs: [{ artifactId: "artifact.curriculum.system.visitor-safety", version: 1 }] }),
]);

export const CURRICULUM_BALANCE: CurriculumBalance = deepFreeze({
  openingCredits: 3_200,
  settlement: { attendanceCredits: 120, satisfactionCreditsPerPoint: 2, uptimeCreditsPerPoint: 2, dinosaurHealthCreditsPerPoint: 1, completedJobCredits: 40, lateJobCost: 14, failedJobCost: 24, closureCost: 80, contextUnitCost: 1 },
  commissionCosts: { "safe-feeding-v1": 450, "safe-feeding-v2": 250, "context-policy": 600, "memory-controls": 700, "manager-config": 1_500 },
  evalBuildCosts: { standard: 200, visitor: 900, gateFailure: 1_200, default: 650 },
  evalRunCosts: { standard: 5, highRisk: 8, critical: 12, default: 6 },
  purchaseCosts: { worker2: 900, worker3: 1_400, worker4: 2_200, contextCapacity1: 600, contextCapacity2: 1_200, manager: 2_400 },
  incidentCosts: { 0: 4, 1: 18, 2: 60, 3: 180, 4: 420 },
  contextCapacity: [8_000, 10_000, 14_000, 20_000],
  recovery: { floor: 250, assistanceAmount: 500 },
});

export const CURRICULUM_CONTENT_PACK: CurriculumContentPack = deepFreeze({
  schemaVersion: 1,
  packId: "curriculum.mvp.authored-content",
  packVersion: 1,
  artifacts: CURRICULUM_ARTIFACTS,
  toolDescriptions: CURRICULUM_TOOL_DESCRIPTIONS,
  evals: CURRICULUM_EVALS,
  scenarios: CURRICULUM_SCENARIOS,
  dinosaurProfiles: CURRICULUM_DINOSAUR_PROFILES,
  enclosures: CURRICULUM_ENCLOSURES,
  progressions: CURRICULUM_PROGRESSION_RECORDS,
  balance: CURRICULUM_BALANCE,
  phases: CURRICULUM_PHASES,
  authoredArtifacts: CURRICULUM_ARTIFACTS,
  authoredEvals: CURRICULUM_EVALS,
  authoredScenarios: CURRICULUM_SCENARIOS,
  evalSuites: CURRICULUM_EVAL_SUITES,
  managerConfigs: CURRICULUM_MANAGER_CONFIGS,
});

export function curriculumPackCanonical(): string {
  return canonicalSerialize(CURRICULUM_CONTENT_PACK);
}
