import assert from "node:assert/strict";
import test from "node:test";

import {
  commitPortableImport,
  canonicalSaveSerialize,
  createAutosaveCoordinator,
  createAsyncPersistenceCoordinator,
  createInMemorySaveRepository,
  createLegacyV0Fixture,
  createMemorySessionPort,
  createPersistenceCoordinator,
  createPersistenceFoundationFixture,
  createSaveEnvelope,
  exportPersistenceDiagnostics,
  exportPortableSave,
  inspectPortableSave,
  loadLastKnownGood,
  migrateSave,
  validateSaveEnvelope,
  type AsyncSaveRepository,
  type MvpCompositeState,
  type PersistenceRepositoryResult,
  type PersistenceSession,
  type SaveEnvelope,
} from "../../src/persistence/public.js";

const fixture = (): { readonly session: PersistenceSession; readonly envelope: SaveEnvelope } => {
  const base = createPersistenceFoundationFixture();
  const mvp: MvpCompositeState = {
    schemaVersion: "1",
    memory: { records: [{ id: "memory:incident", version: "1", text: "Gate inspection complete" }] },
    evals: { assets: [{ id: "eval:gate", version: "2" }], results: [{ id: "result:gate", passed: true }] },
    workbench: { artifactId: "prompt:keeper", draftVersion: "3" },
    reviews: { records: [{ id: "review:3", decision: "approved", deploymentVersion: "3" }] },
    deployments: { active: "2", history: [{ action: "deploy", from: "1", to: "2" }, { action: "revert", from: "3", to: "2" }] },
    economy: { money: 1250, rating: 87 },
    incidents: { records: [{ id: "incident:gate", status: "resolved" }] },
    response: { suspensions: [{ agentId: "agent:keeper", lifted: true }] },
    progression: { level: 4, unlocked: ["evals", "review"] },
    rewards: { earned: ["reward:first-revert"] },
    curriculum: { completed: ["lesson:exact-versions"] },
    consent: { researchTelemetry: false },
  };
  const session = { ...base.session, mvp };
  return {
    session,
    envelope: createSaveEnvelope({ id: "save:mvp", applicationVersion: "test", createdAt: "2026-01-01T00:00:00.000Z", contentManifest: base.contentManifest, session }),
  };
};

test("complete MVP composite and deploy/revert history round-trip exactly", () => {
  const { envelope, session } = fixture();
  assert.equal(validateSaveEnvelope(envelope).ok, true);
  const repository = createInMemorySaveRepository();
  assert.equal(repository.stage(envelope).ok, true);
  assert.equal(repository.promote(envelope.id).ok, true);
  const restored = repository.read(envelope.id);
  assert.deepEqual(restored?.sections.mvp?.data, session.mvp);
  assert.deepEqual(restored?.sections.mvp?.data.deployments, session.mvp?.deployments);
  const active = createMemorySessionPort({ ...session, mvp: { ...session.mvp, deployments: { active: "99", history: [] } } as MvpCompositeState });
  const loaded = createPersistenceCoordinator({ repository, session: active }).load(envelope.id);
  assert.equal(loaded.ok, true);
  assert.deepEqual(active.snapshot().mvp, session.mvp);
});

test("portable export/import validates in quarantine and never overwrites a conflict", () => {
  const { envelope } = fixture();
  const exported = exportPortableSave(envelope);
  const inspected = inspectPortableSave(exported);
  assert.equal(inspected.ok, true);
  assert.equal(canonicalSaveSerialize(inspected.envelope), canonicalSaveSerialize(envelope));
  assert.equal(inspectPortableSave(exported, [envelope.id]).diagnostics[0]?.code, "PERSISTENCE_IMPORT_CONFLICT");
  const tampered = exported.replace("Gate inspection complete", "Gate inspection failed");
  assert.equal(inspectPortableSave(tampered).diagnostics[0]?.code, "PERSISTENCE_IMPORT_QUARANTINED");
  const repository = createInMemorySaveRepository();
  assert.equal(commitPortableImport(inspected, repository).ok, true);
  assert.equal(canonicalSaveSerialize(repository.read(envelope.id)), canonicalSaveSerialize(envelope));
  assert.equal(repository.remove(envelope.id, false).diagnostics[0]?.code, "PERSISTENCE_DELETE_CONFIRMATION_REQUIRED");
});

test("schema 0 migration is deterministic, preserves original bytes, and validates before commit", () => {
  const { envelope } = fixture();
  const legacy = createLegacyV0Fixture(envelope);
  const original = JSON.stringify(legacy);
  const migrated = migrateSave(original);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.originalBackup, original);
  assert.equal(migrated.audit?.stepId, "persistence:0-to-1-preferences-and-mvp");
  assert.equal(validateSaveEnvelope(migrated.envelope).ok, true);
  assert.deepEqual(migrated.envelope?.sections.preferences.data, envelope.sections.preferences.data);
  assert.equal(migrateSave({ schemaVersion: "9", saveSchemaVersion: "9" }).diagnostics[0]?.code, "PERSISTENCE_MIGRATION_STEP_MISSING");
  const badLegacy = { ...(legacy as Record<string, unknown>), accessibilityPreferences: { textScale: 99 } };
  assert.equal(migrateSave(badLegacy).ok, false);
});

test("autosave accepts safe checkpoints, coalesces queued ticks, and exposes quota/abort failures", async () => {
  const { envelope, session } = fixture();
  const memory = createInMemorySaveRepository();
  let stages = 0;
  let unblock: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { unblock = resolve; });
  const asyncRepository: AsyncSaveRepository = {
    stage: async (value): Promise<PersistenceRepositoryResult> => { stages += 1; if (stages === 1) await gate; return memory.stage(value); },
    promote: async (id) => memory.promote(id),
    read: async (id) => { const value = memory.read(id); return value === undefined ? { ok: false, diagnostics: [] } : { ok: true, envelope: value }; },
    list: async () => memory.list(), remove: async (id, confirmed) => memory.remove(id, confirmed), knownGoodId: async () => memory.knownGoodId(), discardStaleStages: async () => ({ ok: true, diagnostics: [] }),
  };
  const sessionPort = createMemorySessionPort(session);
  const autosave = createAutosaveCoordinator({ repository: asyncRepository, session: sessionPort, now: () => "2026-01-01T00:00:00.000Z" });
  const request = { id: envelope.id, applicationVersion: "test", createdAt: envelope.createdAt, contentManifest: envelope.contentManifest, session };
  const first = autosave.request({ safe: true, tick: session.world.tick, request });
  const duplicate = autosave.request({ safe: true, tick: session.world.tick, request });
  unblock?.();
  assert.equal((await first).ok, true);
  assert.equal((await duplicate).ok, true);
  assert.equal(stages, 1);

  const quotaRepository: AsyncSaveRepository = { ...asyncRepository, stage: async () => ({ ok: false, diagnostics: [{ code: "PERSISTENCE_QUOTA_EXCEEDED", path: "repository", rule: "capacity", message: "Quota exceeded; known-good retained." }] }) };
  const quota = await createAutosaveCoordinator({ repository: quotaRepository, session: sessionPort }).request({ safe: true, tick: session.world.tick, request });
  assert.equal(quota.ok, false);
  if (!quota.ok) assert.equal(quota.diagnostics[0]?.code, "PERSISTENCE_QUOTA_EXCEEDED");
  assert.equal(canonicalSaveSerialize(loadLastKnownGood(memory)), canonicalSaveSerialize(envelope));
});

test("portable boundary rejects platform paths and diagnostics retain recovery material", () => {
  const { envelope, session } = fixture();
  const badSession = { ...session, mvp: { ...session.mvp, workbench: { sourcePath: "C:\\Users\\park\\draft.txt" } } as MvpCompositeState };
  const bad = createSaveEnvelope({ id: "save:bad-path", contentManifest: envelope.contentManifest, session: badSession });
  const result = validateSaveEnvelope(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((entry) => entry.code === "PERSISTENCE_PORTABLE_DATA_INVALID"), true);
  const diagnosticExport = exportPersistenceDiagnostics({ saveId: bad.id, originalBackup: "original-save-bytes", diagnostics: result.diagnostics, knownGood: envelope });
  assert.equal(diagnosticExport.includes("original-save-bytes"), true);
  assert.equal(diagnosticExport.includes(envelope.integrity.fingerprint), true);
});

test("async restoration preserves the active session for abort, truncation, corruption, and stale-stage faults", async () => {
  const { envelope, session } = fixture();
  const active = createMemorySessionPort(session);
  const before = active.snapshot();
  const fault = (code: "PERSISTENCE_TRANSACTION_ABORTED" | "PERSISTENCE_TRUNCATED_RECORD" | "PERSISTENCE_CORRUPT_RECORD" | "PERSISTENCE_STALE_STAGING"): PersistenceRepositoryResult => ({ ok: false, diagnostics: [{ code, path: "repository", rule: "fault injection", message: code }] });
  const repository = (code: "PERSISTENCE_TRANSACTION_ABORTED" | "PERSISTENCE_TRUNCATED_RECORD" | "PERSISTENCE_CORRUPT_RECORD" | "PERSISTENCE_STALE_STAGING"): AsyncSaveRepository => ({
    stage: async () => ({ ok: true, diagnostics: [] }),
    promote: async () => fault(code),
    read: async () => ({ ok: false, diagnostics: fault(code).diagnostics }),
    list: async () => [],
    remove: async () => fault(code),
    knownGoodId: async () => envelope.id,
    discardStaleStages: async () => fault(code),
  });
  for (const code of ["PERSISTENCE_TRANSACTION_ABORTED", "PERSISTENCE_TRUNCATED_RECORD", "PERSISTENCE_CORRUPT_RECORD"] as const) {
    const loaded = await createAsyncPersistenceCoordinator({ repository: repository(code), session: active }).load(envelope.id);
    assert.equal(loaded.ok, false);
    if (!loaded.ok) assert.equal(loaded.diagnostics[0]?.code, code);
    assert.deepEqual(active.snapshot(), before);
  }
  const stale = await repository("PERSISTENCE_STALE_STAGING").discardStaleStages("2026-01-02T00:00:00.000Z");
  assert.equal(stale.diagnostics[0]?.code, "PERSISTENCE_STALE_STAGING");
});
