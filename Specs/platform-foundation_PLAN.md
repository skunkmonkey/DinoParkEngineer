<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: Platform Foundation

## Implementation Boundary

This feature owns the visible product frame, canonical destination navigation, global presentation services, shared presentation primitives, formatters, glossary, simulation-control presentation, and display-only preferences. It consumes `application-shell` extension points. It MUST NOT modify root project bootstrapping, application entry, route runtime/registry, provider composer, configuration/error infrastructure, or define domain entities, authoritative stores, simulation logic, content records, save schemas, or feature-specific screens.

Expected owned surface (adapt to the selected framework without changing ownership):

```text
src/platform/**
src/ui/**
src/shared/formatters/**
tests for those paths
```

Other features own their route content and register it through `application-shell`. Platform Foundation may supply canonical navigation metadata and presentation adapters but SHALL NOT wrap or replace the shell registry. Do not add placeholder domain types to a generic `shared` folder; the feature that owns a concept owns its contract.

## Required Public Contracts

Implement equivalents of these framework-neutral contracts and export them from a documented public entry point:

```ts
type PrimaryDestination = 'park' | 'agents' | 'engineering' | 'evals' | 'reviews' | 'progress';

interface PrimaryDestinationPresentation {
  id: PrimaryDestination;
  routeId: string;
  label: string;
  iconLabel: string;
  order: number;
}

interface SimulationControlPort {
  getState(): { paused: boolean; speed: 1 | 2 | 4 };
  setPaused(paused: boolean): Promise<void> | void;
  setSpeed(speed: 1 | 2 | 4): Promise<void> | void;
  subscribe(listener: () => void): () => void;
}

interface NotificationPort {
  publish(message: { id: string; level: 'info'|'success'|'warning'|'error'; title: string; detail?: string; action?: Command }): void;
}
```

Contract rules:

- Destination presentation refers to route ids already registered through `application-shell`; it does not load route modules.
- The product frame never imports a feature's internal store.
- Formatting functions are pure and locale-explicit.
- Provider subscriptions return cleanup functions.
- Route modules may be absent while work is in progress.

## Proposed Vertical Slices

1. Product frame mounted on the runnable Application Shell
   - Blocked by: `application-shell`
   - Stories: Application Entry and Navigation
   - Register the Platform Foundation module through the shell contract; replace the diagnostic home with semantic product frame, canonical Park home, global regions, and honest unavailable destination presentation. Do not change shell bootstrap or route-runtime internals.

2. Navigate all primary destinations through registered lazy routes
   - Blocked by: #1
   - Stories: Application Entry and Navigation
   - Register/present six canonical destinations using Application Shell route ids, active navigation state, direct URLs, and back/forward behavior. Style the shell's loading/Not Found/failure states. Verify a deliberately failing fake route cannot take down the frame.

3. Shared accessible status and operations primitives
   - Blocked by: #1
   - Stories: Accessible Use, Global Controls and Feedback
   - Add the minimum deep primitive set: panel/layout, tabs, drawer/dialog, data table shell, meter, labeled status/severity badge, empty/error state, and notification region. Include examples/tests for severity 0-4, pass/fail, stale, conflict, and blocked without color-only meaning.

4. Provider-backed pause and speed controls
   - Blocked by: #2, #3
   - Stories: Global Controls and Feedback
   - Connect controls to a contract fake, show confirmed/pending/unavailable states, and prove the shell does not advance time. Cover keyboard control and 1x/2x/4x/paused state changes.

5. Preferences, glossary help, and responsive/accessibility hardening
   - Blocked by: #2, #3
   - Stories: Accessible Use
   - Persist reduced-motion preference, add canonical terminology help, tablet drawer behavior, skip link, focus restoration on route/dialog changes, and documented keyboard smoke test. Run accessibility and production-build checks.

## Integration Verification

- Mount Platform Foundation and two fake feature modules using only exported `application-shell` and foundation public APIs.
- Exercise direct load, navigation, refresh, feature render failure, retry, and return-to-Park.
- Inject a fake `SimulationControlPort`; assert commands and confirmed rendering.
- Run unit tests, component tests, accessibility checks, type checking, linting, and production build.
- Confirm Platform Foundation does not modify/import Application Shell internals, future domain internals, or require an external network/LLM dependency.

## Completion Gate

The feature is complete when it is registered as an ordinary `application-shell` feature module; downstream routes appear in the product frame without foundation-internal edits; optional simulation controls integrate through the public presentation port; all six destinations are keyboard reachable and refresh safe; feature failures retain the frame; and the combined shell/foundation build passes its documented checks.
