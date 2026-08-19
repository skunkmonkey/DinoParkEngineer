/** The sole downstream import surface for deterministic authored content. */
export { canonicalSerialize, fingerprint, fingerprintCatalogPackage } from "./canonical.js";
export { createContentRegistry } from "./registry.js";
export {
  CONTENT_REGISTRY_FOUNDATION_REFERENCES,
  createContentRegistryFoundationFixture,
  createInvalidContentRegistryFoundationPackage,
} from "./foundation-fixture.js";
export { createContentClassSchemaCatalog, promptDataSchema } from "./schemas.js";
export type { ContentClassSchemaCatalog } from "./schemas.js";
export type {
  CatalogPackage, ContentAvailability, ContentClassDefinition, ContentProvenance, ContentRecord,
  ContentReference, ContentRegistry, LoadedPackage, PackageLoadResult, PackageRequirement,
  RegistryDiagnostic, RegistryDiagnosticCode, RegistryInspectionProjection, RegistryResolutionResult,
  ResolvedContentManifest,
} from "./types.js";
