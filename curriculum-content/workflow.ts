import type { ContentRegistry } from "../content-registry/index.ts";
import type { EconomyProgressionService } from "../economy-progression/index.ts";
import type { EvalBatchResult, EvalRef, EvalService } from "../eval-runner/index.ts";
import type { WorkbenchService } from "../engineering-workbench/index.ts";
import type { AgentDefinition } from "../instruction/index.ts";
import type { ReviewDeploymentRuntime } from "../review-deployment/index.ts";
import { createOrchestrationService, type ManagerEvaluationResult, type OrchestrationService, type SchedulingWorker } from "../orchestration/index.ts";
import type { OperationsJob, ParkOperationsService } from "../park-operations/index.ts";
import { createSimulationEngine, createStarterFixture, deepFreeze } from "../simulation/index.ts";
import type { ReplayResult, ReplayService, TraceRepository } from "../trace-replay/index.ts";
import { CURRICULUM_ARTIFACT_REFS } from "./artifacts.ts";
import { CURRICULUM_EVAL_SUITES } from "./evals.ts";
import { CURRICULUM_PHASES } from "./phases.ts";
import { createCurriculumSafeFeedingRevision, CURRICULUM_SAFE_FEEDING_RECIPE } from "./recipe.ts";
import { createScenarioDirector, runGoldenSafe, runGoldenUnsafe, runMemoryConflictLesson, runPhase10ScaleComparison, type MemoryConflictLessonResult, type Phase10ScaleComparison, type ScenarioDirectorPort } from "./scenario-director.ts";
import type { CurriculumAcceptanceReport, GoldenTrace } from "./index.ts";

const starterSuite = CURRICULUM_EVAL_SUITES.find((suite) => suite.id === "suite.curriculum.starter-feeding")!;

export interface CurriculumWorkflowDependencies {
  readonly registry: ContentRegistry;
  readonly acceptance: CurriculumAcceptanceReport;
  readonly evals: EvalService;
  readonly economy: EconomyProgressionService;
  readonly reviews: ReviewDeploymentRuntime;
  readonly workbench: WorkbenchService;
  readonly traces: { readonly repository: TraceRepository; readonly replay: ReplayService };
  readonly orchestration: OrchestrationService;
  readonly park: ParkOperationsService;
}

export interface CurriculumWorkflowState {
  readonly phase: number;
  readonly maxUnlockedPhase: number;
  readonly objectiveReady: boolean;
  readonly unsafe?: GoldenTrace;
  readonly unsafeTraceId?: string;
  readonly productionJobId?: string;
  readonly productionJobStatus?: OperationsJob["status"];
  readonly productionIncidentId?: string;
  readonly productionTraceId?: string;
  readonly productionContextLoad?: number;
  readonly productionMissingPostconditions?: readonly string[];
  readonly traceInspected: boolean;
  readonly commissionedRef?: { readonly artifactId: string; readonly version: number };
  readonly reviewId?: string;
  readonly reviewAnalyzed: boolean;
  readonly builtEvalRefs: readonly EvalRef[];
  readonly firstRun?: EvalBatchResult;
  readonly revisionRef?: { readonly artifactId: string; readonly version: number };
  readonly passingRun?: EvalBatchResult;
  readonly deployedRef?: { readonly artifactId: string; readonly version: number };
  readonly replay?: ReplayResult;
  readonly productionRerunJobId?: string;
  readonly productionRerunStatus?: OperationsJob["status"];
  readonly productionRerunTraceId?: string;
  readonly productionRerunContextLoad?: number;
  readonly memoryLesson?: MemoryConflictLessonResult;
  readonly parallelLesson?: Phase10ScaleComparison;
  readonly managerLesson?: ManagerEvaluationResult;
  readonly scaleLesson?: Phase10ScaleComparison;
  readonly message: string;
}

export interface CurriculumWorkflowPort {
  readonly state: () => CurriculumWorkflowState;
  readonly completeCurrentObjective: () => CurriculumWorkflowState;
  readonly enterPhase: (phase: number) => CurriculumWorkflowState;
  readonly runUnsafe: () => CurriculumWorkflowState;
  readonly inspectTrace: () => CurriculumWorkflowState;
  readonly commission: () => CurriculumWorkflowState;
  readonly inspectReview: () => CurriculumWorkflowState;
  readonly buildStarterEvals: () => CurriculumWorkflowState;
  readonly runIntentionalFailure: () => Promise<CurriculumWorkflowState>;
  readonly revise: () => CurriculumWorkflowState;
  readonly runRevision: () => Promise<CurriculumWorkflowState>;
  readonly deploy: () => CurriculumWorkflowState;
  readonly replaySafe: () => Promise<CurriculumWorkflowState>;
  readonly runMemoryLesson: () => CurriculumWorkflowState;
  readonly runParallelLesson: () => CurriculumWorkflowState;
  readonly runManagerLesson: () => CurriculumWorkflowState;
  readonly runScaleLesson: () => CurriculumWorkflowState;
}

function subjectAgent(skillRef: { readonly artifactId: string; readonly version: number }): AgentDefinition {
  const tools = ["move_to", "observe", "bait_dinosaur", "open_gate", "close_gate", "lock_gate", "dispense_food", "alert_security", "evacuate_visitors", "rescue_visitors"];
  return { id: "agent.keeper01", name: "Keeper 01", role: "WORKER", contextBudget: 8_000, toolIds: tools, tools, skillRefs: [skillRef], systemPromptRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy] };
}

function recordGolden(repository: TraceRepository, trace: GoldenTrace, traceId: string): string {
  if (repository.get(traceId)) return traceId;
  const id = repository.begin({ traceId, jobId: `job.curriculum.${trace.mode.toLowerCase()}`, agentId: "agent.keeper01", startLogicalTime: 0, fixtureRef: trace.snapshot.fixtureId, seed: trace.seed, artifactRefs: trace.artifactRefs, schemaVersion: 1 });
  for (const event of trace.events) repository.append(id, event);
  repository.finalize(id, { jobId: `job.curriculum.${trace.mode.toLowerCase()}`, status: trace.outcome === "SUCCEEDED" ? "SUCCEEDED" : trace.outcome === "ESCALATED" ? "ESCALATED" : "FAILED", reasonCode: trace.outcome, worldSnapshot: trace.snapshot });
  return id;
}

export function createCurriculumWorkflow(dependencies: CurriculumWorkflowDependencies, director: ScenarioDirectorPort = createScenarioDirector(0)): CurriculumWorkflowPort {
  let unsafe: GoldenTrace | undefined;
  let unsafeTraceId: string | undefined;
  let productionJob: OperationsJob | undefined;
  let productionIncidentId: string | undefined;
  let productionTraceId: string | undefined;
  let traceInspected = false;
  let commissionedRef: { readonly artifactId: string; readonly version: number } | undefined;
  let reviewId: string | undefined;
  let reviewAnalyzed = false;
  let builtEvalRefs: readonly EvalRef[] = [];
  let firstRun: EvalBatchResult | undefined;
  let revisionRef: { readonly artifactId: string; readonly version: number } | undefined;
  let passingRun: EvalBatchResult | undefined;
  let deployedRef: { readonly artifactId: string; readonly version: number } | undefined;
  let replay: ReplayResult | undefined;
  let productionRerunJob: OperationsJob | undefined;
  let memoryLesson: MemoryConflictLessonResult | undefined;
  let parallelLesson: Phase10ScaleComparison | undefined;
  let managerLesson: ManagerEvaluationResult | undefined;
  let scaleLesson: Phase10ScaleComparison | undefined;
  let message = "Complete the onboarding objective to unlock the first carnivore incident.";
  let logicalTime = 1;

  const ready = (): boolean => {
    switch (director.state().currentPhase) {
      case 0: return Boolean(dependencies.registry.getArtifact(CURRICULUM_ARTIFACT_REFS.onboardingPrompt));
      case 1: return traceInspected;
      case 2: return Boolean(commissionedRef);
      case 3: return dependencies.acceptance.policyRefactor.cheaper;
      case 4: return dependencies.acceptance.policyRefactor.cheaper;
      case 5: return Boolean(firstRun && firstRun.results.filter((result) => result.status === "FAILED").length === 1);
      case 6: return Boolean(deployedRef);
      case 7: return Boolean(memoryLesson?.staleMemoryFound && memoryLesson.conflictingClausesFound && memoryLesson.directObservationWins && memoryLesson.provenancePreserved);
      case 8: return Boolean(parallelLesson?.lateRuns.length === 3 && parallelLesson.lateRuns.every((run) => run.outcome === "SUCCEEDED"));
      case 9: return Boolean(managerLesson?.passed && managerLesson.exact);
      case 10: return Boolean(scaleLesson?.fewerInterventions);
      default: return false;
    }
  };
  const state = (): CurriculumWorkflowState => {
    const progress = director.state();
    return deepFreeze({ phase: progress.currentPhase, maxUnlockedPhase: progress.maxUnlockedPhase, objectiveReady: ready(), ...(unsafe ? { unsafe } : {}), ...(unsafeTraceId ? { unsafeTraceId } : {}), ...(productionJob ? { productionJobId: productionJob.id, productionJobStatus: productionJob.status, productionContextLoad: productionJob.contextSnapshot?.totalLoad, productionMissingPostconditions: productionJob.outcome?.missingPostconditions ?? [] } : {}), ...(productionIncidentId ? { productionIncidentId } : {}), ...(productionTraceId ? { productionTraceId } : {}), traceInspected, ...(commissionedRef ? { commissionedRef } : {}), ...(reviewId ? { reviewId } : {}), reviewAnalyzed, builtEvalRefs, ...(firstRun ? { firstRun } : {}), ...(revisionRef ? { revisionRef } : {}), ...(passingRun ? { passingRun } : {}), ...(deployedRef ? { deployedRef } : {}), ...(replay ? { replay } : {}), ...(productionRerunJob ? { productionRerunJobId: productionRerunJob.id, productionRerunStatus: productionRerunJob.status, productionRerunTraceId: productionRerunJob.traceId, productionRerunContextLoad: productionRerunJob.contextSnapshot?.totalLoad } : {}), ...(memoryLesson ? { memoryLesson } : {}), ...(parallelLesson ? { parallelLesson } : {}), ...(managerLesson ? { managerLesson } : {}), ...(scaleLesson ? { scaleLesson } : {}), message });
  };
  const fail = (next: string): CurriculumWorkflowState => { message = next; return state(); };
  const completeCurrentObjective = (): CurriculumWorkflowState => {
    const phase = director.state().currentPhase;
    const definition = CURRICULUM_PHASES.find((item) => item.phase === phase);
    if (!ready()) return fail(`Phase ${phase} objective is not ready; complete its evidence-producing workflow action first.`);
    const objectiveId = definition?.objectives[0]?.id;
    if (!objectiveId) return fail(`Phase ${phase} is outside the first-slice objective workflow.`);
    director.completeObjective(objectiveId);
    const nextSignal = [undefined, undefined, "repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure", "review.pressure"][phase];
    dependencies.economy.process({ id: `curriculum.objective.${phase}.${logicalTime}`, type: "OBJECTIVE_COMPLETED", logicalTime: logicalTime++, objectiveId, ...(nextSignal ? { signal: nextSignal } : {}) });
    const unlocked = director.state().maxUnlockedPhase;
    director.phase(unlocked);
    message = `${definition?.title ?? `Phase ${phase}`} objective completed; phase ${unlocked} is now available.`;
    return state();
  };

  return Object.freeze({
    state,
    completeCurrentObjective,
    enterPhase: (phase: number) => { const before = director.state().currentPhase; director.phase(phase); message = director.state().currentPhase === before && phase > director.state().maxUnlockedPhase ? `Phase ${phase} is locked by prior objectives.` : `Opened phase ${director.state().currentPhase}.`; return state(); },
    runUnsafe: () => {
      if (!director.canEnter(1)) return fail("Complete onboarding before running the carnivore scenario.");
      const parkView = dependencies.park.getPark();
      const draft = { type: "FEED", targetRefs: ["dino.rex"], priority: 5, dueTime: parkView.snapshot.logicalTime + 120, promptRef: CURRICULUM_ARTIFACT_REFS.unsafePrompt, skillRefs: [], systemPromptRefs: [], assignedAgentId: "agent.keeper01", expectedParkVersion: parkView.version };
      const accepted = dependencies.park.create(draft, "curriculum.production.feed-rex.unsafe");
      if (!accepted.ok) return fail(`${accepted.error.code}: ${accepted.error.message}`);
      const run = dependencies.park.runToCompletion(accepted.job.id, "curriculum.production.feed-rex.unsafe.run");
      if (!run.ok) return fail(`${run.error.code}: ${run.error.message}`);
      productionJob = run.job;
      productionTraceId = run.job.traceId;
      const incident = dependencies.park.getPark().incidentDetails.find((item) => item.responsibleJobId === run.job.id && item.traceId === run.job.traceId);
      const trace = productionTraceId ? dependencies.traces.repository.get(productionTraceId) : undefined;
      if (!incident || !trace || trace.header.jobId !== run.job.id || !run.job.outcome?.missingPostconditions.length) return fail("Production Park run did not produce the required linked containment incident and missing-postcondition Trace.");
      productionIncidentId = incident.id;
      unsafe = runGoldenUnsafe();
      unsafeTraceId = productionTraceId;
      dependencies.economy.process({ id: "curriculum.incident.first-slice", type: "INCIDENT", logicalTime: logicalTime++, severity: 3, signal: "containment.pressure" });
      message = `Accepted and ran production job ${productionJob.id}; incident ${productionIncidentId} and trace ${productionTraceId} expose the missing postcondition.`;
      return state();
    },
    inspectTrace: () => {
      const record = unsafeTraceId ? dependencies.traces.repository.get(unsafeTraceId) : undefined;
      if (!productionJob || !productionIncidentId || !record || record.header.jobId !== productionJob.id || !productionJob.outcome?.missingPostconditions.length) return fail("Accept and run the production Park job before inspecting its missing postcondition.");
      traceInspected = true;
      message = `Production trace ${record.header.traceId} inspected: ${record.eventCount} events and ${productionJob.outcome.missingPostconditions.join(", ")}.`;
      return state();
    },
    commission: () => {
      const result = dependencies.workbench.commission(CURRICULUM_SAFE_FEEDING_RECIPE.ref, [{ id: "containment-contract", optionId: "close-lock-verify" }], "curriculum.commission.safe-feeding.v3");
      if (!result.ok) return fail(`${result.error.code}: ${result.error.message}`);
      commissionedRef = result.value.proposalRef;
      reviewId = result.value.reviewId;
      message = `Commissioned ${commissionedRef.artifactId}@${commissionedRef.version}; review ${reviewId} opened.`;
      return state();
    },
    inspectReview: () => {
      const review = reviewId ? dependencies.reviews.reviews.get(reviewId) : undefined;
      if (!review) return fail("Commission the Skill before opening its review.");
      const analysis = dependencies.reviews.reviews.analyze(review.reviewId);
      if (analysis.hardGateCodes.length > 0) return fail(`Review analysis blocked: ${analysis.hardGateCodes.join(", ")}.`);
      const selected = dependencies.reviews.reviews.selectEvals({ reviewId: review.reviewId, expectedReviewVersion: review.version, suiteId: starterSuite.id });
      if (!selected.ok) return fail(`${selected.error.code}: ${selected.error.message}`);
      reviewAnalyzed = true;
      message = `Review inspected and ${selected.value.evalSelection.length} exact starter Evals selected.`;
      return state();
    },
    buildStarterEvals: () => {
      const built: EvalRef[] = [];
      for (const ref of starterSuite.evalRefs) {
        const evalRef = { id: ref.id, version: ref.version };
        const result = dependencies.evals.build(evalRef, `curriculum.build.${ref.id}.${ref.version}`);
        if (!result.ok) return fail(`${result.error.code}: ${result.error.message}`);
        built.push(evalRef);
      }
      builtEvalRefs = deepFreeze(built);
      message = `Built ${built.length} starter Evals with ${dependencies.economy.balance().amount} credits remaining.`;
      return state();
    },
    runIntentionalFailure: async () => {
      if (!commissionedRef || !reviewId || builtEvalRefs.length !== starterSuite.evalRefs.length) return fail("Commission, review, and build the three starter Evals first.");
      firstRun = await dependencies.evals.run({ suiteId: starterSuite.id, transactionId: "curriculum.run.v3.intentional-failure", subject: { type: "SKILL", ref: commissionedRef, agentDefinition: subjectAgent(commissionedRef) } });
      const review = dependencies.reviews.reviews.get(reviewId);
      if (!review) return fail("The commissioned review is unavailable.");
      const attached = dependencies.reviews.reviews.attachRun({ reviewId, expectedReviewVersion: review.version, batch: firstRun });
      if (!attached.ok) return fail(`${attached.error.code}: ${attached.error.message}`);
      const failed = firstRun.results.filter((result) => result.status === "FAILED");
      message = `${firstRun.results.length} Evals ran; ${failed.length} intentional failure exposed ${failed[0]?.ref.id ?? "the revision gap"}.`;
      return state();
    },
    revise: () => {
      if (!reviewId || !firstRun?.results.some((result) => result.status === "FAILED")) return fail("Run the intentional failing Eval before revising.");
      const artifact = createCurriculumSafeFeedingRevision();
      if (!dependencies.registry.getArtifact(artifact)) {
        const loaded = dependencies.registry.loadPack({ schemaVersion: 1, packId: "curriculum.workflow.revision", packVersion: 1, artifacts: [artifact] });
        if (!loaded.ok) return fail(`Revision content invalid: ${loaded.error.map((item) => item.message).join("; ")}`);
      }
      const review = dependencies.reviews.reviews.get(reviewId);
      if (!review) return fail("The commissioned review is unavailable.");
      const revised = dependencies.reviews.reviews.requestRevision({ reviewId, expectedReviewVersion: review.version, reasonCode: "MISSING_ESCALATION", reason: "Gate Fails to Close requires an explicit security escalation.", proposedRef: { artifactId: artifact.artifactId, version: artifact.version } });
      if (!revised.ok) return fail(`${revised.error.code}: ${revised.error.message}`);
      const selected = dependencies.reviews.reviews.selectEvals({ reviewId, expectedReviewVersion: revised.value.version, suiteId: starterSuite.id });
      if (!selected.ok) return fail(`${selected.error.code}: ${selected.error.message}`);
      revisionRef = { artifactId: artifact.artifactId, version: artifact.version };
      message = `Revision ${revisionRef.artifactId}@${revisionRef.version} adds explicit jam escalation; starter suite reselected.`;
      return state();
    },
    runRevision: async () => {
      if (!revisionRef || !reviewId) return fail("Create the escalation revision before rerunning Evals.");
      passingRun = await dependencies.evals.run({ suiteId: starterSuite.id, transactionId: "curriculum.run.v4.passing", subject: { type: "SKILL", ref: revisionRef, agentDefinition: subjectAgent(revisionRef) } });
      const review = dependencies.reviews.reviews.get(reviewId);
      if (!review) return fail("The revised review is unavailable.");
      const attached = dependencies.reviews.reviews.attachRun({ reviewId, expectedReviewVersion: review.version, batch: passingRun });
      if (!attached.ok) return fail(`${attached.error.code}: ${attached.error.message}`);
      message = `${passingRun.results.filter((result) => result.status === "PASSED").length}/${passingRun.results.length} revised Evals pass.`;
      return state();
    },
    deploy: () => {
      if (!reviewId || !passingRun?.results.every((result) => result.status === "PASSED")) return fail("All revised starter Evals must pass before deployment.");
      const review = dependencies.reviews.reviews.get(reviewId);
      if (!review) return fail("The revised review is unavailable.");
      const assessment = dependencies.reviews.deployments.validate(reviewId);
      if (assessment.hardGates.length > 0) return fail(`Deployment hard gate: ${assessment.hardGates.map((gate) => gate.code).join(", ")}.`);
      const deployed = dependencies.reviews.deployments.deploy({ reviewId, expectedReviewVersion: review.version, acknowledgeWarningCodes: assessment.warnings.map((warning) => warning.code), transactionId: "curriculum.deploy.safe-feeding.v4" });
      if (!deployed.ok) return fail(`${deployed.error.code}: ${deployed.error.message}`);
      deployedRef = deployed.value.ref;
      message = `Deployed exact ${deployedRef.artifactId}@${deployedRef.version}.`;
      return state();
    },
    replaySafe: async () => {
      const standard = passingRun?.results.find((result) => result.ref.id === "eval.curriculum.standard-feeding");
      if (!deployedRef || !standard?.replayManifest) return fail("Deploy the passing revision before replaying its exact safe run.");
      if (!productionJob) return fail("The accepted production job is unavailable for rerun.");
      const recoveredSimulation = createSimulationEngine();
      const recovered = recoveredSimulation.load(createStarterFixture(), 7);
      if (!recovered.ok) return fail(`Production rerun fixture recovery failed: ${recovered.error.map((item) => `${item.code}:${item.path}`).join("; ")}`);
      dependencies.park.restoreWorld(recoveredSimulation.snapshot());
      const parkView = dependencies.park.getPark();
      const rerunDraft = { type: productionJob.type, targetRefs: productionJob.targetRefs, priority: productionJob.priority, dueTime: parkView.snapshot.logicalTime + 120, promptRef: CURRICULUM_ARTIFACT_REFS.explicitPrompt, skillRefs: [deployedRef], systemPromptRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy], assignedAgentId: productionJob.assignedAgentId, expectedParkVersion: parkView.version };
      const accepted = dependencies.park.create(rerunDraft, "curriculum.production.feed-rex.deployed-rerun");
      if (!accepted.ok) return fail(`${accepted.error.code}: ${accepted.error.message}`);
      const productionRun = dependencies.park.runToCompletion(accepted.job.id, "curriculum.production.feed-rex.deployed-rerun.run");
      if (!productionRun.ok) return fail(`${productionRun.error.code}: ${productionRun.error.message}`);
      productionRerunJob = productionRun.job;
      const productionTrace = productionRerunJob.traceId ? dependencies.traces.repository.get(productionRerunJob.traceId) : undefined;
      const gate = dependencies.park.getPark().snapshot.gates.find((item) => item.id === "gate.gamma");
      if (productionRerunJob.status !== "SUCCEEDED" || gate?.state !== "LOCKED" || !productionTrace || productionTrace.header.jobId !== productionRerunJob.id) return fail("The deployed production rerun did not succeed with locked containment and a linked production Trace.");
      replay = await dependencies.traces.replay.replay(standard.replayManifest);
      if (replay.status !== "EXACT") return fail(`Safe replay ${replay.status.toLowerCase()}: ${replay.firstDifference?.message ?? replay.unavailableReason ?? "unknown difference"}.`);
      const safe = runGoldenSafe();
      recordGolden(dependencies.traces.repository, safe, "trace.curriculum.first-slice.safe");
      message = `Production rerun ${productionRerunJob.id} succeeded with trace ${productionRerunJob.traceId}; exact eval replay confirmed and context ${productionJob.contextSnapshot?.totalLoad ?? 0} → ${productionRerunJob.contextSnapshot?.totalLoad ?? 0} CU.`;
      return state();
    },
    runMemoryLesson: () => {
      if (director.state().currentPhase !== 7) return fail("Open phase 7 before running the stale-memory lesson.");
      memoryLesson = runMemoryConflictLesson();
      message = `Memory profiler found ${memoryLesson.findingCodes.join(", ")}; the direct observation superseded stale memory with provenance intact.`;
      return state();
    },
    runParallelLesson: () => {
      if (director.state().currentPhase !== 8) return fail("Complete the memory objective before coordinating parallel workers.");
      parallelLesson = runPhase10ScaleComparison();
      message = `${parallelLesson.lateRuns.length} coordinated safe runs completed without direct interventions.`;
      return state();
    },
    runManagerLesson: () => {
      if (director.state().currentPhase !== 9) return fail("Complete the parallelism objective before evaluating a Manager.");
      const config = dependencies.orchestration.configurations().filter((candidate) => candidate.status === "DEPLOYED").toSorted((left, right) => right.version - left.version)[0];
      if (!config) return fail("No authored Manager configuration is available.");
      const workers: readonly SchedulingWorker[] = [
        { id: "agent.keeper01", role: "KEEPER", status: "IDLE", tools: ["observe", "dispense_food", "alert_security"], toolIds: ["observe", "dispense_food", "alert_security"], contextBudget: 12_000, queueLength: 0, queueCapacity: 5 },
        { id: "agent.security01", role: "SECURITY", status: "IDLE", tools: ["alert_security", "evacuate_visitors"], toolIds: ["alert_security", "evacuate_visitors"], contextBudget: 12_000, queueLength: 0, queueCapacity: 5 },
        { id: "agent.maintenance01", role: "MAINTENANCE", status: "IDLE", tools: ["observe", "alert_security"], toolIds: ["observe", "alert_security"], contextBudget: 12_000, queueLength: 0, queueCapacity: 5 },
      ];
      managerLesson = createOrchestrationService({ workers, configs: [config], content: dependencies.registry }).evaluateConfiguration(config);
      message = `Authored Manager ${managerLesson.configRef} evaluation is ${managerLesson.passed && managerLesson.exact ? "passing and exact" : "blocked"}.`;
      return state();
    },
    runScaleLesson: () => {
      if (director.state().currentPhase !== 10) return fail("Complete the Manager objective before running the scale comparison.");
      scaleLesson = runPhase10ScaleComparison();
      message = `Measured interventions ${scaleLesson.earlyInterventions} early → ${scaleLesson.lateInterventions} late across six deterministic simulations.`;
      return state();
    },
  });
}
