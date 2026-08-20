import { fingerprint } from "../content-registry/public.js";
import type { RenderingAssetDiagnostic, RuntimeAssetBundle, RuntimeAssetFrame, RuntimeBundleValidationResult } from "./types.js";

export interface CompileAssetInput {
  readonly assetId: string;
  readonly assetVersion: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceHash: string;
  readonly briefId: string;
  readonly briefVersion: string;
  readonly approvalReviewId: string;
  readonly approvalReviewVersion: string;
  readonly cell: { readonly column: number; readonly row: number };
  readonly pivot: { readonly x: number; readonly y: number };
  readonly semanticTags: readonly string[];
  readonly accessibilityLabel: string;
  readonly occlusionClass: "ground" | "entity" | "structure" | "overlay";
  readonly animationId?: string;
}

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => lexical(left, right)).map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
};

export const canonicalRuntimeBundleJson = (bundle: RuntimeAssetBundle): string => `${JSON.stringify(canonicalize(bundle), null, 2)}\n`;

export const inspectPng = (bytes: Uint8Array): { readonly width: number; readonly height: number; readonly hasAlpha: boolean } | undefined => {
  if (bytes.length < 26 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16); const height = view.getUint32(20); const colorType = bytes[25];
  if (width === 0 || height === 0) return undefined;
  return { width, height, hasAlpha: colorType === 4 || colorType === 6 };
};

export const compileRuntimeBundle = (
  inputs: readonly CompileAssetInput[],
  sourceBytes: Uint8Array,
  logicalPlatform: "darwin" | "win32",
): RuntimeAssetBundle => {
  const png = inspectPng(sourceBytes);
  if (png === undefined || !png.hasAlpha) throw new Error("Approved fixture source must be an RGBA PNG.");
  const cellWidth = Math.floor(png.width / 3); const cellHeight = Math.floor(png.height / 3);
  const assets: RuntimeAssetFrame[] = [...inputs].sort((a, b) => lexical(a.assetId, b.assetId)).map((input): RuntimeAssetFrame => {
    const rectangle = { x: input.cell.column * cellWidth, y: input.cell.row * cellHeight, width: cellWidth, height: cellHeight };
    const frameId = `${input.assetId}:base`;
    return {
      assetId: input.assetId, assetVersion: input.assetVersion, atlasRectangle: rectangle,
      sourceSize: { width: png.width, height: png.height }, trim: rectangle, pivot: input.pivot,
      hitRegion: { type: "rectangle", x: 0.1, y: 0.1, width: 0.8, height: 0.85 },
      depthHint: { baselineY: input.pivot.y, occlusionClass: input.occlusionClass },
      animations: input.animationId === undefined ? [] : [{ id: input.animationId, frames: [frameId], frameDurationMs: 160, loop: true, reducedMotionFrame: frameId }],
      semanticTags: [...input.semanticTags].sort(lexical), accessibilityLabel: input.accessibilityLabel, placeholder: false,
      source: { sourceId: input.sourceId, sourceVersion: input.sourceVersion, sourceHash: input.sourceHash, briefId: input.briefId, briefVersion: input.briefVersion, approvalReviewId: input.approvalReviewId, approvalReviewVersion: input.approvalReviewVersion },
      transforms: [
        { operation: "crop", parameters: rectangle },
        { operation: "trim", parameters: { alphaThreshold: 1, x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height } },
        { operation: "padding", parameters: { pixels: 0 } },
        { operation: "scale", parameters: { numerator: 1, denominator: 1, filter: "nearest" } },
        { operation: "format", parameters: { from: "png", to: "png", colorProfile: "srgb" } },
      ] satisfies RuntimeAssetFrame["transforms"],
    };
  });
  const unsigned = { schemaVersion: "1" as const, bundleId: "assets:bundle-mvp-park", bundleVersion: "1.0.0", atlas: { image: "atlas.png", width: png.width, height: png.height, format: "png" as const }, assets };
  // The logical platform is deliberately excluded: it is an execution input used only to prove path-independent output.
  void logicalPlatform;
  return { ...unsigned, canonicalFingerprint: fingerprint(canonicalize(unsigned)) };
};

export const createDevelopmentPlaceholder = (assetId: string, assetVersion: string, label: string): RuntimeAssetFrame => ({
  assetId, assetVersion, atlasRectangle: { x: 0, y: 0, width: 1, height: 1 }, sourceSize: { width: 1, height: 1 }, trim: { x: 0, y: 0, width: 1, height: 1 }, pivot: { x: 0.5, y: 1 },
  hitRegion: { type: "rectangle", x: 0, y: 0, width: 1, height: 1 }, depthHint: { baselineY: 1, occlusionClass: "overlay" }, animations: [], semanticTags: ["development-placeholder", "missing-media"], accessibilityLabel: `Missing media: ${label}`, placeholder: true,
  source: { sourceId: "assets-source:development-placeholder", sourceVersion: "1", sourceHash: "fnv1a64:0000000000000000", briefId: "assets:brief-development-placeholder", briefVersion: "1", approvalReviewId: "asset-review:development-placeholder", approvalReviewVersion: "1" }, transforms: [],
});

export const validateRuntimeBundle = (bundle: RuntimeAssetBundle, options: { readonly production: boolean; readonly expectedAssetIds: readonly string[]; readonly expectedSourceHash?: string }): RuntimeBundleValidationResult => {
  const diagnostics: RenderingAssetDiagnostic[] = []; const identities = new Map<string, string>();
  for (const asset of bundle.assets) {
    const identity = `${asset.assetId}@${asset.assetVersion}`; const folded = identity.toLowerCase(); const prior = identities.get(folded);
    if (prior !== undefined) diagnostics.push({ code: prior === identity ? "ASSET_RUNTIME_DUPLICATE" : "ASSET_RUNTIME_CASE_COLLISION", field: "assets", message: `${identity} conflicts with ${prior}.` }); else identities.set(folded, identity);
    if (options.production && asset.placeholder) diagnostics.push({ code: "ASSET_PLACEHOLDER_REQUIRED", field: asset.assetId, message: `Production asset ${asset.assetId} cannot be a development placeholder.` });
    if (asset.pivot.x < 0 || asset.pivot.x > 1 || asset.pivot.y < 0 || asset.pivot.y > 1) diagnostics.push({ code: "ASSET_SOURCE_INVALID", field: `${asset.assetId}.pivot`, message: "Pivot must remain normalized." });
    if (options.expectedSourceHash !== undefined && asset.source.sourceHash !== options.expectedSourceHash) diagnostics.push({ code: "ASSET_OUTPUT_STALE", field: asset.assetId, message: "Compiled source hash is stale." });
    for (const animation of asset.animations) if (animation.frames.length === 0 || animation.reducedMotionFrame.length === 0) diagnostics.push({ code: "ASSET_FRAME_MISSING", field: asset.assetId, message: `Animation ${animation.id} is missing required frames.` });
  }
  for (let i = 0; i < bundle.assets.length; i += 1) for (let j = i + 1; j < bundle.assets.length; j += 1) {
    const a = bundle.assets[i]?.atlasRectangle; const b = bundle.assets[j]?.atlasRectangle;
    if (a !== undefined && b !== undefined && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) diagnostics.push({ code: "ASSET_ATLAS_OVERLAP", field: "atlasRectangle", message: `${bundle.assets[i]?.assetId} overlaps ${bundle.assets[j]?.assetId}.` });
  }
  const expected = new Set(options.expectedAssetIds); for (const id of expected) if (!bundle.assets.some((asset) => asset.assetId === id)) diagnostics.push({ code: "ASSET_FRAME_MISSING", field: id, message: `Required runtime asset ${id} is missing.` });
  for (const asset of bundle.assets) if (!expected.has(asset.assetId)) diagnostics.push({ code: "ASSET_ORPHANED", field: asset.assetId, message: `Runtime asset ${asset.assetId} is not referenced by the fixture contract.` });
  return diagnostics.length === 0 ? { ok: true } : { ok: false, diagnostics };
};
