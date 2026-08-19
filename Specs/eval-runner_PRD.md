# Eval Runner - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Simulation | Instantiates and executes real deterministic scenarios. |
| 2 | Instruction Artifacts | Executes candidate behavior. |
| 3 | Context | Assembles exact eval decision snapshots and retention. |
| 4 | Trace and Replay | Records/replays every case. |
| 5 | Content Registry | Resolves exact cases, suites, candidates, and dependencies. |

### Downstream Dependencies

Review and Deployment selects and records eval evidence. Workbench authors cases.
Economy supplies build/run costs. Recovery mandates suites. Curriculum Content
supplies cases. Persistence saves permanent assets and results.

## Executive Summary

Eval Runner turns expected behavior into reusable deterministic engineering
assets. Every case is a real isolated simulation fixture with explicit expected
observable outcomes. Players select cases or suites based on risk and cost,
execute exact candidate versions, inspect expected versus observed results, and
replay failures. No pass rate or reliability number is fabricated.

## User Stories

### Select and Run

- **GIVEN** a candidate change and authored cases, **WHEN** the player selects a
  subset, **THEN** risks, one-time availability, exact versions, and estimated
  run cost are visible before execution.
  - **Acceptance Criteria:** The player is not forced to buy or run every case.
- **GIVEN** selected cases, **WHEN** the suite runs, **THEN** each case executes
  the same authoritative rules as production in an isolated environment.
  - **Acceptance Criteria:** Production world, safety, rating, and revenue do not
    change.

### Diagnose and Reuse

- **GIVEN** a failed case, **WHEN** inspected, **THEN** expected and observed
  behavior, failed assertions, trace, and synchronized replay are available.
  - **Acceptance Criteria:** The same fixture can rerun after revision for
    like-for-like comparison.
- **GIVEN** an authored case or suite, **WHEN** later changes are reviewed,
  **THEN** it remains a reusable permanent engineering asset.
  - **Acceptance Criteria:** Results name exact case and artifact versions.

## Functional Requirements

### FR-01: Eval Cases

- FR-01.1: A case SHALL have stable ID/version, title, risk/category, authored
  scenario fixture, exact baseline content, setup, candidate injection point,
  expected observable assertions, timeout/tick bound, and build/run cost refs.
- FR-01.2: Assertions SHALL evaluate structured world, job, context, trace, tool,
  message, and outcome records through bounded deterministic operators.
- FR-01.3: Cases SHALL not execute arbitrary code from authored content.
- FR-01.4: Authored cases SHALL remain reusable and historical versions resolvable.

### FR-02: Suites and Selection

- FR-02.1: Players SHALL be able to select individual cases and named versioned
  suites.
- FR-02.2: Selection SHALL show included risks, exact cases, unavailable cases,
  estimated run cost, and prior relevant results without prescribing one answer.
- FR-02.3: Suites SHALL preserve explicit case order and exact versions.
- FR-02.4: Duplicate suite entries SHALL collapse or reject explicitly according
  to one documented rule.

### FR-03: Execution

- FR-03.1: The runner SHALL instantiate a fresh isolated Simulation, Instruction,
  Context, Memory where required, and Trace environment for every case.
- FR-03.2: Candidate versions and all dependencies SHALL resolve exactly before
  execution.
- FR-03.3: Case execution SHALL produce completed, passed, failed, invalid,
  timed-out, or interrupted status with structured reason.
- FR-03.4: Parallel execution MAY be used only when case ordering and results
  remain deterministic.
- FR-03.5: Production state and production persistence SHALL be inaccessible to
  eval commands.

### FR-04: Results and Scoring

- FR-04.1: Each assertion SHALL record expected, observed, pass/fail, evidence
  links, and mismatch details.
- FR-04.2: Case status SHALL derive from executed assertions and validity.
- FR-04.3: Suite totals and pass rates SHALL derive only from completed executed
  cases and SHALL label invalid/interrupted cases separately.
- FR-04.4: Results SHALL record exact case, suite, candidate, dependency,
  fixture, runner-schema, and trace versions.
- FR-04.5: The UI SHALL not display fabricated reliability probabilities.

### FR-05: Rerun and Comparison

- FR-05.1: A prior result SHALL be rerunnable only when its exact supported
  inputs resolve; otherwise the block is explicit.
- FR-05.2: Like-for-like comparison SHALL align case/assertion IDs and report
  changed outcomes, context, actions, cost, and trace links.
- FR-05.3: A failed case SHALL open in Trace and Replay at the first relevant
  mismatch without hiding preceding evidence.

## Non-Functional Requirements

- **NFR-01: Real results** - Every displayed outcome derives from execution.
- **NFR-02: Isolation** - Eval cannot mutate production state or economy except
  through an explicit completed run-cost transaction owned by Economy.
- **NFR-03: Determinism** - Exact inputs produce exact results and result order.
- **NFR-04: Responsiveness** - Batch execution may use Web Workers after
  measurement while UI progress remains accessible and deterministic.

## Invariants

- **INV-01:** Every eval is a real scenario.
- **INV-02:** No fake percentages or probabilistic reliability claims.
- **INV-03:** Production is isolated.
- **INV-04:** Cases, suites, candidates, dependencies, and results are exact-versioned.
- **INV-05:** Rerun compares like for like or blocks explicitly.

## Out of Scope

- Selecting deployment decisions.
- Economy pricing/balance or authoring-time progression.
- Runtime LLM graders.
- Tests that modify production as a shortcut.

## Product Decisions

- **PD-01: Evals are authored assets** - Up-front investment compounds through
  cheap reuse.
- **PD-02: Risk-based choice** - Finite resources make coverage judgment part of
  play.
- **PD-03: Replayable failure** - A red mark is the start of diagnosis, not the
  whole result.

## Implementation Decisions

- **IMP-01:** Reuse production domain services through isolated factories; do
  not maintain a mock scorer.
- **IMP-02:** Use declarative assertion schemas and total evaluators.
- **IMP-03:** Keep execution worker-ready and serialize progress/results through
  stable messages.
- **IMP-04:** Expose only `src/eval-runner/public.ts`.

## Testing Decisions

- **TST-01:** Meta-tests prove displayed scores derive from assertion records.
- **TST-02:** Isolation tests attempt every production mutation path and fail.
- **TST-03:** Fixture tests cover pass, fail, invalid, timeout, interrupt,
  missing version, rerun, and comparison.
- **TST-04:** Rendered tests distinguish eval from production without color and
  support keyboard selection/replay.

## Proposed Modules

- **MOD-01: Eval Asset Catalog** - Validates versioned cases, assertions, and suites.
- **MOD-02: Eval Planner** - Resolves exact selections, risks, dependencies, and
  cost quote inputs.
- **MOD-03: Isolated Case Runner** - Instantiates production-equivalent domain
  services in an inaccessible sandbox.
- **MOD-04: Assertion Engine** - Evaluates bounded observable expectations.
- **MOD-05: Result Projector** - Derives exact case/suite summaries and evidence.
- **MOD-06: Eval Comparator** - Aligns exact reruns and reports differences.

## Workflows

### Workflow 1: Run Selected Evals

```text
1. Resolve the candidate and selected exact cases/suites.
2. Show risks and estimated Economy run cost.
3. Confirm the run and reserve/charge through the Economy port.
4. Instantiate each fresh isolated scenario.
5. Execute production rules and record trace/results.
6. Derive case and suite summaries from assertions.
7. Open failures in synchronized replay when selected.
```

### Workflow 2: Compare a Revision

```text
1. Select the prior result and a new exact candidate.
2. Resolve the identical case fixtures and dependencies where possible.
3. Rerun all selected cases.
4. Align assertions and report changed evidence and outcomes.
5. Preserve both immutable result sets for Review.
```
