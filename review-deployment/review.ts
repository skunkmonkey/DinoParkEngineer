import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef, ArtifactType } from "../content-registry/index.ts";
import type { ContextResult } from "../context/index.ts";
import type { EvalCaseResult, EvalRef } from "../eval-runner/index.ts";
import type {
  AttachEvalRunCommand,
  ChangeAnalysis,
  ClauseDiffEntry,
  ContextDeltaProfile,
  EvalAssociation,
  EvalSelectionCommand,
  RefDelta,
  ReviewConflict,
  ReviewError,
  ReviewJobProfile,
  ReviewProposal,
  ReviewRecord,
  ReviewRegistryPort,
  ReviewRevision,
  ReviewService,
  ReviewServiceOptions,
  ReviewState,
  RevisionRequest,
  SourceDiffLine,
} from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function sameRef(left: ArtifactRef | undefined, right: ArtifactRef | undefined): boolean {
  return Boolean(left && right && left.artifactId === right.artifactId && left.version === right.version);
}

function stableRefs(refs: readonly ArtifactRef[] | undefined): readonly ArtifactRef[] {
  const values = new Map<string, ArtifactRef>();
  for (const ref of refs ?? []) if (ref && typeof ref.artifactId === "string" && Number.isSafeInteger(ref.version) && ref.version > 0) values.set(refKey(ref), { artifactId: ref.artifactId, version: ref.version });
  return Object.freeze([...values.values()].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stableEvalRefs(refs: readonly EvalRef[]): readonly EvalRef[] {
  const values = new Map<string, EvalRef>();
  for (const ref of refs) values.set(`${ref.id}@${ref.version}`, { id: ref.id, version: ref.version });
  return Object.freeze([...values.values()].sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)));
}

function error(code: ReviewError["code"], message: string, reviewId?: string): { readonly ok: false; readonly error: ReviewError } {
  return { ok: false, error: freeze({ code, message, ...(reviewId ? { reviewId } : {}) }) };
}

function conflict(review: ReviewRecord, expectedVersion: number, code: ReviewConflict["code"] = "REVIEW_VERSION_CONFLICT"): { readonly ok: false; readonly error: ReviewConflict } {
  return {
    ok: false,
    error: freeze({
      code,
      reviewId: review.reviewId,
      expectedVersion,
      actualVersion: review.version,
      message: code === "REVIEW_VERSION_CONFLICT"
        ? `Review ${review.reviewId} is version ${review.version}; expected ${expectedVersion}. Refresh before changing it.`
        : `Review ${review.reviewId} cannot accept this action in state ${review.state}.`,
    }),
  };
}

const ALLOWED_TRANSITIONS: Readonly<Record<ReviewState, readonly ReviewState[]>> = {
  PENDING: ["EVALS_RUNNING", "CHANGES_REQUESTED", "CLOSED"],
  EVALS_RUNNING: ["PENDING", "READY", "CHANGES_REQUESTED", "CLOSED"],
  CHANGES_REQUESTED: ["PENDING", "EVALS_RUNNING", "CLOSED"],
  READY: ["EVALS_RUNNING", "DEPLOYED", "CHANGES_REQUESTED", "CLOSED"],
  DEPLOYED: ["CLOSED"],
  CLOSED: [],
};

function lineDiff(before: string, after: string): readonly SourceDiffLine[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const table: number[][] = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) table[i]![j] = left[i] === right[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const output: SourceDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      output.push({ kind: "UNCHANGED", oldLine: i + 1, newLine: j + 1, text: left[i]! });
      i += 1;
      j += 1;
    } else if (j < right.length && (i >= left.length || table[i]![j + 1]! >= table[i + 1]![j]!)) {
      output.push({ kind: "ADDED", newLine: j + 1, text: right[j]! });
      j += 1;
    } else {
      output.push({ kind: "REMOVED", oldLine: i + 1, text: left[i]! });
      i += 1;
    }
  }
  return Object.freeze(output);
}

function clausesOf(artifact: ReturnType<ReviewRegistryPort["getArtifact"]>): readonly Record<string, unknown>[] {
  return (artifact?.clauses ?? []).filter((clause): clause is Record<string, unknown> => Boolean(clause && typeof clause === "object" && typeof (clause as { id?: unknown }).id === "string"));
}

function clauseDiff(before: ReturnType<ReviewRegistryPort["getArtifact"]>, after: ReturnType<ReviewRegistryPort["getArtifact"]>): readonly ClauseDiffEntry[] {
  const left = new Map(clausesOf(before).map((clause) => [String(clause.id), clause]));
  const right = new Map(clausesOf(after).map((clause) => [String(clause.id), clause]));
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
  return Object.freeze(ids.map((id): ClauseDiffEntry => {
    const oldValue = left.get(id);
    const newValue = right.get(id);
    if (!oldValue) return { id, kind: "ADDED", after: newValue };
    if (!newValue) return { id, kind: "REMOVED", before: oldValue };
    return { id, kind: canonicalSerialize(oldValue) === canonicalSerialize(newValue) ? "UNCHANGED" : "CHANGED", before: oldValue, after: newValue };
  }));
}

function delta(before: readonly string[], after: readonly string[]): RefDelta {
  const left = new Set(before);
  const right = new Set(after);
  return freeze({
    added: [...right].filter((value) => !left.has(value)).sort(),
    removed: [...left].filter((value) => !right.has(value)).sort(),
    unchanged: [...right].filter((value) => left.has(value)).sort(),
  });
}

function refsFor(registry: ReviewRegistryPort | undefined, ref: ArtifactRef, transitive: boolean): readonly ArtifactRef[] {
  const artifact = registry?.getArtifact(ref);
  return stableRefs(registry?.dependencies?.(ref, transitive) ?? (transitive ? artifact?.dependencies : artifact?.dependencies));
}

function usedByFor(registry: ReviewRegistryPort | undefined, ref: ArtifactRef, transitive: boolean): readonly string[] {
  if (!registry?.usedBy) return [];
  const found = new Map<string, ArtifactRef>();
  const visit = (target: ArtifactRef) => {
    for (const consumer of registry.usedBy?.(target) ?? []) {
      const key = refKey(consumer);
      if (found.has(key)) continue;
      found.set(key, consumer);
      if (transitive) visit(consumer);
    }
  };
  visit(ref);
  return [...found.keys()].sort();
}

function artifactRoots(profile: ReviewJobProfile, target: ArtifactRef, type: ArtifactType | undefined): ReviewJobProfile {
  const refFilter = (refs: readonly ArtifactRef[] | undefined): readonly ArtifactRef[] => (refs ?? []).filter((ref) => ref.artifactId !== target.artifactId);
  const base = { ...profile };
  if (type === "PROMPT") return { ...base, promptRef: target, skillRefs: refFilter(profile.skillRefs), systemPromptRefs: refFilter(profile.systemPromptRefs), artifactRefs: refFilter(profile.artifactRefs) };
  if (type === "SYSTEM_PROMPT") return { ...base, promptRef: profile.promptRef, skillRefs: refFilter(profile.skillRefs), systemPromptRefs: [target, ...refFilter(profile.systemPromptRefs)], artifactRefs: refFilter(profile.artifactRefs) };
  if (type === "SKILL") return { ...base, promptRef: profile.promptRef, skillRefs: [target, ...refFilter(profile.skillRefs)], systemPromptRefs: refFilter(profile.systemPromptRefs), artifactRefs: refFilter(profile.artifactRefs) };
  return { ...base, artifactRefs: [target, ...refFilter(profile.artifactRefs)] };
}

function requestFor(profile: ReviewJobProfile, target: ArtifactRef, type: ArtifactType | undefined, registry: ReviewRegistryPort | undefined, reviewId: string, side: string): Record<string, unknown> {
  const roots = artifactRoots(profile, target, type);
  return {
    id: `review.${reviewId}.${side}.${profile.id}`,
    agentId: roots.agentId,
    jobId: roots.jobId,
    budget: roots.budget,
    logicalTime: roots.logicalTime ?? 0,
    ...(roots.promptRef ? { promptRef: roots.promptRef } : {}),
    ...(roots.skillRefs ? { skillRefs: roots.skillRefs } : {}),
    ...(roots.systemPromptRefs ? { systemPromptRefs: roots.systemPromptRefs } : {}),
    ...(roots.knowledgeRefs ? { knowledgeRefs: roots.knowledgeRefs } : {}),
    ...(roots.artifactRefs ? { artifactRefs: roots.artifactRefs } : {}),
    ...(roots.toolIds ? { toolIds: roots.toolIds } : {}),
    ...(roots.applicabilityTags ? { applicabilityTags: roots.applicabilityTags } : {}),
    ...(registry ? { registry } : {}),
  };
}

function contextProfile(profile: ReviewJobProfile, baseRef: ArtifactRef, proposedRef: ArtifactRef, baseType: ArtifactType | undefined, proposedType: ArtifactType | undefined, options: ReviewServiceOptions, reviewId: string, revision: number): ContextDeltaProfile {
  const context = options.context;
  if (!context) return freeze({ profileId: profile.id, base: undefined, proposed: undefined, baseTotal: 0, proposedTotal: 0, delta: 0, reconciled: false, diagnostics: ["Context Service unavailable."] });
  const base = context.project(requestFor(profile, baseRef, baseType, options.registry, reviewId, `r${revision}.base`) as never);
  const proposed = context.project(requestFor(profile, proposedRef, proposedType, options.registry, reviewId, `r${revision}.proposed`) as never);
  const baseValue = base.ok
    ? (base as Extract<ContextResult, { readonly ok: true }>).value
    : (base as Extract<ContextResult, { readonly ok: false }>).error;
  const proposedValue = proposed.ok
    ? (proposed as Extract<ContextResult, { readonly ok: true }>).value
    : (proposed as Extract<ContextResult, { readonly ok: false }>).error;
  const baseTotal = baseValue.totalLoad;
  const proposedTotal = proposedValue.totalLoad;
  const diagnostics = [
    ...(baseValue && "diagnostics" in baseValue ? baseValue.diagnostics : []),
    ...(proposedValue && "diagnostics" in proposedValue ? proposedValue.diagnostics : []),
  ];
  return freeze({ profileId: profile.id, base: baseValue, proposed: proposedValue, baseTotal, proposedTotal, delta: proposedTotal - baseTotal, reconciled: "items" in baseValue ? baseValue.items.reduce((sum, item) => sum + item.contextCost, 0) === baseTotal : false, diagnostics });
}

function buildAnalysis(record: ReviewRecord, options: ReviewServiceOptions): ChangeAnalysis {
  const registry = options.registry;
  const before = registry?.getArtifact(record.baseRef);
  const after = registry?.getArtifact(record.proposedRef);
  const directBefore = refsFor(registry, record.baseRef, false).map(refKey);
  const directAfter = refsFor(registry, record.proposedRef, false).map(refKey);
  const transitiveBefore = refsFor(registry, record.baseRef, true).map(refKey);
  const transitiveAfter = refsFor(registry, record.proposedRef, true).map(refKey);
  const toolsBefore = before?.requiredToolIds ?? [];
  const toolsAfter = after?.requiredToolIds ?? [];
  const tagsBefore = before?.applicabilityTags ?? [];
  const tagsAfter = after?.applicabilityTags ?? [];
  const usedBefore = usedByFor(registry, record.baseRef, false);
  const usedAfter = usedByFor(registry, record.proposedRef, false);
  const transitiveUsedBefore = usedByFor(registry, record.baseRef, true);
  const transitiveUsedAfter = usedByFor(registry, record.proposedRef, true);
  const profiles = options.jobProfiles ?? options.contextProfiles ?? [];
  const contextProfiles = profiles.map((profile) => contextProfile(profile, record.baseRef, record.proposedRef, before?.type, after?.type, options, record.reviewId, record.revision));
  const contextTotalDelta = contextProfiles.reduce((sum, profile) => sum + profile.delta, 0);
  const contextOverflowProfiles = contextProfiles.filter((profile) => profile.proposed?.blocked === true).map((profile) => profile.profileId);
  const sources = lineDiff(before?.sourceText ?? "", after?.sourceText ?? "");
  const clauses = clauseDiff(before, after);
  const warnings: string[] = [];
  const hardGateCodes: string[] = [];
  if (!before) hardGateCodes.push("MISSING_BASE");
  if (!after) hardGateCodes.push("MISSING_PROPOSED");
  if (before && after && canonicalSerialize(before) === canonicalSerialize(after)) warnings.push("NO_CHANGE");
  if (contextTotalDelta > 0) warnings.push("CONTEXT_INCREASE");
  if (contextOverflowProfiles.length > 0) hardGateCodes.push("CONTEXT_OVERFLOW");
  return freeze({
    reviewId: record.reviewId,
    revision: record.revision,
    baseRef: record.baseRef,
    proposedRef: record.proposedRef,
    baseMissing: !before,
    proposedMissing: !after,
    noChange: Boolean(before && after && canonicalSerialize(before) === canonicalSerialize(after)),
    ...(before?.type ? { baseType: before.type } : {}),
    ...(after?.type ? { proposedType: after.type } : {}),
    sourceDiff: sources,
    source: sources,
    clauseDiff: clauses,
    clauses,
    dependencies: delta(directBefore, directAfter),
    transitiveDependencies: delta(transitiveBefore, transitiveAfter),
    tools: delta(toolsBefore, toolsAfter),
    tags: delta(tagsBefore, tagsAfter),
    usedBy: delta(usedBefore, usedAfter),
    transitiveUsedBy: delta(transitiveUsedBefore, transitiveUsedAfter),
    contextProfiles,
    contextTotalDelta,
    contextDelta: { totalDelta: contextTotalDelta, profiles: contextProfiles, reconciled: contextProfiles.every((profile) => profile.reconciled) },
    contextOverflowProfiles,
    warnings: [...new Set(warnings)].sort(),
    hardGateCodes: [...new Set(hardGateCodes)].sort(),
  });
}

function actionResult(review: ReviewRecord, action: string, state: ReviewState, version: number, actor: string, gameTime: number, detail?: string): ReviewRecord {
  const history = [...review.history, freeze({ id: `${review.reviewId}.history.${review.history.length + 1}`, action, state, revision: review.revision, gameTime, actor, expectedVersion: review.version, baseRef: review.baseRef, proposedRef: review.proposedRef, ...(detail ? { detail } : {}) })];
  return freeze({ ...review, state, version, history });
}

function validateRef(ref: ArtifactRef | undefined): boolean {
  return Boolean(ref && typeof ref.artifactId === "string" && /^[a-zA-Z0-9._-]+$/.test(ref.artifactId) && Number.isSafeInteger(ref.version) && ref.version > 0);
}

export function createReviewService(options: ReviewServiceOptions = {}): ReviewService {
  const records = new Map<string, ReviewRecord>();
  const logicalTime = options.logicalTime ?? 0;

  const get = (reviewId: string): ReviewRecord | undefined => records.get(reviewId);
  const list = (): readonly ReviewRecord[] => freeze([...records.values()].sort((a, b) => a.reviewId.localeCompare(b.reviewId)));

  const submit = (input: ReviewProposal) => {
    if (!validateRef(input.baseRef) || !validateRef(input.proposedRef) || !input.author?.trim() || !input.goal?.trim() || !Number.isFinite(input.createdAtGameTime)) return error("INVALID_PROPOSAL", "A review requires valid exact base/proposed refs, author, goal, and game time.");
    if (input.baseRef.artifactId !== input.proposedRef.artifactId) return error("INVALID_PROPOSAL", "Base and proposed refs must belong to the same artifact identity.");
    const reviewId = input.reviewId ?? input.id ?? `review.${input.proposedRef.artifactId}.${input.proposedRef.version}`;
    if (records.has(reviewId)) return error("DUPLICATE_REVIEW", `Review ${reviewId} already exists.`, reviewId);
    if (options.registry?.getArtifact(input.baseRef) === undefined) return error("MISSING_BASE", `Base artifact ${refKey(input.baseRef)} is not available.`, reviewId);
    if (options.registry?.getArtifact(input.proposedRef) === undefined) return error("MISSING_PROPOSED", `Proposed artifact ${refKey(input.proposedRef)} is not available.`, reviewId);
    const revision: ReviewRevision = freeze({ revision: 1, baseRef: input.baseRef, proposedRef: input.proposedRef, createdAtGameTime: input.createdAtGameTime });
    const record: ReviewRecord = freeze({
      reviewId,
      artifactId: input.proposedRef.artifactId,
      baseRef: { ...input.baseRef },
      proposedRef: { ...input.proposedRef },
      author: input.author,
      goal: input.goal,
      createdAtGameTime: input.createdAtGameTime,
      state: "PENDING",
      version: 1,
      revision: 1,
      revisions: [revision],
      evalSelection: [],
      evalAssociations: [],
      staleEvalResultIds: [],
      affectedDependencies: stableRefs(input.affectedDependencies),
      affectedConsumers: Object.freeze([...(input.affectedConsumers ?? [])].sort()),
      history: [freeze({ id: `${reviewId}.history.1`, action: "SUBMITTED", state: "PENDING", revision: 1, gameTime: input.createdAtGameTime, actor: input.author, expectedVersion: 0, baseRef: input.baseRef, proposedRef: input.proposedRef })],
    });
    records.set(reviewId, record);
    return { ok: true as const, value: record };
  };

  const analyze = (reviewId: string): ChangeAnalysis => {
    const record = records.get(reviewId);
    if (!record) return freeze({ reviewId, revision: 0, proposedRef: { artifactId: "missing", version: 1 }, baseMissing: true, proposedMissing: true, noChange: false, sourceDiff: [], source: [], clauseDiff: [], clauses: [], dependencies: delta([], []), transitiveDependencies: delta([], []), tools: delta([], []), tags: delta([], []), usedBy: delta([], []), transitiveUsedBy: delta([], []), contextProfiles: [], contextTotalDelta: 0, contextDelta: { totalDelta: 0, profiles: [], reconciled: false }, contextOverflowProfiles: [], warnings: ["UNKNOWN_REVIEW"], hardGateCodes: ["UNKNOWN_REVIEW"] });
    return buildAnalysis(record, options);
  };

  const selectEvals = (command: EvalSelectionCommand) => {
    const review = records.get(command.reviewId);
    if (!review) return error("UNKNOWN_REVIEW", `Review ${command.reviewId} does not exist.`, command.reviewId);
    if (review.version !== command.expectedReviewVersion) return conflict(review, command.expectedReviewVersion);
    if (!ALLOWED_TRANSITIONS[review.state].includes("EVALS_RUNNING") && review.state !== "EVALS_RUNNING") return conflict(review, command.expectedReviewVersion, "INVALID_STATE");
    let selected: readonly EvalRef[];
    const suiteId = command.suiteId ?? command.suiteRef;
    if (suiteId) {
      const suite = options.evals?.suite(suiteId);
      if (!suite) return error("EVAL_UNAVAILABLE", `Eval suite ${suiteId} is unavailable.`, review.reviewId);
      selected = suite.evalRefs;
    } else if (command.evalRefs) selected = command.evalRefs;
    else selected = [...review.evalSelection, ...(command.add ?? [])].filter((ref) => !(command.remove ?? []).some((other) => other.id === ref.id && other.version === ref.version));
    selected = stableEvalRefs(selected);
    if (selected.length === 0) return error("EVAL_UNAVAILABLE", "Select at least one exact eval ref before running.", review.reviewId);
    if (options.evals) {
      const catalog = options.evals.catalog();
      const missing = selected.find((ref) => !catalog.some((entry) => entry.ref.id === ref.id && entry.ref.version === ref.version));
      if (missing) return error("EVAL_UNAVAILABLE", `Eval ${missing.id}@${missing.version} is unavailable.`, review.reviewId);
    }
    // Selection changes never erase evidence. Only current-revision,
    // non-stale associations can satisfy the new selection below.
    const nextAssociations = review.evalAssociations;
    const next = actionResult({ ...review, evalSelection: selected, evalAssociations: nextAssociations }, "EVALS_SELECTED", "EVALS_RUNNING", review.version + 1, command.actor ?? "player", command.gameTime ?? logicalTime, selected.map((ref) => `${ref.id}@${ref.version}`).join(", "));
    records.set(review.reviewId, next);
    return { ok: true as const, value: next };
  };

  const attachRun = (command: AttachEvalRunCommand) => {
    const review = records.get(command.reviewId);
    if (!review) return error("UNKNOWN_REVIEW", `Review ${command.reviewId} does not exist.`, command.reviewId);
    if (review.version !== command.expectedReviewVersion) return conflict(review, command.expectedReviewVersion);
    if (review.state !== "EVALS_RUNNING" && review.state !== "READY") return conflict(review, command.expectedReviewVersion, "INVALID_STATE");
    const runResults: readonly EvalCaseResult[] = command.run
      ? ("results" in command.run ? command.run.results : [command.run as EvalCaseResult])
      : [];
    const values: readonly EvalCaseResult[] = command.results ?? command.batch?.results ?? (runResults.length > 0 ? runResults : command.result ? [command.result] : []);
    if (values.length === 0) return error("EVAL_UNAVAILABLE", "No eval result was supplied.", review.reviewId);
    const associations = [...review.evalAssociations];
    for (const result of values) {
      if (!review.evalSelection.some((ref) => ref.id === result.ref.id && ref.version === result.ref.version)) return error("INVALID_EVAL_SUBJECT", `Eval ${result.ref.id}@${result.ref.version} was not selected for this review.`, review.reviewId);
      const subjectRef = result.subjectRef ?? result.subject.ref;
      const supersededIdentity = review.staleEvalResultIds.includes(result.id);
      const stale = supersededIdentity || !sameRef(subjectRef, review.proposedRef);
      const status: EvalAssociation["status"] = stale ? "STALE" : result.status === "PASSED" ? "PASSED" : result.status.startsWith("BLOCKED") || result.status === "UNAVAILABLE" ? "BLOCKED" : "FAILED";
      const association: EvalAssociation = freeze({ id: `${review.reviewId}.eval.${result.id}.${review.revision}`, reviewId: review.reviewId, revision: review.revision, evalRef: result.ref, result, status, stale, applicable: !stale, ...(subjectRef ? { subjectRef } : {}), attachedAtGameTime: command.gameTime ?? logicalTime, ...(stale ? { reason: supersededIdentity ? `Result identity ${result.id} was invalidated by an earlier review revision and must be rerun.` : `Result targets ${subjectRef ? refKey(subjectRef) : "an unknown subject"}; current proposal is ${refKey(review.proposedRef)}.` } : {}) });
      const index = associations.findIndex((item) => item.revision === review.revision && item.evalRef.id === result.ref.id && item.evalRef.version === result.ref.version);
      if (index >= 0) associations[index] = association;
      else associations.push(association);
    }
    const current = associations.filter((association) => association.revision === review.revision && !association.stale);
    const complete = review.evalSelection.every((ref) => current.some((association) => association.evalRef.id === ref.id && association.evalRef.version === ref.version));
    const nextState: ReviewState = complete ? "READY" : "EVALS_RUNNING";
    const next = actionResult({ ...review, evalAssociations: associations }, "EVAL_RUN_ATTACHED", nextState, review.version + 1, command.actor ?? "player", command.gameTime ?? logicalTime, values.map((result) => `${result.ref.id}@${result.ref.version}:${result.status}`).join(", "));
    records.set(review.reviewId, next);
    return { ok: true as const, value: next };
  };

  const requestRevision = (command: RevisionRequest) => {
    const review = records.get(command.reviewId ?? "");
    if (!review) return error("UNKNOWN_REVIEW", `Review ${command.reviewId ?? ""} does not exist.`, command.reviewId);
    const expected = command.expectedReviewVersion ?? review.version;
    if (review.version !== expected) return conflict(review, expected);
    if (review.state === "DEPLOYED" || review.state === "CLOSED") return conflict(review, expected, "INVALID_STATE");
    if (!command.reasonCode?.trim() || !command.reason?.trim()) return error("INVALID_PROPOSAL", "A revision request requires a reason code and a specific reason.", review.reviewId);
    const revisedRef = command.proposedRef ?? review.proposedRef;
    if (!validateRef(revisedRef)) return error("INVALID_REF", "Revision proposedRef must be an exact positive version.", review.reviewId);
    const nextRevisionNumber = review.revision + 1;
    const revision: ReviewRevision = freeze({ revision: nextRevisionNumber, baseRef: review.proposedRef, proposedRef: revisedRef, reason: freeze({ ...command, reviewId: review.reviewId }), createdAtGameTime: command.gameTime ?? logicalTime });
    const staleIds = [...review.staleEvalResultIds, ...review.evalAssociations.filter((association) => !association.stale).map((association) => association.result?.id ?? association.id)];
    const staleAssociations = review.evalAssociations.map((association) => association.stale ? association : freeze({ ...association, stale: true, applicable: false, status: "STALE" as const, reason: `Superseded by review revision ${nextRevisionNumber}.` }));
    const changed = { ...review, baseRef: { ...revision.baseRef }, proposedRef: { ...revision.proposedRef }, revision: nextRevisionNumber, revisions: [...review.revisions, revision], state: "PENDING" as const, version: review.version + 1, evalSelection: [], evalAssociations: staleAssociations, staleEvalResultIds: [...new Set(staleIds)], revisionRecipe: freeze({ reasonCode: command.reasonCode, reason: command.reason, requestedAtGameTime: command.gameTime ?? logicalTime }) };
    const next = actionResult(changed, "REVISION_REQUESTED", "PENDING", review.version + 1, command.actor ?? "player", command.gameTime ?? logicalTime, `${command.reasonCode}: ${command.reason}`);
    records.set(review.reviewId, next);
    return { ok: true as const, value: next };
  };

  const transition = (reviewId: string, nextState: ReviewState, expectedVersion: number, actor = "player", gameTime = logicalTime) => {
    const review = records.get(reviewId);
    if (!review) return error("UNKNOWN_REVIEW", `Review ${reviewId} does not exist.`, reviewId);
    if (review.version !== expectedVersion) return conflict(review, expectedVersion);
    if (!ALLOWED_TRANSITIONS[review.state].includes(nextState)) return conflict(review, expectedVersion, "INVALID_STATE");
    const next = actionResult(review, "STATE_TRANSITION", nextState, review.version + 1, actor, gameTime);
    records.set(reviewId, next);
    return { ok: true as const, value: next };
  };

  const checkpoint = (): import("./types.ts").ReviewServiceCheckpoint => freeze({ records: [...records.values()] });
  const restore = (snapshot: import("./types.ts").ReviewServiceCheckpoint): void => {
    records.clear();
    for (const record of snapshot.records) records.set(record.reviewId, freeze(record));
  };

  return Object.freeze({ submit, get, list, analyze, selectEvals, attachRun, requestRevision, transition, checkpoint, restore });
}

export const createReview = createReviewService;
