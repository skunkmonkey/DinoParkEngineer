import type {
  ArtifactRef,
  ArtifactVersion,
  ContentPack,
  EvalCaseDefinition,
  ProgressionDefinition,
  ScenarioDefinition,
} from "../content-registry/index.ts";
import type { WorldEvent, WorldSnapshot } from "../simulation/index.ts";
import type { ManagerConfig } from "../orchestration/index.ts";

/** A player-facing objective authored separately from the deterministic rules. */
export interface CurriculumObjective {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly completionSignals: readonly string[];
}

export interface CurriculumIncident {
  readonly id: string;
  readonly trigger: string;
  readonly severity: 0 | 1 | 2 | 3 | 4;
  readonly diagnosis: string;
  readonly spoilerSafeHint: string;
}

export interface CurriculumRecovery {
  readonly id: string;
  readonly label: string;
  readonly steps: readonly string[];
  readonly preventsDeadEnd: boolean;
  readonly assistanceCostCredits?: number;
}

/** Rich phase data consumed by ScenarioDirector. The registry receives the
 * compatible ProgressionDefinition projection from the pack. */
export interface CurriculumPhaseDefinition extends ProgressionDefinition {
  readonly entrySignals: readonly string[];
  readonly fixtureId: string;
  readonly fixtureDelta: Readonly<Record<string, string | number | boolean>>;
  readonly objectives: readonly CurriculumObjective[];
  readonly availableRefs: readonly ArtifactRef[];
  readonly availableEvalRefs: readonly ArtifactRef[];
  readonly teachingIncident: CurriculumIncident;
  readonly successAssertions: readonly string[];
  readonly recovery: CurriculumRecovery;
  readonly completionOutputs: readonly string[];
  readonly interventionTarget: number;
}

export interface CurriculumBalance {
  readonly openingCredits: number;
  readonly settlement: Readonly<Record<string, number>>;
  readonly commissionCosts: Readonly<Record<string, number>>;
  readonly evalBuildCosts: Readonly<Record<string, number>>;
  readonly evalRunCosts: Readonly<Record<string, number>>;
  readonly purchaseCosts: Readonly<Record<string, number>>;
  readonly incidentCosts: Readonly<Record<0 | 1 | 2 | 3 | 4, number>>;
  readonly contextCapacity: readonly number[];
  readonly recovery: Readonly<{ readonly floor: number; readonly assistanceAmount: number }>;
}

export interface CurriculumEvalSuite {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description: string;
  readonly evalRefs: readonly { readonly id: string; readonly version: number }[];
}

export interface GoldenTrace {
  readonly scenarioId: string;
  readonly mode: "UNSAFE" | "SAFE" | "REVISION_FAILURE" | "REVISION_SUCCESS";
  readonly seed: number;
  readonly events: readonly WorldEvent[];
  readonly snapshot: WorldSnapshot;
  readonly outcome: "INCIDENT" | "SUCCEEDED" | "ESCALATED" | "FAILED" | "BLOCKED";
  readonly missingPostconditions: readonly string[];
  readonly contextLoad: number;
  readonly contextBudget: number;
  readonly artifactRefs: readonly ArtifactRef[];
}

export interface GoldenReplayResult {
  readonly exact: boolean;
  readonly firstDifference?: string;
  readonly original: GoldenTrace;
  readonly replay: GoldenTrace;
}

export interface CurriculumContextComparison {
  readonly duplicatedLoad: number;
  readonly refactoredLoad: number;
  readonly cheaper: boolean;
  readonly duplicatedRefs: readonly ArtifactRef[];
  readonly refactoredRefs: readonly ArtifactRef[];
}

export interface CurriculumScaleComparison {
  readonly earlyRuns: readonly GoldenTrace[];
  readonly lateRuns: readonly GoldenTrace[];
  readonly earlyInterventions: number;
  readonly lateInterventions: number;
  readonly fewerInterventions: boolean;
}

export interface CurriculumContentPack extends ContentPack {
  readonly balance: CurriculumBalance;
  readonly phases: readonly CurriculumPhaseDefinition[];
  readonly authoredArtifacts: readonly ArtifactVersion[];
  readonly authoredEvals: readonly EvalCaseDefinition[];
  readonly authoredScenarios: readonly ScenarioDefinition[];
  readonly evalSuites: readonly CurriculumEvalSuite[];
  readonly managerConfigs: readonly ManagerConfig[];
}

export interface CurriculumPackValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly counts: Readonly<{
    readonly phases: number;
    readonly artifacts: number;
    readonly skillsAndPolicies: number;
    readonly evals: number;
    readonly scenarios: number;
  }>;
  readonly manifestHash: string;
}
