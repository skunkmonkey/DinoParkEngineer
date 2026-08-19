import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_REGISTRY_FOUNDATION_REFERENCES,
  createContentRegistry,
  createContentRegistryFoundationFixture,
  fingerprintCatalogPackage,
  promptDataSchema,
  type CatalogPackage,
  type ContentRecord,
} from "../../src/content-registry/public.js";

const sourceRecord = createContentRegistryFoundationFixture().getExact(
  CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt.id,
  CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt.version,
);
if (sourceRecord === undefined) throw new Error("The foundation Prompt fixture is missing.");
const promptRecord: ContentRecord = sourceRecord;
const signPackage = (value: Omit<CatalogPackage, "fingerprint">): CatalogPackage => ({ ...value, fingerprint: fingerprintCatalogPackage(value) });

const loadPath = (path: string) => {
  const entry = { ...promptRecord, dependencies: [], provenance: { ...promptRecord.provenance, path } };
  const unsigned = { packageId: "test:paths", packageVersion: "1", registrySchemaVersion: "1", requirement: "required" as const, entries: [entry] };
  return createContentRegistry({ registrySchemaVersion: "1", classDefinitions: [{ class: "Prompt", schemaVersion: "1", schema: promptDataSchema }] }).loadPackages([signPackage(unsigned)]);
};

test("accepts the same portable logical path on Windows and macOS runtimes", () => {
  assert.equal(loadPath("content/prompts/feed.json").status, "ready");
});

for (const path of ["content\\prompts\\feed.json", "C:/content/feed.json", "/content/feed.json", "content/../feed.json", "content//feed.json"]) {
  test(`rejects non-portable path ${path}`, () => {
    const result = loadPath(path);
    assert.equal(result.status, "blocked");
    assert.ok(result.diagnostics.some((entry) => entry.field === "provenance.path"));
  });
}
