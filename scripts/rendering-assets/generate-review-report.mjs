import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateReviewReportHtml,
  importCandidateToQuarantine,
  loadAssetBriefCatalog,
  recordCandidateReview,
  validateCandidateCatalog,
  validateReviewCatalog,
} from "../../src/rendering-assets/public.ts";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const readJson = async (logicalPath) => JSON.parse(await readFile(resolve(repositoryRoot, logicalPath), "utf8"));
const result = loadAssetBriefCatalog(await Promise.all([
  readJson("assets/briefs/shared-three-quarter.json"),
  readJson("assets/briefs/mvp-robot.json"),
]));
if (result.status !== "ready" || result.diagnostics.length > 0) {
  throw new Error(`Asset brief validation failed: ${JSON.stringify(result.diagnostics)}`);
}
const candidateManifest = await readJson("assets/manifests/candidates.json");
if (candidateManifest === null || typeof candidateManifest !== "object" ||
    Object.keys(candidateManifest).sort().join(",") !== "candidates,manifestVersion" ||
    candidateManifest.manifestVersion !== "1" || !Array.isArray(candidateManifest.candidates)) {
  throw new Error("Candidate catalog must contain only manifestVersion 1 and a candidates array.");
}
const candidates = [];
for (const value of candidateManifest.candidates) {
  if (value === null || typeof value !== "object" || typeof value.sourcePath !== "string") {
    throw new Error("Candidate catalog entry is missing a sourcePath.");
  }
  const imported = importCandidateToQuarantine(value, await readFile(resolve(repositoryRoot, value.sourcePath)));
  if (!imported.ok) throw new Error(`Candidate import failed: ${JSON.stringify(imported.diagnostics)}`);
  candidates.push(imported.candidate);
}
const candidateCatalog = validateCandidateCatalog(candidates);
if (!candidateCatalog.ok) throw new Error(`Candidate catalog validation failed: ${JSON.stringify(candidateCatalog.diagnostics)}`);

const reviewManifest = await readJson("assets/manifests/reviews.json");
if (reviewManifest === null || typeof reviewManifest !== "object" ||
    Object.keys(reviewManifest).sort().join(",") !== "manifestVersion,reviews" ||
    reviewManifest.manifestVersion !== "1" || !Array.isArray(reviewManifest.reviews)) {
  throw new Error("Review catalog must contain only manifestVersion 1 and a reviews array.");
}
const reviews = [];
for (const value of reviewManifest.reviews) {
  if (value === null || typeof value !== "object" || typeof value.candidateId !== "string" || typeof value.candidateVersion !== "string") {
    throw new Error("Review catalog entry is missing a candidate identity.");
  }
  const candidate = candidates.find((entry) => entry.candidateId === value.candidateId && entry.candidateVersion === value.candidateVersion);
  if (candidate === undefined) throw new Error(`Review references unknown candidate ${value.candidateId}@${value.candidateVersion}.`);
  const recorded = recordCandidateReview(candidate, value);
  if (!recorded.ok) throw new Error(`Review validation failed: ${JSON.stringify(recorded.diagnostics)}`);
  reviews.push(recorded.review);
}
const reviewCatalog = validateReviewCatalog(reviews);
if (!reviewCatalog.ok) throw new Error(`Review catalog validation failed: ${JSON.stringify(reviewCatalog.diagnostics)}`);

const outputPath = resolve(repositoryRoot, "assets/manifests/review-report.html");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, generateReviewReportHtml(
  result.registry.queryByClass("AssetBrief"),
  candidateCatalog.candidates,
  reviewCatalog.reviews,
), "utf8");
console.log("Generated assets/manifests/review-report.html from validated briefs.");
