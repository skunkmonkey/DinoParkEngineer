import assert from "node:assert/strict";
import test from "node:test";
import { createContentRegistry, type ArtifactVersion } from "../content-registry/index.ts";
import { createContextService, type ContextRequest, type ContextSnapshot } from "../context/index.ts";
import { createInstructionEngine } from "../instruction/index.ts";
import { createStarterFixture, createSimulationEngine } from "../simulation/index.ts";
import { canonicalSerialize } from "../simulation/index.ts";
import { createReplayService, createTraceRepository, filterTraceEvents, snapshotHash, traceHash, verifyTraceIntegrity, type TraceEventRecord, type TraceRecord } from "../trace-replay/index.ts";
import { applyBasePath } from "../src/shell/public.ts";
import { parkEntityHref } from "../src/trace-replay/links.ts";

const feedPrompt: ArtifactVersion = {
  artifactId: "trace.fixture.prompt.feed",
  version: 1,
  type: "PROMPT",
  title: "Feed Rex",
  sourceText: "Feed Rex.",
  clauses: [
    { id: "trace.feed.goal", sourceText: "Rex is fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" } },
    { id: "trace.feed.move", sourceText: "Move to service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 } },
    { id: "trace.feed.open", sourceText: "Open gate.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma", order: 2 } },
    { id: "trace.feed.enter", sourceText: "Enter.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior", order: 3 } },
    { id: "trace.feed.food", sourceText: "Dispense food.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex", order: 4 } },
  ],
  dependencies: [],
  applicabilityTags: [],
  requiredToolIds: ["move_to", "open_gate", "dispense_food"],
  status: "DEPLOYED",
  authoredByCapability: "trace.fixture",
  createdAtGameTime: 0,
};

function runGoldenTrace(): { readonly repository: ReturnType<typeof createTraceRepository>; readonly trace: TraceRecord; readonly simulation: ReturnType<typeof createSimulationEngine>; readonly contextSnapshot: ContextSnapshot } {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "trace.fixture.pack", artifacts: [feedPrompt] }).ok, true);
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const repository = createTraceRepository();
  const traceId = repository.begin({ traceId: "trace.golden.feeding", executionId: "execution.job.feed", jobId: "job.feed", agentId: "agent.keeper01", fixtureRef: "fixture.starter", seed: 7, artifactRefs: [{ artifactId: feedPrompt.artifactId, version: 1 }], engineVersion: "simulation-test", contentManifestVersion: "trace.fixture.pack", contextSnapshotId: "context.job.feed" });
  const engine = createInstructionEngine({
    content: registry,
    context: createContextService(),
    simulation,
    provenance: { append: (event) => repository.append(traceId, event) },
  });
  const prepared = engine.prepare({ id: "job.feed", type: "FEED", targetRefs: ["dino.rex"], priority: 1, dueTime: 50, assignedAgentId: "agent.keeper01", promptRef: { artifactId: feedPrompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: createStarterFixture().agents[0]!.tools });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) throw new Error("fixture failed to prepare");
  const done = engine.runToCompletion(engine.start(prepared.value).executionId);
  assert.equal(done.outcome?.reasonCode, "GOAL_ACHIEVED_WITHOUT_POSTCONDITION");
  if (!done.outcome) throw new Error("fixture did not finish");
  repository.finalize(traceId, done.outcome);
  const trace = repository.get(traceId);
  if (!trace) throw new Error("trace not recorded");
  return { repository, trace, simulation, contextSnapshot: prepared.value.contextSnapshot };
}

test("slice 1 records the first-feeding diagnosis and preserves source facts", () => {
  const { repository, trace } = runGoldenTrace();
  assert.equal(trace.status, "SUCCEEDED");
  assert.ok(trace.events.some((event) => event.type === "ASSERTION" && event.passFail === "PASS"));
  assert.equal(trace.events.some((event) => event.clauseId?.includes("postcondition")), false);
  assert.ok(trace.events.some((event) => event.type === "OUTCOME" && JSON.stringify(event.payload).includes("WITHOUT_POSTCONDITION")));
  assert.equal(repository.list({ category: "ASSERTION" }).length, 1);
  assert.ok(repository.list({ entityId: "gate.gamma" }).length >= 1);
  const source = trace.events[0]!.source;
  assert.notEqual(source, trace.events[0]);
  assert.equal(Object.isFrozen(trace), true);
  assert.equal(verifyTraceIntegrity(trace).ok, true);
  assert.equal(traceHash(trace), trace.canonicalHash);
  assert.equal(verifyTraceIntegrity({ ...trace, canonicalEventHash: "tampered" }).reason, "EVENT_HASH_MISMATCH");
});

test("Trace Explorer entity links target canonical Park and remain base-path safe", () => {
  const canonical = parkEntityHref("gate.gamma / north");
  assert.equal(canonical, "/?entity=gate.gamma%20%2F%20north");
  assert.equal(canonical.startsWith("/park"), false);
  assert.equal(applyBasePath(canonical, "/dino-engineer"), "/dino-engineer?entity=gate.gamma%20%2F%20north");
});

test("slice 2 exact replay is isolated, with no mutation of the live engine", async () => {
  const live = createSimulationEngine();
  assert.equal(live.load(createStarterFixture(), 7).ok, true);
  const liveBefore = live.canonicalSnapshot();
  const command = { action: "move_to" as const, commandId: "replay.command.move", agentId: "agent.keeper01", zoneId: "zone.gamma.service" };
  const first = createSimulationEngine();
  assert.equal(first.load(createStarterFixture(), 7).ok, true);
  assert.equal(first.command(command).ok, true);
  first.advanceTo(10);
  const manifest = { schemaVersion: 1, fixture: createStarterFixture(), seed: 7, commandStream: [command], untilLogicalTime: 10, expectedEvents: first.events(), expectedFinalSnapshotHash: snapshotHash(first.snapshot()) } as const;
  const service = createReplayService({ simulationFactory: () => createSimulationEngine() });
  const exact = await service.replay(manifest, { paused: true, speed: 4, step: true });
  assert.equal(exact.status, "EXACT", JSON.stringify(exact.firstDifference));
  assert.equal(live.canonicalSnapshot(), liveBefore);
});

test("slice 3 replays pinned instruction provenance, including the absent postcondition fact", async () => {
  const golden = runGoldenTrace();
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "trace.fixture.replay", artifacts: [feedPrompt] }).ok, true);
  const replay = await createReplayService({ content: registry, context: createContextService(), simulationFactory: () => createSimulationEngine() }).replay({
    schemaVersion: 1,
    fixture: createStarterFixture(),
    seed: 7,
    artifactRefs: [{ artifactId: feedPrompt.artifactId, version: 1 }],
    job: { id: "job.feed", type: "FEED", targetRefs: ["dino.rex"], priority: 1, dueTime: 50, assignedAgentId: "agent.keeper01", promptRef: { artifactId: feedPrompt.artifactId, version: 1 } },
    agentDefinition: { id: "agent.keeper01", contextBudget: 8000, toolIds: createStarterFixture().agents[0]!.tools },
    expectedTraceEvents: golden.trace.events,
    expectedFinalSnapshotHash: golden.trace.finalSnapshotHash,
  });
  assert.equal(replay.status, "EXACT", JSON.stringify(replay.firstDifference));
  assert.ok(replay.traceEvents?.some((event) => event.labels.includes("missing-postcondition")));
});

test("slice 3 reports the first canonical event difference and never floats an exact ref", async () => {
  const first = createSimulationEngine();
  assert.equal(first.load(createStarterFixture(), 7).ok, true);
  const command = { action: "move_to" as const, commandId: "replay.command.tamper", agentId: "agent.keeper01", zoneId: "zone.gamma.service" };
  assert.equal(first.command(command).ok, true);
  first.advanceTo(10);
  const events = first.events().map((event, index) => index === first.events().length - 1 ? { ...event, payload: { ...event.payload, tampered: true } } : event);
  const diverged = await createReplayService().replay({ schemaVersion: 1, fixture: createStarterFixture(), seed: 7, commandStream: [command], untilLogicalTime: 10, expectedEvents: events, expectedFinalSnapshotHash: snapshotHash(first.snapshot()) });
  assert.equal(diverged.status, "DIVERGED");
  assert.equal(diverged.firstDifference?.kind, "EVENT");
  assert.ok(diverged.firstDifference?.field?.includes("payload"));

  const registry = createContentRegistry();
  const unavailable = await createReplayService({ content: registry }).replay({ schemaVersion: 1, fixture: createStarterFixture(), seed: 7, artifactRefs: [{ artifactId: "trace.missing", version: 1 }], commandStream: [] });
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.match(unavailable.unavailableReason ?? "", /MISSING_ARTIFACT_VERSION/);
  const schema = await createReplayService({ engineVersion: "engine.current" }).replay({ schemaVersion: 1, fixture: createStarterFixture(), seed: 7, commandStream: [], engineVersion: "engine.historical" });
  assert.equal(schema.status, "UNAVAILABLE");
  assert.equal(schema.firstDifference?.kind, "SCHEMA");
});

test("slice 5 keeps 10k-event traces queryable and adapter-safe", () => {
  const repository = createTraceRepository();
  const traceId = repository.begin({ traceId: "trace.scale.10k", jobId: "job.scale", agentId: "agent.scale", startLogicalTime: 0 });
  for (let index = 0; index < 10_000; index += 1) {
    repository.append(traceId, {
      id: `world-${index}`,
      type: index % 3 === 0 ? "OBSERVATION" : "TOOL_COMPLETED",
      logicalTime: index,
      priority: 20,
      agentId: "agent.scale",
      commandId: `command-${index}`,
      payload: { entityId: index % 2 === 0 ? "gate.gamma" : "dino.rex", index },
    });
  }
  const record = repository.get(traceId);
  assert.equal(record?.eventCount, 10_000);
  assert.equal(repository.list({ entityId: "gate.gamma" })[0]?.eventCount, 10_000);
  assert.equal(record?.events[9_999]?.sequence, 9_999);
  assert.equal(record?.events[9_999]?.source.payload.index, 9_999);
  assert.equal(Object.isFrozen(record?.events[0]), true);
});

test("slice 5 repository adapter round-trips running and finalized records", () => {
  const saved = new Map<string, TraceRecord>();
  const deltas: Array<{ readonly traceId: string; readonly event: TraceEventRecord }> = [];
  const adapter = {
    get: (traceId: string) => saved.get(traceId),
    list: () => [...saved.values()],
    append: (traceId: string, event: TraceEventRecord) => { deltas.push({ traceId, event }); },
    put: (record: TraceRecord) => { saved.set(record.header.traceId, record); },
  };
  const repository = createTraceRepository(adapter);
  const traceId = repository.begin({ traceId: "trace.adapter", jobId: "job.adapter" });
  repository.append(traceId, { id: "event.adapter", type: "OBSERVATION", logicalTime: 1, priority: 20, payload: { entityId: "gate.gamma" } });
  assert.equal(saved.get(traceId)?.status, "RUNNING");
  assert.equal(saved.get(traceId)?.events.length, 0);
  assert.equal(deltas.length, 1);
  repository.finalize(traceId, { jobId: "job.adapter", status: "SUCCEEDED", reasonCode: "DONE" });
  const restored = createTraceRepository(adapter).get(traceId);
  assert.equal(restored?.status, "SUCCEEDED");
  assert.equal(restored?.events.length, 1);
});

test("adversarial restore quarantines corrupted persisted event data and hashes", () => {
  const source = createTraceRepository();
  const traceId = source.begin({ traceId: "trace.corrupt" });
  source.append(traceId, { id: "event.corrupt", type: "OBSERVATION", logicalTime: 1, priority: 20, payload: { entityId: "gate.gamma" } });
  source.finalize(traceId, { status: "SUCCEEDED", reasonCode: "DONE" });
  const valid = source.get(traceId)!;
  const corrupted = JSON.parse(JSON.stringify(valid)) as TraceRecord;
  (corrupted.events[0]!.payload as Record<string, unknown>).entityId = "gate.tampered";
  const restored = createTraceRepository({ get: () => corrupted, list: () => [corrupted], put: () => undefined });
  assert.equal(restored.get(traceId), undefined);
  assert.equal(restored.integrity(traceId)?.ok, false);
  assert.equal(restored.integrity(traceId)?.reason, "EVENT_HASH_MISMATCH");
  assert.deepEqual(restored.quarantined().map((item) => item.traceId), [traceId]);

  const hashTampered = { ...valid, canonicalHash: "attacker-rehash-placeholder" };
  const second = createTraceRepository({ get: () => hashTampered, list: () => [hashTampered], put: () => undefined });
  assert.equal(second.get(traceId), undefined);
  assert.equal(second.integrity(traceId)?.reason, "TRACE_HASH_MISMATCH");
});

test("exact replay rejects malformed and incomplete canonical baselines", async () => {
  const fixture = createStarterFixture();
  const service = createReplayService();
  const malformed = await service.replay({ schemaVersion: 1, fixture, seed: 7, commandStream: [], expectedEventCanonical: "{bad", expectedFinalSnapshotHash: snapshotHash(fixture as never) });
  assert.match(malformed.unavailableReason ?? "", /MALFORMED_EXPECTED_EVENTS/);
  const nonArray = await service.replay({ schemaVersion: 1, fixture, seed: 7, commandStream: [], expectedEventCanonical: "{}", expectedFinalSnapshotHash: "unused" });
  assert.match(nonArray.unavailableReason ?? "", /must decode to an array/);
  const noEvents = await service.replay({ schemaVersion: 1, fixture, seed: 7, commandStream: [], expectedFinalSnapshotHash: "unused" });
  assert.match(noEvents.unavailableReason ?? "", /MISSING_EXPECTED_EVENT_BASELINE/);
  const hashOnly = await service.replay({ schemaVersion: 1, fixture, seed: 7, commandStream: [], expectedEventHash: "deadbeef", expectedFinalSnapshotHash: "unused" });
  assert.match(hashOnly.unavailableReason ?? "", /hash alone is insufficient/);
  const noSnapshot = await service.replay({ schemaVersion: 1, fixture, seed: 7, commandStream: [], expectedEvents: [] });
  assert.match(noSnapshot.unavailableReason ?? "", /MISSING_EXPECTED_SNAPSHOT_BASELINE/);
});

test("pinned artifact bindings, context policy, snapshot, and schema never float", async () => {
  const golden = runGoldenTrace();
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "trace.fixture.replay", artifacts: [feedPrompt] }).ok, true);
  const requests: ContextRequest[] = [];
  const baseContext = createContextService();
  const observedContext = {
    ...baseContext,
    project(request: ContextRequest) { requests.push(request); return baseContext.project(request); },
    buildActual(request: ContextRequest, time: number) { requests.push(request); return baseContext.buildActual(request, time); },
  };
  const common = {
    schemaVersion: 1,
    fixture: createStarterFixture(),
    seed: 7,
    artifactRefs: [{ artifactId: feedPrompt.artifactId, version: 1 }],
    artifactVersions: [{ artifactId: feedPrompt.artifactId, version: 1 }],
    job: { id: "job.feed", type: "FEED", targetRefs: ["dino.rex"], priority: 1, dueTime: 50, assignedAgentId: "agent.keeper01", promptRef: { artifactId: feedPrompt.artifactId, version: 1 } },
    agentDefinition: { id: "agent.keeper01", contextBudget: 8000, toolIds: createStarterFixture().agents[0]!.tools },
    contextPolicyInputs: { applicabilityTags: ["historical-policy"] },
    contextSnapshotId: golden.contextSnapshot.id,
    contextSnapshot: golden.contextSnapshot,
    contextSchemaVersion: 4,
    expectedTraceEvents: golden.trace.events,
    expectedFinalSnapshotHash: golden.trace.finalSnapshotHash!,
  } as const;
  const exact = await createReplayService({ content: registry, context: observedContext, contextSchemaVersion: 4 }).replay(common);
  assert.equal(exact.status, "EXACT", JSON.stringify(exact.firstDifference));
  assert.equal(requests.length, 0, "an exact pinned snapshot must bypass current context projection");

  const wrongJobRef = await createReplayService({ content: registry, context: baseContext }).replay({ ...common, job: { ...common.job, promptRef: { artifactId: feedPrompt.artifactId, version: 2 } } });
  assert.match(wrongJobRef.unavailableReason ?? "", /ARTIFACT_VERSION_MISMATCH/);
  const wrongSet = await createReplayService({ content: registry, context: baseContext }).replay({ ...common, artifactVersions: [{ artifactId: feedPrompt.artifactId, version: 2 }] });
  assert.match(wrongSet.unavailableReason ?? "", /ARTIFACT_MANIFEST_MISMATCH/);
  const wrongSchema = await createReplayService({ content: registry, context: baseContext, contextSchemaVersion: 5 }).replay(common);
  assert.match(wrongSchema.unavailableReason ?? "", /CONTEXT_SCHEMA_MISMATCH/);
  const wrongSnapshot = await createReplayService({ content: registry, context: baseContext, contextSchemaVersion: 4 }).replay({ ...common, contextSnapshot: { ...golden.contextSnapshot, agentId: "agent.someone-else" } });
  assert.match(wrongSnapshot.unavailableReason ?? "", /CONTEXT_AGENT_MISMATCH/);

  const policyOnly = { ...common, contextSnapshot: undefined, contextSnapshotId: undefined };
  const policyReplay = await createReplayService({ content: registry, context: observedContext, contextSchemaVersion: 4 }).replay(policyOnly);
  assert.equal(policyReplay.status, "EXACT", JSON.stringify(policyReplay.firstDifference));
  assert.ok(requests.some((request) => request.applicabilityTags?.includes("historical-policy")));
});

test("10k adapter append uses deltas and filtered timelines narrow the selected trace", () => {
  let appendCalls = 0;
  let appendedBytes = 0;
  const saved = new Map<string, TraceRecord>();
  const repository = createTraceRepository({
    get: (id) => saved.get(id),
    list: () => [...saved.values()],
    append: (_id, event) => { appendCalls += 1; appendedBytes += canonicalSerialize(event).length; },
    put: (record) => { saved.set(record.header.traceId, record); },
  });
  const traceId = repository.begin({ traceId: "trace.adapter.scale" });
  const started = performance.now();
  for (let index = 0; index < 10_000; index += 1) repository.append(traceId, { id: `e.${index}`, type: index % 2 ? "TOOL_COMPLETED" : "OBSERVATION", logicalTime: index, priority: 20, payload: { entityId: index % 2 ? "dino.rex" : "gate.gamma", index } });
  const elapsed = performance.now() - started;
  assert.equal(appendCalls, 10_000);
  assert.ok(appendedBytes < 10_000_000);
  assert.ok(elapsed < 3_000, `delta append took ${elapsed}ms`);
  const record = repository.get(traceId)!;
  assert.equal(filterTraceEvents(record.events, { category: "OBSERVATION", entityId: "gate.gamma" }).length, 5_000);
  assert.equal(filterTraceEvents(record.events, { category: "WORLD" }).length, 5_000);
});
