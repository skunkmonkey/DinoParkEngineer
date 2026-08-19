import React, { useMemo, useRef, useState } from "react";

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

export function FoundationLab(): React.JSX.Element {
  const proof = useMemo(createSimulationRegistryProof, []);
  const [registryVersion, setRegistryVersion] = useState("1.0.0");
  const registry = useMemo(() => createRegistryLabProjection(registryVersion), [registryVersion]);
  const [engine, setEngine] = useState<SimulationEngine>(createEngine);
  const [world, setWorld] = useState<WorldState>(() => engine.project());
  const [history, setHistory] = useState<readonly string[]>([
    "Foundation fixture loaded through the Content Registry at exact version 1.0.0.",
  ]);
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
