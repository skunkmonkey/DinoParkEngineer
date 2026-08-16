import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const projectRoot = new URL("../", import.meta.url);

test("production frame binds privacy controls to active telemetry queue diagnostics", async () => {
  const vite = await createServer({ appType: "custom", configFile: false, logLevel: "silent", root: fileURLToPath(projectRoot), server: { middlewareMode: true } });
  try {
    const telemetry = await vite.ssrLoadModule("/src/telemetry/public.ts");
    const platform = await vite.ssrLoadModule("/src/platform/ProductFrame.tsx");
    const client = new telemetry.TelemetryClient({ delivery: { send: async () => ({ acceptedIds: [] }) }, queue: { retryBaseMs: 10_000 } });
    client.emit("JOB_OUTCOME", { status: "SUCCEEDED", jobId: "job.privacy" }, { logicalTime: 1 });
    telemetry.setActiveTelemetryClient(client);
    const html = renderToStaticMarkup(createElement(platform.ProductFrame, { destinationId: "park", routeKey: "park", navigate() {} }));
    assert.match(html, /Privacy-conscious telemetry/);
    assert.match(html, /Allow optional learning analytics/);
    assert.match(html, /Pending local analytics: 1/);
    assert.match(html, /Inspect pending analytics/);
    assert.match(html, /Clear pending analytics/);
    assert.match(html, /Never collected:/);
    telemetry.setActiveTelemetryClient(undefined);
  } finally {
    await vite.close();
  }
});

test("privacy panel actions are wired to active queue inspection and clearing", async () => {
  const frame = await readFile(new URL("src/platform/ProductFrame.tsx", projectRoot), "utf8");
  assert.match(frame, /pendingCount=\{telemetryPendingCount\}/);
  assert.match(frame, /onInspectQueue=\{\(\) => \{/);
  assert.match(frame, /telemetry\.inspectQueue\(\)/);
  assert.match(frame, /onClearQueue=\{\(\) => \{/);
  assert.match(frame, /telemetry\.clearQueue\(\)/);
  assert.match(frame, /telemetry\.subscribe\(refresh\)/);
});
