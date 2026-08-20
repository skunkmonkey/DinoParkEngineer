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
  const ground = highContrast ? 0x000000 : 0x183c3c;
  const enclosure = highContrast ? 0x111111 : 0x234f42;
  const path = highContrast ? 0x333333 : 0x8e765d;
  const border = highContrast ? 0xffffff : 0x6fb39a;
  graphics.rect(0, 0, width, height).fill({ color: ground });
  graphics.roundRect(80, 100, 450, 300, 22).fill({ color: enclosure }).stroke({ width: 5, color: border });
  graphics.poly([120, 390, 880, 540, 900, 620, 80, 470]).fill({ color: path });
  graphics.poly([530, 370, 850, 270, 920, 340, 630, 470]).fill({ color: highContrast ? 0x222222 : 0x315d4c });
  graphics.rect(0, 0, width, 100).fill({ color: highContrast ? 0x111111 : 0x292958, alpha: 0.8 });
  graphics.rect(0, height - 50, width, 50).fill({ color: highContrast ? 0x111111 : 0x102330, alpha: 0.8 });
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
    graphics.rect(point.x - 30, point.y - 14, 60, 28).fill({ color }).stroke({ width: entity.selected ? 7 : 3, color: highContrast ? 0xffe082 : 0x07131f });
  } else if (entity.kind === "hazard") {
    graphics.poly([point.x, point.y - radius, point.x + radius, point.y, point.x, point.y + radius, point.x - radius, point.y]).fill({ color }).stroke({ width: entity.selected ? 7 : 3, color: highContrast ? 0xffe082 : 0x07131f });
  } else {
    graphics.circle(point.x, point.y, radius).fill({ color }).stroke({ width: entity.selected ? 7 : 3, color: highContrast ? 0xffe082 : 0x07131f });
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
