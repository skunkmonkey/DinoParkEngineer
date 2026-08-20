# Plan: Player Experience

## Proposed Vertical Slices

1. **Dawn Park View renders one dinosaur, robot, gate, and approaching visitors**
   - Blocked by: Shell #1-#4, Rendering Assets #1-#4, Simulation #1-#4,
     Park Operations #1
   - Adds PixiJS scene adapter, three-quarter projection, pan/zoom, time controls,
     semantic DOM entity navigator, responsive layout, mode frame, and one need
     cue using exact runtime asset IDs.
   - Tests: projection-only boundary, selection identity, keyboard/pointer parity,
     pause/speed, asset fallback, text reflow, and reduced motion.
   - Browser proof: understand and select the hungry dinosaur without mandatory
     explanatory text using pointer and keyboard paths.

2. **Contextual Inspector assigns and follows the first feeding job**
   - Blocked by: #1, Park Operations #2
   - Adds outlines, local motion suppression, intent/route, adaptive inspector,
     job assignment action, exact state, event history, and visible focus.
   - Tests: allowed-command dispatch, no direct mutation, entity variants,
     no-hover path, screen-reader naming, and persistent announcement.
   - Browser proof: assign feeding, watch success, and inspect the linked job.

3. **The changed gate condition becomes a readable recoverable near miss**
   - Blocked by: #2, Park Operations #3, Trace #2
   - Adds faulty/degraded visual language, emergency interrupt, focus-on-event,
     intelligent occlusion, grouped incident, auto-pause, persistent non-color
     severity, and concise causal gap.
   - Tests: mode/pause, grouped incident, cue redundancy, casualty-safe tone,
     reduced motion, sound substitution, and return state.
   - Browser proof: notice the maintenance condition, experience the near miss,
     inspect one incident, and distinguish world truth from Agent context.

4. **Causal navigation reaches trace and returns to the same park event**
   - Blocked by: #3, Trace #3
   - Adds focused-mode operational anchor, stable breadcrumbs, production/pause/
     eval/replay framing, trace deep links, route restoration, and frozen event
     summary.
   - Tests: every forward/back identity, deep-link reload, unavailable target,
     non-color mode distinction, and production unchanged.
   - Browser proof: travel park → incident → job → action → evidence → artifact
     placeholder → replay and back.

5. **Opening guidance teaches through action and disappears when unnecessary**
   - Blocked by: #1-#4, Curriculum Content opening slice
   - Adds guidance escalation, action-skipping, timers based on logical/player
     interaction state, concise hints, explicit help, and preference persistence.
   - Tests: early action skips hints, delayed escalation, pause/speed no penalty,
     reload, keyboard guidance, and no hidden reward effect.
   - Browser proof: complete guided and unguided variants of the opening.

6. **Semantic zoom and cue suppression preserve mature-park readability**
   - Blocked by: #1-#4, Orchestration fleet projections
   - Adds far/mid/near aggregation, causal/spatial clusters, fleet pressure,
     priority suppression, high-density navigation, and measured render budgets.
   - Tests: stable aggregation, selected/critical exceptions, hidden-routine
     semantics, keyboard groups, and low-power/reduced-motion variants.
   - Browser proof: locate a critical incident in a mature-density fixture.

7. **Player Experience validation gate**
   - Blocked by: #1-#6
   - Adds cross-browser Playwright projects, axe scans, visual fixtures,
     performance captures, complete accessibility checklist, and validation.
   - Browser proof: opening, selection, incident, causal navigation, all modes,
     semantic zoom, keyboard-only, text scale, contrast, sound substitution, and
   reduced motion on Windows and macOS browser targets.

## Game Experience Remediation Slices

8. **Friendly presentation and concise routine copy**
   - Adds deterministic friendly names, task-language labels, and deliberate
     `Inspect evidence` / `Advanced details` boundaries.
   - Tests: default Park chrome contains no implementation headings or routine
     stable IDs; exact identity remains inside semantic disclosures.

9. **Viewport management-game shell**
   - Replaces permanent global navigation, preferences, retention demo, and
     history sections with shell drawers, a Park HUD, dominant viewport,
     dismissible Inspector, and persistent time/action strip.
   - Browser proof: 1366×768 and 1440×900 at 100% require no body scrolling;
     Inspector, log, settings, and menu open/close without losing focus.

10. **Authored park composition and living-world motion**
    - Rebuilds terrain, habitats, boundaries, gates, routes, landmarks, water,
      shade, landscaping, and overlays in the projection-only Pixi adapter.
    - Adds presentational dinosaur, robot, visitor, gate, route, need, selection,
      and emergency motion with reduced-motion static equivalents.

11. **Focused-mode disclosure and root accessibility preferences**
    - Keeps focused-mode orientation/primary actions in their viewport and
      moves long exact evidence into internal scrollers or disclosures.
    - Exposes the Shell accessibility port to every route; text scale inherits
      from the persisted root variable without feature shadowing.

12. **Remediation validation and human playtest gate**
    - Runs complete validation plus connected-Chrome critical-path, keyboard,
      focus, scale, zoom, contrast, reduced-motion, and offline checks.
    - Representative newcomer and experienced Agent-user comprehension remain
      external human gates and cannot be completed by AI self-assessment.
