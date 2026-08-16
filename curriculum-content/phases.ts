import { type ArtifactRef, type ProgressionDefinition } from "../content-registry/index.ts";
import { deepFreeze } from "../simulation/index.ts";
import { CURRICULUM_ARTIFACT_REFS } from "./artifacts.ts";
import { CURRICULUM_FIXTURE_ID } from "./park.ts";
import type { CurriculumPhaseDefinition } from "./types.ts";

function evalRef(id: string): ArtifactRef {
  return { artifactId: id, version: 1 };
}

function phase(input: CurriculumPhaseDefinition): CurriculumPhaseDefinition {
  return deepFreeze(input);
}

export const CURRICULUM_PHASES: readonly CurriculumPhaseDefinition[] = deepFreeze([
  phase({
    id: "phase.curriculum.00-onboarding", version: 1, phase: 0, title: "Onboarding",
    pressure: "One low-risk herbivore job needs an explicit completion condition.",
    lesson: "A Prompt names an observable goal and completion condition.",
    unlocks: ["capability.prompt.basic", "objective.onboarding.feed-fern"], prerequisites: [],
    entrySignals: ["new-game"], fixtureId: CURRICULUM_FIXTURE_ID, fixtureDelta: { dinosaur: "dino.fern", risk: "low" },
    objectives: [{ id: "objective.onboarding.feed-fern", title: "Feed Fern", description: "Select the onboarding Prompt and complete the herbivore feeding job.", completionSignals: ["job.succeeded", "goal.observable"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.onboardingPrompt],
    availableEvalRefs: [evalRef("eval.curriculum.standard-feeding")],
    teachingIncident: { id: "incident.curriculum.onboarding.missed-goal", trigger: "job-without-observable-goal", severity: 1, diagnosis: "The task completed without proving the animal-care result.", spoilerSafeHint: "Inspect the trace assertions after a surprising completion." },
    successAssertions: ["Fern hunger <= 30", "Trace includes GOAL assertion"],
    recovery: { id: "recovery.curriculum.onboarding", label: "Replay onboarding Prompt", steps: ["Return to the job card", "Select the explicit goal Prompt", "Run the job again"], preventsDeadEnd: true },
    completionOutputs: ["trace.inspection", "capability.prompt.basic"], interventionTarget: 1,
  }),
  phase({
    id: "phase.curriculum.01-containment", version: 1, phase: 1, title: "Containment",
    pressure: "Gate sequencing exposes a missing safety postcondition.",
    lesson: "Intent is not a specification; verify outcomes after the action.",
    unlocks: ["capability.prompt.better", "capability.skill.basic", "objective.containment.diagnose"], prerequisites: ["objective.onboarding.feed-fern"],
    entrySignals: ["objective.onboarding.feed-fern", "containment.pressure"], fixtureId: "scenario.curriculum.carnivore-first-attempt", fixtureDelta: { dinosaur: "dino.rex", gate: "gate.gamma", firstSlice: true },
    objectives: [{ id: "objective.containment.diagnose", title: "Diagnose the missing postcondition", description: "Run the first Rex Prompt, inspect the incident Trace, and identify the absent containment check.", completionSignals: ["incident.containment.open", "trace.missing-postcondition"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.unsafePrompt, CURRICULUM_ARTIFACT_REFS.explicitPrompt],
    availableEvalRefs: [evalRef("eval.curriculum.standard-feeding"), evalRef("eval.curriculum.dinosaur-blocks-gate")],
    teachingIncident: { id: "incident.curriculum.containment.open-gate", trigger: "gate-open-near-dinosaur", severity: 3, diagnosis: "Rex was fed, but the gate remained unsecured because no postcondition required closure.", spoilerSafeHint: "Compare the selected clauses with the world state at the incident timestamp." },
    successAssertions: ["Rex hunger <= 30", "Trace shows absent POSTCONDITION", "Incident is recoverable"],
    recovery: { id: "recovery.curriculum.containment", label: "Secure Gamma", steps: ["Move to Gamma service", "Close Gate Gamma", "Lock Gate Gamma", "Verify containment"], preventsDeadEnd: true, assistanceCostCredits: 40 },
    completionOutputs: ["commission.safe-feeding", "trace.containment-diagnosis"], interventionTarget: 1,
  }),
  phase({
    id: "phase.curriculum.02-repetition", version: 1, phase: 2, title: "Repetition",
    pressure: "Routine feeding jobs repeat the same gate instructions and context cost.",
    lesson: "Repeated behavior belongs in a reusable Skill, not duplicated task Prompts.",
    unlocks: ["capability.skill-library", "capability.source-inspection", "objective.repetition.refactor"], prerequisites: ["objective.containment.diagnose"],
    entrySignals: ["repetition.pressure"], fixtureId: CURRICULUM_FIXTURE_ID, fixtureDelta: { routineJobs: 3, repeatedClauses: 3 },
    objectives: [{ id: "objective.repetition.refactor", title: "Refactor repeated feeding", description: "Use the authored Skill recipe for multiple feeding jobs and compare context composition.", completionSignals: ["skill.selected", "duplicate-context.visible", "jobs.completed"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.safeFeedingV1, CURRICULUM_ARTIFACT_REFS.visitorBuffer, CURRICULUM_ARTIFACT_REFS.maintenanceFallback],
    availableEvalRefs: [evalRef("eval.curriculum.standard-feeding"), evalRef("eval.curriculum.safe-revised-feeding")],
    teachingIncident: { id: "incident.curriculum.repetition.duplicate-policy", trigger: "repeated-instructions", severity: 0, diagnosis: "The same containment prose is loaded for every routine job.", spoilerSafeHint: "Open the context composition and inspect repeated semantic keys." },
    successAssertions: ["Three jobs reuse one Skill ref", "No job is blocked by missing tools", "Context delta is visible"],
    recovery: { id: "recovery.curriculum.repetition", label: "Use the baseline Prompt", steps: ["Keep the explicit Prompt selected", "Run one job at a time", "Earn credits for safe completion"], preventsDeadEnd: true },
    completionOutputs: ["skill.library", "context.duplicate-finding"], interventionTarget: 3,
  }),
  phase({
    id: "phase.curriculum.03-policy", version: 1, phase: 3, title: "Policy",
    pressure: "Visitor and containment rules are duplicated across Skills.",
    lesson: "Move invariant rules into a centralized System Prompt.",
    unlocks: ["capability.system-prompt", "objective.policy.centralize"], prerequisites: ["objective.repetition.refactor"],
    entrySignals: ["policy.pressure"], fixtureId: CURRICULUM_FIXTURE_ID, fixtureDelta: { duplicatedPolicy: true, visitors: "buffer-sensitive" },
    objectives: [{ id: "objective.policy.centralize", title: "Centralize containment policy", description: "Reference the Containment Safety System Prompt and remove duplicate safety clauses from a Skill.", completionSignals: ["system-prompt.selected", "dependency.graph.visible", "context.cost.reduced"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy, CURRICULUM_ARTIFACT_REFS.visitorPolicy],
    availableEvalRefs: [evalRef("eval.curriculum.visitor-transition-zone"), evalRef("eval.curriculum.conflicting-manager-command")],
    teachingIncident: { id: "incident.curriculum.policy.duplicate-conflict", trigger: "duplicated-policy", severity: 2, diagnosis: "Two copied safety clauses disagree about whether visitor throughput can outrank containment.", spoilerSafeHint: "Inspect the conflict winner and its tier in the Trace." },
    successAssertions: ["System Prompt appears once in context", "Visitor buffer constraint wins by precedence", "Context cost is lower than duplicated design"],
    recovery: { id: "recovery.curriculum.policy", label: "Re-enable standard safety Skill", steps: ["Select the reviewed safe Skill", "Keep the System Prompt enabled", "Run the visitor-buffer eval"], preventsDeadEnd: true },
    completionOutputs: ["system-prompt.containment", "conflict.precedence"], interventionTarget: 3,
  }),
  phase({
    id: "phase.curriculum.04-context", version: 1, phase: 4, title: "Context pressure",
    pressure: "A small context budget is exceeded by irrelevant and duplicate modules.",
    lesson: "Relevant context is better than maximal context; capacity does not fix bloat.",
    unlocks: ["capability.context-meter", "capability.context-profiler", "capability.context-capacity", "objective.context.remediate"], prerequisites: ["objective.policy.centralize"],
    entrySignals: ["context.pressure"], fixtureId: "scenario.curriculum.context-overflow", fixtureDelta: { contextBudget: 1, irrelevantModules: 4 },
    objectives: [{ id: "objective.context.remediate", title: "Remediate context pressure", description: "Inspect load, remove irrelevant modules, and choose a capacity investment only when it has a measured benefit.", completionSignals: ["context.finding.visible", "context.below-budget", "context.delta.compared"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.contextMinimizer, CURRICULUM_ARTIFACT_REFS.enclosureKnowledge],
    availableEvalRefs: [evalRef("eval.curriculum.context-overflow"), evalRef("eval.curriculum.stale-enclosure-status")],
    teachingIncident: { id: "incident.curriculum.context.overflow", trigger: "context-budget-exceeded", severity: 2, diagnosis: "The worker was blocked before execution because selected context exceeded its budget.", spoilerSafeHint: "Read the context breakdown; selected items are never silently dropped." },
    successAssertions: ["Overflow is explicit", "No unsafe tool runs while blocked", "Modular context is cheaper than duplicated policy"],
    recovery: { id: "recovery.curriculum.context", label: "Context recovery", steps: ["Remove unrelated modules", "Run the context profiler", "Purchase one capacity upgrade only if needed"], preventsDeadEnd: true, assistanceCostCredits: 80 },
    completionOutputs: ["context.profiler", "context.capacity-upgrade"], interventionTarget: 2,
  }),
  phase({
    id: "phase.curriculum.05-evals", version: 1, phase: 5, title: "Evals",
    pressure: "A production edge case reveals that one successful demo is not confidence.",
    lesson: "Expected behaviors need repeatable, risk-based Eval coverage.",
    unlocks: ["capability.evals", "capability.eval-suites", "capability.replay", "objective.evals.cover-risk"], prerequisites: ["objective.context.remediate"],
    entrySignals: ["eval.pressure"], fixtureId: "scenario.curriculum.gate-jam", fixtureDelta: { gateFault: "JAMMED", uncoveredIncident: true },
    objectives: [{ id: "objective.evals.cover-risk", title: "Cover the risky path", description: "Build the three starter evals, run the Gate Fails to Close case, and inspect the failing assertion.", completionSignals: ["eval.selected", "eval.failed-intentionally", "replay.exact"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.safeFeedingV1, CURRICULUM_ARTIFACT_REFS.safeFeedingV2],
    availableEvalRefs: [evalRef("eval.curriculum.standard-feeding"), evalRef("eval.curriculum.visitor-transition-zone"), evalRef("eval.curriculum.gate-fails-to-close"), evalRef("eval.curriculum.food-dispenser-offline")],
    teachingIncident: { id: "incident.curriculum.evals.uncovered-gate", trigger: "gate-fails-to-close", severity: 4, diagnosis: "The first Skill passed the happy path but had no escalation when the gate jammed.", spoilerSafeHint: "Compare expected assertions with observed tool calls and replay the same fixture." },
    successAssertions: ["At least three evals selected", "Gate Fails to Close fails before revision", "Failure replay is exact"],
    recovery: { id: "recovery.curriculum.evals", label: "Run starter suite", steps: ["Build Standard feeding", "Build Visitor transition zone", "Build Gate fails to close", "Inspect the failure"], preventsDeadEnd: true, assistanceCostCredits: 120 },
    completionOutputs: ["eval.catalog.12-plus", "eval.replay", "eval.incident-conversion"], interventionTarget: 2,
  }),
  phase({
    id: "phase.curriculum.06-review", version: 1, phase: 6, title: "Change discipline",
    pressure: "A Skill optimization risks a regression when a safety clause is removed.",
    lesson: "Inspect the diff, select evals, run them, then deploy intentionally.",
    unlocks: ["capability.review", "capability.deployment", "objective.review.deploy-safe"], prerequisites: ["objective.evals.cover-risk"],
    entrySignals: ["review.pressure"], fixtureId: "scenario.curriculum.gate-jam", fixtureDelta: { proposedVersion: 2, reviewRequired: true },
    objectives: [{ id: "objective.review.deploy-safe", title: "Deploy a reviewed revision", description: "Revise the failed Skill with explicit escalation, pass the selected suite, and deploy the exact version.", completionSignals: ["diff.inspected", "evals.passed", "artifact.deployed"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.safeFeedingV2, CURRICULUM_ARTIFACT_REFS.containmentPolicy],
    availableEvalRefs: [evalRef("eval.curriculum.gate-fails-to-close"), evalRef("eval.curriculum.safe-revised-feeding"), evalRef("eval.curriculum.gate-sensor-degraded")],
    teachingIncident: { id: "incident.curriculum.review.regression", trigger: "unreviewed-safety-change", severity: 3, diagnosis: "A context optimization removed the only closure failure escalation.", spoilerSafeHint: "Use the semantic diff and context delta before changing lifecycle state." },
    successAssertions: ["Review shows source and semantic diff", "Selected evals pass", "Deployment pins exact refs"],
    recovery: { id: "recovery.curriculum.review", label: "Revert to deployed version", steps: ["Open Reviews", "Restore the previous deployed Skill", "Run the known-good suite"], preventsDeadEnd: true },
    completionOutputs: ["review.diff", "deployment.pinned-version"], interventionTarget: 1,
  }),
  phase({
    id: "phase.curriculum.07-memory", version: 1, phase: 7, title: "Memory",
    pressure: "Changing maintenance conditions make stale observations harmful.",
    lesson: "Memory has freshness, scope, provenance, and retention—not just content.",
    unlocks: ["capability.memory", "capability.memory-controls", "objective.memory.refresh"], prerequisites: ["objective.review.deploy-safe"],
    entrySignals: ["memory.pressure"], fixtureId: "scenario.curriculum.stale-memory", fixtureDelta: { staleMemory: true, maintenanceChanged: true },
    objectives: [{ id: "objective.memory.refresh", title: "Refresh stale maintenance context", description: "Detect stale gate notes, observe current state, and retain provenance in the trace.", completionSignals: ["stale.finding.visible", "observe.called", "provenance.present"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.memoryRefresh, CURRICULUM_ARTIFACT_REFS.gateKnowledge, CURRICULUM_ARTIFACT_REFS.enclosureKnowledge],
    availableEvalRefs: [evalRef("eval.curriculum.stale-enclosure-status"), evalRef("eval.curriculum.gate-sensor-degraded")],
    teachingIncident: { id: "incident.curriculum.memory.stale", trigger: "stale-maintenance-memory", severity: 3, diagnosis: "A robot trusted an old gate note after maintenance state changed.", spoilerSafeHint: "Inspect freshness status and provenance in Context, then refresh with Observe." },
    successAssertions: ["Stale memory is labeled", "Fresh observation supersedes stale note", "Trace retains provenance"],
    recovery: { id: "recovery.curriculum.memory", label: "Refresh from simulation", steps: ["Observe the gate", "Discard expired memory", "Retry after current state is in context"], preventsDeadEnd: true },
    completionOutputs: ["memory.freshness-controls", "memory.provenance"], interventionTarget: 1,
  }),
  phase({
    id: "phase.curriculum.08-parallelism", version: 1, phase: 8, title: "Parallelism",
    pressure: "Additional workers increase throughput and coordination/context-switching load.",
    lesson: "Parallel agents create coordination cost; tools and context must be routed deliberately.",
    unlocks: ["capability.multiple-agents", "capability.worker-queues", "objective.parallel.coordinate"], prerequisites: ["objective.memory.refresh"],
    entrySignals: ["parallel.pressure"], fixtureId: CURRICULUM_FIXTURE_ID, fixtureDelta: { workers: 3, simultaneousJobs: 3 },
    objectives: [{ id: "objective.parallel.coordinate", title: "Coordinate worker queues", description: "Run three simultaneous care jobs without two workers claiming one maintenance-locked gate.", completionSignals: ["workers.3", "coordination.conflict-visible", "jobs.safe"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.workerReporting, CURRICULUM_ARTIFACT_REFS.maintenanceFallback],
    availableEvalRefs: [evalRef("eval.curriculum.concurrent-maintenance-robot"), evalRef("eval.curriculum.robot-battery-critical")],
    teachingIncident: { id: "incident.curriculum.parallelism.race", trigger: "concurrent-maintenance-robot", severity: 4, diagnosis: "Two workers attempted the same gate while maintenance held the lock.", spoilerSafeHint: "Inspect stable resource reservations and worker context availability." },
    successAssertions: ["Three workers can run", "Resource conflict is deterministic", "No safety incident is hidden by a race"],
    recovery: { id: "recovery.curriculum.parallelism", label: "Return one job to queue", steps: ["Pause at a safe point", "Reassign the queued job", "Keep the maintenance lock authoritative"], preventsDeadEnd: true, assistanceCostCredits: 140 },
    completionOutputs: ["worker.3", "coordination.trace"], interventionTarget: 3,
  }),
  phase({
    id: "phase.curriculum.09-orchestration", version: 1, phase: 9, title: "Orchestration",
    pressure: "Manual attention is overloaded by simultaneous jobs and exceptions.",
    lesson: "Managers need explicit authority, priorities, routing, escalation, and reporting contracts.",
    unlocks: ["capability.manager-agent", "manager.agent", "objective.manager.configure"], prerequisites: ["objective.parallel.coordinate"],
    entrySignals: ["orchestration.pressure"], fixtureId: "scenario.curriculum.manager-conflict", fixtureDelta: { workers: 3, manager: true, simultaneousJobs: 4 },
    objectives: [{ id: "objective.manager.configure", title: "Configure a Manager Agent", description: "Route feeding to keepers, visitor response to security, and exceptions to the player.", completionSignals: ["manager.active", "delegation.routed", "escalation.reported"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.managerAuthority, CURRICULUM_ARTIFACT_REFS.containmentPolicy, CURRICULUM_ARTIFACT_REFS.workerReporting],
    availableEvalRefs: [evalRef("eval.curriculum.conflicting-manager-command"), evalRef("eval.curriculum.concurrent-maintenance-robot")],
    teachingIncident: { id: "incident.curriculum.orchestration.manager-context", trigger: "manager-context-overflow", severity: 3, diagnosis: "The Manager loaded worker-level details and had no context room for park-wide priorities.", spoilerSafeHint: "Inspect routed versus omitted context and the delegation report contract." },
    successAssertions: ["Manager routes two worker types", "Safety wins conflicting directive", "Exceptions are reported immediately"],
    recovery: { id: "recovery.curriculum.orchestration", label: "Disable Manager safely", steps: ["Pause new assignments", "Drain worker queues", "Return to manual dispatch"], preventsDeadEnd: true, assistanceCostCredits: 200 },
    completionOutputs: ["manager.config.v1", "manager.routing", "manager.reports"], interventionTarget: 2,
  }),
  phase({
    id: "phase.curriculum.10-scale", version: 1, phase: 10, title: "Scale",
    pressure: "Many habitats, incidents, and deadlines require system-level routing.",
    lesson: "Architect systems and regression coverage, not individual tasks.",
    unlocks: ["capability.advanced-routing", "capability.automation-goals", "objective.scale.autonomous-park"], prerequisites: ["objective.manager.configure"],
    entrySignals: ["scale.pressure"], fixtureId: CURRICULUM_FIXTURE_ID, fixtureDelta: { workers: 3, manager: true, simultaneousJobs: 6, target: "fewer-interventions" },
    objectives: [{ id: "objective.scale.autonomous-park", title: "Operate a safe autonomous park", description: "Complete more simultaneous work with fewer direct interventions than the onboarding baseline.", completionSignals: ["safe.jobs.scaled", "interventions.late < interventions.early", "eval.coverage.severity-3-plus"] }],
    availableRefs: [CURRICULUM_ARTIFACT_REFS.managerAuthority, CURRICULUM_ARTIFACT_REFS.contextMinimizer, CURRICULUM_ARTIFACT_REFS.memoryRefresh],
    availableEvalRefs: [evalRef("eval.curriculum.safe-revised-feeding"), evalRef("eval.curriculum.escape-response"), evalRef("eval.curriculum.context-overflow")],
    teachingIncident: { id: "incident.curriculum.scale.coverage-gap", trigger: "scale-uncovered-risk", severity: 3, diagnosis: "Scale created more paths than the current high-severity eval coverage could observe.", spoilerSafeHint: "Compare intervention counts with severity-weighted eval coverage before expanding again." },
    successAssertions: ["At least three concurrent workers complete safe jobs", "Manager reports exceptions", "Late interventions are fewer than early baseline"],
    recovery: { id: "recovery.curriculum.scale", label: "Safe scale fallback", steps: ["Reduce concurrency by one worker", "Keep Manager routing active", "Run the high-severity suite before expanding again"], preventsDeadEnd: true, assistanceCostCredits: 250 },
    completionOutputs: ["scale.autonomous-goal", "regression.suite.high-severity", "intervention.comparison"], interventionTarget: 1,
  }),
] as CurriculumPhaseDefinition[]);

export const CURRICULUM_PROGRESSION_RECORDS: readonly ProgressionDefinition[] = deepFreeze(CURRICULUM_PHASES.map((item): ProgressionDefinition => ({
  id: item.id,
  version: item.version,
  title: item.title,
  phase: item.phase,
  pressure: item.pressure,
  lesson: item.lesson,
  unlocks: item.unlocks,
  prerequisites: item.prerequisites,
})));

export function phaseByNumber(number: number): CurriculumPhaseDefinition | undefined {
  return CURRICULUM_PHASES.find((item) => item.phase === number);
}

export function phaseById(id: string): CurriculumPhaseDefinition | undefined {
  return CURRICULUM_PHASES.find((item) => item.id === id);
}
