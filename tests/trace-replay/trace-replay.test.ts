import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleContext,
  createContextFoundationFixture,
  type ContextManifest,
} from "../../src/context/public.js";
import {
  captureTrace,
  compareTraces,
  containsProhibitedTraceField,
  createReplaySession,
  projectCausalLinks,
  projectConciseTrace,
  projectDetailedTrace,
  traceSchema,
  validateTrace,
  verifyTraceRerun,
  type Trace,
  type TraceEventDraft,
} from "../../src/trace-replay/public.js";
import {
  createSimulation,
  createSimulationFoundationFixture,
  type CommandResult,
  type WorldState,
} from "../../src/simulation/public.js";

const fixture = createSimulationFoundationFixture();
const ref = (id: string, version = "1.0.0") => ({ id, version });
const openGate = {
  id: "command:trace-open",
  kind: "operate-gate" as const,
  expectedTick: 0,
  actorId: "robot:alpha" as const,
  gateId: "gate:alpha" as const,
  operation: "open" as const,
  tool: ref("tool:gate-control"),
};

const links = [{ kind: "job" as const, id: "job:feeding" }, { kind: "entity" as const, id: "gate:alpha" }];

const traceFor = (options: { readonly finalState?: WorldState; readonly commandResult?: CommandResult; readonly extraEvents?: readonly TraceEventDraft[] } = {}): Trace => {
  const commandResult = options.commandResult;
  const events: TraceEventDraft[] = [
    {
      kind: "task",
      tick: 0,
      entityLinks: [{ kind: "task", id: "task:feeding" }, ...links],
      causalParentIds: [],
      payload: { taskId: "task:feeding", jobId: "job:feeding", artifactReferences: [ref("prompt:feeding")], exactContentManifest: { schemaVersion: "1", entries: [{ reference: ref("prompt:feeding") }], fingerprint: "fnv1a64:74b2c8d8d7f7a30b" } },
    },
    {
      kind: "tool-request",
      tick: 0,
      cycleId: "cycle:00000000",
      entityLinks: links,
      causalParentIds: ["event:feeding-00000001"],
      payload: { command: openGate, tool: ref("tool:gate-control") },
    },
  ];
  if (commandResult !== undefined) {
    events.push({
      kind: "tool-result",
      tick: 0,
      cycleId: "cycle:00000000",
      entityLinks: links,
      causalParentIds: ["event:feeding-00000002"],
      payload: { commandResult },
    });
    for (const delta of commandResult.accepted ? commandResult.deltas : []) events.push({ kind: "world-delta", tick: delta.tick, cycleId: "cycle:00000000", entityLinks: links, causalParentIds: ["event:feeding-00000003"], payload: { delta } });
  }
  events.push(...(options.extraEvents ?? []));
  const result = captureTrace({
    id: "trace:feeding",
    mode: "production",
    root: { taskId: "task:feeding", jobId: "job:feeding" },
    contentManifest: [ref("prompt:feeding"), ...fixture.exactContent],
    seed: fixture.initialState.seed,
    startTick: 0,
    initialState: fixture.initialState,
    events,
    authority: {
      initialState: fixture.initialState,
      exactContent: fixture.exactContent,
      allowedCommandKinds: fixture.allowedCommandKinds,
      commands: [{ decisionTick: 0, command: openGate }],
      commandResults: commandResult === undefined ? [] : [commandResult],
      worldEvents: commandResult?.accepted ? commandResult.events : [],
      worldDeltas: commandResult?.accepted ? commandResult.deltas : [],
    },
    finalState: options.finalState,
    outcome: { kind: "complete", reasonCode: "FEEDING_COMPLETE", expected: "gate open", observed: "gate open", consequence: "routine action", immediateCausalGap: "none" },
  });
  assert.equal(result.ok, true, result.ok ? undefined : result.fault.message);
  if (!result.ok) throw new Error(result.fault.message);
  return result.trace;
};

test("golden trace is versioned, authoritative, ordered, linked, and schema-safe", () => {
  const simulation = createSimulation(fixture);
  const commandResult = simulation.execute(openGate);
  assert.equal(commandResult.accepted, true);
  const trace = traceFor({ finalState: simulation.snapshot(), commandResult });
  assert.equal(trace.status, "complete");
  assert.deepEqual(trace.events.map((event) => [event.sequence, event.tick]), [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  assert.equal(trace.identity.contentManifest.entries[0]?.reference.id, "prompt:feeding");
  assert.equal(trace.authority.commandResults.length, 1);
  assert.equal(traceSchema.safeParse(trace).success, true);
  assert.equal(validateTrace(trace).ok, true);
  assert.equal(containsProhibitedTraceField(trace), false);
  assert.equal(projectCausalLinks(trace, trace.events[1]?.id).some((link) => link.id === "gate:alpha"), true);
});

test("prohibited reasoning fields fail capture and become a visible reliability fault", () => {
  const result = captureTrace({
    id: "trace:prohibited",
    mode: "production",
    root: { taskId: "task:feeding" },
    contentManifest: fixture.exactContent,
    seed: fixture.initialState.seed,
    startTick: 0,
    initialState: fixture.initialState,
    events: [{ kind: "message", tick: 0, entityLinks: [], causalParentIds: [], payload: { messageId: "message:bad", senderId: "agent:worker", messageType: "notice", summary: "safe", contextItemIds: [], reasoningText: "must not persist" } } as unknown as TraceEventDraft],
  });
  assert.equal(result.ok, false);
  assert.equal(result.trace.status, "invalid");
  assert.equal(result.fault.code, "TRACE_CAPTURE_PROHIBITED_FIELD");
  assert.equal(result.trace.events.some((event) => event.kind === "capture-fault"), true);
});

test("concise and detailed projections preserve unavailable/excluded/stale/never-routed distinctions", () => {
  const contextFixture = createContextFoundationFixture();
  const assembled = assembleContext(contextFixture.missingMaintenance);
  assert.equal(assembled.ok, true);
  if (!assembled.ok) throw new Error("Expected Context fixture to assemble.");
  const manifest: ContextManifest = assembled.afterRetention;
  const trace = traceFor({ extraEvents: [{
    kind: "context-assembly",
    tick: 0,
    cycleId: "cycle:00000000",
    entityLinks: [{ kind: "agent", id: "agent:worker" }, { kind: "job", id: "job:feeding" }],
    causalParentIds: [],
    payload: {
      afterManifest: manifest,
      entries: [
        { itemId: "context:available", availability: "available", used: true, reasonCode: "ROUTED_SOURCE_INCLUDED" },
        { itemId: "context:missing", availability: "unavailable", used: false, reasonCode: "REQUIRED_SOURCE_UNAVAILABLE" },
        { itemId: "context:evicted", availability: "excluded", used: false, reasonCode: "KEEP_NEWEST_OLDEST_ELIGIBLE" },
        { itemId: "context:stale", availability: "stale", used: false, reasonCode: "STALE_AT_DECISION" },
        { itemId: "context:not-routed", availability: "never-routed", used: false, reasonCode: "NO_ROUTE" },
      ],
      diagnostics: ["maintenance context was unavailable"],
    },
  }] });
  const concise = projectConciseTrace(trace);
  const detailed = projectDetailedTrace(trace);
  assert.equal(concise.immediateCausalGap, "none");
  assert.deepEqual(new Set(detailed.contextAvailability.map((entry) => entry.availability)), new Set(["available", "unavailable", "excluded", "stale", "never-routed"]));
  const filtered = projectDetailedTrace({ ...trace, events: trace.events.filter((event) => event.kind === "task") });
  assert.equal(trace.events.length > filtered.events.length, true);
  assert.equal(trace.events.some((event) => event.kind === "context-assembly"), true);
});

test("advanced Retention Policy audits remain exact trace records", () => {
  const contextFixture = createContextFoundationFixture();
  const assembled = assembleContext({ ...contextFixture.strictOverflow, capacity: 20, retentionPolicy: "PriorityRetention" });
  assert.equal(assembled.ok, true);
  if (!assembled.ok || assembled.retention === undefined) throw new Error("Expected a Priority Retention audit.");
  const trace = traceFor({ extraEvents: [{
    kind: "retention", tick: 4, cycleId: "cycle:00000004", entityLinks: [], causalParentIds: [],
    payload: { audit: assembled.retention, beforeEntries: assembled.beforeRetention.entries, afterEntries: assembled.afterRetention.entries },
  }] });
  const retention = trace.events.find((event) => event.kind === "retention");
  assert.equal(retention?.kind, "retention");
  if (retention?.kind !== "retention") throw new Error("Expected a retention event.");
  assert.equal(retention.payload.audit.policy, "PriorityRetention");
  assert.deepEqual(retention.payload.audit.excludedItemIds, assembled.retention.excludedItemIds);
});

test("historical replay controls are isolated, deterministic, and seekable", () => {
  const simulation = createSimulation(fixture);
  const commandResult = simulation.execute(openGate);
  assert.equal(commandResult.accepted, true);
  simulation.requestTicks(1);
  const productionBefore = simulation.snapshot();
  const trace = traceFor({ finalState: productionBefore, commandResult });
  const replay = createReplaySession(trace);
  assert.equal(replay.snapshot().mode, "historical-replay");
  assert.equal(replay.snapshot().paused, true);
  replay.setSpeed(4);
  replay.play();
  replay.advance(1);
  assert.equal(replay.snapshot().cursor.tick, 1);
  assert.equal(replay.snapshot().world.gates[0]?.position, "open");
  replay.seek({ eventId: trace.events[3]?.id });
  assert.equal(replay.snapshot().selectedEventId, trace.events[3]?.id);
  replay.pause();
  assert.deepEqual(simulation.snapshot(), productionBefore);
});

test("exact rerun proves equivalence and reports first mismatch", () => {
  const simulation = createSimulation(fixture);
  const commandResult = simulation.execute(openGate);
  assert.equal(commandResult.accepted, true);
  const trace = traceFor({ finalState: simulation.snapshot(), commandResult });
  assert.equal(verifyTraceRerun(trace).status, "equivalent");
  const changed = verifyTraceRerun(trace, { commands: [{ decisionTick: 0, command: { ...openGate, operation: "close" } }] });
  assert.equal(changed.status, "mismatch");
  assert.ok(changed.firstMismatch?.path.startsWith("commandResults") || changed.firstMismatch?.path === "finalState");
});

test("trace comparison aligns cycles and reports unmatched/different records", () => {
  const left = traceFor();
  const right = traceFor({ extraEvents: [{ kind: "outcome", tick: 1, cycleId: "cycle:00000001", entityLinks: [], causalParentIds: [], payload: { outcome: { kind: "failure", reasonCode: "CHANGED" } } }] });
  const comparison = compareTraces(left, right);
  assert.equal(comparison.compatible, true);
  assert.equal(comparison.alignments.some((alignment) => alignment.status === "right-only"), true);
  assert.equal(comparison.differences.some((difference) => difference.category === "alignment"), true);
});

test("long traces seek by tick without changing the immutable source", () => {
  const snapshots: TraceEventDraft[] = Array.from({ length: 200 }, (_, index) => {
    const state = { ...fixture.initialState, tick: index + 1 };
    return { kind: "snapshot", tick: index + 1, entityLinks: [], causalParentIds: [], payload: { state, stateFingerprint: "fnv1a64:74b2c8d8d7f7a30b" } };
  });
  const trace = traceFor({ extraEvents: snapshots, finalState: { ...fixture.initialState, tick: 200 } });
  const before = trace.events.length;
  const replay = createReplaySession(trace);
  assert.equal(replay.seek(150).world.tick, 150);
  assert.equal(trace.events.length, before);
});
