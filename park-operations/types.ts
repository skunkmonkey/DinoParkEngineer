import type {
  AgentDefinition,
  InstructionEngine,
  InstructionJob,
  JobOutcome,
} from "../instruction/index.ts";
import type { ContentRegistry, ArtifactRef } from "../content-registry/index.ts";
import type { ContextFinding, ContextService, ContextSnapshot } from "../context/index.ts";
import type { MemoryRecord, MemoryRepository, MemoryService } from "../memory/index.ts";
import type {
  Incident,
  JobStatus as SimulationJobStatus,
  SimulationEngine,
  WorldFixture,
  WorldCommand,
  WorldEvent,
  WorldSnapshot,
} from "../simulation/index.ts";
import type { TraceQuery, TraceSink } from "../trace-replay/index.ts";
import type { EconomyProgressionService } from "../economy-progression/index.ts";

export type OperationsJobStatus = SimulationJobStatus | "BLOCKED" | "PAUSED" | "CANCELLED";
export type Job = OperationsJob;

export interface JobTemplate {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly description: string;
  readonly targetKinds: readonly string[];
  readonly promptRefs: readonly ArtifactRef[];
  readonly skillRefs: readonly ArtifactRef[];
  readonly systemPromptRefs?: readonly ArtifactRef[];
  readonly defaultPriority: number;
  readonly dueOffsetSeconds: number;
}

export interface JobDraft {
  readonly templateId?: string;
  readonly type: string;
  readonly targetRefs: readonly string[];
  readonly priority: number;
  readonly dueTime: number;
  readonly promptRef: ArtifactRef;
  readonly skillRefs?: readonly ArtifactRef[];
  readonly systemPromptRefs?: readonly ArtifactRef[];
  readonly assignedAgentId?: string;
  readonly expectedParkVersion?: number;
}

export interface OperationsJob extends InstructionJob {
  readonly type: string;
  readonly status: OperationsJobStatus;
  readonly promptRef: ArtifactRef;
  readonly skillRefs: readonly ArtifactRef[];
  readonly systemPromptRefs: readonly ArtifactRef[];
  readonly assignedAgentId: string;
  readonly contextSnapshotId?: string;
  readonly contextSnapshot?: ContextSnapshot;
  readonly traceId?: string;
  readonly observedVersion: number;
  readonly createdAtLogicalTime: number;
  readonly updatedAtLogicalTime: number;
  readonly safePoint?: "IDLE" | "PENDING" | "PAUSED";
  readonly outcome?: JobOutcome;
  readonly diagnostics: readonly string[];
}

export interface EligibleAgent {
  readonly agentId: string;
  readonly reason: string;
  readonly contextBudget: number;
  readonly projectedContextLoad?: number;
  readonly missingToolIds: readonly string[];
}

export interface JobPreflight {
  readonly ok: boolean;
  readonly draft: JobDraft;
  readonly template?: JobTemplate;
  readonly context?: ContextSnapshot;
  readonly contextFindings: readonly ContextFinding[];
  readonly eligibleAgents: readonly EligibleAgent[];
  readonly selectedAgentId?: string;
  readonly projectedLoad: number;
  readonly budget: number;
  readonly diagnostics: readonly string[];
  readonly remediation: readonly string[];
  readonly dependencyRefs: readonly string[];
  readonly requiredToolIds: readonly string[];
}

export type JobCommandErrorCode =
  | "DUPLICATE_COMMAND"
  | "STALE_SNAPSHOT"
  | "INVALID_DRAFT"
  | "PREFLIGHT_BLOCKED"
  | "UNKNOWN_JOB"
  | "UNKNOWN_AGENT"
  | "NOT_ELIGIBLE"
  | "INVALID_TRANSITION"
  | "SAFE_POINT_PENDING"
  | "INVALID_COMMAND";

export interface JobCommandError {
  readonly code: JobCommandErrorCode;
  readonly message: string;
  readonly commandId?: string;
  readonly observedVersion?: number;
  readonly expectedVersion?: number;
  readonly remediation?: readonly string[];
}

export type JobCommandResult =
  | { readonly ok: true; readonly job: OperationsJob; readonly duplicate?: boolean; readonly commandId: string }
  | { readonly ok: false; readonly error: JobCommandError; readonly commandId: string };

export interface OperationsEntityRow {
  readonly id: string;
  readonly kind: "ZONE" | "ENCLOSURE" | "GATE" | "DINOSAUR" | "AGENT" | "VISITOR" | "DEVICE" | "INCIDENT";
  readonly label: string;
  readonly state: string;
  readonly location?: string;
  readonly sourceId: string;
  readonly deepLink: string;
  readonly severity?: 0 | 1 | 2 | 3 | 4;
}

export interface ParkMetrics {
  readonly credits: number;
  readonly logicalTime: number;
  readonly speed: 1 | 2 | 4;
  readonly paused: boolean;
  readonly attendance: number;
  readonly satisfaction: number;
  readonly dinosaurHealth: number;
  readonly uptime: number;
  readonly closures: number;
  readonly openIncidents: number;
  readonly recoveredIncidents: number;
}

export interface ParkOperationsView {
  readonly version: number;
  readonly snapshot: WorldSnapshot;
  readonly metrics: ParkMetrics;
  readonly jobs: readonly OperationsJob[];
  readonly agents: readonly AgentOperationsView[];
  readonly incidents: readonly Incident[];
  readonly alerts: readonly Incident[];
  readonly acknowledgedIncidentIds: readonly string[];
  readonly incidentTraceLinks: Readonly<Record<string, string>>;
  readonly incidentDetails: readonly IncidentOperationsView[];
  readonly mapRows: readonly OperationsEntityRow[];
  /** A nonvisual equivalent generated from the same mapRows source. */
  readonly accessibleRows: readonly OperationsEntityRow[];
  readonly selectedEntityId?: string;
  readonly sourceIds: Readonly<Record<string, string>>;
}

export interface IncidentOperationsView {
  readonly id: string;
  readonly severity: 0 | 1 | 2 | 3 | 4;
  readonly trigger: string;
  readonly status: string;
  readonly affectedEntityIds: readonly string[];
  readonly recoveryRequirements: readonly string[];
  readonly currentResponse: string;
  readonly responsibleJobId?: string;
  readonly traceId?: string;
  readonly costCredits: number;
}

export interface AgentOperationsView {
  readonly id: string;
  readonly definitionId: string;
  readonly status: string;
  readonly location: string;
  readonly battery: number;
  readonly tools: readonly string[];
  readonly currentTask?: OperationsJob;
  readonly queue: readonly OperationsJob[];
  readonly contextBudget: number;
  readonly contextLoad: number;
  readonly contextSnapshotId?: string;
  readonly contextItems: readonly ContextSnapshot["items"][number][];
  readonly memorySummary: readonly { readonly id: string; readonly status: string; readonly provenance: string }[];
  readonly managerId?: string;
  readonly recentTraceIds: readonly string[];
  readonly sourceId: string;
}

export type OperationsChangeKind = "SNAPSHOT" | "JOB" | "INCIDENT" | "METRIC";

export interface OperationsChange {
  readonly version: number;
  readonly kind: OperationsChangeKind;
  readonly ids: readonly string[];
  readonly logicalTime: number;
}

export interface OperationsQuery {
  getPark(): ParkOperationsView;
  getAgent(id: string): AgentOperationsView | undefined;
  subscribe(listener: (change: OperationsChange) => void): () => void;
}

export interface JobApplicationService {
  preflight(input: JobDraft): JobPreflight;
  create(input: JobDraft, commandId: string): JobCommandResult;
  assign(jobId: string, agentId: string, commandId: string, expectedVersion?: number): JobCommandResult;
  reprioritize(jobId: string, priority: number, commandId: string, expectedVersion?: number): JobCommandResult;
  cancelOrPauseAtSafePoint(jobId: string, commandId: string, expectedVersion?: number): JobCommandResult;
  start(jobId: string, commandId?: string): JobCommandResult;
  acknowledgeIncident(incidentId: string, commandId: string, expectedVersion?: number): { readonly ok: true; readonly commandId: string } | { readonly ok: false; readonly error: JobCommandError; readonly commandId: string };
  intervene(command: WorldCommand, commandId?: string): { readonly ok: true; readonly events: readonly WorldEvent[] } | { readonly ok: false; readonly error: JobCommandError };
}

export interface ParkOperationsDependencies {
  readonly simulation?: SimulationEngine;
  readonly instruction?: InstructionEngine;
  readonly content?: ContentRegistry;
  readonly context?: ContextService;
  readonly memory?: MemoryService;
  readonly traces?: TraceSink & TraceQuery;
  readonly economy?: EconomyProgressionService;
  readonly templates?: readonly JobTemplate[];
  readonly agentDefinitions?: readonly AgentDefinition[];
  readonly fixture?: WorldFixture;
  /** Resolves the active exact version at job intake. Existing jobs retain
   * their already-pinned refs. */
  readonly resolveActiveRef?: (artifactId: string) => ArtifactRef | undefined;
}

export interface ParkOperationsService extends OperationsQuery, JobApplicationService {
  readonly jobs: () => readonly OperationsJob[];
  readonly snapshot: () => WorldSnapshot;
  readonly advanceTo: (logicalTime: number) => readonly WorldEvent[];
  readonly refresh: () => void;
  readonly getControlState: () => { readonly paused: boolean; readonly speed: 1 | 2 | 4 };
  readonly setPaused: (paused: boolean) => void;
  readonly setSpeed: (speed: 1 | 2 | 4) => void;
  readonly runToCompletion: (jobId: string, commandId?: string) => JobCommandResult;
  readonly persistenceSnapshot: () => ParkOperationsPersistenceState;
  readonly restorePersistence: (state: ParkOperationsPersistenceState) => void;
  readonly restoreWorld: (snapshot: WorldSnapshot) => void;
  readonly memoryRepository: () => MemoryRepository;
  readonly isPersistenceSafe: () => boolean;
  /** Temporarily pauses execution without publishing gameplay mutations; the
   * returned release restores the exact prior control state. */
  readonly enterPersistenceSafeBoundary: () => () => void;
}

export interface ParkOperationsPersistenceState {
  readonly world: WorldSnapshot;
  readonly jobs: readonly OperationsJob[];
  readonly commandResults: readonly { readonly id: string; readonly result: JobCommandResult }[];
  readonly acknowledgedIncidentIds: readonly string[];
  readonly memory: readonly MemoryRecord[];
  readonly operationVersion: number;
  readonly paused: boolean;
  readonly speed: 1 | 2 | 4;
}
