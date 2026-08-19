export type OfflineUpdateStateName =
  | "install"
  | "offline-ready"
  | "update-ready"
  | "failure";

export interface OfflineCacheEmpty {
  readonly status: "empty";
  readonly targetVersion?: string;
}

export interface OfflineCacheReady {
  readonly status: "ready";
  readonly version: string;
}

export interface OfflineCacheUpdateReady {
  readonly status: "update-ready";
  readonly currentVersion: string;
  readonly availableVersion: string;
}

export type OfflineCacheInspection =
  | OfflineCacheEmpty
  | OfflineCacheReady
  | OfflineCacheUpdateReady;

export type OfflineUpdateFailureOperation =
  | "inspect"
  | "install"
  | "check"
  | "checkpoint"
  | "activate";

export interface OfflineUpdateFailure {
  readonly operation: OfflineUpdateFailureOperation;
  readonly code: string;
  readonly message: string;
  readonly previousState: OfflineUpdateStateName;
  /** A safe, immutable state to restore when the player chooses Retry. */
  readonly retryState?: OfflineUpdateState;
  readonly recoveryActions: readonly OfflineRecoveryAction[];
}

export interface OfflineInstallState {
  readonly state: "install";
  readonly targetVersion?: string;
}

export interface OfflineReadyState {
  readonly state: "offline-ready";
  readonly version: string;
}

export interface OfflineUpdateReadyState {
  readonly state: "update-ready";
  readonly currentVersion: string;
  readonly availableVersion: string;
}

export interface OfflineFailureState {
  readonly state: "failure";
  readonly failure: OfflineUpdateFailure;
}

export type OfflineUpdateState =
  | OfflineInstallState
  | OfflineReadyState
  | OfflineUpdateReadyState
  | OfflineFailureState;

export interface OfflineRecoveryAction {
  readonly id: "retry" | "continue-offline" | "reload-safe";
  readonly label: string;
}

export interface OfflineAssetAdapter {
  readonly inspect: () => OfflineCacheInspection | Promise<OfflineCacheInspection>;
  readonly install: () => void | Promise<void>;
  readonly activateUpdate: () => void | Promise<void>;
  readonly checkForUpdate?: () =>
    | OfflineCacheInspection
    | Promise<OfflineCacheInspection>;
}

export interface SafeCheckpointRequest {
  readonly reason: "activate-update" | string;
  readonly confirmNoMutableSessionState?: boolean;
}

export interface SafeCheckpointResult {
  readonly safe: boolean;
  readonly checkpointId?: string;
  readonly diagnosticCode?: string;
  readonly mutableSessionStatePending?: boolean;
}

export interface SafeCheckpointPort {
  readonly requestSafeCheckpoint: (
    request: SafeCheckpointRequest,
  ) => SafeCheckpointResult | Promise<SafeCheckpointResult>;
}

export interface ApplyOfflineUpdateOptions {
  readonly confirmNoMutableSessionState?: boolean;
}

export type OfflineUpdateApplyResult =
  | {
      readonly status: "activated";
      readonly state: OfflineUpdateState;
    }
  | {
      readonly status: "deferred";
      readonly code: string;
      readonly state: OfflineUpdateReadyState;
    }
  | {
      readonly status: "rejected";
      readonly code: string;
      readonly state: OfflineUpdateState;
    }
  | {
      readonly status: "failed";
      readonly code: string;
      readonly state: OfflineFailureState;
    };

export interface OfflineUpdateCoordinatorOptions {
  readonly targetVersion?: string;
  readonly onStateChange?: (state: OfflineUpdateState) => void;
}
