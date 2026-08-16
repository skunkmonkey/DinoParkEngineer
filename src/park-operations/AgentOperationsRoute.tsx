"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { DataTable, Meter, Panel, StatusBadge } from "../platform/public.ts";
import { formatContextUnits, formatGameTime } from "../platform/public.ts";
import { getActiveParkOperationsService } from "./runtime.ts";
import { createParkOperationsService, type ParkOperationsService } from "../../park-operations/index.ts";
import "./ParkOperationsRoute.css";

function tone(status: string): "success" | "warning" | "error" | "neutral" | "pending" {
  if (status === "IDLE" || status === "SUCCEEDED" || status === "FRESH") return "success";
  if (status === "DISABLED" || status === "FAILED" || status === "STALE" || status === "EXPIRED") return "error";
  if (status === "BUSY" || status === "RUNNING" || status === "PAUSED") return "warning";
  return "neutral";
}

export function AgentOperationsRoute({ params, navigate }: ShellRouteProps) {
  const service = useMemo<ParkOperationsService>(() => getActiveParkOperationsService() ?? createParkOperationsService(), []);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState(params.agentId ?? service.getPark().agents[0]?.id ?? "");
  void version;
  const view = service.getPark();
  const selected = view.agents.find((agent) => agent.id === selectedId) ?? view.agents[0];
  useEffect(() => service.subscribe(() => setVersion((value) => value + 1)), [service]);

  if (!selected) return <Panel eyebrow="Agents" title="No workers available"><p>The authoritative snapshot contains no worker agents.</p></Panel>;
  return (
    <div className="agent-operations">
      <nav className="foundation-actions" aria-label="Agent views"><button type="button" onClick={() => navigate("/agents")}>Workers</button><button type="button" onClick={() => navigate("/orchestration")}>Manager Agent / Orchestration</button></nav>
      <div className="agent-operations__switcher" role="listbox" aria-label="Worker agents">
        {view.agents.map((agent) => <button key={agent.id} type="button" role="option" aria-selected={agent.id === selected.id} onClick={() => setSelectedId(agent.id)}>{agent.id}<StatusBadge label={agent.status} status={tone(agent.status)} /></button>)}
      </div>
      <div className="agent-operations-grid">
        <Panel eyebrow="Worker status" title={selected.id}>
          <dl><div><dt>Status</dt><dd><StatusBadge label={selected.status} status={tone(selected.status)} /></dd></div><div><dt>Location</dt><dd>{selected.location}</dd></div><div><dt>Battery</dt><dd>{selected.battery}%</dd></div><div><dt>Manager</dt><dd>{selected.managerId ?? "No manager assigned"}</dd></div></dl>
          <Meter label="Context load" value={selected.contextLoad} max={selected.contextBudget} detail={`${formatContextUnits(selected.contextLoad)} / ${formatContextUnits(selected.contextBudget)}`} />
          <p>Current logical time: {formatGameTime(view.snapshot.logicalTime)}</p>
        </Panel>
        <Panel eyebrow="Tools" title="Available deterministic tools"><ul>{selected.tools.map((tool) => <li key={tool}><code>{tool}</code> · available through the simulation command port</li>)}</ul></Panel>
        <Panel eyebrow="Context" title="Loaded composition"><DataTable caption="Context items" columns={[{ id: "ref", label: "Exact ref" }, { id: "kind", label: "Kind" }, { id: "cost", label: "CU" }, { id: "freshness", label: "Freshness" }]} rows={selected.contextItems.map((item) => [<code key={`${item.ref}-ref`}>{item.ref}{item.version ? `@${item.version}` : ""}</code>, item.kind, item.contextCost, item.freshnessStatus ?? "—"])} /></Panel>
        <Panel eyebrow="Memory" title="Scoped memory"><DataTable caption="Memory summary" columns={[{ id: "id", label: "Record" }, { id: "status", label: "Freshness" }, { id: "provenance", label: "Provenance" }]} rows={selected.memorySummary.map((record) => [record.id, <StatusBadge key={`${record.id}-status`} label={record.status} status={tone(record.status)} />, record.provenance])} /></Panel>
        <Panel eyebrow="Queue" title="Current and ordered work"><DataTable caption="Worker queue" columns={[{ id: "job", label: "Job" }, { id: "state", label: "State" }, { id: "target", label: "Target" }, { id: "trace", label: "Trace" }]} rows={[...(selected.currentTask ? [selected.currentTask] : []), ...selected.queue].map((job) => [job.id, <StatusBadge key={`${job.id}-status`} label={job.status} status={tone(job.status)} />, job.targetRefs.join(", "), job.traceId ? <a key={`${job.id}-trace`} href={`/traces/${job.traceId}`}>{job.traceId}</a> : "—"])} /></Panel>
        <Panel eyebrow="Trace links" title="Recent observable runs">{selected.recentTraceIds.length ? <ul>{selected.recentTraceIds.map((traceId) => <li key={traceId}><a href={`/traces/${traceId}`}>{traceId}</a></li>)}</ul> : <p>No traces yet.</p>}</Panel>
      </div>
    </div>
  );
}
