import { canonicalSaveSerialize } from "./canonical.js";
import type { PersistenceDiagnostic, SaveEnvelope, SaveRepository } from "./types.js";

export const loadLastKnownGood = (repository: SaveRepository): SaveEnvelope | undefined => repository.read(repository.knownGoodId());

export const exportPersistenceDiagnostics = (input: {
  readonly saveId?: string;
  readonly originalBackup?: string;
  readonly diagnostics: readonly PersistenceDiagnostic[];
  readonly knownGood?: SaveEnvelope;
}): string => canonicalSaveSerialize({
  format: "dino-park-persistence-diagnostic",
  formatVersion: "1",
  saveId: input.saveId ?? null,
  originalBackup: input.originalBackup ?? null,
  diagnostics: input.diagnostics,
  knownGoodMetadata: input.knownGood === undefined ? null : {
    id: input.knownGood.id,
    updatedAt: input.knownGood.updatedAt,
    tick: input.knownGood.park.tick,
    integrityFingerprint: input.knownGood.integrity.fingerprint,
  },
});
