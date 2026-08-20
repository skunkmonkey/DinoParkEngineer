import { canonicalSaveSerialize } from "./canonical.js";
import { validateSaveEnvelope } from "./engine.js";
import type {
  AsyncSaveReadResult,
  AsyncSaveRepository,
  PersistenceDiagnostic,
  PersistenceRepositoryResult,
  SaveEnvelope,
  SaveMetadata,
} from "./types.js";

const SAVES = "saves";
const STAGING = "staging";
const CONTROL = "control";
const ACTIVE = "known-good";

const diagnostic = (code: PersistenceDiagnostic["code"], path: string, rule: string, message: string): PersistenceDiagnostic => ({ code, path, rule, message });
const failure = (code: PersistenceDiagnostic["code"], message: string): PersistenceRepositoryResult => ({ ok: false, diagnostics: [diagnostic(code, "repository", "IndexedDB transaction", message)] });

const classify = (error: unknown, fallback: PersistenceDiagnostic["code"]): PersistenceDiagnostic["code"] => {
  if (error instanceof DOMException && error.name === "QuotaExceededError") return "PERSISTENCE_QUOTA_EXCEEDED";
  if (error instanceof DOMException && error.name === "AbortError") return "PERSISTENCE_TRANSACTION_ABORTED";
  return fallback;
};

const request = <T>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  value.addEventListener("success", () => resolve(value.result), { once: true });
  value.addEventListener("error", () => reject(value.error ?? new DOMException("IndexedDB request failed.", "UnknownError")), { once: true });
});

const complete = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true });
  transaction.addEventListener("abort", () => reject(transaction.error ?? new DOMException("IndexedDB transaction aborted.", "AbortError")), { once: true });
  transaction.addEventListener("error", () => reject(transaction.error ?? new DOMException("IndexedDB transaction failed.", "UnknownError")), { once: true });
});

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

const decode = (stored: unknown): AsyncSaveReadResult => {
  if (typeof stored !== "string") return { ok: false, diagnostics: [diagnostic("PERSISTENCE_CORRUPT_RECORD", "repository.record", "canonical save text", "Stored save data is not canonical text; the current session remains unchanged.")] };
  let parsed: unknown;
  try { parsed = JSON.parse(stored); } catch {
    return { ok: false, diagnostics: [diagnostic("PERSISTENCE_TRUNCATED_RECORD", "repository.record", "complete JSON save", "Stored save data is truncated or malformed; load the last known-good save or export diagnostics.")] };
  }
  const validation = validateSaveEnvelope(parsed);
  return validation.ok ? { ok: true, envelope: validation.value } : { ok: false, diagnostics: [diagnostic("PERSISTENCE_CORRUPT_RECORD", "repository.record", "valid complete save", "Stored save data failed integrity or schema validation."), ...validation.diagnostics] };
};

const openDatabase = (factory: IDBFactory, name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const opening = factory.open(name, 1);
  opening.addEventListener("upgradeneeded", () => {
    const database = opening.result;
    if (!database.objectStoreNames.contains(SAVES)) database.createObjectStore(SAVES);
    if (!database.objectStoreNames.contains(STAGING)) database.createObjectStore(STAGING);
    if (!database.objectStoreNames.contains(CONTROL)) database.createObjectStore(CONTROL);
  });
  opening.addEventListener("success", () => resolve(opening.result), { once: true });
  opening.addEventListener("error", () => reject(opening.error ?? new DOMException("IndexedDB open failed.", "UnknownError")), { once: true });
});

/** Browser repository whose promotion updates the save and known-good pointer in one transaction. */
export const createIndexedDbSaveRepository = async (options: {
  readonly factory?: IDBFactory;
  readonly databaseName?: string;
} = {}): Promise<AsyncSaveRepository> => {
  const factory = options.factory ?? globalThis.indexedDB;
  if (factory === undefined) throw new Error("IndexedDB is unavailable in this environment.");
  const database = await openDatabase(factory, options.databaseName ?? "dino-park-engineer");

  const stage = async (envelope: SaveEnvelope): Promise<PersistenceRepositoryResult> => {
    const validation = validateSaveEnvelope(envelope);
    if (!validation.ok) return { ok: false, diagnostics: validation.diagnostics };
    try {
      const tx = database.transaction(STAGING, "readwrite");
      tx.objectStore(STAGING).put({ bytes: canonicalSaveSerialize(validation.value), updatedAt: envelope.updatedAt }, envelope.id);
      await complete(tx);
      return { ok: true, diagnostics: [] };
    } catch (error) {
      return failure(classify(error, "PERSISTENCE_REPOSITORY_WRITE_FAILED"), "The staged write failed; the prior known-good save remains active.");
    }
  };

  const promote = async (id: string): Promise<PersistenceRepositoryResult> => {
    try {
      const tx = database.transaction([STAGING, SAVES, CONTROL], "readwrite");
      const value: unknown = await request(tx.objectStore(STAGING).get(id));
      const staged = typeof value === "object" && value !== null && "bytes" in value ? (value as { readonly bytes?: unknown }).bytes : undefined;
      const decoded = decode(staged);
      if (!decoded.ok) {
        tx.abort();
        return { ok: false, diagnostics: decoded.diagnostics.map((entry) => ({ ...entry, code: entry.code === "PERSISTENCE_TRUNCATED_RECORD" ? entry.code : "PERSISTENCE_REPOSITORY_PROMOTION_FAILED" })) };
      }
      tx.objectStore(SAVES).put(staged, id);
      tx.objectStore(CONTROL).put(id, ACTIVE);
      tx.objectStore(STAGING).delete(id);
      await complete(tx);
      return { ok: true, diagnostics: [] };
    } catch (error) {
      return failure(classify(error, "PERSISTENCE_REPOSITORY_PROMOTION_FAILED"), "Promotion aborted atomically; the prior known-good pointer and save remain active.");
    }
  };

  const knownGoodId = async (): Promise<string | undefined> => {
    const tx = database.transaction(CONTROL, "readonly");
    const result: unknown = await request(tx.objectStore(CONTROL).get(ACTIVE));
    await complete(tx);
    return typeof result === "string" ? result : undefined;
  };

  const read = async (id?: string): Promise<AsyncSaveReadResult> => {
    const key = id ?? await knownGoodId();
    if (key === undefined) return { ok: false, diagnostics: [diagnostic("PERSISTENCE_SAVE_NOT_FOUND", "id", "known-good save exists", "No known-good save is available.")] };
    try {
      const tx = database.transaction(SAVES, "readonly");
      const stored: unknown = await request(tx.objectStore(SAVES).get(key));
      await complete(tx);
      return stored === undefined ? { ok: false, diagnostics: [diagnostic("PERSISTENCE_SAVE_NOT_FOUND", "id", "save exists", `Save ${key} was not found.`)] } : decode(stored);
    } catch (error) {
      return { ok: false, diagnostics: failure(classify(error, "PERSISTENCE_CORRUPT_RECORD"), "The save could not be read; the current session remains unchanged.").diagnostics };
    }
  };

  const list = async (): Promise<readonly SaveMetadata[]> => {
    const tx = database.transaction(SAVES, "readonly");
    const values: unknown[] = await request(tx.objectStore(SAVES).getAll());
    await complete(tx);
    return values.flatMap((value) => { const result = decode(value); return result.ok ? [metadata(result.envelope)] : []; }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  };

  const remove = async (id: string, confirmed: boolean): Promise<PersistenceRepositoryResult> => {
    if (!confirmed) return failure("PERSISTENCE_DELETE_CONFIRMATION_REQUIRED", "Deleting a save requires explicit confirmation.");
    try {
      const tx = database.transaction([SAVES, STAGING, CONTROL], "readwrite");
      tx.objectStore(SAVES).delete(id);
      tx.objectStore(STAGING).delete(id);
      const active: unknown = await request(tx.objectStore(CONTROL).get(ACTIVE));
      if (active === id) tx.objectStore(CONTROL).delete(ACTIVE);
      await complete(tx);
      return { ok: true, diagnostics: [] };
    } catch (error) { return failure(classify(error, "PERSISTENCE_TRANSACTION_ABORTED"), "Delete failed atomically; the save remains available."); }
  };

  const discardStaleStages = async (olderThanUpdatedAt: string): Promise<PersistenceRepositoryResult> => {
    try {
      const tx = database.transaction(STAGING, "readwrite");
      const store = tx.objectStore(STAGING);
      const keys: IDBValidKey[] = await request(store.getAllKeys());
      const values: unknown[] = await request(store.getAll());
      values.forEach((value, index) => {
        if (typeof value === "object" && value !== null && "updatedAt" in value && typeof (value as { updatedAt?: unknown }).updatedAt === "string" && (value as { updatedAt: string }).updatedAt < olderThanUpdatedAt) {
          const key = keys[index];
          if (key !== undefined) store.delete(key);
        }
      });
      await complete(tx);
      return { ok: true, diagnostics: [] };
    } catch (error) { return failure(classify(error, "PERSISTENCE_STALE_STAGING"), "Stale staging cleanup failed without changing known-good saves."); }
  };

  return Object.freeze({ stage, promote, read, list, remove, knownGoodId, discardStaleStages });
};
