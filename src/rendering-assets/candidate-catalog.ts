import { fingerprint } from "../content-registry/public.js";
import { assetCandidateSchema, candidateReviewRecordSchema } from "./schemas.js";
import type {
  AssetCandidate,
  CandidateCatalogResult,
  CandidateImportResult,
  CandidateReviewRecord,
  RenderingAssetDiagnostic,
  ReviewRecordResult,
  ReviewCatalogResult,
  RuntimeBundleInput,
} from "./types.js";

const freeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const fingerprintSourceBytes = (bytes: Uint8Array): string => fingerprint([...bytes]);

const secretKeyPattern = /(?:api[-_]?key|authorization|bearer|password|secret|token)/iu;
const secretValuePattern = /(?:sk-[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._-]{12,})/iu;

const secretPaths = (value: unknown, path = "$", output: string[] = []): readonly string[] => {
  if (typeof value === "string" && secretValuePattern.test(value)) output.push(path);
  if (Array.isArray(value)) value.forEach((entry, index) => secretPaths(entry, `${path}[${index}]`, output));
  else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (secretKeyPattern.test(key)) output.push(childPath);
      secretPaths(entry, childPath, output);
    }
  }
  return output;
};

const invalidDiagnostics = (issues: readonly { readonly path: PropertyKey[]; readonly message: string }[]): readonly RenderingAssetDiagnostic[] =>
  issues.map((issue) => ({ code: "ASSET_CANDIDATE_INVALID", field: issue.path.join("."), message: issue.message }));

export const importCandidateToQuarantine = (manifest: unknown, sourceBytes: Uint8Array): CandidateImportResult => {
  const secrets = secretPaths(manifest);
  if (secrets.length > 0) {
    return {
      ok: false,
      diagnostics: freeze(secrets.map((field) => ({
        code: "ASSET_CANDIDATE_SECRET_REJECTED" as const,
        field,
        message: "Candidate manifests must not contain credentials or secret-bearing fields.",
      }))),
    };
  }
  const parsed = assetCandidateSchema.safeParse(manifest);
  if (!parsed.success) return { ok: false, diagnostics: freeze(invalidDiagnostics(parsed.error.issues)) };
  const actualHash = fingerprintSourceBytes(sourceBytes);
  if (actualHash !== parsed.data.sourceHash) {
    return { ok: false, diagnostics: freeze([{
      code: "ASSET_CANDIDATE_HASH_MISMATCH",
      field: "sourceHash",
      message: `Manifest hash ${parsed.data.sourceHash} does not match imported bytes ${actualHash}.`,
    }]) };
  }
  return { ok: true, candidate: freeze(structuredClone(parsed.data)) };
};

const compareCandidate = (left: AssetCandidate, right: AssetCandidate): number =>
  `${left.candidateId}\u0000${left.candidateVersion}`.localeCompare(
    `${right.candidateId}\u0000${right.candidateVersion}`,
    "en",
    { sensitivity: "variant" },
  );

export const validateCandidateCatalog = (candidates: readonly AssetCandidate[]): CandidateCatalogResult => {
  const identities = new Map<string, string>();
  const diagnostics: RenderingAssetDiagnostic[] = [];
  for (const candidate of [...candidates].sort(compareCandidate)) {
    const exact = `${candidate.candidateId}@${candidate.candidateVersion}`;
    const portable = exact.toLocaleLowerCase("en-US");
    const prior = identities.get(portable);
    if (prior !== undefined) diagnostics.push({
      code: "ASSET_CANDIDATE_DUPLICATE",
      field: "candidateId/candidateVersion",
      message: prior === exact ? `Duplicate candidate identity ${exact}.` : `${exact} collides by case with ${prior}.`,
    });
    else identities.set(portable, exact);
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics: freeze(diagnostics) };
  return { ok: true, candidates: freeze([...candidates].sort(compareCandidate)) };
};

export const recordCandidateReview = (candidate: AssetCandidate, value: unknown): ReviewRecordResult => {
  const secrets = secretPaths(value);
  if (secrets.length > 0) return { ok: false, diagnostics: freeze(secrets.map((field) => ({
    code: "ASSET_MANIFEST_SECRET_REJECTED" as const,
    field,
    message: "Review manifests must not contain credentials or secrets.",
  }))) };
  const parsed = candidateReviewRecordSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, diagnostics: freeze(parsed.error.issues.map((issue) => ({
      code: "ASSET_REVIEW_INVALID" as const,
      field: issue.path.join("."),
      message: issue.message,
    }))) };
  }
  const review = parsed.data;
  const matches = review.candidateId === candidate.candidateId &&
    review.candidateVersion === candidate.candidateVersion &&
    review.sourceId === candidate.sourceId &&
    review.selectedSourceVersion === candidate.sourceVersion &&
    review.sourceHash === candidate.sourceHash;
  if (!matches) return { ok: false, diagnostics: freeze([{
    code: "ASSET_REVIEW_INVALID",
    field: "candidate/source identity",
    message: "Review must bind the candidate, selected source version, and exact source hash.",
  }]) };
  return { ok: true, review: freeze(structuredClone(review)) };
};

const identity = (candidateId: string, candidateVersion: string): string => `${candidateId}\u0000${candidateVersion}`;
const compareReview = (left: CandidateReviewRecord, right: CandidateReviewRecord): number =>
  `${left.decidedAt}\u0000${left.reviewId}\u0000${left.reviewVersion}`.localeCompare(
    `${right.decidedAt}\u0000${right.reviewId}\u0000${right.reviewVersion}`,
    "en",
    { sensitivity: "variant" },
  );

export const validateReviewCatalog = (reviews: readonly CandidateReviewRecord[]): ReviewCatalogResult => {
  const identities = new Map<string, string>();
  const diagnostics: RenderingAssetDiagnostic[] = [];
  for (const review of [...reviews].sort(compareReview)) {
    const exact = `${review.reviewId}@${review.reviewVersion}`;
    const portable = exact.toLocaleLowerCase("en-US");
    const prior = identities.get(portable);
    if (prior !== undefined) diagnostics.push({
      code: "ASSET_REVIEW_INVALID",
      field: "reviewId/reviewVersion",
      message: prior === exact ? `Duplicate review identity ${exact}.` : `${exact} collides by case with ${prior}.`,
    });
    else identities.set(portable, exact);
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics: freeze(diagnostics) };
  return { ok: true, reviews: freeze([...reviews].sort(compareReview)) };
};

export const selectApprovedRuntimeInputs = (
  candidates: readonly AssetCandidate[],
  reviews: readonly CandidateReviewRecord[],
): readonly RuntimeBundleInput[] => {
  if (!validateCandidateCatalog(candidates).ok || !validateReviewCatalog(reviews).ok) return freeze([]);
  const latestReviews = new Map<string, CandidateReviewRecord>();
  for (const review of [...reviews].sort(compareReview)) latestReviews.set(identity(review.candidateId, review.candidateVersion), review);
  const inputs = candidates.flatMap((candidate): RuntimeBundleInput[] => {
    const review = latestReviews.get(identity(candidate.candidateId, candidate.candidateVersion));
    if (review?.decision !== "approved" || review.sourceHash !== candidate.sourceHash ||
        review.sourceId !== candidate.sourceId || review.selectedSourceVersion !== candidate.sourceVersion) return [];
    return [{
      runtimeAssetId: candidate.runtimeAssetId,
      runtimeAssetVersion: candidate.runtimeAssetVersion,
      bundleId: candidate.bundleId,
      bundleVersion: candidate.bundleVersion,
      sourceId: candidate.sourceId,
      sourceVersion: candidate.sourceVersion,
      sourcePath: candidate.sourcePath,
      sourceHash: candidate.sourceHash,
      briefId: candidate.briefId,
      briefVersion: candidate.briefVersion,
      approvalReviewId: review.reviewId,
      approvalReviewVersion: review.reviewVersion,
    }];
  });
  return freeze(inputs.sort((left, right) =>
    `${left.bundleId}\u0000${left.runtimeAssetId}\u0000${left.runtimeAssetVersion}`.localeCompare(
      `${right.bundleId}\u0000${right.runtimeAssetId}\u0000${right.runtimeAssetVersion}`,
      "en",
      { sensitivity: "variant" },
    ),
  ));
};
