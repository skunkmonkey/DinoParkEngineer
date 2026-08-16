/**
 * Public Application Shell entry point.
 *
 * Downstream features may import contracts and factories from this module only.
 * Shell implementation modules remain private to the shell package.
 */
export {
  featureId,
  routeId,
  type FeatureId,
  type FeatureModule,
  type FeatureReadiness,
  type FeatureStatus,
  type ProviderComposer,
  type ProviderContext,
  type ProviderLifecycleResult,
  type ProviderRegistration,
  type PublicRuntimeConfig,
  type RegistrationDiagnostic,
  type Result,
  type RouteComponent,
  type RouteId,
  type RouteMatch,
  type ShellError,
  type ShellLifecycleContext,
  type ShellMode,
  type ShellRegistration,
  type ShellRouteProps,
  type ShellRouteManifestEntry,
  type ShellRouteRegistration,
} from "./types.ts";
export { createFeatureRegistry } from "./registry.ts";
export { createProviderComposer } from "./providers.ts";
export {
  applyBasePath,
  matchRoute,
  matchesRouteManifest,
  normalizeClientHref,
  pushBrowserNavigation,
  readBrowserHref,
  subscribeToBrowserNavigation,
  type BrowserNavigationPort,
} from "./router.ts";
export { DEFAULT_RUNTIME_CONFIG, getBrowserRuntimeConfig, parseRuntimeConfig } from "./config.ts";
export { diagnosticsToErrors, normalizeShellError } from "./errors.ts";
