import { deepClone, deepFreeze } from "../simulation/index.ts";
import { createContextService, type ContextRequest, type ContextResult, type ContextService } from "../context/index.ts";
import type { ContentRegistry } from "../content-registry/index.ts";
import { canonicalSerialize } from "../simulation/index.ts";
import type {
  ManagerConfig,
  ManagerParkSummary,
  RoutingInput,
  RoutingResult,
  RoutingService,
  SchedulingWorker,
} from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function refKey(value: { readonly artifactId: string; readonly version: number }): string {
  return `${value.artifactId}@${value.version}`;
}

function workerRoles(worker: SchedulingWorker): readonly string[] {
  return worker.role ? [worker.role] : [];
}

function choosePolicy(config: ManagerConfig, taskType: string, worker: SchedulingWorker) {
  const policies = config.routingPolicies?.length ? config.routingPolicies : config.contextRoutingPolicy ? [config.contextRoutingPolicy] : [];
  return [...policies]
    .filter((policy) => (!policy.taskTypes || policy.taskTypes.length === 0 || policy.taskTypes.includes(taskType)) && (!policy.workerRoles || policy.workerRoles.length === 0 || workerRoles(worker).some((role) => policy.workerRoles!.includes(role))))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
}

function refsFromSnapshot(result: ContextResult): readonly string[] {
  const items = result.ok ? result.value.items : result.error.items;
  return items.map((item) => item.version && !item.ref.endsWith(`@${item.version}`) ? `${item.ref}@${item.version}` : item.ref).sort();
}

function parseExactRef(value: string) {
  const match = /^(.+)@(\d+)$/.exec(value);
  return match && match[1] ? { artifactId: match[1], version: Number(match[2]) } : undefined;
}

export interface RoutingServiceOptions {
  readonly context?: ContextService;
  readonly content?: ContentRegistry;
}

export function createRoutingService(options: RoutingServiceOptions = {}): RoutingService {
  const context = options.context ?? createContextService();
  const route = (input: RoutingInput): RoutingResult => {
    const policy = choosePolicy(input.managerConfig, input.job.type, input.worker);
    const jobRefs = (input.job.requiredContextRefs ?? []).map(parseExactRef).filter((ref): ref is { readonly artifactId: string; readonly version: number } => Boolean(ref));
    const policyRefs = [...new Map([...(policy?.artifactRefs ?? []), ...jobRefs].map((ref) => [refKey(ref), ref])).values()];
    const knowledgeRefs = policy?.knowledgeRefs ?? [];
    const toolIds = [...new Set([...(policy?.toolIds ?? []), ...(input.job.requiredToolIds ?? [])])].sort();
    const jobRequiredRefs = [...new Set(input.job.requiredContextRefs ?? [])].sort();
    const policyRequiredRefs = [...new Set([...(policy?.includeRefs ?? []), ...policyRefs.map(refKey), ...knowledgeRefs.map(refKey)])].sort();
    const requiredRefs = [...new Set([...jobRequiredRefs, ...policyRequiredRefs])].sort();
    const omittedRefs = [...new Set(policy?.omitRefs ?? [])].sort();
    const budget = Math.min(input.worker.contextBudget, policy?.maxContextLoad ?? input.worker.contextBudget);
    const requested: ContextRequest = {
      ...(input.baseContext ?? {}),
      id: `context.manager.${input.managerId}.${input.job.id}.${input.worker.id}`,
      agentId: input.worker.id,
      jobId: input.job.id,
      budget,
      logicalTime: input.logicalTime ?? 0,
      artifactRefs: policyRefs,
      knowledgeRefs,
      toolIds,
      registry: options.content,
    };
    const projected = context.project(requested);
    const loaded = refsFromSnapshot(projected);
    if (!projected.ok) {
      const blockedInputs = [...new Set([...requiredRefs.filter((ref) => !loaded.includes(ref)), ...projected.error.diagnostics])].sort();
      return freeze({ status: "BLOCKED", managerId: input.managerId, workerId: input.worker.id, jobId: input.job.id, ...(policy ? { policyId: policy.id } : {}), includedRefs: loaded, omittedRefs, blockedInputs, projectedLoad: projected.error.totalLoad, budget: projected.error.budget, diagnostics: projected.error.diagnostics, request: requested });
    }
    const missingJobRequired = jobRequiredRefs.filter((ref) => !loaded.includes(ref));
    const missingPolicyRequired = policyRequiredRefs.filter((ref) => !loaded.includes(ref));
    const missingRequired = [...new Set([...missingJobRequired, ...(policy?.required === false ? [] : missingPolicyRequired)])].sort();
    if (missingRequired.length > 0) {
      return freeze({ status: "BLOCKED", managerId: input.managerId, workerId: input.worker.id, jobId: input.job.id, ...(policy ? { policyId: policy.id } : {}), snapshot: projected.value, includedRefs: loaded, omittedRefs, blockedInputs: missingRequired, projectedLoad: projected.value.totalLoad, budget: projected.value.budget, diagnostics: [`ROUTING_INPUT_UNAVAILABLE:${missingRequired.join(",")}`], request: requested });
    }
    const diagnostics = [...context.analyze(projected.value).map((finding) => `${finding.code}:${finding.findingId}`)];
    const included = [...new Set([...loaded, ...requiredRefs.filter((ref) => !omittedRefs.includes(ref) && loaded.includes(ref))])].sort();
    return freeze({ status: "ROUTED", managerId: input.managerId, workerId: input.worker.id, jobId: input.job.id, ...(policy ? { policyId: policy.id } : {}), snapshot: projected.value, includedRefs: included, omittedRefs, blockedInputs: [], projectedLoad: projected.value.totalLoad, budget: projected.value.budget, diagnostics, request: requested });
  };

  const managerSummary = (managerId: string, config: ManagerConfig, workers: readonly SchedulingWorker[], logicalTime = 0, summary?: ManagerParkSummary): RoutingResult => {
    const completeSummary: ManagerParkSummary = summary ?? { park: {}, incidents: [], schedules: [], workers: workers.map((worker) => ({ id: worker.id, role: worker.role ?? "UNKNOWN", status: worker.status ?? "IDLE", queueLength: worker.queueLength ?? 0 })) };
    const managerWorker: SchedulingWorker = {
      id: managerId,
      role: "MANAGER",
      status: "IDLE",
      contextBudget: config.contextBudget ?? Math.max(1, config.maxWorkers * 4000),
      contextLoad: 0,
      queueLength: 0,
      queueCapacity: config.maxWorkers,
      tools: [],
      enabled: true,
    };
    return route({ managerId, managerConfig: config, worker: managerWorker, job: { id: `manager.summary.${managerId}`, type: "MANAGER_SUMMARY", targetRefs: [], priority: 0, priorityClass: "ROUTINE", requiredContextLoad: 0 }, logicalTime, baseContext: { workingState: { ref: `manager-summary:${managerId}`, content: canonicalSerialize(completeSummary), provenance: "park-operations:summary" } } });
  };
  return Object.freeze({ route, managerSummary });
}

export const createContextRoutingService = createRoutingService;

/** Small helper used by replay and tests to prove that a route is exact. */
export function canonicalRoutingResult(result: RoutingResult): string {
  return canonicalSerialize(result);
}
