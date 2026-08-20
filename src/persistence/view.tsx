import React, { useMemo, useRef, useState } from "react";

import { createAsyncPersistenceCoordinator } from "./async-engine.js";
import { createAutosaveCoordinator } from "./autosave.js";
import { createDefaultInMemoryPersistence, createMemorySessionPort } from "./engine.js";
import { createPersistenceFoundationFixture } from "./foundation-fixture.js";
import { createIndexedDbSaveRepository } from "./indexeddb.js";
import { createLegacyV0Fixture, migrateSave } from "./migration.js";
import { exportPortableSave, inspectPortableSave } from "./portable-package.js";
import type { AsyncSaveRepository, MemorySessionPort, MvpCompositeState } from "./types.js";

export function PersistenceFoundationView(): React.JSX.Element {
  const demo = useMemo(() => {
    const fixture = createPersistenceFoundationFixture();
    return { fixture, system: createDefaultInMemoryPersistence(fixture.session, { applicationVersion: "phase-6", now: () => "2026-01-01T00:00:00.000Z" }) };
  }, []);
  const [status, setStatus] = useState("Ready. The current first-playable checkpoint has not been saved.");
  const [tick, setTick] = useState(demo.system.session.snapshot().world.tick);
  const [mvpStatus, setMvpStatus] = useState("IndexedDB has not been opened. No browser save was written.");
  const [saveList, setSaveList] = useState<readonly string[]>([]);
  const repositoryRef = useRef<AsyncSaveRepository | undefined>(undefined);
  const sessionRef = useRef<MemorySessionPort | undefined>(undefined);
  const exportedRef = useRef<string | undefined>(undefined);
  const mvp: MvpCompositeState = useMemo(() => ({
    schemaVersion: "1", memory: { entries: [{ id: "memory:gate-maintenance", version: "1.0.0" }] },
    evals: { cases: ["eval:opening-maintenance-context@1.0.0"], results: ["result:opening-failed"] },
    workbench: { candidates: ["candidate:opening-context-fix"] }, reviews: { records: ["review:opening-context-fix"] },
    deployments: { active: "deployment:opening-context-fix", history: [{ kind: "deploy", version: "2.0.0" }, { kind: "revert", version: "1.0.0" }] },
    economy: { credits: 820, rating: 92 }, incidents: { records: ["incident:strict-stop"] }, response: { records: ["response:strict-stop"] },
    progression: { capabilities: ["Context optimization"] }, rewards: { inventory: ["reward:dinosaur-plushie"] },
    curriculum: { opening: "complete", transfer: "available" }, consent: { researchTelemetry: false },
  }), []);
  const browserSession = (): MemorySessionPort => {
    sessionRef.current ??= createMemorySessionPort({ ...demo.fixture.session, mvp });
    return sessionRef.current;
  };
  const browserRepository = async (): Promise<AsyncSaveRepository> => {
    repositoryRef.current ??= await createIndexedDbSaveRepository({ databaseName: "dino-park-engineer-phase7" });
    return repositoryRef.current;
  };
  const save = (): void => {
    const result = demo.system.coordinator.save({ id: "save:first-playable", contentManifest: demo.fixture.contentManifest });
    setStatus(result.ok ? `Saved exact world, jobs, versions, Context, trace, and preferences at tick ${result.envelope.park.tick}.` : result.diagnostics.map((entry) => entry.message).join(" "));
  };
  const change = (): void => {
    const current = demo.system.session.snapshot();
    const changed = { ...current, world: { ...current.world, tick: current.world.tick + 1 } };
    demo.system.session.replace(changed);
    setTick(changed.world.tick);
    setStatus(`Current unsaved world advanced to tick ${changed.world.tick}. The known-good save is unchanged.`);
  };
  const load = (): void => {
    const result = demo.system.coordinator.load("save:first-playable");
    if (!result.ok) { setStatus(result.diagnostics.map((entry) => entry.message).join(" ")); return; }
    setTick(result.session.world.tick);
    setStatus(`Loaded exact save ${result.envelope.id}; the complete candidate validated before session replacement.`);
  };
  const replay = (): void => {
    const result = demo.system.coordinator.replay("save:first-playable", demo.fixture.traceId);
    setStatus(result.ok ? `Historical replay ${result.traceId} is equivalent after reload.` : result.diagnostics.map((entry) => entry.message).join(" "));
  };
  const proveFailureIsolation = (): void => {
    const before = demo.system.session.snapshot();
    const result = demo.system.coordinator.load("save:missing");
    const unchanged = demo.system.session.snapshot().world.tick === before.world.tick;
    setStatus(!result.ok && unchanged ? "Invalid load blocked. The current session and known-good save remain unchanged." : "Failure-isolation proof did not produce the expected safe result.");
  };
  const saveMvp = async (): Promise<void> => {
    try {
      const repository = await browserRepository();
      const coordinator = createAsyncPersistenceCoordinator({ repository, session: browserSession(), applicationVersion: "phase-7", now: () => "2026-08-19T00:00:00.000Z" });
      const result = await coordinator.save({ id: "save:mvp-complete", contentManifest: demo.fixture.contentManifest });
      setMvpStatus(result.ok ? `IndexedDB staged, validated, and transactionally promoted ${result.envelope.id} at tick ${result.envelope.park.tick}. Every MVP composite section is present.` : result.diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join(" "));
    } catch (error) { setMvpStatus(error instanceof Error ? error.message : "IndexedDB setup failed safely."); }
  };
  const autosaveMvp = async (): Promise<void> => {
    const repository = await browserRepository(); const session = browserSession();
    const autosave = createAutosaveCoordinator({ repository, session, applicationVersion: "phase-7", now: () => "2026-08-19T00:00:01.000Z" });
    const result = await autosave.request({ safe: true, tick: session.snapshot().world.tick, request: { id: "save:mvp-autosave", contentManifest: demo.fixture.contentManifest } });
    setMvpStatus(result.ok ? `Autosave coalesced at declared safe checkpoint tick ${result.envelope.park.tick}; known-good promotion completed.` : result.diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join(" "));
  };
  const listMvp = async (): Promise<void> => {
    const entries = await (await browserRepository()).list(); setSaveList(entries.map((entry) => `${entry.id} · tick ${entry.tick} · ${entry.integrityFingerprint}`));
    setMvpStatus(`Listed ${entries.length} validated local save record(s) in stable ID order.`);
  };
  const exportMvp = async (): Promise<void> => {
    const result = await (await browserRepository()).read("save:mvp-complete");
    if (!result.ok) { setMvpStatus(result.diagnostics.map((entry) => entry.message).join(" ")); return; }
    exportedRef.current = exportPortableSave(result.envelope);
    setMvpStatus(`Portable export prepared locally for ${result.envelope.id}; ${exportedRef.current.length} canonical characters, no network transmission.`);
  };
  const quarantineTamper = (): void => {
    if (exportedRef.current === undefined) { setMvpStatus("Export the known-good save before testing import quarantine."); return; }
    const tampered = exportedRef.current.replace("SAVE_COMPLETE", "SAVE_TRUNCATED");
    const result = inspectPortableSave(tampered, saveList.map((entry) => entry.split(" · ")[0] ?? ""));
    setMvpStatus(!result.ok ? `${result.diagnostics[0]?.code}: Tampered import stayed quarantined; the current session and known-good save were unchanged.` : "Unexpectedly accepted tampered import.");
  };
  const migrateLegacy = async (): Promise<void> => {
    const read = await (await browserRepository()).read("save:mvp-complete");
    if (!read.ok) { setMvpStatus(read.diagnostics.map((entry) => entry.message).join(" ")); return; }
    const legacy = JSON.stringify(createLegacyV0Fixture(read.envelope)); const migrated = migrateSave(legacy);
    setMvpStatus(migrated.ok ? `Migration ${migrated.audit?.stepId} validated deterministically; original ${migrated.originalBackup?.length ?? 0}-character backup preserved before promotion.` : migrated.diagnostics.map((entry) => entry.message).join(" "));
  };
  const refuseDelete = async (): Promise<void> => {
    const result = await (await browserRepository()).remove("save:mvp-complete", false);
    setMvpStatus(!result.ok ? `${result.diagnostics[0]?.code}: Save deletion refused without explicit confirmation.` : "Unexpected deletion result.");
  };
  return (
    <section className="persistence-experience" aria-labelledby="persistence-heading">
      <header className="player-mode-frame"><div><p className="eyebrow">Save room · Production paused</p><h2 id="persistence-heading">Save &amp; restore</h2><p>Local saves only. Restoring validates the full park before anything changes.</p></div><div className="player-mode-mark" aria-label="Current mode: local persistence"><span aria-hidden="true">▣</span><span>LOCAL</span></div></header>
      <section className="feature-card" aria-labelledby="checkpoint-heading">
        <h3 id="checkpoint-heading">First-playable checkpoint</h3>
        <dl className="status-grid"><div><dt>Current logical tick</dt><dd>{tick}</dd></div><div><dt>Save ID</dt><dd><code>save:first-playable</code></dd></div><div><dt>Historical trace</dt><dd><code>{demo.fixture.traceId}</code></dd></div><div><dt>Repository</dt><dd>In-memory, staged, atomically promoted</dd></div></dl>
        <div className="button-row"><button type="button" onClick={save}>Save exact checkpoint</button><button type="button" onClick={change}>Advance unsaved world</button><button type="button" onClick={load}>Load exact checkpoint</button><button type="button" onClick={replay}>Replay saved feeding</button><button type="button" onClick={proveFailureIsolation}>Try invalid load safely</button></div>
        <p className="safe-state" role="status">{status}</p>
      </section>
      <details className="feature-card"><summary>Advanced save tools</summary><section aria-labelledby="mvp-persistence-heading">
        <h3 id="mvp-persistence-heading">Browser persistence &amp; recovery</h3>
        <p>Local IndexedDB uses staged validation and transactional known-good promotion. The composite includes Memory, Evals, Workbench, Reviews, Deployments and revert history, Economy, incidents, response, progression, rewards, curriculum, preferences, and consent.</p>
        <div className="button-row" role="group" aria-label="MVP persistence controls">
          <button type="button" onClick={() => { void saveMvp(); }}>Save complete MVP to IndexedDB</button>
          <button type="button" onClick={() => { void autosaveMvp(); }}>Autosave safe checkpoint</button>
          <button type="button" onClick={() => { void listMvp(); }}>List local saves</button>
          <button type="button" onClick={() => { void exportMvp(); }}>Prepare portable export</button>
          <button type="button" onClick={quarantineTamper}>Test tampered import quarantine</button>
          <button type="button" onClick={() => { void migrateLegacy(); }}>Migrate legacy save with backup</button>
          <button type="button" onClick={() => { void refuseDelete(); }}>Try delete without confirmation</button>
        </div>
        <p className="safe-state" role="status" aria-live="polite">{mvpStatus}</p>
        <ul aria-label="Validated local save metadata">{saveList.length === 0 ? <li>No save metadata listed yet.</li> : saveList.map((entry) => <li key={entry}><code>{entry}</code></li>)}</ul>
        <p>Quota, transaction abort, corrupt/truncated records, stale staging, missing migration steps, and last-known-good diagnostic export are typed recovery paths covered by deterministic fault tests.</p>
      </section></details>
    </section>
  );
}
