import type { ShellFallbackProps } from "./types.ts";

export function ShellFallback({ title, summary, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }: ShellFallbackProps) {
  return (
    <main className="shell-state" aria-labelledby="shell-state-heading">
      <div className="shell-state__mark" aria-hidden="true">!</div>
      <p className="shell-kicker">Application Shell</p>
      <h1 id="shell-state-heading">{title}</h1>
      <p>{summary}</p>
      <div className="shell-actions">
        {actionLabel && onAction ? (
          <button type="button" className="shell-button" onClick={onAction}>{actionLabel}</button>
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <button type="button" className="shell-button shell-button--secondary" onClick={onSecondaryAction}>{secondaryActionLabel}</button>
        ) : null}
      </div>
    </main>
  );
}

export function ShellLoading() {
  return (
    <main className="shell-state" aria-labelledby="shell-loading-heading" aria-busy="true">
      <div className="shell-state__mark shell-state__mark--loading" aria-hidden="true" />
      <p className="shell-kicker">Application Shell</p>
      <h1 id="shell-loading-heading">Loading route</h1>
      <p>Preparing this feature boundary.</p>
    </main>
  );
}
