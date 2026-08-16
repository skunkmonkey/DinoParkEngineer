import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeConfig } from "../src/shell/config.ts";
import { collectFeatureModules, loadFeatureModules } from "../src/features/discovery.ts";
import { normalizeShellError } from "../src/shell/errors.ts";
import { createShellLifecycleController } from "../src/shell/lifecycle.ts";
import { createProviderComposer } from "../src/shell/providers.ts";
import { createFeatureRegistry } from "../src/shell/registry.ts";
import {
  applyBasePath,
  matchRoute,
  normalizeClientHref,
  pushBrowserNavigation,
  subscribeToBrowserNavigation,
  type BrowserNavigationPort,
} from "../src/shell/router.ts";
import { featureId, routeId } from "../src/shell/types.ts";
import type { FeatureModule, ProviderRegistration } from "../src/shell/types.ts";
import { fixtureLoadCounts, projectFixture, reportFixture } from "./fixtures/shell-features.ts";

const config = { buildId: "test", mode: "test" as const, basePath: "/" };

test("two public lazy feature fixtures support a direct nested parameterized route", async () => {
  const registry = createFeatureRegistry();
  assert.equal(registry.register(projectFixture).ok, true);
  assert.equal(registry.register(reportFixture).ok, true);
  assert.deepEqual(registry.listFeatures().map((feature) => feature.id), ["fixture-projects", "fixture-reports"]);
  assert.deepEqual(fixtureLoadCounts, { project: 0, report: 0 });
  const match = matchRoute(registry.listRoutes(), "/fixtures/projects/rex-7?tab=trace");
  assert.equal(match?.route.id, "fixture-project-detail");
  assert.equal(match?.params.projectId, "rex-7");
  assert.equal(match?.query.tab, "trace");
  await match?.route.load();
  assert.deepEqual(fixtureLoadCounts, { project: 1, report: 0 });
});

test("registry returns diagnostics for malformed modules, routes, and providers without throwing", () => {
  const registry = createFeatureRegistry();
  for (const candidate of [null, undefined, 42, { id: "bad-shape", routes: [null], providers: [null] }]) {
    assert.doesNotThrow(() => registry.register(candidate));
    const result = registry.register(candidate);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.every((entry) => typeof entry.code === "string" && typeof entry.summary === "string"));
  }
});

test("discovery preserves duplicate ids for stable registry diagnostics", () => {
  const duplicateA: FeatureModule = { id: featureId("duplicate-feature"), routes: [] };
  const duplicateB: FeatureModule = { id: featureId("duplicate-feature"), providers: [] };
  const discovered = collectFeatureModules([
    { order: "b/public.ts", exports: { duplicateB } },
    { order: "a/public.ts", exports: { duplicateA } },
  ]);
  assert.equal(discovered.length, 2);
  const registry = createFeatureRegistry();
  assert.equal(registry.register(discovered[0]).ok, true);
  const duplicate = registry.register(discovered[1]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error[0]?.code, "DUPLICATE_FEATURE");
});

test("feature discovery isolates a rejected public entry while siblings remain usable", async () => {
  const healthy: FeatureModule = { id: featureId("healthy-discovery"), routes: [] };
  const discovery = await loadFeatureModules({
    "../broken-feature/public.ts": async () => { throw new Error("private loader detail"); },
    "../healthy-feature/public.ts": async () => ({ healthy }),
  });
  assert.deepEqual(discovery.modules.map((feature) => feature.id), ["healthy-discovery"]);
  assert.equal(discovery.failures.length, 1);
  assert.equal(discovery.failures[0]?.diagnostic.code, "FEATURE_ENTRY_LOAD_FAILED");
  assert.equal(discovery.failures[0]?.featureId, "broken-feature");
  assert.doesNotMatch(JSON.stringify(discovery.failures), /private loader detail/);

  const registry = createFeatureRegistry();
  const failure = discovery.failures[0]!;
  registry.recordUnavailable(failure.featureId, failure.diagnostic);
  assert.equal(registry.registerBatch(discovery.modules)[0]?.ok, true);
  assert.deepEqual(registry.listFeatures().map(({ id, status }) => [id, status]), [
    ["broken-feature", "unavailable"],
    ["healthy-discovery", "registered"],
  ]);
});

test("batch registration resolves cross-feature provider dependencies independent of feature order", async () => {
  const events: string[] = [];
  const dependent: FeatureModule = {
    id: featureId("a-dependent-feature"),
    providers: [{ id: "dependent-provider", dependsOn: ["shared-provider"], create: ({ dependencies }) => {
      assert.equal(dependencies.get("shared-provider"), "shared");
      events.push("dependent");
      return "dependent";
    } }],
  };
  const dependency: FeatureModule = {
    id: featureId("z-shared-feature"),
    providers: [{ id: "shared-provider", create: () => { events.push("shared"); return "shared"; } }],
  };
  const registry = createFeatureRegistry();
  assert.ok(registry.registerBatch([dependent, dependency]).every((result) => result.ok));
  const initialized = await createProviderComposer(registry.listProviders(), config).initialize();
  assert.equal(initialized.ok, true);
  assert.deepEqual(events, ["shared", "dependent"]);
});

test("batch registration isolates cross-feature provider cycles from healthy siblings", () => {
  const registry = createFeatureRegistry();
  const results = registry.registerBatch([
    { id: featureId("cycle-left-feature"), providers: [{ id: "cycle-left", dependsOn: ["cycle-right"], create: () => ({}) }] },
    { id: featureId("healthy-batch-feature"), providers: [{ id: "healthy-batch", create: () => ({}) }] },
    { id: featureId("cycle-right-feature"), providers: [{ id: "cycle-right", dependsOn: ["cycle-left"], create: () => ({}) }] },
  ]);
  assert.equal(results[0]?.ok, false);
  assert.equal(results[1]?.ok, true);
  assert.equal(results[2]?.ok, false);
  assert.deepEqual(registry.listProviders().map((provider) => provider.id), ["healthy-batch"]);
});

test("batch planning removes phantom providers owned by rejected features", async () => {
  let invalidOwnerCalls = 0;
  let dependentCalls = 0;
  let healthyCalls = 0;
  const registry = createFeatureRegistry();
  const results = registry.registerBatch([
    {
      id: featureId("invalid-owner-feature"),
      routes: [{ id: routeId("invalid-owner-route"), path: "relative-path", load: async () => () => null }],
      providers: [{ id: "phantom-provider", create: () => { invalidOwnerCalls += 1; return {}; } }],
    },
    {
      id: featureId("dependent-consumer-feature"),
      providers: [{ id: "dependent-consumer", dependsOn: ["phantom-provider"], create: () => { dependentCalls += 1; return {}; } }],
    },
    {
      id: featureId("independent-healthy-feature"),
      providers: [{ id: "independent-healthy", create: () => { healthyCalls += 1; return {}; } }],
    },
  ]);
  assert.deepEqual(results.map((result) => result.ok), [false, false, true]);
  if (!results[1]?.ok) {
    assert.ok(results[1].error.some((entry) => entry.code === "MISSING_PROVIDER_DEPENDENCY"));
  }
  assert.deepEqual(registry.listProviders().map((provider) => provider.id), ["independent-healthy"]);
  const initialized = await createProviderComposer(registry.listProviders(), config).initialize();
  assert.equal(initialized.ok, true);
  assert.deepEqual({ invalidOwnerCalls, dependentCalls, healthyCalls }, {
    invalidOwnerCalls: 0,
    dependentCalls: 0,
    healthyCalls: 1,
  });
});

test("registry rejects invalid parents, missing providers, and non-terminal wildcards atomically", () => {
  const registry = createFeatureRegistry();
  const invalid = registry.register({
    id: featureId("broken-feature"),
    routes: [
      { id: routeId("broken-route"), path: "/stable/*rest/child", parentId: routeId("missing-parent"), load: async () => () => null },
    ],
    providers: [{ id: "broken-provider", dependsOn: ["missing-provider"], create: () => ({}) }],
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    const codes = invalid.error.map((entry) => entry.code);
    assert.ok(codes.includes("INVALID_ROUTE_PATH"));
    assert.ok(codes.includes("MISSING_PROVIDER_DEPENDENCY"));
  }
  assert.deepEqual(registry.listRoutes(), []);
  assert.deepEqual(registry.listProviders(), []);
});

test("registry accepts a terminal optional route parameter without treating it as a query", () => {
  const registry = createFeatureRegistry();
  assert.equal(registry.register({
    id: featureId("optional-route-feature"),
    routes: [{ id: routeId("optional-detail"), path: "/agents/:agentId?", load: async () => () => null }],
  }).ok, true);
  assert.equal(matchRoute(registry.listRoutes(), "/agents")?.route.id, "optional-detail");
  assert.equal(matchRoute(registry.listRoutes(), "/agents/rex")?.params.agentId, "rex");
});

test("registry deep-copies and freezes provider dependency declarations", () => {
  const dependencies = ["policy"];
  const registry = createFeatureRegistry();
  assert.equal(registry.register({
    id: featureId("provider-feature"),
    providers: [
      { id: "policy", create: () => "policy" },
      { id: "worker", dependsOn: dependencies, create: () => "worker" },
    ],
  }).ok, true);
  dependencies.push("late-mutation");
  const registered = registry.listProviders().find((provider) => provider.id === "worker");
  assert.deepEqual(registered?.dependsOn, ["policy"]);
  assert.throws(() => (registered?.dependsOn as string[]).push("mutate"));
});

test("basePath is honored for matching and browser navigation", () => {
  const routes = [{ id: routeId("detail"), path: "/park/:id", load: async () => () => null }];
  assert.equal(matchRoute(routes, "/game/park/rex?tab=trace", "/game")?.params.id, "rex");
  assert.equal(matchRoute(routes, "/park/rex", "/game"), null);
  assert.equal(normalizeClientHref("/game/park/rex?tab=trace", "/game"), "/park/rex?tab=trace");
  assert.equal(applyBasePath("/park/rex?tab=trace", "/game"), "/game/park/rex?tab=trace");
});

test("provider graph validation prevents every factory from executing", async () => {
  let factoryCalls = 0;
  const composer = createProviderComposer([
    { id: "a", dependsOn: ["b"], create: () => { factoryCalls += 1; return {}; } },
    { id: "b", dependsOn: ["a"], create: () => { factoryCalls += 1; return {}; } },
    { id: "independent", create: () => { factoryCalls += 1; return {}; } },
  ], config);
  const result = await composer.initialize();
  assert.equal(result.ok, false);
  assert.equal(factoryCalls, 0);
  assert.match(result.errors.map((error) => error.summary).join(" "), /cycle/i);
});

test("registration isolates a cyclic feature so unrelated sibling providers still start", async () => {
  let siblingCalls = 0;
  let cyclicCalls = 0;
  const registry = createFeatureRegistry();
  assert.equal(registry.register({
    id: featureId("healthy-feature"),
    providers: [{ id: "healthy", create: () => { siblingCalls += 1; return {}; } }],
  }).ok, true);
  const cyclic = registry.register({
    id: featureId("cyclic-feature"),
    providers: [
      { id: "cycle-a", dependsOn: ["cycle-b"], create: () => { cyclicCalls += 1; return {}; } },
      { id: "cycle-b", dependsOn: ["cycle-a"], create: () => { cyclicCalls += 1; return {}; } },
    ],
  });
  assert.equal(cyclic.ok, false);
  if (!cyclic.ok) assert.ok(cyclic.error.some((entry) => entry.code === "PROVIDER_DEPENDENCY_CYCLE"));
  const result = await createProviderComposer(registry.listProviders(), config).initialize();
  assert.equal(result.ok, true);
  assert.equal(siblingCalls, 1);
  assert.equal(cyclicCalls, 0);
});

test("provider disposal is reverse-stable and isolates sync and async failures", async () => {
  const events: string[] = [];
  const providers: ProviderRegistration[] = [
    { id: "policy", create: () => { events.push("create:policy"); return {}; }, dispose: async () => { events.push("dispose:policy"); throw new Error("private async detail"); } },
    { id: "worker", dependsOn: ["policy"], create: () => { events.push("create:worker"); return {}; }, dispose: () => { events.push("dispose:worker"); throw new Error("private sync detail"); } },
  ];
  const composer = createProviderComposer(providers, config);
  assert.equal((await composer.initialize()).ok, true);
  const disposed = await composer.dispose();
  assert.deepEqual(events, ["create:policy", "create:worker", "dispose:worker", "dispose:policy"]);
  assert.equal(disposed.errors.length, 2);
  assert.doesNotMatch(JSON.stringify(disposed.errors), /private (?:sync|async) detail/);
});

test("feature initialization cancels after cleanup and feature disposal continues in reverse order", async () => {
  const registry = createFeatureRegistry();
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const features: FeatureModule[] = [
    {
      id: featureId("alpha-feature"),
      initialize: async () => { events.push("start:alpha"); await firstGate; },
      dispose: () => { events.push("dispose:alpha"); throw new Error("hidden feature detail"); },
    },
    { id: featureId("beta-feature"), initialize: () => { events.push("start:beta"); }, dispose: () => { events.push("dispose:beta"); } },
  ];
  for (const feature of features) assert.equal(registry.register(feature).ok, true);
  const providers = createProviderComposer([], config);
  const lifecycle = createShellLifecycleController(features, registry, providers, config);
  const abort = new AbortController();
  const starting = lifecycle.start(abort.signal);
  await Promise.resolve();
  abort.abort();
  releaseFirst?.();
  await starting;
  const stopped = await lifecycle.stop();
  assert.deepEqual(events, ["start:alpha", "dispose:alpha"]);
  assert.equal(stopped.ok, true);
});

test("feature disposal runs all initialized features in reverse order after failures", async () => {
  const registry = createFeatureRegistry();
  const events: string[] = [];
  const features: FeatureModule[] = [
    { id: featureId("alpha-feature"), initialize: () => { events.push("start:alpha"); }, dispose: async () => { events.push("dispose:alpha"); } },
    { id: featureId("beta-feature"), initialize: () => { events.push("start:beta"); }, dispose: () => { events.push("dispose:beta"); throw new Error("hidden"); } },
  ];
  for (const feature of features) assert.equal(registry.register(feature).ok, true);
  const lifecycle = createShellLifecycleController(features, registry, createProviderComposer([], config), config);
  assert.equal((await lifecycle.start()).ok, true);
  const result = await lifecycle.stop();
  assert.deepEqual(events, ["start:alpha", "start:beta", "dispose:beta", "dispose:alpha"]);
  assert.equal(result.errors.length, 1);
  assert.doesNotMatch(JSON.stringify(result.errors), /hidden/);
});

test("lifecycle reinitializes honestly across start-stop-start remounts", async () => {
  const registry = createFeatureRegistry();
  const events: string[] = [];
  const feature: FeatureModule = {
    id: featureId("remount-feature"),
    initialize: () => { events.push("start:feature"); },
    dispose: () => { events.push("stop:feature"); },
  };
  assert.equal(registry.register(feature).ok, true);
  const provider = {
    id: "remount-provider",
    create: () => { events.push("start:provider"); return {}; },
    dispose: () => { events.push("stop:provider"); },
  };
  const composer = createProviderComposer([provider], config);
  const lifecycle = createShellLifecycleController([feature], registry, composer, config);
  assert.equal((await lifecycle.start()).ok, true);
  assert.equal(registry.listFeatures()[0]?.status, "ready");
  assert.equal((await lifecycle.stop()).ok, true);
  assert.equal(registry.listFeatures()[0]?.status, "stopped");
  assert.equal(composer.readiness()[0]?.status, "disposed");
  assert.equal((await lifecycle.start()).ok, true);
  assert.equal(registry.listFeatures()[0]?.status, "ready");
  assert.equal(composer.readiness()[0]?.status, "ready");
  await lifecycle.stop();
  assert.deepEqual(events, [
    "start:provider", "start:feature", "stop:feature", "stop:provider",
    "start:provider", "start:feature", "stop:feature", "stop:provider",
  ]);
});

test("popstate subscription tracks browser back and forward navigation", () => {
  const listeners = new Set<() => void>();
  const entries = ["/game/park", "/game/agents", "/game/evals"];
  let index = 0;
  const location = { pathname: entries[index]!, search: "", hash: "" };
  const browser: BrowserNavigationPort = {
    location,
    history: {
      pushState(_data: unknown, _unused: string, url?: string | URL | null) {
        const next = String(url ?? "/");
        entries.splice(index + 1, entries.length, next);
        index += 1;
        location.pathname = next;
      },
    },
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
  };
  const observed: string[] = [];
  const cleanup = subscribeToBrowserNavigation(browser, (href) => observed.push(href));
  pushBrowserNavigation(browser, "/agents", "/game");
  index -= 1;
  location.pathname = entries[index]!;
  for (const listener of listeners) listener();
  index += 1;
  location.pathname = entries[index]!;
  for (const listener of listeners) listener();
  cleanup();
  assert.deepEqual(observed, ["/game/park", "/game/agents"]);
  assert.equal(listeners.size, 0);
});

test("runtime configuration is actionable and thrown values are never rendered", () => {
  const invalid = parseRuntimeConfig({ buildId: "", mode: "production", basePath: "/" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "CONFIG_BUILD_ID_INVALID");
  const normalized = normalizeShellError(new Error("secret save contents"), { category: "startup", code: "SAFE", summary: "Safe summary", mode: "development" });
  assert.equal(normalized.summary, "Safe summary");
  assert.doesNotMatch(JSON.stringify(normalized), /secret save contents/);
});
