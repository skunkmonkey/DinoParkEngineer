# Trace and Replay

`src/trace-replay/public.ts` is the only supported import surface for Trace and
Replay. The package consumes authoritative records from Simulation, Instruction,
Context, and Content Registry; it never infers causes from a rendered view.

## Trace records

`captureAuthoritativeTrace` (also exported as `captureTrace`) accepts an exact
root, pinned content manifest, seed, initial world state, and ordered event
drafts. Every event has a schema version, stable ID, logical tick, sequence,
entity links, and causal parent IDs. Event payloads cover Task identity,
Context manifests and Retention Policy results, clause applicability and
conflicts, decisions, tool requests/results, evidence, world deltas, messages,
delegation, outcomes, incidents, and snapshots.

Capture is append-only and finalized atomically as `complete`, `interrupted`,
`invalid`, or `incomplete`. A recorder failure produces a visible
`capture-fault` event and a stable fault record without touching the simulation
that supplied the authoritative values.

The Zod schemas are strict. Trace payloads reject unknown fields, and the
prohibited-field scan rejects hidden reasoning, chain-of-thought, scratchpad,
and similar fields at every nesting level. Readable Prompt, Skill, and System
Prompt prose is therefore never treated as a reasoning channel.

## Projections and links

`projectConciseTrace` exposes the outcome, consequence, and immediate causal gap
first. `projectDetailedTrace` groups immutable events into decision cycles and
retains Context availability distinctions: `available`, `unavailable`,
`excluded`, `stale`, and `never-routed`. `projectCausalLinks` retains stable IDs
for jobs, Agents, entities, artifacts, evidence, evals, incidents, reviews,
and deployments. Filtering returns a projection only; the underlying trace is
never rewritten.

## Historical replay and verification

`createReplaySession` clones the authoritative initial state and applies
recorded snapshots/deltas in an isolated historical session. `play`, `pause`,
`step`, `advance`, `seek`, `setSpeed`, and `focus` are deterministic controls;
the session is always labeled `historical-replay` and cannot mutate production
state. Missing exact content, incompatible schemas, and incomplete traces are
reported as diagnostics rather than replaced with current content.

`verifyTraceRerun` calls the Simulation replay contract with the trace's exact
state, versions, commands, and final tick. It compares command results, world
deltas/events, and final state and reports the first mismatch path. The same
function supports an explicit replacement command list for like-for-like eval
or revised-artifact comparisons.

`compareTraces` aligns cycles by stable cycle ID (or deterministic tick fallback)
and reports matched, left-only, and right-only cycles. Context, clauses, actions,
evidence, cost, world outcome, and final outcome are compared independently;
the comparator does not infer causality beyond recorded links.

