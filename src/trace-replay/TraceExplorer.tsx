"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterTraceEvents, type ReplayService, type TraceCategory, type TraceEventRecord, type TraceListQuery, type TracePassFail, type TraceQuery, type TraceRecord, type TraceStatus } from "../../trace-replay/index.ts";
import { Panel, StatusBadge } from "../platform/public.ts";
import { parkEntityHref } from "./links.ts";
import styles from "./TraceExplorer.module.css";

const ROW_HEIGHT = 46;
const CATEGORIES: readonly TraceCategory[] = ["JOB", "VALIDATION", "CONTEXT", "OBSERVATION", "CLAUSE", "TOOL", "WORLD", "ASSERTION", "CONFLICT", "INCIDENT", "DELEGATION", "REPORT", "TERMINAL"];

export interface TraceExplorerProps {
  readonly query: TraceQuery;
  readonly replay?: ReplayService | null;
  readonly initialTraceId?: string;
  readonly onReplay?: (trace: TraceRecord) => void;
  readonly navigate?: (href: string) => void;
}

function statusTone(status: TraceStatus): "success" | "error" | "warning" | "neutral" {
  if (status === "SUCCEEDED") return "success";
  if (status === "FAILED" || status === "BLOCKED") return "error";
  if (status === "ESCALATED" || status === "RUNNING") return "warning";
  return "neutral";
}

function passLabel(event: TraceEventRecord): string {
  if (event.passFail === "PASS") return "PASS · observable result";
  if (event.passFail === "FAIL") return "FAIL · observable result";
  if (event.labels.length > 0) return event.labels.join(" · ");
  return event.category;
}

function eventText(event: TraceEventRecord): string {
  const payload = event.payload;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.reason === "string") return payload.reason;
  if (typeof payload.code === "string") return payload.code;
  if (typeof payload.reasonCode === "string") return payload.reasonCode;
  if (Array.isArray(payload.missingPostconditions) && payload.missingPostconditions.length > 0) return String(payload.missingPostconditions[0]);
  if (event.clauseId) return event.clauseId;
  return event.type;
}

export function TraceExplorer({ query, replay = null, initialTraceId, onReplay, navigate }: TraceExplorerProps) {
  const [category, setCategory] = useState<TraceCategory | "ALL">("ALL");
  const [entityId, setEntityId] = useState("");
  const [artifactRef, setArtifactRef] = useState("");
  const [clauseId, setClauseId] = useState("");
  const [passFail, setPassFail] = useState<TracePassFail | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const filter = useMemo<TraceListQuery>(() => ({
      ...(category === "ALL" ? {} : { category }),
      ...(entityId.trim() ? { entityId: entityId.trim() } : {}),
      ...(artifactRef.trim() ? { artifactRef: artifactRef.trim() } : {}),
      ...(clauseId.trim() ? { clauseId: clauseId.trim() } : {}),
      ...(passFail === "ALL" ? {} : { passFail }),
      ...(search.trim() ? { search: search.trim() } : {}),
    }), [artifactRef, category, clauseId, entityId, passFail, search]);
  const summaries = useMemo(() => {
    return query.list(filter);
  }, [filter, query]);
  const [selectedTraceId, setSelectedTraceId] = useState(initialTraceId ?? "");
  const effectiveTraceId = selectedTraceId && summaries.some((summary) => summary.traceId === selectedTraceId) ? selectedTraceId : summaries[0]?.traceId ?? "";
  const selected = effectiveTraceId ? query.get(effectiveTraceId) : undefined;

  return (
    <div className={styles.shell}>
      <Panel eyebrow="Trace / provenance" title="Inspect observable execution">
        <p className={styles.hint}>Follow inputs, selected clauses, tools, world events, assertions, and terminal status. This view never invents private reasoning.</p>
        <div className={styles.toolbar} aria-label="Trace filters">
          <label className={styles.field}>Category
            <select value={category} onChange={(event) => setCategory(event.target.value as TraceCategory | "ALL")}>
              <option value="ALL">All categories</option>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className={styles.field}>Pass / fail
            <select value={passFail} onChange={(event) => setPassFail(event.target.value as TracePassFail | "ALL")}>
              <option value="ALL">All outcomes</option><option value="PASS">Pass</option><option value="FAIL">Fail</option>
            </select>
          </label>
          <label className={styles.field}>Entity id
            <input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="gate.gamma" />
          </label>
          <label className={styles.field}>Artifact ref
            <input value={artifactRef} onChange={(event) => setArtifactRef(event.target.value)} placeholder="skill.feed@3" />
          </label>
          <label className={styles.field}>Clause id
            <input value={clauseId} onChange={(event) => setClauseId(event.target.value)} placeholder="verify.containment" />
          </label>
          <label className={styles.field}>Artifact / clause / text
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="missing postcondition" />
          </label>
        </div>
      </Panel>

      <div className={styles.workspace}>
        <Panel eyebrow="Saved runs" title={`${summaries.length} trace${summaries.length === 1 ? "" : "s"}`}>
          {summaries.length === 0 ? <p className={styles.hint}>No matching traces. Running traces appear here as soon as a producer begins recording.</p> : (
            <div className={styles.list} role="listbox" aria-label="Saved traces">
              {summaries.map((summary) => (
                <button
                  key={summary.traceId}
                  type="button"
                  role="option"
                  aria-selected={summary.traceId === effectiveTraceId}
                  className={`${styles.traceButton} ${summary.traceId === effectiveTraceId ? styles.traceButtonActive : ""}`}
                  onClick={() => setSelectedTraceId(summary.traceId)}
                >
                  <span className={styles.traceTitle}>{summary.jobId ?? summary.traceId}</span>
                  <span className={styles.traceMeta}>{summary.traceId} · {summary.eventCount} events</span>
                  <StatusBadge label={summary.status} status={statusTone(summary.status)} />
                </button>
              ))}
            </div>
          )}
        </Panel>

        <TraceDetail key={`${effectiveTraceId || "empty"}:${JSON.stringify(filter)}`} trace={selected} filter={filter} replay={replay} onReplay={onReplay} navigate={navigate} />
      </div>
    </div>
  );
}

function TraceDetail({ trace, filter, replay, onReplay, navigate }: { readonly trace?: TraceRecord; readonly filter: TraceListQuery; readonly replay: ReplayService | null; readonly onReplay?: (trace: TraceRecord) => void; readonly navigate?: (href: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [copied, setCopied] = useState(false);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);
  const [visualSpeed, setVisualSpeed] = useState<1 | 2 | 4>(1);
  const [visualPaused, setVisualPaused] = useState(true);
  const [replayEvents, setReplayEvents] = useState<readonly TraceEventRecord[]>([]);
  const [visualIndex, setVisualIndex] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const events = useMemo(() => filterTraceEvents(trace?.events ?? [], filter), [filter, trace]);
  const selectedEvent = events[selectedIndex];
  const clientHeight = 520;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 6);
  const end = Math.min(events.length, start + Math.ceil(clientHeight / ROW_HEIGHT) + 12);
  const visible = events.slice(start, end);
  const copyEvent = async () => {
    if (!selectedEvent) return;
    const data = JSON.stringify(selectedEvent, null, 2);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(data);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  useEffect(() => {
    if (visualPaused || replayEvents.length === 0 || visualIndex >= replayEvents.length - 1) return;
    const timer = window.setTimeout(() => setVisualIndex((current) => Math.min(replayEvents.length - 1, current + 1)), 800 / visualSpeed);
    return () => window.clearTimeout(timer);
  }, [replayEvents.length, visualIndex, visualPaused, visualSpeed]);
  const moveSelection = (direction: "next" | "previous" | "first" | "last") => {
    if (events.length === 0) return;
    setSelectedIndex((current) => {
      const next = direction === "next" ? Math.min(events.length - 1, current + 1) : direction === "previous" ? Math.max(0, current - 1) : direction === "first" ? 0 : events.length - 1;
      const top = Math.max(0, next * ROW_HEIGHT - ROW_HEIGHT * 3);
      scroller.current?.scrollTo({ top });
      setScrollTop(top);
      window.requestAnimationFrame(() => document.getElementById(`trace-event-${events[next]!.sequence}`)?.focus());
      return next;
    });
  };
  const runReplay = async () => {
    if (!trace) return;
    onReplay?.(trace);
    if (!replay || !trace.header.replayManifest) {
      setReplayStatus("Replay manifest unavailable");
      return;
    }
    setReplayStatus("Replaying isolated run…");
    const result = await replay.replay(trace.header.replayManifest, { paused: visualPaused, speed: visualSpeed, step: false });
    const visual = result.traceEvents ?? [];
    setReplayEvents(visual);
    setVisualIndex(visual.length > 0 ? 0 : -1);
    setVisualPaused(true);
    setReplayStatus(result.status === "EXACT" ? "EXACT · live park unchanged" : result.status === "DIVERGED" ? `DIVERGED · ${result.firstDifference?.message ?? "first difference unavailable"}` : `UNAVAILABLE · ${result.unavailableReason ?? "history unavailable"}`);
  };
  if (!trace) return <Panel eyebrow="Trace detail" title="Select a trace"><p className={styles.hint}>A trace timeline and terminal summary will appear when a saved run is selected.</p></Panel>;

  return (
    <Panel eyebrow="Trace detail" title={trace.header.traceId} className={styles.detail}>
      <div className={styles.timelineHeader}>
        <div>
          <p className={styles.eventMeta}>{trace.header.jobId ?? "Job unavailable"} · {events.length} shown of {trace.eventCount} events · logical {trace.header.startedAtLogicalTime}–{trace.updatedAtLogicalTime}</p>
          <p className={styles.eventMeta}>Pinned refs: {trace.header.artifactRefs.length > 0 ? trace.header.artifactRefs.map((ref) => `${ref.artifactId}@${ref.version}`).join(", ") : "none recorded"}</p>
        </div>
        <StatusBadge label={`${trace.status}${trace.terminalReason ? ` · ${trace.terminalReason}` : ""}`} status={statusTone(trace.status)} />
      </div>

      <div
        ref={scroller}
        className={styles.timelineScroller}
        role="listbox"
        aria-label="Trace event timeline"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className={styles.timelineTrack} style={{ height: `${events.length * ROW_HEIGHT}px` }}>
          {visible.map((event, offset) => {
            const index = start + offset;
            return (
              <button
                key={`${event.id}-${event.sequence}`}
                id={`trace-event-${event.sequence}`}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                aria-posinset={index + 1}
                aria-setsize={events.length}
                tabIndex={index === selectedIndex ? 0 : -1}
                className={`${styles.eventRow} ${index === selectedIndex ? styles.eventRowActive : ""}`}
                style={{ top: `${index * ROW_HEIGHT}px` }}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "ArrowDown") { keyboardEvent.preventDefault(); moveSelection("next"); }
                  else if (keyboardEvent.key === "ArrowUp") { keyboardEvent.preventDefault(); moveSelection("previous"); }
                  else if (keyboardEvent.key === "Home") { keyboardEvent.preventDefault(); moveSelection("first"); }
                  else if (keyboardEvent.key === "End") { keyboardEvent.preventDefault(); moveSelection("last"); }
                }}
              >
                <span className={styles.eventIndex}>#{event.sequence}</span>
                <span className={styles.eventType}>{event.category}</span>
                <span>{eventText(event)}</span>
                <span className={styles.eventBadge} aria-label={passLabel(event)}>{passLabel(event)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {events.length === 0 ? <p className={styles.hint} role="status">No events match the active timeline filters.</p> : null}

      <div className={styles.detailGrid} aria-label="Trace event fields">
        <dl className={styles.detailItem}><dt>Selected event</dt><dd>{selectedEvent ? `${selectedEvent.type} · logical ${selectedEvent.logicalTime}` : "None"}</dd></dl>
        <dl className={styles.detailItem}><dt>Observable entities</dt><dd>{selectedEvent?.entityRefs.join(", ") || "None recorded"}</dd></dl>
        <dl className={styles.detailItem}><dt>Clause</dt><dd>{selectedEvent?.clauseId ?? "Not applicable"}</dd></dl>
        <dl className={styles.detailItem}><dt>Integrity</dt><dd>{trace.canonicalEventHash} · {trace.canonicalHash}</dd></dl>
      </div>
      <div className={styles.linkRow}>
        {selectedEvent?.artifactRef ? <a href={`/engineering?artifact=${encodeURIComponent(selectedEvent.artifactRef.artifactId)}&version=${selectedEvent.artifactRef.version}`}>Open {selectedEvent.artifactRef.artifactId}@{selectedEvent.artifactRef.version}</a> : null}
        {selectedEvent?.entityRefs.map((entity) => {
          const href = parkEntityHref(entity);
          return <a key={entity} href={href} onClick={navigate ? (event) => { event.preventDefault(); navigate(href); } : undefined}>Inspect {entity}</a>;
        })}
        {(trace.contextSnapshot?.id ?? trace.header.contextSnapshotId) ? <a href={`/engineering?context=${encodeURIComponent(trace.contextSnapshot?.id ?? trace.header.contextSnapshotId ?? "")}`}>Open context {trace.contextSnapshot?.id ?? trace.header.contextSnapshotId}</a> : null}
        {selectedEvent ? <button type="button" className={styles.copyButton} onClick={() => void copyEvent()}>{copied ? "Copied" : "Copy event JSON"}</button> : null}
        {replay ? <button type="button" className={styles.copyButton} onClick={() => void runReplay()}>Replay pinned run</button> : null}
      </div>
      <div className={styles.linkRow} aria-label="Replay presentation controls">
        <button type="button" className={styles.copyButton} aria-pressed={visualPaused} onClick={() => setVisualPaused((paused) => !paused)}>{visualPaused ? "Resume view" : "Pause view"}</button>
        <button type="button" className={styles.copyButton} disabled={replayEvents.length === 0 || visualIndex >= replayEvents.length - 1} onClick={() => { setVisualPaused(true); setVisualIndex((current) => Math.min(replayEvents.length - 1, current + 1)); }}>Step</button>
        {[1, 2, 4].map((speed) => <button key={speed} type="button" className={styles.copyButton} aria-pressed={visualSpeed === speed} onClick={() => setVisualSpeed(speed as 1 | 2 | 4)}>{speed}× view</button>)}
        {replayStatus ? <span className={styles.eventMeta} role="status">{replayStatus}</span> : null}
      </div>
      {replayEvents.length > 0 ? <p className={styles.playback} role="status" aria-live="polite">Replay event {visualIndex + 1} of {replayEvents.length}: {replayEvents[visualIndex]?.type ?? "ready"}</p> : null}
      {selectedEvent ? <pre className={styles.code} aria-label="Selected event structured data">{JSON.stringify(selectedEvent, null, 2)}</pre> : null}
      {trace.outcome ? <pre className={styles.code} aria-label="Terminal outcome">{JSON.stringify(trace.outcome, null, 2)}</pre> : null}
    </Panel>
  );
}
