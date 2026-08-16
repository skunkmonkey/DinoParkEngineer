import assert from "node:assert/strict";
import test from "node:test";
import { createContentRegistry } from "../content-registry/index.ts";
import { createContextService } from "../context/index.ts";
import { createMvpEvalContentPack, createEvalService } from "../eval-runner/index.ts";
import { createAuthoritativeActiveRefResolver, createDefaultFeedingJobDraft, createOperationsContentPack, createParkOperationsService } from "../park-operations/index.ts";
import { createReviewDemoContentPack, createReviewDeploymentService } from "../review-deployment/index.ts";

function setup() {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(createMvpEvalContentPack()).ok, true);
  assert.equal(registry.loadPack(createReviewDemoContentPack()).ok, true);
  const evals = createEvalService({ registry });
  const runtime = createReviewDeploymentService({
    registry,
    context: createContextService(),
    evals,
    jobProfiles: [{ id: "feeding", agentId: "keeper", jobId: "feed", budget: 8_000, toolIds: ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"], applicabilityTags: ["task:feeding", "safety:standard"] }],
    initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }],
  });
  return { registry, evals, runtime };
}

function proposal(id: string) {
  return {
    id,
    baseRef: { artifactId: "review.skill.carnivore-feeding", version: 3 },
    proposedRef: { artifactId: "review.skill.carnivore-feeding", version: 4 },
    author: "test-player",
    goal: "Secure Rex containment after feeding.",
    createdAtGameTime: 4,
  } as const;
}

test("review slice 1 exposes exact source/clause/dependency/tool/context impact", () => {
  const { runtime } = setup();
  const submitted = runtime.reviews.submit(proposal("review.slice1"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const analysis = runtime.reviews.analyze(submitted.value.reviewId);
  assert.equal(analysis.baseRef?.version, 3);
  assert.equal(analysis.proposedRef.version, 4);
  assert.ok(analysis.sourceDiff.some((line) => line.kind === "ADDED"));
  assert.ok(analysis.clauseDiff.some((line) => line.kind === "ADDED"));
  assert.ok(analysis.dependencies.added.includes("curriculum.prompt.standard-feeding@1"));
  assert.ok(Array.isArray(analysis.transitiveUsedBy.added));
  assert.ok(analysis.tools.unchanged.includes("close_gate"));
  assert.equal(analysis.contextProfiles.length, 1);
  assert.equal(analysis.contextProfiles[0]?.reconciled, true);
});

test("review slice 2 associates exact eval results and invalidates them on revision", async () => {
  const { evals, runtime } = setup();
  const submitted = runtime.reviews.submit(proposal("review.slice2"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.dinosaur-blocks-gate", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.dinosaur-blocks-gate", version: 1 }, "review.slice2.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.dinosaur-blocks-gate", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.slice2.run" });
  assert.equal(run.results[0]?.status, "FAILED");
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  assert.equal(attached.value.state, "READY");
  const revised = runtime.reviews.requestRevision({ reviewId: submitted.value.reviewId, expectedReviewVersion: attached.value.version, reasonCode: "FAILED_ASSERTION", reason: "Add an explicit visitor-buffer guard." });
  assert.equal(revised.ok, true);
  if (!revised.ok) return;
  assert.equal(revised.value.revision, 2);
  assert.equal(revised.value.staleEvalResultIds.length, 1);
  assert.equal(revised.value.evalAssociations[0]?.status, "STALE");
  assert.ok(revised.value.staleEvalResultIds.includes(run.results[0]!.id));
  const reselected = runtime.reviews.selectEvals({ reviewId: revised.value.reviewId, expectedReviewVersion: revised.value.version, evalRefs: [{ id: "eval.dinosaur-blocks-gate", version: 1 }] });
  assert.equal(reselected.ok, true);
  if (!reselected.ok) return;
  const reused = runtime.reviews.attachRun({ reviewId: revised.value.reviewId, expectedReviewVersion: reselected.value.version, results: run.results });
  assert.equal(reused.ok, true);
  if (!reused.ok) return;
  assert.equal(reused.value.state, "EVALS_RUNNING");
  assert.equal(reused.value.evalAssociations.length, 2);
  assert.equal(reused.value.evalAssociations.at(-1)?.status, "STALE");
});

test("review slice 3 blocks context overflow but warns for failed eval risk", () => {
  const { registry, evals } = setup();
  const runtime = createReviewDeploymentService({ registry, evals, context: createContextService(), jobProfiles: [{ id: "too-small", agentId: "keeper", jobId: "feed", budget: 1, toolIds: ["move_to"] }], initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }] });
  const submitted = runtime.reviews.submit(proposal("review.slice3"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const blocked = runtime.deployments.validate(submitted.value.reviewId);
  assert.equal(blocked.valid, false);
  assert.ok(blocked.hardGates.some((item) => item.code === "CONTEXT_OVERFLOW"));
  assert.ok(blocked.hardGates.some((item) => item.code === "REVIEW_NOT_READY"));
});

test("review completion gate performs v3 to v4, failed eval, revision, passing rerun, deploy, and auditable revert", async () => {
  const { evals, runtime } = setup();
  const submitted = runtime.reviews.submit(proposal("review.completion"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const failedSelection = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.dinosaur-blocks-gate", version: 1 }] });
  assert.equal(failedSelection.ok, true);
  if (!failedSelection.ok) return;
  assert.equal(evals.build({ id: "eval.dinosaur-blocks-gate", version: 1 }, "review.completion.failed.build").ok, true);
  const failedRun = await evals.run({ evalRefs: [{ id: "eval.dinosaur-blocks-gate", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.completion.failed.run" });
  assert.equal(failedRun.results[0]?.status, "FAILED", JSON.stringify(failedRun.results[0]));
  const failedAttached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: failedSelection.value.version, results: failedRun.results });
  assert.equal(failedAttached.ok, true);
  if (!failedAttached.ok) return;
  const failedAssessment = runtime.deployments.validate(submitted.value.reviewId);
  assert.equal(failedAssessment.valid, true);
  assert.ok(failedAssessment.warnings.some((item) => item.code === "EVAL_FAILURE"));
  const revised = runtime.reviews.requestRevision({ reviewId: submitted.value.reviewId, expectedReviewVersion: failedAttached.value.version, reasonCode: "FAILED_ASSERTION", reason: "Add an explicit containment guard after feeding." });
  assert.equal(revised.ok, true);
  if (!revised.ok) return;
  assert.equal(revised.value.revision, 2);
  assert.equal(revised.value.evalAssociations[0]?.status, "STALE");
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: revised.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.completion.passing.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: revised.value.proposedRef }, transactionId: "review.completion.passing.run" });
  assert.equal(run.results[0]?.status, "PASSED", JSON.stringify(run.results[0]));
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const assessment = runtime.deployments.validate(submitted.value.reviewId);
  assert.equal(assessment.valid, true);
  if (assessment.warnings.length > 0) {
    const missingAcknowledgement = runtime.deployments.deploy({ reviewId: submitted.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: [], transactionId: "review.completion.missing-warning-ack" });
    assert.equal(missingAcknowledgement.ok, false);
    if (!missingAcknowledgement.ok) assert.equal(missingAcknowledgement.error.code, "WARNING_ACK_REQUIRED");
  }
  const deployed = runtime.deployments.deploy({ reviewId: submitted.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.completion.deploy" });
  assert.equal(deployed.ok, true);
  assert.deepEqual(runtime.deployments.resolveActive("review.skill.carnivore-feeding"), { artifactId: "review.skill.carnivore-feeding", version: 4 });
  const reverted = runtime.deployments.revert({ artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, expectedDeploymentVersion: deployed.ok ? deployed.value.version : -1, transactionId: "review.completion.revert" });
  assert.equal(reverted.ok, true);
  assert.deepEqual(runtime.deployments.resolveActive("review.skill.carnivore-feeding"), { artifactId: "review.skill.carnivore-feeding", version: 3 });
  assert.equal(runtime.deployments.records().length, 2);
});

test("QA: transaction ids are bound to command kind and canonical payload", async () => {
  const { evals, runtime } = setup();
  const failedFirstUse = runtime.deployments.deploy({ reviewId: "missing", expectedReviewVersion: 1, acknowledgeWarningCodes: [], transactionId: "review.idempotency.failed-binding" });
  assert.equal(failedFirstUse.ok, false);
  const changedAfterFailure = runtime.deployments.revert({ artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, expectedDeploymentVersion: 0, transactionId: "review.idempotency.failed-binding" });
  assert.equal(changedAfterFailure.ok, false);
  if (!changedAfterFailure.ok) assert.equal(changedAfterFailure.error.code, "IDEMPOTENCY_CONFLICT");
  const submitted = runtime.reviews.submit(proposal("review.idempotency"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.idempotency.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.idempotency.run" });
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const assessment = runtime.deployments.validate(attached.value.reviewId);
  const command = { reviewId: attached.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.idempotency.shared" } as const;
  const deployed = runtime.deployments.deploy(command);
  assert.equal(deployed.ok, true);
  if (!deployed.ok) return;
  const exactRetry = runtime.deployments.deploy(command);
  assert.equal(exactRetry.ok, true);
  if (exactRetry.ok) assert.equal(exactRetry.value.id, deployed.value.id);
  const changedPayload = runtime.deployments.deploy({ ...command, acknowledgeWarningCodes: [...command.acknowledgeWarningCodes, "DIFFERENT"] });
  assert.equal(changedPayload.ok, false);
  if (!changedPayload.ok) assert.equal(changedPayload.error.code, "IDEMPOTENCY_CONFLICT");
  const crossKind = runtime.deployments.revert({ artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, expectedDeploymentVersion: deployed.value.version, transactionId: command.transactionId });
  assert.equal(crossKind.ok, false);
  if (!crossKind.ok) assert.equal(crossKind.error.code, "IDEMPOTENCY_CONFLICT");
  const revertCommand = { artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, expectedDeploymentVersion: deployed.value.version, transactionId: "review.idempotency.revert" } as const;
  const reverted = runtime.deployments.revert(revertCommand);
  assert.equal(reverted.ok, true);
  if (!reverted.ok) return;
  const revertRetry = runtime.deployments.revert(revertCommand);
  assert.equal(revertRetry.ok, true);
  if (revertRetry.ok) assert.equal(revertRetry.value.id, reverted.value.id);
  const changedRevert = runtime.deployments.revert({ ...revertCommand, targetRef: proposal("x").proposedRef });
  assert.equal(changedRevert.ok, false);
  if (!changedRevert.ok) assert.equal(changedRevert.error.code, "IDEMPOTENCY_CONFLICT");
});

test("review slice 5 rejects optimistic races and leaves active refs unchanged on atomic failure", async () => {
  const { registry, evals } = setup();
  let fail = true;
  const runtime = createReviewDeploymentService({ registry, evals, initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }], deployment: { failureInjector: (point) => { if (fail && point === "after-active") throw new Error("injected transaction failure after active write"); } } });
  const submitted = runtime.reviews.submit(proposal("review.atomic"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.atomic.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.atomic.run" });
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const assessment = runtime.deployments.validate(submitted.value.reviewId);
  const failed = runtime.deployments.deploy({ reviewId: submitted.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.atomic.deploy.failed" });
  assert.equal(failed.ok, false);
  assert.equal(registry.getArtifact(proposal("x").baseRef)?.status, "DEPLOYED");
  assert.equal(registry.getArtifact(proposal("x").proposedRef)?.status, "REVIEW");
  assert.equal(runtime.reviews.get(attached.value.reviewId)?.state, "READY");
  assert.deepEqual(runtime.deployments.resolveActive("review.skill.carnivore-feeding"), { artifactId: "review.skill.carnivore-feeding", version: 3 });
  assert.equal(runtime.deployments.records().length, 0);
  fail = false;
  const race = runtime.deployments.deploy({ reviewId: submitted.value.reviewId, expectedReviewVersion: attached.value.version - 1, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.atomic.deploy.race" });
  assert.equal(race.ok, false);
  if (!race.ok) assert.equal(race.error.code, "REVIEW_VERSION_CONFLICT");
  const deployed = runtime.deployments.deploy({ reviewId: submitted.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.atomic.deploy.success" });
  assert.equal(deployed.ok, true);
});

test("QA: adapter failure after work rolls back registry, review, active mapping, and audit", async () => {
  const { registry, evals } = setup();
  const runtime = createReviewDeploymentService({
    registry,
    evals,
    initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }],
    deployment: { transaction: { run: (work) => { work(); throw new Error("adapter failed after work"); } } },
  });
  const submitted = runtime.reviews.submit(proposal("review.adapter-rollback"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.adapter-rollback.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.adapter-rollback.run" });
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const assessment = runtime.deployments.validate(attached.value.reviewId);
  const failed = runtime.deployments.deploy({ reviewId: attached.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.adapter-rollback.deploy" });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, "ATOMIC_COMMIT_FAILED");
  assert.equal(registry.getArtifact(proposal("x").baseRef)?.status, "DEPLOYED");
  assert.equal(registry.getArtifact(proposal("x").proposedRef)?.status, "REVIEW");
  assert.equal(runtime.reviews.get(attached.value.reviewId)?.state, "READY");
  assert.equal(runtime.reviews.get(attached.value.reviewId)?.version, attached.value.version);
  assert.deepEqual(runtime.deployments.resolveActive("review.skill.carnivore-feeding"), proposal("x").baseRef);
  assert.equal(runtime.deployments.records().length, 0);
});

test("QA: adapter failure after revert work restores the deployed ref and audit history", async () => {
  const { registry, evals } = setup();
  let failAfterWork = false;
  const runtime = createReviewDeploymentService({
    registry,
    evals,
    initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }],
    deployment: { transaction: { run: (work) => { const value = work(); if (failAfterWork) throw new Error("revert adapter failed after work"); return value; } } },
  });
  const submitted = runtime.reviews.submit(proposal("review.revert-rollback"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.revert-rollback.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.revert-rollback.run" });
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const assessment = runtime.deployments.validate(attached.value.reviewId);
  const deployed = runtime.deployments.deploy({ reviewId: attached.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.revert-rollback.deploy" });
  assert.equal(deployed.ok, true);
  if (!deployed.ok) return;
  failAfterWork = true;
  const reverted = runtime.deployments.revert({ artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, expectedDeploymentVersion: deployed.value.version, transactionId: "review.revert-rollback.revert" });
  assert.equal(reverted.ok, false);
  if (!reverted.ok) assert.equal(reverted.error.code, "ATOMIC_COMMIT_FAILED");
  assert.deepEqual(runtime.deployments.resolveActive("review.skill.carnivore-feeding"), proposal("x").proposedRef);
  assert.equal(runtime.deployments.records().length, 1);
  assert.equal(runtime.deployments.records()[0]?.kind, "DEPLOY");
});

test("QA: deployed and closed reviews cannot be reopened by eval attachment or revision", async () => {
  const { evals, runtime } = setup();
  const submitted = runtime.reviews.submit(proposal("review.terminal-state"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.terminal-state.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.terminal-state.run" });
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const deployed = runtime.reviews.transition(attached.value.reviewId, "DEPLOYED", attached.value.version);
  assert.equal(deployed.ok, true);
  if (!deployed.ok) return;
  const attachAfterDeploy = runtime.reviews.attachRun({ reviewId: deployed.value.reviewId, expectedReviewVersion: deployed.value.version, results: run.results });
  assert.equal(attachAfterDeploy.ok, false);
  if (!attachAfterDeploy.ok) assert.equal(attachAfterDeploy.error.code, "INVALID_STATE");
  const reviseAfterDeploy = runtime.reviews.requestRevision({ reviewId: deployed.value.reviewId, expectedReviewVersion: deployed.value.version, reasonCode: "LATE", reason: "Must not reopen deployment." });
  assert.equal(reviseAfterDeploy.ok, false);
  if (!reviseAfterDeploy.ok) assert.equal(reviseAfterDeploy.error.code, "INVALID_STATE");
  const closed = runtime.reviews.transition(deployed.value.reviewId, "CLOSED", deployed.value.version);
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(runtime.reviews.attachRun({ reviewId: closed.value.reviewId, expectedReviewVersion: closed.value.version, results: run.results }).ok, false);
  assert.equal(runtime.reviews.requestRevision({ reviewId: closed.value.reviewId, expectedReviewVersion: closed.value.version, reasonCode: "LATE", reason: "Must remain closed." }).ok, false);
  assert.equal(runtime.reviews.get(closed.value.reviewId)?.state, "CLOSED");
});

test("QA: revert requires an exact observed deployment version", () => {
  const { runtime } = setup();
  const missing = runtime.deployments.revert({ artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, transactionId: "review.revert.missing-version" } as never);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "DEPLOYMENT_CONFLICT");
  const stale = runtime.deployments.revert({ artifactId: "review.skill.carnivore-feeding", targetRef: proposal("x").baseRef, expectedDeploymentVersion: 99, transactionId: "review.revert.stale-version" });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "DEPLOYMENT_CONFLICT");
});

test("QA: Park job intake resolves the public active exact ref while existing jobs stay pinned", async () => {
  const { registry, evals, runtime } = setup();
  assert.equal(registry.loadPack(createOperationsContentPack()).ok, true);
  const operations = createParkOperationsService({ content: registry, resolveActiveRef: createAuthoritativeActiveRefResolver(runtime.deployments.resolveActive) });
  const initialView = operations.getPark();
  const draft = createDefaultFeedingJobDraft({ targetRef: "dino.rex", agentId: "agent.keeper01", priority: 5, logicalTime: initialView.snapshot.logicalTime, expectedParkVersion: initialView.version, useSafeSkill: true, useSystemPrompt: true });
  const before = operations.create(draft, "review.future-only.before");
  assert.equal(before.ok, true, before.ok ? undefined : before.error.message);
  if (!before.ok) return;
  assert.equal(before.job.skillRefs[0]?.version, 3);

  const submitted = runtime.reviews.submit(proposal("review.future-only"));
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const selected = runtime.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [{ id: "eval.standard-feeding", version: 1 }] });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(evals.build({ id: "eval.standard-feeding", version: 1 }, "review.future-only.build").ok, true);
  const run = await evals.run({ evalRefs: [{ id: "eval.standard-feeding", version: 1 }], subject: { type: "PROMPT", ref: proposal("x").proposedRef }, transactionId: "review.future-only.run" });
  const attached = runtime.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: run.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  const assessment = runtime.deployments.validate(attached.value.reviewId);
  const deployed = runtime.deployments.deploy({ reviewId: attached.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((item) => item.code), transactionId: "review.future-only.deploy" });
  assert.equal(deployed.ok, true);

  const nextView = operations.getPark();
  const afterDraft = createDefaultFeedingJobDraft({ targetRef: "dino.rex", agentId: "agent.keeper01", priority: 5, logicalTime: nextView.snapshot.logicalTime, expectedParkVersion: nextView.version, useSafeSkill: true, useSystemPrompt: true });
  const after = operations.create(afterDraft, "review.future-only.after");
  assert.equal(after.ok, true, after.ok ? undefined : after.error.message);
  if (!after.ok) return;
  assert.equal(before.job.skillRefs[0]?.version, 3);
  assert.equal(after.job.skillRefs[0]?.version, 4);
});
