import React, { useMemo, useRef, useState } from "react";

import { assembleContext, contextFacts, createContextFoundationFixture } from "../context/public.js";
import {
  createInstructionFoundationFixture,
  executeInstruction,
  executeInstructionTool,
  type InstructionDecision,
  type ResolvedInstructionArtifact,
} from "../instruction/public.js";
import {
  createSimulation,
  type CommandResult,
  type SimulationEngine,
  type StableId,
  type WorldState,
} from "../simulation/public.js";
import {
  createRegistryLabProjection,
  createSimulationRegistryProof,
  runFoundationReplay,
} from "./integration.js";

const id = (value: string): StableId => value as StableId;
const ref = (value: string) => ({ id: value, version: "1.0.0" });

const describeCommand = (label: string, result: CommandResult): string => result.accepted
  ? `${label}: accepted with ${result.deltas.length} world delta(s) and ${result.evidence.length} evidence item(s).`
  : `${label}: rejected safely with ${result.diagnostics.map((entry) => entry.code).join(", ")}.`;

const createEngine = (): SimulationEngine => createSimulation(createSimulationRegistryProof().fixture);

const describeInstructionOutcome = (decision: InstructionDecision): string => {
  if (decision.outcome.kind === "tool-request") return `Tool request: ${decision.outcome.command.kind}.`;
  if (decision.outcome.kind === "escalate") return `Escalate to ${decision.outcome.target}: ${decision.outcome.reasonCode}.`;
  return `${decision.outcome.kind}: ${decision.outcome.reasonCode}.`;
};

export function FoundationLab(): React.JSX.Element {
  const proof = useMemo(createSimulationRegistryProof, []);
  const [registryVersion, setRegistryVersion] = useState("1.0.0");
  const registry = useMemo(() => createRegistryLabProjection(registryVersion), [registryVersion]);
  const [engine, setEngine] = useState<SimulationEngine>(createEngine);
  const [world, setWorld] = useState<WorldState>(() => engine.project());
  const [history, setHistory] = useState<readonly string[]>([
    "Foundation fixture loaded through the Content Registry at exact version 1.0.0.",
  ]);
  const instructionFixture = useMemo(createInstructionFoundationFixture, []);
  const [instructionEvidence, setInstructionEvidence] = useState("No instruction decision has run yet.");
  const contextFixture = useMemo(createContextFoundationFixture, []);
  const contextBase = useMemo(() => assembleContext(contextFixture.base), [contextFixture]);
  const [contextEvidence, setContextEvidence] = useState("No Context lifecycle scenario has run yet.");
  const sequence = useRef(0);

  const refresh = (message: string): void => {
    setWorld(engine.project());
    setHistory((entries) => [...entries, message]);
  };
  const reset = (message = "Simulation reset to the exact registry-loaded fixture."): SimulationEngine => {
    const replacement = createSimulation(proof.fixture);
    setEngine(replacement);
    setWorld(replacement.project());
    setHistory((entries) => [...entries, message]);
    return replacement;
  };
  const nextCommandId = (label: string): StableId => {
    sequence.current += 1;
    return id(`command:${label}-${sequence.current}`);
  };
  const gate = world.gates[0];
  const robot = world.robots[0];
  const dinosaur = world.dinosaurs[0];
  const visitors = world.visitors[0];

  const maintenanceStopPolicy = (): ResolvedInstructionArtifact => ({
    ...instructionFixture.containmentPolicy,
    reference: { id: "policy:maintenance-stop", version: "1.0.0" },
    clauses: [{ ...instructionFixture.selfContained.clauses[0]!, id: "clause:maintenance-stop", priority: 300, requiredFacts: ["gate.maintenance"], applicability: { operator: "fact-equals", fact: "gate.maintenance", value: "closer-disabled" }, outcome: { kind: "stop", reasonCode: "CLOSER_DISABLED" } }],
  });

  const runInstructionAction = (): void => {
    const decision = executeInstruction({ artifacts: [instructionFixture.selfContained], facts: { "task.kind": "feed", "gate.position": "closed" }, evidence: [], currentTick: 0 });
    const result = executeInstructionTool(createEngine(), decision);
    setInstructionEvidence(`${describeInstructionOutcome(decision)} Simulation ${result?.commandResult.accepted === true ? "accepted" : "rejected"} the physical command; ${result?.evidence.length ?? 0} source-labeled evidence item(s) returned.`);
  };

  const compareProse = (): void => {
    const input = { facts: { "task.kind": "feed", "gate.position": "closed" }, evidence: [], currentTick: 0 } as const;
    const first = executeInstruction({ artifacts: [instructionFixture.selfContained], ...input });
    const second = executeInstruction({ artifacts: [instructionFixture.proseVariant], ...input });
    const firstEngine = createEngine(); const secondEngine = createEngine();
    executeInstructionTool(firstEngine, first); executeInstructionTool(secondEngine, second);
    setInstructionEvidence(`Prose-only comparison: ${JSON.stringify(first.outcome) === JSON.stringify(second.outcome) && JSON.stringify(firstEngine.snapshot()) === JSON.stringify(secondEngine.snapshot()) ? "identical action and world outcome" : "mismatch"}. Exact source identities remain distinct for provenance.`);
  };

  const inspectConflict = (): void => {
    const blocker = {
      ...instructionFixture.containmentPolicy,
      reference: { id: "policy:gate-closed", version: "1.0.0" },
      clauses: [{ ...instructionFixture.selfContained.clauses[0]!, id: "clause:keep-gate-closed", priority: 100, outcome: { kind: "stop" as const, reasonCode: "GATE_MUST_REMAIN_CLOSED" } }],
    };
    const decision = executeInstruction({ artifacts: [instructionFixture.selfContained, blocker], facts: { "task.kind": "feed", "gate.position": "closed" }, evidence: [], currentTick: 0 });
    setInstructionEvidence(`Conflict inspection: ${describeInstructionOutcome(decision)} ${decision.provenance.filter((entry) => entry.status === "conflicting").length} conflicting clause provenance record(s).`);
  };

  const inspectDegradedEvidence = (): void => {
    const decision = executeInstruction({ artifacts: [instructionFixture.degradedVerification], facts: { "task.stage": "verify" }, evidence: [{ source: "gate-sensor", sourceId: id("gate:alpha"), field: "position", value: "closed", reliability: "degraded", observedAtTick: 0 }], currentTick: 0 });
    setInstructionEvidence(`Degraded evidence: ${describeInstructionOutcome(decision)} The degraded reading was not treated as verified closure.`);
  };

  const inspectMissingMaintenance = (): void => {
    const result = assembleContext(contextFixture.missingMaintenance);
    if (!result.ok) { setContextEvidence("Missing-maintenance fixture was invalid."); return; }
    const decision = executeInstruction({ artifacts: [maintenanceStopPolicy(), instructionFixture.selfContained], facts: contextFacts(result.afterRetention), evidence: [], currentTick: 0 });
    setContextEvidence(`World state: automatic closer disabled. Agent Context: maintenance Policy unavailable-required. Decision: ${describeInstructionOutcome(decision)} The Agent was not told the omitted fact.`);
  };

  const inspectRuntimeGrowth = (): void => {
    const result = assembleContext({ ...contextFixture.strictOverflow, capacity: 40, retentionPolicy: "Strict" });
    if (!result.ok) { setContextEvidence("Runtime-growth fixture was invalid."); return; }
    const additions = result.beforeRetention.entries.filter((entry) => entry.reasonCode === "DECISION_BOUNDARY_ADDITION").length;
    setContextEvidence(`Decision tick ${result.beforeRetention.decisionTick}: ${additions} runtime additions entered Context. Demand ${result.preview.demand}/${result.preview.capacity} units; ${result.preview.state}.`);
  };

  const inspectStrict = (): void => {
    const result = assembleContext(contextFixture.strictOverflow);
    if (!result.ok) { setContextEvidence("Strict fixture was invalid."); return; }
    setContextEvidence(`Strict / Halt and Signal: ${result.status}. Before ${result.beforeRetention.used}/${result.beforeRetention.capacity}; excess ${result.preview.excess}. Fault ${result.fault?.code ?? "missing"}. No over-capacity snapshot reached Instruction.`);
  };

  const inspectKeepNewest = (): void => {
    const result = assembleContext(contextFixture.keepNewest);
    if (!result.ok) { setContextEvidence("Keep Newest fixture was invalid."); return; }
    const decision = executeInstruction({ artifacts: [maintenanceStopPolicy(), instructionFixture.selfContained], facts: contextFacts(result.afterRetention), evidence: [], currentTick: 4 });
    setContextEvidence(`Keep Newest retained ${result.afterRetention.used}/${result.afterRetention.capacity} units and explicitly excluded ${result.retention?.excludedItemIds.join(", ")}. Downstream decision: ${describeInstructionOutcome(decision)}`);
  };

  const runSafeFeed = (): void => {
    const current = reset("Safe feeding scenario started from the exact fixture.");
    const results = current.executeBatch([
      { id: nextCommandId("feed-open"), kind: "operate-gate", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha"), operation: "open", tool: ref("tool:gate-control") },
      { id: nextCommandId("feed-enter"), kind: "move", expectedTick: 0, actorId: id("robot:alpha"), destinationId: id("location:enclosure") },
      { id: nextCommandId("feed-dinosaur"), kind: "feed", expectedTick: 0, actorId: id("robot:alpha"), dinosaurId: id("dinosaur:tria"), itemId: id("item:food"), tool: ref("tool:feed") },
    ]);
    setWorld(current.project());
    setHistory((entries) => [...entries, ...results.map((result, index) => describeCommand(`Safe feed step ${index + 1}`, result))]);
  };

  const runEscape = (): void => {
    reset("Escape scenario started from the exact fixture.");
    const replay = runFoundationReplay(proof.fixture);
    setEngine(createSimulation({ ...proof.fixture, initialState: replay.state }));
    setWorld(replay.state);
    setHistory((entries) => [...entries, "Escape replay reached tick 3: visitor consequence and dinosaur containment are inspectable below."]);
  };

  const runContention = (): void => {
    const current = reset("Shared-gate contention started from the exact fixture.");
    const first = current.execute({ id: nextCommandId("reserve-alpha"), kind: "reserve", expectedTick: 0, actorId: id("robot:alpha"), gateId: id("gate:alpha") });
    const second = current.execute({ id: nextCommandId("reserve-beta"), kind: "reserve", expectedTick: 0, actorId: id("robot:beta"), gateId: id("gate:alpha") });
    setWorld(current.project());
    setHistory((entries) => [...entries, describeCommand("Alpha reservation", first), describeCommand("Beta reservation", second)]);
  };

  const runReplayProof = (): void => {
    const first = runFoundationReplay(proof.fixture);
    const second = runFoundationReplay(proof.fixture);
    const equal = JSON.stringify(first) === JSON.stringify(second);
    const pinned = proof.pinnedFingerprintBefore === proof.pinnedFingerprintAfter;
    setHistory((entries) => [...entries, `Replay equivalence: ${equal ? "exact match" : "mismatch"}. Pinned v1 manifest after v${proof.newerVersion} registration: ${pinned ? "unchanged" : "changed"}.`]);
  };

  return (
    <section className="feature-card" aria-labelledby="foundation-heading">
      <p className="eyebrow">Phase 2 integration fixture</p>
      <h2 id="foundation-heading">Deterministic foundation lab</h2>
      <p>
        This diagnostic surface renders immutable Content Registry and Simulation
        projections. Buttons issue typed commands; React never edits park state.
      </p>

      <section aria-labelledby="registry-heading">
        <h3 id="registry-heading">Exact Content Registry inspection</h3>
        <div className="button-row" role="group" aria-label="Prompt history version">
          {registry.history.map((entry) => (
            <button
              key={entry.version}
              type="button"
              aria-pressed={registryVersion === entry.version}
              onClick={() => setRegistryVersion(entry.version)}
            >
              Inspect v{entry.version} ({entry.availability})
            </button>
          ))}
        </div>
        <dl className="status-grid" aria-label="Selected exact content version">
          <div><dt>Identity</dt><dd><code>{registry.selected.identity}</code></dd></div>
          <div><dt>Version</dt><dd><code>{registry.selected.version}</code></dd></div>
          <div><dt>Class</dt><dd>{registry.selected.contentClass}</dd></div>
          <div><dt>Availability</dt><dd>{registry.selected.availability}</dd></div>
          <div><dt>Context cost</dt><dd>{registry.selected.contextCost} units</dd></div>
          <div><dt>Manifest</dt><dd><code>{registry.manifestFingerprint}</code></dd></div>
        </dl>
        <p><strong>Readable source:</strong> {registry.selected.readableSource}</p>
        <p><strong>Exact dependencies:</strong> {registry.selected.dependencies.join(", ")}</p>
        <details>
          <summary>Invalid optional package diagnostics ({registry.invalidDiagnostics.length})</summary>
          <p>The valid catalog stayed available; the invalid package committed no records.</p>
          <ul>{registry.invalidDiagnostics.map((diagnostic) => <li key={`${diagnostic.code}-${diagnostic.field}`}><code>{diagnostic.code}</code>: {diagnostic.field} — {diagnostic.message}</li>)}</ul>
        </details>
      </section>

      <section aria-labelledby="instruction-heading">
        <h3 id="instruction-heading">Deterministic Instruction artifacts</h3>
        <p>Readable prose is inspectable teaching content. Only the separately labeled machine-readable clause controls behavior.</p>
        <article className="feature-card" aria-label="Self-contained feeding Prompt">
          <h4>Self-contained feeding Prompt</h4>
          <p><strong>Readable source (non-executable):</strong> {instructionFixture.selfContained.readableSource}</p>
          <p><strong>Executable clause:</strong> <code>{instructionFixture.selfContained.clauses[0]?.id}</code> → <code>{instructionFixture.selfContained.clauses[0]?.outcome.kind}</code></p>
          <dl className="status-grid" aria-label="Instruction approach tradeoffs">
            <div><dt>Self-contained Context</dt><dd>{instructionFixture.selfContained.contextCost} units; {instructionFixture.selfContained.knownTradeoffs.join("; ")}</dd></div>
            <div><dt>Modular Context</dt><dd>{instructionFixture.modularPrompt.contextCost + instructionFixture.feedingSkill.contextCost} units; exact dependency <code>{instructionFixture.modularPrompt.dependencies.map((entry) => `${entry.id}@${entry.version}`).join(", ")}</code></dd></div>
          </dl>
        </article>
        <div className="button-row" aria-label="Instruction scenarios">
          <button type="button" onClick={runInstructionAction}>Run Prompt action</button>
          <button type="button" onClick={compareProse}>Compare prose-only variant</button>
          <button type="button" onClick={inspectConflict}>Inspect Policy conflict</button>
          <button type="button" onClick={inspectDegradedEvidence}>Check degraded evidence</button>
        </div>
        <p role="status" aria-live="polite">{instructionEvidence}</p>
      </section>

      <section aria-labelledby="context-heading">
        <h3 id="context-heading">Finite Agent Context</h3>
        {contextBase.ok ? (
          <>
            <p role="status"><strong>Context Capacity:</strong> {contextBase.afterRetention.used}/{contextBase.afterRetention.capacity} units · {contextBase.preview.state}</p>
            <dl className="status-grid" aria-label="Context category segments">
              {contextBase.afterRetention.segments.map((segment) => <div key={segment.category}><dt>{segment.category}</dt><dd>{segment.units} units</dd></div>)}
            </dl>
            <details>
              <summary>Inspect exact Context manifest</summary>
              <ul>{contextBase.afterRetention.entries.map((entry) => <li key={entry.itemId}><code>{entry.itemId}</code>: {entry.lifecycle}; {entry.item?.cost ?? 0} units; source <code>{entry.item?.sourceVersion.id}@{entry.item?.sourceVersion.version}</code></li>)}</ul>
            </details>
          </>
        ) : <p role="alert">The Context foundation fixture is invalid.</p>}
        <div className="button-row" aria-label="Context lifecycle scenarios">
          <button type="button" onClick={inspectMissingMaintenance}>Compare missing maintenance route</button>
          <button type="button" onClick={inspectRuntimeGrowth}>Step runtime Context growth</button>
          <button type="button" onClick={inspectStrict}>Trigger Strict overflow</button>
          <button type="button" onClick={inspectKeepNewest}>Apply Keep Newest</button>
        </div>
        <p role="status" aria-live="polite">{contextEvidence}</p>
        <p>Capacity state is reported separately from missing, stale, duplicate, conflicting, and irrelevant diagnostics; utilization is not a quality score.</p>
      </section>

      <section aria-labelledby="world-heading">
        <h3 id="world-heading">Registry-loaded world projection</h3>
        <p role="status">Logical tick <strong>{world.tick}</strong> · {world.paused ? "Paused" : `${world.speed}x request speed`}</p>
        <dl className="status-grid" aria-label="Authoritative world projection">
          <div><dt>Robot</dt><dd><code>{robot?.id}</code> at {robot?.locationId}; battery {robot?.battery}</dd></div>
          <div><dt>Gate physical state</dt><dd>{gate?.position}; closer {gate?.closer}</dd></div>
          <div><dt>Gate sensor</dt><dd>{gate?.sensorReading}; {gate?.sensorHealth}</dd></div>
          <div><dt>Reservation</dt><dd>{gate?.reservedBy ?? "none"}</dd></div>
          <div><dt>Dinosaur</dt><dd>{dinosaur?.contained ? "contained" : "escaped"}; hunger {dinosaur?.hunger}</dd></div>
          <div><dt>Visitors</dt><dd>{visitors?.safety}; panic {visitors?.panic}</dd></div>
        </dl>
        <div className="button-row" aria-label="Simulation controls">
          <button type="button" onClick={() => { engine.setPaused(!world.paused); refresh(world.paused ? "Simulation resumed." : "Simulation paused."); }}>{world.paused ? "Resume" : "Pause"}</button>
          {[1, 2, 4].map((speed) => <button key={speed} type="button" aria-pressed={world.speed === speed} onClick={() => { engine.setSpeed(speed as 1 | 2 | 4); refresh(`Tick request speed set to ${speed}x.`); }}>{speed}x</button>)}
          <button type="button" onClick={() => { const result = engine.requestTicks(1); refresh(`Tick request resolved at ${result.resultingTick}.`); }}>Advance one tick</button>
          <button type="button" onClick={() => reset()}>Reset fixture</button>
        </div>
        <div className="button-row" aria-label="Deterministic scenarios">
          <button type="button" onClick={runSafeFeed}>Run safe feeding</button>
          <button type="button" onClick={runEscape}>Run escape and visitor consequence</button>
          <button type="button" onClick={runContention}>Run shared-gate contention</button>
          <button type="button" onClick={() => {
            const result = engine.execute({ id: nextCommandId("observe"), kind: "observe-gate", expectedTick: world.tick, actorId: id("robot:alpha"), gateId: id("gate:alpha"), tool: ref("tool:gate-observe") });
            refresh(result.accepted ? `Gate evidence: ${result.evidence.map((entry) => `${entry.source}=${entry.value} (${entry.reliability})`).join("; ")}.` : describeCommand("Observe gate", result));
          }}>Inspect gate evidence</button>
          <button type="button" onClick={() => {
            const before = JSON.stringify(engine.snapshot());
            const result = engine.execute({ id: nextCommandId("stale"), kind: "move", expectedTick: world.tick + 1, actorId: id("robot:alpha"), destinationId: id("location:safe") });
            const unchanged = before === JSON.stringify(engine.snapshot());
            refresh(`${describeCommand("Stale command", result)} World unchanged: ${unchanged ? "yes" : "no"}.`);
          }}>Try rejected stale command</button>
          <button type="button" onClick={runReplayProof}>Verify replay and pinned history</button>
        </div>
      </section>

      <section className="event-history" aria-labelledby="foundation-history-heading">
        <h3 id="foundation-history-heading">Persistent foundation evidence</h3>
        <ol>{history.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol>
      </section>
    </section>
  );
}
