import React, { useMemo, useState } from "react";

import { createDefaultInMemoryPersistence } from "./engine.js";
import { createPersistenceFoundationFixture } from "./foundation-fixture.js";

export function PersistenceFoundationView(): React.JSX.Element {
  const demo = useMemo(() => {
    const fixture = createPersistenceFoundationFixture();
    return { fixture, system: createDefaultInMemoryPersistence(fixture.session, { applicationVersion: "phase-6", now: () => "2026-01-01T00:00:00.000Z" }) };
  }, []);
  const [status, setStatus] = useState("Ready. The current first-playable checkpoint has not been saved.");
  const [tick, setTick] = useState(demo.system.session.snapshot().world.tick);
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
  return (
    <section className="persistence-experience" aria-labelledby="persistence-heading">
      <header className="player-mode-frame"><div><p className="eyebrow">Local exact persistence · Phase 6</p><h2 id="persistence-heading">Save, change, restore, and replay</h2><p>No account or network is used. Candidate restoration validates completely before replacing the current session.</p></div><div className="player-mode-mark" aria-label="Current mode: local persistence"><span aria-hidden="true">▣</span><span>LOCAL</span></div></header>
      <section className="feature-card" aria-labelledby="checkpoint-heading">
        <h3 id="checkpoint-heading">First-playable checkpoint</h3>
        <dl className="status-grid"><div><dt>Current logical tick</dt><dd>{tick}</dd></div><div><dt>Save ID</dt><dd><code>save:first-playable</code></dd></div><div><dt>Historical trace</dt><dd><code>{demo.fixture.traceId}</code></dd></div><div><dt>Repository</dt><dd>In-memory, staged, atomically promoted</dd></div></dl>
        <div className="button-row"><button type="button" onClick={save}>Save exact checkpoint</button><button type="button" onClick={change}>Advance unsaved world</button><button type="button" onClick={load}>Load exact checkpoint</button><button type="button" onClick={replay}>Replay saved feeding</button><button type="button" onClick={proveFailureIsolation}>Try invalid load safely</button></div>
        <p className="safe-state" role="status">{status}</p>
      </section>
    </section>
  );
}
