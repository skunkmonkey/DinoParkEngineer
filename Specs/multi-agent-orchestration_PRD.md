# Multi-Agent Coordination and Orchestration - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`simulation-core`, `instruction-engine`, `context-memory`, `content-registry`, `park-operations`, `economy-progression`, `trace-replay`, and `platform-foundation` provide workers/jobs/resources, clause requests, routing, unlocks, provenance, and UI.

### Downstream Dependencies

`curriculum-content`, `persistence`, `telemetry`, `eval-runner`, and `review-deployment` consume manager scenarios/config versions/results.

## Executive Summary

This feature scales the park from one named worker to at least three concurrent workers, deliberately exposing visible park activity, queue conflicts, and player context switching before unlocking a Manager Agent. The initial orchestration surface communicates mission, worker assignments, pressure, exceptions, and escalations before exact routing/configuration evidence. A Manager is a versioned Agent configuration with explicit mission, worker pool/capacity, delegation, priority, authority, Context routing, escalation, and reporting contracts. It improves coordination only when well configured; it never bypasses worker Tools, safety policy, Context limits, or deterministic ordering.

## User Stories

- **GIVEN** multiple unassigned jobs, **WHEN** manual play is active, **THEN** workers operate independently and resource conflicts are explicit rather than nondeterministic.
- **GIVEN** Manager eligibility/purchase, **WHEN** configured, **THEN** the player can inspect exactly which jobs/workers/context/authority/reports it will manage.
- **GIVEN** feeding and evacuation work, **WHEN** delegated, **THEN** eligible keeper/security workers receive pinned task context according to stable rules and safety priority.
- **GIVEN** a missing tool, overflow, conflict, or serious incident, **WHEN** encountered, **THEN** the Manager escalates/reports per configured thresholds rather than hiding failure.

## Functional Requirements

### FR-01: Multi-Worker Scheduling
- FR-01.1: Support at least three concurrent workers with independent ordered queues and pinned jobs.
- FR-01.2: Same-time shared resource conflicts rely on Simulation Core results and stable ordering; orchestration may coordinate reservations but never invent success.
- FR-01.3: Manual assignment remains available before/after Manager unlock within authority rules.

### FR-02: Manager Configuration
- FR-02.1: Implement application PRD `managerConfig` plus mission Prompt ref, priority policy, authority boundaries, and configuration version.
- FR-02.2: Validate unique workers, max tier, worker existence/status, delegation targets, tools/capabilities, routing policies, and referenced artifacts.
- FR-02.3: Changes are exact versioned Agent configurations subject to Review/Deployment.
- FR-02.4: A worker belongs to at most one active Manager in MVP.

### FR-03: Delegation and Priority
- FR-03.1: Select eligible worker by matching rule priority, role/tool/context eligibility, queue capacity, then stable load/id ordering.
- FR-03.2: Default priority: safety incidents > containment > animal health > guest throughput; configured authored policy may refine but not violate hard safety.
- FR-03.3: Failed delegation SHALL be explicit (`NO_MATCHING_RULE`, `NO_ELIGIBLE_WORKER`, `MISSING_TOOL`, `WORKER_CONTEXT_OVERFLOW`, `AUTHORITY_DENIED`).
- FR-03.4: Jobs retain exact artifact/configuration refs after assignment.

### FR-04: Context Routing, Escalation, Reporting
- FR-04.1: Manager receives park-wide summary within its budget; workers receive task-relevant context selected by routing policy.
- FR-04.2: Routing SHALL call Context Service and expose included/omitted/blocked inputs; no silent truncation.
- FR-04.3: Default escalation is severity >=2 or unresolved tool failure after one safe fallback; content/config may adjust within safety floors.
- FR-04.4: Exception reports are immediate; routine completions may batch every five jobs by default.
- FR-04.5: Alert flooding and under-escalation are authored failure cases and measurable outcomes.

### FR-05: Orchestration UI and Trace
- FR-05.1: Show mission, worker pool/capacity, live assignment graph, queues, priorities, context load/routing, escalation/report state, and recent manager trace.
- FR-05.2: Delegations/conflicts/escalations/reports SHALL emit structured provenance linked to child jobs/traces.
- FR-05.3: Live UI SHALL lead with human-readable Agent/job/entity names and operational outcome; exact ids, rule matches, routing refs, tie-break evidence, and traces remain inspectable.
- FR-05.4: Before Manager Agent unlock, manual coordination pressure SHALL remain visible rather than being automatically summarized away; after successful orchestration, routine work MAY collapse into summaries while exceptions remain prominent.

## Non-Functional Requirements

- **NFR-01: Determinism** - Same jobs/workers/config/world/context produce identical assignment/order/events.
- **NFR-02: Explainability** - Every assignment/rejection names matched rule, eligibility facts, and stable tie-break.
- **NFR-03: Safety** - Manager authority cannot override hard safety or fabricate worker tools/context.
- **NFR-04: Scale** - MVP supports one Manager and at least four configured workers without UI or scheduling lag.

## Invariants

- **INV-01:** Manager does not perform worker-only tools unless separately modeled as an eligible worker (not MVP default).
- **INV-02:** A job has at most one active assignee.
- **INV-03:** A worker has at most one active Manager.
- **INV-04:** Hard safety outranks manager mission/throughput.
- **INV-05:** Routing cannot bypass context budget/visibility.

## Out of Scope

Manager hierarchies, negotiation/chat, dynamic natural-language planning, arbitrary team topologies, worker RPG stats, hiring, and cross-park orchestration.

## Product Decisions

- **PD-01:** Manager becomes purchasable at four workers or authored intervention threshold.
- **PD-02:** Player feels multi-agent pressure before the solution unlocks.
- **PD-03:** Manager is explicit architecture, not a magic automation button.
- **PD-04:** Orchestration reduces routine attention but never hides exceptions, rejected delegation, Context blocks, or safety conflicts.

## Implementation Decisions

- **IMP-01:** Pure scheduling decision function plus command coordinator.
- **IMP-02:** Manager consumes typed delegation/reporting requests from Instruction Engine.
- **IMP-03:** Context routing policies select authored refs/queries; Context Service calculates outcome.

## Testing Decisions

- **TST-01:** Table-driven scheduling/tie/eligibility/failure tests.
- **TST-02:** Golden concurrency scenarios cover maintenance gate, conflicting command, stale policy, and manager overflow.
- **TST-03:** Safety-property tests prove lower-priority instructions cannot override constraints.

## Proposed Modules

- **MOD-01: OrchestrationScheduler** - Pure deterministic assignment and priority decisions.
- **MOD-02: ManagerRuntime** - Consumes requests/events, coordinates commands, escalation, and reports.
- **MOD-03: RoutingService** - Translates versioned policy into Context Service requests.
- **MOD-04: ManagerConfigurationService** - Validates/version-projects configuration for Review.
- **MOD-05: OrchestrationUI** - Configuration detail and live assignment/report graph.

## Workflows

### Workflow 1: Delegate Routine Work
```text
Receive feeding job -> evaluate priority/rules -> filter workers by tools/authority/context/queue -> stable select -> route task context -> assign pinned job -> consume child outcome -> batch routine report.
```

### Workflow 2: Escalate Exception
```text
Worker gate tool fails -> safe fallback fails -> child emits escalation -> Manager applies severity/authority -> dispatches eligible security work if allowed -> immediately reports exception -> links parent/child traces.
```
