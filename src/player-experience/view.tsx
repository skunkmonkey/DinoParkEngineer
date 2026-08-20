import React, { useEffect, useMemo, useRef, useState } from "react";

import { PARK_OPERATIONS_FOUNDATION_IDS } from "../park-operations/public.js";
import { useAccessibilityPreferences } from "../shell/public.js";
import { createPlayerAudioAdapter } from "./audio.js";
import { friendlyName, friendlyVersion } from "./presentation.js";
import { PixiParkSceneAdapter, type SceneRendererStatus } from "./pixi-scene.js";
import { createPlayerExperience } from "./runtime.js";
import type {
  PlayerEntityKind,
  PlayerEntityProjection,
  PlayerExperienceCommand,
  PlayerExperienceMode,
  PlayerExperienceService,
  PlayerExperienceSnapshot,
} from "./types.js";

export interface PlayerExperienceProps {
  readonly mode?: PlayerExperienceMode;
  readonly runtime?: PlayerExperienceService;
}

const modeText = (mode: PlayerExperienceMode): string => {
  switch (mode) {
    case "production": return "LIVE PARK";
    case "paused-production": return "PARK PAUSED";
    case "workbench": return "WORKBENCH · PARK PAUSED";
    case "eval": return "SIMULATION · PARK PAUSED";
    case "replay": return "HISTORICAL REPLAY";
    case "review": return "REVIEW · PARK PAUSED";
  }
};

const kindLabel = (kind: PlayerEntityKind): string => {
  switch (kind) {
    case "dinosaur": return "Dinosaurs";
    case "robot": return "Worker Agents";
    case "gate": return "Gates";
    case "visitor": return "Visitors";
    case "hazard": return "Hazards";
    case "job": return "Jobs";
    case "alert": return "Alerts";
    case "incident": return "Incidents";
  }
};

const selectedEntity = (snapshot: PlayerExperienceSnapshot): PlayerEntityProjection | undefined =>
  snapshot.scene.entities.find((entity) => entity.id === snapshot.selectedEntityId) ?? snapshot.scene.entities[0];

const rendererLabel = (status: SceneRendererStatus | undefined): string =>
  status?.state === "fallback" ? "Park art unavailable; semantic park active" : "Park ready";

export function PlayerExperience({ mode = "production", runtime }: PlayerExperienceProps): React.JSX.Element {
  const service = useMemo(() => {
    if (runtime !== undefined) return runtime;
    const created = createPlayerExperience({ mode });
    if (typeof window !== "undefined") {
      const parameters = new URLSearchParams(window.location.search);
      if (parameters.has("incident")) created.dispatch({ kind: "trigger-near-miss" });
      const restored = parameters.get("selected");
      if (restored?.includes(":") === true) created.dispatch({ kind: "select-entity", entityId: restored as `${string}:${string}` });
    }
    return created;
  }, [mode, runtime]);
  const [snapshot, setSnapshot] = useState<PlayerExperienceSnapshot>(() => service.project());
  const [rendererStatus, setRendererStatus] = useState<SceneRendererStatus>();
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const { preferences } = useAccessibilityPreferences();
  const audio = useMemo(createPlayerAudioAdapter, []);
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
    void adapter.mount(host, {
      reducedMotion: preferences.reducedMotion,
      highContrast: preferences.highContrast,
      assetBasePath: import.meta.env.BASE_URL,
      onStatusChange: (status) => { if (active) setRendererStatus(status); },
    }).then((status) => { if (active) setRendererStatus(status); });
    return () => { active = false; adapter.dispose(); sceneAdapter.current = undefined; };
  }, [preferences.highContrast, preferences.reducedMotion]);
  useEffect(() => { sceneAdapter.current?.render(snapshot.scene, snapshot.scene.renderFrame * 320); }, [snapshot.scene]);
  useEffect(() => {
    sceneAdapter.current?.setOptions({ reducedMotion: preferences.reducedMotion, highContrast: preferences.highContrast, assetBasePath: import.meta.env.BASE_URL });
    const textScale = preferences.textScale === 1.25 || preferences.textScale === 1.5 ? preferences.textScale : 1;
    service.dispatch({ kind: "set-preferences", preferences: { reducedMotion: preferences.reducedMotion, highContrast: preferences.highContrast, soundSubstitution: preferences.soundSubstitution, textScale } });
  }, [preferences, service]);
  useEffect(() => {
    audioMountCount.current += 1;
    return () => { audioMountCount.current -= 1; queueMicrotask(() => { if (audioMountCount.current === 0) audio.dispose(); }); };
  }, [audio]);

  const selected = selectedEntity(snapshot);
  const groups = useMemo(() => {
    const grouped = new Map<PlayerEntityKind, PlayerEntityProjection[]>();
    for (const entity of snapshot.scene.entities) grouped.set(entity.kind, [...(grouped.get(entity.kind) ?? []), entity]);
    return [...grouped.entries()];
  }, [snapshot.scene.entities]);

  const dispatch = (command: PlayerExperienceCommand): void => {
    const result = service.dispatch(command);
    if (command.kind === "select-entity" || command.kind === "focus-entity") setInspectorOpen(true);
    void audio.unlock().then(() => {
      if (result.accepted) audio.requestCue({
        id: command.kind,
        text: result.snapshot.status,
        severity: command.kind === "trigger-near-miss" ? "emergency" : command.kind === "feed-through-inspector" || command.kind === "resolve-incident" ? "success" : "info",
      });
    });
  };

  const selectedJob = selected === undefined ? undefined : selected.kind === "job"
    ? snapshot.operations.jobs.find((entry) => entry.id === selected.id)
    : snapshot.operations.jobs.find((entry) => entry.targetId === selected.id);
  const selectedIncident = selected?.kind === "incident" ? snapshot.operations.incidents.find((entry) => entry.id === selected.id) : undefined;

  const primaryAction = (): React.JSX.Element | null => {
    if (selected === undefined) return null;
    if (selected.kind === "alert") {
      const alert = snapshot.operations.alerts.find((entry) => entry.id === selected.id);
      return alert?.status === "acknowledged" ? <p className="compact-success">Alert acknowledged</p> : <button className="primary-action" type="button" onClick={() => dispatch({ kind: "acknowledge-alert", alertId: alert?.id })}>Acknowledge warning</button>;
    }
    if (selected.kind === "incident") {
      if (selectedIncident?.status === "detected") return <button className="primary-action" type="button" onClick={() => dispatch({ kind: "stabilize-incident", incidentId: selectedIncident.id })}>Stabilize paddock</button>;
      if (selectedIncident !== undefined && selectedIncident.status !== "closed") return <button className="primary-action" type="button" onClick={() => dispatch({ kind: "resolve-incident", incidentId: selectedIncident.id })}>Close after verification</button>;
      return <p className="compact-success">Recovery recorded</p>;
    }
    if ((selected.kind !== "dinosaur" && selected.kind !== "job") || selectedJob === undefined) return null;
    if (selectedJob.targetId === "dinosaur:vera") return snapshot.operations.incidents.length > 0
      ? <p className="compact-success">Near miss recorded</p>
      : <button className="primary-action danger-action" type="button" onClick={() => dispatch({ kind: "trigger-near-miss" })}>Feed Vera with current Prompt</button>;
    if (selectedJob.status === "queued") return <button className="primary-action" type="button" onClick={() => dispatch({ kind: "assign-feeding-job", agentId: PARK_OPERATIONS_FOUNDATION_IDS.robot })}>Send Robot Alpha</button>;
    if (selectedJob.status === "assigned" || selectedJob.status === "running") return <button className="primary-action" type="button" onClick={() => dispatch({ kind: "feed-through-inspector" })}>Run safe feeding</button>;
    return <p className="compact-success"><span aria-hidden="true">✓</span> Feeding complete</p>;
  };

  const objective = snapshot.operations.incidents.length > 0
    ? "Secure North Paddock"
    : selectedJob?.status === "completed" ? "Check Vera before opening" : "Feed hungry Tria";

  return <section className={`player-experience park-game-shell player-mode-${mode}`} data-mode={mode} aria-labelledby="player-experience-heading">
    <h2 id="player-experience-heading" className="visually-hidden">Dawn Valley Park View</h2>
    <header className="park-hud" aria-label="Park status">
      <div className="park-hud-brand"><span className="live-marker" aria-hidden="true">●</span><div><strong>Dawn Valley</strong><small>{modeText(mode)}</small></div></div>
      <dl className="hud-meters">
        <div><dt>Park time</dt><dd>Day {snapshot.operationalAnchor.day} · {snapshot.operationalAnchor.tick}/300</dd></div>
        <div><dt>Rating</dt><dd>{snapshot.operationalAnchor.rating === "unrated" ? "New park" : `${snapshot.operationalAnchor.rating}%`}</dd></div>
        <div><dt>Credits</dt><dd>¤ {snapshot.operationalAnchor.credits.toLocaleString("en-US")}</dd></div>
        <div className={snapshot.operationalAnchor.emergencyCount > 0 ? "hud-emergency" : ""}><dt>Emergencies</dt><dd>{snapshot.operationalAnchor.emergencyCount === 0 ? "None" : snapshot.operationalAnchor.emergencyCount}</dd></div>
      </dl>
      <div className="hud-objective"><span>Current objective</span><strong>{objective}</strong></div>
    </header>

    <div className={`park-stage ${inspectorOpen ? "inspector-is-open" : ""}`}>
      <section className="park-viewport" aria-label="Living park">
        <div className="park-scene-shell" data-renderer-preference="webgl" data-orientation={snapshot.scene.orientation} data-lighting={snapshot.scene.lighting} data-semantic-zoom={snapshot.scene.semanticZoom}>
          <div className="park-scene-host" ref={sceneHost} aria-hidden="true" />
          <div className="park-scene-fallback" role="img" aria-label="Dawn park with two fenced habitats, keeper routes, a hungry Tria, Robot Alpha at the service depot, and visitors approaching the entrance."><span>Dawn Valley Park</span><span>{rendererLabel(rendererStatus)}</span></div>
          <div className="scene-entity-hit-targets" aria-label="Select an entity in the park">
            {snapshot.scene.entities.filter((entity) => entity.occlusion !== "aggregate" && entity.kind !== "job").map((entity) => <button className={`scene-entity-hit-target cue-${entity.cue?.grammar ?? "routine"} ${entity.selected ? "is-selected" : ""}`} key={entity.id} type="button" style={{ left: `${entity.position.x}%`, top: `${entity.position.y}%` }} aria-label={`Select ${entity.accessibilityLabel}`} aria-pressed={entity.selected} onClick={() => dispatch({ kind: "select-entity", entityId: entity.id })}><span aria-hidden="true">{entity.cue?.symbol ?? ""}</span></button>)}
          </div>
          <div className="world-objective-cue" role="status"><span aria-hidden="true">◇</span><span>{snapshot.status}</span></div>
          {!inspectorOpen ? <button className="open-inspector" type="button" onClick={() => setInspectorOpen(true)}>Inspect {selected?.label ?? "park"}</button> : null}
        </div>
        <div className="camera-controls" aria-label="Park camera controls"><button type="button" aria-label="Pan park left" onClick={() => dispatch({ kind: "pan-camera", delta: { x: -8, y: 0 } })}>←</button><button type="button" aria-label="Pan park right" onClick={() => dispatch({ kind: "pan-camera", delta: { x: 8, y: 0 } })}>→</button><button type="button" aria-label="Zoom out" onClick={() => dispatch({ kind: "zoom-camera", delta: -0.15 })}>−</button><button type="button" aria-label="Zoom in" onClick={() => dispatch({ kind: "zoom-camera", delta: 0.15 })}>+</button><span aria-live="polite">{rendererLabel(rendererStatus)}</span></div>
      </section>

      {inspectorOpen ? <aside className="park-inspector" aria-labelledby="inspector-heading">
        <div className="inspector-title-row"><div><p>{selected === undefined ? "Park" : kindLabel(selected.kind).replace(/s$/u, "")}</p><h3 id="inspector-heading">{selected?.label ?? "Select something"}</h3></div><button className="icon-button" type="button" aria-label="Close Inspector" onClick={() => setInspectorOpen(false)}>×</button></div>
        {selected === undefined ? <p>Choose a park object to inspect.</p> : <>
          <p className={`inspector-status severity-${selected.cue?.severity ?? "info"}`}><span aria-hidden="true">{selected.cue?.symbol ?? "●"}</span>{selected.status}</p>
          <dl className="inspector-summary"><div><dt>Intent</dt><dd>{selected.intent}</dd></div><div><dt>Location</dt><dd>{friendlyName(selected.locationId)}</dd></div>{selected.route.length > 1 ? <div><dt>Route</dt><dd>{selected.route.map(friendlyName).join(" → ")}</dd></div> : null}</dl>
          <div className="inspector-primary-action">{primaryAction()}</div>
          {selectedJob === undefined ? null : <section className="compact-job"><h4>{selectedJob.targetId === "dinosaur:vera" ? "Feed Vera" : "Feed Tria"}</h4><p>{selectedJob.status} · required before opening</p></section>}
          {selected.kind === "incident" && selected.evidence !== undefined ? <section className="incident-summary"><h4>What happened</h4><p>{selected.evidence.consequence.join(" ")}</p><p><strong>Gap:</strong> {selected.evidence.immediateGap.join(" ")}</p><a className="button-link" href={snapshot.causalNavigation?.workbenchUrl ?? "/workbench"}>Investigate in Workbench</a></section> : null}
          <details className="advanced-details"><summary>Inspect evidence</summary><dl className="inspector-details"><div><dt>Exact identity</dt><dd><code>{selected.id}</code></dd></div><div><dt>Location ID</dt><dd><code>{selected.locationId}</code></dd></div><div><dt>Source</dt><dd>{selected.source} · tick {selected.sourceTick}</dd></div></dl>{selectedJob === undefined ? null : <><h4>Production pins</h4><ul>{selectedJob.exactDeployedVersions.map((pin) => <li key={`${pin.reference.id}@${pin.reference.version}`}><strong>{friendlyVersion(`${pin.reference.id}@${pin.reference.version}`)}</strong><br /><code>{pin.reference.id}@{pin.reference.version}</code><br /><small>Manifest {pin.manifestFingerprint}</small></li>)}</ul></>}{selected.evidence === undefined ? null : <><h4>What happened · exact route</h4><ol><li>Incident <code>{selected.id}</code></li><li>Worker action <code>command:opening-reuse-open-gate</code></li><li>Missing Context <code>context:maintenance-policy</code></li><li>Trace {selected.evidence.traceIds.map((traceId) => <code key={traceId}>{traceId} </code>)}</li><li>Prompt <code>prompt:self-contained-feeding@1.0.0</code></li></ol></>}{snapshot.synchronizedEvidence === undefined ? null : <><h4>Synchronized Eval &amp; Historical Replay</h4><p><code>{snapshot.synchronizedEvidence.eval.resultId}</code> · {snapshot.synchronizedEvidence.eval.status}</p><p><code>{snapshot.synchronizedEvidence.replay.sessionId}</code> · {snapshot.synchronizedEvidence.replay.status}</p></>}</details>
          <details className="roster-details"><summary>Park roster</summary><div className="entity-navigator" role="listbox" aria-label="Park roster">{groups.map(([kind, entities]) => <div role="group" aria-label={kindLabel(kind)} key={kind}>{entities.map((entity) => <button className={`navigator-option ${entity.selected ? "is-selected" : ""}`} key={entity.id} type="button" role="option" aria-selected={entity.selected} onClick={() => dispatch({ kind: "select-entity", entityId: entity.id })}><span aria-hidden="true">{entity.cue?.symbol ?? "·"}</span><span><strong>{entity.label}</strong><small>{entity.status}</small></span></button>)}</div>)}</div></details>
        </>}
      </aside> : null}
    </div>

    <footer className="park-action-strip"><div className="time-buttons" role="group" aria-label="Park time controls"><button className="pause-button" type="button" aria-label={snapshot.operations.paused ? "Resume park time" : "Pause park time"} onClick={() => dispatch({ kind: "set-time-control", paused: !snapshot.operations.paused, speed: snapshot.operations.speed })}><span aria-hidden="true">{snapshot.operations.paused ? "▶" : "Ⅱ"}</span><span>{snapshot.operations.paused ? "Resume" : "Pause"}</span></button>{[1, 2, 4].map((speed) => <button key={speed} type="button" aria-label={`${speed} times park speed`} aria-pressed={snapshot.operations.speed === speed} onClick={() => dispatch({ kind: "set-time-control", paused: snapshot.operations.paused, speed: speed as 1 | 2 | 4 })}>{speed}×</button>)}</div><p className="park-time-status" role="status">{snapshot.operations.paused ? "Park paused" : `Park running at ${snapshot.operations.speed}×`} · visitors arrive at 300</p><details className="park-history-popover"><summary>Park log <span>{snapshot.history.length}</span></summary><ol>{snapshot.history.map((entry) => <li key={entry.id} data-severity={entry.severity}><small>Park time {entry.tick}</small>{entry.text}</li>)}</ol>{snapshot.retentionPresentations.map((presentation) => <article className="retention-event" key={presentation.id} data-animation={presentation.animation}><h4>Context retention</h4><p>{presentation.headline}</p><ul>{presentation.items.map((item) => <li key={item.itemId}><strong>{item.lifecycle}</strong> · {friendlyName(item.destination)}<details><summary>Exact record</summary><code>{item.itemId}</code> · <code>{item.reasonCode}</code></details></li>)}</ul></article>)}</details>{snapshot.guidance.level === "complete" ? null : <details className="hint-popover"><summary>Hint</summary><p>{snapshot.guidance.text}</p><div className="button-row"><button type="button" onClick={() => dispatch({ kind: "advance-guidance" })}>More help</button><button type="button" onClick={() => dispatch({ kind: "dismiss-guidance" })}>Dismiss</button></div></details>}</footer>
    <p className="visually-hidden" role="note">Selected entity: {selected?.accessibilityLabel ?? "none"}. The Park roster provides the same selection and state as the visual park.</p>
  </section>;
}

export const ParkPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="production" />;
export const PausedProductionPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="paused-production" />;
export const WorkbenchPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="workbench" />;
export const EvalPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="eval" />;
export const ReplayPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="replay" />;
export const ReviewPlayerExperience = (): React.JSX.Element => <PlayerExperience mode="review" />;
