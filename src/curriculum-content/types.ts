export interface ExactContentReference {
  readonly id: string;
  readonly version: string;
  readonly expectedClass: string;
  readonly expectedSchemaVersion: string;
}

export interface AssetBundleDependency {
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly requiredAssets: readonly ExactContentReference[];
}

export interface PlaytestTag {
  readonly id: string;
  readonly purpose: "comprehension" | "timing" | "transfer" | "accessibility" | "authenticity";
  readonly measure: string;
}

export interface GuidanceRecord {
  readonly id: string;
  readonly worldCue: string;
  readonly affordanceEmphasis: string;
  readonly conciseHint: string;
  readonly explicitHelp: string;
  readonly skipCondition: string;
  readonly accessibilityEquivalent: string;
  readonly copyIds: readonly string[];
}

export interface TransferCase {
  readonly id: string;
  readonly concept: string;
  readonly scenario: ExactContentReference;
  readonly changedSurfaceDetails: readonly string[];
  readonly withheldGuidanceIds: readonly string[];
  readonly successEventId: string;
  readonly fixture: {
    readonly seed: number;
    readonly speciesId: string;
    readonly dinosaurId: string;
    readonly enclosureId: string;
    readonly gateId: string;
    readonly maintenanceSourceId: string;
    readonly task: ExactContentReference;
    readonly speciesKnowledge: ExactContentReference;
    readonly missingContextRoute: ContextRouteFixture;
    readonly revisedContextRoute: ContextRouteFixture;
  };
  readonly openingGuidanceDisabled: true;
  readonly observableSuccess: {
    readonly requiredActionIds: readonly string[];
    readonly eventId: string;
    readonly result: "feeding-succeeded";
    readonly fatalities: 0;
    readonly injuries: 0;
  };
  readonly delayedAssistance: {
    readonly optional: true;
    readonly availableAfterEventId: string;
    readonly guidanceId: string;
    readonly rewardPenalty: false;
  };
}

export interface OpeningSequenceBeat {
  readonly id: string;
  readonly targetCumulativeSeconds: number;
  readonly action: string;
  readonly observableEventId: string;
}

export interface OpeningRunContract {
  readonly targetHumanSeconds: 300;
  readonly timingAcceptance: "human-playtest-required";
  readonly pauseExcluded: true;
  readonly guidancePenalty: false;
  readonly successCopyId: string;
  readonly beats: readonly OpeningSequenceBeat[];
}

export interface HandbookEntry {
  readonly id: string;
  readonly term: string;
  readonly definitionCopyId: string;
  readonly visualGrammarCopyId: string;
  readonly encounteredExampleCopyId: string;
  readonly unlockId: string;
  readonly agentContextEligible: false;
}

export interface UnlockRecord {
  readonly id: string;
  readonly prerequisites: readonly string[];
  readonly grants: readonly ExactContentReference[];
  readonly triggerEventId: string;
}

export interface OpeningJob {
  readonly id: string;
  readonly task: ExactContentReference;
  readonly targetId: string;
  readonly assignedAgentId?: string;
  readonly partiallyConfigured: boolean;
  readonly requiredPlayerAction: "assign-instruction" | "reuse-instruction" | "deploy-and-rerun";
  readonly artifactVersions: readonly ExactContentReference[];
  readonly contextRouteIds: readonly string[];
  readonly expectedOutcomeId: string;
}

export interface ContextRouteFixture {
  readonly id: string;
  readonly item: ExactContentReference;
  readonly routed: boolean;
  readonly unavailableReason?: "not-routed";
}

export interface GoldenOutcome {
  readonly id: string;
  readonly order: number;
  readonly trigger: string;
  readonly result: "feeding-succeeded" | "near-miss-stabilized" | "eval-passed" | "park-opened";
  readonly fatalities: number;
  readonly injuries: number;
  readonly recoverable: boolean;
  readonly causalLinkIds: readonly string[];
}

export interface OpeningScenario {
  readonly id: string;
  readonly version: string;
  readonly schemaVersion: "1";
  readonly arcId: string;
  readonly seed: number;
  readonly setting: {
    readonly phase: "pre-opening";
    readonly timeOfDay: "dawn";
    readonly parkClosed: true;
    readonly openingDeadline: { readonly dueTick: number; readonly pausable: true; readonly guidanceHasNoRewardPenalty: true };
  };
  readonly entities: {
    readonly hungryDinosaurId: string;
    readonly secondDinosaurId: string;
    readonly workerAgentId: string;
    readonly visitorConvoyId: string;
    readonly firstEnclosureId: string;
    readonly secondEnclosureId: string;
    readonly secondGateId: string;
    readonly secondGateAutomaticCloser: "disabled-for-maintenance";
  };
  readonly exactReferences: readonly ExactContentReference[];
  readonly jobs: readonly OpeningJob[];
  readonly contextRoutes: readonly ContextRouteFixture[];
  readonly guidanceIds: readonly string[];
  readonly incident: {
    readonly id: string;
    readonly expectedCopyId: string;
    readonly observedCopyId: string;
    readonly consequenceCopyId: string;
    readonly immediateGapCopyId: string;
    readonly affectedEntityIds: readonly string[];
    readonly traceIds: readonly string[];
    readonly responsibleArtifact: ExactContentReference;
  };
  readonly workbench: {
    readonly choices: readonly { readonly id: string; readonly labelCopyId: string; readonly action: "route-maintenance-context" | "revise-feeding-instruction" }[];
    readonly freeEval: ExactContentReference & { readonly authoringCost: 0 };
    readonly candidate: ExactContentReference;
    readonly review: ExactContentReference;
    readonly deployment: ExactContentReference;
    readonly reward: ExactContentReference;
    readonly handbookEntryId: string;
  };
  readonly goldenOutcomes: readonly GoldenOutcome[];
  readonly assetDependency: AssetBundleDependency;
}

export interface CurriculumArc {
  readonly id: string;
  readonly experiencedPressure: string;
  readonly targetConcept: string;
  readonly availableMechanics: readonly string[];
  readonly prerequisiteDemonstrations: readonly string[];
  readonly scenarioIds: readonly string[];
  readonly transferCaseId: string;
  readonly masteryPeriod: string;
  readonly optionalExpansion: string;
  readonly playtestTagIds: readonly string[];
}

export interface CurriculumPackage {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly schemaVersion: "1";
  readonly compatibleDomainSchemas: Readonly<Record<string, string>>;
  readonly dependencies: readonly ExactContentReference[];
  readonly arcs: readonly CurriculumArc[];
  readonly scenarios: readonly OpeningScenario[];
  readonly unlocks: readonly UnlockRecord[];
  readonly guidance: readonly GuidanceRecord[];
  readonly transfers: readonly TransferCase[];
  readonly handbook: readonly HandbookEntry[];
  readonly copy: Readonly<Record<string, string>>;
  readonly assetBundles: readonly AssetBundleDependency[];
  readonly playtestTags: readonly PlaytestTag[];
  readonly openingRun: OpeningRunContract;
  readonly fingerprint: string;
}

export interface CurriculumValidationInventory {
  readonly exactReferences: ReadonlyMap<string, { readonly expectedClass: string; readonly expectedSchemaVersion: string }>;
  readonly entityIds: ReadonlySet<string>;
  readonly assetBundles: ReadonlyMap<string, ReadonlySet<string>>;
}

export type CurriculumDiagnosticCode =
  | "CURRICULUM_INVALID"
  | "CURRICULUM_FINGERPRINT_MISMATCH"
  | "CURRICULUM_REFERENCE_MISSING"
  | "CURRICULUM_ENTITY_MISSING"
  | "CURRICULUM_UNLOCK_UNREACHABLE"
  | "CURRICULUM_UNLOCK_CYCLE"
  | "CURRICULUM_TRANSFER_MISSING"
  | "CURRICULUM_COPY_MISSING"
  | "CURRICULUM_ACCESSIBILITY_MISSING"
  | "CURRICULUM_ASSET_BUNDLE_MISSING"
  | "CURRICULUM_ASSET_MISSING"
  | "CURRICULUM_FATAL_ONBOARDING"
  | "CURRICULUM_GOLDEN_INVALID"
  | "CURRICULUM_OPENING_TIMING_INVALID"
  | "CURRICULUM_SUCCESS_COPY_INVALID"
  | "CURRICULUM_TRANSFER_INVALID"
  | "CURRICULUM_HANDBOOK_UNLOCK_INVALID";

export interface CurriculumDiagnostic {
  readonly code: CurriculumDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type CurriculumValidationResult =
  | { readonly ok: true; readonly package: CurriculumPackage; readonly report: CurriculumReport }
  | { readonly ok: false; readonly diagnostics: readonly CurriculumDiagnostic[] };

export interface CurriculumReport {
  readonly identity: string;
  readonly fingerprint: string;
  readonly arcIds: readonly string[];
  readonly scenarioIds: readonly string[];
  readonly openingChain: readonly string[];
  readonly assetBundleIdentities: readonly string[];
  readonly timingTargetSeconds: number;
  readonly transferSuccessEvents: readonly string[];
}
