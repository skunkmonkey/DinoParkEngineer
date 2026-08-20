import { z } from "zod";

const id = z.string().min(1);
const nonnegativeInteger = z.number().int().nonnegative();
const signedInteger = z.number().int();
const source = z.strictObject({
  kind: z.enum(["command", "settlement", "outcome", "eval", "system", "recovery"]),
  id,
  label: z.string().optional(),
});
const ruleVersion = z.strictObject({ id, version: z.string().min(1) });
const related = {
  relatedIds: z.array(id).optional(),
  entityIds: z.array(id).optional(),
  artifactIds: z.array(id).optional(),
  evalIds: z.array(id).optional(),
  incidentIds: z.array(id).optional(),
};

export const economyCostCategorySchema = z.enum([
  "authoring",
  "acquisition",
  "runtime",
  "eval-build",
  "eval-run",
  "operation",
  "maintenance",
  "response",
  "recovery",
  "expansion",
  "expression",
  "revenue",
]);

export const economyChargeCategorySchema = economyCostCategorySchema.exclude(["revenue"]);

export const economyTransactionSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id,
  day: nonnegativeInteger,
  tick: nonnegativeInteger,
  amount: signedInteger,
  category: economyCostCategorySchema,
  currency: z.literal("credits"),
  source,
  sourceId: id,
  commandId: id.optional(),
  settlementId: id.optional(),
  balanceBefore: signedInteger,
  balanceAfter: signedInteger,
  ...related,
});

export const economyQuoteSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id,
  category: economyChargeCategorySchema,
  amount: nonnegativeInteger,
  currency: z.literal("credits"),
  day: nonnegativeInteger,
  tick: nonnegativeInteger,
  source,
  sourceId: id,
  ruleVersion,
  expiresAtTick: nonnegativeInteger.optional(),
  description: z.string().optional(),
  ...related,
});

export const economyReservationSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id,
  quoteId: id,
  status: z.enum(["reserved", "committed", "cancelled"]),
  amount: nonnegativeInteger,
  category: economyChargeCategorySchema,
  day: nonnegativeInteger,
  tick: nonnegativeInteger,
  transactionId: id.optional(),
  cancellationReason: z.string().optional(),
  ...related,
});

export const evalAssetSchema = z.strictObject({
  id,
  version: z.string().min(1),
  authoredDay: nonnegativeInteger,
  authoredTick: nonnegativeInteger,
  authoringTransactionId: id.optional(),
});

export const evalRunRecordSchema = z.strictObject({
  runId: id,
  evalId: id,
  evalVersion: z.string().min(1),
  day: nonnegativeInteger,
  tick: nonnegativeInteger,
  transactionId: id.optional(),
});

export const economyRuleSetSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  id,
  version: z.string().min(1),
  currency: z.literal("credits"),
  costs: z.strictObject({
    authoring: nonnegativeInteger,
    acquisition: nonnegativeInteger,
    runtime: nonnegativeInteger,
    "eval-build": nonnegativeInteger,
    "eval-run": nonnegativeInteger,
    operation: nonnegativeInteger,
    maintenance: nonnegativeInteger,
    response: nonnegativeInteger,
    recovery: nonnegativeInteger,
    expansion: nonnegativeInteger,
    expression: nonnegativeInteger,
  }),
  visitors: z.strictObject({
    admissionPrice: nonnegativeInteger,
    baseDemand: nonnegativeInteger,
    capacity: nonnegativeInteger,
  }),
  rating: z.strictObject({
    base: z.strictObject({
      safety: nonnegativeInteger,
      guestExperience: nonnegativeInteger,
      dinosaurWelfare: nonnegativeInteger,
    }),
    penalties: z.strictObject({
      failedJob: nonnegativeInteger,
      incidentRiskDivisor: z.number().int().positive(),
      unresolvedIncident: nonnegativeInteger,
      intervention: nonnegativeInteger,
      closure: nonnegativeInteger,
      injury: nonnegativeInteger,
      death: nonnegativeInteger,
      welfareNeglect: nonnegativeInteger,
      guestDissatisfaction: nonnegativeInteger,
      unservedVisitor: nonnegativeInteger,
    }),
    bonuses: z.strictObject({
      stableOperation: nonnegativeInteger,
      demonstratedRecovery: nonnegativeInteger,
    }),
  }),
});

const capabilityDefinition = z.strictObject({ id, version: z.string().min(1), name: z.string().min(1), description: z.string().min(1), actionId: id, actionLabel: z.string().min(1), prerequisites: z.array(id), pressureIds: z.array(id), cost: nonnegativeInteger });
export const capabilityStateSchema = capabilityDefinition.extend({ status: z.enum(["locked", "available", "purchased"]), availableTick: nonnegativeInteger.optional(), purchasedTick: nonnegativeInteger.optional(), purchaseTransactionId: id.optional() });
export const capabilityActionSchema = z.strictObject({ id, label: z.string().min(1), capabilityId: id, available: z.boolean(), description: z.string().min(1) });
export const progressionStateSchema = z.strictObject({ schemaVersion: z.literal("1"), pressureIds: z.array(id), capabilities: z.array(capabilityStateSchema), actions: z.array(capabilityActionSchema) });
export const rewardDefinitionSchema = z.strictObject({ id, version: z.string().min(1), name: z.string().min(1), description: z.string().min(1), assetId: id, assetVersion: z.string().min(1), cost: nonnegativeInteger, mechanicalBonus: z.literal(0), visibleToVisitors: z.boolean(), prerequisites: z.array(id) });
export const rewardInventoryItemSchema = z.strictObject({ itemId: id, rewardId: id, rewardVersion: z.string().min(1), status: z.enum(["owned", "placed", "removed"]), purchaseTransactionId: id, purchasedDay: nonnegativeInteger, purchasedTick: nonnegativeInteger, placementId: id.optional() });
export const rewardPlacementSchema = z.strictObject({ placementId: id, itemId: id, rewardId: id, assetId: id, assetVersion: z.string().min(1), locationId: id, visibleToVisitors: z.boolean(), placedTick: nonnegativeInteger, removedTick: nonnegativeInteger.optional() });
export const rewardInventoryStateSchema = z.strictObject({ schemaVersion: z.literal("1"), items: z.array(rewardInventoryItemSchema), placements: z.array(rewardPlacementSchema) });
export const economyCapabilityDefinitionSchema = capabilityDefinition;
export const economyRewardDefinitionSchema = rewardDefinitionSchema;

export const economyLedgerStateSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  initialBalance: signedInteger,
  transactions: z.array(economyTransactionSchema),
  quotes: z.array(economyQuoteSchema),
  reservations: z.array(economyReservationSchema),
  authoredEvals: z.array(evalAssetSchema),
  evalRuns: z.array(evalRunRecordSchema),
  settlements: z.array(id),
  progression: progressionStateSchema,
  rewards: rewardInventoryStateSchema,
});

export const economyLedgerProjectionSchema = economyLedgerStateSchema.extend({
  balance: signedInteger,
  reservedBalance: nonnegativeInteger,
  availableBalance: signedInteger,
});

export const parkOutcomeRecordSchema = z.strictObject({
  id,
  kind: z.enum([
    "injury",
    "death",
    "visitor-injury",
    "visitor-death",
    "dinosaur-injury",
    "dinosaur-death",
    "closure",
    "unresolved-incident",
    "stable-safe-operation",
    "recovery-demonstrated",
    "welfare-neglect",
    "guest-dissatisfaction",
  ]),
  count: nonnegativeInteger,
  sourceId: id,
  ...related,
});
