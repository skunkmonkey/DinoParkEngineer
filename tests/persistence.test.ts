import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createAutosaveScheduler,
  createBrowserSaveRepository,
  createMemorySaveRepository,
  createMemoryStorage,
  createMigrationRunner,
  createMemoryStateAdapter,
  createSaveService,
  createSimulationStateAdapter,
  createContentRegistryStateAdapter,
  createStandardAdapterSet,
  createTransactionCoordinator,
  createTraceStateAdapter,
  makeEnvelope,
  stableHash,
} from "../persistence/index.ts";
import type { SaveResult, SaveService } from "../persistence/index.ts";
import { createSimulationEngine, createStarterFixture } from "../simulation/index.ts";
import { createContentRegistry } from "../content-registry/index.ts";
import { CURRICULUM_CONTENT_PACK } from "../curriculum-content/index.ts";
import { createMemoryService } from "../memory/index.ts";
import { createTraceRepository } from "../trace-replay/index.ts";
import { createTraceReplayProvider } from "../src/trace-replay/runtime.ts";
import { createEconomyProgressionService } from "../economy-progression/index.ts";
import { createEvalService } from "../eval-runner/index.ts";
import { createParkOperationsService } from "../park-operations/index.ts";
import { createProductionReviewProvider } from "../src/review-deployment/runtime.ts";
import { createProductionPersistenceProvider } from "../src/persistence/runtime.ts";
import type { CurriculumRuntime } from "../src/curriculum-content/runtime.ts";
import type { ContextService } from "../context/index.ts";

function simulationService(seed = 7) {
  const simulation = createSimulationEngine();
  const loaded = simulation.load(createStarterFixture(), seed);
  assert.equal(loaded.ok, true);
  const adapter = createSimulationStateAdapter(simulation);
  const service = createSaveService({ adapters: [adapter], repository: createMemorySaveRepository(), idFactory: () => "save.test", clock: () => "2026-01-01T00:00:00.000Z" });
  return { simulation, adapter, service };
}

test("slice 1: simulation save/load preserves exact snapshot and continued replay", async () => {
  const original = simulationService();
  const before = original.simulation.snapshot();
  await original.simulation.advanceTo(5);
  const savedHash = original.simulation.canonicalSnapshot();
  const save = await original.service.save("manual");
  assert.equal(save.ok, true);
  original.simulation.advanceTo(20);
  const activeBeforeFailedLoad = original.simulation.canonicalSnapshot();
  const loaded = await original.service.load("manual");
  assert.equal(loaded.ok, true);
  assert.equal(original.simulation.canonicalSnapshot(), savedHash);
  const expected = createSimulationEngine();
  assert.equal(expected.load(createStarterFixture(), 7).ok, true);
  assert.equal(expected.restore(before).ok, true);
  expected.advanceTo(5);
  assert.equal(expected.canonicalSnapshot(), savedHash);
  // Failed load keeps the active current session byte-for-byte intact.
  const badRepo = createMemorySaveRepository({ failureInjector: (phase) => { if (phase === "before-verify") throw new Error("injected"); } });
  const badService = createSaveService({ adapters: [original.adapter], repository: badRepo });
  assert.equal((await badService.load("manual")).ok, false);
  assert.equal(original.simulation.canonicalSnapshot(), savedHash);
  assert.notEqual(activeBeforeFailedLoad, savedHash);
});

test("completion gate: full park snapshot retains logical clock, PRNG, and historical content refs", async () => {
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 31).ok, true);
  const registry = createContentRegistry();
  const pack = registry.loadPack(CURRICULUM_CONTENT_PACK);
  assert.equal(pack.ok, true);
  const service = createSaveService({ adapters: [createSimulationStateAdapter(simulation), createContentRegistryStateAdapter(registry)], repository: createMemorySaveRepository(), idFactory: () => "full-park", clock: () => "x" });
  simulation.advanceTo(6);
  const before = simulation.snapshot();
  const beforeHash = simulation.canonicalSnapshot();
  assert.equal((await service.save("manual")).ok, true);
  simulation.advanceTo(12);
  assert.equal((await service.load("manual")).ok, true);
  assert.equal(simulation.canonicalSnapshot(), beforeHash);
  assert.equal(simulation.snapshot().logicalTime, before.logicalTime);
  assert.equal(simulation.snapshot().prngState, before.prngState);
  assert.ok(registry.getArtifact({ artifactId: "artifact.curriculum.skill.safe-carnivore-feeding", version: 2 }));
  assert.equal(service.canonicalStateHash(), stableHash({ "content-registry": createContentRegistryStateAdapter(registry).canonicalHash(createContentRegistryStateAdapter(registry).snapshot()), simulation: createSimulationStateAdapter(simulation).canonicalHash(simulation.snapshot()) }));
});

test("slice 2: atomic autosave coalesces requests and recovers browser backup", async () => {
  const { service } = simulationService();
  const autosave = createAutosaveScheduler(service, { intervalSeconds: 10 });
  const first = autosave.request("deployment");
  const second = autosave.request("purchase");
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.equal(autosave.status().writing, false);
  const storage = createMemoryStorage();
  const repo = createBrowserSaveRepository({ storage });
  const envelope = makeEnvelope({ formatVersion: 1, metadata: { saveId: "a", slot: "auto", createdAt: "x", updatedAt: "x" }, manifest: { buildId: "test", schemas: {} }, features: {} });
  await repo.write("auto", envelope);
  const next = makeEnvelope({ ...envelope, metadata: { ...envelope.metadata, saveId: "b" } });
  await repo.write("auto", next);
  assert.equal((await repo.backup("auto"))?.envelope.metadata.saveId, "a");
  assert.equal((await repo.recover("auto"))?.envelope.metadata.saveId, "b");
  let injected = false;
  const interrupted = createMemorySaveRepository({ failureInjector: (phase) => { if (phase === "before-active" && injected) { injected = false; throw new Error("interrupted"); } } });
  await interrupted.write("manual", envelope);
  injected = true;
  await assert.rejects(() => interrupted.write("manual", next));
  assert.equal((await interrupted.recover("manual"))?.envelope.metadata.saveId, "a");
  const quota = createMemorySaveRepository({ maxBytes: 10 });
  await assert.rejects(() => quota.write("manual", envelope));
  assert.equal(await quota.recover("manual"), undefined);
});

test("adversarial: autosave requests queued during a write receive the follow-up result", async () => {
  let callCount = 0;
  let releaseFirst: ((result: SaveResult) => void) | undefined;
  const service = {
    save: async (slot: "auto" = "auto"): Promise<SaveResult> => {
      callCount += 1;
      if (callCount === 1) return new Promise((resolve) => { releaseFirst = resolve; });
      return { ok: true, slot, saveId: "follow-up" };
    },
  } as SaveService;
  const autosave = createAutosaveScheduler(service);
  const first = autosave.request("first");
  await Promise.resolve();
  const queued = autosave.request("queued");
  await Promise.resolve();
  assert.equal(callCount, 1);
  releaseFirst?.({ ok: true, slot: "auto", saveId: "in-flight" });
  assert.equal((await first).saveId, "in-flight");
  assert.equal((await queued).saveId, "follow-up");
  assert.equal(callCount, 2);
});

test("slice 3: historical adapters are validated and staged before activation", async () => {
  let current = { value: 1 };
  let shouldFail = false;
  const adapter = { id: "fixture", schemaVersion: 1, snapshot: () => ({ ...current }), validate: (value: unknown) => typeof value === "object" && value !== null ? { ok: true as const, value: value as { value: number } } : { ok: false as const, error: [{ code: "INVALID_TYPE", path: "$", message: "not object" }] }, restore: (value: { value: number }) => { if (shouldFail) throw new Error("restore failed"); current = { ...value }; }, canonicalHash: (value: { value: number }) => stableHash(value) } as const;
  const service = createSaveService({ adapters: [adapter], repository: createMemorySaveRepository(), idFactory: () => "fixture", clock: () => "x" });
  assert.equal((await service.save("manual")).ok, true);
  current = { value: 9 }; shouldFail = true;
  const failed = await service.load("manual");
  assert.equal(failed.ok, false);
  assert.equal(current.value, 9);
});

test("adversarial: memory and trace restores replace state instead of merging", async () => {
  const memory = createMemoryService();
  memory.record({ id: "memory.saved", scope: "SHARED", observedAt: 1, provenance: "test", content: "saved", contextCost: 1 });
  const traces = createTraceRepository();
  const savedTrace = traces.begin({ traceId: "trace.saved", startLogicalTime: 1 });
  traces.finalize(savedTrace, { status: "SUCCEEDED", reasonCode: "DONE" });
  const service = createSaveService({ adapters: [createMemoryStateAdapter(memory.repository()), createTraceStateAdapter(traces)], repository: createMemorySaveRepository() });
  assert.equal((await service.save("manual")).ok, true);
  memory.record({ id: "memory.extra", scope: "SHARED", observedAt: 2, provenance: "test", content: "extra", contextCost: 1 });
  const extraTrace = traces.begin({ traceId: "trace.extra", startLogicalTime: 2 });
  traces.finalize(extraTrace, { status: "FAILED", reasonCode: "EXTRA" });
  assert.equal((await service.load("manual")).ok, true);
  assert.deepEqual(memory.repository().list().map((record) => record.id), ["memory.saved"]);
  assert.deepEqual(traces.records().map((record) => record.header.traceId), ["trace.saved"]);
});

test("adversarial: unsafe boundaries, unavailable historical refs, and repository read failures are actionable", async () => {
  let value = { logicalTime: 4, marker: "saved" };
  let awaited = false;
  const adapter = { id: "state", schemaVersion: 1, snapshot: () => ({ ...value }), validate: (candidate: unknown) => candidate && typeof candidate === "object" ? { ok: true as const, value: candidate as typeof value } : { ok: false as const, error: [{ code: "INVALID_TYPE", path: "$", message: "invalid" }] }, restore: (candidate: typeof value) => { value = { ...candidate }; }, canonicalHash: stableHash, references: () => ["artifact.missing@1"] };
  const repository = createMemorySaveRepository();
  const service = createSaveService({ adapters: [adapter], repository, boundary: { awaitSafePoint: async () => { awaited = true; }, isSafe: () => awaited }, resolveContentRef: () => false });
  assert.equal((await service.save("manual")).ok, true, "safe point must be awaited before checking safety");
  value = { logicalTime: 8, marker: "current" };
  const rejected = await service.load("manual");
  assert.equal(rejected.error?.code, "REFERENCE_INVALID");
  assert.equal(value.marker, "current", "reference validation occurs before live mutation");
  const preview = await service.previewImport(await repository.export("manual"));
  assert.equal(preview.ok, false);
  if (!preview.ok) assert.equal(preview.error.code, "REFERENCE_INVALID");
  const unavailable = createSaveService({ adapters: [adapter], repository: { ...repository, read: async () => { throw new Error("device offline"); }, recover: async () => { throw new Error("backup offline"); } } });
  const failed = await unavailable.load("manual");
  assert.equal(failed.error?.code, "STORAGE_UNAVAILABLE");
  assert.match(failed.error?.message ?? "", /read or recovered/i);
  let paused = false;
  const interrupted = createSaveService({ adapters: [], repository: { ...repository, write: async () => { throw new Error("interrupted"); } }, boundary: { awaitSafePoint: async () => { const previous = paused; paused = true; return () => { paused = previous; }; }, isSafe: () => paused } });
  assert.equal((await interrupted.save("manual")).ok, false);
  assert.equal(paused, false, "safe-boundary release restores prior pause state after write failure");
});

test("production provider registers every live state owner and commits nonempty full-park state", async () => {
  const traces = createTraceReplayProvider();
  const registry = traces.content as ReturnType<typeof createContentRegistry>;
  const context = traces.context as ContextService;
  const economy = createEconomyProgressionService();
  const evals = createEvalService({ registry });
  const reviews = createProductionReviewProvider({ registry, context, evals, economy });
  const park = createParkOperationsService({ traces: traces.repository, content: registry, context, economy });
  let curriculumState = { currentPhase: 0, maxUnlockedPhase: 0, interventions: 0, completedScenarioIds: [], incidentIds: [], unlockedArtifactRefs: [] } as const;
  const curriculum = { director: { state: () => curriculumState, restore: (next: typeof curriculumState) => { curriculumState = next; } } } as unknown as CurriculumRuntime;
  const repository = createMemorySaveRepository();
  const runtime = createProductionPersistenceProvider({ park, economy, evals, reviews, traces, curriculum }, { repository, idFactory: () => "production-full", clock: () => "2026-01-01T00:00:00.000Z", autosaveIntervalSeconds: 2 });
  assert.deepEqual(runtime.service.adapters().map((adapter) => adapter.id), ["agents", "content-registry", "curriculum", "deployments", "economy", "evals", "memory", "operations", "simulation", "traces"]);
  const result = await runtime.service.save("manual");
  assert.equal(result.ok, true, JSON.stringify(result));
  const record = await repository.read("manual");
  assert.ok(record);
  assert.equal(Object.keys(record.envelope.features).length, 10);
  assert.ok((record.envelope.features.simulation?.value as { dinosaurs?: readonly unknown[] }).dinosaurs?.length);
  assert.ok(record.envelope.features.economy?.canonicalHash);
  assert.equal(park.getControlState().paused, false, "production saves restore the player's prior running state");
  const savedHash = runtime.service.canonicalStateHash();
  park.advanceTo(3);
  await runtime.autosave.flush();
  assert.ok(await repository.read("auto"), "logical-time advancement without world events triggers periodic autosave");
  assert.notEqual(runtime.service.canonicalStateHash(), savedHash);
  const loaded = await runtime.service.load("manual");
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  assert.equal(runtime.service.canonicalStateHash(), savedHash);
  const economyBeforeFailure = stableHash(economy.persistenceSnapshot());
  const transaction = await runtime.workflows?.eval("production.eval.rollback", () => {
    const balance = economy.balance();
    const credit = economy.transact({ transactionId: "production.eval.credit", type: "RECOVERY_ASSISTANCE", amount: 10, sourceRef: "test", expectedBalanceVersion: balance.version, logicalTime: park.snapshot().logicalTime });
    assert.equal(credit.ok, true);
    throw new Error("injected eval record failure");
  });
  assert.equal(transaction?.ok, false);
  assert.equal(stableHash(economy.persistenceSnapshot()), economyBeforeFailure, "production workflow rollback restores every participant exactly");
  const submitted = reviews.reviews.submit({ id: "production.review", baseRef: { artifactId: "review.skill.carnivore-feeding", version: 3 }, proposedRef: { artifactId: "review.skill.carnivore-feeding", version: 4 }, author: "player", goal: "Deploy the safer feeding skill.", createdAtGameTime: park.snapshot().logicalTime });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) throw new Error("production review submission failed");
  const evalRef = { id: "eval.standard-feeding", version: 1 } as const;
  const selected = reviews.reviews.selectEvals({ reviewId: submitted.value.reviewId, expectedReviewVersion: submitted.value.version, evalRefs: [evalRef] });
  assert.equal(selected.ok, true);
  if (!selected.ok) throw new Error("production eval selection failed");
  const buildTransaction = await runtime.workflows?.eval("production.ui.eval-build", () => { const outcome = evals.build(evalRef, "production.ui.eval-build.domain"); if (!outcome.ok) throw new Error(outcome.error.message); return outcome; });
  assert.equal(buildTransaction?.ok, true);
  const runTransaction = await runtime.workflows?.eval("production.ui.eval-run", () => evals.run({ evalRefs: [evalRef], subject: { type: "PROMPT", ref: submitted.value.proposedRef }, transactionId: "production.ui.eval-run.domain" }));
  assert.equal(runTransaction?.ok, true);
  const evalRun = runTransaction?.value;
  assert.ok(evalRun);
  const attached = reviews.reviews.attachRun({ reviewId: submitted.value.reviewId, expectedReviewVersion: selected.value.version, results: evalRun.results });
  assert.equal(attached.ok, true);
  if (!attached.ok) throw new Error("production eval attachment failed");
  const assessment = reviews.deployments.validate(attached.value.reviewId);
  assert.equal(assessment.valid, true);
  const deployTransaction = await runtime.workflows?.deploy("production.ui.deploy", () => { const outcome = reviews.deployments.deploy({ reviewId: attached.value.reviewId, expectedReviewVersion: attached.value.version, acknowledgeWarningCodes: assessment.warnings.map((warning) => warning.code), transactionId: "production.ui.deploy.domain" }); if (!outcome.ok) throw new Error(outcome.error.message); return outcome; });
  assert.equal(deployTransaction?.ok, true);
  assert.equal(runtime.autosave.status().lastReason, "major:deployment");
  const deployed = deployTransaction?.value;
  assert.ok(deployed);
  const revertTransaction = await runtime.workflows?.deploy("production.ui.revert", () => { const outcome = reviews.deployments.revert({ artifactId: deployed.value.artifactId, targetRef: { artifactId: "review.skill.carnivore-feeding", version: 3 }, expectedDeploymentVersion: deployed.value.version, transactionId: "production.ui.revert.domain" }); if (!outcome.ok) throw new Error(outcome.error.message); return outcome; });
  assert.equal(revertTransaction?.ok, true);
  assert.equal(reviews.deployments.records().length, 2);
  runtime.dispose();
});

test("production player actions enter persistence workflows before mutating transactional domains", () => {
  const evalRoute = readFileSync(new URL("../src/eval-runner/EvalsRoute.tsx", import.meta.url), "utf8");
  assert.match(evalRoute, /workflows\.eval\(transactionId[\s\S]*service\.build/);
  assert.match(evalRoute, /workflows\.eval\(transactionId[\s\S]*service\.run/);
  const workbenchRoute = readFileSync(new URL("../src/engineering-workbench/EngineeringWorkbenchRoute.tsx", import.meta.url), "utf8");
  assert.match(workbenchRoute, /workflows\.commission\(tx[\s\S]*service\.commission/);
  const reviewRoute = readFileSync(new URL("../src/review-deployment/ReviewsRoute.tsx", import.meta.url), "utf8");
  assert.match(reviewRoute, /workflows\.deploy\(transactionId[\s\S]*deployments\.deploy/);
  assert.match(reviewRoute, /workflows\.deploy\(transactionId[\s\S]*deployments\.revert/);
});

test("slice 3: standard adapter registry covers economy, agents/jobs, context, evals, reviews/deployments, traces, and curriculum", () => {
  const ids = ["economy", "operations", "context", "evals", "deployments", "curriculum", "orchestration"] as const;
  const ports = Object.fromEntries(ids.map((id) => [id, { snapshot: () => ({ id, historicalRef: `${id}@1` }), restore: () => undefined }])) as Record<string, { snapshot: () => unknown; restore: (value: unknown) => void }>;
  const standard = createStandardAdapterSet({ economy: ports.economy, operations: ports.operations, context: ports.context, evals: ports.evals, deployments: ports.deployments, curriculum: ports.curriculum, orchestration: ports.orchestration, featureStatePorts: { "custom-feature": ports.context } });
  assert.deepEqual(standard.adapters.map((adapter) => adapter.id), [...ids, "custom-feature"].sort());
  for (const adapter of standard.adapters) assert.equal(adapter.validate(adapter.snapshot()).ok, true);
});

test("slice 4: transaction coordinator commits once and restores pre-state on every failure", async () => {
  let value = 0;
  const participant = { id: "counter", snapshot: () => value, restore: (old: unknown) => { value = old as number; }, commit: (id: string) => { if (id === "fail") throw new Error("commit failure"); } };
  const transactions = createTransactionCoordinator();
  const committed = await transactions.execute("ok", [participant], () => { value = 3; return "done"; });
  assert.equal(committed.status, "COMMITTED"); assert.equal(value, 3);
  const duplicate = await transactions.execute("ok", [participant], () => { value = 4; return "wrong"; });
  assert.equal(duplicate.status, "DUPLICATE"); assert.equal(value, 3);
  const failed = await transactions.execute("fail", [participant], () => { value = 9; return "never"; });
  assert.equal(failed.ok, false); assert.equal(value, 3);
  for (const phase of ["prepare", "work", "commit"] as const) {
    let injectedPhase: string = phase;
    const participantWithFailure = {
      id: `phase-${phase}`, snapshot: () => value, restore: (old: unknown) => { value = old as number; },
      prepare: () => { if (injectedPhase === "prepare") throw new Error("prepare failure"); },
      commit: () => { if (injectedPhase === "commit") throw new Error("commit failure"); },
    };
    const before: number = value;
    const result = await transactions.execute(`phase-${phase}`, [participantWithFailure], () => { if (injectedPhase === "work") throw new Error("work failure"); value += 100; return value; });
    assert.equal(result.ok, false); assert.equal(value, before);
    injectedPhase = "none";
  }
});

test("adversarial: transactions reject participants without reversible checkpoints before work", async () => {
  const transactions = createTransactionCoordinator();
  for (const participant of [
    { id: "missing-checkpoint", restore: () => undefined },
    { id: "missing-restore", snapshot: () => ({ value: 1 }) },
  ]) {
    let executed = false;
    const result = await transactions.execute(participant.id, [participant], () => { executed = true; });
    assert.equal(result.ok, false);
    assert.equal(result.status, "ROLLED_BACK");
    assert.equal(result.error?.code, "INVALID_VALUE");
    assert.equal(executed, false);
  }
});

test("adversarial: an undefined checkpoint is present state and is restored on failure", async () => {
  const transactions = createTransactionCoordinator();
  let restored = false;
  let restoredValue: unknown = "not-called";
  const result = await transactions.execute("undefined-checkpoint", [{ id: "optional-state", checkpoint: () => undefined, recover: (value) => { restored = true; restoredValue = value; } }], () => { throw new Error("injected"); });
  assert.equal(result.ok, false);
  assert.equal(restored, true);
  assert.equal(restoredValue, undefined);
});

test("slice 5: migrations are sequential, future/corrupt/oversize imports are rejected", async () => {
  const old = makeEnvelope({ formatVersion: 1, metadata: { saveId: "old", slot: "manual", createdAt: "x", updatedAt: "x" }, manifest: { buildId: "test", schemas: {} }, features: {} });
  const runner = createMigrationRunner(3, [
    { id: "one", fromVersion: 1, toVersion: 2, migrate: (source) => ({ ...source, formatVersion: 2 }) },
    { id: "two", fromVersion: 2, toVersion: 3, migrate: (source) => ({ ...source, formatVersion: 3 }) },
  ]);
  const originalBytes = JSON.stringify(old);
  assert.equal(runner.run(old).ok, true);
  assert.equal(JSON.stringify(old), originalBytes, "migration must not mutate source bytes");
  assert.equal(runner.run({ ...old, formatVersion: 4 }).error?.code, "FUTURE_VERSION");
  const service = createSaveService({ adapters: [], repository: createMemorySaveRepository(), maxImportBytes: 100 });
  assert.equal((await service.previewImport(new Blob(["{}"]))).ok, false);
  assert.equal((await service.previewImport(new Blob([JSON.stringify({ ...old, checksum: "tampered" })]))).ok, false);
  const importService = createSaveService({ adapters: [], repository: createMemorySaveRepository() });
  const exportedEnvelope = makeEnvelope({ formatVersion: 1, metadata: { saveId: "export", slot: "manual", createdAt: "x", updatedAt: "x" }, manifest: { buildId: "test", schemas: {} }, features: {} });
  const exported = new Blob([JSON.stringify(exportedEnvelope)], { type: "application/json" });
  assert.equal((await importService.import(exported, { slot: "auto" })).ok, false);
  assert.equal((await importService.import(exported, { slot: "auto", confirm: true })).ok, true);
  assert.equal((await importService.load("auto")).ok, true);
});
