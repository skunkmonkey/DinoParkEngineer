# Context - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Content Registry | Resolves exact versioned context sources and dependencies. |
| 2 | Instruction Artifacts | Declares required facts, instruction sources, and decision inputs. |

### Downstream Dependencies

Memory supplies retrievable items. Trace records manifests. Park Operations
uses snapshots for jobs. Player Experience renders capacity and diagnostics.
Workbench edits routes. Evals and Orchestration exercise context behavior.

## Executive Summary

Context makes an Agent's available information a visible, finite, provenance-
labeled engineering resource. It assembles exact Task, System Prompt, Skill,
Policy, knowledge, memory, tool, message, observation, and history items at
decision boundaries. When required material exceeds capacity, an explicit
Retention Policy either halts or transforms the manifest. Nothing is silently
truncated, and capacity is never confused with relevance or quality.

## User Stories

### Inspect and Compose

- **GIVEN** an Agent decision, **WHEN** the player inspects its context, **THEN**
  every included and excluded item shows provenance, exact version, cost,
  category, reason, and lifecycle state.
  - **Acceptance Criteria:** Used and total units equal the itemized manifest.
- **GIVEN** a proposed route or artifact change, **WHEN** context composition
  changes, **THEN** the capacity and category deltas are previewed.
  - **Acceptance Criteria:** A low-capacity result is not labeled better without
    separate quality evidence.

### Overflow and Retention

- **GIVEN** runtime additions exceed capacity, **WHEN** retention runs, **THEN**
  Strict halts or another explicit policy deterministically excludes or
  transforms eligible items before the next decision.
  - **Acceptance Criteria:** Before/after manifests, policy, excess, affected
    items, and downstream behavior are replayable.

## Functional Requirements

### FR-01: Context Items

- FR-01.1: Every item SHALL have stable ID, category, provenance, exact source
  version, deterministic unit cost, creation/observation tick, priority,
  eligibility, pin state, and structured payload reference.
- FR-01.2: Categories SHALL include Task, System Prompt, Skill, Policy,
  Knowledge, Memory, Tool, Message, Observation, Tool Result, and Task History
  as applicable.
- FR-01.3: Context payloads SHALL be data-only and validated before assembly.
- FR-01.4: Items with equal policy rank SHALL use stable deterministic order.

### FR-02: Assembly

- FR-02.1: Assembly SHALL use exact Agent configuration, job versions, routing
  rules, available sources, prior retained manifest, and decision-boundary
  additions.
- FR-02.2: The result SHALL identify included, unavailable-required,
  inapplicable, excluded, compacted, and externalized items.
- FR-02.3: Used units SHALL equal the exact sum of included item costs.
- FR-02.4: The assembler SHALL not query world or memory state outside supplied
  ports and declared routes.

### FR-03: Runtime Growth

- FR-03.1: Observations, tool results, messages, task history, incident evidence,
  retrieved memory, and new instructions MAY add deterministic items between
  decisions.
- FR-03.2: Additions SHALL be applied only at explicit decision boundaries.
- FR-03.3: Before-retention and after-retention manifests SHALL be immutable and
  linked.
- FR-03.4: A preview SHALL identify next-decision demand and excess before
  applying the configured policy where the workflow permits.

### FR-04: Retention Policies

- FR-04.1: Strict / Halt and Signal SHALL reject the over-capacity manifest and
  stop before the next decision.
- FR-04.2: Keep Newest SHALL evict oldest eligible unpinned items first.
- FR-04.3: Priority Retention SHALL preserve pinned and higher-priority eligible
  items, then evict by explicit priority and stable tie-break order.
- FR-04.4: Compact History SHALL replace eligible sources with a smaller exact
  versioned summary supplied by Memory while recording lost detail.
- FR-04.5: Externalize and Retrieve SHALL transfer eligible items through the
  Memory public contract and continue only with the retained manifest.
- FR-04.6: If no valid transformation can fit required context, the Agent SHALL
  halt explicitly.

### FR-05: Diagnostics and Projection

- FR-05.1: Capacity projection SHALL expose numerical used/total units and
  category segments.
- FR-05.2: Capacity states SHALL be distinct from staleness, duplication,
  conflict, irrelevance, missing requirement, and dependency diagnostics.
- FR-05.3: Diagnostics SHALL identify supporting items and rules rather than
  asserting a fabricated quality score.
- FR-05.4: Fleet projections SHALL aggregate pressure without hiding exact
  selected-Agent manifests.

## Non-Functional Requirements

- **NFR-01: Determinism** - Assembly, math, diagnostics, and retention are exact
  for identical inputs.
- **NFR-02: Inspectability** - Every inclusion, exclusion, and transformation
  has structured reason and provenance.
- **NFR-03: Performance** - Assembly supports measured mature-fleet decision
  rates without sacrificing manifest history.
- **NFR-04: Accessibility** - Capacity meaning never depends only on gauge
  color, animation, or transient movement.

## Invariants

- **INV-01:** Context is visible, finite, provenance-labeled, and version-aware.
- **INV-02:** Overflow is never silent.
- **INV-03:** There is no hidden emergency capacity.
- **INV-04:** Capacity utilization is not a quality score.
- **INV-05:** Instruction sees only the final retained snapshot.

## Out of Scope

- Persisting and retrieving external memory internals.
- Deciding physical tool outcomes.
- Rendering the gauge or retention animation.
- Economic price and unlock rules.

## Product Decisions

- **PD-01: Context is a signature resource** - Its composition and lifecycle are
  primary gameplay, not developer-only diagnostics.
- **PD-02: Retention is contextual** - Strategies are choices with failure modes,
  not a linear upgrade ladder.
- **PD-03: Strict first** - The curriculum introduces a hard limit before
  controlled loss, compaction, or retrieval.

## Implementation Decisions

- **IMP-01:** Use immutable serializable manifests with canonical item order and
  integer context units.
- **IMP-02:** Retention policies are pure transformations returning complete
  audit records.
- **IMP-03:** Diagnostics use explicit analyzers over item metadata; no opaque
  heuristic “quality” score.
- **IMP-04:** Expose only `src/context/public.ts`.

## Testing Decisions

- **TST-01:** Exact capacity math covers every category and zero/boundary/overflow
  values.
- **TST-02:** A retention matrix covers eligibility, pins, priority, age,
  deterministic ties, inability to fit, and behavior-changing loss.
- **TST-03:** Tests fail any continuation whose overflow lacks a recorded policy
  transformation.
- **TST-04:** Rendered tests verify numbers, labels, patterns, lists, and reduced
  motion equivalents.

## Proposed Modules

- **MOD-01: Context Item Catalog** - Validates item identity, cost, provenance,
  category, and lifecycle metadata.
- **MOD-02: Context Assembler** - Produces exact immutable decision manifests.
- **MOD-03: Capacity Planner** - Computes current and preview demand and excess.
- **MOD-04: Retention Engine** - Applies explicit pure deterministic policies.
- **MOD-05: Context Diagnostics** - Reports missing, stale, duplicate,
  conflicting, and irrelevant evidence separately from capacity.
- **MOD-06: Context Projector** - Supplies detailed and fleet-level read models.

## Workflows

### Workflow 1: Assemble a Decision Snapshot

```text
1. Resolve exact routed sources for the Agent and job.
2. Validate and order context items.
3. Add eligible runtime items from the prior decision.
4. Calculate used units and required missing items.
5. Apply retention when capacity is exceeded.
6. Freeze the retained manifest for Instruction and Trace.
```

### Workflow 2: Keep Newest Overflow

```text
1. A tool result causes next-decision demand to exceed capacity.
2. Record the complete before-retention manifest and excess.
3. Sort eligible unpinned items by oldest then stable ID.
4. Exclude items until the manifest fits or halt if impossible.
5. Record excluded items and pass only the retained snapshot to Instruction.
```
