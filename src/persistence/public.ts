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
  createPersistenceSessionCandidate,
  createVersionedPersistencePort,
  createSaveEnvelope,
  validateSaveEnvelope,
} from "./engine.js";
export { createAsyncPersistenceCoordinator } from "./async-engine.js";
export {
  createInMemoryRepository,
  createInMemorySaveRepository,
  createMemorySaveRepository,
} from "./repository.js";
export { createIndexedDbSaveRepository } from "./indexeddb.js";
export { createAutosaveCoordinator, checkpointDiagnostic } from "./autosave.js";
export { createLegacyV0Fixture, migrateSave } from "./migration.js";
export { commitPortableImport, exportPortableSave, inspectPortableSave } from "./portable-package.js";
export { exportPersistenceDiagnostics, loadLastKnownGood } from "./recovery.js";
export {
  contextPersistenceStateSchema,
  persistenceContentManifestSchema,
  persistencePackageManifestSchema,
  persistenceSchemas,
  persistenceSectionSchemas,
  persistenceSectionsSchema,
  playerPreferencesSchema,
  mvpCompositeStateSchema,
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
  AsyncSaveReadResult,
  AsyncSaveRepository,
  AsyncPersistenceCoordinator,
  AutosaveCoordinator,
  HistoricalReplayOptions,
  HistoricalReplayResult,
  LoadOperationResult,
  MemorySessionPort,
  MigrationAudit,
  MigrationResult,
  MvpCompositeState,
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
  PortableSavePackage,
  PortableValue,
  ImportResult,
  SafeCheckpoint,
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
