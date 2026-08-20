import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalRuntimeBundleJson,
  compileRuntimeBundle,
  importCandidateToQuarantine,
  loadAssetBriefCatalog,
  recordCandidateReview,
  selectApprovedRuntimeInputs,
  validateCandidateCatalog,
  validateReviewCatalog,
  validateRuntimeBundle,
} from "../../src/rendering-assets/public.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const json = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const familyBriefs = await json("assets/briefs/mvp-families.json");
if (!Array.isArray(familyBriefs)) throw new Error("MVP family briefs must be an array.");
const briefs = [await json("assets/briefs/shared-three-quarter.json"), await json("assets/briefs/mvp-robot.json"), ...familyBriefs];
const briefCatalog = loadAssetBriefCatalog(briefs);
if (briefCatalog.status !== "ready" || briefCatalog.diagnostics.length > 0) throw new Error(`Brief validation failed: ${JSON.stringify(briefCatalog.diagnostics)}`);
const candidateFile = await json("assets/manifests/candidates.json"); const candidates = [];
for (const value of candidateFile.candidates) {
  const imported = importCandidateToQuarantine(value, await readFile(resolve(root, value.sourcePath)));
  if (!imported.ok) throw new Error(`Candidate import failed: ${JSON.stringify(imported.diagnostics)}`); candidates.push(imported.candidate);
}
const candidateCatalog = validateCandidateCatalog(candidates); if (!candidateCatalog.ok) throw new Error(JSON.stringify(candidateCatalog.diagnostics));
const reviewFile = await json("assets/manifests/reviews.json"); const reviews = [];
for (const value of reviewFile.reviews) {
  const candidate = candidates.find((item) => item.candidateId === value.candidateId && item.candidateVersion === value.candidateVersion);
  if (candidate === undefined) throw new Error(`Unknown reviewed candidate ${value.candidateId}.`);
  const result = recordCandidateReview(candidate, value); if (!result.ok) throw new Error(JSON.stringify(result.diagnostics)); reviews.push(result.review);
}
const reviewCatalog = validateReviewCatalog(reviews); if (!reviewCatalog.ok) throw new Error(JSON.stringify(reviewCatalog.diagnostics));
const approved = selectApprovedRuntimeInputs(candidateCatalog.candidates, reviewCatalog.reviews);
const layout = await json("assets/manifests/fixture-layout.json");
if (approved.length !== layout.assets.length || layout.assets.some((asset) => !approved.some((input) => input.runtimeAssetId === asset.assetId && input.sourceHash === asset.sourceHash))) throw new Error("Fixture layout must bind every and only exact approved runtime input hashes.");
const sourceBytes = await readFile(resolve(root, layout.sourcePath));
const darwin = compileRuntimeBundle(layout.assets, sourceBytes, "darwin"); const win32 = compileRuntimeBundle(layout.assets, sourceBytes, "win32");
const darwinJson = canonicalRuntimeBundleJson(darwin); const win32Json = canonicalRuntimeBundleJson(win32);
if (darwinJson !== win32Json) throw new Error("Canonical runtime bundle differs between darwin and win32 logical platform executions.");
const validation = validateRuntimeBundle(darwin, { production: true, expectedAssetIds: layout.assets.map((asset) => asset.assetId), expectedSourceHash: layout.sourceHash });
if (!validation.ok) throw new Error(`Runtime validation failed: ${JSON.stringify(validation.diagnostics)}`);
const output = resolve(root, "public/assets/mvp-park"); await mkdir(output, { recursive: true });
await copyFile(resolve(root, layout.sourcePath), resolve(output, "atlas.png"));
await writeFile(resolve(output, "atlas.json"), darwinJson);
await writeFile(resolve(output, "platform-comparison.json"), `${JSON.stringify({ schemaVersion: "1", logicalPlatforms: ["darwin", "win32"], byteEquivalentCanonicalManifest: true, canonicalFingerprint: darwin.canonicalFingerprint }, null, 2)}\n`);
console.log(`Compiled ${darwin.assets.length} approved runtime assets; darwin/win32 canonical outputs match ${darwin.canonicalFingerprint}.`);
