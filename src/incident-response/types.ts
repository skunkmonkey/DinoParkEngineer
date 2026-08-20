import type { EconomyQuote, EconomyReservation, EconomyService, EconomyTransaction } from "../economy-progression/public.js";
import type { ParkIncident, ParkOperationsService } from "../park-operations/public.js";
import type { CommandResult, SimulationEngine, StableId, ToolEvidence, WorldDelta } from "../simulation/public.js";

export type ResponseCapability = "visitor-evacuation" | "temporary-containment" | "stranded-robot-recovery";
export type ResponseStatus = "requested" | "dispatched" | "en-route" | "operating" | "limited" | "stabilized" | "failed" | "complete";

export interface EngineeringBoundarySnapshot {
  readonly contextFingerprint: string;
  readonly artifactFingerprint: string;
  readonly routeFingerprint: string;
  readonly retentionPolicyFingerprint: string;
  readonly reviewFingerprint: string;
  readonly deploymentFingerprint: string;
}

export interface ResponseCapabilityPlan {
  readonly capability: ResponseCapability;
  readonly entityId: StableId;
  readonly destinationId?: StableId;
  readonly available: boolean;
  readonly limitation?: string;
}

export interface ResponsePlan {
  readonly id: StableId;
  readonly incidentId: StableId;
  readonly locationId: StableId;
  readonly immediateRisks: readonly string[];
  readonly capabilities: readonly ResponseCapabilityPlan[];
  readonly selectedCapabilities: readonly ResponseCapability[];
  readonly requestedTick: number;
  readonly dispatchTick: number;
  readonly arrivalTick: number;
  readonly estimatedDurationTicks: number;
  readonly expectedCompleteTick: number;
  readonly quote: EconomyQuote;
  readonly closures: readonly string[];
  readonly preconditions: readonly string[];
  readonly expectedStabilizationBoundaries: readonly string[];
  readonly limitations: readonly string[];
}

export interface ResponseTransition { readonly status: ResponseStatus; readonly tick: number }
export interface ResponseActionEvidence {
  readonly capability: ResponseCapability;
  readonly commandId: StableId;
  readonly accepted: boolean;
  readonly deltas: readonly WorldDelta[];
  readonly evidence: readonly ToolEvidence[];
  readonly diagnosticCodes: readonly string[];
}

export interface ResponseOutcome {
  readonly closures: readonly string[];
  readonly downtimeTicks: number;
  readonly cost: number;
  readonly ratingEffect: number;
  readonly casualtiesAvoided: number;
  readonly casualtiesIncurred: number;
}

export interface IncidentResponseRecord {
  readonly id: StableId;
  readonly plan: ResponsePlan;
  readonly status: ResponseStatus;
  readonly transitions: readonly ResponseTransition[];
  readonly reservation: EconomyReservation;
  readonly settlement?: EconomyTransaction;
  readonly actionEvidence: readonly ResponseActionEvidence[];
  readonly traceLinks: readonly StableId[];
  readonly engineeringBoundaryBefore: EngineeringBoundarySnapshot;
  readonly engineeringBoundaryAfter: EngineeringBoundarySnapshot;
  readonly engineeringUnresolved: true;
  readonly outcome?: ResponseOutcome;
}

export interface IncidentResponseRuleSet {
  readonly id: string;
  readonly version: string;
  readonly arrivalDelayTicks: number;
  readonly operatingDurationTicks: number;
  readonly baseCalloutCost: number;
  readonly riskCostPerPoint: number;
  readonly ratingPenalty: number;
  readonly evacuationActorId: StableId;
  readonly evacuationTool: { readonly id: string; readonly version: string };
  readonly safeZoneId: StableId;
  readonly containmentActorId: StableId;
  readonly containmentTool: { readonly id: string; readonly version: string };
  readonly containmentGateId: StableId;
  readonly recoveryDestinationId: StableId;
  readonly maxEvacuationGroupSize: number;
}

export interface IncidentResponsePorts {
  readonly simulation: SimulationEngine;
  readonly parkOperations: ParkOperationsService;
  readonly economy: EconomyService;
}

export interface IncidentResponseOptions {
  readonly ports: IncidentResponsePorts;
  readonly rules: IncidentResponseRuleSet;
  readonly engineeringBoundary: EngineeringBoundarySnapshot;
}

export interface ResponseDiagnostic {
  readonly code: "RESPONSE_INELIGIBLE" | "RESPONSE_PLAN_NOT_FOUND" | "RESPONSE_TICK_STALE" | "RESPONSE_ECONOMY_REJECTED" | "RESPONSE_ACTIVATION_REJECTED";
  readonly message: string;
}
export type ResponseResult<T> = { readonly ok: true; readonly value: T; readonly idempotent: boolean } | { readonly ok: false; readonly diagnostics: readonly ResponseDiagnostic[] };

export interface IncidentResponseService {
  plan(incidentId: StableId): ResponseResult<ResponsePlan>;
  activate(planId: StableId, expectedTick: number): ResponseResult<IncidentResponseRecord>;
  advanceToTick(tick: number): ResponseResult<readonly IncidentResponseRecord[]>;
  project(): readonly IncidentResponseRecord[];
}

export interface IncidentResponseFoundationFixture {
  readonly incident: ParkIncident;
  readonly options: IncidentResponseOptions;
}

export type SimulationCommandResult = CommandResult;
