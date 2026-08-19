/**
 * The sole browser-facing import surface for the application shell.
 * Feature packages should import contracts and helpers from this module, not
 * from shell implementation files.
 */

export {
  assertValidFeatureRegistrations,
  buildFeatureRegistry,
  createFeatureRegistry,
  FeatureNotFoundError,
  FeatureRegistryValidationError,
  normalizeRoutePath,
  validateFeatureRegistrations,
} from "./feature-registry.js";

export type {
  FeatureFailurePresentation,
  FeatureLoader,
  FeatureRecoveryAction,
  FeatureRegistry,
  FeatureRegistryIssue,
  FeatureRegistryIssueCode,
  FeatureRegistryOptions,
  FeatureRegistration,
  FeatureRequirement,
  FeatureRouteContribution,
  RegisteredFeature,
} from "./feature-registry.js";

export {
  createRouteRequest,
  matchCleanRoute,
  matchRoute,
  normalizeBasePath,
  normalizeRequestPath,
  NOT_FOUND_MODE,
  NOT_FOUND_TITLE,
  RoutePathError,
} from "./route.js";

export {
  ACCESSIBILITY_DIAGNOSTIC_CODES,
  createAccessibilityPort,
  createAccessibilityPreferencesPort,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
} from "./providers/accessibility.js";
export type {
  AccessibilityPort,
  AccessibilityPreferenceKey,
  AccessibilityPreferences,
  AccessibilityPreferencesPort,
  AccessibilityUpdateResult,
} from "./providers/accessibility.js";

export {
  AUDIO_DIAGNOSTIC_CODES,
  createAudioPort,
  DEFAULT_AUDIO_SNAPSHOT,
} from "./providers/audio.js";
export type {
  AudioCueRequest,
  AudioCueResult,
  AudioPort,
  AudioSnapshot,
  AudioUpdateResult,
} from "./providers/audio.js";

export {
  CONFIGURATION_DIAGNOSTIC_CODES,
  ConfigurationValidationError,
  createConfigurationPort,
  validateConfiguration,
} from "./providers/configuration.js";
export type {
  ConfigurationOptions,
  ConfigurationPort,
  ConfigurationSnapshot,
  ConfigurationValidationIssue,
  ConfigurationValidationResult,
} from "./providers/configuration.js";

export { createDiagnosticsPort } from "./providers/diagnostics.js";
export type {
  DiagnosticInput,
  DiagnosticRecord,
  DiagnosticScope,
  DiagnosticSeverity,
  DiagnosticsPort,
  RecoveryAction,
} from "./providers/diagnostics.js";

export {
  createFeatureStatusPort,
  FEATURE_STATUS_DIAGNOSTIC_CODES,
} from "./providers/feature-status.js";
export type {
  FeatureLifecycleStatus,
  FeatureRegistration as FeatureStatusRegistration,
  FeatureStatusPort,
  FeatureStatusRecord,
  FeatureStatusResult,
} from "./providers/feature-status.js";

export {
  createMemoryPersistencePort,
  createPlaceholderPersistencePort,
  PERSISTENCE_DIAGNOSTIC_CODES,
} from "./providers/persistence.js";
export type {
  MemoryPersistenceOptions,
  PersistenceCheckpoint,
  PersistenceCheckpointRequest,
  PersistencePort,
  PersistenceWriteResult,
} from "./providers/persistence.js";

export {
  createProviderContext,
  createProviderGraph,
  PROVIDER_DIAGNOSTIC_CODES,
  ProviderGraph,
  ProviderGraphValidationError,
  validateProviderDefinitions,
} from "./providers/provider-graph.js";
export type {
  ProviderContext,
  ProviderDefinition,
  ProviderDisposeReport,
  ProviderFailure,
  ProviderGraphOptions,
  ProviderGraphValidationResult,
  ProviderLifecycleState,
  ProviderPorts,
  ProviderRequirement,
  ProviderStartReport,
  ProviderStartResult,
  ProviderValidationDiagnostic,
} from "./providers/provider-graph.js";

export {
  createMemoryOfflineAssetAdapter,
} from "./offline/memory-adapter.js";
export type {
  MemoryOfflineAssetAdapter,
  MemoryOfflineAssetAdapterOptions,
} from "./offline/memory-adapter.js";
export {
  createOfflineUpdateCoordinator,
  createOfflineUpdateCoordinatorWithPersistence,
  OFFLINE_UPDATE_DIAGNOSTIC_CODES,
} from "./offline/update-coordinator.js";
export type {
  OfflineUpdateCoordinator,
  OfflineUpdateDependencies,
} from "./offline/update-coordinator.js";
export type {
  ApplyOfflineUpdateOptions,
  OfflineAssetAdapter,
  OfflineCacheEmpty,
  OfflineCacheInspection,
  OfflineCacheReady,
  OfflineCacheUpdateReady,
  OfflineFailureState,
  OfflineInstallState,
  OfflineReadyState,
  OfflineRecoveryAction,
  OfflineUpdateApplyResult,
  OfflineUpdateCoordinatorOptions,
  OfflineUpdateFailure,
  OfflineUpdateFailureOperation,
  OfflineUpdateReadyState,
  OfflineUpdateState,
  OfflineUpdateStateName,
  SafeCheckpointPort,
  SafeCheckpointRequest,
  SafeCheckpointResult,
} from "./offline/contracts.js";
export type {
  CausalNavigationPayload,
  RouteMatch,
  RouteMatcherOptions,
  RouteNotFound,
  RouteRequest,
  RouteResolution,
  SerializableValue,
} from "./route.js";
