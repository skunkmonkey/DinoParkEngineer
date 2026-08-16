# Evals and Regression Suites - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`simulation-core`, `instruction-engine`, `context-memory`, `content-registry`, `trace-replay`, and `economy-progression` provide isolated execution, exact content, trace/replay, and credit transactions. The UI uses `platform-foundation`.

### Downstream Dependencies

`engineering-workbench`, `review-deployment`, `curriculum-content`, `telemetry`, and `persistence` consume eval definitions, suites, runs, and coverage.

## Executive Summary

Evals are permanent engineering assets, not opaque scores. Players first see named deterministic scenario cards with expected behavior, risk, build/run economics, and last result; they can then inspect exact refs, fixtures, seeds, assertions, and evidence. Players pay a high one-time authoring cost, assemble named suites, pay a small repeat run cost, test an exact artifact/configuration in an isolated world, inspect every assertion, and replay failures on a park-like surface. An uncovered production incident can become a regression eval from its exact fixture when content permits.

## User Stories

- **GIVEN** available eval cases, **WHEN** the player reviews them, **THEN** each shows behavior, risk/severity, tags, build state, one-time build cost, repeat run cost, and last relevant result.
- **GIVEN** finite credits, **WHEN** selecting cases, **THEN** the player makes a risk-based choice rather than receiving an automatic “best” suite.
- **GIVEN** a built eval and exact subject version, **WHEN** run repeatedly, **THEN** fixture, seed, trace, assertions, and result are identical.
- **GIVEN** a failed production incident without coverage, **WHEN** conversion is allowed and purchased, **THEN** its exact fixture becomes a reusable regression case.

## Functional Requirements

### FR-01: Eval Asset Lifecycle
- FR-01.1: Implement `EvalCase` fields and assertion types from application PRD section 18.4.
- FR-01.2: Unbuilt cases SHALL be discoverable but not runnable; authoring succeeds only after an atomic credit transaction.
- FR-01.3: Built state is permanent for that eval version; reruns charge only run cost.
- FR-01.4: Case versions, fixtures, seed, and expected assertions SHALL be immutable after build.

### FR-02: Suites and Selection
- FR-02.1: Create, rename, update, and remove named suites of exact eval refs without deleting eval assets.
- FR-02.2: Suite selection SHALL allow per-run individual additions/removals.
- FR-02.3: Show total run cost and behavior list before confirmation.
- FR-02.4: Preserve deterministic case order by explicit suite order, then exact ref.
- FR-02.5: Case selection SHALL lead with human-readable scenario title and expected behavior; exact eval ref and fixture metadata SHALL remain available in Technical Details.

### FR-03: Isolated Runs
- FR-03.1: Clone fixture and inject the exact subject Prompt, Skill, System Prompt, or Agent configuration.
- FR-03.2: Execute through public simulation/instruction/context ports and record a trace.
- FR-03.3: Never read/mutate live world state except the confirmed credit transaction and persisted result.
- FR-03.4: Changing only the subject SHALL preserve fixture/seed.

### FR-04: Assertions and Results
- FR-04.1: Support `STATE_EQUALS`, `STATE_IN`, `TOOL_CALLED`, `TOOL_NOT_CALLED`, `INCIDENT_MAX_SEVERITY`, `JOB_STATUS`, `TIME_BELOW`, and `CONTEXT_BELOW`.
- FR-04.2: Each assertion SHALL record expected, observed, pass/fail, evidence refs, and stable message.
- FR-04.3: Overall pass requires every required assertion to pass; no percentage substitutes for case details.
- FR-04.4: Results SHALL include subject ref, case ref, costs, trace/replay ref, start/completion logical metadata, and canonical hash.
- FR-04.5: Result UI SHALL present observed outcome and failed expectation before the complete assertion/evidence record; no aggregate percentage may obscure a failed named case.
- FR-04.6: Replay visualization SHALL consume the same isolated authoritative events as Trace Replay and SHALL not alter Eval output.

### FR-05: Incident Conversion
- FR-05.1: Eligible incidents SHALL expose “Create regression eval from incident.”
- FR-05.2: Conversion SHALL capture exact reconstructable fixture/seed/manifest and require authored assertions plus build cost.
- FR-05.3: Missing reconstruction data or disallowed content SHALL produce an actionable unavailable reason.

## Non-Functional Requirements

- **NFR-01: Determinism** - Same case/subject/engine/content versions produce exact results.
- **NFR-02: Atomicity** - Credit charge and build/run record either both commit or neither commits.
- **NFR-03: Isolation** - A crashing eval cannot corrupt live state or other cases.
- **NFR-04: Accessibility** - Selection/results/replay are keyboard operable and not color-only.

## Invariants

- **INV-01:** Every eval corresponds to a real deterministic simulation state.
- **INV-02:** Authoring cost is charged once per built eval version; run cost once per attempted confirmed case.
- **INV-03:** A suite is a convenience selection, not a hidden aggregate score.
- **INV-04:** Eval execution cannot alter production park state.
- **INV-05:** Historical results retain exact subject and case refs.

## Out of Scope

Probabilistic/model-graded evals, live LLM calls, load testing, automatic purchase of all evals, deployment policy, and freeform fixture editing.

## Product Decisions

- **PD-01:** Build costs are high and run costs low to teach compounding evaluation infrastructure.
- **PD-02:** Warnings may recommend risk coverage, but the player selects cases.
- **PD-03:** MVP includes at least 12 cases, including the application PRD feeding examples.
- **PD-04:** Evals are presented as real park scenarios first and exact engineering evidence second.

## Implementation Decisions

- **IMP-01:** Assertion evaluators are a closed, typed registry in MVP.
- **IMP-02:** Economy is accessed through idempotent transaction commands.
- **IMP-03:** Batch runner isolates each case and returns partial batch results if a later case cannot start.

## Testing Decisions

- **TST-01:** One contract test per assertion type, including negative evidence.
- **TST-02:** Exact rerun and live-state isolation are golden tests.
- **TST-03:** Transaction tests cover insufficient credits, retry/idempotency, crash, and partial batch.

## Proposed Modules

- **MOD-01: EvalCatalogService** - Joins definitions, build state, costs, coverage, and last results.
- **MOD-02: EvalRunner** - Clones, injects, executes, and records isolated cases.
- **MOD-03: AssertionEngine** - Evaluates typed assertions against snapshots/events/traces.
- **MOD-04: EvalSuiteService** - Owns named exact-ref selections.
- **MOD-05: IncidentEvalFactory** - Validates and converts replayable incidents.

## Workflows

### Workflow 1: Build and Run
```text
Review unbuilt case -> confirm build cost -> atomically build -> select cases/suite -> preview run cost -> confirm -> isolate and run each case -> inspect assertion details -> replay failure.
```

### Workflow 2: Regression from Incident
```text
Open eligible incident -> request conversion -> validate reconstructability -> author/select expected assertions -> confirm build cost -> persist immutable case -> add to suite -> run against proposed fix.
```
