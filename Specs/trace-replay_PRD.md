# Trace and Replay - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Simulation | Supplies exact initial state, commands, evidence, and world deltas. |
| 2 | Instruction Artifacts | Supplies clause applicability and decision records. |
| 3 | Context | Supplies before/after manifests and retention events. |
| 4 | Content Registry | Resolves exact historical versions. |

### Downstream Dependencies

Park Operations links incidents and jobs. Player Experience renders timelines.
Evals reuse replay. Review, Incident Response, Orchestration, Persistence,
Curriculum Content, and Telemetry consume structured evidence or links.

## Executive Summary

Trace and Replay records the observable evidence needed to understand and
reproduce an Agent decision without exposing or fabricating hidden
chain-of-thought. A trace connects Task, exact versions, context, clauses, tool
calls, evidence, world changes, retention, messages, and outcomes. Replay
recreates or projects the same timeline in synchronization with the park and
can verify exact equivalence.

## User Stories

### Diagnose

- **GIVEN** a surprising park outcome, **WHEN** the player follows its trace,
  **THEN** they can move from consequence to job, decision, context, clause,
  tool evidence, world delta, and responsible artifact.
  - **Acceptance Criteria:** The initial view is concise; exact evidence remains
    available through deliberate expansion.
- **GIVEN** relevant information was unavailable, **WHEN** a decision is
  inspected, **THEN** the trace distinguishes unavailable, excluded, stale, and
  never-routed information from information actually used.
  - **Acceptance Criteria:** The trace never implies the Agent saw absent data.

### Replay

- **GIVEN** a production incident or eval, **WHEN** replay starts, **THEN** the
  world presentation and structured trace advance together over the same exact
  record.
  - **Acceptance Criteria:** Replay cannot alter production state, rating, or
    revenue and is persistently labeled.

## Functional Requirements

### FR-01: Trace Identity and Events

- FR-01.1: Every trace SHALL have stable ID, schema version, mode, root Task/job
  or eval ID, exact resolved content manifest, seed/state reference, start/end
  ticks, and outcome.
- FR-01.2: Events SHALL have stable IDs, logical tick, deterministic sequence,
  event type, actor/entity links, causal parent links, and structured payload.
- FR-01.3: Event types SHALL cover context assembly/retention, clause
  applicability/conflict, decision, tool request/result, evidence, world delta,
  message/delegation, completion/failure/stop/escalation, and incident links.
- FR-01.4: Trace schemas SHALL prohibit hidden-reasoning or chain-of-thought
  fields.

### FR-02: Capture

- FR-02.1: Capture SHALL consume authoritative records rather than reconstructing
  causes from presentation state.
- FR-02.2: Capture SHALL preserve exact version and provenance references needed
  for historical resolution.
- FR-02.3: A trace SHALL finalize atomically with an explicit complete,
  interrupted, invalid, or incomplete status.
- FR-02.4: Capture failure SHALL not change simulation results and SHALL produce
  a visible reliability fault.

### FR-03: Projections and Navigation

- FR-03.1: The feature SHALL provide concise outcome, decision-cycle timeline,
  context, clause, tool/evidence, world-delta, and causal-link projections.
- FR-03.2: Projections SHALL preserve stable entity and artifact identities for
  bidirectional navigation.
- FR-03.3: Initial incident projection SHALL emphasize expected, observed,
  consequence, and immediate causal gap supplied by the owning incident.
- FR-03.4: Filtering or collapsing SHALL never rewrite the underlying trace.

### FR-04: Replay

- FR-04.1: Replay SHALL support play, pause, step, seek to event/tick, speed, and
  focus on linked entity.
- FR-04.2: Historical projection MAY replay recorded snapshots/deltas; exact
  verification SHALL rerun the authoritative fixture and compare records.
- FR-04.3: Replay SHALL identify any missing version, incompatible schema, or
  mismatch rather than substituting current content.
- FR-04.4: Production, eval, and historical replay SHALL remain unmistakably
  labeled and isolated.

### FR-05: Comparison

- FR-05.1: Two compatible traces SHALL be comparable by aligned decision cycle,
  context delta, clause selection, tool result, world delta, cost, and outcome.
- FR-05.2: Alignment rules and unmatched events SHALL be explicit.
- FR-05.3: Comparison SHALL not claim causality beyond recorded structured links.

## Non-Functional Requirements

- **NFR-01: Fidelity** - Captured values derive from authoritative subsystem
  records.
- **NFR-02: Replayability** - Exact supported inputs reproduce the original or
  report a mismatch.
- **NFR-03: Scale** - Long traces support indexed seeking and progressive detail.
- **NFR-04: Accessibility** - Timeline state and controls have keyboard, text,
  non-color, reduced-motion, and persistent equivalents.

## Invariants

- **INV-01:** Traces expose structured provenance, never hidden chain-of-thought.
- **INV-02:** Replay never mutates production.
- **INV-03:** Historical references never float.
- **INV-04:** Presentation filtering never changes recorded facts.
- **INV-05:** Replay mismatch is visible and never silently accepted.

## Out of Scope

- Deciding incident severity or grouping.
- Owning simulation transitions or instruction decisions.
- Raw video recording.
- Remote observability or user analytics.

## Product Decisions

- **PD-01: Progressive evidence** - Consequence and immediate gap precede full
  technical detail.
- **PD-02: Synchronized replay** - Players can connect structured events to
  visible park behavior.
- **PD-03: Exact mismatch over best effort** - Broken history blocks explicitly.

## Implementation Decisions

- **IMP-01:** Use versioned discriminated trace events and canonical ordering.
- **IMP-02:** Store periodic authoritative snapshots plus ordered records when
  measurement shows seeking benefits; do not make presentation frames canonical.
- **IMP-03:** Use content-addressed immutable trace segments where useful for
  save deduplication without changing trace identity.
- **IMP-04:** Expose only `src/trace-replay/public.ts`.

## Testing Decisions

- **TST-01:** Golden traces assert exact event schemas, order, links, manifests,
  and no prohibited fields.
- **TST-02:** Replay equivalence compares rerun state/events to originals.
- **TST-03:** Navigation tests preserve causal identity across projections.
- **TST-04:** Rendered tests cover long timelines, seek, mode distinction,
  keyboard control, and reduced motion.

## Proposed Modules

- **MOD-01: Trace Recorder** - Ingests structured subsystem records and
  finalizes immutable traces.
- **MOD-02: Trace Schema** - Defines safe versioned events and prohibited data.
- **MOD-03: Trace Index** - Supports causal, entity, artifact, cycle, and tick
  queries.
- **MOD-04: Replay Session** - Projects or verifies an isolated historical run.
- **MOD-05: Trace Comparator** - Aligns compatible traces and reports exact
  differences.

## Workflows

### Workflow 1: Inspect a Decision

```text
1. Follow a world event to its trace and decision cycle.
2. Inspect exact Task and resolved versions.
3. Compare available, unavailable, and retained context.
4. Inspect applicable clauses and selected tool request.
5. Inspect returned evidence and authoritative world delta.
6. Navigate to the responsible artifact or replay point.
```

### Workflow 2: Verify Historical Replay

```text
1. Resolve the exact fixture, content manifest, seed, and commands.
2. Run in an isolated replay environment.
3. Compare every authoritative record and final state.
4. Report equivalence or the first exact mismatch.
5. Preserve production state unchanged.
```
