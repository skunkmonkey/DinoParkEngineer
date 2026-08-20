import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canonicalRuntimeBundleJson,
  compileRuntimeBundle,
  createDevelopmentPlaceholder,
  createRuntimeAssetCatalog,
  importCandidateToQuarantine,
  inspectPng,
  recordCandidateReview,
  selectApprovedRuntimeInputs,
  validateRuntimeBundle,
  type CompileAssetInput,
  type RuntimeAssetBundle,
} from "../../src/rendering-assets/public.js";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const json = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
const candidates = json<{ candidates: unknown[] }>("assets/manifests/candidates.json").candidates;
const reviews = json<{ reviews: unknown[] }>("assets/manifests/reviews.json").reviews;
const layout = json<{ sourcePath: string; sourceHash: string; assets: CompileAssetInput[] }>("assets/manifests/fixture-layout.json");
const source = readFileSync(resolve(root, layout.sourcePath));

test("approved source is RGBA PNG and rejected opaque revision remains quarantined", () => {
  assert.deepEqual(inspectPng(source), { width: 1254, height: 1254, hasAlpha: true });
  assert.equal(inspectPng(readFileSync(resolve(root, "assets/source/mvp-source-sheet-r2.png")))?.hasAlpha, false);
  const imported = candidates.map((candidate) => {
    const path = (candidate as { sourcePath: string }).sourcePath;
    return importCandidateToQuarantine(candidate, readFileSync(resolve(root, path)));
  });
  assert.equal(imported.every((result) => result.ok), true);
  const values = imported.flatMap((result) => result.ok ? [result.candidate] : []);
  const recorded = reviews.map((review) => {
    const identity = review as { candidateId: string; candidateVersion: string };
    const candidate = values.find((value) => value.candidateId === identity.candidateId && value.candidateVersion === identity.candidateVersion);
    assert.ok(candidate); return recordCandidateReview(candidate, review);
  });
  assert.equal(recorded.every((result) => result.ok), true);
  const selected = selectApprovedRuntimeInputs(values, recorded.flatMap((result) => result.ok ? [result.review] : []));
  assert.equal(selected.length, 9);
  assert.equal(selected.every((input) => input.sourceHash === layout.sourceHash), true);
});

test("compiler emits byte-equivalent canonical output for darwin and win32 logical inputs", () => {
  const darwin = compileRuntimeBundle(layout.assets, source, "darwin");
  const win32 = compileRuntimeBundle([...layout.assets].reverse(), source, "win32");
  assert.equal(canonicalRuntimeBundleJson(darwin), canonicalRuntimeBundleJson(win32));
  assert.equal(darwin.assets.length, 9);
  assert.equal(darwin.assets.every((asset) => asset.transforms.map((step) => step.operation).join(",") === "crop,trim,padding,scale,format"), true);
  const effect = darwin.assets.find((asset) => asset.assetId === "assets:effect-dust-puff");
  assert.deepEqual(effect?.animations, [{ id: "puff", frames: ["assets:effect-dust-puff:base"], frameDurationMs: 160, loop: true, reducedMotionFrame: "assets:effect-dust-puff:base" }]);
});

test("production validation rejects placeholders, overlaps, stale sources, missing frames, duplicates, case collisions, and orphans", () => {
  const bundle = compileRuntimeBundle(layout.assets, source, "darwin"); const expected = layout.assets.map((asset) => asset.assetId);
  assert.deepEqual(validateRuntimeBundle(bundle, { production: true, expectedAssetIds: expected, expectedSourceHash: layout.sourceHash }), { ok: true });
  const placeholder = createDevelopmentPlaceholder("assets:missing-required", "1.0.0", "required dinosaur");
  const first = bundle.assets[0]; const second = bundle.assets[1]; assert.ok(first); assert.ok(second);
  const broken: RuntimeAssetBundle = { ...bundle, assets: [
    ...bundle.assets,
    placeholder,
    { ...first, assetId: first.assetId.toUpperCase(), source: { ...first.source, sourceHash: "fnv1a64:0000000000000000" } },
    { ...second, animations: [{ id: "broken", frames: [], frameDurationMs: 1, loop: false, reducedMotionFrame: "" }] },
  ] };
  const result = validateRuntimeBundle(broken, { production: true, expectedAssetIds: expected, expectedSourceHash: layout.sourceHash });
  assert.equal(result.ok, false);
  if (result.ok) return;
  const codes = new Set(result.diagnostics.map((diagnostic) => diagnostic.code));
  for (const code of ["ASSET_PLACEHOLDER_REQUIRED", "ASSET_ATLAS_OVERLAP", "ASSET_OUTPUT_STALE", "ASSET_FRAME_MISSING", "ASSET_RUNTIME_CASE_COLLISION", "ASSET_ORPHANED"]) assert.equal(codes.has(code), true, code);
});

test("compiler rejects unsupported or opaque source formats before compilation", () => {
  assert.throws(() => compileRuntimeBundle(layout.assets, new TextEncoder().encode("not a png"), "darwin"), /RGBA PNG/u);
  const opaque = readFileSync(resolve(root, "assets/source/mvp-source-sheet-r2.png"));
  assert.throws(() => compileRuntimeBundle(layout.assets, opaque, "win32"), /RGBA PNG/u);
});

test("runtime catalog resolves exact IDs through a base-path-aware local atlas URL", () => {
  const bundle = compileRuntimeBundle(layout.assets, source, "darwin"); const catalog = createRuntimeAssetCatalog(bundle, "/dino-park/");
  assert.equal(catalog.atlasUrl, "/dino-park/assets/mvp-park/atlas.png");
  assert.equal(catalog.resolveExact("assets:robot-park-worker", "1.0.0")?.accessibilityLabel, "Park Worker Robot");
  assert.equal(catalog.resolveExact("assets:robot-park-worker", "2.0.0"), undefined);
});

test("committed Pixi fixture contains only local runtime files and no generation metadata or secrets", () => {
  assert.deepEqual(readdirSync(resolve(root, "public/assets/mvp-park")).sort(), ["atlas.json", "atlas.png", "platform-comparison.json"]);
  const shipped = readFileSync(resolve(root, "public/assets/mvp-park/atlas.json"), "utf8");
  assert.doesNotMatch(shipped, /(?:openai|prompt|api[-_]?key|authorization|bearer|secret|token)/iu);
  const bundle = JSON.parse(shipped) as RuntimeAssetBundle;
  assert.equal(bundle.assets.every((asset) => !asset.placeholder && asset.source.sourceHash === layout.sourceHash), true);
});
