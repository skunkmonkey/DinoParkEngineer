# Application Shell Implementation

The application shell is the browser-only foundation for Dino Park Engineer. It
owns startup, feature discovery, route and mode identity, shared browser ports,
failure isolation, and safe static updates. It does not own park rules or expose
mutable domain state.

## Public boundary

Browser-facing features import shell contracts only from `src/shell/public.ts`.
Registrations use stable feature and route identifiers, an explicit requirement
level, deterministic order, a lazy loader, and an accessible failure
presentation. Registrations are validated before the shell reports ready.

Provider definitions declare stable IDs and dependencies. Startup follows the
stable dependency order; disposal runs once in exact reverse order. Public ports
offer commands and immutable snapshots rather than mutable state.

## Failure behavior

Configuration, browser-capability, provider, feature-loader, render, and update
failures use stable diagnostic codes. A required startup failure blocks the
application with retry and safe-Park recovery actions. An optional feature
failure stays on that feature's route, leaving sibling routes usable.

The shell always leaves meaningful HTML visible: the static boot surface is
present before React starts, and React replaces it with ready, unsupported,
recovery, route, or update state.

## Offline and updates

The production build generates a versioned precache from Vite output. The
running client reports install, offline-ready, update-ready, and update-failed
states. A waiting build is activated only after the persistence checkpoint says
the current session is safe. The shell never refreshes automatically over an
unsafe mutable session.

## Accessibility baseline

Shell navigation, recovery, preferences, and update actions use semantic DOM
controls and visible focus. Text scales through a root preference, high contrast
and reduced motion are explicit preferences, and status meaning is written in
text rather than carried by color or animation alone. Important transient
status also remains in the persistent shell event history.

## Validation

Use the focused shell suite while iterating and `npm run validate` at the phase
gate. Browser verification covers normal startup, deep links, unknown routes,
optional and required failures, keyboard navigation, accessibility preferences,
offline reload, and deferred versus safe update activation.

## Tooling notes

The shell pins TypeScript 5.9 because the repository's current
`typescript-eslint` release supports TypeScript 5.x and provides the strict lint
contract used by validation. `vite-plugin-pwa` generates the Workbox precache at
build time, and `tsx` lets the portable Node test runner execute TypeScript
contract and rendered tests without platform-specific shell globs.
