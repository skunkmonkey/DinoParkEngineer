# Memory implementation notes

`src/memory/public.ts` is the only import surface for the Memory domain. Memory
is a deterministic, local, versioned store; an entry outside active Context is
not available to an Agent until a retrieval result explicitly selects it.

## Lifecycle

- `createMemoryStore` validates a scoped store, its readers/writers, and its
  exact entries. `createMemoryRepository` owns immutable snapshots and atomic
  append operations.
- `externalizeContextItem` accepts one Context item and an authored
  `MemoryExternalizationRule`. It writes the complete entry before returning a
  `ContextRetentionEvent`; a failed write returns no event, so Context cannot
  record phantom externalization.
- `retrieveMemory` evaluates only serializable predicates (task, Agent,
  location, entity, tags, scopes, ticks, facts, and exact versions), then
  applies explicit ranking and limit fields. The result keeps selected,
  considered, rejected, unavailable, and conflicting records separate. Every
  selected record includes its exact version and context-unit cost.
- `compactHistory` is an authored reducer. It validates exact, ordered source
  versions, preserves only declared fact paths, records known lost-detail
  classes, emits a smaller versioned summary, and keeps nested lineage
  traversable. Repeating the same request is idempotent.

Shared stores use explicit principal-based read/write rules. Scope, routing,
staleness, supersession, broadness, duplication, conflicts, and missing routes
are returned as stable diagnostics; no newer version is silently substituted.

The deterministic fixture from `createMemoryFoundationFixture` covers an
enclosure observation, a retrieval miss, stale shared memory, conflicting
entries, and history compaction. It is headless by design; browser wiring and
Context retention UI belong to downstream integration slices.

