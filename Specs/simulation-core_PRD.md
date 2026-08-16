# Deterministic Simulation Core - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | `application-shell` | Supplies the established TypeScript application toolchain and test/build runtime; the headless engine does not depend on product UI. |

### Downstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | `instruction-engine` | Executes agent actions through simulation tools. |
| 2 | `platform-foundation` | Connects its global pause/speed presentation through the simulation-control adapter produced here. |
| 3 | `trace-replay`, `eval-runner`, `park-operations`, `multi-agent-orchestration`, `persistence` | Consume world events, snapshots, commands, and deterministic ordering. |

## Executive Summary

The Simulation Core is the authoritative dinosaur-park world. It advances a one-second logical clock, schedules deterministic actions, validates tool prerequisites, mutates entities, creates incidents, and produces identical results from identical inputs. It supports one park zone, three or more enclosures and dinosaur archetypes, robots, visitors, gates, devices, routes, jobs, and incidents without requiring a runtime LLM.

## User Stories

### Operate the Park

- **GIVEN** a valid world state, **WHEN** a robot moves, observes, baits, opens/closes/locks a gate, feeds, alerts security, or evacuates visitors, **THEN** prerequisites, duration, effects, and failures are applied visibly and consistently.
- **GIVEN** paused, 1x, 2x, or 4x display speed, **WHEN** the same queued commands are processed, **THEN** authoritative outcomes and event order are unchanged.

### Trust and Replay

- **GIVEN** the same fixture, seed, command stream, and engine version, **WHEN** a scenario is rerun, **THEN** its ordered events and final state are byte-for-byte canonically equivalent.
- **GIVEN** simultaneous resource use, **WHEN** actions conflict, **THEN** the loser receives an explicit result such as `TOOL_BUSY`, `ZONE_OCCUPIED`, or `MAINTENANCE_LOCKED`.

## Functional Requirements

### FR-01: Clock and Event Queue
- FR-01.1: The engine SHALL use integer logical seconds and a discrete event queue.
- FR-01.2: Same-time events SHALL order by event priority, then agent id, then event id.
- FR-01.3: Pause and display speed SHALL affect scheduling cadence, not logical results.
- FR-01.4: Every accepted command SHALL yield scheduled and completed/failed events.

### FR-02: Authoritative Entities
- FR-02.1: The engine SHALL model every required entity and state listed in application PRD section 7.3.
- FR-02.2: All references SHALL use stable ids; dangling references SHALL fail fixture validation.
- FR-02.3: Dinosaur movement and target interest SHALL be deterministic from state, authored profile, and persisted seeded PRNG state.
- FR-02.4: World mutation SHALL only occur through validated engine commands/events.

### FR-03: Tool Actions
- FR-03.1: The engine SHALL implement the core physical actions in application PRD section 7.4.
- FR-03.2: Tool execution SHALL return a typed success or failure; it SHALL never throw for an authored world-condition failure.
- FR-03.3: A permanently jammed gate SHALL not succeed through retries.
- FR-03.4: `observe` SHALL return current observable facts and observation time without deciding memory retention.

### FR-04: Safety and Incidents
- FR-04.1: Open/failed gates, dinosaur proximity, visitor buffers, and containment state SHALL produce deterministic risks and incidents.
- FR-04.2: Incident severities SHALL use 0-4 definitions from the application PRD.
- FR-04.3: Safety consequences SHALL be non-graphic and represented through panic, threat, closure, response, and recovery state.
- FR-04.4: Goal success SHALL not erase a simultaneous safety incident.

### FR-05: Snapshots and Commands
- FR-05.1: Consumers SHALL be able to read immutable snapshots and submit explicit commands.
- FR-05.2: Snapshots SHALL be canonically serializable and contain logical time plus PRNG state.
- FR-05.3: Invalid commands SHALL leave state unchanged.

## Non-Functional Requirements

- **NFR-01: Determinism** - No iteration order, wall clock, locale, floating-point instability, or unseeded randomness may affect outcomes.
- **NFR-02: Performance** - Process 10,000 simple queued events in under one second in a production build on a typical development laptop.
- **NFR-03: Testability** - The engine SHALL run headlessly with no UI or browser-global dependency.
- **NFR-04: Diagnostics** - Validation and command failures SHALL include stable machine codes and entity references.

## Invariants

- **INV-01:** World state is authoritative; agents cannot directly mutate it.
- **INV-02:** Identical inputs produce identical outputs.
- **INV-03:** A closed gate is not locked; a gate can lock only while closed.
- **INV-04:** One resource reservation has at most one winner at a logical timestamp.
- **INV-05:** Simulation never fabricates agent reasoning or prompt semantics.

## Out of Scope

Instruction clause selection, context assembly, memory retention, eval assertions, economy calculations, UI animation, path-construction gameplay, breeding, combat, and freeform generation.

## Product Decisions

- **PD-01:** One logical tick is one second; the UI may animate between events.
- **PD-02:** Seeded events provide variety but are persisted at run start.
- **PD-03:** MVP content includes at least three enclosures and docile herbivore, large herbivore, and carnivore profiles.

## Implementation Decisions

- **IMP-01:** Pure/headless core with command-query separation.
- **IMP-02:** Integer values for time and balance-sensitive quantities.
- **IMP-03:** Canonical stable sort and serialization are explicit utilities, never runtime defaults.

## Testing Decisions

- **TST-01:** Golden replay tests compare ordered events and final canonical state.
- **TST-02:** Table-driven tests cover every tool result and prerequisite.
- **TST-03:** Property tests cover invalid-command immutability, stable ordering, gate invariants, and replay determinism.

## Proposed Modules

- **MOD-01: SimulationEngine** - Small API to create/load, command, advance, snapshot, and subscribe.
- **MOD-02: EventScheduler** - Owns logical clock, queue, reservations, and stable ordering.
- **MOD-03: WorldRules** - Hides entity transitions, containment, movement, visitor safety, and incident triggers.
- **MOD-04: ToolRuntime** - Validates and executes deterministic tool contracts.
- **MOD-05: FixtureValidator** - Validates complete referentially sound starting worlds.

## Workflows

### Workflow 1: Safe Gate Action
```text
1. Submit open_gate(G7) for Keeper-01.
2. Engine validates range, authorization, gate state, locks, zone, and reservation.
3. Engine schedules completion at a deterministic time.
4. Completion mutates G7 and emits world facts/risks.
5. Consumers receive an immutable resulting snapshot.
```

### Workflow 2: Exact Replay
```text
1. Load fixture, seed, and ordered command stream.
2. Run until the queue is idle or terminal condition supplied by caller is reached.
3. Capture canonical events and final snapshot.
4. Repeat with the same inputs.
5. Both outputs match exactly.
```
