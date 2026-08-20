import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprintSourceBytes, inspectPng } from "../../src/rendering-assets/public.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const initialPrompt = "Use case: stylized-concept; asset type: deterministic game sprite source sheet for a browser-based management simulation; create exactly nine separate, fully visible game sprites arranged in a precise 3 by 3 grid: calm compact park worker robot, friendly but credible small herbivore dinosaur, sturdy automated dinosaur enclosure gate, square grass-and-path environment tile with fern, park visitor, amber triangular operational warning cue, pale-blue dust-puff effect, miniature park overview thumbnail, cheerful green dinosaur plushie expressive reward. Genuinely transparent background; polished stylized 2.5D tactile retro-futuristic management-sim art; south-east three-quarter view; generous transparent padding; soft upper-left daylight; natural park palette; no embedded words, letters, numbers, labels, logos, trademarks, signatures, watermark, border, captions, grid, crops, or overlaps.";
const revisionPrompt = "Edit the most recent generated nine-sprite 3-by-3 game source sheet. Change only these items: remove every leaf emblem or symbol from the robot cap, robot chest, and gate control panel; replace each with plain unmarked material matching its surrounding surface. Keep the exact nine sprites, positions, proportions, poses, silhouettes, transparent background, lighting, palette, shadows, and all other details unchanged. Keep the amber warning cue's geometric safety motif. No words, letters, numbers, labels, logos, trademarks, signatures, watermark, border, captions, grid lines, or cropped objects. Preserve actual alpha transparency and clean edges.";
const finalPrompt = "Use case: stylized-concept; asset type: game sprite source sheet; exactly nine isolated sprites in a strict 3-by-3 grid: unmarked wheeled park worker robot, small herbivore dinosaur, automated enclosure gate, grass-and-path environment tile, park visitor, amber geometric operational warning cue, pale-blue dust puff, fenced park overview thumbnail, green dinosaur plushie reward. True transparent alpha; stylized 2.5D management-sim; south-east three-quarter view; soft upper-left daylight; no words, letters, numbers, labels, logos, trademarks, signatures, watermark, borders, captions, or grid lines.";
const families = [
  ["robot", "assets:robot-park-worker", "Park Worker Robot", "A calm general-purpose Worker Agent available for park tasks.", 0, 0, 0.5, 0.92, "entity", ["available", "idle"]],
  ["dinosaur", "assets:dinosaur-herbivore", "Herbivore Dinosaur", "A small herbivore dinosaur whose visible pose never replaces its DOM need status.", 1, 0, 0.5, 0.9, "entity", ["dinosaur", "herbivore"]],
  ["gate", "assets:gate-enclosure", "Automated Enclosure Gate", "A sturdy automated enclosure gate with state reported separately in text.", 2, 0, 0.5, 0.92, "structure", ["equipment", "gate"]],
  ["environment", "assets:environment-grass-path", "Grass and Path Tile", "A natural park ground tile containing grass, a path, and a fern.", 0, 1, 0.5, 0.9, "ground", ["environment", "ground"]],
  ["visitor", "assets:visitor-park", "Park Visitor", "A park visitor whose safety and movement state is available in the semantic interface.", 1, 1, 0.5, 0.94, "entity", ["person", "visitor"]],
  ["cue", "assets:cue-operational-warning", "Operational Warning Cue", "An operational warning cue paired with a persistent text warning and shape cue.", 2, 1, 0.5, 0.9, "overlay", ["cue", "warning"]],
  ["effect", "assets:effect-dust-puff", "Dust Puff Effect", "A decorative dust puff with no authoritative or essential meaning.", 0, 2, 0.5, 0.75, "overlay", ["decorative", "effect"]],
  ["thumbnail", "assets:thumbnail-park-overview", "Park Overview Thumbnail", "A miniature overview of the fenced park, supplemented by a text location description.", 1, 2, 0.5, 0.92, "ground", ["overview", "thumbnail"]],
  ["reward", "assets:reward-dinosaur-plushie", "Dinosaur Plushie Reward", "A cheerful dinosaur plushie expressive reward with a persistent text description.", 2, 2, 0.5, 0.92, "entity", ["expressive-reward", "plushie"]],
];
const paths = ["mvp-source-sheet-r1.png", "mvp-source-sheet-r2.png", "mvp-source-sheet-r3.png"];
const sources = await Promise.all(paths.map(async (name) => {
  const bytes = await readFile(resolve(root, "assets/source", name));
  return { name, bytes, hash: fingerprintSourceBytes(bytes), png: inspectPng(bytes) };
}));
if (sources.some((source) => source.png === undefined)) throw new Error("All fixture sources must be PNG files.");

const records = families.filter(([slug]) => slug !== "robot").map(([slug, assetId, label, role, column, row, pivotX, pivotY, , tags]) => ({
  id: `assets:brief-mvp-${slug}`, version: "1.0.0", class: "AssetBrief", schemaVersion: "1", displayName: `MVP ${label}`, author: "Dino Park Engineer",
  provenance: { source: "built-in", path: "assets/briefs/mvp-families.json", author: "Dino Park Engineer" }, contextCost: 0,
  dependencies: [{ id: "assets:three-quarter-art-direction", version: "1.0.0", expectedClass: "AssetArtDirection", expectedSchemaVersion: "1" }], tags: ["mvp", "rendering", slug].sort(), availability: "available",
  data: {
    assetFamilyId: `assets:family-${slug}`, runtimeAssetId: assetId, bundleId: "assets:bundle-mvp-park", owningFeature: "Player Experience", semanticRole: role,
    requiredViews: ["south-east-three-quarter"], targetDisplayScale: { widthPx: slug === "thumbnail" ? 128 : 80, heightPx: slug === "thumbnail" ? 128 : 80, semanticZooms: ["far", "near"] },
    sourceCanvas: { widthPx: 1254, heightPx: 1254, background: "transparent" }, safeBounds: { x: column * 418, y: row * 418, width: 418, height: 418 },
    pivot: { x: pivotX, y: pivotY, rule: "Pivot is normalized to the stable ground-contact point and remains unchanged across semantic variants." },
    animation: { mode: slug === "effect" ? "frames" : "none", requiredSequences: slug === "effect" ? ["puff"] : [], reducedMotionEquivalent: "A static base frame plus persistent DOM text preserves all semantic information." },
    variants: [{ id: `${assetId}-base`, semanticTags: tags }],
    accessibilityEquivalent: { domLabel: label, textDescription: role, soundSubstitution: "Persistent DOM status and history carry all essential meaning.", shapeCue: `The ${label.toLowerCase()} has a stable silhouette distinct from color alone.` },
    artDirection: { id: "assets:three-quarter-art-direction", version: "1.0.0" },
    acceptanceChecklist: ["Matches the shared south-east three-quarter orientation and lighting.", "Contains no embedded words, letters, numbers, labels, logos, or watermarks.", "Keeps a complete readable silhouette inside its declared cell and stable pivot.", "Uses transparent RGBA source pixels with clean edges.", "Provides a persistent non-image semantic equivalent for every essential meaning."],
  },
}));
await writeFile(resolve(root, "assets/briefs/mvp-families.json"), `${JSON.stringify(records, null, 2)}\n`);

const baseCandidate = (slug, assetId, source, version, promptRevision, prompt) => ({
  candidateId: `assets-candidate:mvp-${slug}-sheet-r${version}`, candidateVersion: `${version}.0.0`, sourceId: `assets-source:mvp-sheet-r${version}`, sourceVersion: `${version}.0.0`, briefId: slug === "robot" ? "assets:brief-mvp-park-robot" : `assets:brief-mvp-${slug}`, briefVersion: "1.0.0", runtimeAssetId: assetId, runtimeAssetVersion: "1.0.0", bundleId: "assets:bundle-mvp-park", bundleVersion: "1.0.0", sourcePath: `assets/source/${source.name}`, sourceHash: source.hash,
  model: { alias: "openai-built-in-imagegen" }, promptRevision, referenceInputs: [], generationParameters: { surface: "built-in-imagegen", prompt, requestedBackground: "transparent", requestedLayout: "3x3" }, createdAt: `2026-08-19T${version === 1 ? "16:00" : version === 2 ? "16:10" : "16:20"}:00.000Z`, lineage: version === 1 ? { operation: "original" } : { operation: "edit", parentCandidateId: `assets-candidate:mvp-robot-sheet-r${version - 1}`, parentCandidateVersion: `${version - 1}.0.0`, parentSourceHash: sources[version - 2].hash }, rightsUsage: { owner: "Dino Park Engineer", license: "project-use", allowedUse: "Approved local game rendering source and derived runtime bundle." }, quarantine: "unapproved",
});
const r1 = baseCandidate("robot", "assets:robot-park-worker", sources[0], 1, "1.0.0", initialPrompt);
const r2 = baseCandidate("robot", "assets:robot-park-worker", sources[1], 2, "1.1.0", revisionPrompt);
const approved = families.map(([slug, assetId]) => baseCandidate(slug, assetId, sources[2], 3, "2.0.0", finalPrompt));
await writeFile(resolve(root, "assets/manifests/candidates.json"), `${JSON.stringify({ manifestVersion: "1", candidates: [r1, r2, ...approved] }, null, 2)}\n`);
const rejected = [
  { candidate: r1, note: "Rejected: robot and gate contain leaf emblems that violate the no embedded logos acceptance criterion." },
  { candidate: r2, note: "Rejected: output is opaque RGB with a baked checkerboard, violating transparent RGBA and clean-edge requirements." },
].map(({ candidate, note }, index) => ({ reviewId: `asset-review:mvp-robot-r${index + 1}-rejected`, reviewVersion: "1.0.0", candidateId: candidate.candidateId, candidateVersion: candidate.candidateVersion, sourceId: candidate.sourceId, selectedSourceVersion: candidate.sourceVersion, sourceHash: candidate.sourceHash, reviewer: "Dino Park Engineer asset review", decision: "rejected", decidedAt: `2026-08-19T16:${index === 0 ? "05" : "15"}:00.000Z`, notes: note }));
const approvals = approved.map((candidate, index) => ({ reviewId: `asset-review:mvp-${families[index][0]}-r3-approved`, reviewVersion: "1.0.0", candidateId: candidate.candidateId, candidateVersion: candidate.candidateVersion, sourceId: candidate.sourceId, selectedSourceVersion: candidate.sourceVersion, sourceHash: candidate.sourceHash, reviewer: "Dino Park Engineer asset review", decision: "approved", decidedAt: "2026-08-19T16:30:00.000Z", notes: "Approved exact RGBA source hash after review for view, silhouette, lighting, edge quality, pivot cell, scale, absence of embedded text/logos, and persistent accessibility equivalent." }));
await writeFile(resolve(root, "assets/manifests/reviews.json"), `${JSON.stringify({ manifestVersion: "1", reviews: [...rejected, ...approvals] }, null, 2)}\n`);
await writeFile(resolve(root, "assets/manifests/fixture-layout.json"), `${JSON.stringify({ schemaVersion: "1", sourcePath: approved[0].sourcePath, sourceHash: approved[0].sourceHash, bundleId: "assets:bundle-mvp-park", bundleVersion: "1.0.0", assets: families.map(([slug, assetId, label, , column, row, pivotX, pivotY, occlusionClass, semanticTags]) => ({ assetId, assetVersion: "1.0.0", sourceId: `assets-source:mvp-sheet-r3`, sourceVersion: "3.0.0", sourceHash: approved[0].sourceHash, briefId: slug === "robot" ? "assets:brief-mvp-park-robot" : `assets:brief-mvp-${slug}`, briefVersion: "1.0.0", approvalReviewId: `asset-review:mvp-${slug}-r3-approved`, approvalReviewVersion: "1.0.0", cell: { column, row }, pivot: { x: pivotX, y: pivotY }, semanticTags, accessibilityLabel: label, occlusionClass, ...(slug === "effect" ? { animationId: "puff" } : {}) })) }, null, 2)}\n`);
console.log("Created deterministic MVP fixture briefs, candidates, exact hash-bound reviews, and layout.");
