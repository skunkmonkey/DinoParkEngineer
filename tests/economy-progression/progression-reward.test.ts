import assert from "node:assert/strict";
import test from "node:test";

import {
  createEconomyService,
  economyLedgerProjectionSchema,
} from "../../src/economy-progression/public.js";

test("capability availability follows pressure and purchase creates a concrete action", () => {
  const economy = createEconomyService({ initialBalance: 100 });
  const before = economy.progression().capabilities[0];
  assert.equal(before?.status, "locked");
  assert.equal(economy.availableActions()[0]?.available, false);

  const offered = economy.markPressure({ capabilityId: "capability:context-optimization", pressureIds: ["pressure:missing-context"], tick: 10 });
  assert.equal(offered.ok, true);
  assert.equal(economy.progression().capabilities[0]?.status, "available");
  assert.equal(economy.snapshot().balance, 100);

  const purchased = economy.purchaseCapability({ capabilityId: "capability:context-optimization", day: 1, tick: 11, commandId: "command:buy-context" });
  assert.equal(purchased.ok, true);
  assert.equal(economy.progression().capabilities[0]?.status, "purchased");
  assert.deepEqual(economy.availableActions().map((action) => action.id), ["action:route-context"]);
  assert.equal(economy.availableActions()[0]?.available, true);
  assert.equal(economy.snapshot().balance, 75);
  const repeated = economy.purchaseCapability({ capabilityId: "capability:context-optimization", day: 1, tick: 12 });
  assert.equal(repeated.ok, true);
  assert.equal(economy.snapshot().balance, 75);
});

test("approved plushie reward has exact asset identity, persisted inventory, and no mechanical bonus", () => {
  const economy = createEconomyService({ initialBalance: 50 });
  const purchased = economy.purchaseReward({ rewardId: "reward:dinosaur-plushie", day: 1, tick: 20, commandId: "command:buy-plushie" });
  assert.equal(purchased.ok, true);
  if (!purchased.ok) return;
  assert.equal(purchased.value.status, "owned");
  assert.equal(economy.snapshot().rewards.items[0]?.rewardId, "reward:dinosaur-plushie");
  assert.equal(economy.snapshot().transactions.find((transaction) => transaction.category === "expression")?.id, purchased.value.purchaseTransactionId);

  const placed = economy.placeReward({ itemId: purchased.value.itemId, placementId: "placement:gift-shop", locationId: "location:gift-shop", tick: 21 });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.value.assetId, "assets:reward-dinosaur-plushie");
  assert.equal(placed.value.visibleToVisitors, true);
  assert.equal(economy.snapshot().rewards.items[0]?.status, "placed");
  assert.equal(economy.snapshot().rewards.placements[0]?.locationId, "location:gift-shop");

  const removed = economy.removeReward({ placementId: placed.value.placementId, tick: 22 });
  assert.equal(removed.ok, true);
  assert.equal(economy.snapshot().rewards.items[0]?.status, "removed");
  assert.equal(economy.snapshot().rewards.placements[0]?.removedTick, 22);
  assert.equal(economy.snapshot().balance, 40);
  assert.equal(economy.snapshot().progression.capabilities.length, 1);
  assert.equal(economy.snapshot().rewards.items[0]?.rewardId, "reward:dinosaur-plushie");
  assert.equal(economy.snapshot().rewards.placements[0]?.assetVersion, "1.0.0");
  assert.deepEqual(economyLedgerProjectionSchema.parse(economy.snapshot()), economy.snapshot());
});

test("an incident day records pressure without silently purchasing a capability", () => {
  const economy = createEconomyService({ initialBalance: 10 });
  const summary = {
    id: "summary:pressure-day",
    day: 1,
    startTick: 0,
    endTick: 10,
    attendance: 1,
    departedVisitors: 1,
    completedJobIds: [],
    failedJobIds: ["job:failed"],
    incidentIds: ["incident:near-miss"],
    interventionCommandIds: [],
  } as const;
  const settled = economy.settleDay({ settlementId: "settlement:pressure-day", day: 1, tick: 10, summary, costs: [] });
  assert.equal(settled.ok, true);
  assert.equal(economy.progression().pressureIds.includes("pressure:missing-context"), true);
  assert.equal(economy.progression().capabilities[0]?.status, "available");
  assert.equal(economy.snapshot().balance, 20);
});
