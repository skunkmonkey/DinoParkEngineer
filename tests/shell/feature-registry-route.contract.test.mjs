import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../../src/shell/public.ts";

function registration(id, order, path, requirement = "optional", load = async () => id) {
  return {
    id,
    order,
    requirement,
    route: { id, path, mode: `${id}-mode`, title: `${id} title` },
    load,
    failure: {
      diagnosticCode: `${id}-load-failed`,
      title: `${id} unavailable`,
      message: `${id} could not be loaded`,
    },
  };
}

test("registry validates duplicates, required entries, and stable ordering", async () => {
  const first = registration("zeta", 20, "/zeta");
  const second = registration("alpha", 10, "/alpha", "required");
  const registry = publicApi.createFeatureRegistry([first, second]);

  assert.deepEqual(
    registry.features.map(({ id }) => id),
    ["alpha", "zeta"],
  );
  assert.equal(await registry.load("alpha"), "alpha");

  assert.throws(
    () =>
      publicApi.createFeatureRegistry([
        registration("same", 0, "/one"),
        registration("same", 1, "/two"),
      ]),
    (error) =>
      error instanceof publicApi.FeatureRegistryValidationError &&
      error.issues.some(({ code }) => code === "duplicate-feature-id"),
  );

  assert.throws(
    () =>
      publicApi.createFeatureRegistry([
        registration("one", 0, "/same"),
        registration("two", 1, "/same/"),
      ]),
    (error) =>
      error instanceof publicApi.FeatureRegistryValidationError &&
      error.issues.some(({ code }) => code === "duplicate-route-path"),
  );

  assert.throws(
    () =>
      publicApi.createFeatureRegistry([
        registration("one", 0, "/one"),
        { ...registration("two", 1, "/two"), route: { ...registration("two", 1, "/two").route, id: "one-route" } },
        { ...registration("three", 2, "/three"), route: { ...registration("three", 2, "/three").route, id: "one-route" } },
      ]),
    (error) =>
      error instanceof publicApi.FeatureRegistryValidationError &&
      error.issues.some(({ code }) => code === "duplicate-route-id"),
  );

  assert.throws(
    () =>
      publicApi.createFeatureRegistry(
        [registration("optional", 0, "/optional")],
        { requiredFeatureIds: ["optional"] },
      ),
    (error) =>
      error instanceof publicApi.FeatureRegistryValidationError &&
      error.issues.some(({ code }) => code === "missing-required-feature"),
  );
});

test("route matching is base-aware, case-sensitive, and payload-opaque", () => {
  const registry = publicApi.createFeatureRegistry([
    registration("park", 0, "/park", "required"),
    registration("eval", 1, "/eval"),
  ]);
  const causalPayload = Object.freeze({ entityId: "entity-7", traceId: "trace-4" });
  const matched = publicApi.matchRoute(registry, {
    pathname: "/game/eval/",
    basePath: "/game/",
    causalPayload,
  });

  assert.equal(matched.kind, "match");
  assert.equal(matched.mode, "eval-mode");
  assert.equal(matched.title, "eval title");
  assert.equal(matched.pathname, "/eval");
  assert.strictEqual(matched.causalPayload, causalPayload);

  const notFound = publicApi.matchRoute(registry, "/game/EVAL", "/game");
  assert.equal(notFound.kind, "not-found");
  assert.equal(notFound.safePath, "/park");
  assert.equal(notFound.mode, publicApi.NOT_FOUND_MODE);
  assert.equal(notFound.title, publicApi.NOT_FOUND_TITLE);
});
