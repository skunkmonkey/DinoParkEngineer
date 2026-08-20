import type { Application, Container, Graphics } from "pixi.js";

import { OPENING_RUNTIME_ASSET_IDS } from "../curriculum-content/public.js";
import { interpolateSceneProjection } from "./projection.js";
import type { PlayerSceneProjection } from "./types.js";
import type { RuntimeAssetFrame } from "../rendering-assets/public.js";

export type SceneRendererStatus =
  | { readonly state: "ready"; readonly renderer: "webgl" | "webgpu" | "canvas"; readonly assets: "approved" | "placeholder" }
  | { readonly state: "fallback"; readonly code: "PIXI_INITIALIZATION_FAILED"; readonly message: string };

export interface PixiSceneMountOptions {
  readonly reducedMotion?: boolean;
  readonly highContrast?: boolean;
  readonly assetBasePath?: string;
  /** Called whenever the renderer or approved art readiness changes. */
  readonly onStatusChange?: (status: SceneRendererStatus) => void;
}

const width = 1000;
const height = 700;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRuntimeAssetFrame = (value: unknown): value is RuntimeAssetFrame => {
  if (!isRecord(value)) return false;
  return typeof value.assetId === "string" && value.assetVersion === "1.0.0" &&
    isRecord(value.atlasRectangle) && typeof value.atlasRectangle.x === "number" &&
    typeof value.atlasRectangle.y === "number" && typeof value.atlasRectangle.width === "number" &&
    typeof value.atlasRectangle.height === "number" && isRecord(value.pivot) &&
    typeof value.pivot.x === "number" && typeof value.pivot.y === "number";
};

const isRuntimeAssetBundle = (value: unknown): value is { readonly assets: readonly RuntimeAssetFrame[]; readonly atlas: { readonly image: string }; readonly bundleId: string; readonly bundleVersion: "1.0.0" } => {
  if (!isRecord(value) || value.schemaVersion !== "1" || value.bundleId !== "assets:bundle-mvp-park" || value.bundleVersion !== "1.0.0" || !isRecord(value.atlas) || typeof value.atlas.image !== "string" || !Array.isArray(value.assets)) return false;
  return value.assets.every(isRuntimeAssetFrame);
};

const assetBase = (path: string): string => path.endsWith("/") ? path.slice(0, -1) : path;

const toCanvasPoint = (point: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } => ({
  x: point.x * (width / 100),
  y: point.y * (height / 100),
});

const entityColor = (kind: string, highContrast: boolean): number => {
  if (highContrast) return 0xffffff;
  switch (kind) {
    case "dinosaur":
      return 0x82d7a5;
    case "robot":
      return 0x81c7ef;
    case "gate":
      return 0xf0bd68;
    case "visitor":
      return 0xf3e38e;
    case "hazard":
      return 0xffa69c;
    default:
      return 0xffffff;
  }
};

const clearLayer = (layer: Container): void => {
  const oldChildren = layer.removeChildren();
  for (const child of oldChildren) child.destroy();
};

const drawPark = (graphics: Graphics, highContrast: boolean): void => {
  const ground = highContrast ? 0x000000 : 0x315f48;
  const habitat = highContrast ? 0x111111 : 0x5f8552;
  const habitatDry = highContrast ? 0x171717 : 0x7e8e4e;
  const visitorPath = highContrast ? 0x3a3a3a : 0xc49a62;
  const serviceRoute = highContrast ? 0x202020 : 0x657266;
  const fence = highContrast ? 0xffffff : 0x283d36;
  const pathEdge = highContrast ? 0xffffff : 0xf0d19a;
  const water = highContrast ? 0x444444 : 0x4fa0a8;

  // Terrain and distant dawn ridge.
  graphics.rect(0, 0, width, height).fill({ color: ground });
  graphics.poly([0, 0, 1000, 0, 1000, 115, 840, 82, 700, 120, 520, 76, 330, 120, 170, 70, 0, 105]).fill({ color: highContrast ? 0x111111 : 0x31436b });
  graphics.poly([0, 86, 155, 48, 285, 102, 430, 62, 590, 110, 740, 66, 890, 100, 1000, 72, 1000, 145, 0, 145]).fill({ color: highContrast ? 0x1a1a1a : 0x244b47 });

  // Visitor promenade and connected service loop use consistent widths/edges.
  graphics.poly([35, 570, 75, 525, 915, 455, 980, 485, 952, 530, 100, 610]).fill({ color: visitorPath }).stroke({ width: 7, color: pathEdge });
  graphics.poly([470, 620, 515, 595, 640, 430, 680, 452, 565, 635, 545, 700, 455, 700]).fill({ color: serviceRoute }).stroke({ width: 5, color: fence });
  graphics.poly([485, 590, 445, 505, 410, 420, 438, 398, 485, 490, 525, 575]).fill({ color: serviceRoute }).stroke({ width: 5, color: fence });

  // Two authored habitats with distinct ground, water, shade, feeders, and gates.
  graphics.roundRect(70, 145, 370, 315, 34).fill({ color: habitat }).stroke({ width: 10, color: fence });
  graphics.roundRect(555, 125, 340, 300, 34).fill({ color: habitatDry }).stroke({ width: 10, color: fence });
  graphics.ellipse(145, 335, 68, 36).fill({ color: water }).stroke({ width: 4, color: highContrast ? 0xffffff : 0x2e6c75 });
  graphics.ellipse(805, 205, 55, 30).fill({ color: water }).stroke({ width: 4, color: highContrast ? 0xffffff : 0x2e6c75 });
  graphics.roundRect(115, 190, 88, 42, 8).fill({ color: highContrast ? 0x555555 : 0x5c4a37 });
  graphics.roundRect(740, 315, 92, 44, 8).fill({ color: highContrast ? 0x555555 : 0x5c4a37 });
  graphics.rect(342, 355, 46, 25).fill({ color: highContrast ? 0xffffff : 0xd9b668 }).stroke({ width: 4, color: fence });
  graphics.rect(602, 330, 46, 25).fill({ color: highContrast ? 0xffffff : 0xd9b668 }).stroke({ width: 4, color: fence });

  // Intentional fence posts make containment legible without labels.
  for (const x of [92, 145, 198, 251, 304, 357, 410]) {
    graphics.rect(x, 137, 8, 22).fill({ color: fence });
    graphics.rect(x, 450, 8, 22).fill({ color: fence });
  }
  for (const x of [575, 625, 675, 725, 775, 825, 875]) {
    graphics.rect(x, 117, 8, 22).fill({ color: fence });
    graphics.rect(x, 416, 8, 22).fill({ color: fence });
  }

  // Robot depot, keeper building, arrival pavilion, and route destinations.
  graphics.roundRect(700, 520, 180, 115, 16).fill({ color: highContrast ? 0x222222 : 0x36586b }).stroke({ width: 6, color: highContrast ? 0xffffff : 0x9fc3c4 });
  graphics.poly([690, 525, 790, 470, 890, 525]).fill({ color: highContrast ? 0xffffff : 0xd46f4f }).stroke({ width: 5, color: fence });
  graphics.rect(760, 560, 62, 75).fill({ color: highContrast ? 0x000000 : 0x1f3541 }).stroke({ width: 4, color: pathEdge });
  graphics.roundRect(875, 445, 105, 68, 12).fill({ color: highContrast ? 0x222222 : 0xe2c77c }).stroke({ width: 5, color: fence });

  // Landscaping integrates the paths and provides scale.
  for (const [x, y, radius] of [[35, 210, 24], [480, 170, 28], [500, 315, 20], [930, 285, 27], [220, 520, 22], [615, 545, 18], [925, 620, 20]] as const) {
    graphics.rect(x - 4, y, 8, 24).fill({ color: highContrast ? 0xffffff : 0x4f382a });
    graphics.circle(x, y - 10, radius).fill({ color: highContrast ? 0xffffff : 0x214a36 }).stroke({ width: 3, color: highContrast ? 0x000000 : 0x6f9d55 });
  }
};

const drawEntity = (
  graphics: Graphics,
  entity: PlayerSceneProjection["entities"][number],
  highContrast: boolean,
): void => {
  const point = toCanvasPoint(entity.position);
  const color = entityColor(entity.kind, highContrast);
  const radius = entity.kind === "gate" ? 26 : entity.kind === "hazard" ? 18 : 22;
  if (entity.kind === "gate") {
    graphics.rect(point.x - 34, point.y - 18, 10, 38).fill({ color });
    graphics.rect(point.x + 24, point.y - 18, 10, 38).fill({ color });
    graphics.rect(point.x - 24, point.y - 7, 48, 12).fill({ color }).stroke({ width: entity.selected ? 7 : 3, color: highContrast ? 0xffe082 : 0x07131f });
    if (entity.cue?.grammar === "degraded" || entity.cue?.grammar === "emergency") {
      graphics.poly([point.x + 34, point.y - 30, point.x + 22, point.y - 12, point.x + 40, point.y - 15, point.x + 27, point.y + 6]).stroke({ width: 5, color: highContrast ? 0xffffff : 0xffd166 });
    }
  } else if (entity.kind === "hazard") {
    graphics.poly([point.x, point.y - radius, point.x + radius, point.y, point.x, point.y + radius, point.x - radius, point.y]).fill({ color }).stroke({ width: entity.selected ? 7 : 3, color: highContrast ? 0xffe082 : 0x07131f });
  } else {
    graphics.ellipse(point.x, point.y, entity.kind === "dinosaur" ? radius * 1.6 : radius, radius).fill({ color }).stroke({ width: entity.selected ? 7 : 3, color: highContrast ? 0xffe082 : 0x07131f });
    if (entity.kind === "dinosaur") {
      graphics.circle(point.x + 30, point.y - 8, 12).fill({ color }).stroke({ width: 3, color: highContrast ? 0x000000 : 0x07131f });
      graphics.poly([point.x - 32, point.y, point.x - 55, point.y + 10, point.x - 28, point.y + 13]).fill({ color });
    }
  }
  if (entity.selected) {
    graphics.circle(point.x, point.y, radius + 12).stroke({ width: 5, color: 0xffe082 });
  }
  if (entity.cue !== undefined) {
    graphics.circle(point.x + radius, point.y - radius, 9).fill({ color: entity.critical ? 0xffa69c : 0xffe38a }).stroke({ width: 2, color: 0x07131f });
  }
};

/**
 * Production WebGL-preferred, projection-only Pixi adapter. It does not run a
 * ticker and does not retain world state: every render consumes a fresh scene
 * projection supplied by React.
 */
export class PixiParkSceneAdapter {
  private application: Application | undefined;
  private layer: Container | undefined;
  private graphicsConstructor: typeof import("pixi.js").Graphics | undefined;
  private spriteConstructor: typeof import("pixi.js").Sprite | undefined;
  private textureConstructor: typeof import("pixi.js").Texture | undefined;
  private rectangleConstructor: typeof import("pixi.js").Rectangle | undefined;
  private pixiModule: typeof import("pixi.js") | undefined;
  private assetFrames = new Map<string, RuntimeAssetFrame>();
  private atlasTexture: import("pixi.js").Texture | undefined;
  private host: HTMLElement | undefined;
  private options: PixiSceneMountOptions = {};
  private animationFrame: number | undefined;
  private status: SceneRendererStatus = {
    state: "fallback",
    code: "PIXI_INITIALIZATION_FAILED",
    message: "The park scene is waiting for a browser renderer; semantic controls remain available.",
  };

  private updateStatus(status: SceneRendererStatus): void {
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  async mount(host: HTMLElement, options: PixiSceneMountOptions = {}): Promise<SceneRendererStatus> {
    this.host = host;
    this.options = options;
    try {
      const pixi = await import("pixi.js");
      const application = new pixi.Application();
      await application.init({
        width,
        height,
        antialias: true,
        autoDensity: true,
        autoStart: false,
        preference: "webgl",
        powerPreference: "high-performance",
        backgroundAlpha: 0,
      });
      this.application = application;
      this.layer = new pixi.Container();
      this.graphicsConstructor = pixi.Graphics;
      this.spriteConstructor = pixi.Sprite;
      this.textureConstructor = pixi.Texture;
      this.rectangleConstructor = pixi.Rectangle;
      this.pixiModule = pixi;
      application.stage.addChild(this.layer);
      application.canvas.setAttribute("aria-hidden", "true");
      application.canvas.dataset.rendererPreference = "webgl";
      application.canvas.className = "park-pixi-canvas";
      host.replaceChildren(application.canvas);
      const animate = (presentationTime: number): void => {
        if (this.application === undefined) return;
        if (this.lastScene !== undefined) this.render(this.lastScene, presentationTime);
        this.animationFrame = window.requestAnimationFrame(animate);
      };
      this.animationFrame = window.requestAnimationFrame(animate);
      const renderer = application.renderer.type === 1 ? "webgl" : application.renderer.type === 2 ? "webgpu" : "canvas";
      this.updateStatus({ state: "ready", renderer, assets: "placeholder" });
      void this.loadApprovedAssets();
      return this.status;
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "WebGL initialization failed.";
      this.updateStatus({
        state: "fallback",
        code: "PIXI_INITIALIZATION_FAILED",
        message: `PixiJS could not initialize production WebGL (${detail}). Semantic park controls remain available.`,
      });
      return this.status;
    }
  }

  private async loadApprovedAssets(): Promise<void> {
    const pixi = this.pixiModule;
    if (pixi === undefined) return;
    const basePath = assetBase(this.options.assetBasePath ?? "/");
    try {
      const bundleResponse = await fetch(`${basePath}/assets/mvp-park/atlas.json`);
      if (!bundleResponse.ok) throw new Error(`atlas metadata responded ${bundleResponse.status}`);
      const bundleValue: unknown = await bundleResponse.json();
      if (!isRuntimeAssetBundle(bundleValue)) throw new Error("atlas metadata failed the runtime asset boundary");
      const expected = new Set<string>(OPENING_RUNTIME_ASSET_IDS);
      const frames = bundleValue.assets.filter((entry) => expected.has(entry.assetId));
      if (frames.length !== expected.size) throw new Error("approved opening asset IDs are incomplete");
      const atlas = await pixi.Assets.load<import("pixi.js").Texture>(`${basePath}/assets/mvp-park/${bundleValue.atlas.image}`);
      for (const frame of frames) this.assetFrames.set(`${frame.assetId}@${frame.assetVersion}`, frame);
      this.atlasTexture = atlas;
      if (this.status.state === "ready") this.updateStatus({ ...this.status, assets: "approved" });
      if (this.lastScene !== undefined) this.render(this.lastScene);
    } catch {
      // The WebGL scene remains useful with explicit shape placeholders. The
      // status is kept visible so missing optional media is never silent.
      if (this.status.state === "ready") this.updateStatus({ ...this.status, assets: "placeholder" });
    }
  }

  getStatus(): SceneRendererStatus {
    return this.status;
  }

  setOptions(options: PixiSceneMountOptions): void {
    this.options = { ...this.options, ...options };
  }

  private lastScene: PlayerSceneProjection | undefined;

  render(scene: PlayerSceneProjection, presentationTimeMs = 0): void {
    this.lastScene = scene;
    const application = this.application;
    const layer = this.layer;
    if (application === undefined || layer === undefined) return;
    clearLayer(layer);
    const GraphicsConstructor = this.graphicsConstructor;
    if (GraphicsConstructor === undefined) return;
    const graphics = new GraphicsConstructor();
    const presentational = interpolateSceneProjection(scene, presentationTimeMs, this.options.reducedMotion ?? false);
    drawPark(graphics, this.options.highContrast ?? false);
    layer.addChild(graphics);
    const selected = presentational.entities.find((entry) => entry.selected);
    if (selected?.kind === "robot" || selected?.kind === "dinosaur" || presentational.entities.some((entry) => entry.kind === "incident" && entry.critical)) {
      const route = new GraphicsConstructor();
      const routeColor = this.options.highContrast === true ? 0xffffff : 0x7ee8d0;
      route.poly([765, 515, 650, 475, 520, 565, 445, 400, 365, 385]).stroke({ width: 7, color: routeColor, alpha: 0.82 });
      for (const [x, y] of [[765, 515], [650, 475], [520, 565], [445, 400], [365, 385]] as const) route.circle(x, y, 8).fill({ color: routeColor }).stroke({ width: 3, color: 0x17322d });
      layer.addChild(route);
    }
    for (const entity of presentational.entities.filter((entry) => entry.occlusion !== "aggregate")) {
      const frame = this.assetFrames.get(`${entity.assetId}@${entity.assetVersion}`);
      const SpriteConstructor = this.spriteConstructor;
      const TextureConstructor = this.textureConstructor;
      const RectangleConstructor = this.rectangleConstructor;
      if (frame !== undefined && this.atlasTexture !== undefined && SpriteConstructor !== undefined && TextureConstructor !== undefined && RectangleConstructor !== undefined) {
        const texture = new TextureConstructor({
          source: this.atlasTexture.source,
          frame: new RectangleConstructor(frame.atlasRectangle.x, frame.atlasRectangle.y, frame.atlasRectangle.width, frame.atlasRectangle.height),
          defaultAnchor: frame.pivot,
        });
        const sprite = new SpriteConstructor(texture);
        const point = toCanvasPoint(entity.position);
        sprite.anchor.set(frame.pivot.x, frame.pivot.y);
        sprite.position.set(point.x, point.y);
        const size = entity.kind === "dinosaur" ? { width: 130, height: 105 }
          : entity.kind === "gate" ? { width: 120, height: 88 }
            : entity.kind === "robot" ? { width: 105, height: 105 }
              : entity.kind === "visitor" ? { width: 82, height: 110 }
                : entity.kind === "job" || entity.kind === "alert" || entity.kind === "incident" ? { width: 72, height: 72 }
                  : { width: 64, height: 64 };
        sprite.width = size.width;
        sprite.height = size.height;
        sprite.alpha = entity.occlusion === "occluded" ? 0.45 : 1;
        layer.addChild(sprite);
        const cueGraphics = new GraphicsConstructor();
        if (entity.selected) cueGraphics.circle(point.x, point.y, 48).stroke({ width: 5, color: 0xffe082 });
        if (entity.cue !== undefined) cueGraphics.circle(point.x + 32, point.y - 32, 9).fill({ color: entity.critical ? 0xffa69c : 0xffe38a });
        layer.addChild(cueGraphics);
      } else {
        const entityGraphics = new GraphicsConstructor();
        drawEntity(entityGraphics, entity, this.options.highContrast ?? false);
        layer.addChild(entityGraphics);
      }
    }
    application.render();
  }

  dispose(): void {
    if (this.animationFrame !== undefined) window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
    this.layer?.destroy({ children: true });
    this.layer = undefined;
    this.graphicsConstructor = undefined;
    this.spriteConstructor = undefined;
    this.textureConstructor = undefined;
    this.rectangleConstructor = undefined;
    this.pixiModule = undefined;
    this.atlasTexture = undefined;
    this.assetFrames.clear();
    this.application?.destroy({ removeView: true }, { children: true });
    this.application = undefined;
    this.host?.replaceChildren();
    this.host = undefined;
  }
}
