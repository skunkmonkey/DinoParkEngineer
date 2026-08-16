# Plan: Deterministic Simulation Core

## Implementation Boundary

Own `simulation/**`, its public contract, authored fixture validation, and headless tests. Do not implement feature UI, instruction clauses, context, memory, evals, credits, saves, or orchestration. Other modules command the engine only through the port below.

## Required Public Contracts

```ts
interface SimulationEngine {
  load(fixture: WorldFixture, seed: number): Result<void, FixtureError[]>;
  command(command: WorldCommand): ToolResult;
  advanceTo(logicalTime: number): readonly WorldEvent[];
  runNext(): WorldEvent | null;
  snapshot(): WorldSnapshot;
  pendingEvents(): readonly ScheduledEvent[];
}
type ToolResult = { ok: true; commandId: string; completionEventIds: string[] }
  | { ok: false; code: ToolFailureCode; details: Record<string,string|number> };
type ToolFailureCode = 'INVALID_TARGET'|'NOT_AUTHORIZED'|'OUT_OF_RANGE'|'PREREQUISITE_FAILED'|'TOOL_BUSY'|'ZONE_OCCUPIED'|'MAINTENANCE_LOCKED'|'JAMMED'|'UNAVAILABLE';
```

Events are immutable facts with stable `id`, `type`, `logicalTime`, `priority`, `agentId?`, `commandId?`, and typed `payload`. Export entity/fixture/snapshot schemas from the simulation package; consumers must not recreate them.

## Proposed Vertical Slices

1. One gate, dinosaur, robot, clock, and exact replay
   - Blocked by: `application-shell` toolchain only; no UI dependency
   - Implement fixture validation, canonical ids/serialization, scheduler, move/open/close, snapshots, and a golden replay test.
2. Complete core tool runtime through a safe feeding scenario
   - Blocked by: #1
   - Add observe, bait, lock, feed, alert, evacuate, rescue, durations, reservations, typed failures, and an integrated safe feeding command stream.
3. Containment, visitor safety, incidents, and non-graphic recovery state
   - Blocked by: #2
   - Model proximity/buffer rules, at-risk/escaped transitions, severity 0-4 incidents, closures, panic, and explicit recovery requirements.
4. Deterministic movement profiles and seeded scenario events
   - Blocked by: #2
   - Add three archetypes, deterministic movement/interest, persisted PRNG state, fault scheduling, and replay tests across save boundaries.
5. Multi-enclosure contention and performance hardening
   - Blocked by: #3, #4
   - Add at least three enclosures, same-time contention cases, stable failure results, property tests, and the 10,000-event benchmark.

## Integration and Completion Gate

Publish a headless example that loads a fixture, accepts tool commands, advances, and produces canonical events/snapshot. Verify exact replay, all action failure codes, invalid-command immutability, 1x/2x/4x-equivalent results, fixture diagnostics, typecheck, tests, and benchmark. No simulation outcome may depend on UI, wall time, network, or LLM.
