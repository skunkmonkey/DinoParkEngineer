import { fingerprint } from "../content-registry/public.js";
import type {
  AssetBundleDependency,
  CurriculumPackage,
  CurriculumValidationInventory,
  ExactContentReference,
} from "./types.js";

const ref = (id: string, expectedClass: string, version = "1.0.0", expectedSchemaVersion = "1"): ExactContentReference => ({
  id, version, expectedClass, expectedSchemaVersion,
});

export const OPENING_CURRICULUM_IDS = Object.freeze({
  package: "curriculum:opening-foundation",
  arc: "arc:missing-maintenance-context",
  scenario: "scenario:dawn-opening",
  transfer: "transfer:missing-context-new-enclosure",
  bundle: "assets:bundle-mvp-park",
  bundleVersion: "1.0.0",
});

export const OPENING_RUNTIME_ASSET_IDS = Object.freeze([
  "assets:cue-operational-warning",
  "assets:dinosaur-herbivore",
  "assets:effect-dust-puff",
  "assets:environment-grass-path",
  "assets:gate-enclosure",
  "assets:reward-dinosaur-plushie",
  "assets:robot-park-worker",
  "assets:thumbnail-park-overview",
  "assets:visitor-park",
] as const);

const assetDependency: AssetBundleDependency = {
  bundleId: OPENING_CURRICULUM_IDS.bundle,
  bundleVersion: OPENING_CURRICULUM_IDS.bundleVersion,
  requiredAssets: OPENING_RUNTIME_ASSET_IDS.map((id) => ref(id, "RuntimeAsset")),
};

const unsignedOpeningPackage: Omit<CurriculumPackage, "fingerprint"> = {
  packageId: OPENING_CURRICULUM_IDS.package,
  packageVersion: "1.0.0",
  schemaVersion: "1",
  compatibleDomainSchemas: {
    context: "1", "content-registry": "1", curriculum: "1", "eval-runner": "1", instruction: "1",
    "park-operations": "1", "rendering-assets": "1", simulation: "1", "trace-replay": "1",
  },
  dependencies: [
    ref("task:feed-triceratops", "Task"),
    ref("park:feed-triceratops", "Prompt"),
    ref("park:safe-feeding", "Skill"),
    ref("park:containment-policy", "Policy"),
    ref("content:maintenance-policy", "Knowledge"),
    ref("knowledge:triceratops-care", "Knowledge"),
    ref("tool:bait", "Tool"),
    ref("tool:feed", "Tool"),
    ref("tool:gate-control", "Tool"),
    ref("tool:gate-observe", "Tool"),
    ref("eval:opening-maintenance-context", "EvalCase"),
    ref("park:feed-triceratops-revised", "Prompt"),
    ref("review:opening-feeding-revision", "Review"),
    ref("deployment:opening-feeding-revision", "Deployment"),
    ref("reward:dinosaur-plushie", "Reward"),
    ref("workbench:minimum-opening", "WorkbenchSurface"),
    ref("handbook:context-boundary", "HandbookEntry"),
    ref("scenario:opening-transfer-enclosure", "Scenario"),
  ],
  arcs: [{
    id: OPENING_CURRICULUM_IDS.arc,
    experiencedPressure: "A familiar feeding route fails because maintenance state is outside Worker Context.",
    targetConcept: "Context boundaries and selective routing",
    availableMechanics: ["Context inspection", "Park Developer", "Review and Deployment", "Trace"],
    prerequisiteDemonstrations: ["Complete one feeding with the supplied instruction"],
    scenarioIds: [OPENING_CURRICULUM_IDS.scenario],
    transferCaseId: OPENING_CURRICULUM_IDS.transfer,
    masteryPeriod: "The revised feeding route reruns successfully and the park opens without extra intervention.",
    optionalExpansion: "A later enclosure changes species, gate, and route while preserving the missing-context concept.",
    playtestTagIds: ["playtest:opening-accessibility", "playtest:opening-authenticity", "playtest:opening-comprehension", "playtest:opening-timing"],
  }],
  scenarios: [{
    id: OPENING_CURRICULUM_IDS.scenario,
    version: "1.0.0",
    schemaVersion: "1",
    arcId: OPENING_CURRICULUM_IDS.arc,
    seed: 1601,
    setting: { phase: "pre-opening", timeOfDay: "dawn", parkClosed: true, openingDeadline: { dueTick: 300, pausable: true, guidanceHasNoRewardPenalty: true } },
    entities: {
      hungryDinosaurId: "dinosaur:tria", secondDinosaurId: "dinosaur:stella", workerAgentId: "robot:alpha", visitorConvoyId: "visitor:morning",
      firstEnclosureId: "enclosure:alpha", secondEnclosureId: "enclosure:beta", secondGateId: "gate:beta",
      secondGateAutomaticCloser: "disabled-for-maintenance",
    },
    exactReferences: [
      ref("task:feed-triceratops", "Task"), ref("park:feed-triceratops", "Prompt"), ref("park:safe-feeding", "Skill"),
      ref("park:containment-policy", "Policy"), ref("content:maintenance-policy", "Knowledge"), ref("tool:bait", "Tool"),
      ref("tool:feed", "Tool"), ref("tool:gate-control", "Tool"), ref("tool:gate-observe", "Tool"),
    ],
    jobs: [
      {
        id: "job:opening-feed-alpha", task: ref("task:feed-triceratops", "Task"), targetId: "dinosaur:tria",
        partiallyConfigured: true, requiredPlayerAction: "assign-instruction",
        artifactVersions: [ref("park:containment-policy", "Policy"), ref("park:feed-triceratops", "Prompt"), ref("park:safe-feeding", "Skill")],
        contextRouteIds: ["route:feeding-task", "route:feeding-prompt", "route:gate-tool", "route:species-knowledge"], expectedOutcomeId: "outcome:first-feed-success",
      },
      {
        id: "job:opening-feed-beta", task: ref("task:feed-triceratops", "Task"), targetId: "dinosaur:stella", assignedAgentId: "robot:alpha",
        partiallyConfigured: false, requiredPlayerAction: "reuse-instruction",
        artifactVersions: [ref("park:containment-policy", "Policy"), ref("park:feed-triceratops", "Prompt"), ref("park:safe-feeding", "Skill")],
        contextRouteIds: ["route:feeding-task", "route:feeding-prompt", "route:gate-tool", "route:species-knowledge"], expectedOutcomeId: "outcome:near-miss",
      },
      {
        id: "job:opening-feed-beta-rerun", task: ref("task:feed-triceratops", "Task"), targetId: "dinosaur:stella", assignedAgentId: "robot:alpha",
        partiallyConfigured: false, requiredPlayerAction: "deploy-and-rerun",
        artifactVersions: [ref("park:containment-policy", "Policy"), ref("park:feed-triceratops-revised", "Prompt"), ref("park:safe-feeding", "Skill")],
        contextRouteIds: ["route:feeding-task", "route:feeding-prompt", "route:gate-tool", "route:maintenance-policy-revised", "route:species-knowledge"], expectedOutcomeId: "outcome:rerun-success",
      },
    ],
    contextRoutes: [
      { id: "route:feeding-prompt", item: ref("park:feed-triceratops", "Prompt"), routed: true },
      { id: "route:feeding-task", item: ref("task:feed-triceratops", "Task"), routed: true },
      { id: "route:gate-tool", item: ref("tool:gate-control", "Tool"), routed: true },
      { id: "route:maintenance-policy", item: ref("content:maintenance-policy", "Knowledge"), routed: false, unavailableReason: "not-routed" },
      { id: "route:maintenance-policy-revised", item: ref("content:maintenance-policy", "Knowledge"), routed: true },
      { id: "route:species-knowledge", item: ref("knowledge:triceratops-care", "Knowledge"), routed: true },
    ],
    guidanceIds: ["guidance:opening-assign", "guidance:opening-diagnose"],
    incident: {
      id: "incident:opening-gate-beta", expectedCopyId: "copy:incident-expected", observedCopyId: "copy:incident-observed",
      consequenceCopyId: "copy:incident-consequence", immediateGapCopyId: "copy:incident-gap",
      affectedEntityIds: ["dinosaur:stella", "gate:beta", "robot:alpha"], traceIds: ["trace:opening-feed-beta"],
      responsibleArtifact: ref("park:feed-triceratops", "Prompt"),
    },
    workbench: {
      choices: [
        { id: "choice:revise-instruction", labelCopyId: "copy:choice-revise", action: "revise-feeding-instruction" },
        { id: "choice:route-context", labelCopyId: "copy:choice-route", action: "route-maintenance-context" },
      ],
      freeEval: { ...ref("eval:opening-maintenance-context", "EvalCase"), authoringCost: 0 },
      candidate: ref("park:feed-triceratops-revised", "Prompt"), review: ref("review:opening-feeding-revision", "Review"),
      deployment: ref("deployment:opening-feeding-revision", "Deployment"), reward: ref("reward:dinosaur-plushie", "Reward"),
      handbookEntryId: "handbook:context-boundary",
    },
    goldenOutcomes: [
      { id: "outcome:first-feed-success", order: 0, trigger: "Assign the supplied instruction to Robot Alpha.", result: "feeding-succeeded", fatalities: 0, injuries: 0, recoverable: true, causalLinkIds: ["job:opening-feed-alpha"] },
      { id: "outcome:near-miss", order: 1, trigger: "Reuse the instruction while maintenance Context is unavailable.", result: "near-miss-stabilized", fatalities: 0, injuries: 0, recoverable: true, causalLinkIds: ["incident:opening-gate-beta", "trace:opening-feed-beta"] },
      { id: "outcome:eval-pass", order: 2, trigger: "Run the free maintenance-context Eval against the candidate.", result: "eval-passed", fatalities: 0, injuries: 0, recoverable: true, causalLinkIds: ["eval:opening-maintenance-context", "review:opening-feeding-revision"] },
      { id: "outcome:rerun-success", order: 3, trigger: "Deploy the reviewed exact version and rerun the second feeding.", result: "feeding-succeeded", fatalities: 0, injuries: 0, recoverable: true, causalLinkIds: ["deployment:opening-feeding-revision", "job:opening-feed-beta-rerun"] },
      { id: "outcome:park-open", order: 4, trigger: "Issue the intentional opening command after required work succeeds.", result: "park-opened", fatalities: 0, injuries: 0, recoverable: true, causalLinkIds: ["command:open-park"] },
    ],
    assetDependency,
  }],
  unlocks: [
    { id: "unlock:opening-start", prerequisites: [], grants: [ref("park:feed-triceratops", "Prompt")], triggerEventId: "event:park-loaded" },
    { id: "unlock:opening-workbench", prerequisites: ["unlock:opening-start"], grants: [ref("eval:opening-maintenance-context", "EvalCase"), ref("workbench:minimum-opening", "WorkbenchSurface")], triggerEventId: "outcome:near-miss" },
    { id: "unlock:opening-reward", prerequisites: ["unlock:opening-workbench"], grants: [ref("reward:dinosaur-plushie", "Reward"), ref("handbook:context-boundary", "HandbookEntry")], triggerEventId: "outcome:park-open" },
  ],
  guidance: [
    {
      id: "guidance:opening-assign", worldCue: "The hungry dinosaur calls while Robot Alpha waits beside the route.",
      affordanceEmphasis: "Emphasize the dinosaur and available Worker without blocking other controls.", conciseHint: "Robot Alpha can take the feeding job.",
      explicitHelp: "Select Robot Alpha, choose the feeding job, then assign the supplied instruction.", skipCondition: "The player assigns any instruction to the first feeding job.",
      accessibilityEquivalent: "Persistent text names the hungry dinosaur, available Worker, feeding job, and deadline.",
      copyIds: ["copy:guidance-assign-help", "copy:guidance-assign-hint"],
    },
    {
      id: "guidance:opening-diagnose", worldCue: "The disabled closer and open gate remain visible after the park pauses.",
      affordanceEmphasis: "Emphasize the incident evidence link after the player inspects the gate.", conciseHint: "Compare what changed with what the Worker received.",
      explicitHelp: "Open the incident, follow its Trace, and inspect unavailable Context for the maintenance state.", skipCondition: "The player opens the missing maintenance Context record.",
      accessibilityEquivalent: "Persistent incident text states closer status, gate state, affected entities, and the missing route.",
      copyIds: ["copy:guidance-diagnose-help", "copy:guidance-diagnose-hint"],
    },
  ],
  transfers: [{
    id: OPENING_CURRICULUM_IDS.transfer, concept: "Context boundaries and selective routing",
    scenario: ref("scenario:opening-transfer-enclosure", "Scenario"),
    changedSurfaceDetails: ["different dinosaur species", "different enclosure and gate", "maintenance note supplied by a different source"],
    withheldGuidanceIds: ["guidance:opening-assign", "guidance:opening-diagnose"], successEventId: "event:transfer-context-routed",
  }],
  handbook: [{
    id: "handbook:context-boundary", term: "Context", definitionCopyId: "copy:handbook-context-definition",
    visualGrammarCopyId: "copy:handbook-context-visual", encounteredExampleCopyId: "copy:handbook-context-example",
    unlockId: "unlock:opening-reward", agentContextEligible: false,
  }],
  copy: {
    "copy:choice-revise": "Revise the feeding instruction",
    "copy:choice-route": "Route maintenance state to the Worker",
    "copy:guidance-assign-help": "Select Robot Alpha, choose the feeding job, then assign the supplied instruction.",
    "copy:guidance-assign-hint": "Robot Alpha can take the feeding job.",
    "copy:guidance-diagnose-help": "Follow the incident Trace and inspect unavailable Context.",
    "copy:guidance-diagnose-hint": "Compare what changed with what the Worker received.",
    "copy:handbook-context-definition": "Context is the finite, provenance-labeled information available to an Agent for a decision.",
    "copy:handbook-context-example": "The gate closer was disabled in the park but its maintenance record was not routed to Robot Alpha.",
    "copy:handbook-context-visual": "Included, unavailable, and excluded items use text labels and distinct shapes as well as color.",
    "copy:incident-consequence": "A dinosaur reached the empty service lane before visitors arrived; the park paused and containment was restored.",
    "copy:incident-expected": "The feeding instruction expected the automatic closer to restore containment.",
    "copy:incident-gap": "The closer was disabled for maintenance, but that record was not routed into Worker Context.",
    "copy:incident-observed": "The gate remained open after Robot Alpha left the second enclosure.",
  },
  assetBundles: [assetDependency],
  playtestTags: [
    { id: "playtest:opening-accessibility", purpose: "accessibility", measure: "Required cues and actions remain equivalent by keyboard, text, non-color state, and paused time." },
    { id: "playtest:opening-authenticity", purpose: "authenticity", measure: "Experienced Agent users identify the failure as a credible missing-context fault." },
    { id: "playtest:opening-comprehension", purpose: "comprehension", measure: "A newcomer diagnoses the unavailable maintenance record without facilitator explanation." },
    { id: "playtest:opening-timing", purpose: "timing", measure: "Record elapsed play time against the provisional five-minute opening target without penalizing pause or guidance." },
  ],
};

export const createOpeningCurriculumPackage = (): CurriculumPackage => {
  const value = structuredClone(unsignedOpeningPackage);
  return { ...value, fingerprint: fingerprint(value) };
};

const referenceInventory = [
  ...unsignedOpeningPackage.dependencies,
  ...unsignedOpeningPackage.scenarios[0]!.exactReferences,
  ref("knowledge:triceratops-care", "Knowledge"), ref("park:feed-triceratops-revised", "Prompt"),
  ref("review:opening-feeding-revision", "Review"), ref("deployment:opening-feeding-revision", "Deployment"),
  ref("reward:dinosaur-plushie", "Reward"), ref("workbench:minimum-opening", "WorkbenchSurface"),
  ref("handbook:context-boundary", "HandbookEntry"), ...assetDependency.requiredAssets,
];

export const createOpeningCurriculumInventory = (): CurriculumValidationInventory => ({
  exactReferences: new Map(referenceInventory.map((reference) => [`${reference.id}@${reference.version}`, { expectedClass: reference.expectedClass, expectedSchemaVersion: reference.expectedSchemaVersion }])),
  entityIds: new Set(["dinosaur:stella", "dinosaur:tria", "enclosure:alpha", "enclosure:beta", "gate:beta", "robot:alpha", "visitor:morning"]),
  assetBundles: new Map([[`${assetDependency.bundleId}@${assetDependency.bundleVersion}`, new Set(assetDependency.requiredAssets.map((reference) => `${reference.id}@${reference.version}`))]]),
});
