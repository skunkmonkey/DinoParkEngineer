import { clonePortable } from "./canonical.js";
import { createPersistenceSessionCandidate, createSaveEnvelope, validateSaveEnvelope } from "./engine.js";
import type { AsyncPersistenceCoordinator, AsyncSaveRepository, LoadOperationResult, PersistenceDiagnostic, PersistenceSessionPort, SaveOperationResult, SaveRequest } from "./types.js";

const diagnostic = (code: PersistenceDiagnostic["code"], message: string): PersistenceDiagnostic => ({ code, path: "session", rule: "atomic validated persistence operation", message });

export const createAsyncPersistenceCoordinator = (options: {
  readonly repository: AsyncSaveRepository;
  readonly session: PersistenceSessionPort;
  readonly applicationVersion?: string;
  readonly now?: () => string;
}): AsyncPersistenceCoordinator => {
  const now = options.now ?? (() => "1970-01-01T00:00:00.000Z");
  const save = async (request: SaveRequest): Promise<SaveOperationResult> => {
    const timestamp = now();
    const envelope = createSaveEnvelope({ id: request.id, applicationVersion: request.applicationVersion ?? options.applicationVersion, createdAt: request.createdAt ?? timestamp, updatedAt: request.updatedAt ?? timestamp, contentManifest: request.contentManifest, session: request.session ?? options.session.snapshot() });
    const validation = validateSaveEnvelope(envelope);
    if (!validation.ok) return validation;
    const staged = await options.repository.stage(validation.value);
    if (!staged.ok) return { ok: false, diagnostics: staged.diagnostics };
    const promoted = await options.repository.promote(envelope.id);
    return promoted.ok ? { ok: true, envelope: validation.value } : { ok: false, diagnostics: promoted.diagnostics };
  };
  const load = async (id?: string): Promise<LoadOperationResult> => {
    const read = await options.repository.read(id);
    if (!read.ok) return read;
    const validation = validateSaveEnvelope(read.envelope);
    if (!validation.ok) return validation;
    const candidate = createPersistenceSessionCandidate(validation.value);
    try { options.session.replace(candidate); } catch (error) {
      return { ok: false, diagnostics: [diagnostic("PERSISTENCE_SESSION_REPLACEMENT_FAILED", error instanceof Error ? error.message : "Candidate session replacement failed.")] };
    }
    return { ok: true, envelope: validation.value, session: clonePortable(candidate) };
  };
  return Object.freeze({ save, load });
};
