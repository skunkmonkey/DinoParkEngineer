# Park Operations - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Simulation | Owns world time, entities, physical commands, and consequences. |
| 2 | Trace and Replay | Records job execution and supplies incident evidence links. |
| 3 | Content Registry | Resolves job, schedule, and operational definition versions. |

### Downstream Dependencies

Player Experience renders Park View and incidents. Eval, Economy, Incident
Response, Orchestration, Persistence, Curriculum Content, and Telemetry consume
jobs, cadence, alerts, incidents, or operational outcomes.

## Executive Summary

Park Operations turns the physical simulation into a playable management loop.
It owns park-day phases, jobs and schedules, assignments, opening and closing,
operational commands, alerts, causally grouped incidents, and park-level fault
monitoring. It exposes meaningful exceptions without converting ambient state
into notification spam.

## User Stories

### Park Day and Jobs

- **GIVEN** a closed park approaching opening, **WHEN** needs and schedules
  become due, **THEN** the player can understand and assign meaningful work
  before visitors enter.
  - **Acceptance Criteria:** One partially configured feeding job can be assigned
    and resolved against exact versions.
- **GIVEN** a stable automated operation, **WHEN** another day runs, **THEN**
  routine jobs execute visibly without requiring repeated intervention.
  - **Acceptance Criteria:** Mastered work does not receive hidden failure-rate
    inflation.

### Alerts and Incidents

- **GIVEN** a gate fault, robot retry, containment warning, and visitor exposure
  share one cause, **WHEN** alerts are processed, **THEN** one evolving incident
  groups the symptoms and links affected entities and traces.
  - **Acceptance Criteria:** Ambient state does not become four unrelated
    notifications.
- **GIVEN** a qualifying emergency or Strict context stop, **WHEN** the park
  monitor detects it, **THEN** an external operational alert is raised even if
  the Agent cannot reason.
  - **Acceptance Criteria:** Emergency detection does not rely on failed-Agent
    context.

## Functional Requirements

### FR-01: Park-Day Cadence

- FR-01.1: Operations SHALL model pre-opening, open operation, closing, and
  engineering/expansion phases with explicit transition criteria.
- FR-01.2: Opening SHALL require allowed readiness conditions and an intentional
  or scheduled operational command as content defines.
- FR-01.3: Visitors SHALL enter only during permitted operation and SHALL depart
  during closing or evacuation.
- FR-01.4: Day summaries SHALL report attendance, operations, incidents, and
  interventions through exact contributing records.

### FR-02: Jobs and Schedules

- FR-02.1: Jobs SHALL have stable ID, Task, target, priority, schedule/source,
  status, exact deployed artifact versions, Agent assignment, creation/due
  ticks, and result links.
- FR-02.2: Job assignment, start, pause, resume, cancel, complete, fail, stop,
  and escalate transitions SHALL be validated commands.
- FR-02.3: A job SHALL resolve exact production artifact versions before its
  first Agent decision and retain them for its history.
- FR-02.4: Schedules SHALL create jobs deterministically and prevent duplicate
  creation through stable occurrence IDs.
- FR-02.5: Job queues SHALL use explicit priority and stable tie-breaking.

### FR-03: Operational Commands

- FR-03.1: The feature SHALL expose commands for assignment, time control,
  opening/closing, incident acknowledgement, approved emergency actions, and
  other owned operations.
- FR-03.2: Commands SHALL validate current phase, authority, targets, and state
  before forwarding permitted physical actions.
- FR-03.3: UI SHALL receive read-only projections and never mutate queues,
  incidents, or Simulation directly.

### FR-04: Alerts

- FR-04.1: Ambient conditions SHALL remain queryable world/entity state and
  SHALL not emit notifications solely because they exist.
- FR-04.2: Operational warnings SHALL enter a prioritized non-disruptive queue.
- FR-04.3: Emergencies SHALL create concise interrupts, identify location and
  immediate risk, and request production pause by default.
- FR-04.4: Every alert SHALL link source evidence, affected entities, severity,
  lifecycle state, and owning incident when grouped.

### FR-05: Incidents and Fault Monitor

- FR-05.1: Incident grouping SHALL use explicit causal/grouping keys, time and
  spatial rules, and stable ordering.
- FR-05.2: Incidents SHALL evolve through detected, active, stabilized,
  engineering-unresolved, resolved, and closed states as applicable.
- FR-05.3: Incident projection SHALL provide expected, observed, consequence,
  immediate causal gap, location, risk, affected entities, and trace links.
- FR-05.4: The park-level monitor SHALL detect authored qualifying world and
  subsystem faults including Strict context stops independently of Agents.
- FR-05.5: Stabilization SHALL not mark the engineering cause repaired.

## Non-Functional Requirements

- **NFR-01: Determinism** - Job creation, queue order, phase transitions,
  monitoring, grouping, and incident evolution are exact.
- **NFR-02: Attention quality** - Density is managed through grouping,
  suppression, priority, and routing rather than spam.
- **NFR-03: Inspectability** - Every job and incident links authoritative
  evidence and exact versions.
- **NFR-04: Accessibility** - Time, phase, alerts, severity, location, and
  actions have persistent non-transient equivalents.

## Invariants

- **INV-01:** Jobs pin exact artifact versions before execution.
- **INV-02:** Ambient state is not notification spam.
- **INV-03:** Related symptoms group through explicit causal rules.
- **INV-04:** The park monitor does not depend on Agent context.
- **INV-05:** Operational stabilization and engineering resolution are distinct.

## Out of Scope

- Physical world rules and Agent decision logic.
- Rating, credits, or unlock calculation.
- Incident Response Team capabilities and cost.
- Visual rendering and sound treatment.

## Product Decisions

- **PD-01: Park-day rhythm** - Pre-opening, operation, closing, and engineering
  create pressure, mastery, and a natural stopping point.
- **PD-02: Meaningful exceptions** - Alerts protect player attention.
- **PD-03: External fault monitoring** - Defense in depth remains possible when
  an Agent stops.

## Implementation Decisions

- **IMP-01:** Model jobs, schedules, alerts, incidents, and day state as explicit
  serializable state machines.
- **IMP-02:** Consume domain events through typed ports and issue commands to
  owning domains; avoid a global untyped event bus.
- **IMP-03:** Keep incident grouping policy authored and versioned where content
  varies.
- **IMP-04:** Expose only `src/park-operations/public.ts`.

## Testing Decisions

- **TST-01:** Exact state-machine tests cover every valid/invalid transition.
- **TST-02:** Schedule fixtures prove idempotent occurrence creation and stable
  priority.
- **TST-03:** Incident matrices cover ambient/warning/emergency, correlation,
  evolution, Strict faults, stabilization, and unresolved engineering.
- **TST-04:** Rendered tests verify persistent history, non-color severity, and
  keyboard actions.

## Proposed Modules

- **MOD-01: Day Coordinator** - Owns park phase and opening/closing rules.
- **MOD-02: Job Service** - Creates, pins, queues, assigns, and transitions jobs.
- **MOD-03: Schedule Engine** - Produces idempotent due occurrences.
- **MOD-04: Alert Router** - Classifies and prioritizes operational signals.
- **MOD-05: Incident Service** - Groups causes and owns incident lifecycle.
- **MOD-06: Park Fault Monitor** - Detects external qualifying faults from exact
  subsystem projections.

## Workflows

### Workflow 1: Scheduled Feeding Job

```text
1. A schedule occurrence becomes due in pre-opening.
2. Operations creates one stable job and resolves production versions.
3. The player or authorized manager assigns a Worker.
4. The job runs through Context, Instruction, Simulation, and Trace.
5. Operations records completion, failure, stop, or escalation.
6. The day coordinator evaluates opening readiness.
```

### Workflow 2: Group an Emergency

```text
1. Authoritative signals report gate fault, robot action, containment, and risk.
2. Alert routing classifies ambient, warning, and emergency signals.
3. Grouping rules attach correlated symptoms to one incident.
4. Emergency requests pause and exposes location and immediate risk.
5. Stabilization updates world safety while engineering remains unresolved.
```
