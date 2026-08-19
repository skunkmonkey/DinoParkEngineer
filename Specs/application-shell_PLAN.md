# Plan: Application Shell

## Environment Bootstrap Prerequisite

Before the Phase 0 environment gate installs dependencies, create the initial
npm package manifest and committed lockfile with the confirmed React, PixiJS,
Vite, TypeScript, routing, and validation dependencies. Phase 1 slice 1 owns
their configuration and application use; the environment prerequisite only
establishes the portable install boundary and pinned dependency source.

## Proposed Vertical Slices

1. **Cross-platform static shell renders a useful boot surface**
   - Blocked by: None
   - Stories: Start and Resume
   - Adds strict TypeScript, React, Vite, repository scripts, base styles,
     configuration validation, and an accessible boot/unsupported state.
   - Tests: typecheck, production build, rendered boot states, Windows and macOS
     command parity.
   - Browser proof: load by keyboard on Chrome, verify text scaling and no blank
     frame after a forced configuration error.

2. **One public feature contract loads a visible placeholder route**
   - Blocked by: #1
   - Stories: Start and Resume; Modes, Input, and Updates
   - Adds `src/shell/public.ts`, validated feature registration, stable ordering,
     lazy loading, route/mode metadata, and a placeholder Park feature.
   - Tests: registration order, duplicate rejection, route matching, direct
     reload, base-path behavior, and case-sensitive import lint.
   - Browser proof: navigate to the placeholder, deep-link reload it, and return
     through keyboard navigation.

3. **Optional failure degrades only its own route**
   - Blocked by: #2
   - Stories: Degraded Operation
   - Adds scoped render and loader boundaries, diagnostic projections, retry,
     safe-route recovery, and a test feature that intentionally fails.
   - Tests: sibling survival, preserved route state, required-versus-optional
     behavior, accessible error naming.
   - Browser proof: trigger the test failure, use retry and Park return, and
     confirm another route remains usable.

4. **Shared providers have deterministic lifecycle and safe public ports**
   - Blocked by: #2
   - Stories: Start and Resume; Degraded Operation
   - Adds provider dependency validation, stable start/dispose order,
     configuration, diagnostics, accessibility preference, and placeholder
     persistence ports.
   - Tests: lifecycle order, cycle rejection, idempotent teardown, provider
     failure scope, and architecture import rules.
   - Browser proof: change an accessibility preference, reload, and confirm the
     shell restores it without exposing mutable domain state.

5. **Offline-ready build applies updates only at a safe checkpoint**
   - Blocked by: #1, #4
   - Stories: Modes, Input, and Updates
   - Adds generated asset precaching, offline startup, cache-state projection,
     update notification, safe-checkpoint handshake, and host fallback examples.
   - Tests: first install, offline reload, changed manifest, failed update,
     deferred activation, and base-path asset URLs.
   - Browser proof: install once, switch network off, reload, then simulate an
     update and verify it cannot overwrite an unsafe session.

6. **Shell validation gate proves the foundation**
   - Blocked by: #1-#5
   - Stories: All shell stories
   - Adds architecture lint, rendered HTML checks, complete validation command,
     dependency documentation, and Windows/macOS CI jobs.
   - Tests: full repository validation and focused shell suite.
   - Browser proof: complete startup, deep link, not-found, optional failure,
     offline reload, keyboard navigation, reduced motion, and update flow.
