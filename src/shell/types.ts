import type { ComponentType, ReactNode } from "react";

/** A small result type used at dynamic shell boundaries. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type FeatureId = string & { readonly __featureId: unique symbol };
export type RouteId = string & { readonly __routeId: unique symbol };

export function featureId(value: string): FeatureId {
  return value as FeatureId;
}

export function routeId(value: string): RouteId {
  return value as RouteId;
}

export type ShellMode = "development" | "test" | "production";

export interface PublicRuntimeConfig {
  readonly buildId: string;
  readonly mode: ShellMode;
  readonly basePath: string;
}

export interface ShellRouteProps {
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string | readonly string[]>>;
  readonly route: ShellRouteRegistration;
  readonly navigate: (href: string) => void;
}

export type RouteComponent = ComponentType<ShellRouteProps>;

export interface ProviderContext {
  readonly config: PublicRuntimeConfig;
  readonly dependencies: ReadonlyMap<string, unknown>;
}

export interface ProviderRegistration {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  readonly create: (context: ProviderContext) => unknown | Promise<unknown>;
  readonly dispose?: (instance: unknown) => void | Promise<void>;
}

export interface ShellLifecycleContext {
  readonly config: PublicRuntimeConfig;
  readonly featureId: FeatureId;
  readonly signal: AbortSignal;
  readonly report: (error: ShellError) => void;
}

export interface ShellRouteRegistration {
  readonly id: RouteId;
  readonly path: string;
  readonly parentId?: RouteId;
  readonly title?: string;
  readonly load: () => Promise<RouteComponent>;
}

export interface FeatureModule {
  readonly id: FeatureId;
  readonly routes?: readonly ShellRouteRegistration[];
  readonly providers?: readonly ProviderRegistration[];
  readonly initialize?: (context: ShellLifecycleContext) => void | Promise<void>;
  readonly dispose?: () => void | Promise<void>;
}

export type FeatureStatus =
  | "registered"
  | "initializing"
  | "ready"
  | "stopped"
  | "failed"
  | "unavailable";

export interface RegistrationDiagnostic {
  readonly code:
    | "INVALID_FEATURE_ID"
    | "INVALID_ROUTE_ID"
    | "INVALID_ROUTE_PATH"
    | "INVALID_PROVIDER_ID"
    | "DUPLICATE_FEATURE"
    | "DUPLICATE_ROUTE"
    | "DUPLICATE_PROVIDER"
    | "MISSING_ROUTE_PARENT"
    | "INVALID_ROUTE_PARENT"
    | "MISSING_PROVIDER_DEPENDENCY"
    | "PROVIDER_DEPENDENCY_CYCLE"
    | "FEATURE_ENTRY_LOAD_FAILED"
    | "INVALID_PROVIDER_DEPENDENCY"
    | "INVALID_MODULE";
  readonly featureId?: FeatureId;
  readonly routeId?: RouteId;
  readonly providerId?: string;
  readonly summary: string;
  readonly recoverable: boolean;
}

export interface ShellError {
  readonly category:
    | "configuration"
    | "registration"
    | "startup"
    | "route-load"
    | "route-render"
    | "disposal";
  readonly code: string;
  readonly featureId?: FeatureId;
  readonly routeId?: RouteId;
  readonly recoverable: boolean;
  readonly summary: string;
}

export interface FeatureReadiness {
  readonly id: FeatureId;
  readonly status: FeatureStatus;
  readonly routeCount: number;
  readonly providerCount: number;
  readonly error?: ShellError;
}

export interface RouteMatch {
  readonly route: ShellRouteRegistration;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string | readonly string[]>>;
}

export interface ShellRegistration {
  register(module: unknown): Result<void, readonly RegistrationDiagnostic[]>;
  registerBatch(modules: readonly unknown[]): readonly Result<void, readonly RegistrationDiagnostic[]>[];
  listFeatures(): readonly FeatureReadiness[];
  listRoutes(): readonly ShellRouteRegistration[];
  listProviders(): readonly ProviderRegistration[];
  diagnostics(): readonly RegistrationDiagnostic[];
}

export interface ProviderLifecycleResult {
  readonly ok: boolean;
  readonly errors: readonly ShellError[];
}

export interface ProviderComposer {
  initialize(signal?: AbortSignal): Promise<ProviderLifecycleResult>;
  dispose(): Promise<ProviderLifecycleResult>;
  readiness(): readonly { id: string; status: "pending" | "ready" | "failed" | "disposed" }[];
}

export interface ShellAppProps {
  readonly initialPath?: string;
  readonly initialRoutes?: readonly ShellRouteManifestEntry[];
}

export interface ShellRouteManifestEntry {
  readonly id: RouteId;
  readonly path: string;
  readonly parentId?: RouteId;
  readonly title?: string;
}

export type ShellFallbackProps = {
  readonly title: string;
  readonly summary: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly secondaryActionLabel?: string;
  readonly onSecondaryAction?: () => void;
};

export type ShellChildren = { readonly children?: ReactNode };
