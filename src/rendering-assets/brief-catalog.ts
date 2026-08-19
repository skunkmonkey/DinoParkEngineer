import {
  createContentRegistry,
  fingerprintCatalogPackage,
  type PackageLoadResult,
} from "../content-registry/public.js";
import { assetArtDirectionDataSchema, assetBriefDataSchema } from "./schemas.js";

export const ASSET_BRIEF_CLASS = "AssetBrief";
export const ASSET_ART_DIRECTION_CLASS = "AssetArtDirection";
export const RENDERING_ASSET_SCHEMA_VERSION = "1";

export const loadAssetBriefCatalog = (entries: readonly unknown[]): PackageLoadResult => {
  const unsigned = {
    packageId: "assets:mvp-briefs",
    packageVersion: "1.0.0",
    registrySchemaVersion: "1",
    requirement: "required" as const,
    entries,
  };
  const pkg = { ...unsigned, fingerprint: fingerprintCatalogPackage(unsigned) };
  return createContentRegistry({
    registrySchemaVersion: "1",
    classDefinitions: [
      { class: ASSET_ART_DIRECTION_CLASS, schemaVersion: RENDERING_ASSET_SCHEMA_VERSION, schema: assetArtDirectionDataSchema },
      { class: ASSET_BRIEF_CLASS, schemaVersion: RENDERING_ASSET_SCHEMA_VERSION, schema: assetBriefDataSchema },
    ],
  }).loadPackages([pkg]);
};
