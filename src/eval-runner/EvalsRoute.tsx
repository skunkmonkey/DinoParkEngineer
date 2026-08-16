"use client";

import { useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { Panel, StatusBadge } from "../platform/public.ts";
import type { EvalCaseResult, EvalRef, EvalRunRequest, EvalSubject } from "../../eval-runner/index.ts";
import { evalRefKey } from "../../eval-runner/index.ts";
import type { ReplayManifest, TraceRecord } from "../../trace-replay/index.ts";
import { getActiveTraceReplayRuntime } from "../trace-replay/public.ts";
import { getActiveEvalService } from "./runtime.ts";
import { getActivePersistenceRuntime } from "../persistence/public.ts";

function resultTone(status: EvalCaseResult["status"]): "success" | "error" | "warning" | "neutral" {
  if (status === "PASSED") return "success";
  if (status === "FAILED") return "error";
  if (status.startsWith("BLOCKED") || status === "UNAVAILABLE" || status === "ISOLATION_FAILED") return "warning";
  return "neutral";
}

function display(value: unknown): string {
  if (value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function incidentManifest(trace: TraceRecord): ReplayManifest | undefined {
  return trace.header.replayManifest;
}

function inferSubject(manifest: ReplayManifest): EvalSubject | undefined {
  if (manifest.job?.promptRef) return { type: "PROMPT", ref: manifest.job.promptRef };
  if (manifest.job?.skillRefs?.[0]) return { type: "SKILL", ref: manifest.job.skillRefs[0] };
  if (manifest.job?.systemPromptRefs?.[0]) return { type: "SYSTEM_PROMPT", ref: manifest.job.systemPromptRefs[0] };
  if (manifest.agentDefinition) return { type: "AGENT_CONFIG", agentDefinition: manifest.agentDefinition };
  return undefined;
}

export function EvalsRoute({ navigate }: ShellRouteProps) {
  const service = getActiveEvalService();
  const traceRuntime = getActiveTraceReplayRuntime();
  const persistence = getActivePersistenceRuntime();
  const [revision, setRevision] = useState(0);
  const catalog = service?.catalog() ?? [];
  const suites = service?.suites() ?? [];
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [suiteId, setSuiteId] = useState("feeding-regression");
  const [suiteTitle, setSuiteTitle] = useState("Feeding regression");
  const [message, setMessage] = useState("Select built evals or a suite to preview a deterministic run.");
  const [replayMessage, setReplayMessage] = useState("");

  const selectedRefs = catalog.filter((entry) => selectedKeys.includes(evalRefKey(entry.ref))).map((entry) => entry.ref);
  const suite = selectedSuiteId ? service?.suite(selectedSuiteId) : undefined;
  const request: EvalRunRequest = (() => {
    if (!suite) return { evalRefs: selectedRefs };
    const suiteKeys = new Set(suite.evalRefs.map(evalRefKey));
    const selected = new Set(selectedRefs.map(evalRefKey));
    return {
      suiteId: suite.id,
      overrides: {
        add: selectedRefs.filter((ref) => !suiteKeys.has(evalRefKey(ref))),
        remove: suite.evalRefs.filter((ref) => !selected.has(evalRefKey(ref))),
      },
    };
  })();
  const preview = service?.preview(request);
  const results = service?.results() ?? [];
  const incidents = (traceRuntime?.repository.records() ?? []).filter((trace) => trace.events.some((event) => event.category === "INCIDENT"));

  if (!service) {
    return <Panel eyebrow="Evals" title="Evaluation service unavailable"><p>The Evals provider has not initialized. Reload after the feature providers are ready.</p></Panel>;
  }

  const refresh = () => setRevision((value) => value + 1);
  const toggle = (ref: EvalRef) => {
    const key = evalRefKey(ref);
    setSelectedKeys((keys) => keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]);
  };
  const chooseSuite = (id: string) => {
    setSelectedSuiteId(id);
    const next = id ? service.suite(id)?.evalRefs ?? [] : [];
    setSelectedKeys(next.map(evalRefKey));
  };
  const build = async (ref: EvalRef) => {
    const transactionId = `ui.eval-build.${evalRefKey(ref)}`;
    const coordinated = persistence?.workflows
      ? await persistence.workflows.eval(transactionId, () => { const outcome = service.build(ref, transactionId); if (!outcome.ok) throw new Error(outcome.error.message); return outcome; })
      : undefined;
    if (coordinated && (!coordinated.ok || !coordinated.value)) { setMessage(coordinated.error?.message ?? "Eval build transaction failed."); return; }
    const outcome = coordinated?.value ?? service.build(ref, transactionId);
    setMessage(outcome.ok ? `Built ${evalRefKey(ref)}. Its fixture, seed, and assertions are now immutable.` : outcome.error.message);
    refresh();
  };
  const run = async () => {
    const transactionId = `ui.eval-run.${revision}.${preview?.evalRefs.map(evalRefKey).join("+")}`;
    const coordinated = persistence?.workflows ? await persistence.workflows.eval(transactionId, () => service.run({ ...request, transactionId })) : undefined;
    if (coordinated && !coordinated.ok) { setMessage(coordinated.error?.message ?? "Eval run transaction failed."); return; }
    const outcome = coordinated?.value ?? await service.run({ ...request, transactionId });
    setMessage(`${outcome.results.length} case(s) completed; ${outcome.chargedRunCostCredits} credits charged. ${outcome.partial ? "Some cases were blocked; inspect each reason." : "Batch complete."}`);
    refresh();
  };

  return (
    <main className="foundation-page" data-revision={revision}>
      <header className="foundation-page__header">
        <div><p className="foundation-eyebrow">Engineering assurance</p><h1>Evals &amp; regression suites</h1><p>Buy permanent deterministic cases, test exact versions in isolation, and inspect evidence instead of an aggregate score.</p></div>
      </header>
      <p role="status" aria-live="polite">{message}</p>

      <Panel eyebrow="Catalog" title={`${catalog.length} deterministic cases`}>
        <fieldset>
          <legend>Select cases for this run</legend>
          {catalog.map((entry) => {
            const key = evalRefKey(entry.ref);
            return (
              <article key={key} className="foundation-card">
                <label><input type="checkbox" checked={selectedKeys.includes(key)} onChange={() => toggle(entry.ref)} /> <strong>{entry.definition.title}</strong></label>
                <p>{entry.definition.description}</p>
                <p><StatusBadge label={entry.built ? "Built" : "Unbuilt"} status={entry.built ? "success" : "warning"} /> Severity {entry.severityCoverage} · Build {entry.buildCostCredits} · Run {entry.runCostCredits} credits</p>
                <p>Tags: {entry.definition.tags.join(", ") || "none"} · Exact ref: <code>{key}</code></p>
                {entry.lastResult ? <StatusBadge label={`Last: ${entry.lastResult.status}`} status={resultTone(entry.lastResult.status)} /> : <span>No result for this subject yet.</span>}
                {!entry.built ? <p><button type="button" onClick={() => void build(entry.ref)}>Build for {entry.buildCostCredits} credits</button></p> : null}
              </article>
            );
          })}
        </fieldset>
      </Panel>

      <Panel eyebrow="Suites" title="Named exact-ref selections">
        <label>Active suite <select value={selectedSuiteId} onChange={(event) => chooseSuite(event.target.value)}><option value="">No suite (individual selection)</option>{suites.map((item) => <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>)}</select></label>
        <div>
          <label>Suite id <input value={suiteId} onChange={(event) => setSuiteId(event.target.value)} /></label>{" "}
          <label>Title <input value={suiteTitle} onChange={(event) => setSuiteTitle(event.target.value)} /></label>{" "}
          <button type="button" onClick={() => { const outcome = service.createSuite({ id: suiteId, title: suiteTitle, evalRefs: selectedRefs }); setMessage(outcome.ok ? `Created suite ${outcome.value.title}.` : outcome.errors.map((error) => error.message).join(" ")); if (outcome.ok) setSelectedSuiteId(outcome.value.id); refresh(); }}>Create from selection</button>
        </div>
        {suite ? <p>
          <button type="button" onClick={() => { const outcome = service.renameSuite(suite.id, suiteTitle); setMessage(outcome.ok ? `Renamed suite to ${outcome.value.title}.` : outcome.errors.map((error) => error.message).join(" ")); refresh(); }}>Rename</button>{" "}
          <button type="button" onClick={() => { const outcome = service.updateSuite(suite.id, { evalRefs: selectedRefs }); setMessage(outcome.ok ? `Updated ${outcome.value.title} to version ${outcome.value.version}.` : outcome.errors.map((error) => error.message).join(" ")); refresh(); }}>Save selection to suite</button>{" "}
          <button type="button" onClick={() => { service.removeSuite(suite.id); setSelectedSuiteId(""); setMessage(`Removed suite ${suite.title}; eval assets were preserved.`); refresh(); }}>Remove suite</button>
        </p> : null}
        {suite ? <p>Checkbox changes are per-run additions/removals until “Save selection to suite” is chosen.</p> : null}
      </Panel>

      <Panel eyebrow="Run preview" title={`${preview?.evalRefs.length ?? 0} cases · ${preview?.totalRunCostCredits ?? 0} credits`}>
        {(preview?.behavior.length ?? 0) > 0 ? <ol>{preview?.behavior.map((behavior, index) => <li key={`${index}-${behavior}`}>{behavior}</li>)}</ol> : <p>Select at least one case.</p>}
        {(preview?.errors.length ?? 0) > 0 ? <ul>{preview?.errors.map((error) => <li key={`${error.path}-${error.code}`}>{error.message}</li>)}</ul> : null}
        <button type="button" disabled={(preview?.evalRefs.length ?? 0) === 0} onClick={() => void run()}>Confirm and run isolated batch for {preview?.totalRunCostCredits ?? 0} credits</button>
      </Panel>

      <Panel eyebrow="Inspection" title="Expected vs observed evidence">
        {results.length === 0 ? <p>No eval results yet.</p> : results.map((result) => (
          <details key={result.id} open={result.status !== "PASSED"}>
            <summary><StatusBadge label={result.status} status={resultTone(result.status)} /> {evalRefKey(result.ref)} · fixture {result.fixtureId} · seed {result.seed}</summary>
            <p>Subject: {result.subjectRef ? `${result.subjectRef.artifactId}@${result.subjectRef.version}` : result.subject.type} · Run cost: {result.runCostCredits} · Hash: <code>{result.canonicalHash}</code></p>
            {result.error ? <p><strong>Reason:</strong> {result.error}</p> : null}
            <ul>{result.assertions.map((assertion, index) => <li key={`${assertion.type}-${index}`}><StatusBadge label={assertion.passed ? "Pass" : "Fail"} status={assertion.passed ? "success" : "error"} /> <strong>{assertion.type}</strong>: expected <code>{display(assertion.expected)}</code>; observed <code>{display(assertion.observed)}</code>. {assertion.message} Evidence: {assertion.evidenceRefs.join(", ") || "negative evidence: no matching event"}.</li>)}</ul>
            <p>{result.traceRef ? <button type="button" onClick={() => navigate(`/traces/${result.traceRef}`)}>Open trace {result.traceRef}</button> : "No trace was recorded."}{" "}
              {result.replayManifest && traceRuntime ? <button type="button" onClick={() => { void traceRuntime.replay.replay(result.replayManifest!).then((replay) => setReplayMessage(`${evalRefKey(result.ref)} replay: ${replay.status}${replay.firstDifference ? ` · ${replay.firstDifference.message}` : ""}`)); }}>Replay exact fixture and seed</button> : null}</p>
          </details>
        ))}
        {replayMessage ? <p role="status" aria-live="polite">{replayMessage}</p> : null}
      </Panel>

      <Panel eyebrow="Production learning" title="Create regression eval from incident">
        {incidents.length === 0 ? <p>No incident trace with reconstructable replay data is available. Capture the exact fixture, seed, manifest, and pinned artifacts during the incident.</p> : incidents.map((trace) => {
          const manifest = incidentManifest(trace);
          const subject = manifest ? inferSubject(manifest) : undefined;
          const eligible = Boolean(manifest?.fixture && Number.isFinite(manifest.seed) && subject);
          return <article key={trace.header.traceId} className="foundation-card"><h3>{trace.header.traceId}</h3><p>{eligible ? `Eligible: exact fixture ${manifest?.fixture?.id}, seed ${manifest?.seed}, and pinned manifest are available.` : "Unavailable: the trace needs an exact fixture, finite seed, and exact subject in its replay manifest."}</p><button type="button" disabled={!eligible} onClick={() => {
            if (!manifest?.fixture || !subject) return;
            const outcome = service.fromIncident({ incidentId: trace.header.traceId, manifest, fixture: manifest.fixture, seed: manifest.seed, subjectType: subject.type, subjectRef: subject.ref, assertions: [{ type: "JOB_STATUS", expected: "SUCCEEDED" }, { type: "INCIDENT_MAX_SEVERITY", maxSeverity: 2 }] }, `ui.incident-build.${trace.header.traceId}`);
            setMessage(outcome.ok ? `Created immutable regression ${evalRefKey(outcome.value.ref)} from ${trace.header.traceId}.` : outcome.error.message);
            refresh();
          }}>Create regression eval from incident</button></article>;
        })}
      </Panel>
    </main>
  );
}
