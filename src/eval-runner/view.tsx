import React, { useMemo, useState } from "react";

import {
  createOpeningMaintenanceContextEvalCase,
  rerunEvalCase,
  runEvalCase,
} from "./engine.js";
import type {
  EvalCase,
  EvalCaseResult,
  EvalCandidate,
  EvalComparison,
} from "./types.js";

export interface EvalRunnerViewProps {
  readonly evalCase?: EvalCase;
  readonly candidate?: EvalCandidate;
  readonly onResult?: (result: EvalCaseResult) => void;
}

const displayValue = (value: unknown): string => value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value);

/**
 * Focused semantic Eval surface. Route ownership stays with the application
 * shell; this component owns only the Eval projection and commands.
 */
export function EvalRunnerView({ evalCase: providedCase, candidate, onResult }: EvalRunnerViewProps = {}): React.JSX.Element {
  const causalParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const causalIncidentId = causalParams.get("origin");
  const returnQuery = new URLSearchParams({
    incident: causalIncidentId ?? "incident:opening-near-miss",
    job: causalParams.get("job") ?? "job:schedule-second-feed-day-1-tick-0",
    action: causalParams.get("action") ?? "command:opening-reuse-open-gate",
    trace: causalParams.get("trace") ?? "trace:opening-feed-beta",
    artifact: causalParams.get("artifact") ?? "prompt:self-contained-feeding@1.0.0",
  });
  const evalCase = useMemo(() => providedCase ?? createOpeningMaintenanceContextEvalCase(), [providedCase]);
  const [selected, setSelected] = useState(true);
  const [result, setResult] = useState<EvalCaseResult>();
  const [comparison, setComparison] = useState<EvalComparison>();
  const [replayMessage, setReplayMessage] = useState("");

  const run = (): void => {
    if (!selected) return;
    const next = runEvalCase(evalCase, candidate === undefined ? {} : { candidate });
    setResult(next);
    setComparison(undefined);
    setReplayMessage("");
    onResult?.(next);
  };

  const rerun = (): void => {
    if (result === undefined) return;
    const next = rerunEvalCase(result, evalCase, candidate === undefined ? {} : { candidate });
    if ("diagnostics" in next) {
      setReplayMessage(next.diagnostics.map((entry) => entry.message).join(" "));
      return;
    }
    setResult(next.rerun);
    setComparison(next.comparison);
    setReplayMessage("Like-for-like rerun complete. Both exact result sets remain available for review.");
    onResult?.(next.rerun);
  };

  return (
    <section className="eval-runner-experience" data-mode="simulation" data-production="false" aria-labelledby="eval-runner-heading">
      <header className="player-mode-frame">
        <div>
          <p className="eyebrow">Eval Runner · isolated engineering surface</p>
          <h2 id="eval-runner-heading">{evalCase.title}</h2>
          <p><strong>SIMULATION.</strong> This Eval uses a fresh production-equivalent fixture. Production world, Economy, and Persistence remain unchanged.</p>
        </div>
        <div className="player-mode-mark" aria-label="Current mode: Simulation; production is unchanged"><span aria-hidden="true">◎</span><span>SIMULATION</span></div>
      </header>

      {causalIncidentId === null ? null : <p><a className="button-link" href={`/park?${returnQuery.toString()}`}>Return to the same causal event</a></p>}

      <section className="operational-anchor" aria-labelledby="eval-anchor-heading">
        <h3 id="eval-anchor-heading">Exact Eval selection</h3>
        <label>
          <input type="checkbox" checked={selected} onChange={(event) => setSelected(event.currentTarget.checked)} />
          Select <code>{evalCase.id}@{evalCase.version}</code>
        </label>
        <dl className="status-grid">
          <div><dt>Risk / category</dt><dd>{evalCase.risk} · {evalCase.category}</dd></div>
          <div><dt>Availability</dt><dd>{evalCase.availability}{evalCase.oneTime ? " · one-time opening Eval" : ""}</dd></div>
          <div><dt>Estimated run cost</dt><dd>{evalCase.cost.run.units} units · {evalCase.cost.run.label}</dd></div>
          <div><dt>Exact fixture</dt><dd><code>{evalCase.fixture.id}@{evalCase.fixture.version}</code></dd></div>
          <div><dt>Previous results</dt><dd>{evalCase.previousResultIds.length === 0 ? "None" : evalCase.previousResultIds.join(", ")}</dd></div>
        </dl>
        <button type="button" onClick={run} disabled={!selected || evalCase.availability !== "available"}>Run selected Eval</button>
        <p className="safe-state" role="status">{selected ? "Selected case will run in a fresh isolated environment." : "No Eval selected."}</p>
      </section>

      {result === undefined ? <section className="feature-card" aria-labelledby="eval-ready-heading"><h3 id="eval-ready-heading">Ready to execute</h3><p>Expected behavior, exact versions, risk, and cost are visible before the run. No reliability probability is implied.</p></section> : (
        <section className="feature-card" aria-labelledby="eval-result-heading">
          <p className="eyebrow">Expected versus observed</p>
          <h3 id="eval-result-heading">{result.status.toUpperCase()} · <code>{result.resultId}</code></h3>
          <p role="status">{result.reasonCode}. {result.surface.accessibleNotice}</p>
          <table>
            <caption>Bounded assertion results</caption>
            <thead><tr><th scope="col">Assertion</th><th scope="col">Expected</th><th scope="col">Observed</th><th scope="col">Result</th></tr></thead>
            <tbody>{result.assertions.map((assertion) => <tr key={assertion.id}>
              <th scope="row"><code>{assertion.id}</code><br /><small>{assertion.subject}.{assertion.path}</small></th>
              <td>{displayValue(assertion.expected)}</td>
              <td>{displayValue(assertion.observed)}</td>
              <td>{assertion.passed ? "PASS" : "FAIL"}</td>
            </tr>)}</tbody>
          </table>
          <dl className="inspector-details">
            <div><dt>Executed assertions</dt><dd>{result.assertionSummary.passed} passed / {result.assertionSummary.executed} executed</dd></div>
            <div><dt>Exact dependency manifest</dt><dd><code>{result.dependencyManifest.fingerprint}</code></dd></div>
            <div><dt>Trace / replay</dt><dd><code>{result.replay.traceId}</code> · {result.replay.available ? "available" : "unavailable"}</dd></div>
          </dl>
          <div className="button-row">
            <button type="button" onClick={() => setReplayMessage(result.replay.available ? `Replay opened at ${result.replay.firstMismatchEventId ?? "the recorded start"}.` : "Replay is unavailable because this Eval did not finish a complete trace.")}>Open synchronized replay</button>
            <button type="button" onClick={rerun}>Rerun exact case</button>
          </div>
          {replayMessage === "" ? null : <p className="safe-state" role="status">{replayMessage}</p>}
          {comparison === undefined ? null : <section aria-labelledby="comparison-heading"><h4 id="comparison-heading">Like-for-like comparison</h4><p>{comparison.compatible ? "Exact case, fixture, candidate, and dependency versions align." : "Comparison blocked or changed exact inputs."}</p><p>{comparison.changedAssertions.length} assertion outcome(s) changed; {comparison.differences.length} difference(s) recorded.</p></section>}
        </section>
      )}
    </section>
  );
}
