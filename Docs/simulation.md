# Simulation foundation

`src/simulation/public.ts` is the only supported import surface. Simulation is
the sole owner of physical park truth: consumers receive frozen projections and
can change the world only through validated commands.

Authoritative state is plain structured-clone-compatible data. Collections are
lexically ordered by stable namespaced ID, quantities are bounded integers, and
time advances only in integer logical ticks. Pause and the `1x`, `2x`, and `4x`
speed setting describe tick-request behavior; they do not change a tick's rules.
Scheduled work resolves by tick, numeric priority, then stable transition ID.

Scenario fixtures pin their registry identity and every tool/content version.
`loadScenarioFixture` resolves the exact registry manifest and then applies the
Simulation-owned Zod schema and world invariants. Missing or incompatible
content blocks before tick zero. Replay starts from a snapshot and applies
commands by decision tick in their recorded array order through the production
engine. Replay inputs preserve the fixture's exact content references and
command allowlist.

Commands validate completely against a cloned draft before commit. Rejections
leave state unchanged and use stable diagnostic codes. Batches are atomic.
Gates keep physical position separate from sensor reading and evidence names
both its source and reliability. Reservations make shared-resource contention
explicit. Dinosaur and visitor consequences follow world location, gate state,
need, and exposure rather than ambient randomness. Named seeded random streams
are part of snapshots and may be consumed only through the exported deterministic
PRNG utility; authoritative code never uses an ambient random source.

The focused suite is `npm run test -- simulation`. It covers fixture validation,
serialization, immutable projections, time controls, movement, gates, degraded
sensors, command failure atomicity, tools, feeding, escape, visitor casualties,
evacuation, contention, replay, and speed/frame-request independence. The module
has no browser-only dependencies; the same ESM public contract executes in Node
and browser bundles. Browser-visible computer-use verification belongs to
Integration Gate A, because this foundation intentionally exposes no UI route.
