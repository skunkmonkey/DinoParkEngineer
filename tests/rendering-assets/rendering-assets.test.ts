import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContentRegistry, fingerprintCatalogPackage, type ContentRecord } from "../../src/content-registry/public.js";
import {
  assetBriefDataSchema,
  fingerprintSourceBytes,
  generateReviewReportHtml,
  importCandidateToQuarantine,
  loadAssetBriefCatalog,
  recordCandidateReview,
  selectApprovedRuntimeInputs,
  validateCandidateCatalog,
  validateReviewCatalog,
  type AssetCandidate,
  type CandidateReviewRecord,
  type ReviewDecision,
} from "../../src/rendering-assets/public.js";

const bytes = new TextEncoder().encode("deterministic candidate fixture");
const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const readJson = (logicalPath: string): unknown => JSON.parse(readFileSync(resolve(repositoryRoot, logicalPath), "utf8"));
const loadBuiltInAssetBriefCatalog = () => loadAssetBriefCatalog([
  readJson("assets/briefs/shared-three-quarter.json"),
  readJson("assets/briefs/mvp-robot.json"),
]);
const candidateManifest = {
  candidateId: "assets-candidate:mvp-robot-a",
  candidateVersion: "1.0.0",
  sourceId: "assets-source:mvp-robot-a",
  sourceVersion: "1.0.0",
  briefId: "assets:brief-mvp-park-robot",
  briefVersion: "1.0.0",
  runtimeAssetId: "assets:robot-park-worker",
  runtimeAssetVersion: "1.0.0",
  bundleId: "assets:bundle-mvp-park",
  bundleVersion: "1.0.0",
  sourcePath: "assets/source/mvp-robot-a.png",
  sourceHash: fingerprintSourceBytes(bytes),
  model: { alias: "openai-image", snapshot: "image-model-snapshot" },
  promptRevision: "1.0.0",
  referenceInputs: [],
  generationParameters: { background: "transparent", quality: "high", seedLabel: 1 },
  createdAt: "2026-08-19T12:00:00.000Z",
  lineage: { operation: "original" as const },
  rightsUsage: { owner: "Dino Park Engineer", license: "project-use", allowedUse: "game rendering source" },
  quarantine: "unapproved" as const,
};

const importedCandidate = (): AssetCandidate => {
  const result = importCandidateToQuarantine(candidateManifest, bytes);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture candidate failed validation");
  return result.candidate;
};

const reviewValue = (decision: ReviewDecision, overrides: Readonly<Record<string, unknown>> = {}) => ({
  reviewId: `asset-review:mvp-robot-${decision}`,
  reviewVersion: "1.0.0",
  candidateId: candidateManifest.candidateId,
  candidateVersion: candidateManifest.candidateVersion,
  sourceId: candidateManifest.sourceId,
  selectedSourceVersion: candidateManifest.sourceVersion,
  sourceHash: candidateManifest.sourceHash,
  reviewer: "Human Art Reviewer",
  decision,
  decidedAt: "2026-08-19T13:00:00.000Z",
  notes: `Explicit ${decision} fixture decision.`,
  ...(decision === "superseded" ? { supersededBy: { candidateId: "assets-candidate:mvp-robot-b", candidateVersion: "1.0.0" } } : {}),
  ...overrides,
});

test("validates the shared art direction and complete MVP robot brief through the Content Registry", () => {
  const result = loadBuiltInAssetBriefCatalog();
  assert.equal(result.status, "ready");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.registry.queryByClass("AssetBrief").map((brief) => `${brief.id}@${brief.version}`), [
    "assets:brief-mvp-park-robot@1.0.0",
  ]);
  const resolution = result.registry.resolveExact("assets:brief-mvp-park-robot", "1.0.0");
  assert.equal(resolution.ok, true);
  if (resolution.ok) {
    assert.deepEqual(resolution.manifest.dependencies.map((record) => record.id), ["assets:three-quarter-art-direction"]);
  }
});

test("rejects missing views, anchors, variants, unsafe bounds, and non-portable brief paths", () => {
  const builtIn = loadBuiltInAssetBriefCatalog();
  assert.equal(builtIn.status, "ready");
  const brief = builtIn.registry.getExact("assets:brief-mvp-park-robot", "1.0.0");
  assert.ok(brief);
  const data = brief.data as Record<string, unknown>;
  const invalidRecord: ContentRecord = {
    ...brief,
    id: "assets:invalid-brief",
    data: {
      ...data,
      requiredViews: [],
      safeBounds: { x: 500, y: 500, width: 50, height: 50 },
      variants: [],
      pivot: undefined,
    },
  };
  const unsigned = { packageId: "assets:invalid-brief-package", packageVersion: "1", registrySchemaVersion: "1", requirement: "required" as const, entries: [invalidRecord] };
  const result = createContentRegistry({
    registrySchemaVersion: "1",
    classDefinitions: [{ class: "AssetBrief", schemaVersion: "1", schema: assetBriefDataSchema }],
  }).loadPackages([{ ...unsigned, fingerprint: fingerprintCatalogPackage(unsigned) }]);
  assert.equal(result.status, "blocked");
  const fields = result.diagnostics.map((diagnostic) => diagnostic.field);
  assert.ok(fields.some((field) => field.includes("requiredViews")));
  assert.ok(fields.some((field) => field.includes("pivot")));
  assert.ok(fields.some((field) => field.includes("variants")));

  const invalidPath = { ...invalidRecord, provenance: { ...invalidRecord.provenance, path: "assets\\briefs\\invalid.json" }, data: brief.data };
  const pathUnsigned = { ...unsigned, packageId: "assets:invalid-path-package", entries: [invalidPath] };
  const pathResult = createContentRegistry({
    registrySchemaVersion: "1",
    classDefinitions: [{ class: "AssetBrief", schemaVersion: "1", schema: assetBriefDataSchema }],
  }).loadPackages([{ ...pathUnsigned, fingerprint: fingerprintCatalogPackage(pathUnsigned) }]);
  assert.ok(pathResult.diagnostics.some((diagnostic) => diagnostic.field === "provenance.path"));
});

test("imports exact candidate bytes into immutable quarantine with complete provenance", () => {
  const candidate = importedCandidate();
  assert.equal(candidate.quarantine, "unapproved");
  assert.equal(candidate.model.snapshot, "image-model-snapshot");
  assert.equal(candidate.briefVersion, "1.0.0");
  assert.equal(Object.isFrozen(candidate), true);
  assert.equal(Object.isFrozen(candidate.generationParameters), true);
  assert.throws(() => {
    (candidate as { quarantine: string }).quarantine = "approved";
  }, TypeError);
});

test("rejects changed bytes, missing model identity, incomplete lineage, and secret-bearing manifests", () => {
  const changed = importCandidateToQuarantine(candidateManifest, new TextEncoder().encode("changed"));
  assert.equal(changed.ok, false);
  if (!changed.ok) assert.equal(changed.diagnostics[0]?.code, "ASSET_CANDIDATE_HASH_MISMATCH");

  const noModel = importCandidateToQuarantine({ ...candidateManifest, model: { alias: "" } }, bytes);
  assert.equal(noModel.ok, false);
  const brokenLineage = importCandidateToQuarantine({ ...candidateManifest, lineage: { operation: "edit", parentCandidateId: "assets-candidate:parent" } }, bytes);
  assert.equal(brokenLineage.ok, false);
  const secret = importCandidateToQuarantine({
    ...candidateManifest,
    generationParameters: { apiKey: "sk-this-must-never-enter-a-manifest" },
  }, bytes);
  assert.equal(secret.ok, false);
  if (!secret.ok) assert.equal(secret.diagnostics[0]?.code, "ASSET_CANDIDATE_SECRET_REJECTED");
});

test("rejects duplicate and case-colliding candidate identities", () => {
  const candidate = importedCandidate();
  const duplicate = validateCandidateCatalog([candidate, candidate]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.diagnostics[0]?.code, "ASSET_CANDIDATE_DUPLICATE");
  const caseCollision = validateCandidateCatalog([
    candidate,
    { ...candidate, candidateId: "ASSETS-CANDIDATE:MVP-ROBOT-A" },
  ]);
  assert.equal(caseCollision.ok, false);
});

test("records all explicit immutable review decisions against exact candidate bytes", () => {
  const candidate = importedCandidate();
  for (const decision of ["approved", "rejected", "request-revision", "superseded"] as const) {
    const result = recordCandidateReview(candidate, reviewValue(decision));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(Object.isFrozen(result.review), true);
  }
  const wrongHash = recordCandidateReview(candidate, reviewValue("approved", { sourceHash: "fnv1a64:0000000000000000" }));
  assert.equal(wrongHash.ok, false);
  const secret = recordCandidateReview(candidate, reviewValue("approved", { notes: "Bearer a-secret-token-value" }));
  assert.equal(secret.ok, false);
  if (!secret.ok) assert.equal(secret.diagnostics[0]?.code, "ASSET_MANIFEST_SECRET_REJECTED");
});

test("rejects duplicate review identities and keeps an ambiguous catalog out of runtime inputs", () => {
  const candidate = importedCandidate();
  const approval = recordCandidateReview(candidate, reviewValue("approved"));
  const rejection = recordCandidateReview(candidate, reviewValue("rejected", {
    reviewId: "asset-review:mvp-robot-approved",
  }));
  assert.equal(approval.ok, true); assert.equal(rejection.ok, true);
  if (!approval.ok || !rejection.ok) return;
  const catalog = validateReviewCatalog([approval.review, rejection.review]);
  assert.equal(catalog.ok, false);
  assert.deepEqual(selectApprovedRuntimeInputs([candidate], [approval.review, rejection.review]), []);
});

test("unapproved, rejected, requested-revision, superseded, or hash-mismatched candidates cannot enter runtime inputs", () => {
  const candidate = importedCandidate();
  assert.deepEqual(selectApprovedRuntimeInputs([candidate], []), []);
  for (const decision of ["rejected", "request-revision", "superseded"] as const) {
    const recorded = recordCandidateReview(candidate, reviewValue(decision));
    assert.equal(recorded.ok, true);
    if (recorded.ok) assert.deepEqual(selectApprovedRuntimeInputs([candidate], [recorded.review]), []);
  }
  const approved = recordCandidateReview(candidate, reviewValue("approved"));
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.deepEqual(selectApprovedRuntimeInputs([candidate], [approved.review]), [{
    runtimeAssetId: "assets:robot-park-worker",
    runtimeAssetVersion: "1.0.0",
    bundleId: "assets:bundle-mvp-park",
    bundleVersion: "1.0.0",
    sourceId: "assets-source:mvp-robot-a",
    sourceVersion: "1.0.0",
    sourcePath: "assets/source/mvp-robot-a.png",
    sourceHash: candidate.sourceHash,
    briefId: "assets:brief-mvp-park-robot",
    briefVersion: "1.0.0",
    approvalReviewId: "asset-review:mvp-robot-approved",
    approvalReviewVersion: "1.0.0",
  }]);

  const laterSuperseded = recordCandidateReview(candidate, reviewValue("superseded", {
    decidedAt: "2026-08-19T14:00:00.000Z",
  }));
  assert.equal(laterSuperseded.ok, true);
  if (laterSuperseded.ok) assert.deepEqual(selectApprovedRuntimeInputs([candidate], [approved.review, laterSuperseded.review]), []);

  const alteredCandidate = { ...candidate, sourceHash: "fnv1a64:0000000000000000" } as AssetCandidate;
  assert.deepEqual(selectApprovedRuntimeInputs([alteredCandidate], [approved.review]), []);
});

test("generates a deterministic escaped human review contact sheet and checklist", () => {
  const builtIn = loadBuiltInAssetBriefCatalog();
  assert.equal(builtIn.status, "ready");
  const candidate = importedCandidate();
  const report = generateReviewReportHtml(builtIn.registry.queryByClass("AssetBrief"), [candidate], []);
  assert.equal(report, generateReviewReportHtml(builtIn.registry.queryByClass("AssetBrief"), [candidate], []));
  assert.match(report, /Human review required/u);
  assert.match(report, /Acceptance checklist/u);
  assert.match(report, /quarantined until an exact hash-bound approval/u);
  assert.match(report, /awaiting review/u);
  assert.match(report, /<img src="\.\.\/source\/mvp-robot-a\.png"/u);
  assert.doesNotMatch(report, /sk-this-must-never/u);
});

test("runtime input ordering is stable across candidate enumeration order", () => {
  const first = importedCandidate();
  const secondBytes = new TextEncoder().encode("candidate b");
  const secondResult = importCandidateToQuarantine({
    ...candidateManifest,
    candidateId: "assets-candidate:mvp-robot-b",
    sourceId: "assets-source:mvp-robot-b",
    runtimeAssetId: "assets:robot-park-worker-b",
    sourcePath: "assets/source/mvp-robot-b.png",
    sourceHash: fingerprintSourceBytes(secondBytes),
  }, secondBytes);
  assert.equal(secondResult.ok, true);
  if (!secondResult.ok) return;
  const approval = recordCandidateReview(first, reviewValue("approved"));
  const secondApproval = recordCandidateReview(secondResult.candidate, {
    ...reviewValue("approved"),
    reviewId: "asset-review:mvp-robot-b-approved",
    candidateId: secondResult.candidate.candidateId,
    sourceId: secondResult.candidate.sourceId,
    sourceHash: secondResult.candidate.sourceHash,
  });
  assert.equal(approval.ok, true); assert.equal(secondApproval.ok, true);
  if (!approval.ok || !secondApproval.ok) return;
  const reviews: readonly CandidateReviewRecord[] = [approval.review, secondApproval.review];
  assert.deepEqual(
    selectApprovedRuntimeInputs([secondResult.candidate, first], reviews),
    selectApprovedRuntimeInputs([first, secondResult.candidate], reviews),
  );
});
