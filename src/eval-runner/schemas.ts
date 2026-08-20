import { z } from "zod";

import {
  contextItemSchema,
  contextRouteSchema,
} from "../context/public.js";
import {
  decisionOutcomeSchema,
  expressionSchema,
  instructionArtifactClassSchema,
  instructionClauseSchema,
  instructionEvidenceSchema,
} from "../instruction/public.js";
import { scenarioFixtureSchema } from "../simulation/public.js";
import type { JsonValue } from "./types.js";

const identity = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const reference = z.strictObject({
  id: identity,
  version,
  expectedClass: z.string().optional(),
  expectedSchemaVersion: version.optional(),
});
const factValue = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const jsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(jsonValue).max(64),
  z.record(z.string(), jsonValue),
]));
const factRecord = z.record(z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u), factValue);

const jobFixtureSchema = z.strictObject({
  id: identity,
  taskId: identity,
  agentId: identity,
  targetId: identity,
  goal: z.string().min(1),
});

const contextFixtureSchema = z.strictObject({
  agentId: identity,
  jobId: identity,
  decisionTick: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
  routes: z.array(contextRouteSchema),
  availableSources: z.array(contextItemSchema),
  priorRetained: z.array(contextItemSchema),
  additions: z.array(contextItemSchema),
  retentionPolicy: z.enum(["Strict", "KeepNewest", "PriorityRetention", "CompactHistory", "ExternalizeRetrieve"]),
});

export const evalCandidateInjectionSchema = z.strictObject({
  point: z.literal("instruction-artifacts"),
  requiredArtifactClasses: z.array(instructionArtifactClassSchema).max(16),
});

export const evalRiskSchema = z.enum(["low", "medium", "high", "critical"]);
export const evalStatusSchema = z.enum(["completed", "passed", "failed", "invalid", "timed-out", "interrupted"]);
export const evalAssertionSubjectSchema = z.enum(["world", "job", "context", "trace", "tool", "message", "outcome"]);
export const evalAssertionOperatorSchema = z.enum(["equals", "not-equals", "in", "contains", "exists", "not-exists", "gte", "lte", "count-equals"]);

const resolvedArtifactSchema = z.strictObject({
  reference,
  class: instructionArtifactClassSchema,
  readableSource: z.string(),
  author: z.string().min(1),
  contextCost: z.number().int().nonnegative(),
  dependencies: z.array(reference),
  requiredTools: z.array(reference),
  clauses: z.array(instructionClauseSchema).min(1).max(128),
  knownTradeoffs: z.array(z.string().min(1)).max(64),
});

export const evalCandidateSchema = z.strictObject({
  reference,
  artifactReferences: z.array(reference).max(32),
  artifacts: z.array(resolvedArtifactSchema).max(32).optional(),
});

export const evalFixtureSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id: identity,
  version,
  scenario: scenarioFixtureSchema,
  job: jobFixtureSchema,
  context: contextFixtureSchema,
  candidateInjection: evalCandidateInjectionSchema,
  facts: factRecord,
  evidence: z.array(instructionEvidenceSchema).max(64),
  retryCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  maxTicks: z.number().int().positive(),
});

export const evalAssertionSchema = z.strictObject({
  id: identity,
  subject: evalAssertionSubjectSchema,
  path: z.string().regex(/^[A-Za-z0-9_*:-]+(?:\.[A-Za-z0-9_*:-]+)*$/u),
  operator: evalAssertionOperatorSchema,
  expected: jsonValue.optional(),
  evidenceKinds: z.array(z.string().min(1)).max(16).optional(),
});

export const evalCostReferenceSchema = z.strictObject({
  id: identity,
  kind: z.enum(["build", "run"]),
  units: z.number().int().nonnegative(),
  label: z.string().min(1),
});

export const evalCaseSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id: identity,
  version,
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  risk: evalRiskSchema,
  availability: z.enum(["available", "unavailable", "hidden"]),
  availabilityReason: z.string().min(1).optional(),
  oneTime: z.boolean(),
  fixture: evalFixtureSchema,
  assertions: z.array(evalAssertionSchema).max(128),
  timeoutTicks: z.number().int().positive(),
  cost: z.strictObject({ build: evalCostReferenceSchema, run: evalCostReferenceSchema }),
  defaultCandidate: evalCandidateSchema.optional(),
  previousResultIds: z.array(identity),
});

export const evalSuiteSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id: identity,
  version,
  title: z.string().min(1),
  description: z.string().min(1),
  availability: z.enum(["available", "unavailable", "hidden"]),
  caseReferences: z.array(reference).min(1).max(128),
});

export const evalSelectionRequestSchema = z.strictObject({
  caseReferences: z.array(reference).max(128).optional(),
  suiteReferences: z.array(reference).max(64).optional(),
});

export const evalSchemas = Object.freeze({
  evalCaseSchema,
  evalSuiteSchema,
  evalFixtureSchema,
  evalAssertionSchema,
  evalCandidateSchema,
  evalCandidateInjectionSchema,
  evalCostReferenceSchema,
  evalRiskSchema,
  evalStatusSchema,
  evalAssertionSubjectSchema,
  evalAssertionOperatorSchema,
  evalSelectionRequestSchema,
  expressionSchema,
  decisionOutcomeSchema,
});
