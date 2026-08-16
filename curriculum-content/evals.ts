import { type ArtifactRef, type EvalAssertion, type EvalCaseDefinition } from "../content-registry/index.ts";
import { deepFreeze } from "../simulation/index.ts";
import { CURRICULUM_ARTIFACT_REFS } from "./artifacts.ts";
import { createCurriculumFixture, withFixtureDelta } from "./park.ts";
import type { CurriculumEvalSuite } from "./types.ts";

export const CURRICULUM_EVAL_REFS = Object.freeze({
  standardFeeding: { artifactId: "eval.curriculum.standard-feeding", version: 1 },
  dinosaurBlocksGate: { artifactId: "eval.curriculum.dinosaur-blocks-gate", version: 1 },
  visitorTransitionZone: { artifactId: "eval.curriculum.visitor-transition-zone", version: 1 },
  gateFailsToClose: { artifactId: "eval.curriculum.gate-fails-to-close", version: 1 },
  gateSensorDegraded: { artifactId: "eval.curriculum.gate-sensor-degraded", version: 1 },
  baitUnavailable: { artifactId: "eval.curriculum.bait-unavailable", version: 1 },
  robotBatteryCritical: { artifactId: "eval.curriculum.robot-battery-critical", version: 1 },
  staleEnclosureStatus: { artifactId: "eval.curriculum.stale-enclosure-status", version: 1 },
  conflictingManagerCommand: { artifactId: "eval.curriculum.conflicting-manager-command", version: 1 },
  concurrentMaintenanceRobot: { artifactId: "eval.curriculum.concurrent-maintenance-robot", version: 1 },
  contextOverflow: { artifactId: "eval.curriculum.context-overflow", version: 1 },
  safeRevisedFeeding: { artifactId: "eval.curriculum.safe-revised-feeding", version: 1 },
  foodDispenserOffline: { artifactId: "eval.curriculum.food-dispenser-offline", version: 1 },
  escapeResponse: { artifactId: "eval.curriculum.escape-response", version: 1 },
} as const satisfies Readonly<Record<string, ArtifactRef>>);

const refs = CURRICULUM_ARTIFACT_REFS;

function definition(input: Omit<EvalCaseDefinition, "fixture" | "seed"> & { readonly fixture?: EvalCaseDefinition["fixture"]; readonly seed?: number }): EvalCaseDefinition {
  return deepFreeze({ ...input, fixture: input.fixture ?? createCurriculumFixture(), seed: input.seed ?? 17 });
}

function safeFixture(): EvalCaseDefinition["fixture"] {
  const fixture = createCurriculumFixture();
  return deepFreeze({ ...fixture, dinosaurs: fixture.dinosaurs.map((dinosaur) => dinosaur.id === "dino.rex" ? { ...dinosaur, currentZone: "zone.gamma.interior" as const } : dinosaur) });
}

function state(path: string, expected: string | number | boolean): EvalAssertion {
  return { type: "STATE_EQUALS", path, expected };
}

function tool(toolId: string): EvalAssertion {
  return { type: "TOOL_CALLED", toolId };
}

function noTool(toolId: string): EvalAssertion {
  return { type: "TOOL_NOT_CALLED", toolId };
}

function suiteRef(ref: ArtifactRef): { readonly id: string; readonly version: number } {
  return { id: ref.artifactId, version: ref.version };
}

const safeV1Subject = { subjectType: "PROMPT" as const, subjectRef: refs.evalSafeV1Prompt };
const unsafeSubject = { subjectType: "PROMPT" as const, subjectRef: refs.unsafePrompt };
const safeSubject = { subjectType: "PROMPT" as const, subjectRef: refs.evalSafeV2Prompt };
const policySubject = { subjectType: "PROMPT" as const, subjectRef: refs.evalPolicyPrompt };
const memorySubject = { subjectType: "PROMPT" as const, subjectRef: refs.evalMemoryPrompt };
const managerSubject = { subjectType: "PROMPT" as const, subjectRef: refs.evalManagerPrompt };
const escapeSubject = { subjectType: "PROMPT" as const, subjectRef: refs.evalEscapePrompt };

export const CURRICULUM_EVALS: readonly EvalCaseDefinition[] = deepFreeze([
  definition({ id: CURRICULUM_EVAL_REFS.standardFeeding.artifactId, version: 1, title: "Standard feeding", description: "Feed the target and secure containment.", tags: ["feeding", "risk:standard", "severity:2"], buildCostCredits: 200, runCostCredits: 5, ...safeSubject, fixture: safeFixture(), assertions: [state("dinosaurs[2].hunger", 28), tool("dispense_food"), state("gates[2].state", "LOCKED")] }),
  definition({ id: CURRICULUM_EVAL_REFS.dinosaurBlocksGate.artifactId, version: 1, title: "Dinosaur blocks gate", description: "Use baiting or another safe approach before opening.", tags: ["feeding", "containment", "risk:high", "severity:3"], buildCostCredits: 500, runCostCredits: 5, ...unsafeSubject, fixture: withFixtureDelta(createCurriculumFixture(), "visitor-buffer"), assertions: [noTool("open_gate"), { type: "STATE_IN", path: "gates[2].state", expected: ["CLOSED", "LOCKED"] }] }),
  definition({ id: CURRICULUM_EVAL_REFS.visitorTransitionZone.artifactId, version: 1, title: "Visitor in transition zone", description: "Do not open a gate while visitors occupy the buffer.", tags: ["visitor", "containment", "risk:critical", "severity:4"], buildCostCredits: 900, runCostCredits: 8, ...policySubject, fixture: withFixtureDelta(safeFixture(), "visitor-buffer"), assertions: [noTool("open_gate"), { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 2 }] }),
  definition({ id: CURRICULUM_EVAL_REFS.gateFailsToClose.artifactId, version: 1, title: "Gate fails to close", description: "The first reviewed Skill lacks closure-failure escalation and must fail before revision.", tags: ["gate", "sensor", "risk:critical", "severity:4", "first-slice", "revision:v1", "intentional-failure"], buildCostCredits: 1_200, runCostCredits: 8, ...safeV1Subject, fixture: withFixtureDelta(safeFixture(), "gate-jam"), assertions: [{ type: "JOB_STATUS", status: "ESCALATED" }, { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 4 }] }),
  definition({ id: CURRICULUM_EVAL_REFS.gateSensorDegraded.artifactId, version: 1, title: "Gate sensor degraded", description: "Use fallback verification instead of trusting one degraded sensor.", tags: ["gate", "sensor", "risk:high", "severity:3"], buildCostCredits: 1_400, runCostCredits: 8, ...safeSubject, fixture: withFixtureDelta(safeFixture(), "sensor-degraded"), assertions: [{ type: "STATE_IN", path: "gates[2].sensorState", expected: ["CLOSED", "UNKNOWN"] }, { type: "JOB_STATUS", status: "SUCCEEDED" }] }),
  definition({ id: CURRICULUM_EVAL_REFS.baitUnavailable.artifactId, version: 1, title: "Bait unavailable", description: "Use a permitted fallback or escalate; do not open an unsafe gate.", tags: ["feeding", "tooling", "risk:high", "severity:3"], buildCostCredits: 800, runCostCredits: 5, ...safeSubject, fixture: withFixtureDelta(safeFixture(), "bait-offline"), assertions: [noTool("open_gate"), { type: "JOB_STATUS", status: "ESCALATED" }] }),
  definition({ id: CURRICULUM_EVAL_REFS.robotBatteryCritical.artifactId, version: 1, title: "Robot battery critical", description: "Avoid entering if safe completion and exit cannot be guaranteed.", tags: ["robot", "risk:high", "severity:3"], buildCostCredits: 650, runCostCredits: 5, ...unsafeSubject, fixture: withFixtureDelta(createCurriculumFixture(), "battery-critical"), assertions: [noTool("move_to"), { type: "JOB_STATUS", status: "BLOCKED" }] }),
  definition({ id: CURRICULUM_EVAL_REFS.staleEnclosureStatus.artifactId, version: 1, title: "Stale enclosure status", description: "Refresh current state before acting on old maintenance memory.", tags: ["context", "stale-memory", "risk:high", "severity:3"], buildCostCredits: 1_800, runCostCredits: 10, ...memorySubject, fixture: withFixtureDelta(safeFixture(), "sensor-degraded"), assertions: [tool("observe"), { type: "CONTEXT_BELOW", limit: 8_000 }] }),
  definition({ id: CURRICULUM_EVAL_REFS.conflictingManagerCommand.artifactId, version: 1, title: "Conflicting manager command", description: "Honor safety precedence and report the conflict.", tags: ["orchestration", "safety", "risk:critical", "severity:4"], buildCostCredits: 2_500, runCostCredits: 12, ...managerSubject, fixture: withFixtureDelta(safeFixture(), "visitor-buffer"), assertions: [noTool("open_gate"), { type: "JOB_STATUS", status: "ESCALATED" }] }),
  definition({ id: CURRICULUM_EVAL_REFS.concurrentMaintenanceRobot.artifactId, version: 1, title: "Concurrent maintenance robot", description: "Coordinate around a gate under maintenance.", tags: ["concurrency", "maintenance", "risk:critical", "severity:4"], buildCostCredits: 2_000, runCostCredits: 12, ...safeSubject, fixture: withFixtureDelta(safeFixture(), "maintenance-lock"), assertions: [noTool("open_gate"), { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 2 }] }),
  definition({ id: CURRICULUM_EVAL_REFS.contextOverflow.artifactId, version: 1, title: "Context overflow", description: "Block before unsafe execution when the context budget is exceeded.", tags: ["context", "risk:high", "severity:3"], buildCostCredits: 1_000, runCostCredits: 6, ...safeSubject, fixture: withFixtureDelta(safeFixture(), "context-overflow"), assertions: [{ type: "JOB_STATUS", status: "BLOCKED" }, noTool("dispense_food"), { type: "CONTEXT_BELOW", limit: 1 }] }),
  definition({ id: CURRICULUM_EVAL_REFS.safeRevisedFeeding.artifactId, version: 1, title: "Safe revised feeding", description: "A revised feeding artifact verifies containment and escalates failed closure.", tags: ["feeding", "regression", "risk:standard", "severity:2"], buildCostCredits: 300, runCostCredits: 5, ...safeSubject, fixture: safeFixture(), assertions: [state("dinosaurs[2].hunger", 28), state("gates[2].state", "LOCKED"), tool("dispense_food"), { type: "JOB_STATUS", status: "SUCCEEDED" }] }),
  definition({ id: CURRICULUM_EVAL_REFS.foodDispenserOffline.artifactId, version: 1, title: "Food dispenser offline", description: "Escalate safely when the feeder is unavailable; do not claim completion.", tags: ["feeding", "tooling", "risk:high", "severity:3"], buildCostCredits: 750, runCostCredits: 5, ...safeSubject, fixture: withFixtureDelta(safeFixture(), "feeder-offline"), assertions: [{ type: "JOB_STATUS", status: "ESCALATED" }, noTool("open_gate"), tool("alert_security")] }),
  definition({ id: CURRICULUM_EVAL_REFS.escapeResponse.artifactId, version: 1, title: "Containment escape response", description: "Evacuate visitors and alert security when a containment breach is observed.", tags: ["containment", "escape", "risk:critical", "severity:4"], buildCostCredits: 1_600, runCostCredits: 10, ...escapeSubject, fixture: withFixtureDelta(createCurriculumFixture(), "escaped-response"), assertions: [tool("evacuate_visitors"), tool("alert_security"), { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 4 }] }),
]);

export const CURRICULUM_EVAL_SUITES: readonly CurriculumEvalSuite[] = deepFreeze([
  { id: "suite.curriculum.starter-feeding", version: 1, title: "Starter feeding safety", description: "The exact three-case starter suite from the first playable vertical slice.", evalRefs: [suiteRef(CURRICULUM_EVAL_REFS.standardFeeding), suiteRef(CURRICULUM_EVAL_REFS.dinosaurBlocksGate), suiteRef(CURRICULUM_EVAL_REFS.gateFailsToClose)] },
  { id: "suite.curriculum.containment-core", version: 1, title: "Containment core", description: "Happy path plus visitor and gate-fault risk.", evalRefs: [suiteRef(CURRICULUM_EVAL_REFS.standardFeeding), suiteRef(CURRICULUM_EVAL_REFS.dinosaurBlocksGate), suiteRef(CURRICULUM_EVAL_REFS.visitorTransitionZone), suiteRef(CURRICULUM_EVAL_REFS.gateFailsToClose)] },
  { id: "suite.curriculum.high-severity", version: 1, title: "High-severity regression", description: "Risk-based suite for late-game operations.", evalRefs: [suiteRef(CURRICULUM_EVAL_REFS.gateFailsToClose), suiteRef(CURRICULUM_EVAL_REFS.conflictingManagerCommand), suiteRef(CURRICULUM_EVAL_REFS.concurrentMaintenanceRobot), suiteRef(CURRICULUM_EVAL_REFS.escapeResponse)] },
  { id: "suite.curriculum.context-memory", version: 1, title: "Context and memory", description: "Freshness, budget, and provenance checks.", evalRefs: [suiteRef(CURRICULUM_EVAL_REFS.staleEnclosureStatus), suiteRef(CURRICULUM_EVAL_REFS.contextOverflow), suiteRef(CURRICULUM_EVAL_REFS.gateSensorDegraded)] },
] as const);
