import assert from "node:assert/strict";
import test from "node:test";
import {
  INCIDENT_PARK_PERIOD,
  LATE_PARK_PERIOD,
  SAFE_PARK_PERIOD,
  createCreditLedger,
  createEconomyProgressionService,
  createProgressionService,
  createSettlementEngine,
  validateProgressEvent,
} from "../economy-progression/index.ts";
import { createEconomyProgressionProvider, getActiveEconomyProgressionService, setActiveEconomyProgressionService } from "../src/economy-progression/runtime.ts";

test("slice 1 settles safe, late, and incident periods deterministically", () => {
  const run = () => {
    const service = createEconomyProgressionService({ openingBalance: 0 });
    const safe = service.settle(SAFE_PARK_PERIOD);
    const late = service.settle(LATE_PARK_PERIOD);
    const incident = service.settle(INCIDENT_PARK_PERIOD);
    return { safe, late, incident, balance: service.balance(), ledger: service.ledger(), reconciliation: service.reconcile() };
  };
  assert.deepEqual(run(), run());
  const service = createEconomyProgressionService({ openingBalance: 0 });
  const safe = service.settle(SAFE_PARK_PERIOD);
  assert.equal(safe.ok, true);
  assert.ok(safe.lineItems.some((line) => line.id === "revenue.attendance" && line.amount > 0));
  assert.equal(service.settle(SAFE_PARK_PERIOD).duplicate, true);
  assert.equal(service.reconcile().reconciled, true);
  assert.equal(service.validateBalance().valid, true);
});

test("slice 1 rejects an overdrawn period atomically", () => {
  const ledger = createCreditLedger(0);
  const settlement = createSettlementEngine(ledger);
  const result = settlement.settle({ ...SAFE_PARK_PERIOD, periodId: "fixture.period.overdraw", attendance: 0, satisfaction: 0, uptime: 0, dinosaurHealth: 0, completedJobs: 0, failedJobs: 100, closures: 100, incidents: [] });
  assert.equal(result.ok, false);
  assert.equal(ledger.balance().amount, 0);
  assert.equal(ledger.ledger().length, 0);
});

test("slice 1 duplicate credit keys return the original result and never overdraw", () => {
  const ledger = createCreditLedger(10);
  const first = ledger.transact({ transactionId: "tx.one", type: "PURCHASE", amount: -10, sourceRef: "fixture", expectedBalanceVersion: 0 });
  const duplicate = ledger.transact({ transactionId: "tx.one", type: "PURCHASE", amount: -10, sourceRef: "fixture", expectedBalanceVersion: 0 });
  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(ledger.balance().amount, 0);
  assert.equal(ledger.transact({ transactionId: "tx.overdraw", type: "PURCHASE", amount: -1, sourceRef: "fixture", expectedBalanceVersion: 1 }).ok, false);
  assert.equal(ledger.balance().amount, 0);
});

test("slice 2 purchase commits a debit and entitlement exactly once", () => {
  const service = createEconomyProgressionService({ openingBalance: 1_000 });
  const before = service.balance();
  const first = service.purchase({ transactionId: "purchase.worker.1", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: before.version, expectedStateVersion: service.snapshot().stateVersion, logicalTime: 10 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.balance.amount, 300);
  assert.equal(first.entitlement.quantity, 1);
  const duplicate = service.purchase({ transactionId: "purchase.worker.1", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: before.version, expectedStateVersion: 0, logicalTime: 10 });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(service.balance().amount, 300);
  assert.equal(service.purchases().entitlements().entitlements.find((item) => item.id === "worker.robot")?.quantity, 1);
});

test("slice 2 rejects overdraw and stale balance/state races without partial effects", () => {
  const service = createEconomyProgressionService({ openingBalance: 500 });
  const versions = { balance: service.balance().version, state: service.snapshot().stateVersion };
  const overdraw = service.purchase({ transactionId: "purchase.worker.overdraw", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: versions.balance, expectedStateVersion: versions.state });
  assert.equal(overdraw.ok, false);
  if (!overdraw.ok) assert.equal(overdraw.error.code, "INSUFFICIENT_FUNDS");
  assert.deepEqual(service.balance(), { amount: 500, version: 0 });
  assert.equal(service.purchases().entitlements().entitlements.length, 0);

  const raceService = createEconomyProgressionService({ openingBalance: 700 });
  const first = raceService.purchase({ transactionId: "purchase.worker.race.1", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: 0, expectedStateVersion: 0 });
  assert.equal(first.ok, true);
  const second = raceService.purchase({ transactionId: "purchase.worker.race.2", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: 0, expectedStateVersion: 0 });
  assert.equal(second.ok, false);
  if (!second.ok) assert.ok(["BALANCE_VERSION_CONFLICT", "STATE_VERSION_CONFLICT", "INSUFFICIENT_FUNDS"].includes(second.error.code));
  assert.equal(raceService.purchases().entitlements().entitlements.find((item) => item.id === "worker.robot")?.quantity, 1);
});

test("slice 2 injected transaction failure leaves balance and entitlements unchanged", () => {
  const service = createEconomyProgressionService({ openingBalance: 1_000, beforePurchaseCommit: () => { throw new Error("injected failure"); } });
  const result = service.purchase({ transactionId: "purchase.injected", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: 0, expectedStateVersion: 0 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "TRANSACTION_FAILED");
  assert.deepEqual(service.balance(), { amount: 1_000, version: 0 });
  assert.equal(service.purchases().entitlements().entitlements.length, 0);
});

test("slice 3 advances authored Park Developer phases 0 through 7 in order", () => {
  const service = createEconomyProgressionService();
  assert.equal(service.snapshot().phase, 0);
  const signals = ["containment.pressure", "repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure", "review.pressure", "memory.pressure"];
  for (const [index, signal] of signals.entries()) {
    const eventId = `phase-gate-${index + 1}`;
    const first = service.process({ id: eventId, type: "METRIC", logicalTime: index + 1, signal });
    assert.equal(service.snapshot().phase, index + 1);
    assert.ok(first.every((event) => event.kind === "UNLOCK"));
    assert.deepEqual(service.process({ id: eventId, type: "METRIC", logicalTime: index + 1, signal }), []);
  }
  const snapshot = service.snapshot();
  assert.ok(snapshot.capabilities.includes("capability.prompt.basic"));
  assert.ok(snapshot.capabilities.includes("capability.skill.basic"));
  assert.ok(snapshot.capabilities.includes("capability.system-prompt"));
  assert.ok(snapshot.capabilities.includes("capability.evals"));
  assert.ok(snapshot.capabilities.includes("capability.review"));
  assert.ok(snapshot.capabilities.includes("capability.memory"));
  assert.equal(snapshot.unlocks.length, snapshot.capabilities.length);
});

test("slice 3 does not skip phases for out-of-order pressure signals", () => {
  const service = createEconomyProgressionService();
  service.process({ id: "late-memory", type: "METRIC", logicalTime: 1, signal: "memory.pressure" });
  assert.equal(service.snapshot().phase, 0);
  service.process({ id: "containment", type: "METRIC", logicalTime: 2, signal: "containment.pressure" });
  assert.equal(service.snapshot().phase, 1);
  for (const [index, signal] of ["repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure", "review.pressure"].entries()) service.process({ id: `ordered-${index}`, type: "METRIC", logicalTime: index + 3, signal });
  assert.equal(service.snapshot().phase, 7);
  assert.ok(service.snapshot().capabilities.includes("capability.memory"));
});

test("slice 4 worker purchases unlock parallelism and Manager at four workers", () => {
  const service = createEconomyProgressionService({ openingBalance: 7_000 });
  for (const [index, signal] of ["containment.pressure", "repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure", "review.pressure", "memory.pressure"].entries()) service.process({ id: `manager-phase-${index}`, type: "METRIC", logicalTime: index, signal });
  for (let index = 0; index < 3; index += 1) {
    const result = service.purchase({ transactionId: `worker-${index}`, itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: service.balance().version, expectedStateVersion: service.snapshot().stateVersion, logicalTime: index });
    assert.equal(result.ok, true);
  }
  assert.equal(service.snapshot().workerCount, 4);
  assert.ok(service.snapshot().phase >= 9);
  assert.ok(service.snapshot().capabilities.includes("manager.agent"));
  const canManager = service.can("manager.agent");
  assert.equal(canManager.eligible, true);
  const manager = service.purchase({ transactionId: "manager-1", itemId: "manager.agent", type: "MANAGER", amount: 3_500, expectedBalanceVersion: service.balance().version, expectedStateVersion: service.snapshot().stateVersion });
  assert.equal(manager.ok, true);
  assert.equal(service.purchases().entitlements().entitlements.find((item) => item.id === "manager.agent")?.quantity, 1);
});

test("slice 4 Manager can unlock through authored intervention threshold", () => {
  const service = createEconomyProgressionService({ openingBalance: 4_000 });
  for (const [index, signal] of ["containment.pressure", "repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure", "review.pressure", "memory.pressure"].entries()) service.process({ id: `intervention-phase-${index}`, type: "METRIC", logicalTime: index, signal });
  for (let index = 0; index < 12; index += 1) service.process({ id: `intervention-${index}`, type: "INTERVENTION", logicalTime: index, value: 1 });
  assert.ok(service.snapshot().interventions >= 12);
  assert.ok(service.snapshot().phase >= 9);
  assert.equal(service.can("manager.agent").eligible, true);
});

test("slice 4 context capacity purchase changes headroom only, not authored findings", () => {
  const service = createEconomyProgressionService({ openingBalance: 2_000 });
  for (const [index, signal] of ["containment.pressure", "repetition.pressure", "policy.pressure", "context.pressure"].entries()) service.process({ id: `capacity-phase-${index}`, type: "METRIC", logicalTime: index, signal });
  const before = service.snapshot();
  const beforeSignals = JSON.stringify(before.signals);
  const result = service.purchase({ transactionId: "capacity-1", itemId: "context.capacity.1", type: "CONTEXT_CAPACITY", amount: 900, expectedBalanceVersion: service.balance().version, expectedStateVersion: before.stateVersion });
  assert.equal(result.ok, true);
  assert.equal(service.snapshot().contextCapacity, 10_000);
  assert.equal(JSON.stringify(service.snapshot().signals), beforeSignals);
});

test("slice 5 recovery assistance restores an authored floor without double settlement", () => {
  const service = createEconomyProgressionService({ openingBalance: 0, recoveryPolicy: { floor: 250, assistanceAmount: 500 } });
  const result = service.settle({ ...INCIDENT_PARK_PERIOD, periodId: "recovery-period", logicalTime: 400 });
  assert.equal(result.ok, true);
  assert.ok(service.balance().amount >= 250);
  assert.equal(service.ledger({ type: "RECOVERY_ASSISTANCE" }).length, 1);
  const balanceAfter = service.balance();
  assert.equal(service.settle({ ...INCIDENT_PARK_PERIOD, periodId: "recovery-period", logicalTime: 400 }).duplicate, true);
  assert.deepEqual(service.balance(), balanceAfter);
  assert.equal(service.validateBalance().valid, true);
});

test("slice 5 eval build/run costs are ledger transactions while sandbox failures do not create incident costs", () => {
  const service = createEconomyProgressionService({ openingBalance: 5_000 });
  for (const [index, signal] of ["containment.pressure", "repetition.pressure", "policy.pressure", "context.pressure", "eval.pressure"].entries()) service.process({ id: `eval-phase-${index}`, type: "METRIC", logicalTime: index, signal });
  const built = service.purchase({ transactionId: "eval-build-1", itemId: "eval.build.default", type: "EVAL_BUILD", amount: 500, expectedBalanceVersion: service.balance().version, expectedStateVersion: service.snapshot().stateVersion });
  assert.equal(built.ok, true);
  const run = service.purchase({ transactionId: "eval-run-1", itemId: "eval.run.default", type: "EVAL_RUN", amount: 25, expectedBalanceVersion: service.balance().version, expectedStateVersion: service.snapshot().stateVersion });
  assert.equal(run.ok, true);
  assert.equal(service.ledger({ type: "EVAL_BUILD" }).length, 1);
  assert.equal(service.ledger({ type: "EVAL_RUN" }).length, 1);
  const before = service.balance().amount;
  const sandboxFailure = service.process({ id: "sandbox-failure", type: "JOB_RESULT", logicalTime: 9, signal: "sandbox-eval-failed" });
  assert.ok(sandboxFailure.length >= 0);
  assert.equal(service.balance().amount, before);
  assert.equal(service.ledger({ type: "INCIDENT_COST" }).length, 0);
});

test("QA: duplicate Worker purchase never increments progression Worker count", () => {
  const service = createEconomyProgressionService({ openingBalance: 2_000 });
  const command = { transactionId: "qa-worker-once", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: 0, expectedStateVersion: 0 } as const;
  assert.equal(service.purchase(command).ok, true);
  assert.equal(service.snapshot().workerCount, 2);
  const duplicate = service.purchase(command);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(service.snapshot().workerCount, 2);
});

test("QA: public progression CAS rejects a stale state version even when entitlement version matches", () => {
  const service = createEconomyProgressionService({ openingBalance: 2_000 });
  service.process({ id: "qa-progress-version", type: "METRIC", logicalTime: 1, signal: "containment.pressure" });
  assert.equal(service.snapshot().stateVersion, 1);
  assert.equal(service.purchases().entitlements().stateVersion, 0);
  const stale = service.purchase({ transactionId: "qa-stale-public-state", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: 0, expectedStateVersion: 0 });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "STATE_VERSION_CONFLICT");
  assert.equal(service.balance().amount, 2_000);
  assert.equal(service.snapshot().workerCount, 1);
});

test("QA: standalone ProgressionService enforces its own public CAS before delegation", () => {
  let delegated = 0;
  const progression = createProgressionService({ purchase: (command) => {
    delegated += 1;
    return { ok: false, transactionId: command.transactionId, error: { code: "TRANSACTION_FAILED", message: "not reached" }, balance: { amount: 0, version: 0 }, stateVersion: 0 };
  } });
  progression.process({ id: "standalone-version", type: "METRIC", logicalTime: 1, signal: "containment.pressure" });
  const stale = progression.purchase({ transactionId: "standalone-stale", itemId: "worker.robot", type: "WORKER", amount: 700, expectedBalanceVersion: 0, expectedStateVersion: 0 });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "STATE_VERSION_CONFLICT");
  assert.equal(delegated, 0);
});

test("QA: failed oversized recovery does not burn the successful retry marker", () => {
  const ledger = createCreditLedger(1);
  const oversized = ledger.applyRecovery(1, "qa-recovery", Number.MAX_SAFE_INTEGER);
  assert.equal(oversized?.ok, false);
  const retry = ledger.applyRecovery(2, "qa-recovery", 100);
  assert.equal(retry?.ok, true);
  assert.equal(ledger.balance().amount, 101);
});

test("QA: settlement rejects unsafe integer products without ledger effects", () => {
  const ledger = createCreditLedger(0);
  const settlement = createSettlementEngine(ledger);
  const unsafe = settlement.settle({ ...SAFE_PARK_PERIOD, periodId: "qa-unsafe-product", attendance: Number.MAX_SAFE_INTEGER });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.error?.code, "INVALID_COMMAND");
  assert.deepEqual(ledger.balance(), { amount: 0, version: 0 });
});

test("QA: invalid progress numerics are rejected without consuming the event id", () => {
  const service = createEconomyProgressionService();
  const before = service.snapshot();
  assert.equal(validateProgressEvent(null).valid, false);
  const invalidEvents = [
    { id: "bad-value", type: "METRIC", logicalTime: 1, signal: "containment.pressure", value: -1 },
    { id: "bad-time", type: "METRIC", logicalTime: 1.5, signal: "containment.pressure" },
    { id: "bad-worker", type: "METRIC", logicalTime: 1, workerCount: Number.POSITIVE_INFINITY },
    { id: "bad-signal", type: "METRIC", logicalTime: 1, signals: { "containment.pressure": Number.NaN } },
  ];
  for (const event of invalidEvents) {
    assert.equal(validateProgressEvent(event).valid, false);
    assert.deepEqual(service.process(event), []);
  }
  assert.deepEqual(service.snapshot(), before);
  assert.ok(service.process({ id: "bad-value", type: "METRIC", logicalTime: 2, signal: "containment.pressure", value: 1 }).length > 0);
});

test("QA: successful settlement deterministically updates progression and finance metrics once", () => {
  const service = createEconomyProgressionService({ openingBalance: 2_000 });
  const input = { ...LATE_PARK_PERIOD, periodId: "qa-settlement-progress", incidents: [{ id: "qa-near-miss", severity: 2 as const }] };
  assert.equal(service.settle(input).ok, true);
  const snapshot = service.snapshot();
  assert.ok(snapshot.signals["containment.pressure"] >= 1);
  assert.ok(snapshot.signals["repetition.pressure"] >= 1);
  assert.equal(snapshot.metrics.satisfaction, input.satisfaction);
  assert.equal(snapshot.metrics.reliability, input.uptime);
  const version = snapshot.stateVersion;
  assert.equal(service.settle(input).duplicate, true);
  assert.equal(service.snapshot().stateVersion, version);
});

test("QA: Finance/Progress read model is live, subscribable, and exposes every required surface", () => {
  const service = createEconomyProgressionService({ openingBalance: 2_000 });
  let notifications = 0;
  const unsubscribe = service.subscribe(() => { notifications += 1; });
  const initial = service.readModel();
  assert.equal(service.readModel(), initial);
  assert.ok(initial.investments.some((item) => item.status === "AVAILABLE"));
  assert.ok(initial.investments.some((item) => item.status === "LOCKED"));
  assert.ok(initial.capabilities.includes("capability.prompt.basic"));
  assert.ok(initial.unlocks.every((unlock) => unlock.reason.length > 0));
  assert.deepEqual(Object.keys(initial.metrics).sort(), ["efficiency", "interventions", "reliability", "safety", "satisfaction"]);

  assert.equal(service.settle(SAFE_PARK_PERIOD).ok, true);
  const updated = service.readModel();
  assert.notEqual(updated, initial);
  assert.ok(updated.settlementLineItems.length > 0);
  assert.ok(updated.recentLedger.length > 0);
  assert.ok(updated.objectives.includes("park-day.safe"));
  assert.ok(notifications > 0);
  unsubscribe();
});

test("QA: Finance/Progress provider owns the active live service lifecycle", () => {
  setActiveEconomyProgressionService(null);
  const service = createEconomyProgressionProvider();
  assert.equal(getActiveEconomyProgressionService(), service);
  setActiveEconomyProgressionService(null);
  assert.equal(getActiveEconomyProgressionService(), null);
});
