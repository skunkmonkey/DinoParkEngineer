import { canonicalSaveSerialize, fingerprintSaveData } from "./canonical.js";
import { validateSaveEnvelope } from "./engine.js";
import type { MigrationResult, MvpCompositeState, PersistenceDiagnostic, SaveEnvelope } from "./types.js";
import { PERSISTENCE_COMPLETION_MARKER, PERSISTENCE_FINGERPRINT_ALGORITHM, PERSISTENCE_SCHEMA_VERSION } from "./types.js";

const diagnostic = (code: PersistenceDiagnostic["code"], message: string): PersistenceDiagnostic => ({ code, path: "migration", rule: "explicit schema 0 to 1 migration", message });
const emptyMvp = (): MvpCompositeState => ({
  schemaVersion: "1", memory: {}, evals: {}, workbench: {}, reviews: {}, deployments: {}, economy: {}, incidents: {}, response: {}, progression: {}, rewards: {}, curriculum: {}, consent: {},
});
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Real v0 migration: moves root accessibilityPreferences into a versioned section and adds the MVP composite. */
export const migrateSave = (source: string | unknown): MigrationResult => {
  const originalBackup = typeof source === "string" ? source : canonicalSaveSerialize(source);
  let input: unknown = source;
  if (typeof source === "string") {
    try { input = JSON.parse(source); } catch { return { ok: false, originalBackup, diagnostics: [diagnostic("PERSISTENCE_MIGRATION_FAILED", "Original save text is truncated or invalid JSON; the original remains available.")] }; }
  }
  if (!record(input)) return { ok: false, originalBackup, diagnostics: [diagnostic("PERSISTENCE_MIGRATION_FAILED", "Migration input is not a save record.")] };
  if (input.schemaVersion === "1" && input.saveSchemaVersion === "1") {
    const current = validateSaveEnvelope(input);
    return current.ok ? { ok: true, envelope: current.value, originalBackup, diagnostics: [] } : { ok: false, originalBackup, diagnostics: current.diagnostics };
  }
  if (input.schemaVersion !== "0" || input.saveSchemaVersion !== "0") {
    return { ok: false, originalBackup, diagnostics: [diagnostic("PERSISTENCE_MIGRATION_STEP_MISSING", `No migration step exists for schema ${String(input.schemaVersion)}.`)] };
  }
  if (!record(input.sections) || !record(input.accessibilityPreferences)) {
    return { ok: false, originalBackup, diagnostics: [diagnostic("PERSISTENCE_MIGRATION_FAILED", "Schema 0 requires sections and accessibilityPreferences preconditions.")] };
  }
  try {
    const preferences = structuredClone(input.accessibilityPreferences);
    const mvp = emptyMvp();
    const sections = {
      ...structuredClone(input.sections),
      preferences: { schemaVersion: PERSISTENCE_SCHEMA_VERSION, fingerprint: fingerprintSaveData(preferences), data: preferences },
      mvp: { schemaVersion: PERSISTENCE_SCHEMA_VERSION, fingerprint: fingerprintSaveData(mvp), data: mvp },
    };
    const payload = {
      ...Object.fromEntries(Object.entries(input).filter(([key]) => !["integrity", "accessibilityPreferences"].includes(key))),
      schemaVersion: PERSISTENCE_SCHEMA_VERSION,
      saveSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
      sections,
      completionMarker: PERSISTENCE_COMPLETION_MARKER,
    };
    const migrated = { ...payload, integrity: { algorithm: PERSISTENCE_FINGERPRINT_ALGORITHM, fingerprint: fingerprintSaveData(payload) } };
    const validation = validateSaveEnvelope(migrated);
    if (!validation.ok) return { ok: false, originalBackup, diagnostics: [diagnostic("PERSISTENCE_MIGRATION_FAILED", "Migrated output failed complete validation; no save was committed."), ...validation.diagnostics] };
    return {
      ok: true,
      envelope: validation.value,
      originalBackup,
      audit: { fromVersion: "0", toVersion: "1", stepId: "persistence:0-to-1-preferences-and-mvp", originalFingerprint: fingerprintSaveData(input), migratedFingerprint: validation.value.integrity.fingerprint },
      diagnostics: [],
    };
  } catch (error) {
    return { ok: false, originalBackup, diagnostics: [diagnostic("PERSISTENCE_MIGRATION_FAILED", error instanceof Error ? error.message : "Migration transform failed.")] };
  }
};

export const createLegacyV0Fixture = (envelope: SaveEnvelope): unknown => {
  const source = structuredClone(envelope);
  const sections = Object.fromEntries(Object.entries(source.sections).filter(([key]) => key !== "preferences" && key !== "mvp"));
  return { ...source, schemaVersion: "0", saveSchemaVersion: "0", sections, accessibilityPreferences: source.sections.preferences.data, integrity: { algorithm: PERSISTENCE_FINGERPRINT_ALGORITHM, fingerprint: "fnv1a64:0000000000000000" } };
};
