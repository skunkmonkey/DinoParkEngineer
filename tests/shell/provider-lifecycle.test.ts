import assert from "node:assert/strict";
import test from "node:test";

import {
  ProviderGraphValidationError,
  createProviderGraph,
  validateProviderDefinitions,
  createMemoryPersistencePort,
  type ProviderDefinition,
} from "../../src/shell/public.js";

test("provider validation returns deterministic dependency order", () => {
  const definitions: readonly ProviderDefinition[] = [
    { id: "ui", dependencies: ["config"], start: () => undefined },
    { id: "config", start: () => undefined },
    { id: "audio", dependencies: ["config"], start: () => undefined },
  ];

  const result = validateProviderDefinitions(definitions);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.order, ["config", "audio", "ui"]);
  }
});

test("provider validation reports missing dependencies and cycles", () => {
  const missing = validateProviderDefinitions([
    { id: "shell", dependencies: ["missing"], start: () => undefined },
  ]);
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.diagnostics[0]?.code, "SHELL_PROVIDER_DEPENDENCY_MISSING");
  }

  const cycle = validateProviderDefinitions([
    { id: "a", dependencies: ["b"], start: () => undefined },
    { id: "b", dependencies: ["a"], start: () => undefined },
  ]);
  assert.equal(cycle.ok, false);
  if (!cycle.ok) {
    assert.equal(
      cycle.diagnostics.some((diagnostic) =>
        diagnostic.code === "SHELL_PROVIDER_DEPENDENCY_CYCLE",
      ),
      true,
    );
  }

  assert.throws(
    () => createProviderGraph([{ id: "bad", dependencies: ["missing"], start: () => undefined }]),
    ProviderGraphValidationError,
  );
});

test("provider lifecycle starts deterministically and disposes once in reverse order", async () => {
  const events: string[] = [];
  const graph = createProviderGraph([
    {
      id: "consumer",
      dependencies: ["storage"],
      start: () => {
        events.push("start:consumer");
      },
      dispose: () => {
        events.push("dispose:consumer");
      },
    },
    {
      id: "storage",
      start: () => {
        events.push("start:storage");
      },
      dispose: () => {
        events.push("dispose:storage");
      },
    },
  ]);

  const firstStart = await graph.start();
  const secondStart = await graph.start();
  assert.equal(firstStart, secondStart);
  assert.deepEqual(events, ["start:storage", "start:consumer"]);

  await graph.dispose();
  await graph.dispose();
  assert.deepEqual(events, [
    "start:storage",
    "start:consumer",
    "dispose:consumer",
    "dispose:storage",
  ]);
});

test("optional provider failure is degraded while required failure blocks", async () => {
  const optionalGraph = createProviderGraph([
    {
      id: "optional",
      requirement: "optional",
      start: () => {
        throw new Error("optional unavailable");
      },
    },
    {
      id: "required",
      start: () => undefined,
    },
  ]);
  const optionalReport = await optionalGraph.start();
  assert.equal(optionalReport.state, "degraded");
  assert.deepEqual(optionalReport.started, ["required"]);

  const requiredGraph = createProviderGraph([
    {
      id: "required",
      start: () => {
        throw new Error("required unavailable");
      },
    },
    {
      id: "after",
      dependencies: ["required"],
      start: () => undefined,
    },
  ]);
  const requiredReport = await requiredGraph.start();
  assert.equal(requiredReport.state, "failed");
  assert.equal(requiredReport.failed[0]?.code, "SHELL_PROVIDER_START_FAILED");
});

test("persistence checkpoint is explicit and returns immutable projections", async () => {
  const persistence = createMemoryPersistencePort();
  persistence.markMutableSessionStatePending(true);
  const unsafe = await persistence.requestSafeCheckpoint({ reason: "activate-update" });
  assert.equal(unsafe.safe, false);

  const safe = await persistence.requestSafeCheckpoint({
    reason: "activate-update",
    confirmNoMutableSessionState: true,
  });
  assert.equal(safe.safe, true);
  assert.equal(Object.isFrozen(safe), true);
});
