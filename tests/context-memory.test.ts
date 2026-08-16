import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTextCU,
  createContextService,
  type ContextRequest,
} from "../context/index.ts";
import { createMemoryService, type NewMemory } from "../memory/index.ts";
import { createContentRegistry, type ArtifactVersion } from "../content-registry/index.ts";
import type { WorkingStateInput } from "../context/index.ts";

function artifact(overrides: Partial<ArtifactVersion> = {}): ArtifactVersion {
  return {
    artifactId: "fixture.context.feed",
    version: 1,
    type: "PROMPT",
    title: "Feed Rex",
    sourceText: "Feed Rex safely.",
    clauses: [{ id: "clause.feed", sourceText: "Verify containment.", type: "POSTCONDITION", semanticKey: "containment.verify", assert: { fact: "contained" } }],
    dependencies: [],
    applicabilityTags: ["task:feeding"],
    requiredToolIds: ["observe"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
    ...overrides,
  };
}

function registry(...artifacts: ArtifactVersion[]) {
  const value = createContentRegistry();
  assert.equal(value.loadPack({ schemaVersion: 1, packId: `fixture.context.${artifacts.length}`, artifacts }).ok, true);
  return value;
}

function request(overrides: Partial<ContextRequest> = {}): ContextRequest {
  const item = artifact();
  return {
    agentId: "agent.keeper01",
    jobId: "job.feed-rex",
    budget: 10_000,
    promptRef: { artifactId: item.artifactId, version: item.version },
    registry: registry(item),
    applicabilityTags: ["task:feeding"],
    ...overrides,
  };
}

test("slice 1 calculates exact UTF-8 CU and reconciles a stable projected snapshot", () => {
  assert.equal(calculateTextCU("abcd"), 1);
  assert.equal(calculateTextCU("abcde"), 2);
  assert.equal(calculateTextCU("🦖"), 1); // four UTF-8 bytes
  assert.equal(calculateTextCU("é"), 1);
  assert.equal(calculateTextCU("你"), 1);
  assert.equal(calculateTextCU("🦖a"), 2);

  const service = createContextService();
  const first = service.project(request({ tools: ["observe", { id: "dispense_food", contextCost: 7 }], workingState: { ref: "world:starter", contextCost: 11 } }));
  const second = service.project(request({ tools: [{ id: "dispense_food", contextCost: 7 }, "observe"], workingState: { ref: "world:starter", contextCost: 11 } }));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.deepEqual(first.value.items, second.value.items);
    assert.equal(JSON.stringify(first.value), JSON.stringify(second.value));
    assert.equal(first.value.totalLoad, first.value.items.reduce((sum, item) => sum + item.contextCost, 0));
    assert.equal(first.value.mode, "PROJECTED");
    assert.equal(Object.isFrozen(first.value), true);
  }
});

test("adversarial request failures distinguish invalid input from missing content", () => {
  const service = createContextService();
  const invalid = service.project({ agentId: "agent.keeper01", jobId: "job.invalid", budget: -1 });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "INVALID_CONTEXT_REQUEST");

  const emptyRegistry = createContentRegistry();
  const missing = service.project({ agentId: "agent.keeper01", jobId: "job.missing", budget: 10, promptRef: { artifactId: "missing.prompt", version: 1 }, registry: emptyRegistry });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "MISSING_ARTIFACT");

  for (const logicalTime of [-1, 1.5, Number.NaN]) {
    const actual = service.buildActual({ agentId: "agent.keeper01", jobId: "job.actual", budget: 10 }, logicalTime);
    assert.equal(actual.ok, false);
    if (!actual.ok) {
      assert.equal(actual.error.code, "INVALID_CONTEXT_REQUEST");
      assert.ok(actual.error.id.endsWith(".actual"));
    }
  }
});

test("slice 2 blocks overflow with every item intact and no request mutation", () => {
  const service = createContextService();
  const value = request({ budget: 1, tools: [{ id: "observe", contextCost: 9 }] });
  const before = JSON.stringify(value);
  const result = service.project(value);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "BLOCKED_CONTEXT_OVERFLOW");
    assert.ok(result.error.totalLoad > result.error.budget);
    assert.equal(result.error.items.length, 2);
    assert.equal(result.error.items.reduce((sum, item) => sum + item.contextCost, 0), result.error.totalLoad);
  }
  assert.equal(JSON.stringify(value), before);
});

test("slice 3 scopes memory, observes validUntil boundary, and gives direct observations precedence", () => {
  const memories = createMemoryService();
  const stale = memories.record({ id: "memory.gate3.health", scope: "SHARED", observedAt: 4, validUntil: 20, provenance: "maintenance:log", subjectRefs: ["gate.3"], facts: { sensorHealth: 100 }, contextCost: 8 });
  const local = memories.record({ id: "memory.private", scope: "LOCAL", ownerAgentId: "agent.other", observedAt: 9, provenance: "other", contextCost: 1 });
  assert.equal(memories.evaluate(stale, 4, { maxAgeSeconds: 10 }), "FRESH");
  assert.equal(memories.evaluate(stale, 15, { maxAgeSeconds: 10 }), "STALE");
  assert.equal(memories.evaluate(stale, 20, { maxAgeSeconds: 100 }), "EXPIRED");
  assert.deepEqual(memories.retrieve({}, { agentId: "agent.keeper01" }, 15).map((record) => record.id), [stale.id]);
  assert.deepEqual(memories.retrieve({}, { agentId: "agent.keeper01", includeShared: false }, 15), []);
  assert.deepEqual(memories.retrieve({}, { agentId: "agent.keeper01", localAgentIds: ["agent.other"] }, 15).map((record) => record.id), [local.id, stale.id]);

  const state: WorkingStateInput = { ref: "world:gate3", contextCost: 4, observations: [{ key: "sensorHealth", value: 50, subjectRef: "gate.3", observedAt: 15, provenance: "sensor:direct" }] };
  const result = createContextService().project(request({ logicalTime: 15, memoryService: memories, memoryAccess: { agentId: "agent.keeper01" }, memoryQuery: { subjectRefs: ["gate.3"] }, freshnessPolicy: { maxAgeSeconds: 10 }, workingState: state }));
  assert.equal(result.ok, true);
  if (result.ok) {
    const memory = result.value.items.find((item) => item.ref === stale.id);
    assert.equal(memory?.freshnessStatus, "STALE");
    assert.equal(result.value.authoritativeFacts.find((fact) => fact.key === "sensorHealth")?.source, "DIRECT_OBSERVATION");
    assert.deepEqual(result.value.authoritativeFacts.find((fact) => fact.key === "sensorHealth")?.supersedes, [stale.id]);
  }
});

test("adversarial memory boundaries exclude future data and enforce explicit-record access", () => {
  const memoryService = createMemoryService();
  const privateOther = memoryService.record({ id: "memory.other.private", scope: "LOCAL", ownerAgentId: "agent.other", observedAt: 1, provenance: "other", facts: { gateState: "OPEN" }, contextCost: 3 });
  const shared = memoryService.record({ id: "memory.shared", scope: "SHARED", observedAt: 1, provenance: "shared", facts: { gateState: "CLOSED" }, contextCost: 4 });
  const future = memoryService.record({ id: "memory.future", scope: "SHARED", observedAt: 50, provenance: "future", facts: { gateState: "JAMMED" }, contextCost: 5 });
  const result = createContextService().project(request({
    logicalTime: 10,
    promptRef: undefined,
    memoryRecords: [privateOther, shared, future],
    memoryAccess: { agentId: "agent.keeper01" },
    workingState: { ref: "world.future", contextCost: 1, observations: [{ key: "gateState", value: "OPEN", observedAt: 11, provenance: "future-observation" }] },
  }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.items.filter((item) => item.kind === "MEMORY").map((item) => item.ref), [shared.id]);
    assert.equal(result.value.authoritativeFacts.find((fact) => fact.key === "gateState")?.source, "MEMORY");
    assert.equal(result.value.authoritativeFacts.find((fact) => fact.key === "gateState")?.value, "CLOSED");
  }
  assert.deepEqual(memoryService.retrieve({}, { agentId: "agent.keeper01" }, 10).map((record) => record.id), [shared.id]);
  assert.deepEqual(memoryService.retrieve({}, { agentId: "agent.keeper01", localAgentIds: ["agent.other"] }, 10).map((record) => record.id), [privateOther.id, shared.id]);
});

test("adversarial memory creation is browser-safe, deterministic, and rejects invalid enums", () => {
  const input: NewMemory = { scope: "SHARED", observedAt: 7, provenance: "sensor:🦖", content: "闸门", contextCost: 2 };
  const first = createMemoryService().record(input);
  const second = createMemoryService().record(input);
  assert.equal(first.id, second.id);
  assert.match(first.id, /^memory\.[0-9a-f]{24}$/);
  assert.equal(JSON.stringify(first).includes("Buffer"), false);
  assert.throws(() => createMemoryService().record({ ...input, scope: "GLOBAL" } as unknown as NewMemory), /scope/);
  assert.throws(() => createMemoryService().record({ ...input, retentionStatus: "RETAINED" } as unknown as NewMemory), /retentionStatus/);
});

test("slice 4 produces duplicate, conflict, irrelevant, stale, and over-broad findings without mutation", () => {
  const base = artifact({ artifactId: "fixture.context.base", applicabilityTags: ["task:other"], clauses: [{ id: "base.a", sourceText: "Check gate.", type: "PRECONDITION", semanticKey: "gate.check", assert: { value: true } }] });
  const conflict = artifact({ artifactId: "fixture.context.conflict", clauses: [{ id: "conflict.a", sourceText: "Do not check gate.", type: "CONSTRAINT", semanticKey: "gate.check", assert: { value: false } }], dependencies: [{ artifactId: base.artifactId, version: 1 }], applicabilityTags: ["task:other"] });
  const service = createContextService();
  const memoryService = createMemoryService();
  const stale = memoryService.record({ id: "memory.stale", scope: "SHARED", observedAt: 0, validUntil: 3, provenance: "old", contextCost: 4 });
  const result = service.project(request({ promptRef: { artifactId: base.artifactId, version: 1 }, artifactRefs: [{ artifactId: conflict.artifactId, version: 1 }, { artifactId: conflict.artifactId, version: 1 }], registry: registry(base, conflict), applicabilityTags: ["task:feeding"], logicalTime: 2, memoryRecords: [stale], freshnessPolicy: { maxAgeSeconds: 1 } }));
  assert.equal(result.ok, true);
  if (result.ok) {
    const before = JSON.stringify(result.value);
    const findings = service.analyze(result.value, { usedRefs: [] });
    assert.ok(findings.some((finding) => finding.code === "DUPLICATE_EXACT_REF"));
    assert.ok(findings.some((finding) => finding.code === "CONFLICTING_CLAUSES"));
    assert.ok(findings.some((finding) => finding.code === "APPLICABILITY_MISMATCH"));
    assert.ok(findings.some((finding) => finding.code === "STALE_MEMORY"));
    assert.ok(findings.some((finding) => finding.code === "OVER_BROAD_DEPENDENCY"));
    assert.ok(findings.some((finding) => finding.code === "UNUSED_MODULE"));
    assert.equal(JSON.stringify(result.value), before);
  }
});

test("slice 5 exposes basic/advanced profiler filtering and handles 500 items", () => {
  const item = artifact({ artifactId: "fixture.context.large", sourceText: "x", clauses: [{ id: "large.clause", sourceText: "Act.", type: "ACTION", action: { tool: "observe" } }] });
  const service = createContextService();
  const largeRequest = request({ promptRef: undefined, artifactRefs: Array.from({ length: 500 }, () => ({ artifactId: item.artifactId, version: 1 })), registry: registry(item), budget: 100_000 });
  service.project(largeRequest); // warm the runtime before the production-style gate
  const assemblyStart = performance.now();
  const result = service.project(largeRequest);
  assert.equal(result.ok, true);
  if (result.ok) {
    const basic = service.profiler(result.value, "BASIC");
    const advanced = service.profiler(result.value, "ADVANCED");
    assert.equal(basic.findings.length, 0);
    assert.ok(advanced.findings.some((finding) => finding.code === "DUPLICATE_EXACT_REF"));
    const assemblyAndAnalysis = performance.now() - assemblyStart;
    assert.ok(assemblyAndAnalysis < 50, `500-item assembly and analysis took ${assemblyAndAnalysis.toFixed(1)}ms`);
    const start = performance.now();
    for (let index = 0; index < 20; index += 1) service.analyze(result.value);
    assert.ok(performance.now() - start < 50, "500-item profiler should remain below 50ms in production-sized work");
  }
});
