import type { ContentReference, ContentRegistry } from "../content-registry/public.js";

export type StableId = `${string}:${string}`;
export type GatePosition = "open" | "closed";
export type SensorHealth = "healthy" | "degraded" | "offline";
export type VisitorSafety = "safe" | "exposed" | "injured" | "casualty";

export interface LocationState { readonly id: StableId; readonly kind: "enclosure" | "path" | "service" | "safe-zone"; readonly enclosureId?: StableId }
export interface NavigationEdge { readonly id: StableId; readonly from: StableId; readonly to: StableId; readonly gateId?: StableId }
export interface EnclosureBoundaryState { readonly id: StableId; readonly enclosureId: StableId; readonly edgeIds: readonly StableId[]; readonly gateIds: readonly StableId[] }
export interface GateState { readonly id: StableId; readonly locationA: StableId; readonly locationB: StableId; readonly position: GatePosition; readonly locked: boolean; readonly jammed: boolean; readonly closer: "enabled" | "disabled"; readonly sensorReading: GatePosition; readonly sensorHealth: SensorHealth; readonly accessZones: readonly StableId[]; readonly reservedBy?: StableId }
export interface RobotState { readonly id: StableId; readonly locationId: StableId; readonly toolRefs: readonly ContentReference[]; readonly carried: readonly { readonly itemId: StableId; readonly quantity: number }[]; readonly battery: number; readonly health: number; readonly assignmentId?: StableId; readonly action: "idle" | "moving" | "using-tool" | "disabled"; readonly accessZones: readonly StableId[] }
export interface DinosaurState { readonly id: StableId; readonly species: string; readonly locationId: StableId; readonly homeEnclosureId: StableId; readonly contained: boolean; readonly hunger: number; readonly agitation: number; readonly targetLocationId?: StableId; readonly baitedBy?: StableId; readonly allowedTerrain: readonly LocationState["kind"][]; readonly hazardInteraction: "avoid" | "ignore" }
export interface VisitorGroupState { readonly id: StableId; readonly locationId: StableId; readonly size: number; readonly movingTo?: StableId; readonly exposedTo?: StableId; readonly panic: number; readonly evacuating: boolean; readonly safety: VisitorSafety }
export interface HazardState { readonly id: StableId; readonly locationId: StableId; readonly severity: number; readonly active: boolean }
export interface ToolDefinition { readonly reference: ContentReference; readonly capability: "gate-control" | "gate-observation" | "feed" | "bait" | "evacuate"; readonly batteryCost: number; readonly requiresSameLocation: boolean }
export interface RandomStreamState { readonly name: string; readonly state: number; readonly consumed: number }
export interface ScheduledTransition { readonly id: StableId; readonly tick: number; readonly priority: number; readonly kind: "gate-auto-close" | "visitor-arrival"; readonly entityId: StableId }
export interface ActivePhysicalAction { readonly id: StableId; readonly actorId: StableId; readonly kind: string; readonly startedTick: number; readonly completesTick: number }

export interface WorldState {
  readonly schemaVersion: "1";
  readonly scenario: ContentReference;
  readonly tick: number;
  readonly paused: boolean;
  readonly speed: 1 | 2 | 4;
  readonly seed: number;
  readonly randomStreams: readonly RandomStreamState[];
  readonly eventSequence: number;
  readonly locations: readonly LocationState[];
  readonly enclosureBoundaries: readonly EnclosureBoundaryState[];
  readonly navigationEdges: readonly NavigationEdge[];
  readonly gates: readonly GateState[];
  readonly robots: readonly RobotState[];
  readonly dinosaurs: readonly DinosaurState[];
  readonly visitors: readonly VisitorGroupState[];
  readonly hazards: readonly HazardState[];
  readonly weather: { readonly condition: "clear" | "rain" | "storm"; readonly intensity: number };
  readonly tools: readonly ToolDefinition[];
  readonly scheduled: readonly ScheduledTransition[];
  readonly activeActions: readonly ActivePhysicalAction[];
}

export interface ScenarioFixture {
  readonly schemaVersion: "1";
  readonly scenario: ContentReference;
  readonly exactContent: readonly ContentReference[];
  readonly allowedCommandKinds: readonly WorldCommand["kind"][];
  readonly initialState: WorldState;
}

interface CommandBase { readonly id: StableId; readonly expectedTick: number; readonly actorId: StableId }
export type WorldCommand =
  | (CommandBase & { readonly kind: "move"; readonly destinationId: StableId })
  | (CommandBase & { readonly kind: "operate-gate"; readonly gateId: StableId; readonly operation: "open" | "close" | "lock" | "unlock"; readonly tool: ContentReference })
  | (CommandBase & { readonly kind: "observe-gate"; readonly gateId: StableId; readonly tool: ContentReference })
  | (CommandBase & { readonly kind: "feed"; readonly dinosaurId: StableId; readonly itemId: StableId; readonly tool: ContentReference })
  | (CommandBase & { readonly kind: "bait"; readonly dinosaurId: StableId; readonly destinationId: StableId; readonly itemId: StableId; readonly tool: ContentReference })
  | (CommandBase & { readonly kind: "evacuate"; readonly visitorId: StableId; readonly destinationId: StableId; readonly tool: ContentReference })
  | (CommandBase & { readonly kind: "reserve"; readonly gateId: StableId })
  | (CommandBase & { readonly kind: "release"; readonly gateId: StableId });

export type SimulationDiagnosticCode = "SIM_COMMAND_INVALID" | "SIM_COMMAND_STALE" | "SIM_COMMAND_UNAUTHORIZED" | "SIM_COMMAND_IMPOSSIBLE" | "SIM_FIXTURE_INVALID" | "SIM_CONTENT_MISSING" | "SIM_CONTENT_MISMATCH" | "SIM_RESOURCE_RESERVED";
export interface SimulationDiagnostic { readonly code: SimulationDiagnosticCode; readonly path: string; readonly rule: string; readonly message: string }
export interface WorldDelta { readonly id: StableId; readonly tick: number; readonly entityId: StableId; readonly field: string; readonly before: string | number | boolean | null; readonly after: string | number | boolean | null; readonly causeId: StableId }
export interface ToolEvidence { readonly source: "physical-gate" | "gate-sensor" | "dinosaur" | "visitor" | "robot"; readonly sourceId: StableId; readonly field: string; readonly value: string | number | boolean; readonly reliability: "direct" | "healthy" | "degraded" | "unavailable" }
export interface WorldEvent { readonly id: StableId; readonly tick: number; readonly kind: string; readonly entityId: StableId; readonly causeId: StableId }
export type CommandResult = { readonly accepted: true; readonly commandId: StableId; readonly resultingTick: number; readonly deltas: readonly WorldDelta[]; readonly evidence: readonly ToolEvidence[]; readonly events: readonly WorldEvent[] } | { readonly accepted: false; readonly commandId: StableId; readonly resultingTick: number; readonly diagnostics: readonly SimulationDiagnostic[]; readonly deltas: readonly []; readonly evidence: readonly []; readonly events: readonly [] };
export interface TickResult { readonly resultingTick: number; readonly deltas: readonly WorldDelta[]; readonly events: readonly WorldEvent[] }
export interface ReplayInput { readonly snapshot: WorldState; readonly exactContent: readonly ContentReference[]; readonly allowedCommandKinds: readonly WorldCommand["kind"][]; readonly commands: readonly { readonly decisionTick: number; readonly command: WorldCommand }[]; readonly finalTick: number }
export interface ReplayResult { readonly state: WorldState; readonly commandResults: readonly CommandResult[]; readonly events: readonly WorldEvent[] }
export type FixtureLoadResult = { readonly ok: true; readonly fixture: ScenarioFixture } | { readonly ok: false; readonly diagnostics: readonly SimulationDiagnostic[] };

export interface SimulationEngine {
  snapshot(): WorldState;
  project(): Readonly<WorldState>;
  setPaused(paused: boolean): void;
  setSpeed(speed: 1 | 2 | 4): void;
  requestedTicksPerFrame(): 0 | 1 | 2 | 4;
  requestTicks(count: number): TickResult;
  execute(command: unknown): CommandResult;
  executeBatch(commands: readonly unknown[]): readonly CommandResult[];
}

export interface RegistryFixtureSource { readonly registry: Pick<ContentRegistry, "resolveExact">; readonly reference: ContentReference }
