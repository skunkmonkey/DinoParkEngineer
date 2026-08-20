import type {
  ParkOperationsState,
  ParkJob,
  OperationalAlert,
  ParkIncident,
} from "../park-operations/public.js";
import {
  OPENING_RUNTIME_ASSET_IDS,
} from "../curriculum-content/public.js";
import type {
  DinosaurState,
  GateState,
  RobotState,
  StableId,
  VisitorGroupState,
  WorldState,
} from "../simulation/public.js";
import {
  DEFAULT_CAMERA,
  semanticZoomFor,
} from "./camera.js";
import type {
  CameraState,
  PlayerEntityProjection,
  PlayerSceneProjection,
  Point2D,
  SceneAggregate,
  SemanticZoomLevel,
  VisualCue,
  VisualGrammarKey,
  VisualShape,
} from "./types.js";
import type { RuntimeAssetBundle, RuntimeAssetCatalog } from "../rendering-assets/public.js";

type HazardState = WorldState["hazards"][number];

export const OPENING_ASSET_BUNDLE = Object.freeze({
  id: "assets:bundle-mvp-park",
  version: "1.0.0" as const,
});

/**
 * A deliberately redundant grammar. Shape, symbol, text, and motion carry
 * meaning independently of the palette, canvas, or audio channel.
 */
export const PLAYER_VISUAL_GRAMMAR: Readonly<Record<VisualGrammarKey, Readonly<{
  readonly shape: VisualShape;
  readonly symbol: string;
  readonly label: string;
}>>> = Object.freeze({
  need: { shape: "diamond", symbol: "◇", label: "Immediate need" },
  intent: { shape: "arrow", symbol: "→", label: "Agent intent" },
  risk: { shape: "triangle", symbol: "△", label: "Risk" },
  provenance: { shape: "hexagon", symbol: "⬡", label: "Provenance" },
  outcome: { shape: "check", symbol: "✓", label: "Outcome" },
  selection: { shape: "ring", symbol: "◎", label: "Selected entity" },
  degraded: { shape: "hatch", symbol: "//", label: "Degraded" },
  warning: { shape: "triangle", symbol: "!", label: "Warning" },
  emergency: { shape: "octagon", symbol: "‼", label: "Emergency" },
});

export const OPENING_LOCATION_POINTS: Readonly<Record<string, Point2D>> = Object.freeze({
  "location:enclosure": { x: 28, y: 43 },
  "location:enclosure-beta": { x: 68, y: 38 },
  "location:path": { x: 50, y: 64 },
  "location:service": { x: 76, y: 72 },
  "location:safe": { x: 91, y: 57 },
  "location:park": { x: 50, y: 50 },
});

const LOCATION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "location:enclosure": "Tria Habitat",
  "location:enclosure-beta": "North Paddock",
  "location:path": "Keeper Route",
  "location:service": "Robot Depot",
  "location:safe": "Visitor Arrival",
  "location:park": "Dawn Valley Park",
});

const ASSET_IDS = Object.freeze({
  dinosaur: "assets:dinosaur-herbivore",
  robot: "assets:robot-park-worker",
  gate: "assets:gate-enclosure",
  visitor: "assets:visitor-park",
  hazard: "assets:cue-operational-warning",
});

const asStableId = (value: string): StableId => value as StableId;

const locationPoint = (locationId: StableId): Point2D =>
  OPENING_LOCATION_POINTS[locationId] ?? OPENING_LOCATION_POINTS["location:park"]!;

const compareIds = (left: { readonly id: string }, right: { readonly id: string }): number =>
  left.id < right.id ? -1 : left.id > right.id ? 1 : 0;

const cue = (
  grammar: VisualGrammarKey,
  text: string,
  severity: VisualCue["severity"],
  motion: VisualCue["motion"] = "none",
): VisualCue => ({
  grammar,
  shape: PLAYER_VISUAL_GRAMMAR[grammar].shape,
  symbol: PLAYER_VISUAL_GRAMMAR[grammar].symbol,
  text,
  severity,
  motion,
  persistent: true,
});

const depthFor = (point: Point2D, occlusionClass: PlayerEntityProjection["occlusionClass"]): number =>
  Math.round(point.y * 10) + (occlusionClass === "structure" ? 20 : occlusionClass === "overlay" ? 80 : 0);

const renderOrderFor = (
  point: Point2D,
  occlusionClass: PlayerEntityProjection["occlusionClass"],
): number => {
  const classOffset = occlusionClass === "ground" ? 0 : occlusionClass === "structure" ? 20 : occlusionClass === "entity" ? 40 : 80;
  return Math.round(point.y * 10) + classOffset;
};

const jobFor = (operations: ParkOperationsState, entityId: StableId): ParkJob | undefined =>
  operations.jobs.find((job) => job.targetId === entityId);

const dinosaurProjection = (
  dinosaur: DinosaurState,
  operations: ParkOperationsState,
  selected: boolean,
): PlayerEntityProjection => {
  const job = jobFor(operations, dinosaur.id);
  const hungry = dinosaur.hunger >= 70;
  const completed = job?.status === "completed";
  const position = locationPoint(dinosaur.locationId);
  return {
    id: dinosaur.id,
    kind: "dinosaur",
    label: dinosaur.id === "dinosaur:tria" ? "Tria" : dinosaur.id === "dinosaur:vera" ? "Vera" : dinosaur.species,
    locationId: dinosaur.locationId,
    position: { x: position.x - 3, y: position.y - 2 },
    status: completed ? "Fed · calm" : hungry ? `Hungry · ${dinosaur.hunger}% need` : `Cared for · ${dinosaur.hunger}% hunger`,
    intent: completed ? "Resting after feeding" : hungry ? "Waiting for a safe feeding assignment" : "Foraging in its enclosure",
    route: [LOCATION_LABELS[dinosaur.locationId] ?? dinosaur.locationId, "Safe feeding route"],
    accessibilityLabel: `${dinosaur.species} ${dinosaur.id === "dinosaur:tria" ? "Tria" : dinosaur.id === "dinosaur:vera" ? "Vera" : "dinosaur"}; ${completed ? "fed and calm" : hungry ? "hungry and needs feeding" : "cared for"}; located at ${LOCATION_LABELS[dinosaur.locationId] ?? "park"}`,
    assetId: ASSET_IDS.dinosaur,
    assetVersion: "1.0.0",
    selected,
    critical: hungry || !dinosaur.contained,
    ...(completed
      ? { cue: cue("outcome", "Feeding complete", "success") }
      : hungry
        ? { cue: cue("need", "Hungry: feeding needed", "warning", "gentle-pulse") }
        : {}),
    occlusionClass: "entity",
    occlusion: "visible",
    depthBaseline: depthFor(position, "entity"),
    renderOrder: renderOrderFor(position, "entity"),
    source: "simulation",
    sourceTick: 0,
  };
};

const robotProjection = (
  robot: RobotState,
  operations: ParkOperationsState,
  selected: boolean,
): PlayerEntityProjection => {
  const assignedJob = robot.assignmentId === undefined
    ? operations.jobs.find((job) => job.assignedAgentId === robot.id && job.status !== "completed")
    : operations.jobs.find((job) => job.id === robot.assignmentId);
  const position = locationPoint(robot.locationId);
  const available = assignedJob === undefined && robot.action === "idle";
  return {
    id: robot.id,
    kind: "robot",
    label: "Robot Alpha",
    locationId: robot.locationId,
    position: { x: position.x + 3, y: position.y + 1 },
    status: available ? "Available · battery 100%" : `${robot.action === "using-tool" ? "Using tool" : "Assigned"} · battery ${robot.battery}%`,
    intent: available ? "Waiting for a safe job" : assignedJob === undefined ? "Returning to standby" : `Working on ${assignedJob.task.id}`,
    route: [LOCATION_LABELS[robot.locationId] ?? "Robot Depot", "Keeper Route", "South Habitat Gate", "Tria Habitat"],
    accessibilityLabel: `Robot Alpha; ${available ? "available" : "assigned"}; battery ${robot.battery} percent; located at ${LOCATION_LABELS[robot.locationId] ?? robot.locationId}`,
    assetId: ASSET_IDS.robot,
    assetVersion: "1.0.0",
    selected,
    critical: false,
    ...(available ? { cue: cue("intent", "Available Worker", "info") } : {}),
    occlusionClass: "entity",
    occlusion: "visible",
    depthBaseline: depthFor(position, "entity"),
    renderOrder: renderOrderFor(position, "entity"),
    source: "simulation",
    sourceTick: 0,
  };
};

const gateProjection = (
  gate: GateState,
  operations: ParkOperationsState,
  selected: boolean,
): PlayerEntityProjection => {
  const beta = gate.id === asStableId("gate:beta");
  const position: Point2D = beta ? { x: 61, y: 53 } : { x: 44, y: 55 };
  const gateLabel = beta ? "North Paddock Gate" : "South Habitat Gate";
  const enclosureLabel = beta ? "North Paddock" : "Tria Habitat";
  const incident = operations.incidents.find((entry) => entry.entityIds.includes(gate.id) && entry.status !== "closed");
  const degraded = gate.sensorHealth !== "healthy" || gate.closer === "disabled";
  const emergency = incident?.risk !== undefined && incident.risk >= 80;
  const status = emergency
    ? "Emergency · containment risk"
    : degraded
      ? `Degraded · closer ${gate.closer}`
      : `${gate.position === "closed" ? "Closed" : "Open"} · sensor ${gate.sensorHealth}`;
  return {
    id: gate.id,
    kind: "gate",
    label: gateLabel,
    locationId: gate.locationA,
    position,
    status,
    intent: gate.position === "open" ? "Transition open" : "Containment restored",
    route: [gateLabel, enclosureLabel, "Keeper path"],
    accessibilityLabel: `${gateLabel}; ${status}; ${gate.position === "closed" ? "containment closed" : "containment open"}`,
    assetId: ASSET_IDS.gate,
    assetVersion: "1.0.0",
    selected,
    critical: emergency || gate.position === "open" || degraded,
    ...(emergency
      ? { cue: cue("emergency", "Containment emergency", "emergency", "urgent-pulse") }
      : degraded
        ? { cue: cue("degraded", "Maintenance degradation", "warning") }
        : gate.position === "open"
          ? { cue: cue("warning", "Gate open", "warning") }
          : {}),
    occlusionClass: "structure",
    occlusion: "visible",
    depthBaseline: depthFor(position, "structure"),
    renderOrder: renderOrderFor(position, "structure"),
    source: "simulation",
    sourceTick: 0,
  };
};

const visitorProjection = (
  visitor: VisitorGroupState,
  selected: boolean,
): PlayerEntityProjection => {
  const position = locationPoint(visitor.locationId);
  const unsafe = visitor.safety !== "safe";
  return {
    id: visitor.id,
    kind: "visitor",
    label: "Morning visitors",
    locationId: visitor.locationId,
    position: { x: position.x + 13, y: position.y + 1 },
    status: unsafe ? `${visitor.safety} · panic ${visitor.panic}%` : `Approaching · group of ${visitor.size}`,
    intent: visitor.movingTo === undefined ? "Waiting for park opening" : "Walking toward the park entrance",
    route: ["Park entrance", LOCATION_LABELS[visitor.locationId] ?? visitor.locationId],
    accessibilityLabel: `Morning visitor group of ${visitor.size}; ${unsafe ? visitor.safety : "approaching"}; ${visitor.panic}% panic`,
    assetId: ASSET_IDS.visitor,
    assetVersion: "1.0.0",
    selected,
    critical: unsafe,
    ...(unsafe
      ? { cue: cue(visitor.safety === "casualty" ? "emergency" : "risk", `Visitor safety ${visitor.safety}`, visitor.safety === "casualty" ? "emergency" : "warning") }
      : { cue: cue("intent", "Approaching visitors", "info") }),
    occlusionClass: "entity",
    occlusion: "visible",
    depthBaseline: depthFor(position, "entity"),
    renderOrder: renderOrderFor(position, "entity"),
    source: "simulation",
    sourceTick: 0,
  };
};

const hazardProjection = (hazard: HazardState, selected: boolean): PlayerEntityProjection => {
  const position = locationPoint(hazard.locationId);
  return {
    id: hazard.id,
    kind: "hazard",
    label: "Service lane mud",
    locationId: hazard.locationId,
    position: { x: position.x, y: position.y + 2 },
    status: hazard.active ? `Active · severity ${hazard.severity}%` : "Resolved",
    intent: hazard.active ? "Keep routine routes clear" : "No immediate action",
    route: [LOCATION_LABELS[hazard.locationId] ?? hazard.locationId],
    accessibilityLabel: `Service lane mud hazard; ${hazard.active ? "active" : "resolved"}; severity ${hazard.severity} percent`,
    assetId: ASSET_IDS.hazard,
    assetVersion: "1.0.0",
    selected,
    critical: hazard.active && hazard.severity >= 50,
    ...(hazard.active ? { cue: cue("risk", `Hazard severity ${hazard.severity}%`, "warning") } : {}),
    occlusionClass: "overlay",
    occlusion: "visible",
    depthBaseline: depthFor(position, "overlay"),
    renderOrder: renderOrderFor(position, "overlay"),
    source: "simulation",
    sourceTick: 0,
  };
};

const operationPosition = (
  world: Readonly<WorldState>,
  entityId: StableId,
  fallback: StableId = asStableId("location:park"),
): Point2D => {
  const worldEntity = [
    ...world.dinosaurs,
    ...world.robots,
    ...world.gates,
    ...world.visitors,
    ...world.hazards,
  ].find((entry) => entry.id === entityId);
  const locationId = worldEntity !== undefined && "locationId" in worldEntity
    ? worldEntity.locationId
    : fallback;
  return locationPoint(locationId);
};

const jobProjection = (
  job: ParkJob,
  world: Readonly<WorldState>,
  operations: ParkOperationsState,
  selected: boolean,
): PlayerEntityProjection => {
  const position = operationPosition(world, job.targetId);
  const completed = job.status === "completed";
  const risky = job.status === "failed" || job.status === "escalated";
  return {
    id: job.id,
    kind: "job",
    label: job.targetId === "dinosaur:tria" ? "Feed Tria" : job.targetId === "dinosaur:vera" ? "Feed Vera" : "Park job",
    locationId: world.dinosaurs.find((entry) => entry.id === job.targetId)?.locationId ?? asStableId("location:park"),
    position: { x: position.x + 1, y: position.y - 8 },
    status: completed ? "Completed · result linked" : `${job.status} · priority ${job.priority}`,
    intent: completed ? "Feeding result recorded" : `Assign the feeding procedure to ${job.assignedAgentId === undefined ? "an available Worker Agent" : "Robot Alpha"}`,
    route: ["Park Operations", job.targetId === "dinosaur:tria" ? "Tria Habitat" : "North Paddock"],
    accessibilityLabel: `${job.targetId === "dinosaur:tria" ? "Feed Tria" : job.targetId === "dinosaur:vera" ? "Feed Vera" : "Park"} job; ${job.status}; priority ${job.priority}; exact pinned versions available in evidence`,
    assetId: ASSET_IDS.hazard,
    assetVersion: "1.0.0",
    selected,
    critical: risky,
    cue: cue(completed ? "outcome" : risky ? "risk" : "intent", completed ? "Job outcome" : risky ? "Job needs review" : "Job intent", risky ? "warning" : completed ? "success" : "info"),
    occlusionClass: "overlay",
    occlusion: "visible",
    depthBaseline: depthFor(position, "overlay"),
    renderOrder: renderOrderFor(position, "overlay"),
    source: "park-operations",
    sourceTick: operations.tick,
    relatedEntityIds: [job.targetId, ...(job.assignedAgentId === undefined ? [] : [job.assignedAgentId])],
  };
};

const alertProjection = (
  alert: OperationalAlert,
  world: Readonly<WorldState>,
  operations: ParkOperationsState,
  selected: boolean,
): PlayerEntityProjection => {
  const position = operationPosition(world, alert.locationId);
  const emergency = alert.severity === "emergency";
  return {
    id: alert.id,
    kind: "alert",
    label: emergency ? "Emergency alert" : "Operational warning",
    locationId: alert.locationId,
    position: { x: position.x + 7, y: position.y - 12 },
    status: `${alert.severity} · ${alert.status} · risk ${alert.risk}%`,
    intent: alert.pauseRequested ? "Production paused for safe investigation" : "Inspect and acknowledge evidence",
    route: ["Park Operations", alert.id, alert.incidentId ?? "No grouped incident"],
    accessibilityLabel: `${emergency ? "Emergency" : "Warning"} alert; ${alert.status}; risk ${alert.risk} percent; ${alert.immediateRisk}`,
    assetId: ASSET_IDS.hazard,
    assetVersion: "1.0.0",
    selected,
    critical: emergency,
    cue: cue(emergency ? "emergency" : "warning", emergency ? "Emergency: production paused" : "Operational warning", emergency ? "emergency" : "warning", emergency ? "urgent-pulse" : "none"),
    occlusionClass: "overlay",
    occlusion: "visible",
    depthBaseline: depthFor(position, "overlay"),
    renderOrder: renderOrderFor(position, "overlay"),
    source: "park-operations",
    sourceTick: operations.tick,
    relatedEntityIds: [...alert.entityIds, ...(alert.incidentId === undefined ? [] : [alert.incidentId])],
  };
};

const incidentProjection = (
  incident: ParkIncident,
  world: Readonly<WorldState>,
  operations: ParkOperationsState,
  selected: boolean,
): PlayerEntityProjection => {
  const position = operationPosition(world, incident.locationId);
  const emergency = incident.risk >= 80;
  return {
    id: incident.id,
    kind: "incident",
    label: "Opening-Day Near Miss",
    locationId: incident.locationId,
    position: { x: position.x + 11, y: position.y - 14 },
    status: `${incident.status} · risk ${incident.risk}% · ${incident.entityIds.length} affected entities`,
    intent: incident.status === "stabilized" || incident.status === "resolved" || incident.status === "closed" ? "Retain recovery evidence" : "Compare expected, observed, consequence, and gap",
    route: ["Park Operations", "North Paddock", "Opening-Day Near Miss"],
    accessibilityLabel: `Opening-Day Near Miss; ${incident.status}; risk ${incident.risk} percent; ${incident.immediateGap.join("; ")}`,
    assetId: ASSET_IDS.hazard,
    assetVersion: "1.0.0",
    selected,
    critical: incident.status !== "closed",
    cue: cue(incident.status === "closed" ? "outcome" : emergency ? "emergency" : "warning", incident.status === "closed" ? "Incident closed" : "Near miss requires investigation", incident.status === "closed" ? "success" : emergency ? "emergency" : "warning", incident.status === "closed" ? "none" : emergency ? "urgent-pulse" : "none"),
    occlusionClass: "overlay",
    occlusion: "visible",
    depthBaseline: depthFor(position, "overlay"),
    renderOrder: renderOrderFor(position, "overlay"),
    source: "park-operations",
    sourceTick: operations.tick,
    relatedEntityIds: [...incident.entityIds, ...incident.alertIds],
    evidence: {
      expected: incident.expected,
      observed: [...incident.observed],
      consequence: [...incident.consequence],
      immediateGap: [...incident.immediateGap],
      traceIds: [...incident.traceIds],
    },
  };
};

const withOcclusion = (
  entities: readonly PlayerEntityProjection[],
  semanticZoom: SemanticZoomLevel,
): { readonly entities: readonly PlayerEntityProjection[]; readonly aggregates: readonly SceneAggregate[] } => {
  const visible: PlayerEntityProjection[] = [];
  const aggregates: SceneAggregate[] = [];
  const groups = new Map<string, PlayerEntityProjection[]>();
  for (const entity of entities) {
    const key = `${entity.locationId}:${Math.round(entity.position.x / 8)}:${Math.round(entity.position.y / 8)}`;
    const group = groups.get(key) ?? [];
    group.push(entity);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) =>
      Number(right.selected) - Number(left.selected) ||
      Number(right.critical) - Number(left.critical) ||
      right.renderOrder - left.renderOrder ||
      compareIds(left, right));
    const [front, ...behind] = ordered;
    if (front === undefined) continue;
    visible.push({ ...front, occlusion: "visible" });
    for (const entity of behind) {
      const isFarRoutine = semanticZoom === "far" && !entity.selected && !entity.critical;
      visible.push({ ...entity, occlusion: isFarRoutine ? "aggregate" : "occluded" });
    }
    if (semanticZoom === "far" && group.length > 1) {
      aggregates.push({
        id: asStableId(`aggregate:${group[0]?.locationId.replace(":", "-") ?? "park"}`),
        locationId: group[0]?.locationId ?? asStableId("location:park"),
        position: group[0]?.position ?? locationPoint(asStableId("location:park")),
        label: `${group.length} nearby park entities`,
        count: group.length,
        entityIds: group.map((entry) => entry.id).sort(),
        cue: cue("provenance", `${group.length} entities grouped by distance`, "info"),
      });
    }
  }
  return {
    entities: visible.sort((left, right) => left.renderOrder - right.renderOrder || compareIds(left, right)),
    aggregates: aggregates.sort(compareIds),
  };
};

export interface ProjectionOptions {
  readonly camera?: CameraState;
  readonly selectedEntityId?: StableId;
  readonly assetBundle?: RuntimeAssetBundle;
  readonly assetCatalog?: RuntimeAssetCatalog;
  readonly renderFrame?: number;
}

/** Convert authoritative read models into an immutable Park View projection. */
export const projectPlayerScene = (
  world: Readonly<WorldState>,
  operations: Readonly<ParkOperationsState>,
  options: ProjectionOptions = {},
): PlayerSceneProjection => {
  const camera = options.camera ?? DEFAULT_CAMERA;
  const semanticZoom = semanticZoomFor(camera.zoom);
  const entities: PlayerEntityProjection[] = [
    ...[...world.dinosaurs].sort(compareIds).map((entry) => dinosaurProjection(entry, operations, entry.id === options.selectedEntityId)),
    ...[...world.robots].filter((entry) => entry.id === "robot:alpha").sort(compareIds).map((entry) => robotProjection(entry, operations, entry.id === options.selectedEntityId)),
    ...[...world.gates].sort(compareIds).map((entry) => gateProjection(entry, operations, entry.id === options.selectedEntityId)),
    ...[...world.visitors].sort(compareIds).map((entry) => visitorProjection(entry, entry.id === options.selectedEntityId)),
    ...[...world.hazards].sort(compareIds).map((entry) => hazardProjection(entry, entry.id === options.selectedEntityId)),
    ...[...operations.jobs].sort(compareIds).map((entry) => jobProjection(entry, world, operations, entry.id === options.selectedEntityId)),
    ...[...operations.alerts].sort(compareIds).map((entry) => alertProjection(entry, world, operations, entry.id === options.selectedEntityId)),
    ...[...operations.incidents].sort(compareIds).map((entry) => incidentProjection(entry, world, operations, entry.id === options.selectedEntityId)),
  ].map((entry) => ({ ...entry, sourceTick: world.tick }));
  const occluded = withOcclusion(entities, semanticZoom);
  const renderFrame = options.renderFrame ?? 0;
  return {
    orientation: "three-quarter",
    lighting: "dawn",
    camera,
    semanticZoom,
    entities: occluded.entities,
    aggregates: occluded.aggregates,
    assetBundle: OPENING_ASSET_BUNDLE,
    ...(options.assetCatalog === undefined ? {} : { assetCatalog: options.assetCatalog }),
    renderFrame,
  };
};

/**
 * Apply a presentational animation offset without changing the projection or
 * any authoritative read model. Reduced motion returns a structural clone.
 */
export const interpolateSceneProjection = (
  scene: PlayerSceneProjection,
  presentationTimeMs: number,
  reducedMotion: boolean,
): PlayerSceneProjection => {
  const phase = reducedMotion ? 0 : Math.sin(presentationTimeMs / 360);
  return {
    ...scene,
    renderFrame: scene.renderFrame + 1,
    entities: scene.entities.map((entity) => ({
      ...entity,
      position: reducedMotion ? { ...entity.position } : entity.kind === "dinosaur"
        ? { x: entity.position.x + phase * 0.35, y: entity.position.y + Math.abs(phase) * 0.55 }
        : entity.kind === "robot" && !entity.status.startsWith("Available")
          ? { x: entity.position.x + phase * 1.4, y: entity.position.y - Math.abs(phase) * 0.35 }
          : entity.kind === "visitor"
            ? { x: entity.position.x - Math.abs(phase) * 0.7, y: entity.position.y }
            : entity.cue?.motion === "gentle-pulse" || entity.cue?.motion === "urgent-pulse"
              ? { x: entity.position.x, y: entity.position.y + phase * 0.8 }
              : { ...entity.position },
    })),
    aggregates: scene.aggregates.map((aggregate) => ({
      ...aggregate,
      position: { ...aggregate.position },
    })),
  };
};

export const openingAssetIds = (): readonly string[] => [...OPENING_RUNTIME_ASSET_IDS];
