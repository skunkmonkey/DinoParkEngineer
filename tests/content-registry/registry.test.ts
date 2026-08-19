import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  canonicalSerialize,
  CONTENT_REGISTRY_FOUNDATION_REFERENCES,
  createContentRegistry,
  createContentRegistryFoundationFixture,
  createInvalidContentRegistryFoundationPackage,
  fingerprint,
  fingerprintCatalogPackage,
  promptDataSchema,
  type CatalogPackage,
  type ContentRecord,
} from "../../src/content-registry/public.js";

const definitions = ["Prompt", "Skill", "Policy"].map((contentClass) => ({ class: contentClass, schemaVersion: "1", schema: promptDataSchema }));
const emptyRegistry = () => createContentRegistry({ registrySchemaVersion: "1", classDefinitions: definitions });
const loadedRegistry = () => createContentRegistryFoundationFixture();
const requireFoundationRecord = (reference: { readonly id: string; readonly version: string }): ContentRecord => {
  const record = loadedRegistry().getExact(reference.id, reference.version);
  if (record === undefined) throw new Error(`Missing foundation record ${reference.id}@${reference.version}.`);
  return record;
};
const policyRecord = requireFoundationRecord(CONTENT_REGISTRY_FOUNDATION_REFERENCES.policy);
const promptRecord = requireFoundationRecord(CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt);
const skillRecord = requireFoundationRecord(CONTENT_REGISTRY_FOUNDATION_REFERENCES.skill);
const signPackage = (value: Omit<CatalogPackage, "fingerprint">): CatalogPackage => ({ ...value, fingerprint: fingerprintCatalogPackage(value) });
const packageWith = (entries: readonly unknown[], requirement: "required" | "optional" = "required", packageId = "test:package"): CatalogPackage => signPackage({ packageId, packageVersion: "1", registrySchemaVersion: "1", requirement, entries });
const basePackage = signPackage({ packageId: "park:base-content", packageVersion: "1.0.0", registrySchemaVersion: "1", requirement: "required", entries: [policyRecord, skillRecord, promptRecord] });

test("loads a validated Prompt atomically and exposes one consistent inspection projection", () => {
  const registry = loadedRegistry();
  assert.deepEqual(registry.inspect(promptRecord.id, promptRecord.version), {
    identity: "park:feed-triceratops",
    contentClass: "Prompt",
    version: "1.0.0",
    schemaVersion: "1",
    displayName: "Feed the Triceratops",
    author: "Park Developer",
    dependencies: ["park:containment-policy@1.0.0", "park:safe-feeding@1.0.0"],
    contextCost: 8,
    sourceProvenance: "built-in:content/prompts/feed-triceratops.json",
    availability: "available",
    readableSource: promptRecord.readableSource,
  });
  assert.equal(Object.isFrozen(registry.getExact(promptRecord.id, promptRecord.version)), true);
  assert.equal(Object.isFrozen(registry.queryByClass("Prompt")), true);
  assert.throws(() => {
    (registry.getExact(promptRecord.id, promptRecord.version)?.provenance as { path: string }).path = "changed.json";
  }, TypeError);
  assert.equal(registry.getExact(promptRecord.id, promptRecord.version)?.provenance.path, promptRecord.provenance.path);
});

test("resolves an exact dependency-first manifest with a stable canonical fingerprint", () => {
  const registry = loadedRegistry();
  const first = registry.resolveExact(promptRecord.id, promptRecord.version);
  const second = registry.resolveExact(promptRecord.id, promptRecord.version);
  assert.equal(first.ok, true); assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.manifest.dependencies.map((record) => `${record.id}@${record.version}`), [
    "park:containment-policy@1.0.0",
    "park:safe-feeding@1.0.0",
  ]);
  assert.equal(first.manifest.fingerprint, "fnv1a64:f5d9489dc36240c0");
  assert.equal(first.manifest.fingerprint, second.manifest.fingerprint);
  assert.match(first.manifest.fingerprint, /^fnv1a64:[0-9a-f]{16}$/u);
  assert.equal(canonicalSerialize({ z: 1, a: { y: 2, x: 3 } }), '{"a":{"x":3,"y":2},"z":1}');
  assert.equal(fingerprint({ a: 1 }), fingerprint({ a: 1 }));

  const changedPrompt: ContentRecord = { ...promptRecord, id: "park:changed-dependencies", dependencies: [{ id: policyRecord.id, version: policyRecord.version }] };
  const changedLoad = registry.loadPackages([packageWith([changedPrompt], "optional", "park:changed-graph")]);
  assert.equal(changedLoad.status, "ready");
  const changed = changedLoad.registry.resolveExact(changedPrompt.id, changedPrompt.version);
  assert.equal(changed.ok, true);
  if (changed.ok) assert.notEqual(changed.manifest.fingerprint, first.manifest.fingerprint);
});

test("adding a newer hidden version cannot mutate or float historical resolution", () => {
  const original = loadedRegistry();
  const prior = original.resolveExact(promptRecord.id, promptRecord.version);
  assert.equal(prior.ok, true);
  const newer: ContentRecord = { ...promptRecord, version: "3.0.0", displayName: "Feed the Triceratops (third revision)", availability: "hidden", readableSource: "Third source revision." };
  const extended = original.loadPackages([packageWith([newer], "optional", "park:history")]);
  assert.equal(extended.status, "ready");
  const historical = extended.registry.resolveExact(promptRecord.id, promptRecord.version);
  assert.deepEqual(historical, prior);
  assert.equal(original.getExact(promptRecord.id, "3.0.0"), undefined);
  assert.deepEqual(extended.registry.history(promptRecord.id).map((record) => record.version), ["1.0.0", "2.0.0", "3.0.0"]);
  assert.deepEqual(extended.registry.queryByAvailability("hidden").map((record) => record.version), ["2.0.0", "3.0.0"]);
  assert.equal(extended.registry.getExact(promptRecord.id, "3.0.0")?.availability, "hidden");
});

test("queries use exact versions and stable identity/version ordering", () => {
  const registry = loadedRegistry();
  assert.deepEqual(registry.queryByTag("safety").map((record) => record.id), [policyRecord.id, skillRecord.id]);
  assert.deepEqual(registry.queryByDependency({ id: policyRecord.id, version: policyRecord.version }).map((record) => `${record.id}@${record.version}`), ["park:feed-triceratops@1.0.0", "park:feed-triceratops@2.0.0", "park:safe-feeding@1.0.0"]);
  assert.deepEqual(registry.queryByClass("Policy").map((record) => record.id), [policyRecord.id]);
  assert.equal("getNewest" in registry, false);
  assert.equal(registry.resolveExact(promptRecord.id, "latest").ok, false);
});

test("malformed and duplicate records fail atomically with stable diagnostics", () => {
  const malformed = { ...promptRecord, id: "not-namespaced", extra: true };
  const duplicate = { ...policyRecord };
  const result = loadedRegistry().loadPackages([packageWith([malformed, duplicate])]);
  assert.equal(result.status, "blocked");
  assert.equal(result.registry.getExact(duplicate.id, duplicate.version)?.displayName, policyRecord.displayName);
  assert.deepEqual(result.diagnostics.map((entry) => entry.code), [...result.diagnostics].sort((a, b) => [a.packageId, a.source, a.record ?? "", a.field, a.code, a.message].join("\0").localeCompare([b.packageId, b.source, b.record ?? "", b.field, b.code, b.message].join("\0"), "en", { sensitivity: "variant" })).map((entry) => entry.code));
  assert.ok(result.diagnostics.some((entry) => entry.code === "REGISTRY_RECORD_VALIDATION_FAILED" && entry.field === "id"));
  assert.ok(result.diagnostics.some((entry) => entry.code === "REGISTRY_IDENTITY_DUPLICATE"));
  assert.equal(result.registry.getExact("not-namespaced", "1.0.0"), undefined);
});

test("optional package failure is isolated while required failure blocks every new commit", () => {
  const invalidOptional = createInvalidContentRegistryFoundationPackage();
  const validOptional = packageWith([{ ...promptRecord, id: "park:optional-prompt" }], "optional", "park:valid-option");
  const optional = loadedRegistry().loadPackages([invalidOptional, validOptional]);
  assert.equal(optional.status, "ready");
  assert.ok(optional.diagnostics.length > 0);
  assert.ok(optional.registry.getExact("park:optional-prompt", "1.0.0"));

  const invalidRequired = packageWith([{ ...promptRecord, id: "bad" }], "required", "park:required-failure");
  const blocked = loadedRegistry().loadPackages([validOptional, invalidRequired]);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.registry.getExact("park:optional-prompt", "1.0.0"), undefined);
});

test("rejects record, path, and package case collisions plus duplicate package identity", () => {
  const recordCollision: ContentRecord = {
    ...promptRecord,
    id: "PARK:FEED-TRICERATOPS",
    provenance: { ...promptRecord.provenance, path: "Content/Prompts/Feed-Triceratops.json" },
  };
  const collision = loadedRegistry().loadPackages([packageWith([recordCollision], "optional", "park:collision")]);
  assert.ok(collision.diagnostics.some((entry) => entry.code === "REGISTRY_CASE_COLLISION"));
  assert.ok(collision.diagnostics.some((entry) => entry.code === "REGISTRY_PATH_CASE_COLLISION"));

  const duplicatePackage = loadedRegistry().loadPackages([basePackage]);
  assert.equal(duplicatePackage.status, "blocked");
  assert.ok(duplicatePackage.diagnostics.some((entry) => entry.code === "REGISTRY_IDENTITY_DUPLICATE" && entry.field === "packageId/packageVersion"));
});

test("detects missing, cyclic, conflicting, and incompatible exact dependencies", () => {
  const missing: ContentRecord = { ...promptRecord, id: "test:missing", dependencies: [{ id: "test:nope", version: "1" }] };
  const cycleA: ContentRecord = { ...policyRecord, id: "test:cycle-a", dependencies: [{ id: "test:cycle-b", version: "1" }], version: "1" };
  const cycleB: ContentRecord = { ...policyRecord, id: "test:cycle-b", dependencies: [{ id: "test:cycle-a", version: "1" }], version: "1" };
  const incompatible: ContentRecord = { ...promptRecord, id: "test:incompatible", dependencies: [{ id: policyRecord.id, version: policyRecord.version, expectedClass: "Skill" }] };
  const policyV2: ContentRecord = { ...policyRecord, version: "2" };
  const left: ContentRecord = { ...skillRecord, id: "test:left", version: "1", dependencies: [{ id: policyRecord.id, version: "1.0.0" }] };
  const right: ContentRecord = { ...skillRecord, id: "test:right", version: "1", dependencies: [{ id: policyRecord.id, version: "2" }] };
  const conflict: ContentRecord = { ...promptRecord, id: "test:conflict", version: "1", dependencies: [{ id: left.id, version: "1" }, { id: right.id, version: "1" }] };
  const result = loadedRegistry().loadPackages([packageWith([cycleA, cycleB, incompatible, left, missing, policyV2, conflict, right])]);
  assert.equal(result.status, "blocked");
  const codes = new Set(result.diagnostics.map((entry) => entry.code));
  assert.ok(codes.has("REGISTRY_DEPENDENCY_MISSING"));
  assert.ok(codes.has("REGISTRY_DEPENDENCY_CYCLE"));
  assert.ok(codes.has("REGISTRY_DEPENDENCY_CONFLICT"));
  assert.ok(codes.has("REGISTRY_DEPENDENCY_INCOMPATIBLE"));
});

test("rejects bad fingerprints, schema mismatches, unknown class schemas, and invalid class data", () => {
  const badFingerprint = { ...basePackage, fingerprint: "fnv1a64:0000000000000000" };
  assert.ok(emptyRegistry().loadPackages([badFingerprint]).diagnostics.some((entry) => entry.code === "REGISTRY_PACKAGE_FINGERPRINT_MISMATCH"));
  const schemaMismatch = signPackage({ packageId: basePackage.packageId, packageVersion: basePackage.packageVersion, registrySchemaVersion: "2", requirement: basePackage.requirement, entries: basePackage.entries });
  assert.ok(emptyRegistry().loadPackages([schemaMismatch]).diagnostics.some((entry) => entry.code === "REGISTRY_PACKAGE_SCHEMA_INCOMPATIBLE"));
  const unknown = packageWith([{ ...promptRecord, class: "Unknown" }]);
  assert.ok(emptyRegistry().loadPackages([unknown]).diagnostics.some((entry) => entry.code === "REGISTRY_CLASS_SCHEMA_MISSING"));
  const badData = packageWith([{ ...promptRecord, data: { purpose: "" } }]);
  assert.ok(emptyRegistry().loadPackages([badData]).diagnostics.some((entry) => entry.field.startsWith("data")));
});

test("class schema catalog is extensible without changing the registry query API", () => {
  const registry = createContentRegistry({ registrySchemaVersion: "1", classDefinitions: [{ class: "Tool", schemaVersion: "1", schema: z.strictObject({ capability: z.string() }) }] });
  const tool: ContentRecord = { ...policyRecord, id: "park:gate-tool", class: "Tool", data: { capability: "close-gate" } };
  const result = registry.loadPackages([packageWith([tool])]);
  assert.equal(result.status, "ready");
  assert.equal(result.registry.queryByClass("Tool")[0]?.id, tool.id);
});
