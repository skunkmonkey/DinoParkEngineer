import type { ContentReference, LoadedPackage } from "../content-registry/public.js";
import type {
  ContextManifest,
  RetentionAudit,
} from "../context/public.js";
import type {
  ParkOperationsState,
} from "../park-operations/public.js";
import type {
  PlayerPreferences,
} from "../player-experience/public.js";
import type {
  Trace,
  ReplayVerificationResult,
} from "../trace-replay/public.js";
import type { WorldState } from "../simulation/public.js";

/** The first persisted format is deliberately literal for historical saves. */
export const PERSISTENCE_SCHEMA_VERSION = "1" as const;
export const PERSISTENCE_COMPLETION_MARKER = "SAVE_COMPLETE" as const;
export const PERSISTENCE_FINGERPRINT_ALGORITHM = "fnv1a64" as const;

export type PersistenceSchemaVersion = typeof PERSISTENCE_SCHEMA_VERSION;
export type PersistenceDomain =
  | "simulation"
  | "parkOperations"
  | "context"
  | "traceReplay"
  | "preferences"
  | "mvp";

export type PortableScalar = null | boolean | number | string;
export type PortableValue = PortableScalar | readonly PortableValue[] | { readonly [key: string]: PortableValue };

/** State not already owned by the five foundation sections. */
export interface MvpCompositeState {
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly memory: PortableValue;
  readonly evals: PortableValue;
  readonly workbench: PortableValue;
  readonly reviews: PortableValue;
  readonly deployments: PortableValue;
  readonly economy: PortableValue;
  readonly incidents: PortableValue;
  readonly response: PortableValue;
  readonly progression: PortableValue;
  readonly rewards: PortableValue;
  readonly curriculum: PortableValue;
  readonly consent: PortableValue;
}

/**
 * Versioned domain ports keep persistence independent from mutable engines.
 * A port supplies a serializable snapshot and validates imported section data;
 * it does not expose renderer, DOM, or executable state.
 */
export interface VersionedPersistencePort<Domain extends PersistenceDomain, T> {
  readonly domain: Domain;
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly snapshot: () => T;
  readonly validate: (value: unknown) => PersistenceValidationResult<T>;
}

export interface PersistenceDiagnostic {
  readonly code:
    | "PERSISTENCE_ENVELOPE_INVALID"
    | "PERSISTENCE_SCHEMA_UNSUPPORTED"
    | "PERSISTENCE_COMPLETION_MISSING"
    | "PERSISTENCE_INTEGRITY_MISMATCH"
    | "PERSISTENCE_SECTION_INVALID"
    | "PERSISTENCE_PORTABLE_DATA_INVALID"
    | "PERSISTENCE_CONTENT_MISSING"
    | "PERSISTENCE_CONTENT_MANIFEST_INVALID"
    | "PERSISTENCE_REPLAY_INVALID"
    | "PERSISTENCE_SAVE_NOT_FOUND"
    | "PERSISTENCE_REPOSITORY_WRITE_FAILED"
    | "PERSISTENCE_REPOSITORY_PROMOTION_FAILED"
    | "PERSISTENCE_SESSION_REPLACEMENT_FAILED"
    | "PERSISTENCE_DELETE_CONFIRMATION_REQUIRED"
    | "PERSISTENCE_QUOTA_EXCEEDED"
    | "PERSISTENCE_TRANSACTION_ABORTED"
    | "PERSISTENCE_CORRUPT_RECORD"
    | "PERSISTENCE_TRUNCATED_RECORD"
    | "PERSISTENCE_STALE_STAGING"
    | "PERSISTENCE_IMPORT_QUARANTINED"
    | "PERSISTENCE_IMPORT_CONFLICT"
    | "PERSISTENCE_MIGRATION_FAILED"
    | "PERSISTENCE_MIGRATION_STEP_MISSING"
    | "PERSISTENCE_SAFE_CHECKPOINT_REQUIRED";
  readonly path: string;
  readonly rule: string;
  readonly message: string;
}

export interface PersistenceValidationFailure {
  readonly ok: false;
  readonly diagnostics: readonly PersistenceDiagnostic[];
}

export interface PersistenceValidationSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly diagnostics: readonly [];
}

export type PersistenceValidationResult<T> =
  | PersistenceValidationSuccess<T>
  | PersistenceValidationFailure;

export type SimulationPersistencePort = VersionedPersistencePort<"simulation", WorldState>;
export type ParkOperationsPersistencePort = VersionedPersistencePort<"parkOperations", ParkOperationsState>;
export type ContextPersistencePort = VersionedPersistencePort<"context", ContextPersistenceState>;
export type TraceReplayPersistencePort = VersionedPersistencePort<"traceReplay", TracePersistenceState>;
export type PreferencesPersistencePort = VersionedPersistencePort<"preferences", PlayerPreferences>;

export interface PersistencePackageManifest extends LoadedPackage {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly requirement: "required" | "optional";
  readonly fingerprint: string;
}

export interface PersistenceContentManifest {
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly packages: readonly PersistencePackageManifest[];
  readonly references: readonly ContentReference[];
  readonly fingerprint: string;
}

export interface PersistenceSection<T> {
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly fingerprint: string;
  readonly data: T;
}

/** Context is stored as an explicit history of decision-boundary manifests. */
export interface ContextPersistenceState {
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly manifests: readonly ContextManifest[];
  readonly retentionAudits: readonly RetentionAudit[];
}

/** Traces are immutable historical records; replay sessions are derived. */
export interface TracePersistenceState {
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly traces: readonly Trace[];
}

export interface PersistenceSections {
  readonly simulation: PersistenceSection<WorldState>;
  readonly parkOperations: PersistenceSection<ParkOperationsState>;
  readonly context: PersistenceSection<ContextPersistenceState>;
  readonly traceReplay: PersistenceSection<TracePersistenceState>;
  readonly preferences: PersistenceSection<PlayerPreferences>;
  readonly mvp?: PersistenceSection<MvpCompositeState>;
}

/** The complete first-playable state, without renderer or DOM projections. */
export interface PersistenceSession {
  readonly world: WorldState;
  readonly operations: ParkOperationsState;
  readonly context: ContextPersistenceState;
  readonly traces: readonly Trace[];
  readonly preferences: PlayerPreferences;
  readonly mvp?: MvpCompositeState;
}

export interface SaveEnvelope {
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly saveSchemaVersion: PersistenceSchemaVersion;
  readonly applicationVersion: string;
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly park: {
    readonly tick: number;
    readonly day: number;
    readonly seed: number;
  };
  readonly contentManifest: PersistenceContentManifest;
  readonly sections: PersistenceSections;
  readonly integrity: {
    readonly algorithm: typeof PERSISTENCE_FINGERPRINT_ALGORITHM;
    readonly fingerprint: string;
  };
  readonly completionMarker: typeof PERSISTENCE_COMPLETION_MARKER;
}

export interface SaveEnvelopeInput {
  readonly id: string;
  readonly applicationVersion?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly contentManifest: PersistenceContentManifest;
  readonly session: PersistenceSession;
}

export interface PersistenceContentResolver {
  readonly resolveExact: (
    id: string,
    version: string,
  ) => { readonly ok: boolean };
}

export interface SaveValidationOptions {
  readonly contentResolver?: PersistenceContentResolver;
  readonly requireContentResolution?: boolean;
}

export interface SaveMetadata {
  readonly id: string;
  readonly schemaVersion: PersistenceSchemaVersion;
  readonly applicationVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tick: number;
  readonly day: number;
  readonly seed: number;
  readonly contentFingerprint: string;
  readonly integrityFingerprint: string;
}

export interface SaveRepository {
  readonly stage: (envelope: SaveEnvelope) => PersistenceRepositoryResult;
  readonly promote: (id: string) => PersistenceRepositoryResult;
  readonly read: (id?: string) => SaveEnvelope | undefined;
  readonly list: () => readonly SaveMetadata[];
  readonly remove: (id: string, confirmed: boolean) => PersistenceRepositoryResult;
  readonly knownGoodId: () => string | undefined;
}

export interface AsyncSaveRepository {
  readonly stage: (envelope: SaveEnvelope) => Promise<PersistenceRepositoryResult>;
  readonly promote: (id: string) => Promise<PersistenceRepositoryResult>;
  readonly read: (id?: string) => Promise<AsyncSaveReadResult>;
  readonly list: () => Promise<readonly SaveMetadata[]>;
  readonly remove: (id: string, confirmed: boolean) => Promise<PersistenceRepositoryResult>;
  readonly knownGoodId: () => Promise<string | undefined>;
  readonly discardStaleStages: (olderThanUpdatedAt: string) => Promise<PersistenceRepositoryResult>;
}

export type AsyncSaveReadResult =
  | { readonly ok: true; readonly envelope: SaveEnvelope }
  | { readonly ok: false; readonly diagnostics: readonly PersistenceDiagnostic[] };

export interface SafeCheckpoint {
  readonly safe: true;
  readonly tick: number;
  readonly request: SaveRequest;
}

export interface AutosaveCoordinator {
  readonly request: (checkpoint: SafeCheckpoint) => Promise<SaveOperationResult>;
  readonly flush: () => Promise<SaveOperationResult | undefined>;
}

export interface PortableSavePackage {
  readonly format: "dino-park-save";
  readonly formatVersion: "1";
  readonly envelope: SaveEnvelope;
  readonly fingerprint: string;
}

export interface MigrationAudit {
  readonly fromVersion: string;
  readonly toVersion: PersistenceSchemaVersion;
  readonly stepId: string;
  readonly originalFingerprint: string;
  readonly migratedFingerprint: string;
}

export interface MigrationResult {
  readonly ok: boolean;
  readonly envelope?: SaveEnvelope;
  readonly originalBackup: string;
  readonly audit?: MigrationAudit;
  readonly diagnostics: readonly PersistenceDiagnostic[];
}

export interface ImportResult {
  readonly ok: boolean;
  readonly quarantined: boolean;
  readonly envelope?: SaveEnvelope;
  readonly originalBackup: string;
  readonly diagnostics: readonly PersistenceDiagnostic[];
}

export interface PersistenceRepositoryResult {
  readonly ok: boolean;
  readonly diagnostics: readonly PersistenceDiagnostic[];
}

export interface PersistenceSessionPort {
  readonly snapshot: () => PersistenceSession;
  /** Implementations must replace the whole candidate atomically. */
  readonly replace: (candidate: PersistenceSession) => void;
}

export interface MemorySessionPort extends PersistenceSessionPort {
  readonly current: () => PersistenceSession;
}

export interface PersistenceCoordinatorOptions {
  readonly repository: SaveRepository;
  readonly session: PersistenceSessionPort;
  readonly applicationVersion?: string;
  readonly contentResolver?: PersistenceContentResolver;
  /** Metadata clock only; logical world time always comes from the session. */
  readonly now?: () => string;
}

export interface SaveRequest {
  readonly id: string;
  readonly applicationVersion?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly contentManifest: PersistenceContentManifest;
  readonly session?: PersistenceSession;
}

export interface SaveOperationSuccess {
  readonly ok: true;
  readonly envelope: SaveEnvelope;
}

export interface SaveOperationFailure {
  readonly ok: false;
  readonly diagnostics: readonly PersistenceDiagnostic[];
}

export type SaveOperationResult = SaveOperationSuccess | SaveOperationFailure;

export interface LoadOperationSuccess {
  readonly ok: true;
  readonly envelope: SaveEnvelope;
  readonly session: PersistenceSession;
}

export type LoadOperationResult = LoadOperationSuccess | SaveOperationFailure;

export interface HistoricalReplayOptions {
  readonly availableContent?: readonly ContentReference[];
  readonly resolver?: PersistenceContentResolver;
}

export interface HistoricalReplayResult {
  readonly ok: boolean;
  readonly traceId: string;
  readonly verification?: ReplayVerificationResult;
  readonly diagnostics: readonly PersistenceDiagnostic[];
}

export interface PersistenceCoordinator {
  readonly save: (request: SaveRequest) => SaveOperationResult;
  readonly load: (id?: string) => LoadOperationResult;
  readonly replay: (saveId: string, traceId: string, options?: HistoricalReplayOptions) => HistoricalReplayResult;
}

export interface AsyncPersistenceCoordinator {
  readonly save: (request: SaveRequest) => Promise<SaveOperationResult>;
  readonly load: (id?: string) => Promise<LoadOperationResult>;
}
