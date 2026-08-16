import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type {
  DelegationRule,
  DelegationFailure,
  EligibilityFact,
  AuthorityBoundary,
  OrchestrationPriorityClass,
  OrchestrationScheduler,
  PriorityPolicy,
  SchedulingDecision,
  SchedulingInput,
  SchedulingJob,
  SchedulingWorker,
} from "./types.ts";

const DEFAULT_POLICY: Required<PriorityPolicy> = {
  safetyIncidents: 400,
  containment: 300,
  animalHealth: 200,
  guestThroughput: 100,
  routine: 0,
  safetyFloor: 2,
};

/** Authored product safety boundary. Manager policy may tune presentation
 * weights, but it cannot redefine which incident severities are safety work. */
export const HARD_SAFETY_SEVERITY = 2;

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function priorityWeight(policy: PriorityPolicy | undefined, priorityClass: OrchestrationPriorityClass): number {
  const merged = { ...DEFAULT_POLICY, ...(policy ?? {}) };
  const routine = merged.routine;
  const guest = Math.max(merged.guestThroughput, routine + 1);
  const animal = Math.max(merged.animalHealth, guest + 1);
  const containment = Math.max(merged.containment, animal + 1);
  const safety = Math.max(merged.safetyIncidents, containment + 1);
  switch (priorityClass) {
    case "SAFETY_INCIDENT": return safety;
    case "CONTAINMENT": return containment;
    case "ANIMAL_HEALTH": return animal;
    case "GUEST_THROUGHPUT": return guest;
    case "ROUTINE": return routine;
  }
}

export function classifyPriority(job: SchedulingJob, policy?: PriorityPolicy): OrchestrationPriorityClass {
  void policy; // classification is deliberately independent of authored policy
  const type = job.type.toUpperCase();
  const hardClass: OrchestrationPriorityClass = job.safetyCritical || (job.severity ?? 0) >= HARD_SAFETY_SEVERITY || type.includes("INCIDENT") || type.includes("ESCALAT") || type.includes("RESCUE") || type.includes("SECURITY")
    ? "SAFETY_INCIDENT"
    : type.includes("CONTAIN") || type.includes("GATE") || type.includes("EVACUAT")
      ? "CONTAINMENT"
      : type.includes("FEED") || type.includes("ANIMAL") || type.includes("HEALTH")
        ? "ANIMAL_HEALTH"
        : type.includes("VISITOR") || type.includes("GUEST") || type.includes("THROUGHPUT")
          ? "GUEST_THROUGHPUT"
          : "ROUTINE";
  if (!job.priorityClass) return hardClass;
  const order: readonly OrchestrationPriorityClass[] = ["ROUTINE", "GUEST_THROUGHPUT", "ANIMAL_HEALTH", "CONTAINMENT", "SAFETY_INCIDENT"];
  return order.indexOf(job.priorityClass) > order.indexOf(hardClass) ? job.priorityClass : hardClass;
}

function ruleMatches(rule: DelegationRule, job: SchedulingJob): boolean {
  if (rule.enabled === false) return false;
  if (rule.taskTypes && rule.taskTypes.length > 0 && !rule.taskTypes.includes(job.type)) return false;
  return true;
}

function workerTools(worker: SchedulingWorker): readonly string[] {
  return worker.toolIds ?? worker.tools ?? [];
}

function queueLength(worker: SchedulingWorker): number {
  return Math.max(0, worker.queueLength ?? 0);
}

function queueCapacity(worker: SchedulingWorker, rule: DelegationRule | undefined, job: SchedulingJob): number {
  return Math.max(0, job.queueCapacity ?? rule?.maxQueueLength ?? worker.queueCapacity ?? Number.MAX_SAFE_INTEGER);
}

function contextLoad(worker: SchedulingWorker): number {
  return Math.max(0, worker.contextLoad ?? 0);
}

function buildFact(worker: SchedulingWorker, job: SchedulingJob, rule: DelegationRule | undefined, managerId?: string, authority?: AuthorityBoundary, activeManagerByWorker?: Readonly<Record<string, string>>): EligibilityFact {
  const tools = new Set(workerTools(worker));
  const requiredTools = [...new Set([...(job.requiredToolIds ?? []), ...(rule?.requiredToolIds ?? []), ...(rule?.requiredCapabilities ?? [])])].sort();
  const missingToolIds = requiredTools.filter((tool) => !tools.has(tool));
  const requiredContextRefs = [...new Set(job.requiredContextRefs ?? [])].sort();
  // The scheduler only receives context refs that are already known to the
  // caller. A worker can therefore satisfy a ref iff it is represented by the
  // optional `sourceId`/`loadedContextRefs` adapter extension.
  const loaded = new Set(worker.loadedContextRefs ?? []);
  const missingContextRefs = worker.loadedContextRefs === undefined ? [] : requiredContextRefs.filter((ref) => !loaded.has(ref));
  const projectedContext = contextLoad(worker) + Math.max(0, job.requiredContextLoad ?? 0);
  const reasons: string[] = [];
  if (worker.enabled === false) reasons.push("WORKER_DISABLED");
  if (worker.status && ["OFFLINE", "DISABLED", "UNAVAILABLE"].includes(worker.status)) reasons.push("WORKER_UNAVAILABLE");
  const activeOwner = activeManagerByWorker?.[worker.id] ?? worker.managerId;
  if (managerId && activeOwner && activeOwner !== managerId) reasons.push(`WORKER_MANAGED_BY:${activeOwner}`);
  if (job.requiredRole && worker.role !== job.requiredRole) reasons.push(`ROLE_MISMATCH:${job.requiredRole}`);
  if (rule?.roles && rule.roles.length > 0 && (!worker.role || !rule.roles.includes(worker.role))) reasons.push("RULE_ROLE_MISMATCH");
  if (authority?.allowedWorkerRoles && (!worker.role || !authority.allowedWorkerRoles.includes(worker.role))) reasons.push("AUTHORITY_WORKER_ROLE");
  if (authority?.allowedToolIds && requiredTools.some((tool) => !authority.allowedToolIds!.includes(tool))) reasons.push("AUTHORITY_TOOL_DENIED");
  if (rule?.targetWorkerIds && rule.targetWorkerIds.length > 0 && !rule.targetWorkerIds.includes(worker.id)) reasons.push("RULE_TARGET_MISMATCH");
  if (missingToolIds.length > 0) reasons.push(`MISSING_TOOL:${missingToolIds.join(",")}`);
  if (missingContextRefs.length > 0) reasons.push(`MISSING_CONTEXT:${missingContextRefs.join(",")}`);
  if (projectedContext > worker.contextBudget || (rule?.maxContextLoad !== undefined && projectedContext > rule.maxContextLoad)) reasons.push("WORKER_CONTEXT_OVERFLOW");
  if (queueLength(worker) >= queueCapacity(worker, rule, job)) reasons.push("QUEUE_FULL");
  if (job.active && worker.id !== job.assignedAgentId) reasons.push("JOB_ACTIVE");
  return {
    workerId: worker.id,
    eligible: reasons.length === 0,
    role: worker.role ?? "UNKNOWN",
    status: worker.status ?? "IDLE",
    queueLength: queueLength(worker),
    queueCapacity: queueCapacity(worker, rule, job),
    contextLoad: projectedContext,
    contextBudget: worker.contextBudget,
    missingToolIds,
    missingContextRefs,
    reasons,
    ...(rule ? { matchedRuleId: rule.id } : {}),
  };
}

function failureFor(facts: readonly EligibilityFact[], input: SchedulingInput): DelegationFailure {
  if (input.manager?.authority.allowedTaskTypes && !input.manager.authority.allowedTaskTypes.includes(input.job.type)) return "AUTHORITY_DENIED";
  if (facts.length === 0) return "NO_ELIGIBLE_WORKER";
  if (facts.some((fact) => fact.reasons.includes("AUTHORITY_WORKER_ROLE") || fact.reasons.includes("AUTHORITY_TOOL_DENIED"))) return "AUTHORITY_DENIED";
  if (facts.some((fact) => fact.reasons.some((reason) => reason.startsWith("MISSING_TOOL")))) return "MISSING_TOOL";
  if (facts.length > 0 && facts.every((fact) => fact.reasons.includes("WORKER_CONTEXT_OVERFLOW"))) return "WORKER_CONTEXT_OVERFLOW";
  if (facts.some((fact) => fact.reasons.some((reason) => reason.startsWith("WORKER_MANAGED_BY")))) return "WORKER_MANAGER_CONFLICT";
  if (input.activeAssignments?.[input.job.id]) return "ALREADY_ASSIGNED";
  return "NO_ELIGIBLE_WORKER";
}

function ruleList(input: SchedulingInput): readonly DelegationRule[] {
  const rules = input.rules ?? input.manager?.rules ?? [];
  return [...rules].filter((rule) => rule.enabled !== false).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

function tieBreak(worker: SchedulingWorker, rule: DelegationRule | undefined): string {
  return `rule.priority:${rule?.priority ?? 0}>queueLength:${queueLength(worker)}>contextLoad:${contextLoad(worker)}>workerId:${worker.id}`;
}

export function createOrchestrationScheduler(): OrchestrationScheduler {
  const decide = (input: SchedulingInput): SchedulingDecision => {
    if (!input?.job || typeof input.job.id !== "string" || typeof input.job.type !== "string" || !Array.isArray(input.job.targetRefs) || !Array.isArray(input.workers)) return freeze({ status: "UNASSIGNED", reason: "INVALID_REQUEST", eligibility: [], priorityClass: "ROUTINE" });
    const priorityClass = classifyPriority(input.job, input.priorityPolicy ?? input.manager?.priorityPolicy);
    if (input.activeAssignments?.[input.job.id] || (input.job.active && input.job.assignedAgentId)) {
      return freeze({ status: "UNASSIGNED", reason: "ALREADY_ASSIGNED", eligibility: [], priorityClass });
    }
    if (input.manager?.authority.canAssign === false) {
      return freeze({ status: "UNASSIGNED", reason: "AUTHORITY_DENIED", eligibility: [], priorityClass });
    }
    if (input.manager?.authority.allowedTaskTypes && !input.manager.authority.allowedTaskTypes.includes(input.job.type)) {
      return freeze({ status: "UNASSIGNED", reason: "AUTHORITY_DENIED", eligibility: [], priorityClass });
    }
    const rules = ruleList(input);
    const matches = rules.length === 0 ? [undefined] : rules.filter((rule) => ruleMatches(rule, input.job));
    if (matches.length === 0) return freeze({ status: "UNASSIGNED", reason: "NO_MATCHING_RULE", eligibility: [], priorityClass });
    const allFacts: EligibilityFact[] = [];
    for (const rule of matches) {
      const facts = input.workers
        .filter((worker) => !input.manager || (input.manager.workerIds ?? input.manager.workerPool ?? []).includes(worker.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((worker) => buildFact(worker, input.job, rule, input.manager?.id ?? input.manager?.managerId, input.manager?.authority, input.activeManagerByWorker));
      allFacts.push(...facts);
      const eligible = facts.filter((fact) => fact.eligible);
      if (eligible.length === 0) continue;
      const chosenFact = eligible.slice().sort((a, b) => a.queueLength - b.queueLength || a.contextLoad - b.contextLoad || a.workerId.localeCompare(b.workerId))[0]!;
      const chosenWorker = input.workers.find((worker) => worker.id === chosenFact.workerId)!;
      return freeze({ status: "ASSIGNED", workerId: chosenFact.workerId, matchedRuleId: rule?.id ?? "rule.default", eligibility: allFacts, tieBreak: tieBreak(chosenWorker, rule), priorityClass });
    }
    return freeze({ status: "UNASSIGNED", reason: failureFor(allFacts, input), eligibility: allFacts, priorityClass });
  };

  const order = (jobs: readonly SchedulingJob[], policy?: PriorityPolicy): readonly SchedulingJob[] => jobs.slice().sort((a, b) => {
    const classA = classifyPriority(a, policy);
    const classB = classifyPriority(b, policy);
    const weight = priorityWeight(policy, classB) - priorityWeight(policy, classA);
    return weight || b.priority - a.priority || (a.dueTime ?? Number.MAX_SAFE_INTEGER) - (b.dueTime ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
  });
  return Object.freeze({ decide, order });
}

export const createScheduler = createOrchestrationScheduler;

/** Stable serial form used by orchestration golden scenarios. */
export function canonicalSchedulingDecision(decision: SchedulingDecision): string {
  return canonicalSerialize(decision);
}
