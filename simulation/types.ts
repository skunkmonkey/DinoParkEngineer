/**
 * Public, UI-agnostic contracts for the deterministic park simulation.
 *
 * The simulation intentionally uses string identifiers and string unions. This
 * keeps fixtures easy to author while the engine remains the only place that
 * can mutate authoritative world state.
 */

export type EntityId = string;
export type LogicalTime = number;

export type GateState = "OPEN" | "CLOSED" | "LOCKED" | "JAMMED";
export type SensorState = "OPEN" | "CLOSED" | "UNKNOWN";
export type ContainmentState = "CONTAINED" | "AT_RISK" | "ESCAPED";
export type SafetyState = "SAFE" | "AT_RISK" | "EVACUATING" | "SAFE_ZONE";
export type IncidentStatus = "OPEN" | "CONTAINED" | "RECOVERED";
export type AgentStatus = "IDLE" | "BUSY" | "DISABLED";
export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ESCALATED";

export type DinosaurArchetype =
  | "DOCILE_HERBIVORE"
  | "LARGE_HERBIVORE"
  | "CARNIVORE";

export interface MovementProfile {
  readonly archetype: DinosaurArchetype;
  /** Chance in basis points (0..10000) used by the seeded movement step. */
  readonly wanderChanceBasisPoints: number;
  readonly preferredZoneIds: readonly EntityId[];
  readonly escapeRiskBasisPoints: number;
}

export interface Zone {
  readonly id: EntityId;
  readonly enclosureId?: EntityId;
  readonly kind: "OUTSIDE" | "INTERIOR" | "SERVICE" | "TRANSITION" | "VISITOR_BUFFER" | "SAFE";
}

export interface Gate {
  readonly id: EntityId;
  readonly enclosureId: EntityId;
  readonly zoneId: EntityId;
  readonly state: GateState;
  readonly sensorState: SensorState;
  readonly sensorHealth: number;
  readonly autoCloseEnabled: boolean;
  readonly maintenanceLock: boolean;
  readonly transitionZoneOccupants: readonly EntityId[];
}

export interface Dinosaur {
  readonly id: EntityId;
  readonly speciesId: EntityId;
  readonly archetype: DinosaurArchetype;
  readonly enclosureId: EntityId;
  readonly currentZone: EntityId;
  readonly hunger: number;
  readonly agitation: number;
  readonly health: number;
  readonly targetInterest: Readonly<{
    readonly zoneId: EntityId;
    readonly until: LogicalTime;
  }> | null;
  readonly containmentState: ContainmentState;
  readonly movementProfile: MovementProfile;
}

export interface RobotAgent {
  readonly id: EntityId;
  readonly agentDefinitionId: EntityId;
  readonly location: EntityId;
  readonly battery: number;
  readonly tools: readonly ToolType[];
  readonly contextBudget: number;
  readonly activeTask: EntityId | null;
  readonly queue: readonly EntityId[];
  readonly memoryRefs: readonly EntityId[];
  readonly status: AgentStatus;
  readonly authorizedEnclosureIds: readonly EntityId[];
}

export interface VisitorGroup {
  readonly id: EntityId;
  readonly location: EntityId;
  readonly size: number;
  readonly satisfaction: number;
  readonly panic: number;
  readonly safetyState: SafetyState;
  readonly destination: EntityId;
}

export interface Enclosure {
  readonly id: EntityId;
  readonly speciesAllowed: readonly EntityId[];
  readonly gateIds: readonly EntityId[];
  readonly zoneIds: readonly EntityId[];
  readonly feederIds: readonly EntityId[];
  readonly hazardLevel: number;
  readonly visitorBufferZoneIds: readonly EntityId[];
  readonly closed: boolean;
}

export type DeviceType = "FEEDER" | "BAIT_DISPENSER" | "RADIO" | "RESCUE_UNIT" | "SENSOR";

export interface ToolDevice {
  readonly id: EntityId;
  readonly type: DeviceType;
  readonly enclosureId?: EntityId;
  readonly zoneId?: EntityId;
  readonly health: number;
  readonly available: boolean;
  readonly state: "READY" | "OFFLINE" | "JAMMED";
  readonly inventory: number;
}

export interface Incident {
  readonly id: EntityId;
  readonly severity: 0 | 1 | 2 | 3 | 4;
  readonly startTime: LogicalTime;
  readonly affectedEntities: readonly EntityId[];
  readonly trigger: string;
  readonly status: IncidentStatus;
  readonly recoveryRequirements: readonly string[];
  readonly enclosureId?: EntityId;
}

export interface Job {
  readonly id: EntityId;
  readonly type: string;
  readonly targetRefs: readonly EntityId[];
  readonly priority: number;
  readonly dueTime: LogicalTime;
  readonly assignedAgentId: EntityId;
  readonly status: JobStatus;
}

export interface Route {
  readonly fromZoneId: EntityId;
  readonly toZoneId: EntityId;
  readonly durationSeconds: number;
}

export type ToolType =
  | "move_to"
  | "observe"
  | "bait_dinosaur"
  | "open_gate"
  | "close_gate"
  | "lock_gate"
  | "dispense_food"
  | "alert_security"
  | "evacuate_visitors"
  | "rescue_visitors";

export interface ScheduledFault {
  readonly id: EntityId;
  readonly logicalTime: LogicalTime;
  readonly type: "GATE_JAM" | "SENSOR_DEGRADE" | "DEVICE_OUTAGE";
  readonly targetId: EntityId;
}

export interface WorldFixture {
  readonly id: EntityId;
  readonly zones: readonly Zone[];
  readonly enclosures: readonly Enclosure[];
  readonly gates: readonly Gate[];
  readonly dinosaurs: readonly Dinosaur[];
  readonly agents: readonly RobotAgent[];
  readonly visitors: readonly VisitorGroup[];
  readonly devices: readonly ToolDevice[];
  readonly incidents?: readonly Incident[];
  readonly jobs?: readonly Job[];
  readonly routes: readonly Route[];
  readonly faults?: readonly ScheduledFault[];
  readonly enableAutonomy?: boolean;
}

export interface WorldSnapshot {
  readonly fixtureId: EntityId;
  readonly seed: number;
  readonly logicalTime: LogicalTime;
  readonly prngState: number;
  readonly zones: readonly Zone[];
  readonly enclosures: readonly Enclosure[];
  readonly gates: readonly Gate[];
  readonly dinosaurs: readonly Dinosaur[];
  readonly agents: readonly RobotAgent[];
  readonly visitors: readonly VisitorGroup[];
  readonly devices: readonly ToolDevice[];
  readonly incidents: readonly Incident[];
  readonly jobs: readonly Job[];
  readonly routes: readonly Route[];
  readonly pendingEvents: readonly ScheduledEvent[];
  readonly resourceReservations: readonly ResourceReservation[];
  readonly eventSequence: number;
}

export interface ResourceReservation {
  readonly logicalTime: LogicalTime;
  readonly resourceKey: string;
  readonly winnerEventId: string;
}

export interface MoveToCommand {
  readonly action: "move_to";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly zoneId: EntityId;
}

export interface ObserveCommand {
  readonly action: "observe";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly targetId: EntityId;
}

export interface BaitDinosaurCommand {
  readonly action: "bait_dinosaur";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly dinosaurId: EntityId;
  readonly zoneId: EntityId;
}

export interface GateCommand {
  readonly action: "open_gate" | "close_gate" | "lock_gate";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly gateId: EntityId;
}

export interface DispenseFoodCommand {
  readonly action: "dispense_food";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly dinosaurId: EntityId;
}

export interface AlertSecurityCommand {
  readonly action: "alert_security";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly incidentId?: EntityId;
  readonly targetZoneId?: EntityId;
  readonly severity?: 0 | 1 | 2 | 3 | 4;
}

export interface EvacuateVisitorsCommand {
  readonly action: "evacuate_visitors";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly zoneId: EntityId;
}

export interface RescueVisitorsCommand {
  readonly action: "rescue_visitors";
  readonly commandId: string;
  readonly agentId: EntityId;
  readonly visitorGroupId: EntityId;
}

export type WorldCommand =
  | MoveToCommand
  | ObserveCommand
  | BaitDinosaurCommand
  | GateCommand
  | DispenseFoodCommand
  | AlertSecurityCommand
  | EvacuateVisitorsCommand
  | RescueVisitorsCommand;

export type ToolFailureCode =
  | "INVALID_TARGET"
  | "NOT_AUTHORIZED"
  | "OUT_OF_RANGE"
  | "PREREQUISITE_FAILED"
  | "TOOL_BUSY"
  | "ZONE_OCCUPIED"
  | "MAINTENANCE_LOCKED"
  | "JAMMED"
  | "UNAVAILABLE";

export type ToolResult =
  | {
      readonly ok: true;
      readonly commandId: string;
      readonly completionEventIds: readonly string[];
    }
  | {
      readonly ok: false;
      readonly commandId: string;
      readonly code: ToolFailureCode;
      readonly details: Readonly<Record<string, string | number>>;
    };

export interface FixtureError {
  readonly code:
    | "INVALID_ID"
    | "DUPLICATE_ID"
    | "DANGLING_REFERENCE"
    | "INVALID_VALUE"
    | "INVALID_ROUTE"
    | "INVALID_FAULT";
  readonly path: string;
  readonly details: Readonly<Record<string, string | number>>;
}

export type WorldEventType =
  | "COMMAND_SCHEDULED"
  | "TOOL_COMPLETED"
  | "TOOL_FAILED"
  | "OBSERVATION"
  | "FAULT_APPLIED"
  | "DINO_MOVED"
  | "INCIDENT_OPENED"
  | "INCIDENT_UPDATED"
  | "INCIDENT_RECOVERED";

export type WorldEventPayloadValue = string | number | boolean | null | readonly string[];

export interface WorldEvent {
  readonly id: string;
  readonly type: WorldEventType;
  readonly logicalTime: LogicalTime;
  readonly priority: number;
  readonly agentId?: EntityId;
  readonly commandId?: string;
  readonly payload: Readonly<Record<string, WorldEventPayloadValue>>;
}

export interface ScheduledEvent {
  readonly id: string;
  readonly logicalTime: LogicalTime;
  readonly priority: number;
  readonly agentId?: EntityId;
  readonly commandId?: string;
  readonly action: WorldCommand["action"] | "fault" | "autonomy";
  readonly command?: WorldCommand;
  readonly fault?: ScheduledFault;
  /** Every resource reserved by this event; persisted for exact restore. */
  readonly resourceKeys: readonly string[];
  /** Backward-compatible primary resource identifier. */
  readonly resourceKey?: string;
}

export type SimulationResult<T, E> = {
  readonly ok: true;
  readonly value: T;
} | {
  readonly ok: false;
  readonly error: E;
};

export interface SimulationEngine {
  load(fixture: WorldFixture, seed: number): SimulationResult<void, readonly FixtureError[]>;
  command(command: WorldCommand): ToolResult;
  advanceTo(logicalTime: number): readonly WorldEvent[];
  runNext(): WorldEvent | null;
  snapshot(): WorldSnapshot;
  pendingEvents(): readonly ScheduledEvent[];
  events(): readonly WorldEvent[];
  canonicalSnapshot(): string;
  canonicalEvents(): string;
  restore(snapshot: WorldSnapshot): SimulationResult<void, readonly FixtureError[]>;
}
