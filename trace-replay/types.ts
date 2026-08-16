import type { ArtifactRef, ContentRegistry } from "../content-registry/index.ts";
import type { ContextRequest, ContextSnapshot, ContextService } from "../context/index.ts";
import type {
  AgentDefinition,
  InstructionContentPort,
  InstructionContextPort,
  InstructionJob,
  InstructionSimulationPort,
  JobOutcome,
  ProvenanceEvent,
  InstructionEngine,
} from "../instruction/index.ts";
import type {
  SimulationEngine,
  WorldCommand,
  WorldEvent,
  WorldFixture,
  WorldSnapshot,
} from "../simulation/index.ts";

/** Versioned, observable trace categories. Categories are presentation labels,
 * never inferred reasoning. */
export type TraceCategory =
  | "JOB"
  | "VALIDATION"
  | "CONTEXT"
  | "OBSERVATION"
  | "CLAUSE"
  | "TOOL"
  | "WORLD"
  | "ASSERTION"
  | "CONFLICT"
  | "INCIDENT"
  | "DELEGATION"
  | "REPORT"
  | "TERMINAL";

export type TraceStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "ESCALATED" | "BLOCKED";
export type TracePassFail = "PASS" | "FAIL";

export type TraceSourceEvent = ProvenanceEvent | WorldEvent;

export interface TraceStart {
  readonly traceId?: string;
  readonly executionId?: string;
  readonly jobId?: string;
  readonly agentId?: string;
  readonly startLogicalTime?: number;
  readonly fixtureRef?: string;
  readonly seed?: number;
  readonly artifactRefs?: readonly ArtifactRef[];
  readonly contextSnapshotId?: string;
  readonly contextSnapshot?: ContextSnapshot;
  readonly engineVersion?: string;
  readonly engineSchemaVersion?: number | string;
  readonly contentManifestVersion?: string;
  readonly contentSchemaVersion?: number | string;
  readonly contextSchemaVersion?: number | string;
  readonly schemaVersion?: number;
  /** Optional replay inputs captured at the start of a run. */
  readonly replayManifest?: ReplayManifest;
}

export interface TraceHeader extends TraceStart {
  readonly traceId: string;
  readonly startedAtLogicalTime: number;
  readonly artifactRefs: readonly ArtifactRef[];
  readonly schemaVersion: number;
}

export interface TraceEventRecord {
  readonly id: string;
  readonly sequence: number;
  readonly logicalTime: number;
  readonly category: TraceCategory;
  readonly type: string;
  readonly executionId?: string;
  readonly jobId?: string;
  readonly clauseId?: string;
  readonly artifactRef?: ArtifactRef;
  readonly entityRefs: readonly string[];
  readonly passFail?: TracePassFail;
  readonly labels: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
  /** Defensive copy of the public upstream event. */
  readonly source: TraceSourceEvent;
}

export interface TraceRecord {
  readonly header: TraceHeader;
  readonly status: TraceStatus;
  readonly terminalReason?: string;
  readonly events: readonly TraceEventRecord[];
  readonly outcome?: JobOutcome | TraceOutcome;
  readonly contextSnapshot?: ContextSnapshot;
  readonly finalSnapshotHash?: string;
  readonly canonicalEventHash: string;
  readonly canonicalHash: string;
  readonly eventCount: number;
  readonly endLogicalTime?: number;
  readonly updatedAtLogicalTime: number;
}

export interface TraceIntegrityResult {
  readonly ok: boolean;
  readonly expectedEventHash: string;
  readonly expectedCanonicalHash: string;
  readonly actualEventHash: string;
  readonly actualCanonicalHash: string;
  readonly reason?: "EVENT_HASH_MISMATCH" | "TRACE_HASH_MISMATCH";
}

export interface TraceOutcome {
  readonly jobId?: string;
  readonly status: TraceStatus;
  readonly reasonCode?: string;
  readonly terminalReason?: string;
  readonly contextSnapshotId?: string;
  readonly worldSnapshot?: WorldSnapshot;
  readonly finalSnapshotHash?: string;
  readonly [key: string]: unknown;
}

export interface TraceSummary {
  readonly traceId: string;
  readonly jobId?: string;
  readonly agentId?: string;
  readonly status: TraceStatus;
  readonly startLogicalTime: number;
  readonly endLogicalTime: number;
  readonly eventCount: number;
  readonly terminalReason?: string;
  readonly artifactRefs: readonly ArtifactRef[];
}

export interface TraceListQuery {
  readonly traceId?: string;
  readonly jobId?: string;
  readonly agentId?: string;
  readonly status?: TraceStatus | readonly TraceStatus[];
  readonly category?: TraceCategory | readonly TraceCategory[];
  readonly entityId?: string;
  readonly artifactRef?: string | ArtifactRef;
  readonly clauseId?: string;
  readonly passFail?: TracePassFail;
  readonly search?: string;
  readonly limit?: number;
}

export interface TraceSink {
  begin(header: TraceStart): string;
  append(traceId: string, event: TraceSourceEvent): void;
  finalize(traceId: string, outcome: JobOutcome | TraceOutcome): void;
}

export interface TraceQuery {
  get(traceId: string): TraceRecord | undefined;
  list(query?: TraceListQuery): readonly TraceSummary[];
}

export interface TraceRepository extends TraceSink, TraceQuery {
  /** Adapter hook for persistence/save features. */
  put(record: TraceRecord): void;
  /** Returns a defensive snapshot of all records for adapter migration. */
  records(): readonly TraceRecord[];
  /** Persistence replacement boundary; removes traces absent from the save. */
  replace(records: readonly TraceRecord[]): void;
  /** Reports verified persisted integrity, including quarantined records. */
  integrity(traceId: string): TraceIntegrityResult | undefined;
  quarantined(): readonly { readonly traceId: string; readonly integrity: TraceIntegrityResult }[];
}

export interface TracePersistenceAdapter {
  get(traceId: string): TraceRecord | undefined;
  list(): readonly TraceRecord[];
  /** O(1) event delta; adapters must not require a full record per append. */
  append?(traceId: string, event: TraceEventRecord): void;
  put(record: TraceRecord): void;
}

export interface ReplayManifest {
  readonly schemaVersion: number;
  readonly id?: string;
  readonly traceId?: string;
  readonly fixtureRef?: string;
  readonly fixture?: WorldFixture;
  readonly seed: number;
  /** Exact refs selected by the original run. */
  readonly artifactRefs?: readonly ArtifactRef[];
  readonly artifactVersions?: readonly ArtifactRef[];
  readonly agentDefinition?: AgentDefinition;
  readonly job?: InstructionJob;
  readonly contextSnapshotId?: string;
  readonly contextSnapshot?: ContextSnapshot;
  readonly contextPolicyInputs?: Partial<ContextRequest> & Readonly<Record<string, unknown>>;
  readonly contextSchemaVersion?: number | string;
  readonly engineVersion?: string;
  readonly engineSchemaVersion?: number | string;
  readonly contentManifestVersion?: string;
  readonly contentSchemaVersion?: number | string;
  readonly commandStream?: readonly WorldCommand[];
  readonly untilLogicalTime?: number;
  /** Expected simulation world events for a command-stream replay. */
  readonly expectedEvents?: readonly WorldEvent[];
  readonly expectedEventCanonical?: string;
  readonly expectedEventHash?: string;
  /** Expected normalized trace events for instruction/provenance replay. */
  readonly expectedTraceEvents?: readonly TraceEventRecord[];
  readonly expectedTraceCanonical?: string;
  readonly expectedTraceHash?: string;
  readonly expectedFinalSnapshot?: WorldSnapshot;
  readonly expectedFinalSnapshotHash?: string;
}

export interface ReplayControls {
  readonly paused?: boolean;
  readonly speed?: 1 | 2 | 4;
  readonly step?: boolean;
  readonly onEvent?: (event: TraceEventRecord) => void;
}

export type ReplayResultStatus = "EXACT" | "DIVERGED" | "UNAVAILABLE";

export interface ReplayDifference {
  readonly kind: "EVENT" | "TRACE" | "SNAPSHOT" | "INPUT" | "SCHEMA";
  readonly index?: number;
  readonly field?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly code?: string;
  readonly message: string;
}

export interface ReplayResult {
  readonly status: ReplayResultStatus;
  readonly firstDifference?: ReplayDifference;
  readonly finalSnapshotHash?: string;
  readonly events?: readonly WorldEvent[];
  readonly traceEvents?: readonly TraceEventRecord[];
  readonly finalSnapshot?: WorldSnapshot;
  readonly unavailableReason?: string;
  readonly isolated: true;
}

export interface ReplayPorts {
  readonly simulationFactory?: () => SimulationEngine;
  readonly instructionFactory?: (ports: {
    readonly content: InstructionContentPort | ContentRegistry;
    readonly context: InstructionContextPort | ContextService;
    readonly simulation: InstructionSimulationPort;
  }) => InstructionEngine;
  readonly content?: InstructionContentPort | ContentRegistry;
  readonly context?: InstructionContextPort | ContextService;
  readonly engineVersion?: string;
  readonly engineSchemaVersion?: number | string;
  readonly contentManifestVersion?: string;
  readonly contentSchemaVersion?: number | string;
  readonly contextSchemaVersion?: number | string;
}

export interface ReplayService {
  replay(manifest: ReplayManifest, controls?: ReplayControls): Promise<ReplayResult>;
}
