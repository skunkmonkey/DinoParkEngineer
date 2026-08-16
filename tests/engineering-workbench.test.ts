import assert from "node:assert/strict";
import test from "node:test";
import { createContentRegistry } from "../content-registry/index.ts";
import { createContextService } from "../context/index.ts";
import { createEconomyProgressionService } from "../economy-progression/index.ts";
import { createMvpEvalContentPack, createEvalService } from "../eval-runner/index.ts";
import { createReviewDemoContentPack, createReviewDeploymentService } from "../review-deployment/index.ts";
import { EVAL_CONFIGURATION_RECIPE, MEMORY_CONFIGURATION_RECIPE, SAFE_FEEDING_SKILL_RECIPE, TOOL_CONFIGURATION_RECIPE, createWorkbenchBaselineContentPack, createWorkbenchService } from "../engineering-workbench/index.ts";

function setup(openingBalance = 5_000) {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(createMvpEvalContentPack()).ok, true);
  assert.equal(registry.loadPack(createReviewDemoContentPack()).ok, true);
  assert.equal(registry.loadPack(createWorkbenchBaselineContentPack()).ok, true);
  const context = createContextService();
  const evals = createEvalService({ registry });
  const reviews = createReviewDeploymentService({ registry, context, evals, initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }] });
  const economy = createEconomyProgressionService({ openingBalance });
  economy.process({ id: "workbench.containment-pressure", type: "INCIDENT", logicalTime: 1, severity: 2, signal: "containment.pressure" });
  return { registry, context, evals, reviews, economy };
}

test("workbench slice 1 projects exact historical/deployed source and architecture", () => {
  const { registry, context, evals, reviews } = setup();
  const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, deployment: reviews.deployments });
  const detail = service.getAsset({ artifactId: "review.skill.carnivore-feeding", version: 3 });
  assert.ok(detail);
  if (!detail) return;
  assert.equal(detail.sourceText, "Feed Rex.");
  assert.equal(detail.status, "DEPLOYED");
  assert.equal(detail.current, true);
  assert.equal(detail.clauses[0]?.type, "GOAL");
  assert.deepEqual(detail.dependencies, []);
  assert.ok(detail.requiredToolIds.includes("open_gate"));
  assert.ok(detail.applicabilityTags.includes("task:feeding"));
  assert.ok(detail.context.every((profile) => profile.totalLoad === profile.items.reduce((sum, item) => sum + item.contextCost, 0)));
  assert.ok(detail.context.every((profile) => profile.diagnostics.length === 0));
  assert.ok(detail.history.some((asset) => asset.version === 4));
  assert.ok(Array.isArray(detail.usedBy));
  assert.ok(detail.reviews.length === 0);
  assert.equal(service.listAssets({ deployed: true }).some((asset) => asset.version === 3), true);
});

test("workbench slice 2 charges once, creates an exact Review proposal, and leaves deployed v3 unchanged", () => {
  const { registry, context, evals, reviews, economy } = setup();
  const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, deployment: reviews.deployments, economy });
  const offer = service.listCommissions(economy.snapshot()).find((item) => item.ref.artifactId === SAFE_FEEDING_SKILL_RECIPE.ref.artifactId);
  assert.equal(offer?.status, "AVAILABLE");
  const choices = [{ id: "verification-mode", optionId: "safe-containment" }] as const;
  const first = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, choices, "workbench.slice2.once");
  assert.equal(first.ok, true, first.ok ? "" : first.error.message);
  if (!first.ok) return;
  assert.equal(first.value.proposalRef.version, 5);
  assert.equal(registry.getArtifact({ artifactId: "review.skill.carnivore-feeding", version: 3 })?.status, "DEPLOYED");
  assert.equal(registry.getArtifact(first.value.proposalRef)?.status, "REVIEW");
  assert.equal(reviews.reviews.get(first.value.reviewId)?.state, "PENDING");
  const balanceAfter = economy.balance();
  assert.equal(balanceAfter.amount, 4_550);
  const duplicate = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, choices, "workbench.slice2.once");
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.value.duplicate, true);
  assert.deepEqual(economy.balance(), balanceAfter);
});

test("workbench slice 3 shows locked reasons without charging", () => {
  const { registry, context, evals, reviews, economy } = setup(100);
  const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, deployment: reviews.deployments, economy });
  const offer = service.listCommissions(economy.snapshot())[0];
  assert.equal(offer?.status, "LOCKED");
  assert.match(offer?.reason ?? "", /credits|phase|capability|prerequisite/i);
  const result = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, [{ id: "verification-mode", optionId: "safe-containment" }], "workbench.slice3.locked");
  assert.equal(result.ok, false);
  assert.equal(economy.balance().amount, 100);
  assert.equal(registry.getArtifact({ artifactId: "review.skill.carnivore-feeding", version: 5 }), undefined);
});

test("workbench slice 5 compensates a rejected Review intake and the same transaction id retries exactly once", () => {
  const { registry, context, evals, reviews, economy } = setup();
  const initial = economy.balance();
  const initialPackCount = registry.manifest().packs.length;
  let intakeAttempts = 0;
  const service = createWorkbenchService({ registry, context, evals, economy, reviews: reviews.reviews, reviewIntake: { submit: (proposal, meta) => {
    intakeAttempts += 1;
    if (intakeAttempts === 1) return { ok: false as const, error: { code: "REJECTED", message: "review store unavailable" } };
    const submitted = reviews.reviews.submit({ id: meta.reviewId ?? `review.retry.${proposal.artifactId}.${proposal.version}`, baseRef: meta.baseRef, proposedRef: proposal, author: meta.author, goal: meta.goal, createdAtGameTime: meta.createdAtGameTime });
    return submitted.ok ? { ok: true as const, value: { reviewId: submitted.value.reviewId } } : { ok: false as const, error: { code: submitted.error.code, message: submitted.error.message } };
  } } });
  const result = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, [{ id: "verification-mode", optionId: "safe-containment" }], "workbench.slice5.recovery");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REVIEW_INTAKE_FAILED");
  assert.equal(economy.balance().amount, initial.amount);
  assert.equal(registry.getArtifact({ artifactId: "review.skill.carnivore-feeding", version: 5 }), undefined, "rejected intake must remove its exact proposal artifact");
  assert.equal(registry.manifest().packs.length, initialPackCount, "rollback must remove the provisional pack identity");
  assert.equal(service.listCommissions(economy.snapshot())[0]?.status, "AVAILABLE", "a compensated rejection must remain retryable");
  const retry = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, [{ id: "verification-mode", optionId: "safe-containment" }], "workbench.slice5.recovery");
  assert.equal(retry.ok, true, retry.ok ? "" : retry.error.message);
  if (!retry.ok) return;
  assert.equal(economy.balance().amount, initial.amount - SAFE_FEEDING_SKILL_RECIPE.costCredits, "retry must leave exactly one net charge");
  assert.equal(registry.manifest().packs.length, initialPackCount + 1, "retry must leave exactly one proposal pack");
  assert.equal(reviews.reviews.list().filter((item) => item.proposedRef.artifactId === retry.value.proposalRef.artifactId && item.proposedRef.version === retry.value.proposalRef.version).length, 1);
  const duplicate = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, [{ id: "verification-mode", optionId: "safe-containment" }], "workbench.slice5.recovery");
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.value.duplicate, true);
  assert.equal(economy.balance().amount, initial.amount - SAFE_FEEDING_SKILL_RECIPE.costCredits);
  assert.equal(registry.manifest().packs.length, initialPackCount + 1);
});

test("workbench rejects arbitrary prose and stale progress before any charge", () => {
  const { registry, context, evals, reviews, economy } = setup();
  const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, economy });
  const before = economy.balance();
  const prose = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, [{ id: "verification-mode", optionId: "write-anything" }], "workbench.no-prose");
  assert.equal(prose.ok, false);
  if (!prose.ok) assert.equal(prose.error.code, "INVALID_CHOICE");
  assert.deepEqual(economy.balance(), before);
  const staleProgress = { ...economy.snapshot(), phase: 0, capabilities: ["capability.prompt.basic"] };
  const locked = service.listCommissions(staleProgress)[0];
  assert.equal(locked?.status, "LOCKED");
  assert.match(locked?.reason ?? "", /phase|capability/i);
});

test("workbench library filters by authored tags, capability, required Tool, and deployment state", () => {
  const { registry, context, evals, reviews } = setup();
  const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, deployment: reviews.deployments });
  assert.ok(service.listAssets({ tag: "task:feeding" }).every((asset) => asset.applicabilityTags.includes("task:feeding")));
  assert.ok(service.listAssets({ capability: "capability.prompt.basic" }).every((asset) => asset.authoredByCapability === "capability.prompt.basic"));
  assert.ok(service.listAssets({ toolId: "open_gate" }).every((asset) => asset.requiredToolIds.includes("open_gate")));
  assert.ok(service.listAssets({ deploymentState: "DEPLOYED" }).some((asset) => asset.ref.artifactId === "review.skill.carnivore-feeding" && asset.ref.version === 3));
  assert.ok(service.listAssets({ deploymentState: "HISTORICAL" }).some((asset) => asset.ref.artifactId === "review.skill.carnivore-feeding" && asset.ref.version === 4));
});

test("capability presentation gives effective Tool unlocks a consistent level and reason", () => {
  const { registry } = setup();
  const service = createWorkbenchService({ registry, progress: { snapshot: () => fullyUnlocked } });
  const tooling = service.capabilities().find((item) => item.area === "TOOL");
  assert.equal(tooling?.unlocked, true);
  assert.equal(tooling?.level, 1);
  assert.match(tooling?.reason ?? "", /Unlocked/);
});

test("review links resolve only the exact artifact version", () => {
  const { registry, context, evals, reviews, economy } = setup();
  const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, deployment: reviews.deployments, economy });
  const result = service.commission(SAFE_FEEDING_SKILL_RECIPE.ref, [{ id: "verification-mode", optionId: "safe-containment" }], "workbench.exact-review-link");
  assert.equal(result.ok, true);
  assert.equal(service.getAsset({ artifactId: "review.skill.carnivore-feeding", version: 3 })?.reviews.length, 0);
  const link = service.getAsset({ artifactId: "review.skill.carnivore-feeding", version: 5 })?.reviews[0];
  assert.match(link?.href ?? "", /artifact=review\.skill\.carnivore-feeding/);
  assert.match(link?.href ?? "", /version=5/);
});

const fullyUnlocked = {
  phase: 9, stateVersion: 1, signals: {}, milestones: [], completedObjectives: [], unlocks: [], workerCount: 2, contextCapacity: 20_000, interventions: 0, metrics: {},
  capabilities: ["capability.prompt.basic", "capability.skill.basic", "capability.source-inspection", "capability.context-meter", "capability.evals", "capability.review", "capability.memory"],
} as const;

for (const scenario of [
  { recipe: TOOL_CONFIGURATION_RECIPE, choice: { id: "tool-schema", optionId: "minimal" }, source: /only its state and fixture id/, semanticKey: "tool.observe.schema" },
  { recipe: EVAL_CONFIGURATION_RECIPE, choice: { id: "risk-profile", optionId: "edge-risk" }, source: /jammed-gate escalation evals/, semanticKey: "eval.required-suite" },
  { recipe: MEMORY_CONFIGURATION_RECIPE, choice: { id: "memory-policy", optionId: "local-session" }, source: /local to the current work session/, semanticKey: "memory.local-session" },
] as const) {
  test(`workbench applies the selected authored ${scenario.recipe.family} source and clauses`, () => {
    const { registry, context, evals, reviews, economy } = setup(10_000);
    const service = createWorkbenchService({ registry, context, evals, reviews: reviews.reviews, deployment: reviews.deployments, economy, progress: { snapshot: () => fullyUnlocked } });
    const result = service.commission(scenario.recipe.ref, [scenario.choice], `workbench.choice.${scenario.recipe.family}`);
    assert.equal(result.ok, true, result.ok ? "" : result.error.message);
    if (!result.ok) return;
    assert.match(result.value.artifact.sourceText, scenario.source);
    assert.ok(result.value.artifact.clauses.some((clause) => clause.semanticKey === scenario.semanticKey));
    assert.deepEqual(result.value.choices, [scenario.choice]);
    assert.equal(registry.getArtifact(result.value.proposalRef)?.status, "REVIEW");
  });
}
