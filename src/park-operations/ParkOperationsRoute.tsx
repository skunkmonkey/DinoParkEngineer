"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { DataTable, Meter, Panel, SeverityBadge, StatusBadge, Tabs, TabPanel } from "../platform/public.ts";
import { formatContextUnits, formatCredits, formatGameTime } from "../platform/public.ts";
import { getActiveParkOperationsService } from "./runtime.ts";
import { createDefaultFeedingJobDraft, createParkOperationsService, DEFAULT_OPERATIONS_ARTIFACTS, type OperationsEntityRow, type ParkOperationsService } from "../../park-operations/index.ts";
import "./ParkOperationsRoute.css";

function statusTone(status: string): "success" | "warning" | "error" | "neutral" | "pending" {
  if (status === "SUCCEEDED" || status === "RECOVERED" || status === "CONTAINED") return "success";
  if (status === "FAILED" || status === "ESCALATED" || status === "BLOCKED" || status === "CANCELLED") return "error";
  if (status === "RUNNING" || status === "PAUSED" || status === "OPEN") return "warning";
  return "neutral";
}

function labelFor(row: OperationsEntityRow): string {
  return `${row.kind.toLowerCase()} · ${row.label}`;
}

function refKeyForDisplay(ref: { readonly artifactId: string; readonly version: number }): string {
  return `${ref.artifactId}@${ref.version}`;
}

export function ParkOperationsRoute({ query }: ShellRouteProps) {
  const service = useMemo<ParkOperationsService>(() => getActiveParkOperationsService() ?? createParkOperationsService(), []);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState("overview");
  const [layoutTab, setLayoutTab] = useState("map");
  const [target, setTarget] = useState("dino.rex");
  const [agent, setAgent] = useState("agent.keeper01");
  const [priority, setPriority] = useState(5);
  const [useSafeSkill, setUseSafeSkill] = useState(false);
  const [useSystemPrompt, setUseSystemPrompt] = useState(false);
  const [queueStatus, setQueueStatus] = useState("ALL");
  const [queueSort, setQueueSort] = useState("PRIORITY");
  const [selected, setSelected] = useState(typeof query.entity === "string" ? query.entity : "dino.rex");
  const [message, setMessage] = useState("");
  void version;
  const view = service.getPark();
  const dinosaurs = view.snapshot.dinosaurs;
  const draft = createDefaultFeedingJobDraft({ targetRef: target, agentId: agent, priority, logicalTime: view.snapshot.logicalTime, expectedParkVersion: view.version, useSafeSkill, useSystemPrompt });
  const preview = service.preflight(draft);

  useEffect(() => service.subscribe(() => setVersion((value) => value + 1)), [service]);

  const submit = () => {
    if (!preview.ok) {
      setMessage(`Blocked: ${preview.diagnostics.join(" ")}`);
      return;
    }
    const result = service.create(draft, `ui.create.feed.${view.version}.${target}`);
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setMessage(`Queued ${result.job.id}; exact Context ${formatContextUnits(preview.projectedLoad)} / ${formatContextUnits(preview.budget)}.`);
  };

  const acknowledge = (incidentId: string) => {
    const result = service.acknowledgeIncident(incidentId, `ui.ack.${incidentId}`);
    setMessage(result.ok ? `Acknowledged ${incidentId}; underlying incident state remains authoritative.` : `${result.error.code}: ${result.error.message}`);
  };

  const commandJob = (jobId: string, action: "START" | "RUN" | "PAUSE_CANCEL" | "PRIORITY") => {
    const job = view.jobs.find((item) => item.id === jobId);
    if (!job) return;
    const commandId = `ui.${action.toLowerCase()}.${jobId}.${view.version}`;
    const result = action === "START" ? service.start(jobId, commandId)
      : action === "RUN" ? service.runToCompletion(jobId, commandId)
      : action === "PRIORITY" ? service.reprioritize(jobId, job.priority + 1, commandId, job.observedVersion)
      : service.cancelOrPauseAtSafePoint(jobId, commandId, job.observedVersion);
    setMessage(result.ok ? `${jobId}: ${result.job.status}${result.job.safePoint ? ` · safe point ${result.job.safePoint}` : ""}.` : `${result.error.code}: ${result.error.message}`);
  };

  const emergencyResponse = (incidentId: string) => {
    const incident = view.incidents.find((item) => item.id === incidentId);
    if (!incident) return;
    const beforeTime = view.snapshot.logicalTime;
    const commandId = `ui.emergency.${incident.id}.${view.version}`;
    const result = service.intervene({ action: "alert_security", commandId, agentId: agent, incidentId: incident.id, severity: incident.severity });
    setMessage(result.ok ? `Emergency response ${view.metrics.paused ? "queued while paused" : "issued"}; logical time ${beforeTime} → ${service.snapshot().logicalTime}.` : `${result.error.code}: ${result.error.message}`);
  };

  const selectedRow = view.mapRows.find((row) => row.id === selected);
  const visibleJobs = view.jobs.filter((job) => queueStatus === "ALL" || job.status === queueStatus).sort((a, b) => queueSort === "DUE" ? a.dueTime - b.dueTime || a.id.localeCompare(b.id) : b.priority - a.priority || a.dueTime - b.dueTime || a.id.localeCompare(b.id));
  const jobRows = visibleJobs.map((job) => [
    <button key={`${job.id}-select`} type="button" onClick={() => setSelected(job.id)}>{job.id}</button>,
    <span key={`${job.id}-type`}>{job.type} · {job.targetRefs.join(", ")}</span>,
    <StatusBadge key={`${job.id}-status`} label={job.status} status={statusTone(job.status)} />,
    <span key={`${job.id}-agent`}>{job.assignedAgentId}</span>,
    <span key={`${job.id}-actions`} className="park-job-actions">{job.status === "QUEUED" ? <><button type="button" onClick={() => commandJob(job.id, "START")}>Start</button><button type="button" onClick={() => commandJob(job.id, "RUN")}>Run all</button><button type="button" onClick={() => commandJob(job.id, "PRIORITY")}>Priority +1</button><button type="button" onClick={() => commandJob(job.id, "PAUSE_CANCEL")}>Cancel</button></> : job.status === "RUNNING" ? <button type="button" onClick={() => commandJob(job.id, "PAUSE_CANCEL")}>Pause after safe point</button> : job.traceId ? <a href={`/traces/${job.traceId}`}>Trace {job.traceId}</a> : "—"}</span>,
  ]);
  const mapRows = view.mapRows.map((row) => [
    <button key={`${row.id}-entity`} type="button" onClick={() => setSelected(row.id)} aria-pressed={selected === row.id}>{labelFor(row)}</button>,
    <span key={`${row.id}-state`}>{row.state}</span>,
    <span key={`${row.id}-location`}>{row.location ?? "—"}</span>,
    <a key={`${row.id}-link`} href={row.deepLink}>Inspect</a>,
  ]);
  const incidentRows = view.alerts.map((incident) => [
    <SeverityBadge key={`${incident.id}-severity`} severity={incident.severity} />,
    <button key={`${incident.id}-select`} type="button" onClick={() => setSelected(incident.id)}>{incident.id}</button>,
    <span key={`${incident.id}-trigger`}>{incident.trigger}</span>,
    <StatusBadge key={`${incident.id}-status`} label={incident.status} status={statusTone(incident.status)} />,
    <span key={`${incident.id}-actions`}><button type="button" onClick={() => acknowledge(incident.id)}>{view.acknowledgedIncidentIds.includes(incident.id) ? "Acknowledged" : "Acknowledge"}</button>{view.incidentTraceLinks[incident.id] ? <a href={`/traces/${view.incidentTraceLinks[incident.id]}`}> Trace</a> : null}</span>,
  ]);

  return (
    <div className="park-operations" data-testid="park-operations">
      <div className="foundation-actions" aria-label="Park controls">
        <StatusBadge label={`${view.metrics.openIncidents} open incidents`} status={view.metrics.openIncidents > 0 ? "warning" : "success"} />
        <StatusBadge label={`Time ${formatGameTime(view.metrics.logicalTime)}`} status="neutral" />
        <StatusBadge label={`${formatCredits(view.metrics.credits)} credits`} status="neutral" />
        <button type="button" aria-pressed={view.metrics.paused} onClick={() => service.setPaused(!view.metrics.paused)}>{view.metrics.paused ? "Resume park" : "Pause park"}</button>
        {[1, 2, 4].map((speed) => <button key={speed} type="button" aria-pressed={view.metrics.speed === speed} onClick={() => service.setSpeed(speed as 1 | 2 | 4)}>{speed}x</button>)}
      </div>
      {message ? <p role="status" className="foundation-notice">{message}</p> : null}

      <div className="park-operations-mobile-tabs"><Tabs idPrefix="park-layout" tabs={[{ id: "queues", label: "Queues" }, { id: "map", label: "Map" }, { id: "alerts", label: "Alerts" }]} value={layoutTab} onChange={setLayoutTab} /></div>

      <div className="park-operations-grid">
        <aside className={`park-operations-panel-region ${layoutTab === "queues" ? "is-mobile-active" : ""}`} aria-label="Jobs and agents queue">
          <Panel eyebrow="Queue" title="Jobs / agents">
            <div className="foundation-actions" aria-label="Queue filters"><label>Status <select value={queueStatus} onChange={(event) => setQueueStatus(event.target.value)}><option value="ALL">All</option>{["QUEUED", "RUNNING", "PAUSED", "SUCCEEDED", "FAILED", "ESCALATED", "BLOCKED", "CANCELLED"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Sort <select value={queueSort} onChange={(event) => setQueueSort(event.target.value)}><option value="PRIORITY">Priority</option><option value="DUE">Due time</option></select></label></div>
            <DataTable caption="Live jobs" columns={[{ id: "job", label: "Job" }, { id: "target", label: "Target" }, { id: "state", label: "State" }, { id: "agent", label: "Agent" }, { id: "action", label: "Action" }]} rows={jobRows.length ? jobRows : [["No jobs", "—", "—", "—", "—"]]} />
            <div className="foundation-stack" aria-label="Workers">
              {view.agents.map((worker) => <button key={worker.id} type="button" onClick={() => setSelected(worker.id)}>{worker.id} · {worker.status} · {formatContextUnits(worker.contextLoad)} / {formatContextUnits(worker.contextBudget)}</button>)}
            </div>
          </Panel>
          <Panel eyebrow="Authored job" title="Create feeding job">
            <p>Choose an authored template and exact artifacts. Freeform prose is not accepted by the deterministic core.</p>
            <label>Target <select value={target} onChange={(event) => setTarget(event.target.value)}>{dinosaurs.map((dinosaur) => <option key={dinosaur.id} value={dinosaur.id}>{dinosaur.id}</option>)}</select></label>
            <label>Worker <select value={agent} onChange={(event) => setAgent(event.target.value)}>{view.agents.map((worker) => <option key={worker.id} value={worker.id}>{worker.id}</option>)}</select></label>
            <label>Priority <input type="number" min={0} max={10} value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></label>
            <label>Prompt <select value={refKeyForDisplay(DEFAULT_OPERATIONS_ARTIFACTS.promptRef)} disabled><option>{refKeyForDisplay(DEFAULT_OPERATIONS_ARTIFACTS.promptRef)}</option></select></label>
            <label><input type="checkbox" checked={useSafeSkill} onChange={(event) => setUseSafeSkill(event.target.checked)} /> Safe Feeding Skill {useSafeSkill && preview.draft.skillRefs?.[0] ? refKeyForDisplay(preview.draft.skillRefs[0]) : refKeyForDisplay(DEFAULT_OPERATIONS_ARTIFACTS.skillRef)}{useSafeSkill ? " · authoritative active ref" : ""}</label>
            <label><input type="checkbox" checked={useSystemPrompt} onChange={(event) => setUseSystemPrompt(event.target.checked)} /> Containment System Prompt {refKeyForDisplay(DEFAULT_OPERATIONS_ARTIFACTS.systemPromptRef)}</label>
            <div className="park-preflight" aria-live="polite"><StatusBadge label={preview.ok ? "Preflight ready" : "Preflight blocked"} status={preview.ok ? "success" : "error"} /><Meter label="Projected Context" value={preview.projectedLoad} max={preview.budget || 1} detail={`${formatContextUnits(preview.projectedLoad)} / ${formatContextUnits(preview.budget)}`} /><p><strong>Dependencies:</strong> {preview.dependencyRefs.join(", ") || "None"}</p><p><strong>Required tools:</strong> {preview.requiredToolIds.join(", ") || "None"}</p><p><strong>Eligible workers:</strong> {preview.eligibleAgents.filter((item) => item.missingToolIds.length === 0 && item.projectedContextLoad !== undefined).map((item) => item.agentId).join(", ") || "None"}</p>{preview.diagnostics.length ? <ul>{preview.diagnostics.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div>
            <button type="button" onClick={submit} disabled={!preview.ok}>Queue exact configuration</button>
          </Panel>
        </aside>

        <section className={`park-operations-panel-region ${layoutTab === "map" ? "is-mobile-active" : ""}`} aria-label="Park schematic and accessible equivalent">
          <Panel eyebrow="Authoritative snapshot" title="Park schematic">
            <div className="park-schematic" role="img" aria-label="Schematic view represented equivalently by the entity table below">
              {view.snapshot.enclosures.map((enclosure) => {
                const gate = view.snapshot.gates.find((item) => item.enclosureId === enclosure.id);
                const device = view.snapshot.devices.find((item) => item.enclosureId === enclosure.id);
                const visitors = view.snapshot.visitors.filter((item) => enclosure.visitorBufferZoneIds.includes(item.location));
                const workers = view.snapshot.agents.filter((item) => enclosure.zoneIds.includes(item.location));
                return <button key={enclosure.id} type="button" className="park-schematic__enclosure" onClick={() => setSelected(enclosure.id)} aria-label={`${enclosure.id}, ${enclosure.closed ? "closed" : "open"}, gate ${gate?.state ?? "unknown"}, device ${device?.state ?? "unknown"}, ${visitors.length} visitor groups, ${workers.length} workers`}><strong>{enclosure.id}</strong><span>Enclosure {enclosure.closed ? "CLOSED" : "OPEN"}</span><span>Dinosaur {view.snapshot.dinosaurs.find((dinosaur) => dinosaur.enclosureId === enclosure.id)?.id ?? "none"}</span><span>Gate {gate?.id ?? "—"}: {gate?.state ?? "UNKNOWN"}</span><span>Device {device?.id ?? "—"}: {device?.state ?? "UNKNOWN"}</span><span>Visitors: {visitors.map((item) => `${item.id} ${item.safetyState}`).join(", ") || "none"}</span><span>Workers: {workers.map((item) => `${item.id} ${item.status}`).join(", ") || "none"}</span></button>;
              })}
            </div>
            <DataTable caption="Keyboard-accessible entity list (same source as schematic)" columns={[{ id: "entity", label: "Entity" }, { id: "state", label: "State" }, { id: "location", label: "Location" }, { id: "link", label: "Deep link" }]} rows={mapRows} />
          </Panel>
          <Panel eyebrow="Inspector" title={selectedRow ? labelFor(selectedRow) : "Select an entity"}>
            {selectedRow ? <dl><div><dt>State</dt><dd>{selectedRow.state}</dd></div><div><dt>Source id</dt><dd>{selectedRow.sourceId}</dd></div><div><dt>Deep link</dt><dd><a href={selectedRow.deepLink}>{selectedRow.deepLink}</a></dd></div></dl> : <p>Select a map node or table row.</p>}
          </Panel>
        </section>

        <aside className={`park-operations-panel-region ${layoutTab === "alerts" ? "is-mobile-active" : ""}`} aria-label="Alerts and operational metrics">
          <Panel eyebrow="Alerts" title="Severity ordered incidents"><DataTable caption="Open alerts" columns={[{ id: "severity", label: "Severity" }, { id: "incident", label: "Incident" }, { id: "trigger", label: "Trigger" }, { id: "state", label: "State" }, { id: "ack", label: "Action" }]} rows={incidentRows.length ? incidentRows : [["No", "open", "incidents", "—", "—"]]} /></Panel>
          {view.incidentDetails.map((incident) => <Panel key={incident.id} eyebrow={`Incident severity ${incident.severity}`} title={incident.id}><dl><div><dt>Trigger</dt><dd>{incident.trigger}</dd></div><div><dt>Affected</dt><dd>{incident.affectedEntityIds.map((id) => <button key={id} type="button" onClick={() => setSelected(id)}>{id}</button>)}</dd></div><div><dt>Recovery</dt><dd>{incident.recoveryRequirements.join(" → ")}</dd></div><div><dt>Current response</dt><dd>{incident.currentResponse}</dd></div><div><dt>Responsible job</dt><dd>{incident.responsibleJobId ?? "Unassigned"}</dd></div><div><dt>Trace</dt><dd>{incident.traceId ? <a href={`/traces/${incident.traceId}`}>{incident.traceId}</a> : "Not recorded"}</dd></div><div><dt>Posted costs</dt><dd>{formatCredits(incident.costCredits)}</dd></div></dl><button type="button" onClick={() => emergencyResponse(incident.id)}>Issue emergency response</button></Panel>)}
          <Panel eyebrow="Operations metrics" title="Park health"><div className="foundation-stack"><Meter label="Attendance" value={view.metrics.attendance} max={100} detail={`${view.metrics.attendance} visitors`} /><Meter label="Satisfaction" value={view.metrics.satisfaction} max={100} /><Meter label="Dinosaur health" value={view.metrics.dinosaurHealth} max={100} /><Meter label="Uptime" value={view.metrics.uptime} max={100} /></div></Panel>
          <Panel eyebrow="Inspection" title="Context and agent pressure"><Tabs idPrefix="park-operations-tabs" tabs={[{ id: "overview", label: "Overview" }, { id: "agents", label: "Agents" }]} value={tab} onChange={setTab} /><TabPanel idPrefix="park-operations-tabs" tabId="overview" active={tab === "overview"}><p>World time {formatGameTime(view.snapshot.logicalTime)} · {view.snapshot.enclosures.length} enclosures · {view.snapshot.agents.length} worker.</p></TabPanel><TabPanel idPrefix="park-operations-tabs" tabId="agents" active={tab === "agents"}><ul>{view.agents.map((worker) => <li key={worker.id}>{worker.id}: {worker.tools.length} tools, {worker.memorySummary.length} memory refs, {worker.recentTraceIds.length} traces.</li>)}</ul></TabPanel></Panel>
        </aside>
      </div>
    </div>
  );
}
