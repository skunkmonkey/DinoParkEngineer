# Context and Memory Engineering - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| Feature | Relationship |
|---|---|
| `content-registry` | Supplies exact artifact text, dependencies, tags, and Tool Description records. |
| `simulation-core` | Supplies current observable working state and logical time. |

### Downstream Dependencies

`instruction-engine` blocks/executes from snapshots; Engineering, Agent, Review, Eval, Trace, Orchestration, Economy, and Persistence surfaces consume context data and findings.

## Executive Summary

This feature makes Context a visible, constrained engineering resource. It is introduced as an understandable load/budget and named composition before expanding into exact Context Units (CU), provenance, freshness, duplicates, conflicts, irrelevant modules, and over-broad dependencies. It deterministically assembles job Context, enforces budgets without silent truncation, and retrieves scoped Memory. The profiler unlocks after players feel Context pressure; it explains findings but never auto-solves architecture.

## User Stories

- **GIVEN** selected job artifacts/tools/memory, **WHEN** context is projected, **THEN** the player sees total load, budget, and every contributing item before execution.
- **GIVEN** load exceeds budget, **WHEN** the job starts, **THEN** it blocks without silently dropping context.
- **GIVEN** stale maintenance memory and newer direct observation, **WHEN** clauses use context, **THEN** authoritative observation wins and stale use remains visible.
- **GIVEN** duplicated or irrelevant instructions, **WHEN** the profiler is available, **THEN** it names exact refs, cost, and reason while leaving the decision to the player.

## Functional Requirements

### FR-01: CU Calculation
- FR-01.1: Text CU SHALL equal `ceil(UTF-8 byte length / 4)`.
- FR-01.2: Tools, memories, knowledge, and working state SHALL use explicit deterministic authored/calculated integer costs.
- FR-01.3: The calculation SHALL include task Prompt, transitive loaded Skills/System Prompts/Knowledge, available Tool schemas, retrieved memories, and working state.
- FR-01.4: Projected and actual snapshots SHALL use the same rules and identify their mode.

### FR-02: Snapshot Assembly
- FR-02.1: Implement the `ContextSnapshot` baseline from application PRD section 18.5 plus `createdAtLogicalTime` and `mode`.
- FR-02.2: Each item SHALL expose ref, kind, exact version if applicable, cost, provenance, freshness when applicable, and applicability match.
- FR-02.3: Dependency traversal and item order SHALL be stable and cycle-safe.
- FR-02.4: Total greater than budget SHALL return `BLOCKED_CONTEXT_OVERFLOW`; MVP SHALL not truncate or rank a subset.
- FR-02.5: Player-facing composition SHALL use canonical item kind and human-readable title before raw ref; totals and exact refs remain available and reconcile identically.

### FR-03: Memory
- FR-03.1: Memory records SHALL include id, scope, observedAt, optional validUntil/TTL, provenance, subject refs, content/facts, context cost, and retention status.
- FR-03.2: Retrieval SHALL respect agent access, scope, explicit query/tags, and stable ordering.
- FR-03.3: Freshness SHALL be evaluated against logical time and policy, never wall time.
- FR-03.4: Current direct observation SHALL supersede conflicting memory for authoritative fact selection without deleting history.

### FR-04: Analysis and Profiler
- FR-04.1: Detect exact/semantic-key duplicates, explicit clause conflicts, stale items, applicability mismatches, unused modules when execution evidence is supplied, and over-broad dependency branches.
- FR-04.2: Findings SHALL include stable code, involved refs, CU impact, severity, evidence, and suggested question/remediation category.
- FR-04.3: The basic meter/composition is always available; advanced profiler findings are gated by progression.
- FR-04.4: Analysis SHALL not mutate artifact selection or memory.
- FR-04.5: Before profiler unlock, the UI MAY summarize composition but SHALL still expose overflow, budget, item categories, and exact detail on demand; after unlock, findings become prominently actionable.

## Non-Functional Requirements

- **NFR-01: Determinism** - UTF-8 calculation, traversal, freshness, and findings are stable.
- **NFR-02: Explainability** - Totals always reconcile exactly with item costs.
- **NFR-03: Performance** - Assemble/analyze typical MVP context (up to 500 items) in under 50 ms in production on a typical laptop.
- **NFR-04: Privacy/Security** - Authored core content only; no external transmission.

## Invariants

- **INV-01:** Context overflow never silently omits selected items in MVP.
- **INV-02:** Context capacity does not remove duplication/staleness/conflicts.
- **INV-03:** Memory is not authoritative when directly observed current world state disagrees.
- **INV-04:** Snapshot item costs sum exactly to total load.
- **INV-05:** Analysis is advisory and side-effect free.

## Out of Scope

Advanced automatic retrieval under overflow, vector search, LLM summarization, artifact editing, clause execution, shared-manager routing policy, and UI shell ownership.

## Product Decisions

- **PD-01:** Display 1,000 CU as 1.0k context; retain exact values in details.
- **PD-02:** Missing and excess context are both meaningful failure/cost sources.
- **PD-03:** Profiler appears only after context pressure/duplication has been experienced.
- **PD-04:** Context visualization progresses from load -> named composition -> provenance/findings; numerical and technical evidence is never discarded.

## Implementation Decisions

- **IMP-01:** Use semantic keys authored on clauses for duplicate/conflict analysis; never NLP-compare source prose.
- **IMP-02:** Snapshot assembly and analysis are separate deep modules.
- **IMP-03:** Memory storage is behind a port so persistence can replace in-memory storage.

## Testing Decisions

- **TST-01:** UTF-8 fixtures include ASCII, emoji, and multi-byte text boundary cases.
- **TST-02:** Golden snapshots cover exact costs/order/findings.
- **TST-03:** Test stale boundary at `validUntil`, scope access, direct-observation precedence, and overflow immutability.

## Proposed Modules

- **MOD-01: ContextAssembler** - Resolves selected inputs and returns projected/actual snapshots or blocks.
- **MOD-02: ContextCostModel** - Pure CU and fixed-cost calculations.
- **MOD-03: MemoryService** - Records, retrieves, expires, and exposes memories through a small scoped API.
- **MOD-04: ContextAnalyzer** - Produces non-mutating profiler findings.

## Workflows

### Workflow 1: Preflight
```text
Resolve selected refs -> retrieve permitted memory -> obtain working state -> calculate every item -> analyze -> compare total to budget -> return snapshot or explicit overflow block.
```

### Workflow 2: Stale Memory
```text
Retrieve old Gate 3 health memory -> label stale at current logical time -> direct observe says degraded -> snapshot keeps both with provenance -> authoritative fact points to observation -> trace can show whether a clause used stale data.
```
