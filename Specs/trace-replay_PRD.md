# Trace Inspection and Replay - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`simulation-core`, `instruction-engine`, `context-memory`, and `content-registry` supply immutable observable events, snapshots, and pinned refs. `platform-foundation` supplies route/UI primitives.

### Downstream Dependencies

`eval-runner`, `review-deployment`, `park-operations`, `curriculum-content`, and `persistence` link to traces and replays.

## Executive Summary

Trace and Replay lets the player understand a surprising outcome without first parsing a raw event stream. It opens with an observable outcome story—intent/task, available Context, consequential actions, resulting world state, and the smallest relevant evidence set—then provides the complete chronological trace. It exposes exactly what an Agent received, which deterministic clauses applied, which Tools ran, what state changed, and what assertions passed without fabricating private reasoning. Replay can reconstruct or validate an exact run from a fixture, seed, artifact manifest, Context snapshot, and command/provenance stream.

## User Stories

- **GIVEN** surprising behavior, **WHEN** the player opens its trace, **THEN** they can follow a chronological, filterable timeline from job receipt to outcome.
- **GIVEN** a missing postcondition, conflict, stale record, or unavailable tool, **WHEN** inspecting the trace, **THEN** the relevant context and clause evidence are directly linked.
- **GIVEN** a saved eval or incident replay, **WHEN** replayed unchanged, **THEN** event order and final state match and any mismatch is reported as divergence, not concealed.

## Functional Requirements

### FR-01: Trace Record
- FR-01.1: Store trace header with trace/job/agent ids, start/end logical time, terminal status/reason, pinned artifact refs, context snapshot id, fixture/seed references, and engine/content manifest versions.
- FR-01.2: Events SHALL cover job, context, observation, clause, tool, world change, assertion, conflict, incident, delegation/reporting, and terminal status.
- FR-01.3: Event order SHALL use authoritative sequence numbers and logical time.
- FR-01.4: Incomplete/running traces SHALL be readable and clearly labeled.

### FR-02: Inspection UI
- FR-02.1: Show chronological summary with filters by category, entity, artifact, clause, and pass/fail.
- FR-02.2: Selecting an event SHALL show structured inputs/results and links to context/artifact/entity versions.
- FR-02.3: Missing, stale, conflict, and applicability findings SHALL have distinct text labels/icons.
- FR-02.4: The player SHALL be able to copy/select source and structured data.
- FR-02.5: Default inspection SHALL show player-facing job/entity/artifact names and an outcome-first summary; exact ids/refs/hashes remain linked Technical Details and search aliases.
- FR-02.6: A short relevant-evidence view SHALL never delete or mutate events; the complete filterable timeline remains available.
- FR-02.7: When replay visualization is available, it SHALL project isolated authoritative events onto the same park visual language as normal operations, with a nonvisual equivalent.

### FR-03: Replay
- FR-03.1: A replay manifest SHALL pin fixture, seed, artifact versions, agent definition, context policy inputs, and engine/content schema versions.
- FR-03.2: Replay SHALL run isolated from the live park and never mutate production state.
- FR-03.3: Exact replay SHALL compare ordered canonical events and final snapshot hash.
- FR-03.4: Divergence SHALL identify first differing event/field and mark the replay non-authoritative.
- FR-03.5: Pause, step, and 1x/2x/4x visualization SHALL not affect authoritative output.

## Non-Functional Requirements

- **NFR-01: Honesty** - Never display inferred chain-of-thought or claim unsupported causality.
- **NFR-02: Scale** - Virtualize/filter traces of 10,000 events without freezing interaction.
- **NFR-03: Accessibility** - Timeline is keyboard navigable and meaningful without color/motion.
- **NFR-04: Integrity** - Canonical event hashes detect corruption/divergence.

## Invariants

- **INV-01:** Trace storage cannot mutate source events or world state.
- **INV-02:** Replay cannot write to the live simulation.
- **INV-03:** Historical refs never float to newer versions.
- **INV-04:** Explanations cite observable facts/clauses only.

## Out of Scope

Generating source events, running eval assertions, artifact editing, production deployment, telemetry dashboards, video capture, and hidden-reasoning simulation.

## Product Decisions

- **PD-01:** Outcome story and relevant source/Context evidence are default; complete event and semantic details are advanced evidence views.
- **PD-02:** Incidents and failed evals deep-link to the relevant event.
- **PD-03:** Replay state is an isolated simulation environment.

## Implementation Decisions

- **IMP-01:** Append-only event sink plus query repository port.
- **IMP-02:** Trace schema is versioned and canonically serializable.
- **IMP-03:** Replay orchestration calls public feature ports only.

## Testing Decisions

- **TST-01:** Golden trace covers first carnivore feeding and missing postcondition.
- **TST-02:** Tamper/divergence tests identify the first mismatch.
- **TST-03:** UI tests cover filtering, focus, links, and 10k-event virtualization.
- **TST-04:** Tests prove summary evidence is a lossless projection over the complete trace and friendly-name search resolves the same exact records as raw-id search.

## Proposed Modules

- **MOD-01: TraceRecorder** - Accepts append-only observable events and finalizes headers.
- **MOD-02: TraceRepository** - Queries traces without coupling producers to storage.
- **MOD-03: ReplayService** - Builds isolated runs and verifies canonical equivalence.
- **MOD-04: TraceExplorer** - Accessible timeline/detail/context inspection feature UI.

## Workflows

### Workflow 1: Diagnose Missing Postcondition
```text
Open incident -> jump to job trace -> inspect loaded context -> filter clauses/postconditions -> see no containment postcondition -> inspect final gate/world event -> open responsible Prompt version.
```

### Workflow 2: Verify Replay
```text
Load manifest into isolated engine -> execute/step -> canonicalize output -> compare expected hashes/events -> show exact match or first divergence -> leave live park unchanged.
```
