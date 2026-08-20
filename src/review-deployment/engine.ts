import { fingerprint, type ContentReference } from "../content-registry/public.js";
import type { ResolvedInstructionArtifact } from "../instruction/public.js";
import type {
  ActivateDeploymentInput, AttachEvalResultInput, AttachEvalSuiteInput,
  CausalLinkInput, ChangeRequest, ConfirmDeploymentInput, CreateChangeRequestInput,
  DeploymentConfirmation, DeploymentDependencyManifest, DeploymentEligibility,
  DeploymentManifestInput, DeploymentManifestResult, DeploymentRecord, DeploymentSlot,
  EvalEvidence, GovernanceHistoryEvent, GovernanceHistoryFilter, JobDeploymentPin,
  OmitEvalInput, PinJobInput, ReviewArtifactSnapshot, ReviewCausalLink,
  ReviewCommandResult, ReviewDecisionInput, ReviewDecisionRecord,
  ReviewDeltaEntry, ReviewDeploymentOptions, ReviewDeploymentService,
  ReviewDeploymentState, ReviewDiagnostic, ReviewDiffProjection, SelectEvalInput,
} from "./types.js";

const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const key = (reference: ContentReference): string => `${reference.id}@${reference.version}`;
const slotKey = (slot: DeploymentSlot): string => `${slot.slot}\0${slot.scope}`;
const copy = <T>(value: T): T => structuredClone(value);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
};
const immutable = <T>(value: T): T => freeze(copy(value));
const diagnostic = (code: ReviewDiagnostic["code"], path: string, rule: string, message: string): ReviewDiagnostic => ({ code, path, rule, message });
const ok = <T>(value: T): ReviewCommandResult<T> => ({ ok: true, value: immutable(value), diagnostics: [] });
const fail = <T>(...diagnostics: ReviewDiagnostic[]): ReviewCommandResult<T> => ({ ok: false, diagnostics: immutable(diagnostics) });
const sameRef = (a: ContentReference, b: ContentReference): boolean => a.id === b.id && a.version === b.version;
const sortedRefs = (values: readonly ContentReference[]): readonly ContentReference[] => [...values].map(copy).sort((a, b) => lexical(key(a), key(b)));

const snapshotArtifact = (artifact: ResolvedInstructionArtifact): ReviewArtifactSnapshot => immutable({
  reference: artifact.reference, class: artifact.class, author: artifact.author,
  readableSource: artifact.readableSource, contextCost: artifact.contextCost,
  dependencies: sortedRefs(artifact.dependencies), requiredTools: sortedRefs(artifact.requiredTools),
  clauses: artifact.clauses, knownTradeoffs: [...artifact.knownTradeoffs],
  fingerprint: fingerprint(artifact),
});

const delta = (id: string, change: ReviewDeltaEntry["change"], summary: string, left?: string, right?: string): ReviewDeltaEntry => ({
  id: `review-delta:${id}`, change, summary, evidenceIds: [], ...(left === undefined ? {} : { left }), ...(right === undefined ? {} : { right }),
});
const refDeltas = (name: string, base: readonly ContentReference[], candidate: readonly ContentReference[]): readonly ReviewDeltaEntry[] => {
  const left = new Map(base.map((entry) => [key(entry), entry]));
  const right = new Map(candidate.map((entry) => [key(entry), entry]));
  return [...new Set([...left.keys(), ...right.keys()])].sort(lexical).flatMap((entry) =>
    left.has(entry) && !right.has(entry) ? [delta(`${name}-removed-${entry.replaceAll("@", "-")}`, "removed", `${name} removed: ${entry}`, entry)] :
      !left.has(entry) && right.has(entry) ? [delta(`${name}-added-${entry.replaceAll("@", "-")}`, "added", `${name} added: ${entry}`, undefined, entry)] : []);
};
const projectDiff = (base: ResolvedInstructionArtifact, candidate: ResolvedInstructionArtifact): ReviewDiffProjection => {
  const readable = base.readableSource === candidate.readableSource ? [] : [delta("readable-source", "changed", "Readable source changed (non-executable).", base.readableSource, candidate.readableSource)];
  const behavioral = fingerprint(base.clauses) === fingerprint(candidate.clauses) ? [] : [delta("behavioral-clauses", "changed", "Machine-readable behavior changed.", fingerprint(base.clauses), fingerprint(candidate.clauses))];
  const context = base.contextCost === candidate.contextCost ? [] : [delta("context-cost", "changed", `Context cost changed by ${candidate.contextCost - base.contextCost} units.`, String(base.contextCost), String(candidate.contextCost))];
  const dependency = refDeltas("dependency", base.dependencies, candidate.dependencies);
  const tool = refDeltas("tool", base.requiredTools, candidate.requiredTools);
  const verification = behavioral.filter(() => candidate.clauses.some((entry) => entry.type === "verification"));
  const failure = behavioral.filter(() => candidate.clauses.some((entry) => entry.type === "failure" || entry.type === "stop" || entry.type === "escalation"));
  const tradeoff = fingerprint(base.knownTradeoffs) === fingerprint(candidate.knownTradeoffs) ? [] : [delta("tradeoffs", "changed", "Known tradeoffs changed.")];
  return { readable, behavioral, context, dependency, tool, verification, failure, tradeoff, findings: [] };
};

export const resolveDeploymentManifest = (input: DeploymentManifestInput): DeploymentManifestResult => {
  if (input.registry !== undefined) {
    const resolved = input.registry.resolveExact(input.root.id, input.root.version);
    if (resolved.ok) return ok({ schemaVersion: "1", root: input.root, dependencies: sortedRefs(resolved.manifest.dependencies.map((entry) => ({ id: entry.id, version: entry.version }))), resolvedContent: resolved.manifest, source: "registry", fingerprint: resolved.manifest.fingerprint });
    if (input.allowCandidateSnapshot !== true) return fail(diagnostic("REVIEW_DEPENDENCY_UNRESOLVED", "root", "exact registry resolution", `Exact candidate ${key(input.root)} and its dependencies did not resolve.`));
  }
  if (input.allowCandidateSnapshot !== true) return fail(diagnostic("REVIEW_DEPENDENCY_UNRESOLVED", "root", "exact manifest source", "No exact manifest source was available."));
  const dependencies = sortedRefs(input.dependencies ?? []);
  const payload = { schemaVersion: "1" as const, root: copy(input.root), dependencies };
  return ok({ ...payload, source: "candidate-snapshot", fingerprint: fingerprint(payload) });
};

const emptyState = (): ReviewDeploymentState => ({ schemaVersion: "1", sequence: 0, reviews: [], suiteEvidence: [], decisions: [], feedback: [], deployments: [], activeDeployments: [], jobPins: [], history: [] });

export const createReviewDeployment = (options: ReviewDeploymentOptions = {}): ReviewDeploymentService => {
  let state: ReviewDeploymentState = immutable(options.initialState ?? emptyState());
  const mutate = (patch: Partial<ReviewDeploymentState>): void => { state = immutable({ ...state, ...patch }); };
  const review = (id: string): ChangeRequest | undefined => state.reviews.find((entry) => entry.id === id);
  const replaceReview = (next: ChangeRequest): void => mutate({ reviews: state.reviews.map((entry) => entry.id === next.id ? next : entry) });
  const history = (kind: GovernanceHistoryEvent["kind"], tick: number, subject: ReviewCausalLink, links: readonly ReviewCausalLink[], summary: string, actor?: string): GovernanceHistoryEvent => {
    const sequence = state.sequence + 1;
    const event: GovernanceHistoryEvent = { schemaVersion: "1", id: `governance:event-${sequence.toString().padStart(6, "0")}`, sequence, kind, tick, ...(actor === undefined ? {} : { actor }), subject, links: [...links], summary };
    mutate({ sequence, history: [...state.history, event] });
    return event;
  };

  const createChangeRequest = (input: CreateChangeRequestInput): ReviewCommandResult<ChangeRequest> => {
    if (state.reviews.some((entry) => entry.id === input.id)) return fail(diagnostic("REVIEW_DUPLICATE", "id", "unique review ID", `Review ${input.id} already exists.`));
    if (!sameRef(input.baseVersion, input.baseArtifact.reference) || !sameRef(input.candidate.reference, input.candidateArtifact.reference) || !sameRef(input.candidate.baseVersion, input.baseVersion)) return fail(diagnostic("REVIEW_STALE_CANDIDATE", "candidate", "exact immutable candidate/base", "The candidate, base, and artifact snapshots do not identify the same exact versions."));
    const diff = projectDiff(input.baseArtifact, input.candidateArtifact);
    const contextDelta = { baseCost: input.baseArtifact.contextCost, candidateCost: input.candidateArtifact.contextCost, delta: input.candidateArtifact.contextCost - input.baseArtifact.contextCost, composition: [...diff.context] };
    const links: ReviewCausalLink[] = [{ kind: "candidate", id: input.candidate.id, version: input.candidate.reference.version }, { kind: "workbench", id: input.candidate.requestId }];
    const request: ChangeRequest = {
      schemaVersion: "1", id: input.id, status: "open", author: input.author, goal: input.goal,
      owningArtifact: input.owningArtifact ?? input.baseVersion, baseVersion: input.baseVersion,
      candidateVersion: input.candidate.reference, candidateId: input.candidate.id, candidate: input.candidate,
      baseSnapshot: snapshotArtifact(input.baseArtifact), candidateSnapshot: snapshotArtifact(input.candidateArtifact),
      createdTick: input.createdTick, sourceFingerprint: fingerprint({ base: input.baseArtifact, candidate: input.candidateArtifact, candidateRecord: input.candidate }),
      workbenchLinks: links, diff, contextDelta,
      dependencyDelta: { base: sortedRefs(input.baseArtifact.dependencies), candidate: sortedRefs(input.candidateArtifact.dependencies), changes: diff.dependency },
      toolDelta: { base: sortedRefs(input.baseArtifact.requiredTools), candidate: sortedRefs(input.candidateArtifact.requiredTools), changes: diff.tool },
      expectedEffect: input.expectedEffect ?? input.candidate.changeSummary.join(" "), tradeoffs: [...input.candidateArtifact.knownTradeoffs],
      risks: [...(input.riskAreas ?? [])], evidence: [], decisionIds: [], feedbackIds: [], causalLinks: links,
    };
    mutate({ reviews: [...state.reviews, immutable(request)].sort((a, b) => lexical(a.id, b.id)) });
    history("review-created", input.createdTick, { kind: "review", id: input.id }, links, `Opened immutable review ${input.id}.`, input.author);
    return ok(request);
  };

  const selectEvals = (input: SelectEvalInput): ReviewCommandResult<ChangeRequest> => {
    const current = review(input.reviewId); if (current === undefined) return fail(diagnostic("REVIEW_NOT_FOUND", "reviewId", "existing review", `Review ${input.reviewId} was not found.`));
    const plan = input.plan;
    const selected = sortedRefs(plan?.selectedCases ?? input.caseReferences ?? []);
    const selection = { schemaVersion: "1" as const, caseReferences: sortedRefs(input.caseReferences ?? selected), suiteReferences: sortedRefs(input.suiteReferences ?? []), selectedCases: selected, includedRisks: [...(plan?.includedRisks ?? [])], estimatedCost: plan?.estimatedCost ?? { buildUnits: 0, runUnits: 0, totalUnits: 0, references: [] }, items: [...(plan?.items ?? [])], diagnostics: (plan?.diagnostics ?? []).map((entry) => entry.message), selectedTick: input.tick };
    const next = { ...current, selection: immutable(selection) }; replaceReview(next);
    history("eval-selected", input.tick, { kind: "review", id: current.id }, [...selection.caseReferences.map((entry) => ({ kind: "eval" as const, id: entry.id, version: entry.version })), ...selection.suiteReferences.map((entry) => ({ kind: "suite" as const, id: entry.id, version: entry.version }))], `Selected ${selected.length} exact Eval case(s).`);
    return ok(next);
  };

  const attachEvalResult = (input: AttachEvalResultInput): ReviewCommandResult<EvalEvidence> => {
    const current = review(input.reviewId); if (current === undefined) return fail(diagnostic("REVIEW_NOT_FOUND", "reviewId", "existing review", `Review ${input.reviewId} was not found.`));
    if (!sameRef(input.result.candidateReference, current.candidateVersion)) return fail(diagnostic("REVIEW_EVIDENCE_MISMATCH", "result.candidateReference", "exact reviewed candidate", "Eval result belongs to a different candidate."));
    if (current.evidence.some((entry) => entry.id === input.result.resultId)) return fail(diagnostic("REVIEW_EVIDENCE_DUPLICATE", "resultId", "unique immutable result", `Eval result ${input.result.resultId} is already attached.`));
    const replayLinks: ReviewCausalLink[] = [{ kind: "result", id: input.result.resultId }, { kind: "trace", id: input.result.replay.traceId }, { kind: "replay", id: input.result.replay.sessionId }];
    if ((input.result.status === "failed" || input.result.status === "invalid") && !input.result.replay.available) return fail(diagnostic("REVIEW_EVIDENCE_UNDIAGNOSED", "result.replay", "failure diagnosis link", "Failed or invalid evidence must link to replay/Trace diagnosis."));
    const evidence: EvalEvidence = { schemaVersion: "1", id: input.result.resultId, reviewId: current.id, caseReference: input.result.caseReference, ...(input.suiteReference === undefined ? {} : { suiteReference: input.suiteReference }), resultId: input.result.resultId, status: input.result.status, reasonCode: input.result.reasonCode, candidateReference: input.result.candidateReference, fixtureReference: input.result.fixtureReference, dependencyFingerprint: input.result.dependencyManifest.fingerprint, result: input.result, replay: { sessionId: input.result.replay.sessionId, traceId: input.result.replay.traceId, available: input.result.replay.available, ...(input.result.replay.firstMismatchEventId === undefined ? {} : { firstMismatchEventId: input.result.replay.firstMismatchEventId }), ...(input.result.replay.firstMismatchTick === undefined ? {} : { firstMismatchTick: input.result.replay.firstMismatchTick }) }, diagnosisLinks: replayLinks, attachedTick: input.tick };
    replaceReview({ ...current, evidence: [...current.evidence, immutable(evidence)].sort((a, b) => lexical(a.id, b.id)), causalLinks: [...current.causalLinks, ...replayLinks] });
    history("eval-attached", input.tick, { kind: "review", id: current.id }, replayLinks, `Attached immutable ${input.result.status} evidence ${input.result.resultId}.`);
    return ok(evidence);
  };

  const omitEval = (input: OmitEvalInput): ReviewCommandResult<EvalEvidence> => {
    const current = review(input.reviewId); if (current === undefined) return fail(diagnostic("REVIEW_NOT_FOUND", "reviewId", "existing review", `Review ${input.reviewId} was not found.`));
    const id = `omitted:${current.id}:${input.caseReference.id}:${input.caseReference.version}`;
    const evidence: EvalEvidence = { schemaVersion: "1", id, reviewId: current.id, caseReference: input.caseReference, status: "omitted", reasonCode: "EVAL_OMITTED", candidateReference: current.candidateVersion, diagnosisLinks: [], attachedTick: input.tick, omittedReason: input.reason };
    replaceReview({ ...current, evidence: [...current.evidence.filter((entry) => entry.id !== id), immutable(evidence)].sort((a, b) => lexical(a.id, b.id)) });
    history("eval-omitted", input.tick, { kind: "review", id: current.id }, [{ kind: "eval", id: input.caseReference.id, version: input.caseReference.version }], `Recorded omitted Eval evidence: ${input.reason}`);
    return ok(evidence);
  };

  const evaluateEligibility = (reviewId: string, acceptRisk = false): DeploymentEligibility => {
    const current = review(reviewId);
    const required = sortedRefs(options.mandatoryEvalReferences ?? []);
    if (current === undefined) return { allowed: false, reviewId, requiredCases: required, selectedCases: [], evidenceIds: [], missingCases: required, failedCases: [], invalidCases: [], interruptedCases: [], omittedCases: [], unresolvedCases: required, acceptedRisk: acceptRisk, diagnostics: [diagnostic("REVIEW_NOT_FOUND", "reviewId", "existing review", `Review ${reviewId} was not found.`)] };
    const evidenceFor = (reference: ContentReference): EvalEvidence | undefined => current.evidence.find((entry) => sameRef(entry.caseReference, reference));
    const selected = current.selection?.selectedCases ?? [];
    const all = sortedRefs([...required, ...selected]);
    const by = (status: EvalEvidence["status"]): readonly ContentReference[] => all.filter((entry) => evidenceFor(entry)?.status === status);
    const missing = required.filter((entry) => evidenceFor(entry) === undefined);
    const failed = by("failed"), invalid = by("invalid"), interrupted = [...by("interrupted"), ...by("timed-out")], omitted = by("omitted"), unresolved = all.filter((entry) => evidenceFor(entry)?.status !== "passed");
    const mandatoryUnresolved = required.some((entry) => evidenceFor(entry)?.status !== "passed");
    const allowed = !mandatoryUnresolved && (unresolved.length === 0 || acceptRisk);
    const diagnostics = allowed ? [] : [diagnostic("REVIEW_EVIDENCE_MISSING", "evidence", "required evidence passed or explicit non-mandatory risk acceptance", "Deployment evidence is incomplete, failed, invalid, interrupted, timed out, or omitted.")];
    return { allowed, reviewId, requiredCases: required, selectedCases: selected, evidenceIds: current.evidence.map((entry) => entry.id), missingCases: missing, failedCases: failed, invalidCases: invalid, interruptedCases: interrupted, omittedCases: omitted, unresolvedCases: unresolved, acceptedRisk: acceptRisk, diagnostics };
  };

  const confirmDeployment = (input: ConfirmDeploymentInput): ReviewCommandResult<DeploymentConfirmation> => {
    const current = review(input.reviewId); if (current === undefined) return fail(diagnostic("REVIEW_NOT_FOUND", "reviewId", "existing review", `Review ${input.reviewId} was not found.`));
    if (input.slot.slot.trim() === "" || input.slot.scope.trim() === "") return fail(diagnostic("REVIEW_SLOT_INVALID", "slot", "explicit production slot and scope", "Deployment confirmation requires a non-empty slot and scope."));
    const manifest = input.historicalDeploymentId === undefined
      ? resolveDeploymentManifest({ root: current.candidateVersion, dependencies: current.candidateSnapshot.dependencies, registry: options.registry, allowCandidateSnapshot: true })
      : (() => { const prior = state.deployments.find((entry) => entry.id === input.historicalDeploymentId); return prior === undefined ? fail<DeploymentDependencyManifest>(diagnostic("REVIEW_DEPLOYMENT_NOT_FOUND", "historicalDeploymentId", "known historical deployment", "Historical deployment was not found.")) : ok(prior.manifest); })();
    if (!manifest.ok) return manifest;
    return ok({ schemaVersion: "1", id: input.confirmationId ?? `confirmation:${input.reviewId}:${input.slot.slot}:${input.slot.scope}:${input.tick}`, reviewId: input.reviewId, candidateReference: manifest.value.root, slot: copy(input.slot), manifestFingerprint: manifest.value.fingerprint, evidenceIds: [...(input.evidenceIds ?? current.evidence.map((entry) => entry.id))].sort(lexical), actor: input.actor, confirmed: true, confirmedTick: input.tick });
  };

  const activateDeployment = (input: ActivateDeploymentInput): ReviewCommandResult<DeploymentRecord> => {
    const current = review(input.confirmation.reviewId); if (current === undefined) return fail(diagnostic("REVIEW_NOT_FOUND", "confirmation.reviewId", "existing review", "Confirmed review was not found."));
    const historical = input.historicalDeploymentId === undefined ? undefined : state.deployments.find((entry) => entry.id === input.historicalDeploymentId);
    if (input.kind === "revert" && historical === undefined) return fail(diagnostic("REVIEW_DEPLOYMENT_NOT_FOUND", "historicalDeploymentId", "known historical deployment", "Revert target was not found."));
    const root = historical?.rootArtifact ?? current.candidateVersion;
    const dependencies = historical?.manifest.dependencies ?? current.candidateSnapshot.dependencies;
    const manifest = historical === undefined ? resolveDeploymentManifest({ root, dependencies, registry: options.registry, allowCandidateSnapshot: true }) : ok(historical.manifest);
    if (!manifest.ok) return manifest;
    if (!sameRef(input.confirmation.candidateReference, root) || input.confirmation.manifestFingerprint !== manifest.value.fingerprint) return fail(diagnostic("REVIEW_CONFIRMATION_MISMATCH", "confirmation", "exact root/manifest/slot confirmation", "Deployment confirmation does not match the exact manifest."));
    const eligibility = evaluateEligibility(current.id, input.acceptRisk === true);
    if (input.kind !== "revert" && !eligibility.allowed) return fail(...eligibility.diagnostics);
    const commandId = input.commandId ?? `deployment:${current.id}:${state.deployments.length + 1}`;
    const existing = state.deployments.find((entry) => entry.id === commandId); if (existing !== undefined) return ok(existing);
    const prior = state.activeDeployments.find((entry) => slotKey(entry.slot) === slotKey(input.confirmation.slot));
    const record: DeploymentRecord = { schemaVersion: "1", id: commandId, kind: input.kind ?? "deploy", slot: input.confirmation.slot, rootArtifact: root, manifest: manifest.value, sourceReviewId: current.id, ...(prior === undefined ? {} : { priorDeploymentId: prior.id }), ...(historical === undefined ? {} : { revertedDeploymentId: historical.id }), actor: input.actor ?? input.confirmation.actor, effectiveTick: input.tick ?? input.confirmation.confirmedTick, confirmation: input.confirmation, evidenceIds: [...input.confirmation.evidenceIds], causalLinks: [{ kind: "review", id: current.id }, { kind: input.kind === "revert" ? "revert" : "deployment", id: commandId }] };
    mutate({ deployments: [...state.deployments, immutable(record)], activeDeployments: [...state.activeDeployments.filter((entry) => slotKey(entry.slot) !== slotKey(record.slot)), immutable(record)] });
    replaceReview({ ...current, status: input.kind === "revert" ? "reverted" : "deployed", completedTick: record.effectiveTick });
    history("deployment-activated", record.effectiveTick, { kind: "deployment", id: record.id }, record.causalLinks, `${record.kind === "revert" ? "Reverted" : "Deployed"} exact ${key(root)} to ${record.slot.slot}/${record.slot.scope}.`, record.actor);
    return ok(record);
  };

  const decide = (input: ReviewDecisionInput): ReviewCommandResult<ReviewDecisionRecord> => {
    const current = review(input.reviewId); if (current === undefined) return fail(diagnostic("REVIEW_NOT_FOUND", "reviewId", "existing review", `Review ${input.reviewId} was not found.`));
    const decisionId = input.id ?? `decision:${input.reviewId}:${input.kind}:${state.decisions.length + 1}`;
    const priorDecision = state.decisions.find((entry) => entry.id === decisionId); if (priorDecision !== undefined) return ok(priorDecision);
    let deployment: DeploymentRecord | undefined;
    let feedbackId: string | undefined;
    if (input.kind === "deploy" || input.kind === "revert") {
      let confirmation = input.confirmation;
      if (confirmation === undefined && input.slot !== undefined) { const confirmed = confirmDeployment({ reviewId: input.reviewId, actor: input.actor, tick: input.tick, slot: input.slot, historicalDeploymentId: input.historicalDeploymentId }); if (!confirmed.ok) return confirmed; confirmation = confirmed.value; }
      if (confirmation === undefined) return fail(diagnostic("REVIEW_CONFIRMATION_REQUIRED", "confirmation", "explicit exact deployment confirmation", "Deploy and revert require exact confirmation."));
      if (input.kind === "deploy") { const eligibility = evaluateEligibility(current.id, input.acceptRisk === true); if (!eligibility.allowed) return fail(...eligibility.diagnostics); }
      const activated = activateDeployment({ commandId: `deployment:${decisionId}`, confirmation, actor: input.actor, tick: input.tick, kind: input.kind, historicalDeploymentId: input.historicalDeploymentId, acceptRisk: input.acceptRisk }); if (!activated.ok) return activated; deployment = activated.value;
    }
    if (input.kind === "request-changes") {
      const feedback = input.feedback;
      if (feedback === undefined) return fail(diagnostic("REVIEW_DECISION_INVALID", "feedback", "linked revision feedback", "Request changes requires structured feedback."));
      const work = options.workbench?.requestRevision(current.candidateId, { id: feedback.id ?? `work:${decisionId}`, goal: feedback.goal, baseVersion: feedback.baseVersion ?? current.candidateVersion, capability: feedback.capability ?? "Prompt engineering", inputs: feedback.inputs ?? [], quote: feedback.quote ?? { id: `quote:${decisionId}`, credits: 0, durationTicks: 0, category: "authoring" } });
      if (work !== undefined) { feedbackId = work.id; mutate({ feedback: [...state.feedback, immutable(work)] }); }
      else feedbackId = feedback.id ?? `feedback:${decisionId}`;
    }
    const links: ReviewCausalLink[] = [{ kind: "review", id: current.id }, ...(feedbackId === undefined ? [] : [{ kind: "feedback" as const, id: feedbackId }]), ...(deployment === undefined ? [] : [{ kind: deployment.kind === "revert" ? "revert" as const : "deployment" as const, id: deployment.id }])];
    const decision: ReviewDecisionRecord = { schemaVersion: "1", id: decisionId, reviewId: current.id, kind: input.kind, actor: input.actor, tick: input.tick, rationale: input.rationale ?? {}, evidenceIds: [...current.evidence.map((entry) => entry.id), ...(input.recoveryEvidenceIds ?? [])].sort(lexical), ...(feedbackId === undefined ? {} : { feedbackId }), ...(deployment === undefined ? {} : { deploymentId: deployment.id }), ...(input.historicalDeploymentId === undefined ? {} : { targetDeploymentId: input.historicalDeploymentId }), causalLinks: links };
    mutate({ decisions: [...state.decisions, immutable(decision)] });
    const updated = { ...review(current.id)!, status: input.kind === "request-changes" ? "changes-requested" as const : input.kind === "retain" ? "retained" as const : input.kind === "revert" ? "reverted" as const : "deployed" as const, completedTick: input.tick, decisionIds: [...current.decisionIds, decision.id], feedbackIds: feedbackId === undefined ? current.feedbackIds : [...current.feedbackIds, feedbackId] }; replaceReview(updated);
    history("decision-recorded", input.tick, { kind: "review", id: current.id }, links, `Recorded ${input.kind} decision.`, input.actor);
    return ok(decision);
  };

  const pinJob = (input: PinJobInput): ReviewCommandResult<JobDeploymentPin> => {
    const existing = state.jobPins.find((entry) => entry.jobId === input.jobId); if (existing !== undefined) return ok(existing);
    const active = state.activeDeployments.find((entry) => slotKey(entry.slot) === slotKey(input.slot)); if (active === undefined) return fail(diagnostic("REVIEW_NO_ACTIVE_DEPLOYMENT", "slot", "active deployment", "No active deployment exists for this job slot."));
    const refs = [active.manifest.root, ...active.manifest.dependencies];
    const pin: JobDeploymentPin = { schemaVersion: "1", jobId: input.jobId, deploymentId: active.id, slot: input.slot, pinnedTick: input.tick, manifestFingerprint: active.manifest.fingerprint, exactDeployedVersions: refs.map((reference) => ({ reference, manifestFingerprint: active.manifest.fingerprint })), causalLinks: [{ kind: "deployment", id: active.id }, { kind: "job", id: input.jobId }] };
    mutate({ jobPins: [...state.jobPins, immutable(pin)].sort((a, b) => lexical(a.jobId, b.jobId)) });
    history("job-pinned", input.tick, { kind: "job", id: input.jobId }, pin.causalLinks, `Pinned future job ${input.jobId} to deployment ${active.id}.`);
    return ok(pin);
  };

  const addCausalLink = (input: CausalLinkInput): ReviewCommandResult<GovernanceHistoryEvent> => ok(history("causal-link", input.tick, input.subject, input.links, input.summary, input.actor));
  const governanceHistory = (filter?: GovernanceHistoryFilter): readonly GovernanceHistoryEvent[] => immutable(state.history.filter((event) => {
    if (filter?.kind !== undefined && event.kind !== filter.kind) return false;
    const links = [event.subject, ...event.links];
    if (filter?.reviewId !== undefined && !links.some((entry) => entry.kind === "review" && entry.id === filter.reviewId)) return false;
    if (filter?.deploymentId !== undefined && !links.some((entry) => (entry.kind === "deployment" || entry.kind === "revert") && entry.id === filter.deploymentId)) return false;
    if (filter?.jobId !== undefined && !links.some((entry) => entry.kind === "job" && entry.id === filter.jobId)) return false;
    if (filter?.incidentId !== undefined && !links.some((entry) => entry.kind === "incident" && entry.id === filter.incidentId)) return false;
    return true;
  }));

  return Object.freeze({
    snapshot: (): ReviewDeploymentState => immutable(state), createChangeRequest, openReview: createChangeRequest,
    getReview: (reviewId: string): ChangeRequest | undefined => { const value = review(reviewId); return value === undefined ? undefined : immutable(value); },
    listReviews: (): readonly ChangeRequest[] => immutable(state.reviews), selectEvals, attachEvalResult,
    attachEvalSuite: (input: AttachEvalSuiteInput) => { const evidence: EvalEvidence[] = []; for (const result of input.result.results) { const attached = attachEvalResult({ reviewId: input.reviewId, result, suiteReference: input.suiteReference, tick: input.tick }); if (!attached.ok) return attached; evidence.push(attached.value); } mutate({ suiteEvidence: [...state.suiteEvidence, { id: input.result.resultId, reviewId: input.reviewId, suiteReference: input.suiteReference, resultId: input.result.resultId, selectedCases: input.result.selectedCases, evidenceIds: evidence.map((entry) => entry.id), attachedTick: input.tick }] }); return ok(evidence); },
    omitEval, listEvidence: (reviewId: string): readonly EvalEvidence[] => immutable(review(reviewId)?.evidence ?? []), evaluateEligibility, confirmDeployment, activateDeployment, decide,
    requestChanges: (input: ReviewDecisionInput) => decide({ ...input, kind: "request-changes" }),
    retainProduction: (input: ReviewDecisionInput) => decide({ ...input, kind: "retain" }),
    deploy: (input: ReviewDecisionInput) => decide({ ...input, kind: "deploy" }), revert: (input: ReviewDecisionInput) => decide({ ...input, kind: "revert" }),
    getDeployment: (id: string): DeploymentRecord | undefined => { const value = state.deployments.find((entry) => entry.id === id); return value === undefined ? undefined : immutable(value); },
    listDeployments: (slot?: DeploymentSlot): readonly DeploymentRecord[] => immutable(state.deployments.filter((entry) => slot === undefined || slotKey(entry.slot) === slotKey(slot))),
    getActiveDeployment: (slot: DeploymentSlot): DeploymentRecord | undefined => { const value = state.activeDeployments.find((entry) => slotKey(entry.slot) === slotKey(slot)); return value === undefined ? undefined : immutable(value); }, pinJob,
    getJobPin: (jobId: string): JobDeploymentPin | undefined => { const value = state.jobPins.find((entry) => entry.jobId === jobId); return value === undefined ? undefined : immutable(value); }, addCausalLink, governanceHistory,
    historyFor: (id: string): readonly GovernanceHistoryEvent[] => immutable(state.history.filter((event) => [event.subject, ...event.links].some((entry) => entry.id === id))),
    createProductionResolver: (slot: DeploymentSlot) => ({ resolve: (reference: ContentReference) => { const active = state.activeDeployments.find((entry) => slotKey(entry.slot) === slotKey(slot)); if (active === undefined) return { ok: false as const }; const found = [active.manifest.root, ...active.manifest.dependencies].find((entry) => sameRef(entry, reference)); return found === undefined ? { ok: false as const } : { ok: true as const, pin: { reference: copy(found), manifestFingerprint: active.manifest.fingerprint } }; } }),
  });
};
