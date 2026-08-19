import type {
  ContentReference,
  ResolvedContentManifest,
} from "../content-registry/public.js";
import type {
  ContextManifest,
  ContextManifestEntry,
  RetentionAudit,
} from "../context/public.js";
import type {
  ClauseProvenance,
  CompositionFinding,
  DecisionOutcome,
  InstructionEvidence,
} from "../instruction/public.js";
import type {
  CommandResult,
  StableId,
  ToolEvidence,
  WorldCommand,
  WorldDelta,
  WorldEvent,
  WorldState,
} from "../simulation/public.js";

/** Trace schema versions are intentionally literal so historical records do not float. */
export type TraceSchemaVersion = "1";
export type TraceMode = "production" | "eval" | "historical-replay";
export type TraceStatus = "recording" | "complete" | "interrupted" | "invalid" | "incomplete";
export type TraceStableId = StableId;

export type TraceEventKind =
  | "task"
  | "context-assembly"
  | "retention"
  | "clause-applicability"
  | "decision"
  | "tool-request"
  | "tool-result"
  | "evidence"
  | "world-delta"
  | "message"
  | "delegation"
  | "outcome"
  | "incident-link"
  | "capture-fault"
  | "snapshot";

export type TraceLinkKind =
  | "park"
  | "task"
  | "job"
  | "agent"
  | "entity"
  | "evidence"
  | "artifact"
  | "eval"
  | "review"
  | "deployment"
  | "incident"
  | "trace"
  | "replay";

export interface TraceLink {
  readonly kind: TraceLinkKind;
  readonly id: TraceStableId;
  readonly relation?: string;
}

export interface TraceRoot {
  readonly taskId?: TraceStableId;
  readonly jobId?: TraceStableId;
  readonly evalId?: TraceStableId;
}

export interface TraceContentManifestEntry {
  readonly reference: ContentReference;
  readonly class?: string;
  readonly schemaVersion?: string;
  readonly fingerprint?: string;
}

export interface TraceContentManifest {
  readonly schemaVersion: TraceSchemaVersion;
  readonly entries: readonly TraceContentManifestEntry[];
  readonly fingerprint: string;
}

export interface TraceStateReference {
  readonly initialTick: number;
  readonly initialFingerprint: string;
}

export interface TraceOutcome {
  readonly kind: "complete" | "failure" | "stop" | "escalate" | "interrupted";
  readonly reasonCode: string;
  readonly expected?: string;
  readonly observed?: string;
  readonly consequence?: string;
  readonly immediateCausalGap?: string;
}

export interface TraceCaptureFault {
  readonly code:
    | "TRACE_CAPTURE_INVALID"
    | "TRACE_CAPTURE_APPEND_FAILED"
    | "TRACE_CAPTURE_FINALIZE_FAILED"
    | "TRACE_CAPTURE_PROHIBITED_FIELD"
    | "TRACE_CAPTURE_SEQUENCE"
    | "TRACE_CAPTURE_CAUSAL_LINK";
  readonly scope: "identity" | "event" | "finalize" | "authority";
  readonly message: string;
  readonly eventId?: TraceStableId;
  readonly tick?: number;
}

export interface TraceAvailabilityEntry {
  readonly itemId: string;
  readonly availability: "available" | "unavailable" | "excluded" | "stale" | "never-routed";
  readonly used: boolean;
  readonly sourceVersion?: ContentReference;
  readonly reasonCode: string;
}

export interface TraceContextPayload {
  readonly beforeManifest?: ContextManifest;
  readonly afterManifest: ContextManifest;
  readonly entries: readonly TraceAvailabilityEntry[];
  readonly diagnostics: readonly string[];
}

export interface TraceTaskPayload {
  readonly taskId: TraceStableId;
  readonly jobId?: TraceStableId;
  readonly evalId?: TraceStableId;
  readonly artifactReferences: readonly ContentReference[];
  readonly exactContentManifest: TraceContentManifest;
}

export interface TraceRetentionPayload {
  readonly audit: RetentionAudit;
  readonly beforeEntries: readonly ContextManifestEntry[];
  readonly afterEntries: readonly ContextManifestEntry[];
}

export interface TraceClausePayload {
  readonly clauseId: string;
  readonly source: ContentReference;
  readonly sourceClass: string;
  readonly status: ClauseProvenance["status"];
  readonly reasonCode: string;
  readonly conflictGroup?: string;
}

export interface TraceDecisionPayload {
  readonly outcome: DecisionOutcome;
  readonly provenance: readonly ClauseProvenance[];
  readonly compositionFindings: readonly CompositionFinding[];
  readonly availableContextItemIds: readonly string[];
  readonly unavailableContextItemIds: readonly string[];
}

export interface TraceToolRequestPayload {
  readonly command: WorldCommand;
  readonly tool?: ContentReference;
}

export interface TraceToolResultPayload {
  readonly commandResult: CommandResult;
}

export interface TraceEvidencePayload {
  readonly evidence: readonly (ToolEvidence | InstructionEvidence)[];
}

export interface TraceWorldDeltaPayload {
  readonly delta: WorldDelta;
}

export interface TraceMessagePayload {
  readonly messageId: TraceStableId;
  readonly senderId: TraceStableId;
  readonly recipientId?: TraceStableId;
  readonly messageType: "report" | "request" | "escalation" | "handoff" | "notice";
  readonly summary: string;
  readonly contextItemIds: readonly string[];
}

export interface TraceDelegationPayload {
  readonly delegationId: TraceStableId;
  readonly managerId: TraceStableId;
  readonly workerId: TraceStableId;
  readonly jobId: TraceStableId;
  readonly authority: readonly string[];
  readonly artifactReferences: readonly ContentReference[];
}

export interface TraceOutcomePayload {
  readonly outcome: TraceOutcome;
  readonly finalStateFingerprint?: string;
}

export interface TraceIncidentLinkPayload {
  readonly incidentId: TraceStableId;
  readonly relation: "detected-by" | "caused-by" | "evidence-for" | "stabilized-by" | "resolved-by";
}

export interface TraceCaptureFaultPayload {
  readonly fault: TraceCaptureFault;
}

export interface TraceSnapshotPayload {
  readonly state: WorldState;
  readonly stateFingerprint: string;
}

export interface TraceEventBase<K extends TraceEventKind, P> {
  readonly schemaVersion: TraceSchemaVersion;
  readonly id: TraceStableId;
  readonly tick: number;
  readonly sequence: number;
  readonly kind: K;
  readonly cycleId?: TraceStableId;
  readonly actor?: TraceLink;
  readonly entityLinks: readonly TraceLink[];
  readonly causalParentIds: readonly TraceStableId[];
  readonly payload: P;
}

export type TraceEvent =
  | TraceEventBase<"task", TraceTaskPayload>
  | TraceEventBase<"context-assembly", TraceContextPayload>
  | TraceEventBase<"retention", TraceRetentionPayload>
  | TraceEventBase<"clause-applicability", TraceClausePayload>
  | TraceEventBase<"decision", TraceDecisionPayload>
  | TraceEventBase<"tool-request", TraceToolRequestPayload>
  | TraceEventBase<"tool-result", TraceToolResultPayload>
  | TraceEventBase<"evidence", TraceEvidencePayload>
  | TraceEventBase<"world-delta", TraceWorldDeltaPayload>
  | TraceEventBase<"message", TraceMessagePayload>
  | TraceEventBase<"delegation", TraceDelegationPayload>
  | TraceEventBase<"outcome", TraceOutcomePayload>
  | TraceEventBase<"incident-link", TraceIncidentLinkPayload>
  | TraceEventBase<"capture-fault", TraceCaptureFaultPayload>
  | TraceEventBase<"snapshot", TraceSnapshotPayload>;

export type TraceEventDraft = Omit<TraceEvent, "id" | "sequence"> & {
  readonly id?: TraceStableId;
  readonly sequence?: number;
};

export interface TraceAuthorityCommand {
  readonly decisionTick: number;
  readonly command: WorldCommand;
}

export interface TraceAuthority {
  readonly initialState: WorldState;
  readonly exactContent: readonly ContentReference[];
  readonly allowedCommandKinds: readonly WorldCommand["kind"][];
  readonly commands: readonly TraceAuthorityCommand[];
  readonly commandResults: readonly CommandResult[];
  readonly worldEvents: readonly WorldEvent[];
  readonly worldDeltas: readonly WorldDelta[];
}

export interface TraceIdentity {
  readonly schemaVersion: TraceSchemaVersion;
  readonly id: TraceStableId;
  readonly mode: TraceMode;
  readonly root: TraceRoot;
  readonly contentManifest: TraceContentManifest;
  readonly seed: number;
  readonly stateReference: TraceStateReference;
  readonly startTick: number;
}

export interface Trace {
  readonly schemaVersion: TraceSchemaVersion;
  readonly id: TraceStableId;
  readonly identity: TraceIdentity;
  readonly mode: TraceMode;
  readonly root: TraceRoot;
  readonly contentManifest: TraceContentManifest;
  readonly seed: number;
  readonly stateReference: TraceStateReference;
  readonly startTick: number;
  readonly endTick?: number;
  readonly status: TraceStatus;
  readonly events: readonly TraceEvent[];
  readonly authority: TraceAuthority;
  readonly finalState?: WorldState;
  readonly outcome?: TraceOutcome;
  readonly captureFaults: readonly TraceCaptureFault[];
}

/** Compatibility aliases keep the public vocabulary concise for downstream domains. */
export type TraceRecord = Trace;
export type TraceEventRecord = TraceEvent;

export interface TraceCaptureInput {
  readonly id: TraceStableId;
  readonly mode: TraceMode;
  readonly root: TraceRoot;
  readonly contentManifest: TraceContentManifest | ResolvedContentManifest | readonly ContentReference[];
  readonly seed: number;
  readonly startTick: number;
  readonly initialState: WorldState;
  readonly events?: readonly TraceEventDraft[];
  readonly authority?: Partial<TraceAuthority>;
  readonly finalState?: WorldState;
  readonly outcome?: TraceOutcome;
}

export type TraceAppendResult = {
  readonly ok: true;
  readonly event: TraceEvent;
} | {
  readonly ok: false;
  readonly fault: TraceCaptureFault;
};

export type TraceCaptureResult = {
  readonly ok: true;
  readonly trace: Trace;
} | {
  readonly ok: false;
  readonly trace: Trace;
  readonly fault: TraceCaptureFault;
};

export interface TraceDiagnostic {
  readonly code:
    | "TRACE_INVALID"
    | "TRACE_SCHEMA_INCOMPATIBLE"
    | "TRACE_EVENT_ORDER"
    | "TRACE_CAUSAL_PARENT_MISSING"
    | "TRACE_IDENTITY_MISMATCH"
    | "TRACE_PROHIBITED_FIELD";
  readonly path: string;
  readonly message: string;
}

export type TraceValidationResult =
  | { readonly ok: true; readonly trace: Trace }
  | { readonly ok: false; readonly diagnostics: readonly TraceDiagnostic[] };

export interface TraceRecorder {
  readonly id: TraceStableId;
  append(event: TraceEventDraft | TraceEvent): TraceAppendResult;
  record(event: TraceEventDraft | TraceEvent): TraceAppendResult;
  reportFailure(fault: TraceCaptureFault): void;
  snapshot(): Trace;
  finalize(status?: Exclude<TraceStatus, "recording">, outcome?: TraceOutcome, finalState?: WorldState): Trace;
}

export interface TraceConciseProjection {
  readonly schemaVersion: TraceSchemaVersion;
  readonly traceId: TraceStableId;
  readonly mode: TraceMode;
  readonly status: TraceStatus;
  readonly root: TraceRoot;
  readonly startTick: number;
  readonly endTick?: number;
  readonly outcome?: TraceOutcome;
  readonly expected?: string;
  readonly observed?: string;
  readonly consequence?: string;
  readonly immediateCausalGap?: string;
  readonly eventCount: number;
  readonly cycleCount: number;
  readonly availableDetail: boolean;
  readonly links: readonly TraceLink[];
}

export interface TraceDecisionCycleProjection {
  readonly cycleId: TraceStableId;
  readonly tick: number;
  readonly eventIds: readonly TraceStableId[];
  readonly context: readonly TraceContextPayload[];
  readonly clauses: readonly TraceClausePayload[];
  readonly decisions: readonly TraceDecisionPayload[];
  readonly toolRequests: readonly TraceToolRequestPayload[];
  readonly toolResults: readonly TraceToolResultPayload[];
  readonly evidence: readonly TraceEvidencePayload[];
  readonly worldDeltas: readonly WorldDelta[];
  readonly cost?: number;
}

export interface TraceDetailedProjection {
  readonly schemaVersion: TraceSchemaVersion;
  readonly traceId: TraceStableId;
  readonly mode: TraceMode;
  readonly status: TraceStatus;
  readonly cycles: readonly TraceDecisionCycleProjection[];
  readonly events: readonly TraceEvent[];
  readonly contextAvailability: readonly TraceAvailabilityEntry[];
  readonly links: readonly TraceLink[];
}

export interface TraceProjection {
  readonly concise: TraceConciseProjection;
  readonly detailed: TraceDetailedProjection;
}

export interface ReplayCursor {
  readonly tick: number;
  readonly sequence: number;
  readonly eventId?: TraceStableId;
}

export type ReplayStatus = "ready" | "playing" | "paused" | "unavailable" | "invalid";

export interface ReplayDiagnostic {
  readonly code: "REPLAY_SCHEMA_INCOMPATIBLE" | "REPLAY_CONTENT_MISSING" | "REPLAY_TRACE_INCOMPLETE" | "REPLAY_SEEK_INVALID" | "REPLAY_APPLY_FAILED";
  readonly message: string;
  readonly path?: string;
}

export interface ReplaySessionSnapshot {
  readonly schemaVersion: TraceSchemaVersion;
  readonly sessionId: TraceStableId;
  readonly traceId: TraceStableId;
  readonly mode: "historical-replay";
  readonly status: ReplayStatus;
  readonly paused: boolean;
  readonly speed: 1 | 2 | 4;
  readonly cursor: ReplayCursor;
  readonly world: WorldState;
  readonly focusedLink?: TraceLink;
  readonly selectedEventId?: TraceStableId;
  readonly diagnostics: readonly ReplayDiagnostic[];
}

export interface ReplaySession {
  readonly trace: Trace;
  snapshot(): ReplaySessionSnapshot;
  play(): ReplaySessionSnapshot;
  pause(): ReplaySessionSnapshot;
  step(count?: number): ReplaySessionSnapshot;
  advance(ticks?: number): ReplaySessionSnapshot;
  seek(target: number | { readonly tick?: number; readonly eventId?: TraceStableId }): ReplaySessionSnapshot;
  setSpeed(speed: 1 | 2 | 4): ReplaySessionSnapshot;
  focus(link?: TraceLink): ReplaySessionSnapshot;
}

export interface ReplaySessionOptions {
  readonly availableContent?: readonly ContentReference[];
  readonly registry?: { readonly resolveExact: (id: string, version: string) => { readonly ok: boolean } };
}

export interface TraceRerunOptions {
  readonly commands?: readonly TraceAuthorityCommand[];
  readonly availableContent?: readonly ContentReference[];
  readonly registry?: { readonly resolveExact: (id: string, version: string) => { readonly ok: boolean } };
}

export interface ReplayVerificationMismatch {
  readonly kind: "event" | "final-state" | "schema" | "content";
  readonly path: string;
  readonly expected: string;
  readonly observed: string;
  readonly tick?: number;
  readonly sequence?: number;
  readonly eventId?: TraceStableId;
}

export interface ReplayVerificationResult {
  readonly status: "equivalent" | "mismatch" | "unavailable" | "invalid";
  readonly traceId: TraceStableId;
  readonly rerunTraceId?: TraceStableId;
  readonly comparedEvents: number;
  readonly firstMismatch?: ReplayVerificationMismatch;
  readonly diagnostics: readonly ReplayDiagnostic[];
}

export interface TraceComparisonAlignment {
  readonly leftCycleId?: TraceStableId;
  readonly rightCycleId?: TraceStableId;
  readonly leftTick?: number;
  readonly rightTick?: number;
  readonly status: "matched" | "left-only" | "right-only";
  readonly contextDelta?: string;
  readonly clauseSelection?: string;
  readonly actions?: string;
  readonly evidence?: string;
  readonly cost?: string;
  readonly worldOutcome?: string;
}

export interface TraceComparisonDifference {
  readonly category: "context" | "clause" | "action" | "evidence" | "cost" | "world-outcome" | "outcome" | "alignment";
  readonly path: string;
  readonly left: string;
  readonly right: string;
}

export interface TraceComparisonResult {
  readonly schemaVersion: TraceSchemaVersion;
  readonly compatible: boolean;
  readonly leftTraceId: TraceStableId;
  readonly rightTraceId: TraceStableId;
  readonly alignments: readonly TraceComparisonAlignment[];
  readonly differences: readonly TraceComparisonDifference[];
}
