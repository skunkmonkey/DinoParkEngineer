# Incident Response - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Park Operations | Supplies grouped incidents, phase, pause, and park-level faults. |
| 2 | Simulation | Supplies exact dangerous world state and allowed stabilization tools. |
| 3 | Trace and Replay | Records intervention evidence and links engineering cause. |
| 4 | Economy and Progression | Quotes/settles response, closure, recovery, and suspension costs. |

### Downstream Dependencies

Player Experience renders response cards and staged stabilization. Orchestration
may receive explicit automatic-call authority. Persistence and Curriculum
Content preserve and teach recovery.

## Executive Summary

Incident Response provides an external deterministic safety net when ordinary
automation fails or stops in danger. A park-level monitor and grouped incident
make the situation visible; the player can call an abstract Incident Response
Team with explicit location, capability, arrival time, cost, and consequences.
The team may evacuate, contain, or recover but never extends Agent context or
repairs the Prompt, Skill, Policy, route, Retention Policy, or deployment that
caused the incident.

## User Stories

### Call and Stabilize

- **GIVEN** a stopped robot or dangerous incident, **WHEN** a response is
  available, **THEN** the player sees immediate risk, location, capabilities,
  arrival time, cost, closures, and expected stabilization before calling.
  - **Acceptance Criteria:** Calling once lives are at risk is preferable to
    refusing solely to avoid the fee.
- **GIVEN** the team is activated, **WHEN** it arrives and acts, **THEN** visible
  deterministic operations stabilize allowed world state.
  - **Acceptance Criteria:** The responsible artifact/context/deployment remains
    unchanged and engineering-unresolved.

### Suspend and Recover

- **GIVEN** catastrophic casualties, repeated unresolved safety failure, or
  financial collapse, **WHEN** suspension triggers, **THEN** the park closes and
  preserves exact history in an active engineering recovery workflow.
  - **Acceptance Criteria:** Reopening requires correction/revert, mandated
    evals, and intentional compliant deployment rather than waiting.

## Functional Requirements

### FR-01: Eligibility and Response Plans

- FR-01.1: Eligibility SHALL derive from exact incident/world state and authored
  capability rules, independent of failed-Agent context.
- FR-01.2: A response plan SHALL declare incident/location, immediate risks,
  selected capabilities, arrival tick, estimated duration, Economy quote,
  closures, preconditions, and expected stabilization boundaries.
- FR-01.3: Unavailable capabilities and reasons SHALL be explicit.
- FR-01.4: Multiple calls for the same grouped incident SHALL be idempotent or
  rejected explicitly.

### FR-02: Activation and Arrival

- FR-02.1: Player activation SHALL confirm exact response plan and Economy
  reservation.
- FR-02.2: Later progression MAY authorize a Worker or Manager to activate the
  team only through explicit authority, criteria, and cost acceptance.
- FR-02.3: Arrival and action scheduling SHALL use deterministic park ticks and
  stable order.
- FR-02.4: Response status SHALL include requested, dispatched, en route,
  operating, stabilized, failed/limited, and complete as applicable.

### FR-03: Stabilization

- FR-03.1: Capabilities MAY include visitor evacuation, area isolation,
  temporary containment, dinosaur recovery support, gate override, and stranded
  robot recovery as authored.
- FR-03.2: Every action SHALL execute through Simulation commands with explicit
  authority and evidence.
- FR-03.3: Actions SHALL respect declared access, timing, capacity, and failure
  limits; the team is not magical.
- FR-03.4: Intervention SHALL record closures, downtime, costs, rating effects,
  casualties avoided/incurred as observable outcomes, and trace links.

### FR-04: Engineering Boundary

- FR-04.1: Incident Response SHALL not add, remove, retain, retrieve, or extend
  Agent context.
- FR-04.2: It SHALL not revise, deploy, revert, or mark resolved any responsible
  instruction, context route, memory rule, tool definition, or orchestration
  configuration.
- FR-04.3: Stabilized incidents SHALL remain engineering-unresolved until the
  responsible workflow records correction and evidence.
- FR-04.4: Response records SHALL link but never overwrite original job/trace/
  deployment evidence.

### FR-05: Operating License Suspension

- FR-05.1: Suspension triggers SHALL use exact evidence and versioned rules from
  Economy/Park Operations.
- FR-05.2: Suspension SHALL stop visitor operation/revenue, stabilize active
  danger through allowed response, and preserve all specified world,
  engineering, progression, history, and expressive state.
- FR-05.3: Recovery review SHALL identify associated incidents and deployments
  without hidden reasoning.
- FR-05.4: Reopening SHALL require responsible revision/revert, exact mandated
  eval passes, and intentional compliant deployment.
- FR-05.5: Reopening restrictions and reduced rating/demand SHALL be explicit;
  safe operation, not time alone, restores trust.

## Non-Functional Requirements

- **NFR-01: Determinism** - Eligibility, schedule, commands, stabilization, and
  suspension/reopening transitions are exact.
- **NFR-02: Fairness** - Response has meaningful cost and limits but does not
  make preventable death economically preferable.
- **NFR-03: Inspectability** - Every action and boundary is traceable.
- **NFR-04: Accessibility** - Risk, arrival, capability, status, cost, and
  engineering-unresolved state are persistently non-color communicated.

## Invariants

- **INV-01:** Incident Response is external to Agent context.
- **INV-02:** It stabilizes the world but never repairs engineering cause.
- **INV-03:** It is an abstract capability, not a hiring/direct-control minigame.
- **INV-04:** Rescue refusal solely to avoid cost is never optimal once lives
  are at risk.
- **INV-05:** Primary suspension preserves the save and requires active recovery.

## Out of Scope

- Direct manual rescue gameplay or staff management.
- Unbounded instant rescue.
- Automatic artifact correction.
- Final numeric response timing/cost before balance prototypes.

## Product Decisions

- **PD-01: External recovery** - Hard context limits remain real.
- **PD-02: Defense in depth** - Park monitoring and response can act when an
  Agent cannot.
- **PD-03: Suspension over deletion** - Catastrophe becomes consequential
  engineering recovery.

## Implementation Decisions

- **IMP-01:** Model responses and suspension as explicit serializable state
  machines using typed Simulation/Economy/Park Operations ports.
- **IMP-02:** Capability definitions and balance values live in exact content.
- **IMP-03:** Enforce engineering-boundary tests at public APIs; no Context,
  Workbench, or Deployment mutation ports are accepted.
- **IMP-04:** Expose only `src/incident-response/public.ts`.

## Testing Decisions

- **TST-01:** Response matrices cover eligibility, unavailable plans, arrival,
  limited capability, failure, idempotency, and stabilization.
- **TST-02:** Boundary tests prove Agent context/artifacts/deployments unchanged.
- **TST-03:** Economy tests prove callout cost and lives-at-risk dominance.
- **TST-04:** Suspension tests prove preservation, mandated work, restricted
  funding, no timer recovery, and reopening.

## Proposed Modules

- **MOD-01: Response Planner** - Produces exact eligible plans, limitations,
  schedules, and quote inputs.
- **MOD-02: Response Service** - Owns activation and response lifecycle.
- **MOD-03: Stabilization Coordinator** - Issues allowed authoritative world
  commands and records evidence.
- **MOD-04: Engineering Boundary Auditor** - Demonstrates unchanged responsible
  systems and links unresolved causes.
- **MOD-05: Suspension and Reopening Service** - Owns preserved catastrophic
  state and compliant active recovery gates.

## Workflows

### Workflow 1: Recover a Stopped Robot

```text
1. Park monitor groups the Strict stop and hazardous location into an incident.
2. Response Planner shows risk, arrival, robot recovery/containment actions,
   cost, closures, and limitations.
3. Player confirms; Economy reserves the callout.
4. Team arrives on deterministic ticks and acts through Simulation.
5. World becomes stable and response consequences settle.
6. Incident remains engineering-unresolved and links the unchanged artifact.
```

### Workflow 2: Reopen After Suspension

```text
1. Suspension preserves the closed park and exact associated evidence.
2. Recovery review identifies incidents and deployed versions.
3. Player revises or reverts responsible engineering.
4. Player runs and passes exact mandated safety evals.
5. Player intentionally submits a compliant reopening deployment.
6. Park reopens under explicit restrictions and reduced demand.
```
