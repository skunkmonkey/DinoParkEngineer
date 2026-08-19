import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BootSurface,
  FailureSurface,
  NotFoundSurface,
  OfflineStatus,
  OptionalFeatureFailureSurface,
  UnsupportedBrowserSurface,
} from "../../src/app-shell.js";

const noop = (): void => undefined;

test("boot and unsupported states always render meaningful accessible content", () => {
  const boot = renderToStaticMarkup(<BootSurface />);
  assert.match(boot, /aria-busy="true"/u);
  assert.match(boot, /Dino Park Engineer/u);

  const unsupported = renderToStaticMarkup(<UnsupportedBrowserSurface />);
  assert.match(unsupported, /SHELL_BROWSER_UNSUPPORTED/u);
  assert.match(unsupported, /<button/u);
});

test("required, optional, and not-found failures expose keyboard recovery actions", () => {
  const required = renderToStaticMarkup(
    <FailureSurface
      code="SHELL_CONFIGURATION_INVALID"
      title="Configuration invalid"
      message="Startup remained safe."
      onRetry={noop}
      onSafeRoute={noop}
    />,
  );
  assert.match(required, /Retry startup/u);
  assert.match(required, /Return to Park View/u);
  assert.match(required, /No authoritative park state was changed/u);

  const optional = renderToStaticMarkup(
    <OptionalFeatureFailureSurface
      code="SHELL_OPTIONAL_FEATURE_FAILED"
      title="Optional feature unavailable"
      message="Sibling routes remain available."
      onRetry={noop}
      onSafeRoute={noop}
    />,
  );
  assert.match(optional, /Retry feature/u);
  assert.match(optional, /SHELL_OPTIONAL_FEATURE_FAILED/u);

  const notFound = renderToStaticMarkup(
    <NotFoundSurface pathname="/missing" onSafeRoute={noop} />,
  );
  assert.match(notFound, /Route not found/u);
  assert.match(notFound, /Return to Park View/u);
});

test("offline-ready and update-ready states have persistent textual status", () => {
  const ready = renderToStaticMarkup(
    <OfflineStatus state={{ state: "offline-ready", version: "build-1" }} />,
  );
  assert.match(ready, /role="status"/u);
  assert.match(ready, /offline-ready/u);

  const update = renderToStaticMarkup(
    <OfflineStatus
      state={{
        state: "update-ready",
        currentVersion: "build-1",
        availableVersion: "build-2",
      }}
    />,
  );
  assert.match(update, /update-ready/u);
});
