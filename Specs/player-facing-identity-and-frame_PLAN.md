<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: Player-Facing Identity and Product Frame

## Goal and Owning Requirements

Establish the presentation boundary required by `player-experience_PRD.md` FR-01, FR-02, FR-04, and FR-07 before redesigning individual screens. Preserve exact ids/refs and deterministic behavior while making normal play use canonical AI types plus approachable artifact/world names.

Primary affected specifications: `content-registry_PRD.md`, `platform-foundation_PRD.md`, `curriculum-content_PRD.md`, `engineering-workbench_PRD.md`, and application PRD section 17.

## Proposed Vertical Slices

1. Add validated player-facing identity to one starter habitat and one Skill
 - Blocked by: None
 - Checklist: PXF-001 through PXF-008
 - Extend content schemas with required artifact `title` and world `displayName`, optional description/aliases, and explicit canonical artifact type/version presentation. Backfill only the starter habitat, its gate/dinosaur/worker, and Carnivore Feeding Skill first. Implement validation for missing names and scoped alias collision. Prove exact artifact/entity ids, manifest serialization, dependency ordering, and replay hashes are unchanged by display-only edits.
 - Visible result: the starter selection surfaces show `SKILL · Carnivore Feeding · v3`, named park entities, and a Technical Details disclosure containing the exact refs.
 - Tests: registry validation, canonical-manifest parity, raw-id and alias lookup, rendered HTML, keyboard access to Technical Details.

2. Introduce the shared PlayerFacingIdentity projection and backfill MVP content
 - Blocked by: #1
 - Checklist: PXF-009 through PXF-016
 - Add a small public projection API that resolves authored names, canonical type labels, deterministic generated labels for jobs/incidents/traces/reviews, search aliases, and technical identity metadata. Do not let React components invent independent naming rules. Backfill every MVP world entity, artifact, Eval, suite, scenario, Agent, and Manager configuration. Add deterministic fallbacks only for runtime-generated records.
 - Visible result: raw ids no longer serve as ordinary labels across Park, Agents, AI Workshop, Evals, Reviews, and Trace; searching or opening a raw-id deep link still selects the same record.
 - Tests: projection contracts for every record kind, generated-label stability, name/alias coverage validation, deep-link parity.

3. Replace the six equal primary destinations with Park, Operations, and AI Workshop
 - Blocked by: #2
 - Checklist: PXF-017 through PXF-024
 - Update destination presentation and ProductFrame grouping while keeping existing specialist route paths and route registrations stable. Park links to the world; Operations exposes Agents/jobs/incidents/Manager surfaces; AI Workshop exposes Engineering, Evals, Reviews, deployment, and Progress. Consume curriculum/progression disclosure state so unavailable concepts are subordinate or honestly locked rather than equally prominent. Back/forward, refresh, and direct URLs must still work.
 - Visible result: a first-time campaign has three understandable top-level choices; a mature campaign can reach all specialist surfaces without route migration.
 - Tests: shell route contracts, unlock/disclosure matrices, refresh/back/forward, direct locked-route behavior, keyboard focus order.

4. Move implementation diagnostics out of the normal player frame
 - Blocked by: #3
 - Checklist: PXF-025 through PXF-031
 - Remove `Frame ready`, provider/build/fixture status, destination numbering, telemetry queue controls, and platform implementation copy from normal play. Preserve actionable player errors and preferences. Add an explicit development diagnostics route/drawer enabled only by development configuration, using public diagnostic data rather than importing feature internals.
 - Visible result: the product frame reads as a dinosaur park game; developers can still inspect runtime/provider/telemetry/build state intentionally.
 - Tests: production rendering excludes diagnostic strings/controls, development rendering includes them, feature failure recovery remains available.

5. Establish shared Outcome, Explanation, Evidence disclosure primitives
 - Blocked by: #2
 - Checklist: PXF-032 through PXF-038
 - Add reusable summary/detail/Technical Details patterns, artifact identity header, named-entity link, and copy-id action. Migrate one Park inspector and one Skill detail as exemplars. Maintain semantic HTML, selectable source, keyboard toggles, focus restoration, and screen-reader names.
 - Visible result: both a world entity and a Skill present understandable meaning first and exact evidence one deliberate action away.
 - Tests: component contracts, accessibility automation, focus/expanded state, no-color-only status, raw evidence parity.

6. Complete frame migration and verify deterministic parity
 - Blocked by: #3, #4, #5
 - Checklist: PXF-039 through PXF-044
 - Migrate remaining shared frame/navigation/status uses, delete superseded presentation-only placeholders, update architecture tests and implementation docs, and run focused plus full validation. Capture before/after golden simulation/trace/Eval outputs to prove presentation work did not alter authoritative behavior.
 - Visible result: every feature renders inside the new player frame with stable routes and consistent identity/disclosure.
 - Tests: `npm run typecheck`, `npm run lint`, `npm run lint:architecture`, `npm run test:shell`, relevant domain/rendered tests, `npm run validate`, computer-use desktop/tablet smoke.

## Exit Criteria

- Every MVP player-visible record has an approachable name while canonical AI artifact types remain explicit.
- Raw ids/refs are searchable and available in Technical Details but are not ordinary labels.
- Three player-level areas replace six equal top-level choices without breaking specialist routes.
- Normal play contains no implementation/provider/build/telemetry-queue diagnostics.
- Presentation-only changes produce identical authoritative golden outputs.

