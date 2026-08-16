import type { FeatureReadiness, PublicRuntimeConfig, ShellError } from "./types.ts";

export interface DiagnosticHomeProps {
  readonly config: PublicRuntimeConfig;
  readonly features: readonly FeatureReadiness[];
  readonly errors: readonly ShellError[];
}

function readinessLabel(feature: FeatureReadiness): string {
  if (feature.status === "ready") return "Ready";
  if (feature.status === "initializing") return "Starting";
  if (feature.status === "stopped") return "Stopped";
  if (feature.status === "failed") return "Degraded";
  if (feature.status === "unavailable") return "Unavailable";
  return "Registered";
}

export function DiagnosticHome({ config, features, errors }: DiagnosticHomeProps) {
  return (
    <main className="shell-diagnostic" aria-labelledby="shell-heading">
      <header className="shell-diagnostic__header">
        <p className="shell-kicker">Application Shell</p>
        <h1 id="shell-heading">Dino Park Engineer</h1>
        <p className="shell-lede">
          The application shell is running. Product features can register their
          own routes and providers through the public contract.
        </p>
      </header>

      <section className="shell-card" aria-labelledby="shell-status-heading">
        <div className="shell-card__heading">
          <div>
            <p className="shell-label">Runtime status</p>
            <h2 id="shell-status-heading">Ready for feature integration</h2>
          </div>
          <span className="shell-status" role="status">
            {errors.length > 0 ? "Needs attention" : "Healthy"}
          </span>
        </div>
        <dl className="shell-facts">
          <div>
            <dt>Build</dt>
            <dd>{config.buildId}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{config.mode}</dd>
          </div>
          <div>
            <dt>Registered features</dt>
            <dd>{features.length}</dd>
          </div>
        </dl>
      </section>

      <section className="shell-card" aria-labelledby="shell-features-heading">
        <div className="shell-card__heading">
          <div>
            <p className="shell-label">Extension registry</p>
            <h2 id="shell-features-heading">Feature readiness</h2>
          </div>
        </div>
        {features.length === 0 ? (
          <p className="shell-muted">No optional feature modules are registered yet.</p>
        ) : (
          <ul className="shell-feature-list">
            {features.map((feature) => (
              <li key={feature.id}>
                <span>
                  <strong>{feature.id}</strong>
                  <small>
                    {feature.routeCount} route{feature.routeCount === 1 ? "" : "s"} · {feature.providerCount} provider{feature.providerCount === 1 ? "" : "s"}
                  </small>
                </span>
                <span className={`shell-feature-state shell-feature-state--${feature.status}`}>
                  {readinessLabel(feature)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {errors.length > 0 ? (
        <section className="shell-card shell-card--warning" aria-labelledby="shell-errors-heading">
          <div className="shell-card__heading">
            <div>
              <p className="shell-label">Recovery summary</p>
              <h2 id="shell-errors-heading">Some optional capabilities are unavailable</h2>
            </div>
          </div>
          <ul className="shell-error-list" role="alert">
            {errors.map((error, index) => (
              <li key={`${error.code}-${error.featureId ?? "shell"}-${index}`}>
                <strong>{error.code}</strong>
                <span>{error.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="shell-footer">
        <span>Shell diagnostics only</span>
        <span aria-hidden="true">·</span>
        <span>No game state is loaded</span>
      </footer>
    </main>
  );
}
