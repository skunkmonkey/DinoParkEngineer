"use client";

import { useSyncExternalStore } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { Panel, StatusBadge } from "../platform/public.ts";
import { formatCredits } from "../shared/formatters/game.ts";
import type { EconomyProgressionService } from "../../economy-progression/index.ts";
import { getActiveEconomyProgressionService } from "./runtime.ts";

function signedCredits(amount: number): string {
  return `${amount >= 0 ? "+" : "−"}${formatCredits(Math.abs(amount))}`;
}

function ConnectedFinanceProgress({ service, navigate }: { readonly service: EconomyProgressionService; readonly navigate: ShellRouteProps["navigate"] }) {
  const model = useSyncExternalStore(service.subscribe, service.readModel, service.readModel);
  return (
    <section className="foundation-content-grid" aria-labelledby="finance-progress-heading">
      <h2 id="finance-progress-heading">Finance / Progress</h2>
      <Panel eyebrow="Finance / Progress" title="Engineer the park economy">
        <p>Credits reward safe, reliable operation. Every change is an auditable ledger entry.</p>
        <p aria-label="Current credit balance"><strong>{formatCredits(model.balance.amount)}</strong> · Ledger version {model.balance.version}</p>
        <StatusBadge label={`Phase ${model.phase}`} status="success" />
        <dl aria-label="Park success metrics">
          <dt>Safety</dt><dd>{model.metrics.safety}/100</dd>
          <dt>Satisfaction</dt><dd>{model.metrics.satisfaction}/100</dd>
          <dt>Efficiency</dt><dd>{model.metrics.efficiency}/100</dd>
          <dt>Reliability</dt><dd>{model.metrics.reliability}/100</dd>
          <dt>Manual interventions</dt><dd>{model.metrics.interventions}</dd>
        </dl>
      </Panel>

      <Panel eyebrow="Latest settlement" title="Revenue and cost breakdown">
        {model.settlementLineItems.length === 0 ? <p>No park period has settled yet.</p> : (
          <ul>{model.settlementLineItems.map((line) => <li key={line.id}><span>{line.label}</span> · <strong>{signedCredits(line.amount)}</strong></li>)}</ul>
        )}
      </Panel>

      <Panel eyebrow="Park Developer" title="Investments">
        <ul>
          {model.investments.map((item) => (
            <li key={item.id}>
              <StatusBadge label={item.status === "OWNED" ? "Owned" : item.status === "AVAILABLE" ? "Available" : "Locked"} status={item.status === "AVAILABLE" ? "success" : item.status === "LOCKED" ? "warning" : "neutral"} />
              <span> {item.title} · {formatCredits(item.cost)}</span>
              <small> · {item.reason}</small>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel eyebrow="Curriculum" title="Capabilities, objectives, and unlock reasons">
        <h3>Capabilities</h3>
        {model.capabilities.length === 0 ? <p>No capabilities unlocked.</p> : <ul>{model.capabilities.map((id) => <li key={id}>{id}</li>)}</ul>}
        <h3>Completed objectives</h3>
        {model.objectives.length === 0 ? <p>No objectives completed yet.</p> : <ul>{model.objectives.map((id) => <li key={id}>{id}</li>)}</ul>}
        <h3>Unlock audit</h3>
        <ul>{model.unlocks.map((unlock) => <li key={unlock.id}><strong>{unlock.id}</strong> · Phase {unlock.phase} · {unlock.reason}</li>)}</ul>
      </Panel>

      <Panel eyebrow="Audit" title="Recent ledger">
        {model.recentLedger.length === 0 ? <p>No transactions settled yet.</p> : (
          <ul>{model.recentLedger.map((entry) => <li key={entry.id}>{entry.type}: {signedCredits(entry.amount)} → {formatCredits(entry.postBalance)}</li>)}</ul>
        )}
        <button type="button" onClick={() => navigate("/progress")}>Return to Finance / Progress</button>
      </Panel>
    </section>
  );
}

/** Live Finance/Progress view bound to the feature provider's read model. */
export function FinanceProgressRoute({ navigate }: ShellRouteProps) {
  const service = getActiveEconomyProgressionService();
  if (!service) return <section aria-labelledby="finance-progress-unavailable-heading"><h2 id="finance-progress-unavailable-heading">Finance / Progress</h2><Panel eyebrow="Finance / Progress" title="Economy unavailable"><p>The economy provider is not connected.</p></Panel></section>;
  return <ConnectedFinanceProgress service={service} navigate={navigate} />;
}
