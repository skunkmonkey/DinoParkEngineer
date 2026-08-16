"use client";

import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { NotificationMessage, PanelProps } from "../platform/types.ts";
import { SEVERITY_PRESENTATIONS, STATUS_PRESENTATIONS, type SemanticStatus } from "./status.ts";
import { nextTabIndex, trappedFocusIndex, type TabNavigationKey } from "./interaction.ts";
import { invokeNotificationAction } from "./notifications.ts";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function useModalFocus(open: boolean, onClose: () => void) {
  const surfaceRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = surfaceRef.current;
    if (!surface) return;
    const focusable = () => [...surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => !element.hidden);
    (focusable()[0] ?? surface).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const candidates = focusable();
      const current = candidates.indexOf(document.activeElement as HTMLElement);
      const next = trappedFocusIndex(current, candidates.length, event.shiftKey);
      if (next < 0) return;
      if ((event.shiftKey && current <= 0) || (!event.shiftKey && current >= candidates.length - 1)) {
        event.preventDefault();
        candidates[next]?.focus();
      }
    };
    surface.addEventListener("keydown", handleKeyDown);
    return () => {
      surface.removeEventListener("keydown", handleKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  return surfaceRef;
}

export function Panel({ children, title, eyebrow, className = "" }: PanelProps) {
  return (
    <section className={`foundation-panel ${className}`.trim()}>
      {eyebrow || title ? (
        <header className="foundation-panel__header">
          <div>
            {eyebrow ? <p className="foundation-eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  idPrefix,
}: {
  readonly tabs: readonly { id: string; label: string }[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly idPrefix?: string;
}) {
  const generatedId = useId().replace(/:/g, "");
  const baseId = idPrefix ?? `foundation-tabs-${generatedId}`;
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = nextTabIndex(currentIndex, tabs.length, event.key as TabNavigationKey);
    const next = tabs[nextIndex];
    if (!next) return;
    onChange(next.id);
    buttonRefs.current.get(next.id)?.focus();
  };
  return (
    <div className="foundation-tabs" role="tablist" aria-label="View tabs">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => { if (element) buttonRefs.current.set(tab.id, element); else buttonRefs.current.delete(tab.id); }}
          type="button"
          role="tab"
          id={`${baseId}-${tab.id}-tab`}
          aria-controls={`${baseId}-${tab.id}-panel`}
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          className={tab.id === value ? "is-active" : ""}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix, tabId, active, children }: { readonly idPrefix: string; readonly tabId: string; readonly active: boolean; readonly children: ReactNode }) {
  return <div role="tabpanel" id={`${idPrefix}-${tabId}-panel`} aria-labelledby={`${idPrefix}-${tabId}-tab`} tabIndex={0} hidden={!active}>{children}</div>;
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const generatedId = useId().replace(/:/g, "");
  const titleId = `foundation-drawer-title-${generatedId}`;
  const surfaceRef = useModalFocus(open, onClose);
  if (!open) return null;
  return (
    <div className="foundation-drawer-backdrop" role="presentation">
      <aside
        ref={surfaceRef}
        className="foundation-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="foundation-drawer__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="foundation-icon-button" onClick={onClose} aria-label={`Close ${title}`}>
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const generatedId = useId().replace(/:/g, "");
  const titleId = `foundation-dialog-title-${generatedId}`;
  const surfaceRef = useModalFocus(open, onClose);
  if (!open) return null;
  return (
    <div className="foundation-dialog-backdrop" role="presentation">
      <section ref={surfaceRef} className="foundation-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="foundation-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="foundation-icon-button" onClick={onClose} aria-label={`Close ${title}`}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  readonly caption: string;
  readonly columns: readonly { id: string; label: string }[];
  readonly rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div className="foundation-table-wrap">
      <table className="foundation-table">
        <caption>{caption}</caption>
        <thead><tr>{columns.map((column) => <th key={column.id} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Meter({ label, value, max, detail }: { readonly label: string; readonly value: number; readonly max: number; readonly detail?: string }) {
  const percentage = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return (
    <div className="foundation-meter">
      <div className="foundation-meter__heading"><span>{label}</span><strong>{detail ?? `${Math.round(percentage)}%`}</strong></div>
      <div className="foundation-meter__track" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({ label, status = "neutral" }: { readonly label: string; readonly status?: "neutral" | "success" | "warning" | "error" | "pending" }) {
  return <span className={`foundation-badge foundation-badge--${status}`}><span aria-hidden="true">{status === "success" ? "✓" : status === "error" ? "!" : status === "warning" ? "△" : status === "pending" ? "…" : "•"}</span>{label}</span>;
}

export function SeverityBadge({ severity }: { readonly severity: 0 | 1 | 2 | 3 | 4 }) {
  const presentation = SEVERITY_PRESENTATIONS[severity];
  return <span className={`foundation-badge foundation-severity foundation-severity--${severity}`}><span aria-hidden="true">{presentation.symbol}</span>{presentation.symbol} · {presentation.label}</span>;
}

export function SemanticStatusBadge({ status }: { readonly status: SemanticStatus }) {
  const presentation = STATUS_PRESENTATIONS[status];
  return <StatusBadge label={`${presentation.symbol} ${presentation.label}`} status={presentation.tone} />;
}

export function EmptyState({ title, summary, action }: { readonly title: string; readonly summary: string; readonly action?: ReactNode }) {
  return <div className="foundation-empty"><p className="foundation-empty__mark" aria-hidden="true">○</p><h3>{title}</h3><p>{summary}</p>{action}</div>;
}

export function ErrorState({ title, summary, action }: { readonly title: string; readonly summary: string; readonly action?: ReactNode }) {
  return <div className="foundation-empty foundation-empty--error"><p className="foundation-empty__mark" aria-hidden="true">!</p><h3>{title}</h3><p>{summary}</p>{action}</div>;
}

export function NotificationRegion({ notifications, onDismiss }: { readonly notifications: readonly NotificationMessage[]; readonly onDismiss?: (id: string) => void }) {
  return (
    <section className="foundation-notifications" aria-label="Notifications" aria-live="polite">
      {notifications.map((notification) => (
        <div key={notification.id} className={`foundation-notification foundation-notification--${notification.level}`}>
          <div><StatusBadge label={notification.level} status={notification.level === "info" ? "neutral" : notification.level} /><strong>{notification.title}</strong>{notification.detail ? <p>{notification.detail}</p> : null}{notification.action ? <button type="button" className="foundation-notification__action" onClick={() => { if (notification.action) void invokeNotificationAction(notification.action); }}>{notification.action.label}</button> : null}</div>
          {onDismiss ? <button type="button" className="foundation-icon-button" onClick={() => onDismiss(notification.id)} aria-label={`Dismiss ${notification.title}`}>×</button> : null}
        </div>
      ))}
    </section>
  );
}
