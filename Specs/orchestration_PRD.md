# Orchestration - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Instruction Artifacts | Executes delegation, escalation, reporting, and authority clauses. |
| 2 | Context | Routes finite provenance-labeled context and messages. |
| 3 | Memory | Supplies explicitly shared/retrieved state where configured. |
| 4 | Park Operations | Supplies jobs, priorities, alerts, schedules, and assignments. |
| 5 | Trace and Replay | Records Manager-to-Worker-to-world chains. |

### Downstream Dependencies

Player Experience renders fleet pressure and Manager surfaces. Economy unlocks
Agents/capabilities. Incident Response accepts explicit call authority.
Persistence, Curriculum Content, and Telemetry preserve/teach/test coordination.

## Executive Summary

Orchestration creates scalable automation through explicit Worker and Manager
Agent organization. Additional Workers introduce throughput plus attention,
shared-resource, routing, and coordination pressure. A Manager Agent becomes
valuable only after that demand is experienced and acts solely through declared
authority, priorities, delegation, context routes, escalation, reporting, and
success conditions. Vague management never grants magical coordination.

## User Stories

### Multiple Workers

- **GIVEN** multiple Worker Agents and overlapping work, **WHEN** they share
  gates, schedules, tools, or context sources, **THEN** locally reasonable
  actions may create deterministic diagnosable coordination failures.
  - **Acceptance Criteria:** The complete cross-Agent chain is inspectable.
- **GIVEN** specialized Workers, **WHEN** jobs are routed, **THEN** smaller
  relevant context can improve bounded work while specialization dependencies
  and handoffs remain visible.
  - **Acceptance Criteria:** Specialization is a tradeoff, not free competence.

### Manager Agent

- **GIVEN** coordination pressure, **WHEN** the Manager becomes available, **THEN**
  the player configures exact authority, priorities, delegation, routing,
  escalation, reporting, and success conditions.
  - **Acceptance Criteria:** “Keep things running” alone does not solve the park.
- **GIVEN** configured reporting, **WHEN** routine work succeeds, **THEN** the
  Manager can reduce player attention while meaningful exceptions remain
  visible according to rules.
  - **Acceptance Criteria:** Omitted information can cause fair traceable failure.

## Functional Requirements

### FR-01: Agent Topology

- FR-01.1: The feature SHALL model stable exact-versioned Worker and Manager
  Agent configurations, roles, capabilities, tools, capacity, context routes,
  and organizational relationships.
- FR-01.2: Progression SHALL begin with one Worker and introduce additional
  Workers before one Manager.
- FR-01.3: A Worker SHALL have one active manager relationship at a time unless
  a later explicit topology defines conflict semantics.
- FR-01.4: Invalid cycles, duplicate ownership, or unsupported topology SHALL
  block activation.

### FR-02: Authority and Priorities

- FR-02.1: Manager authority SHALL explicitly enumerate job classes, Workers,
  operational commands, resource scopes, message/report access, escalation
  actions, deployment limitations, and Incident Response call permission.
- FR-02.2: Actions outside authority SHALL be rejected and traced.
- FR-02.3: Priorities SHALL be explicit, deterministic, and use stable ties.
- FR-02.4: Conflicting authority or priorities SHALL invoke explicit conflict
  handling rather than arbitrary choice.

### FR-03: Delegation and Routing

- FR-03.1: Delegation rules SHALL declare eligible jobs, Worker selection,
  assignment limits, prerequisite capabilities/tools, exact artifact selection,
  context routes, deadline/priority, and failure behavior.
- FR-03.2: Delegated jobs SHALL pin exact versions before Worker execution.
- FR-03.3: Routing SHALL provide only explicitly selected Task, instruction,
  state, memory, and messages and SHALL preserve provenance/cost.
- FR-03.4: Manager and Worker SHALL not access undeclared shared world or memory
  state through Orchestration.

### FR-04: Messages, Reports, and Attention

- FR-04.1: Messages/reports SHALL have stable ID, sender/recipient, type, tick,
  related job/incident, structured content, provenance, context cost, delivery
  state, and retention behavior.
- FR-04.2: Reporting rules SHALL declare routine summaries, exception thresholds,
  cadence, recipients, required evidence, and aggregation.
- FR-04.3: Suppressed/aggregated detail SHALL remain traceable even when not
  routed into player or Agent context.
- FR-04.4: Delivery failure, delay, overflow, or omission SHALL be explicit.

### FR-05: Escalation and Success

- FR-05.1: Escalation rules SHALL declare condition, target, urgency, authority,
  evidence, expected response, and fallback.
- FR-05.2: Escalation MAY target the player, Manager, another authorized Agent,
  Park Operations, or Incident Response according to explicit capability.
- FR-05.3: Success conditions SHALL be observable structured outcomes, not vague
  prose interpretation.
- FR-05.4: A Manager SHALL not mark a job successful without required Worker/
  Simulation evidence.

### FR-06: Coordination Diagnostics

- FR-06.1: Diagnostics SHALL identify assignment gaps, authority violations,
  missing routes, shared-resource conflicts, report omissions, message overflow,
  stale shared state, and conflicting priorities through evidence.
- FR-06.2: A complete trace SHALL connect Manager decision, delegated job,
  Worker context/actions, report, world outcome, and escalation.
- FR-06.3: Fleet projections SHALL emphasize meaningful exceptions and context/
  workload pressure rather than every routine message.

## Non-Functional Requirements

- **NFR-01: Determinism** - Topology, routing, delegation, messaging, reporting,
  escalation, and diagnostics are exact.
- **NFR-02: Inspectability** - Every authority and handoff decision has structured
  provenance.
- **NFR-03: Scale** - Mature fleet fixtures remain operable through aggregation
  without losing drill-down evidence.
- **NFR-04: Authenticity** - Failures arise from explicit coordination design,
  not arbitrary Manager incompetence.

## Invariants

- **INV-01:** Manager Agents have no magical authority, context, or competence.
- **INV-02:** Every delegated job pins exact versions.
- **INV-03:** Messages and reports have provenance and context cost.
- **INV-04:** Simulation remains physical authority.
- **INV-05:** Orchestration reduces attention only according to explicit rules.

## Out of Scope

- Human employee hiring or management.
- Freeform natural-language Manager interpretation.
- Unlimited hierarchy or self-modifying organizations in MVP.
- Direct ownership of jobs, context, memory, or response capabilities.

## Product Decisions

- **PD-01: Demand before Manager** - Players feel coordination pressure first.
- **PD-02: Explicit governance** - Authority, routing, reporting, and escalation
  are the mechanic.
- **PD-03: Throughput has coordination cost** - More Agents are not pure power.

## Implementation Decisions

- **IMP-01:** Model organization/topology and rules as validated versioned data.
- **IMP-02:** Reuse Instruction for rule evaluation and Context/Memory for actual
  routed information; do not create orchestration-only hidden context.
- **IMP-03:** Use deterministic job/message queues with explicit priority and
  stable IDs.
- **IMP-04:** Expose only `src/orchestration/public.ts`.

## Testing Decisions

- **TST-01:** Topology tests cover cycles, ownership, activation, versions, and
  capability compatibility.
- **TST-02:** Matrices cover authority, priority ties, delegation, routing,
  messages, reports, omission, overflow, escalation, and success evidence.
- **TST-03:** Shared-gate fixtures prove locally reasonable cross-Agent failure.
- **TST-04:** Rendered tests cover fleet density, drill-down chain, keyboard
  configuration, and exception aggregation.

## Proposed Modules

- **MOD-01: Agent Topology Registry** - Validates exact Worker/Manager structures.
- **MOD-02: Authority Engine** - Checks explicit scoped permissions.
- **MOD-03: Delegation Router** - Selects exact eligible work, Workers, versions,
  and context routes.
- **MOD-04: Message and Report Service** - Delivers costed provenance-labeled
  communications and aggregation.
- **MOD-05: Escalation Coordinator** - Routes authorized structured exceptions.
- **MOD-06: Coordination Diagnostics** - Explains failures across the complete chain.

## Workflows

### Workflow 1: Manager Delegates Feeding

```text
1. Park Operations exposes due jobs and priorities.
2. Manager context contains routed schedules, Worker capabilities, and rules.
3. Instruction evaluates authority and delegation clauses.
4. Orchestration selects an eligible Worker and exact job artifacts.
5. Worker receives only configured context and executes normally.
6. Report rules route structured outcome or exception back.
7. Trace links Manager decision through world result.
```

### Workflow 2: Reporting Omission Creates a Failure

```text
1. Maintenance state is available to one Worker but excluded from configured reports.
2. Manager delegates feeding using the incomplete routed state.
3. Feeding Worker acts locally reasonably on its actual context.
4. Shared gate interaction creates a deterministic incident.
5. Diagnostics link the omitted report and routing rule to the cross-Agent chain.
```
