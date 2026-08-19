import assert from "node:assert/strict";
import test from "node:test";

import { createContentRegistry, fingerprintCatalogPackage, type CatalogPackage, type ContentRecord } from "../../src/content-registry/public.js";
import { composeInstructionArtifacts, createInstructionFoundationFixture, executeInstruction, executeInstructionTool, instructionArtifactDataSchema, resolveInstructionArtifacts, validateInstructionRecord, type ResolvedInstructionArtifact } from "../../src/instruction/public.js";
import { createSimulation, createSimulationFoundationFixture } from "../../src/simulation/public.js";

const facts = { "task.kind": "feed", "gate.position": "closed" } as const;
const decisionFor = (artifact: ResolvedInstructionArtifact) => executeInstruction({ artifacts: [artifact], facts, evidence: [], currentTick: 0 });

test("Instruction selects one exact feeding tool request and safely rejects missing context", () => {
  const fixture = createInstructionFoundationFixture(); const decision = decisionFor(fixture.selfContained);
  assert.equal(decision.outcome.kind, "tool-request");
  if (decision.outcome.kind === "tool-request") assert.deepEqual({ kind: decision.outcome.command.kind, operation: "operation" in decision.outcome.command ? decision.outcome.command.operation : undefined }, { kind: "operate-gate", operation: "open" });
  assert.deepEqual(decision.provenance.map((entry) => [entry.clauseId, entry.status, entry.reasonCode]), [["clause:open-for-feeding", "applied", "CLAUSE_SELECTED"]]);
  const missing = executeInstruction({ artifacts: [fixture.selfContained], facts: { "task.kind": "feed" }, evidence: [], currentTick: 0 });
  assert.deepEqual(missing.outcome, { kind: "stop", reasonCode: "REQUIRED_CONTEXT_UNAVAILABLE" }); assert.deepEqual(missing.unsatisfiedRequirements, ["gate.position"]);
});

test("Instruction keeps readable prose behaviorally inert", () => {
  const fixture = createInstructionFoundationFixture(); assert.notEqual(fixture.selfContained.readableSource, fixture.proseVariant.readableSource); assert.deepEqual(decisionFor(fixture.selfContained).outcome, decisionFor(fixture.proseVariant).outcome);
  const firstSimulation = createSimulation(createSimulationFoundationFixture()); const secondSimulation = createSimulation(createSimulationFoundationFixture());
  const first = executeInstructionTool(firstSimulation, decisionFor(fixture.selfContained)); const second = executeInstructionTool(secondSimulation, decisionFor(fixture.proseVariant));
  assert.deepEqual(first?.commandResult, second?.commandResult); assert.deepEqual(firstSimulation.snapshot(), secondSimulation.snapshot());
});

test("Instruction forwards physical actions to Simulation and consumes source-labeled evidence", () => {
  const fixture = createInstructionFoundationFixture(); const simulation = createSimulation(createSimulationFoundationFixture()); const result = executeInstructionTool(simulation, decisionFor(fixture.selfContained));
  assert.equal(result?.commandResult.accepted, true); assert.deepEqual(result?.evidence.map((entry) => ({ source: entry.source, sourceId: entry.sourceId, field: entry.field, value: entry.value, observedAtTick: entry.observedAtTick })), [{ source: "physical-gate", sourceId: "gate:alpha", field: "position", value: "open", observedAtTick: 0 }]); assert.equal(simulation.snapshot().gates[0]?.position, "open");
});

test("Instruction orders sources deterministically and stops or escalates explicit conflicts", () => {
  const fixture = createInstructionFoundationFixture(); const conflict: ResolvedInstructionArtifact = { ...fixture.containmentPolicy, reference: { id: "policy:gate-closed", version: "1.0.0" }, clauses: [{ ...fixture.selfContained.clauses[0]!, id: "clause:keep-gate-closed", priority: 100, outcome: { kind: "stop", reasonCode: "GATE_MUST_REMAIN_CLOSED" } }] };
  const composed = composeInstructionArtifacts([fixture.selfContained, conflict]); assert.deepEqual(composed.findings.map((entry) => [entry.kind, entry.reasonCode]), [["conflict", "CONFLICTING_OUTCOMES"]]);
  const decision = executeInstruction({ artifacts: [fixture.selfContained, conflict], facts, evidence: [], currentTick: 0 }); assert.deepEqual(decision.outcome, { kind: "stop", reasonCode: "CLAUSE_CONFLICT" }); assert.equal(decision.provenance.every((entry) => entry.status === "conflicting"), true);
  const escalated = executeInstruction({ artifacts: [{ ...conflict, clauses: [{ ...conflict.clauses[0]!, conflictResolution: "escalate" }] }, fixture.selfContained], facts, evidence: [], currentTick: 0 }); assert.deepEqual(escalated.outcome, { kind: "escalate", reasonCode: "CLAUSE_CONFLICT", target: "agent:manager" });
});

test("Instruction combines matching authored outcomes and selects a stable winner when permitted", () => {
  const fixture = createInstructionFoundationFixture(); const matching: ResolvedInstructionArtifact = { ...fixture.selfContained, reference: { id: "skill:matching-feed", version: "1.0.0" }, class: "Skill", clauses: [{ ...fixture.selfContained.clauses[0]!, id: "clause:matching-feed", conflictResolution: "combine" }] };
  const combined = executeInstruction({ artifacts: [{ ...fixture.selfContained, clauses: [{ ...fixture.selfContained.clauses[0]!, conflictResolution: "combine" }] }, matching], facts, evidence: [], currentTick: 0 }); assert.equal(combined.outcome.kind, "tool-request"); assert.deepEqual(combined.provenance.map((entry) => [entry.clauseId, entry.status, entry.reasonCode]), [["clause:matching-feed", "applied", "CLAUSES_COMBINED"], ["clause:open-for-feeding", "applied", "CLAUSES_COMBINED"]]);
  const alternate: ResolvedInstructionArtifact = { ...matching, clauses: [{ ...matching.clauses[0]!, id: "clause:alternate-feed", conflictResolution: "select", outcome: { kind: "wait", reasonCode: "WAIT_FOR_CLEARANCE" } }] };
  const selected = executeInstruction({ artifacts: [{ ...fixture.selfContained, clauses: [{ ...fixture.selfContained.clauses[0]!, conflictResolution: "select" }] }, alternate], facts, evidence: [], currentTick: 0 }); assert.deepEqual(selected.outcome, { kind: "wait", reasonCode: "WAIT_FOR_CLEARANCE" }); assert.equal(selected.provenance.some((entry) => entry.status === "conflicting"), true); assert.equal(selected.provenance.some((entry) => entry.status === "applied"), true);
});

test("Instruction requires fresh reliable agreeing evidence and applies bounded fallback", () => {
  const fixture = createInstructionFoundationFixture(); const verificationFacts = { "task.stage": "verify" } as const;
  const healthy = executeInstruction({ artifacts: [fixture.containmentPolicy], facts: verificationFacts, evidence: [{ source: "gate-sensor", sourceId: "gate:alpha", field: "position", value: "closed", reliability: "healthy", observedAtTick: 4 }], currentTick: 5 }); assert.deepEqual(healthy.outcome, { kind: "complete", reasonCode: "CONTAINMENT_VERIFIED" }); assert.equal(healthy.provenance[0]?.reasonCode, "VERIFICATION_SATISFIED");
  const degraded = executeInstruction({ artifacts: [fixture.degradedVerification], facts: verificationFacts, evidence: [{ source: "gate-sensor", sourceId: "gate:alpha", field: "position", value: "closed", reliability: "degraded", observedAtTick: 5 }], currentTick: 5 }); assert.deepEqual(degraded.outcome, { kind: "escalate", reasonCode: "GATE_EVIDENCE_UNRELIABLE", target: "agent:manager" }); assert.equal(degraded.provenance[0]?.reasonCode, "VERIFICATION_INSUFFICIENT");
  const retry = executeInstruction({ artifacts: [fixture.containmentPolicy], facts: verificationFacts, evidence: [], currentTick: 5, retryCounts: { "clause:verify-containment": 0 } }); assert.equal(retry.outcome.kind, "tool-request"); if (retry.outcome.kind === "tool-request") assert.equal(retry.outcome.command.kind, "observe-gate");
  const exhausted = executeInstruction({ artifacts: [fixture.containmentPolicy], facts: verificationFacts, evidence: [], currentTick: 5, retryCounts: { "clause:verify-containment": 1 } }); assert.deepEqual(exhausted.outcome, { kind: "stop", reasonCode: "VERIFICATION_RETRY_EXHAUSTED" });
});

test("Instruction exposes self-contained and modular tradeoffs without a best ranking", () => {
  const fixture = createInstructionFoundationFixture(); assert.ok(fixture.selfContained.contextCost > fixture.modularPrompt.contextCost); assert.deepEqual(fixture.selfContained.dependencies, []); assert.deepEqual(fixture.modularPrompt.dependencies, [{ id: "skill:safe-feeding", version: "1.0.0" }]); assert.equal("rank" in fixture.modularPrompt, false); assert.equal("best" in fixture.modularPrompt, false);
});

test("Instruction rejects arbitrary code, unknown operators, invalid paths, and direct effects", () => {
  const fixture = createInstructionFoundationFixture(); const data = { schemaVersion: "1", requiredTools: [], knownTradeoffs: [], clauses: [{ ...fixture.selfContained.clauses[0], applicability: { operator: "javascript", code: "world.gates[0].position='open'" }, effect: { mutate: "world" } }] };
  assert.equal(instructionArtifactDataSchema.safeParse(data).success, false); assert.equal(instructionArtifactDataSchema.safeParse({ ...data, clauses: [{ ...fixture.selfContained.clauses[0], requiredFacts: ["World Gates[0]"] }] }).success, false);
});

test("Instruction validates and resolves exact records through Content Registry", () => {
  const fixture = createInstructionFoundationFixture(); const data = { schemaVersion: "1", requiredTools: fixture.selfContained.requiredTools, clauses: fixture.selfContained.clauses, knownTradeoffs: fixture.selfContained.knownTradeoffs };
  const record: ContentRecord = { id: fixture.selfContained.reference.id, version: fixture.selfContained.reference.version, class: "Prompt", schemaVersion: "1", displayName: "Self-contained feeding", author: "Park Engineering", provenance: { source: "built-in", path: "content/instruction/self-contained-feeding.json", author: "Park Engineering" }, contextCost: 12, dependencies: [], tags: ["instruction"], availability: "available", readableSource: fixture.selfContained.readableSource, data }; assert.equal(validateInstructionRecord(record).ok, true);
  const unsigned: Omit<CatalogPackage, "fingerprint"> = { packageId: "instruction-package:foundation", packageVersion: "1.0.0", registrySchemaVersion: "1", requirement: "required", entries: [record] }; const registry = createContentRegistry({ registrySchemaVersion: "1", classDefinitions: [{ class: "Prompt", schemaVersion: "1", schema: instructionArtifactDataSchema }] }).loadPackages([{ ...unsigned, fingerprint: fingerprintCatalogPackage(unsigned) }]).registry;
  assert.deepEqual(resolveInstructionArtifacts(registry, [fixture.selfContained.reference]), { ok: true, artifacts: [fixture.selfContained] }); const missing = resolveInstructionArtifacts(registry, [{ id: fixture.selfContained.reference.id, version: "9.9.9" }]); assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.diagnostics[0]?.code, "INSTRUCTION_CONTENT_MISSING");
});

test("Instruction uses one executor contract for production and eval without hidden reasoning", () => {
  const fixture = createInstructionFoundationFixture(); const production = executeInstruction({ artifacts: [fixture.selfContained], facts, evidence: [], currentTick: 0 }); const evalRun = executeInstruction({ artifacts: [fixture.selfContained], facts: structuredClone(facts), evidence: [], currentTick: 0 }); assert.deepEqual(evalRun, production); assert.doesNotMatch(JSON.stringify(evalRun), /chain.?of.?thought|reasoningText|innerThought/iu);
});
