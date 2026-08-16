<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: Application Shell

## Implementation Boundary

This is the only feature authorized to create or replace root repository/application bootstrap files. It owns the selected web toolchain, lockfile, application entry, root composition, route runtime, dynamic feature-module registry, provider composition, runtime configuration, root/feature error boundaries, architecture dependency checks, and shell-only tests/documentation.

Expected owned surface (adapt names to the selected stack while preserving ownership):

```text
root package/toolchain/build/test/lint/format configuration
dependency lockfile and source-control ignore rules
src/main.* or equivalent single browser entry
src/shell/**
src/shell/public.*
src/features/registration.* (composition only; no feature internals)
tests/shell/**
```

It MUST NOT create domain types “for later,” game stores, simulation state, styled product navigation, shared game UI components, feature screens, service/database/API/authentication scaffolding, save storage, or analytics. `platform-foundation` owns the visible product frame and UI system after this feature is complete.

## Stack Selection Gate

Before editing, the implementing agent SHALL inspect existing repository files and any governing instructions. If no stack is already mandated, choose one mature TypeScript client stack using these constraints:

- Strong static typing and current supported tooling.
- Client routing with direct-load/static-host fallback support.
- Component and headless unit testing without external accounts.
- Accessible component composition; no required proprietary service.
- A single package/workspace unless multiple packages solve an immediate documented boundary.

Record the chosen runtime, package manager, UI framework, router, test runner, linter/formatter, and minimum versions in the repository README or shell-owned developer document. Commit the generated lockfile. Do not compare or scaffold multiple candidate stacks.

## Required Public Contracts

Implement framework-appropriate equivalents and export them from one shell public entry point:

```ts
type FeatureId = string & { readonly __featureId: unique symbol };
type RouteId = string & { readonly __routeId: unique symbol };

interface FeatureModule {
  id: FeatureId;
  routes?: readonly ShellRouteRegistration[];
  providers?: readonly ProviderRegistration[];
  initialize?(context: ShellLifecycleContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

interface ShellRouteRegistration {
  id: RouteId;
  path: string;
  parentId?: RouteId;
  title?: string;
  load: () => Promise<RouteComponent>;
}

interface ProviderRegistration {
  id: string;
  dependsOn?: readonly string[];
  create(context: ProviderContext): unknown | Promise<unknown>;
  dispose?(instance: unknown): void | Promise<void>;
}

interface ShellRegistration {
  register(module: FeatureModule): Result<void, readonly RegistrationDiagnostic[]>;
  listFeatures(): readonly FeatureReadiness[];
}

interface PublicRuntimeConfig {
  buildId: string;
  mode: 'development' | 'test' | 'production';
  basePath: string;
}
```

Contract rules:

- Feature, route, and provider ids are stable and globally unique.
- Registrations are validated before activation and returned in stable id order.
- Provider dependency cycles/missing dependencies are rejected with the complete path.
- Route modules are lazy; initialization must not eagerly import their private implementation.
- A subscription/lifecycle API always exposes cleanup.
- Public returned collections are immutable/read-only.
- The registry has no generic service-locator API for domain code; explicit public ports remain preferred.
- Shell errors use safe structured codes and never stringify arbitrary application state.

## Proposed Vertical Slices

1. Clean checkout to runnable, testable, buildable application
   - Blocked by: None
   - Execution mode: AFK
   - Stories: Start the Application
   - Inspect repository constraints; select and document one TypeScript web stack; add pinned package metadata/lockfile, application entry, minimal semantic diagnostic home, development/test/typecheck/lint/build commands, ignore rules, and a smoke test. Verify no external service, secret, backend, or LLM is required.

2. Direct-load route runtime with honest fallback states
   - Blocked by: #1
   - Execution mode: AFK
   - Stories: Start the Application, Recover From Application Errors
   - Add client history routing, nested/parameter/query support, direct production-like nested load, Not Found, lazy loading state, browser back/forward, safe document-title metadata, and root route recovery. Keep product destinations out of shell code.

3. Register two isolated lazy feature modules
   - Blocked by: #2
   - Execution mode: AFK
   - Stories: Integrate an Isolated Feature
   - Implement public FeatureModule/route contracts, deterministic registry, composition mechanism that does not require root edits per feature, duplicate/conflict diagnostics, and two contract-test fixtures. Prove a feature imports only the shell public entry point.

4. Compose providers and lifecycle dependencies safely
   - Blocked by: #3
   - Execution mode: AFK
   - Stories: Integrate an Isolated Feature
   - Add explicit provider dependency graph, stable initialization/disposal, missing/cycle rejection, idempotent development remount behavior, startup readiness, and tests for asynchronous creation/disposal. Do not introduce a general domain service locator.

5. Isolate feature failures and validate configuration
   - Blocked by: #3, #4
   - Execution mode: AFK
   - Stories: Recover From Application Errors
   - Add root and route/feature error boundaries, retry/home actions, safe error normalization, RuntimeConfig validation/defaults, missing/invalid configuration diagnostics, and tests for startup, lazy-load, render, and disposal failures. Confirm verbose diagnostics are development-only.

6. Enforce architecture and clean-checkout completion
   - Blocked by: #1-#5
   - Execution mode: AFK with human review of selected stack and public contracts
   - Stories: All
   - Add import-boundary/architecture checks, public-entry documentation, a sample downstream integration guide, clean-install verification, production route-fallback test, accessibility smoke tests for all shell states, startup measurement, and final removal of unused scaffold/demo code.

## Integration Verification

- Start from a clean dependency installation using only committed metadata/lockfile.
- Run development startup, unit/component tests, typecheck, lint/format validation, and production build.
- Serve the production output and directly open root, valid nested, parameterized, and invalid routes.
- Register two lazy fixture features and dependent providers through public contracts only.
- Inject duplicate ids/routes, missing/cyclic providers, lazy-load failure, render failure, and disposal failure; verify stable diagnostics and sibling availability.
- Search imports to confirm features cannot reach shell internals or other fixture-private paths.
- Confirm the built application makes no network request required for startup and contains no secrets/backend/game domain logic.

## Completion Gate

Application Shell is complete when a fresh agent can clone/install/run/test/typecheck/lint/build the application from documented commands; a downstream feature can register lazy routes/providers without changing shell internals; direct client routes work under production-like serving; invalid integrations and feature failures are isolated; architecture checks enforce public imports; and no gameplay, visual product foundation, backend, account, network service, secret, or runtime LLM has entered the shell.
