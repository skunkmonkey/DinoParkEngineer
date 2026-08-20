import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DEFAULT_CAMERA,
  ParkPlayerExperience,
  PlayerExperience,
  buildCausalNavigation,
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
  assert.doesNotMatch(html, /Stage recoverable near miss/u);
  assert.match(html, /Recovery recorded/u);
});

test("near-miss inspection exposes the complete causal route into Workbench", () => {
  const service = createPlayerExperience();
  service.dispatch({ kind: "trigger-near-miss" });
  const html = renderToStaticMarkup(<PlayerExperience runtime={service} />);
  assert.match(html, /What happened · exact route/u);
  assert.match(html, /Opening-Day Near Miss/u);
  assert.match(html, /command:opening-reuse-open-gate/u);
  assert.match(html, /context:maintenance-policy/u);
  assert.match(html, /prompt:self-contained-feeding@1.0.0/u);
  assert.match(html, /Investigate in Workbench/u);
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

test("focused operational anchor keeps exact production, economy, version, emergency, and causal identity", () => {
  const service = createPlayerExperience({ mode: "eval", rating: 84, credits: 725, selectedVersion: "prompt:self-contained-feeding@1.0.0" });
  const before = service.project().operationalAnchor;
  assert.equal(before.productionState, "paused · pre-opening"); assert.equal(before.rating, 84); assert.equal(before.credits, 725);
  assert.equal(before.selectedVersion, "prompt:self-contained-feeding@1.0.0"); assert.deepEqual(before.causalBreadcrumb, ["Park", "Tria", "Inspector"]);
  service.dispatch({ kind: "trigger-near-miss" }); const after = service.project();
  assert.equal(after.operationalAnchor.emergencyCount, 1); assert.equal(after.operationalAnchor.tick, 1);
  assert.ok(after.operationalAnchor.causalBreadcrumb.includes("opening:near-miss"));
});

test("causal navigation synchronizes Eval and Historical Replay and restores the exact originating park event", () => {
  const navigation = buildCausalNavigation({ incidentId: "incident:gate-beta" as `${string}:${string}`, eventId: "opening:near-miss" as `${string}:${string}`, entityId: "gate:beta" as `${string}:${string}`, jobId: "job:feed-beta" as `${string}:${string}`, traceId: "trace:opening-feed-beta" as `${string}:${string}`, artifactVersion: "prompt:self-contained-feeding@1.0.0", tick: 1 });
  assert.match(navigation.workbenchUrl, /return=%2Fpark%3Fincident%3Dincident%253Agate-beta/u);
  assert.match(navigation.returnUrl, /^\/park\?incident=incident%3Agate-beta&event=opening%3Anear-miss&selected=gate%3Abeta&tick=1$/u);
  assert.match(navigation.evalUrl, /sync=incident%3Agate-beta%7Ctrace%3Aopening-feed-beta%7C1/u);
  const service = createPlayerExperience(); service.dispatch({ kind: "trigger-near-miss" }); const snapshot = service.project();
  assert.equal(snapshot.synchronizedEvidence?.incidentId, snapshot.operations.incidents[0]?.id);
  assert.equal(snapshot.synchronizedEvidence?.eval.status, "passed"); assert.match(snapshot.synchronizedEvidence?.eval.resultId ?? "", /^result:/u);
  assert.equal(snapshot.synchronizedEvidence?.replay.status, "available"); assert.equal(snapshot.synchronizedEvidence?.replay.mode, "historical-replay");
  assert.equal(snapshot.synchronizedEvidence?.eval.productionMutation, false); assert.equal(snapshot.synchronizedEvidence?.replay.productionMutation, false);
  assert.equal(snapshot.synchronizedEvidence?.synchronizationKey, snapshot.causalNavigation?.synchronizationKey);
  const html = renderToStaticMarkup(<PlayerExperience runtime={service} mode="replay" />);
  assert.match(html, /Synchronized Eval &amp; Historical Replay/u); assert.match(html, /result:/u); assert.match(html, /replay:/u); assert.match(html, /Inspect evidence/u);
});

test("guidance escalates by interaction, correct action skips it, and guidance/time choices never alter permanent reward", () => {
  const service = createPlayerExperience({ permanentReward: 250 }); const initialFingerprint = service.project().authoritativeFingerprint;
  assert.equal(service.project().guidance.level, "world-cue");
  service.dispatch({ kind: "advance-guidance" }); assert.equal(service.project().guidance.level, "affordance");
  service.dispatch({ kind: "advance-guidance" }); assert.equal(service.project().guidance.level, "hint");
  assert.equal(service.project().authoritativeFingerprint, initialFingerprint);
  service.dispatch({ kind: "set-time-control", paused: true, speed: 1 });
  service.dispatch({ kind: "set-time-control", paused: true, speed: 2 });
  assert.equal(service.project().permanentReward, 250);
  service.dispatch({ kind: "assign-feeding-job" }); assert.equal(service.project().guidance.level, "complete"); assert.equal(service.project().permanentReward, 250);
  const skipped = createPlayerExperience({ permanentReward: 250 }); skipped.dispatch({ kind: "dismiss-guidance" }); assert.equal(skipped.project().guidance.level, "complete"); assert.equal(skipped.project().permanentReward, 250);
});

test("first retention presentation is memorable while later and reduced-motion presentations are faster and all destinations persist", () => {
  const service = createPlayerExperience(); service.dispatch({ kind: "present-retention" }); service.dispatch({ kind: "present-retention" });
  const [first, later] = service.project().retentionPresentations;
  assert.equal(first?.animation, "first-memorable"); assert.equal(first?.durationMs, 1_200); assert.equal(later?.animation, "later-fast"); assert.equal(later?.durationMs, 240);
  assert.deepEqual(first?.items.map((entry) => entry.lifecycle), ["Excluded", "Compacted", "Externalized"]);
  assert.ok(first?.items.every((entry) => entry.destination.length > 0 && entry.reasonCode.length > 0));
  const reduced = createPlayerExperience({ preferences: { reducedMotion: true } }); reduced.dispatch({ kind: "present-retention" }); reduced.dispatch({ kind: "present-retention" });
  assert.deepEqual(reduced.project().retentionPresentations.map((entry) => [entry.animation, entry.durationMs]), [["reduced-motion-static", 0], ["reduced-motion-static", 0]]);
  const html = renderToStaticMarkup(<PlayerExperience runtime={service} />); assert.match(html, /Context retention/u); assert.match(html, /Excluded/u); assert.match(html, /Compacted/u); assert.match(html, /Externalized/u);
});

test("Park View has a responsive semantic canvas equivalent, Inspector, history, and non-color mode framing", () => {
  const html = renderToStaticMarkup(<ParkPlayerExperience />);
  assert.match(html, /Dawn Valley/u);
  assert.match(html, /LIVE PARK/u);
  assert.match(html, /Current objective/u);
  assert.match(html, /Feed hungry Tria/u);
  assert.match(html, /data-renderer-preference="webgl"/u);
  assert.match(html, /Park roster/u);
  assert.match(html, /role="listbox"/u);
  assert.match(html, /Send Robot Alpha/u);
  assert.match(html, /Park time controls/u);
  assert.match(html, /Park log/u);
  assert.match(html, /Inspect evidence/u);
  assert.doesNotMatch(html, /Visual grammar|Semantic navigation|Operational anchor|Action-skippable opening guidance/u);
  const routineVisualLayout = html.split('<details class="advanced-details">')[0] ?? html;
  assert.doesNotMatch(routineVisualLayout, /dinosaur:tria|location:enclosure|prompt:self-contained-feeding/u);
});

test("friendly presentation names are deterministic while exact IDs stay in advanced evidence", () => {
  const html = renderToStaticMarkup(<ParkPlayerExperience />);
  assert.match(html, /North Paddock Gate/u);
  assert.match(html, /South Habitat Gate/u);
  assert.match(html, /Vera/u);
  assert.match(html, /<summary>Inspect evidence<\/summary>/u);
  assert.match(html, /<code>dinosaur:tria<\/code>/u);
});
