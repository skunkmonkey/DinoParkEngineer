import { z } from "zod";

const namespacedId = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const positiveInteger = z.number().int().positive();
const normalizedPoint = z.number().min(0).max(1);
const portablePath = z.string().min(1).superRefine((path, context) => {
  const invalid = path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/u.test(path) ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
  if (invalid) context.addIssue({ code: "custom", message: "must be a portable relative POSIX path" });
});
const uniqueLexical = (values: readonly string[], context: z.RefinementCtx): void => {
  const sorted = [...values].sort();
  if (new Set(values).size !== values.length || values.some((value, index) => value !== sorted[index])) {
    context.addIssue({ code: "custom", message: "must be unique and in lexical order" });
  }
};

export const assetArtDirectionDataSchema = z.strictObject({
  orientation: z.string().min(1),
  lighting: z.string().min(1),
  palette: z.array(z.string().min(1)).min(1),
  silhouette: z.string().min(1),
  outline: z.string().min(1),
  tone: z.string().min(1),
});

export const assetBriefDataSchema = z.strictObject({
  assetFamilyId: namespacedId,
  runtimeAssetId: namespacedId,
  bundleId: namespacedId,
  owningFeature: z.string().min(1),
  semanticRole: z.string().min(1),
  requiredViews: z.array(z.string().min(1)).min(1).superRefine(uniqueLexical),
  targetDisplayScale: z.strictObject({
    widthPx: positiveInteger,
    heightPx: positiveInteger,
    semanticZooms: z.array(z.enum(["far", "near"])).min(1).superRefine(uniqueLexical),
  }),
  sourceCanvas: z.strictObject({
    widthPx: positiveInteger,
    heightPx: positiveInteger,
    background: z.literal("transparent"),
  }),
  safeBounds: z.strictObject({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: positiveInteger,
    height: positiveInteger,
  }),
  pivot: z.strictObject({
    x: normalizedPoint,
    y: normalizedPoint,
    rule: z.string().min(1),
  }),
  animation: z.strictObject({
    mode: z.enum(["none", "frames"]),
    requiredSequences: z.array(z.string().min(1)).superRefine(uniqueLexical),
    reducedMotionEquivalent: z.string().min(1),
  }),
  variants: z.array(z.strictObject({
    id: namespacedId,
    semanticTags: z.array(z.string().min(1)).min(1).superRefine(uniqueLexical),
  })).min(1),
  accessibilityEquivalent: z.strictObject({
    domLabel: z.string().min(1),
    textDescription: z.string().min(1),
    soundSubstitution: z.string().min(1),
    shapeCue: z.string().min(1),
  }),
  artDirection: z.strictObject({ id: namespacedId, version }),
  acceptanceChecklist: z.array(z.string().min(1)).min(1),
}).superRefine((brief, context) => {
  if (brief.safeBounds.x + brief.safeBounds.width > brief.sourceCanvas.widthPx ||
      brief.safeBounds.y + brief.safeBounds.height > brief.sourceCanvas.heightPx) {
    context.addIssue({ code: "custom", path: ["safeBounds"], message: "must fit within sourceCanvas" });
  }
  uniqueLexical(brief.variants.map((variant) => variant.id), context);
});

const hash = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u);
const timestamp = z.string().datetime({ offset: true });

export const assetCandidateSchema = z.strictObject({
  candidateId: namespacedId,
  candidateVersion: version,
  sourceId: namespacedId,
  sourceVersion: version,
  briefId: namespacedId,
  briefVersion: version,
  runtimeAssetId: namespacedId,
  runtimeAssetVersion: version,
  bundleId: namespacedId,
  bundleVersion: version,
  sourcePath: portablePath.refine((path) => path.startsWith("assets/source/"), "must remain inside assets/source quarantine"),
  sourceHash: hash,
  model: z.strictObject({ alias: z.string().min(1), snapshot: z.string().min(1).optional() }),
  promptRevision: version,
  referenceInputs: z.array(z.strictObject({ sourceId: namespacedId, sourceVersion: version, sourceHash: hash })),
  generationParameters: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])),
  createdAt: timestamp,
  lineage: z.strictObject({
    operation: z.enum(["original", "edit", "variant"]),
    parentCandidateId: namespacedId.optional(),
    parentCandidateVersion: version.optional(),
    parentSourceHash: hash.optional(),
  }),
  rightsUsage: z.strictObject({ owner: z.string().min(1), license: z.string().min(1), allowedUse: z.string().min(1) }),
  quarantine: z.literal("unapproved"),
}).superRefine((candidate, context) => {
  const parentFields = [candidate.lineage.parentCandidateId, candidate.lineage.parentCandidateVersion, candidate.lineage.parentSourceHash];
  const hasAllParentFields = parentFields.every((field) => field !== undefined);
  if (candidate.lineage.operation === "original" && parentFields.some((field) => field !== undefined)) {
    context.addIssue({ code: "custom", path: ["lineage"], message: "original candidates cannot declare a parent" });
  }
  if (candidate.lineage.operation !== "original" && !hasAllParentFields) {
    context.addIssue({ code: "custom", path: ["lineage"], message: "derived candidates require complete parent lineage" });
  }
});

export const candidateReviewRecordSchema = z.strictObject({
  reviewId: namespacedId,
  reviewVersion: version,
  candidateId: namespacedId,
  candidateVersion: version,
  sourceId: namespacedId,
  selectedSourceVersion: version,
  sourceHash: hash,
  reviewer: z.string().min(1),
  decision: z.enum(["approved", "rejected", "request-revision", "superseded"]),
  decidedAt: timestamp,
  notes: z.string().min(1),
  supersededBy: z.strictObject({ candidateId: namespacedId, candidateVersion: version }).optional(),
}).superRefine((review, context) => {
  if ((review.decision === "superseded") !== (review.supersededBy !== undefined)) {
    context.addIssue({ code: "custom", path: ["supersededBy"], message: "is required only for a superseded decision" });
  }
});
