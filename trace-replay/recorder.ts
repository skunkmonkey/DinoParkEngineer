import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ArtifactRef } from "../content-registry/index.ts";
import type { JobOutcome, ProvenanceEvent } from "../instruction/index.ts";
import { snapshotHash, traceEventsHash, traceHash, verifyTraceIntegrity } from "./canonical.ts";
import type {
  TraceCategory,
  TraceEventRecord,
  TraceHeader,
  TraceListQuery,
  TraceOutcome,
  TraceRecord,
  TraceRepository,
  TracePersistenceAdapter,
  TraceSink,
  TraceSourceEvent,
  TraceStart,
  TraceStatus,
  TraceSummary,
  TracePassFail,
  TraceIntegrityResult,
} from "./types.ts";

type MutableRecord = {
  header: TraceHeader;
  status: TraceStatus;
  terminalReason?: string;
  events: TraceEventRecord[];
  outcome?: JobOutcome | TraceOutcome;
  contextSnapshot?: TraceRecord["contextSnapshot"];
  finalSnapshotHash?: string;
  updatedAtLogicalTime: number;
};

const DEFAULT_SCHEMA_VERSION = 1;

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isProvenanceEvent(event: TraceSourceEvent): event is ProvenanceEvent {
  return "executionId" in event && "sequence" in event;
}

function categoryFor(event: TraceSourceEvent): TraceCategory {
  if (!isProvenanceEvent(event)) {
    if (event.type === "OBSERVATION") return "OBSERVATION";
    if (event.type === "INCIDENT_OPENED" || event.type === "INCIDENT_UPDATED" || event.type === "INCIDENT_RECOVERED") return "INCIDENT";
    return "WORLD";
  }
  switch (event.type) {
    case "JOB_RECEIVED": return "JOB";
    case "VALIDATION": return "VALIDATION";
    case "CONTEXT_BOUND": return "CONTEXT";
    case "CLAUSE_COMPILED":
    case "CLAUSE_SKIPPED":
    case "CLAUSE_SELECTED": return "CLAUSE";
    case "TOOL_REQUESTED":
    case "TOOL_RESULT": return "TOOL";
    case "WORLD_EVENT": {
      const nestedType = typeof event.payload.type === "string" ? event.payload.type : "";
      if (nestedType.startsWith("INCIDENT_")) return "INCIDENT";
      if (nestedType === "OBSERVATION") return "OBSERVATION";
      return "WORLD";
    }
    case "ASSERTION": return "ASSERTION";
    case "CONFLICT_RESOLVED": return "CONFLICT";
    case "DELEGATION_REQUEST": return "DELEGATION";
    case "REPORT": return "REPORT";
    case "RETRIEVAL_REQUEST": return "CONTEXT";
    case "STATUS":
    case "OUTCOME": return "TERMINAL";
    default: return "WORLD";
  }
}

function passFailFor(event: TraceSourceEvent): TracePassFail | undefined {
  const payload = event.payload;
  const passValue = payload.passed ?? payload.ok;
  if (typeof passValue === "boolean") return passValue ? "PASS" : "FAIL";
  if (typeof payload.status === "string") {
    const status = payload.status.toUpperCase();
    if (["PASSED", "PASS", "SUCCEEDED", "SUCCESS", "OK"].includes(status)) return "PASS";
    if (["FAILED", "FAIL", "BLOCKED", "ERROR"].includes(status)) return "FAIL";
  }
  return undefined;
}

function collectEntityRefs(payload: Readonly<Record<string, unknown>>): readonly string[] {
  const result = new Set<string>();
  const visit = (key: string, value: unknown): void => {
    const normalized = key.toLowerCase();
    const isEntityField = normalized.includes("entity")
      || normalized.endsWith("id")
      || normalized.endsWith("ids")
      || normalized.includes("target")
      || normalized.includes("affected");
    if (typeof value === "string" && isEntityField && value.length > 0 && !value.includes("@")) result.add(value);
    else if (Array.isArray(value)) for (const item of value) visit(key, item);
    else if (value !== null && typeof value === "object") for (const [childKey, childValue] of Object.entries(value)) visit(childKey, childValue);
  };
  for (const [key, value] of Object.entries(payload)) visit(key, value);
  return Object.freeze([...result].sort());
}

function labelsFor(event: TraceSourceEvent, category: TraceCategory): readonly string[] {
  const labels = new Set<string>();
  const payload = event.payload;
  if (category === "ASSERTION" && payload.passed === false) labels.add("assertion-failed");
  if (payload.stale === true || typeof payload.freshnessStatus === "string" && payload.freshnessStatus === "STALE") labels.add("stale");
  if (typeof payload.freshnessStatus === "string" && payload.freshnessStatus === "EXPIRED") labels.add("expired");
  if (payload.conflict === true || category === "CONFLICT") labels.add("conflict");
  if (payload.applicabilityMatched === false || payload.applicable === false) labels.add("applicability-mismatch");
  if (typeof payload.code === "string" && payload.code.toUpperCase().includes("MISSING")) labels.add("missing");
  if (typeof payload.reasonCode === "string" && (payload.reasonCode.toUpperCase().includes("MISSING") || payload.reasonCode.toUpperCase().includes("WITHOUT_POSTCONDITION"))) labels.add("missing");
  if (Array.isArray(payload.missingPostconditions) && payload.missingPostconditions.length > 0) labels.add("missing-postcondition");
  return Object.freeze([...labels].sort());
}

function traceEvent(sequence: number, event: TraceSourceEvent): TraceEventRecord {
  const source = deepFreeze(deepClone(event));
  const category = categoryFor(source);
  const payload = source.payload;
  const record: TraceEventRecord = {
    id: source.id,
    sequence,
    logicalTime: source.logicalTime,
    category,
    type: source.type,
    ...(isProvenanceEvent(source) && source.executionId ? { executionId: source.executionId } : {}),
    ...(isProvenanceEvent(source) && source.jobId ? { jobId: source.jobId } : {}),
    ...(isProvenanceEvent(source) && source.clauseId ? { clauseId: source.clauseId } : {}),
    ...(isProvenanceEvent(source) && source.artifactRef ? { artifactRef: deepFreeze(deepClone(source.artifactRef)) } : {}),
    entityRefs: collectEntityRefs(payload),
    ...(passFailFor(source) ? { passFail: passFailFor(source) } : {}),
    labels: labelsFor(source, category),
    payload: deepFreeze(deepClone(payload)),
    source,
  };
  return deepFreeze(record);
}

function freshHeader(input: TraceStart, traceId: string): TraceHeader {
  const artifacts = [...(input.artifactRefs ?? [])]
    .map((ref) => ({ artifactId: ref.artifactId, version: ref.version }))
    .sort((a, b) => stableCompare(refKey(a), refKey(b)));
  return deepFreeze({
    ...deepClone(input),
    traceId,
    startedAtLogicalTime: Number.isFinite(input.startLogicalTime) ? Math.trunc(input.startLogicalTime!) : 0,
    artifactRefs: artifacts,
    schemaVersion: input.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
  });
}

function statusFromOutcome(outcome: JobOutcome | TraceOutcome): TraceStatus {
  if (outcome.status === "SUCCEEDED" || outcome.status === "FAILED" || outcome.status === "ESCALATED" || outcome.status === "BLOCKED") return outcome.status;
  return "FAILED";
}

function terminalReasonFromOutcome(outcome: JobOutcome | TraceOutcome): string | undefined {
  if ("reasonCode" in outcome && typeof outcome.reasonCode === "string") return outcome.reasonCode;
  if ("terminalReason" in outcome && typeof outcome.terminalReason === "string") return outcome.terminalReason;
  return undefined;
}

function recordFromMutable(value: MutableRecord): TraceRecord {
  const events = deepFreeze(deepClone(value.events));
  const finalSnapshot = value.outcome && "worldSnapshot" in value.outcome ? value.outcome.worldSnapshot : undefined;
  const finalSnapshotHash = value.finalSnapshotHash ?? (finalSnapshot ? snapshotHash(finalSnapshot) : undefined);
  const partial = {
    header: value.header,
    status: value.status,
    ...(value.terminalReason ? { terminalReason: value.terminalReason } : {}),
    events,
    ...(value.outcome ? { outcome: deepFreeze(deepClone(value.outcome)) } : {}),
    ...(value.contextSnapshot ? { contextSnapshot: deepFreeze(deepClone(value.contextSnapshot)) } : {}),
    ...(finalSnapshotHash ? { finalSnapshotHash } : {}),
    eventCount: events.length,
    endLogicalTime: value.updatedAtLogicalTime,
    updatedAtLogicalTime: value.updatedAtLogicalTime,
    canonicalEventHash: traceEventsHash(events),
  };
  return deepFreeze({ ...partial, canonicalHash: traceHash(partial as unknown as TraceRecord) });
}

function summary(record: TraceRecord): TraceSummary {
  return deepFreeze({
    traceId: record.header.traceId,
    ...(record.header.jobId ? { jobId: record.header.jobId } : {}),
    ...(record.header.agentId ? { agentId: record.header.agentId } : {}),
    status: record.status,
    startLogicalTime: record.header.startedAtLogicalTime,
    endLogicalTime: record.updatedAtLogicalTime,
    eventCount: record.events.length,
    ...(record.terminalReason ? { terminalReason: record.terminalReason } : {}),
    artifactRefs: deepClone(record.header.artifactRefs),
  });
}

function eventMatches(event: TraceEventRecord, query: TraceListQuery): boolean {
  const categories = query.category ? (Array.isArray(query.category) ? query.category : [query.category]) : undefined;
  const artifact = typeof query.artifactRef === "string" ? query.artifactRef : query.artifactRef ? refKey(query.artifactRef) : undefined;
  if (categories && !categories.includes(event.category)) return false;
  if (query.entityId && !event.entityRefs.includes(query.entityId)) return false;
  if (artifact && (!event.artifactRef || refKey(event.artifactRef) !== artifact)) return false;
  if (query.clauseId && event.clauseId !== query.clauseId) return false;
  if (query.passFail && event.passFail !== query.passFail) return false;
  if (query.search) {
    const haystack = `${event.type} ${event.category} ${event.clauseId ?? ""} ${canonicalSerialize(event.payload)}`.toLowerCase();
    if (!haystack.includes(query.search.toLowerCase())) return false;
  }
  return true;
}

export function filterTraceEvents(events: readonly TraceEventRecord[], query: TraceListQuery = {}): readonly TraceEventRecord[] {
  return Object.freeze(events.filter((event) => eventMatches(event, query)));
}

function matches(record: TraceRecord, query: TraceListQuery): boolean {
  if (query.traceId && record.header.traceId !== query.traceId) return false;
  if (query.jobId && record.header.jobId !== query.jobId) return false;
  if (query.agentId && record.header.agentId !== query.agentId) return false;
  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    if (!statuses.includes(record.status)) return false;
  }
  const artifact = typeof query.artifactRef === "string" ? query.artifactRef : query.artifactRef ? refKey(query.artifactRef) : undefined;
  if (artifact && record.header.artifactRefs.some((ref) => refKey(ref) === artifact)
    && !query.category && !query.entityId && !query.clauseId && !query.passFail && !query.search) return true;
  if (query.category || query.entityId || query.artifactRef || query.clauseId || query.passFail || query.search) {
    const events = filterTraceEvents(record.events, query);
    if (events.length === 0) return false;
  }
  return true;
}

/** Recorder and in-memory repository implementation. The live state keeps one
 * append-only event array; immutable snapshots are materialized only at query
 * boundaries so 10k-event traces do not incur quadratic copying. */
export function createTraceRepository(adapter?: TracePersistenceAdapter): TraceRepository {
  const states = new Map<string, MutableRecord>();
  const integrityById = new Map<string, TraceIntegrityResult>();
  const quarantinedById = new Map<string, TraceRecord>();
  let nextTraceNumber = 1;
  const hydrate = (input: TraceRecord): boolean => {
    const record = deepFreeze(deepClone(input));
    const integrity = verifyTraceIntegrity(record);
    integrityById.set(record.header.traceId, integrity);
    if (!integrity.ok) {
      quarantinedById.set(record.header.traceId, record);
      states.delete(record.header.traceId);
      return false;
    }
    quarantinedById.delete(record.header.traceId);
    states.set(record.header.traceId, {
      header: record.header,
      status: record.status,
      ...(record.terminalReason ? { terminalReason: record.terminalReason } : {}),
      events: [...record.events],
      ...(record.outcome ? { outcome: record.outcome } : {}),
      ...(record.contextSnapshot ? { contextSnapshot: record.contextSnapshot } : {}),
      ...(record.finalSnapshotHash ? { finalSnapshotHash: record.finalSnapshotHash } : {}),
      updatedAtLogicalTime: record.updatedAtLogicalTime,
    });
    return true;
  };
  if (adapter) for (const record of adapter.list()) hydrate(record);

  const makeId = (requested?: string): string => {
    if (requested && !states.has(requested) && !quarantinedById.has(requested)) return requested;
    let candidate = requested ?? "";
    while (!candidate || states.has(candidate) || quarantinedById.has(candidate)) candidate = `trace.${String(nextTraceNumber++).padStart(6, "0")}`;
    return candidate;
  };
  const repository: TraceRepository = {
    begin(input) {
      const traceId = makeId(input.traceId);
      const header = freshHeader(input, traceId);
      states.set(traceId, { header, status: "RUNNING", events: [], ...(header.contextSnapshot ? { contextSnapshot: header.contextSnapshot } : {}), updatedAtLogicalTime: header.startedAtLogicalTime });
      const record = recordFromMutable(states.get(traceId)!);
      integrityById.set(traceId, verifyTraceIntegrity(record));
      adapter?.put(record);
      return traceId;
    },
    append(traceId, event) {
      const current = states.get(traceId);
      if (!current) throw new Error(`Unknown trace ${traceId}`);
      if (current.status !== "RUNNING") throw new Error(`Trace ${traceId} is finalized`);
      const normalized = traceEvent(current.events.length, event);
      current.events.push(normalized);
      current.updatedAtLogicalTime = normalized.logicalTime;
      integrityById.delete(traceId);
      adapter?.append?.(traceId, normalized);
    },
    finalize(traceId, outcome) {
      const current = states.get(traceId);
      if (!current) throw new Error(`Unknown trace ${traceId}`);
      if (current.status !== "RUNNING") throw new Error(`Trace ${traceId} is finalized`);
      const normalized = deepFreeze(deepClone(outcome));
      const status = statusFromOutcome(normalized);
      const finalSnapshot = "worldSnapshot" in normalized ? normalized.worldSnapshot : undefined;
      current.status = status;
      current.terminalReason = terminalReasonFromOutcome(normalized);
      current.outcome = normalized;
      if (finalSnapshot) current.finalSnapshotHash = snapshotHash(finalSnapshot);
      current.updatedAtLogicalTime = finalSnapshot?.logicalTime ?? current.updatedAtLogicalTime;
      const record = recordFromMutable(current);
      integrityById.set(traceId, verifyTraceIntegrity(record));
      adapter?.put(record);
    },
    get(traceId) {
      const record = states.get(traceId);
      if (record) return recordFromMutable(record);
      if (quarantinedById.has(traceId)) return undefined;
      const persisted = adapter?.get(traceId);
      if (!persisted || !hydrate(persisted)) return undefined;
      return recordFromMutable(states.get(traceId)!);
    },
    list(query = {}) {
      const records = [...states.values()].map(recordFromMutable)
        .filter((record) => matches(record, query))
        .sort((a, b) => stableCompare(a.header.traceId, b.header.traceId))
        .map(summary);
      return Object.freeze(query.limit === undefined ? records : records.slice(0, Math.max(0, query.limit)));
    },
    put(input) {
      const record = deepFreeze(deepClone(input));
      if (hydrate(record)) adapter?.put(record);
    },
    records() {
      return Object.freeze([...states.values()].map(recordFromMutable).sort((a, b) => stableCompare(a.header.traceId, b.header.traceId)));
    },
    replace(records) {
      states.clear(); quarantinedById.clear(); integrityById.clear();
      for (const record of records) if (hydrate(record)) adapter?.put(record);
    },
    integrity(traceId) {
      const current = states.get(traceId);
      if (current) {
        const integrity = verifyTraceIntegrity(recordFromMutable(current));
        integrityById.set(traceId, integrity);
        return integrity;
      }
      return integrityById.get(traceId);
    },
    quarantined() {
      return Object.freeze([...quarantinedById.keys()].sort(stableCompare).map((traceId) => Object.freeze({ traceId, integrity: integrityById.get(traceId)! })));
    },
  };
  return repository;
}

export class TraceRecorder implements TraceSink {
  private readonly repository: TraceRepository;
  public constructor(repository: TraceRepository = createTraceRepository()) { this.repository = repository; }
  public begin(header: TraceStart): string { return this.repository.begin(header); }
  public append(traceId: string, event: TraceSourceEvent): void { this.repository.append(traceId, event); }
  public finalize(traceId: string, outcome: JobOutcome | TraceOutcome): void { this.repository.finalize(traceId, outcome); }
}

export function createTraceRecorder(repository: TraceRepository = createTraceRepository()): TraceRecorder {
  return new TraceRecorder(repository);
}

export const createInMemoryTraceRepository = createTraceRepository;

/** Adapt one trace id to the upstream instruction ProvenanceSink shape. The
 * adapter only appends observable facts and has no access to world mutation. */
export function createTraceEventSink(repository: TraceRepository, traceId: string): { append(event: TraceSourceEvent): void } {
  return { append: (event) => repository.append(traceId, event) };
}

export const createProvenanceSink = createTraceEventSink;
