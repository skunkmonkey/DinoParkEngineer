# Player Experience - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Application Shell | Supplies routes, modes, providers, failure isolation, and lifecycle. |
| 2 | Rendering Asset Pipeline | Supplies reviewed versioned PixiJS runtime bundles and semantic metadata. |
| 3 | Park Operations | Supplies day, job, alert, incident, and operational command projections. |
| 4 | Simulation | Supplies authoritative read-only world projections. |
| 5 | Context | Supplies capacity, manifest, and diagnostic projections. |
| 6 | Trace and Replay | Supplies evidence, replay, and causal navigation projections. |

### Downstream Dependencies

Workbench, Eval Runner, Review/Deployment, Economy, Incident Response,
Orchestration, Curriculum Content, Persistence, and Telemetry contribute focused
surfaces through these presentation and navigation conventions.

## Executive Summary

Player Experience makes Dino Park Engineer feel like a living management game
rather than a technical dashboard. It owns Park View, entity selection,
Contextual Inspector, mode framing, camera and semantic zoom, visual grammar,
onboarding guidance, announcements, persistent event history, accessibility
equivalents, and causal navigation. A PixiJS three-quarter park supplies
spectacle; React DOM supplies precise, responsive, accessible operational and
engineering UI. Both render authoritative projections and issue allowed
commands.

## User Stories

### Operate the Park

- **GIVEN** the dawn opening, **WHEN** the player first sees the park, **THEN** a
  hungry dinosaur, available robot, gate, approaching visitors, and time
  pressure are understandable before substantial text.
  - **Acceptance Criteria:** A meaningful first action is available immediately
    through pointer or keyboard.
- **GIVEN** a selected entity, **WHEN** it acts or changes state, **THEN** the
  player sees identity, immediate state, intent, route, and concise inspector
  without the park becoming covered in labels.
  - **Acceptance Criteria:** Exact detail remains available without hover.

### Investigate and Navigate

- **GIVEN** a visible incident, **WHEN** the player investigates, **THEN** causal
  identity persists from park event through job, Agent action, evidence,
  artifact, eval/replay, review/deployment, and back.
  - **Acceptance Criteria:** Breadcrumbs and return actions preserve the
    originating entity and time.
- **GIVEN** production, paused production, eval, or historical replay, **WHEN**
  displayed, **THEN** labels, framing, controls, motion, and sound distinguish
  the mode without color alone.
  - **Acceptance Criteria:** An eval incident cannot reasonably be mistaken for
    production.

### Accessible Meaning

- **GIVEN** reduced motion, enlarged text, keyboard input, high contrast, or
  sound substitution, **WHEN** the player operates and investigates, **THEN**
  equivalent state, urgency, location, provenance, and consequence remain
  available.
  - **Acceptance Criteria:** Essential meaning never depends on a canvas pixel,
    transient animation, audio cue, or precise pointer action alone.

## Functional Requirements

### FR-01: Park View

- FR-01.1: Park View SHALL be the default emotional and operational home.
- FR-01.2: It SHALL project dinosaurs, robots, visitors, enclosures, gates,
  equipment, needs, routes, hazards, time, weather/environment, and relevant
  operational state from authoritative read models.
- FR-01.3: The initial camera SHALL use stable three-quarter orientation with
  pan, zoom, focus-on-event, and intelligent occlusion handling; rotation SHALL
  not be required.
- FR-01.4: Visual interpolation and animation SHALL not mutate or time the
  authoritative simulation.
- FR-01.5: Park View SHALL expose a synchronized semantic entity navigator and
  accessible state description outside the canvas.

### FR-02: Visual Grammar and Density

- FR-02.1: Needs, intent, risk, provenance, outcome, selection, degradation,
  warning, and emergency SHALL use stable shapes/icons/motion/sound/text
  semantics across park and focused modes.
- FR-02.2: Color SHALL reinforce but never solely communicate meaning.
- FR-02.3: Thought cues SHALL represent immediate need/intent and SHALL not
  become permanent floating dashboards.
- FR-02.4: Semantic zoom SHALL aggregate conditions and affected areas at
  distance and expose entities/details at closer levels.
- FR-02.5: Routine, resolved, and low-priority cues SHALL be suppressed as
  density grows; causal/spatial grouping SHALL replace icon stacking.

### FR-03: Selection and Inspector

- FR-03.1: Pointer and keyboard selection SHALL use the same stable entity IDs
  and allowed commands.
- FR-03.2: Selection SHALL outline/focus the entity, reduce irrelevant local
  motion, expose immediate intent/route, and open a concise inspector.
- FR-03.3: The inspector SHALL adapt by entity type while preserving stable
  status, provenance, jobs, incidents, and evidence sections.
- FR-03.4: Essential actions SHALL not require hover, rapid reaction, or precise
  pointer movement.

### FR-04: Modes and Causal Navigation

- FR-04.1: Park View and Inspector SHALL preserve selected simulation speed.
- FR-04.2: Workbench, Eval/Incident Replay, and Review/Deployment SHALL pause
  production by default.
- FR-04.3: Focused modes SHALL retain a thin operational anchor containing
  production state/time, rating, money, emergency count, selected version, and
  causal breadcrumb.
- FR-04.4: Production, pause, eval, and replay SHALL have persistent distinct
  mode framing and announcements.
- FR-04.5: Causal navigation SHALL preserve entity, job, trace event, artifact,
  eval, review, and return-location identity without interpreting domain rules.

### FR-05: Opening and Guidance

- FR-05.1: The first session SHALL open at dawn in the closed park, not on a
  lecture, title-card tutorial, Handbook, or Workbench.
- FR-05.2: Approaching visitors, lighting/activity, announcements, and an
  accessible time reference SHALL establish a pausable deadline.
- FR-05.3: Guidance SHALL be action-skippable and escalate from world cue to
  affordance emphasis, concise hint, and explicit help only as needed.
- FR-05.4: The opening SHALL expose one success, one observable changed gate
  condition absent from Worker context, a recoverable near miss, diagnosis,
  free eval, review, deployment, and successful opening.
- FR-05.5: Guidance use, pause, and slower speed SHALL not reduce permanent
  rewards.

### FR-06: Accessibility and Preferences

- FR-06.1: Announcements and transient cues SHALL enter persistent event history.
- FR-06.2: Text SHALL scale and reflow without hiding required actions or state.
- FR-06.3: Reduced motion, screen shake, flashing, contrast, and sound
  substitution preferences SHALL preserve semantic information.
- FR-06.4: Park navigation, entity selection, incidents, Workbench, evals, and
  deployment SHALL be keyboard operable with visible focus.
- FR-06.5: Canvas content SHALL have synchronized DOM names, states, grouping,
  and selection controls sufficient for equivalent operation.

### FR-07: Art, Audio, and Humor

- FR-07.1: Presentation SHALL follow the colorful tactile retro-futuristic
  competent-absurdity direction and reviewed asset briefs.
- FR-07.2: Dinosaurs SHALL read as animals and robots as earnest machines whose
  staged behavior follows system outcomes.
- FR-07.3: Humor SHALL primarily use animation, timing, juxtaposition,
  environmental reaction, concise announcements, and optional one-line text.
- FR-07.4: Casualties SHALL retain weight and SHALL not be individual punchlines.
- FR-07.5: Audio cues SHALL have persistent visual/text substitutes and respect
  user volume/mute settings and browser autoplay constraints.

### FR-08: Management-Game Shell and Progressive Disclosure

- FR-08.1: At 1366×768 or larger and 100% in-game text scale, Park View SHALL
  fit within one 100dvh application shell without body scrolling.
- FR-08.2: A compact HUD SHALL keep Park time, pause/speed, rating, credits,
  emergencies, and the current objective visible with the living park.
- FR-08.3: The selected-object Inspector SHALL be docked or overlaid,
  independently scrollable, dismissible, and restorable without leaving Park View.
- FR-08.4: Save, settings, Handbook, Economy, and diagnostic destinations SHALL
  use concise menus or focused modes instead of permanent page sections.
- FR-08.5: Routine presentation SHALL use deterministic friendly names. Stable
  IDs, fingerprints, reason codes, manifests, and exact versions SHALL appear
  only in deliberate evidence, replay, export, support, or diagnostic views.
- FR-08.6: Routine information SHALL follow world consequence, one concise
  operational explanation, optional engineering evidence, and optional
  Handbook depth. Long evidence SHALL scroll inside an opened panel or focused
  workspace.
- FR-08.7: The opening scene SHALL be an authored composition with terrain,
  habitat ground and boundaries, gates, feeders, water/shade, visitor paths,
  service routes, buildings, vegetation, entities, and overlays.
- FR-08.8: Presentational animation SHALL stage dinosaur, Worker Agent, gate,
  visitor, route, selection, alert, incident, and Context-retention states while
  remaining unable to advance authoritative state. Reduced motion SHALL replace
  motion with immediate states and persistent semantic records.
- FR-08.9: The visual grammar SHALL remain a design-system and optional Handbook
  reference; routine Park View SHALL NOT require or permanently display a legend.
- FR-08.10: The Shell accessibility preference port SHALL be the one persisted
  application text-scale source. Every route SHALL inherit the root scale, and
  no feature stylesheet may shadow it.

## Non-Functional Requirements

- **NFR-01: Responsiveness** - Park animation, selection, and UI remain
  responsive at measured MVP and target mature density.
- **NFR-02: Accessibility equivalence** - Alternative paths preserve meaning
  and actions, not merely disable effects.
- **NFR-03: Learnability** - Baseline players can complete the opening loop in
  approximately five minutes, subject to playtest evidence.
- **NFR-04: Cross-browser** - Supported desktop Chrome/Edge, Firefox, and Safari
  paths behave consistently within declared renderer support.
- **NFR-05: Asset resilience** - Missing optional media degrades explicitly;
  semantic state and safe controls remain available.

## Invariants

- **INV-01:** Park View is a projection, never authoritative state.
- **INV-02:** Essential meaning is not canvas-only, color-only, sound-only,
  animation-only, transient-only, or hover-only.
- **INV-03:** Mode identity is persistent and non-color-redundant.
- **INV-04:** The park presents the motivating consequence before deep technical
  interfaces explain it.
- **INV-05:** Humor never obscures safety or causality.

## Out of Scope

- Owning domain transitions, artifact versions, eval execution, or economy.
- Photorealism, mandatory camera rotation, mobile-first controls, or VR.
- A distracting live miniature park inside focused engineering modes.

## Product Decisions

- **PD-01: Hybrid DOM/canvas** - PixiJS creates the living park; React DOM owns
  semantic UI and accessibility.
- **PD-02: Stable three-quarter 2.5D** - Readability and diagnosis outrank true
  3D camera freedom.
- **PD-03: Park first** - Technical surfaces answer questions created by world
  events.
- **PD-04: Focus pauses by default** - Difficulty comes from judgment, not
  reading speed.
- **PD-05: Viewport-bound park shell** - Desktop Park View uses a stable HUD,
  dominant park viewport, contextual Inspector, and time/action strip; document
  flow is reserved for narrow or highly zoomed reflow.
- **PD-06: Friendly routine identity** - Domain IDs stay authoritative while a
  deterministic presentation projection supplies ordinary park names. Exact
  identity is evidence, not routine chrome.
- **PD-07: No prerequisite legend** - Symbols are introduced in context and
  keep accessible names and non-color treatments; visual grammar is not a
  permanent opening panel.

## Implementation Decisions

- **IMP-01:** Use PixiJS 8 with production WebGL preference; WebGPU is optional
  only after compatibility testing.
- **IMP-02:** React owns DOM chrome/inspectors; Pixi scene adapters subscribe to
  immutable projections and dispatch typed commands.
- **IMP-03:** Use source asset IDs and metadata only through
  `src/rendering-assets/public.ts`.
- **IMP-04:** Maintain a custom camera/semantic-zoom adapter rather than binding
  domain state to Pixi scene objects.
- **IMP-05:** Use CSS custom-property design tokens and CSS modules/standard CSS,
  avoiding mandatory runtime CSS-in-JS.
- **IMP-06:** Audio is behind a replaceable Web Audio port; domain events supply
  semantic cue requests, not file playback calls.

## Testing Decisions

- **TST-01:** Rendered DOM tests cover every critical mode, inspector, incident,
  context, and fallback state.
- **TST-02:** Playwright covers keyboard navigation, focus, text scale/reflow,
  reduced motion, non-color modes, event history, and axe-detectable issues.
- **TST-03:** Visual regression fixtures cover low/high density, semantic zoom,
  selection, occlusion, and generated asset consistency.
- **TST-04:** Computer-use verification is mandatory for every behavioral slice.
- **TST-05:** Human playtests, not automation alone, validate comprehension and
  accessible equivalence.

## Proposed Modules

- **MOD-01: Park Scene Adapter** - Maps read-only world projections to Pixi
  display objects and presentational animation.
- **MOD-02: Camera and Semantic Zoom** - Owns pan, zoom, focus, aggregation, and
  occlusion treatment.
- **MOD-03: Semantic Entity Navigator** - Provides synchronized DOM selection,
  grouping, exact state, and keyboard control.
- **MOD-04: Contextual Inspector** - Renders concise entity/job/incident details
  and domain-issued actions.
- **MOD-05: Mode and Causal Navigation** - Owns framing, operational anchor,
  breadcrumbs, and return paths.
- **MOD-06: Cue and Event History** - Coordinates transient presentations with
  persistent accessible records.
- **MOD-07: Preference Projector** - Applies motion, contrast, text, flash,
  shake, and sound substitutions consistently.

## Workflows

### Workflow 1: Select a Hungry Dinosaur

```text
1. Park projection shows the dinosaur's need through body and local cue.
2. The semantic navigator announces the same need and location.
3. Pointer or keyboard selects the same stable entity ID.
4. Camera focuses, local noise reduces, and the concise inspector opens.
5. The player follows the available job action without substantial mandatory text.
```

### Workflow 2: Investigate a Near Miss

```text
1. A world consequence and emergency cue identify the affected enclosure.
2. Production pauses and one grouped incident opens.
3. The player sees expected, observed, consequence, and immediate gap.
4. Causal navigation follows job, decision, context, evidence, and artifact.
5. Focused mode retains a breadcrumb and operational anchor.
6. The player returns to the exact park incident after engineering work.
```
