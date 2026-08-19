# Foundation lab

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

The Phase 3 Instruction section keeps readable Prompt prose visibly separate
from executable clauses. Its native controls run one clause-selected physical
tool request through Simulation, compare a prose-only variant, expose an
explicit Policy conflict, and reject degraded sensor evidence as sufficient
verification. The self-contained and modular approaches show exact Context
cost and dependency tradeoffs without a best-option ranking. Decision records
contain applied, rejected, and conflicting clause provenance only; they never
contain hidden reasoning.

The Phase 3 Context section exposes the exact numerical used/total Context
Capacity and category segments, plus every item's lifecycle, cost, provenance,
and exact source version. Browser scenarios compare visible disabled-closer
world state with the Worker's unavailable maintenance route, add runtime items
at a decision boundary, halt and signal on Strict overflow, and apply Keep
Newest with a persistent excluded-item list and downstream behavior. Capacity
state remains separate from missing, stale, duplicate, conflicting, and
irrelevant diagnostics.

Focused verification is `node scripts/run-tests.mjs foundation-lab`. The asset
authoring review surface is generated separately with
`npm run assets:review-report` and served on loopback for browser review with
`npm run assets:review-report:serve`; it never enters the shipped runtime asset
boundary.
