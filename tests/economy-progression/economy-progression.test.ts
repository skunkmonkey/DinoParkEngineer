import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateParkRating,
  createEconomyService,
  economyQuoteSchema,
  economyTransactionSchema,
  type EconomySource,
  type ParkDaySettlementInput,
} from "../../src/economy-progression/public.js";
import type { OperationalDaySummary } from "../../src/park-operations/public.js";
import type { StableId } from "../../src/simulation/public.js";

const id = (value: string): StableId => value as StableId;
const source = (value: string): EconomySource => ({ kind: "command", id: id(value) });

const summary = (overrides: Partial<OperationalDaySummary> = {}): OperationalDaySummary => ({
  id: id("day-summary:one"),
  day: 1,
  startTick: 0,
  endTick: 100,
  attendance: 10,
  departedVisitors: 10,
  completedJobIds: [id("job:feed")],
  failedJobIds: [],
  incidentIds: [],
  interventionCommandIds: [],
  ...overrides,
});

const day = (overrides: Partial<ParkDaySettlementInput> = {}): ParkDaySettlementInput => ({
  settlementId: "settlement:one",
  day: 1,
  tick: 100,
  summary: summary(),
  ...overrides,
});

test("ledger balance is derived from immutable transactions and batch failure is atomic", () => {
  const economy = createEconomyService({ initialBalance: 20 });
  const before = economy.snapshot();
  const first = economy.append({ id: "transaction:income", day: 1, tick: 1, amount: 8, category: "revenue", source: source("outcome:attendance") });
  assert.equal(first.ok, true);
  assert.equal(economy.snapshot().balance, 28);
  assert.equal(economy.snapshot().transactions[0]?.balanceBefore, 20);
  assert.equal(economy.snapshot().transactions[0]?.balanceAfter, 28);
  assert.equal(Object.isFrozen(economy.snapshot()), true);
  assert.equal(Object.isFrozen(economy.snapshot().transactions), true);
  assert.deepEqual(before.transactions, []);

  const failed = economy.appendBatch([
    { id: "transaction:charge-a", day: 1, tick: 2, amount: -18, category: "operation", source: source("job:a") },
    { id: "transaction:charge-b", day: 1, tick: 2, amount: -20, category: "maintenance", source: source("job:b") },
  ]);
  assert.equal(failed.ok, false);
  assert.equal(economy.snapshot().transactions.length, 1);
  assert.equal(economy.snapshot().balance, 28);

  const duplicate = economy.append({ id: "transaction:income", day: 1, tick: 1, amount: 8, category: "revenue", source: source("outcome:attendance") });
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.value.id, "transaction:income");
  assert.equal(economy.snapshot().transactions.length, 1);
  assert.deepEqual(economyTransactionSchema.parse(economy.snapshot().transactions[0]), economy.snapshot().transactions[0]);
});

test("quote reserve commit and cancel are atomic and idempotent", () => {
  const economy = createEconomyService({ initialBalance: 25 });
  const quoted = economy.quote({ id: "quote:runtime", category: "runtime", day: 1, tick: 2, amount: 10, source: source("job:runtime") });
  assert.equal(quoted.ok, true);
  if (!quoted.ok) return;
  assert.deepEqual(economyQuoteSchema.parse(quoted.value), quoted.value);
  const reserved = economy.reserve({ quote: quoted.value, reservationId: "reservation:runtime" });
  assert.equal(reserved.ok, true);
  assert.equal(economy.snapshot().balance, 25);
  assert.equal(economy.snapshot().reservedBalance, 10);
  assert.equal(economy.snapshot().availableBalance, 15);
  const reservedAgain = economy.reserve({ quote: quoted.value, reservationId: "reservation:runtime" });
  assert.equal(reservedAgain.ok, true);
  assert.equal(economy.snapshot().reservedBalance, 10);

  const committed = economy.commit("reservation:runtime", { day: 1, tick: 3, commandId: "command:runtime" });
  assert.equal(committed.ok, true);
  assert.equal(economy.snapshot().balance, 15);
  assert.equal(economy.snapshot().reservedBalance, 0);
  const committedAgain = economy.commit("reservation:runtime", { day: 1, tick: 3, commandId: "command:runtime" });
  assert.equal(committedAgain.ok, true);
  assert.equal(economy.snapshot().transactions.length, 1);

  const cancelledQuote = economy.quote({ id: "quote:cancel", category: "expression", day: 1, tick: 4, amount: 5, source: source("reward:sign") });
  assert.equal(cancelledQuote.ok, true);
  if (!cancelledQuote.ok) return;
  assert.equal(economy.reserve({ quote: cancelledQuote.value, reservationId: "reservation:cancel" }).ok, true);
  const cancelled = economy.cancel("reservation:cancel", { reason: "player-deferred" });
  assert.equal(cancelled.ok, true);
  assert.equal(economy.snapshot().availableBalance, 15);
  assert.equal(economy.cancel("reservation:cancel").ok, true);
  assert.equal(economy.commit("reservation:cancel").ok, false);

  const tooExpensive = economy.quote({ id: "quote:too-expensive", category: "expansion", day: 1, tick: 5, amount: 99, source: source("expansion:north") });
  assert.equal(tooExpensive.ok, true);
  if (tooExpensive.ok) assert.equal(economy.reserve(tooExpensive.value).ok, false);
});

test("day settlement derives inspectable rating, demand, revenue, itemized costs, and no double charge", () => {
  const economy = createEconomyService({ initialBalance: 10 });
  const first = economy.settleDay(day({
    costs: [{ category: "operation", amount: 3, sourceId: "job:feed", relatedIds: ["job:feed"] }],
  }));
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.revenue, 100);
  assert.equal(first.value.totalCosts, 3);
  assert.equal(first.value.netChange, 97);
  assert.equal(first.value.rating.value, 100);
  assert.equal(first.value.rating.contributors.length, 3);
  assert.deepEqual(first.value.rating.contributors.map((entry) => entry.category), ["safety", "guest-experience", "dinosaur-welfare"]);
  assert.equal(first.value.demand.demand, 100);
  assert.equal(economy.snapshot().balance, 107);
  assert.equal(economy.snapshot().transactions.length, 2);

  const repeated = economy.settleDay(day({
    costs: [{ category: "operation", amount: 999, sourceId: "job:changed" }],
  }));
  assert.equal(repeated.ok, true);
  if (repeated.ok) {
    assert.equal(repeated.value.idempotent, true);
    assert.equal(repeated.value.netChange, 97);
  }
  assert.equal(economy.snapshot().transactions.length, 2);

  const risky = calculateParkRating({
    summary: summary({
      id: id("day-summary:risky"),
      failedJobIds: [id("job:failed")],
      incidentIds: [id("incident:escape")],
      interventionCommandIds: [id("command:evacuate")],
    }),
    incidents: [{
      id: id("incident:escape"),
      status: "engineering-unresolved",
      detectedTick: 10,
      updatedTick: 10,
      causalKeys: ["gate"],
      spatialKeys: ["north"],
      locationId: id("location:north"),
      risk: 100,
      expected: "Containment",
      observed: ["Breach"],
      consequence: ["Closure"],
      immediateGap: ["Response"],
      entityIds: [id("gate:north")],
      traceIds: [id("trace:escape")],
      alertIds: [],
    }],
    outcomes: [{ id: "outcome:injury", kind: "visitor-injury", count: 1, sourceId: "incident:escape" }],
  });
  assert.ok(risky.value < 100);
  assert.ok(risky.contributors.find((entry) => entry.category === "safety")?.relatedIds?.includes("incident:escape"));
});

test("eval authoring charges once and later reruns use the cheaper eval-run category", () => {
  const economy = createEconomyService({ initialBalance: 100 });
  const authored = economy.authorEval({ evalId: "eval:gate", evalVersion: "1.0.0", day: 1, tick: 1 });
  assert.equal(authored.ok, true);
  if (!authored.ok) return;
  assert.equal(authored.value.charged, 20);
  assert.equal(authored.value.transaction?.category, "eval-build");
  assert.equal(economy.snapshot().balance, 80);

  const authoredAgain = economy.authorEval({ evalId: "eval:gate", evalVersion: "1.0.0", day: 1, tick: 2 });
  assert.equal(authoredAgain.ok, true);
  if (authoredAgain.ok) assert.equal(authoredAgain.value.charged, 0);
  assert.equal(economy.snapshot().balance, 80);

  const run = economy.runEval({ runId: "eval-run:first", evalId: "eval:gate", evalVersion: "1.0.0", day: 1, tick: 3 });
  assert.equal(run.ok, true);
  if (!run.ok) return;
  assert.equal(run.value.charged, 2);
  assert.equal(run.value.transaction?.category, "eval-run");
  const runAgain = economy.runEval({ runId: "eval-run:first", evalId: "eval:gate", evalVersion: "1.0.0", day: 1, tick: 4 });
  assert.equal(runAgain.ok, true);
  if (runAgain.ok) assert.equal(runAgain.value.idempotent, true);
  assert.equal(economy.snapshot().balance, 78);
  assert.equal(economy.snapshot().transactions.length, 2);
  assert.equal(economy.runEval({ runId: "eval-run:missing", evalId: "eval:missing", evalVersion: "1.0.0", day: 1, tick: 5 }).ok, false);
});
