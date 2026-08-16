import { computeEnvelopeChecksum, validateEnvelopeShape } from "./envelope.ts";
import { byteLength, canonicalSerialize } from "./canonical.ts";
import { deepClone } from "./canonical.ts";
import type { Migration, MigrationResult, MigrationRunner, SaveEnvelope, SaveError, StateDiagnostic } from "./types.ts";

function error(code: SaveError["code"], message: string, source: SaveEnvelope, step?: string, diagnostics?: readonly StateDiagnostic[]): SaveError {
  return Object.freeze({ code, message, cause: `formatVersion=${source.formatVersion}`, ...(step ? { phase: step } : {}), ...(diagnostics ? { diagnostics } : {}) });
}

export function createMigrationRunner(currentVersion: number, migrations?: readonly Migration[], maxBytes?: number): MigrationRunner;
export function createMigrationRunner(migrations: readonly Migration[], currentVersion: number, maxBytes?: number): MigrationRunner;
export function createMigrationRunner(currentVersionOrMigrations: number | readonly Migration[], migrationsOrCurrent: number | readonly Migration[] = [], maxBytes?: number): MigrationRunner {
  const currentVersion = typeof currentVersionOrMigrations === "number" ? currentVersionOrMigrations : migrationsOrCurrent as number;
  const migrations = typeof currentVersionOrMigrations === "number" ? migrationsOrCurrent as readonly Migration[] : currentVersionOrMigrations;
  const ordered = [...migrations].sort((a, b) => a.fromVersion - b.fromVersion || a.toVersion - b.toVersion || a.id.localeCompare(b.id));
  const validate = (source: SaveEnvelope): readonly StateDiagnostic[] => validateEnvelopeShape(source, maxBytes);
  function run(source: SaveEnvelope): MigrationResult {
    const sourceCopy = deepClone(source);
    const initialErrors = validate(sourceCopy);
    if (initialErrors.length > 0) return { ok: false, fromVersion: source.formatVersion, error: error("INVALID_ENVELOPE", "Save envelope validation failed before migration.", source, undefined, initialErrors) };
    if (source.formatVersion > currentVersion) return { ok: false, fromVersion: source.formatVersion, error: error("FUTURE_VERSION", `Save format ${source.formatVersion} is newer than this build supports (${currentVersion}).`, source) };
    let current = sourceCopy;
    const fromVersion = source.formatVersion;
    const visited = new Set<number>();
    while (current.formatVersion < currentVersion) {
      if (visited.has(current.formatVersion)) return { ok: false, fromVersion, error: error("MIGRATION_FAILED", "Migration graph contains a cycle.", source, `format-${current.formatVersion}`) };
      visited.add(current.formatVersion);
      const migration = ordered.find((candidate) => candidate.fromVersion === current.formatVersion);
      if (!migration || migration.toVersion <= migration.fromVersion || migration.toVersion > currentVersion) return { ok: false, fromVersion, error: error("MIGRATION_FAILED", `No valid migration is registered from format ${current.formatVersion}.`, source, `format-${current.formatVersion}`) };
      const before = deepClone(current);
      try {
        const migrated = migration.migrate(deepClone(current));
        if (!migrated || migrated.formatVersion !== migration.toVersion) return { ok: false, fromVersion, error: error("MIGRATION_FAILED", `Migration ${migration.id} returned an unexpected target version.`, source, migration.id) };
        const withChecksum = { ...migrated, checksum: computeEnvelopeChecksum(migrated) };
        let sizeBytes = 0;
        for (let index = 0; index < 4; index += 1) {
          const next = byteLength(canonicalSerialize({ ...withChecksum, sizeBytes }));
          if (next === sizeBytes) break;
          sizeBytes = next;
        }
        const recalculated: SaveEnvelope = { ...withChecksum, sizeBytes };
        const diagnostics = validate(recalculated);
        if (diagnostics.length > 0) return { ok: false, fromVersion, error: error("MIGRATION_FAILED", `Migration ${migration.id} produced invalid data.`, source, migration.id, diagnostics) };
        current = deepClone(recalculated);
        // Guard migrations that mutate source-shaped data in place and return it.
        if (JSON.stringify(before) === JSON.stringify(current) && migration.toVersion !== before.formatVersion) current = { ...current, formatVersion: migration.toVersion, checksum: computeEnvelopeChecksum({ ...current, formatVersion: migration.toVersion }) };
      } catch (thrown) {
        return { ok: false, fromVersion, error: error("MIGRATION_FAILED", `Migration ${migration.id} failed.`, source, migration.id, [{ code: "INVALID_VALUE", path: "$", message: thrown instanceof Error ? thrown.message : String(thrown) }]) };
      }
    }
    return { ok: true, value: Object.freeze(current), ...(fromVersion === currentVersion ? {} : { fromVersion }) };
  }
  return Object.freeze({ currentVersion, run, validate });
}

export const sequentialMigrations = createMigrationRunner;
