import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef, ArtifactVersion, Clause } from "../content-registry/index.ts";
import { createMemoryRepository, createMemoryService } from "../memory/index.ts";
import type { FreshnessStatus, MemoryFact, MemoryRecord } from "../memory/index.ts";
import { artifactContextUnits, assertContextCost, toolContextUnits, workingStateContextUnits } from "./cost.ts";
import type {
  ArtifactRegistryPort,
  AuthoritativeFact,
  ContextBlock,
  ContextItem,
  ContextItemKind,
  ContextRequest,
  ContextResult,
  ContextService,
  ContextSnapshot,
  ContextToolInput,
  ContextUsageEvidence,
  ContextFinding,
  ProfilerLevel,
  ProfilerResult,
  WorkingStateInput,
  WorkingStateObservation,
} from "./types.ts";
import type { ContextMode } from "./types.ts";

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function compareRef(a: ArtifactRef, b: ArtifactRef): number {
  return a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version;
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function stableStrings(values: readonly string[] | undefined): readonly string[] {
  return [...new Set(values ?? [])].sort();
}

class InvalidContextRequestError extends Error {}
class MissingArtifactError extends Error {}

function assertRequest(request: ContextRequest): void {
  if (!request.agentId || !request.jobId) throw new InvalidContextRequestError("agentId and jobId are required");
  if (!Number.isInteger(request.budget) || request.budget < 0) throw new InvalidContextRequestError("budget must be a non-negative integer");
  if (request.logicalTime !== undefined && (!Number.isInteger(request.logicalTime) || request.logicalTime < 0)) throw new InvalidContextRequestError("logicalTime must be a non-negative integer");
}

function assertLogicalTime(logicalTime: number): void {
  if (!Number.isInteger(logicalTime) || logicalTime < 0) throw new InvalidContextRequestError("logicalTime must be a non-negative integer");
}

function registryFor(request: ContextRequest): ArtifactRegistryPort | undefined {
  return request.registry ?? request.artifactRegistry;
}

function normalizeWorkingStates(request: ContextRequest, logicalTime: number, mode: ContextMode): readonly WorkingStateInput[] {
  const direct = request.workingState === undefined ? [] : Array.isArray(request.workingState) ? request.workingState : [request.workingState];
  const query = request.workingStateQuery ?? request.stateQuery;
  const queried = mode === "ACTUAL" || direct.length === 0
    ? (query?.getWorkingState?.(request.agentId, request.jobId, logicalTime) ?? query?.query?.(request.agentId, request.jobId, logicalTime))
    : undefined;
  const fromQuery = queried === undefined ? [] : Array.isArray(queried) ? queried : [queried];
  return [...direct, ...fromQuery].sort((a, b) => (a.ref ?? "working-state") < (b.ref ?? "working-state") ? -1 : (a.ref ?? "working-state") > (b.ref ?? "working-state") ? 1 : 0);
}

function artifactKind(artifact: ArtifactVersion, requestedKind?: ContextItemKind): ContextItemKind {
  if (requestedKind) return requestedKind;
  if (artifact.type === "PROMPT") return "PROMPT";
  if (artifact.type === "SYSTEM_PROMPT") return "SYSTEM_PROMPT";
  if (artifact.type === "KNOWLEDGE") return "KNOWLEDGE";
  return "SKILL";
}

interface ArtifactSelection {
  readonly ref: ArtifactRef;
  readonly requestedKind?: ContextItemKind;
}

function selectedArtifactRoots(request: ContextRequest): readonly ArtifactSelection[] {
  const roots: ArtifactSelection[] = [];
  if (request.promptRef ?? request.prompt) roots.push({ ref: request.promptRef ?? request.prompt!, requestedKind: "PROMPT" });
  for (const ref of [...(request.skillRefs ?? request.skills ?? [])].sort(compareRef)) roots.push({ ref, requestedKind: "SKILL" });
  for (const ref of [...(request.systemPromptRefs ?? request.systemPrompts ?? [])].sort(compareRef)) roots.push({ ref, requestedKind: "SYSTEM_PROMPT" });
  for (const ref of [...(request.knowledgeRefs ?? request.knowledge ?? [])].sort(compareRef)) roots.push({ ref, requestedKind: "KNOWLEDGE" });
  const generic = [...(request.artifactRefs ?? request.selectedArtifacts ?? [])].sort(compareRef).map((ref) => ({ ref }));
  roots.push(...generic);
  return roots;
}

function dependencyRefs(registry: ArtifactRegistryPort, artifact: ArtifactVersion): readonly ArtifactRef[] {
  const direct = registry.dependencies?.({ artifactId: artifact.artifactId, version: artifact.version }, false) ?? artifact.dependencies;
  return [...direct].sort(compareRef);
}

function applicabilityMatched(artifact: ArtifactVersion, request: ContextRequest): boolean {
  const available = new Set(request.applicabilityTags ?? request.contextTags ?? []);
  return artifact.applicabilityTags.every((tag) => available.has(tag));
}

function clauseSignature(clause: Clause): string {
  return canonicalSerialize({ conditions: clause.conditions ?? null, action: clause.action ?? null, assert: clause.assert ?? null, onFail: clause.onFail ?? null, type: clause.type });
}

function makeArtifactItem(artifact: ArtifactVersion, kind: ContextItemKind, request: ContextRequest, rootRef: string): ContextItem {
  const clauses = artifact.clauses ?? [];
  const semanticPairs = clauses
    .filter((clause): clause is Clause & { readonly semanticKey: string } => Boolean(clause.semanticKey))
    .map((clause) => ({ key: clause.semanticKey, signature: clauseSignature(clause) }))
    .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : a.signature < b.signature ? -1 : 1);
  const semanticKeys = stableStrings(semanticPairs.map((pair) => pair.key));
  return {
    ref: refKey(artifact),
    kind,
    version: artifact.version,
    contextCost: assertContextCost(artifactContextUnits(artifact)),
    provenance: `artifact:${refKey(artifact)}`,
    applicabilityMatched: applicabilityMatched(artifact, request),
    semanticKeys,
    semanticSignatures: semanticKeys.map((key) => semanticPairs.filter((pair) => pair.key === key).map((pair) => pair.signature).sort().join("\u0001")),
    clauseIds: stableStrings(clauses.map((clause) => clause.id)),
    clauseSignatures: clauses.map(clauseSignature).sort(),
    sourceArtifactRef: rootRef,
  };
}

function observationsFromState(states: readonly WorkingStateInput[], logicalTime: number): readonly WorkingStateObservation[] {
  const observations: WorkingStateObservation[] = [];
  for (const state of states) {
    for (const observation of state.observations ?? []) {
      if (observation.observedAt <= logicalTime) observations.push(observation);
    }
    if (state.facts && !Array.isArray(state.facts)) {
      for (const [key, value] of Object.entries(state.facts)) observations.push({ key, value, observedAt: logicalTime, provenance: state.provenance });
    }
    for (const fact of (state.facts && Array.isArray(state.facts) ? state.facts : [])) {
      observations.push({ key: fact.key, value: fact.value, subjectRef: fact.subjectRef, observedAt: fact.observedAt ?? logicalTime, provenance: fact.provenance ?? state.provenance });
    }
  }
  return observations.filter((observation) => observation.observedAt <= logicalTime);
}

function memoryFacts(record: MemoryRecord): readonly MemoryFact[] {
  // A memory's subjectRefs scope a compact fact map.  Preserve an explicit
  // fact subject when authored, otherwise attach a single-record subject so
  // it can participate in direct-observation precedence.
  return (record.facts ?? []).map((fact) => fact.subjectRef || record.subjectRefs.length === 1
    ? { ...fact, ...(fact.subjectRef || record.subjectRefs.length !== 1 ? {} : { subjectRef: record.subjectRefs[0] }) }
    : fact);
}

function freshnessNumber(status: FreshnessStatus): number {
  return status === "FRESH" ? 1 : 0;
}

function normalizeMemoryRecords(request: ContextRequest, logicalTime: number): readonly MemoryRecord[] {
  const policy = request.freshnessPolicy ?? { maxAgeSeconds: 300 };
  const query = { ...(request.memoryQuery ?? {}), ...(request.memoryRefs ? { ids: request.memoryRefs } : {}) };
  const access = request.memoryAccess ?? { agentId: request.agentId };
  // Explicit records still cross the same query/access boundary as repository
  // records. Passing an array is not authority to read another agent's LOCAL
  // memory.
  const explicitService = request.memoryRecords ? createMemoryService(createMemoryRepository(request.memoryRecords)) : undefined;
  const records = explicitService
    ? explicitService.retrieve(query, access, logicalTime)
    : request.memoryService?.retrieve(query, access, logicalTime) ?? [];
  const evaluator = request.memoryService ?? createMemoryService();
  return records
    .filter((record) => request.memoryQuery?.includeExpired === true || evaluator.evaluate(record, logicalTime, policy) !== "EXPIRED")
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function makeMemoryItem(record: MemoryRecord, request: ContextRequest, logicalTime: number): ContextItem {
  const policy = request.freshnessPolicy ?? { maxAgeSeconds: 300 };
  const service = request.memoryService ?? createMemoryService();
  const status = service.evaluate(record, logicalTime, policy);
  return {
    ref: record.id,
    kind: "MEMORY",
    contextCost: assertContextCost(record.contextCost),
    provenance: record.provenance,
    freshness: freshnessNumber(status),
    freshnessStatus: status,
    applicabilityMatched: true,
  };
}

function makeWorkingItem(state: WorkingStateInput): ContextItem {
  return {
    ref: state.ref ?? "working-state",
    kind: "WORKING_STATE",
    contextCost: assertContextCost(workingStateContextUnits(state)),
    provenance: state.provenance ?? "simulation:working-state",
    applicabilityMatched: state.applicabilityMatched ?? true,
  };
}

function authoritativeFacts(states: readonly WorkingStateInput[], memories: readonly MemoryRecord[], logicalTime: number, request: ContextRequest): readonly AuthoritativeFact[] {
  const observations = observationsFromState(states, logicalTime);
  const byKey = new Map<string, { direct?: WorkingStateObservation; memory?: { record: MemoryRecord; fact: MemoryFact } }>();
  for (const observation of observations) {
    const key = `${observation.key}\u0000${observation.subjectRef ?? ""}`;
    const current = byKey.get(key);
    if (!current?.direct || current.direct.observedAt < observation.observedAt) byKey.set(key, { ...(current ?? {}), direct: observation });
  }
  const policy = request.freshnessPolicy ?? { maxAgeSeconds: 300 };
  const service = request.memoryService ?? createMemoryService();
  for (const record of memories) {
    if (service.evaluate(record, logicalTime, policy) === "EXPIRED") continue;
    for (const fact of memoryFacts(record)) {
      const key = `${fact.key}\u0000${fact.subjectRef ?? ""}`;
      const current = byKey.get(key);
      if (!current?.memory || current.memory.record.observedAt < record.observedAt) byKey.set(key, { ...(current ?? {}), memory: { record, fact } });
    }
  }
  return [...byKey.entries()]
    .map(([compound, candidate]) => {
      const [key, subjectRef] = compound.split("\u0000");
      if (candidate.direct) {
        const supersedes = candidate.memory && canonicalSerialize(candidate.memory.fact.value) !== canonicalSerialize(candidate.direct.value) ? [candidate.memory.record.id] : undefined;
        return { key, ...(subjectRef ? { subjectRef } : {}), value: candidate.direct.value, observedAt: candidate.direct.observedAt, source: "DIRECT_OBSERVATION" as const, provenance: candidate.direct.provenance ?? "simulation:observation", ...(supersedes ? { supersedes } : {}) };
      }
      const memory = candidate.memory!;
      return { key, ...(subjectRef ? { subjectRef } : {}), value: memory.fact.value, observedAt: memory.fact.observedAt ?? memory.record.observedAt, source: "MEMORY" as const, provenance: memory.fact.provenance ?? memory.record.provenance };
    })
    .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : (a.subjectRef ?? "") < (b.subjectRef ?? "") ? -1 : 1);
}

function contextId(request: ContextRequest, mode: ContextMode): string {
  return request.id ?? request.snapshotId ?? `context.${request.agentId}.${request.jobId}.${mode.toLowerCase()}`;
}

interface AssemblyResult {
  readonly items: readonly ContextItem[];
  readonly states: readonly WorkingStateInput[];
  readonly memories: readonly MemoryRecord[];
  readonly createdAtLogicalTime: number;
}

function assemble(request: ContextRequest, mode: ContextMode, logicalTime: number): AssemblyResult {
  const registry = registryFor(request);
  const items: ContextItem[] = [];
  const roots = selectedArtifactRoots(request);
  if (roots.length > 0 && !registry) throw new InvalidContextRequestError("a registry is required when artifact refs are selected");
  const visit = (selection: ArtifactSelection, stack: readonly string[], rootRef: string): void => {
    const artifact = registry?.getArtifact(selection.ref);
    if (!artifact) throw new MissingArtifactError(`missing artifact ${refKey(selection.ref)}`);
    const key = refKey(selection.ref);
    if (stack.includes(key)) return;
    const kind = artifactKind(artifact, selection.requestedKind);
    items.push(makeArtifactItem(artifact, kind, request, rootRef));
    for (const dependency of dependencyRefs(registry!, artifact)) {
      if (!stack.includes(refKey(dependency))) visit({ ref: dependency }, [...stack, key], rootRef);
    }
  };
  for (const selection of roots) visit(selection, [], refKey(selection.ref));

  const tools = [
    ...(request.toolSchemas ?? []),
    ...(request.tools ?? []).map((tool): string | ContextToolInput => tool),
    ...(request.toolIds ?? []),
  ].sort((a, b) => (typeof a === "string" ? a : a.id) < (typeof b === "string" ? b : b.id) ? -1 : (typeof a === "string" ? a : a.id) > (typeof b === "string" ? b : b.id) ? 1 : 0);
  for (const tool of tools) {
    const input = typeof tool === "string" ? { id: tool } : tool;
    items.push({ ref: input.id, kind: "TOOL", contextCost: assertContextCost(toolContextUnits(input)), provenance: input.provenance ?? `tool:${input.id}`, applicabilityMatched: input.applicabilityMatched ?? true });
  }

  const memories = normalizeMemoryRecords(request, logicalTime);
  for (const record of memories) items.push(makeMemoryItem(record, request, logicalTime));
  const states = normalizeWorkingStates(request, logicalTime, mode);
  for (const state of states) items.push(makeWorkingItem(state));
  return { items: cloneFreeze(items), states, memories, createdAtLogicalTime: logicalTime };
}

function baseSnapshot(request: ContextRequest, mode: ContextMode, logicalTime: number, assembly: AssemblyResult): ContextSnapshot {
  const totalLoad = assembly.items.reduce((sum, item) => sum + item.contextCost, 0);
  return cloneFreeze({
    id: contextId(request, mode),
    agentId: request.agentId,
    jobId: request.jobId,
    budget: request.budget,
    totalLoad,
    items: assembly.items,
    conflicts: [],
    duplicates: [],
    createdAtLogicalTime: logicalTime,
    mode,
    authoritativeFacts: authoritativeFacts(assembly.states, assembly.memories, logicalTime, request),
  });
}

function overflowBlock(request: ContextRequest, snapshot: ContextSnapshot): ContextBlock {
  return cloneFreeze({
    blocked: true,
    code: "BLOCKED_CONTEXT_OVERFLOW",
    id: snapshot.id,
    agentId: snapshot.agentId,
    jobId: snapshot.jobId,
    budget: snapshot.budget,
    totalLoad: snapshot.totalLoad,
    items: snapshot.items,
    message: `Context load ${snapshot.totalLoad} CU exceeds budget ${snapshot.budget} CU; execution is blocked without truncation.`,
    diagnostics: [`total=${snapshot.totalLoad}`, `budget=${snapshot.budget}`, `items=${snapshot.items.length}`],
  });
}

function failureBlock(request: ContextRequest, mode: ContextMode, error: unknown): ContextBlock {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof MissingArtifactError ? "MISSING_ARTIFACT" : "INVALID_CONTEXT_REQUEST";
  return cloneFreeze({ blocked: true, code, id: contextId(request, mode), agentId: request.agentId, jobId: request.jobId, budget: request.budget, totalLoad: 0, items: [], message, diagnostics: [message] });
}

function findingId(code: string, refs: readonly string[], detail = ""): string {
  return `${code}:${refs.join(",")}${detail ? `:${detail}` : ""}`;
}

function finding(code: ContextFinding["code"], refs: readonly string[], cuImpact: number, severity: ContextFinding["severity"], evidence: readonly string[], question: string, remediationCategory: ContextFinding["remediationCategory"], semanticKey?: string): ContextFinding {
  const sortedRefs = [...new Set(refs)].sort();
  return { code, findingId: findingId(code, sortedRefs, semanticKey), involvedRefs: sortedRefs, cuImpact, severity, evidence: [...evidence].sort(), question, remediationCategory, ...(semanticKey ? { semanticKey } : {}) };
}

export function analyzeContext(snapshot: ContextSnapshot, evidence?: ContextUsageEvidence): readonly ContextFinding[] {
  const findings: ContextFinding[] = [];
  const exactGroups = new Map<string, ContextItem[]>();
  for (const item of snapshot.items) {
    const key = `${item.kind}\u0000${item.ref}`;
    const group = exactGroups.get(key) ?? [];
    group.push(item);
    exactGroups.set(key, group);
  }
  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    const refs = group.map((item) => item.ref);
    const cuImpact = group.slice(1).reduce((sum, item) => sum + item.contextCost, 0);
    findings.push(finding("DUPLICATE_EXACT_REF", refs, cuImpact, "INFO", [`${group.length} copies of ${group[0].ref}`, `avoidable=${cuImpact} CU`], "Can this exact artifact or module be selected once?", "DEDUPLICATE"));
  }

  const semanticGroups = new Map<string, { item: ContextItem; signature: string }[]>();
  for (const item of snapshot.items) {
    for (const [semanticIndex, semanticKey] of (item.semanticKeys ?? []).entries()) {
      const group = semanticGroups.get(semanticKey) ?? [];
      const signatures = item.semanticSignatures?.[semanticIndex] ? [item.semanticSignatures[semanticIndex]] : [""];
      group.push(...(signatures.length === 0 ? [{ item, signature: "" }] : signatures.map((signature) => ({ item, signature }))));
      semanticGroups.set(semanticKey, group);
    }
  }
  for (const [semanticKey, group] of [...semanticGroups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const refs = [...new Set(group.map(({ item }) => item.ref))];
    if (refs.length < 2) continue;
    const signatures = new Set(group.map(({ signature }) => signature));
    const cuImpact = group.slice(1).reduce((sum, { item }) => sum + item.contextCost, 0);
    if (signatures.size > 1) findings.push(finding("CONFLICTING_CLAUSES", refs, cuImpact, "ERROR", [`semanticKey=${semanticKey}`, `${signatures.size} distinct clause semantics`], "Which clause should own this semantic key, and what precedence is intended?", "RECONCILE_CONFLICT", semanticKey));
    else findings.push(finding("DUPLICATE_SEMANTIC_KEY", refs, cuImpact, "INFO", [`semanticKey=${semanticKey}`, `avoidable=${cuImpact} CU`], "Can this repeated semantic clause be shared or referenced once?", "DEDUPLICATE", semanticKey));
  }

  for (const item of snapshot.items) {
    if (item.kind === "MEMORY" && item.freshnessStatus === "STALE") findings.push(finding("STALE_MEMORY", [item.ref], item.contextCost, "WARNING", [`memory=${item.ref}`, "record exceeded freshness policy"], "Should this memory be refreshed before the agent relies on it?", "REFRESH_MEMORY"));
    if (!item.applicabilityMatched) {
      findings.push(finding("APPLICABILITY_MISMATCH", [item.ref], item.contextCost, "INFO", [`${item.ref} does not match the active applicability tags`], "Is this module too broad for the current task?", "NARROW_SCOPE"));
      if (item.sourceArtifactRef && item.sourceArtifactRef !== item.ref) findings.push(finding("OVER_BROAD_DEPENDENCY", [item.sourceArtifactRef, item.ref], item.contextCost, "WARNING", [`dependency=${item.ref}`, `root=${item.sourceArtifactRef}`, "dependency branch is not applicable"], "Can this dependency branch be split or loaded conditionally?", "NARROW_SCOPE"));
    }
  }

  if (evidence) {
    const used = new Set([...(evidence.usedRefs ?? []), ...(evidence.usedItemRefs ?? []), ...(evidence.usedClauseIds ?? [])]);
    const moduleItems = snapshot.items.filter((item) => ["PROMPT", "SKILL", "SYSTEM_PROMPT", "KNOWLEDGE"].includes(item.kind));
    for (const item of moduleItems) {
      const usedByRef = used.has(item.ref) || (item.clauseIds ?? []).some((clauseId) => used.has(clauseId));
      if (!usedByRef) findings.push(finding("UNUSED_MODULE", [item.ref], item.contextCost, "INFO", [`execution evidence did not reference ${item.ref}`], "Can this module be removed from the selected context?", "REMOVE_UNUSED"));
    }
  }
  return cloneFreeze(findings.sort((a, b) => a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0));
}

export function createContextService(): ContextService {
  const build = (request: ContextRequest, mode: ContextMode, logicalTime: number): ContextResult => {
    try {
      assertRequest(request);
      assertLogicalTime(logicalTime);
      const assembly = assemble(request, mode, logicalTime);
      const snapshot = baseSnapshot(request, mode, logicalTime, assembly);
      if (snapshot.totalLoad > snapshot.budget) return { ok: false, error: overflowBlock(request, snapshot) };
      return { ok: true, value: snapshot };
    } catch (error) {
      return { ok: false, error: failureBlock(request, mode, error) };
    }
  };
  return {
    project: (request) => build(request, "PROJECTED", request.logicalTime ?? 0),
    buildActual: (request, logicalTime) => build(request, "ACTUAL", logicalTime),
    analyze: analyzeContext,
    profiler: (snapshot, level: ProfilerLevel, evidence?: ContextUsageEvidence): ProfilerResult => ({
      level,
      findings: level === "ADVANCED" ? analyzeContext(snapshot, evidence) : [],
      snapshot,
    }),
  };
}

export const createContextAssembler = createContextService;
export const createContext = createContextService;
