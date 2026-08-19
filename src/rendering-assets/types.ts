export type ReviewDecision = "approved" | "rejected" | "request-revision" | "superseded";

export interface AssetCandidate {
  readonly candidateId: string;
  readonly candidateVersion: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly briefId: string;
  readonly briefVersion: string;
  readonly runtimeAssetId: string;
  readonly runtimeAssetVersion: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly model: {
    readonly alias: string;
    readonly snapshot?: string;
  };
  readonly promptRevision: string;
  readonly referenceInputs: readonly {
    readonly sourceId: string;
    readonly sourceVersion: string;
    readonly sourceHash: string;
  }[];
  readonly generationParameters: Readonly<Record<string, string | number | boolean>>;
  readonly createdAt: string;
  readonly lineage: {
    readonly operation: "original" | "edit" | "variant";
    readonly parentCandidateId?: string;
    readonly parentCandidateVersion?: string;
    readonly parentSourceHash?: string;
  };
  readonly rightsUsage: {
    readonly owner: string;
    readonly license: string;
    readonly allowedUse: string;
  };
  readonly quarantine: "unapproved";
}

export interface CandidateReviewRecord {
  readonly reviewId: string;
  readonly reviewVersion: string;
  readonly candidateId: string;
  readonly candidateVersion: string;
  readonly sourceId: string;
  readonly selectedSourceVersion: string;
  readonly sourceHash: string;
  readonly reviewer: string;
  readonly decision: ReviewDecision;
  readonly decidedAt: string;
  readonly notes: string;
  readonly supersededBy?: {
    readonly candidateId: string;
    readonly candidateVersion: string;
  };
}

export interface RuntimeBundleInput {
  readonly runtimeAssetId: string;
  readonly runtimeAssetVersion: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly briefId: string;
  readonly briefVersion: string;
  readonly approvalReviewId: string;
  readonly approvalReviewVersion: string;
}

export interface RenderingAssetDiagnostic {
  readonly code:
    | "ASSET_CANDIDATE_HASH_MISMATCH"
    | "ASSET_CANDIDATE_INVALID"
    | "ASSET_CANDIDATE_DUPLICATE"
    | "ASSET_CANDIDATE_SECRET_REJECTED"
    | "ASSET_MANIFEST_SECRET_REJECTED"
    | "ASSET_REVIEW_INVALID";
  readonly field: string;
  readonly message: string;
}

export type CandidateImportResult =
  | { readonly ok: true; readonly candidate: AssetCandidate }
  | { readonly ok: false; readonly diagnostics: readonly RenderingAssetDiagnostic[] };

export type ReviewRecordResult =
  | { readonly ok: true; readonly review: CandidateReviewRecord }
  | { readonly ok: false; readonly diagnostics: readonly RenderingAssetDiagnostic[] };

export type CandidateCatalogResult =
  | { readonly ok: true; readonly candidates: readonly AssetCandidate[] }
  | { readonly ok: false; readonly diagnostics: readonly RenderingAssetDiagnostic[] };

export type ReviewCatalogResult =
  | { readonly ok: true; readonly reviews: readonly CandidateReviewRecord[] }
  | { readonly ok: false; readonly diagnostics: readonly RenderingAssetDiagnostic[] };
