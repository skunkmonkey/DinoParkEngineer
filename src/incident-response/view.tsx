import React, { useMemo, useState } from "react";

import { createIncidentResponseFoundationFixture } from "./foundation-fixture.js";
import { createIncidentResponse } from "./service.js";
import type { IncidentResponseRecord } from "./types.js";

export const IncidentResponseView = (): React.JSX.Element => {
  const fixture = useMemo(createIncidentResponseFoundationFixture, []);
  const service = useMemo(() => createIncidentResponse(fixture.options), [fixture]);
  const planned = useMemo(() => service.plan(fixture.incident.id), [fixture, service]);
  const [tick, setTick] = useState(10);
  const [record, setRecord] = useState<IncidentResponseRecord>();
  const [status, setStatus] = useState("Response plan ready. No callout has been activated or charged.");

  if (!planned.ok) return <section className="feature-card" role="alert">{planned.diagnostics[0]?.message ?? "Incident Response plan is unavailable."}</section>;
  const plan = planned.value;
  const activate = (expectedTick = tick): void => {
    const result = service.activate(plan.id, expectedTick);
    if (!result.ok) { setStatus(`${result.diagnostics[0]?.code}: ${result.diagnostics[0]?.message}`); return; }
    setRecord(result.value);
    setStatus(result.idempotent ? "Duplicate call recognized; the existing response and single reservation were preserved." : `Incident Response requested. ${plan.quote.amount} credits reserved; dispatch at tick ${plan.dispatchTick}.`);
  };
  const advance = (target: number): void => {
    const result = service.advanceToTick(target);
    if (!result.ok) { setStatus(result.diagnostics[0]?.message ?? "Response time could not advance."); return; }
    const next = result.value[0]; setTick(target); setRecord(next);
    setStatus(next === undefined ? "No active response record." : `Response ${next.status} at tick ${target}. ${next.engineeringUnresolved ? "Engineering cause remains unresolved." : ""}`);
  };

  return <section className="feature-card incident-response-experience" aria-labelledby="incident-response-heading">
    <p className="eyebrow">Incident Response · External stabilization · Production paused</p>
    <h2 id="incident-response-heading">Strict-stop containment response</h2>
    <dl className="status-grid" aria-label="Incident Response plan">
      <div><dt>Location</dt><dd><code>{plan.locationId}</code></dd></div><div><dt>Immediate risk</dt><dd>{plan.immediateRisks.join(" ")}</dd></div>
      <div><dt>Arrival</dt><dd>Tick {plan.arrivalTick}</dd></div><div><dt>Duration</dt><dd>{plan.estimatedDurationTicks} ticks</dd></div>
      <div><dt>Callout cost</dt><dd>{plan.quote.amount} credits · exact quote <code>{plan.quote.id}</code></dd></div><div><dt>Closure</dt><dd>{plan.closures.join(" ")}</dd></div>
    </dl>
    <details><summary>Capabilities and limitations</summary><section aria-labelledby="response-capabilities-heading"><h3 id="response-capabilities-heading">Response scope</h3>
      <ul>{plan.capabilities.map((entry) => <li key={entry.capability}><strong>{entry.capability}</strong>: {entry.available ? "Available" : `Unavailable — ${entry.limitation}`}{entry.destinationId === undefined ? "" : `; destination ${entry.destinationId}`}</li>)}</ul>
      <p><strong>Boundaries:</strong> {plan.expectedStabilizationBoundaries.join(" ")}</p>
      <p><strong>Limitations:</strong> {plan.limitations.length === 0 ? "No additional limitation in this exact plan; authored capacity, access, timing, gate, health, and route checks still apply." : plan.limitations.join(" ")}</p>
    </section></details>
    <div className="button-row" role="group" aria-label="Incident Response controls">
      <button type="button" onClick={() => activate(9)}>Try stale activation</button>
      <button type="button" onClick={() => activate()}>Activate Incident Response</button>
      <button type="button" disabled={record === undefined || tick >= plan.expectedCompleteTick} onClick={() => advance(tick + 1)}>Advance one response tick</button>
      <button type="button" disabled={record === undefined || tick >= plan.expectedCompleteTick} onClick={() => advance(plan.expectedCompleteTick)}>Run to stabilization</button>
    </div>
    <p role="status" aria-live="polite">{status}</p>
    <p><strong>Response state:</strong> {record?.status ?? "not activated"} · tick {tick} · represented by text and sequence, not color alone.</p>
    {record === undefined ? null : <>
      <ol aria-label="Response lifecycle">{record.transitions.map((entry, index) => <li key={`${entry.status}-${entry.tick}-${index}`}>{entry.status} at tick {entry.tick}</li>)}</ol>
      <details><summary>Inspect response evidence</summary><section aria-labelledby="response-evidence-heading"><h3 id="response-evidence-heading">Authoritative response evidence</h3>
        <ul>{record.actionEvidence.length === 0 ? <li>No Simulation command has run yet.</li> : record.actionEvidence.map((entry) => <li key={entry.commandId}><strong>{entry.capability}</strong>: {entry.accepted ? "accepted" : `limited/failed (${entry.diagnosticCodes.join(", ")})`} · command <code>{entry.commandId}</code></li>)}</ul>
        <p><strong>Engineering status:</strong> {record.engineeringUnresolved ? "STABILIZED OR IN RESPONSE — ENGINEERING UNRESOLVED" : "resolved"}</p>
        <p>Context <code>{record.engineeringBoundaryAfter.contextFingerprint}</code>, artifact <code>{record.engineeringBoundaryAfter.artifactFingerprint}</code>, route, Retention Policy, review, and deployment fingerprints remain unchanged.</p>
        {record.outcome === undefined ? null : <p><strong>Outcome:</strong> {record.outcome.cost} credits settled; {record.outcome.downtimeTicks} ticks downtime; rating effect {record.outcome.ratingEffect}; closures preserved.</p>}
      </section></details>
    </>}
  </section>;
};
