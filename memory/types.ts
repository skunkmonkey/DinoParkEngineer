/**
 * Headless memory contracts.  Memory is deliberately independent of a
 * persistence implementation: a save system can provide a repository while
 * tests and the MVP use the in-memory adapter.
 */

export type MemoryScope = "LOCAL" | "SHARED";
export type MemoryRetentionStatus = "ACTIVE" | "EXPIRED" | "DISCARDED";
export type FreshnessStatus = "FRESH" | "STALE" | "EXPIRED";

export type MemoryJsonPrimitive = string | number | boolean | null;
export type MemoryJsonValue =
  | MemoryJsonPrimitive
  | readonly MemoryJsonValue[]
  | { readonly [key: string]: MemoryJsonValue };

export interface MemoryFact {
  readonly key: string;
  readonly value: MemoryJsonValue;
  readonly subjectRef?: string;
  readonly observedAt?: number;
  readonly provenance?: string;
}

export interface NewMemory {
  /** If omitted, the service creates a deterministic id from the input. */
  readonly id?: string;
  readonly scope: MemoryScope;
  /** Required for local records and ignored for shared records. */
  readonly ownerAgentId?: string;
  readonly observedAt: number;
  /** Absolute logical time at which the record is no longer valid. */
  readonly validUntil?: number;
  /** Relative logical lifetime. `validUntil` wins if both are supplied. */
  readonly ttl?: number;
  readonly provenance: string;
  readonly subjectRefs?: readonly string[];
  /** Human-readable observation text. */
  readonly content?: string;
  /** Structured facts allow deterministic conflict/precedence analysis. */
  readonly facts?: readonly MemoryFact[] | Readonly<Record<string, MemoryJsonValue>>;
  /** Explicit context cost; otherwise the context cost model calculates it. */
  readonly contextCost?: number;
  readonly tags?: readonly string[];
  readonly retentionStatus?: MemoryRetentionStatus;
}

export interface MemoryRecord {
  readonly id: string;
  readonly scope: MemoryScope;
  readonly ownerAgentId?: string;
  readonly observedAt: number;
  readonly validUntil?: number;
  readonly ttl?: number;
  readonly provenance: string;
  readonly subjectRefs: readonly string[];
  readonly content: string;
  readonly facts: readonly MemoryFact[];
  readonly contextCost: number;
  readonly tags: readonly string[];
  readonly retentionStatus: MemoryRetentionStatus;
}

export interface MemoryQuery {
  readonly ids?: readonly string[];
  readonly subjectRefs?: readonly string[];
  readonly tags?: readonly string[];
  readonly scope?: MemoryScope;
  readonly text?: string;
  readonly includeExpired?: boolean;
  readonly limit?: number;
}

export interface MemoryAccess {
  readonly agentId: string;
  /** Shared access defaults to true; set false to intentionally isolate local context. */
  readonly includeShared?: boolean;
  /** Additional agents whose local records may be read by a manager. */
  readonly localAgentIds?: readonly string[];
  readonly scopes?: readonly MemoryScope[];
}

export interface FreshnessPolicy {
  /** Maximum age in logical seconds before a record is stale. */
  readonly maxAgeSeconds: number;
  /** Optional policy-specific expiry independent of the record's own validity. */
  readonly expireAfterSeconds?: number;
}

export interface MemoryRepository {
  get(id: string): MemoryRecord | undefined;
  list(): readonly MemoryRecord[];
  put(record: MemoryRecord): void;
  /** Persistence replacement boundary; restores exact state, removing records
   * that are not present in the staged snapshot. */
  replace(records: readonly MemoryRecord[]): void;
}

export interface MemoryService {
  record(input: NewMemory): MemoryRecord;
  retrieve(query: MemoryQuery, access: MemoryAccess, logicalTime: number): readonly MemoryRecord[];
  evaluate(record: MemoryRecord, logicalTime: number, policy: FreshnessPolicy): FreshnessStatus;
  repository(): MemoryRepository;
}
