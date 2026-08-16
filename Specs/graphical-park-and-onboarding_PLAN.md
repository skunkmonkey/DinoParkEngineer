<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: Graphical Park and Guided First Play

## Goal and Owning Requirements

Make one complete observe -> act -> consequence -> diagnose -> improve -> verify loop genuinely playable from a graphical Park before expanding visual breadth. Owns `player-experience_PRD.md` FR-03 and FR-05 plus the integrated curriculum slice.

Blocked by completion of Player-Facing Identity and Product Frame slices #1-#3.

## Proposed Vertical Slices

1. Render one named habitat as an authoritative graphical scene
 - Blocked by: Player-Facing Identity plan #1-#3
 - Checklist: GPO-001 through GPO-009
 - Define stable scene metadata for habitat bounds, zones, paths, gates, feeders, dinosaur/worker/visitor anchors, and layering. Project existing ParkReadModel state into spatial scene nodes; do not add a second simulation. Render one starter habitat with visible containment, gate/device, dinosaur hunger, worker position/status, and visitor safety. Reuse CSS/SVG/local assets; asset generation must not block functional acceptance.
 - Visible result: the player can identify the habitat, dinosaur, robot, gate state, and current need without reading the entity table.
 - Tests: scene projection, state-to-cue matrix, screenshot/rendered DOM, exact nonvisual equivalent.

2. Animate authoritative job and incident events
 - Blocked by: #1
 - Checklist: GPO-010 through GPO-017
 - Map existing observable events/snapshots to presentational transitions for travel, baiting, gate operation, feeding, exit, containment verification, visitor evacuation, and incident attention. Animation cannot schedule commands or infer missing state. Implement reduced-motion state transitions and pause/speed-compatible presentation.
 - Visible result: running a feeding job visibly changes the park in the same order as its trace; pause/speed only changes presentation pace.
 - Tests: event-to-transition mapping, no duplicate command emission, speed/determinism parity, reduced-motion screenshots/computer-use smoke.

3. Add selection relationships, current objective, and contextual action
 - Blocked by: #1
 - Checklist: GPO-018 through GPO-025
 - Add curriculum-owned current objective projection, relevant-entity emphasis, selection links between dinosaur/habitat/gate/job/Agent/incident, and one contextual primary action. Move queues, filters, metrics, and full job configuration into contextual drawers/details. Preserve every command and the accessible table/list.
 - Visible result: a new player sees one objective and no more than three equally prominent choices; selecting Rex or its objective reveals the same relevant job path.
 - Tests: objective entry/completion/recovery, selection/deep-link sync, keyboard order, command parity with old controls.

4. Deliver the low-risk herbivore orientation
 - Blocked by: #2, #3
 - Checklist: GPO-026 through GPO-032
 - Author Phase 0 objective, names, fixture delta, focused Prompt choice, success state, resume behavior, and concise post-success feedback. Do not pre-explain the later specification lesson. Hide/subordinate unmotivated Workshop/Operations surfaces while direct locked routes remain honest.
 - Visible result: fresh campaign -> identify hungry herbivore -> assign Keeper One -> watch feeding -> recognize success, with a target time to first action under 45 seconds.
 - Tests: headless phase rules, fresh/resume persistence, browser acceptance, choice-count assertion where practical, computer-use walkthrough.

5. Deliver the first authentic specification/context consequence
 - Blocked by: #4
 - Checklist: GPO-033 through GPO-041
 - Author the first carnivore or containment-pressure job so failure arises from an actual missing postcondition/available-context boundary rather than artificial robot stupidity. Represent the unsecured state/incident graphically, keep costs memorable but recoverable, and offer outcome-first diagnosis. Link to the exact full trace and responsible Prompt after desire to inspect exists.
 - Visible result: player intent, Agent-available instruction/Context, action sequence, and resulting gate/containment state are understandable from the Park and concise outcome story.
 - Tests: deterministic golden failure, recovery/no-dead-end, graphical/nonvisual incident equivalence, exact trace deep link.

6. Complete Prompt improvement, first Skill, first named Evals, and safe replay
 - Blocked by: #5 and Learning Surfaces plan trace/eval/review slices as needed
 - Checklist: GPO-042 through GPO-051
 - Connect the consequence to a structured Prompt improvement or commissioned Carnivore Feeding Skill; show canonical type/title/version and Context impact. Build/select three named Evals, include one deterministic failure requiring revision, deploy intentionally, rerun the exact job safely, and compare intervention/Context outcomes.
 - Visible result: one polished end-to-end learning loop demonstrates that architecture and evaluation—not longer prose alone—improve the park.
 - Tests: integrated browser/golden test, exact fixture/seed rerun, active-version boundary, saved progress, computer-use validation.

7. Expand the scene to the MVP zone and finish accessibility/responsiveness
 - Blocked by: #6
 - Checklist: GPO-052 through GPO-060
 - Backfill all three MVP habitats and their authored visual metadata, responsive camera/layout rules, tablet drawers, keyboard spatial navigation, screen-reader entity summary, high contrast, reduced motion, and critical-state legend. Optimize update granularity so decorative animation yields before input responsiveness.
 - Visible result: all MVP habitats are visually distinct and fully operable at desktop and tablet widths.
 - Tests: max-entity performance fixture, tablet/desktop screenshots, keyboard-only and screen-reader checklist, `npm run validate`.

## Exit Criteria

- The first meaningful action is reachable from the default Park without table reading.
- One complete deterministic learning loop is graphical, recoverable, replayable, and saved.
- Graphical and nonvisual surfaces expose the same critical state and commands.
- All three MVP habitats are named, spatially legible, responsive, and deterministic.

