import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const templateRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("framed Finance route renders one main landmark and one main-content target", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: fileURLToPath(templateRoot),
    server: { middlewareMode: true },
  });
  try {
    const economy = await vite.ssrLoadModule("/src/economy-progression/public.ts");
    const platform = await vite.ssrLoadModule("/src/platform/ProductFrame.tsx");
    const navigate = () => undefined;
    const route = {
      id: "platform-progress",
      path: "/progress",
      title: "Finance / Progress",
      load: async () => economy.FinanceProgressRoute,
    };

    for (const service of [null, economy.createEconomyProgressionProvider()]) {
      economy.setActiveEconomyProgressionService(service);
      const html = renderToStaticMarkup(createElement(platform.ProductFrame, {
        destinationId: "progress",
        routeKey: route.id,
        navigate,
        heading: "Finance / Progress",
      }, createElement(economy.FinanceProgressRoute, { params: {}, query: {}, route, navigate })));
      assert.equal((html.match(/<main\b/g) ?? []).length, 1, "the frame must own the only main landmark");
      assert.equal((html.match(/\bid="main-content"/g) ?? []).length, 1, "the frame must own the only skip-link target");
      assert.match(html, /<section\b[^>]*aria-labelledby="finance-progress-(?:heading|unavailable-heading)"/);
    }
    economy.setActiveEconomyProgressionService(null);
  } finally {
    await vite.close();
  }
});

test("full production registerBatch hydrates every direct route without ownership cascades", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: fileURLToPath(templateRoot),
    server: { middlewareMode: true },
  });
  let composer;
  try {
    const shell = await vite.ssrLoadModule("/src/shell/public.ts");
    const publicEntries = await Promise.all([
      "/src/platform/public.ts",
      "/src/trace-replay/public.ts",
      "/src/curriculum-content/public.ts",
      "/src/economy-progression/public.ts",
      "/src/eval-runner/public.ts",
      "/src/review-deployment/public.ts",
      "/src/engineering-workbench/public.ts",
      "/src/park-operations/public.ts",
      "/src/orchestration/public.ts",
      "/src/persistence/public.ts",
    ].map((entry) => vite.ssrLoadModule(entry)));
    const modules = publicEntries.flatMap((entry) => Object.values(entry).filter((value) => value && typeof value === "object" && typeof value.id === "string" && (Array.isArray(value.routes) || Array.isArray(value.providers))));
    const registry = shell.createFeatureRegistry();
    const results = registry.registerBatch(modules);

    assert.equal(results.length, modules.length);
    assert.equal(results.every((result) => result.ok), true, JSON.stringify(results.filter((result) => !result.ok)));
    assert.deepEqual(registry.diagnostics(), []);
    assert.equal(registry.listFeatures().find((feature) => feature.id === "platform-foundation")?.status, "registered");
    assert.equal(registry.listProviders().some((provider) => provider.id === "platform-foundation.presentation"), true);

    const directRoutes = [
      ["Park", "/", "platform-park"],
      ["Agents", "/agents", "platform-agents"],
      ["Engineering", "/engineering", "engineering-workbench"],
      ["Evals", "/evals", "eval-runner-catalog"],
      ["Reviews", "/reviews", "review-deployment-reviews"],
      ["Progress", "/progress", "platform-progress"],
      ["Curriculum", "/curriculum", "curriculum-content"],
      ["Trace", "/traces/trace.release", "trace-replay-explorer"],
      ["Orchestration", "/orchestration", "orchestration-manager"],
      ["Save", "/save", "persistence-save"],
    ];
    for (const [label, href, expectedId] of directRoutes) {
      const match = shell.matchRoute(registry.listRoutes(), href);
      assert.ok(match, `${label} must resolve directly`);
      assert.equal(match.route.id, expectedId, `${label} must have one canonical owner`);
    }

    composer = shell.createProviderComposer(registry.listProviders(), { buildId: "release-registration-test", mode: "test", basePath: "/" });
    const hydrated = await composer.initialize();
    assert.equal(hydrated.ok, true, JSON.stringify(hydrated.errors));
    assert.equal(composer.readiness().every((provider) => provider.status === "ready"), true);
  } finally {
    await composer?.dispose();
    await vite.close();
  }
});

test("server-renders the foundation route loading state", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Dino Park Engineer<\/title>/i);
  assert.match(html, /<meta name="description" content="Engineer reliable AI agents while operating a deterministic automated dinosaur park\."/i);
  assert.match(html, /Loading route/);
  assert.match(html, /Preparing this feature boundary/);
  assert.doesNotMatch(html, /Ready for feature integration|No optional feature modules are registered yet|Shell diagnostics only/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("direct nested requests use the recoverable shell route", async () => {
  const response = await render("/unknown/route?tab=trace");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Dino Park Engineer/);
  assert.match(html, /Page not found|Loading route|Application Shell/);
});

test("production discovery composes the root into the product route instead of shell diagnostics", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: fileURLToPath(templateRoot),
    server: { middlewareMode: true },
  });
  try {
    const features = await vite.ssrLoadModule("/src/features/registration.ts");
    const shell = await vite.ssrLoadModule("/src/shell/public.ts");
    const discovery = await features.getFeatureDiscovery();
    const registry = shell.createFeatureRegistry();
    const results = registry.registerBatch(discovery.modules);
    assert.ok(results.some((result) => result.ok), "at least one production feature must register");
    const root = shell.matchRoute(registry.listRoutes(), "/");
    assert.ok(root, "hydrated production registration must own the root route");
    assert.equal(root.route.id, "platform-park");
    assert.notEqual(root.route.id, "shell-status");
    assert.doesNotMatch(root.route.title ?? "", /diagnostic|application shell/i);
    assert.equal(typeof await root.route.load(), "function", "the product root must resolve lazily");
  } finally {
    await vite.close();
  }
});

test("production worker directly serves a registered nested parameterized lazy route", async () => {
  const response = await render("/shell/status/features/platform-foundation?tab=route");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Loading route/);
  assert.doesNotMatch(html, /Page not found/);
});

test("the production shell chunk excludes the dynamically imported route component", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const javascriptFiles = (await readdir(clientAssets)).filter((file) => file.endsWith(".js"));
  const chunks = await Promise.all(
    javascriptFiles.map(async (file) => ({
      file,
      source: await readFile(new URL(file, clientAssets), "utf8"),
    })),
  );
  const routeChunks = chunks.filter(({ source }) => source.includes("Feature boundary ready"));
  assert.equal(routeChunks.length, 1, "the dynamic status route must have its own emitted chunk");

  const shellChunks = chunks.filter(({ source }) => source.includes("Preparing this feature boundary"));
  assert.ok(shellChunks.length >= 1, "the application shell chunk must be identifiable");
  for (const { file, source } of shellChunks) {
    assert.doesNotMatch(
      source,
      /Feature boundary ready/,
      `dynamic route implementation leaked into shell chunk ${file}`,
    );
    assert.doesNotMatch(
      source,
      /ProductFrame|dino-product-frame/,
      `product implementation leaked into shell chunk ${file}`,
    );
  }

  const namedShellChunk = chunks.find(({ file }) => /^ShellApp-.*\.js$/.test(file));
  assert.ok(namedShellChunk, "the build must emit a named ShellApp chunk");
  assert.doesNotMatch(namedShellChunk.source, /ProductFrame|dino-product-frame/);
});

test("production CSS contains every plain Foundation primitive class", async () => {
  const cssAssets = new URL("../dist/client/_next/static/css/", import.meta.url);
  const css = (await Promise.all(
    (await readdir(cssAssets)).filter((file) => file.endsWith(".css")).map((file) => readFile(new URL(file, cssAssets), "utf8")),
  )).join("\n");
  for (const className of [
    "foundation-eyebrow",
    "foundation-panel",
    "foundation-panel__header",
    "foundation-badge",
    "foundation-severity",
    "foundation-tabs",
    "foundation-meter",
    "foundation-meter__heading",
    "foundation-meter__track",
    "foundation-table-wrap",
    "foundation-table",
    "foundation-empty",
    "foundation-empty__mark",
    "foundation-controls",
    "foundation-controls__heading",
    "foundation-controls__buttons",
    "foundation-controls__hint",
    "foundation-controls__unavailable",
    "foundation-controls__error",
    "foundation-notifications",
    "foundation-notification",
    "foundation-notification__action",
    "foundation-icon-button",
    "foundation-dialog-backdrop",
    "foundation-dialog",
    "foundation-dialog__header",
    "foundation-drawer-backdrop",
    "foundation-drawer",
    "foundation-drawer__header",
    "foundation-feature-loading",
    "foundation-actions",
    "foundation-button",
  ]) {
    assert.match(css, new RegExp(`\\.${className}(?:[\\s,{:.]|$)`), `${className} must be emitted without a CSS Modules hash`);
  }
});

test("framed feature recovery keeps the product frame chunk mounted", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunks = await Promise.all(
    (await readdir(clientAssets)).filter((file) => file.endsWith(".js")).map(async (file) => ({ file, source: await readFile(new URL(file, clientAssets), "utf8") })),
  );
  const recovery = chunks.find(({ source }) => source.includes("Feature rendering failed"));
  const frame = chunks.find(({ source }) => source.includes("Operations console"));
  const simulationControls = chunks.find(({ source }) => source.includes("Simulation controls"));
  assert.ok(recovery, "the framed route recovery chunk must be emitted");
  assert.ok(frame, "the persistent product frame chunk must be emitted");
  assert.ok(simulationControls, "the simulation controls chunk must be emitted");
  assert.match(recovery.source, /Navigation and global controls remain available/);
  assert.match(recovery.source, /ProductFrame/);
  assert.match(frame.source, /Primary navigation/);
  assert.match(frame.source, /SimulationControls-/);
});

test("healthy production feature registrations require the persistent product frame", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunks = await Promise.all(
    (await readdir(clientAssets)).filter((file) => file.endsWith(".js")).map(async (file) => ({ file, source: await readFile(new URL(file, clientAssets), "utf8") })),
  );
  // Route content may legitimately link to these destinations. Identify the
  // registration owner by both its path and emitted lazy-route import marker.
  const financeRegistration = chunks.find(({ source }) => source.includes("path:`/progress`") && source.includes("/progress/economy") && source.includes("FinanceProgressRoute-"));
  const traceRegistration = chunks.find(({ source }) => source.includes("/traces/:traceId?") && source.includes("TraceReplayRoute-"));
  const financeContent = chunks.find(({ source }) => source.includes("Engineer the park economy"));
  const traceContent = chunks.find(({ file }) => /^TraceReplayRoute-.*\.js$/.test(file));
  assert.ok(financeRegistration, "the production Finance / Progress registration must be emitted");
  assert.ok(traceRegistration, "the production Trace Replay registration must be emitted");
  assert.ok(financeContent, "the healthy finance content chunk must remain lazy");
  assert.ok(traceContent, "the healthy trace content chunk must remain lazy");
  assert.match(financeRegistration.source, /destinationId:`progress`/);
  assert.match(financeRegistration.source, /id:`platform-progress`,path:`\/progress`/);
  assert.match(traceRegistration.source, /destinationId:`agents`/);
  assert.match(financeRegistration.source, /FinanceProgressRoute-/);
  assert.match(traceRegistration.source, /TraceReplayRoute-/);
});

test("production primary Park and Agents destinations are owned by Park Operations", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunks = await Promise.all(
    (await readdir(clientAssets)).filter((file) => file.endsWith(".js")).map(async (file) => ({ file, source: await readFile(new URL(file, clientAssets), "utf8") })),
  );
  const registration = chunks.find(({ source }) => source.includes("platform-park") && source.includes("/operations/park"));
  const parkContent = chunks.find(({ source }) => source.includes("Create feeding job") && source.includes("Pause after safe point"));
  const agentContent = chunks.find(({ source }) => source.includes("Loaded composition") && source.includes("Scoped memory"));

  assert.ok(registration, "the Park Operations module registrations must be emitted");
  assert.match(registration.source, /path:`\/`/);
  assert.match(registration.source, /path:`\/agents\/:agentId\?`/);
  assert.match(registration.source, /destinationId:`park`/);
  assert.match(registration.source, /destinationId:`agents`/);
  assert.ok(parkContent, "the production Park destination must load the Park Operations implementation");
  assert.ok(agentContent, "the production Agents destination must load the Agent Operations implementation");
  for (const marker of [
    "Queue filters",
    "Priority +1",
    "Cancel",
    "Issue emergency response",
    "Projected Context",
    "Dependencies:",
    "Required tools:",
    "Eligible workers:",
    "Keyboard-accessible entity list (same source as schematic)",
    "Current response",
    "Responsible job",
    "Posted costs",
  ]) assert.match(parkContent.source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${marker} must ship in the Park route`);
  assert.doesNotMatch(parkContent.source, /Ready for feature integration|Shell diagnostics only/);
  assert.doesNotMatch(agentContent.source, /Ready for feature integration|Shell diagnostics only/);

  const cssAssets = new URL("../dist/client/_next/static/css/", import.meta.url);
  const css = (await Promise.all(
    (await readdir(cssAssets)).filter((file) => file.endsWith(".css")).map((file) => readFile(new URL(file, cssAssets), "utf8")),
  )).join("\n");
  assert.match(css, /@media\s*\(max-width:1100px\).*park-operations-mobile-tabs/s, "tablet layout tabs must be emitted");
  assert.match(css, /@media\s*\(prefers-reduced-motion:reduce\).*park-operations/s, "reduced-motion rules must be emitted");
});

test("production Manager UI exposes attainable change control and assignment explanations", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunks = await Promise.all(
    (await readdir(clientAssets)).filter((file) => file.endsWith(".js")).map(async (file) => ({ file, source: await readFile(new URL(file, clientAssets), "utf8") })),
  );
  const manager = chunks.find(({ source }) => source.includes("Manager change control") && source.includes("Manager assignment explanations"));
  assert.ok(manager, "the production Manager route must emit its live orchestration surface");
  for (const marker of [
    "Open Manager review / evaluate / deploy",
    "Run deterministic Manager evaluation",
    "Deploy evaluated Manager config",
    "Priority class / policy",
    "Tie-break / rejection",
    "Eligibility facts",
    "Context policy / blockers",
    "Admitted by Manager authority",
  ]) assert.match(manager.source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${marker} must ship in the Manager route`);
});

test("production Curriculum UI ships the gated playable engineering loop", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunks = await Promise.all(
    (await readdir(clientAssets)).filter((file) => file.endsWith(".js")).map(async (file) => ({ file, source: await readFile(new URL(file, clientAssets), "utf8") })),
  );
  const curriculum = chunks.find(({ source }) => source.includes("Accept and run unsafe Rex job") && source.includes("Rerun same production Rex job and replay"));
  assert.ok(curriculum, "the production /curriculum route must emit its playable workflow");
  for (const marker of [
    "Inspect missing postcondition",
    "Commission safe-feeding Skill",
    "Inspect review and select three Evals",
    "Build three starter Evals",
    "Run intentional v1 failure",
    "Revise with gate-jam escalation",
    "Rerun revised suite",
    "Deploy exact passing revision",
    "Context Minimizer",
    "Simulated interventions",
    "Open Park",
    "Production incident",
    "Diagnose stale and conflicting memory",
    "Run coordinated worker simulation",
    "Evaluate authored Manager configuration",
    "Compare scaled intervention runs",
  ]) assert.match(curriculum.source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${marker} must ship in the Curriculum route`);
  assert.doesNotMatch(curriculum.source, /["'`]\/park["'`]/, "the Curriculum Park control must target the canonical / route");
});

test("failing production framed routes retain navigation and global-control recovery", async () => {
  const clientAssets = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunks = await Promise.all(
    (await readdir(clientAssets)).filter((file) => file.endsWith(".js")).map(async (file) => ({ file, source: await readFile(new URL(file, clientAssets), "utf8") })),
  );
  const recovery = chunks.find(({ source }) => source.includes("This feature could not be loaded inside the product frame"));
  const recoveryView = chunks.find(({ source }) => source.includes("Feature unavailable"));
  const frame = chunks.find(({ source }) => source.includes("Operations console"));
  const controls = chunks.find(({ source }) => source.includes("Simulation controls"));
  assert.ok(recovery, "load failures must emit an in-frame recovery state");
  assert.ok(recoveryView, "load failures must emit recovery actions inside the frame");
  assert.ok(frame, "load failures must retain the ProductFrame chunk");
  assert.ok(controls, "load failures must retain the global simulation-control chunk");
  assert.match(recoveryView.source, /Feature unavailable/);
  assert.match(recoveryView.source, /Return to Park/);
  assert.match(recoveryView.source, /ProductFrame/);
  assert.match(frame.source, /Primary navigation/);
  assert.match(frame.source, /SimulationControls-/);
});

test("the starter preview scaffold is removed", async () => {
  await assert.deepEqual(await readdir(new URL("app/_sites-preview", templateRoot)), []);
});
