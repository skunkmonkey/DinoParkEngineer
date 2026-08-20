import { createSaveEnvelope, validateSaveEnvelope } from "./engine.js";
import type {
  AsyncSaveRepository,
  AutosaveCoordinator,
  PersistenceDiagnostic,
  PersistenceSessionPort,
  SafeCheckpoint,
  SaveOperationResult,
} from "./types.js";

const invalidCheckpoint = (): SaveOperationResult => ({
  ok: false,
  diagnostics: [{ code: "PERSISTENCE_SAFE_CHECKPOINT_REQUIRED", path: "checkpoint.safe", rule: "explicit domain-safe checkpoint", message: "Autosave only accepts an explicit safe checkpoint; no save was written." }],
});

/** Coalesces requests while retaining the newest logical checkpoint. */
export const createAutosaveCoordinator = (options: {
  readonly repository: AsyncSaveRepository;
  readonly session: PersistenceSessionPort;
  readonly applicationVersion?: string;
  readonly now?: () => string;
}): AutosaveCoordinator => {
  let pending: SafeCheckpoint | undefined;
  let running: Promise<SaveOperationResult | undefined> | undefined;
  let lastSavedTick = -1;
  const now = options.now ?? (() => "1970-01-01T00:00:00.000Z");

  const execute = async (): Promise<SaveOperationResult | undefined> => {
    let finalResult: SaveOperationResult | undefined;
    while (pending !== undefined) {
      const checkpoint = pending;
      pending = undefined;
      if (checkpoint.tick <= lastSavedTick) continue;
      const session = checkpoint.request.session ?? options.session.snapshot();
      if (session.world.tick !== checkpoint.tick) {
        finalResult = invalidCheckpoint();
        continue;
      }
      const timestamp = now();
      const envelope = createSaveEnvelope({
        id: checkpoint.request.id,
        applicationVersion: checkpoint.request.applicationVersion ?? options.applicationVersion,
        createdAt: checkpoint.request.createdAt ?? timestamp,
        updatedAt: checkpoint.request.updatedAt ?? timestamp,
        contentManifest: checkpoint.request.contentManifest,
        session,
      });
      const validation = validateSaveEnvelope(envelope);
      if (!validation.ok) { finalResult = validation; continue; }
      const staged = await options.repository.stage(validation.value);
      if (!staged.ok) { finalResult = { ok: false, diagnostics: staged.diagnostics }; continue; }
      const promoted = await options.repository.promote(validation.value.id);
      if (!promoted.ok) { finalResult = { ok: false, diagnostics: promoted.diagnostics }; continue; }
      lastSavedTick = checkpoint.tick;
      finalResult = { ok: true, envelope: validation.value };
    }
    return finalResult;
  };

  const start = (): Promise<SaveOperationResult | undefined> => {
    if (running !== undefined) return running;
    running = execute().finally(() => { running = undefined; });
    return running;
  };

  return Object.freeze({
    request: async (checkpoint: SafeCheckpoint): Promise<SaveOperationResult> => {
      if ((checkpoint as { readonly safe?: unknown }).safe !== true) return invalidCheckpoint();
      if (pending === undefined || checkpoint.tick >= pending.tick) pending = checkpoint;
      return (await start()) ?? invalidCheckpoint();
    },
    flush: async (): Promise<SaveOperationResult | undefined> => running === undefined ? undefined : running,
  });
};

export const checkpointDiagnostic = (message: string): PersistenceDiagnostic => ({
  code: "PERSISTENCE_SAFE_CHECKPOINT_REQUIRED",
  path: "checkpoint",
  rule: "explicit safe checkpoint",
  message,
});
