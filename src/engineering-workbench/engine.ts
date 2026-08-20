import { canonicalSerialize } from "../content-registry/public.js";
import type { ContextDiagnostic } from "../context/public.js";
import { composeInstructionArtifacts, type ResolvedInstructionArtifact } from "../instruction/public.js";
import { workRequestInputSchema } from "./schemas.js";
import type { ArtifactCandidate, ArtifactHistoryEntry, ArtifactInspection, CompositionPreview, EngineeringWorkbenchService, HandbookEntry, ParkDeveloperProfile, SemanticComparison, SemanticDifference, WorkRequest } from "./types.js";

const referenceKey = (value: { readonly id: string; readonly version: string }): string => `${value.id}@${value.version}`;
const stable = (value: unknown): string => canonicalSerialize(value);
const deepFreeze = <T>(value: T): T => { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; };

export const PARK_DEVELOPER: ParkDeveloperProfile = Object.freeze({
  id: "park-developer:ada",
  name: "Ada, Park Developer",
  capabilities: Object.freeze({
    "Prompt engineering": "available", "Skill authoring": "locked", "Context optimization": "available", "Eval creation": "locked",
    "Tool integration": "locked", "Memory architecture": "locked", "Agent design": "locked", "Orchestration": "locked",
  }),
});

const handbookEntries: readonly HandbookEntry[] = Object.freeze([
  Object.freeze({ id: "handbook:context", term: "Context", definition: "The finite, provenance-labeled information available to one Agent decision.", visualGrammar: "Segmented capacity bar with exact used and total units.", encounteredExample: "The gate closer maintenance state was visible in the park but absent from Worker Context.", tags: ["context", "opening"], incidentIds: ["incident:opening-near-miss"], unlocked: true, contextEligible: false }),
  Object.freeze({ id: "handbook:clause", term: "Executable clause", definition: "A validated machine-readable behavior rule; readable prose does not execute.", visualGrammar: "Monospace rule block marked EXECUTABLE.", encounteredExample: "The feeding Prompt opened the gate using clause:open-for-feeding.", tags: ["prompt", "behavior"], incidentIds: ["incident:opening-near-miss"], unlocked: true, contextEligible: false }),
]);

const diff = (id: string, dimension: SemanticDifference["dimension"], left: unknown, right: unknown, leftLabel: string, rightLabel: string): SemanticDifference | undefined => {
  if (stable(left) === stable(right)) return undefined;
  return { id, dimension, change: "changed", summary: `${dimension} differs between exact versions.`, evidence: [
    { id: `${id}:left`, source: leftLabel, detail: stable(left) },
    { id: `${id}:right`, source: rightLabel, detail: stable(right) },
  ] };
};

export const createEngineeringWorkbench = (production: ResolvedInstructionArtifact): EngineeringWorkbenchService => {
  const requests = new Map<string, WorkRequest>();
  const candidateRecords: ArtifactCandidate[] = [];
  const deployed = Object.freeze({ ...production.reference });
  const inspect = (artifact: ResolvedInstructionArtifact, history: readonly ArtifactHistoryEntry[] = []): ArtifactInspection => ({
    reference: artifact.reference, class: artifact.class, author: artifact.author, readableSource: artifact.readableSource,
    clauses: artifact.clauses, contextCost: artifact.contextCost,
    contextComposition: artifact.class === "Prompt" ? ["Task", "Skill", "Policy", "Tool"] : ["Skill"],
    dependencies: artifact.dependencies, requiredTools: artifact.requiredTools, tradeoffs: artifact.knownTradeoffs,
    deploymentStatus: referenceKey(artifact.reference) === referenceKey(deployed) ? "deployed" : "candidate",
    history,
  });
  return {
    inspect,
    compare(left, right, contextFindings = []): SemanticComparison {
      const leftKey = referenceKey(left.reference); const rightKey = referenceKey(right.reference);
      const differences = [
        diff("difference:readable", "readable", left.readableSource, right.readableSource, leftKey, rightKey),
        diff("difference:behavioral", "behavioral", left.clauses, right.clauses, leftKey, rightKey),
        diff("difference:context", "context", left.contextCost, right.contextCost, leftKey, rightKey),
        diff("difference:dependency", "dependency", left.dependencies, right.dependencies, leftKey, rightKey),
        diff("difference:tool", "tool", left.requiredTools, right.requiredTools, leftKey, rightKey),
        diff("difference:verification", "verification", left.clauses.map((entry) => entry.verification), right.clauses.map((entry) => entry.verification), leftKey, rightKey),
        diff("difference:failure", "failure", left.clauses.map((entry) => entry.outcome), right.clauses.map((entry) => entry.outcome), leftKey, rightKey),
        diff("difference:tradeoff", "tradeoff", left.knownTradeoffs, right.knownTradeoffs, leftKey, rightKey),
      ].filter((entry): entry is SemanticDifference => entry !== undefined);
      const composed = composeInstructionArtifacts([left, right]);
      const findings: SemanticComparison["findings"][number][] = composed.findings.map((entry) => ({ kind: entry.kind === "conflict" ? "conflicting" : "duplicate", evidence: entry.clauseIds.map((clauseId) => ({ id: `evidence:${clauseId}`, source: entry.sourceReferences.map(referenceKey).join(", "), detail: entry.reasonCode })) }));
      for (const finding of contextFindings) findings.push({ kind: finding.kind === "capacity" || finding.kind === "boundary" ? "missing" : finding.kind === "conflict" ? "conflicting" : finding.kind, evidence: finding.itemIds.map((itemId) => ({ id: `evidence:${finding.code}:${itemId}`, source: itemId, detail: finding.message })) });
      return { left: left.reference, right: right.reference, differences, findings };
    },
    compose(artifacts, routes, capacity, baselineUsed): CompositionPreview {
      const composed = composeInstructionArtifacts(artifacts);
      const used = routes.filter((route) => route.included).reduce((sum, route) => sum + route.item.cost, 0);
      const diagnostics = routes.filter((route) => route.included).reduce<ContextDiagnostic[]>((entries, route) => {
        const quality = route.item.quality;
        if (quality.relevance === "irrelevant") entries.push({ code: "CONTEXT_IRRELEVANT", kind: "irrelevant", itemIds: [route.item.id], message: `${route.item.id} is irrelevant to the next decision.` });
        if (quality.staleAtTick !== undefined) entries.push({ code: "CONTEXT_STALE", kind: "stale", itemIds: [route.item.id], message: `${route.item.id} has a staleness boundary.` });
        return entries;
      }, []);
      return { clauses: composed.clauses.map((entry) => entry.clause), routes, contextUsed: used, contextCapacity: capacity, contextDelta: used - baselineUsed, diagnostics, valid: composed.findings.every((entry) => entry.kind !== "conflict") && used <= capacity };
    },
    requestWork(input) {
      const parsed = workRequestInputSchema.safeParse(input);
      if (!parsed.success || requests.has(input.id)) return { ok: false, code: "WORKBENCH_INVALID_REQUEST" };
      if (PARK_DEVELOPER.capabilities[input.capability] !== "available") return { ok: false, code: "WORKBENCH_CAPABILITY_LOCKED" };
      const request: WorkRequest = Object.freeze({ ...input, status: "quoted" }); requests.set(request.id, request); return { ok: true, request };
    },
    acceptWork(requestId) { const current = requests.get(requestId); if (current === undefined || current.status !== "quoted") throw new Error("WORKBENCH_REQUEST_NOT_QUOTED"); const next = Object.freeze({ ...current, status: "accepted" as const }); requests.set(requestId, next); return next; },
    cancelWork(requestId) { const current = requests.get(requestId); if (current === undefined || current.status === "completed" || current.status === "cancelled") throw new Error("WORKBENCH_REQUEST_NOT_CANCELLABLE"); const next = Object.freeze({ ...current, status: "cancelled" as const }); requests.set(requestId, next); return next; },
    completeWork(requestId, artifact, routes) {
      const current = requests.get(requestId); if (current === undefined || current.status !== "accepted") throw new Error("WORKBENCH_REQUEST_NOT_ACCEPTED");
      const ordinal = candidateRecords.length + 1; const candidate: ArtifactCandidate = deepFreeze({ id: `candidate:${ordinal}`, reference: structuredClone(artifact.reference), baseVersion: structuredClone(current.baseVersion), requestId, goal: current.goal, readableSource: artifact.readableSource, clauses: structuredClone(artifact.clauses), contextRoutes: [...routes].sort(), changeSummary: [`Goal: ${current.goal}`, `Context routes: ${routes.length}`, `Executable clauses: ${artifact.clauses.length}`], productionAffected: false });
      candidateRecords.push(candidate); requests.set(requestId, Object.freeze({ ...current, status: "completed" as const })); return candidate;
    },
    requestRevision(candidateId, input) { if (!candidateRecords.some((entry) => entry.id === candidateId)) throw new Error("WORKBENCH_CANDIDATE_NOT_FOUND"); const result = this.requestWork({ ...input, feedbackForCandidateId: candidateId }); if (!result.ok) throw new Error(result.code); return result.request; },
    candidates: () => structuredClone(candidateRecords),
    productionReference: () => structuredClone(deployed),
    handbook(query = "", tag) { const normalized = query.trim().toLowerCase(); return handbookEntries.filter((entry) => entry.unlocked && (tag === undefined || entry.tags.includes(tag)) && (normalized === "" || `${entry.term} ${entry.definition} ${entry.encounteredExample}`.toLowerCase().includes(normalized))).map((entry) => structuredClone(entry)); },
  };
};
