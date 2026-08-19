import { z } from "zod";

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const factPath = z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u);
const factValue = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const tag = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const memoryScopeSchema = z.enum([
  "Agent", "Team", "Enclosure", "Park", "Scenario",
  "agent", "team", "enclosure", "park", "scenario",
]);
export const memoryConfidenceSchema = z.enum(["unknown", "low", "medium", "high"]);
export const memoryReferenceSchema = z.strictObject({ id, version });
export const memorySourceReferenceSchema = z.strictObject({
  id,
  version,
  itemId: id.optional(),
  sourceVersion: memoryReferenceSchema.optional(),
});
export const memoryRoutingSchema = z.strictObject({
  taskIds: z.array(id).optional(),
  agentIds: z.array(id).optional(),
  locationIds: z.array(id).optional(),
  entityIds: z.array(id).optional(),
  routeIds: z.array(id).optional(),
});
export const memoryTransformationSchema = z.strictObject({
  kind: z.enum(["externalize", "compact-history", "manual"]),
  rule: memoryReferenceSchema.optional(),
  sources: z.array(memorySourceReferenceSchema),
  createdTick: z.number().int().nonnegative(),
  producer: z.string().min(1),
});
export const memoryProvenanceSchema = z.strictObject({
  source: z.string().min(1),
  sourceItems: z.array(memorySourceReferenceSchema),
  transformation: memoryTransformationSchema,
  author: z.string().min(1),
});
export const memorySummarySchema = z.strictObject({
  rule: memoryReferenceSchema,
  sourceReferences: z.array(memorySourceReferenceSchema),
  sourceRange: z.strictObject({ firstTick: z.number().int().nonnegative(), lastTick: z.number().int().nonnegative() }).optional(),
  preservedFactPaths: z.array(factPath),
  preservedFacts: z.record(factPath, factValue),
  lostDetailClasses: z.array(z.string().min(1)),
  contextCostBefore: z.number().int().positive(),
  contextCostAfter: z.number().int().positive(),
  lineage: z.array(memoryReferenceSchema),
});

export const memoryEntrySchema = z.strictObject({
  id,
  version,
  storeId: id,
  scope: memoryScopeSchema,
  scopeId: id,
  sourceItems: z.array(memorySourceReferenceSchema),
  sourceLineage: z.array(memorySourceReferenceSchema),
  createdTick: z.number().int().nonnegative(),
  observedWorldTick: z.number().int().nonnegative().optional(),
  author: z.string().min(1),
  producer: z.string().min(1),
  confidence: memoryConfidenceSchema,
  priority: z.number().int(),
  tags: z.array(tag),
  facts: z.record(factPath, factValue),
  routing: memoryRoutingSchema,
  staleAtTick: z.number().int().nonnegative().optional(),
  supersedes: memoryReferenceSchema.optional(),
  supersededBy: memoryReferenceSchema.optional(),
  provenance: memoryProvenanceSchema,
  contextCost: z.number().int().positive(),
  summary: memorySummarySchema.optional(),
  duplicateKey: z.string().min(1).optional(),
  conflictKey: z.string().min(1).optional(),
});

export const memoryAuthorityRuleSchema = z.strictObject({
  principalId: id,
  scopes: z.array(memoryScopeSchema).optional(),
  storeIds: z.array(id).optional(),
});
export const memoryStoreSchema = z.strictObject({
  id,
  version,
  scope: memoryScopeSchema,
  scopeId: id,
  readers: z.array(memoryAuthorityRuleSchema),
  writers: z.array(memoryAuthorityRuleSchema),
  publicRead: z.boolean(),
  publicWrite: z.boolean(),
  enabled: z.boolean(),
  entries: z.array(memoryEntrySchema),
});
export const memoryStoreInputSchema = memoryStoreSchema.omit({ readers: true, writers: true, entries: true }).extend({
  readers: z.array(memoryAuthorityRuleSchema).optional(),
  writers: z.array(memoryAuthorityRuleSchema).optional(),
  readAuthority: z.array(memoryAuthorityRuleSchema).optional(),
  writeAuthority: z.array(memoryAuthorityRuleSchema).optional(),
  entries: z.array(memoryEntrySchema).optional(),
});

export const memoryPrincipalSchema = z.strictObject({ id, roles: z.array(z.string().min(1)).optional() });
export const memoryExternalizationRuleSchema = z.strictObject({
  id,
  version,
  eligibleCategories: z.array(z.enum(["Task", "SystemPrompt", "Skill", "Policy", "Knowledge", "Memory", "Tool", "Message", "Observation", "ToolResult", "TaskHistory", "IncidentEvidence"])),
  targetStoreId: id,
  mode: z.enum(["full-item", "facts"]),
  factPaths: z.array(factPath).optional(),
  scope: memoryScopeSchema,
  scopeId: id,
  tags: z.array(tag),
  routing: memoryRoutingSchema.optional(),
  contextCost: z.number().int().positive().optional(),
  priority: z.number().int().optional(),
  confidence: memoryConfidenceSchema.optional(),
  author: z.string().min(1),
  producer: z.string().min(1),
  failurePolicy: z.enum(["retain-in-context", "block"]),
});

export const memoryPredicateSchema = z.union([
  z.strictObject({ kind: z.literal("task"), taskId: id }),
  z.strictObject({ kind: z.literal("agent"), agentId: id }),
  z.strictObject({ kind: z.literal("location"), locationId: id }),
  z.strictObject({ kind: z.literal("entity"), entityId: id }),
  z.strictObject({ kind: z.literal("tag"), tag, mode: z.enum(["has", "missing"]).optional() }),
  z.strictObject({ kind: z.literal("scope"), scope: memoryScopeSchema, scopeId: id.optional() }),
  z.strictObject({ kind: z.literal("created-tick"), min: z.number().int().nonnegative().optional(), max: z.number().int().nonnegative().optional() }),
  z.strictObject({ kind: z.literal("observed-world-tick"), min: z.number().int().nonnegative().optional(), max: z.number().int().nonnegative().optional() }),
  z.strictObject({ kind: z.literal("exact-version"), id, version }),
  z.strictObject({ kind: z.literal("fact-equals"), path: factPath, value: factValue }),
]);
export const memoryRankingRuleSchema = z.strictObject({
  field: z.enum(["priority", "confidence", "createdTick", "observedWorldTick", "scopeSpecificity", "tagMatchCount"]),
  direction: z.enum(["asc", "desc"]),
});
export const memoryRetrievalQuerySchema = z.strictObject({
  requestId: id.optional(),
  principal: memoryPrincipalSchema.optional(),
  taskId: id.optional(),
  agentId: id.optional(),
  locationId: id.optional(),
  entityId: id.optional(),
  tags: z.array(tag).optional(),
  predicates: z.array(memoryPredicateSchema).optional(),
  storeIds: z.array(id).optional(),
  scopes: z.array(z.strictObject({ scope: memoryScopeSchema, scopeId: id.optional() })).optional(),
  exactVersions: z.array(memoryReferenceSchema).optional(),
  currentTick: z.number().int().nonnegative().optional(),
  currentWorldTick: z.number().int().nonnegative().optional(),
  staleAfterTicks: z.number().int().nonnegative().optional(),
  ranking: z.array(memoryRankingRuleSchema).optional(),
  limit: z.number().int().nonnegative(),
  includeSuperseded: z.boolean().optional(),
});

export const compactHistoryRuleSchema = z.strictObject({
  id,
  version,
  preserveFactPaths: z.array(factPath),
  lostDetailClasses: z.array(z.string().min(1)),
  contextCost: z.number().int().positive(),
  author: z.string().min(1),
  producer: z.string().min(1),
  summaryScope: memoryScopeSchema.optional(),
  summaryScopeId: id.optional(),
  tags: z.array(tag).optional(),
});
export const compactHistoryRequestSchema = z.strictObject({
  sourceEntries: z.array(memoryEntrySchema).optional(),
  sourceReferences: z.array(memoryReferenceSchema).optional(),
  rule: compactHistoryRuleSchema,
  storeId: id,
  createdTick: z.number().int().nonnegative(),
  observedWorldTick: z.number().int().nonnegative().optional(),
  principal: memoryPrincipalSchema,
  summaryId: id.optional(),
  summaryVersion: version.optional(),
});
