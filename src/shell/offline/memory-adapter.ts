import type {
  OfflineAssetAdapter,
  OfflineCacheInspection,
} from "./contracts.js";

export interface MemoryOfflineAssetAdapterOptions {
  readonly version?: string;
  readonly availableVersion?: string;
  readonly installed?: boolean;
  readonly failInstall?: boolean;
  readonly failActivation?: boolean;
}

export interface MemoryOfflineAssetAdapter extends OfflineAssetAdapter {
  readonly setAvailableVersion: (version: string | undefined) => void;
  readonly setFailInstall: (failed: boolean) => void;
  readonly setFailActivation: (failed: boolean) => void;
}

/** Deterministic service-worker stand-in for unit and rendered shell tests. */
export function createMemoryOfflineAssetAdapter(
  options: MemoryOfflineAssetAdapterOptions = {},
): MemoryOfflineAssetAdapter {
  let installed = options.installed === true;
  let currentVersion = options.version ?? "";
  let availableVersion = options.availableVersion;
  let failInstall = options.failInstall === true;
  let failActivation = options.failActivation === true;

  const inspect = (): OfflineCacheInspection => {
    if (!installed) {
      return {
        status: "empty",
        ...(availableVersion === undefined
          ? {}
          : { targetVersion: availableVersion }),
      };
    }

    if (availableVersion !== undefined) {
      return {
        status: "update-ready",
        currentVersion,
        availableVersion,
      };
    }

    return { status: "ready", version: currentVersion };
  };

  const install = (): void => {
    if (failInstall) {
      throw new Error("Memory asset installation failed.");
    }

    installed = true;
    if (currentVersion.length === 0) {
      currentVersion = availableVersion ?? "dev-build";
    }
    if (availableVersion === currentVersion) {
      availableVersion = undefined;
    }
  };

  const activateUpdate = (): void => {
    if (failActivation) {
      throw new Error("Memory asset activation failed.");
    }

    if (availableVersion !== undefined) {
      currentVersion = availableVersion;
      availableVersion = undefined;
    }
  };

  const checkForUpdate = (): OfflineCacheInspection => inspect();

  return Object.freeze({
    inspect,
    install,
    activateUpdate,
    checkForUpdate,
    setAvailableVersion: (version: string | undefined): void => {
      const normalized = version?.trim();
      availableVersion = normalized === undefined || normalized.length === 0
        ? undefined
        : normalized;
    },
    setFailInstall: (failed: boolean): void => {
      failInstall = failed;
    },
    setFailActivation: (failed: boolean): void => {
      failActivation = failed;
    },
  });
}
