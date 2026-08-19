import assert from "node:assert/strict";
import test from "node:test";

import {
  createMemoryFoundationFixture,
  externalizeContextItem,
  memoryEntrySchema,
  retrieveMemory,
} from "../../src/memory/public.js";

test("Memory stores exact versioned entries with immutable scope, facts, tags, ticks, and lineage", () => {
  const fixture = createMemoryFoundationFixture();
  const entry = fixture.repository.getExact("memory:gate-note", "1.0.0");
  assert.ok(entry);
  assert.equal(entry.storeId, "memory:enclosure-gate");
  assert.equal(entry.scope, "enclosure");
  assert.equal(entry.createdTick, 2);
  assert.equal(entry.observedWorldTick, 2);
  assert.deepEqual(entry.tags, ["gate", "maintenance"]);
  assert.deepEqual(entry.sourceItems[0], entry.provenance.sourceItems[0]);
  assert.equal(Object.isFrozen(entry), true);
  assert.equal(memoryEntrySchema.safeParse(entry).success, true);
  assert.equal(fixture.repository.getExact(entry.id, "9.9.9"), undefined);
});

test("Externalize and Retrieve stores first and returns an explicit Context retention event", () => {
  const fixture = createMemoryFoundationFixture();
  const before = fixture.repository.snapshot().entries.length;
  const result = fixture.repository.externalize({ contextItem: fixture.contextItem, rule: fixture.externalization, createdTick: 3, observedWorldTick: 3, principal: { id: "agent:worker-alpha" }, sourceManifestId: "context:before" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(fixture.repository.snapshot().entries.length, before + 1);
  assert.deepEqual(result.contextRetention, { kind: "externalized", contextItemIds: [fixture.contextItem.id], reasonCode: "MEMORY_EXTERNALIZED", memoryEntries: [{ id: result.entry.id, version: result.entry.version }] });
  assert.equal(result.sourceManifestId, "context:before");
  const retrieved = fixture.repository.retrieve({ ...fixture.retrieval, storeIds: [fixture.externalization.targetStoreId], exactVersions: [{ id: result.entry.id, version: result.entry.version }] });
  assert.deepEqual(retrieved.selected.map((item) => item.reference), [{ id: result.entry.id, version: result.entry.version }]);
  assert.equal(retrieved.contextCost, result.entry.contextCost);
});

test("Failed storage produces no phantom entry or Context externalization event", () => {
  const fixture = createMemoryFoundationFixture();
  const result = fixture.repository.externalize({ contextItem: fixture.contextItem, rule: { ...fixture.externalization, targetStoreId: "memory:missing-store" }, createdTick: 3, principal: { id: "agent:worker-alpha" } });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "MEMORY_STORE_UNAVAILABLE");
  assert.equal("contextRetention" in result, false);
  assert.equal(fixture.repository.snapshot().entries.some((entry) => entry.sourceItems.some((source) => source.itemId === fixture.contextItem.id)), false);
});

test("Retrieval returns considered/rejected/unavailable categories with deterministic predicates, ranks, limits, and costs", () => {
  const fixture = createMemoryFoundationFixture();
  const result = fixture.repository.retrieve({ ...fixture.retrieval, limit: 1, predicates: [{ kind: "location", locationId: "location:gate" }, { kind: "tag", tag: "gate" }] });
  assert.equal(result.ok, true);
  assert.equal(result.considered.length, 7);
  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0]?.rank, 1);
  assert.equal(result.contextCost, result.selected[0]?.entry?.contextCost);
  assert.ok(result.rejected.some((item) => item.reasonCode === "MEMORY_LIMIT_EXCEEDED"));
  const unauthorised = fixture.repository.retrieve({ ...fixture.retrieval, principal: { id: "agent:untrusted" }, storeIds: ["memory:team"] });
  assert.equal(unauthorised.selected.length, 0);
  assert.ok(unauthorised.unavailable.every((item) => item.reasonCode === "MEMORY_READ_UNAUTHORIZED"));
  const rerun = fixture.repository.retrieve({ ...fixture.retrieval, limit: 1, predicates: [{ kind: "location", locationId: "location:gate" }, { kind: "tag", tag: "gate" }] });
  assert.deepEqual(rerun, result);
});

test("Relevant memory remains unavailable when an explicit route misses", () => {
  const fixture = createMemoryFoundationFixture();
  const miss = fixture.repository.retrieve(fixture.retrievalMiss);
  assert.equal(miss.selected.length, 0);
  assert.equal(miss.unavailable.length, 0);
  assert.ok(miss.rejected.every((item) => item.reasonCode === "MEMORY_MISROUTED"));
  assert.ok(miss.rejected.some((item) => item.reason.includes("location:feeding-yard")));
  assert.equal(miss.contextCost, 0);
});

test("Exact old shared versions remain exact and expose stale/supersession evidence", () => {
  const fixture = createMemoryFoundationFixture();
  const result = fixture.repository.retrieve(fixture.staleSharedMemory);
  assert.deepEqual(result.selected.map((item) => item.reference), [{ id: "memory:shared-gate", version: "1.0.0" }]);
  assert.ok(result.diagnostics.some((item) => item.code === "MEMORY_STALE"));
  assert.ok(result.diagnostics.some((item) => item.code === "MEMORY_SUPERSEDED"));
  assert.equal(result.selected[0]?.entry?.facts["gate.position"], "open");
  assert.ok(result.unavailable.some((item) => item.reference.version === "2.0.0"));
});

test("Shared read/write authority and conflict diagnostics are explicit", () => {
  const fixture = createMemoryFoundationFixture();
  const teamEntry = fixture.repository.getExact("memory:conflict-a", "1.0.0");
  assert.ok(teamEntry);
  const denied = fixture.repository.append(teamEntry, { id: "agent:worker-alpha" });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, "MEMORY_WRITE_UNAUTHORIZED");
  const result = fixture.repository.retrieve({ ...fixture.retrieval, storeIds: ["memory:team"], tags: ["conflict"], limit: 5 });
  assert.equal(result.selected.length, 0);
  assert.equal(result.conflicting.length, 2);
  assert.ok(result.diagnostics.some((item) => item.code === "MEMORY_CONFLICT"));
});

test("Compact History is a deterministic loss-explicit reducer with nested lineage", () => {
  const fixture = createMemoryFoundationFixture();
  const first = fixture.repository.compactHistory(fixture.compaction);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(first.preservedFacts, { "gate.position": "closed" });
  assert.deepEqual(first.lostDetailClasses, ["dinosaur-mood", "tool-results"]);
  assert.equal(first.contextCostBefore, 8);
  assert.equal(first.contextCostAfter, 2);
  assert.deepEqual(first.lineage, [
    { id: "memory:history-observation", version: "1.0.0" },
    { id: "memory:history-tool-result", version: "1.0.0" },
  ]);
  assert.deepEqual(first.contextRetention.contextItemIds, ["memory:history-observation", "memory:history-tool-result"]);
  const second = fixture.repository.compactHistory(fixture.compaction);
  assert.deepEqual(second, first);
  const summary = first.summary;
  assert.equal(summary.summary?.contextCostAfter, 2);
  const nested = fixture.repository.compactHistory({ ...fixture.compaction, sourceReferences: [{ id: summary.id, version: summary.version }], rule: { ...fixture.compaction.rule, id: "rule:compact-summary", preserveFactPaths: ["gate.position"], contextCost: 1 }, createdTick: 9 });
  assert.equal(nested.ok, true);
  if (nested.ok) assert.ok(nested.summary.summary?.lineage.some((reference) => reference.id === "memory:history-observation"));
});

test("Public pure lifecycle ports are repeatable and do not expose hidden reasoning", () => {
  const fixture = createMemoryFoundationFixture();
  const first = externalizeContextItem({ contextItem: fixture.contextItem, rule: fixture.externalization, createdTick: 3, principal: { id: "agent:worker-alpha" } }, { append: fixture.repository.append, getStore: (id) => fixture.repository.stores().find((store) => store.id === id) });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = retrieveMemory(fixture.repository.snapshot(), { ...fixture.retrieval, exactVersions: [{ id: first.entry.id, version: first.entry.version }], storeIds: [first.entry.storeId] });
  assert.deepEqual(replay.selected.map((item) => item.reference), [{ id: first.entry.id, version: first.entry.version }]);
  assert.doesNotMatch(JSON.stringify(first), /chain.?of.?thought|hidden.?reasoning|inner.?thought/iu);
});
