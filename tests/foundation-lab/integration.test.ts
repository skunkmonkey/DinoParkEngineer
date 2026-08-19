import assert from "node:assert/strict";
import test from "node:test";

import {
  createRegistryLabProjection,
  createSimulationRegistryProof,
  runFoundationReplay,
} from "../../src/foundation-lab/integration.js";
import { createSimulation } from "../../src/simulation/public.js";

test("registry inspection preserves hidden history and isolates an invalid optional package", () => {
  const available = createRegistryLabProjection("1.0.0");
  const hidden = createRegistryLabProjection("2.0.0");
  assert.equal(available.selected.availability, "available");
  assert.equal(hidden.selected.availability, "hidden");
  assert.deepEqual(available.history.map((entry) => entry.version), ["1.0.0", "2.0.0"]);
  assert.ok(available.invalidDiagnostics.length > 0);
  assert.ok(available.invalidDiagnostics.every((entry) => entry.packageId === "park:invalid-inspector-fixture"));
});

test("an exact Simulation fixture loads through the registry and stays pinned after a newer version", () => {
  const proof = createSimulationRegistryProof();
  assert.equal(proof.fixture.scenario.version, "1.0.0");
  assert.equal(proof.newerVersion, "2.0.0");
  assert.equal(proof.pinnedFingerprintAfter, proof.pinnedFingerprintBefore);
  const projection = createSimulation(proof.fixture).project();
  assert.equal(projection.robots[0]?.id, "robot:alpha");
  assert.equal(projection.gates[0]?.position, "closed");
  assert.equal(Object.isFrozen(projection), true);
});

test("the integrated registry-loaded replay is exactly repeatable", () => {
  const proof = createSimulationRegistryProof();
  const first = runFoundationReplay(proof.fixture);
  const second = runFoundationReplay(proof.fixture);
  assert.deepEqual(second, first);
  assert.equal(first.state.dinosaurs[0]?.contained, false);
  assert.equal(first.state.visitors[0]?.safety, "casualty");
});
