# Application Shell - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Modern desktop browser | Provides standards-based modules, storage, canvas, audio, keyboard, and pointer input. |
| 2 | Static file host | Optional delivery mechanism; local development remains fully supported. |

### Downstream Dependencies

Every browser-facing feature depends on the shell for bootstrap, route
registration, shared providers, lifecycle, configuration, and failure
isolation. Domain packages do not depend on browser shell internals.

## Executive Summary

The Application Shell supplies the smallest reliable browser foundation on
which Dino Park Engineer can grow. It starts the static application, identifies
the active mode, loads feature entry points in deterministic order, composes
shared capabilities, reports degraded operation clearly, and keeps one failed
optional feature from blanking the rest of the game. It behaves consistently on
Windows and macOS development machines and on supported desktop browsers.

## User Stories

### Start and Resume

- **GIVEN** the built game assets are available, **WHEN** the player opens the
  application, **THEN** the core shell starts without an account, secret,
  backend, or model request.
  - **Acceptance Criteria:** A useful loading, ready, recovery, or unsupported
    state is always visible; the page never remains blank.
- **GIVEN** a valid deep link or restored route, **WHEN** startup completes,
  **THEN** the intended feature opens while preserving a direct path back to
  Park View.
  - **Acceptance Criteria:** Route resolution is stable across reloads and
    independent of feature discovery timing.

### Degraded Operation

- **GIVEN** an optional feature cannot load, **WHEN** the player reaches or
  starts the application, **THEN** unaffected features remain usable and an
  actionable explanation identifies the unavailable capability.
  - **Acceptance Criteria:** A feature failure cannot blank a sibling route or
    destroy current authoritative state.
- **GIVEN** a required feature or configuration is invalid, **WHEN** bootstrap
  detects it, **THEN** startup blocks explicitly with diagnostic and recovery
  actions rather than silently substituting behavior.
  - **Acceptance Criteria:** The player can retry, return to a safe route, or
    export available diagnostics as applicable.

### Modes, Input, and Updates

- **GIVEN** any primary surface, **WHEN** it is active, **THEN** the shell
  exposes its route and mode identity to navigation, accessibility, and test
  surfaces.
  - **Acceptance Criteria:** Production, paused production, eval, and replay
    cannot be confused because a route failed to provide its mode contract.
- **GIVEN** a newer static build is ready, **WHEN** an update would replace the
  running application, **THEN** the player receives a non-destructive update
  choice and unsaved progress is protected.
  - **Acceptance Criteria:** The shell never refreshes over active play without
    an explicit safe transition.

## Functional Requirements

### FR-01: Bootstrap

- FR-01.1: The shell SHALL render an immediate boot state before loading
  optional features.
- FR-01.2: Bootstrap SHALL validate configuration and required feature
  registrations before reporting ready.
- FR-01.3: Startup SHALL be idempotent and SHALL dispose prior listeners and
  providers during development reload or test teardown.
- FR-01.4: Core startup SHALL not require network access after static assets
  have been made available offline.

### FR-02: Feature Registration

- FR-02.1: A browser-facing feature SHALL register through a public contract
  containing a stable ID, route contribution, load function, deterministic
  order, requirement level, and failure presentation.
- FR-02.2: Registrations SHALL be validated and ordered deterministically.
- FR-02.3: Duplicate IDs, duplicate route ownership, invalid ordering, or
  missing required features SHALL fail explicitly.
- FR-02.4: Optional features SHALL load lazily and SHALL be isolated from
  sibling failure.
- FR-02.5: Domain packages SHALL NOT import shell internals; browser features
  SHALL consume only `src/shell/public.ts`.

### FR-03: Routes and Modes

- FR-03.1: Route matching SHALL be deterministic, base-path aware, and
  independent from import completion order.
- FR-03.2: Unknown routes SHALL resolve to an accessible recovery surface with
  a safe Park View action.
- FR-03.3: Every route SHALL declare a stable mode identity and title.
- FR-03.4: Route transitions SHALL preserve causal navigation state supplied by
  owning features without the shell interpreting domain identifiers.
- FR-03.5: Static-host deployment SHALL support clean routes through host
  fallback configuration without requiring hash routing in normal play.

### FR-04: Providers and Lifecycle

- FR-04.1: The shell SHALL compose shared configuration, clock scheduling,
  persistence access, accessibility preferences, audio, feature status, and
  diagnostics through replaceable public ports.
- FR-04.2: Provider dependencies SHALL be explicit and cycle-free.
- FR-04.3: Provider startup and disposal order SHALL be deterministic.
- FR-04.4: No provider SHALL grant UI code direct mutation access to
  authoritative domain state.

### FR-05: Failure and Update Handling

- FR-05.1: Route, feature, provider, and render failures SHALL identify scope,
  severity, recovery actions, and a stable diagnostic code.
- FR-05.2: A failure surface SHALL be keyboard operable and readable without
  relying on color.
- FR-05.3: The offline asset cache SHALL distinguish first install, ready,
  update available, update failed, and offline-ready states.
- FR-05.4: Applying an update SHALL require a safe persistence checkpoint or an
  explicit confirmation that no mutable session state will be lost.

### FR-06: Cross-Platform Development

- FR-06.1: All repository scripts owned by the shell SHALL run through npm on
  Windows PowerShell and macOS shells without platform-specific path syntax.
- FR-06.2: Imports and route IDs SHALL be checked with case-sensitive semantics
  so Windows development cannot create macOS-only failures.
- FR-06.3: Generated build output SHALL use base-aware URLs and portable file
  names.

## Non-Functional Requirements

- **NFR-01: Startup clarity** - A meaningful shell state SHALL render promptly;
  exact budgets will be established by measured builds.
- **NFR-02: Isolation** - One optional feature failure SHALL not blank another.
- **NFR-03: Accessibility** - Boot, navigation, recovery, and update actions
  SHALL be keyboard and screen-reader operable.
- **NFR-04: Static portability** - The production output SHALL consist of static
  assets suitable for local serving or a conventional static web host.
- **NFR-05: Testability** - Feature discovery, routes, provider lifecycle, and
  failures SHALL be testable without starting the simulation.

## Invariants

- **INV-01:** The shell coordinates browser concerns but owns no park rules.
- **INV-02:** UI and feature code cannot mutate authoritative state directly.
- **INV-03:** Registration and startup order never depend on filesystem or
  network timing.
- **INV-04:** Optional failure cannot blank the core application.
- **INV-05:** Runtime gameplay never requires a server, account, model, or
  secret.

## Out of Scope

- Park simulation and economy rules.
- Feature-specific screen layout or visual semantics.
- Cloud accounts, multiplayer, server rendering, and remote saves.
- Runtime OpenAI integration.

## Product Decisions

- **PD-01: Static client application** - The game remains local-first and may be
  hosted without a runtime backend.
- **PD-02: Clean routes** - Normal play uses readable paths; hosting adapters
  supply fallback behavior rather than degrading all URLs to hashes.
- **PD-03: Explicit degradation** - Missing capability is visible and scoped.

## Implementation Decisions

- **IMP-01: Confirmed stack** - Use strict TypeScript, React 19, Vite, and npm
  with Node.js `>=22.13.0`; use the current Node.js 24 LTS for development.
- **IMP-02: Client-only React** - Use React DOM without server components or
  server-side rendering.
- **IMP-03: Public shell boundary** - `src/shell/public.ts` is the only shell
  import surface available to features.
- **IMP-04: Route library encapsulation** - React Router may implement matching,
  but its types SHALL not leak through the shell public contract.
- **IMP-05: Offline build** - Use generated Workbox precaching with an explicit
  safe-update adapter.
- **IMP-06: Portable scripts** - Use Node scripts rather than OS-specific shell
  scripts for repository automation.

## Testing Decisions

- **TST-01:** Contract tests cover validation, stable ordering, duplicates,
  missing required entries, and lazy optional entries.
- **TST-02:** Rendered tests cover boot, not-found, required failure, optional
  failure, offline-ready, and update-ready states.
- **TST-03:** Architecture lint rejects shell-internal imports and direct UI
  domain mutation.
- **TST-04:** Production builds and validation run on Windows and macOS CI.
- **TST-05:** Browser verification exercises keyboard startup, navigation,
  fallback, reload, and offline startup.

## Proposed Modules

- **MOD-01: Bootstrap Runtime** - Validates configuration, starts providers,
  discovers features, and reports readiness through one small lifecycle API.
- **MOD-02: Feature Registry** - Validates, orders, loads, and reports feature
  registrations while isolating optional failure.
- **MOD-03: Route Host** - Matches routes, carries mode metadata and causal
  navigation payloads, and owns not-found recovery.
- **MOD-04: Provider Graph** - Starts and disposes explicit shared ports in
  stable dependency order.
- **MOD-05: Failure Boundary** - Converts scoped failures into stable,
  actionable projections.
- **MOD-06: Offline Update Coordinator** - Reports cache state and applies
  updates only at a safe checkpoint.

## Workflows

### Workflow 1: Successful Startup

```text
1. Render the boot surface.
2. Load and validate static configuration.
3. Start shared providers in dependency order.
4. Discover and validate feature registrations.
5. Match the requested route and load its feature.
6. Render the active mode and report offline readiness.
```

### Workflow 2: Optional Feature Failure

```text
1. A lazy optional feature fails to load or initialize.
2. The registry records a scoped diagnostic code.
3. The route renders an actionable unavailable surface.
4. Sibling routes and authoritative state remain usable.
5. The player retries or returns to Park View.
```

### Workflow 3: Safe Static Update

```text
1. A new precached build becomes ready.
2. The shell shows a non-disruptive update notice.
3. The player chooses to update.
4. Persistence confirms a safe checkpoint.
5. The new build activates and restores the prior route or a safe fallback.
```
