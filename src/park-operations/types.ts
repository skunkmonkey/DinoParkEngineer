import type { ContentReference, ContentRegistry } from "../content-registry/public.js";
import type { ContextFault } from "../context/public.js";
import type { StableId } from "../simulation/public.js";

export type ParkPhase = "pre-opening" | "open" | "closing" | "engineering";
export type JobStatus = "queued" | "assigned" | "running" | "paused" | "cancelled" | "completed" | "failed" | "stopped" | "escalated";
export type AlertSeverity = "warning" | "emergency";
export type AlertStatus = "queued" | "interrupted" | "acknowledged" | "grouped";
export type IncidentStatus = "detected" | "active" | "stabilized" | "engineering-unresolved" | "resolved" | "closed";
export type OperationalSignalClassification = "ambient" | "warning" | "emergency";

export interface ExactVersionPin {
  readonly reference: ContentReference;
  readonly manifestFingerprint: string;
}

export interface ParkJob {
  readonly id: StableId;
  readonly occurrenceId?: StableId;
  readonly task: ContentReference;
  readonly targetId: StableId;
  readonly priority: number;
  readonly scheduleId?: StableId;
  readonly source: "schedule" | "player" | "system";
  readonly status: JobStatus;
  readonly exactDeployedVersions: readonly ExactVersionPin[];
  readonly assignedAgentId?: StableId;
  readonly createdTick: number;
  readonly dueTick: number;
  readonly requiredForOpening: boolean;
  readonly resultLinks: readonly StableId[];
}

export interface ParkSchedule {
  readonly id: StableId;
  readonly task: ContentReference;
  readonly targetId: StableId;
  readonly priority: number;
  readonly dueTickOffset: number;
  readonly artifactVersions: readonly ContentReference[];
  readonly requiredForOpening: boolean;
  readonly enabled: boolean;
}

export interface ScheduleOccurrence {
  readonly id: StableId;
  readonly scheduleId: StableId;
  readonly day: number;
  readonly dueTick: number;
  readonly jobId: StableId;
}

export interface OperationalSignal {
  readonly id: StableId;
  readonly tick: number;
  readonly classification: OperationalSignalClassification;
  readonly source: "world" | "job" | "context" | "system";
  readonly causalKey: string;
  readonly spatialKey: string;
  readonly locationId: StableId;
  readonly risk: number;
  readonly expected: string;
  readonly observed: string;
  readonly consequence: string;
  readonly immediateGap: string;
  readonly entityIds: readonly StableId[];
  readonly traceIds: readonly StableId[];
}

export interface OperationalAlert {
  readonly id: StableId;
  readonly signalId: StableId;
  readonly tick: number;
  readonly severity: AlertSeverity;
  readonly status: AlertStatus;
  readonly locationId: StableId;
  readonly immediateRisk: string;
  readonly risk: number;
  readonly entityIds: readonly StableId[];
  readonly traceIds: readonly StableId[];
  readonly incidentId?: StableId;
  readonly pauseRequested: boolean;
}

export interface ParkIncident {
  readonly id: StableId;
  readonly status: IncidentStatus;
  readonly detectedTick: number;
  readonly updatedTick: number;
  readonly causalKeys: readonly string[];
  readonly spatialKeys: readonly string[];
  readonly locationId: StableId;
  readonly risk: number;
  readonly expected: string;
  readonly observed: readonly string[];
  readonly consequence: readonly string[];
  readonly immediateGap: readonly string[];
  readonly entityIds: readonly StableId[];
  readonly traceIds: readonly StableId[];
  readonly alertIds: readonly StableId[];
  readonly stabilizedTick?: number;
  readonly resolvedTick?: number;
  readonly closedTick?: number;
}

export interface OperationalDaySummary {
  readonly id: StableId;
  readonly day: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly attendance: number;
  readonly departedVisitors: number;
  readonly completedJobIds: readonly StableId[];
  readonly failedJobIds: readonly StableId[];
  readonly incidentIds: readonly StableId[];
  readonly interventionCommandIds: readonly StableId[];
}

export interface ParkOperationsState {
  readonly schemaVersion: "1";
  readonly day: number;
  readonly dayStartedTick: number;
  readonly tick: number;
  readonly phase: ParkPhase;
  readonly paused: boolean;
  readonly speed: 1 | 2 | 4;
  readonly visitorsPresent: number;
  readonly totalAttendance: number;
  readonly departedVisitors: number;
  readonly jobs: readonly ParkJob[];
  readonly schedules: readonly ParkSchedule[];
  readonly occurrences: readonly ScheduleOccurrence[];
  readonly signals: readonly OperationalSignal[];
  readonly alerts: readonly OperationalAlert[];
  readonly incidents: readonly ParkIncident[];
  readonly interventionCommandIds: readonly StableId[];
  readonly daySummaries: readonly OperationalDaySummary[];
}

export type ParkOperationsDiagnosticCode =
  | "OPS_COMMAND_INVALID"
  | "OPS_PHASE_INVALID"
  | "OPS_JOB_DUPLICATE"
  | "OPS_JOB_NOT_FOUND"
  | "OPS_JOB_TRANSITION_INVALID"
  | "OPS_AGENT_NOT_FOUND"
  | "OPS_CONTENT_UNRESOLVED"
  | "OPS_TICK_STALE"
  | "OPS_VISITOR_PHASE_INVALID"
  | "OPS_INCIDENT_NOT_FOUND"
  | "OPS_INCIDENT_TRANSITION_INVALID"
  | "OPS_SIGNAL_INVALID"
  | "OPS_PORT_REJECTED";

export interface ParkOperationsDiagnostic {
  readonly code: ParkOperationsDiagnosticCode;
  readonly path: string;
  readonly rule: string;
  readonly message: string;
}

interface CommandBase { readonly id: StableId; readonly expectedTick: number }
export type ParkOperationsCommand =
  | (CommandBase & { readonly kind: "create-job"; readonly job: Omit<ParkJob, "status" | "exactDeployedVersions" | "resultLinks">; readonly artifactVersions: readonly ContentReference[] })
  | (CommandBase & { readonly kind: "assign-job"; readonly jobId: StableId; readonly agentId: StableId })
  | (CommandBase & { readonly kind: "start-job" | "pause-job" | "resume-job" | "cancel-job" | "complete-job" | "fail-job" | "stop-job" | "escalate-job"; readonly jobId: StableId; readonly resultLink?: StableId })
  | (CommandBase & { readonly kind: "transition-phase"; readonly phase: ParkPhase })
  | (CommandBase & { readonly kind: "set-time-control"; readonly paused: boolean; readonly speed: 1 | 2 | 4 })
  | (CommandBase & { readonly kind: "open-park" | "begin-closing" | "enter-engineering" | "start-next-day" })
  | (CommandBase & { readonly kind: "admit-visitors" | "depart-visitors"; readonly count: number })
  | (CommandBase & { readonly kind: "acknowledge-alert"; readonly alertId: StableId })
  | (CommandBase & { readonly kind: "activate-incident" | "stabilize-incident" | "mark-engineering-unresolved" | "resolve-incident" | "close-incident"; readonly incidentId: StableId });

export type ParkOperationsCommandResult =
  | { readonly accepted: true; readonly commandId: StableId; readonly state: Readonly<ParkOperationsState>; readonly createdJobIds: readonly StableId[]; readonly pauseRequested: boolean }
  | { readonly accepted: false; readonly commandId: StableId; readonly state: Readonly<ParkOperationsState>; readonly diagnostics: readonly ParkOperationsDiagnostic[]; readonly createdJobIds: readonly [] };

export type OperationalSignalResult =
  | { readonly accepted: true; readonly state: Readonly<ParkOperationsState>; readonly classification: OperationalSignalClassification; readonly alertId?: StableId; readonly incidentId?: StableId; readonly pauseRequested: boolean }
  | { readonly accepted: false; readonly state: Readonly<ParkOperationsState>; readonly diagnostics: readonly ParkOperationsDiagnostic[] };

export interface ProductionVersionResolver {
  resolve(reference: ContentReference): { readonly ok: true; readonly pin: ExactVersionPin } | { readonly ok: false };
}

export interface ParkOperationsService {
  snapshot(): ParkOperationsState;
  project(): Readonly<ParkOperationsState>;
  advanceToTick(tick: number): ParkOperationsCommandResult;
  execute(command: unknown): ParkOperationsCommandResult;
  ingestSignal(signal: unknown): OperationalSignalResult;
  reportContextFault(fault: ContextFault): OperationalSignalResult;
}

export interface ParkOperationsPorts {
  readonly time?: { setPaused(paused: boolean): void; setSpeed(speed: 1 | 2 | 4): void };
  readonly visitors?: { admit(count: number): boolean; depart(count: number): boolean };
}

export type RegistryResolverSource = Pick<ContentRegistry, "resolveExact">;
