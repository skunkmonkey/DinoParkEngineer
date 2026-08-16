"use client";

import { TELEMETRY_DISCLOSURE } from "../../telemetry/index.ts";

export interface TelemetryPrivacyPanelProps {
  readonly enabled: boolean;
  readonly onEnabledChange: (enabled: boolean) => void;
  readonly pendingCount?: number;
  readonly onInspectQueue?: () => void;
  readonly onClearQueue?: () => void;
  readonly inspectedEvents?: readonly { readonly eventId: string; readonly type: string; readonly logicalTime: number }[];
}

/**
 * Small, embeddable privacy disclosure/control. It intentionally receives the
 * current consent state and callbacks from the owning shell; it does not own a
 * telemetry client or read gameplay state.
 */
export function TelemetryPrivacyPanel({ enabled, onEnabledChange, pendingCount = 0, onInspectQueue, onClearQueue, inspectedEvents }: TelemetryPrivacyPanelProps) {
  return (
    <section aria-labelledby="telemetry-privacy-heading">
      <h2 id="telemetry-privacy-heading">{TELEMETRY_DISCLOSURE.title}</h2>
      <p>Optional analytics help balance the park and validate learning. Turning them off never changes simulation, saves, progression, or offline play.</p>
      <label>
        <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
        <span>Allow optional learning analytics</span>
      </label>
      <details>
        <summary>What is collected</summary>
        <ul>{TELEMETRY_DISCLOSURE.collected.map((item) => <li key={item}>{item}</li>)}</ul>
        <p>Never collected:</p>
        <ul>{TELEMETRY_DISCLOSURE.excluded.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>
      <p aria-live="polite">Pending local analytics: {pendingCount}</p>
      {onInspectQueue ? <button type="button" onClick={onInspectQueue}>Inspect pending analytics</button> : null}{" "}
      {onClearQueue ? <button type="button" onClick={onClearQueue}>Clear pending analytics</button> : null}
      {inspectedEvents ? (
        <div aria-live="polite" aria-label="Pending analytics inspection">
          {inspectedEvents.length === 0 ? <p>Pending analytics queue is empty.</p> : (
            <ul>{inspectedEvents.map((event) => <li key={event.eventId}>{event.type} · logical time {event.logicalTime} · {event.eventId}</li>)}</ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
