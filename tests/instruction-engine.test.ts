import assert from "node:assert/strict";
import test from "node:test";
import { createContentRegistry, type ArtifactVersion } from "../content-registry/index.ts";
import { createContextService } from "../context/index.ts";
import { compileRuleGraph, createInstructionEngine } from "../instruction/index.ts";
import { createSimulationEngine, createStarterFixture } from "../simulation/index.ts";

function runFixture(artifacts: readonly ArtifactVersion[], jobOverrides: Record<string, unknown> = {}) {
  const registry = createContentRegistry();
  const loaded = registry.loadPack({ schemaVersion: 1, packId: `fixture.instruction.${artifacts.map((item) => item.artifactId).join(".")}`, artifacts });
  assert.equal(loaded.ok, true);
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const prompt = artifacts.find((item) => item.type === "PROMPT") ?? artifacts[0]!;
  const job = {
    id: "job.feed.rex",
    type: "FEED",
    targetRefs: ["dino.rex"],
    priority: 1,
    dueTime: 100,
    assignedAgentId: "agent.keeper01",
    promptRef: { artifactId: prompt.artifactId, version: prompt.version },
    ...jobOverrides,
  } as const;
  const agent = { id: "agent.keeper01", contextBudget: 8000, toolIds: createStarterFixture().agents[0]!.tools };
  const prepared = engine.prepare(job, agent);
  if (prepared.ok === false) throw new Error(prepared.error.code);
  const started = engine.start(prepared.value);
  const done = engine.runToCompletion(started.executionId);
  return { done, simulation, prepared: prepared.value };
}

test("slice 1 executes under-specified feeding deterministically and exposes missing postcondition", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.feed",
    version: 1,
    type: "PROMPT",
    title: "Feed Rex",
    sourceText: "Feed Rex.",
    clauses: [
      { id: "feed.goal", sourceText: "Rex is fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" }, priority: 1 },
      { id: "feed.move.service", sourceText: "Go to service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service" }, priority: 100 },
      { id: "feed.open", sourceText: "Open the gate.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma" }, priority: 90 },
      { id: "feed.move.interior", sourceText: "Enter.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior" }, priority: 80 },
      { id: "feed.food", sourceText: "Dispense food.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex" }, priority: 70 },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "open_gate", "dispense_food"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const first = runFixture([prompt]);
  const second = runFixture([prompt]);
  assert.equal(first.done.status, "SUCCEEDED");
  assert.equal(first.done.outcome?.reasonCode, "GOAL_ACHIEVED_WITHOUT_POSTCONDITION");
  assert.deepEqual(first.done.outcome?.missingPostconditions, ["No POSTCONDITION clause was loaded for this job."]);
  assert.equal(first.done.outcome?.worldSnapshot.gates.find((gate) => gate.id === "gate.gamma")?.state, "OPEN");
  assert.equal(first.done.graph.canonical, second.done.graph.canonical);
  assert.deepEqual(first.done.provenance, second.done.provenance);
  assert.deepEqual(first.done.outcome, second.done.outcome);
  assert.ok(first.done.provenance.some((event) => event.type === "TOOL_REQUESTED" && event.payload.tool === "dispense_food"));
});

test("slice 2 executes a safe Skill with postconditions and resolves skill over prompt on ties", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.safe",
    version: 1,
    type: "PROMPT",
    title: "Safe feed intent",
    sourceText: "Feed and secure.",
    clauses: [
      { id: "safe.goal", sourceText: "Fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" } },
      { id: "safe.move.prompt", sourceText: "Prompt route.", type: "ACTION", semanticKey: "route.to.service", action: { tool: "move_to", zoneId: "zone.gamma.interior" }, priority: 1 },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "dispense_food"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const skill: ArtifactVersion = {
    artifactId: "fixture.instruction.skill.safe",
    version: 1,
    type: "SKILL",
    title: "Safe feeding",
    sourceText: "Bait, feed, exit, secure.",
    clauses: [
      { id: "safe.move.skill", sourceText: "Service.", type: "ACTION", semanticKey: "route.to.service", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 10 }, priority: 1 },
      { id: "safe.open", sourceText: "Open.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma", order: 20 }, priority: 90 },
      { id: "safe.enter", sourceText: "Enter.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.interior", order: 30 }, priority: 80 },
      { id: "safe.food", sourceText: "Feed.", type: "ACTION", action: { tool: "dispense_food", dinosaurId: "dino.rex", order: 40 }, priority: 70 },
      { id: "safe.exit", sourceText: "Exit.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 50 }, priority: 60 },
      { id: "safe.close", sourceText: "Close.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 60 }, priority: 50 },
      { id: "safe.lock", sourceText: "Lock.", type: "ACTION", action: { tool: "lock_gate", gateId: "gate.gamma", order: 70 }, priority: 40 },
      { id: "safe.contained", sourceText: "Contained.", type: "POSTCONDITION", assert: { fact: "DINOSAUR_CONTAINED" }, priority: 1 },
    ],
    dependencies: [{ artifactId: prompt.artifactId, version: 1 }],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "open_gate", "close_gate", "lock_gate", "dispense_food"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const result = runFixture([prompt, skill], { skillRefs: [{ artifactId: skill.artifactId, version: 1 }] });
  assert.equal(result.done.status, "SUCCEEDED", JSON.stringify(result.done.outcome));
  assert.equal(result.done.outcome?.reasonCode, "GOALS_AND_POSTCONDITIONS_PASSED");
  assert.equal(result.done.outcome?.postconditionResults[0]?.passed, true);
  assert.equal(result.done.outcome?.worldSnapshot.gates.find((gate) => gate.id === "gate.gamma")?.state, "LOCKED");
  const routeEvents = result.done.provenance.filter((event) => event.type === "TOOL_REQUESTED" && event.payload.tool === "move_to");
  assert.equal(routeEvents[0]?.clauseId, "safe.move.skill");
  assert.ok(result.done.provenance.some((event) => event.type === "CONFLICT_RESOLVED" && event.payload.semanticKey === "route.to.service"));
});

test("slice 2 blocks a hard safety constraint before the prohibited action", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.constraint",
    version: 1,
    type: "PROMPT",
    title: "Constraint test",
    sourceText: "Open the gate.",
    clauses: [
      { id: "constraint.goal", sourceText: "Fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" } },
      { id: "constraint.move", sourceText: "Service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service" }, priority: 100 },
      { id: "constraint.open", sourceText: "Open.", type: "ACTION", action: { tool: "open_gate", gateId: "gate.gamma" }, priority: 90 },
      { id: "constraint.safety", sourceText: "Never open.", type: "CONSTRAINT", action: { prohibit: "open_gate" }, conditions: { enabled: true }, priority: 100 },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "open_gate"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const result = runFixture([prompt]);
  assert.equal(result.done.status, "FAILED");
  assert.equal(result.done.outcome?.reasonCode, "GOAL_NOT_ACHIEVED");
  assert.equal(result.done.provenance.filter((event) => event.type === "TOOL_REQUESTED" && event.payload.tool === "open_gate").length, 0);
  assert.ok(result.done.provenance.some((event) => event.type === "CLAUSE_SKIPPED" && event.payload.tool === "open_gate"));
});

test("slice 3 blocks context overflow before any simulation command and emits retrieval requests", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.overflow",
    version: 1,
    type: "PROMPT",
    title: "Overflow prompt",
    sourceText: "x".repeat(40_000),
    clauses: [
      { id: "overflow.goal", sourceText: "Already fed.", type: "GOAL", assert: { fact: "DINOSAUR_FED" } },
      { id: "overflow.retrieve", sourceText: "Retrieve gate note.", type: "RETRIEVAL", action: { refs: ["memory.gate.gamma"], query: "current gate status" } },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: [],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.overflow", artifacts: [prompt] }).ok, true);
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const blocked = engine.prepare({ id: "job.overflow", type: "FEED", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: prompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 10, toolIds: [] });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error.code, "BLOCKED_CONTEXT_OVERFLOW");
  assert.equal(simulation.events().length, 0);

  const smallPrompt: ArtifactVersion = { ...prompt, artifactId: "fixture.instruction.prompt.retrieve", sourceText: "Retrieve.", clauses: [{ id: "retrieve.goal", sourceText: "Contained.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } }, { id: "retrieve.request", sourceText: "Retrieve.", type: "RETRIEVAL", action: { refs: ["memory.gate.gamma"], query: "gate" } }] };
  const retrievalRegistry = createContentRegistry();
  assert.equal(retrievalRegistry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.retrieve", artifacts: [smallPrompt] }).ok, true);
  const retrievalSimulation = createSimulationEngine();
  assert.equal(retrievalSimulation.load(createStarterFixture(), 7).ok, true);
  const retrievalEngine = createInstructionEngine({ content: retrievalRegistry, context: createContextService(), simulation: retrievalSimulation });
  const prepared = retrievalEngine.prepare({ id: "job.retrieve", type: "INSPECT", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: smallPrompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: [] });
  if (prepared.ok === false) throw new Error(prepared.error.code);
  const done = retrievalEngine.start(prepared.value);
  assert.deepEqual(done.retrievalRequests, [{ clauseId: "retrieve.request", refs: ["memory.gate.gamma"], query: "gate" }]);
  assert.equal(done.status, "SUCCEEDED");
});

test("slice 3 follows the authored JAMMED fallback/escalation path", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.jam",
    version: 1,
    type: "PROMPT",
    title: "Jam path",
    sourceText: "Close and escalate if jammed.",
    clauses: [
      { id: "jam.goal", sourceText: "Containment.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } },
      { id: "jam.move", sourceText: "Service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 } },
      { id: "jam.close", sourceText: "Close.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 2 } },
      { id: "jam.escalate", sourceText: "Alert security.", type: "ESCALATION", conditions: { errorCode: "JAMMED" }, action: { tool: "alert_security", targetZoneId: "zone.gamma.service", severity: 3 } },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "close_gate", "alert_security"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.jam", artifacts: [prompt] }).ok, true);
  const simulation = createSimulationEngine();
  const fixture = createStarterFixture();
  assert.equal(simulation.load({ ...fixture, faults: [{ id: "fault.jam.gamma", logicalTime: 0, type: "GATE_JAM", targetId: "gate.gamma" }] }, 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const prepared = engine.prepare({ id: "job.jam", type: "SECURE", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: prompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: fixture.agents[0]!.tools });
  if (prepared.ok === false) throw new Error(prepared.error.code);
  const done = engine.runToCompletion(engine.start(prepared.value).executionId);
  assert.equal(done.status, "ESCALATED", JSON.stringify(done.outcome));
  assert.equal(done.outcome?.reasonCode, "ESCALATION_EMITTED");
  assert.ok(done.outcome?.incidentIds.length);
  assert.ok(done.provenance.some((event) => event.type === "TOOL_RESULT" && event.payload.code === "JAMMED"));
  assert.ok(done.provenance.some((event) => event.type === "DELEGATION_REQUEST" || event.type === "TOOL_REQUESTED" && event.payload.tool === "alert_security"));
});

test("slice 3 uses a degraded-sensor fallback before deterministic escalation", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.degraded",
    version: 1,
    type: "PROMPT",
    title: "Degraded sensor path",
    sourceText: "Verify the degraded gate and escalate.",
    clauses: [
      { id: "degraded.goal", sourceText: "Containment.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } },
      { id: "degraded.move", sourceText: "Service.", type: "ACTION", action: { tool: "move_to", zoneId: "zone.gamma.service", order: 1 } },
      { id: "degraded.close", sourceText: "Close.", type: "ACTION", action: { tool: "close_gate", gateId: "gate.gamma", order: 2 } },
      { id: "degraded.post", sourceText: "Sensor confirms closed.", type: "POSTCONDITION", assert: { path: "gates[gate.gamma].sensorState", expected: "CLOSED" } },
      { id: "degraded.fallback", sourceText: "Observe again.", type: "FALLBACK", conditions: { path: "gates[gate.gamma].sensorState", expected: "UNKNOWN" }, action: { tool: "observe", targetId: "gate.gamma" } },
      { id: "degraded.escalate", sourceText: "Escalate unknown sensor.", type: "ESCALATION", conditions: { errorCode: "POSTCONDITION_FAILED", path: "gates[gate.gamma].sensorState", expected: "UNKNOWN" }, action: { tool: "alert_security", targetZoneId: "zone.gamma.service", severity: 3 } },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["move_to", "close_gate", "observe", "alert_security"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.degraded", artifacts: [prompt] }).ok, true);
  const simulation = createSimulationEngine();
  const fixture = createStarterFixture();
  assert.equal(simulation.load({ ...fixture, faults: [{ id: "fault.sensor.gamma", logicalTime: 0, type: "SENSOR_DEGRADE", targetId: "gate.gamma" }] }, 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const prepared = engine.prepare({ id: "job.degraded", type: "SECURE", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: prompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: fixture.agents[0]!.tools });
  if (prepared.ok === false) throw new Error(prepared.error.code);
  const done = engine.runToCompletion(engine.start(prepared.value).executionId);
  assert.equal(done.status, "ESCALATED", JSON.stringify(done.outcome));
  assert.ok(done.provenance.some((event) => event.clauseId === "degraded.fallback" && event.type === "TOOL_REQUESTED"));
  assert.ok(done.provenance.some((event) => event.clauseId === "degraded.escalate" && event.type === "TOOL_REQUESTED"));
});

test("slice 4 emits typed delegation/reporting requests and cancels at a safe point", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.orchestration",
    version: 1,
    type: "PROMPT",
    title: "Orchestration boundary",
    sourceText: "Delegate and report.",
    clauses: [
      { id: "orch.goal", sourceText: "Containment.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } },
      { id: "orch.delegate", sourceText: "Delegate security.", type: "DELEGATION", action: { targetAgentId: "agent.security", taskType: "CLEAR_BUFFER", targetRefs: ["zone.gamma.buffer"] } },
      { id: "orch.report", sourceText: "Report.", type: "REPORTING", action: { status: "READY", message: "security handoff requested", facts: { priority: "safety" } } },
      { id: "orch.move", sourceText: "Observe.", type: "ACTION", action: { tool: "observe", targetId: "dino.rex", order: 1 } },
    ],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["observe"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const normal = runFixture([prompt]);
  assert.equal(normal.done.status, "SUCCEEDED");
  assert.deepEqual(normal.done.delegationRequests[0], { executionId: normal.done.executionId, jobId: "job.feed.rex", clauseId: "orch.delegate", targetAgentId: "agent.security", taskType: "CLEAR_BUFFER", targetRefs: ["zone.gamma.buffer"] });
  assert.deepEqual(normal.done.reports[0], { clauseId: "orch.report", status: "READY", message: "security handoff requested", facts: { priority: "safety" } });

  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.cancel", artifacts: [prompt] }).ok, true);
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const prepared = engine.prepare({ id: "job.cancel", type: "OBSERVE", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: prompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: createStarterFixture().agents[0]!.tools });
  if (prepared.ok === false) throw new Error(prepared.error.code);
  const started = engine.start(prepared.value);
  const paused = engine.cancelAtSafePoint(started.executionId);
  assert.equal(paused.status, "RUNNING");
  assert.ok(paused.pendingCommandId);
  const atSafePoint = engine.runToCompletion(started.executionId);
  assert.equal(atSafePoint.status, "PAUSED");
  assert.equal(atSafePoint.outcome, undefined);
  assert.ok(atSafePoint.provenance.some((event) => event.type === "STATUS" && event.payload.reasonCode === "PAUSED_AT_SAFE_POINT"));
  const resumed = engine.runToCompletion(started.executionId);
  assert.equal(resumed.status, "SUCCEEDED");
  assert.ok(resumed.provenance.some((event) => event.type === "STATUS" && event.payload.reasonCode === "RESUMED"));
});

test("slice 5 covers all clause categories, malformed clauses, loop guards, and incident-aware success", () => {
  const categories = ["GOAL", "PRECONDITION", "ACTION", "SEQUENCE", "CONSTRAINT", "POSTCONDITION", "FALLBACK", "ESCALATION", "DELEGATION", "REPORTING", "RETRIEVAL", "PRIORITY"] as const;
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.categories",
    version: 1,
    type: "PROMPT",
    title: "Category coverage",
    sourceText: "Semantic categories.",
    clauses: categories.map((type, index) => ({ id: `category.${type.toLowerCase()}`, sourceText: `${type}.`, type, priority: index, ...(type === "GOAL" ? { assert: { fact: "DINOSAUR_CONTAINED" } } : {}), ...(type === "ACTION" ? { action: { tool: "observe", targetId: "dino.rex", order: 20 } } : {}), ...(type === "RETRIEVAL" ? { action: { refs: ["memory.gate.gamma"] } } : {}), ...(type === "DELEGATION" ? { action: { targetAgentId: "agent.other" } } : {}), ...(type === "REPORTING" ? { action: { status: "OK" } } : {}), ...(type === "SEQUENCE" ? { action: { order: 1 } } : {}) })) as ArtifactVersion["clauses"],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["observe"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.categories", artifacts: [prompt] }).ok, true);
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const prepared = engine.prepare({ id: "job.categories", type: "COVERAGE", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", maxSteps: 2, promptRef: { artifactId: prompt.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: createStarterFixture().agents[0]!.tools });
  if (prepared.ok === false) throw new Error(prepared.error.code);
  assert.deepEqual(new Set(prepared.value.graph.nodes.map((node) => node.category)), new Set(categories));
  const limited = engine.runToCompletion(engine.start(prepared.value).executionId);
  assert.equal(limited.status, "FAILED");
  assert.equal(limited.outcome?.reasonCode, "STEP_LIMIT_EXCEEDED");

  const incidentPrompt: ArtifactVersion = { ...prompt, artifactId: "fixture.instruction.prompt.incident", clauses: [{ id: "incident.goal", sourceText: "Contained.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } }, { id: "incident.alert", sourceText: "Alert.", type: "ACTION", action: { tool: "alert_security", targetZoneId: "zone.gamma.service", severity: 3 } }] };
  const incidentRun = runFixture([incidentPrompt]);
  assert.equal(incidentRun.done.status, "SUCCEEDED");
  assert.equal(incidentRun.done.outcome?.reasonCode, "GOAL_ACHIEVED_WITH_SAFETY_INCIDENT");
  assert.ok(incidentRun.done.outcome?.incidentIds.length);
});

test("slice 5 rejects malformed semantic clauses and keeps false applicability observable", () => {
  const malformed = {
    artifactId: "fixture.instruction.malformed",
    version: 1,
    type: "PROMPT",
    title: "Malformed",
    sourceText: "Ignored.",
    clauses: [{ id: "bad.category", sourceText: "Ignored.", type: "NOT_A_CLAUSE" }],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: [],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  } as unknown as ArtifactVersion;
  const registry = { getArtifact: (ref: { artifactId: string; version: number }) => ref.artifactId === malformed.artifactId && ref.version === 1 ? malformed : undefined };
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const engine = createInstructionEngine({ content: registry, context: createContextService(), simulation });
  const blocked = engine.prepare({ id: "job.malformed", type: "CHECK", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: malformed.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: [] });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error.code, "MALFORMED_CLAUSE");

  const inapplicable: ArtifactVersion = { ...malformed, artifactId: "fixture.instruction.inapplicable", clauses: [{ id: "inapplicable.goal", sourceText: "Ignored.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } }], applicabilityTags: ["task:other"] };
  const applicableRegistry = { getArtifact: (ref: { artifactId: string; version: number }) => ref.artifactId === inapplicable.artifactId && ref.version === 1 ? inapplicable : undefined };
  const context = createContextService().project({ agentId: "agent.keeper01", jobId: "job.inapplicable", budget: 8000, promptRef: { artifactId: inapplicable.artifactId, version: 1 }, registry: applicableRegistry });
  assert.equal(context.ok, true);
  if (context.ok) {
    const graph = compileRuleGraph({ id: "job.inapplicable", type: "CHECK", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: inapplicable.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000 }, context.value, applicableRegistry);
    assert.equal(graph.nodes[0]?.applicable, false);
    assert.ok(graph.skippedNodeIds.includes(graph.nodes[0]!.nodeId));
  }
});

test("QA: supplied context snapshots cannot bypass load, budget, artifact, or tool validation", () => {
  const prompt: ArtifactVersion = {
    artifactId: "fixture.instruction.prompt.supplied-context",
    version: 1,
    type: "PROMPT",
    title: "Supplied context",
    sourceText: "Observe containment.",
    clauses: [{ id: "supplied.goal", sourceText: "Contained.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } }, { id: "supplied.observe", sourceText: "Observe.", type: "ACTION", action: { tool: "observe", targetId: "dino.rex" } }],
    dependencies: [],
    applicabilityTags: [],
    requiredToolIds: ["observe"],
    status: "DEPLOYED",
    authoredByCapability: "fixture",
    createdAtGameTime: 0,
  };
  const registry = createContentRegistry();
  assert.equal(registry.loadPack({ schemaVersion: 1, packId: "fixture.instruction.supplied-context", artifacts: [prompt] }).ok, true);
  const baseJob = { id: "job.supplied-context", type: "OBSERVE", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: prompt.artifactId, version: 1 } } as const;
  const agent = { id: "agent.keeper01", contextBudget: 8000, toolIds: ["observe"] } as const;
  const projected = createContextService().project({ agentId: agent.id, jobId: baseJob.id, budget: agent.contextBudget, promptRef: baseJob.promptRef, toolIds: agent.toolIds, registry });
  if (projected.ok === false) throw new Error(projected.error.code);

  const makeEngine = () => {
    const simulation = createSimulationEngine();
    assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
    return { engine: createInstructionEngine({ content: registry, context: createContextService(), simulation }), simulation };
  };
  const cases = [
    { name: "overflow", snapshot: { ...projected.value, budget: 1 }, code: "BLOCKED_CONTEXT_OVERFLOW" },
    { name: "unreconciled load", snapshot: { ...projected.value, totalLoad: projected.value.totalLoad + 1 }, code: "INVALID_CONTEXT_SNAPSHOT" },
    { name: "forged budget", snapshot: { ...projected.value, budget: 9000 }, code: "INVALID_CONTEXT_SNAPSHOT" },
    { name: "missing tool schema", snapshot: { ...projected.value, items: projected.value.items.filter((item) => item.kind !== "TOOL"), totalLoad: projected.value.items.filter((item) => item.kind !== "TOOL").reduce((sum, item) => sum + item.contextCost, 0) }, code: "MISSING_TOOL" },
  ] as const;
  for (const item of cases) {
    const { engine, simulation } = makeEngine();
    const result = engine.prepare({ ...baseJob, contextSnapshot: item.snapshot }, agent);
    assert.equal(result.ok, false, item.name);
    if (!result.ok) assert.equal(result.error.code, item.code, item.name);
    assert.equal(simulation.events().length, 0, `${item.name} must not execute a tool`);
  }
});

test("QA: cyclic injected content ports return stable blocked diagnostics", () => {
  const first: ArtifactVersion = { artifactId: "fixture.instruction.cycle.a", version: 1, type: "PROMPT", title: "A", sourceText: "A.", clauses: [{ id: "cycle.goal", sourceText: "Contained.", type: "GOAL", assert: { fact: "DINOSAUR_CONTAINED" } }], dependencies: [{ artifactId: "fixture.instruction.cycle.b", version: 1 }], applicabilityTags: [], requiredToolIds: [], status: "DEPLOYED", authoredByCapability: "fixture", createdAtGameTime: 0 };
  const second: ArtifactVersion = { ...first, artifactId: "fixture.instruction.cycle.b", type: "SKILL", title: "B", dependencies: [{ artifactId: first.artifactId, version: 1 }], clauses: [] };
  const records = new Map([[`${first.artifactId}@1`, first], [`${second.artifactId}@1`, second]]);
  const content = {
    getArtifact: (ref: { artifactId: string; version: number }) => records.get(`${ref.artifactId}@${ref.version}`),
    dependencies: (ref: { artifactId: string; version: number }) => records.get(`${ref.artifactId}@${ref.version}`)?.dependencies ?? [],
  };
  const run = () => {
    const simulation = createSimulationEngine();
    assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
    return createInstructionEngine({ content, context: createContextService(), simulation }).prepare({ id: "job.cycle", type: "CHECK", targetRefs: ["dino.rex"], priority: 1, dueTime: 1, assignedAgentId: "agent.keeper01", promptRef: { artifactId: first.artifactId, version: 1 } }, { id: "agent.keeper01", contextBudget: 8000, toolIds: [] });
  };
  const one = run();
  const two = run();
  assert.equal(one.ok, false);
  assert.deepEqual(one, two);
  if (!one.ok) {
    assert.equal(one.error.code, "DEPENDENCY_CYCLE");
    assert.deepEqual(one.error.diagnostics, ["artifact dependency cycle: fixture.instruction.cycle.a@1 -> fixture.instruction.cycle.b@1 -> fixture.instruction.cycle.a@1"]);
  }
});

test("QA: null, undefined, and malformed jobs always return stable blocks", () => {
  const simulation = createSimulationEngine();
  assert.equal(simulation.load(createStarterFixture(), 7).ok, true);
  const content = { getArtifact: () => undefined };
  const engine = createInstructionEngine({ content, context: createContextService(), simulation });
  const prepare = engine.prepare as unknown as (job: unknown, agent: unknown) => { ok: boolean; error?: { code: string; jobId: string; diagnostics: readonly string[] } };
  for (const [job, agent] of [[null, null], [undefined, undefined], [{}, {}], [{ id: "job.bad", targetRefs: "bad" }, { id: "agent.bad", contextBudget: -1 }]]) {
    let result: ReturnType<typeof prepare> | undefined;
    assert.doesNotThrow(() => { result = prepare(job, agent); });
    assert.equal(result?.ok, false);
    assert.equal(result?.error?.code, "INVALID_JOB");
    assert.ok(result?.error?.diagnostics.length);
  }
});
