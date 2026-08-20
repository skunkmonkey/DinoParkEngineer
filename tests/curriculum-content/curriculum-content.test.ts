import assert from "node:assert/strict";
import test from "node:test";

import { fingerprint } from "../../src/content-registry/public.js";
import {
  createOpeningCurriculumInventory,
  createOpeningCurriculumPackage,
  curriculumPackageSchema,
  OPENING_CURRICULUM_IDS,
  OPENING_RUNTIME_ASSET_IDS,
  projectGoldenOutcomes,
  validateCurriculumPackage,
  type CurriculumPackage,
  type CurriculumValidationInventory,
} from "../../src/curriculum-content/public.js";

const resign = (pkg: CurriculumPackage): CurriculumPackage => {
  const { fingerprint: ignored, ...unsigned } = pkg;
  void ignored;
  return { ...unsigned, fingerprint: fingerprint(unsigned) };
};

const validateOpening = () => {
  const result = validateCurriculumPackage(createOpeningCurriculumPackage(), createOpeningCurriculumInventory());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.diagnostics.map((entry) => entry.message).join("\n"));
  return result;
};

test("opening package validates exact references, unlock reachability, asset readiness, and stable fingerprint", () => {
  const first = createOpeningCurriculumPackage();
  const second = createOpeningCurriculumPackage();
  assert.equal(first.fingerprint, second.fingerprint);
  const result = validateOpening();
  assert.equal(result.report.identity, `${OPENING_CURRICULUM_IDS.package}@1.0.0`);
  assert.deepEqual(result.report.assetBundleIdentities, [`${OPENING_CURRICULUM_IDS.bundle}@${OPENING_CURRICULUM_IDS.bundleVersion}`]);
  assert.deepEqual(result.package.assetBundles[0]?.requiredAssets.map((asset) => asset.id), OPENING_RUNTIME_ASSET_IDS);
  assert.deepEqual(result.package.unlocks.map((unlock) => unlock.id), ["unlock:opening-start", "unlock:opening-workbench", "unlock:opening-reward"]);
});

test("dawn scenario authors the closed pausable park, partial first success, changed closer, and explicit Context omission", () => {
  const scenario = validateOpening().package.scenarios[0]!;
  assert.deepEqual(scenario.setting, { phase: "pre-opening", timeOfDay: "dawn", parkClosed: true, openingDeadline: { dueTick: 300, pausable: true, guidanceHasNoRewardPenalty: true } });
  assert.equal(scenario.entities.secondDinosaurId, "dinosaur:stella");
  assert.equal(scenario.entities.secondGateAutomaticCloser, "disabled-for-maintenance");
  assert.equal(scenario.jobs[0]?.partiallyConfigured, true);
  assert.equal(scenario.jobs[0]?.assignedAgentId, undefined);
  assert.equal(scenario.jobs[0]?.requiredPlayerAction, "assign-instruction");
  assert.equal(scenario.jobs[0]?.expectedOutcomeId, "outcome:first-feed-success");
  const omitted = scenario.contextRoutes.find((route) => route.id === "route:maintenance-policy");
  assert.deepEqual(omitted, { id: "route:maintenance-policy", item: { id: "content:maintenance-policy", version: "1.0.0", expectedClass: "Knowledge", expectedSchemaVersion: "1" }, routed: false, unavailableReason: "not-routed" });
  assert.equal(scenario.jobs[1]?.contextRouteIds.includes("route:maintenance-policy"), false);
  assert.equal(scenario.jobs[2]?.contextRouteIds.includes("route:maintenance-policy-revised"), true);
});

test("golden opening is deterministic, recoverable, nonfatal, and includes rerun plus intentional opening", () => {
  const pkg = validateOpening().package;
  const first = projectGoldenOutcomes(pkg, OPENING_CURRICULUM_IDS.scenario);
  const second = projectGoldenOutcomes(pkg, OPENING_CURRICULUM_IDS.scenario);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((outcome) => outcome.result), ["feeding-succeeded", "near-miss-stabilized", "eval-passed", "feeding-succeeded", "park-opened"]);
  assert.equal(first.every((outcome) => outcome.fatalities === 0 && outcome.injuries === 0 && outcome.recoverable), true);
  assert.deepEqual(first[1]?.causalLinkIds, ["incident:opening-gate-beta", "trace:opening-feed-beta"]);
});

test("incident, minimum Workbench path, free Eval, reward, and Handbook placeholders stay concise and explicit", () => {
  const pkg = validateOpening().package;
  const scenario = pkg.scenarios[0]!;
  const incidentCopyIds = [scenario.incident.expectedCopyId, scenario.incident.observedCopyId, scenario.incident.consequenceCopyId, scenario.incident.immediateGapCopyId];
  assert.equal(incidentCopyIds.every((id) => (pkg.copy[id]?.length ?? 0) > 0 && (pkg.copy[id]?.length ?? 0) < 180), true);
  assert.deepEqual(scenario.workbench.choices.map((choice) => choice.action), ["revise-feeding-instruction", "route-maintenance-context"]);
  assert.equal(scenario.workbench.freeEval.authoringCost, 0);
  assert.equal(scenario.workbench.review.expectedClass, "Review");
  assert.equal(scenario.workbench.deployment.expectedClass, "Deployment");
  assert.equal(scenario.workbench.reward.expectedClass, "Reward");
  assert.equal(pkg.handbook[0]?.agentContextEligible, false);
});

test("guidance has action-skippable accessible equivalents and transfer withholds opening instructions", () => {
  const pkg = validateOpening().package;
  assert.equal(pkg.guidance.every((record) => record.worldCue && record.affordanceEmphasis && record.conciseHint && record.explicitHelp && record.skipCondition && record.accessibilityEquivalent), true);
  assert.deepEqual(pkg.transfers[0]?.withheldGuidanceIds, pkg.scenarios[0]?.guidanceIds);
  assert.equal(pkg.playtestTags.some((tag) => tag.purpose === "accessibility"), true);
  assert.equal(pkg.playtestTags.some((tag) => tag.purpose === "timing" && tag.measure.includes("five-minute")), true);
});

test("boundary schema rejects executable content and malformed imported package data", () => {
  const pkg = createOpeningCurriculumPackage();
  assert.equal(curriculumPackageSchema.safeParse({ ...pkg, executable: () => "unsafe" }).success, false);
  assert.equal(validateCurriculumPackage({ ...pkg, copy: { ...pkg.copy, "copy:incident-gap": () => "unsafe" } }, createOpeningCurriculumInventory()).ok, false);
});

test("validation reports missing exact references, asset contents, circular unlocks, and fatal onboarding", () => {
  const pkg = createOpeningCurriculumPackage();
  const inventory = createOpeningCurriculumInventory();
  const references = new Map(inventory.exactReferences);
  references.delete("park:feed-triceratops@1.0.0");
  const missingReference = validateCurriculumPackage(pkg, { ...inventory, exactReferences: references });
  assert.equal(missingReference.ok, false);
  if (!missingReference.ok) assert.equal(missingReference.diagnostics.some((entry) => entry.code === "CURRICULUM_REFERENCE_MISSING"), true);

  const missingAssets: CurriculumValidationInventory = { ...inventory, assetBundles: new Map([[`${OPENING_CURRICULUM_IDS.bundle}@1.0.0`, new Set<string>()]]) };
  const assetResult = validateCurriculumPackage(pkg, missingAssets);
  assert.equal(assetResult.ok, false);
  if (!assetResult.ok) assert.equal(assetResult.diagnostics.some((entry) => entry.code === "CURRICULUM_ASSET_MISSING"), true);

  const circular = resign({ ...pkg, unlocks: pkg.unlocks.map((unlock, index) => index === 0 ? { ...unlock, prerequisites: ["unlock:opening-reward"] } : unlock) });
  const circularResult = validateCurriculumPackage(circular, inventory);
  assert.equal(circularResult.ok, false);
  if (!circularResult.ok) assert.equal(circularResult.diagnostics.some((entry) => entry.code === "CURRICULUM_UNLOCK_CYCLE"), true);

  const fatalScenario = { ...pkg.scenarios[0]!, goldenOutcomes: pkg.scenarios[0]!.goldenOutcomes.map((outcome, index) => index === 1 ? { ...outcome, fatalities: 1 } : outcome) };
  const fatal = resign({ ...pkg, scenarios: [fatalScenario] });
  const fatalResult = validateCurriculumPackage(fatal, inventory);
  assert.equal(fatalResult.ok, false);
  if (!fatalResult.ok) assert.equal(fatalResult.diagnostics.some((entry) => entry.code === "CURRICULUM_FATAL_ONBOARDING"), true);
});
