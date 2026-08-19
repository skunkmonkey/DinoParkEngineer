import assert from "node:assert/strict";
import test from "node:test";

import { assembleContext, compareRetentionResults, contextFacts, contextItemSchema, createContextFoundationFixture, type ContextAssemblyInput, type ContextFault, type ContextItem, type RetentionPolicy } from "../../src/context/public.js";
import { createInstructionFoundationFixture, executeInstruction, type ResolvedInstructionArtifact } from "../../src/instruction/public.js";
import { createMemoryFoundationFixture, createMemoryPorts, type MemoryEntry } from "../../src/memory/public.js";

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

const historyItem = (entry: MemoryEntry): ContextItem => ({
  id: entry.id,
  category: "TaskHistory",
  provenance: { source: `memory:${entry.storeId}`, routeId: `route:${entry.id.split(":")[1] ?? "history"}` },
  sourceVersion: { id: entry.id, version: entry.version },
  cost: entry.contextCost,
  createdTick: entry.createdTick,
  priority: entry.priority,
  retentionEligible: true,
  pinned: false,
  payload: { reference: `${entry.id}@${entry.version}`, facts: entry.facts },
  quality: { relevance: "relevant" },
});

test("Priority Retention protects pins and higher priorities with stable ties", () => {
  const fixture = createContextFoundationFixture();
  const result = ready({ ...fixture.strictOverflow, capacity: 20, retentionPolicy: "PriorityRetention" });
  assert.equal(result.status, "ready");
  assert.equal(result.retention?.policy, "PriorityRetention");
  assert.deepEqual(result.retention?.excludedItemIds, ["context:gate-observation", "context:incident-evidence", "context:manager-message", "context:tool-result"]);
  assert.equal(result.afterRetention.entries.find((entry) => entry.itemId === "context:maintenance-policy")?.lifecycle, "included");
});

test("Compact History uses exact Memory sources and records known loss", () => {
  const memory = createMemoryFoundationFixture();
  const histories = memory.entries.filter((entry) => entry.id.startsWith("memory:history-")).map(historyItem);
  const input: ContextAssemblyInput = {
    agentId: "agent:worker-alpha", jobId: "job:history", decisionTick: 8, capacity: 3,
    routes: [], availableSources: [], priorRetained: [], additions: histories,
    retentionPolicy: "CompactHistory",
    memory: { ports: createMemoryPorts(memory.repository), principal: { id: "agent:worker-alpha" }, compactionRequest: memory.compaction },
  };
  const result = ready(input);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.retention?.compactedItemIds, ["memory:history-observation", "memory:history-tool-result"]);
  assert.deepEqual(result.retention?.knownLostDetail, ["dinosaur-mood", "tool-results"]);
  assert.equal(result.afterRetention.entries.filter((entry) => entry.lifecycle === "compacted").length, 2);
  assert.deepEqual(contextFacts(result.afterRetention), { "gate.position": "closed" });
});

test("Externalize and Retrieve removes only successfully stored Context and later retrieves it explicitly", () => {
  const memory = createMemoryFoundationFixture();
  const ports = createMemoryPorts(memory.repository);
  const externalized = ready({
    agentId: "agent:worker-alpha", jobId: "job:externalize", decisionTick: 3, capacity: 0,
    routes: [], availableSources: [], priorRetained: [], additions: [memory.contextItem], retentionPolicy: "ExternalizeRetrieve",
    memory: { ports, principal: { id: "agent:worker-alpha" }, externalizationRule: memory.externalization },
  });
  assert.equal(externalized.status, "ready");
  assert.deepEqual(externalized.retention?.externalizedItemIds, [memory.contextItem.id]);
  assert.equal(externalized.afterRetention.used, 0);
  assert.equal(memory.repository.snapshot().entries.some((entry) => entry.sourceItems.some((source) => source.itemId === memory.contextItem.id)), true);

  const retrieved = ready({
    agentId: "agent:worker-alpha", jobId: "job:retrieve", decisionTick: 4, capacity: 20,
    routes: [], availableSources: [], priorRetained: [], additions: [], retentionPolicy: "Strict",
    memory: { ports, principal: { id: "agent:worker-alpha" }, retrievalQuery: { principal: { id: "agent:worker-alpha" }, storeIds: [memory.externalization.targetStoreId], tags: ["gate", "maintenance"], limit: 10 } },
  });
  assert.equal(retrieved.afterRetention.entries.some((entry) => entry.item?.category === "Memory" && entry.lifecycle === "included"), true);
  assert.equal(contextFacts(retrieved.afterRetention)["gate.maintenance"], "closer-disabled");
});

test("failed externalization keeps Context visible and halts without phantom removal", () => {
  const memory = createMemoryFoundationFixture();
  const before = memory.repository.snapshot().entries.length;
  const result = ready({
    agentId: "agent:unauthorized", jobId: "job:externalize", decisionTick: 3, capacity: 0,
    routes: [], availableSources: [], priorRetained: [], additions: [memory.contextItem], retentionPolicy: "ExternalizeRetrieve",
    memory: { ports: createMemoryPorts(memory.repository), principal: { id: "agent:unauthorized" }, externalizationRule: memory.externalization },
  });
  assert.equal(result.status, "halted");
  assert.equal(result.afterRetention.entries[0]?.lifecycle, "included");
  assert.equal(memory.repository.snapshot().entries.length, before);
  assert.deepEqual(result.retention?.externalizedItemIds ?? [], []);
});

test("retention comparison exposes exact outcomes without a universal best policy", () => {
  const fixture = createContextFoundationFixture();
  const policies: readonly RetentionPolicy[] = ["Strict", "KeepNewest", "PriorityRetention", "CompactHistory", "ExternalizeRetrieve"];
  const results = Object.fromEntries(policies.map((policy) => [policy, assembleContext({ ...fixture.strictOverflow, retentionPolicy: policy })])) as Record<RetentionPolicy, ReturnType<typeof assembleContext>>;
  const comparison = compareRetentionResults(results);
  assert.deepEqual(comparison.map((entry) => entry.policy), ["CompactHistory", "ExternalizeRetrieve", "KeepNewest", "PriorityRetention", "Strict"]);
  assert.equal(comparison.every((entry) => !("best" in entry) && !("score" in entry)), true);
  assert.equal(comparison.find((entry) => entry.policy === "Strict")?.status, "halted");
});
