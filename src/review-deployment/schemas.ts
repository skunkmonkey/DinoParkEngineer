import { z } from "zod";

const identity = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const reference = z.strictObject({
  id: identity,
  version,
  expectedClass: z.string().optional(),
  expectedSchemaVersion: version.optional(),
});
const slot = z.strictObject({ slot: z.string().min(1), scope: z.string().min(1) });
const causalLink = z.strictObject({
  kind: z.enum(["review", "candidate", "workbench", "feedback", "eval", "suite", "result", "trace", "replay", "deployment", "job", "incident", "revert"]),
  id: z.string().min(1),
  version: version.optional(),
});

export const reviewRiskAreaSchema = z.strictObject({
  id: identity,
  kind: z.enum(["safety", "coverage", "context", "dependency", "tool", "behavior", "tradeoff", "replay"]),
  summary: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

export const reviewDeltaEntrySchema = z.strictObject({
  id: identity,
  change: z.enum(["added", "removed", "changed"]),
  summary: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  left: z.string().optional(),
  right: z.string().optional(),
});

export const evalEvidenceStatusSchema = z.enum(["completed", "passed", "failed", "invalid", "timed-out", "interrupted", "omitted"]);
export const reviewDecisionKindSchema = z.enum(["request-changes", "retain", "deploy", "revert"]);
export const reviewStatusSchema = z.enum(["open", "changes-requested", "retained", "deployed", "reverted", "superseded"]);

export const evalSelectionSnapshotSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  caseReferences: z.array(reference),
  suiteReferences: z.array(reference),
  selectedCases: z.array(reference),
  includedRisks: z.array(z.enum(["low", "medium", "high", "critical"])),
  estimatedCost: z.strictObject({
    buildUnits: z.number().int().nonnegative(),
    runUnits: z.number().int().nonnegative(),
    totalUnits: z.number().int().nonnegative(),
    references: z.array(z.unknown()),
  }),
  items: z.array(z.unknown()),
  diagnostics: z.array(z.string()),
  selectedTick: z.number().int().nonnegative(),
});

export const deploymentManifestSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  root: reference,
  dependencies: z.array(reference),
  resolvedContent: z.unknown().optional(),
  source: z.enum(["registry", "candidate-snapshot"]),
  fingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
});

export const deploymentConfirmationSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id: z.string().min(1),
  reviewId: identity,
  candidateReference: reference,
  slot,
  manifestFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
  evidenceIds: z.array(z.string().min(1)),
  actor: z.string().min(1),
  confirmed: z.literal(true),
  confirmedTick: z.number().int().nonnegative(),
});

export const reviewCausalLinkSchema = causalLink;
export const reviewSchemas = Object.freeze({
  reviewRiskAreaSchema,
  reviewDeltaEntrySchema,
  evalEvidenceStatusSchema,
  reviewDecisionKindSchema,
  reviewStatusSchema,
  evalSelectionSnapshotSchema,
  deploymentManifestSchema,
  deploymentConfirmationSchema,
  reviewCausalLinkSchema,
});

