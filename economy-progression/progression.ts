import type {
  Eligibility,
  ProgressEvent,
  ProgressEventValidation,
  ProgressionRule,
  ProgressionService,
  ProgressSnapshot,
  PurchaseCommand,
  PurchaseResult,
  UnlockEvent,
  UnlockRecord,
} from "./types.ts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function validNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateProgressEvent(event: unknown): ProgressEventValidation {
  const errors: string[] = [];
  if (event === null || typeof event !== "object" || Array.isArray(event)) return freeze({ valid: false, errors: Object.freeze(["event must be an object"]) });
  const candidate = event as Partial<ProgressEvent>;
  if (!candidate.id || typeof candidate.id !== "string") errors.push("id must be a stable non-empty string");
  if (!candidate.type || typeof candidate.type !== "string") errors.push("type must be a stable non-empty string");
  if (!validNonNegativeInteger(candidate.logicalTime as number)) errors.push("logicalTime must be a non-negative safe integer");
  for (const [name, value] of [["value", candidate.value], ["workerCount", candidate.workerCount], ["contextCapacity", candidate.contextCapacity], ["interventions", candidate.interventions]] as const) {
    if (value !== undefined && !validNonNegativeInteger(value)) errors.push(`${name} must be a non-negative safe integer`);
  }
  if (candidate.severity !== undefined && (!validNonNegativeInteger(candidate.severity) || candidate.severity > 4)) errors.push("severity must be an integer from 0 through 4");
  if (candidate.signals !== undefined && (candidate.signals === null || typeof candidate.signals !== "object" || Array.isArray(candidate.signals))) errors.push("signals must be an object");
  else for (const [name, value] of Object.entries(candidate.signals ?? {})) if (!validNonNegativeInteger(typeof value === "boolean" ? (value ? 1 : 0) : value)) errors.push(`signals.${name} must be a non-negative safe integer or boolean`);
  if (candidate.metrics !== undefined && (candidate.metrics === null || typeof candidate.metrics !== "object" || Array.isArray(candidate.metrics))) errors.push("metrics must be an object");
  else for (const [name, value] of Object.entries(candidate.metrics ?? {})) if (!validNonNegativeInteger(value)) errors.push(`metrics.${name} must be a non-negative safe integer`);
  return freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

/** Authored conceptual pressure gates from application PRD section 16. */
export const DEFAULT_PROGRESSION_RULES: readonly ProgressionRule[] = Object.freeze([
  { phase: 0, id: "phase.onboarding", title: "Onboarding", pressure: "One low-risk job needs an explicit completion condition.", lesson: "A Prompt must state an observable goal and postcondition.", unlocks: ["capability.prompt.basic"] },
  { phase: 1, id: "phase.containment", title: "Containment", pressure: "A gate sequence exposes a missing safety postcondition.", lesson: "Intent is not a specification; verify outcomes.", unlocks: ["capability.prompt.better", "capability.skill.basic"], requiredSignals: { "containment.pressure": 1 } },
  { phase: 2, id: "phase.repetition", title: "Repetition", pressure: "Routine jobs repeat instruction cost.", lesson: "Reusable Skills reduce duplicated instructions.", unlocks: ["capability.skill-library", "capability.source-inspection"], requiredSignals: { "repetition.pressure": 1 } },
  { phase: 3, id: "phase.policy", title: "Policy", pressure: "Safety rules are repeated across Skills.", lesson: "Move invariants into System Prompts.", unlocks: ["capability.system-prompt"], requiredSignals: { "policy.pressure": 1 } },
  { phase: 4, id: "phase.context", title: "Context pressure", pressure: "A context budget is exceeded by irrelevant or duplicated context.", lesson: "Relevant context is better than maximal context.", unlocks: ["capability.context-meter", "capability.context-profiler", "capability.context-capacity"], requiredSignals: { "context.pressure": 1 } },
  { phase: 5, id: "phase.evals", title: "Evals", pressure: "A production edge case reveals that a demo pass is not confidence.", lesson: "Expected behavior needs repeatable eval coverage.", unlocks: ["capability.evals", "capability.eval-suites", "capability.replay"], requiredSignals: { "eval.pressure": 1 } },
  { phase: 6, id: "phase.review", title: "Change discipline", pressure: "A Skill optimization risks a regression.", lesson: "Review, select evals, run, then deploy.", unlocks: ["capability.review", "capability.deployment"], requiredSignals: { "review.pressure": 1 } },
  { phase: 7, id: "phase.memory", title: "Memory", pressure: "Changing maintenance conditions make stale observations harmful.", lesson: "Freshness, provenance, and TTL matter.", unlocks: ["capability.memory", "capability.memory-controls"], requiredSignals: { "memory.pressure": 1 } },
  { phase: 8, id: "phase.parallelism", title: "Parallelism", pressure: "Multiple Workers create concurrency and context-switching pressure.", lesson: "Parallel throughput introduces coordination cost.", unlocks: ["capability.multiple-agents", "capability.worker-queues"], requiredSignals: { "parallel.pressure": 1 } },
  { phase: 9, id: "phase.orchestration", title: "Orchestration", pressure: "Manual attention is overloaded by simultaneous work.", lesson: "Delegate with explicit authority, routing, escalation, and reporting contracts.", unlocks: ["capability.manager-agent", "manager.agent"], requiredSignals: { "orchestration.pressure": 1 } },
  { phase: 10, id: "phase.scale", title: "Scale", pressure: "Many habitats and incidents require system-level routing.", lesson: "Architect systems, not individual tasks.", unlocks: ["capability.advanced-routing", "capability.automation-goals"], requiredSignals: { "scale.pressure": 1 } },
] as ProgressionRule[]);

export interface ProgressionServiceOptions {
  readonly rules?: readonly ProgressionRule[];
  readonly initialPhase?: number;
  readonly initialWorkerCount?: number;
  readonly initialContextCapacity?: number;
  readonly purchase?: (command: PurchaseCommand) => PurchaseResult;
  readonly purchaseCan?: (id: string) => Eligibility;
}

function emptyEligibility(id: string, snapshot: ProgressSnapshot): Eligibility {
  const unlocked = snapshot.capabilities.includes(id);
  return freeze({
    id,
    eligible: unlocked,
    code: unlocked ? "AVAILABLE" : "PHASE_LOCKED",
    reason: unlocked ? `${id} is unlocked.` : `${id} is not unlocked yet.`,
    cost: 0,
    currentLevel: unlocked ? 1 : 0,
    targetLevel: 1,
    prerequisites: Object.freeze([]),
  });
}

/** Pure deterministic phase/signal state machine with auditable unlocks. */
export function createProgressionService(options: ProgressionServiceOptions = {}): MutableProgressionService {
  const rules = Object.freeze([...(options.rules ?? DEFAULT_PROGRESSION_RULES)].sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id)).map((rule) => freeze({ ...rule, unlocks: Object.freeze([...rule.unlocks]), ...(rule.prerequisites ? { prerequisites: Object.freeze([...rule.prerequisites]) } : {}), ...(rule.requiredSignals ? { requiredSignals: freeze({ ...rule.requiredSignals }) } : {}) })));
  const signalValues = new Map<string, number>();
  const metricValues = new Map<string, number>();
  const milestoneValues = new Set<string>();
  const objectiveValues = new Set<string>();
  const eventIds = new Set<string>();
  const unlockValues = new Map<string, UnlockRecord>();
  let currentPhase = Math.max(0, Math.min(10, Math.trunc(options.initialPhase ?? 0)));
  let stateVersion = 0;
  let workerCount = Math.max(1, Math.trunc(options.initialWorkerCount ?? 1));
  let contextCapacity = Math.max(1, Math.trunc(options.initialContextCapacity ?? 8_000));
  let interventions = 0;
  let purchaseDelegate = options.purchase;
  let purchaseCanDelegate = options.purchaseCan;
  let purchaseTransactionVersion = () => stateVersion;
  const purchaseResults = new Map<string, PurchaseResult>();

  function capabilities(): readonly string[] {
    return Object.freeze([...unlockValues.keys()].sort());
  }
  function snapshot(): ProgressSnapshot {
    const unlocks = Object.freeze([...unlockValues.values()].sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id)));
    return freeze({
      phase: currentPhase,
      stateVersion,
      signals: freeze(Object.fromEntries([...signalValues.entries()].sort(([a], [b]) => a.localeCompare(b)))),
      milestones: Object.freeze([...milestoneValues].sort()),
      completedObjectives: Object.freeze([...objectiveValues].sort()),
      unlocks,
      capabilities: capabilities(),
      workerCount,
      contextCapacity,
      interventions,
      metrics: freeze(Object.fromEntries([...metricValues.entries()].sort(([a], [b]) => a.localeCompare(b)))),
    });
  }

  function meets(rule: ProgressionRule): boolean {
    for (const [key, required] of Object.entries(rule.requiredSignals ?? {})) {
      if ((signalValues.get(key) ?? metricValues.get(key) ?? 0) < required) return false;
    }
    for (const prerequisite of rule.prerequisites ?? []) if (!unlockValues.has(prerequisite) && !milestoneValues.has(prerequisite) && !objectiveValues.has(prerequisite)) return false;
    return true;
  }

  function unlock(rule: ProgressionRule, id: string, event: ProgressEvent): UnlockEvent | null {
    if (unlockValues.has(id)) return null;
    const record: UnlockRecord = freeze({ id, phase: rule.phase, reason: `${rule.pressure} Lesson: ${rule.lesson}`, eventId: event.id, logicalTime: event.logicalTime });
    unlockValues.set(id, record);
    return freeze({ kind: "UNLOCK" as const, ...record });
  }

  function process(event: ProgressEvent): readonly UnlockEvent[] {
    if (!validateProgressEvent(event).valid || eventIds.has(event.id)) return Object.freeze([]);
    const stagedSignals = new Map(signalValues);
    const stagedMetrics = new Map(metricValues);
    const stageAdd = (target: Map<string, number>, key: string, value: number): boolean => {
      const next = (target.get(key) ?? 0) + value;
      if (!Number.isSafeInteger(next) || next < 0) return false;
      target.set(key, next);
      return true;
    };
    const stagedAmount = event.value ?? 1;
    if (event.signal && !stageAdd(stagedSignals, event.signal, stagedAmount)) return Object.freeze([]);
    if (event.metric && !stageAdd(stagedMetrics, event.metric, stagedAmount)) return Object.freeze([]);
    for (const [key, value] of Object.entries(event.signals ?? {})) {
      const numeric = typeof value === "boolean" ? (value ? 1 : 0) : value;
      if (!stageAdd(stagedSignals, key, numeric)) return Object.freeze([]);
    }
    for (const [key, value] of Object.entries(event.metrics ?? {})) if (!stageAdd(stagedMetrics, key, value)) return Object.freeze([]);
    const stagedInterventions = Math.max(interventions, event.interventions ?? 0) + (event.type === "INTERVENTION" ? Math.max(1, stagedAmount) : 0);
    if (!Number.isSafeInteger(stagedInterventions)) return Object.freeze([]);
    eventIds.add(event.id);
    stateVersion += 1;
    const amount = event.value ?? 1;
    if (event.signal) signalValues.set(event.signal, (signalValues.get(event.signal) ?? 0) + amount);
    if (event.metric) metricValues.set(event.metric, (metricValues.get(event.metric) ?? 0) + amount);
    for (const [key, value] of Object.entries(event.signals ?? {})) {
      const numeric = typeof value === "boolean" ? (value ? 1 : 0) : value;
      signalValues.set(key, (signalValues.get(key) ?? 0) + numeric);
    }
    for (const [key, value] of Object.entries(event.metrics ?? {})) metricValues.set(key, (metricValues.get(key) ?? 0) + value);
    if (event.milestone) milestoneValues.add(event.milestone);
    if (event.objectiveId) objectiveValues.add(event.objectiveId);
    if (event.workerCount !== undefined) workerCount = Math.max(workerCount, Math.trunc(event.workerCount));
    if (event.contextCapacity !== undefined) contextCapacity = Math.max(contextCapacity, Math.trunc(event.contextCapacity));
    if (event.interventions !== undefined) interventions = Math.max(interventions, Math.trunc(event.interventions));
    if (event.type === "INTERVENTION") interventions += Math.max(1, amount);
    if (event.type === "INCIDENT" && (event.severity ?? amount) >= 2) signalValues.set("containment.pressure", Math.max(1, signalValues.get("containment.pressure") ?? 0));
    if (event.type === "JOB_RESULT" && (event.signal === "late" || event.signal === "failed")) signalValues.set("repetition.pressure", Math.max(1, signalValues.get("repetition.pressure") ?? 0));
    if (workerCount >= 2) signalValues.set("parallel.pressure", Math.max(1, signalValues.get("parallel.pressure") ?? 0));
    if (interventions >= 12) signalValues.set("parallel.pressure", Math.max(1, signalValues.get("parallel.pressure") ?? 0));
    if (workerCount >= 4 || interventions >= 12) signalValues.set("orchestration.pressure", Math.max(1, signalValues.get("orchestration.pressure") ?? 0));
    const emitted: UnlockEvent[] = [];
    // Only the next authored phase can advance. This prevents out-of-order
    // signals from skipping the conceptual curriculum.
    let next = rules.find((rule) => rule.phase === currentPhase + 1);
    while (next && meets(next)) {
      currentPhase = next.phase;
      for (const id of next.unlocks) {
        const eventValue = unlock(next, id, event);
        if (eventValue) emitted.push(eventValue);
      }
      next = rules.find((rule) => rule.phase === currentPhase + 1);
    }
    return Object.freeze(emitted);
  }

  function can(id: string): Eligibility {
    return purchaseCanDelegate?.(id) ?? emptyEligibility(id, snapshot());
  }

  function purchase(command: PurchaseCommand): PurchaseResult {
    const prior = purchaseResults.get(command.transactionId);
    if (prior) return prior.ok ? freeze({ ...prior, duplicate: true }) : prior;
    if (command.expectedStateVersion !== stateVersion) {
      const conflict: PurchaseResult = freeze({ ok: false as const, transactionId: command.transactionId, error: freeze({ code: "STATE_VERSION_CONFLICT" as const, message: `Expected progression version ${command.expectedStateVersion}; current version is ${stateVersion}.` }), balance: freeze({ amount: 0, version: 0 }), stateVersion });
      purchaseResults.set(command.transactionId, conflict);
      return conflict;
    }
    if (!purchaseDelegate) {
      const unavailable: PurchaseResult = freeze({ ok: false as const, transactionId: command.transactionId, error: freeze({ code: "UNKNOWN_ITEM" as const, message: "No purchase coordinator is attached." }), balance: { amount: 0, version: 0 }, stateVersion });
      purchaseResults.set(command.transactionId, unavailable);
      return unavailable;
    }
    const result = purchaseDelegate({ ...command, expectedStateVersion: purchaseTransactionVersion() });
    if (result.ok && !result.duplicate) {
      const item = result.entitlement;
      if (item.type === "WORKER") workerCount += item.quantity;
      if (item.type === "CONTEXT_CAPACITY") contextCapacity = Math.max(contextCapacity, 8_000 + item.level * 2_000);
      if (item.type === "MANAGER") signalValues.set("orchestration.pressure", Math.max(1, signalValues.get("orchestration.pressure") ?? 0));
      process({ id: `purchase:${command.transactionId}`, type: "PURCHASE", logicalTime: command.logicalTime ?? 0, reason: `Purchased ${item.id}.` });
    }
    const publicResult: PurchaseResult = freeze({ ...result, stateVersion });
    purchaseResults.set(command.transactionId, publicResult);
    return publicResult;
  }

  /** Internal wiring seam used by the composed economy service. */
  function attachPurchase(delegate: (command: PurchaseCommand) => PurchaseResult, eligibility: (id: string) => Eligibility, transactionVersion?: () => number): void {
    purchaseDelegate = delegate;
    purchaseCanDelegate = eligibility;
    purchaseTransactionVersion = transactionVersion ?? (() => stateVersion);
  }

  function checkpoint() {
    return freeze({ snapshot: snapshot(), eventIds: Object.freeze([...eventIds].sort()), purchaseResults: Object.freeze([...purchaseResults.entries()].map(([id, result]) => freeze({ id, result })).sort((a, b) => a.id.localeCompare(b.id))) });
  }

  function restore(value: ReturnType<typeof checkpoint>): void {
    const saved = value.snapshot;
    currentPhase = saved.phase; stateVersion = saved.stateVersion; workerCount = saved.workerCount; contextCapacity = saved.contextCapacity; interventions = saved.interventions;
    signalValues.clear(); for (const [key, amount] of Object.entries(saved.signals)) signalValues.set(key, amount);
    metricValues.clear(); for (const [key, amount] of Object.entries(saved.metrics)) metricValues.set(key, amount);
    milestoneValues.clear(); for (const id of saved.milestones) milestoneValues.add(id);
    objectiveValues.clear(); for (const id of saved.completedObjectives) objectiveValues.add(id);
    unlockValues.clear(); for (const record of saved.unlocks) unlockValues.set(record.id, freeze({ ...record }));
    eventIds.clear(); for (const id of value.eventIds) eventIds.add(id);
    purchaseResults.clear(); for (const item of value.purchaseResults) purchaseResults.set(item.id, item.result);
  }

  // Phase 0 is an authored starting capability and therefore appears in the
  // audit log before the first gameplay event.
  const initialRule = rules.find((rule) => rule.phase === currentPhase);
  if (initialRule) for (const id of initialRule.unlocks) unlockValues.set(id, freeze({ id, phase: initialRule.phase, reason: `${initialRule.pressure} Lesson: ${initialRule.lesson}`, eventId: "system.initial", logicalTime: 0 }));

  return Object.freeze({ snapshot, process, can, purchase, rules: () => rules, attachPurchase, checkpoint, restore });
}

export type MutableProgressionService = ProgressionService & {
  readonly attachPurchase: (delegate: (command: PurchaseCommand) => PurchaseResult, eligibility: (id: string) => Eligibility, transactionVersion?: () => number) => void;
};
