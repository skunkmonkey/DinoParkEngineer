import { createSimulationEngine, deepClone, deepFreeze, type WorldFixture } from "../simulation/index.ts";
import { createContentRegistry, type ArtifactRef } from "../content-registry/index.ts";
import { createContextService } from "../context/index.ts";
import { createMemoryService } from "../memory/index.ts";
import { createInstructionEngine, type AgentDefinition, type InstructionJob } from "../instruction/index.ts";
import { stableHash } from "../trace-replay/index.ts";
import { CURRICULUM_ARTIFACT_REFS } from "./artifacts.ts";
import { CURRICULUM_CONTENT_PACK } from "./pack.ts";
import { createCurriculumFixture, withFixtureDelta } from "./park.ts";
import type { GoldenReplayResult, GoldenTrace } from "./types.ts";

export interface ScenarioDirectorState {
  readonly currentPhase: number;
  readonly maxUnlockedPhase: number;
  readonly completedObjectives: readonly string[];
  readonly interventions: number;
  readonly incidentIds: readonly string[];
  readonly unlockedRefs: readonly ArtifactRef[];
}

export interface ScenarioDirectorPort {
  readonly state: () => ScenarioDirectorState;
  readonly phase: (phase: number) => ReturnType<ScenarioDirectorPort["state"]> & { readonly phase: number };
  readonly completeObjective: (objectiveId: string, logicalTime?: number) => ScenarioDirectorState;
  readonly recordIntervention: (logicalTime?: number) => ScenarioDirectorState;
  readonly availableArtifacts: (phase: number) => readonly ArtifactRef[];
  readonly canEnter: (phase: number) => boolean;
  readonly restore: (state: ScenarioDirectorState) => void;
}

export interface MemoryConflictLessonResult {
  readonly staleMemoryFound: boolean;
  readonly conflictingClausesFound: boolean;
  readonly directObservationWins: boolean;
  readonly provenancePreserved: boolean;
  readonly findingCodes: readonly string[];
}

export function runMemoryConflictLesson(): MemoryConflictLessonResult {
  const registry = createContentRegistry();
  const prompt = {
    artifactId: "artifact.curriculum.prompt.memory-lesson", version: 1, type: "PROMPT" as const, title: "Inspect Gate Gamma",
    sourceText: "Inspect the current gate state before acting.", clauses: [{ id: "memory.current", sourceText: "Treat the gate as closed.", type: "PRECONDITION" as const, semanticKey: "gate.gamma.state", assert: { state: "CLOSED" } }],
    dependencies: [], applicabilityTags: ["lesson:memory"], requiredToolIds: ["observe"], status: "DEPLOYED" as const, authoredByCapability: "curriculum", createdAtGameTime: 0,
  };
  const conflict = {
    artifactId: "artifact.curriculum.system.memory-conflict", version: 1, type: "SYSTEM_PROMPT" as const, title: "Maintenance Override",
    sourceText: "Maintenance reports Gate Gamma open.", clauses: [{ id: "memory.conflict", sourceText: "Treat the gate as open.", type: "CONSTRAINT" as const, semanticKey: "gate.gamma.state", assert: { state: "OPEN" } }],
    dependencies: [], applicabilityTags: ["lesson:memory"], requiredToolIds: [], status: "DEPLOYED" as const, authoredByCapability: "curriculum", createdAtGameTime: 0,
  };
  const loaded = registry.loadPack({ schemaVersion: 1, packId: "curriculum.memory-conflict.lesson", artifacts: [prompt, conflict] });
  if (!loaded.ok) throw new Error(loaded.error.map((item) => item.message).join("; "));
  const memories = createMemoryService();
  const stale = memories.record({ id: "memory.curriculum.gate-gamma", scope: "SHARED", observedAt: 1, validUntil: 30, provenance: "maintenance:old-log", subjectRefs: ["gate.gamma"], facts: { gateState: "OPEN" }, contextCost: 8 });
  const projected = createContextService().project({
    agentId: "agent.keeper01", jobId: "job.curriculum.memory", budget: 8_000, promptRef: prompt, artifactRefs: [conflict], registry,
    applicabilityTags: ["lesson:memory"], logicalTime: 20, memoryService: memories, memoryAccess: { agentId: "agent.keeper01" }, memoryQuery: { subjectRefs: ["gate.gamma"] }, freshnessPolicy: { maxAgeSeconds: 10 },
    workingState: { ref: "world:gate.gamma", contextCost: 4, observations: [{ key: "gateState", subjectRef: "gate.gamma", value: "CLOSED", observedAt: 20, provenance: "sensor:direct" }] },
  });
  if (!projected.ok) throw new Error(projected.error.message);
  const findings = createContextService().analyze(projected.value);
  const fact = projected.value.authoritativeFacts.find((item) => item.key === "gateState");
  return deepFreeze({
    staleMemoryFound: findings.some((item) => item.code === "STALE_MEMORY"),
    conflictingClausesFound: findings.some((item) => item.code === "CONFLICTING_CLAUSES"),
    directObservationWins: fact?.source === "DIRECT_OBSERVATION" && fact.value === "CLOSED",
    provenancePreserved: fact?.provenance === "sensor:direct" && fact.supersedes?.includes(stale.id) === true,
    findingCodes: findings.map((item) => item.code),
  });
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function fixtureFor(mode: GoldenTrace["mode"]): WorldFixture {
  const base = createCurriculumFixture();
  const safePositioned = deepFreeze({ ...base, dinosaurs: base.dinosaurs.map((dinosaur) => dinosaur.id === "dino.rex" ? { ...dinosaur, currentZone: "zone.gamma.interior" as const } : dinosaur) });
  if (mode === "REVISION_FAILURE" || mode === "REVISION_SUCCESS") return withFixtureDelta(safePositioned, "gate-jam");
  return mode === "SAFE" ? safePositioned : base;
}

function subjectRefs(mode: GoldenTrace["mode"]): { readonly promptRef: ArtifactRef; readonly skillRefs: readonly ArtifactRef[]; readonly systemPromptRefs: readonly ArtifactRef[] } {
  if (mode === "UNSAFE") return { promptRef: CURRICULUM_ARTIFACT_REFS.unsafePrompt, skillRefs: [], systemPromptRefs: [] };
  return { promptRef: CURRICULUM_ARTIFACT_REFS.explicitPrompt, skillRefs: [mode === "REVISION_FAILURE" || mode === "SAFE" ? CURRICULUM_ARTIFACT_REFS.safeFeedingV1 : CURRICULUM_ARTIFACT_REFS.safeFeedingV2], systemPromptRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy] };
}

function runOnce(mode: GoldenTrace["mode"]): GoldenTrace {
  const registry = createContentRegistry();
  const loaded = registry.loadPack(CURRICULUM_CONTENT_PACK);
  if (!loaded.ok) throw new Error(`Curriculum pack failed to load: ${loaded.error.map((item) => item.message).join("; ")}`);
  const fixture = fixtureFor(mode);
  const simulation = createSimulationEngine();
  const seed = mode === "UNSAFE" ? 17 : mode.startsWith("REVISION") ? 31 : 19;
  const loadedFixture = simulation.load(deepClone(fixture), seed);
  if (!loadedFixture.ok) throw new Error(`Curriculum fixture failed to load: ${loadedFixture.error.map((item) => item.path).join(", ")}`);
  const snapshot = simulation.snapshot();
  const agentState = snapshot.agents[0];
  if (!agentState) throw new Error("Curriculum fixture requires one initial worker.");
  const agent: AgentDefinition = { id: agentState.id, name: "Keeper 01", role: "WORKER", contextBudget: agentState.contextBudget, toolIds: agentState.tools, tools: agentState.tools };
  const selection = subjectRefs(mode);
  const job: InstructionJob = { id: `job.curriculum.golden.${mode.toLowerCase()}`, type: "FEED", targetRefs: ["dino.rex"], priority: 100, dueTime: 120, assignedAgentId: agent.id, promptRef: selection.promptRef, skillRefs: selection.skillRefs, systemPromptRefs: selection.systemPromptRefs, maxSteps: 256 };
  const context = createContextService();
  const projected = context.project({ id: `context.curriculum.golden.${mode.toLowerCase()}`, agentId: agent.id, jobId: job.id, budget: agent.contextBudget, logicalTime: 0, promptRef: selection.promptRef, skillRefs: selection.skillRefs, systemPromptRefs: selection.systemPromptRefs, toolIds: agent.tools, registry, applicabilityTags: ["task:feeding", "safety:standard"] });
  if (!projected.ok) throw new Error(`Golden context projection failed: ${projected.error.message}`);
  const instruction = createInstructionEngine({ content: registry, context, simulation });
  const prepared = instruction.prepare({ ...job, contextSnapshot: projected.value }, agent);
  if (!prepared.ok) throw new Error(`Golden job preparation failed: ${prepared.error.diagnostics.join("; ")}`);
  const update = instruction.start(prepared.value);
  const completed = instruction.runToCompletion(update.executionId);
  const outcome = completed.outcome;
  const finalSnapshot = outcome?.worldSnapshot ?? simulation.snapshot();
  const modeOutcome: GoldenTrace["outcome"] = mode === "UNSAFE"
    ? finalSnapshot.incidents.some((incident) => incident.status !== "RECOVERED") ? "INCIDENT" : outcome?.status ?? "FAILED"
    : outcome?.status ?? "FAILED";
  const postconditions = prepared.value.graph.nodes.filter((node) => node.applicable && node.category === "POSTCONDITION").map((node) => node.clauseId);
  return deepFreeze({ scenarioId: mode === "UNSAFE" ? "scenario.curriculum.carnivore-first-attempt" : mode.startsWith("REVISION") ? "scenario.curriculum.gate-jam" : "scenario.curriculum.scale", mode, seed, events: simulation.events(), snapshot: finalSnapshot, outcome: modeOutcome, missingPostconditions: postconditions.length === 0 ? ["containment.postcondition"] : [], contextLoad: projected.value.totalLoad, contextBudget: projected.value.budget, artifactRefs: [selection.promptRef, ...selection.skillRefs, ...selection.systemPromptRefs] });
}

export function runGoldenUnsafe(): GoldenTrace {
  return runOnce("UNSAFE");
}

export function runGoldenSafe(): GoldenTrace {
  return runOnce("SAFE");
}

export function runGoldenRevisionFailure(): GoldenTrace {
  return runOnce("REVISION_FAILURE");
}

export function runGoldenRevisionSuccess(): GoldenTrace {
  return runOnce("REVISION_SUCCESS");
}

export function replayGolden(trace: GoldenTrace): GoldenReplayResult {
  const replay = runOnce(trace.mode);
  const originalHash = stableHash({ events: trace.events, snapshot: trace.snapshot, outcome: trace.outcome, missingPostconditions: trace.missingPostconditions, contextLoad: trace.contextLoad, contextBudget: trace.contextBudget, artifactRefs: trace.artifactRefs });
  const replayHash = stableHash({ events: replay.events, snapshot: replay.snapshot, outcome: replay.outcome, missingPostconditions: replay.missingPostconditions, contextLoad: replay.contextLoad, contextBudget: replay.contextBudget, artifactRefs: replay.artifactRefs });
  return deepFreeze({ exact: originalHash === replayHash, ...(originalHash === replayHash ? {} : { firstDifference: `golden hash ${originalHash} != replay hash ${replayHash}` }), original: trace, replay });
}

export function runPolicyRefactorComparison() {
  const registry = createContentRegistry();
  const loaded = registry.loadPack(CURRICULUM_CONTENT_PACK);
  if (!loaded.ok) throw new Error(`Curriculum pack failed to load: ${loaded.error.map((item) => item.message).join("; ")}`);
  const context = createContextService();
  const base = { agentId: "agent.keeper01", jobId: "job.curriculum.policy-comparison", budget: 8_000, logicalTime: 0, promptRef: CURRICULUM_ARTIFACT_REFS.explicitPrompt, toolIds: createCurriculumFixture().agents[0]?.tools ?? [], registry };
  const duplicatedRefs = [CURRICULUM_ARTIFACT_REFS.safeFeedingV1, CURRICULUM_ARTIFACT_REFS.visitorBuffer, CURRICULUM_ARTIFACT_REFS.maintenanceFallback];
  const refactoredRefs = [CURRICULUM_ARTIFACT_REFS.contextMinimizer];
  const duplicated = context.project({ ...base, id: "context.curriculum.policy.duplicated", skillRefs: duplicatedRefs, systemPromptRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy, CURRICULUM_ARTIFACT_REFS.visitorPolicy] });
  const refactored = context.project({ ...base, id: "context.curriculum.policy.refactored", skillRefs: refactoredRefs, systemPromptRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy] });
  if (!duplicated.ok || !refactored.ok) throw new Error(`Policy context comparison failed: ${duplicated.ok ? "" : duplicated.error.message} ${refactored.ok ? "" : refactored.error.message}`.trim());
  return deepFreeze({ duplicatedLoad: duplicated.value.totalLoad, refactoredLoad: refactored.value.totalLoad, cheaper: refactored.value.totalLoad < duplicated.value.totalLoad, duplicatedRefs, refactoredRefs });
}

export function runPhase10ScaleComparison() {
  const earlyRuns = [runGoldenUnsafe(), runGoldenUnsafe(), runGoldenUnsafe()];
  const lateRuns = [runGoldenSafe(), runGoldenSafe(), runGoldenSafe()];
  const earlyInterventions = earlyRuns.filter((run) => run.outcome !== "SUCCEEDED" || run.snapshot.incidents.some((incident) => incident.status !== "RECOVERED")).length;
  const lateInterventions = lateRuns.filter((run) => run.outcome !== "SUCCEEDED" || run.snapshot.incidents.some((incident) => incident.status !== "RECOVERED")).length;
  return deepFreeze({ earlyRuns, lateRuns, earlyInterventions, lateInterventions, fewerInterventions: lateInterventions < earlyInterventions });
}

export type Phase10ScaleComparison = ReturnType<typeof runPhase10ScaleComparison>;

export function createScenarioDirector(initialPhase = 0): ScenarioDirectorPort {
  let currentPhase = Math.max(0, Math.min(10, Math.trunc(initialPhase)));
  let maxUnlockedPhase = currentPhase;
  let interventions = 0;
  const completed = new Set<string>();
  const incidents = new Set<string>();
  const unlocked = new Set<string>();
  for (const phase of CURRICULUM_CONTENT_PACK.phases.filter((item) => item.phase < currentPhase)) for (const objective of phase.objectives) completed.add(objective.id);
  const state = (): ScenarioDirectorState => deepFreeze({ currentPhase, maxUnlockedPhase, completedObjectives: [...completed].sort(), interventions, incidentIds: [...incidents].sort(), unlockedRefs: [...unlocked].map((key) => { const at = key.lastIndexOf("@"); return { artifactId: key.slice(0, at), version: Number(key.slice(at + 1)) }; }).sort((a, b) => refKey(a).localeCompare(refKey(b))) });
  return {
    state,
    phase: (phaseNumber) => { const requested = Math.max(0, Math.min(10, Math.trunc(phaseNumber))); if (requested <= maxUnlockedPhase) currentPhase = requested; return { ...state(), phase: currentPhase }; },
    completeObjective: (objectiveId) => {
      const phase = CURRICULUM_CONTENT_PACK.phases.find((item) => item.phase === currentPhase);
      if (!phase?.objectives.some((objective) => objective.id === objectiveId)) return state();
      if ((phase.prerequisites ?? []).some((prerequisite) => !completed.has(prerequisite))) return state();
      completed.add(objectiveId);
      if (phase.objectives.every((objective) => completed.has(objective.id))) maxUnlockedPhase = Math.min(10, Math.max(maxUnlockedPhase, currentPhase + 1));
      return state();
    },
    recordIntervention: () => { interventions += 1; return state(); },
    availableArtifacts: (phaseNumber) => {
      if (phaseNumber > maxUnlockedPhase) return deepFreeze([]);
      const phaseRefs = CURRICULUM_CONTENT_PACK.phases.find((phase) => phase.phase === phaseNumber)?.availableRefs ?? [];
      for (const ref of phaseRefs) unlocked.add(refKey(ref));
      return deepFreeze(phaseRefs.map((ref) => ({ ...ref })));
    },
    canEnter: (phaseNumber) => Number.isInteger(phaseNumber) && phaseNumber >= 0 && phaseNumber <= maxUnlockedPhase,
    restore: (saved) => {
      currentPhase = Math.max(0, Math.min(10, Math.trunc(saved.currentPhase)));
      maxUnlockedPhase = Math.max(currentPhase, Math.min(10, Math.trunc(saved.maxUnlockedPhase)));
      interventions = Math.max(0, Math.trunc(saved.interventions));
      completed.clear(); for (const id of saved.completedObjectives) completed.add(id);
      incidents.clear(); for (const id of saved.incidentIds) incidents.add(id);
      unlocked.clear(); for (const ref of saved.unlockedRefs) unlocked.add(refKey(ref));
    },
  };
}
