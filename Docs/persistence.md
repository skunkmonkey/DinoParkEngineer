# Persistence boundary

`persistence/` owns save envelopes, repository commit/recovery, staged feature
restore, autosave scheduling, migrations, and cross-feature transactions. Domain
packages only provide `FeatureStateAdapter`/`FeatureStatePort` implementations;
the persistence package does not reach through domain stores or browser APIs.

## Guarantees

- Canonical JSON + FNV-1a checksums cover every envelope except the checksum and
  byte-count metadata. Byte counts are fixed-point calculated and enforced on
  import.
- Repositories stage and decode a complete save before swapping the active
  pointer. Browser storage keeps `active`, `temp`, and last-known-good `backup`
  keys in a namespaced storage adapter.
- Loads validate every adapter and its canonical hash before restoring anything.
  Restores capture old snapshots and compensate in reverse order if activation
  fails, leaving the live session unchanged when rollback succeeds.
- Autosaves coalesce concurrent requests, never overlap writes, and trigger at
  authored logical-time intervals or major park/economy events. Requests queued
  behind an active write resolve with their own follow-up commit result. Park
  logical-time advancement is published even when it produces no world event,
  so periodic autosave does not depend on incidental activity.
- Migrations operate on deep copies, run in deterministic source-version order,
  validate every output, reject future versions, and retain the original slot.
- Transaction ids bind participant sets and produce one committed result;
  duplicate execution returns the original result without re-running work.
  Participants without checkpoint and restore/recover ports are rejected before
  work. Production purchase, commission, eval, and deploy workflows bind the
  exact economy, registry, review/deployment, eval, and trace participants they
  can mutate. An `undefined` checkpoint is valid present state and is still
  passed to restore/recover after failure.

The standard adapter factory covers simulation, content registry, memory,
reviews, traces, economy/progression, agent/jobs/incidents, context, evals,
deployment, curriculum, and orchestration ports. The Save / Recovery route is
registered as `/save` inside the product frame and keeps display preferences
outside gameplay state. The production provider registers ten live full-park
sections, resolves exact historical artifact refs through the shared registry,
pauses the park at a safe snapshot boundary, and restores memory/trace stores by
replacement rather than additive hydration. The temporary safe pause is silent,
is not persisted as player state, and releases back to the exact prior pause and
speed state after both successful and failed writes. Status and errors are announced to
assistive technology, and deleting the manual slot requires a visible explicit
confirmation.

## Verification

`tests/persistence.test.ts` has 14 passing tests proving exact simulation
continuation, production ten-section full-park round trip, logical clock/PRNG and
historical refs, staged restore failure isolation, exact memory/trace
replacement, coalesced autosave generations, browser backup/quota recovery,
unavailable repository/ref handling, all named adapter registrations, injected
prepare/work/commit and production workflow failures, undefined checkpoint
recovery, safe-boundary release, eventless periodic autosave, real UI workflow
wiring, and a real eval-build/run/deploy/revert chain with deployment autosave.
It also covers sequential migrations, source immutability, confirmation-gated
import, and corrupt/future/oversize rejection. Full typecheck and lint,
architecture and shell contracts, rendered HTML checks, and the production build
pass with the bundled runtime.
