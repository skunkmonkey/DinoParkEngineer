import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef, ArtifactVersion, Clause, ContentRegistry } from "../content-registry/index.ts";
import type { ContextSnapshot } from "../context/index.ts";
import type { AgentDefinition, CompiledRuleGraph, CompiledRuleNode, ClauseTier, InstructionContentPort, InstructionJob, RuleConflict } from "./types.ts";

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function compareRef(a: ArtifactRef, b: ArtifactRef): number {
  return a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version;
}

function compareNode(a: CompiledRuleNode, b: CompiledRuleNode): number {
  // Resolution order is explicit and independent of Map/object insertion order.
  return tierOrder(a.tier) - tierOrder(b.tier)
    || b.priority - a.priority
    || compareRef(a.artifactRef, b.artifactRef)
    || (a.clauseId < b.clauseId ? -1 : a.clauseId > b.clauseId ? 1 : 0)
    || a.order - b.order;
}

export function tierOrder(tier: ClauseTier): number {
  return {
    HARD_SAFETY: 0,
    SYSTEM_PROMPT: 1,
    MANAGER: 2,
    SKILL: 3,
    PROMPT: 4,
    HEURISTIC: 5,
  }[tier];
}

function clauseTier(artifact: ArtifactVersion, clause: Clause, job: InstructionJob): ClauseTier {
  const condition = clause.conditions ?? {};
  // A constraint is a hard safety rule unless explicitly authored as a soft
  // system preference. This keeps safety independent of artifact ordering.
  if (clause.type === "CONSTRAINT" && condition.hard !== false && condition.safety !== false) return "HARD_SAFETY";
  if (job.managerDirectiveRefs?.some((ref) => ref.artifactId === artifact.artifactId && ref.version === artifact.version)) return "MANAGER";
  if (artifact.type === "SYSTEM_PROMPT") return "SYSTEM_PROMPT";
  if (artifact.type === "SKILL") return "SKILL";
  if (artifact.type === "PROMPT") return "PROMPT";
  return "HEURISTIC";
}

function clauseApplicable(clause: Clause, itemApplicable: boolean): { applicable: boolean; reason?: string } {
  if (!itemApplicable) return { applicable: false, reason: "artifact applicability tags do not match" };
  const conditions = clause.conditions ?? {};
  const explicit = conditions.applicable;
  if (explicit === false) return { applicable: false, reason: "clause applicability is false" };
  if (conditions.enabled === false) return { applicable: false, reason: "clause is disabled" };
  return { applicable: true };
}

function parseContextRef(ref: string, version?: number): ArtifactRef | undefined {
  if (version !== undefined) {
    const separator = ref.lastIndexOf("@");
    if (separator > 0 && Number(ref.slice(separator + 1)) === version) return { artifactId: ref.slice(0, separator), version };
    return { artifactId: ref, version };
  }
  const separator = ref.lastIndexOf("@");
  if (separator <= 0) return undefined;
  const parsed = Number(ref.slice(separator + 1));
  if (!Number.isInteger(parsed)) return undefined;
  return { artifactId: ref.slice(0, separator), version: parsed };
}

function artifactForRef(content: InstructionContentPort, ref: ArtifactRef): ArtifactVersion | undefined {
  return content.getArtifact(ref);
}

function actionSemanticKey(node: CompiledRuleNode): string | undefined {
  if (node.semanticKey) return node.semanticKey;
  if (node.category === "CONSTRAINT") {
    const assertion = node.clause.assert ?? node.clause.action;
    return assertion ? `constraint:${canonicalSerialize(assertion)}` : undefined;
  }
  return undefined;
}

/**
 * Compile only semantic clauses present in the immutable context snapshot.
 * Source text is deliberately not read here (or anywhere in this package).
 */
export function compileRuleGraph(
  job: InstructionJob,
  agent: AgentDefinition,
  context: ContextSnapshot,
  content: InstructionContentPort | ContentRegistry,
): CompiledRuleGraph {
  const nodes: CompiledRuleNode[] = [];
  const seenArtifacts = new Set<string>();
  let order = 0;
  for (const item of context.items) {
    if (!(item.kind === "PROMPT" || item.kind === "SKILL" || item.kind === "SYSTEM_PROMPT" || item.kind === "KNOWLEDGE")) continue;
    const ref = parseContextRef(item.ref, item.version);
    if (!ref) continue;
    const key = refKey(ref);
    if (seenArtifacts.has(key)) continue;
    seenArtifacts.add(key);
    const artifact = artifactForRef(content, ref);
    if (!artifact) continue;
    for (const clause of [...artifact.clauses].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      const applicability = clauseApplicable(clause, item.applicabilityMatched);
      const node: CompiledRuleNode = {
        nodeId: `${key}:${clause.id}`,
        clauseId: clause.id,
        artifactRef: ref,
        artifactType: artifact.type,
        category: clause.type,
        tier: clauseTier(artifact, clause, job),
        priority: Number.isFinite(clause.priority) ? Math.trunc(clause.priority ?? 0) : 0,
        ...(clause.semanticKey ? { semanticKey: clause.semanticKey } : {}),
        clause: deepFreeze(deepClone(clause)),
        applicable: applicability.applicable,
        ...(applicability.reason ? { skipReason: applicability.reason } : {}),
        order: order++,
      };
      nodes.push(node);
    }
  }

  const applicableNodes = nodes.filter((node) => node.applicable);
  const bySemantic = new Map<string, CompiledRuleNode[]>();
  for (const node of applicableNodes) {
    const key = actionSemanticKey(node);
    if (!key) continue;
    const group = bySemantic.get(key) ?? [];
    group.push(node);
    bySemantic.set(key, group);
  }
  const conflicts: RuleConflict[] = [];
  for (const [semanticKey, contenders] of [...bySemantic.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (contenders.length < 2) continue;
    const ordered = contenders.toSorted(compareNode);
    const winner = ordered[0]!;
    conflicts.push({
      conflictId: `conflict:${semanticKey}:${ordered.map((node) => node.nodeId).join(",")}`,
      semanticKey,
      contenders: ordered.map((node) => node.nodeId),
      winnerNodeId: winner.nodeId,
      winnerReason: `tier=${winner.tier};priority=${winner.priority};artifact=${refKey(winner.artifactRef)};clause=${winner.clauseId}`,
    });
  }
  const graphId = `graph.${job.id}`;
  const graphShape = {
    id: graphId,
    jobId: job.id,
    nodes: nodes.toSorted((a, b) => a.order - b.order),
    conflicts,
    skippedNodeIds: nodes.filter((node) => !node.applicable).map((node) => node.nodeId).sort(),
  };
  return deepFreeze({ ...graphShape, canonical: canonicalSerialize(graphShape) });
}

export function canonicalRuleGraph(graph: CompiledRuleGraph): string {
  return graph.canonical;
}

export interface ClauseResolution {
  readonly selected: CompiledRuleNode | undefined;
  readonly candidates: readonly CompiledRuleNode[];
  readonly conflict?: RuleConflict;
}

/** Resolve one semantic action using the mandated tier/priority/tie ordering. */
export function resolveClause(nodes: readonly CompiledRuleNode[], completed: ReadonlySet<string>, semanticKey?: string): ClauseResolution {
  const candidates = nodes.filter((node) => node.applicable && !completed.has(node.nodeId) && (semanticKey === undefined || actionSemanticKey(node) === semanticKey));
  // Callers selecting the next execution node already provide the explicit
  // SEQUENCE/order sort. A semantic conflict, however, must be independently
  // resolved by tier/priority/tie rules.
  const ordered = semanticKey === undefined ? candidates : candidates.toSorted(compareNode);
  const selected = ordered[0];
  if (!selected) return { selected: undefined, candidates: ordered };
  const same = ordered.filter((node) => actionSemanticKey(node) !== undefined && actionSemanticKey(node) === actionSemanticKey(selected));
  return { selected, candidates: ordered, ...(same.length > 1 ? { conflict: { conflictId: `runtime:${actionSemanticKey(selected)}`, semanticKey: actionSemanticKey(selected)!, contenders: same.map((node) => node.nodeId), winnerNodeId: selected.nodeId, winnerReason: `tier=${selected.tier};priority=${selected.priority}` } } : {}) };
}

export function graphArtifacts(graph: CompiledRuleGraph): readonly ArtifactRef[] {
  return [...new Map(graph.nodes.map((node) => [refKey(node.artifactRef), node.artifactRef])).values()].sort(compareRef);
}

/** Small adapter class for feature consumers that prefer an injected compiler. */
export class RuleCompiler {
  private readonly content: InstructionContentPort | ContentRegistry;

  constructor(content: InstructionContentPort | ContentRegistry) {
    this.content = content;
  }

  compile(job: InstructionJob, agent: AgentDefinition, context: ContextSnapshot): CompiledRuleGraph {
    return compileRuleGraph(job, agent, context, this.content);
  }
}

/** Small adapter class exposing the precedence resolver as a stable port. */
export class ClauseResolver {
  resolve(nodes: readonly CompiledRuleNode[], completed: ReadonlySet<string>, semanticKey?: string): ClauseResolution {
    return resolveClause(nodes, completed, semanticKey);
  }
}
