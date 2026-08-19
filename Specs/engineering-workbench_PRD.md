# Engineering Workbench - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Content Registry | Supplies exact artifacts, dependencies, and version history. |
| 2 | Instruction Artifacts | Supplies readable source, clauses, composition, and tradeoffs. |
| 3 | Context | Supplies composition, capacity deltas, routing, and diagnostics. |
| 4 | Player Experience | Supplies focused-mode framing, navigation, and accessibility conventions. |

### Downstream Dependencies

Eval Runner receives candidate versions/cases. Review and Deployment receives
change requests. Economy owns capability cost/unlocks. Curriculum Content
supplies exemplars and Handbook entries. Persistence restores work/history.

## Executive Summary

The Engineering Workbench is the player's focused AI-engineering environment
and the home of the single Park Developer progression mechanism. It supports
commissioning, inspecting, comparing, composing, and revising Prompt, Skill,
System Prompt, Policy, context-route, memory, tool, eval, and orchestration
artifacts as capabilities unlock. It teaches through actionable work and
professional exemplars, not lectures or developer hiring simulation.

## User Stories

### Inspect and Compare

- **GIVEN** an artifact becomes relevant after a park problem, **WHEN** the
  player opens it, **THEN** readable source, clauses, context cost, dependencies,
  required tools, versions, and tradeoffs are visible together.
  - **Acceptance Criteria:** The surface never ranks choices as simply Basic,
    Better, Best.
- **GIVEN** two approaches, **WHEN** compared, **THEN** missing verification,
  duplicated policy, irrelevant load, dependency/staleness risk, and behavior
  differences are supported by exact records.
  - **Acceptance Criteria:** Comparison distinguishes context capacity from
    context quality.

### Produce Engineering Work

- **GIVEN** an unlocked Park Developer capability, **WHEN** the player
  commissions or composes work, **THEN** a proposed exact version and stated
  goal are created without changing production.
  - **Acceptance Criteria:** Production changes only through Review and
    Deployment.
- **GIVEN** an encountered concept, **WHEN** the player opens the Engineering
  Handbook, **THEN** concise canonical definitions and encountered examples are
  available but never required for routine play.
  - **Acceptance Criteria:** Handbook content cannot enter Agent context.

## Functional Requirements

### FR-01: Park Developer

- FR-01.1: The park SHALL have one Park Developer represented by a coherent face,
  presence, capability progression, work queue, and concise communication.
- FR-01.2: Capabilities SHALL include Prompt engineering, Skill authoring,
  context optimization, eval creation, tool integration, memory architecture,
  Agent design, and orchestration.
- FR-01.3: Each capability level SHALL unlock concrete work types or controls,
  not only numerical quality.
- FR-01.4: The feature SHALL NOT include developer recruiting, candidates,
  salaries, replacement, specialization teams, or human-team management.

### FR-02: Artifact Inspection

- FR-02.1: Inspection SHALL expose exact ID/version, class, author, goal/source,
  readable text, clauses, context cost/composition, dependencies, tools,
  tradeoffs, availability, deployment status, and version history as applicable.
- FR-02.2: Prose and behavioral clauses SHALL be visually and semantically
  distinct.
- FR-02.3: Exact clauses, versions, traces, and diffs MAY use monospace;
  ordinary UI SHALL remain approachable and legible.
- FR-02.4: Historical versions SHALL remain inspectable but not silently
  editable.

### FR-03: Comparison and Composition

- FR-03.1: Comparison SHALL align exact versions and show readable, behavioral,
  context, dependency, tool, verification, failure, and tradeoff differences.
- FR-03.2: Claims such as duplicate, missing, stale, conflict, or irrelevant
  SHALL link supporting structured evidence.
- FR-03.3: Early play SHALL offer professional authored exemplars for selection
  or commissioning after demand exists.
- FR-03.4: Midgame composition SHALL use deterministic components/clauses and
  validate resulting dependencies and conflicts.
- FR-03.5: Late work SHALL support architecture decisions over policies, routes,
  retrieval, memory, verification, escalation, and delegation as owning features
  unlock them.

### FR-04: Work Requests and Candidate Versions

- FR-04.1: A work request SHALL declare stable ID, goal, requested artifact/work
  type, base version, capability requirement, inputs, cost/time quote supplied
  by Economy, and status.
- FR-04.2: Completed work SHALL produce an immutable candidate version and
  structured change summary.
- FR-04.3: Revision requests SHALL create new work linked to prior feedback;
  completed candidates SHALL not be overwritten.
- FR-04.4: Candidate creation SHALL never alter active deployments.

### FR-05: Engineering Handbook

- FR-05.1: The Handbook SHALL define canonical application terms, visual
  symbols, encountered examples, and links to relevant incidents.
- FR-05.2: Entries SHALL unlock through experience and remain searchable/filterable.
- FR-05.3: The Handbook SHALL remain distinct from operational Knowledge,
  Policies, and other Agent context.
- FR-05.4: Decorative previous-engineer wildlife damage MAY theme the Handbook
  but SHALL not obscure content or controls.

## Non-Functional Requirements

- **NFR-01: Learnability** - The minimum relevant concepts appear after a
  motivating problem; advanced controls remain progressively disclosed.
- **NFR-02: Information integrity** - Every comparison and delta derives from
  exact artifacts and analyzers.
- **NFR-03: Accessibility** - Source, clauses, diffs, composition, and work
  actions support keyboard, text reflow, and non-color change semantics.
- **NFR-04: Focus** - Communication is concise and tied to actionable work.

## Invariants

- **INV-01:** There is one Park Developer, not a hiring simulation.
- **INV-02:** The player remains reviewer and decision-maker.
- **INV-03:** Candidate work never changes production without deployment.
- **INV-04:** Handbook material never becomes Agent context.
- **INV-05:** Comparison does not fabricate quality scores or a universal best.

## Out of Scope

- Eval execution, review decisions, deployment, or rollback.
- Economy balances and capability pricing.
- Freeform prose as executable behavior.
- Human developer teams and management.

## Product Decisions

- **PD-01: One Developer with growing capability** - Focus stays on transferable
  AI-engineering judgment.
- **PD-02: Recognition to architecture** - Select/inspect grows into compose and
  govern.
- **PD-03: Brief actionable communication** - No lecture character.
- **PD-04: Code-review familiarity** - Professional development patterns make
  AI engineering legible.

## Implementation Decisions

- **IMP-01:** Workbench consumes read-only public APIs and owns UI/work-request
  orchestration, not artifact execution semantics.
- **IMP-02:** Use schema-driven editors for bounded clause/component composition;
  readable prose editing remains non-executable by itself.
- **IMP-03:** Difference calculation occurs in deep analyzers and returns
  serializable semantic diff records.
- **IMP-04:** Expose only `src/engineering-workbench/public.ts`.

## Testing Decisions

- **TST-01:** Inspection tests cover every required artifact field and exact
  historical version.
- **TST-02:** Diff/comparison fixtures cover additions, removals, behavior,
  context, dependencies, duplicates, conflicts, and unsupported claims.
- **TST-03:** Work tests prove immutability, linked revision requests, capability
  gating, and no deployment mutation.
- **TST-04:** Rendered tests cover long source/diffs, keyboard composition,
  text scaling, and Handbook separation.

## Proposed Modules

- **MOD-01: Park Developer Service** - Exposes capability-backed available work
  and concise status.
- **MOD-02: Artifact Inspector** - Projects exact source, clauses, context,
  dependencies, tools, tradeoffs, and history.
- **MOD-03: Semantic Comparator** - Produces evidence-backed multi-dimensional
  differences.
- **MOD-04: Composition Workspace** - Builds validated deterministic candidate
  structures without executing prose.
- **MOD-05: Work Request Service** - Tracks request, completion, feedback, and
  immutable candidate linkage.
- **MOD-06: Engineering Handbook** - Owns unlocked reference content and links
  while remaining outside operational context.

## Workflows

### Workflow 1: Inspect and Compare a Skill

```text
1. A park incident links to the responsible deployed version.
2. Workbench opens paused with the causal operational anchor.
3. The player inspects readable source and exact behavior clauses.
4. A professional candidate or prior version is selected for comparison.
5. Semantic differences show evidence-backed context, dependency, and behavior deltas.
6. The player commissions revision, composes a change, or returns without change.
```

### Workflow 2: Produce a Candidate Version

```text
1. The player selects an unlocked work type and states/selects its goal.
2. Workbench validates base version, inputs, capability, and Economy quote.
3. Park Developer work completes according to the owning progression rules.
4. An immutable exact candidate and structured summary are registered.
5. The candidate remains outside production and becomes available to Review.
```
