/**
 * Privacy-conscious product telemetry contracts.
 *
 * This package deliberately contains no references to gameplay stores. Domain
 * producers pass the small, typed summaries below and the telemetry boundary
 * validates them before a delivery adapter can see them.
 */

export const TELEMETRY_SCHEMA_VERSION = 1 as const;

export type TelemetryEventType =
  | "CONTEXT_SNAPSHOT"
  | "CONTEXT_SUMMARY"
  | "CONTEXT_FINDING"
  | "JOB_OUTCOME"
  | "INCIDENT"
  | "EVAL_BUILD"
  | "EVAL_RUN"
  | "EVAL_SELECTION"
  | "REVIEW"
  | "DEPLOY"
  | "REVERT"
  | "ARTIFACT_REFACTOR"
  | "CAPABILITY"
  | "UNLOCK"
  | "PURCHASE"
  | "MANUAL_INTERVENTION"
  | "MANAGER_ADOPTION"
  | "MANAGER_ASSIGNMENT"
  | "MANAGER_ESCALATION"
  | "SAVE_ERROR"
  | "APPLICATION_ERROR";

export type TelemetryCategory = "analytics" | "essential";

export interface TelemetryContext {
  readonly installationId?: string;
  readonly sessionId?: string;
  readonly logicalTime: number;
  readonly appVersion?: string;
  readonly contentVersion?: string;
  readonly phaseId?: string;
  readonly scenarioId?: string;
}

export interface ContextSnapshotTelemetryPayload {
  readonly snapshotId?: string;
  readonly jobId?: string;
  readonly agentId?: string;
  readonly budget?: number;
  readonly totalLoad?: number;
  readonly utilization?: number;
  readonly itemCount?: number;
  readonly duplicateCu?: number;
  readonly duplicateContextCu?: number;
  readonly findingCount?: number;
  readonly mode?: "PROJECTED" | "ACTUAL";
  readonly overflow?: boolean;
}

export interface ContextFindingTelemetryPayload {
  readonly snapshotId?: string;
  readonly findingCode: string;
  readonly severity?: "INFO" | "WARNING" | "ERROR" | number;
  readonly cuImpact?: number;
  readonly duplicate?: boolean;
  readonly stale?: boolean;
  readonly applicabilityMismatch?: boolean;
}

export interface JobOutcomeTelemetryPayload {
  readonly jobId?: string;
  readonly status: string;
  readonly duration?: number;
  readonly severity?: number;
  readonly toolCallCount?: number;
  readonly interventionRequired?: boolean;
  readonly contextLoad?: number;
  readonly contextBudget?: number;
  readonly duplicateCu?: number;
  readonly duplicateContextCu?: number;
  readonly evalRun?: boolean;
}

export interface IncidentTelemetryPayload {
  readonly incidentId?: string;
  readonly severity: number;
  readonly category: string;
  readonly status?: string;
  readonly uncovered?: boolean;
  readonly jobId?: string;
}

export interface EvalBuildTelemetryPayload {
  readonly evalId: string;
  readonly evalVersion?: number;
  readonly riskLevel?: string;
  readonly severity?: number;
  readonly buildCost?: number;
  readonly built?: boolean;
  readonly incidentId?: string;
  readonly fromIncidentId?: string;
}

export interface EvalRunTelemetryPayload {
  readonly evalId: string;
  readonly evalVersion?: number;
  readonly runId?: string;
  readonly passed: boolean;
  readonly severity?: number;
  readonly assertionCount?: number;
  readonly failedAssertionCount?: number;
  readonly runCost?: number;
  readonly contextLoad?: number;
  readonly incidentId?: string;
  readonly fromIncidentId?: string;
}

export interface EvalSelectionTelemetryPayload {
  readonly evalId: string;
  readonly evalVersion?: number;
  readonly suiteId?: string;
  readonly selected: boolean;
  readonly severity?: number;
}

export interface ReviewTelemetryPayload {
  readonly reviewId: string;
  readonly artifactId?: string;
  readonly artifactVersion?: number;
  readonly decision?: string;
  readonly evalRunCount?: number;
  readonly contextDeltaCu?: number;
  readonly riskLevel?: string;
}

export interface DeployTelemetryPayload {
  readonly deploymentId?: string;
  readonly artifactId?: string;
  readonly artifactVersion?: number;
  readonly evalRunCount?: number;
  readonly evalRun?: boolean;
  readonly hasEvalRun?: boolean;
  readonly coveredSeverity?: number;
  readonly warningCount?: number;
  readonly outcome?: string;
}

export interface RevertTelemetryPayload {
  readonly deploymentId?: string;
  readonly artifactId?: string;
  readonly artifactVersion?: number;
  readonly reasonCategory?: string;
}

export interface ArtifactRefactorTelemetryPayload {
  readonly artifactId: string;
  readonly fromVersion?: number;
  readonly toVersion?: number;
  readonly fromCu?: number;
  readonly toCu?: number;
  readonly duplicateCu?: number;
  readonly moduleCount?: number;
  readonly incidentId?: string;
  readonly fromIncidentId?: string;
}

export interface CapabilityTelemetryPayload {
  readonly capabilityId: string;
  readonly level?: number;
  readonly amount?: number;
  readonly currency?: string;
  readonly success?: boolean;
  readonly reasonCode?: string;
}

export interface UnlockTelemetryPayload {
  readonly capabilityId: string;
  readonly level?: number;
  readonly reasonCode?: string;
}

export interface PurchaseTelemetryPayload {
  readonly purchaseId?: string;
  readonly capabilityId?: string;
  readonly amount: number;
  readonly currency?: string;
  readonly success?: boolean;
  readonly reasonCode?: string;
}

export interface ManualInterventionTelemetryPayload {
  readonly jobId?: string;
  readonly interventionType: string;
  readonly reasonCategory?: string;
  readonly severity?: number;
  readonly jobsSinceLast?: number;
  readonly count?: number;
}

export interface ManagerAdoptionTelemetryPayload {
  readonly managerId: string;
  readonly managerVersion?: number;
  readonly workerCount?: number;
  readonly eligible?: boolean;
  readonly adopted: boolean;
  readonly reasonCode?: string;
}

export interface ManagerAssignmentTelemetryPayload {
  readonly managerId: string;
  readonly jobId?: string;
  readonly workerId?: string;
  readonly accepted: boolean;
  readonly reasonCategory?: string;
  readonly concurrentCount?: number;
}

export interface ManagerEscalationTelemetryPayload {
  readonly managerId: string;
  readonly jobId?: string;
  readonly incidentId?: string;
  readonly severity: number;
  readonly reasonCategory?: string;
  readonly fallbackAttempts?: number;
}

export interface SaveErrorTelemetryPayload {
  readonly operation: string;
  readonly errorCode: string;
  readonly recoverable?: boolean;
  readonly stateVersion?: number;
}

export interface ApplicationErrorTelemetryPayload {
  readonly errorCode: string;
  readonly recoverable?: boolean;
  readonly surface?: string;
  readonly featureId?: string;
  readonly count?: number;
}

export interface TelemetryPayloads {
  readonly CONTEXT_SNAPSHOT: ContextSnapshotTelemetryPayload;
  readonly CONTEXT_SUMMARY: ContextSnapshotTelemetryPayload;
  readonly CONTEXT_FINDING: ContextFindingTelemetryPayload;
  readonly JOB_OUTCOME: JobOutcomeTelemetryPayload;
  readonly INCIDENT: IncidentTelemetryPayload;
  readonly EVAL_BUILD: EvalBuildTelemetryPayload;
  readonly EVAL_RUN: EvalRunTelemetryPayload;
  readonly EVAL_SELECTION: EvalSelectionTelemetryPayload;
  readonly REVIEW: ReviewTelemetryPayload;
  readonly DEPLOY: DeployTelemetryPayload;
  readonly REVERT: RevertTelemetryPayload;
  readonly ARTIFACT_REFACTOR: ArtifactRefactorTelemetryPayload;
  readonly CAPABILITY: CapabilityTelemetryPayload;
  readonly UNLOCK: UnlockTelemetryPayload;
  readonly PURCHASE: PurchaseTelemetryPayload;
  readonly MANUAL_INTERVENTION: ManualInterventionTelemetryPayload;
  readonly MANAGER_ADOPTION: ManagerAdoptionTelemetryPayload;
  readonly MANAGER_ASSIGNMENT: ManagerAssignmentTelemetryPayload;
  readonly MANAGER_ESCALATION: ManagerEscalationTelemetryPayload;
  readonly SAVE_ERROR: SaveErrorTelemetryPayload;
  readonly APPLICATION_ERROR: ApplicationErrorTelemetryPayload;
}

export type TelemetryPayload = TelemetryPayloads[TelemetryEventType];

export type TelemetryEvent<E extends TelemetryEventType = TelemetryEventType> = {
  readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION;
  readonly eventId: string;
  /** Compatibility alias for feature event systems that call the stable id `id`. */
  readonly id?: string;
  readonly installationId: string;
  readonly sessionId: string;
  readonly type: E;
  readonly logicalTime: number;
  readonly appVersion: string;
  readonly contentVersion: string;
  readonly phaseId?: string;
  readonly scenarioId?: string;
  readonly category: TelemetryCategory;
  readonly payload: TelemetryPayloads[E];
};

export type SanitizedTelemetryEvent<E extends TelemetryEventType = TelemetryEventType> = TelemetryEvent<E>;

export interface TelemetryValidationError {
  readonly code:
    | "UNKNOWN_EVENT_TYPE"
    | "INVALID_EVENT"
    | "UNKNOWN_FIELD"
    | "FORBIDDEN_FIELD"
    | "INVALID_FIELD"
    | "INVALID_CONTEXT"
    | "PII_FIELD";
  readonly path: string;
  readonly message: string;
}

export interface TelemetryValidationResult<E extends TelemetryEventType = TelemetryEventType> {
  readonly valid: boolean;
  readonly event?: SanitizedTelemetryEvent<E>;
  readonly errors: readonly TelemetryValidationError[];
}

export interface TelemetryDelivery {
  send(batch: readonly SanitizedTelemetryEvent[]): Promise<{ readonly acceptedIds: readonly string[] }>;
}

export interface TelemetryQueueOptions {
  readonly maxItems?: number;
  readonly maxSize?: number;
  readonly batchSize?: number;
  readonly maxBatchSize?: number;
  readonly maxRetries?: number;
  readonly retryBaseMs?: number;
  readonly retryBaseDelayMs?: number;
  readonly onDrop?: (event: SanitizedTelemetryEvent, reason: "BOUNDED" | "DUPLICATE") => void;
}

export interface TelemetryQueueEntry {
  readonly event: SanitizedTelemetryEvent;
  readonly attempts: number;
  readonly nextAttemptAt: number;
}

export interface TelemetryQueueSnapshot {
  readonly entries: readonly TelemetryQueueEntry[];
  readonly droppedCount: number;
  readonly inFlight: boolean;
}

export interface TelemetryPort {
  emit<E extends TelemetryEventType>(type: E, payload: TelemetryPayloads[E], context?: Partial<TelemetryContext>): void;
  setOptionalEnabled(enabled: boolean): void;
}

export interface TelemetryDiagnosticsPort extends TelemetryPort {
  isOptionalEnabled(): boolean;
  inspectQueue(): TelemetryQueueSnapshot;
  clearQueue(): void;
  pendingEvents(): readonly SanitizedTelemetryEvent[];
  subscribe(listener: () => void): () => void;
}

export interface TelemetryClientOptions {
  readonly installationId?: string;
  readonly sessionId?: string;
  readonly appVersion?: string;
  readonly contentVersion?: string;
  readonly phaseId?: string;
  readonly scenarioId?: string;
  readonly logicalTime?: () => number;
  readonly optionalEnabled?: boolean;
  readonly delivery?: TelemetryDelivery;
  readonly queue?: TelemetryQueueOptions;
}
