import { canonicalSaveSerialize, fingerprintSaveData } from "./canonical.js";
import { migrateSave } from "./migration.js";
import type { ImportResult, PersistenceDiagnostic, PortableSavePackage, SaveEnvelope, SaveRepository } from "./types.js";

const diagnostic = (code: PersistenceDiagnostic["code"], message: string): PersistenceDiagnostic => ({ code, path: "import", rule: "quarantined portable save package", message });

export const exportPortableSave = (envelope: SaveEnvelope): string => {
  const payload = { format: "dino-park-save" as const, formatVersion: "1" as const, envelope };
  return canonicalSaveSerialize({ ...payload, fingerprint: fingerprintSaveData(payload) });
};

export const inspectPortableSave = (source: string, existingIds: readonly string[] = []): ImportResult => {
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { return { ok: false, quarantined: true, originalBackup: source, diagnostics: [diagnostic("PERSISTENCE_IMPORT_QUARANTINED", "Import is not complete JSON; nothing was written.")] }; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, quarantined: true, originalBackup: source, diagnostics: [diagnostic("PERSISTENCE_IMPORT_QUARANTINED", "Import is not a portable save package.")] };
  const value = parsed as Partial<PortableSavePackage>;
  const payload = { format: value.format, formatVersion: value.formatVersion, envelope: value.envelope };
  if (value.format !== "dino-park-save" || value.formatVersion !== "1" || value.fingerprint !== fingerprintSaveData(payload)) return { ok: false, quarantined: true, originalBackup: source, diagnostics: [diagnostic("PERSISTENCE_IMPORT_QUARANTINED", "Package identity or fingerprint is invalid; nothing was written.")] };
  const migrated = migrateSave(value.envelope);
  if (!migrated.ok || migrated.envelope === undefined) return { ok: false, quarantined: true, originalBackup: source, diagnostics: migrated.diagnostics };
  if (existingIds.includes(migrated.envelope.id)) return { ok: false, quarantined: true, originalBackup: source, diagnostics: [diagnostic("PERSISTENCE_IMPORT_CONFLICT", `Save ${migrated.envelope.id} already exists; choose a separate save ID rather than overwriting it.`)] };
  return { ok: true, quarantined: false, envelope: migrated.envelope, originalBackup: migrated.originalBackup, diagnostics: [] };
};

export const commitPortableImport = (result: ImportResult, repository: SaveRepository): ImportResult => {
  if (!result.ok || result.envelope === undefined) return result;
  const staged = repository.stage(result.envelope);
  if (!staged.ok) return { ...result, ok: false, quarantined: true, envelope: undefined, diagnostics: staged.diagnostics };
  const promoted = repository.promote(result.envelope.id);
  return promoted.ok ? result : { ...result, ok: false, quarantined: true, envelope: undefined, diagnostics: promoted.diagnostics };
};
