# Deterministic Instruction Engine - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| Feature | Relationship |
|---|---|
| `simulation-core` | Provides authoritative snapshots, tool commands, results, and events. |
| `content-registry` | Resolves pinned artifacts, clauses, dependencies, and tools. |
| `context-memory` | Builds/validates the job context snapshot before compilation. |

### Downstream Dependencies

`trace-replay`, `eval-runner`, `park-operations`, and `multi-agent-orchestration` consume job outcomes and execution events.

## Executive Summary

The Instruction Engine converts authored semantic clauses into deterministic agent behavior. It validates a job, resolves pinned versions, obtains context, compiles applicable clauses, applies the mandated precedence rules, calls simulation tools, evaluates goals/postconditions/fallbacks/escalations, and terminates with an explicit outcome. Human-readable prompt text is never parsed to make runtime decisions.

## User Stories

- **GIVEN** “Feed Rex” with only a hunger goal, **WHEN** the job executes, **THEN** the agent can achieve the goal yet leave an unsafe world state, with an explicit outcome showing that no containment postcondition existed.
- **GIVEN** conflicting task and safety clauses, **WHEN** they apply, **THEN** hard safety wins and the conflict is observable.
- **GIVEN** a missing dependency, tool, or over-budget context, **WHEN** the job starts, **THEN** it blocks before unsafe actions and states the exact remediation.
- **GIVEN** a failed primary action and authored fallback/escalation, **WHEN** it executes, **THEN** only the deterministic eligible path runs.

## Functional Requirements

### FR-01: Job Validation and Start
- FR-01.1: Resolve exactly pinned artifact versions and validate dependencies/tools before action.
- FR-01.2: Obtain one immutable context snapshot; overflow SHALL produce `BLOCKED_CONTEXT_OVERFLOW` without executing a tool.
- FR-01.3: Missing configuration SHALL produce a stable blocked reason, not an exception or substitution.

### FR-02: Clause Compilation
- FR-02.1: Support GOAL, PRECONDITION, ACTION, SEQUENCE, CONSTRAINT, POSTCONDITION, FALLBACK, ESCALATION, DELEGATION, REPORTING, RETRIEVAL, and PRIORITY.
- FR-02.2: Compile only machine-readable clauses present in loaded context.
- FR-02.3: False applicability/conditions SHALL remain non-executable and observable as skipped when diagnostically relevant.
- FR-02.4: Unsupported/malformed clauses SHALL fail validation before execution.

### FR-03: Deterministic Resolution
- FR-03.1: Precedence SHALL be hard safety, System Prompt, manager authority, Skill, task Prompt, heuristics/defaults.
- FR-03.2: Within a tier, higher numeric priority wins; ties sort by artifact id then clause id.
- FR-03.3: Conflicts SHALL be emitted as structured provenance.
- FR-03.4: Heuristics may only select explicitly authored default behavior; they may not infer source prose.

### FR-04: Execution State Machine
- FR-04.1: Execute eligible clauses one transition at a time through simulation tool commands.
- FR-04.2: Reevaluate constraints, assertions, incidents, fallback, and escalation after each world event.
- FR-04.3: Terminate only as `SUCCEEDED`, `FAILED`, `ESCALATED`, or `BLOCKED`; goal success with a safety incident SHALL be represented explicitly.
- FR-04.4: Prevent infinite loops through authored/engine step limits with a safe terminal failure and diagnostics.

### FR-05: Provenance Output
- FR-05.1: Emit observable job-received, validation, context, clause, tool, assertion, conflict, status, and outcome events.
- FR-05.2: Provenance SHALL state facts and selected rule reasons, not simulated hidden chain-of-thought.

## Non-Functional Requirements

- **NFR-01: Replayability** - Same inputs produce the same compiled graph, actions, provenance, and outcome.
- **NFR-02: Headless Testability** - Run with in-memory ports and no UI.
- **NFR-03: Safety** - Blocked validation never mutates world state.
- **NFR-04: Diagnostics** - Every terminal outcome contains a stable reason and relevant refs.

## Invariants

- **INV-01:** Source text is never runtime-executed or parsed for behavior.
- **INV-02:** All tool effects pass through the Simulation Core.
- **INV-03:** A job uses pinned artifact versions and one context snapshot.
- **INV-04:** Safety precedence cannot be overridden by lower tiers.
- **INV-05:** Every executed clause and tool call is attributable to stable ids.

## Out of Scope

Content editing, context-cost policy, simulation rules, UI, eval assertions, manager assignment algorithms, runtime LLMs, and freeform prompt compilation.

## Product Decisions

- **PD-01:** Failure modes come from authored clauses/context/world state, not “AI randomness.”
- **PD-02:** Under-specification is valid educational content; the engine does not silently repair it.
- **PD-03:** Observable provenance replaces chain-of-thought.

## Implementation Decisions

- **IMP-01:** Compile to a validated internal rule graph with stable node ids.
- **IMP-02:** Use an explicit, resumable state machine driven by simulation events.
- **IMP-03:** Delegation/reporting clauses emit typed requests; orchestration owns fulfillment.

## Testing Decisions

- **TST-01:** Golden first-feeding traces cover missing postcondition and safe revised Skill.
- **TST-02:** Pairwise precedence/tie tests cover all tiers.
- **TST-03:** Every clause category has success, false-condition, malformed, and failure-path tests.

## Proposed Modules

- **MOD-01: JobExecutor** - Validates, starts, steps, resumes, and terminates jobs.
- **MOD-02: RuleCompiler** - Produces stable graphs from loaded semantic clauses.
- **MOD-03: ClauseResolver** - Applies applicability, precedence, priorities, and conflict reporting.
- **MOD-04: OutcomeEvaluator** - Evaluates goals, postconditions, incidents, escalation, and safe limits.

## Workflows

### Workflow 1: Execute Job
```text
Resolve pinned content -> validate tools/dependencies -> request context -> compile graph -> select eligible clause -> call tool -> consume world event -> evaluate assertions -> repeat -> persist typed outcome.
```

### Workflow 2: Gate Failure
```text
close_gate returns JAMMED -> primary sequence cannot continue -> applicable fallback is evaluated -> if no safe fallback succeeds, escalation emits containment incident request -> job ends ESCALATED, never routine-complete.
```
