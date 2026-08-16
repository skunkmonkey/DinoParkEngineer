import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import { createMemoryRepository, compareMemory } from "./repository.ts";
import type {
  FreshnessPolicy,
  FreshnessStatus,
  MemoryAccess,
  MemoryFact,
  MemoryJsonValue,
  MemoryQuery,
  MemoryRecord,
  MemoryRepository,
  MemoryService,
  NewMemory,
} from "./types.ts";

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function assertFiniteInteger(value: number, name: string, minimum = 0): void {
  if (!Number.isInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`);
}

function normalizeFacts(facts: NewMemory["facts"]): readonly MemoryFact[] {
  if (!facts) return [];
  if (Array.isArray(facts)) {
    return facts
      .map((fact) => ({ ...fact }))
      .filter((fact) => fact.key.length > 0)
      .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : (a.subjectRef ?? "") < (b.subjectRef ?? "") ? -1 : 1);
  }
  const record = facts as Readonly<Record<string, MemoryJsonValue>>;
  return Object.keys(record).sort().map((key) => ({ key, value: record[key] }));
}

function deterministicId(input: NewMemory): string {
  const serialized = canonicalSerialize({
    scope: input.scope,
    ownerAgentId: input.ownerAgentId,
    observedAt: input.observedAt,
    validUntil: input.validUntil,
    ttl: input.ttl,
    provenance: input.provenance,
    subjectRefs: [...(input.subjectRefs ?? [])].sort(),
    content: input.content ?? "",
    facts: normalizeFacts(input.facts),
  });
  const bytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serialized)
    : utf8Bytes(serialized);
  const hash = (seed: number): string => {
    let value = seed >>> 0;
    for (const byte of bytes) {
      value ^= byte;
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, "0");
  };
  return `memory.${hash(0x811c9dc5)}${hash(0x9e3779b9)}${hash(0x85ebca6b)}`;
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let point = value.codePointAt(index) ?? 0xfffd;
    if (point >= 0xd800 && point <= 0xdfff) point = 0xfffd;
    if (point > 0xffff) index += 1;
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff) bytes.push(0xc0 | point >> 6, 0x80 | point & 0x3f);
    else if (point <= 0xffff) bytes.push(0xe0 | point >> 12, 0x80 | point >> 6 & 0x3f, 0x80 | point & 0x3f);
    else bytes.push(0xf0 | point >> 18, 0x80 | point >> 12 & 0x3f, 0x80 | point >> 6 & 0x3f, 0x80 | point & 0x3f);
  }
  return new Uint8Array(bytes);
}

function recordValidUntil(record: MemoryRecord): number | undefined {
  if (record.validUntil !== undefined) return record.validUntil;
  if (record.ttl !== undefined) return record.observedAt + record.ttl;
  return undefined;
}

export function evaluateMemory(record: MemoryRecord, logicalTime: number, policy: FreshnessPolicy): FreshnessStatus {
  assertFiniteInteger(logicalTime, "logicalTime");
  assertFiniteInteger(policy.maxAgeSeconds, "maxAgeSeconds");
  if (record.retentionStatus === "DISCARDED") return "EXPIRED";
  const validUntil = recordValidUntil(record);
  // The boundary is exclusive: a record is no longer valid at validUntil.
  if (validUntil !== undefined && logicalTime >= validUntil) return "EXPIRED";
  if (policy.expireAfterSeconds !== undefined && logicalTime >= record.observedAt + policy.expireAfterSeconds) return "EXPIRED";
  if (logicalTime - record.observedAt > policy.maxAgeSeconds) return "STALE";
  return "FRESH";
}

export function canAccessMemory(record: MemoryRecord, access: MemoryAccess): boolean {
  const scopes = access.scopes;
  if (scopes && !scopes.includes(record.scope)) return false;
  if (record.scope === "SHARED") return access.includeShared !== false;
  if (record.scope !== "LOCAL") return false;
  if (record.ownerAgentId === access.agentId) return true;
  return access.localAgentIds?.includes(record.ownerAgentId ?? "") === true;
}

function matchesQuery(record: MemoryRecord, query: MemoryQuery): boolean {
  if (query.ids && !query.ids.includes(record.id)) return false;
  if (query.scope && record.scope !== query.scope) return false;
  if (query.subjectRefs && !query.subjectRefs.some((subject) => record.subjectRefs.includes(subject) || record.facts.some((fact) => fact.subjectRef === subject))) return false;
  if (query.tags && !query.tags.every((tag) => record.tags.includes(tag))) return false;
  if (query.text) {
    const haystack = `${record.content}\u0000${record.provenance}`.toLowerCase();
    if (!haystack.includes(query.text.toLowerCase())) return false;
  }
  if (!query.includeExpired && record.retentionStatus === "EXPIRED") return false;
  return true;
}

export function createMemoryService(repository: MemoryRepository = createMemoryRepository()): MemoryService {
  const record = (input: NewMemory): MemoryRecord => {
    if (input.scope !== "LOCAL" && input.scope !== "SHARED") throw new TypeError("memory scope must be LOCAL or SHARED");
    if (input.retentionStatus !== undefined && !["ACTIVE", "EXPIRED", "DISCARDED"].includes(input.retentionStatus)) throw new TypeError("memory retentionStatus must be ACTIVE, EXPIRED, or DISCARDED");
    if (!input.provenance) throw new TypeError("memory provenance is required");
    assertFiniteInteger(input.observedAt, "observedAt");
    if (input.validUntil !== undefined) assertFiniteInteger(input.validUntil, "validUntil");
    if (input.ttl !== undefined) assertFiniteInteger(input.ttl, "ttl");
    if (input.contextCost !== undefined) assertFiniteInteger(input.contextCost, "contextCost");
    if (input.scope === "LOCAL" && !input.ownerAgentId) throw new TypeError("local memory requires ownerAgentId");
    const validUntil = input.validUntil ?? (input.ttl === undefined ? undefined : input.observedAt + input.ttl);
    if (validUntil !== undefined && validUntil < input.observedAt) throw new RangeError("validUntil cannot precede observedAt");
    const facts = normalizeFacts(input.facts);
    const result: MemoryRecord = {
      id: input.id ?? deterministicId(input),
      scope: input.scope,
      ...(input.ownerAgentId === undefined ? {} : { ownerAgentId: input.ownerAgentId }),
      observedAt: input.observedAt,
      ...(validUntil === undefined ? {} : { validUntil }),
      ...(input.ttl === undefined ? {} : { ttl: input.ttl }),
      provenance: input.provenance,
      subjectRefs: [...new Set(input.subjectRefs ?? [])].sort(),
      content: input.content ?? "",
      facts: facts.map((fact) => cloneFreeze(fact)),
      contextCost: input.contextCost ?? 0,
      tags: [...new Set(input.tags ?? [])].sort(),
      retentionStatus: input.retentionStatus ?? "ACTIVE",
    };
    const frozen = cloneFreeze(result);
    repository.put(frozen);
    return frozen;
  };

  const retrieve = (query: MemoryQuery, access: MemoryAccess, logicalTime: number): readonly MemoryRecord[] => {
    assertFiniteInteger(logicalTime, "logicalTime");
    const records = repository.list()
      .filter((candidate) => candidate.observedAt <= logicalTime)
      .filter((candidate) => canAccessMemory(candidate, access))
      .filter((candidate) => matchesQuery(candidate, query))
      .filter((candidate) => evaluateMemory(candidate, logicalTime, { maxAgeSeconds: Number.MAX_SAFE_INTEGER }) !== "EXPIRED" || query.includeExpired === true)
      .sort(compareMemory);
    return cloneFreeze(query.limit === undefined ? records : records.slice(0, Math.max(0, query.limit)));
  };

  return {
    record,
    retrieve,
    evaluate: evaluateMemory,
    repository: () => repository,
  };
}

export const createMemoryStore = createMemoryService;
