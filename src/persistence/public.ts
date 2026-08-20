/** Sole downstream import surface for versioned, local, exact save data. */
export {
  canonicalSaveSerialize,
  clonePortable,
  fingerprintSaveData,
  freezePortable,
  validatePortableData,
} from "./canonical.js";
export {
  createDefaultInMemoryPersistence,
  createManualPersistence,
  createMemorySessionPort,
  createPersistenceContentManifest,
  createPersistenceCoordinator,
  createVersionedPersistencePort,
  createSaveEnvelope,
  validateSaveEnvelope,
} from "./engine.js";
export {
  createInMemoryRepository,
  createInMemorySaveRepository,
  createMemorySaveRepository,
} from "./repository.js";
export {
  contextPersistenceStateSchema,
  persistenceContentManifestSchema,
  persistencePackageManifestSchema,
  persistenceSchemas,
  persistenceSectionSchemas,
  persistenceSectionsSchema,
  playerPreferencesSchema,
  saveEnvelopeSchema,
  tracePersistenceStateSchema,
} from "./schemas.js";
export {
  PERSISTENCE_COMPLETION_MARKER,
  PERSISTENCE_FINGERPRINT_ALGORITHM,
  PERSISTENCE_SCHEMA_VERSION,
} from "./types.js";
export type {
  ContextPersistenceState,
  HistoricalReplayOptions,
  HistoricalReplayResult,
  LoadOperationResult,
  MemorySessionPort,
  PersistenceContentManifest,
  PersistenceContentResolver,
  PersistenceCoordinator,
  PersistenceCoordinatorOptions,
  ContextPersistencePort,
  PersistenceDiagnostic,
  PersistenceDomain,
  PersistencePackageManifest,
  PersistenceRepositoryResult,
  PersistenceSchemaVersion,
  PersistenceSection,
  PersistenceSections,
  PersistenceSession,
  PersistenceSessionPort,
  ParkOperationsPersistencePort,
  PreferencesPersistencePort,
  SimulationPersistencePort,
  TraceReplayPersistencePort,
  PersistenceValidationFailure,
  PersistenceValidationResult,
  PersistenceValidationSuccess,
  SaveEnvelope,
  SaveEnvelopeInput,
  SaveMetadata,
  SaveOperationFailure,
  SaveOperationResult,
  SaveOperationSuccess,
  SaveRequest,
  SaveRepository,
  SaveValidationOptions,
  TracePersistenceState,
  VersionedPersistencePort,
} from "./types.js";
export type { SaveEnvelopeSchema } from "./schemas.js";
export { createPersistenceFoundationFixture } from "./foundation-fixture.js";
export { PersistenceFoundationView } from "./view.js";
