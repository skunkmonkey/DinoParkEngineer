import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DEFAULT_CAMERA,
  ParkPlayerExperience,
  PlayerExperience,
  createPlayerExperience,
  interpolateSceneProjection,
  openingAssetIds,
  panCamera,
  presentationalFrame,
  projectPlayerScene,
  zoomCamera,
} from "../../src/player-experience/public.js";

test("dawn projection has stable entities, exact asset IDs, and bounded camera controls", () => {
  const service = createPlayerExperience();
  const before = service.project();
  assert.equal(before.scene.orientation, "three-quarter");
  assert.equal(before.scene.lighting, "dawn");
  assert.equal(before.scene.semanticZoom, "mid");
  assert.deepEqual(before.scene.entities.filter((entity) => entity.kind === "dinosaur").map((entity) => entity.id).sort(), ["dinosaur:tria", "dinosaur:vera"]);
  assert.ok(before.scene.entities.some((entity) => entity.id === "robot:alpha"));
  assert.ok(before.scene.entities.some((entity) => entity.id === "gate:alpha"));
  assert.ok(before.scene.entities.some((entity) => entity.id === "visitor:morning"));
  assert.deepEqual(openingAssetIds(), [
    "assets:cue-operational-warning",
    "assets:dinosaur-herbivore",
    "assets:effect-dust-puff",
    "assets:environment-grass-path",
    "assets:gate-enclosure",
    "assets:reward-dinosaur-plushie",
    "assets:robot-park-worker",
    "assets:thumbnail-park-overview",
    "assets:visitor-park",
  ]);
  assert.equal(panCamera(DEFAULT_CAMERA, { x: -1000, y: 1000 }).center.x, DEFAULT_CAMERA.bounds.minX);
  assert.equal(panCamera(DEFAULT_CAMERA, { x: -1000, y: 1000 }).center.y, DEFAULT_CAMERA.bounds.maxY);
  assert.equal(zoomCamera(DEFAULT_CAMERA, 100).zoom, 2.25);
});

test("animation and projection passes cannot mutate authoritative snapshots", () => {
  const service = createPlayerExperience();
  const before = service.project();
  const worldFingerprint = before.authoritativeFingerprint;
  const animated = presentationalFrame(before, 160, false);
  assert.notStrictEqual(animated.scene, before.scene);
  assert.equal(animated.authoritativeFingerprint, worldFingerprint);
  assert.equal(service.project().authoritativeFingerprint, worldFingerprint);
  const projection = projectPlayerScene(before.world, before.operations, { camera: before.scene.camera });
  const copy = structuredClone(projection);
  void interpolateSceneProjection(projection, 400, false);
  assert.deepEqual(projection, copy);
});

test("Inspector feeding uses deterministic atomic simulation commands and exact job evidence", () => {
  const service = createPlayerExperience();
  const assigned = service.dispatch({ kind: "assign-feeding-job" });
  assert.equal(assigned.accepted, true);
  assert.equal(assigned.snapshot.operations.jobs[0]?.status, "assigned");
  const fed = service.dispatch({ kind: "feed-through-inspector" });
  assert.equal(fed.accepted, true);
  assert.equal(fed.snapshot.operations.jobs[0]?.status, "completed");
  assert.equal(fed.snapshot.world.dinosaurs.find((entry) => entry.id === "dinosaur:tria")?.hunger, 40);
  assert.equal(fed.snapshot.world.gates.find((entry) => entry.id === "gate:alpha")?.position, "closed");
  assert.deepEqual(fed.snapshot.feedingEvidence, {
    dinosaurHunger: { before: 80, after: 40 },
    gatePosition: { before: "closed", after: "closed" },
    robotLocation: { before: "location:path", after: "location:path" },
  });
  assert.ok(fed.snapshot.operations.jobs[0]?.resultLinks.length === 1);
  assert.ok(fed.snapshot.history.some((entry) => entry.text.includes("Feeding succeeded through the Inspector")));
});

test("feeding evidence reflects the exact world delta after logical time advances", () => {
  const service = createPlayerExperience();
  service.dispatch({ kind: "set-time-control", paused: false, speed: 4 });
  service.dispatch({ kind: "step-logical-tick" });
  service.dispatch({ kind: "set-time-control", paused: true, speed: 4 });
  service.dispatch({ kind: "assign-feeding-job" });
  const fed = service.dispatch({ kind: "feed-through-inspector" });
  assert.equal(fed.accepted, true);
  assert.deepEqual(fed.snapshot.feedingEvidence?.dinosaurHunger, { before: 81, after: 41 });
});

test("correlated near miss is grouped, auto-pauses, and recoverably closes", () => {
  const service = createPlayerExperience();
  assert.equal(service.project().world.gates.find((entry) => entry.id === "gate:beta")?.closer, "disabled");
  const staged = service.dispatch({ kind: "trigger-near-miss" });
  assert.equal(staged.accepted, true);
  assert.equal(staged.snapshot.operations.paused, true);
  assert.equal(staged.snapshot.world.paused, true);
  assert.equal(staged.snapshot.operations.incidents.length, 1);
  assert.equal(staged.snapshot.operations.incidents[0]?.observed.length, 2);
  assert.equal(staged.snapshot.operations.alerts.length, 2);
  assert.equal(staged.snapshot.world.gates.find((entry) => entry.id === "gate:beta")?.position, "open");
  assert.equal(staged.snapshot.world.dinosaurs.find((entry) => entry.id === "dinosaur:vera")?.contained, false);
  assert.equal(staged.snapshot.operations.jobs.find((entry) => entry.targetId === "dinosaur:vera")?.status, "failed");
  assert.ok(staged.snapshot.scene.entities.some((entity) => entity.kind === "alert"));
  assert.ok(staged.snapshot.scene.entities.some((entity) => entity.kind === "incident" && entity.evidence?.immediateGap.some((gap) => gap.includes("maintenance"))));
  const stabilized = service.dispatch({ kind: "stabilize-incident" });
  assert.equal(stabilized.accepted, true);
  assert.equal(stabilized.snapshot.world.gates.find((entry) => entry.id === "gate:beta")?.position, "closed");
  assert.equal(stabilized.snapshot.world.dinosaurs.find((entry) => entry.id === "dinosaur:vera")?.contained, true);
  assert.equal(stabilized.snapshot.operations.incidents[0]?.status, "stabilized");
  const closed = service.dispatch({ kind: "resolve-incident" });
  assert.equal(closed.accepted, true);
  assert.equal(closed.snapshot.operations.incidents[0]?.status, "closed");
  assert.equal(closed.snapshot.operations.paused, false);
  assert.equal(closed.snapshot.world.paused, false);
});

test("the authored near-miss control stays unavailable after its evidence is closed", () => {
  const service = createPlayerExperience();
  service.dispatch({ kind: "trigger-near-miss" });
  service.dispatch({ kind: "stabilize-incident" });
  service.dispatch({ kind: "resolve-incident" });
  const html = renderToStaticMarkup(<PlayerExperience runtime={service} />);
  assert.match(html, /<button type="button" disabled="">Stage recoverable near miss<\/button>/u);
});

test("near-miss inspection exposes the complete causal route into Workbench", () => {
  const service = createPlayerExperience();
  service.dispatch({ kind: "trigger-near-miss" });
  const html = renderToStaticMarkup(<PlayerExperience runtime={service} />);
  assert.match(html, /Causal investigation path/u);
  assert.match(html, /job:schedule-second-feed-day-1-tick-0/u);
  assert.match(html, /command:opening-reuse-open-gate/u);
  assert.match(html, /context:maintenance-policy/u);
  assert.match(html, /prompt:self-contained-feeding@1.0.0/u);
  assert.match(html, /Open responsible artifact in Workbench/u);
});

test("focused modes start with production and simulation paused", () => {
  for (const mode of ["workbench", "eval", "replay", "review"] as const) {
    const snapshot = createPlayerExperience({ mode }).project();
    assert.equal(snapshot.mode, mode);
    assert.equal(snapshot.operations.paused, true);
    assert.equal(snapshot.world.paused, true);
    assert.match(snapshot.history[0]?.text ?? "", /Dawn|Production paused/u);
  }
});

test("Park View has a responsive semantic canvas equivalent, Inspector, history, and non-color mode framing", () => {
  const html = renderToStaticMarkup(<ParkPlayerExperience />);
  assert.match(html, /Pre-opening operations/u);
  assert.match(html, /Dawn park scene/u);
  assert.match(html, /three-quarter/u);
  assert.match(html, /data-renderer-preference="webgl"/u);
  assert.match(html, /Semantic navigation/u);
  assert.match(html, /role="listbox"/u);
  assert.match(html, /Tria Inspector/u);
  assert.match(html, /Assign Robot Alpha/u);
  assert.match(html, /Feed Tria through Inspector/u);
  assert.match(html, /Persistent operations history/u);
  assert.match(html, /Reduced motion/u);
  assert.match(html, /Sound substitution/u);
  assert.match(html, /Expected/u);
  assert.match(html, /Canvas content is synchronized/u);
});
