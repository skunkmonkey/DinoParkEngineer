import assert from "node:assert/strict";
import test from "node:test";

import { assembleContext, contextFacts, contextItemSchema, createContextFoundationFixture, type ContextFault, type ContextItem } from "../../src/context/public.js";
import { createInstructionFoundationFixture, executeInstruction, type ResolvedInstructionArtifact } from "../../src/instruction/public.js";

const ready = (input: Parameters<typeof assembleContext>[0]) => {
  const result = assembleContext(input); assert.equal(result.ok, true); if (!result.ok) throw new Error("Expected a valid Context result."); return result;
};

const maintenancePolicy = (): ResolvedInstructionArtifact => {
  const instruction = createInstructionFoundationFixture();
  return {
    ...instruction.containmentPolicy,
    reference: { id: "policy:maintenance-stop", version: "1.0.0" },
    clauses: [{ ...instruction.selfContained.clauses[0]!, id: "clause:maintenance-stop", priority: 300, requiredFacts: ["gate.maintenance"], applicability: { operator: "fact-equals", fact: "gate.maintenance", value: "closer-disabled" }, outcome: { kind: "stop", reasonCode: "CLOSER_DISABLED" } }],
  };
};

test("Context assembles an immutable exact segmented manifest with numerical capacity", () => {
  const fixture = createContextFoundationFixture(); const result = ready(fixture.base);
  assert.equal(result.status, "ready"); assert.equal(result.beforeRetention.used, 16); assert.equal(result.beforeRetention.capacity, 20); assert.deepEqual(result.beforeRetention.segments, [{ category: "Task", units: 3 }, { category: "Skill", units: 5 }, { category: "Policy", units: 4 }, { category: "Knowledge", units: 2 }, { category: "Tool", units: 2 }]);
  assert.deepEqual(result.preview, { demand: 16, capacity: 20, excess: 0, state: "constrained" }); assert.equal(Object.isFrozen(result.afterRetention), true); assert.equal(Object.isFrozen(result.afterRetention.entries), true); assert.deepEqual(contextFacts(result.afterRetention), { "dinosaur.species": "Triceratops", "gate.maintenance": "closer-disabled", "gate.position": "closed", "task.kind": "feed" });
});

test("Context validates items, stable order, duplicate IDs, and decision-boundary additions", () => {
  const fixture = createContextFoundationFixture(); const malformed = { ...fixture.items[0]!, cost: 1.5 }; assert.equal(contextItemSchema.safeParse(malformed).success, false);
  const duplicate = assembleContext({ ...fixture.base, additions: [fixture.items[0]!] }); assert.equal(duplicate.ok, false); if (!duplicate.ok) assert.equal(duplicate.diagnostics[0]?.code, "CONTEXT_DUPLICATE_ID");
  const duplicateRoute = assembleContext({ ...fixture.base, routes: [...fixture.base.routes, { ...fixture.base.routes[0]!, id: "route:duplicate" }] }); assert.equal(duplicateRoute.ok, false); if (!duplicateRoute.ok) assert.equal(duplicateRoute.diagnostics[0]?.code, "CONTEXT_DUPLICATE_ID");
  const future: ContextItem = { ...fixture.items[0]!, id: "context:future-observation", category: "Observation", createdTick: 2, payload: { reference: "future", facts: { "future.fact": true } } };
  const result = ready({ ...fixture.base, additions: [future] }); assert.equal(result.beforeRetention.entries.find((entry) => entry.itemId === future.id)?.lifecycle, "inapplicable"); assert.equal(contextFacts(result.afterRetention)["future.fact"], undefined);
});

test("missing maintenance routing is explicit and changes behavior without hidden world access", () => {
  const fixture = createContextFoundationFixture(); const missing = ready(fixture.missingMaintenance); assert.equal(missing.status, "ready"); assert.deepEqual(missing.diagnostics.map((entry) => [entry.code, entry.itemIds]), [["CONTEXT_REQUIRED_UNAVAILABLE", ["context:maintenance-policy"]]]);
  const instruction = createInstructionFoundationFixture(); const facts = contextFacts(missing.afterRetention); assert.equal(facts["gate.maintenance"], undefined);
  const decision = executeInstruction({ artifacts: [maintenancePolicy(), instruction.selfContained], facts, evidence: [], currentTick: 0 }); assert.equal(decision.outcome.kind, "tool-request");
  const withMaintenance = ready(fixture.base); const stopped = executeInstruction({ artifacts: [maintenancePolicy(), instruction.selfContained], facts: contextFacts(withMaintenance.afterRetention), evidence: [], currentTick: 0 }); assert.deepEqual(stopped.outcome, { kind: "stop", reasonCode: "CLOSER_DISABLED" });
});

test("runtime growth is applied only at decision boundaries with exact before and after links", () => {
  const fixture = createContextFoundationFixture(); const earlier = ready({ ...fixture.strictOverflow, decisionTick: 1, additions: fixture.strictOverflow.additions }); assert.equal(earlier.beforeRetention.entries.filter((entry) => entry.lifecycle === "included" && ["Observation", "ToolResult", "Message", "TaskHistory", "IncidentEvidence"].includes(entry.item?.category ?? "")).length, 1);
  const atBoundary = ready(fixture.strictOverflow); assert.equal(atBoundary.preview.demand, 29); assert.equal(atBoundary.beforeRetention.id, atBoundary.retention?.beforeManifestId); assert.equal(atBoundary.afterRetention.id, atBoundary.retention?.afterManifestId); assert.equal(atBoundary.afterRetention.previousManifestId, atBoundary.beforeRetention.id);
});

test("Strict halts before a decision, signals the external fault port, and exposes no reserve", () => {
  const fixture = createContextFoundationFixture(); const faults: ContextFault[] = []; const result = ready({ ...fixture.strictOverflow, faultPort: { reportContextFault: (fault) => faults.push(fault) } });
  assert.equal(result.status, "halted"); assert.equal(result.preview.excess, 9); assert.equal(result.retention?.policy, "Strict"); assert.equal(result.retention?.halted, true); assert.equal(faults[0]?.code, "CONTEXT_CAPACITY_STRICT_STOP"); assert.equal(faults[0]?.excess, 9); assert.equal(result.afterRetention.used, 0); assert.ok(result.afterRetention.used <= result.afterRetention.capacity); assert.throws(() => contextFacts(result.beforeRetention), /over-capacity Context/u);
});

test("Keep Newest evicts oldest eligible unpinned items with stable ties and changes behavior", () => {
  const fixture = createContextFoundationFixture(); const result = ready(fixture.keepNewest); assert.equal(result.status, "ready"); assert.equal(result.beforeRetention.used, 29); assert.equal(result.afterRetention.used, 17); assert.deepEqual(result.retention?.excludedItemIds, ["context:gate-observation", "context:maintenance-policy", "context:species-knowledge", "context:tool-result"]);
  assert.equal(result.afterRetention.entries.find((entry) => entry.itemId === "context:feeding-task")?.lifecycle, "included"); assert.equal(result.afterRetention.entries.find((entry) => entry.itemId === "context:maintenance-policy")?.lifecycle, "excluded");
  const instruction = createInstructionFoundationFixture(); const decision = executeInstruction({ artifacts: [maintenancePolicy(), instruction.selfContained], facts: contextFacts(result.afterRetention), evidence: [], currentTick: 4 }); assert.equal(decision.outcome.kind, "tool-request");
});

test("Keep Newest halts when pinned or ineligible Context cannot fit", () => {
  const fixture = createContextFoundationFixture(); const result = ready({ ...fixture.base, capacity: 5, retentionPolicy: "KeepNewest" }); assert.equal(result.status, "halted"); assert.equal(result.fault?.code, "CONTEXT_RETENTION_CANNOT_FIT"); assert.equal(result.retention?.halted, true); assert.equal(result.diagnostics.at(-1)?.code, "CONTEXT_OVERFLOW_UNRESOLVED"); assert.ok(result.afterRetention.used > result.afterRetention.capacity);
});

test("capacity and quality diagnostics remain separate and never produce a quality score", () => {
  const fixture = createContextFoundationFixture(); const staleIrrelevant: ContextItem = { ...fixture.items[0]!, id: "context:stale-note", createdTick: 0, quality: { staleAtTick: 1, relevance: "irrelevant", duplicateKey: "note" } }; const duplicate: ContextItem = { ...staleIrrelevant, id: "context:duplicate-note", quality: { relevance: "relevant", duplicateKey: "note" } };
  const result = ready({ ...fixture.base, decisionTick: 2, capacity: 30, additions: [staleIrrelevant, duplicate] }); assert.deepEqual(result.diagnostics.map((entry) => entry.kind), ["duplicate", "irrelevant", "stale"]); assert.equal("qualityScore" in result, false); assert.notEqual(result.preview.state, "overflow");
});

test("conflicting facts fail explicitly instead of being silently selected", () => {
  const fixture = createContextFoundationFixture(); const conflict: ContextItem = { ...fixture.items[0]!, id: "context:conflicting-task", category: "Message", payload: { reference: "conflict", facts: { "task.kind": "inspect" } }, quality: { relevance: "relevant", conflictKey: "task-kind" } };
  const result = ready({ ...fixture.base, capacity: 30, additions: [conflict] }); assert.throws(() => contextFacts(result.afterRetention), /Conflicting Context fact task.kind/u);
});
