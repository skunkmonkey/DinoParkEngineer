import { memoryEntrySchema, memoryStoreInputSchema } from "./schemas.js";
import { diagnostic, cloneFreeze, entryKey, immutableEntries } from "./diagnostics.js";
import { canWriteMemoryStore } from "./authority.js";
import type {
  MemoryEntry,
  MemoryExternalizationRequest,
  MemoryExternalizationResult,
  MemoryMutationFailure,
  MemoryMutationResult,
  MemoryPrincipal,
  MemoryRepository,
  MemoryRetrievalQuery,
  MemoryRetrievalResult,
  MemoryState,
  MemoryStore,
  MemoryStoreInput,
  CompactHistoryRequest,
  CompactHistoryResult,
  MemoryLifecyclePorts,
} from "./types.js";
import { externalizeContextItem } from "./externalization.js";
import { retrieveMemory } from "./retrieval.js";
import { compactHistory } from "./compaction.js";

const invalid = (message: string, code: "MEMORY_INVALID" | "MEMORY_STORE_UNAVAILABLE" = "MEMORY_INVALID"): MemoryMutationFailure => ({
  ok: false,
  code,
  diagnostics: [diagnostic(code, code === "MEMORY_STORE_UNAVAILABLE" ? "missing" : "boundary", [], message)],
});

const validEntry = (entry: MemoryEntry): MemoryEntry | undefined => {
  const parsed = memoryEntrySchema.safeParse(entry);
  return parsed.success ? cloneFreeze(parsed.data) : undefined;
};

const validStore = (input: MemoryStoreInput): MemoryStore | undefined => {
  const parsed = memoryStoreInputSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const entries = parsed.data.entries ?? [];
  if (entries.some((entry) => entry.storeId !== parsed.data.id)) return undefined;
  const readers = parsed.data.readers ?? parsed.data.readAuthority ?? [];
  const writers = parsed.data.writers ?? parsed.data.writeAuthority ?? [];
  return cloneFreeze({ ...parsed.data, readers, writers, entries: immutableEntries(entries) });
};

export const createMemoryStore = (input: MemoryStoreInput): MemoryStore => {
  const store = validStore(input);
  if (store === undefined) throw new TypeError("Invalid Memory store at its public boundary.");
  return store;
};

export interface MemoryRepositoryOptions {
  readonly stores?: readonly MemoryStoreInput[];
  readonly entries?: readonly MemoryEntry[];
}

const normalizeOptions = (options: MemoryRepositoryOptions): MemoryState => {
  const stores = (options.stores ?? []).map((store) => createMemoryStore(store));
  const storeIds = new Set<string>();
  for (const store of stores) {
    if (storeIds.has(store.id)) throw new TypeError(`Duplicate Memory store ${store.id}.`);
    storeIds.add(store.id);
  }
  const entries = [...stores.flatMap((store) => store.entries), ...(options.entries ?? [])];
  const keys = new Set<string>();
  const valid: MemoryEntry[] = [];
  for (const rawEntry of entries) {
    const entry = validEntry(rawEntry);
    if (entry === undefined || !storeIds.has(rawEntry.storeId)) throw new TypeError(`Invalid Memory entry ${rawEntry.id}@${rawEntry.version}.`);
    const key = entryKey(entry);
    if (keys.has(key)) throw new TypeError(`Duplicate Memory entry ${key}.`);
    keys.add(key);
    valid.push(entry);
  }
  const byStore = stores.map((store) => ({ ...store, entries: immutableEntries(valid.filter((entry) => entry.storeId === store.id)) }));
  return cloneFreeze({ stores: byStore, entries: immutableEntries(valid) });
};

export const createMemoryRepository = (options: MemoryRepositoryOptions = {}): MemoryRepository => {
  let state = normalizeOptions(options);

  const snapshot = (): MemoryState => cloneFreeze(state);
  const stores = (): readonly MemoryStore[] => state.stores;
  const getExact = (id: string, version: string): MemoryEntry | undefined => state.entries.find((entry) => entry.id === id && entry.version === version);
  const history = (id: string): readonly MemoryEntry[] => immutableEntries(state.entries.filter((entry) => entry.id === id));

  const append = (rawEntry: MemoryEntry, principal?: MemoryPrincipal): MemoryMutationResult => {
    const entry = validEntry(rawEntry);
    if (entry === undefined) return invalid("Memory entry failed schema validation.");
    const store = state.stores.find((candidate) => candidate.id === entry.storeId);
    if (store === undefined || !store.enabled) return invalid(`Memory store ${entry.storeId} is unavailable.`, "MEMORY_STORE_UNAVAILABLE");
    if (!canWriteMemoryStore(store, principal)) return {
      ok: false,
      code: "MEMORY_WRITE_UNAUTHORIZED",
      diagnostics: [diagnostic("MEMORY_WRITE_UNAUTHORIZED", "authority", [entry.id], `Principal ${principal?.id ?? "anonymous"} cannot write Memory store ${store.id}.`)],
    };
    const existing = state.entries.find((candidate) => entryKey(candidate) === entryKey(entry));
    if (existing !== undefined) return {
      ok: false,
      code: "MEMORY_DUPLICATE_ENTRY",
      diagnostics: [diagnostic("MEMORY_DUPLICATE", "duplicate", [entry.id], `Memory entry ${entryKey(entry)} already exists.`)],
    };
    const priorVersions = state.entries.filter((candidate) => candidate.id === entry.id);
    if (priorVersions.length > 0 && entry.supersedes === undefined) return {
      ok: false,
      code: "MEMORY_INVALID",
      diagnostics: [diagnostic("MEMORY_INVALID", "boundary", [entry.id], "A new Memory version must explicitly supersede the prior version.")],
    };
    const supersedes = entry.supersedes;
    if (supersedes !== undefined && !state.entries.some((candidate) => entryKey(candidate) === entryKey(supersedes))) return {
      ok: false,
      code: "MEMORY_INVALID",
      diagnostics: [diagnostic("MEMORY_INVALID", "missing", [entry.id], `Superseded Memory ${entryKey(supersedes)} is unavailable.`)],
    };
    const nextEntries = immutableEntries([...state.entries, entry]);
    const nextStores = state.stores.map((candidate) => candidate.id === store.id ? { ...candidate, entries: immutableEntries([...candidate.entries, entry]) } : candidate);
    state = cloneFreeze({ stores: nextStores, entries: nextEntries });
    return { ok: true, entry };
  };

  const externalize = (request: MemoryExternalizationRequest): MemoryExternalizationResult => externalizeContextItem(request, { append, getStore: (id) => state.stores.find((store) => store.id === id) });
  const retrieve = (query: MemoryRetrievalQuery): MemoryRetrievalResult => retrieveMemory(state, query);
  const compact = (request: CompactHistoryRequest): CompactHistoryResult => compactHistory(request, { state: () => state, append, getExact, getStore: (id) => state.stores.find((store) => store.id === id) });

  return Object.freeze({ snapshot, stores, getExact, history, append, externalize, retrieve, compactHistory: compact });
};

export const stateFromStores = (stores: readonly MemoryStore[]): MemoryState => normalizeOptions({ stores });

export const createMemoryPorts = (repository: MemoryRepository): MemoryLifecyclePorts => Object.freeze({
  externalize: repository.externalize,
  retrieve: repository.retrieve,
  compactHistory: repository.compactHistory,
});
