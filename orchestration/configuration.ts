import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef, ContentRegistry } from "../content-registry/index.ts";
import type {
  ManagerConfig,
  ManagerConfigurationService,
  ManagerValidationError,
  ManagerValidationResult,
  SchedulingWorker,
} from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function refKey(ref: ArtifactRef | undefined): string {
  return ref ? `${ref.artifactId}@${ref.version}` : "missing";
}

function parseExactRef(value: string): ArtifactRef | undefined {
  const match = /^(.+)@(\d+)$/.exec(value);
  if (!match) return undefined;
  const version = Number(match[2]);
  return match[1] && Number.isInteger(version) && version > 0 ? { artifactId: match[1], version } : undefined;
}

function workersOf(config: ManagerConfig): readonly string[] {
  return config.workerIds?.length ? config.workerIds : config.workerPool?.length ? config.workerPool : config.workerAgentIds ?? [];
}

function versionOf(config: ManagerConfig): number {
  return config.configurationVersion ?? config.version;
}

function error(code: ManagerValidationError["code"], path: string, message: string, details?: Readonly<Record<string, string | number>>): ManagerValidationError {
  return { code, path, message, ...(details ? { details } : {}) };
}

export interface ManagerConfigurationOptions {
  readonly content?: ContentRegistry;
  readonly initial?: readonly ManagerConfig[];
}

export function validateManagerConfiguration(
  config: ManagerConfig,
  workers: readonly SchedulingWorker[] = [],
  activeManagerByWorker: Readonly<Record<string, string>> = {},
  content?: ContentRegistry,
): ManagerValidationResult {
  const errors: ManagerValidationError[] = [];
  if (!config || typeof config !== "object") {
    errors.push(error("INVALID_ID", "config", "Manager configuration must be an object."));
    return freeze({ valid: false, errors, warnings: [], exactRef: "manager.invalid" });
  }
  const workerIds = workersOf(config);
  const workerMap = new Map(workers.map((worker) => [worker.id, worker]));
  if (!config.id || typeof config.id !== "string") errors.push(error("INVALID_ID", "id", "Manager id is required."));
  if (!Number.isInteger(versionOf(config)) || versionOf(config) < 1) errors.push(error("INVALID_VERSION", "version", "Manager configuration version must be a positive integer."));
  if (!config.missionPromptRef?.artifactId || !Number.isInteger(config.missionPromptRef?.version) || config.missionPromptRef.version < 1) errors.push(error("MISSING_MISSION_PROMPT", "missionPromptRef", "An exact mission Prompt reference is required."));
  if (content && config.missionPromptRef && !content.getArtifact(config.missionPromptRef)) errors.push(error("MISSING_ARTIFACT", "missionPromptRef", `Mission Prompt ${refKey(config.missionPromptRef)} is unavailable.`));
  for (const [index, ref] of (config.artifactRefs ?? []).entries()) if (!ref?.artifactId || !Number.isInteger(ref.version) || ref.version < 1 || (content && !content.getArtifact(ref))) errors.push(error("MISSING_ARTIFACT", `artifactRefs[${index}]`, `Manager artifact ${refKey(ref)} is invalid or unavailable.`));
  if (!Number.isInteger(config.maxTier) || config.maxTier < 0 || config.maxTier > 10) errors.push(error("INVALID_MAX_TIER", "maxTier", "maxTier must be an integer from 0 through 10."));
  const maxWorkers = config.maxConcurrentWorkers ?? config.maxWorkers;
  if (!Number.isInteger(config.maxWorkers) || config.maxWorkers < 1 || config.maxWorkers > Math.max(1, workerIds.length)) errors.push(error("INVALID_MAX_WORKERS", "maxWorkers", "maxWorkers must be positive and no larger than the configured worker pool."));
  if (!Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > config.maxWorkers) errors.push(error("INVALID_MAX_WORKERS", "maxConcurrentWorkers", "maxConcurrentWorkers must be between one and maxWorkers."));
  const unique = new Set<string>();
  for (const [index, workerId] of workerIds.entries()) {
    if (unique.has(workerId)) errors.push(error("DUPLICATE_WORKER", `workerIds[${index}]`, `Worker ${workerId} appears more than once.`));
    unique.add(workerId);
    const worker = workerMap.get(workerId);
    if (!worker) errors.push(error("WORKER_NOT_FOUND", `workerIds[${index}]`, `Worker ${workerId} does not exist.`));
    else if (worker.enabled === false || ["OFFLINE", "DISABLED", "UNAVAILABLE"].includes(worker.status ?? "")) errors.push(error("WORKER_UNAVAILABLE", `workerIds[${index}]`, `Worker ${workerId} is not available.`));
    if (activeManagerByWorker[workerId] && activeManagerByWorker[workerId] !== config.id) errors.push(error("WORKER_ALREADY_MANAGED", `workerIds[${index}]`, `Worker ${workerId} is already managed by ${activeManagerByWorker[workerId]}.`));
  }
  const ruleIds = new Set<string>();
  for (const [index, rule] of (config.rules ?? config.delegationRules ?? []).entries()) {
    if (!rule.id || ruleIds.has(rule.id)) errors.push(error("DUPLICATE_RULE", `rules[${index}].id`, `Delegation rule ${rule.id || "(missing)"} is duplicated or missing.`));
    ruleIds.add(rule.id);
    if (!Number.isInteger(rule.priority)) errors.push(error("INVALID_VERSION", `rules[${index}].priority`, "Rule priority must be an integer."));
    for (const workerId of rule.targetWorkerIds ?? []) {
      if (!unique.has(workerId)) errors.push(error("RULE_TARGET_NOT_IN_POOL", `rules[${index}].targetWorkerIds`, `Rule ${rule.id} targets worker ${workerId}, which is outside the manager pool.`));
      if (!workerMap.has(workerId)) errors.push(error("INVALID_RULE_TARGET", `rules[${index}].targetWorkerIds`, `Rule ${rule.id} targets unknown worker ${workerId}.`));
    }
    for (const tool of rule.requiredToolIds ?? []) {
      const targets = (rule.targetWorkerIds?.length ? rule.targetWorkerIds : workerIds).map((id) => workerMap.get(id)).filter((worker): worker is SchedulingWorker => Boolean(worker));
      if (targets.length > 0 && !targets.some((worker) => (worker.toolIds ?? worker.tools ?? []).includes(tool))) errors.push(error("RULE_MISSING_TOOL", `rules[${index}].requiredToolIds`, `No target for rule ${rule.id} exposes required Tool ${tool}.`));
    }
  }
  const policyIds = new Set<string>();
  const routingPolicies = config.routingPolicies?.length ? config.routingPolicies : config.contextRoutingPolicy ? [config.contextRoutingPolicy] : [];
  for (const [index, policy] of routingPolicies.entries()) {
    if (!policy.id || policyIds.has(policy.id)) errors.push(error("DUPLICATE_ROUTING_POLICY", `routingPolicies[${index}].id`, `Routing policy ${policy.id || "(missing)"} is duplicated or missing.`));
    policyIds.add(policy.id);
    const included = new Set(policy.includeRefs ?? policy.artifactRefs?.map(refKey) ?? []);
    for (const omitted of policy.omitRefs ?? []) if (included.has(omitted)) errors.push(error("ROUTING_POLICY_OVERLAP", `routingPolicies[${index}]`, `Routing policy ${policy.id} both includes and omits ${omitted}.`));
    for (const ref of policy.artifactRefs ?? []) if (content && !content.getArtifact(ref)) errors.push(error("MISSING_ARTIFACT", `routingPolicies[${index}].artifactRefs`, `Routing policy ${policy.id} references missing artifact ${refKey(ref)}.`));
    for (const ref of policy.knowledgeRefs ?? []) if (!ref?.artifactId || !Number.isInteger(ref.version) || ref.version < 1 || (content && !content.getArtifact(ref))) errors.push(error("MISSING_ARTIFACT", `routingPolicies[${index}].knowledgeRefs`, `Routing policy ${policy.id} references missing Knowledge ${refKey(ref)}.`));
    const seenIncludeRefs = new Set<string>();
    for (const [refIndex, includeRef] of (policy.includeRefs ?? []).entries()) {
      if (!includeRef || seenIncludeRefs.has(includeRef)) errors.push(error("ROUTING_POLICY_OVERLAP", `routingPolicies[${index}].includeRefs[${refIndex}]`, `Routing policy ${policy.id} has a missing or duplicate include ref.`));
      seenIncludeRefs.add(includeRef);
      const exact = parseExactRef(includeRef);
      if (content && exact && !content.getArtifact(exact)) errors.push(error("MISSING_ARTIFACT", `routingPolicies[${index}].includeRefs[${refIndex}]`, `Routing policy ${policy.id} references missing input ${includeRef}.`));
    }
    for (const workerId of policy.workerRoles ?? []) {
      if (!workerIds.some((id) => workerMap.get(id)?.role === workerId)) errors.push(error("ROUTING_POLICY_TARGET_NOT_IN_POOL", `routingPolicies[${index}].workerRoles`, `Routing policy ${policy.id} cannot target role ${workerId} in this pool.`));
    }
    if (policy.maxContextLoad !== undefined && (!Number.isInteger(policy.maxContextLoad) || policy.maxContextLoad < 0)) errors.push(error("ROUTING_CONTEXT_OVERFLOW", `routingPolicies[${index}].maxContextLoad`, "Routing context limit must be a non-negative integer."));
  }
  const escalation = config.escalation ?? config.escalationRules?.[0];
  if (!escalation || !Number.isInteger(escalation.severityThreshold) || escalation.severityThreshold < 0 || escalation.severityThreshold > 4 || !Number.isInteger(escalation.fallbackAttempts) || escalation.fallbackAttempts < 0) errors.push(error("INVALID_ESCALATION_POLICY", "escalation", "Escalation threshold and fallbackAttempts are required and bounded."));
  if (config.authority?.maxEscalationSeverity !== undefined && (!Number.isInteger(config.authority.maxEscalationSeverity) || config.authority.maxEscalationSeverity < 0 || config.authority.maxEscalationSeverity > 4)) errors.push(error("INVALID_ESCALATION_POLICY", "authority.maxEscalationSeverity", "Authority escalation severity must be between 0 and 4."));
  const reporting = config.reporting ?? config.reportingRules?.[0];
  if (!reporting || !Number.isInteger(reporting.routineBatchSize) || reporting.routineBatchSize < 1) errors.push(error("INVALID_REPORTING_POLICY", "reporting.routineBatchSize", "Routine report batch size must be a positive integer."));
  for (const role of config.authority?.allowedWorkerRoles ?? []) if (!(workers.some((worker) => worker.role === role))) errors.push(error("AUTHORITY_DENIED", "authority.allowedWorkerRoles", `Authority names worker role ${role}, but no configured worker provides it.`));
  for (const [key, value] of Object.entries(config.priorityPolicy ?? {})) if (typeof value !== "number" || !Number.isFinite(value)) errors.push(error("AUTHORITY_DENIED", `priorityPolicy.${key}`, `Priority weight ${key} must be finite.`));
  return freeze({ valid: errors.length === 0, errors, warnings: config.status === "DRAFT" ? ["Configuration is a draft and cannot be activated until reviewed and deployed."] : [], exactRef: `${config.id}@${versionOf(config)}` });
}

export function createManagerConfigurationService(options: ManagerConfigurationOptions = {}): ManagerConfigurationService {
  const configs = new Map<string, ManagerConfig>();
  for (const config of options.initial ?? []) configs.set(`${config.id}@${versionOf(config)}`, freeze(config));
  const exactRef = (config: ManagerConfig) => `${config.id}@${versionOf(config)}`;
  const validate = (config: ManagerConfig, workers: readonly SchedulingWorker[] = [], activeManagerByWorker: Readonly<Record<string, string>> = {}) => validateManagerConfiguration(config, workers, activeManagerByWorker, options.content);
  const save = (config: ManagerConfig, workers: readonly SchedulingWorker[] = [], activeManagerByWorker: Readonly<Record<string, string>> = {}) => {
    const validation = validate(config, workers, activeManagerByWorker);
    if (!validation.valid) return { ok: false as const, errors: validation.errors };
    const ref = exactRef(config);
    const existing = configs.get(ref);
    if (existing && canonicalSerialize(existing) !== canonicalSerialize(config)) return { ok: false as const, errors: [error("CONFIG_VERSION_CONFLICT", "version", `Exact configuration ref ${ref} already exists with different contents.`)] };
    const value = freeze(config);
    configs.set(ref, value);
    return { ok: true as const, value };
  };
  return Object.freeze({
    validate,
    save,
    get: (id: string, version?: number) => {
      if (version !== undefined) return configs.get(`${id}@${version}`);
      return [...configs.values()].filter((config) => config.id === id).sort((a, b) => versionOf(b) - versionOf(a))[0];
    },
    list: () => freeze([...configs.values()].sort((a, b) => a.id.localeCompare(b.id) || versionOf(a) - versionOf(b))),
    exactRef,
  });
}

export const createManagerConfigService = createManagerConfigurationService;
