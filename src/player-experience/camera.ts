import type {
  CameraBounds,
  CameraState,
  Point2D,
  SemanticZoomLevel,
} from "./types.js";

export const DEFAULT_CAMERA_BOUNDS: CameraBounds = Object.freeze({
  minX: 16,
  maxX: 84,
  minY: 20,
  maxY: 80,
});

export const DEFAULT_CAMERA: CameraState = Object.freeze({
  center: Object.freeze({ x: 50, y: 50 }),
  zoom: 1,
  bounds: DEFAULT_CAMERA_BOUNDS,
});

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.25;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const clampPoint = (point: Point2D, bounds: CameraBounds): Point2D => ({
  x: clamp(point.x, bounds.minX, bounds.maxX),
  y: clamp(point.y, bounds.minY, bounds.maxY),
});

/** Keep all camera movement deterministic and inside the authored park. */
export const clampCamera = (camera: CameraState): CameraState => ({
  ...camera,
  center: clampPoint(camera.center, camera.bounds),
  zoom: clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM),
});

export const semanticZoomFor = (zoom: number): SemanticZoomLevel => {
  if (zoom < 0.95) return "far";
  if (zoom < 1.4) return "mid";
  return "near";
};

export const panCamera = (
  camera: CameraState,
  delta: Point2D,
): CameraState => clampCamera({
  ...camera,
  center: {
    x: camera.center.x + delta.x / Math.max(camera.zoom, MIN_ZOOM),
    y: camera.center.y + delta.y / Math.max(camera.zoom, MIN_ZOOM),
  },
});

export const zoomCamera = (
  camera: CameraState,
  delta: number,
  anchor?: Point2D,
): CameraState => {
  const nextZoom = clamp(camera.zoom + delta, MIN_ZOOM, MAX_ZOOM);
  if (anchor === undefined || nextZoom === camera.zoom) {
    return clampCamera({ ...camera, zoom: nextZoom });
  }

  // Keep the point under the pointer stable while zooming. This is a view
  // transform only; it never feeds values back into the simulation.
  const ratio = 1 - camera.zoom / nextZoom;
  return clampCamera({
    ...camera,
    zoom: nextZoom,
    center: {
      x: camera.center.x + (anchor.x - camera.center.x) * ratio,
      y: camera.center.y + (anchor.y - camera.center.y) * ratio,
    },
  });
};

export const focusCamera = (
  camera: CameraState,
  point: Point2D,
): CameraState => clampCamera({ ...camera, center: point });

export const cameraForViewport = (
  viewport: { readonly width: number; readonly height: number },
  bounds: CameraBounds = DEFAULT_CAMERA_BOUNDS,
): CameraState => {
  const aspect = viewport.height === 0 ? 1 : viewport.width / viewport.height;
  const zoom = aspect < 1 ? 0.9 : 1;
  return clampCamera({ ...DEFAULT_CAMERA, zoom, bounds });
};
