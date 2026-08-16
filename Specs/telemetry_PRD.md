# Privacy-Conscious Product and Learning Telemetry - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

All gameplay features emit stable public domain/product events; `platform-foundation` supplies error/consent/status integration; `curriculum-content` supplies scenario/phase ids.

### Downstream Dependencies

None for core gameplay. Telemetry is optional and must never be required for simulation, saves, progression, or offline play.

## Executive Summary

Telemetry records privacy-conscious, structured gameplay signals needed to balance the game and validate learning: eval choices, context trends, incident causes, review-before-deploy discipline, refactors, manager adoption, and intervention rates. It does not collect freeform source text, hidden reasoning, save contents, or personally identifying data. Collection is transparent, locally inspectable, disableable where required, and failure never affects gameplay.

## User Stories

- **GIVEN** telemetry is enabled, **WHEN** relevant gameplay occurs, **THEN** only documented structured fields are queued without interrupting play.
- **GIVEN** the player reviews privacy information or disables analytics, **WHEN** they act, **THEN** collection state is clear and future optional events stop without affecting the save.
- **GIVEN** offline/network failure, **WHEN** events cannot upload, **THEN** gameplay remains unchanged and the queue is bounded/retry-safe.
- **GIVEN** developers analyze learning, **WHEN** aggregating events, **THEN** they can compute the application PRD learning metrics without source text or identity.

## Functional Requirements

### FR-01: Event Schema
- FR-01.1: Every event SHALL include schema version, event id, anonymous installation/session id, event type, logical game time, app/content version, phase/scenario id when relevant, and allowlisted payload.
- FR-01.2: Define events for context snapshot summary/findings, job outcome, incident, eval build/run/selection, review/deploy/revert, artifact refactor, capability/unlock/purchase, manual intervention, Manager adoption/assignment/escalation, save error, and application error.
- FR-01.3: Payload SHALL use stable ids/categories/counts/amounts; no source text, memory content, trace payload, imported save data, or arbitrary exception strings.

### FR-02: Learning Metrics
- FR-02.1: Support calculation of duplicate CU/job, severity 3+ eval coverage, deployments with eval run, context utilization distribution, interventions/10 jobs, and uncovered-incident-to-regression conversion.
- FR-02.2: Metric definitions SHALL state numerator, denominator, eligible population, version, and missing-data handling.
- FR-02.3: Economy/retention metrics SHALL not replace safety/learning outcomes as product success.

### FR-03: Collection and Delivery
- FR-03.1: Producers emit to a non-blocking port; telemetry sanitizes/validates before storage/delivery.
- FR-03.2: Unknown fields are rejected/removed according to schema, not blindly serialized.
- FR-03.3: Queue SHALL be bounded, batched, retry with backoff, deduplicate by event id, and drop oldest noncritical analytics when full.
- FR-03.4: Delivery adapter may be disabled/local-only; no feature branches on telemetry success.

### FR-04: Privacy and Controls
- FR-04.1: Provide concise disclosure of collected categories and exclusions plus enable/disable control consistent with product policy.
- FR-04.2: Optional analytics disabled state SHALL prevent enqueue/delivery after essential local error/state events explicitly classified by policy.
- FR-04.3: Allow local inspection/clear of pending analytics queue in development/privacy diagnostics.
- FR-04.4: Anonymous ids SHALL not derive from device/user PII.

## Non-Functional Requirements

- **NFR-01: Gameplay Isolation** - Telemetry calls never block authoritative operations and thrown adapter errors are contained.
- **NFR-02: Privacy** - Data minimization and allowlist validation are mandatory.
- **NFR-03: Performance** - Event emission adds under 1 ms synchronous work at p95 for typical payloads.
- **NFR-04: Reliability** - At-least-once delivery is acceptable; ids make downstream deduplication possible.
- **NFR-05: Testability** - Local sink exposes events for acceptance tests without network.

## Invariants

- **INV-01:** Gameplay behavior/state never depends on telemetry availability or response.
- **INV-02:** Source text, memory content, full traces, save contents, and PII are never telemetry payloads.
- **INV-03:** Only versioned allowlisted event fields leave the application.
- **INV-04:** Logical game time is analytics data; wall time cannot affect simulation.

## Out of Scope

Advertising, user profiling, leaderboards, crash dump uploads with arbitrary state, session replay/video, third-party tracker selection, production dashboards, experiments that alter deterministic outcomes, and marketing attribution.

## Product Decisions

- **PD-01:** Learning validation and balance are the purpose; monetization surveillance is not.
- **PD-02:** Core deterministic mode contains authored text, so text collection is unnecessary.
- **PD-03:** Telemetry integration is optional and degrades to local/no-op.

## Implementation Decisions

- **IMP-01:** One typed telemetry port with schema registry, sanitizer, queue, and delivery adapter.
- **IMP-02:** Domain producers pass minimal ids/counts; telemetry may not query feature stores to enrich with sensitive state.
- **IMP-03:** Metric computation definitions live with analytics contracts/tests, not gameplay code.

## Testing Decisions

- **TST-01:** Schema/allowlist tests attempt forbidden text/PII/unknown fields.
- **TST-02:** Failure/latency tests prove gameplay command results are identical with throwing/slow/no-op adapters.
- **TST-03:** Synthetic event sets verify each learning metric definition.

## Proposed Modules

- **MOD-01: TelemetryClient** - Small non-blocking `emit` API and consent state.
- **MOD-02: EventSchemaRegistry** - Validates, sanitizes, and versions allowlisted events.
- **MOD-03: TelemetryQueue** - Bounded persistence/batching/dedup/retry.
- **MOD-04: DeliveryAdapter** - No-op, local, and optional remote interface.
- **MOD-05: LearningMetricDefinitions** - Tested versioned aggregation specifications.

## Workflows

### Workflow 1: Emit Eval Result
```text
Eval completes -> producer emits ids/tags/severity/pass/counts/cost only -> schema validates/strips unknowns -> queue accepts asynchronously -> batch adapter sends or retains bounded offline queue -> gameplay result is already complete.
```

### Workflow 2: Disable Optional Analytics
```text
Player opens privacy control -> reviews categories/exclusions -> disables -> optional queued events are cleared/held per policy -> future optional events no-op -> save/simulation/progression remain unchanged.
```
