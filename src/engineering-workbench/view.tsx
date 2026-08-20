import React, { useMemo, useState } from "react";

import { createEconomyService } from "../economy-progression/public.js";
import { createEngineeringWorkbenchFoundationFixture } from "./foundation-fixture.js";
import { PARK_DEVELOPER } from "./engine.js";

export function EngineeringWorkbench(): React.JSX.Element {
  const causalParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const causalIncidentId = causalParams.get("incident") ?? "incident:opening-near-miss";
  const causalJobId = causalParams.get("job") ?? "job:schedule-second-feed-day-1-tick-0";
  const causalActionId = causalParams.get("action") ?? "command:opening-reuse-open-gate";
  const causalTraceId = causalParams.get("trace") ?? "trace:opening-feed-beta";
  const causalArtifact = causalParams.get("artifact") ?? "prompt:self-contained-feeding@1.0.0";
  const fixture = useMemo(createEngineeringWorkbenchFoundationFixture, []);
  const economyQuote = useMemo(() => {
    const economy = createEconomyService({ initialBalance: 1_000 });
    const result = economy.quote({
      id: "quote:opening-maintenance-route",
      category: "authoring",
      day: 1,
      tick: 1,
      source: { kind: "recovery", id: "incident:opening-near-miss" },
      relatedIds: ["context:maintenance-policy", "incident:opening-near-miss"],
    });
    if (!result.ok) throw new Error("The deterministic Workbench quote could not be created.");
    return result.value;
  }, []);
  const { instruction, context, workbench } = fixture;
  const deployed = workbench.inspect(instruction.selfContained, [{ reference: instruction.selfContained.reference, status: "deployed", summary: "Pinned by opening feeding jobs." }]);
  const correction = workbench.inspect(instruction.modularPrompt, [{ reference: instruction.modularPrompt.reference, status: "candidate", summary: "Routes the reusable safe-feeding Skill." }]);
  const comparison = workbench.compare(instruction.selfContained, instruction.modularPrompt, [{ code: "CONTEXT_REQUIRED_UNAVAILABLE", kind: "missing", itemIds: ["context:maintenance-policy"], message: "Gate closer maintenance state was required but unavailable to the Worker." }]);
  const [maintenanceIncluded, setMaintenanceIncluded] = useState(false);
  const [candidateId, setCandidateId] = useState<string>();
  const [handbookQuery, setHandbookQuery] = useState("");
  const routes = context.items.map((item) => ({ id: item.provenance.routeId, item, included: item.id === "context:maintenance-policy" ? maintenanceIncluded : true }));
  const preview = workbench.compose([instruction.modularPrompt, instruction.feedingSkill], routes, 20, 12);
  const commission = (): void => {
    if (!maintenanceIncluded || candidateId !== undefined) return;
    const request = workbench.requestWork({ id: "work:opening-maintenance-route", goal: "Route current gate maintenance state before feeding decisions", baseVersion: instruction.selfContained.reference, capability: "Context optimization", inputs: ["context:maintenance-policy", "incident:opening-near-miss"], quote: { id: economyQuote.id, credits: economyQuote.amount, durationTicks: 1, category: "authoring" } });
    if (!request.ok) return;
    workbench.acceptWork(request.request.id);
    const candidate = workbench.completeWork(request.request.id, instruction.modularPrompt, routes.filter((route) => route.included).map((route) => route.id));
    setCandidateId(candidate.id);
  };
  return (
    <section className="workbench-experience" data-mode="workbench" aria-labelledby="workbench-heading">
      <header className="player-mode-frame"><div><p className="eyebrow">Engineering Workbench · focused mode</p><h2 id="workbench-heading">Repair the opening maintenance-context gap</h2><p><strong>Workbench · Production paused.</strong> Candidate work cannot change production.</p></div><div className="player-mode-mark" aria-label="Current mode: Workbench, production paused"><span aria-hidden="true">⬡</span><span>WORKBENCH</span></div></header>
      <section className="operational-anchor" aria-labelledby="workbench-anchor-heading"><h3 id="workbench-anchor-heading">Operational anchor</h3><dl className="status-grid"><div><dt>Production state / time</dt><dd>Pre-opening · Day 1 · Tick 1 · paused</dd></div><div><dt>Rating / credits</dt><dd>Unrated · 1,000 credits</dd></div><div><dt>Emergency count</dt><dd>1 grouped near miss</dd></div><div><dt>Selected version</dt><dd><code>{deployed.reference.id}@{deployed.reference.version}</code></dd></div><div><dt>Causal breadcrumb</dt><dd>Park → <code>{causalIncidentId}</code> → <code>{causalJobId}</code> → <code>{causalActionId}</code> → <code>context:maintenance-policy</code> → <code>{causalTraceId}</code> → <code>{causalArtifact}</code></dd></div></dl><a className="button-link" href={`/park?incident=${encodeURIComponent(causalIncidentId)}&job=${encodeURIComponent(causalJobId)}&trace=${encodeURIComponent(causalTraceId)}`}>Return to the exact park incident</a></section>
      <div className="workbench-grid">
        <section className="feature-card" aria-labelledby="developer-heading"><p className="eyebrow">Single Park Developer</p><h3 id="developer-heading">{PARK_DEVELOPER.name}</h3><p>One engineering partner with capability-backed work. There are no candidates, hiring, salaries, replacement, or developer teams.</p><ul>{Object.entries(PARK_DEVELOPER.capabilities).map(([capability, status]) => <li key={capability}><strong>{capability}</strong> · {status}</li>)}</ul></section>
        <section className="feature-card artifact-inspector" aria-labelledby="deployed-heading"><p className="eyebrow">Exact deployed artifact</p><h3 id="deployed-heading"><code>{deployed.reference.id}@{deployed.reference.version}</code></h3><dl className="inspector-details"><div><dt>Class / author</dt><dd>{deployed.class} · {deployed.author}</dd></div><div><dt>Context cost</dt><dd>{deployed.contextCost} units</dd></div><div><dt>Context composition</dt><dd>{deployed.contextComposition.join(", ")}</dd></div><div><dt>Dependencies</dt><dd>{deployed.dependencies.length === 0 ? "Self-contained" : deployed.dependencies.map((entry) => `${entry.id}@${entry.version}`).join(", ")}</dd></div><div><dt>Tools</dt><dd>{deployed.requiredTools.map((entry) => `${entry.id}@${entry.version}`).join(", ")}</dd></div><div><dt>Tradeoffs</dt><dd>{deployed.tradeoffs.join("; ")}</dd></div><div><dt>Deployment / history</dt><dd>{deployed.deploymentStatus}; {deployed.history[0]?.summary}</dd></div></dl><section className="prose-panel" aria-labelledby="prose-heading"><h4 id="prose-heading">Readable prose · inspectable, not executable</h4><p>{deployed.readableSource}</p></section><section className="clause-panel" aria-labelledby="clauses-heading"><h4 id="clauses-heading">EXECUTABLE CLAUSES · machine-readable behavior</h4>{deployed.clauses.map((clause) => <pre key={clause.id}><code>{JSON.stringify({ id: clause.id, type: clause.type, priority: clause.priority, requiredFacts: clause.requiredFacts, outcome: clause.outcome }, null, 2)}</code></pre>)}</section></section>
        <section className="feature-card" aria-labelledby="comparison-heading"><p className="eyebrow">Semantic comparison · no universal ranking</p><h3 id="comparison-heading">Deployed vs valid modular correction</h3><p><code>{correction.reference.id}@{correction.reference.version}</code> lowers routine Context cost but introduces an exact Skill dependency.</p><ul className="difference-list">{comparison.differences.map((difference) => <li key={difference.id}><strong>{difference.dimension}</strong> · {difference.summary}<details><summary>Exact evidence</summary>{difference.evidence.map((entry) => <p key={entry.id}><code>{entry.source}</code>: {entry.detail}</p>)}</details></li>)}</ul><h4>Evidence-backed findings</h4><ul>{comparison.findings.map((finding, index) => <li key={`${finding.kind}-${index}`}><strong>{finding.kind}</strong>: {finding.evidence.map((entry) => entry.detail).join("; ")}</li>)}</ul></section>
        <section className="feature-card" aria-labelledby="composition-heading"><p className="eyebrow">Bounded deterministic composition</p><h3 id="composition-heading">Context route and capacity preview</h3><label className="route-choice"><input type="checkbox" checked={maintenanceIncluded} onChange={(event) => setMaintenanceIncluded(event.currentTarget.checked)} /> Include <code>context:maintenance-policy</code> from the maintenance-state route</label><dl className="inspector-details"><div><dt>Used / capacity</dt><dd>{preview.contextUsed} / {preview.contextCapacity} units</dd></div><div><dt>Exact delta</dt><dd>{preview.contextDelta >= 0 ? "+" : ""}{preview.contextDelta} units from deployed baseline</dd></div><div><dt>Executable clauses</dt><dd>{preview.clauses.length}</dd></div><div><dt>Validation</dt><dd>{preview.valid ? "Valid composition" : "Blocked by conflict or capacity"}</dd></div><div><dt>Economy quote</dt><dd><code>{economyQuote.id}</code> · {economyQuote.amount} {economyQuote.currency} · {economyQuote.category}</dd></div></dl><button type="button" disabled={!maintenanceIncluded || candidateId !== undefined} onClick={commission}>Commission minimum context fix · {economyQuote.amount} credits</button>{candidateId === undefined ? <p role="status">Select the missing maintenance route to create a valid work request.</p> : <div className="candidate-success" role="status"><strong>Immutable candidate created: <code>{candidateId}</code></strong><p>Production still uses <code>{workbench.productionReference().id}@{workbench.productionReference().version}</code>. Review and Deployment is required before future jobs can change.</p><a className="button-link" href={`/eval?candidate=${encodeURIComponent(candidateId)}&origin=${encodeURIComponent(causalIncidentId)}&job=${encodeURIComponent(causalJobId)}&action=${encodeURIComponent(causalActionId)}&trace=${encodeURIComponent(causalTraceId)}&artifact=${encodeURIComponent(causalArtifact)}`}>Run the free exact maintenance-context eval</a></div>}</section>
        <section className="feature-card handbook-card" aria-labelledby="handbook-heading"><p className="eyebrow">Engineering Handbook · optional player reference</p><h3 id="handbook-heading">Encountered concepts</h3><label>Search Handbook <input type="search" value={handbookQuery} onChange={(event) => setHandbookQuery(event.currentTarget.value)} /></label><p className="safe-state">Handbook entries are not operational Knowledge and cannot enter Agent Context.</p>{workbench.handbook(handbookQuery).map((entry) => <article key={entry.id}><h4>{entry.term}</h4><p>{entry.definition}</p><p><strong>Visual grammar:</strong> {entry.visualGrammar}</p><p><strong>Encountered example:</strong> {entry.encounteredExample}</p><p>Incident link: <code>{entry.incidentIds.join(", ")}</code> · Context eligible: no</p></article>)}</section>
      </div>
    </section>
  );
}
