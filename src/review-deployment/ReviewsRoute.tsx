"use client";

import { useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { Panel, StatusBadge, Tabs, TabPanel } from "../platform/public.ts";
import type { EvalRef } from "../../eval-runner/index.ts";
import { evalRefKey } from "../../eval-runner/index.ts";
import { getActiveEvalService } from "../eval-runner/public.ts";
import { getActiveTraceReplayRuntime } from "../trace-replay/public.ts";
import { getActiveReviewDeploymentRuntime } from "./runtime.ts";
import type { ChangeAnalysis, ReviewRecord } from "../../review-deployment/index.ts";
import { getActivePersistenceRuntime } from "../persistence/public.ts";

function refLabel(ref: { readonly artifactId: string; readonly version: number }): string {
  return `${ref.artifactId}@${ref.version}`;
}

function resultTone(state: ReviewRecord["state"]): "success" | "warning" | "pending" | "neutral" {
  if (state === "DEPLOYED" || state === "READY") return "success";
  if (state === "CHANGES_REQUESTED") return "warning";
  if (state === "EVALS_RUNNING") return "pending";
  return "neutral";
}

function diffLineClass(kind: string): string {
  return kind === "ADDED" ? "review-diff--added" : kind === "REMOVED" ? "review-diff--removed" : "";
}

function blockLabel(value: ChangeAnalysis["contextProfiles"][number]["proposed"]): string {
  if (!value) return "unavailable";
  return "blocked" in value && value.blocked ? `blocked · ${value.code}` : `${value.totalLoad} CU`;
}

export function ReviewsRoute({ navigate }: ShellRouteProps) {
  const runtime = getActiveReviewDeploymentRuntime();
  const evals = getActiveEvalService();
  const traceRuntime = getActiveTraceReplayRuntime();
  const persistence = getActivePersistenceRuntime();
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("Create a review to inspect exact refs, context impact, eval evidence, and deployment risk.");
  const [tab, setTab] = useState("source");
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [suiteId, setSuiteId] = useState("feeding-review-suite");
  const [suiteTitle, setSuiteTitle] = useState("Feeding review suite");
  const [replayMessage, setReplayMessage] = useState("");
  const [warningAcknowledgement, setWarningAcknowledgement] = useState<{ readonly reviewId: string; readonly reviewVersion: number; readonly codes: readonly string[] }>({ reviewId: "", reviewVersion: 0, codes: [] });

  const reviews = runtime?.reviews.list() ?? [];
  const selected = reviews.find((review) => review.reviewId === selectedId) ?? reviews[0];
  const analysis = selected && runtime ? runtime.reviews.analyze(selected.reviewId) : undefined;
  const catalog = evals?.catalog() ?? [];
  const suites = evals?.suites() ?? [];
  const active = selected && runtime ? runtime.deployments.active().find((item) => item.artifactId === selected.artifactId) : undefined;
  const lastDeployment = selected && active && runtime
    ? [...runtime.deployments.records()].reverse().find((record) => record.artifactId === selected.artifactId && record.ref.artifactId === active.ref.artifactId && record.ref.version === active.ref.version)
    : undefined;
  const previousExactRef = lastDeployment?.previousRef;
  const selectedEvalKeys = new Set(selected?.evalSelection.map(evalRefKey) ?? []);
  const runPreview = evals && selected ? evals.preview({ evalRefs: selected.evalSelection }) : undefined;
  const acknowledgedWarningCodes = selected && warningAcknowledgement.reviewId === selected.reviewId && warningAcknowledgement.reviewVersion === selected.version
    ? warningAcknowledgement.codes
    : [];

  if (!runtime) return <Panel eyebrow="Reviews" title="Review service unavailable"><p>The review/deployment provider has not initialized. Reload after feature providers are ready.</p></Panel>;

  const refresh = () => setRevision((value) => value + 1);
  const createDemo = () => {
    const outcome = runtime.reviews.submit({
      id: `review.demo.${reviews.length + 1}`,
      baseRef: { artifactId: "review.skill.carnivore-feeding", version: 3 },
      proposedRef: { artifactId: "review.skill.carnivore-feeding", version: 4 },
      author: "Park Developer",
      goal: "Close and verify the containment gate after feeding Rex.",
      createdAtGameTime: 4,
    });
    if (outcome.ok) {
      setSelectedId(outcome.value.reviewId);
      setMessage("Review opened. Start with the source diff, then select and run exact evals before deployment.");
    } else setMessage(outcome.error.message);
    refresh();
  };
  const toggleEval = (ref: EvalRef) => {
    if (!selected) return;
    const next = selectedEvalKeys.has(evalRefKey(ref)) ? selected.evalSelection.filter((item) => evalRefKey(item) !== evalRefKey(ref)) : [...selected.evalSelection, ref];
    if (next.length === 0) {
      setMessage("Select at least one eval; risk-based coverage is a review decision.");
      return;
    }
    const outcome = runtime.reviews.selectEvals({ reviewId: selected.reviewId, expectedReviewVersion: selected.version, evalRefs: next });
    setMessage(outcome.ok ? `Selected ${next.length} exact eval ref(s). Build unbuilt cases, then run them against ${refLabel(selected.proposedRef)}.` : outcome.error.message);
    refresh();
  };
  const buildEval = (ref: EvalRef) => {
    if (!evals) return;
    const outcome = evals.build(ref, `review.build.${evalRefKey(ref)}`);
    setMessage(outcome.ok ? `Built ${evalRefKey(ref)} atomically. The immutable fixture and assertions are now runnable.` : outcome.error.message);
    refresh();
  };
  const chooseSuite = (id: string) => {
    setSelectedSuiteId(id);
    if (!selected || !id) return;
    const outcome = runtime.reviews.selectEvals({ reviewId: selected.reviewId, expectedReviewVersion: selected.version, suiteId: id });
    setMessage(outcome.ok ? `Selected exact suite ${id}; its saved case refs now gate this review.` : outcome.error.message);
    refresh();
  };
  const saveSuite = () => {
    if (!selected || !evals) return;
    const outcome = selectedSuiteId
      ? evals.updateSuite(selectedSuiteId, { title: suiteTitle, evalRefs: selected.evalSelection })
      : evals.createSuite({ id: suiteId, title: suiteTitle, evalRefs: selected.evalSelection });
    setMessage(outcome.ok ? `Saved ${outcome.value.title} v${outcome.value.version} with ${outcome.value.evalRefs.length} exact case ref(s).` : outcome.errors.map((item) => item.message).join(" "));
    if (outcome.ok) setSelectedSuiteId(outcome.value.id);
    refresh();
  };
  const runEvals = async () => {
    if (!selected || !evals || selected.evalSelection.length === 0) return;
    const expectedVersion = selected.version;
    if (runPreview?.errors.length) {
      setMessage(runPreview.errors.map((item) => item.message).join(" "));
      return;
    }
    setMessage(`Confirmed ${runPreview?.totalRunCostCredits ?? 0} credits. Running ${selected.evalSelection.length} eval(s) in isolated runtimes against ${refLabel(selected.proposedRef)}…`);
    // The deterministic instruction entry point is a pinned promptRef. The
    // exact proposed Skill remains the subject ref and its dependency graph is
    // still what the isolated runtime evaluates.
    const transactionId = `review.run.${selected.reviewId}.${selected.revision}.${revision}`;
    const coordinated = persistence?.workflows ? await persistence.workflows.eval(transactionId, () => evals.run({ evalRefs: selected.evalSelection, subject: { type: "PROMPT", ref: selected.proposedRef }, transactionId })) : undefined;
    if (coordinated && !coordinated.ok) { setMessage(coordinated.error?.message ?? "Review eval transaction failed."); return; }
    const result = coordinated?.value ?? await evals.run({ evalRefs: selected.evalSelection, subject: { type: "PROMPT", ref: selected.proposedRef }, transactionId });
    const attached = runtime.reviews.attachRun({ reviewId: selected.reviewId, expectedReviewVersion: expectedVersion, results: result.results });
    setMessage(attached.ok ? `${result.results.length} isolated eval(s) attached. ${result.results.some((item) => item.status !== "PASSED") ? "Inspect the failed assertion evidence, then request a revision." : "All selected assertions pass; deployment is now available."}` : attached.error.message);
    refresh();
  };
  const requestRevision = () => {
    if (!selected) return;
    const outcome = runtime.reviews.requestRevision({ reviewId: selected.reviewId, expectedReviewVersion: selected.version, reasonCode: "MISSING_POSTCONDITION", reason: "Add or reconcile the containment postcondition shown by the failed eval trace.", proposedRef: selected.proposedRef });
    setMessage(outcome.ok ? `Revision ${outcome.value.revision} created. Previous eval results remain historical but are marked stale; rerun against ${refLabel(outcome.value.proposedRef)}.` : outcome.error.message);
    refresh();
  };
  const deploy = async () => {
    if (!selected) return;
    const assessment = runtime.deployments.validate(selected.reviewId);
    if (!assessment.valid) {
      setMessage(`Deployment hard gate: ${assessment.hardGates.map((item) => item.message).join(" ")}`);
      refresh();
      return;
    }
    const requiredWarningCodes = assessment.warnings.filter((item) => item.acknowledgementRequired).map((item) => item.code);
    const missingAcknowledgements = requiredWarningCodes.filter((code) => !acknowledgedWarningCodes.includes(code));
    if (missingAcknowledgements.length > 0) {
      setMessage(`Acknowledge each deployment warning before activation: ${missingAcknowledgements.join(", ")}.`);
      refresh();
      return;
    }
    const transactionId = `review.deploy.${selected.reviewId}.${selected.revision}.${revision}`;
    const command = { reviewId: selected.reviewId, expectedReviewVersion: selected.version, acknowledgeWarningCodes: acknowledgedWarningCodes, transactionId };
    const coordinated = persistence?.workflows ? await persistence.workflows.deploy(transactionId, () => { const result = runtime.deployments.deploy(command); if (!result.ok) throw new Error(result.error.message); return result; }) : undefined;
    if (coordinated && (!coordinated.ok || !coordinated.value)) { setMessage(coordinated.error?.message ?? "Deployment transaction failed."); return; }
    const outcome = coordinated?.value ?? runtime.deployments.deploy(command);
    setMessage(outcome.ok ? `Deployed exact ${refLabel(outcome.value.ref)}. Running and historical jobs retain their pinned refs; future jobs resolve the new active ref.` : outcome.error.message);
    refresh();
  };
  const revert = async () => {
    if (!selected || !active || !previousExactRef) return;
    const transactionId = `review.revert.${selected.artifactId}.${revision}`;
    const command = { artifactId: selected.artifactId, targetRef: previousExactRef, expectedDeploymentVersion: active.version, transactionId };
    const coordinated = persistence?.workflows ? await persistence.workflows.deploy(transactionId, () => { const result = runtime.deployments.revert(command); if (!result.ok) throw new Error(result.error.message); return result; }) : undefined;
    if (coordinated && (!coordinated.ok || !coordinated.value)) { setMessage(coordinated.error?.message ?? "Revert transaction failed."); return; }
    const outcome = coordinated?.value ?? runtime.deployments.revert(command);
    setMessage(outcome.ok ? `Reverted through a new auditable deployment record to exact ${refLabel(outcome.value.ref)}. History was preserved.` : outcome.error.message);
    refresh();
  };

  return (
    <main className="foundation-page" data-revision={revision}>
      <header className="foundation-page__header">
        <div><p className="foundation-eyebrow">Engineering change control</p><h1>Reviews / Deploy</h1><p>Inspect source and behavior, run exact evals in isolation, request revision, then activate or revert an immutable version intentionally.</p></div>
        <button type="button" onClick={createDemo}>Open v3 → v4 feeding review</button>
      </header>
      <p role="status" aria-live="polite">{message}</p>

      <Panel eyebrow="Review queue" title={`${reviews.length} immutable review${reviews.length === 1 ? "" : "s"}`}>
        {reviews.length === 0 ? <p>No proposals yet. Open the v3 → v4 demo review to exercise the complete workflow.</p> : <div role="list" aria-label="Review proposals">{reviews.map((review) => <div key={review.reviewId} role="listitem"><button type="button" className={selected?.reviewId === review.reviewId ? "is-active" : ""} onClick={() => setSelectedId(review.reviewId)}><strong>{review.goal}</strong><span>{refLabel(review.baseRef)} → {refLabel(review.proposedRef)}</span><StatusBadge label={`${review.state} · r${review.revision} · v${review.version}`} status={resultTone(review.state)} /></button></div>)}</div>}
      </Panel>

      {selected && analysis ? <>
        <Panel eyebrow="Review record" title={`${refLabel(selected.baseRef)} → ${refLabel(selected.proposedRef)}`}>
          <p><StatusBadge label={selected.state} status={resultTone(selected.state)} /> <span>Author: {selected.author}</span> · Goal: {selected.goal}</p>
          <p>Exact refs are pinned. Revision {selected.revision} has {selected.staleEvalResultIds.length} historical result(s) invalidated after proposal changes.</p>
          <p><button type="button" onClick={requestRevision} disabled={selected.state === "DEPLOYED" || selected.state === "CLOSED"}>Request revision from failed evidence</button>{" "}<button type="button" onClick={deploy} disabled={selected.state !== "READY"}>Validate and deploy exact ref</button>{" "}<button type="button" onClick={revert} disabled={!active || !previousExactRef}>Revert to previous exact ref</button></p>
        </Panel>

        <Panel eyebrow="Change impact" title="Source first; semantic behavior is inspectable">
          <Tabs tabs={[{ id: "source", label: "Source diff" }, { id: "clauses", label: "Behavior clauses" }, { id: "impact", label: "Context & dependencies" }]} value={tab} onChange={setTab} idPrefix="review-tabs" />
          <TabPanel idPrefix="review-tabs" tabId="source" active={tab === "source"}><div className="review-diff" aria-label="Source diff">{analysis.sourceDiff.map((line, index) => <div key={`${line.kind}-${line.oldLine ?? ""}-${line.newLine ?? ""}-${index}`} className={diffLineClass(line.kind)}><span aria-hidden="true">{line.kind === "ADDED" ? "+" : line.kind === "REMOVED" ? "−" : " "}</span><code>{line.text || " "}</code></div>)}</div></TabPanel>
          <TabPanel idPrefix="review-tabs" tabId="clauses" active={tab === "clauses"}><ul>{analysis.clauseDiff.map((entry) => <li key={entry.id}><StatusBadge label={entry.kind} status={entry.kind === "ADDED" ? "success" : entry.kind === "REMOVED" ? "error" : entry.kind === "CHANGED" ? "warning" : "neutral"} /> <code>{entry.id}</code>{entry.kind === "CHANGED" ? <details><summary>before / after</summary><pre>{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details> : null}</li>)}</ul></TabPanel>
          <TabPanel idPrefix="review-tabs" tabId="impact" active={tab === "impact"}><p>Direct dependencies: +{analysis.dependencies.added.join(", ") || "none"} / −{analysis.dependencies.removed.join(", ") || "none"}.</p><p>Transitive dependencies: +{analysis.transitiveDependencies.added.join(", ") || "none"} / −{analysis.transitiveDependencies.removed.join(", ") || "none"}; unchanged {analysis.transitiveDependencies.unchanged.join(", ") || "none"}.</p><p>Tools: +{analysis.tools.added.join(", ") || "none"} / −{analysis.tools.removed.join(", ") || "none"}. Direct used-by: +{analysis.usedBy.added.join(", ") || "none"} / −{analysis.usedBy.removed.join(", ") || "none"}.</p><p>Transitive used-by: +{analysis.transitiveUsedBy.added.join(", ") || "none"} / −{analysis.transitiveUsedBy.removed.join(", ") || "none"}; unchanged {analysis.transitiveUsedBy.unchanged.join(", ") || "none"}.</p><p>Tags: +{analysis.tags.added.join(", ") || "none"} / −{analysis.tags.removed.join(", ") || "none"}.</p>{analysis.contextProfiles.map((profile) => <article key={profile.profileId} className="foundation-card"><strong>{profile.profileId}</strong><p>Base {profile.baseTotal} CU → proposed {blockLabel(profile.proposed)} ({profile.delta >= 0 ? "+" : ""}{profile.delta} CU). {profile.reconciled ? "Totals reconcile." : "Review blocked/unavailable context details."}</p>{profile.diagnostics.length > 0 ? <ul>{profile.diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}</ul> : null}</article>)}{analysis.contextProfiles.length === 0 ? <p>No representative profile was supplied.</p> : null}</TabPanel>
        </Panel>

        <Panel eyebrow="Eval gate" title="Select exact cases; inspect every result">
          <p>Selected exact refs: {selected.evalSelection.map((ref) => `${ref.id}@${ref.version}`).join(", ") || "none"}. Results from older revisions never count toward deployment.</p>
          <fieldset><legend>Risk-based eval coverage</legend>{catalog.map((entry) => { const key = evalRefKey(entry.ref); return <article key={key} className="foundation-card"><label><input type="checkbox" checked={selectedEvalKeys.has(key)} onChange={() => toggleEval(entry.ref)} /> <strong>{entry.definition.title}</strong></label><p>{entry.definition.description}</p><p>Risk tags: {entry.definition.tags.join(", ") || "none"} · Severity {entry.severityCoverage} · Exact <code>{key}</code>.</p><p>{entry.built ? `Built · run ${entry.runCostCredits} credits` : `Unbuilt · build ${entry.buildCostCredits} credits`}. {entry.lastResult ? `Last result: ${entry.lastResult.status}.` : "No prior result."}</p>{!entry.built ? <button type="button" onClick={() => buildEval(entry.ref)}>Build for {entry.buildCostCredits} credits</button> : null}</article>; })}</fieldset>
          <div className="foundation-card"><h3>Named suite</h3><label>Saved suite <select value={selectedSuiteId} onChange={(event) => chooseSuite(event.target.value)}><option value="">Individual selection</option>{suites.map((suite) => <option key={suite.id} value={suite.id}>{suite.title} · v{suite.version}</option>)}</select></label><p><label>Suite id <input value={suiteId} onChange={(event) => setSuiteId(event.target.value)} disabled={Boolean(selectedSuiteId)} /></label>{" "}<label>Suite title <input value={suiteTitle} onChange={(event) => setSuiteTitle(event.target.value)} /></label></p><button type="button" onClick={saveSuite} disabled={selected.evalSelection.length === 0}>{selectedSuiteId ? "Save selection to suite" : "Create suite from selection"}</button></div>
          <p>Run preview: {runPreview?.evalRefs.length ?? 0} exact case(s), {runPreview?.totalRunCostCredits ?? 0} credits. Costs are charged only after confirmation.</p>
          <button type="button" onClick={() => void runEvals()} disabled={selected.evalSelection.length === 0 || selected.state === "DEPLOYED" || selected.state === "CLOSED"}>Confirm {runPreview?.totalRunCostCredits ?? 0} credits and run against {refLabel(selected.proposedRef)}</button>
          {selected.evalAssociations.length === 0 ? <p>No eval result attached yet.</p> : <div>{selected.evalAssociations.map((association) => {
            const result = association.result;
            const traceRef = result?.traceRef ?? result?.output?.traceRef;
            const replayManifest = result?.replayManifest ?? result?.output?.replayManifest;
            return <details key={association.id} open={association.status === "FAILED" || association.stale}><summary><StatusBadge label={association.status} status={association.status === "PASSED" ? "success" : association.status === "STALE" ? "warning" : association.status === "FAILED" ? "error" : "pending"} /> {evalRefKey(association.evalRef)} · {association.stale ? "stale" : "current exact subject"}</summary><p>{association.reason ?? "Result is associated with this review revision."}</p>{result ? <><p>Subject ref: <code>{association.subjectRef ? refLabel(association.subjectRef) : "unavailable"}</code></p><p>{traceRef ? <button type="button" onClick={() => navigate(`/traces/${traceRef}`)}>Open trace {traceRef}</button> : "No trace was recorded."}{" "}{replayManifest && traceRuntime ? <button type="button" onClick={() => { void traceRuntime.replay.replay(replayManifest).then((replay) => setReplayMessage(`Replay ${evalRefKey(association.evalRef)}: ${replay.status}${replay.firstDifference ? ` · ${replay.firstDifference.message}` : ""}`)); }}>Replay exact fixture and seed</button> : null}{" "}<button type="button" onClick={() => setTab("clauses")}>Inspect relevant clauses</button>{" "}<button type="button" onClick={() => setTab("impact")}>Inspect context impact</button></p><ul>{result.assertions.map((assertion, index) => <li key={`${association.id}-${index}`}><StatusBadge label={assertion.passed ? "PASS" : "FAIL"} status={assertion.passed ? "success" : "error"} /> {assertion.type}: expected <code>{JSON.stringify(assertion.expected)}</code>, observed <code>{JSON.stringify(assertion.observed)}</code>. {assertion.message} <small>Evidence: {assertion.evidenceRefs.join(", ") || "none"}</small></li>)}</ul></> : null}</details>;
          })}</div>}
          {replayMessage ? <p role="status" aria-live="polite">{replayMessage}</p> : null}
        </Panel>

        <Panel eyebrow="Deployment policy" title="Warnings inform; hard gates protect integrity">
          {(() => { const assessment = runtime.deployments.validate(selected.reviewId); return <><p>{assessment.valid ? <StatusBadge label="Validatable" status="success" /> : <StatusBadge label="Hard gate" status="error" />} Exact active ref: {runtime.deployments.resolveActive(selected.artifactId) ? refLabel(runtime.deployments.resolveActive(selected.artifactId)!) : "none"}.</p>{assessment.hardGates.length > 0 ? <div><h3>Cannot deploy</h3><ul>{assessment.hardGates.map((item) => <li key={item.code}><StatusBadge label={item.code} status="error" /> {item.message}</li>)}</ul></div> : null}{assessment.warnings.length > 0 ? <div><h3>Warnings requiring explicit acknowledgement</h3><ul>{assessment.warnings.map((item) => <li key={item.code}><label><input type="checkbox" checked={acknowledgedWarningCodes.includes(item.code)} onChange={() => { const next = acknowledgedWarningCodes.includes(item.code) ? acknowledgedWarningCodes.filter((code) => code !== item.code) : [...acknowledgedWarningCodes, item.code]; setWarningAcknowledgement({ reviewId: selected.reviewId, reviewVersion: selected.version, codes: next }); }} /> <StatusBadge label={item.code} status="warning" /> {item.message}</label></li>)}</ul></div> : <p>No deployment warnings.</p>}</>; })()}
        </Panel>
      </> : null}
    </main>
  );
}
