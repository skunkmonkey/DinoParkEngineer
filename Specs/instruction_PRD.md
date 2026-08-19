# Instruction Artifacts - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Content Registry | Resolves exact Prompt, Skill, System Prompt, Policy, tool, and knowledge versions. |
| 2 | Simulation | Supplies authoritative observations, tool requirements, and physical command results. |

### Downstream Dependencies

Context assembles its inputs. Trace records applicability and actions. Park
Operations runs jobs. Evals execute cases. Workbench inspects and composes
clauses. Review compares behavior. Orchestration uses delegation and escalation.

## Executive Summary

Instruction Artifacts deterministically translate an Agent's Task and available
context into allowed tool actions. Readable Prompt, Skill, System Prompt, and
Policy text teaches professional patterns, but validated machine-readable
clauses alone control applicability, priorities, preconditions, verification,
failure handling, delegation, and escalation. This separation makes behavior
educational, exact, and replayable without a runtime LLM.

## User Stories

### Inspectable Behavior

- **GIVEN** an instruction artifact, **WHEN** the player inspects it, **THEN**
  readable source and behavioral clauses are both visible and clearly distinct.
  - **Acceptance Criteria:** Changing prose alone does not change execution.
- **GIVEN** multiple applicable clauses, **WHEN** an Agent decides, **THEN**
  deterministic priority and conflict rules select or block an action.
  - **Acceptance Criteria:** The trace names applied, rejected, and conflicting
    clauses without inventing hidden reasoning.

### Verification and Failure

- **GIVEN** a clause requires gate verification, **WHEN** the available evidence
  is degraded or insufficient, **THEN** explicit verification and failure rules
  determine retry, alternate evidence, stop, or escalation.
  - **Acceptance Criteria:** “Verify closure” is not treated as automatically
    satisfied.

## Functional Requirements

### FR-01: Artifact Classes

- FR-01.1: The feature SHALL support Task, Prompt, Skill, System Prompt, Policy,
  tool instruction, knowledge-selection, verification, failure, escalation,
  delegation, and reporting clauses as applicable.
- FR-01.2: Each artifact SHALL expose exact identity/version, readable source,
  author, class, context cost, required tools, dependencies, clauses, and known
  tradeoffs.
- FR-01.3: Readable prose SHALL never be parsed or pattern-matched to decide
  runtime behavior.

### FR-02: Clause Model

- FR-02.1: Clauses SHALL declare stable ID, type, applicability conditions,
  priority, required context facts, allowed action, preconditions,
  postconditions, verification, and failure continuation as applicable.
- FR-02.2: Conditions and effects SHALL use validated bounded operators over
  structured context and tool schemas; arbitrary executable code is prohibited.
- FR-02.3: Applicable clauses SHALL be ordered by explicit priority, source
  precedence, and stable clause ID.
- FR-02.4: Conflict rules SHALL deterministically select, combine, stop, or
  escalate and SHALL remain inspectable.

### FR-03: Decision Cycle

- FR-03.1: Given exact Task, Agent configuration, context snapshot, tool
  definitions, and prior structured result, the executor SHALL return one
  allowed action, completion, stop, wait, or escalation result.
- FR-03.2: A decision result SHALL identify applicable clauses, unsatisfied
  requirements, selected action, required evidence, and structured outcome
  reason.
- FR-03.3: The executor SHALL not read unavailable world state.
- FR-03.4: Tool execution SHALL be delegated to Simulation and its returned
  evidence SHALL feed the next decision boundary.

### FR-04: Verification and Failure

- FR-04.1: Verification SHALL name an observable claim, acceptable evidence
  sources, freshness, agreement rules, and failure behavior.
- FR-04.2: Retry SHALL be bounded and deterministic.
- FR-04.3: Failure handling SHALL distinguish retry, alternate tool/evidence,
  safe stop, job failure, escalation, and allowed degraded completion.
- FR-04.4: An artifact SHALL not claim a physical postcondition that Simulation
  evidence does not establish.

### FR-05: Composition

- FR-05.1: Artifact composition SHALL preserve source provenance for every
  clause and detect duplicate or conflicting behavior.
- FR-05.2: System Prompt and Policy constraints SHALL remain persistent only
  when included in the actual context snapshot.
- FR-05.3: Modular and self-contained approaches SHALL both be valid and expose
  their context/dependency tradeoffs.
- FR-05.4: Composed output SHALL resolve exact dependency versions before use.

## Non-Functional Requirements

- **NFR-01: Determinism** - Exact inputs produce the same applicability,
  selected action, and structured explanation.
- **NFR-02: Safety of authored data** - Content clauses cannot execute arbitrary
  JavaScript or mutate world state directly.
- **NFR-03: Inspectability** - The executor returns structured provenance, not
  chain-of-thought.
- **NFR-04: Extensibility** - New bounded clause types can be added with schemas,
  semantics, fixtures, and version compatibility.

## Invariants

- **INV-01:** Prose is never behavior.
- **INV-02:** Simulation adjudicates every physical effect.
- **INV-03:** The executor sees only the supplied context snapshot.
- **INV-04:** Clause order and conflict outcomes are stable.
- **INV-05:** Trace data contains structured evidence, never fabricated inner
  reasoning.

## Out of Scope

- Freeform natural-language interpretation.
- Runtime OpenAI calls.
- Context selection, capacity, retention, or memory retrieval.
- Artifact deployment and production pinning.

## Product Decisions

- **PD-01: Professionally readable exemplars** - Source text remains a valuable
  learning object even though clauses execute.
- **PD-02: Multiple valid architectures** - The engine does not encode a single
  globally best Prompt or Skill.
- **PD-03: Evidence-based verification** - Verification quality is modeled, not
  inferred from a reassuring phrase.

## Implementation Decisions

- **IMP-01:** Use discriminated-union clause schemas and total evaluators in
  strict TypeScript.
- **IMP-02:** Conditions use a versioned declarative expression vocabulary with
  explicit operators and field paths.
- **IMP-03:** Return data-only decision records suitable for structured clone,
  saves, traces, and golden tests.
- **IMP-04:** Expose only `src/instruction/public.ts`.

## Testing Decisions

- **TST-01:** Prose-independence tests change text while preserving clauses and
  assert identical behavior.
- **TST-02:** Clause matrices cover applicability, precedence, combination,
  conflicts, missing context, retry, verification, stop, and escalation.
- **TST-03:** Security tests reject arbitrary code, unknown operators, invalid
  field paths, and direct world effects.
- **TST-04:** Production and eval fixtures share the same executor.

## Proposed Modules

- **MOD-01: Clause Schema Catalog** - Validates bounded declarative instruction
  types.
- **MOD-02: Applicability Engine** - Evaluates available structured facts and
  produces stable candidates.
- **MOD-03: Conflict Resolver** - Applies explicit precedence and combination
  rules.
- **MOD-04: Decision Executor** - Returns one allowed structured next step.
- **MOD-05: Verification Engine** - Assesses evidence freshness, source, and
  agreement.
- **MOD-06: Composition Analyzer** - Preserves provenance and reports duplicate
  or conflicting clauses.

## Workflows

### Workflow 1: Select and Execute an Action

```text
1. Receive exact Task, artifacts, context snapshot, and tools.
2. Validate resolved artifact and clause versions.
3. Evaluate applicability using only supplied facts.
4. Resolve precedence and conflicts deterministically.
5. Return a tool request, wait, stop, completion, or escalation record.
6. Receive Simulation evidence for the next decision cycle.
```

### Workflow 2: Verify Gate Closure

```text
1. A postcondition requires a contained closed gate.
2. Verification checks permitted evidence sources and freshness.
3. Healthy agreeing evidence satisfies the claim.
4. Degraded or conflicting evidence invokes the exact fallback clause.
5. The executor retries, uses secondary evidence, stops, or escalates.
```
