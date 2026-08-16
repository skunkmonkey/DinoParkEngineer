import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef, Clause, ClauseCategory } from "../content-registry/index.ts";
import type { ContextRequest, ContextSnapshot } from "../context/index.ts";
import type { WorldCommand, WorldEvent, WorldSnapshot } from "../simulation/index.ts";
import { compileRuleGraph, graphArtifacts, resolveClause, tierOrder } from "./compiler.ts";
import type {
  AgentDefinition,
  AssertionResult,
  CompiledRuleNode,
  DelegationRequest,
  ExecutionStatus,
  ExecutionUpdate,
  InstructionContentPort,
  InstructionContextPort,
  InstructionEngine,
  InstructionJob,
  InstructionPorts,
  InstructionSimulationPort,
  JobBlock,
  JobOutcome,
  JobTerminalStatus,
  PreparedJob,
  ProvenanceEvent,
  ProvenanceEventType,
  ReportingUpdate,
  RetrievalRequest,
} from "./types.ts";

const CLAUSE_TYPES = new Set<ClauseCategory>([
  "GOAL", "PRECONDITION", "ACTION", "SEQUENCE", "CONSTRAINT", "POSTCONDITION",
  "FALLBACK", "ESCALATION", "DELEGATION", "REPORTING", "RETRIEVAL", "PRIORITY",
]);

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refsToStrings(refs: readonly ArtifactRef[]): readonly string[] {
  return refs.map(refKey).sort();
}

function rootRefs(job: InstructionJob, agent: AgentDefinition): readonly ArtifactRef[] {
  const refs = [
    ...(job.promptRef ? [job.promptRef] : []),
    ...(job.skillRefs ?? []),
    ...(job.systemPromptRefs ?? []),
    ...(job.managerDirectiveRefs ?? []),
    ...(agent.skillRefs ?? []),
    ...(agent.systemPromptRefs ?? []),
  ];
  const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
  return [...unique.values()].sort((a, b) => a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version);
}

function artifact(content: InstructionContentPort, ref: ArtifactRef) {
  return content.getArtifact(ref);
}

function dependenciesOf(content: InstructionContentPort, ref: ArtifactRef): readonly ArtifactRef[] {
  const direct = content.dependencies?.(ref, false) ?? artifact(content, ref)?.dependencies ?? [];
  return [...direct].sort((a, b) => a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version);
}

function discoverArtifactRefs(content: InstructionContentPort, roots: readonly ArtifactRef[]): { readonly refs: readonly ArtifactRef[]; readonly cycle?: readonly string[]; readonly error?: string } {
  const result = new Map<string, ArtifactRef>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycle: readonly string[] | undefined;
  let error: string | undefined;
  const visit = (ref: ArtifactRef, stack: readonly string[]): void => {
    const key = refKey(ref);
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      cycle = [...stack.slice(Math.max(0, start)), key];
      return;
    }
    if (visited.has(key) || cycle || error) return;
    visiting.add(key);
    result.set(key, ref);
    try {
      for (const dependency of dependenciesOf(content, ref)) visit(dependency, [...stack, key]);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    visiting.delete(key);
    visited.add(key);
  };
  for (const root of roots) visit(root, []);
  return { refs: [...result.values()].sort((a, b) => a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version), ...(cycle ? { cycle } : {}), ...(error ? { error } : {}) };
}

function toolIdsForAgent(agent: AgentDefinition, simulation: InstructionSimulationPort): readonly string[] {
  const configured = agent.toolIds ?? agent.tools;
  if (configured) return [...new Set(configured)].sort();
  return simulation.snapshot().agents.find((candidate) => candidate.id === agent.id)?.tools.toSorted() ?? [];
}

function contextRequest(job: InstructionJob, agent: AgentDefinition, simulation: InstructionSimulationPort, content: InstructionContentPort): ContextRequest {
  return {
    id: job.contextSnapshotId,
    agentId: agent.id,
    jobId: job.id,
    budget: agent.contextBudget,
    logicalTime: simulation.snapshot().logicalTime,
    ...(job.promptRef ? { promptRef: job.promptRef } : {}),
    skillRefs: [...new Map([...(job.skillRefs ?? []), ...(agent.skillRefs ?? [])].map((ref) => [refKey(ref), ref])).values()],
    systemPromptRefs: [...new Map([...(job.systemPromptRefs ?? []), ...(agent.systemPromptRefs ?? [])].map((ref) => [refKey(ref), ref])).values()],
    artifactRefs: job.managerDirectiveRefs,
    toolIds: toolIdsForAgent(agent, simulation),
    registry: content,
  };
}

function block(job: unknown, code: string, diagnostics: readonly string[], refs: readonly ArtifactRef[], context?: ContextSnapshot): { ok: false; error: JobBlock } {
  const stableJobId = isRecord(job) && typeof job.id === "string" && job.id.length > 0 ? job.id : "unknown-job";
  return { ok: false, error: cloneFreeze({ blocked: true, jobId: stableJobId, code, reasonCode: code, diagnostics: [...diagnostics].sort(), artifactRefs: refsToStrings(refs), ...(context ? { context } : {}) }) };
}

function validArtifactRef(value: unknown): value is ArtifactRef {
  return isRecord(value) && typeof value.artifactId === "string" && value.artifactId.length > 0 && Number.isInteger(value.version) && Number(value.version) > 0;
}

function validateInputShape(job: unknown, agent: unknown): readonly string[] {
  const diagnostics: string[] = [];
  if (!isRecord(job)) return ["job must be a non-null object"];
  if (typeof job.id !== "string" || job.id.length === 0) diagnostics.push("job.id must be a non-empty string");
  if (typeof job.type !== "string" || job.type.length === 0) diagnostics.push("job.type must be a non-empty string");
  if (!Array.isArray(job.targetRefs) || job.targetRefs.some((value) => typeof value !== "string" || value.length === 0)) diagnostics.push("job.targetRefs must be an array of non-empty strings");
  if (!Number.isInteger(job.priority)) diagnostics.push("job.priority must be an integer");
  if (!Number.isInteger(job.dueTime) || Number(job.dueTime) < 0) diagnostics.push("job.dueTime must be a non-negative integer");
  if (typeof job.assignedAgentId !== "string" || job.assignedAgentId.length === 0) diagnostics.push("job.assignedAgentId must be a non-empty string");
  for (const field of ["promptRef"] as const) if (job[field] !== undefined && !validArtifactRef(job[field])) diagnostics.push(`job.${field} must be an exact artifact ref`);
  for (const field of ["skillRefs", "systemPromptRefs", "managerDirectiveRefs"] as const) if (job[field] !== undefined && (!Array.isArray(job[field]) || job[field].some((value) => !validArtifactRef(value)))) diagnostics.push(`job.${field} must contain exact artifact refs`);
  if (job.maxSteps !== undefined && (!Number.isInteger(job.maxSteps) || Number(job.maxSteps) <= 0)) diagnostics.push("job.maxSteps must be a positive integer");
  if (!isRecord(agent)) return [...diagnostics, "agent must be a non-null object"].sort();
  if (typeof agent.id !== "string" || agent.id.length === 0) diagnostics.push("agent.id must be a non-empty string");
  if (!Number.isInteger(agent.contextBudget) || Number(agent.contextBudget) < 0) diagnostics.push("agent.contextBudget must be a non-negative integer");
  for (const field of ["toolIds", "tools"] as const) if (agent[field] !== undefined && (!Array.isArray(agent[field]) || agent[field].some((value) => typeof value !== "string" || value.length === 0))) diagnostics.push(`agent.${field} must contain non-empty tool ids`);
  for (const field of ["skillRefs", "systemPromptRefs"] as const) if (agent[field] !== undefined && (!Array.isArray(agent[field]) || agent[field].some((value) => !validArtifactRef(value)))) diagnostics.push(`agent.${field} must contain exact artifact refs`);
  if (typeof job.assignedAgentId === "string" && typeof agent.id === "string" && job.assignedAgentId !== agent.id) diagnostics.push("job.assignedAgentId must match agent.id");
  return diagnostics.sort();
}

function validateClause(clause: Clause): string | undefined {
  if (!clause || typeof clause !== "object" || typeof clause.id !== "string" || clause.id.length === 0) return "MALFORMED_CLAUSE: clause id is required";
  if (!CLAUSE_TYPES.has(clause.type)) return `UNSUPPORTED_CLAUSE_CATEGORY:${String(clause.type)}`;
  if (clause.conditions !== undefined && (typeof clause.conditions !== "object" || clause.conditions === null || Array.isArray(clause.conditions))) return `MALFORMED_CLAUSE:${clause.id}:conditions`;
  if (clause.action !== undefined && (typeof clause.action !== "object" || clause.action === null || Array.isArray(clause.action))) return `MALFORMED_CLAUSE:${clause.id}:action`;
  if (clause.assert !== undefined && (typeof clause.assert !== "object" || clause.assert === null || Array.isArray(clause.assert))) return `MALFORMED_CLAUSE:${clause.id}:assert`;
  return undefined;
}

function validateArtifacts(job: InstructionJob, agent: AgentDefinition, content: InstructionContentPort, simulation: InstructionSimulationPort): { ok: true; refs: readonly ArtifactRef[] } | { ok: false; code: string; diagnostics: readonly string[]; refs: readonly ArtifactRef[] } {
  const roots = rootRefs(job, agent);
  if (!job.promptRef && !job.contextSnapshot) return { ok: false, code: "MISSING_PROMPT", diagnostics: ["a pinned promptRef is required"], refs: roots };
  if (job.contextSnapshot && roots.length === 0) return { ok: true, refs: roots };
  if (roots.length === 0) return { ok: false, code: "MISSING_ARTIFACT", diagnostics: ["no pinned artifacts were selected"], refs: roots };
  const discovered = discoverArtifactRefs(content, roots);
  const refs = discovered.refs;
  if (discovered.cycle) return { ok: false, code: "DEPENDENCY_CYCLE", diagnostics: [`artifact dependency cycle: ${discovered.cycle.join(" -> ")}`], refs };
  if (discovered.error) return { ok: false, code: "CONTENT_PORT_ERROR", diagnostics: [`content dependency lookup failed: ${discovered.error}`], refs };
  const tools = new Set(toolIdsForAgent(agent, simulation));
  const diagnostics: string[] = [];
  for (const ref of refs) {
    let item: ReturnType<typeof artifact>;
    try {
      item = artifact(content, ref);
    } catch (cause) {
      diagnostics.push(`content lookup failed for ${refKey(ref)}: ${cause instanceof Error ? cause.message : String(cause)}`);
      continue;
    }
    if (!item) {
      diagnostics.push(`missing exact artifact ${refKey(ref)}`);
      continue;
    }
    for (const clause of item.clauses ?? []) {
      const issue = validateClause(clause);
      if (issue) diagnostics.push(`${refKey(ref)}:${issue}`);
    }
    for (const toolId of item.requiredToolIds ?? []) if (!tools.has(toolId)) diagnostics.push(`required tool '${toolId}' is unavailable to agent ${agent.id}`);
    for (const dependency of dependenciesOf(content, ref)) if (!artifact(content, dependency)) diagnostics.push(`missing dependency ${refKey(dependency)} required by ${refKey(ref)}`);
  }
  if (diagnostics.some((item) => item.startsWith("missing exact artifact"))) return { ok: false, code: "MISSING_ARTIFACT", diagnostics, refs };
  if (diagnostics.some((item) => item.startsWith("content lookup failed"))) return { ok: false, code: "CONTENT_PORT_ERROR", diagnostics, refs };
  if (diagnostics.some((item) => item.includes("missing dependency"))) return { ok: false, code: "MISSING_DEPENDENCY", diagnostics, refs };
  if (diagnostics.some((item) => item.includes("required tool"))) return { ok: false, code: "MISSING_TOOL", diagnostics, refs };
  if (diagnostics.length > 0) return { ok: false, code: "MALFORMED_CLAUSE", diagnostics, refs };
  return { ok: true, refs };
}

const CONTEXT_ITEM_KINDS = new Set(["PROMPT", "SKILL", "SYSTEM_PROMPT", "MEMORY", "KNOWLEDGE", "TOOL", "WORKING_STATE"]);

function contextArtifactRef(item: Record<string, unknown>): ArtifactRef | undefined {
  if (!(["PROMPT", "SKILL", "SYSTEM_PROMPT", "KNOWLEDGE"] as readonly unknown[]).includes(item.kind)) return undefined;
  if (typeof item.ref !== "string") return undefined;
  if (Number.isInteger(item.version) && Number(item.version) > 0) {
    const suffix = `@${item.version}`;
    return { artifactId: item.ref.endsWith(suffix) ? item.ref.slice(0, -suffix.length) : item.ref, version: Number(item.version) };
  }
  const separator = item.ref.lastIndexOf("@");
  const version = Number(item.ref.slice(separator + 1));
  return separator > 0 && Number.isInteger(version) && version > 0 ? { artifactId: item.ref.slice(0, separator), version } : undefined;
}

function validateContextSnapshot(
  input: unknown,
  job: InstructionJob,
  agent: AgentDefinition,
  content: InstructionContentPort,
  simulation: InstructionSimulationPort,
): { readonly ok: true; readonly snapshot: ContextSnapshot; readonly refs: readonly ArtifactRef[] } | { readonly ok: false; readonly code: string; readonly diagnostics: readonly string[]; readonly refs: readonly ArtifactRef[] } {
  if (!isRecord(input)) return { ok: false, code: "INVALID_CONTEXT_SNAPSHOT", diagnostics: ["context snapshot must be a non-null object"], refs: [] };
  const diagnostics: string[] = [];
  if (typeof input.id !== "string" || input.id.length === 0) diagnostics.push("context.id must be a non-empty string");
  if (input.agentId !== agent.id) diagnostics.push("context.agentId must match agent.id");
  if (input.jobId !== job.id) diagnostics.push("context.jobId must match job.id");
  if (!Number.isInteger(input.budget) || Number(input.budget) < 0) diagnostics.push("context.budget must be a non-negative integer");
  if (!Number.isInteger(input.totalLoad) || Number(input.totalLoad) < 0) diagnostics.push("context.totalLoad must be a non-negative integer");
  if (Number.isInteger(input.budget) && Number(input.budget) > agent.contextBudget) diagnostics.push("context.budget cannot exceed agent.contextBudget");
  if (!Array.isArray(input.items)) diagnostics.push("context.items must be an array");
  const items = Array.isArray(input.items) ? input.items : [];
  let calculatedLoad = 0;
  const refs = new Map<string, ArtifactRef>();
  const contextToolIds = new Set<string>();
  for (const [index, raw] of items.entries()) {
    if (!isRecord(raw)) { diagnostics.push(`context.items[${index}] must be an object`); continue; }
    if (typeof raw.ref !== "string" || raw.ref.length === 0) diagnostics.push(`context.items[${index}].ref must be a non-empty string`);
    if (typeof raw.kind !== "string" || !CONTEXT_ITEM_KINDS.has(raw.kind)) diagnostics.push(`context.items[${index}].kind is invalid`);
    if (!Number.isInteger(raw.contextCost) || Number(raw.contextCost) < 0) diagnostics.push(`context.items[${index}].contextCost must be a non-negative integer`);
    else calculatedLoad += Number(raw.contextCost);
    if (raw.kind === "TOOL" && typeof raw.ref === "string") contextToolIds.add(raw.ref);
    if (["PROMPT", "SKILL", "SYSTEM_PROMPT", "KNOWLEDGE"].includes(String(raw.kind))) {
      const ref = contextArtifactRef(raw);
      if (!ref) diagnostics.push(`context.items[${index}] must contain an exact artifact ref`);
      else refs.set(refKey(ref), ref);
    }
  }
  if (Number.isInteger(input.totalLoad) && calculatedLoad !== Number(input.totalLoad)) diagnostics.push(`context.totalLoad ${String(input.totalLoad)} does not reconcile with item cost sum ${calculatedLoad}`);
  const artifactRefs = [...refs.values()].sort((a, b) => a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version);
  for (const selected of rootRefs(job, agent)) if (!refs.has(refKey(selected))) diagnostics.push(`context is missing selected artifact ${refKey(selected)}`);
  const discovered = discoverArtifactRefs(content, artifactRefs);
  if (discovered.cycle) return { ok: false, code: "DEPENDENCY_CYCLE", diagnostics: [`artifact dependency cycle: ${discovered.cycle.join(" -> ")}`], refs: discovered.refs };
  if (discovered.error) return { ok: false, code: "CONTENT_PORT_ERROR", diagnostics: [`content dependency lookup failed: ${discovered.error}`], refs: discovered.refs };
  const availableTools = new Set(toolIdsForAgent(agent, simulation));
  for (const ref of artifactRefs) {
    let item: ReturnType<typeof artifact>;
    try { item = artifact(content, ref); }
    catch (cause) { diagnostics.push(`content lookup failed for ${refKey(ref)}: ${cause instanceof Error ? cause.message : String(cause)}`); continue; }
    if (!item) { diagnostics.push(`missing exact artifact ${refKey(ref)}`); continue; }
    for (const dependency of dependenciesOf(content, ref)) if (!refs.has(refKey(dependency))) diagnostics.push(`context is missing dependency ${refKey(dependency)} required by ${refKey(ref)}`);
    for (const clause of item.clauses ?? []) {
      const issue = validateClause(clause);
      if (issue) diagnostics.push(`${refKey(ref)}:${issue}`);
      const tool = actionTool({ clause } as CompiledRuleNode);
      if (tool && ["ACTION", "SEQUENCE", "FALLBACK", "ESCALATION"].includes(clause.type)) {
        if (!availableTools.has(tool)) diagnostics.push(`clause ${clause.id} requires unavailable agent tool '${tool}'`);
        if (!contextToolIds.has(tool)) diagnostics.push(`context is missing tool schema '${tool}' required by clause ${clause.id}`);
      }
    }
    for (const toolId of item.requiredToolIds ?? []) {
      if (!availableTools.has(toolId)) diagnostics.push(`required tool '${toolId}' is unavailable to agent ${agent.id}`);
      if (!contextToolIds.has(toolId)) diagnostics.push(`context is missing required tool schema '${toolId}'`);
    }
  }
  if (Number.isInteger(input.totalLoad) && Number.isInteger(input.budget) && (Number(input.totalLoad) > Number(input.budget) || Number(input.totalLoad) > agent.contextBudget)) {
    return { ok: false, code: "BLOCKED_CONTEXT_OVERFLOW", diagnostics: [...diagnostics, `context load ${String(input.totalLoad)} exceeds permitted budget ${Math.min(Number(input.budget), agent.contextBudget)}`].sort(), refs: artifactRefs };
  }
  if (diagnostics.some((entry) => entry.includes("unavailable agent tool") || entry.includes("missing required tool schema") || entry.includes("missing tool schema"))) return { ok: false, code: "MISSING_TOOL", diagnostics: diagnostics.sort(), refs: artifactRefs };
  if (diagnostics.some((entry) => entry.includes("missing dependency"))) return { ok: false, code: "MISSING_DEPENDENCY", diagnostics: diagnostics.sort(), refs: artifactRefs };
  if (diagnostics.some((entry) => entry.startsWith("missing exact artifact"))) return { ok: false, code: "MISSING_ARTIFACT", diagnostics: diagnostics.sort(), refs: artifactRefs };
  if (diagnostics.length > 0) return { ok: false, code: "INVALID_CONTEXT_SNAPSHOT", diagnostics: diagnostics.sort(), refs: artifactRefs };
  try {
    return { ok: true, snapshot: cloneFreeze(input as unknown as ContextSnapshot), refs: artifactRefs };
  } catch (cause) {
    return { ok: false, code: "INVALID_CONTEXT_SNAPSHOT", diagnostics: [`context snapshot is not canonically cloneable: ${cause instanceof Error ? cause.message : String(cause)}`], refs: artifactRefs };
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function actionOrder(node: CompiledRuleNode): number {
  const action = node.clause.action ?? {};
  const conditions = node.clause.conditions ?? {};
  const value = action.order ?? action.sequence ?? conditions.order ?? conditions.sequence;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function nodeSort(a: CompiledRuleNode, b: CompiledRuleNode): number {
  return actionOrder(a) - actionOrder(b)
    || tierOrder(a.tier) - tierOrder(b.tier)
    || b.priority - a.priority
    || (a.artifactRef.artifactId < b.artifactRef.artifactId ? -1 : a.artifactRef.artifactId > b.artifactRef.artifactId ? 1 : 0)
    || (a.clauseId < b.clauseId ? -1 : a.clauseId > b.clauseId ? 1 : 0)
    || a.order - b.order;
}

function actualAtPath(snapshot: WorldSnapshot, path: string): unknown {
  // Supports authored paths such as dinosaurs[Rex].hunger, gates[G7].state,
  // and simple snapshot property paths without introducing a prose parser.
  const match = path.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\[([^\]]+)\])?(?:\.(.*))?$/);
  if (!match) return undefined;
  const collection = (snapshot as unknown as Record<string, unknown>)[match[1]!];
  let current: unknown = collection;
  if (match[2] !== undefined && Array.isArray(collection)) current = collection.find((item) => typeof item === "object" && item !== null && (item as { id?: unknown }).id === match[2]);
  for (const segment of (match[3] ?? "").split(".").filter(Boolean)) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function targetDinosaur(snapshot: WorldSnapshot, job: InstructionJob): WorldSnapshot["dinosaurs"][number] | undefined {
  const id = job.targetRefs.find((target) => snapshot.dinosaurs.some((dino) => dino.id === target));
  return snapshot.dinosaurs.find((dino) => dino.id === id) ?? snapshot.dinosaurs[0];
}

function factValue(fact: string, snapshot: WorldSnapshot, job: InstructionJob): unknown {
  const dino = targetDinosaur(snapshot, job);
  const normalized = fact.toUpperCase().replace(/[\s.-]+/g, "_");
  if (normalized === "DINOSAUR_FED" || normalized === "FED" || normalized === "HUNGER_OK") return dino ? dino.hunger <= 30 : false;
  if (normalized === "DINOSAUR_CONTAINED" || normalized === "CONTAINED") return dino?.containmentState === "CONTAINED";
  if (normalized === "DINOSAUR_ESCAPED" || normalized === "ESCAPED") return dino?.containmentState === "ESCAPED";
  if (normalized === "VISITORS_SAFE") return snapshot.visitors.every((visitor) => visitor.safetyState === "SAFE" || visitor.safetyState === "SAFE_ZONE");
  if (normalized === "GATE_SECURED" || normalized === "GATE_LOCKED") return snapshot.gates.some((gate) => gate.state === "LOCKED");
  if (normalized === "GATE_CLOSED") return snapshot.gates.some((gate) => gate.state === "CLOSED" || gate.state === "LOCKED");
  if (normalized === "NO_OPEN_INCIDENT") return snapshot.incidents.every((incident) => incident.status === "RECOVERED");
  return undefined;
}

function compareActual(actual: unknown, expected: unknown, op: string | undefined): boolean {
  if (op === "<") return typeof actual === "number" && typeof expected === "number" && actual < expected;
  if (op === "<=") return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  if (op === ">") return typeof actual === "number" && typeof expected === "number" && actual > expected;
  if (op === ">=") return typeof actual === "number" && typeof expected === "number" && actual >= expected;
  if (op === "!=" || op === "NOT_EQUALS") return canonicalSerialize(actual) !== canonicalSerialize(expected);
  return canonicalSerialize(actual) === canonicalSerialize(expected);
}

export function evaluateAssertion(assertion: Readonly<Record<string, unknown>> | undefined, snapshot: WorldSnapshot, job: InstructionJob): { passed: boolean; reasonCode: string; fact?: string; expected?: unknown; actual?: unknown } {
  if (!assertion) return { passed: false, reasonCode: "MISSING_ASSERTION" };
  const path = stringValue(assertion.path);
  const fact = stringValue(assertion.fact ?? assertion.key);
  const expected = assertion.expected ?? assertion.value ?? assertion.equals ?? (fact ? true : undefined);
  const actual = path ? actualAtPath(snapshot, path) : fact ? factValue(fact, snapshot, job) : assertion.actual;
  if (actual === undefined) return { passed: false, reasonCode: "FACT_UNAVAILABLE", ...(fact ? { fact } : {}), ...(expected !== undefined ? { expected } : {}) };
  const op = stringValue(assertion.op ?? assertion.operator);
  const passed = expected === undefined ? Boolean(actual) : compareActual(actual, expected, op);
  return { passed, reasonCode: passed ? "ASSERTION_PASSED" : "ASSERTION_FAILED", ...(fact ? { fact } : {}), ...(expected !== undefined ? { expected } : {}), actual };
}

function conditionMatches(conditions: Readonly<Record<string, unknown>> | undefined, snapshot: WorldSnapshot, job: InstructionJob, failureCode?: string): boolean {
  if (!conditions) return true;
  if (conditions.applicable === false || conditions.enabled === false) return false;
  const error = conditions.errorCode ?? conditions.failureCode ?? conditions.onFailure;
  if (error !== undefined) {
    const errors = Array.isArray(error) ? error.map(String) : [String(error)];
    if (!failureCode || !errors.includes(failureCode)) return false;
  }
  if (conditions.when && typeof conditions.when === "object") if (!conditionMatches(conditions.when as Readonly<Record<string, unknown>>, snapshot, job, failureCode)) return false;
  if (conditions.assert && typeof conditions.assert === "object") if (!evaluateAssertion(conditions.assert as Readonly<Record<string, unknown>>, snapshot, job).passed) return false;
  if (conditions.fact && typeof conditions.fact === "string") if (!factValue(conditions.fact, snapshot, job)) return false;
  if (conditions.path && typeof conditions.path === "string" && conditions.expected !== undefined) if (!compareActual(actualAtPath(snapshot, conditions.path), conditions.expected, stringValue(conditions.op))) return false;
  return true;
}

function commandForNode(node: CompiledRuleNode, job: InstructionJob, agent: AgentDefinition, executionId: string, attempt: number): WorldCommand | undefined {
  const raw = node.clause.action ?? {};
  const nested = raw.params && typeof raw.params === "object" ? raw.params as Readonly<Record<string, unknown>> : {};
  const action = { ...nested, ...raw };
  const tool = stringValue(action.tool ?? action.action ?? action.name);
  if (!tool) return undefined;
  const commandId = `${executionId}:command:${node.nodeId}:${attempt}`;
  const fallbackTarget = job.targetRefs[0];
  const value = (keys: readonly string[], fallback?: string): string | undefined => {
    for (const key of keys) {
      const candidate = action[key];
      if (typeof candidate === "string") return candidate.startsWith("$target") ? fallback : candidate;
    }
    return fallback;
  };
  const base = { action: tool, commandId, agentId: agent.id } as Record<string, unknown>;
  switch (tool) {
    case "move_to": base.zoneId = value(["zoneId", "targetZoneId"], fallbackTarget); break;
    case "observe": base.targetId = value(["targetId", "entityId"], fallbackTarget); break;
    case "bait_dinosaur": base.dinosaurId = value(["dinosaurId", "targetId"], fallbackTarget); base.zoneId = value(["zoneId", "targetZoneId"], fallbackTarget); break;
    case "open_gate":
    case "close_gate":
    case "lock_gate": base.gateId = value(["gateId", "targetId"], fallbackTarget); break;
    case "dispense_food": base.dinosaurId = value(["dinosaurId", "targetId"], fallbackTarget); break;
    case "alert_security":
      if (typeof action.incidentId === "string") base.incidentId = action.incidentId;
      if (typeof action.targetZoneId === "string") base.targetZoneId = action.targetZoneId;
      if (typeof action.severity === "number") base.severity = action.severity;
      break;
    case "evacuate_visitors": base.zoneId = value(["zoneId", "targetZoneId"], fallbackTarget); break;
    case "rescue_visitors": base.visitorGroupId = value(["visitorGroupId", "targetId"], fallbackTarget); break;
    default: return undefined;
  }
  if (Object.values(base).some((item) => item === undefined)) return undefined;
  return base as unknown as WorldCommand;
}

function actionTool(node: CompiledRuleNode): string | undefined {
  const action = node.clause.action ?? {};
  return stringValue(action.tool ?? action.action ?? action.name);
}

/** Return safety-prohibited tools/semantic keys for the current world state. */
function activeConstraintBlocks(nodes: readonly CompiledRuleNode[], snapshot: WorldSnapshot, job: InstructionJob): { readonly tools: ReadonlySet<string>; readonly semanticKeys: ReadonlySet<string>; readonly violated: readonly string[] } {
  const tools = new Set<string>();
  const semanticKeys = new Set<string>();
  const violated: string[] = [];
  for (const node of nodes.filter((candidate) => candidate.applicable && candidate.category === "CONSTRAINT").sort(nodeSort)) {
    if (!conditionMatches(node.clause.conditions, snapshot, job)) continue;
    const action = node.clause.action ?? {};
    const declaredTool = stringValue(action.prohibit ?? action.blockedTool ?? action.forbid);
    const tool = declaredTool ?? (action.allow === false || action.allow === undefined ? actionTool(node) : undefined);
    const assertion = node.clause.assert ? evaluateAssertion(node.clause.assert, snapshot, job) : undefined;
    // A constraint with an assertion is an invariant: its assertion must hold.
    if (assertion && !assertion.passed) {
      violated.push(node.clauseId);
      if (tool) tools.add(tool);
      else if (node.semanticKey) semanticKeys.add(node.semanticKey);
      else if (!declaredTool && action.allow !== true) {
        // No explicit target means the authored safety rule blocks actions
        // until its invariant is restored.
        for (const candidate of nodes.filter((item) => item.category === "ACTION" || item.category === "SEQUENCE")) {
          const candidateTool = actionTool(candidate);
          if (candidateTool) tools.add(candidateTool);
        }
      }
    }
    if (tool) tools.add(tool);
    if (node.semanticKey && (action.prohibit !== undefined || action.allow === false || assertion?.passed === false)) semanticKeys.add(node.semanticKey);
  }
  return { tools, semanticKeys, violated };
}

interface PendingTool {
  readonly node: CompiledRuleNode;
  readonly commandId: string;
  readonly attempt: number;
}

interface InternalExecution {
  readonly prepared: PreparedJob;
  readonly executionId: string;
  readonly events: ProvenanceEvent[];
  readonly completed: Set<string>;
  readonly skipped: Set<string>;
  readonly goalResults: AssertionResult[];
  readonly postconditionResults: AssertionResult[];
  readonly preconditionResults: AssertionResult[];
  readonly incidents: Set<string>;
  readonly delegationRequests: DelegationRequest[];
  readonly retrievalRequests: RetrievalRequest[];
  readonly reports: ReportingUpdate[];
  status: ExecutionStatus;
  pending?: PendingTool;
  failureCode?: string;
  failureNode?: CompiledRuleNode;
  failureHandled: boolean;
  escalating: boolean;
  cancelRequested: boolean;
  steps: number;
  sequence: number;
  terminalOutcome?: JobOutcome;
}

export function createInstructionEngine(ports: InstructionPorts): InstructionEngine {
  const content = ports.content;
  const context = ports.context as InstructionContextPort;
  const simulation = ports.simulation as InstructionSimulationPort;
  const executions = new Map<string, InternalExecution>();

  const emit = (state: InternalExecution, type: ProvenanceEventType, payload: object, node?: CompiledRuleNode): ProvenanceEvent => {
    const snapshot = simulation.snapshot();
    const event: ProvenanceEvent = {
      id: `${state.executionId}:event:${state.sequence}`,
      sequence: state.sequence++,
      executionId: state.executionId,
      jobId: state.prepared.job.id,
      type,
      logicalTime: snapshot.logicalTime,
      ...(node ? { clauseId: node.clauseId, artifactRef: { ...node.artifactRef } } : {}),
      payload: cloneFreeze(payload as Readonly<Record<string, unknown>>),
    };
    state.events.push(event);
    ports.provenance?.append(event);
    return event;
  };

  const assertionResult = (state: InternalExecution, node: CompiledRuleNode, category: AssertionResult["category"]): AssertionResult => {
    const result = evaluateAssertion(node.clause.assert, simulation.snapshot(), state.prepared.job);
    const value: AssertionResult = { clauseId: node.clauseId, category, passed: result.passed, reasonCode: result.reasonCode, ...(result.fact ? { fact: result.fact } : {}), ...(result.expected !== undefined ? { expected: result.expected } : {}), ...(result.actual !== undefined ? { actual: result.actual } : {}) };
    if (category === "GOAL") state.goalResults.push(value);
    else if (category === "POSTCONDITION") state.postconditionResults.push(value);
    else state.preconditionResults.push(value);
    emit(state, "ASSERTION", value, node);
    return value;
  };

  const complete = (state: InternalExecution, status: JobTerminalStatus, reasonCode: string, diagnostics: readonly string[] = []): void => {
    if (state.terminalOutcome) return;
    const snapshot = simulation.snapshot();
    const activeIncidentIds = snapshot.incidents.filter((incident) => incident.status !== "RECOVERED").map((incident) => incident.id);
    const incidentIds = [...new Set([...state.incidents, ...activeIncidentIds])].sort();
    const missingPostconditions = state.prepared.graph.nodes.filter((node) => node.applicable && node.category === "POSTCONDITION").length === 0
      ? ["No POSTCONDITION clause was loaded for this job."]
      : [];
    const outcome: JobOutcome = cloneFreeze({
      jobId: state.prepared.job.id,
      status,
      reasonCode,
      goalResults: state.goalResults,
      postconditionResults: state.postconditionResults,
      preconditionResults: state.preconditionResults,
      incidentIds,
      contextSnapshotId: state.prepared.contextSnapshot.id,
      graphId: state.prepared.graph.id,
      diagnostics: [...diagnostics, ...missingPostconditions],
      missingPostconditions,
      worldSnapshot: snapshot,
    });
    state.status = status;
    state.terminalOutcome = outcome;
    emit(state, "STATUS", { status, reasonCode }, undefined);
    emit(state, "OUTCOME", { status, reasonCode, incidentIds, missingPostconditions }, undefined);
  };

  const pauseAtSafePoint = (state: InternalExecution): void => {
    if (state.terminalOutcome) return;
    state.status = "PAUSED";
    state.cancelRequested = false;
    emit(state, "STATUS", { status: "PAUSED", reasonCode: "PAUSED_AT_SAFE_POINT" });
  };

  const resumeExecution = (state: InternalExecution): void => {
    if (state.terminalOutcome || state.status !== "PAUSED") return;
    state.status = "RUNNING";
    state.cancelRequested = false;
    emit(state, "STATUS", { status: "RUNNING", reasonCode: "RESUMED" });
    drive(state);
  };

  const matchFailure = (state: InternalExecution, category: "FALLBACK" | "ESCALATION"): CompiledRuleNode | undefined => state.prepared.graph.nodes
    .filter((node) => node.applicable && node.category === category)
    .filter((node) => !state.completed.has(node.nodeId))
    .filter((node) => conditionMatches(node.clause.conditions, simulation.snapshot(), state.prepared.job, state.failureCode))
    .sort(nodeSort)[0];

  const handleFailure = (state: InternalExecution, code: string, node: CompiledRuleNode, details: unknown, failedCommandId?: string): void => {
    state.failureCode = code;
    state.failureNode = node;
    state.failureHandled = false;
    state.completed.add(node.nodeId);
    emit(state, "TOOL_RESULT", { ok: false, commandId: failedCommandId ?? state.pending?.commandId ?? "", code, details }, node);
    state.pending = undefined;
    if (state.cancelRequested) { pauseAtSafePoint(state); return; }
    const fallback = matchFailure(state, "FALLBACK");
    const escalation = matchFailure(state, "ESCALATION");
    if (fallback) {
      emit(state, "CLAUSE_SELECTED", { reason: "fallback", failureCode: code }, fallback);
      state.failureHandled = true;
      return;
    }
    if (escalation) {
      emit(state, "CLAUSE_SELECTED", { reason: "escalation", failureCode: code }, escalation);
      state.failureHandled = true;
      return;
    }
    complete(state, "FAILED", `TOOL_${code}`, [`${node.clauseId} failed with ${code}`]);
  };

  const recordWorldEvent = (state: InternalExecution, worldEvent: WorldEvent): void => {
    const incidentId = worldEvent.payload.incidentId;
    if (typeof incidentId === "string" && incidentId.length > 0) state.incidents.add(incidentId);
    emit(state, "WORLD_EVENT", { id: worldEvent.id, type: worldEvent.type, logicalTime: worldEvent.logicalTime, payload: worldEvent.payload }, undefined);
  };

  const drive = (state: InternalExecution): void => {
    if (state.status !== "RUNNING" || state.terminalOutcome || state.pending) return;
    state.steps += 1;
    if (state.steps > state.prepared.maxSteps) {
      complete(state, "FAILED", "STEP_LIMIT_EXCEEDED", [`maximum instruction steps ${state.prepared.maxSteps} exceeded`]);
      return;
    }
    const graph = state.prepared.graph;
    const snapshot = simulation.snapshot();

    // Safety constraints and preconditions are reevaluated before every action.
    for (const node of graph.nodes.filter((candidate) => candidate.applicable && candidate.category === "CONSTRAINT").sort(nodeSort)) {
      const active = conditionMatches(node.clause.conditions, snapshot, state.prepared.job);
      if (active && node.clause.assert) {
        const result = assertionResult(state, node, "CONSTRAINT");
        if (!result.passed) {
          emit(state, "CLAUSE_SKIPPED", { reason: "constraint assertion is not satisfied", nodeId: node.nodeId }, node);
          continue;
        }
      }
    }
    for (const node of graph.nodes.filter((candidate) => candidate.applicable && candidate.category === "PRECONDITION" && !state.completed.has(candidate.nodeId)).sort(nodeSort)) {
      if (node.clause.conditions?.applicable === false || node.clause.conditions?.enabled === false) {
        state.completed.add(node.nodeId);
        state.skipped.add(node.nodeId);
        emit(state, "CLAUSE_SKIPPED", { reason: "precondition applicability is false" }, node);
        continue;
      }
      if (!conditionMatches(node.clause.conditions, snapshot, state.prepared.job)) {
        complete(state, "FAILED", "PRECONDITION_FAILED", [`${node.clauseId} is not applicable`]);
        return;
      }
      const result = assertionResult(state, node, "PRECONDITION");
      state.completed.add(node.nodeId);
      if (!result.passed) {
        const escalation = matchFailure(state, "ESCALATION");
        if (escalation) { state.failureCode = result.reasonCode; state.failureHandled = true; emit(state, "CLAUSE_SELECTED", { reason: "precondition escalation", failureCode: result.reasonCode }, escalation); }
        else complete(state, "FAILED", "PRECONDITION_FAILED", [`${node.clauseId} assertion failed`]);
        return;
      }
    }

    const safetyBlocks = activeConstraintBlocks(graph.nodes, snapshot, state.prepared.job);
    if (safetyBlocks.violated.length > 0) {
      emit(state, "STATUS", { status: "RUNNING", reasonCode: "SAFETY_CONSTRAINT_ACTIVE", violatedClauseIds: safetyBlocks.violated });
    }

    if (state.failureCode && state.failureHandled) {
      const fallback = matchFailure(state, "FALLBACK");
      const escalation = matchFailure(state, "ESCALATION");
      const selected = fallback ?? escalation;
      if (selected && !state.completed.has(selected.nodeId)) {
        state.completed.add(selected.nodeId);
        state.escalating = !fallback;
        emit(state, "CLAUSE_SELECTED", { reason: fallback ? "fallback" : "escalation", failureCode: state.failureCode }, selected);
        const tool = commandForNode(selected, state.prepared.job, state.prepared.agent, state.executionId, state.steps);
        if (tool) {
          const result = simulation.command(tool);
          emit(state, "TOOL_REQUESTED", { commandId: tool.commandId, tool: tool.action, result }, selected);
          if (!result.ok) {
            emit(state, "TOOL_RESULT", { ok: false, commandId: tool.commandId, code: result.code, details: result.details }, selected);
            if (fallback && escalation) { state.failureCode = result.code; state.failureHandled = true; state.completed.delete(escalation.nodeId); return; }
            complete(state, "ESCALATED", `ESCALATION_${result.code}`, [`${selected.clauseId} failed with ${result.code}`]);
            return;
          }
          state.pending = { node: selected, commandId: tool.commandId, attempt: state.steps };
          if (result.completionEventIds.length === 0) {
            state.pending = undefined;
            if (fallback) { state.failureHandled = false; state.escalating = false; drive(state); }
            else complete(state, "ESCALATED", "ESCALATION_EMITTED");
          }
          return;
        }
        if (!fallback) { complete(state, "ESCALATED", "ESCALATION_EMITTED"); return; }
        state.failureHandled = false;
      }
    }

    const goalNodes = graph.nodes.filter((node) => node.applicable && node.category === "GOAL");
    const actionNodes = graph.nodes.filter((node) => {
      if (!node.applicable || !["ACTION", "SEQUENCE", "RETRIEVAL", "DELEGATION", "REPORTING"].includes(node.category) || state.completed.has(node.nodeId)) return false;
      if (!conditionMatches(node.clause.conditions, snapshot, state.prepared.job, state.failureCode)) {
        state.skipped.add(node.nodeId);
        emit(state, "CLAUSE_SKIPPED", { reason: "runtime condition is false" }, node);
        return false;
      }
      const conflict = node.semanticKey ? graph.conflicts.find((candidate) => candidate.semanticKey === node.semanticKey) : undefined;
      if (conflict && conflict.winnerNodeId !== node.nodeId) {
        state.skipped.add(node.nodeId);
        emit(state, "CLAUSE_SKIPPED", { reason: "lower-precedence conflict loser", winnerNodeId: conflict.winnerNodeId, semanticKey: conflict.semanticKey }, node);
        return false;
      }
      const tool = actionTool(node);
      if (tool && safetyBlocks.tools.has(tool)) {
        emit(state, "CLAUSE_SKIPPED", { reason: "hard safety constraint prohibits tool", tool }, node);
        state.skipped.add(node.nodeId);
        return false;
      }
      if (node.semanticKey && safetyBlocks.semanticKeys.has(node.semanticKey)) {
        emit(state, "CLAUSE_SKIPPED", { reason: "hard safety constraint prohibits semantic key", semanticKey: node.semanticKey }, node);
        state.skipped.add(node.nodeId);
        return false;
      }
      return true;
    }).sort(nodeSort);
    const fallbackNodes = state.failureCode ? graph.nodes.filter((node) => node.applicable && ["FALLBACK", "ESCALATION"].includes(node.category) && !state.completed.has(node.nodeId)).sort(nodeSort) : [];
    const selectedResolution = resolveClause([...actionNodes, ...fallbackNodes], state.completed);
    const node = selectedResolution.selected;
    if (node) {
      state.completed.add(node.nodeId);
      emit(state, "CLAUSE_SELECTED", { reason: "deterministic-resolution", tier: node.tier, priority: node.priority, ...(selectedResolution.conflict ? { conflictId: selectedResolution.conflict.conflictId, contenders: selectedResolution.conflict.contenders } : {}) }, node);
      if (selectedResolution.conflict) emit(state, "CONFLICT_RESOLVED", { conflictId: selectedResolution.conflict.conflictId, semanticKey: selectedResolution.conflict.semanticKey, winnerNodeId: node.nodeId, contenders: selectedResolution.conflict.contenders }, node);
      if (node.category === "RETRIEVAL") {
        const refs = Array.isArray(node.clause.action?.refs) ? node.clause.action?.refs.map(String) : [];
        const request: RetrievalRequest = { clauseId: node.clauseId, refs, ...(typeof node.clause.action?.query === "string" ? { query: node.clause.action.query } : {}) };
        state.retrievalRequests.push(request);
        emit(state, "RETRIEVAL_REQUEST", request, node);
        drive(state);
        return;
      }
      if (node.category === "DELEGATION") {
        const request: DelegationRequest = { executionId: state.executionId, jobId: state.prepared.job.id, clauseId: node.clauseId, ...(typeof node.clause.action?.targetAgentId === "string" ? { targetAgentId: node.clause.action.targetAgentId } : {}), ...(typeof node.clause.action?.taskType === "string" ? { taskType: node.clause.action.taskType } : {}), targetRefs: Array.isArray(node.clause.action?.targetRefs) ? node.clause.action.targetRefs.map(String) : [...state.prepared.job.targetRefs] };
        state.delegationRequests.push(request);
        emit(state, "DELEGATION_REQUEST", request, node);
        drive(state);
        return;
      }
      if (node.category === "REPORTING") {
        const report: ReportingUpdate = { clauseId: node.clauseId, status: typeof node.clause.action?.status === "string" ? node.clause.action.status : "COMPLETED", ...(typeof node.clause.action?.message === "string" ? { message: node.clause.action.message } : {}), ...(node.clause.action?.facts && typeof node.clause.action.facts === "object" ? { facts: node.clause.action.facts as Readonly<Record<string, unknown>> } : {}) };
        state.reports.push(report);
        emit(state, "REPORT", report, node);
        drive(state);
        return;
      }
      if (node.category === "SEQUENCE" && !node.clause.action?.tool && !node.clause.action?.action) { drive(state); return; }
      const command = commandForNode(node, state.prepared.job, state.prepared.agent, state.executionId, state.steps);
      if (!command) { handleFailure(state, "INVALID_ACTION", node, { reason: "semantic action does not map to a simulation tool" }); return; }
      const result = simulation.command(command);
      emit(state, "TOOL_REQUESTED", { commandId: command.commandId, tool: command.action, result }, node);
      if (!result.ok) { handleFailure(state, result.code, node, result.details, command.commandId); return; }
      state.pending = { node, commandId: command.commandId, attempt: state.steps };
      if (result.completionEventIds.length === 0) {
        state.pending = undefined;
        emit(state, "TOOL_RESULT", { ok: true, commandId: command.commandId, completionEventIds: [] }, node);
        drive(state);
      }
      return;
    }

    // Once all actions are consumed, evaluate goals and postconditions.
    const goals = goalNodes.map((node) => assertionResult(state, node, "GOAL"));
    if (goalNodes.length === 0) { complete(state, "FAILED", "MISSING_GOAL", ["no GOAL clause was loaded"]); return; }
    if (goals.some((result) => !result.passed)) {
      const escalation = matchFailure(state, "ESCALATION");
      if (safetyBlocks.violated.length > 0 && escalation) {
        state.failureCode = "SAFETY_CONSTRAINT_ACTIVE";
        state.failureHandled = true;
        drive(state);
        return;
      }
      complete(state, "FAILED", safetyBlocks.violated.length > 0 ? "SAFETY_CONSTRAINT_BLOCKED" : "GOAL_NOT_ACHIEVED", goals.filter((result) => !result.passed).map((result) => result.clauseId));
      return;
    }
    const posts = graph.nodes.filter((node) => node.applicable && node.category === "POSTCONDITION").map((node) => assertionResult(state, node, "POSTCONDITION"));
    if (posts.some((result) => !result.passed)) {
      const fallback = matchFailure(state, "FALLBACK");
      const escalation = matchFailure(state, "ESCALATION");
      if (fallback || escalation) { state.failureCode = "POSTCONDITION_FAILED"; state.failureHandled = true; drive(state); return; }
      complete(state, "FAILED", "POSTCONDITION_FAILED", posts.filter((result) => !result.passed).map((result) => result.clauseId));
      return;
    }
    const activeIncident = simulation.snapshot().incidents.some((incident) => incident.status !== "RECOVERED");
    if (activeIncident) complete(state, "SUCCEEDED", "GOAL_ACHIEVED_WITH_SAFETY_INCIDENT", ["goal passed while a safety incident remained open"]);
    else if (posts.length === 0) complete(state, "SUCCEEDED", "GOAL_ACHIEVED_WITHOUT_POSTCONDITION", ["no postcondition clause was loaded"]);
    else complete(state, "SUCCEEDED", "GOALS_AND_POSTCONDITIONS_PASSED");
  };

  const update = (state: InternalExecution): ExecutionUpdate => cloneFreeze({
    executionId: state.executionId,
    jobId: state.prepared.job.id,
    status: state.status,
    events: state.events,
    provenance: state.events,
    graph: state.prepared.graph,
    ...(state.terminalOutcome ? { outcome: state.terminalOutcome } : {}),
    ...(state.pending ? { pendingCommandId: state.pending.commandId } : {}),
    delegationRequests: state.delegationRequests,
    retrievalRequests: state.retrievalRequests,
    reports: state.reports,
  });

  const prepare = (jobInput: InstructionJob, agentInput: AgentDefinition): { readonly ok: true; readonly value: PreparedJob } | { readonly ok: false; readonly error: JobBlock } => {
    const shapeDiagnostics = validateInputShape(jobInput, agentInput);
    if (shapeDiagnostics.length > 0) return block(jobInput, "INVALID_JOB", shapeDiagnostics, []);
    const job = jobInput as InstructionJob;
    const agent = agentInput as AgentDefinition;
    try {
      const validation = validateArtifacts(job, agent, content, simulation);
      if (!validation.ok) return block(job, validation.code, validation.diagnostics, validation.refs);
      let rawContextSnapshot: unknown;
      if (job.contextSnapshot !== undefined) rawContextSnapshot = job.contextSnapshot;
      else {
        let result: ReturnType<InstructionContextPort["project"]>;
        try { result = context.project(contextRequest(job, agent, simulation, content)); }
        catch (cause) { return block(job, "CONTEXT_PORT_ERROR", [`context projection failed: ${cause instanceof Error ? cause.message : String(cause)}`], validation.refs); }
        if (!isRecord(result) || typeof result.ok !== "boolean") return block(job, "CONTEXT_PORT_ERROR", ["context projection returned a malformed result"], validation.refs);
        if (!result.ok) return block(job, result.error.code, [result.error.message, ...result.error.diagnostics], validation.refs);
        rawContextSnapshot = result.value;
      }
      const contextValidation = validateContextSnapshot(rawContextSnapshot, job, agent, content, simulation);
      if (!contextValidation.ok) return block(job, contextValidation.code, contextValidation.diagnostics, contextValidation.refs);
      const contextSnapshot = contextValidation.snapshot;
      const graph = compileRuleGraph(job, agent, contextSnapshot, content);
      const goalCount = graph.nodes.filter((node) => node.applicable && node.category === "GOAL").length;
      if (goalCount === 0) return block(job, "MISSING_GOAL", ["compiled graph has no applicable GOAL clause"], contextValidation.refs, contextSnapshot);
      const prepared: PreparedJob = cloneFreeze({ job: cloneFreeze(job), agent: cloneFreeze(agent), contextSnapshot, graph, preparedAtLogicalTime: simulation.snapshot().logicalTime, maxSteps: Math.max(1, Math.trunc(job.maxSteps ?? 256)) });
      return { ok: true, value: prepared };
    } catch (cause) {
      return block(job, "PREPARE_FAILED", [`instruction preparation failed: ${cause instanceof Error ? cause.message : String(cause)}`], []);
    }
  };

  return {
    prepare,
    start: (prepared) => {
      // Execution ids are derived from pinned job identity so replaying the
      // same prepared inputs yields byte-identical command/provenance ids.
      const executionId = `execution.${prepared.job.id}`;
      const state: InternalExecution = { prepared, executionId, events: [], completed: new Set(), skipped: new Set(), goalResults: [], postconditionResults: [], preconditionResults: [], incidents: new Set(), delegationRequests: [], retrievalRequests: [], reports: [], status: "RUNNING", failureHandled: false, escalating: false, cancelRequested: false, steps: 0, sequence: 0 };
      executions.set(executionId, state);
      emit(state, "JOB_RECEIVED", { jobId: prepared.job.id, agentId: prepared.agent.id, promptRef: prepared.job.promptRef ? refKey(prepared.job.promptRef) : "" });
      emit(state, "VALIDATION", { status: "PASSED", artifactRefs: graphArtifacts(prepared.graph).map(refKey) });
      emit(state, "CONTEXT_BOUND", { contextSnapshotId: prepared.contextSnapshot.id, totalLoad: prepared.contextSnapshot.totalLoad, budget: prepared.contextSnapshot.budget });
      for (const node of prepared.graph.nodes) emit(state, node.applicable ? "CLAUSE_COMPILED" : "CLAUSE_SKIPPED", { nodeId: node.nodeId, category: node.category, applicable: node.applicable, ...(node.skipReason ? { reason: node.skipReason } : {}) }, node);
      for (const conflict of prepared.graph.conflicts) emit(state, "CONFLICT_RESOLVED", conflict);
      drive(state);
      return update(state);
    },
    handleWorldEvents: (executionId, events) => {
      const state = executions.get(executionId);
      if (!state) throw new Error(`unknown execution ${executionId}`);
      if (state.terminalOutcome) return update(state);
      if (state.status === "PAUSED") resumeExecution(state);
      for (const event of events) {
        recordWorldEvent(state, event);
        if (state.pending && event.commandId === state.pending.commandId) {
          if (event.type === "TOOL_FAILED") {
            const pending = state.pending;
            handleFailure(state, typeof event.payload.code === "string" ? event.payload.code : "TOOL_FAILED", pending.node, event.payload);
          } else if (event.type === "TOOL_COMPLETED" || event.type === "OBSERVATION") {
            const pending = state.pending;
            state.pending = undefined;
            emit(state, "TOOL_RESULT", { ok: true, commandId: pending.commandId, worldEventId: event.id }, pending.node);
            if (state.cancelRequested) { pauseAtSafePoint(state); break; }
            if (pending.node.category === "ESCALATION") { complete(state, "ESCALATED", "ESCALATION_EMITTED"); break; }
            if (pending.node.category === "FALLBACK") { state.failureHandled = false; state.escalating = false; }
            drive(state);
          }
        }
        if (state.terminalOutcome) break;
      }
      if (!state.terminalOutcome && state.status === "RUNNING" && !state.pending) drive(state);
      return update(state);
    },
    cancelAtSafePoint: (executionId) => {
      const state = executions.get(executionId);
      if (!state) throw new Error(`unknown execution ${executionId}`);
      if (state.terminalOutcome) return update(state);
      if (state.status === "PAUSED") return update(state);
      state.cancelRequested = true;
      if (!state.pending) pauseAtSafePoint(state);
      return update(state);
    },
    resume: (executionId) => {
      const state = executions.get(executionId);
      if (!state) throw new Error(`unknown execution ${executionId}`);
      resumeExecution(state);
      return update(state);
    },
    runToCompletion: (executionId) => {
      const state = executions.get(executionId);
      if (!state) throw new Error(`unknown execution ${executionId}`);
      if (state.status === "PAUSED") resumeExecution(state);
      let guard = 0;
      while (!state.terminalOutcome && state.status !== "PAUSED" && guard++ < 1024) {
        if (state.pending) {
          if (simulation.runNext) {
            const event = simulation.runNext();
            if (event) { recordWorldEvent(state, event); if (state.pending && event.commandId === state.pending.commandId) { if (event.type === "TOOL_FAILED") handleFailure(state, typeof event.payload.code === "string" ? event.payload.code : "TOOL_FAILED", state.pending.node, event.payload); else if (event.type === "TOOL_COMPLETED" || event.type === "OBSERVATION") { const pending = state.pending; state.pending = undefined; emit(state, "TOOL_RESULT", { ok: true, commandId: pending.commandId, worldEventId: event.id }, pending.node); if (state.cancelRequested) pauseAtSafePoint(state); else if (pending.node.category === "ESCALATION") complete(state, "ESCALATED", "ESCALATION_EMITTED"); else { if (pending.node.category === "FALLBACK") { state.failureHandled = false; state.escalating = false; } drive(state); } } } continue; }
          }
          const events = simulation.advanceTo(simulation.snapshot().logicalTime + 1);
          if (events.length > 0) { for (const event of events) { recordWorldEvent(state, event); if (state.pending && event.commandId === state.pending.commandId) { if (event.type === "TOOL_FAILED") handleFailure(state, typeof event.payload.code === "string" ? event.payload.code : "TOOL_FAILED", state.pending.node, event.payload); else { const pending = state.pending; state.pending = undefined; emit(state, "TOOL_RESULT", { ok: true, commandId: pending.commandId, worldEventId: event.id }, pending.node); if (state.cancelRequested) pauseAtSafePoint(state); else if (pending.node.category === "ESCALATION") complete(state, "ESCALATED", "ESCALATION_EMITTED"); else { if (pending.node.category === "FALLBACK") { state.failureHandled = false; state.escalating = false; } drive(state); } } } } continue; }
          break;
        }
        drive(state);
      }
      if (!state.terminalOutcome && guard >= 1024) complete(state, "FAILED", "STEP_LIMIT_EXCEEDED", ["runToCompletion guard exceeded"]);
      return update(state);
    },
  };
}

export const createInstructionExecutor = createInstructionEngine;
export const createEngine = createInstructionEngine;
