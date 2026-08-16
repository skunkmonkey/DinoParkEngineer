# Platform Foundation - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | `application-shell` | Supplies the runnable web stack, application entry, route/module registration, provider composition, configuration, and error boundaries. |

### Downstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Every other MVP feature | Uses the navigation frame, shared visual language, global feedback, formatters, accessibility conventions, and presentation ports established here. |

## Executive Summary

Platform Foundation turns the runnable `application-shell` scaffold into the recognizable, desktop-first Dino Park Engineer product frame. The player receives coherent navigation, responsive layout, global feedback, pause/speed controls, terminology help, and accessible interaction conventions even before every gameplay destination is implemented.

This feature is deliberately thin in domain behavior. It provides product presentation and global UI ports on top of shell extension points, but does not own application bootstrap, route mechanics, simulation, economy, engineering, eval, save, or orchestration rules.

## User Stories

### Application Entry and Navigation

- **GIVEN** a supported browser, **WHEN** the player opens the game, **THEN** the application loads into a usable Park destination without a network model dependency.
  - **Acceptance Criteria:** A fresh load renders a header, primary navigation, main content region, and non-blocking placeholder for destinations not yet integrated.
- **GIVEN** any primary destination, **WHEN** the player chooses Park, Agents, Engineering, Evals, Reviews, or Finance/Progress, **THEN** the selected destination and browser history update predictably.
  - **Acceptance Criteria:** Refresh and back/forward navigation preserve the selected destination.

### Global Controls and Feedback

- **GIVEN** a simulation-backed screen, **WHEN** the player pauses or selects 1x, 2x, or 4x, **THEN** the control emits an explicit request and displays the confirmed speed.
  - **Acceptance Criteria:** The shell never advances logical time itself and distinguishes pending from confirmed state.
- **GIVEN** a recoverable error or completed transaction, **WHEN** it occurs, **THEN** the player receives a concise message with a relevant recovery action.

### Accessible Use

- **GIVEN** keyboard-only or reduced-motion use, **WHEN** the player navigates the shell, **THEN** all global actions remain available with visible focus and no required animation.

## Functional Requirements

### FR-01: Product Frame and Navigation

- FR-01.1: The application SHALL provide persistent primary navigation for Park, Agents, Engineering, Evals, Reviews, and Finance/Progress.
- FR-01.2: The product frame SHALL provide a single main landmark and global status/notification region inside the boundaries supplied by `application-shell`.
- FR-01.3: Each primary destination SHALL be registered through the `application-shell` route contract with direct URL metadata and active navigation state.
- FR-01.4: The initial route SHALL resolve to Park.
- FR-01.5: Unavailable feature destinations SHALL render an honest unavailable/coming-soon state, never fabricated data.

### FR-02: Global Simulation Controls

- FR-02.1: The shell SHALL display pause, 1x, 2x, and 4x controls whenever a simulation control provider is connected.
- FR-02.2: Controls SHALL invoke a provider-owned command and reflect provider-confirmed state.
- FR-02.3: The shell SHALL not contain clock, event queue, or simulation transition logic.

### FR-03: Shared Presentation Language

- FR-03.1: The application SHALL define reusable presentation primitives for panels, tabs, drawers, dialogs, badges, meters, tables, empty states, severity labels, and status labels.
- FR-03.2: Pass/fail, warning, severity, stale, conflict, and blocked states SHALL always include text or iconography in addition to color.
- FR-03.3: AI-engineering terminology SHALL use the canonical terms in `application_PRD.md`.
- FR-03.4: The shell SHALL expose contextual glossary help without forcing modal tutorials.

### FR-04: Global Preferences

- FR-04.1: The player SHALL be able to enable reduced motion.
- FR-04.2: The shell SHALL remember non-gameplay display preferences locally.
- FR-04.3: Gameplay state SHALL not be stored by this feature.

### FR-05: Presentation Integration

- FR-05.1: The foundation SHALL register the canonical product frame and home behavior through the public `application-shell` feature-module contract.
- FR-05.2: Global commands, notifications, and destination badges SHALL use foundation-owned public interfaces rather than direct imports into foundation internals.
- FR-05.3: Missing optional providers SHALL degrade to explicit unavailable states without crashing the shell.

## Non-Functional Requirements

- **NFR-01: Browser Support** - Support the current and previous major versions of Chromium, Firefox, and Safari; desktop-first and usable at tablet widths of 768 CSS pixels and above.
- **NFR-02: Accessibility** - Meet WCAG 2.2 AA for the shell, including focus order, landmarks, names, contrast, keyboard operation, and reduced motion.
- **NFR-03: Performance** - The foundation-only production build SHALL show usable shell content within 2 seconds on a typical development laptop after assets are available locally.
- **NFR-04: Offline Core** - Shell startup SHALL not require an LLM or any third-party runtime service.
- **NFR-05: Isolation** - Domain features SHALL use `application-shell` for route/module loading and foundation public ports for presentation; neither feature's internals may be imported.

## Invariants

- **INV-01:** The shell does not own authoritative game state.
- **INV-02:** The shell does not calculate simulation time or outcomes.
- **INV-03:** A global status cannot be communicated by color alone.
- **INV-04:** Feature absence cannot prevent unrelated destinations from loading.
- **INV-05:** Canonical AI terms are not replaced with fantasy-only synonyms.

## Out of Scope

- Simulation rules, entities, tools, or incidents.
- Authentication, cloud sync, multiplayer, mobile-first layouts, and online services.
- Park map rendering and domain destination content.
- Save-game serialization.
- Runtime theme marketplace or user-authored themes.

## Product Decisions

- **PD-01: Developer-operations presentation** - Use a clean operations-console aesthetic over a readable park schematic, not photorealism.
- **PD-02: Six primary destinations** - Finance and Progress share one secondary destination to keep engineering work central.
- **PD-03: Pause-friendly UX** - No global interaction requires twitch timing.

## Implementation Decisions

- **IMP-01: Shell/foundation separation** - `application-shell` owns technical composition and boundaries; Platform Foundation owns the visible frame and presentation services.
- **IMP-02: One shared component vocabulary** - Cross-feature status, severity, and layout primitives are foundation-owned to prevent parallel teams from producing incompatible variants.
- **IMP-03: Deterministic formatting helpers** - Display helpers for game time, context units, credits, and stable identifiers accept values and return presentation only; they do not query stores.

## Testing Decisions

- **TST-01: Test product-frame behavior** - Cover canonical navigation integration, provider absence, keyboard navigation, branded recovery presentation, and preference persistence using the shell's contract test harness.
- **TST-02: Accessibility automation plus keyboard smoke test** - Automated checks are required but do not replace a documented manual focus-order check.
- **TST-03: No domain mocks in foundation unit tests** - Use minimal contract fakes so the shell remains independent.

## Proposed Modules

- **MOD-01: ProductFrame** - Mounts navigation and global regions around the route outlet supplied by `application-shell`.
- **MOD-02: PresentationRegistry** - Registers destination badges, notifications, and optional global presentation providers without duplicating shell route/provider composition.
- **MOD-03: UIPrimitives** - Provides accessible, visually consistent primitives and domain-neutral status treatments.
- **MOD-04: DisplayPreferences** - Owns reduced-motion and shell-only preferences.
- **MOD-05: GameFormatters** - Formats logical time, CU, credits, and severity consistently from supplied values.

## Workflows

### Workflow 1: Launch and Navigate

```text
1. Player loads the application.
2. Application Shell initializes registered modules; Platform Foundation initializes display preferences and the product frame.
3. Park is selected by default.
4. Player navigates to Engineering.
5. The route updates; the registered Engineering module renders or an explicit unavailable state appears.
```

### Workflow 2: Feature Failure Isolation

```text
1. A destination throws during rendering.
2. Its Application Shell route boundary catches the failure.
3. The Platform Foundation frame remains navigable and presents the recovery state.
4. The player sees Retry and Return to Park actions.
5. A structured application error is offered to the telemetry provider when present.
```
