import React, { useMemo, useState } from "react";

import { friendlyVersion } from "../player-experience/public.js";
import { createReviewDeploymentFoundationFixture, REVIEW_DEPLOYMENT_FOUNDATION_SLOT } from "./foundation-fixture.js";

export const ReviewDeploymentView = (): React.JSX.Element => {
  const fixture = useMemo(createReviewDeploymentFoundationFixture, []);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Review opened. Candidate creation has not changed production.");
  const [acceptRisk, setAcceptRisk] = useState(false);
  const snapshot = fixture.service.snapshot();
  const review = fixture.service.getReview(fixture.reviewId);
  const active = fixture.service.getActiveDeployment(REVIEW_DEPLOYMENT_FOUNDATION_SLOT);
  const refresh = (message: string): void => { setStatus(message); setRevision((value) => value + 1); };
  void revision;
  if (review === undefined) return <section className="feature-card" role="alert">Review evidence is unavailable. Production remains unchanged.</section>;

  const attachEvidence = (): void => {
    const result = fixture.service.attachEvalResult({ reviewId: fixture.reviewId, result: fixture.result, tick: 12 });
    refresh(result.ok ? `Attached ${result.value.status} Eval evidence with Trace ${result.value.replay?.traceId}.` : result.diagnostics[0]?.message ?? "Evidence attachment failed safely.");
  };
  const deploy = (): void => {
    const confirmation = fixture.service.confirmDeployment({ reviewId: fixture.reviewId, actor: "player", tick: 20, slot: REVIEW_DEPLOYMENT_FOUNDATION_SLOT });
    if (!confirmation.ok) { refresh(confirmation.diagnostics[0]?.message ?? "Confirmation failed safely."); return; }
    const decision = fixture.service.deploy({ reviewId: fixture.reviewId, kind: "deploy", actor: "player", tick: 20, confirmation: confirmation.value, acceptRisk, rationale: acceptRisk ? { selection: "accepted-risk" } : { selection: "evidence-sufficient" } });
    refresh(decision.ok ? `Deployed ${friendlyVersion(`${review.candidateVersion.id}@${review.candidateVersion.version}`)}. Only future jobs use the new manifest.` : decision.diagnostics[0]?.message ?? "Deployment failed closed.");
  };
  const requestChanges = (): void => {
    const result = fixture.service.requestChanges({ reviewId: fixture.reviewId, kind: "request-changes", actor: "player", tick: 15, feedback: { goal: "Add degraded sensor evidence before deployment." } });
    refresh(result.ok ? "Changes requested. The reviewed candidate and production deployment were preserved." : result.diagnostics[0]?.message ?? "Feedback failed safely.");
  };
  const retain = (): void => {
    const result = fixture.service.retainProduction({ reviewId: fixture.reviewId, kind: "retain", actor: "player", tick: 16 });
    refresh(result.ok ? "Current production retained. No hidden deployment occurred." : result.diagnostics[0]?.message ?? "Retain decision failed safely.");
  };
  const revert = (): void => {
    const deployment = fixture.service.getActiveDeployment(REVIEW_DEPLOYMENT_FOUNDATION_SLOT);
    if (deployment === undefined) { refresh("No deployed historical manifest is available to revert."); return; }
    const confirmation = fixture.service.confirmDeployment({ reviewId: fixture.reviewId, actor: "player", tick: 30, slot: REVIEW_DEPLOYMENT_FOUNDATION_SLOT, historicalDeploymentId: deployment.id });
    if (!confirmation.ok) { refresh(confirmation.diagnostics[0]?.message ?? "Revert confirmation failed safely."); return; }
    const result = fixture.service.revert({ reviewId: fixture.reviewId, kind: "revert", actor: "player", tick: 30, confirmation: confirmation.value, historicalDeploymentId: deployment.id });
    refresh(result.ok ? `Revert recorded as new deployment ${result.value.deploymentId}. History was not rewritten.` : result.diagnostics[0]?.message ?? "Revert failed safely.");
  };

  return <section className="feature-card review-experience" aria-labelledby="review-deployment-heading">
    <p className="eyebrow">Review / Deployment · Production paused</p>
    <h2 id="review-deployment-heading">Opening maintenance Context fix</h2>
    <dl className="status-grid" aria-label="Park status">
      <div><dt>Production</dt><dd>Paused at dawn · tick 10</dd></div><div><dt>Rating</dt><dd>100</dd></div>
      <div><dt>Credits</dt><dd>100</dd></div><div><dt>Emergencies</dt><dd>1 grouped near miss</dd></div>
      <div><dt>Selected version</dt><dd>{friendlyVersion(`${review.candidateVersion.id}@${review.candidateVersion.version}`)}</dd></div>
      <div><dt>Origin</dt><dd><a href="/park?incident=incident%3Aopening-near-miss">North Paddock incident</a></dd></div>
    </dl>
    <p><strong>Goal:</strong> {review.goal}</p><p><strong>Author:</strong> {review.author}</p><p><strong>Expected effect:</strong> {review.expectedEffect}</p>
    <details open><summary><strong>Review change</strong></summary><section aria-labelledby="review-diff-heading"><h3 id="review-diff-heading">Readable and behavioral diff</h3>
      <p><strong>Readable source:</strong> {review.diff.readable.length} changed section (non-executable).</p>
      <p><strong>Behavioral clauses:</strong> {review.diff.behavioral.length} changed section.</p>
      <p><strong>Context delta:</strong> {review.contextDelta.baseCost} → {review.contextDelta.candidateCost} units ({review.contextDelta.delta >= 0 ? "+" : ""}{review.contextDelta.delta}).</p>
      <p><strong>Dependency delta:</strong> {review.dependencyDelta.changes.map((entry) => entry.summary === "dependency added: knowledge:gate-maintenance@1.0.0" ? `${friendlyVersion("knowledge:gate-maintenance@1.0.0")} added` : entry.summary).join("; ") || "none"}</p>
      <p><strong>Tool delta:</strong> {review.toolDelta.changes.map((entry) => entry.summary).join("; ") || "none"}</p>
      <details><summary>Inspect exact immutable candidate</summary><pre>{JSON.stringify(review.candidateSnapshot, null, 2)}</pre></details>
    </section></details>
    <details><summary><strong>Inspect Eval evidence</strong></summary><section aria-labelledby="review-evidence-heading"><h3 id="review-evidence-heading">Executed Eval evidence</h3>
      <p>Evidence states remain explicit: passed, failed, invalid, timed out, interrupted, or omitted. No confidence score is invented.</p>
      <ul>{review.evidence.length === 0 ? <li>Selected opening Eval has no attached result yet.</li> : review.evidence.map((entry) => <li key={entry.id}><strong>{entry.status}</strong> · <code>{entry.caseReference.id}@{entry.caseReference.version}</code> · Trace <code>{entry.replay?.traceId ?? "unavailable"}</code></li>)}</ul>
      <label><input type="checkbox" checked={acceptRisk} onChange={(event) => setAcceptRisk(event.currentTarget.checked)} /> I explicitly accept non-mandatory failed, interrupted, or omitted evidence for this deployment.</label>
    </section></details>
    <div className="button-row" role="group" aria-label="Review decisions">
      <button type="button" onClick={attachEvidence}>Attach executed Eval</button><button type="button" onClick={requestChanges}>Request changes</button>
      <button type="button" onClick={retain}>Retain production</button><button type="button" onClick={deploy}>Confirm and deploy reviewed version</button><button type="button" onClick={revert}>Revert with new deployment</button>
    </div>
    <p role="status" aria-live="polite">{status}</p>
    <p><strong>Active production:</strong> {active === undefined ? "unchanged" : friendlyVersion(`${active.rootArtifact.id}@${active.rootArtifact.version}`)}</p>
    <details><summary>Governance history ({snapshot.history.length})</summary><ol>{snapshot.history.map((entry) => <li key={entry.id}>{entry.summary}</li>)}</ol></details>
  </section>;
};
