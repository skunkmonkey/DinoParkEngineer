import React, { useMemo, useState } from "react";

import { createEconomyService, DEFAULT_REWARD_DEFINITIONS } from "./engine.js";
import type { DaySettlementSummary, EconomyLedgerProjection } from "./types.js";

const firstDaySummary = {
  id: "day-summary:first-full-day",
  day: 1,
  startTick: 0,
  endTick: 300,
  attendance: 10,
  departedVisitors: 10,
  completedJobIds: ["job:first-feeding"],
  failedJobIds: [],
  incidentIds: [],
  interventionCommandIds: [],
} as const;

const resultMessage = (result: { readonly ok: boolean; readonly diagnostics?: readonly { readonly message: string }[] }, success: string): string =>
  result.ok ? success : result.diagnostics?.map((entry) => entry.message).join(" ") ?? "The economy command failed safely.";

export function EconomyProgressionView(): React.JSX.Element {
  const economy = useMemo(() => createEconomyService({ initialBalance: 1_000 }), []);
  const [projection, setProjection] = useState<EconomyLedgerProjection>(() => economy.snapshot());
  const [settlement, setSettlement] = useState<DaySettlementSummary>();
  const [status, setStatus] = useState("Opening day is active. No full-day settlement, capability purchase, or reward purchase has occurred.");
  const refresh = (message: string): void => { setProjection(economy.snapshot()); setStatus(message); };

  const settle = (): void => {
    const result = economy.settleDay({ settlementId: "settlement:first-full-day", day: 1, tick: 300, summary: firstDaySummary, costs: [{ category: "operation", amount: 3, sourceId: "job:first-feeding", relatedIds: ["job:first-feeding"] }] });
    if (result.ok) setSettlement(result.value);
    refresh(resultMessage(result, "First full park day settled exactly. Rating, demand, revenue, costs, and net credits are inspectable below."));
  };
  const offerCapability = (): void => {
    const result = economy.markPressure({ capabilityId: "capability:context-optimization", tick: 301, pressureIds: ["pressure:missing-context"] });
    refresh(resultMessage(result, "Missing-context pressure made Context Optimization available. No credits were spent and the action is not enabled until purchase."));
  };
  const purchaseCapability = (): void => {
    const result = economy.purchaseCapability({ capabilityId: "capability:context-optimization", day: 2, tick: 302, commandId: "command:purchase-context-optimization" });
    refresh(resultMessage(result, "Context Optimization purchased intentionally. The real Workbench context-routing action is now enabled."));
  };
  const purchaseReward = (): void => {
    const result = economy.purchaseReward({ rewardId: "reward:dinosaur-plushie", day: 2, tick: 303, commandId: "command:purchase-plushie" });
    refresh(resultMessage(result, "Dinosaur Plushie purchased into the persistent reward inventory."));
  };
  const placeReward = (): void => {
    const item = economy.rewards().items[0];
    if (item === undefined) { refresh("Purchase the Dinosaur Plushie before placement."); return; }
    const result = economy.placeReward({ itemId: item.itemId, placementId: "placement:gift-shop-plushie", locationId: "location:gift-shop", tick: 304 });
    refresh(resultMessage(result, "Dinosaur Plushie placed at the gift shop. Visitors can see and use the display; the park receives no production multiplier."));
  };
  const removeReward = (): void => {
    const result = economy.removeReward({ placementId: "placement:gift-shop-plushie", tick: 305 });
    refresh(resultMessage(result, "Dinosaur Plushie removed from the gift-shop display and retained in persistent inventory."));
  };

  const capability = projection.progression.capabilities[0];
  const action = projection.progression.actions[0];
  const reward = projection.rewards.items[0];
  const placement = projection.rewards.placements.find((entry) => entry.removedTick === undefined);
  const rewardDefinition = DEFAULT_REWARD_DEFINITIONS[0];
  const configuredBase = import.meta.env?.BASE_URL ?? "/";
  const assetBase = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;

  return <section className="economy-experience" aria-labelledby="economy-heading">
    <header className="player-mode-frame"><div><p className="eyebrow">Park office · Production paused</p><h2 id="economy-heading">Day close &amp; park rewards</h2><p>Review today, choose one upgrade, then return to the park.</p></div><div className="player-mode-mark" aria-label="Current mode: economy and progression"><span aria-hidden="true">◇</span><span>DAY CLOSE</span></div></header>

    <section className="feature-card" aria-labelledby="settlement-heading">
      <h3 id="settlement-heading">First full park day</h3>
      <button type="button" onClick={settle}>Settle first full park day</button>
      {settlement === undefined ? <p>No settlement recorded.</p> : <>
        <dl className="status-grid"><div><dt>Rating</dt><dd>{settlement.rating.value} / 100</dd></div><div><dt>Visitor demand</dt><dd>{settlement.demand.demand}</dd></div><div><dt>Revenue</dt><dd>+{settlement.revenue} credits</dd></div><div><dt>Itemized costs</dt><dd>−{settlement.totalCosts} credits</dd></div><div><dt>Net day change</dt><dd>+{settlement.netChange} credits</dd></div><div><dt>Balance</dt><dd>{projection.balance} credits</dd></div></dl>
        <ul aria-label="Rating contributors">{settlement.rating.contributors.map((entry) => <li key={entry.id}><strong>{entry.label}</strong>: {entry.points} points · {entry.explanation}</li>)}</ul>
      </>}
    </section>

    <section className="feature-card" aria-labelledby="capability-heading">
      <h3 id="capability-heading">Park Developer capability</h3>
      <dl className="status-grid"><div><dt>Capability</dt><dd>{capability?.name}</dd></div><div><dt>Status</dt><dd>{capability?.status}</dd></div><div><dt>Purchase cost</dt><dd>{capability?.cost} credits</dd></div><div><dt>Action</dt><dd>{action?.available ? "Enabled" : "Unavailable until purchased"}</dd></div></dl>
      <div className="button-row"><button type="button" disabled={capability?.status !== "locked"} onClick={offerCapability}>Experience missing-context pressure</button><button type="button" disabled={capability?.status !== "available"} onClick={purchaseCapability}>Purchase Context Optimization · 25 credits</button>{action?.available ? <a className="button-link" href="/workbench?incident=incident%3Aopening-near-miss&trace=trace%3Aopening-feed-beta">Route maintenance Context in Workbench</a> : null}</div>
      <p>New capabilities become active only after you choose to purchase them.</p>
    </section>

    <section className="feature-card" aria-labelledby="reward-heading">
      <h3 id="reward-heading">Expressive reward inventory</h3>
      <dl className="status-grid"><div><dt>Reward</dt><dd>{rewardDefinition?.name}</dd></div><div><dt>Inventory</dt><dd>{reward?.status ?? "Not owned"}</dd></div><div><dt>Use</dt><dd>Park decoration</dd></div></dl>
      <div className="button-row"><button type="button" disabled={reward !== undefined} onClick={purchaseReward}>Purchase Dinosaur Plushie · 10 credits</button><button type="button" disabled={reward === undefined || reward.status === "placed"} onClick={placeReward}>Place at gift shop</button><button type="button" disabled={placement === undefined} onClick={removeReward}>Remove from gift shop</button></div>
      {placement === undefined ? <p>The gift-shop display is empty. Owned/removed inventory remains persisted in the Economy projection.</p> : <figure>
        <div role="img" aria-label="Placed Dinosaur Plushie at the gift shop, visible to visitors" style={{ width: 140, height: 140, backgroundImage: `url(${assetBase}assets/mvp-park/atlas.png)`, backgroundSize: "418px 418px", backgroundPosition: "-279px -279px", backgroundRepeat: "no-repeat" }} />
        <figcaption>Visitors browse the Dinosaur Plushie in the gift shop.</figcaption>
      </figure>}
      <details><summary>Advanced details</summary><p>Asset <code>{rewardDefinition?.assetId}@{rewardDefinition?.assetVersion}</code></p><p>Inventory schema <code>{projection.rewards.schemaVersion}</code> · {projection.rewards.items.length} item(s) · {projection.rewards.placements.length} placement record(s).</p></details>
    </section>
    <p className="safe-state" role="status" aria-live="polite">{status}</p>
  </section>;
}
