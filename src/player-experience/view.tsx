import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PARK_OPERATIONS_FOUNDATION_IDS } from "../park-operations/public.js";
import { PixiParkSceneAdapter, type SceneRendererStatus } from "./pixi-scene.js";
import {
  createPlayerExperience,
  DEFAULT_PLAYER_PREFERENCES,
} from "./runtime.js";
import { createPlayerAudioAdapter } from "./audio.js";
import type {
  PlayerExperienceCommand,
  PlayerEntityKind,
  PlayerEntityProjection,
  PlayerExperienceMode,
  PlayerExperienceService,
  PlayerExperienceSnapshot,
  PlayerPreferences,
} from "./types.js";

export interface PlayerExperienceProps {
  readonly mode?: PlayerExperienceMode;
  readonly runtime?: PlayerExperienceService;
}

const modeText = (mode: PlayerExperienceMode): string => {
  switch (mode) {
    case "production":
      return "Production · Dawn · Park closed";
    case "paused-production":
      return "Paused Production · Dawn · Park closed";
    case "workbench":
      return "Workbench · Production paused";
    case "eval":
      return "Eval · Isolated run · Production paused";
    case "replay":
      return "Historical Replay · Frozen evidence";
    case "review":
      return "Review / Deployment · Production paused";
  }
};

const kindLabel = (kind: PlayerEntityKind): string => {
  switch (kind) {
    case "dinosaur":
      return "Dinosaurs";
    case "robot":
      return "Workers";
    case "gate":
      return "Gates";
    case "visitor":
      return "Visitors";
    case "hazard":
      return "Hazards";
    case "job":
      return "Jobs";
    case "alert":
      return "Alerts";
    case "incident":
      return "Incidents";
  }
};

const statusClass = (status: SceneRendererStatus | undefined): string => {
  if (status === undefined) return "scene-status scene-status-loading";
  return status.state === "ready" ? "scene-status scene-status-ready" : "scene-status scene-status-fallback";
};

const selectedEntity = (snapshot: PlayerExperienceSnapshot) =>
  snapshot.scene.entities.find((entity) => entity.id === snapshot.selectedEntityId) ?? snapshot.scene.entities[0];

export function PlayerExperience({ mode = "production", runtime }: PlayerExperienceProps): React.JSX.Element {
  const service = useMemo(() => {
    if (runtime !== undefined) return runtime;
    const created = createPlayerExperience({ mode });
    if (mode === "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("incident")) {
      created.dispatch({ kind: "trigger-near-miss" });
    }
    return created;
  }, [mode, runtime]);
  const [snapshot, setSnapshot] = useState<PlayerExperienceSnapshot>(() => service.project());
  const [preferences, setPreferences] = useState<PlayerPreferences>(DEFAULT_PLAYER_PREFERENCES);
  const [rendererStatus, setRendererStatus] = useState<SceneRendererStatus>();
  const audio = useMemo(createPlayerAudioAdapter, []);
  const [audioState, setAudioState] = useState(audio.getSnapshot());
  const audioMountCount = useRef(0);
  const sceneHost = useRef<HTMLDivElement>(null);
  const sceneAdapter = useRef<PixiParkSceneAdapter | undefined>(undefined);

  useEffect(() => service.subscribe(() => setSnapshot(service.project())), [service]);

  useEffect(() => {
    const host = sceneHost.current;
    if (host === null) return undefined;
    const adapter = new PixiParkSceneAdapter();
    sceneAdapter.current = adapter;
    let active = true;
    // The app can be hosted below a Vite base path; keep approved art
    // resolution relative to the deployed application rather than `/`.
    void adapter.mount(host, {
      reducedMotion: preferences.reducedMotion,
      highContrast: preferences.highContrast,
      assetBasePath: import.meta.env.BASE_URL,
      onStatusChange: (status) => {
        if (active) setRendererStatus(status);
      },
    }).then((status) => {
      if (active) setRendererStatus(status);
    });
    return () => {
      active = false;
      adapter.dispose();
      sceneAdapter.current = undefined;
    };
  }, [preferences.highContrast, preferences.reducedMotion]);

  useEffect(() => {
    sceneAdapter.current?.render(snapshot.scene, snapshot.scene.renderFrame * 160);
  }, [snapshot.scene]);

  useEffect(() => {
    sceneAdapter.current?.setOptions({ reducedMotion: preferences.reducedMotion, highContrast: preferences.highContrast, assetBasePath: import.meta.env.BASE_URL });
    document.documentElement.dataset.playerContrast = preferences.highContrast ? "high" : "standard";
    document.documentElement.dataset.playerMotion = preferences.reducedMotion ? "reduced" : "standard";
    document.documentElement.style.setProperty("--dpe-player-font-scale", String(preferences.textScale));
  }, [preferences]);

  useEffect(() => {
    audioMountCount.current += 1;
    return () => {
      audioMountCount.current -= 1;
      // React Strict Mode rehearses effect teardown/setup in development. Wait
      // until that synchronous rehearsal finishes before disposing the adapter.
      queueMicrotask(() => {
        if (audioMountCount.current === 0) audio.dispose();
      });
    };
  }, [audio]);

  const selected = selectedEntity(snapshot);
  const groups = useMemo(() => {
    const grouped = new Map<PlayerEntityKind, PlayerEntityProjection[]>();
    for (const entity of snapshot.scene.entities) {
      const entries = grouped.get(entity.kind) ?? [];
      entries.push(entity);
      grouped.set(entity.kind, entries);
    }
    return [...grouped.entries()];
  }, [snapshot.scene.entities]);

  const dispatch = (command: PlayerExperienceCommand) => {
    // Unlock is attempted from the originating user gesture. Rejection is
    // harmless because every cue has a persistent text/history equivalent.
    const result = service.dispatch(command);
    void audio.unlock().then(() => {
      if (result.accepted) {
        const severity = command.kind === "trigger-near-miss"
          ? "emergency"
          : command.kind === "feed-through-inspector" || command.kind === "resolve-incident"
            ? "success"
            : command.kind === "acknowledge-alert" || command.kind === "stabilize-incident"
              ? "warning"
              : "info";
        audio.requestCue({ id: command.kind, text: result.snapshot.status, severity });
      }
      setAudioState(audio.getSnapshot());
    });
    return result;
  };
  const setPreference = <K extends keyof PlayerPreferences>(key: K, value: PlayerPreferences[K]): void => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    dispatch({ kind: "set-preferences", preferences: { [key]: value } });
  };

  const selectNext = (entityId: string, direction: 1 | -1): void => {
    const entities = snapshot.scene.entities;
    const index = entities.findIndex((entity) => entity.id === entityId);
    if (index < 0 || entities.length === 0) return;
    const next = entities[(index + direction + entities.length) % entities.length];
    if (next !== undefined) dispatch({ kind: "select-entity", entityId: next.id });
  };

  const actionForSelected = (): React.JSX.Element | null => {
    if (selected === undefined) return null;
    if (selected.kind === "alert") {
      const alert = snapshot.operations.alerts.find((entry) => entry.id === selected.id);
      if (alert === undefined) return null;
      return alert.status === "acknowledged" ? <p className="inspector-success">Alert acknowledged; incident evidence remains persistent.</p> : <button type="button" onClick={() => dispatch({ kind: "acknowledge-alert", alertId: alert.id })}>Acknowledge alert</button>;
    }
    if (selected.kind === "incident") {
      const incident = snapshot.operations.incidents.find((entry) => entry.id === selected.id);
      if (incident === undefined) return null;
      if (incident.status === "detected") return <button type="button" onClick={() => dispatch({ kind: "stabilize-incident", incidentId: incident.id })}>Stabilize near miss</button>;
      if (incident.status === "active" || incident.status === "stabilized" || incident.status === "engineering-unresolved") return <button type="button" onClick={() => dispatch({ kind: "resolve-incident", incidentId: incident.id })}>Resolve incident after verification</button>;
      return <p className="inspector-success">Incident recovery is retained in history.</p>;
    }
    const job = selected.kind === "job"
      ? snapshot.operations.jobs.find((entry) => entry.id === selected.id)
      : snapshot.operations.jobs.find((entry) => entry.targetId === selected.id);
    if ((selected.kind !== "dinosaur" && selected.kind !== "job") || job === undefined) return null;
    if (job.targetId === "dinosaur:vera") {
      return snapshot.operations.incidents.length > 0
        ? <p className="inspector-success">Second feeding near miss is retained as grouped evidence.</p>
        : <button type="button" onClick={() => dispatch({ kind: "trigger-near-miss" })}>Reuse first instruction for Vera</button>;
    }
    if (job.status === "queued") {
      return (
        <>
          <button type="button" onClick={() => dispatch({ kind: "assign-feeding-job", agentId: PARK_OPERATIONS_FOUNDATION_IDS.robot })}>
            Assign Robot Alpha
          </button>
          <button type="button" onClick={() => dispatch({ kind: "assign-feeding-job", agentId: "robot:unavailable" })}>
            Try unavailable Agent
          </button>
          <button type="button" disabled title="Assign Robot Alpha before running the procedure">
            Feed Tria through Inspector
          </button>
        </>
      );
    }
    if (job.status === "assigned" || job.status === "running") {
      return (
        <button type="button" onClick={() => dispatch({ kind: "feed-through-inspector" })}>
          Feed Tria through Inspector
        </button>
      );
    }
    return <p className="inspector-success"><span aria-hidden="true">✓</span> Feeding complete; exact job evidence is retained.</p>;
  };

  const selectedJob = selected === undefined
    ? undefined
    : selected.kind === "job"
      ? snapshot.operations.jobs.find((entry) => entry.id === selected.id)
      : snapshot.operations.jobs.find((entry) => entry.targetId === selected.id);
  const selectedIncident = selected?.kind === "incident" ? snapshot.operations.incidents.find((entry) => entry.id === selected.id) : undefined;
  const causalJobId = selectedIncident?.entityIds.find((entry) => entry.startsWith("job:")) ?? "job:schedule-second-feed-day-1-tick-0";

  return (
    <section className={`player-experience player-mode-${mode}`} data-mode={mode} aria-labelledby="player-experience-heading">
      <header className="player-mode-frame">
        <div>
          <p className="eyebrow">Dino Park Engineer · First playable</p>
          <p className="eyebrow">Pre-opening operations · Park closed · Dawn</p>
          <h2 id="player-experience-heading">Park View · Dawn</h2>
          <p className="mode-announcement"><strong>{modeText(mode)}</strong>. Mode identity is text and shape framed, not color-only.</p>
        </div>
        <div className="player-mode-mark" aria-label={`Current mode: ${modeText(mode)}`}>
          <span aria-hidden="true">{mode === "production" ? "◉" : mode === "replay" ? "◇" : "⬡"}</span>
          <span>{mode === "production" ? "LIVE PARK" : mode.toUpperCase()}</span>
        </div>
      </header>

      <section className="operational-anchor" aria-labelledby="operational-anchor-heading">
        <h3 id="operational-anchor-heading">Operational anchor</h3>
        <dl className="status-grid" aria-label="Park operations status">
          <div><dt>Production state / time</dt><dd>{snapshot.operations.phase} · Day {snapshot.operations.day} · Tick {snapshot.operations.tick}</dd></div>
          <div><dt>Rating</dt><dd>Unrated · opening day</dd></div>
          <div><dt>Credits</dt><dd>1,000 credits</dd></div>
          <div><dt>Emergencies</dt><dd>{snapshot.operations.alerts.filter((alert) => alert.severity === "emergency").length}</dd></div>
          <div><dt>Selected asset bundle</dt><dd><code>{snapshot.scene.assetBundle.id}@{snapshot.scene.assetBundle.version}</code></dd></div>
          <div><dt>Causal breadcrumb</dt><dd>Park → {selected?.label ?? "No entity"} → Inspector</dd></div>
        </dl>
      </section>

      <div className="player-layout">
        <section className="park-view-card" aria-labelledby="park-view-heading">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Production projection · three-quarter orientation</p>
              <h3 id="park-view-heading">Dawn park scene</h3>
            </div>
            <p className={statusClass(rendererStatus)} role="status">
              {rendererStatus === undefined ? "PixiJS 8 · WebGL preferred · starting" : rendererStatus.state === "ready" ? `PixiJS 8 · ${rendererStatus.renderer} renderer` : "Semantic renderer fallback active"}
            </p>
          </div>
          <div
            className="park-scene-shell"
            data-renderer-preference="webgl"
            data-orientation={snapshot.scene.orientation}
            data-lighting={snapshot.scene.lighting}
            data-semantic-zoom={snapshot.scene.semanticZoom}
          >
            <div className="park-scene-host" ref={sceneHost} aria-hidden="true" />
            <div className="park-scene-fallback" role="img" aria-label="Dawn three-quarter park projection. Use the semantic entity navigator for exact state and actions.">
              <span>DAWN · THREE-QUARTER PARK</span>
              <span>Canvas is illustrative; exact state is available below.</span>
            </div>
            <div className="scene-entity-hit-targets" aria-label="Park entity pointer selection">
              {snapshot.scene.entities.filter((entity) => entity.occlusion !== "aggregate").map((entity) => (
                <button
                  className={`scene-entity-hit-target ${entity.selected ? "is-selected" : ""}`}
                  key={entity.id}
                  type="button"
                  style={{ left: `${entity.position.x}%`, top: `${entity.position.y}%` }}
                  aria-label={`Select ${entity.accessibilityLabel}`}
                  aria-pressed={entity.selected}
                  data-entity-id={entity.id}
                  data-asset-id={entity.assetId}
                  onClick={() => dispatch({ kind: "select-entity", entityId: entity.id })}
                >
                  <span aria-hidden="true">{entity.cue?.symbol ?? "·"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="camera-controls" aria-label="Park camera controls">
            <button type="button" aria-label="Pan camera left" onClick={() => dispatch({ kind: "pan-camera", delta: { x: -8, y: 0 } })}>← Pan</button>
            <button type="button" aria-label="Pan camera right" onClick={() => dispatch({ kind: "pan-camera", delta: { x: 8, y: 0 } })}>Pan →</button>
            <button type="button" aria-label="Pan camera up" onClick={() => dispatch({ kind: "pan-camera", delta: { x: 0, y: -8 } })}>↑</button>
            <button type="button" aria-label="Pan camera down" onClick={() => dispatch({ kind: "pan-camera", delta: { x: 0, y: 8 } })}>↓</button>
            <button type="button" aria-label="Zoom out" onClick={() => dispatch({ kind: "zoom-camera", delta: -0.15 })}>− Zoom</button>
            <button type="button" aria-label="Zoom in" onClick={() => dispatch({ kind: "zoom-camera", delta: 0.15 })}>+ Zoom</button>
            <button type="button" onClick={() => selected === undefined ? undefined : dispatch({ kind: "focus-entity", entityId: selected.id })}>Focus selected</button>
            <span className="camera-readout">Camera {Math.round(snapshot.scene.camera.center.x)},{Math.round(snapshot.scene.camera.center.y)} · {snapshot.scene.semanticZoom} zoom · bounded</span>
          </div>
          <section className="visual-grammar" aria-labelledby="visual-grammar-heading">
            <h4 id="visual-grammar-heading">Visual grammar</h4>
            <ul>
              <li><span aria-hidden="true">◇</span> Need · immediate action</li>
              <li><span aria-hidden="true">→</span> Intent · current Agent route</li>
              <li><span aria-hidden="true">!</span> Warning · inspect evidence</li>
              <li><span aria-hidden="true">✓</span> Outcome · persistent result</li>
              <li><span aria-hidden="true">//</span> Degraded · maintenance state</li>
            </ul>
          </section>
        </section>

        <aside className="player-sidebar">
          <section className="inspector-card" aria-labelledby="inspector-heading">
            <p className="eyebrow">Contextual Inspector</p>
            <h3 id="inspector-heading">{selected === undefined ? "Select a park entity" : `${selected.label} Inspector`}</h3>
            {selected === undefined ? <p>Select an entity from the scene or semantic navigator.</p> : (
              <>
                <p className="inspector-status"><span aria-hidden="true">{selected.cue?.symbol ?? "·"}</span> {selected.status}</p>
                <dl className="inspector-details">
                  <div><dt>Stable identity</dt><dd><code>{selected.id}</code></dd></div>
                  <div><dt>Immediate intent</dt><dd>{selected.intent}</dd></div>
                  <div><dt>Route</dt><dd>{selected.route.join(" → ")}</dd></div>
                  <div><dt>Location</dt><dd>{selected.locationId}</dd></div>
                  <div><dt>Source / tick</dt><dd>{selected.source} projection · {selected.sourceTick}</dd></div>
                </dl>
                {selectedJob === undefined ? null : (
                  <section className="inspector-section" aria-labelledby="job-heading">
                    <h4 id="job-heading">Jobs</h4>
                    <p><strong>{selectedJob.targetId === "dinosaur:vera" ? "Feed Vera" : "Feed Tria"}</strong> · {selectedJob.status} · Required before opening</p>
                    <p>Job <code>{selectedJob.id}</code> · target <code>{selectedJob.targetId}</code></p>
                    <details>
                      <summary>Inspect pinned production versions</summary>
                      <ul>
                        {selectedJob.exactDeployedVersions.map((pin) => <li key={`${pin.reference.id}@${pin.reference.version}`}><code>{pin.reference.id}@{pin.reference.version}</code> · pinned manifest <code>{pin.manifestFingerprint}</code></li>)}
                      </ul>
                    </details>
                    {selectedJob.status === "completed" ? (
                      <details open>
                        <summary>Inspect exact Context, clauses, tools, and world delta</summary>
                        <dl className="inspector-details">
                          <div><dt>Context manifest</dt><dd><code>task:feed-triceratops@1.0.0</code>, <code>park:safe-feeding@1.0.0</code>, and <code>park:containment-policy@1.0.0</code> were included at tick 0.</dd></div>
                          <div><dt>Applied clauses</dt><dd>Open Gate Alpha, enter Enclosure Alpha, restore containment before feeding completes.</dd></div>
                          <div><dt>Tool evidence</dt><dd><code>tool:gate-control@1.0.0</code> and <code>tool:feed@1.0.0</code>; result <code>{selectedJob.resultLinks[0] ?? "event:dinosaur-fed"}</code>.</dd></div>
                          <div><dt>World delta</dt><dd>Tria hunger {snapshot.feedingEvidence?.dinosaurHunger.before ?? 80} → {snapshot.feedingEvidence?.dinosaurHunger.after ?? 40}; Gate Alpha {snapshot.feedingEvidence?.gatePosition.before ?? "closed"} → {snapshot.feedingEvidence?.gatePosition.after ?? "closed"} after the atomic route; Robot Alpha returned to Keeper path.</dd></div>
                        </dl>
                      </details>
                    ) : null}
                    <div className="button-row">{actionForSelected()}</div>
                  </section>
                )}
                {selected.kind === "alert" ? (() => {
                  const alert = snapshot.operations.alerts.find((entry) => entry.id === selected.id);
                  return alert === undefined ? null : <section className="inspector-section" aria-labelledby="alert-heading"><h4 id="alert-heading">Alert evidence</h4><p><strong>Immediate risk:</strong> {alert.immediateRisk}</p><p><strong>Severity:</strong> {alert.severity}; <strong>Pause requested:</strong> {alert.pauseRequested ? "yes" : "no"}</p><p>Entities: {alert.entityIds.map((entityId) => <code key={entityId}>{entityId} </code>)}</p><div className="button-row">{actionForSelected()}</div></section>;
                })() : null}
                {selected.kind === "incident" && selected.evidence !== undefined ? (
                  <section className="inspector-section" aria-labelledby="incident-evidence-heading">
                    <h4 id="incident-evidence-heading">Near-miss evidence</h4>
                    <dl className="inspector-details">
                      <div><dt>Expected</dt><dd>{selected.evidence.expected}</dd></div>
                      <div><dt>Observed</dt><dd>{selected.evidence.observed.join("; ")}</dd></div>
                      <div><dt>Consequence</dt><dd>{selected.evidence.consequence.join("; ")}</dd></div>
                      <div><dt>Immediate gap</dt><dd>{selected.evidence.immediateGap.join("; ")}</dd></div>
                      <div><dt>Trace links</dt><dd>{selected.evidence.traceIds.map((traceId) => <code key={traceId}>{traceId} </code>)}</dd></div>
                    </dl>
                    <nav aria-label="Causal investigation path">
                      <ol>
                        <li>Park event <code>{selected.id}</code></li>
                        <li>Job <code>{causalJobId}</code></li>
                        <li>Agent action <code>command:opening-reuse-open-gate</code></li>
                        <li>Context boundary <code>context:maintenance-policy</code> unavailable</li>
                        <li>Evidence <code>{selected.evidence.traceIds[0] ?? "trace:opening-feed-beta"}</code></li>
                        <li>Responsible artifact <code>prompt:self-contained-feeding@1.0.0</code></li>
                      </ol>
                      <a className="button-link" href={`/workbench?incident=${encodeURIComponent(selected.id)}&job=${encodeURIComponent(causalJobId)}&action=command%3Aopening-reuse-open-gate&trace=${encodeURIComponent(selected.evidence.traceIds[0] ?? "trace:opening-feed-beta")}&artifact=prompt%3Aself-contained-feeding%401.0.0`}>Open responsible artifact in Workbench</a>
                    </nav>
                    <div className="button-row">{actionForSelected()}</div>
                  </section>
                ) : null}
                <section className="inspector-section" aria-labelledby="incidents-heading">
                  <h4 id="incidents-heading">Incidents</h4>
                  {snapshot.operations.incidents.length === 0 ? <p>No incident; production monitoring is clear. Expected, observed, consequence, immediate gap, and Trace fields remain available if a recoverable near miss is staged.</p> : <ul>{snapshot.operations.incidents.map((incident) => <li key={incident.id}>{incident.status} · <code>{incident.id}</code></li>)}</ul>}
                </section>
                <section className="inspector-section" aria-labelledby="evidence-heading">
                  <h4 id="evidence-heading">Evidence and provenance</h4>
                  <p>Simulation state is authoritative. Rendering asset <code>{selected.assetId}@{selected.assetVersion}</code> is illustrative and never drives state.</p>
                </section>
              </>
            )}
          </section>

          <section className="navigator-card" aria-labelledby="navigator-heading">
            <p className="eyebrow">Semantic navigation</p>
            <h3 id="navigator-heading">Entity navigator</h3>
            <p id="navigator-help">Use arrow keys to move, Enter or Space to select. The same stable IDs drive pointer and keyboard selection.</p>
            <div className="entity-navigator" role="listbox" aria-label="Park entities" aria-describedby="navigator-help">
              {groups.map(([kind, entities]) => (
                <div className="navigator-group" role="group" aria-label={kindLabel(kind)} key={kind}>
                  <h4>{kindLabel(kind)}</h4>
                  {entities.map((entity) => (
                    <button
                      className={`navigator-option ${entity.selected ? "is-selected" : ""}`}
                      key={entity.id}
                      type="button"
                      role="option"
                      aria-selected={entity.selected}
                      data-entity-id={entity.id}
                      onClick={() => dispatch({ kind: "select-entity", entityId: entity.id })}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                          event.preventDefault();
                          selectNext(entity.id, 1);
                        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                          event.preventDefault();
                          selectNext(entity.id, -1);
                        } else if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          dispatch({ kind: "select-entity", entityId: entity.id });
                        }
                      }}
                    >
                      <span aria-hidden="true">{entity.cue?.symbol ?? "·"}</span>
                      <span><strong>{entity.label}</strong><small>{entity.status}</small></span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="time-controls" aria-labelledby="time-controls-heading">
        <div>
          <p className="eyebrow">Logical time · deterministic</p>
          <h3 id="time-controls-heading">Park time</h3>
          <p>Animation and camera motion never advance authoritative state. Logical ticks advance only through this control.</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => dispatch({ kind: "set-time-control", paused: !snapshot.operations.paused, speed: snapshot.operations.speed })}>
            {snapshot.operations.paused ? "Resume time" : "Pause time"}
          </button>
          {[1, 2, 4].map((speed) => (
            <button key={speed} type="button" aria-pressed={snapshot.operations.speed === speed} onClick={() => dispatch({ kind: "set-time-control", paused: snapshot.operations.paused, speed: speed as 1 | 2 | 4 })}>{speed}× speed</button>
          ))}
          <button type="button" disabled={snapshot.operations.paused} onClick={() => dispatch({ kind: "step-logical-tick" })}>Advance one logical tick</button>
          <button type="button" onClick={() => dispatch({ kind: "trigger-near-miss" })} disabled={snapshot.operations.incidents.length > 0}>Stage recoverable near miss</button>
        </div>
        <p className="time-readout" role="status">Day {snapshot.operations.day} · logical tick {snapshot.operations.tick} · {snapshot.operations.paused ? "paused" : "running"} · opening deadline tick 300</p>
      </section>

      <section className="accessibility-panel" aria-labelledby="player-preferences-heading">
        <h3 id="player-preferences-heading">Accessibility and cue preferences</h3>
        <div className="control-grid">
          <label><input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => setPreference("reducedMotion", event.currentTarget.checked)} /> Reduced motion</label>
          <label><input type="checkbox" checked={preferences.highContrast} onChange={(event) => setPreference("highContrast", event.currentTarget.checked)} /> High contrast</label>
          <label>Text scale <select value={preferences.textScale} onChange={(event) => setPreference("textScale", Number(event.currentTarget.value) as PlayerPreferences["textScale"])}><option value={1}>100%</option><option value={1.25}>125%</option><option value={1.5}>150%</option></select></label>
          <label><input type="checkbox" checked={preferences.soundSubstitution} onChange={(event) => setPreference("soundSubstitution", event.currentTarget.checked)} /> Sound substitution</label>
          <label><input type="checkbox" checked={audioState.muted} onChange={(event) => { audio.setMuted(event.currentTarget.checked); setAudioState(audio.getSnapshot()); }} /> Mute optional audio</label>
          <label>Audio volume <input type="range" min="0" max="1" step="0.05" value={audioState.volume} onChange={(event) => { audio.setVolume(Number(event.currentTarget.value)); setAudioState(audio.getSnapshot()); }} /></label>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => { void audio.unlock().then(() => setAudioState(audio.getSnapshot())); }}>Enable optional audio</button>
          <span role="status">{audioState.unlocked ? "Audio unlocked after user action." : "Audio locked until a user action; text substitutes remain active."}</span>
        </div>
        <p>Essential meaning is repeated in text, symbols, focus, and persistent history. Audio is optional; browser autoplay and mute never remove a cue.</p>
      </section>

      <section className="event-history player-history" aria-labelledby="player-history-heading">
        <div className="section-heading-row"><div><p className="eyebrow">Persistent operations history · Persistent event history</p><h3 id="player-history-heading">Park history</h3></div><p role="status" aria-live="polite">{snapshot.status}</p></div>
        <ol>{snapshot.history.map((entry) => <li key={entry.id} data-severity={entry.severity}><span className="history-tick">Tick {entry.tick}</span> {entry.text}</li>)}</ol>
        {snapshot.audioSubstitutes.length > 0 ? <p className="audio-substitute" role="status">Text substitute queued for {snapshot.audioSubstitutes.length} audio cue(s).</p> : <p className="audio-substitute">Audio cues have persistent text substitutes available.</p>}
      </section>

      <p className="screen-reader-note" role="note">Selected entity: {selected?.accessibilityLabel ?? "none"}. Canvas content is synchronized with the semantic navigator and Inspector.</p>
    </section>
  );
}

export const ParkPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="production" />;
export const PausedProductionPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="paused-production" />;
export const WorkbenchPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="workbench" />;
export const EvalPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="eval" />;
export const ReplayPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="replay" />;
export const ReviewPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="review" />;
