import assert from "node:assert/strict";
import test from "node:test";
import { createContentRegistry } from "../content-registry/index.ts";
import { createContextService } from "../context/index.ts";
import { createEconomyProgressionProvider } from "../src/economy-progression/runtime.ts";
import { createEvalService, createMvpEvalContentPack } from "../eval-runner/index.ts";
import { createEvalProvider } from "../src/eval-runner/runtime.ts";
import { createReviewDeploymentService, createReviewDemoContentPack } from "../review-deployment/index.ts";
import { createWorkbenchBaselineContentPack, createWorkbenchService, DEFAULT_COMMISSION_RECIPES } from "../engineering-workbench/index.ts";
import { createReplayService, createTraceRepository } from "../trace-replay/index.ts";
import { createParkOperationsService } from "../park-operations/index.ts";
import { validateManagerConfiguration } from "../orchestration/index.ts";
import { createOrchestrationProvider } from "../src/orchestration/runtime.ts";
import {
  CURRICULUM_ARTIFACT_REFS,
  CURRICULUM_CONTENT_PACK,
  CURRICULUM_EVALS,
  CURRICULUM_EVAL_SUITES,
  CURRICULUM_MANAGER_CONFIGS,
  CURRICULUM_PHASES,
  CURRICULUM_SAFE_FEEDING_RECIPE,
  CURRICULUM_SCENARIOS,
  createCurriculumWorkflow,
  createScenarioDirector,
  replayGolden,
  runCurriculumAcceptance,
  runGoldenRevisionFailure,
  runGoldenRevisionSuccess,
  runGoldenSafe,
  runGoldenUnsafe,
  runPhase10ScaleComparison,
  runPolicyRefactorComparison,
  validateCurriculumPack,
} from "../curriculum-content/index.ts";

test("curriculum pack validates its public contracts and MVP counts", () => {
  const validation = validateCurriculumPack();
  assert.equal(validation.valid, true, validation.errors.join("; "));
  assert.deepEqual(validation.counts, { phases: 11, artifacts: 23, skillsAndPolicies: 10, evals: 14, scenarios: 11 });
  assert.equal(CURRICULUM_CONTENT_PACK.phases.length, 11);
  assert.equal(CURRICULUM_EVALS.length >= 12, true);
  assert.equal(CURRICULUM_SCENARIOS.length >= 11, true);
});

test("all 14 authored Evals have an executable Prompt path and Standard Feeding secures containment", async () => {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(CURRICULUM_CONTENT_PACK).ok, true);
  const service = createEvalService({ registry, catalog: CURRICULUM_EVALS, openingCredits: 100_000 });
  for (const definition of CURRICULUM_EVALS) assert.equal(service.build({ id: definition.id, version: definition.version }, `build.${definition.id}`).ok, true);
  const batch = await service.run({ evalRefs: CURRICULUM_EVALS.map((definition) => ({ id: definition.id, version: definition.version })), transactionId: "curriculum.all-authored" });
  assert.equal(batch.results.length, 14);
  assert.ok(batch.results.every((result) => !result.error?.includes("MISSING_PROMPT")));
  const standard = batch.results.find((result) => result.ref.id === "eval.curriculum.standard-feeding");
  assert.equal(standard?.status, "PASSED");
  assert.equal(standard?.assertions.find((item) => item.type === "STATE_EQUALS" && item.expected === "LOCKED")?.observed, "LOCKED");
  const gate = CURRICULUM_EVALS.find((definition) => definition.id === "eval.curriculum.gate-fails-to-close");
  assert.deepEqual(gate?.subjectRef, CURRICULUM_ARTIFACT_REFS.evalSafeV1Prompt);
  assert.ok(gate?.tags.includes("intentional-failure"));
});

test("production Eval provider loads all four authored suites", () => {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(CURRICULUM_CONTENT_PACK).ok, true);
  const service = createEvalProvider({ registry, catalog: registry.queryEvals(), openingCredits: 100_000, initialSuites: CURRICULUM_EVAL_SUITES });
  assert.deepEqual(service.suites().map((suite) => suite.id), CURRICULUM_EVAL_SUITES.map((suite) => suite.id).toSorted());
  assert.deepEqual(
    service.suites().find((suite) => suite.id === "suite.curriculum.starter-feeding")?.evalRefs.map((ref) => ref.id),
    ["eval.curriculum.standard-feeding", "eval.curriculum.dinosaur-blocks-gate", "eval.curriculum.gate-fails-to-close"],
  );
});

test("production Economy consumes curriculum balance and retains an early recovery path", () => {
  const economy = createEconomyProgressionProvider(CURRICULUM_CONTENT_PACK.balance);
  assert.equal(economy.balance().amount, CURRICULUM_CONTENT_PACK.balance.openingCredits);
  assert.deepEqual(economy.recoveryPolicy(), { floor: 250, assistanceAmount: 500, enabled: true });
  assert.equal(economy.purchases().can("worker.robot").cost, CURRICULUM_CONTENT_PACK.balance.purchaseCosts.worker2);
  assert.ok(CURRICULUM_CONTENT_PACK.balance.openingCredits - 450 - 200 - 900 - 1_200 - 5 - 8 - 8 >= CURRICULUM_CONTENT_PACK.balance.recovery.floor);
});

test("authored Manager configs validate through the production orchestration contract", () => {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(CURRICULUM_CONTENT_PACK).ok, true);
  const workers = [
    { id: "agent.keeper01", role: "KEEPER", contextBudget: 12_000, tools: ["observe", "dispense_food"] },
    { id: "agent.security01", role: "SECURITY", contextBudget: 12_000, tools: ["observe", "alert_security"] },
    { id: "agent.maintenance01", role: "MAINTENANCE", contextBudget: 12_000, tools: ["observe", "alert_security"] },
  ];
  assert.ok(CURRICULUM_MANAGER_CONFIGS.every((config) => validateManagerConfiguration(config, workers, {}, registry).valid));
});

test("production Orchestration provider runs the authored Manager configurations", () => {
  const park = createParkOperationsService();
  const service = createOrchestrationProvider({ park, configs: CURRICULUM_MANAGER_CONFIGS });
  assert.deepEqual(
    service.configurations().map((config) => `${config.id}@${config.version}`),
    CURRICULUM_MANAGER_CONFIGS.map((config) => `${config.id}@${config.version}`),
  );
  assert.ok(service.configurations().every((config) => config.id === "manager.curriculum.park"));
});

test("phase gating rejects skips and unlocks only after the current objective", () => {
  const director = createScenarioDirector(0);
  assert.equal(director.canEnter(1), false);
  director.phase(10);
  assert.equal(director.state().currentPhase, 0);
  director.completeObjective("objective.manager.configure");
  assert.equal(director.state().maxUnlockedPhase, 0);
  director.completeObjective("objective.onboarding.feed-fern");
  assert.equal(director.state().maxUnlockedPhase, 1);
  assert.equal(director.canEnter(1), true);
  assert.deepEqual(director.availableArtifacts(2), []);
});

test("policy refactor and phase 10 comparisons are measured from executable context and simulation", () => {
  const context = runPolicyRefactorComparison();
  assert.equal(context.cheaper, true);
  assert.ok(context.refactoredRefs.some((ref) => ref.artifactId === CURRICULUM_ARTIFACT_REFS.contextMinimizer.artifactId));
  const scale = runPhase10ScaleComparison();
  assert.equal(scale.earlyRuns.length, 3);
  assert.equal(scale.lateRuns.length, 3);
  assert.equal(scale.fewerInterventions, true);
  assert.ok(scale.lateInterventions < scale.earlyInterventions);
});

test("production-style first slice uses Trace, commission, Review, Evals, revision, deploy, and exact replay", async () => {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(CURRICULUM_CONTENT_PACK).ok, true);
  assert.equal(registry.loadPack(createMvpEvalContentPack()).ok, true);
  assert.equal(registry.loadPack(createReviewDemoContentPack()).ok, true);
  assert.equal(registry.loadPack(createWorkbenchBaselineContentPack()).ok, true);
  const context = createContextService();
  const economy = createEconomyProgressionProvider(CURRICULUM_CONTENT_PACK.balance);
  const repository = createTraceRepository();
  const replay = createReplayService({ content: registry, context });
  const evals = createEvalService({ registry, catalog: registry.queryEvals(), execution: { charge: economy.transact, balance: economy.balance, recordTrace: repository } });
  for (const suite of CURRICULUM_EVAL_SUITES) assert.equal(evals.createSuite(suite).ok, true);
  const reviews = createReviewDeploymentService({ registry, context, evals, economy });
  const workbench = createWorkbenchService({ registry, context, economy, reviews: reviews.reviews, deployment: reviews.deployments, evals, recipes: [...DEFAULT_COMMISSION_RECIPES, CURRICULUM_SAFE_FEEDING_RECIPE] });
  const park = createParkOperationsService({ content: registry, context, traces: repository });
  const orchestration = createOrchestrationProvider({ park, configs: CURRICULUM_MANAGER_CONFIGS });
  const workflow = createCurriculumWorkflow({ registry, acceptance: runCurriculumAcceptance(), evals, economy, reviews, workbench, traces: { repository, replay }, orchestration, park });

  workflow.completeCurrentObjective();
  workflow.runUnsafe();
  const unsafeState = workflow.state();
  assert.equal(unsafeState.productionJobStatus, "SUCCEEDED");
  assert.ok(unsafeState.productionJobId);
  assert.ok(unsafeState.productionIncidentId);
  assert.equal(repository.get(unsafeState.productionTraceId!)?.header.jobId, unsafeState.productionJobId);
  assert.ok(unsafeState.productionMissingPostconditions?.length);
  workflow.inspectTrace();
  workflow.completeCurrentObjective();
  workflow.commission();
  workflow.completeCurrentObjective();
  workflow.completeCurrentObjective();
  workflow.completeCurrentObjective();
  workflow.inspectReview();
  workflow.buildStarterEvals();
  await workflow.runIntentionalFailure();
  assert.deepEqual(workflow.state().firstRun?.results.map((result) => result.status), ["PASSED", "PASSED", "FAILED"]);
  workflow.completeCurrentObjective();
  workflow.revise();
  await workflow.runRevision();
  assert.ok(workflow.state().passingRun?.results.every((result) => result.status === "PASSED"));
  workflow.deploy();
  assert.equal(workflow.state().deployedRef?.version, 4);
  await workflow.replaySafe();
  assert.equal(workflow.state().replay?.status, "EXACT");
  assert.equal(workflow.state().productionRerunStatus, "SUCCEEDED");
  assert.notEqual(workflow.state().productionRerunJobId, workflow.state().productionJobId);
  const originalProductionJob = park.jobs().find((job) => job.id === workflow.state().productionJobId)!;
  const rerunProductionJob = park.jobs().find((job) => job.id === workflow.state().productionRerunJobId)!;
  assert.deepEqual(
    { type: rerunProductionJob.type, targetRefs: rerunProductionJob.targetRefs, priority: rerunProductionJob.priority, assignedAgentId: rerunProductionJob.assignedAgentId },
    { type: originalProductionJob.type, targetRefs: originalProductionJob.targetRefs, priority: originalProductionJob.priority, assignedAgentId: originalProductionJob.assignedAgentId },
  );
  assert.deepEqual(rerunProductionJob.skillRefs, [workflow.state().deployedRef]);
  assert.equal(repository.get(workflow.state().productionRerunTraceId!)?.header.jobId, workflow.state().productionRerunJobId);
  assert.equal(park.snapshot().gates.find((gate) => gate.id === "gate.gamma")?.state, "LOCKED");
  assert.equal(park.getPark().metrics.openIncidents, 0);
  assert.ok((workflow.state().productionRerunContextLoad ?? Infinity) < (workflow.state().productionContextLoad ?? 0));
  workflow.completeCurrentObjective();
  workflow.runMemoryLesson();
  assert.equal(workflow.state().memoryLesson?.provenancePreserved, true);
  workflow.completeCurrentObjective();
  workflow.runParallelLesson();
  workflow.completeCurrentObjective();
  workflow.runManagerLesson();
  assert.equal(workflow.state().managerLesson?.exact, true);
  workflow.completeCurrentObjective();
  workflow.runScaleLesson();
  assert.equal(workflow.state().scaleLesson?.fewerInterventions, true);
  assert.equal(workflow.state().objectiveReady, true);
  assert.ok(economy.balance().amount >= CURRICULUM_CONTENT_PACK.balance.recovery.floor);
});

test("curriculum phases are ordered and every recovery prevents a dead-end save", () => {
  assert.deepEqual(CURRICULUM_PHASES.map((phase) => phase.phase), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(CURRICULUM_PHASES.every((phase) => phase.objectives.length > 0 && phase.availableRefs.length > 0 && phase.recovery.preventsDeadEnd));
});

test("first carnivore slice exposes the missing postcondition and a cheaper modular context", () => {
  const unsafe = runGoldenUnsafe();
  const safe = runGoldenSafe();
  assert.equal(unsafe.outcome, "INCIDENT");
  assert.ok(unsafe.missingPostconditions.includes("containment.postcondition"));
  assert.equal(safe.outcome, "SUCCEEDED");
  assert.equal(safe.snapshot.gates.find((gate) => gate.id === "gate.gamma")?.state, "LOCKED");
  assert.ok(safe.contextLoad < unsafe.contextLoad);
});

test("gate-failure revision is deterministic: incomplete version fails and escalation revision is safe", () => {
  const failure = runGoldenRevisionFailure();
  const success = runGoldenRevisionSuccess();
  assert.equal(failure.outcome, "FAILED");
  assert.equal(success.outcome, "ESCALATED");
  assert.equal(replayGolden(failure).exact, true);
  assert.equal(replayGolden(success).exact, true);
});

test("acceptance report covers browser-recognizable first slice and exact replays", () => {
  const report = runCurriculumAcceptance();
  assert.equal(report.valid, true, report.blockers.join("; "));
  assert.equal(report.firstSlice.browserRecognizable, true);
  assert.equal(report.failureReplay.exact, true);
  assert.equal(report.successReplay.exact, true);
  assert.equal(report.firstSlice.contextCostReduced, true);
});
