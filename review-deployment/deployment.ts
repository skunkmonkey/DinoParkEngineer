import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import { STANDARD_TOOL_IDS } from "../content-registry/index.ts";
import type { ArtifactRef } from "../content-registry/index.ts";
import type {
  ActiveArtifact,
  DeploymentAssessment,
  DeploymentCommand,
  DeploymentError,
  DeploymentRecord,
  DeploymentService,
  DeploymentServiceCheckpoint,
  DeploymentServiceOptions,
  DeploymentWarning,
  RevertCommand,
  ReviewRecord,
  ReviewService,
} from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function warning(code: string, message: string, acknowledgementRequired = true): DeploymentWarning {
  return freeze({ code, message, severity: acknowledgementRequired ? "WARNING" : "INFO", acknowledgementRequired });
}

function failure(code: DeploymentError["code"], message: string, reviewId?: string, warningCodes?: readonly string[]): { readonly ok: false; readonly error: DeploymentError } {
  return { ok: false, error: freeze({ code, message, ...(reviewId ? { reviewId } : {}), ...(warningCodes ? { warningCodes } : {}) }) };
}

export function createDeploymentService(options: DeploymentServiceOptions & { readonly reviews: ReviewService }): DeploymentService {
  const records: DeploymentRecord[] = [];
  const activeByArtifact = new Map<string, ActiveArtifact>();
  const byTransaction = new Map<string, { readonly fingerprint: string; readonly record: DeploymentRecord }>();
  const transactionBindings = new Map<string, string>();
  let version = 0;
  const registry = options.registry;
  const reviews = options.reviews;
  const knownRefs = new Set<string>();

  function checkpoint(): DeploymentServiceCheckpoint {
    return freeze({
      review: reviews.checkpoint(),
      registry: registry?.checkpointLifecycle?.(),
      active: [...activeByArtifact.entries()],
      records: [...records],
      knownRefs: [...knownRefs],
      version,
      transactions: [...byTransaction.entries()].map(([id, value]) => ({ id, fingerprint: value.fingerprint, record: value.record })),
      bindings: [...transactionBindings.entries()].map(([id, fingerprint]) => ({ id, fingerprint })),
    });
  }

  function restore(snapshot: ReturnType<typeof checkpoint>): void {
    reviews.restore(snapshot.review);
    if (snapshot.registry) registry?.restoreLifecycle?.(snapshot.registry);
    activeByArtifact.clear();
    for (const [artifactId, active] of snapshot.active) activeByArtifact.set(artifactId, active);
    records.splice(0, records.length, ...snapshot.records);
    knownRefs.clear();
    for (const key of snapshot.knownRefs) knownRefs.add(key);
    version = snapshot.version;
    byTransaction.clear(); for (const item of snapshot.transactions) byTransaction.set(item.id, { fingerprint: item.fingerprint, record: item.record });
    transactionBindings.clear(); for (const item of snapshot.bindings) transactionBindings.set(item.id, item.fingerprint);
  }

  function runTransaction(work: () => DeploymentRecord): DeploymentRecord {
    return options.transaction?.run(work) ?? work();
  }

  function transactionFingerprint(kind: "DEPLOY" | "REVERT", payload: Record<string, unknown>): string {
    return canonicalSerialize({ kind, ...payload });
  }

  for (const ref of options.initialActiveRefs ?? []) {
    const active: ActiveArtifact = freeze({ artifactId: ref.artifactId, ref: { artifactId: ref.artifactId, version: ref.version }, deploymentId: `deployment.bootstrap.${ref.artifactId}`, version: 0 });
    activeByArtifact.set(ref.artifactId, active);
    knownRefs.add(refKey(ref));
  }

  function review(reviewId: string): ReviewRecord | undefined {
    return reviews.get(reviewId);
  }

  function validate(reviewId: string, acknowledgedWarningCodes: readonly string[] = []): DeploymentAssessment {
    const current = review(reviewId);
    if (!current) return freeze({ valid: false, reviewId, reviewVersion: 0, warnings: [], hardGates: [warning("UNKNOWN_REVIEW", `Review ${reviewId} does not exist.`, false)], acknowledgedWarningCodes });
    const analysis = (() => {
      try { return reviews.analyze(reviewId); } catch { return undefined; }
    })();
    const warnings: DeploymentWarning[] = [];
    const hardGates: DeploymentWarning[] = [];
    const artifact = registry?.getArtifact(current.proposedRef);
    if (!artifact) hardGates.push(warning("MISSING_PROPOSED", `Proposed artifact ${refKey(current.proposedRef)} is unavailable.`, false));
    if (analysis?.baseMissing) hardGates.push(warning("MISSING_BASE", `Base artifact ${refKey(current.baseRef)} is unavailable.`, false));
    if (analysis?.proposedMissing) hardGates.push(warning("MISSING_PROPOSED", `Proposed artifact ${refKey(current.proposedRef)} is unavailable.`, false));
    for (const code of analysis?.hardGateCodes ?? []) if (!hardGates.some((item) => item.code === code)) hardGates.push(warning(code, `Deployment hard gate: ${code}.`, false));
    if (artifact?.status === "DRAFT") hardGates.push(warning("INVALID_LIFECYCLE", `Exact proposed ref ${refKey(current.proposedRef)} is still DRAFT; it must be in review before deployment.`, false));
    if (artifact?.status === "RETIRED") hardGates.push(warning("INVALID_LIFECYCLE", `Exact proposed ref ${refKey(current.proposedRef)} is RETIRED and cannot be a new deployment.`, false));
    if (registry?.transition && (!registry.checkpointLifecycle || !registry.restoreLifecycle)) hardGates.push(warning("REGISTRY_TRANSACTION_UNAVAILABLE", "Registry lifecycle updates do not expose checkpoint/restore and cannot be deployed atomically.", false));
    const dependencies = registry?.dependencies?.(current.proposedRef, true) ?? artifact?.dependencies ?? [];
    for (const dependency of dependencies) if (!registry?.getArtifact(dependency)) hardGates.push(warning("MISSING_DEPENDENCY", `Dependency ${refKey(dependency)} is unavailable.`, false));
    for (const tool of artifact?.requiredToolIds ?? []) if (!STANDARD_TOOL_IDS.includes(tool) && registry?.getToolDescription && !registry.getToolDescription(tool)) hardGates.push(warning("MISSING_REQUIRED_TOOL", `Required Tool ${tool} is unavailable for ${refKey(current.proposedRef)}.`, false));
    if (current.state !== "READY" && current.state !== "DEPLOYED") hardGates.push(warning("REVIEW_NOT_READY", `Review is ${current.state}; complete the review/eval workflow before deploying.`, false));
    if (current.evalSelection.length === 0) warnings.push(warning("EVALS_NOT_RUN", "No evals are associated with this review; deployment is permitted only after acknowledging the coverage risk."));
    const associations = current.evalAssociations.filter((association) => association.revision === current.revision);
    if (associations.some((association) => association.stale || !association.applicable)) warnings.push(warning("STALE_EVAL_RESULT", "One or more eval results target an older exact subject or review revision."));
    if (associations.some((association) => association.status === "FAILED" || association.status === "BLOCKED")) warnings.push(warning("EVAL_FAILURE", "One or more selected evals failed or were blocked; inspect expected vs observed evidence before accepting this risk."));
    if (analysis?.contextTotalDelta && analysis.contextTotalDelta > 0) warnings.push(warning("CONTEXT_INCREASE", `Projected context increases by ${analysis.contextTotalDelta} CU for the configured job profiles.`));
    if (analysis?.noChange) warnings.push(warning("NO_CHANGE", "The source and semantic records are identical; verify that this review has a meaningful goal."));
    for (const code of options.hardGateCodes ?? []) {
      const candidate = warnings.find((item) => item.code === code);
      if (candidate) {
        hardGates.push(warning(candidate.code, `Authored hard gate: ${candidate.message}`, false));
        warnings.splice(warnings.indexOf(candidate), 1);
      }
    }
    const uniqueWarnings = [...new Map(warnings.map((item) => [item.code, item])).values()];
    const uniqueHardGates = [...new Map(hardGates.map((item) => [item.code, item])).values()];
    return freeze({ valid: uniqueHardGates.length === 0, reviewId, reviewVersion: current.version, proposedRef: current.proposedRef, warnings: uniqueWarnings, hardGates: uniqueHardGates, acknowledgedWarningCodes: [...new Set(acknowledgedWarningCodes)].sort() });
  }

  function deploy(command: DeploymentCommand) {
    if (!command.transactionId) return failure("INVALID_TRANSACTION", "A deployment transaction id is required.", command.reviewId);
    const fingerprint = transactionFingerprint("DEPLOY", {
      reviewId: command.reviewId,
      expectedReviewVersion: command.expectedReviewVersion,
      acknowledgeWarningCodes: [...new Set(command.acknowledgeWarningCodes ?? [])].sort(),
      actor: command.actor ?? "player",
      gameTime: command.gameTime ?? options.logicalTime ?? 0,
    });
    const binding = transactionBindings.get(command.transactionId);
    if (binding && binding !== fingerprint) return failure("IDEMPOTENCY_CONFLICT", `Transaction ${command.transactionId} is already bound to a different command payload.`, command.reviewId);
    if (!binding) transactionBindings.set(command.transactionId, fingerprint);
    const prior = byTransaction.get(command.transactionId);
    if (prior) return prior.fingerprint === fingerprint
      ? { ok: true as const, value: prior.record }
      : failure("IDEMPOTENCY_CONFLICT", `Transaction ${command.transactionId} is already bound to a different deployment command.`, command.reviewId);
    const current = review(command.reviewId);
    if (!current) return failure("UNKNOWN_REVIEW", `Review ${command.reviewId} does not exist.`, command.reviewId);
    if (current.version !== command.expectedReviewVersion) return failure("REVIEW_VERSION_CONFLICT", `Review ${command.reviewId} is version ${current.version}; expected ${command.expectedReviewVersion}.`, command.reviewId);
    const assessment = validate(command.reviewId, command.acknowledgeWarningCodes ?? []);
    if (assessment.hardGates.length > 0) return failure("HARD_GATE", assessment.hardGates.map((item) => item.message).join(" "), command.reviewId, assessment.hardGates.map((item) => item.code));
    const requiredWarnings = assessment.warnings.filter((item) => item.acknowledgementRequired).map((item) => item.code);
    const acknowledged = new Set(command.acknowledgeWarningCodes ?? []);
    const missingAcknowledgements = requiredWarnings.filter((code) => !acknowledged.has(code));
    if (missingAcknowledgements.length > 0) return failure("WARNING_ACK_REQUIRED", `Acknowledge permitted deployment warnings before activating this exact ref: ${missingAcknowledgements.join(", ")}.`, command.reviewId, missingAcknowledgements);
    const previous = activeByArtifact.get(current.artifactId);
    const gameTime = command.gameTime ?? options.logicalTime ?? 0;
    const snapshot = checkpoint();
    try {
      const record = runTransaction(() => {
        options.failureInjector?.("before-commit");
        const existing = registry?.getArtifact(current.proposedRef);
        if (existing?.status === "REVIEW") {
          const transitioned = registry?.transition?.(current.proposedRef, "REVIEW", "DEPLOYED");
          if (transitioned && !transitioned.ok) throw new Error(transitioned.error?.map((item) => item.message).join(" ") ?? "Registry lifecycle conflict.");
        }
        options.failureInjector?.("after-registry");
        const moved = reviews.transition(command.reviewId, "DEPLOYED", command.expectedReviewVersion, command.actor ?? "player", gameTime);
        if (!moved.ok) throw new Error("Review changed while deployment was committing.");
        version += 1;
        const deployment: DeploymentRecord = freeze({ id: `deployment.${current.artifactId}.${version}`, version, artifactId: current.artifactId, ref: current.proposedRef, ...(previous ? { previousRef: previous.ref } : {}), reviewId: current.reviewId, reviewRevision: current.revision, kind: "DEPLOY", actor: command.actor ?? "player", transactionId: command.transactionId, gameTime, audit: [`review=${current.reviewId}`, `reviewRevision=${current.revision}`, `expectedPriorState=${current.state}`, `exactRef=${refKey(current.proposedRef)}`, `expectedReviewVersion=${command.expectedReviewVersion}`, `warningsAcknowledged=${[...acknowledged].sort().join(",") || "none"}`] });
        activeByArtifact.set(current.artifactId, freeze({ artifactId: current.artifactId, ref: current.proposedRef, deploymentId: deployment.id, version: deployment.version }));
        records.push(deployment);
        knownRefs.add(refKey(current.proposedRef));
        options.failureInjector?.("after-active");
        return deployment;
      });
      byTransaction.set(command.transactionId, freeze({ fingerprint, record }));
      return { ok: true as const, value: record };
    } catch (thrown) {
      restore(snapshot);
      return failure("ATOMIC_COMMIT_FAILED", thrown instanceof Error ? thrown.message : String(thrown), command.reviewId);
    }
  }

  function revert(command: RevertCommand) {
    if (!command.transactionId) return failure("INVALID_TRANSACTION", "A revert transaction id is required.");
    const fingerprint = transactionFingerprint("REVERT", {
      artifactId: command.artifactId,
      targetRef: command.targetRef,
      expectedDeploymentVersion: command.expectedDeploymentVersion,
      actor: command.actor ?? "player",
      gameTime: command.gameTime ?? options.logicalTime ?? 0,
    });
    const binding = transactionBindings.get(command.transactionId);
    if (binding && binding !== fingerprint) return failure("IDEMPOTENCY_CONFLICT", `Transaction ${command.transactionId} is already bound to a different command payload.`);
    if (!binding) transactionBindings.set(command.transactionId, fingerprint);
    const prior = byTransaction.get(command.transactionId);
    if (prior) return prior.fingerprint === fingerprint
      ? { ok: true as const, value: prior.record }
      : failure("IDEMPOTENCY_CONFLICT", `Transaction ${command.transactionId} is already bound to a different revert command.`);
    const current = activeByArtifact.get(command.artifactId);
    if (!current) return failure("DEPLOYMENT_CONFLICT", `No active exact ref exists for ${command.artifactId}.`);
    if (!Number.isSafeInteger(command.expectedDeploymentVersion) || command.expectedDeploymentVersion < 0) return failure("DEPLOYMENT_CONFLICT", "Revert requires the exact observed deployment version.");
    if (current.version !== command.expectedDeploymentVersion) return failure("DEPLOYMENT_CONFLICT", `Active deployment is version ${current.version}; expected ${command.expectedDeploymentVersion}.`);
    if (command.targetRef.artifactId !== command.artifactId) return failure("INVALID_TARGET", "Revert target must use the active artifact identity.");
    const target = registry?.getArtifact(command.targetRef);
    if (!target && !knownRefs.has(refKey(command.targetRef))) return failure("UNKNOWN_ARTIFACT", `Historical exact ref ${refKey(command.targetRef)} is unavailable; refusing to substitute a newer version.`);
    const gameTime = command.gameTime ?? options.logicalTime ?? 0;
    const snapshot = checkpoint();
    try {
      const record = runTransaction(() => {
        options.failureInjector?.("before-commit");
        version += 1;
        const deployment: DeploymentRecord = freeze({ id: `deployment.${command.artifactId}.${version}`, version, artifactId: command.artifactId, ref: command.targetRef, previousRef: current.ref, kind: "REVERT", actor: command.actor ?? "player", transactionId: command.transactionId, gameTime, audit: [`revertFrom=${refKey(current.ref)}`, `restoreExactRef=${refKey(command.targetRef)}`, "historyPreserved=true"] });
        activeByArtifact.set(command.artifactId, freeze({ artifactId: command.artifactId, ref: command.targetRef, deploymentId: deployment.id, version: deployment.version }));
        records.push(deployment);
        knownRefs.add(refKey(command.targetRef));
        options.failureInjector?.("after-active");
        return deployment;
      });
      byTransaction.set(command.transactionId, freeze({ fingerprint, record }));
      return { ok: true as const, value: record };
    } catch (thrown) {
      restore(snapshot);
      return failure("ATOMIC_COMMIT_FAILED", thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  return Object.freeze({
    validate,
    deploy,
    revert,
    resolveActive: (artifactId: string) => {
      const value = activeByArtifact.get(artifactId);
      return value ? freeze(value.ref) : undefined;
    },
    active: () => freeze([...activeByArtifact.values()].sort((a, b) => a.artifactId.localeCompare(b.artifactId))),
    records: () => freeze([...records]),
    checkpoint,
    restore,
  });
}

export const createDeployment = createDeploymentService;
