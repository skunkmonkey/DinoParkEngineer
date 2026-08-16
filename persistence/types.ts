import type { WorldSnapshot, SimulationEngine } from "../simulation/index.ts";
import type { ContentRegistry } from "../content-registry/index.ts";
import type { MemoryRepository } from "../memory/index.ts";
import type { ReviewService } from "../review-deployment/index.ts";
import type { TraceRepository } from "../trace-replay/index.ts";

/* Public collections type-erase independently versioned feature adapters. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type SaveSlot = "auto" | "manual" | (string & {});

export interface StateDiagnostic {
  readonly code: "INVALID_TYPE" | "INVALID_VALUE" | "MISSING_FIELD" | "INVALID_REFERENCE" | "SCHEMA_MISMATCH" | "OVERSIZE" | string;
  readonly path: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: readonly StateDiagnostic[] };

/** Feature adapters own domain interpretation; Persistence only coordinates. */
export interface FeatureStateAdapter<T = unknown> {
  readonly id: string;
  readonly schemaVersion: number;
  readonly snapshot: () => T;
  readonly validate: (value: unknown) => ValidationResult<T>;
  readonly restore: (value: T) => void;
  readonly canonicalHash: (value: T) => string;
  readonly references?: (value: T) => readonly string[];
}

export interface SaveMetadata {
  readonly saveId: string;
  readonly slot: SaveSlot;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly logicalTime?: number;
}

export interface SaveManifest {
  readonly buildId: string;
  readonly engineVersion?: string;
  readonly contentManifestVersion?: string;
  readonly schemas: Readonly<Record<string, number | string>>;
}

export interface FeatureStateSection {
  readonly schemaVersion: number;
  readonly value: unknown;
  readonly canonicalHash: string;
  readonly references?: readonly string[];
}

export interface SaveEnvelope {
  readonly formatVersion: number;
  readonly metadata: SaveMetadata;
  readonly manifest: SaveManifest;
  readonly features: Readonly<Record<string, FeatureStateSection>>;
  readonly contentRefs: readonly string[];
  readonly checksum: string;
  readonly sizeBytes: number;
}

export interface SaveRecord {
  readonly envelope: SaveEnvelope;
  readonly raw: string;
}

export type SaveWritePhase = "before-temp" | "after-temp" | "before-verify" | "after-verify" | "before-active" | "after-active" | "after-backup";

export interface SaveRepository {
  readonly read: (slot: SaveSlot) => Promise<SaveRecord | undefined>;
  readonly get?: (slot: SaveSlot) => Promise<SaveRecord | undefined>;
  readonly write: (slot: SaveSlot, envelope: SaveEnvelope) => Promise<void>;
  readonly put?: (slot: SaveSlot, envelope: SaveEnvelope) => Promise<void>;
  readonly remove: (slot: SaveSlot, confirmation?: string) => Promise<void>;
  readonly list: () => Promise<readonly SaveMetadata[]>;
  readonly export: (slot: SaveSlot) => Promise<Blob>;
  readonly import: (slot: SaveSlot, raw: string) => Promise<void>;
  readonly backup: (slot: SaveSlot) => Promise<SaveRecord | undefined>;
  /** Choose a validated active save, falling back to the last-known-good copy. */
  readonly recover: (slot: SaveSlot) => Promise<SaveRecord | undefined>;
}

export interface MemoryRepositoryOptions {
  readonly initial?: readonly SaveEnvelope[];
  readonly failureInjector?: (phase: SaveWritePhase, slot: SaveSlot) => void;
  readonly maxBytes?: number;
}

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface BrowserRepositoryOptions {
  readonly storage?: BrowserStorageLike;
  readonly namespace?: string;
  readonly maxBytes?: number;
  readonly failureInjector?: (phase: SaveWritePhase, slot: SaveSlot) => void;
}

export interface SaveBoundary {
  readonly isSafe?: () => boolean;
  /** May return a per-save release hook (for example, restoring a player's
   * prior pause state) after the immutable snapshot has committed or failed. */
  readonly awaitSafePoint?: () => Promise<void | (() => void | Promise<void>)>;
}

export interface SaveResult {
  readonly ok: boolean;
  readonly slot: SaveSlot;
  readonly saveId?: string;
  readonly logicalTime?: number;
  readonly canonicalStateHash?: string;
  readonly error?: SaveError;
}

export interface LoadResult {
  readonly ok: boolean;
  readonly slot: SaveSlot;
  readonly saveId?: string;
  readonly canonicalStateHash?: string;
  readonly migratedFrom?: number;
  readonly error?: SaveError;
}

export type SaveErrorCode =
  | "NOT_FOUND"
  | "INVALID_ENVELOPE"
  | "CHECKSUM_MISMATCH"
  | "SCHEMA_INVALID"
  | "REFERENCE_INVALID"
  | "MIGRATION_FAILED"
  | "FUTURE_VERSION"
  | "OVERSIZE"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_QUOTA"
  | "WRITE_INTERRUPTED"
  | "RESTORE_FAILED"
  | "ROLLBACK_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "IMPORT_INVALID"
  | string;

export interface SaveError {
  readonly code: SaveErrorCode;
  readonly message: string;
  readonly slot?: SaveSlot;
  readonly diagnostics?: readonly StateDiagnostic[];
  readonly phase?: string;
  readonly cause?: string;
}

export interface ImportPreview {
  readonly ok: true;
  readonly envelope: SaveEnvelope;
  readonly metadata: SaveMetadata;
  readonly featureIds: readonly string[];
  readonly migratedFrom?: number;
  readonly warnings: readonly string[];
}

export interface ImportError {
  readonly ok: false;
  readonly error: SaveError;
}

export interface Migration {
  readonly id: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (source: SaveEnvelope) => SaveEnvelope;
}

export interface MigrationResult {
  readonly ok: boolean;
  readonly value?: SaveEnvelope;
  readonly fromVersion?: number;
  readonly error?: SaveError;
}

export interface MigrationRunner {
  readonly currentVersion: number;
  readonly run: (source: SaveEnvelope) => MigrationResult;
  readonly validate: (source: SaveEnvelope) => readonly StateDiagnostic[];
}

export interface SaveService {
  readonly save: (slot?: SaveSlot) => Promise<SaveResult>;
  readonly load: (slot: SaveSlot) => Promise<LoadResult>;
  readonly export: (slot: SaveSlot) => Promise<Blob>;
  readonly import: (file: Blob, options?: { readonly slot?: SaveSlot; readonly confirm?: boolean }) => Promise<ImportPreview | ImportError>;
  readonly previewImport: (file: Blob) => Promise<ImportPreview | ImportError>;
  readonly delete: (slot: SaveSlot, confirmation?: string) => Promise<SaveResult>;
  readonly list: () => Promise<readonly SaveMetadata[]>;
  readonly registerAdapter: <T>(adapter: FeatureStateAdapter<T>) => void;
  readonly adapters: () => readonly FeatureStateAdapter<any>[];
  readonly canonicalStateHash: () => string;
  readonly lastError: () => SaveError | undefined;
}

export interface AutosaveScheduler {
  readonly request: (reason?: string) => Promise<SaveResult>;
  readonly onLogicalTime: (logicalTime: number) => Promise<SaveResult | undefined>;
  readonly onMajorEvent: (event: string, logicalTime?: number) => Promise<SaveResult>;
  readonly flush: () => Promise<SaveResult | undefined>;
  readonly status: () => { readonly pending: boolean; readonly writing: boolean; readonly lastLogicalTime?: number; readonly lastReason?: string; readonly lastResult?: SaveResult };
  readonly dispose: () => void;
}

export interface TransactionParticipant {
  readonly id: string;
  readonly prepare?: (transactionId: string) => void | boolean | Promise<void | boolean>;
  readonly commit?: (transactionId: string) => void | Promise<void>;
  readonly rollback?: (transactionId: string) => void | Promise<void>;
  readonly snapshot?: () => unknown;
  readonly restore?: (snapshot: unknown) => void;
  /** Aliases are accepted so domain ports can remain persistence-agnostic. */
  readonly checkpoint?: () => unknown;
  readonly recover?: (snapshot: unknown) => void;
}

export interface TransactionResult<T> {
  readonly ok: boolean;
  readonly transactionId: string;
  readonly status: "COMMITTED" | "ROLLED_BACK" | "RECOVERABLE" | "DUPLICATE";
  readonly value?: T;
  readonly duplicate?: boolean;
  readonly error?: SaveError;
}

export interface TransactionCoordinator {
  readonly execute: <T>(transactionId: string, participants: readonly TransactionParticipant[], work: () => T | Promise<T>) => Promise<TransactionResult<T>>;
  readonly run: <T>(transactionId: string, participants: readonly TransactionParticipant[], work: () => T | Promise<T>) => Promise<TransactionResult<T>>;
  readonly recover: (transactionId: string) => TransactionResult<unknown> | undefined;
  readonly results: () => readonly TransactionResult<unknown>[];
}

/** Ports used by the standard adapter factory. All restores are optional at
 * the domain boundary; unsupported state remains a caller-supplied adapter. */
export interface StandardPersistencePorts {
  readonly simulation?: SimulationEngine;
  readonly registry?: ContentRegistry;
  readonly memory?: { readonly repository: () => MemoryRepository } | MemoryRepository;
  readonly reviews?: ReviewService;
  readonly traces?: TraceRepository;
  /** Versioned ports supplied by state-owning feature packages. Persistence
   * never reaches through these ports into domain stores. */
  readonly economy?: FeatureStatePort;
  readonly operations?: FeatureStatePort;
  readonly context?: FeatureStatePort;
  readonly evals?: FeatureStatePort;
  readonly deployments?: FeatureStatePort;
  readonly curriculum?: FeatureStatePort;
  readonly orchestration?: FeatureStatePort;
  readonly featureStatePorts?: Readonly<Record<string, FeatureStatePort>>;
  readonly custom?: readonly FeatureStateAdapter<any>[];
}

export interface FeatureStatePort {
  readonly snapshot: () => unknown;
  readonly restore?: (value: unknown) => void;
  readonly validate?: (value: unknown) => ValidationResult<unknown>;
  readonly canonicalHash?: (value: unknown) => string;
  readonly references?: (value: unknown) => readonly string[];
  readonly schemaVersion?: number;
}

export interface StandardAdapterSet {
  readonly adapters: readonly FeatureStateAdapter<any>[];
  readonly byId: ReadonlyMap<string, FeatureStateAdapter<any>>;
}

export interface PersistenceOptions {
  readonly adapters?: readonly FeatureStateAdapter<any>[];
  readonly repository?: SaveRepository;
  readonly migrations?: readonly Migration[];
  readonly formatVersion?: number;
  readonly buildManifest?: Partial<SaveManifest>;
  readonly boundary?: SaveBoundary;
  readonly clock?: () => string;
  readonly idFactory?: () => string;
  readonly maxImportBytes?: number;
  readonly resolveContentRef?: (ref: string) => boolean;
}

export type SimulationStateAdapter = FeatureStateAdapter<WorldSnapshot>;
