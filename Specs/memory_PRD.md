# Memory - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Content Registry | Resolves immutable memory and summary versions. |
| 2 | Context | Defines items, provenance, externalization, retrieval ports, and capacity. |

### Downstream Dependencies

Instruction receives retrieved items only through Context. Trace records memory
lineage. Workbench designs memory rules. Evals exercise lifecycle failures.
Orchestration may share memory. Persistence restores exact stores and versions.

## Executive Summary

Memory holds versioned prior state outside active context. Explicit rules decide
what may be externalized, summarized, shared, retrieved, or superseded. Every
entry and retrieval retains source, time, version, transformation, and routing
provenance. Memory can reduce routine context load, but stale, broad, missing,
conflicting, or incorrectly routed memory creates fair diagnosable failures.

## User Stories

### Externalize and Retrieve

- **GIVEN** eligible history exceeds active-context needs, **WHEN** it is
  externalized, **THEN** a versioned memory entry preserves source linkage and
  leaves active context only through an explicit retention event.
  - **Acceptance Criteria:** The original and resulting memory remain linked.
- **GIVEN** a later decision matches retrieval rules, **WHEN** memory is queried,
  **THEN** selected entries enter context with exact provenance and cost.
  - **Acceptance Criteria:** Available-but-not-retrieved information remains
    inspectable as a routing failure without pretending the Agent saw it.

### Compaction and Staleness

- **GIVEN** history is compacted, **WHEN** the summary is inspected, **THEN**
  preserved facts, source range, known lost detail, and version are visible.
  - **Acceptance Criteria:** A summary never claims full fidelity.
- **GIVEN** newer world information exists, **WHEN** stale memory is retrieved,
  **THEN** conflict/staleness diagnostics and authored rules determine behavior.
  - **Acceptance Criteria:** Old memory does not silently become current.

## Functional Requirements

### FR-01: Entries and Stores

- FR-01.1: Every memory entry SHALL have stable ID/version, store ID, source
  item IDs/versions, creation tick, observed-world tick where applicable,
  author/producer, scope, tags, facts, confidence category if authored,
  supersession links, and transformation provenance.
- FR-01.2: Memory SHALL remain outside active context until explicitly retrieved
  or retained.
- FR-01.3: Store scope SHALL distinguish Agent, team/manager, enclosure, park,
  and scenario-owned memory where enabled.
- FR-01.4: Mutating retained knowledge SHALL create a new version or explicit
  supersession record.

### FR-02: Externalization

- FR-02.1: Externalization rules SHALL declare eligible categories, target
  store, fact mapping or full-item preservation, version behavior, and failure
  handling.
- FR-02.2: Externalization SHALL be atomic with the Context retention event.
- FR-02.3: Failed storage SHALL prevent Context from pretending the item was
  safely externalized.

### FR-03: Retrieval

- FR-03.1: Retrieval rules SHALL use bounded deterministic predicates over Task,
  Agent, location, entity, tags, time, and exact versions.
- FR-03.2: Results SHALL be ranked and limited by explicit fields with stable
  tie-breaking.
- FR-03.3: Retrieval SHALL return selected, considered, rejected, unavailable,
  and conflicting entries with reasons and context costs.
- FR-03.4: Retrieval SHALL not silently replace one exact version with another.

### FR-04: Compaction

- FR-04.1: Compact History SHALL use authored deterministic summary rules rather
  than a runtime language model.
- FR-04.2: A summary SHALL record source item range/list, preserved structured
  facts, explicitly unavailable detail classes, unit cost, and version.
- FR-04.3: Recompacting the same exact sources and rule version SHALL produce the
  same summary.
- FR-04.4: Summary-of-summary lineage SHALL remain traversable.

### FR-05: Diagnostics and Sharing

- FR-05.1: Diagnostics SHALL identify stale, superseded, broad, conflicting,
  duplicated, missing, and misrouted memory through structured evidence.
- FR-05.2: Shared memory SHALL require explicit read/write authority and routing.
- FR-05.3: An Agent SHALL not receive a shared entry merely because it exists.
- FR-05.4: Player-facing history SHALL reveal which exact memory a decision
  received.

## Non-Functional Requirements

- **NFR-01: Determinism** - Externalization, compaction, retrieval, ranking, and
  diagnostics are exact for versioned inputs.
- **NFR-02: Provenance** - Every entry and summary traces to exact sources and
  transformations.
- **NFR-03: Scale** - Stores support mature-park history through indexed bounded
  retrieval without loading every entry into active context.
- **NFR-04: Privacy** - Memory remains local game data and is never sent to an
  external model or service.

## Invariants

- **INV-01:** Memory outside context is unavailable to the Agent.
- **INV-02:** Retrieval is explicit, deterministic, and traceable.
- **INV-03:** Compaction records lost detail and never pretends perfect recall.
- **INV-04:** Historical memory versions never float.
- **INV-05:** Shared memory requires explicit authority and routing.

## Out of Scope

- Semantic vector search or runtime embeddings.
- Runtime LLM summarization.
- Context capacity and retention ordering outside Memory ports.
- Save-medium implementation.

## Product Decisions

- **PD-01: Memory creates lifecycle gameplay** - It is not unlimited free
  context.
- **PD-02: Deterministic retrieval** - Reproducible rules serve teaching and
  diagnosis better than opaque similarity.
- **PD-03: Loss is explicit** - Compaction trades detail for capacity visibly.

## Implementation Decisions

- **IMP-01:** Use structured fact records and bounded predicate/ranking schemas.
- **IMP-02:** Keep memory data serializable and indexable with stable keys.
- **IMP-03:** Implement summaries as versioned deterministic reducers supplied
  by authored content.
- **IMP-04:** Expose only `src/memory/public.ts`.

## Testing Decisions

- **TST-01:** Retrieval matrices cover match, rank, limit, ties, versions,
  authority, and missing routes.
- **TST-02:** Compaction golden tests assert preserved facts, lost detail,
  lineage, cost, and exact repeatability.
- **TST-03:** Failure tests prove storage and retrieval failures cannot create
  phantom active context.
- **TST-04:** Stale/conflict fixtures connect memory selection to observable
  Agent behavior.

## Proposed Modules

- **MOD-01: Versioned Memory Store** - Appends exact entries and resolves history
  without floating.
- **MOD-02: Externalization Engine** - Atomically maps eligible context items to
  stored entries.
- **MOD-03: Retrieval Engine** - Applies explicit predicates, ranking, limits,
  authority, and stable ties.
- **MOD-04: Compaction Engine** - Produces deterministic summaries and lineage.
- **MOD-05: Memory Diagnostics** - Reports lifecycle, freshness, conflict, and
  routing problems.

## Workflows

### Workflow 1: Externalize and Later Retrieve

```text
1. Context identifies eligible items during retention.
2. Memory validates authority, rule, target store, and source versions.
3. It appends an exact entry and returns storage evidence.
4. Context removes only successfully externalized items.
5. A later Task triggers a retrieval rule.
6. Selected exact entries return as costed context items with provenance.
```

### Workflow 2: Compact History

```text
1. Context supplies an exact eligible history range and summary rule version.
2. Memory validates ordered sources.
3. The deterministic reducer emits preserved facts and known lost detail.
4. A new summary artifact links every source.
5. Context substitutes the summary and records the transformation.
```
