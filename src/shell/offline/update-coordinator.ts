import type { PersistencePort } from "../providers/persistence.js";
import {
  type ApplyOfflineUpdateOptions,
  type OfflineAssetAdapter,
  type OfflineCacheInspection,
  type OfflineFailureState,
  type OfflineReadyState,
  type OfflineRecoveryAction,
  type OfflineUpdateApplyResult,
  type OfflineUpdateCoordinatorOptions,
  type OfflineUpdateFailureOperation,
  type OfflineUpdateReadyState,
  type OfflineUpdateState,
  type SafeCheckpointPort,
} from "./contracts.js";

export const OFFLINE_UPDATE_DIAGNOSTIC_CODES = {
  INSTALL_FAILED: "SHELL_OFFLINE_INSTALL_FAILED",
  INSPECTION_FAILED: "SHELL_OFFLINE_INSPECTION_FAILED",
  CHECK_FAILED: "SHELL_OFFLINE_UPDATE_CHECK_FAILED",
  UPDATE_FAILED: "SHELL_OFFLINE_UPDATE_FAILED",
  CHECKPOINT_FAILED: "SHELL_UPDATE_CHECKPOINT_FAILED",
  UNSAFE_SESSION: "SHELL_UPDATE_UNSAFE_SESSION",
  NOT_READY: "SHELL_UPDATE_NOT_READY",
  ALREADY_RUNNING: "SHELL_UPDATE_OPERATION_IN_PROGRESS",
} as const;

export interface OfflineUpdateCoordinator {
  readonly getState: () => OfflineUpdateState;
  readonly initialize: () => Promise<OfflineUpdateState>;
  readonly install: () => Promise<OfflineUpdateState>;
  readonly checkForUpdate: () => Promise<OfflineUpdateState>;
  readonly announceUpdate: (
    availableVersion: string,
  ) => OfflineUpdateReadyState | OfflineFailureState;
  readonly applyUpdate: (
    options?: ApplyOfflineUpdateOptions,
  ) => Promise<OfflineUpdateApplyResult>;
  readonly retry: () => Promise<OfflineUpdateState>;
  readonly subscribe: (listener: (state: OfflineUpdateState) => void) => () => void;
}

export interface OfflineUpdateDependencies {
  readonly assets: OfflineAssetAdapter;
  readonly checkpoint: SafeCheckpointPort | PersistencePort;
}

export function createOfflineUpdateCoordinator(
  dependencies: OfflineUpdateDependencies,
  options: OfflineUpdateCoordinatorOptions = {},
): OfflineUpdateCoordinator {
  let state: OfflineUpdateState = Object.freeze({
    state: "install",
    ...(options.targetVersion === undefined
      ? {}
      : { targetVersion: options.targetVersion }),
  });
  let operation: Promise<unknown> | undefined;
  const listeners = new Set<(nextState: OfflineUpdateState) => void>();

  const publish = (nextState: OfflineUpdateState): OfflineUpdateState => {
    state = Object.freeze(nextState) as OfflineUpdateState;
    options.onStateChange?.(state);
    listeners.forEach((listener) => listener(state));
    return state;
  };

  const fail = (
    operationName: OfflineUpdateFailureOperation,
    code: string,
    message: string,
    previousState: OfflineUpdateState,
  ): OfflineFailureState => {
    const failure: OfflineFailureState = {
      state: "failure",
      failure: {
        operation: operationName,
        code,
        message,
        previousState: previousState.state,
        ...(previousState.state === "failure"
          ? {}
          : { retryState: previousState }),
        recoveryActions: recoveryActionsFor(operationName),
      },
    };
    return publish(failure) as OfflineFailureState;
  };

  const initialize = async (): Promise<OfflineUpdateState> => {
    if (operation !== undefined) {
      await operation;
      return state;
    }

    const work = (async (): Promise<OfflineUpdateState> => {
      const previousState = state;
      try {
        const inspection = await dependencies.assets.inspect();
        return applyInspection(inspection, previousState);
      } catch (error: unknown) {
        return fail(
          "inspect",
          OFFLINE_UPDATE_DIAGNOSTIC_CODES.INSPECTION_FAILED,
          getErrorMessage(error),
          previousState,
        );
      }
    })();
    operation = work;
    try {
      return await work;
    } finally {
      operation = undefined;
    }
  };

  const install = async (): Promise<OfflineUpdateState> => {
    if (state.state !== "install") {
      return state;
    }
    if (operation !== undefined) {
      await operation;
      return state;
    }

    const work = (async (): Promise<OfflineUpdateState> => {
      const previousState = state;
      try {
        await dependencies.assets.install();
        const inspection = await dependencies.assets.inspect();
        if (inspection.status === "update-ready") {
          return applyInspection(inspection, previousState);
        }

        const version =
          inspection.status === "ready"
            ? inspection.version
            : inspection.targetVersion ?? options.targetVersion;
        if (version === undefined || version.trim().length === 0) {
          return fail(
            "install",
            OFFLINE_UPDATE_DIAGNOSTIC_CODES.INSTALL_FAILED,
            "The asset adapter completed installation without reporting a version.",
            previousState,
          );
        }

        return publish({ state: "offline-ready", version });
      } catch (error: unknown) {
        return fail(
          "install",
          OFFLINE_UPDATE_DIAGNOSTIC_CODES.INSTALL_FAILED,
          getErrorMessage(error),
          previousState,
        );
      }
    })();
    operation = work;
    try {
      return await work;
    } finally {
      operation = undefined;
    }
  };

  const checkForUpdate = async (): Promise<OfflineUpdateState> => {
    if (operation !== undefined) {
      await operation;
      return state;
    }

    const work = (async (): Promise<OfflineUpdateState> => {
      const previousState = state;
      try {
        const inspection = dependencies.assets.checkForUpdate
          ? await dependencies.assets.checkForUpdate()
          : await dependencies.assets.inspect();
        return applyInspection(inspection, previousState);
      } catch (error: unknown) {
        return fail(
          "check",
          OFFLINE_UPDATE_DIAGNOSTIC_CODES.CHECK_FAILED,
          getErrorMessage(error),
          previousState,
        );
      }
    })();
    operation = work;
    try {
      return await work;
    } finally {
      operation = undefined;
    }
  };

  const announceUpdate = (
    availableVersion: string,
  ): OfflineUpdateReadyState | OfflineFailureState => {
    const normalized = availableVersion.trim();
    if (normalized.length === 0) {
      return fail(
        "check",
        OFFLINE_UPDATE_DIAGNOSTIC_CODES.CHECK_FAILED,
        "An update must identify a non-empty version.",
        state,
      );
    }

    const currentVersion = getCurrentVersion(state);
    if (currentVersion === undefined) {
      return fail(
        "check",
        OFFLINE_UPDATE_DIAGNOSTIC_CODES.CHECK_FAILED,
        "An update cannot be announced before an offline-ready build exists.",
        state,
      );
    }

    return publish({
      state: "update-ready",
      currentVersion,
      availableVersion: normalized,
    }) as OfflineUpdateReadyState;
  };

  const applyUpdate = async (
    applyOptions: ApplyOfflineUpdateOptions = {},
  ): Promise<OfflineUpdateApplyResult> => {
    if (state.state !== "update-ready") {
      return {
        status: "rejected",
        code: OFFLINE_UPDATE_DIAGNOSTIC_CODES.NOT_READY,
        state,
      };
    }

    if (operation !== undefined) {
      return {
        status: "rejected",
        code: OFFLINE_UPDATE_DIAGNOSTIC_CODES.ALREADY_RUNNING,
        state,
      };
    }

    const updateState = state;
    const work = (async (): Promise<OfflineUpdateApplyResult> => {
      let checkpointResult;
      try {
        checkpointResult = await dependencies.checkpoint.requestSafeCheckpoint({
          reason: "activate-update",
          confirmNoMutableSessionState:
            applyOptions.confirmNoMutableSessionState === true,
        });
      } catch (error: unknown) {
        const failure = fail(
          "checkpoint",
          OFFLINE_UPDATE_DIAGNOSTIC_CODES.CHECKPOINT_FAILED,
          getErrorMessage(error),
          updateState,
        );
        return {
          status: "failed",
          code: OFFLINE_UPDATE_DIAGNOSTIC_CODES.CHECKPOINT_FAILED,
          state: failure,
        };
      }

      if (!checkpointResult.safe) {
        return {
          status: "deferred",
          code:
            checkpointResult.diagnosticCode ??
            OFFLINE_UPDATE_DIAGNOSTIC_CODES.UNSAFE_SESSION,
          state: updateState,
        };
      }

      try {
        await dependencies.assets.activateUpdate();
        let inspection: OfflineCacheInspection | undefined;
        try {
          inspection = await dependencies.assets.inspect();
        } catch {
          // Activation succeeded.  The available version is the only stable
          // version we can report when a post-activation inspection is absent.
        }

        const version =
          inspection?.status === "ready"
            ? inspection.version
            : updateState.availableVersion;
        const nextState: OfflineReadyState = { state: "offline-ready", version };
        publish(nextState);
        return { status: "activated", state: nextState };
      } catch (error: unknown) {
        const failure = fail(
          "activate",
          OFFLINE_UPDATE_DIAGNOSTIC_CODES.UPDATE_FAILED,
          getErrorMessage(error),
          updateState,
        );
        return {
          status: "failed",
          code: OFFLINE_UPDATE_DIAGNOSTIC_CODES.UPDATE_FAILED,
          state: failure,
        };
      }
    })();
    operation = work;
    try {
      return await work;
    } finally {
      operation = undefined;
    }
  };

  const retry = async (): Promise<OfflineUpdateState> => {
    if (state.state !== "failure" || state.failure.retryState === undefined) {
      return state;
    }

    const retryState = state.failure.retryState;
    publish(retryState);
    switch (retryState.state) {
      case "install":
        return install();
      case "update-ready": {
        await applyUpdate();
        return state;
      }
      case "offline-ready":
      case "failure":
        return state;
      default:
        return state;
    }
  };

  const applyInspection = (
    inspection: OfflineCacheInspection,
    previousState: OfflineUpdateState,
  ): OfflineUpdateState => {
    switch (inspection.status) {
      case "empty":
        return publish({
          state: "install",
          ...(inspection.targetVersion === undefined
            ? {}
            : { targetVersion: inspection.targetVersion }),
        });
      case "ready":
        return publish({ state: "offline-ready", version: inspection.version });
      case "update-ready":
        return publish({
          state: "update-ready",
          currentVersion: inspection.currentVersion,
          availableVersion: inspection.availableVersion,
        });
      default:
        return fail(
          "inspect",
          OFFLINE_UPDATE_DIAGNOSTIC_CODES.INSPECTION_FAILED,
          "The asset adapter returned an unknown cache state.",
          previousState,
        );
    }
  };

  const subscribe = (listener: (nextState: OfflineUpdateState) => void): (() => void) => {
    listeners.add(listener);
    return (): void => {
      listeners.delete(listener);
    };
  };

  return Object.freeze({
    getState: (): OfflineUpdateState => state,
    initialize,
    install,
    checkForUpdate,
    announceUpdate,
    applyUpdate,
    retry,
    subscribe,
  });
}

export const createOfflineUpdateCoordinatorWithPersistence =
  createOfflineUpdateCoordinator;

function getCurrentVersion(state: OfflineUpdateState): string | undefined {
  switch (state.state) {
    case "offline-ready":
      return state.version;
    case "update-ready":
      return state.currentVersion;
    case "install":
    case "failure":
      return undefined;
    default:
      return undefined;
  }
}

function recoveryActionsFor(
  operationName: OfflineUpdateFailureOperation,
): readonly OfflineRecoveryAction[] {
  if (operationName === "activate") {
    return Object.freeze([
      { id: "retry", label: "Retry update" },
      { id: "continue-offline", label: "Continue with current build" },
    ]);
  }

  return Object.freeze([
    { id: "retry", label: "Retry" },
    { id: "continue-offline", label: "Continue offline" },
  ]);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "The offline asset adapter reported an unspecified failure.";
}
