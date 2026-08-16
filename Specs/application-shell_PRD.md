# Application Shell - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

None. This is the first implementation feature and the only feature authorized to bootstrap the application repository.

### Downstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | `platform-foundation` | Builds the visible product frame on the shell's route, provider, error-boundary, and styling extension points. |
| 2 | Every other MVP feature | Adds feature-owned modules through the shell's public registration and composition contracts. |

## Executive Summary

Application Shell creates the runnable web application in which every Dino Park Engineer feature will reside. It establishes the supported web stack, development/build/test commands, application entry point, root route runtime, global provider composition, error isolation, configuration handling, and public feature-module contract. It provides a minimal diagnostic home screen so the repository is runnable and testable before gameplay features exist.

The shell is infrastructure, not gameplay. It does not define dinosaur entities, game state, visual product design, navigation content, simulation behavior, context, evals, credits, saves, or authored curriculum. Its purpose is to let isolated feature agents add modules without editing central bootstrap files or importing one another's internals.

## User Stories

### Start the Application

- **GIVEN** a clean checkout with supported tooling installed, **WHEN** a developer runs the documented development command, **THEN** a local Dino Park Engineer application opens without requiring external services or secrets.
  - **Acceptance Criteria:** Development startup, automated tests, type checking, linting, and production build each have one documented command and succeed in the shell-only repository.
- **GIVEN** a production build, **WHEN** its entry URL or a registered client route is opened directly, **THEN** the application loads rather than returning a route-specific failure.
  - **Acceptance Criteria:** A shell smoke test covers the root and a registered nested route under production-like serving.

### Integrate an Isolated Feature

- **GIVEN** a feature module that implements the published shell contract, **WHEN** it is registered, **THEN** its route and providers become available without editing shell internals.
  - **Acceptance Criteria:** A contract-test fixture mounts two lazy feature modules using public exports only.
- **GIVEN** an optional feature that is absent or fails to load, **WHEN** the player uses another feature, **THEN** the rest of the application remains usable.
  - **Acceptance Criteria:** Missing, loading, and failed-module states are distinguishable and recoverable.

### Recover From Application Errors

- **GIVEN** a feature render/load failure, **WHEN** it occurs, **THEN** a boundary contains it and offers retry and return-home actions.
- **GIVEN** an unrecoverable root bootstrap failure, **WHEN** it occurs, **THEN** the application displays a minimal non-blank diagnostic instead of an infinite loading state.

## Functional Requirements

### FR-01: Repository Bootstrap

- FR-01.1: The feature SHALL establish one supported, documented web application toolchain with pinned dependency and runtime requirements.
- FR-01.2: It SHALL provide commands for development, unit/component tests, type checking, linting/format validation, and production build.
- FR-01.3: It SHALL provide a minimal production-like static serving command or documented test harness for route fallback verification.
- FR-01.4: The application SHALL start without an LLM, third-party API, account, secret, or network dependency after local assets are installed.
- FR-01.5: Build output, caches, local environment files, and test artifacts SHALL be ignored appropriately without hiding source/configuration required by collaborators.

### FR-02: Application Entry and Composition

- FR-02.1: There SHALL be exactly one browser application entry point and one root composition module.
- FR-02.2: The root composition module SHALL initialize shell-owned infrastructure and registered feature modules; it SHALL not initialize feature-owned domain stores directly.
- FR-02.3: Feature providers SHALL be composed through deterministic registration order and explicit dependencies.
- FR-02.4: Duplicate feature, route, command, or provider identifiers SHALL fail fast in development and produce a stable diagnostic.
- FR-02.5: Development-only diagnostics SHALL be excluded or inert in production builds unless explicitly safe.

### FR-03: Feature Module Contract

- FR-03.1: A feature module SHALL declare stable id, owned route registrations, optional provider registrations, and optional startup/disposal hooks.
- FR-03.2: Feature modules SHALL load lazily unless explicitly marked as startup-critical.
- FR-03.3: Registration SHALL occur through a public shell entry point; no feature SHALL need to modify the root composition module.
- FR-03.4: The shell SHALL detect route conflicts and invalid parent/child route relationships before rendering the conflicting feature.
- FR-03.5: Startup hooks SHALL not return authoritative game state or depend on another feature's private implementation.

### FR-04: Route Runtime

- FR-04.1: The shell SHALL support refresh-safe client routes, nested routes, route parameters, query strings, and browser back/forward navigation.
- FR-04.2: The shell SHALL expose route metadata sufficient for `platform-foundation` to render navigation and document titles.
- FR-04.3: Unknown routes SHALL render a recoverable Not Found result with a public home-route action.
- FR-04.4: Loading and failed lazy routes SHALL have domain-neutral fallback states that `platform-foundation` can visually replace.
- FR-04.5: Route runtime SHALL not encode the six canonical product destinations; those registrations belong to `platform-foundation` and feature modules.

### FR-05: Error and Lifecycle Boundaries

- FR-05.1: The shell SHALL provide root and per-feature/route error boundaries.
- FR-05.2: One feature's render, load, startup, or disposal failure SHALL not crash successfully isolated sibling features.
- FR-05.3: Errors SHALL have stable category/code, feature/route id when known, recoverability, and safe human-readable summary.
- FR-05.4: Arbitrary error objects, save contents, source text, memory, traces, or secrets SHALL not be rendered automatically.
- FR-05.5: Startup and disposal SHALL be idempotent under development remounting and test environments.

### FR-06: Runtime Configuration

- FR-06.1: Build-time and runtime configuration SHALL be accessed through one validated configuration service.
- FR-06.2: Missing required configuration SHALL fail at startup with an actionable diagnostic; optional values SHALL have explicit defaults.
- FR-06.3: Browser-delivered configuration SHALL be treated as public and SHALL not contain secrets.
- FR-06.4: Core shell operation SHALL require no environment-specific configuration beyond documented local defaults.

### FR-07: Minimal Diagnostic Surface

- FR-07.1: Before `platform-foundation` is integrated, the root route SHALL show a minimal accessible application name, build state, registered feature list, and readiness/error summary.
- FR-07.2: The diagnostic surface SHALL make no claims about game state and SHALL be replaceable through the public home-route registration.
- FR-07.3: The production product SHALL not expose verbose development diagnostics by default.

## Non-Functional Requirements

- **NFR-01: Supported Environment** - Document the exact runtime/package-manager versions; support current and previous major Chromium, Firefox, and Safari versions for the browser runtime.
- **NFR-02: Startup Performance** - The shell-only production application SHALL render its diagnostic surface within 1 second after local static assets are available on a typical development laptop.
- **NFR-03: Build Reproducibility** - A clean install using the committed lockfile SHALL produce a successful build and test run without undeclared global packages.
- **NFR-04: Type Safety** - Public feature, route, provider, configuration, and error contracts SHALL be statically typed and runtime-validated at untrusted/dynamic boundaries.
- **NFR-05: Accessibility** - Minimal loading, failure, diagnostic, and Not Found states SHALL use semantic landmarks, accessible names, visible focus, and keyboard actions.
- **NFR-06: Security** - No runtime code evaluation, arbitrary HTML injection, client secret storage, or remote module loading is permitted in MVP.
- **NFR-07: Isolation** - A feature module SHALL consume only other features' published entry points; shell lint/boundary checks SHALL reject known private-path imports.

## Invariants

- **INV-01:** Application Shell owns no authoritative gameplay state or business rules.
- **INV-02:** There is one application entry and root composition point.
- **INV-03:** Feature integration does not require editing shell internals.
- **INV-04:** Registration identifiers and ordering are deterministic.
- **INV-05:** A noncritical feature failure cannot blank the entire application.
- **INV-06:** Core startup does not require an LLM, network service, account, or secret.
- **INV-07:** Browser-visible configuration is never considered secret.

## Out of Scope

- Product navigation styling, shared game UI primitives, glossary, notifications, simulation controls, and display preferences; these belong to `platform-foundation`.
- Any gameplay domain model, state store, content, route screen, or application service.
- Authentication, authorization, server backend, cloud hosting, CI provider configuration, deployment pipeline, monitoring vendor, or analytics delivery.
- Save-game storage, offline service worker/PWA installation, multiplayer, remote plugins, or module federation.
- Choosing post-MVP hosting or API architecture.

## Product Decisions

- **PD-01: Web application first** - The product is a desktop-first browser application, not a native wrapper or server-rendered content site.
- **PD-02: Runnable before gameplay** - The first implementation outcome is a clean, testable shell that proves extension contracts.
- **PD-03: Local core** - The shell and eventual deterministic core remain usable without external AI/network services.
- **PD-04: Honest partial integration** - Missing features show unavailable states; the shell never fabricates game data to appear complete.

## Implementation Decisions

- **IMP-01: One selected stack** - The implementing agent SHALL inspect repository constraints, select one mature TypeScript web stack, document the choice, and avoid maintaining parallel alternatives.
- **IMP-02: Contract-first feature modules** - Route/provider registration types and boundary tests are implemented before downstream feature work.
- **IMP-03: Public entry points** - Each feature package exposes a single documented public entry point; lint or architecture tests prevent private imports.
- **IMP-04: Replaceable adapters** - Environment/configuration/error reporting are accessed through ports so later hosting/telemetry choices do not alter bootstrap.
- **IMP-05: No speculative backend** - Do not add a server, database, API client, authentication, or state library until an owning feature requires it.

## Testing Decisions

- **TST-01: Clean-checkout test** - Automated verification SHALL install from lockfile and run typecheck, lint, test, and build commands.
- **TST-02: Feature contract fixtures** - Tests mount two valid lazy features and reject duplicate ids/routes and private imports.
- **TST-03: Failure isolation** - Tests cover startup, lazy-load, render, and disposal failures plus root bootstrap fallback.
- **TST-04: Route behavior** - Direct nested load, Not Found, parameters/query, back/forward, and production fallback are tested.
- **TST-05: No gameplay tests** - Domain behavior belongs to downstream features and SHALL not be mocked into the shell suite.

## Proposed Modules

- **MOD-01: ApplicationBootstrap** - Validates configuration, creates the feature registry, initializes critical infrastructure, and mounts root composition behind one public start function.
- **MOD-02: FeatureModuleRegistry** - Validates and deterministically composes feature ids, routes, providers, and lifecycle hooks without exposing mutable internals.
- **MOD-03: RouteRuntime** - Owns client-route matching/history/lazy loading and returns domain-neutral loading/error/not-found states.
- **MOD-04: ProviderComposer** - Orders explicit provider dependencies and isolates startup/disposal failures.
- **MOD-05: ShellErrorBoundary** - Converts unsafe thrown values into safe structured diagnostics and contains feature failures.
- **MOD-06: RuntimeConfig** - Loads and validates public configuration through a small immutable query API.
- **MOD-07: ArchitectureGuard** - Tests/lint configuration enforcing public entry points and dependency direction.

## Workflows

### Workflow 1: Start a Clean Checkout

```text
1. Developer installs the documented runtime and dependencies from the lockfile.
2. Developer runs the development command.
3. RuntimeConfig validates local defaults.
4. ApplicationBootstrap creates registries and composes critical providers.
5. RouteRuntime resolves the root route.
6. The minimal diagnostic surface renders with registered feature readiness.
```

### Workflow 2: Register a Downstream Feature

```text
1. Feature exports one FeatureModule from its public entry point.
2. Shell discovers/registers the module through the supported composition mechanism.
3. Registry validates ids, route ownership, and provider dependencies.
4. Route remains lazy until requested.
5. On navigation, the module loads inside its feature boundary.
6. Failure affects only that route and presents retry/home recovery.
```

### Workflow 3: Reject an Invalid Integration

```text
1. A module declares a duplicate route id or missing provider dependency.
2. Registry returns a stable diagnostic before the route renders.
3. The invalid module remains unavailable.
4. Other valid modules and the diagnostic home remain usable.
5. Development output identifies the owning feature and violated contract.
```
