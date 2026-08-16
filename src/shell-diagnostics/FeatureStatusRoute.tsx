"use client";

import type { ShellRouteProps } from "../shell/public.ts";

export function FeatureStatusRoute({ params, navigate }: ShellRouteProps) {
  const requestedFeature = params.featureId;
  return (
    <main className="shell-state" aria-labelledby="shell-feature-status-heading">
      <p className="shell-kicker">Application Shell</p>
      <h1 id="shell-feature-status-heading">Feature boundary ready</h1>
      <p>
        {requestedFeature
          ? `The route boundary for “${requestedFeature}” resolved successfully.`
          : "The nested route boundary is available for feature diagnostics."}
      </p>
      <div className="shell-actions">
        <button className="shell-button" type="button" onClick={() => navigate("/")}>Return home</button>
      </div>
    </main>
  );
}
