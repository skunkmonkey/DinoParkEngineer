import assert from "node:assert/strict";
import test from "node:test";

import { createInstructionFoundationFixture } from "../../src/instruction/public.js";
import { runOpeningMaintenanceContextEval } from "../../src/eval-runner/public.js";
import { createReviewDeployment } from "../../src/review-deployment/public.js";
import type { ArtifactCandidate } from "../../src/engineering-workbench/public.js";

const opening = () => {
  const instruction = createInstructionFoundationFixture();
  const candidateArtifact = {
    ...instruction.selfContained,
    reference: { id: instruction.selfContained.reference.id, version: "2.0.0" },
    readableSource: "Check exact maintenance Context before opening the feeding gate.",
    contextCost: 14,
    dependencies: [{ id: "knowledge:gate-maintenance", version: "1.0.0" }],
  };
  const candidate: ArtifactCandidate = {
    id: "candidate:opening-fix", reference: candidateArtifact.reference,
    baseVersion: instruction.selfContained.reference, requestId: "work:opening-fix",
    goal: "Route maintenance Context before feeding", readableSource: candidateArtifact.readableSource,
    clauses: candidateArtifact.clauses, contextRoutes: ["route:gate-maintenance"],
    changeSummary: ["Adds exact maintenance Context dependency."], productionAffected: false,
  };
  const service = createReviewDeployment();
  const opened = service.createChangeRequest({ id: "review:opening-fix", author: "Park Developer Ada", goal: candidate.goal, baseVersion: instruction.selfContained.reference, candidate, baseArtifact: instruction.selfContained, candidateArtifact, createdTick: 10 });
  assert.equal(opened.ok, true);
  return { service, instruction, candidate, candidateArtifact };
};

test("an immutable change request exposes exact diff and never changes production", () => {
  const { service, candidate } = opening();
  const review = service.getReview("review:opening-fix");
  assert.ok(review);
  assert.equal(review?.candidate.productionAffected, false);
  assert.equal(review?.candidateVersion.version, "2.0.0");
  assert.equal(review?.contextDelta.delta, 2);
  assert.equal(review?.dependencyDelta.changes.length, 1);
  assert.equal(review?.diff.readable.length, 1);
  assert.equal(Object.isFrozen(service.snapshot()), true);
  assert.equal(service.getActiveDeployment({ slot: "feeding", scope: "park" }), undefined);
  assert.equal(candidate.productionAffected, false);
});

test("exact Eval evidence stays attached with Trace and replay diagnosis", () => {
  const { service, candidate, candidateArtifact } = opening();
  const result = runOpeningMaintenanceContextEval({ candidate: { reference: candidate.reference, artifactReferences: [candidate.reference], artifacts: [candidateArtifact] } });
  const selected = service.selectEvals({ reviewId: "review:opening-fix", caseReferences: [result.caseReference], tick: 11 });
  assert.equal(selected.ok, true);
  const attached = service.attachEvalResult({ reviewId: "review:opening-fix", result, tick: 12 });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  assert.equal(attached.value.status, result.status);
  assert.equal(attached.value.replay?.traceId, result.replay.traceId);
  assert.equal(attached.value.diagnosisLinks.some((entry) => entry.kind === "trace"), true);
});

test("explicit non-mandatory risk acceptance reaches atomic activation without bypassing mandatory cases", () => {
  const { service, candidate, candidateArtifact } = opening();
  const result = runOpeningMaintenanceContextEval({ candidate: { reference: candidate.reference, artifactReferences: [candidate.reference], artifacts: [candidateArtifact] } });
  service.selectEvals({ reviewId: "review:opening-fix", caseReferences: [result.caseReference], tick: 11 });
  service.attachEvalResult({ reviewId: "review:opening-fix", result, tick: 12 });
  const slot = { slot: "feeding", scope: "park" };
  const confirmation = service.confirmDeployment({ reviewId: "review:opening-fix", actor: "player", tick: 20, slot });
  assert.equal(confirmation.ok, true);
  if (!confirmation.ok) return;
  const decision = service.deploy({ reviewId: "review:opening-fix", kind: "deploy", actor: "player", tick: 20, confirmation: confirmation.value, acceptRisk: true, rationale: { selection: "accepted-risk" } });
  assert.equal(decision.ok, true);
  assert.equal(service.getActiveDeployment(slot)?.rootArtifact.version, "2.0.0");
});

test("deployment is explicit and atomic, old jobs stay pinned, and revert adds history", () => {
  const { service } = opening();
  const slot = { slot: "feeding", scope: "park" };
  const confirmed = service.confirmDeployment({ reviewId: "review:opening-fix", actor: "player", tick: 20, slot });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  const deployed = service.activateDeployment({ commandId: "deployment:opening-fix", confirmation: confirmed.value, tick: 20 });
  assert.equal(deployed.ok, true);
  const oldJob = service.pinJob({ jobId: "job:after-deploy", slot, tick: 21 });
  assert.equal(oldJob.ok, true);

  const second = opening();
  const historical = service.getDeployment("deployment:opening-fix");
  assert.ok(historical);
  const revertConfirmation = second.service.confirmDeployment({ reviewId: "review:opening-fix", actor: "player", tick: 30, slot });
  assert.equal(revertConfirmation.ok, true);
  // The same service keeps causal history; a revert targets its own historical record.
  if (historical !== undefined) {
    const confirmHistorical = service.confirmDeployment({ reviewId: "review:opening-fix", actor: "player", tick: 30, slot, historicalDeploymentId: historical.id });
    assert.equal(confirmHistorical.ok, true);
    if (confirmHistorical.ok) {
      const reverted = service.activateDeployment({ commandId: "deployment:revert-opening", confirmation: confirmHistorical.value, kind: "revert", historicalDeploymentId: historical.id, tick: 30 });
      assert.equal(reverted.ok, true);
      assert.equal(reverted.ok && reverted.value.kind, "revert");
    }
  }
  assert.equal(service.getJobPin("job:after-deploy")?.deploymentId, "deployment:opening-fix");
  assert.equal(service.listDeployments().length, 2);
  assert.equal(service.governanceHistory().some((entry) => entry.kind === "deployment-activated"), true);
});

test("request changes and retain preserve the candidate without hidden activation", () => {
  const { service } = opening();
  const changed = service.requestChanges({ reviewId: "review:opening-fix", kind: "request-changes", actor: "player", tick: 15, feedback: { goal: "Add a degraded-sensor case." } });
  assert.equal(changed.ok, true);
  assert.equal(service.getReview("review:opening-fix")?.candidateId, "candidate:opening-fix");
  assert.equal(service.getActiveDeployment({ slot: "feeding", scope: "park" }), undefined);
});
