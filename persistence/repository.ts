import { decodeEnvelope, encodeEnvelope, rebindEnvelopeSlot } from "./envelope.ts";
import { deepClone } from "./canonical.ts";
import type {
  BrowserRepositoryOptions,
  BrowserStorageLike,
  SaveEnvelope,
  SaveMetadata,
  SaveRecord,
  SaveRepository,
  SaveSlot,
  SaveWritePhase,
  MemoryRepositoryOptions,
} from "./types.ts";

function asRecord(envelope: SaveEnvelope): SaveRecord {
  return Object.freeze({ envelope: deepClone(envelope), raw: encodeEnvelope(envelope) });
}

function invokeFailure(injector: ((phase: SaveWritePhase, slot: SaveSlot) => void) | undefined, phase: SaveWritePhase, slot: SaveSlot): void {
  injector?.(phase, slot);
}

function toMetadata(envelope: SaveEnvelope): SaveMetadata {
  return Object.freeze(deepClone(envelope.metadata));
}

/** In-memory repository used by tests and offline sessions. The commit path
 * always stages and validates a complete envelope before swapping the pointer. */
export function createMemorySaveRepository(options: MemoryRepositoryOptions = {}): SaveRepository {
  const active = new Map<SaveSlot, SaveRecord>();
  const backups = new Map<SaveSlot, SaveRecord>();
  const temps = new Map<SaveSlot, SaveRecord>();
  const maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
  for (const envelope of options.initial ?? []) active.set(envelope.metadata.slot, asRecord(envelope));

  async function read(slot: SaveSlot): Promise<SaveRecord | undefined> {
    const record = active.get(slot);
    if (!record) return undefined;
    const validated = decodeEnvelope(record.raw, maxBytes);
    return validated.ok ? asRecord(validated.value) : undefined;
  }

  async function write(slot: SaveSlot, envelope: SaveEnvelope): Promise<void> {
    const raw = encodeEnvelope(envelope);
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("quota exceeded");
    invokeFailure(options.failureInjector, "before-temp", slot);
    const staged = asRecord(envelope);
    temps.set(slot, staged);
    invokeFailure(options.failureInjector, "after-temp", slot);
    invokeFailure(options.failureInjector, "before-verify", slot);
    const verified = decodeEnvelope(staged.raw, maxBytes);
    if (!verified.ok) {
      temps.delete(slot);
      throw new Error("staged save failed validation");
    }
    invokeFailure(options.failureInjector, "after-verify", slot);
    invokeFailure(options.failureInjector, "before-active", slot);
    const previous = active.get(slot);
    if (previous) backups.set(slot, previous);
    invokeFailure(options.failureInjector, "after-backup", slot);
    active.set(slot, staged);
    temps.delete(slot);
    invokeFailure(options.failureInjector, "after-active", slot);
  }

  async function recover(slot: SaveSlot): Promise<SaveRecord | undefined> {
    const current = await read(slot);
    if (current) return current;
    const backup = backups.get(slot);
    if (!backup) return undefined;
    const verified = decodeEnvelope(backup.raw, maxBytes);
    if (!verified.ok) return undefined;
    active.set(slot, backup);
    return asRecord(verified.value);
  }

  return Object.freeze({
    read,
    get: read,
    write,
    put: write,
    remove: async (slot: SaveSlot, confirmation?: string) => {
      if (confirmation !== `DELETE:${slot}`) throw new Error("explicit confirmation required");
      active.delete(slot); backups.delete(slot); temps.delete(slot);
    },
    list: async () => Object.freeze([...active.values()].map((record) => toMetadata(record.envelope)).sort((a, b) => a.slot.localeCompare(b.slot))),
    export: async (slot: SaveSlot) => {
      const record = await read(slot);
      if (!record) throw new Error(`save ${slot} not found`);
      return new Blob([record.raw], { type: "application/json" });
    },
    import: async (slot: SaveSlot, raw: string) => {
      const parsed = decodeEnvelope(raw, maxBytes);
      if (!parsed.ok) throw new Error(parsed.error.map((item) => item.message).join(" "));
      await write(slot, rebindEnvelopeSlot(parsed.value, slot));
    },
    backup: async (slot: SaveSlot) => {
      const record = backups.get(slot);
      return record ? asRecord(record.envelope) : undefined;
    },
    recover,
  });
}

function defaultStorage(): BrowserStorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try { return window.localStorage; } catch { return undefined; }
}

/** Browser adapter. A temp key is fully decoded and checksummed before the
 * active pointer is replaced; prior active data is retained as backup. */
export function createBrowserSaveRepository(options: BrowserRepositoryOptions = {}): SaveRepository {
  const storage = options.storage ?? defaultStorage();
  const namespace = options.namespace ?? "dino-park-engineer:saves";
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
  const key = (slot: SaveSlot, kind: "active" | "backup" | "temp") => `${namespace}:${kind}:${slot}`;
  const ensureStorage = (): BrowserStorageLike => { if (!storage) throw new Error("browser storage is unavailable"); return storage; };

  async function readRecord(slot: SaveSlot, kind: "active" | "backup" | "temp" = "active"): Promise<SaveRecord | undefined> {
    const raw = ensureStorage().getItem(key(slot, kind));
    if (!raw) return undefined;
    const parsed = decodeEnvelope(raw, maxBytes);
    return parsed.ok ? asRecord(parsed.value) : undefined;
  }
  async function write(slot: SaveSlot, envelope: SaveEnvelope): Promise<void> {
    const target = ensureStorage();
    const raw = encodeEnvelope(envelope);
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("quota exceeded");
    invokeFailure(options.failureInjector, "before-temp", slot);
    target.setItem(key(slot, "temp"), raw);
    invokeFailure(options.failureInjector, "after-temp", slot);
    invokeFailure(options.failureInjector, "before-verify", slot);
    const verified = await readRecord(slot, "temp");
    if (!verified) { target.removeItem(key(slot, "temp")); throw new Error("staged save failed validation"); }
    invokeFailure(options.failureInjector, "after-verify", slot);
    invokeFailure(options.failureInjector, "before-active", slot);
    const previous = target.getItem(key(slot, "active"));
    if (previous) target.setItem(key(slot, "backup"), previous);
    invokeFailure(options.failureInjector, "after-backup", slot);
    target.setItem(key(slot, "active"), verified.raw);
    target.removeItem(key(slot, "temp"));
    invokeFailure(options.failureInjector, "after-active", slot);
  }
  async function recover(slot: SaveSlot): Promise<SaveRecord | undefined> {
    const active = await readRecord(slot);
    if (active) return active;
    const backup = await readRecord(slot, "backup");
    if (!backup) return undefined;
    ensureStorage().setItem(key(slot, "active"), backup.raw);
    return backup;
  }
  return Object.freeze({
    read: (slot: SaveSlot) => readRecord(slot),
    get: (slot: SaveSlot) => readRecord(slot),
    write,
    put: write,
    remove: async (slot: SaveSlot, confirmation?: string) => { if (confirmation !== `DELETE:${slot}`) throw new Error("explicit confirmation required"); const target = ensureStorage(); target.removeItem(key(slot, "active")); target.removeItem(key(slot, "backup")); target.removeItem(key(slot, "temp")); },
    list: async () => {
      const target = ensureStorage(); const values: SaveMetadata[] = [];
      for (let index = 0; index < target.length; index += 1) {
        const item = target.key(index); if (!item || !item.startsWith(`${namespace}:active:`)) continue;
        const slot = item.slice(`${namespace}:active:`.length) as SaveSlot; const record = await readRecord(slot); if (record) values.push(toMetadata(record.envelope));
      }
      return Object.freeze(values.sort((a, b) => a.slot.localeCompare(b.slot)));
    },
    export: async (slot: SaveSlot) => { const record = await readRecord(slot); if (!record) throw new Error(`save ${slot} not found`); return new Blob([record.raw], { type: "application/json" }); },
    import: async (slot: SaveSlot, raw: string) => { const parsed = decodeEnvelope(raw, maxBytes); if (!parsed.ok) throw new Error(parsed.error.map((item) => item.message).join(" ")); await write(slot, rebindEnvelopeSlot(parsed.value, slot)); },
    backup: async (slot: SaveSlot) => readRecord(slot, "backup"),
    recover,
  });
}

/** A tiny storage implementation useful for browser adapter conformance tests. */
export function createMemoryStorage(): BrowserStorageLike {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); }, key: (index) => [...values.keys()][index] ?? null };
}

export const createInMemorySaveRepository = createMemorySaveRepository;
