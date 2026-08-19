# Phase 2 foundation lab

`/foundation-lab` is the browser verification surface for Integration Gate A.
It is an optional shell feature that composes only the public Content Registry
and Simulation contracts. React renders frozen projections and issues typed
Simulation commands; it never owns or directly edits authoritative world state.

The registry section exposes available Prompt v1 and hidden Prompt v2, their
exact dependencies and manifest fingerprints, and a deterministic malformed
optional package. The malformed package reports stable diagnostics while the
valid catalog remains inspectable.

The world section loads Simulation Scenario v1 and its exact tool dependencies
through the Content Registry, then registers a hidden Scenario v2. The v1
manifest fingerprint and replay remain unchanged. Browser controls exercise
safe feeding, stale-command atomic rejection, physical-versus-sensor evidence,
an escape with visitor consequences, shared-gate contention, pause/speed request
semantics, and exact repeated replay. Every result is retained in persistent DOM
evidence and all controls are native keyboard-operable elements.

Focused verification is `node scripts/run-tests.mjs foundation-lab`. The asset
authoring review surface is generated separately with
`npm run assets:review-report` and served on loopback for browser review with
`npm run assets:review-report:serve`; it never enters the shipped runtime asset
boundary.
