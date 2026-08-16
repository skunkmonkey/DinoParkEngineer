import { deepClone } from "./canonical.ts";
import { canonicalFeatureHash, decodeEnvelope, makeEnvelope, rebindEnvelopeSlot, validateFeatureSections } from "./envelope.ts";
import { createBrowserSaveRepository, createMemorySaveRepository } from "./repository.ts";
import { createMigrationRunner } from "./migrations.ts";
import type {
  FeatureStateAdapter,
  ImportError,
  ImportPreview,
  LoadResult,
  PersistenceOptions,
  SaveEnvelope,
  SaveError,
  SaveManifest,
  SaveRecord,
  SaveResult,
  SaveService,
  SaveSlot,
  StateDiagnostic,
} from "./types.ts";

/* Save coordination erases feature-owned state types only after each adapter
 * validates its own versioned section. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const DEFAULT_BUILD = Object.freeze({ buildId: "dino-park-engineer", schemas: Object.freeze({}) });

function saveError(code: SaveError["code"], message: string, slot?: SaveSlot, diagnostics?: readonly StateDiagnostic[], cause?: unknown): SaveError {
  return Object.freeze({ code, message, ...(slot ? { slot } : {}), ...(diagnostics ? { diagnostics } : {}), ...(cause !== undefined ? { cause: cause instanceof Error ? cause.message : String(cause) } : {}) });
}

function randomId(): string {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `save-${random}`;
}

export function createSaveService(options: PersistenceOptions = {}): SaveService {
  const repository = options.repository ?? (typeof window !== "undefined" ? createBrowserSaveRepository({ maxBytes: options.maxImportBytes }) : createMemorySaveRepository({ maxBytes: options.maxImportBytes }));
  const formatVersion = options.formatVersion ?? 1;
  const maxImportBytes = options.maxImportBytes ?? 4 * 1024 * 1024;
  const migrationRunner = createMigrationRunner(formatVersion, options.migrations ?? [], maxImportBytes);
  const adaptersById = new Map<string, FeatureStateAdapter<any>>();
  for (const adapter of options.adapters ?? []) adaptersById.set(adapter.id, adapter);
  let lastError: SaveError | undefined;

  const now = options.clock ?? (() => new Date().toISOString());
  const idFactory = options.idFactory ?? randomId;
  const manifest: SaveManifest = Object.freeze({ ...DEFAULT_BUILD, ...(options.buildManifest ?? {}), schemas: Object.freeze({ ...DEFAULT_BUILD.schemas, ...(options.buildManifest?.schemas ?? {}) }) });

  function adapterList(): readonly FeatureStateAdapter<any>[] { return Object.freeze([...adaptersById.values()].sort((a, b) => a.id.localeCompare(b.id))); }
  function collect(slot: SaveSlot): SaveEnvelope {
    const timestamp = now();
    const features: Record<string, { readonly schemaVersion: number; readonly value: unknown; readonly canonicalHash: string; readonly references?: readonly string[] }> = {};
    const refs = new Set<string>();
    let logicalTime: number | undefined;
    for (const adapter of adapterList()) {
      const value = deepClone(adapter.snapshot());
      const validation = adapter.validate(value);
      if (!validation.ok) throw Object.assign(new Error(`Feature ${adapter.id} snapshot is invalid.`), { diagnostics: validation.error });
      if (logicalTime === undefined && validation.value && typeof validation.value === "object" && typeof (validation.value as { logicalTime?: unknown }).logicalTime === "number") logicalTime = (validation.value as { logicalTime: number }).logicalTime;
      const references = adapter.references?.(validation.value) ?? [];
      references.forEach((ref) => refs.add(ref));
      features[adapter.id] = Object.freeze({ schemaVersion: adapter.schemaVersion, value: validation.value, canonicalHash: adapter.canonicalHash(validation.value), ...(references.length > 0 ? { references: [...references].sort() } : {}) });
    }
    return makeEnvelope({ formatVersion, metadata: { saveId: idFactory(), slot, createdAt: timestamp, updatedAt: timestamp, ...(logicalTime === undefined ? {} : { logicalTime }) }, manifest, features, contentRefs: [...refs] });
  }
  function stateHash(): string { return canonicalFeatureHash(adapterList()); }
  function recordError(error: SaveError): SaveResult { lastError = error; return { ok: false, slot: (error.slot ?? "manual") as SaveSlot, error }; }

  async function save(slot: SaveSlot = "manual"): Promise<SaveResult> {
    let releaseSafePoint: void | (() => void | Promise<void>) = undefined;
    try {
      releaseSafePoint = await options.boundary?.awaitSafePoint?.();
      if (options.boundary?.isSafe && !options.boundary.isSafe()) return recordError(saveError("WRITE_INTERRUPTED", "Save could not reach a simulation safe boundary.", slot, undefined));
      const envelope = collect(slot);
      await repository.write(slot, envelope);
      lastError = undefined;
      return { ok: true, slot, saveId: envelope.metadata.saveId, logicalTime: envelope.metadata.logicalTime, canonicalStateHash: canonicalFeatureHash(adapterList()) };
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      const code: SaveError["code"] = /quota|exceed/i.test(message) ? "STORAGE_QUOTA" : /safe boundary/i.test(message) ? "WRITE_INTERRUPTED" : "STORAGE_UNAVAILABLE";
      return recordError(saveError(code, `Could not save ${slot}.`, slot, undefined, thrown));
    } finally {
      await releaseSafePoint?.();
    }
  }

  async function readAndMigrate(slot: SaveSlot): Promise<{ readonly envelope?: SaveEnvelope; readonly record?: SaveRecord; readonly fromVersion?: number; readonly error?: SaveError }> {
    let record: SaveRecord | undefined;
    try { record = await repository.read(slot) ?? await repository.recover(slot); }
    catch (thrown) { return { error: saveError("STORAGE_UNAVAILABLE", `Save slot “${slot}” could not be read or recovered. Retry, export another slot, or continue without loading.`, slot, undefined, thrown) }; }
    if (!record) return { error: saveError("NOT_FOUND", `No valid save exists in slot “${slot}”.`, slot) };
    const decoded = decodeEnvelope(record.raw, maxImportBytes);
    if (!decoded.ok) return { error: saveError("INVALID_ENVELOPE", `Save in slot “${slot}” failed validation.`, slot, decoded.error) };
    const migrated = migrationRunner.run(decoded.value);
    if (!migrated.ok || !migrated.value) return { error: { ...migrated.error!, slot } };
    return { envelope: migrated.value, record, ...(migrated.fromVersion !== undefined ? { fromVersion: migrated.fromVersion } : {}) };
  }

  async function load(slot: SaveSlot): Promise<LoadResult> {
    const staged = await readAndMigrate(slot);
    if (!staged.envelope) { lastError = staged.error; return { ok: false, slot, error: staged.error }; }
    const validated = validateFeatureSections(staged.envelope, adapterList());
    if (!validated.ok) { const error = saveError("SCHEMA_INVALID", `Save in slot “${slot}” contains invalid feature state.`, slot, validated.error); lastError = error; return { ok: false, slot, error }; }
    const missingRefs = options.resolveContentRef ? staged.envelope.contentRefs.filter((ref) => !options.resolveContentRef!(ref)) : [];
    if (missingRefs.length > 0) { const error = saveError("REFERENCE_INVALID", `Save references unavailable historical content: ${missingRefs.join(", ")}.`, slot, missingRefs.map((ref) => ({ code: "INVALID_REFERENCE", path: "contentRefs", message: `Historical content ${ref} is unavailable.` }))); lastError = error; return { ok: false, slot, error }; }
    const oldValues = new Map<string, unknown>();
    for (const adapter of adapterList()) oldValues.set(adapter.id, deepClone(adapter.snapshot()));
    const restored: FeatureStateAdapter<any>[] = [];
    try {
      for (const adapter of adapterList()) { restored.push(adapter); adapter.restore(deepClone(validated.values.get(adapter.id))); }
    } catch (thrown) {
      let rollbackFailed = false;
      for (const adapter of restored.reverse()) try { adapter.restore(deepClone(oldValues.get(adapter.id))); } catch { rollbackFailed = true; }
      const error = saveError(rollbackFailed ? "ROLLBACK_FAILED" : "RESTORE_FAILED", rollbackFailed ? "Save restore failed and rollback requires recovery." : "Save restore failed; active session was retained.", slot, undefined, thrown);
      lastError = error; return { ok: false, slot, error };
    }
    lastError = undefined;
    return { ok: true, slot, saveId: staged.envelope.metadata.saveId, canonicalStateHash: canonicalFeatureHash(adapterList()), ...(staged.fromVersion !== undefined ? { migratedFrom: staged.fromVersion } : {}) };
  }

  async function previewImport(file: Blob): Promise<ImportPreview | ImportError> {
    let raw: string;
    try { raw = await file.text(); } catch (thrown) { return { ok: false, error: saveError("IMPORT_INVALID", "The selected file could not be read.", undefined, undefined, thrown) }; }
    const parsed = decodeEnvelope(raw, maxImportBytes);
    if (!parsed.ok) return { ok: false, error: saveError("IMPORT_INVALID", "The selected save is corrupt, incompatible, or oversized.", undefined, parsed.error) };
    const migration = migrationRunner.run(parsed.value);
    if (!migration.ok || !migration.value) return { ok: false, error: migration.error! };
    const featureValidation = validateFeatureSections(migration.value, adapterList());
    if (!featureValidation.ok) return { ok: false, error: saveError("SCHEMA_INVALID", "The selected save has unsupported feature sections.", undefined, featureValidation.error) };
    const missingRefs = options.resolveContentRef ? migration.value.contentRefs.filter((ref) => !options.resolveContentRef!(ref)) : [];
    if (missingRefs.length > 0) return { ok: false, error: saveError("REFERENCE_INVALID", `The selected save references unavailable historical content: ${missingRefs.join(", ")}.`, undefined, missingRefs.map((ref) => ({ code: "INVALID_REFERENCE", path: "contentRefs", message: `Historical content ${ref} is unavailable.` }))) };
    return { ok: true, envelope: migration.value, metadata: migration.value.metadata, featureIds: Object.freeze(Object.keys(migration.value.features).sort()), ...(migration.fromVersion !== undefined ? { migratedFrom: migration.fromVersion } : {}), warnings: Object.freeze(migration.fromVersion !== undefined ? [`Save migrated from format ${migration.fromVersion} to ${formatVersion}.`] : []) };
  }

  async function importSave(file: Blob, importOptions: { readonly slot?: SaveSlot; readonly confirm?: boolean } = {}): Promise<ImportPreview | ImportError> {
    const preview = await previewImport(file);
    if (!preview.ok) return preview;
    if (importOptions.confirm !== true) return { ok: false, error: saveError("CONFIRMATION_REQUIRED", "Confirm replacement before importing this save.", importOptions.slot ?? preview.metadata.slot) };
    const slot = importOptions.slot ?? preview.metadata.slot;
    try { const rebound = rebindEnvelopeSlot(preview.envelope, slot); await repository.import(slot, JSON.stringify(rebound)); return { ...preview, metadata: rebound.metadata, envelope: rebound }; }
    catch (thrown) { return { ok: false, error: saveError("STORAGE_UNAVAILABLE", "Imported save could not be committed atomically.", slot, undefined, thrown) }; }
  }

  return Object.freeze({
    save, load,
    export: (slot: SaveSlot) => repository.export(slot),
    import: importSave,
    previewImport,
    delete: async (slot: SaveSlot, confirmation?: string): Promise<SaveResult> => { try { await repository.remove(slot, confirmation); return { ok: true, slot }; } catch (thrown) { return recordError(saveError(/confirmation/i.test(String(thrown)) ? "CONFIRMATION_REQUIRED" : "STORAGE_UNAVAILABLE", "Save deletion was not confirmed or could not be completed.", slot, undefined, thrown)); } },
    list: repository.list,
    registerAdapter: <T>(adapter: FeatureStateAdapter<T>) => { if (adaptersById.has(adapter.id)) throw new Error(`Feature adapter ${adapter.id} is already registered.`); adaptersById.set(adapter.id, adapter); },
    adapters: adapterList,
    canonicalStateHash: stateHash,
    lastError: () => lastError,
  });
}

export const createSaveCoordinator = createSaveService;
export const createPersistenceService = createSaveService;
