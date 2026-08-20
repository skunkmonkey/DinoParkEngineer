import type {
  ParkOperationsCommandResult,
  ParkOperationsState,
} from "../park-operations/public.js";
import type {
  RuntimeAssetBundle,
  RuntimeAssetCatalog,
} from "../rendering-assets/public.js";
import type {
  DinosaurState,
  GateState,
  RobotState,
  StableId,
  VisitorGroupState,
  WorldState,
} from "../simulation/public.js";

export type PlayerExperienceMode =
  | "production"
  | "paused-production"
  | "workbench"
  | "eval"
  | "replay"
  | "review";

export type PlayerEntityKind =
  | "dinosaur"
  | "robot"
  | "gate"
  | "visitor"
  | "hazard"
  | "job"
  | "alert"
  | "incident";

export type SemanticZoomLevel = "far" | "mid" | "near";

export type VisualGrammarKey =
  | "need"
  | "intent"
  | "risk"
  | "provenance"
  | "outcome"
  | "selection"
  | "degraded"
  | "warning"
  | "emergency";

export type VisualShape =
  | "diamond"
  | "arrow"
  | "triangle"
  | "hexagon"
  | "check"
  | "ring"
  | "hatch"
  | "octagon";

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface CameraBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface CameraState {
  readonly center: Point2D;
  readonly zoom: number;
  readonly bounds: CameraBounds;
}

export interface VisualCue {
  readonly grammar: VisualGrammarKey;
  readonly shape: VisualShape;
  readonly symbol: string;
  readonly text: string;
  readonly severity: "info" | "warning" | "emergency" | "success";
  readonly motion: "none" | "gentle-pulse" | "urgent-pulse";
  readonly persistent: boolean;
}

export interface PlayerEntityProjection {
  readonly id: StableId;
  readonly kind: PlayerEntityKind;
  readonly label: string;
  readonly locationId: StableId;
  readonly position: Point2D;
  readonly status: string;
  readonly intent: string;
  readonly route: readonly string[];
  readonly accessibilityLabel: string;
  readonly assetId: string;
  readonly assetVersion: "1.0.0";
  readonly selected: boolean;
  readonly critical: boolean;
  readonly cue?: VisualCue;
  readonly occlusionClass: "ground" | "entity" | "structure" | "overlay";
  readonly occlusion: "visible" | "occluded" | "aggregate";
  readonly depthBaseline: number;
  readonly renderOrder: number;
  readonly source: "simulation" | "park-operations";
  readonly sourceTick: number;
  readonly relatedEntityIds?: readonly StableId[];
  readonly evidence?: {
    readonly expected: string;
    readonly observed: readonly string[];
    readonly consequence: readonly string[];
    readonly immediateGap: readonly string[];
    readonly traceIds: readonly StableId[];
  };
}

export interface SceneAggregate {
  readonly id: StableId;
  readonly locationId: StableId;
  readonly position: Point2D;
  readonly label: string;
  readonly count: number;
  readonly entityIds: readonly StableId[];
  readonly cue: VisualCue;
}

export interface PlayerSceneProjection {
  readonly orientation: "three-quarter";
  readonly lighting: "dawn";
  readonly camera: CameraState;
  readonly semanticZoom: SemanticZoomLevel;
  readonly entities: readonly PlayerEntityProjection[];
  readonly aggregates: readonly SceneAggregate[];
  readonly assetBundle: { readonly id: string; readonly version: "1.0.0" };
  readonly assetCatalog?: RuntimeAssetCatalog;
  readonly renderFrame: number;
}

export interface HistoryEntry {
  readonly id: StableId;
  readonly tick: number;
  readonly kind:
    | "announcement"
    | "selection"
    | "command"
    | "outcome"
    | "mode"
    | "preference"
    | "audio-substitute";
  readonly severity: "info" | "warning" | "emergency" | "success";
  readonly text: string;
  readonly entityIds: readonly StableId[];
  readonly persistent: true;
}

export interface PlayerPreferences {
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly textScale: 1 | 1.25 | 1.5;
  readonly soundSubstitution: boolean;
}

export interface AudioSubstitute {
  readonly id: StableId;
  readonly tick: number;
  readonly cue: string;
  readonly text: string;
  readonly played: false;
}

export interface FeedingEvidence {
  readonly dinosaurHunger: { readonly before: number; readonly after: number };
  readonly gatePosition: { readonly before: GateState["position"]; readonly after: GateState["position"] };
  readonly robotLocation: { readonly before: StableId; readonly after: StableId };
}

export interface PlayerExperienceSnapshot {
  readonly schemaVersion: "1";
  readonly mode: PlayerExperienceMode;
  readonly world: Readonly<WorldState>;
  readonly operations: Readonly<ParkOperationsState>;
  readonly scene: PlayerSceneProjection;
  readonly selectedEntityId?: StableId;
  readonly history: readonly HistoryEntry[];
  readonly audioSubstitutes: readonly AudioSubstitute[];
  readonly feedingEvidence?: FeedingEvidence;
  readonly status: string;
  readonly authoritativeFingerprint: string;
}

export type PlayerExperienceCommand =
  | { readonly kind: "select-entity"; readonly entityId: StableId }
  | { readonly kind: "pan-camera"; readonly delta: Point2D }
  | { readonly kind: "zoom-camera"; readonly delta: number }
  | { readonly kind: "focus-entity"; readonly entityId: StableId }
  | { readonly kind: "set-time-control"; readonly paused: boolean; readonly speed: 1 | 2 | 4 }
  | { readonly kind: "step-logical-tick" }
  | { readonly kind: "assign-feeding-job"; readonly agentId?: StableId }
  | { readonly kind: "feed-through-inspector" }
  | { readonly kind: "trigger-near-miss" }
  | { readonly kind: "acknowledge-alert"; readonly alertId?: StableId }
  | { readonly kind: "stabilize-incident"; readonly incidentId?: StableId }
  | { readonly kind: "resolve-incident"; readonly incidentId?: StableId }
  | { readonly kind: "set-preferences"; readonly preferences: Partial<PlayerPreferences> };

export type PlayerExperienceCommandResult =
  | {
      readonly accepted: true;
      readonly commandId: StableId;
      readonly snapshot: PlayerExperienceSnapshot;
      readonly operations?: ParkOperationsCommandResult;
    }
  | {
      readonly accepted: false;
      readonly commandId: StableId;
      readonly snapshot: PlayerExperienceSnapshot;
      readonly message: string;
    };

export interface PlayerExperienceService {
  snapshot(): PlayerExperienceSnapshot;
  project(): PlayerExperienceSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(command: PlayerExperienceCommand): PlayerExperienceCommandResult;
  dispose(): void;
}

export interface PlayerExperienceOptions {
  readonly mode?: PlayerExperienceMode;
  readonly preferences?: Partial<PlayerPreferences>;
  readonly history?: readonly HistoryEntry[];
  readonly assetBundle?: RuntimeAssetBundle;
}

export type EntityState = DinosaurState | RobotState | GateState | VisitorGroupState;
