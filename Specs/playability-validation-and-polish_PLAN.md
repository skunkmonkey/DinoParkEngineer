<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: Playability Validation and Polish

## Goal and Owning Requirements

Prove the overhaul is more playable, accessible, deterministic, and maintainable before removing rollout scaffolding. This plan completes `player-experience_PRD.md` NFR/TST requirements and does not authorize unplanned simulation or economy redesign.

Blocked by the functional acceptance slices in the other three plans.

## Proposed Vertical Slices

1. Establish a coherent visual/audio feedback language
 - Blocked by: Graphical Park plan #6
 - Checklist: PVP-001 through PVP-008
 - Define local visual tokens, habitat silhouettes, dinosaur/robot/gate/visitor iconography, job/incident highlights, and optional local sound cues. Critical state must remain legible without audio, color, or motion. Reuse assets consistently; generated raster assets, if used, must be committed with source/prompt documentation and verified at target sizes.
 - Visible result: the Park has a cohesive game identity rather than a collection of generic panels.
 - Tests: contrast/state matrix, reduced-motion/audio-off equivalence, target-size asset review.

2. Validate responsive behavior and performance at authored maximum scale
 - Blocked by: Graphical Park plan #7, Learning Surfaces plan #7
 - Checklist: PVP-009 through PVP-016
 - Profile desktop/tablet layouts, scene updates, long traces, large Context snapshots, Eval lists, and multi-Agent operations. Virtualize or summarize only where exact evidence stays reachable. Establish performance fixtures and budgets; decorative work yields before input/state comprehension.
 - Visible result: no wall of permanently visible panels returns at narrower widths or late-game scale.
 - Tests: max fixtures, interaction latency measurements, responsive screenshots, 10k trace and 500-item Context cases.

3. Complete accessibility acceptance across graphical and technical workflows
 - Blocked by: #1, #2
 - Checklist: PVP-017 through PVP-025
 - Run automated WCAG checks plus manual keyboard, focus, screen-reader naming/order, zoom, contrast, reduced-motion, and nonvisual-map equivalence. Verify dialogs/drawers restore focus and no raw id is required for ordinary completion.
 - Visible result: the complete first learning loop works without pointer precision, color, or animation.
 - Tests: automated suite plus documented computer-use/manual checklist at desktop and tablet.

4. Instrument and run first-time-player comprehension playtests
 - Blocked by: #2, #3
 - Checklist: PVP-026 through PVP-033
 - Measure time to first meaningful action, wrong navigation attempts, visible-choice count, objective comprehension, cause-of-failure explanation, canonical-term recognition, first Eval completion, and interventions per jobs. Use local/privacy-respecting telemetry contracts already in scope. Conduct at least one internal fresh-profile walkthrough before broader playtesting.
 - Visible result: evidence shows whether the overhaul improved playability and retained learning transfer.
 - Tests: telemetry schema/consent, stable scenario ids, fresh-profile run records; record findings in Docs without silently changing normative curriculum.

5. Tune from evidence without violating invariants
 - Blocked by: #4
 - Checklist: PVP-034 through PVP-040
 - Fix comprehension, hierarchy, naming, pacing, or visual issues revealed by playtests. Any change to curriculum order, economy, failure cost, simulation, or AI concept meaning requires the owning PRD to change first. Re-run the affected vertical slice and deterministic parity suite after each meaningful adjustment.
 - Visible result: first play meets agreed usability targets while preserving authentic failure and engineering judgment.
 - Tests: targeted regression plus full acceptance for changed behavior.

6. Remove rollout scaffolding, reconcile documentation, and certify release readiness
 - Blocked by: #1-#5
 - Checklist: PVP-041 through PVP-048
 - Remove obsolete placeholders/flags/styles only after verifying no supported path uses them. Update Docs implementation notes, keyboard smoke, screenshots where maintained, architecture boundaries, and checklist status. Inspect final diff for accidental product decisions and user changes. Run complete validation and final computer-use walkthrough.
 - Visible result: one coherent supported experience with no parallel legacy player frame.
 - Tests: full `npm run validate`, production build/start smoke, fresh/save resume, deterministic golden suite, desktop/tablet computer-use acceptance.

## Exit Criteria

- First meaningful action target, canonical-term recognition, and cause-of-failure comprehension have documented playtest evidence.
- Accessibility and responsive acceptance are complete for the full first learning loop.
- Maximum authored scale remains responsive and exact evidence remains reachable.
- Specifications, Docs, tests, and implementation checklist agree with shipped behavior.
- All validation and computer-use acceptance checks pass.

