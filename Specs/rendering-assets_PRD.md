# Rendering Asset Pipeline - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Application Shell | Supplies cross-platform build commands, configuration, and diagnostics. |
| 2 | Content Registry | Supplies stable asset identity, package validation, exact versions, and provenance contracts. |

### Downstream Dependencies

Player Experience consumes runtime rendering bundles. Curriculum Content names
asset identities. Park Operations, Incident Response, Orchestration, and
Economy request semantic presentations without importing source media.

## Executive Summary

The Rendering Asset Pipeline lets OpenAI models create visual source material
early, while keeping generated output reviewable, reproducible, portable, and
safe for an offline deterministic game. Asset briefs capture art direction and
technical contracts before generation. Every candidate retains provenance.
Only explicitly approved candidates are normalized and compiled into versioned
runtime bundles used by PixiJS. Regeneration is a new reviewable source version,
never an invisible mutation.

## User Stories

### Brief and Generate

- **GIVEN** a future feature needs visual assets, **WHEN** its rendering contract
  is known, **THEN** an asset brief can be authored and queued before feature
  implementation begins.
  - **Acceptance Criteria:** The brief declares semantic role, views, motion,
    dimensions, anchors, safe bounds, variants, and art-direction constraints.
- **GIVEN** an OpenAI model produces one or more candidates, **WHEN** they are
  imported, **THEN** the candidates retain their generation provenance and are
  marked unapproved.
  - **Acceptance Criteria:** A generated file cannot enter a production bundle
    merely because it exists in the source directory.

### Review and Compile

- **GIVEN** candidate assets, **WHEN** a reviewer compares them with the brief,
  **THEN** the reviewer can approve, reject, or request a new revision without
  overwriting prior candidates.
  - **Acceptance Criteria:** Reviewer, decision, time, notes, and selected source
    version are recorded.
- **GIVEN** an approved source, **WHEN** the pipeline compiles it, **THEN** the
  output has deterministic dimensions, trim, pivot, scale, atlas placement,
  animation metadata, and identity.
  - **Acceptance Criteria:** Recompiling unchanged approved sources produces
    byte-equivalent metadata and semantically equivalent images.

### Consume and Diagnose

- **GIVEN** a feature requests a runtime asset ID, **WHEN** a compatible bundle
  is loaded, **THEN** it receives the exact compiled version declared by the
  content package.
  - **Acceptance Criteria:** No feature depends on source filenames or prompts.
- **GIVEN** an asset is missing, invalid, or unapproved, **WHEN** validation or
  build runs, **THEN** the exact brief and failure are reported.
  - **Acceptance Criteria:** Development placeholders are explicit; production
    bundles cannot silently substitute unrelated media.

## Functional Requirements

### FR-01: Asset Briefs

- FR-01.1: Every requested asset family SHALL have a stable brief ID, version,
  owning feature, intended semantic role, required views, target display scale,
  source canvas, safe bounds, anchor/pivot rules, animation requirements,
  variants, and acceptance checklist.
- FR-01.2: Briefs SHALL reference shared art-direction constraints for
  three-quarter orientation, lighting, palette, silhouette, outline, and
  competent-absurdity tone.
- FR-01.3: Briefs SHALL identify essential meaning that requires a DOM, text,
  sound-substitution, shape, or other non-image equivalent.
- FR-01.4: A changed contract SHALL create a new brief revision.

### FR-02: OpenAI-Assisted Generation

- FR-02.1: Generation MAY use OpenAI image-generation and image-editing models
  through development tools available to the authorized creator.
- FR-02.2: The manifest SHALL record model alias and snapshot when available,
  prompt/brief revision, reference image identities, generation parameters,
  creation time, and output identity without secrets.
- FR-02.3: Candidate generation SHALL remain outside the shipped game and SHALL
  not be required by normal build, test, run, save, replay, or play workflows.
- FR-02.4: Output from any model SHALL begin in an unapproved quarantine state.
- FR-02.5: The pipeline SHALL support iterative edits and derived variants while
  preserving parent-source lineage.

### FR-03: Review and Approval

- FR-03.1: Candidate review SHALL check brief conformance, visual consistency,
  legibility at target scale, transparent-edge quality, pose/view consistency,
  prohibited embedded text, occlusion bounds, and accessibility implications.
- FR-03.2: Approval SHALL be explicit, attributable, and tied to exact source
  hashes.
- FR-03.3: Rejected and superseded candidates MAY remain outside runtime bundles
  for provenance but SHALL not be shipped by default.
- FR-03.4: Approval of a new revision SHALL not mutate a previously compiled
  asset version.

### FR-04: Deterministic Compilation

- FR-04.1: Compilation SHALL validate file type, dimensions, alpha behavior,
  color profile, file size, naming, source hash, and brief approval.
- FR-04.2: Transformations SHALL use versioned repository scripts and declared
  parameters for crop, padding, trim, scale, format conversion, atlas packing,
  and metadata generation.
- FR-04.3: Runtime sprite metadata SHALL declare asset ID/version, bundle,
  rectangle, source size, trim, pivot, hit region, depth/occlusion hints,
  animation frames and timing, and semantic variant tags as applicable.
- FR-04.4: Animation timing is presentational and SHALL not advance or adjudicate
  authoritative simulation state.
- FR-04.5: Output bundles SHALL be loadable by PixiJS WebGL from static assets
  and use base-path-aware URLs.

### FR-05: Validation and Placeholders

- FR-05.1: Validation SHALL detect missing briefs, missing approved sources,
  stale compiled output, duplicate IDs, atlas overlap, invalid pivots, missing
  frames, unsupported formats, case collisions, and orphaned assets.
- FR-05.2: A development placeholder SHALL retain the requested asset ID and
  visibly indicate missing media without pretending to be production art.
- FR-05.3: Production validation SHALL reject placeholders for required assets.
- FR-05.4: Player Experience tests SHALL be able to load a small deterministic
  fixture bundle without loading the full art catalog.

### FR-06: Asset Families

- FR-06.1: The MVP pipeline SHALL support environment tiles/props, dinosaurs,
  robots and carried tools, gates/equipment, visitors, UI cue imagery,
  selection/route overlays, effects, thumbnails, and expressive rewards.
- FR-06.2: Assets SHALL support semantic zoom and reduced-motion variants where
  required by their owning briefs.
- FR-06.3: Critical state variants SHALL share stable silhouettes and anchors so
  state changes do not appear as positional jumps.

## Non-Functional Requirements

- **NFR-01: Cross-platform** - Brief validation and compilation produce the
  same manifests on Windows and macOS.
- **NFR-02: Offline runtime** - Compiled assets require no OpenAI or network
  access.
- **NFR-03: Auditability** - Every shipped asset traces to an approved source,
  brief revision, transformations, and content package.
- **NFR-04: Performance** - Bundle, texture, and atlas budgets are measured in
  Player Experience prototypes before hard limits are adopted.
- **NFR-05: Replaceability** - Model providers and versions may change without
  changing runtime asset contracts.

## Invariants

- **INV-01:** Generated pixels never define authoritative world state.
- **INV-02:** Unapproved generated output never enters production bundles.
- **INV-03:** Normal builds never make a model request.
- **INV-04:** Regeneration creates a new candidate/source version.
- **INV-05:** Essential meaning always has a non-image semantic equivalent.
- **INV-06:** Runtime consumers address stable asset IDs, not source files.

## Out of Scope

- Runtime procedural image generation.
- Player-authored asset generation.
- Training or fine-tuning image models.
- Requiring a particular desktop graphics editor.
- Using media to decide collisions, hazards, containment, or other world truth.

## Product Decisions

- **PD-01: Generate early from contracts** - Feature plans identify asset briefs
  before their visual slices begin.
- **PD-02: Human approval gate** - Model output is a candidate, not a finished
  production asset.
- **PD-03: Source and runtime separation** - Large source candidates and prompts
  stay separate from lean compiled bundles.
- **PD-04: Consistency over novelty** - Brief conformance and readable systemic
  state matter more than individually impressive images.

## Implementation Decisions

- **IMP-01:** Use an `assets/source`, `assets/briefs`, `assets/manifests`, and
  generated `public/assets` separation; only approved source and required
  provenance are committed according to repository policy.
- **IMP-02:** Use portable Node scripts and prebuilt npm image-processing
  packages; do not require ImageMagick, FFmpeg, Tiled, or OS-specific tools.
- **IMP-03:** Default runtime raster formats to lossless WebP or PNG according
  to measured quality and browser support, with JSON atlas manifests.
- **IMP-04:** Pin model snapshots in provenance when the generation surface
  exposes them; never make runtime behavior depend on model reproducibility.
- **IMP-05:** Expose runtime bundle lookup through
  `src/rendering-assets/public.ts` and keep generation tooling out of browser
  imports.

## Testing Decisions

- **TST-01:** Golden manifests cover crop, trim, pivot, atlas, animation, and
  provenance output.
- **TST-02:** Rebuild tests compare canonical manifests and output hashes where
  encoding is deterministic.
- **TST-03:** Negative fixtures cover unapproved, missing, corrupt, oversized,
  wrongly oriented, case-colliding, and stale output.
- **TST-04:** A rendered contact sheet and Pixi fixture scene provide visual QA;
  automated checks do not claim to replace human art review.
- **TST-05:** Windows and macOS CI compile the same fixture asset pack.

## Proposed Modules

- **MOD-01: Brief Catalog** - Validates versioned visual and technical asset
  contracts before generation.
- **MOD-02: Candidate Provenance Store** - Records model, prompt, references,
  parameters, lineage, hashes, and approval state.
- **MOD-03: Review Projector** - Produces contact sheets and exact review
  checklists without altering candidates.
- **MOD-04: Asset Compiler** - Deterministically normalizes approved sources and
  emits runtime images and metadata.
- **MOD-05: Bundle Validator** - Rejects missing, stale, colliding, placeholder,
  and incompatible production assets.
- **MOD-06: Runtime Asset Catalog** - Resolves exact bundle asset IDs for PixiJS
  without exposing generation internals.

## Workflows

### Workflow 1: Generate Before Feature Implementation

```text
1. The owning feature plan declares required semantic asset families.
2. An artist or agent authors and validates versioned briefs.
3. An authorized OpenAI generation tool creates candidates from those briefs.
4. Candidate files and provenance enter the unapproved source area.
5. Review approves, rejects, or requests a derived revision.
6. Approved candidates compile into a fixture or production runtime bundle.
7. The consuming feature implements against stable asset IDs and metadata.
```

### Workflow 2: Revise an Existing Asset

```text
1. A visual defect or changed feature contract creates a new brief revision.
2. A new generation or edit references the prior approved source as lineage.
3. The prior runtime asset remains available while candidates are reviewed.
4. Approval and compilation create a new exact asset version.
5. A content-package change intentionally selects the new version.
```
