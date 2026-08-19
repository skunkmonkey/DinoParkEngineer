import type { z } from "zod";

export type ContentAvailability = "available" | "hidden" | "unavailable";
export type PackageRequirement = "required" | "optional";

export interface ContentReference {
  readonly id: string;
  readonly version: string;
  readonly expectedClass?: string;
  readonly expectedSchemaVersion?: string;
}

export interface ContentProvenance {
  readonly source: string;
  readonly path: string;
  readonly author: string;
  readonly license?: string;
}

export interface ContentRecord<TData = unknown> {
  readonly id: string;
  readonly version: string;
  readonly class: string;
  readonly schemaVersion: string;
  readonly displayName: string;
  readonly author: string;
  readonly provenance: ContentProvenance;
  readonly contextCost: number;
  readonly dependencies: readonly ContentReference[];
  readonly tags: readonly string[];
  readonly availability: ContentAvailability;
  readonly readableSource?: string;
  readonly data: TData;
}

export interface CatalogPackage {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly registrySchemaVersion: string;
  readonly requirement: PackageRequirement;
  readonly entries: readonly unknown[];
  readonly fingerprint: string;
}

export interface ContentClassDefinition<TData = unknown> {
  readonly class: string;
  readonly schemaVersion: string;
  readonly schema: z.ZodType<TData>;
}

export type RegistryDiagnosticCode =
  | "REGISTRY_CASE_COLLISION"
  | "REGISTRY_CLASS_SCHEMA_DUPLICATE"
  | "REGISTRY_CLASS_SCHEMA_MISSING"
  | "REGISTRY_DEPENDENCY_CONFLICT"
  | "REGISTRY_DEPENDENCY_CYCLE"
  | "REGISTRY_DEPENDENCY_DUPLICATE"
  | "REGISTRY_DEPENDENCY_INCOMPATIBLE"
  | "REGISTRY_DEPENDENCY_MISSING"
  | "REGISTRY_DEPENDENCY_SELF"
  | "REGISTRY_IDENTITY_DUPLICATE"
  | "REGISTRY_PACKAGE_FINGERPRINT_MISMATCH"
  | "REGISTRY_PACKAGE_SCHEMA_INCOMPATIBLE"
  | "REGISTRY_PACKAGE_VALIDATION_FAILED"
  | "REGISTRY_PATH_CASE_COLLISION"
  | "REGISTRY_RECORD_VALIDATION_FAILED";

export interface RegistryDiagnostic {
  readonly code: RegistryDiagnosticCode;
  readonly packageId: string;
  readonly source: string;
  readonly record?: string;
  readonly field: string;
  readonly rule: string;
  readonly message: string;
}

export interface LoadedPackage {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly requirement: PackageRequirement;
  readonly fingerprint: string;
}

export interface ResolvedContentManifest {
  readonly root: ContentRecord;
  readonly dependencies: readonly ContentRecord[];
  readonly schemaVersions: readonly {
    readonly id: string;
    readonly version: string;
    readonly schemaVersion: string;
  }[];
  readonly fingerprint: string;
}

export interface RegistryInspectionProjection {
  readonly identity: string;
  readonly contentClass: string;
  readonly version: string;
  readonly schemaVersion: string;
  readonly displayName: string;
  readonly author: string;
  readonly dependencies: readonly string[];
  readonly contextCost: number;
  readonly sourceProvenance: string;
  readonly availability: ContentAvailability;
  readonly readableSource?: string;
}

export type RegistryResolutionResult =
  | { readonly ok: true; readonly manifest: ResolvedContentManifest }
  | { readonly ok: false; readonly diagnostics: readonly RegistryDiagnostic[] };

export type PackageLoadResult =
  | {
      readonly status: "ready";
      readonly registry: ContentRegistry;
      readonly diagnostics: readonly RegistryDiagnostic[];
    }
  | {
      readonly status: "blocked";
      readonly registry: ContentRegistry;
      readonly diagnostics: readonly RegistryDiagnostic[];
    };

export interface ContentRegistry {
  readonly registrySchemaVersion: string;
  readonly packages: readonly LoadedPackage[];
  loadPackages(packages: readonly unknown[]): PackageLoadResult;
  resolveExact(id: string, version: string): RegistryResolutionResult;
  getExact(id: string, version: string): ContentRecord | undefined;
  queryByClass(contentClass: string): readonly ContentRecord[];
  queryByTag(tag: string): readonly ContentRecord[];
  queryByDependency(reference: ContentReference): readonly ContentRecord[];
  queryByAvailability(availability: ContentAvailability): readonly ContentRecord[];
  history(id: string): readonly ContentRecord[];
  inspect(id: string, version: string): RegistryInspectionProjection | undefined;
}
