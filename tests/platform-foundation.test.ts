import assert from "node:assert/strict";
import test from "node:test";
import { createFeatureRegistry, featureId, routeId } from "../src/shell/public.ts";
import { FOUNDATION_ROUTE_DEFINITIONS, createFoundationRouteRegistrations } from "../src/platform/contract.ts";
import { PRIMARY_DESTINATIONS } from "../src/platform/destinations.ts";
import { createPresentationRegistry } from "../src/platform/presentationRegistry.ts";
import { CANONICAL_GLOSSARY } from "../src/platform/glossary.ts";
import { platformFoundationModule } from "../src/platform/module.ts";
import { createFramedRouteRegistration } from "../src/platform/framedRoute.ts";
import { resolveFramedRouteContent } from "../src/platform/framedRouteModel.ts";
import { executeSimulationRequest, resolveSimulationPort } from "../src/platform/simulationControlModel.ts";
import { formatContextUnits, formatCredits, formatGameTime, formatSeverity, formatStableId } from "../src/shared/formatters/game.ts";
import { nextTabIndex, trappedFocusIndex } from "../src/ui/interaction.ts";
import { invokeNotificationAction } from "../src/ui/notifications.ts";
import { SEVERITY_PRESENTATIONS, STATUS_PRESENTATIONS } from "../src/ui/status.ts";

test("defines six canonical destinations for lazy shell registration", () => {
  assert.equal(FOUNDATION_ROUTE_DEFINITIONS.length, 6);
  assert.deepEqual(FOUNDATION_ROUTE_DEFINITIONS.map((route) => route.path), ["/", "/agents", "/engineering", "/evals", "/reviews", "/progress"]);
  assert.deepEqual(PRIMARY_DESTINATIONS.map((destination) => destination.label), ["Park", "Agents", "Engineering", "Evals", "Reviews", "Finance / Progress"]);
});

test("production Platform keeps presentation ownership without placeholder routes", () => {
  assert.deepEqual(platformFoundationModule.routes, []);
  assert.equal(platformFoundationModule.providers?.some((provider) => provider.id === "platform-foundation.presentation"), true);
});

test("mounts with two sibling features through public shell contracts", async () => {
  const registry = createFeatureRegistry();
  const routeComponent = () => null;
  const foundation = {
    id: featureId("platform-foundation-test"),
    routes: createFoundationRouteRegistrations(async () => routeComponent),
  };
  const healthySibling = {
    id: featureId("healthy-sibling"),
    routes: [{ id: routeId("healthy-route"), path: "/healthy", load: async () => routeComponent }],
  };
  const failingContentLoad = async () => { throw new Error("deliberate route failure"); };
  const failingSibling = {
    id: featureId("failing-sibling"),
    routes: [createFramedRouteRegistration({ id: "failing-route", path: "/failing", title: "Failing route", destinationId: "engineering", load: failingContentLoad })],
  };
  assert.equal(registry.register(foundation).ok, true);
  assert.equal(registry.register(healthySibling).ok, true);
  assert.equal(registry.register(failingSibling).ok, true);
  assert.equal(registry.listRoutes().length, 8);
  assert.equal(registry.listRoutes().some((route) => route.path === "/"), true);
  assert.equal(registry.listRoutes().some((route) => route.path === "/healthy"), true);
  assert.equal(typeof registry.listRoutes().find((route) => route.path === "/failing")!.load, "function");
  assert.deepEqual(await resolveFramedRouteContent(failingContentLoad), { ok: false, message: "This feature could not be loaded inside the product frame." });
  assert.equal(registry.listRoutes().filter((route) => route.path.startsWith("/healthy") || route.path === "/").length, 2);
});

test("presentation registry publishes notifications and cleans up subscriptions", () => {
  const registry = createPresentationRegistry();
  let updates = 0;
  const unsubscribe = registry.subscribe(() => { updates += 1; });
  registry.publish({ id: "welcome", level: "info", title: "Ready" });
  assert.equal(registry.getNotifications()[0]?.title, "Ready");
  assert.equal(updates, 1);
  unsubscribe();
  registry.publish({ id: "welcome", level: "success", title: "Connected" });
  assert.equal(updates, 1);
  assert.equal(registry.getNotifications()[0]?.level, "success");
});

test("simulation control port remains optional and reflects provider-confirmed state", async () => {
  const registry = createPresentationRegistry();
  assert.equal(registry.getSimulationControlPort(), null);
  let state = { paused: false, speed: 1 as 1 | 2 | 4 };
  const port = {
    getState: () => state,
    setPaused: (paused: boolean) => { state = { ...state, paused }; },
    setSpeed: (speed: 1 | 2 | 4) => { state = { ...state, speed }; },
    subscribe: () => () => undefined,
  };
  registry.setSimulationControlPort(port);
  assert.equal(registry.getSimulationControlPort()?.getState().speed, 1);
  await registry.getSimulationControlPort()?.setSpeed(4);
  assert.equal(registry.getSimulationControlPort()?.getState().speed, 4);
  assert.equal(resolveSimulationPort(undefined, port), port);
  assert.equal(resolveSimulationPort(null, port), null);
  const failed = await executeSimulationRequest(port, () => { throw new Error("provider rejected request"); });
  assert.equal(failed.ok, false);
  assert.match(failed.ok ? "" : failed.message, /rejected/i);
  assert.deepEqual(failed.state, { paused: false, speed: 4 });
});

test("formatters are pure, locale-explicit presentation helpers", () => {
  assert.equal(formatGameTime(3542, "en-US"), "Day 1 · 00:59:02");
  assert.equal(formatContextUnits(5200, "en-US"), "5.2k CU");
  assert.equal(formatContextUnits(1000, "en-US"), "1.0k CU");
  assert.equal(formatCredits(12480, "en-US"), "12,480 cr");
  assert.equal(formatStableId("platform-foundation-presentation", 16), "platform-founda…");
  assert.equal(formatSeverity(3), "Containment incident");
});

test("tabs and focus traps wrap predictably for keyboard use", () => {
  assert.equal(nextTabIndex(0, 3, "ArrowLeft"), 2);
  assert.equal(nextTabIndex(2, 3, "ArrowRight"), 0);
  assert.equal(nextTabIndex(1, 3, "Home"), 0);
  assert.equal(nextTabIndex(1, 3, "End"), 2);
  assert.equal(trappedFocusIndex(0, 3, true), 2);
  assert.equal(trappedFocusIndex(2, 3, false), 0);
});

test("notification recovery actions are invoked and failures are contained", async () => {
  let calls = 0;
  assert.equal(await invokeNotificationAction({ id: "retry", label: "Retry", run: () => { calls += 1; } }), true);
  assert.equal(calls, 1);
  assert.equal(await invokeNotificationAction({ id: "retry-failed", label: "Retry", run: () => { throw new Error("still unavailable"); } }), false);
});

test("glossary includes every canonical application term", () => {
  assert.deepEqual(CANONICAL_GLOSSARY.map((entry) => entry.term), [
    "Prompt", "Skill", "System Prompt", "Context", "Context Budget", "Memory", "Tool", "Eval", "Eval Suite", "Agent", "Manager Agent", "Orchestration", "Trace", "Deploy",
  ]);
});

test("critical states always expose text and symbols in addition to color", () => {
  assert.deepEqual(Object.keys(STATUS_PRESENTATIONS), ["passed", "failed", "stale", "conflict", "blocked"]);
  for (const presentation of Object.values(STATUS_PRESENTATIONS)) {
    assert.ok(presentation.label.length > 0);
    assert.ok(presentation.symbol.length > 0);
  }
  assert.deepEqual(SEVERITY_PRESENTATIONS.map((presentation) => presentation.symbol), ["S0", "S1", "S2", "S3", "S4"]);
  assert.equal(SEVERITY_PRESENTATIONS.every((presentation) => presentation.label.length > 0), true);
});
