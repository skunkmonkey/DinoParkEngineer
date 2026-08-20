# Game Experience Remediation Brief

## Mandatory

Adopt the persona of a successful game developer with 25+yrs of experience. Think as that persona would think, approach problems as they would approach them, stay in role.
You are passionate about this game idea and you are excited to improve this game to make it very fun, and intuitive.

## Purpose

The Phase 7 build proves the deterministic simulation and engineering workflows,
but its presentation does not yet deliver the intended game experience. This is
now a product-quality blocker, not optional polish.

The next implementation pass must preserve the deterministic domain engines,
replayability, accessibility, and exact engineering evidence while replacing the
current document-like presentation with a coherent management-game interface.

## Current-build evidence

A connected-Chrome audit of `/park` confirmed the feedback against the Phase 7
build:

- At a 1710×952 viewport, the document is 5,013 pixels tall—about 5.3 screens.
- The actual park scene does not begin until roughly 1,208 pixels down the page,
  so no part of the park is visible in the initial viewport.
- Twelve global navigation buttons precede play, followed by mode narration,
  an `Operational anchor`, and an `Action-skippable opening guidance` card.
- Routine Park View exposes raw values including
  `prompt:self-contained-feeding@1.0.0`, `dinosaur:tria`,
  `location:enclosure`, and `job:schedule-morning-feed-day-1-tick-0`.
- The visible interface includes the headings `Visual grammar`,
  `Semantic navigation`, and `Entity navigator`, plus text explaining rendering,
  deterministic ticks, authoritative state, accessibility redundancy, and
  future incident fields.
- The park scene is a small bounded panel beside a text-heavy inspector. Its
  enclosure, path, gates, dinosaurs, robot, and worker read as overlaid objects
  rather than a coherent functioning park.
- Selecting 150% in the Park View text-scale control changes the root custom
  property to `1.5`, but `.player-experience` still computes
  `--dpe-player-font-scale: 1`; its base font remains 16px and its heading remains
  24px. This is a confirmed implementation defect, not subjective preference.

Before changing code, read:

1. `AGENTS.md`, `checklist.md`, `Specs/application_PRD.md`, and
   `coding_standards.md`.
2. `Specs/player-experience_PRD.md` and its PLAN.
3. `Docs/brainstorming_session.md` and `Docs/game_planning_session.md`, especially
   the decisions on player fantasy, UI attention flow, visual language, opening
   experience, progressive disclosure, and fun pillars.
4. The current Park, Workbench, Eval, Review, Incident Response, Persistence,
   Economy, and Curriculum views plus `src/styles/global.css` and
   `src/styles/tokens.css`.

Do not reinterpret this work as a generic visual redesign. The original intent
is specific:

- The park is the emotional center; engineering interfaces provide leverage.
- Players learn through visible consequence, investigation, revision, and
  watching the improved system work.
- It should feel like a colorful, tactile, slightly retro-futuristic 2.5D
  management sim with “competent absurdity,” not an enterprise dashboard or a
  childish cartoon.
- Routine play is concise. Exact technical evidence is available on deliberate
  inspection.
- Canonical AI-engineering terms remain where they teach a real concept:
  Prompt, Skill, System Prompt, context, memory, eval, trace, deployment, Worker
  Agent, Manager Agent, and orchestration.
- Deterministic state must never be derived from prose, animation, canvas state,
  wall-clock timing, or network/LLM output.

## Issues to fix

### P0 — The product reads as a website, not a game

Current symptoms:

- Generic headers, navigation links, bordered cards, headings, paragraphs, and
  form controls dominate the experience.
- The living park is one card among many instead of the primary playfield.
- Debug/demo controls and acceptance-test explanations are visible as normal
  player UI.

Required outcome:

- Make Park View a full game shell centered on the living park.
- Use a compact HUD for park time, speed/pause, rating, credits, emergencies,
  and the current objective.
- Put the selected-object inspector in a docked panel or overlay that can be
  opened and dismissed without leaving the park.
- Move Save, accessibility, Handbook, Economy, and other secondary systems into
  concise menus, drawers, or focused modes rather than permanent page sections.
- Remove developer-demo narration such as explanations of authoritative state,
  deterministic ticks, asset provenance, browser audio locking, and test
  behavior from routine play. Preserve this information only where it is useful
  in diagnostics, the Handbook, or deliberate evidence inspection.

Acceptance:

- A first-time player looking at Park View can identify the hungry dinosaur,
  available robot, opening pressure, time controls, rating, and credits without
  reading an explanatory paragraph.
- The park, not a navigation bar or text card, is the largest and strongest
  visual element.
- The player performs the first meaningful feeding action before encountering
  substantial mandatory text.

### P0 — Excessive text and missing progressive disclosure

Current symptoms:

- Several screens expose every status, instruction, explanation, history item,
  provenance record, and control simultaneously.
- Empty-state prose explains hypothetical future behavior.
- Routine actions are surrounded by implementation and accessibility
  explanations.

Required outcome:

- Apply the information hierarchy from the planning session:
  1. world consequence,
  2. one concise operational explanation,
  3. optional engineering evidence,
  4. optional Handbook depth.
- Use short labels, icons with accessible names, meters, spatial cues, and
  one-line status messages for routine operation.
- Collapse exact traces, manifests, retention records, long histories, and
  diagnostic detail behind explicit actions such as `Inspect evidence`,
  `View trace`, or `Advanced details`.
- Do not render explanatory empty states when a compact state such as
  `No active incidents` is sufficient.
- Limit onboarding assistance to the accepted escalation sequence: world cue,
  affordance emphasis, concise hint, explicit help. Acting must skip guidance.

Acceptance:

- At the opening Park View, no uninterrupted explanatory copy block exceeds two
  short lines at the default desktop size.
- The first operational screen contains only information relevant to the next
  decision; exact evidence remains reachable in no more than two deliberate
  interactions.
- Screen-reader users retain equivalent state and can reach the same deeper
  evidence without forcing that evidence into the default visual layout.

### P0 — The app is an enormous scrolling document

Current symptoms:

- Primary play controls, inspector, preferences, retention demo, and history are
  stacked vertically in the document.
- A player must scroll away from the park to operate important systems.

Required outcome:

- At default text scale on a maximized 1366×768 or larger desktop viewport,
  Park View must fit within one `100dvh` game shell without body scrolling.
- Use a stable layout: compact top HUD, dominant park viewport, contextual side
  inspector, and compact time/action strip. Exact dimensions may adapt, but the
  hierarchy must remain.
- Long content must scroll inside a deliberately opened panel, drawer, modal,
  or focused engineering workspace—not by extending the entire game page.
- Focused Workbench/Eval/Review modes may contain internally scrolling evidence
  panes, but must retain the thin operational anchor and primary actions within
  the viewport.
- Responsive layouts may stack on small screens. Do not sacrifice desktop game
  presentation to make every surface a single generic document flow.

Acceptance:

- At 1366×768 and 1440×900, the park, HUD, inspector summary, and time controls
  are simultaneously usable without document scrolling at 100% text scale.
- Opening any long evidence view does not move the primary action off-screen;
  the evidence container scrolls independently with correct focus management.
- Keyboard focus is never trapped or lost when drawers and focused modes open
  or close.

### P0 — Player-facing stable IDs and internal terminology

Current symptoms:

- Raw values such as `incident:opening-near-miss`, `gate:beta`, trace IDs,
  assertion IDs, reason codes, fingerprints, and version references frequently
  appear as primary labels.
- Labels such as `Semantic navigation` and `Entity navigator` describe the
  implementation rather than the player's task.

Required outcome:

- Add a centralized presentation projection for friendly names. Domain state
  keeps stable IDs; UI renders names such as `North Paddock Gate`, `Robot Alpha`,
  `Vera`, `Opening-Day Near Miss`, and `Safe Feeding Prompt v2`.
- Exact IDs remain available in an `Advanced details`, trace, replay, export, or
  diagnostic view where exact identity matters.
- Replace implementation-centric labels with game/task language. For example:
  - `Semantic navigation` / `Entity navigator` → remove the visible heading;
    present a concise `Park roster` only if the spatial view cannot provide the
    needed accessible selection path.
  - `Logical tick` → `Park time` in routine play; exact tick stays in replay and
    trace evidence.
  - `Causal investigation path` → `What happened` or `Investigate`.
  - `Operational anchor` → no visible meta-label; show the information as the
    focused-mode HUD.
  - `Persistent destinations` and reason codes → player-readable retention
    outcomes, with exact codes in advanced evidence.
- Do not remove the canonical AI terms listed above. They belong in the
  Engineering Workbench when the associated concept is genuinely in play.
- Keep ordinary park concepts in ordinary park language. Do not rename gates,
  dinosaurs, incidents, or park controls with AI jargon.

Acceptance:

- No raw stable ID, fingerprint, diagnostic code, reason code, or database term
  appears in the default Park View.
- Every entity and event has a stable, deterministic player-facing name.
- Exact identity remains inspectable for replay, support, and engineering
  diagnosis without becoming the primary label.

### P0 — Park art lacks coherence and readable spatial design

Current symptoms:

- The scene reads as scattered objects on a background rather than a functioning
  dinosaur park.
- The path reads as a brown streak rather than a designed circulation route.
- Enclosures, boundaries, service access, visitor space, landscaping, and
  operational relationships are not visually convincing.

Required outcome:

- Redesign the opening scene as a coherent authored composition, not random
  coordinate placement.
- Establish clear layers: terrain, enclosure ground, fence/boundary, gates,
  visitor paths, service routes, buildings/props, vegetation, entities, effects,
  and selection/alert overlays.
- Give each enclosure a readable boundary, entrance, internal habitat, feeder,
  shade/water/vegetation treatment, and connection to service and visitor
  routes.
- Make paths intentional through consistent width, edges, junctions, materials,
  and destinations. Use landscaping and props to integrate paths into the park.
- Ensure dinosaurs, robots, gates, visitors, and hazards have distinct
  silhouettes and sensible scale.
- Use the planned natural palette as the base and reserve strong operational
  colors for selection, degraded state, warning, and emergency.
- Preserve the stable three-quarter camera and handle occlusion without
  requiring rotation.
- Use approved, versioned assets and keep rendering illustrative; simulation
  state remains authoritative.

Acceptance:

- A screenshot without text labels is recognizable as an intentionally designed
  automated dinosaur park.
- A player can visually trace Robot Alpha's route from service area through the
  correct gate to the feeder.
- Gate state, dinosaur need, selected entity, visitor approach, and an active
  hazard are readable through shape, placement, and motion—not color alone.

### P0 — Missing animation and living-world feedback

Current symptoms:

- Entities largely appear as static sprites or jump between states.
- Success, failure, route intent, park activity, and humor are explained in text
  rather than shown.

Required outcome:

- Add deterministic presentation animation for at least:
  - dinosaur idle/need/feed/satisfied behavior,
  - robot idle/move/carry/operate/feed/verify behavior,
  - gate open/close/degraded/spark states,
  - visitor convoy approach and visitor movement,
  - selection, route preview, alerts, and incident focus,
  - visible context-retention movement to Excluded, Compacted, or Externalized.
- Interpolate visuals between authoritative logical states. Animation may
  present a state transition but must never decide or advance simulation state.
- Add ambient movement sparingly so a stable park is pleasurable to watch.
- Reduce irrelevant ambient motion around a selected entity or emergency.
- Use motion, timing, environmental reaction, and concise optional captions for
  humor.
- Every animation needs a reduced-motion equivalent and persistent semantic
  record. Reduced motion should use immediate state changes, static route/state
  indicators, and concise announcements.

Acceptance:

- The complete first feeding can be understood by watching the park: selection,
  route, gate operation, robot movement, feeding, containment verification, and
  dinosaur response are visibly staged.
- The near miss is visually legible before the player opens its incident text.
- Running the same commands produces the same authoritative outcome regardless
  of animation duration, frame rate, reduced-motion preference, or tab focus.

### P1 — The visible “Visual grammar” legend signals an unintuitive UI

Current symptoms:

- Park View contains a player-facing `Visual grammar` section explaining what
  the interface symbols mean.

Required outcome:

- Remove the permanent visible legend from routine play.
- Keep a visual grammar as an internal design-system rule and optional Handbook
  reference, not a prerequisite for operating the opening.
- Introduce symbols in context, pair unfamiliar symbols with short labels until
  learned, and keep meaning consistent across Park, Inspector, Workbench, Eval,
  and Replay.
- Validate icons through first-look testing; do not assume a legend repairs an
  unclear scene.

Acceptance:

- Representative players can identify need, intent, selected state, degraded
  gate, warning, and emergency without first reading a legend.
- Removing the legend does not remove accessible names, non-color treatments,
  or Handbook reference material.

### P0 — Text scaling is scoped incorrectly and behaves inconsistently

Current evidence:

- `PlayerExperience` writes `--dpe-player-font-scale` on the document root, but
  `.player-experience` redeclares that custom property as `1`, overriding the
  selected value for the very subtree it is intended to scale.
- Feature routes outside Player Experience do not consistently consume the
  player preference.

Required outcome:

- Establish one persisted application-wide text-scale source owned by the shell
  accessibility preference port.
- Apply the scale at the application root. Do not shadow it in feature-level
  CSS.
- Make every route consume the same preference, including Workbench, Eval,
  Review/Deployment, Incident Response, Persistence, Economy, Curriculum,
  dialogs, menus, HUD, tooltips, and recovery/error surfaces.
- Support browser zoom as well as the in-game text preference. Use `rem`, `em`,
  `clamp`, flexible tracks, wrapping, and internal scrolling rather than fixed
  text boxes.
- Keep controls, labels, evidence, and focus indicators visible at all supported
  sizes. Do not solve overflow by clipping text or shrinking interactive targets.
- Persist the preference across route changes, reload, save/load, and offline
  restart.

Acceptance:

- Changing text scale visibly changes all player-facing text immediately and
  consistently without a route reload.
- Verify 100%, 125%, and 150% in-game scale on every Phase 7 route, plus browser
  zoom at 100%, 150%, and 200% on the critical Park → incident → Workbench →
  Eval → Review → Park path.
- At 200% browser zoom, reflow is allowed and document scrolling may be
  necessary, but no content or critical control is clipped, overlapped, or
  unreachable.
- Add automated coverage that would fail if a feature shadows or ignores the
  application text-scale variable.

## Implementation sequence

Implement this as coherent vertical slices, not a single CSS cleanup:

1. **Presentation model and copy:** add friendly-name projections, separate
   routine labels from advanced evidence, remove internal/test narration, and
   preserve exact IDs behind deliberate inspection.
2. **Viewport game shell:** create the desktop HUD/park/inspector/action-strip
   layout, move secondary systems to drawers or focused modes, and establish
   internal scrolling/focus behavior.
3. **Authored opening park:** rebuild scene composition and spatial hierarchy
   with approved assets and clear routes, boundaries, habitats, and operational
   landmarks.
4. **Living-world motion:** stage the first feeding and near miss visually,
   then add restrained ambient life and reduced-motion equivalents.
5. **Focused engineering modes:** apply progressive disclosure and viewport
   containment to Workbench, Eval, Review, Incident Response, Persistence,
   Economy, and Curriculum without weakening exact evidence or decisions.
6. **Accessibility preference repair:** centralize and persist text scaling,
   then verify keyboard, focus, contrast, reduced motion, screen-reader
   structure, browser zoom, and offline behavior.
7. **Playtest and tune:** run first-look, five-minute opening, and density tests.
   Revise hierarchy and cue design based on observed behavior rather than adding
   more explanatory text.

For each slice, update the owning spec if behavior or navigation changes, add
focused tests, use connected Chrome for real keyboard and visual verification,
and run the repository validation required by `AGENTS.md` before completion.

## Definition of done

This remediation is complete only when all of the following are true:

- The opening reads immediately as a dinosaur-park management game.
- Park View fits a normal maximized desktop viewport at default scale and keeps
  the primary operation visible.
- The park is coherent, animated, and enjoyable to watch during stable
  operation.
- Routine play is concise; precise engineering evidence remains available on
  demand.
- Default game UI uses friendly names and task language, while exact stable IDs
  remain available in advanced evidence.
- Canonical AI-engineering concepts are taught through mechanics and
  consequences, not removed or replaced with vague fictional terminology.
- No permanent visual-grammar explanation is needed to perform the opening.
- Text scaling works consistently across all routes and survives persistence.
- Keyboard, screen-reader, high-contrast, reduced-motion, sound-substitution,
  zoom/reflow, offline, deterministic replay, and save/load guarantees still
  pass.
- Representative newcomer and experienced Agent-user playtests confirm that the
  interface is legible, the failure is credible, and the first loop is learned
  through play rather than a wall of text.

## Non-goals and safeguards

- Do not replace the deterministic engines with an LLM or animation-driven
  logic.
- Do not delete traceability, stable IDs, manifests, versions, or provenance;
  change when and how they are presented.
- Do not remove canonical AI-engineering terminology from the focused
  engineering experience.
- Do not turn the game into a reflex-action game; pause and speed controls remain
  available and consequences remain deterministic.
- Do not use color, motion, sound, hover, or transient timing as the only carrier
  of essential information.
- Do not add decorative art before the opening route, enclosure logic, entity
  silhouettes, state cues, and interaction hierarchy are coherent.
- Do not mark the human playtest criteria complete using AI self-assessment.
