import assert from "node:assert/strict";
import test from "node:test";

import { PARK_DEVELOPER, createEngineeringWorkbenchFoundationFixture } from "../../src/engineering-workbench/public.js";

test("Workbench inspects exact source and clauses without conflating prose and behavior", () => {
  const { instruction, workbench } = createEngineeringWorkbenchFoundationFixture();
  const inspected = workbench.inspect(instruction.selfContained, [{ reference: instruction.selfContained.reference, status: "deployed", summary: "Opening production version" }]);
  assert.equal(inspected.readableSource, instruction.selfContained.readableSource);
  assert.deepEqual(inspected.clauses, instruction.selfContained.clauses);
  assert.equal(inspected.deploymentStatus, "deployed");
  assert.deepEqual(inspected.history.map((entry) => entry.status), ["deployed"]);
});

test("semantic comparison covers all dimensions and backs quality findings with evidence", () => {
  const { instruction, workbench } = createEngineeringWorkbenchFoundationFixture();
  const comparison = workbench.compare(instruction.selfContained, instruction.modularPrompt, [{ code: "CONTEXT_IRRELEVANT", kind: "irrelevant", itemIds: ["context:unused"], message: "Unused context is not required." }]);
  assert.ok(comparison.differences.some((entry) => entry.dimension === "readable"));
  assert.ok(comparison.differences.some((entry) => entry.dimension === "behavioral"));
  assert.ok(comparison.differences.some((entry) => entry.dimension === "context"));
  assert.ok(comparison.differences.some((entry) => entry.dimension === "dependency"));
  const verificationComparison = workbench.compare(instruction.selfContained, instruction.containmentPolicy);
  assert.ok(verificationComparison.differences.some((entry) => entry.dimension === "tool"));
  assert.ok(verificationComparison.differences.some((entry) => entry.dimension === "verification"));
  assert.ok(verificationComparison.differences.some((entry) => entry.dimension === "failure"));
  assert.ok(verificationComparison.differences.some((entry) => entry.dimension === "tradeoff"));
  assert.ok(comparison.findings.every((entry) => entry.evidence.length > 0));
  assert.equal("rank" in comparison, false);
});

test("bounded composition previews exact capacity and rejects conflicts", () => {
  const { context, instruction, workbench } = createEngineeringWorkbenchFoundationFixture();
  const routes = context.items.map((item) => ({ id: item.provenance.routeId, item, included: true }));
  const preview = workbench.compose([instruction.modularPrompt, instruction.feedingSkill], routes, 20, 12);
  assert.equal(preview.contextUsed, 16);
  assert.equal(preview.contextDelta, 4);
  assert.equal(preview.valid, true);
  assert.deepEqual(preview.routes.map((entry) => entry.id), routes.map((entry) => entry.id));
});

test("single Park Developer gates work and candidates never change production", () => {
  const { instruction, workbench } = createEngineeringWorkbenchFoundationFixture();
  assert.equal(PARK_DEVELOPER.id, "park-developer:ada");
  assert.equal("salary" in PARK_DEVELOPER, false);
  assert.equal("team" in PARK_DEVELOPER, false);
  const locked = workbench.requestWork({ id: "work:locked", goal: "Create a Skill", baseVersion: instruction.selfContained.reference, capability: "Skill authoring", inputs: [], quote: { id: "quote:locked", credits: 20, durationTicks: 2, category: "authoring" } });
  assert.deepEqual(locked, { ok: false, code: "WORKBENCH_CAPABILITY_LOCKED" });
  const cancellable = workbench.requestWork({ id: "work:cancel", goal: "Inspect only", baseVersion: instruction.selfContained.reference, capability: "Prompt engineering", inputs: [], quote: { id: "quote:cancel", credits: 0, durationTicks: 0, category: "authoring" } });
  assert.equal(cancellable.ok, true);
  assert.equal(workbench.cancelWork("work:cancel").status, "cancelled");
  const created = workbench.requestWork({ id: "work:opening-fix", goal: "Route gate maintenance state", baseVersion: instruction.selfContained.reference, capability: "Context optimization", inputs: ["context:maintenance-policy"], quote: { id: "quote:opening-fix", credits: 40, durationTicks: 1, category: "authoring" } });
  assert.equal(created.ok, true);
  workbench.acceptWork("work:opening-fix");
  const before = workbench.productionReference();
  const candidate = workbench.completeWork("work:opening-fix", instruction.modularPrompt, ["route:maintenance-policy"]);
  assert.equal(candidate.productionAffected, false);
  assert.equal(Object.isFrozen(candidate.clauses), true);
  assert.deepEqual(workbench.productionReference(), before);
  assert.equal(workbench.candidates().length, 1);
  const revision = workbench.requestRevision(candidate.id, { id: "work:revision", goal: "Clarify verification", baseVersion: candidate.reference, capability: "Prompt engineering", inputs: [candidate.id], quote: { id: "quote:revision", credits: 10, durationTicks: 1, category: "authoring" } });
  assert.equal(revision.feedbackForCandidateId, candidate.id);
  assert.equal(workbench.candidates()[0]?.id, candidate.id);
});

test("Handbook searches encountered examples and remains outside Agent Context", () => {
  const { workbench } = createEngineeringWorkbenchFoundationFixture();
  const entries = workbench.handbook("maintenance", "context");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.term, "Context");
  assert.equal(entries[0]?.contextEligible, false);
  assert.deepEqual(entries[0]?.incidentIds, ["incident:opening-near-miss"]);
});
