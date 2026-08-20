import {
  clonePortable,
  fingerprintSaveData,
  freezePortable,
} from "./canonical.js";
import { saveEnvelopeSchema } from "./schemas.js";
import type {
  PersistenceDiagnostic,
  PersistenceRepositoryResult,
  SaveEnvelope,
  SaveMetadata,
  SaveRepository,
} from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const diagnostic = (code: PersistenceDiagnostic["code"], path: string, rule: string, message: string): PersistenceDiagnostic => ({ code, path, rule, message });

/**
 * A staged, known-good repository used by tests and headless integrations.
 * Promotion changes one map entry and the known-good pointer together; a
 * malformed stage therefore cannot replace the prior save.
 */
export const createInMemorySaveRepository = (): SaveRepository => {
  const records = new Map<string, SaveEnvelope>();
  const staged = new Map<string, SaveEnvelope>();
  let activeId: string | undefined;
  let sequence = 0;

  const stage = (envelope: SaveEnvelope): PersistenceRepositoryResult => {
    const parsed = saveEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      return {
        ok: false,
        diagnostics: parsed.error.issues.map((issue) => diagnostic(
          "PERSISTENCE_REPOSITORY_WRITE_FAILED",
          issue.path.join(".") || "$",
          "stage a complete save envelope",
          issue.message,
        )),
      };
    }
    const payload = Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== "integrity"));
    const expectedIntegrity = fingerprintSaveData(payload);
    const expectedManifest = fingerprintSaveData({
      schemaVersion: envelope.contentManifest.schemaVersion,
      packages: envelope.contentManifest.packages,
      references: envelope.contentManifest.references,
    });
    const invalidSection = Object.entries(envelope.sections).find(([, entry]) => entry.fingerprint !== fingerprintSaveData(entry.data));
    if (envelope.completionMarker !== "SAVE_COMPLETE" || envelope.integrity.fingerprint !== expectedIntegrity || envelope.contentManifest.fingerprint !== expectedManifest || invalidSection !== undefined) {
      return {
        ok: false,
        diagnostics: [diagnostic("PERSISTENCE_REPOSITORY_WRITE_FAILED", "integrity", "complete canonical save candidate", "Staged save failed completion or integrity validation; the prior known-good save remains active.")],
      };
    }
    staged.set(envelope.id, freezePortable(clonePortable(envelope)));
    sequence += 1;
    return { ok: true, diagnostics: [] };
  };

  const promote = (id: string): PersistenceRepositoryResult => {
    const candidate = staged.get(id);
    if (candidate === undefined) return { ok: false, diagnostics: [diagnostic("PERSISTENCE_REPOSITORY_PROMOTION_FAILED", "id", "staged save exists", `No staged save exists for ${id}.`)] };
    // The map replacement and pointer assignment are synchronous and adjacent;
    // readers can observe either old known-good data or the complete candidate.
    records.set(id, freezePortable(clonePortable(candidate)));
    activeId = id;
    staged.delete(id);
    sequence += 1;
    return { ok: true, diagnostics: [] };
  };

  const read = (id?: string): SaveEnvelope | undefined => {
    const key = id ?? activeId;
    if (key === undefined) return undefined;
    const value = records.get(key);
    return value === undefined ? undefined : clonePortable(value);
  };

  const metadata = (envelope: SaveEnvelope): SaveMetadata => ({
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    applicationVersion: envelope.applicationVersion,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    tick: envelope.park.tick,
    day: envelope.park.day,
    seed: envelope.park.seed,
    contentFingerprint: envelope.contentManifest.fingerprint,
    integrityFingerprint: envelope.integrity.fingerprint,
  });

  const list = (): readonly SaveMetadata[] => [...records.values()]
    .map(metadata)
    .sort((left, right) => lexical(left.id, right.id));

  const remove = (id: string, confirmed: boolean): PersistenceRepositoryResult => {
    if (!confirmed) return { ok: false, diagnostics: [diagnostic("PERSISTENCE_DELETE_CONFIRMATION_REQUIRED", "confirmed", "explicit deletion confirmation", "Deleting a save requires explicit confirmation.")] };
    staged.delete(id);
    records.delete(id);
    if (activeId === id) activeId = [...records.keys()].sort(lexical)[0];
    sequence += 1;
    return { ok: true, diagnostics: [] };
  };

  return Object.freeze({
    stage,
    promote,
    read,
    list,
    remove,
    knownGoodId: (): string | undefined => activeId,
    /** Exposed only for deterministic diagnostics in tests; it is not save state. */
    get sequence(): number { return sequence; },
  } as SaveRepository);
};

/** Alias matching the persistence PRD's repository terminology. */
export const createMemorySaveRepository = createInMemorySaveRepository;
export const createInMemoryRepository = createInMemorySaveRepository;
