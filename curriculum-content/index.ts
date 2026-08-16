export * from "./types.ts";
export * from "./artifacts.ts";
export * from "./park.ts";
export * from "./evals.ts";
export * from "./phases.ts";
export * from "./manager.ts";
export * from "./recipe.ts";
export * from "./workflow.ts";
export * from "./pack.ts";
export * from "./scenario-director.ts";
export * from "./validation.ts";

import { createContentRegistry, type ContentRegistry } from "../content-registry/index.ts";
import { CURRICULUM_CONTENT_PACK } from "./pack.ts";
import { assertCurriculumPack, curriculumManifestHash } from "./validation.ts";
import { replayGolden, runGoldenRevisionFailure, runGoldenRevisionSuccess, runGoldenSafe, runGoldenUnsafe, runPhase10ScaleComparison, runPolicyRefactorComparison } from "./scenario-director.ts";
import type { GoldenReplayResult, GoldenTrace } from "./types.ts";

export function createCurriculumContentRegistry(): ContentRegistry {
  assertCurriculumPack(CURRICULUM_CONTENT_PACK);
  const registry = createContentRegistry();
  const loaded = registry.loadPack(CURRICULUM_CONTENT_PACK);
  if (!loaded.ok) throw new Error(`Curriculum content pack failed to load: ${loaded.error.map((item) => `${item.code}: ${item.message}`).join("; ")}`);
  return registry;
}

export interface CurriculumAcceptanceReport {
  readonly valid: boolean;
  readonly packHash: string;
  readonly counts: ReturnType<typeof assertCurriculumPack>["counts"];
  readonly firstSlice: {
    readonly browserRecognizable: boolean;
    readonly unsafe: GoldenTrace;
    readonly safe: GoldenTrace;
    readonly revisionFailure: GoldenTrace;
    readonly revisionSuccess: GoldenTrace;
    readonly contextCostReduced: boolean;
  };
  readonly failureReplay: GoldenReplayResult;
  readonly successReplay: GoldenReplayResult;
  readonly policyRefactor: ReturnType<typeof runPolicyRefactorComparison>;
  readonly scaleComparison: ReturnType<typeof runPhase10ScaleComparison>;
  readonly blockers: readonly string[];
}

export function runCurriculumAcceptance(): CurriculumAcceptanceReport {
  const validation = assertCurriculumPack(CURRICULUM_CONTENT_PACK);
  const unsafe = runGoldenUnsafe();
  const safe = runGoldenSafe();
  const revisionFailure = runGoldenRevisionFailure();
  const revisionSuccess = runGoldenRevisionSuccess();
  const failureReplay = replayGolden(revisionFailure);
  const successReplay = replayGolden(safe);
  const policyRefactor = runPolicyRefactorComparison();
  const scaleComparison = runPhase10ScaleComparison();
  const blockers: string[] = [];
  if (unsafe.outcome !== "INCIDENT") blockers.push(`unsafe golden expected INCIDENT, observed ${unsafe.outcome}`);
  if (unsafe.missingPostconditions.length === 0) blockers.push("unsafe golden did not expose a missing containment postcondition");
  if (safe.outcome !== "SUCCEEDED") blockers.push(`safe golden expected SUCCEEDED, observed ${safe.outcome}`);
  if (!revisionFailure.outcome || !["FAILED", "ESCALATED"].includes(revisionFailure.outcome)) blockers.push("revision failure golden did not fail or escalate");
  if (!revisionSuccess.outcome || !["SUCCEEDED", "ESCALATED"].includes(revisionSuccess.outcome)) blockers.push("revision success golden did not complete safely");
  if (!failureReplay.exact) blockers.push("revision failure replay diverged");
  if (!successReplay.exact) blockers.push("safe success replay diverged");
  if (safe.contextLoad >= unsafe.contextLoad) blockers.push(`safe modular context ${safe.contextLoad} CU is not below unsafe context ${unsafe.contextLoad} CU`);
  if (!policyRefactor.cheaper) blockers.push(`centralized policy context ${policyRefactor.refactoredLoad} CU is not cheaper than duplicated context ${policyRefactor.duplicatedLoad} CU`);
  if (!scaleComparison.fewerInterventions) blockers.push(`phase 10 interventions ${scaleComparison.lateInterventions} are not below early interventions ${scaleComparison.earlyInterventions}`);
  const browserRecognizable = unsafe.events.length > 0 && safe.events.length > 0 && revisionFailure.events.length > 0 && revisionSuccess.events.length > 0;
  return Object.freeze({ valid: blockers.length === 0, packHash: curriculumManifestHash(), counts: validation.counts, firstSlice: { browserRecognizable, unsafe, safe, revisionFailure, revisionSuccess, contextCostReduced: safe.contextLoad < unsafe.contextLoad }, failureReplay, successReplay, policyRefactor, scaleComparison, blockers: Object.freeze(blockers) });
}
