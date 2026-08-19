import { z } from "zod";

import { worldCommandSchema } from "../simulation/public.js";

const stableId = z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u);
const factPath = z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u);
const reasonCode = z.string().regex(/^[A-Z][A-Z0-9_]*$/u);
const reference = z.strictObject({
  id: stableId,
  version: z.string().min(1),
  expectedClass: z.string().optional(),
  expectedSchemaVersion: z.string().optional(),
});
const factValue = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export const expressionSchema: z.ZodType<import("./types.js").Expression> = z.lazy(() => z.discriminatedUnion("operator", [
  z.strictObject({ operator: z.literal("always") }),
  z.strictObject({ operator: z.literal("fact-exists"), fact: factPath }),
  z.strictObject({ operator: z.literal("fact-equals"), fact: factPath, value: factValue }),
  z.strictObject({ operator: z.literal("fact-not-equals"), fact: factPath, value: factValue }),
  z.strictObject({ operator: z.literal("fact-in"), fact: factPath, values: z.array(factValue).min(1).max(32) }),
  z.strictObject({ operator: z.literal("fact-gte"), fact: factPath, value: z.number().finite() }),
  z.strictObject({ operator: z.literal("fact-lte"), fact: factPath, value: z.number().finite() }),
  z.strictObject({ operator: z.literal("all"), expressions: z.array(expressionSchema).min(1).max(16) }),
  z.strictObject({ operator: z.literal("any"), expressions: z.array(expressionSchema).min(1).max(16) }),
  z.strictObject({ operator: z.literal("not"), expression: expressionSchema }),
]));

export const decisionOutcomeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("tool-request"), command: worldCommandSchema }),
  z.strictObject({ kind: z.literal("complete"), reasonCode }),
  z.strictObject({ kind: z.literal("wait"), reasonCode }),
  z.strictObject({ kind: z.literal("stop"), reasonCode }),
  z.strictObject({ kind: z.literal("escalate"), reasonCode, target: stableId }),
]);

const evidenceSource = z.enum(["physical-gate", "gate-sensor", "dinosaur", "visitor", "robot"]);
const evidenceReliability = z.enum(["direct", "healthy", "degraded", "unavailable"]);

export const instructionEvidenceSchema = z.strictObject({
  source: evidenceSource,
  sourceId: stableId,
  field: factPath,
  value: factValue,
  reliability: evidenceReliability,
  observedAtTick: z.number().int().nonnegative(),
});

export const verificationRuleSchema = z.strictObject({
  claim: z.strictObject({ sourceId: stableId, field: factPath, expected: factValue }),
  acceptableSources: z.array(evidenceSource).min(1),
  acceptableReliability: z.array(evidenceReliability).min(1),
  maxAgeTicks: z.number().int().nonnegative(),
  minimumAgreement: z.number().int().positive(),
  maxRetries: z.number().int().nonnegative(),
  failureOutcome: decisionOutcomeSchema,
});

export const instructionClauseSchema = z.strictObject({
  id: stableId,
  type: z.enum(["action", "completion", "wait", "stop", "escalation", "delegation", "reporting", "knowledge-selection", "verification", "failure"]),
  applicability: expressionSchema,
  priority: z.number().int(),
  requiredFacts: z.array(factPath),
  preconditions: z.array(expressionSchema).max(16),
  postconditions: z.array(expressionSchema).max(16),
  conflictGroup: z.string().regex(/^[a-z][a-z0-9-]*$/u).optional(),
  conflictResolution: z.enum(["select", "combine", "stop", "escalate"]),
  outcome: decisionOutcomeSchema,
  verification: verificationRuleSchema.optional(),
});

export const instructionArtifactDataSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  requiredTools: z.array(reference),
  clauses: z.array(instructionClauseSchema).min(1),
  knownTradeoffs: z.array(z.string().min(1)),
});

export const instructionArtifactClassSchema = z.enum([
  "Task", "Prompt", "Skill", "SystemPrompt", "Policy", "ToolInstruction",
  "KnowledgeSelection", "Verification", "Failure", "Escalation", "Delegation", "Reporting",
]);
