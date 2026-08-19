import assert from "node:assert/strict";
import test from "node:test";

import {
  createMemoryOfflineAssetAdapter,
  createOfflineUpdateCoordinator,
  createMemoryPersistencePort,
} from "../../src/shell/public.js";

test("offline coordinator reports first install and offline-ready", async () => {
  const assets = createMemoryOfflineAssetAdapter({ version: "build-1" });
  const persistence = createMemoryPersistencePort();
  const coordinator = createOfflineUpdateCoordinator({
    assets,
    checkpoint: persistence,
  }, { targetVersion: "build-1" });

  assert.equal(coordinator.getState().state, "install");
  await coordinator.initialize();
  assert.equal(coordinator.getState().state, "install");
  const ready = await coordinator.install();
  assert.deepEqual(ready, { state: "offline-ready", version: "build-1" });
});

test("update activation defers over unsafe mutable session and activates at a checkpoint", async () => {
  const assets = createMemoryOfflineAssetAdapter({
    installed: true,
    version: "build-1",
    availableVersion: "build-2",
  });
  const persistence = createMemoryPersistencePort();
  persistence.markMutableSessionStatePending(true);
  const coordinator = createOfflineUpdateCoordinator({ assets, checkpoint: persistence });

  await coordinator.initialize();
  assert.equal(coordinator.getState().state, "update-ready");
  const deferred = await coordinator.applyUpdate();
  assert.equal(deferred.status, "deferred");
  assert.equal(coordinator.getState().state, "update-ready");

  const applied = await coordinator.applyUpdate({
    confirmNoMutableSessionState: true,
  });
  assert.equal(applied.status, "activated");
  assert.deepEqual(coordinator.getState(), {
    state: "offline-ready",
    version: "build-2",
  });
});

test("failed activation is visible and never silently replaces the current build", async () => {
  const assets = createMemoryOfflineAssetAdapter({
    installed: true,
    version: "build-1",
    availableVersion: "build-2",
    failActivation: true,
  });
  const persistence = createMemoryPersistencePort();
  const coordinator = createOfflineUpdateCoordinator({ assets, checkpoint: persistence });

  await coordinator.initialize();
  const result = await coordinator.applyUpdate();
  assert.equal(result.status, "failed");
  assert.equal(coordinator.getState().state, "failure");
  const failureState = coordinator.getState();
  if (failureState.state === "failure") {
    assert.equal(failureState.failure.code, "SHELL_OFFLINE_UPDATE_FAILED");
    assert.equal(
      failureState.failure.recoveryActions.some((action) => action.id === "retry"),
      true,
    );
    assert.equal(failureState.failure.retryState?.state, "update-ready");
  }
  assert.deepEqual(await assets.inspect(), {
    status: "update-ready",
    currentVersion: "build-1",
    availableVersion: "build-2",
  });
});
