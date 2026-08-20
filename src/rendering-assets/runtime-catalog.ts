import type { RuntimeAssetBundle, RuntimeAssetFrame } from "./types.js";

const cleanBase = (basePath: string): string => basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

export interface RuntimeAssetCatalog {
  readonly atlasUrl: string;
  readonly resolveExact: (assetId: string, assetVersion: string) => RuntimeAssetFrame | undefined;
}

export const createRuntimeAssetCatalog = (bundle: RuntimeAssetBundle, basePath: string): RuntimeAssetCatalog => ({
  atlasUrl: `${cleanBase(basePath)}/assets/mvp-park/${bundle.atlas.image}`,
  resolveExact: (assetId, assetVersion) => bundle.assets.find((asset) => asset.assetId === assetId && asset.assetVersion === assetVersion),
});
