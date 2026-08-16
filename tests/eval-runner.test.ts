import assert from "node:assert/strict";
import test from "node:test";
import {
  createEvalService,
  createMvpEvalCatalog,
  type EvalRef,
} from "../eval-runner/index.ts";
import { createContentRegistry, type ArtifactVersion, type EvalCaseDefinition } from "../content-registry/index.ts";
import { createContextService } from "../context/index.ts";
import { createCreditLedger, type CreditCommand, type CreditResult } from "../economy-progression/index.ts";
import { createStarterFixture, createSimulationEngine } from "../simulation/index.ts";
import { createReplayService, createTraceRepository } from "../trace-replay/index.ts";
import { createEvalProvider, createProductionEvalProvider, setActiveEvalService } from "../src/eval-runner/runtime.ts";
import { createTraceReplayProvider, setActiveTraceReplayRuntime } from "../src/trace-replay/runtime.ts";

const prompt: ArtifactVersion = {
  artifactId: "eval.test.prompt.feeding",
  version: 1,
  type: "PROMPT",
  title: "Standard Feeding",
  sourceText: "Feed Rex safely and secure containment.",
  clauses: [
    { id: "eval.test.move.service", sourceText: "Move to service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 } },
    { id: "eval.test.open", sourceText: "Open the gate.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma", order: 2 } },
    { id: "eval.test.enter", sourceText: "Enter.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior", order: 3 } },
    { id: "eval.test.feed", sourceText: "Feed Rex.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex", order: 4 } },
    { id: "eval.test.exit", sourceText: "Exit.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 5 } },
    { id: "eval.test.close", sourceText: "Close the gate.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 6 } },
    { id: "eval.test.lock", sourceText: "Lock the gate.", type: "ACTION", action: { tool: "lock_gate", gateId: "gate.gamma", order: 7 } },
    { id: "eval.test.goal", sourceText: "Rex is fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 10 },
    { id: "eval.test.post", sourceText: "Rex is contained.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 10 },
    { id: "eval.test.escalate", sourceText: "Alert security when the gate jams.", type: "ESCALATION", conditions: { failureCode: "JAMMED" }, action: { tool: "alert_security", severity: 4 }, priority: 100 },
  ],
  dependencies: [],
  applicabilityTags: [],
  requiredToolIds: ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"],
  status: "DEPLOYED",
  authoredByCapability: "eval.test",
  createdAtGameTime: 0,
};

function catalog(): readonly EvalCaseDefinition[] {
  const fixture = createStarterFixture();
  const standard = {
    id: "eval.test.standard-feeding",
    version: 1,
    title: "Standard Feeding",
    description: "Feed and secure Rex.",
    tags: ["feeding", "severity:2"],
    buildCostCredits: 200,
    runCostCredits: 5,
    fixture,
    seed: 7,
    subjectType: "PROMPT" as const,
    subjectRef: { artifactId: prompt.artifactId, version: 1 },
    assertions: [
      { type: "STATE_EQUALS" as const, path: "dinosaurs[2].hunger", expected: 28 },
      { type: "STATE_EQUALS" as const, path: "gates[2].state", expected: "LOCKED" },
      { type: "TOOL_CALLED" as const, toolId: "dispense_food" },
      { type: "TOOL_NOT_CALLED" as const, toolId: "rescue_visitors" },
      { type: "INCIDENT_MAX_SEVERITY" as const, maxSeverity: 3 },
      { type: "JOB_STATUS" as const, status: "SUCCEEDED" },
      { type: "TIME_BELOW" as const, limit: 100 },
      { type: "CONTEXT_BELOW" as const, limit: 8_000 },
    ],
  };
  const jamFixture = { ...fixture, faults: [{ id: "fault.gate-jam", logicalTime: 8, type: "GATE_JAM" as const, targetId: "gate.gamma" }] };
  const jam = { ...standard, id: "eval.test.gate-fails", title: "Gate Fails to Close", description: "Escalate when close fails.", fixture: jamFixture, assertions: [{ type: "JOB_STATUS" as const, status: "ESCALATED" }, { type: "TOOL_CALLED" as const, toolId: "alert_security" }] };
  return [standard, jam];
}

function setup() {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "eval.test", artifacts: [prompt] }).ok, true);
  const ledger = createCreditLedger(10_000);
  const traces = createTraceRepository();
  const service = createEvalService({ catalog: catalog(), registry, execution: { charge: ledger.transact, balance: ledger.balance, recordTrace: traces } });
  return { service, ledger, traces, registry };
}

test("eval slice 1 builds and runs Standard Feeding with visible assertions", async () => {
  const { service, ledger } = setup();
  const ref: EvalRef = { id: "eval.test.standard-feeding", version: 1 };
  const build = service.build(ref, "build.standard");
  assert.equal(build.ok, true);
  const run = await service.run({ transactionId: "run.standard", evalRefs: [ref] });
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0]?.status, "PASSED", JSON.stringify(run.results[0]));
  assert.equal(run.results[0]?.assertions.length, 8);
  assert.equal(run.results[0]?.fixtureId, "fixture.starter");
  assert.equal(run.results[0]?.seed, 7);
  assert.equal(ledger.ledger({ type: "EVAL_BUILD" }).length, 1);
  assert.equal(ledger.ledger({ type: "EVAL_RUN" }).length, 1);
});

test("eval slice 1 exposes an exact replay manifest for Standard Feeding", async () => {
  const { service, registry } = setup();
  const ref: EvalRef = { id: "eval.test.standard-feeding", version: 1 };
  assert.equal(service.build(ref, "build.replay").ok, true);
  const run = await service.run({ transactionId: "run.replay", evalRefs: [ref] });
  const manifest = run.results[0]?.replayManifest;
  assert.ok(manifest);
  const replay = await createReplayService({ content: registry, context: createContextService(), simulationFactory: () => createSimulationEngine() }).replay(manifest!);
  assert.equal(replay.status, "EXACT", JSON.stringify(replay.firstDifference));
});

test("eval slice 2 supports every assertion and exact rerun", async () => {
  const { service } = setup();
  const ref: EvalRef = { id: "eval.test.standard-feeding", version: 1 };
  assert.equal(service.build(ref, "build.assertions").ok, true);
  const first = await service.run({ transactionId: "run.exact", evalRefs: [ref] });
  const second = await service.run({ transactionId: "run.exact", evalRefs: [ref] });
  assert.deepEqual(second.results[0], first.results[0]);
  assert.equal(first.results[0]?.assertions.every((assertion) => assertion.evidenceRefs !== undefined), true);
});

test("eval slice 3 isolates Gate Fails to Close, supports suites and overrides", async () => {
  const { service, ledger } = setup();
  const standard: EvalRef = { id: "eval.test.standard-feeding", version: 1 };
  const jam: EvalRef = { id: "eval.test.gate-fails", version: 1 };
  assert.equal(service.build(standard, "build.suite.standard").ok, true);
  assert.equal(service.build(jam, "build.suite.jam").ok, true);
  assert.equal(service.createSuite({ id: "suite.feeding", title: "Feeding safety", evalRefs: [standard, jam] }).ok, true);
  const preview = service.preview({ suiteId: "suite.feeding", overrides: { remove: [standard] } });
  assert.deepEqual(preview.evalRefs, [jam]);
  assert.equal(preview.totalRunCostCredits, 5);
  const live = createSimulationEngine();
  assert.equal(live.load(createStarterFixture(), 7).ok, true);
  const before = live.canonicalSnapshot();
  const result = await service.run({ transactionId: "run.jam", suiteId: "suite.feeding", overrides: { remove: [standard] } });
  assert.equal(result.results[0]?.status, "PASSED", JSON.stringify(result.results[0]));
  assert.equal(result.results[0]?.passed, true);
  assert.equal(live.canonicalSnapshot(), before);
  assert.equal(ledger.ledger({ type: "EVAL_RUN" }).length, 1);
});

test("eval slice 4 exposes the 12-case catalog and stable suite order", () => {
  const entries = createEvalService({ catalog: createMvpEvalCatalog() }).catalog();
  assert.ok(entries.length >= 12);
  assert.deepEqual(entries.map((entry) => `${entry.ref.id}@${entry.ref.version}`), [...entries].map((entry) => `${entry.ref.id}@${entry.ref.version}`).sort());
  assert.ok(entries.some((entry) => entry.definition.tags.includes("severity:4")));
});

test("eval slice 5 converts a reconstructable incident atomically", () => {
  const { service, ledger } = setup();
  const converted = service.fromIncident({ incidentId: "incident.gate-77", fixture: createStarterFixture(), seed: 7, subjectType: "PROMPT", subjectRef: { artifactId: prompt.artifactId, version: 1 }, assertions: [{ type: "JOB_STATUS", status: "SUCCEEDED" }], transactionId: "build.incident.77" });
  assert.equal(converted.ok, true);
  if (converted.ok) assert.equal(service.catalog({ tag: "regression" }).length, 1);
  assert.equal(ledger.ledger({ type: "EVAL_BUILD" }).length, 1);
  const unavailable = service.fromIncident({ incidentId: "incident.missing", seed: 7, subjectType: "PROMPT", assertions: [{ type: "JOB_STATUS", status: "SUCCEEDED" }], transactionId: "build.incident.missing" });
  assert.equal(unavailable.ok, false);
  assert.equal(ledger.ledger({ type: "EVAL_BUILD" }).length, 1);
});

test("QA: production provider wires a real registry and isolated execution so Standard Feeding runs", async () => {
  setActiveEvalService(null);
  const service = createEvalProvider({ openingCredits: 5_000 });
  const standard = service.catalog({ id: "eval.standard-feeding" })[0];
  assert.ok(standard);
  assert.equal(service.build(standard.ref, "provider.build.standard").ok, true);
  const run = await service.run({ transactionId: "provider.run.standard", evalRefs: [standard.ref] });
  assert.equal(run.results[0]?.status, "PASSED", run.results[0]?.error);
  assert.ok(run.results[0]?.traceRef);
  assert.ok(run.results[0]?.replayManifest?.expectedTraceEvents?.length);
  setActiveEvalService(null);
});

test("QA: production shared Trace runtime replays Standard Feeding exactly and missing content stays unavailable", async () => {
  setActiveEvalService(null);
  setActiveTraceReplayRuntime(null);
  const traceRuntime = createTraceReplayProvider();
  const ledger = createCreditLedger(5_000);
  const evalService = createProductionEvalProvider({ traces: traceRuntime, economy: { transact: ledger.transact, balance: ledger.balance } });
  const standard = evalService.catalog({ id: "eval.standard-feeding" })[0];
  assert.ok(standard);
  assert.equal(evalService.build(standard.ref, "production.replay.build").ok, true);
  const run = await evalService.run({ transactionId: "production.replay.run", evalRefs: [standard.ref] });
  assert.equal(run.results[0]?.status, "PASSED", JSON.stringify(run.results[0]));
  const manifest = run.results[0]?.replayManifest;
  assert.ok(manifest);
  const replay = await traceRuntime.replay.replay(manifest);
  assert.equal(replay.status, "EXACT", JSON.stringify(replay.firstDifference));

  const missingRuntime = createTraceReplayProvider({ content: createContentRegistry(), context: createContextService() });
  const unavailable = await missingRuntime.replay.replay(manifest);
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.match(unavailable.unavailableReason ?? "", /MISSING_ARTIFACT_VERSION/);
  setActiveEvalService(null);
  setActiveTraceReplayRuntime(null);
});

test("QA: production provider runs Gate Fails to Close through the real escalation path", async () => {
  setActiveEvalService(null);
  const service = createEvalProvider({ openingCredits: 5_000 });
  const gateFailure = service.catalog({ id: "eval.gate-fails-to-close" })[0];
  assert.ok(gateFailure);
  assert.equal(service.build(gateFailure.ref, "provider.build.gate-failure").ok, true);
  const run = await service.run({ transactionId: "provider.run.gate-failure", evalRefs: [gateFailure.ref] });
  assert.equal(run.results[0]?.status, "PASSED", JSON.stringify(run.results[0]));
  assert.equal(run.results[0]?.assertions.every((assertion) => assertion.passed), true);
  assert.equal(run.results[0]?.replayManifest?.seed, gateFailure.definition.seed);
  setActiveEvalService(null);
});

test("QA: forged successful credit results cannot build or run an eval", async () => {
  const makeResult = (command: CreditCommand, sourceRef = command.sourceRef): CreditResult => ({
    ok: true,
    balance: { amount: 9_000, version: 1 },
    entry: {
      id: `ledger.${command.transactionId}`,
      type: command.type,
      amount: command.amount,
      logicalTime: command.logicalTime ?? 0,
      sourceRef,
      idempotencyKey: command.transactionId,
      postBalance: 9_000,
      balanceVersion: 1,
    },
  });
  const ref = { id: "eval.test.standard-feeding", version: 1 };
  const rejectedBuild = createEvalService({ catalog: catalog(), execution: { balance: () => ({ amount: 10_000, version: 0 }), charge: (command) => makeResult(command, "eval-build:wrong@1") } });
  const build = rejectedBuild.build(ref, "forged.build");
  assert.equal(build.ok, false);
  if (!build.ok) assert.equal(build.error.code, "INVALID_TRANSACTION");
  assert.equal(rejectedBuild.catalog({ id: ref.id })[0]?.built, false);

  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "eval.test.forged", artifacts: [prompt] }).ok, true);
  const service = createEvalService({ catalog: catalog(), registry, execution: {
    balance: () => ({ amount: 10_000, version: 0 }),
    charge: (command) => makeResult(command, command.type === "EVAL_RUN" ? "eval-run:wrong@1" : command.sourceRef),
  } });
  assert.equal(service.build(ref, "valid.build").ok, true);
  const run = await service.run({ transactionId: "forged.run", evalRefs: [ref] });
  assert.equal(run.results[0]?.status, "BLOCKED_CREDIT");
  assert.match(run.results[0]?.error ?? "", /source/i);
});

test("QA: credit-port crashes return blocked results without mutating eval state", async () => {
  const ref = { id: "eval.test.standard-feeding", version: 1 };
  let chargeCalls = 0;
  const service = createEvalService({ catalog: catalog(), execution: {
    balance: () => { throw new Error("ledger offline"); },
    charge: () => { chargeCalls += 1; throw new Error("must not be reached"); },
  } });
  const build = service.build(ref, "crash.build");
  assert.equal(build.ok, false);
  if (!build.ok) assert.equal(build.error.code, "TRANSACTION_FAILED");
  assert.equal(service.catalog({ id: ref.id })[0]?.built, false);
  assert.equal(chargeCalls, 0);
});

test("QA: one build transaction cannot unlock two eval refs or float across service state", () => {
  const { service, ledger, registry } = setup();
  const first = { id: "eval.test.standard-feeding", version: 1 };
  const second = { id: "eval.test.gate-fails", version: 1 };
  assert.equal(service.build(first, "build.bound").ok, true);
  const reused = service.build(second, "build.bound");
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.error.code, "INVALID_TRANSACTION");
  assert.equal(service.catalog({ id: second.id })[0]?.built, false);
  assert.equal(ledger.ledger({ type: "EVAL_BUILD" }).length, 1);

  const restarted = createEvalService({ catalog: catalog(), registry, execution: { charge: ledger.transact, balance: ledger.balance } });
  const replayed = restarted.build(second, "build.bound");
  assert.equal(replayed.ok, false);
  if (!replayed.ok) assert.match(replayed.error.message, /source|bound/i);
  assert.equal(restarted.catalog({ id: second.id })[0]?.built, false);
});

test("QA: unavailable subjects block before a run charge", async () => {
  const { service, ledger } = setup();
  const ref = { id: "eval.test.standard-feeding", version: 1 };
  assert.equal(service.build(ref, "build.unavailable").ok, true);
  const before = ledger.ledger({ type: "EVAL_RUN" }).length;
  const run = await service.run({ transactionId: "run.unavailable", evalRefs: [ref], subjectRef: { artifactId: "missing.subject", version: 9 } });
  assert.equal(run.results[0]?.status, "BLOCKED_INPUT");
  assert.match(run.results[0]?.error ?? "", /unavailable/);
  assert.equal(ledger.ledger({ type: "EVAL_RUN" }).length, before);
});

test("QA: partial batches retain an explicit BLOCKED_INPUT result for every invalid case", async () => {
  const { service } = setup();
  const valid = { id: "eval.test.standard-feeding", version: 1 };
  const invalid = { id: "eval.unknown", version: 77 };
  assert.equal(service.build(valid, "build.partial").ok, true);
  const run = await service.run({ transactionId: "run.partial", evalRefs: [valid, invalid] });
  assert.equal(run.results.length, 2);
  assert.equal(run.results[0]?.status, "PASSED");
  assert.equal(run.results[1]?.status, "BLOCKED_INPUT");
  assert.equal(run.results[1]?.reasonCode, "INVALID_CASE_REF");
  assert.match(run.results[1]?.error ?? "", /not in the catalog/);
  assert.equal(run.partial, true);
});

test("QA: incident conversion is idempotent and retains exact artifact provenance", () => {
  const { service, ledger } = setup();
  const manifest = {
    schemaVersion: 1,
    id: "incident.manifest.exact",
    fixture: createStarterFixture(),
    fixtureRef: "fixture.starter",
    seed: 7,
    artifactRefs: [{ artifactId: prompt.artifactId, version: 1 }],
    job: { id: "incident.job", type: "FEED", targetRefs: ["dino.rex"], priority: 1, dueTime: 10, assignedAgentId: "agent.keeper01", promptRef: { artifactId: prompt.artifactId, version: 1 } },
  } as const;
  const input = { incidentId: "incident.exact", manifest, subjectType: "PROMPT" as const, assertions: [{ type: "JOB_STATUS" as const, status: "SUCCEEDED" }], transactionId: "incident.build.exact" };
  const first = service.fromIncident(input);
  const duplicate = service.fromIncident(input);
  const alternateTransaction = service.fromIncident({ ...input, transactionId: "incident.build.retry" });
  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, true);
  assert.equal(alternateTransaction.ok, true);
  if (first.ok && duplicate.ok && alternateTransaction.ok) {
    assert.equal(duplicate.value.ref.id, first.value.ref.id);
    assert.equal(alternateTransaction.value.ref.id, first.value.ref.id);
    assert.deepEqual(first.value.artifactRefs, manifest.artifactRefs);
    assert.equal(first.value.replayManifest?.id, manifest.id);
  }
  assert.equal(service.catalog({ tag: "regression" }).length, 1);
  assert.equal(ledger.ledger({ type: "EVAL_BUILD" }).length, 1);
  const changed = service.fromIncident({ ...input, assertions: [{ type: "JOB_STATUS", status: "FAILED" }], transactionId: "incident.build.changed" });
  assert.equal(changed.ok, false);
  if (!changed.ok) assert.equal(changed.error.code, "INVALID_INCIDENT");
  const reused = service.fromIncident({ ...input, incidentId: "incident.other", transactionId: "incident.build.exact" });
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.error.code, "INVALID_TRANSACTION");
});
