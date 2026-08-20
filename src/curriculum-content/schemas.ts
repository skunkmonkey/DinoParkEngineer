import { z } from "zod";

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const nonempty = z.string().min(1);
const sortedUnique = (values: readonly string[], context: z.RefinementCtx): void => {
  if (new Set(values).size !== values.length || values.some((value, index) => value !== [...values].sort()[index])) {
    context.addIssue({ code: "custom", message: "must be unique and lexically ordered" });
  }
};

export const exactContentReferenceSchema = z.strictObject({ id, version, expectedClass: nonempty, expectedSchemaVersion: version });
export const assetBundleDependencySchema = z.strictObject({
  bundleId: id,
  bundleVersion: version,
  requiredAssets: z.array(exactContentReferenceSchema).min(1),
});
export const playtestTagSchema = z.strictObject({ id, purpose: z.enum(["comprehension", "timing", "transfer", "accessibility", "authenticity"]), measure: nonempty });
export const guidanceSchema = z.strictObject({
  id, worldCue: nonempty, affordanceEmphasis: nonempty, conciseHint: nonempty,
  explicitHelp: nonempty, skipCondition: nonempty, accessibilityEquivalent: nonempty,
  copyIds: z.array(id).min(1).superRefine(sortedUnique),
});
const transferContextRouteSchema = z.strictObject({
  id, item: exactContentReferenceSchema, routed: z.boolean(), unavailableReason: z.literal("not-routed").optional(),
}).superRefine((route, context) => {
  if (route.routed === (route.unavailableReason !== undefined)) context.addIssue({ code: "custom", path: ["unavailableReason"], message: "is required exactly when a route is unavailable" });
});
export const transferSchema = z.strictObject({
  id, concept: nonempty, scenario: exactContentReferenceSchema,
  changedSurfaceDetails: z.array(nonempty).min(1), withheldGuidanceIds: z.array(id), successEventId: id,
  fixture: z.strictObject({
    seed: z.number().int().nonnegative(), speciesId: id, dinosaurId: id, enclosureId: id, gateId: id, maintenanceSourceId: id,
    task: exactContentReferenceSchema, speciesKnowledge: exactContentReferenceSchema,
    missingContextRoute: transferContextRouteSchema, revisedContextRoute: transferContextRouteSchema,
  }),
  openingGuidanceDisabled: z.literal(true),
  observableSuccess: z.strictObject({
    requiredActionIds: z.array(id).min(1), eventId: id, result: z.literal("feeding-succeeded"), fatalities: z.literal(0), injuries: z.literal(0),
  }),
  delayedAssistance: z.strictObject({ optional: z.literal(true), availableAfterEventId: id, guidanceId: id, rewardPenalty: z.literal(false) }),
});
export const handbookEntrySchema = z.strictObject({
  id, term: nonempty, definitionCopyId: id, visualGrammarCopyId: id,
  encounteredExampleCopyId: id, unlockId: id, agentContextEligible: z.literal(false),
});
export const unlockSchema = z.strictObject({ id, prerequisites: z.array(id), grants: z.array(exactContentReferenceSchema).min(1), triggerEventId: id });
export const copyCatalogSchema = z.record(id, nonempty);

const openingJobSchema = z.strictObject({
  id, task: exactContentReferenceSchema, targetId: id, assignedAgentId: id.optional(), partiallyConfigured: z.boolean(),
  requiredPlayerAction: z.enum(["assign-instruction", "reuse-instruction", "deploy-and-rerun"]),
  artifactVersions: z.array(exactContentReferenceSchema).min(1), contextRouteIds: z.array(id).min(1), expectedOutcomeId: id,
});
const contextRouteSchema = z.strictObject({ id, item: exactContentReferenceSchema, routed: z.boolean(), unavailableReason: z.literal("not-routed").optional() })
  .superRefine((route, context) => {
    if (route.routed === (route.unavailableReason !== undefined)) context.addIssue({ code: "custom", path: ["unavailableReason"], message: "is required exactly when a route is unavailable" });
  });
const goldenOutcomeSchema = z.strictObject({
  id, order: z.number().int().nonnegative(), trigger: nonempty,
  result: z.enum(["feeding-succeeded", "near-miss-stabilized", "eval-passed", "park-opened"]),
  fatalities: z.number().int().nonnegative(), injuries: z.number().int().nonnegative(), recoverable: z.boolean(), causalLinkIds: z.array(id),
});

export const scenarioSchema = z.strictObject({
  id, version, schemaVersion: z.literal("1"), arcId: id, seed: z.number().int().nonnegative(),
  setting: z.strictObject({
    phase: z.literal("pre-opening"), timeOfDay: z.literal("dawn"), parkClosed: z.literal(true),
    openingDeadline: z.strictObject({ dueTick: z.number().int().positive(), pausable: z.literal(true), guidanceHasNoRewardPenalty: z.literal(true) }),
  }),
  entities: z.strictObject({
    hungryDinosaurId: id, secondDinosaurId: id, workerAgentId: id, visitorConvoyId: id, firstEnclosureId: id,
    secondEnclosureId: id, secondGateId: id, secondGateAutomaticCloser: z.literal("disabled-for-maintenance"),
  }),
  exactReferences: z.array(exactContentReferenceSchema).min(1), jobs: z.array(openingJobSchema).min(3),
  contextRoutes: z.array(contextRouteSchema).min(1), guidanceIds: z.array(id).min(1),
  incident: z.strictObject({
    id, expectedCopyId: id, observedCopyId: id, consequenceCopyId: id, immediateGapCopyId: id,
    affectedEntityIds: z.array(id).min(1), traceIds: z.array(id).min(1), responsibleArtifact: exactContentReferenceSchema,
  }),
  workbench: z.strictObject({
    choices: z.array(z.strictObject({ id, labelCopyId: id, action: z.enum(["route-maintenance-context", "revise-feeding-instruction"]) })).min(2),
    freeEval: exactContentReferenceSchema.extend({ authoringCost: z.literal(0) }), candidate: exactContentReferenceSchema,
    review: exactContentReferenceSchema, deployment: exactContentReferenceSchema, reward: exactContentReferenceSchema, handbookEntryId: id,
  }),
  goldenOutcomes: z.array(goldenOutcomeSchema).min(4), assetDependency: assetBundleDependencySchema,
});

export const arcSchema = z.strictObject({
  id, experiencedPressure: nonempty, targetConcept: nonempty, availableMechanics: z.array(nonempty).min(1),
  prerequisiteDemonstrations: z.array(nonempty), scenarioIds: z.array(id).min(1), transferCaseId: id,
  masteryPeriod: nonempty, optionalExpansion: nonempty, playtestTagIds: z.array(id).min(1),
});

export const curriculumPackageSchema = z.strictObject({
  packageId: id, packageVersion: version, schemaVersion: z.literal("1"), compatibleDomainSchemas: z.record(nonempty, version),
  dependencies: z.array(exactContentReferenceSchema).min(1), arcs: z.array(arcSchema).min(1), scenarios: z.array(scenarioSchema).min(1),
  unlocks: z.array(unlockSchema).min(1), guidance: z.array(guidanceSchema).min(1), transfers: z.array(transferSchema).min(1),
  handbook: z.array(handbookEntrySchema).min(1), copy: copyCatalogSchema, assetBundles: z.array(assetBundleDependencySchema).min(1),
  playtestTags: z.array(playtestTagSchema).min(1), fingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
  openingRun: z.strictObject({
    targetHumanSeconds: z.literal(300), timingAcceptance: z.literal("human-playtest-required"), pauseExcluded: z.literal(true), guidancePenalty: z.literal(false), successCopyId: id,
    beats: z.array(z.strictObject({ id, targetCumulativeSeconds: z.number().int().positive().max(300), action: nonempty, observableEventId: id })).min(5),
  }),
});
