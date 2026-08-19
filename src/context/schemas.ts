import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u);
const factPath = z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u);
const factValue = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const reference = z.strictObject({ id, version: z.string().min(1), expectedClass: z.string().optional(), expectedSchemaVersion: z.string().optional() });

export const contextCategorySchema = z.enum(["Task", "SystemPrompt", "Skill", "Policy", "Knowledge", "Memory", "Tool", "Message", "Observation", "ToolResult", "TaskHistory", "IncidentEvidence"]);
export const contextItemSchema = z.strictObject({
  id,
  category: contextCategorySchema,
  provenance: z.strictObject({ source: z.string().min(1), routeId: id }),
  sourceVersion: reference,
  cost: z.number().int().positive(),
  createdTick: z.number().int().nonnegative(),
  priority: z.number().int(),
  retentionEligible: z.boolean(),
  pinned: z.boolean(),
  payload: z.strictObject({ reference: z.string().min(1), facts: z.record(factPath, factValue) }),
  quality: z.strictObject({ staleAtTick: z.number().int().nonnegative().optional(), relevance: z.enum(["relevant", "irrelevant"]), duplicateKey: z.string().min(1).optional(), conflictKey: z.string().min(1).optional() }),
});
export const contextRouteSchema = z.strictObject({ id, itemId: id, required: z.boolean(), applicable: z.boolean() });
export const contextAssemblyInputSchema = z.strictObject({
  agentId: id,
  jobId: id,
  decisionTick: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
  routes: z.array(contextRouteSchema),
  availableSources: z.array(contextItemSchema),
  priorRetained: z.array(contextItemSchema),
  additions: z.array(contextItemSchema),
  retentionPolicy: z.enum(["Strict", "KeepNewest"]),
  faultPort: z.custom<import("./types.js").ContextFaultPort>((value) => value === undefined || (value !== null && typeof value === "object" && "reportContextFault" in value && typeof value.reportContextFault === "function")).optional(),
});
