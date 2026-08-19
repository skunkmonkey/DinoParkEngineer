# Simulation - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Content Registry | Resolves exact scenario, entity-definition, and tool-definition versions. |

### Downstream Dependencies

Instruction executes allowed actions against Simulation. Trace and Replay,
Evals, Park Operations, Player Experience, Incident Response, Economy,
Orchestration, Persistence, and Curriculum Content consume its state,
commands, fixtures, or projections.

## Executive Summary

Simulation owns the park's physical truth. It advances deterministic time,
validates commands, updates dinosaurs, robots, visitors, gates, equipment,
hazards, and weather, and emits exact world deltas. Agents and UI may request
actions, but only Simulation decides their physical results. Identical versioned
starting state and ordered commands always reproduce the same outcome.

## User Stories

### Trustworthy World

- **GIVEN** the same fixture, seed, versions, commands, and decision order,
  **WHEN** the world runs twice, **THEN** every authoritative transition and
  outcome is identical.
  - **Acceptance Criteria:** Exact final state and ordered world events match.
- **GIVEN** a gate sensor reports closed while degraded, **WHEN** an Agent uses
  the gate, **THEN** physical gate and sensor states remain distinct and tools
  return evidence from the modeled source.
  - **Acceptance Criteria:** An instruction cannot declare containment merely
    by asserting it.

### Time and Interaction

- **GIVEN** live park operation, **WHEN** the player pauses or changes speed,
  **THEN** logical outcomes remain equivalent to the same ordered commands at
  normal speed.
  - **Acceptance Criteria:** Display frame rate never changes world outcomes.
- **GIVEN** two locally reasonable actors share a resource, **WHEN** their
  commands interleave, **THEN** explicit resource and world state determine the
  result.
  - **Acceptance Criteria:** Coordination failures require no random Agent
    incompetence.

## Functional Requirements

### FR-01: State and Identity

- FR-01.1: World state SHALL include stable IDs and explicit state for clock,
  locations, enclosure boundaries, gates, equipment, dinosaurs, robots,
  visitors, hazards, weather/environment, and active physical actions.
- FR-01.2: State collections and projections SHALL use documented stable order.
- FR-01.3: Authoritative state SHALL be serializable and free of DOM, renderer,
  clock-object, and function references.
- FR-01.4: Numeric rules that affect outcomes SHALL use deterministic units and
  rounding.

### FR-02: Clock and Scheduling

- FR-02.1: The world SHALL advance through integer logical ticks.
- FR-02.2: Pause SHALL stop logical advancement without altering pending order.
- FR-02.3: Speed SHALL control how quickly ticks are requested, not tick
  semantics.
- FR-02.4: Scheduled transitions SHALL resolve by tick, priority, and stable ID.
- FR-02.5: Rendering interpolation SHALL not enter authoritative state.

### FR-03: Commands and Transitions

- FR-03.1: All world mutation SHALL occur through validated commands.
- FR-03.2: Command results SHALL report acceptance or rejection, evidence,
  ordered world deltas, and resulting tick.
- FR-03.3: Invalid, stale, unauthorized, or impossible commands SHALL fail
  explicitly without partial mutation.
- FR-03.4: Command batches SHALL define deterministic ordering and atomicity.

### FR-04: Entities and Physical Rules

- FR-04.1: Gates SHALL model open/closed/locked/jammed state, closer state,
  sensor reading, sensor health, access zones, and transitions needed by
  accepted scenarios.
- FR-04.2: Dinosaurs SHALL model location, containment, hunger/need, agitation,
  target/behavior, species constraints, and hazard interaction.
- FR-04.3: Robots SHALL model location, movement, tools, carried state, battery
  or operational health, assignment linkage, and physical action state.
- FR-04.4: Visitors SHALL model location, movement, exposure, panic/evacuation,
  safety, injury, and casualty outcomes.
- FR-04.5: Shared tools, spaces, gates, and resources SHALL support explicit
  contention and reservation where defined.

### FR-05: Tools and Evidence

- FR-05.1: Simulation SHALL implement physical tool effects through a small
  public command surface.
- FR-05.2: Tool evidence SHALL identify the observed source and distinguish
  reported state from physical state.
- FR-05.3: Tool failure and degraded results SHALL be deterministic from world
  state and exact tool definition.
- FR-05.4: Simulation SHALL not know Prompt prose or infer Agent intent.

### FR-06: Fixtures and Replay Inputs

- FR-06.1: A scenario fixture SHALL declare exact content versions, seed,
  initial state, clock, and allowed external commands.
- FR-06.2: Fixture loading SHALL validate invariants before the first tick.
- FR-06.3: The engine SHALL support snapshot plus ordered-command replay and
  exact final-state comparison.
- FR-06.4: Production and eval environments SHALL use the same transition rules.

## Non-Functional Requirements

- **NFR-01: Determinism** - Identical versioned inputs produce exact ordered
  outputs across Windows/macOS and supported browsers.
- **NFR-02: Headless operation** - Domain tests and evals run without React,
  PixiJS, audio, or a browser canvas.
- **NFR-03: Performance** - Tick and projection costs are measured against MVP
  and mature-density fixtures; budgets follow profiling.
- **NFR-04: Inspectability** - Every material transition has structured cause,
  evidence, and before/after data appropriate for Trace.

## Invariants

- **INV-01:** Simulation alone owns physical truth.
- **INV-02:** UI, Prompt, Skill, trace, and animation cannot directly mutate or
  declare world outcomes.
- **INV-03:** Frame rate, wall-clock timing, and animation do not affect results.
- **INV-04:** Production and evals share transition semantics.
- **INV-05:** Randomness comes only from explicit seeded streams with recorded
  consumption.

## Out of Scope

- Choosing Agent actions or parsing instruction prose.
- Rating, credits, progression, alerts, or incident grouping.
- Rendering, sound, and UI animation.
- Full continuous rigid-body physics.

## Product Decisions

- **PD-01: Hard state over probabilistic interpretation** - Fair diagnosis
  requires explicit world facts.
- **PD-02: Discrete deterministic time** - Exact replay matters more than
  physically continuous simulation.
- **PD-03: Emergence through interaction** - Surprise comes from composable
  rules and shared state, not hidden failure rolls.

## Implementation Decisions

- **IMP-01:** Implement a framework-free strict TypeScript engine with plain
  serializable state, commands, and events.
- **IMP-02:** Use integer ticks and seeded named random streams; avoid ambient
  `Date`, `Math.random`, locale ordering, and renderer time.
- **IMP-03:** Keep the engine worker-ready through structured-clone-compatible
  ports; begin in-process until profiling justifies production-worker overhead.
- **IMP-04:** Expose only `src/simulation/public.ts`.
- **IMP-05:** Use deterministic navigation graphs or grids rather than a
  renderer physics engine.

## Testing Decisions

- **TST-01:** Golden fixtures assert exact states, command results, deltas, and
  seeded events.
- **TST-02:** Replay tests run fixtures at different display-speed schedules and
  compare exact outcomes.
- **TST-03:** Boundary tests cover stale commands, atomic failure, invalid
  fixtures, contention, sensor disagreement, and casualty rules.
- **TST-04:** Cross-runtime fixtures run in Node and browser.

## Proposed Modules

- **MOD-01: World Engine** - Applies validated commands and advances ticks
  through one deterministic API.
- **MOD-02: Entity Stores** - Own normalized stable entity state and invariants.
- **MOD-03: Scheduler** - Orders future transitions by tick, priority, and ID.
- **MOD-04: Tool Physics** - Resolves action requirements, physical effects,
  failures, and evidence.
- **MOD-05: Scenario Loader** - Validates exact initial state and content
  references.
- **MOD-06: World Projector** - Produces immutable read models without granting
  mutation access.

## Workflows

### Workflow 1: Execute a Gate Tool

```text
1. Receive a validated tool command at a logical tick.
2. Check actor, location, tool, authorization, and physical preconditions.
3. Reject atomically or schedule/apply deterministic effects.
4. Emit observed evidence and ordered world deltas.
5. Expose the new read-only world projection.
```

### Workflow 2: Replay a Scenario

```text
1. Load exact fixture versions, seed, and initial state.
2. Apply the recorded ordered commands at their decision ticks.
3. Advance through the same scheduled transitions.
4. Compare exact events and final state with the original record.
```
