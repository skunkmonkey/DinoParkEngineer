# Context implementation

`src/context/public.ts` is the sole public boundary for finite Agent Context.
Items carry a stable identity, canonical category, exact source version,
provenance route, integer cost, logical creation tick, priority, pin and
retention eligibility, structured facts, and explicit quality metadata.
Assembly receives declared routes and supplied sources only; it never queries
the world or Memory directly.

Each decision boundary produces immutable before-retention and after-retention
manifests with exact numerical capacity, stable category segments, lifecycle
records, and links. Runtime observations, tool results, messages, task history,
and incident evidence enter only when their creation tick reaches the current
decision boundary. Missing required routes remain `unavailable-required` and
cannot become hidden facts.

Strict / Halt and Signal refuses an overflowing next snapshot, records the
exact excess and audit, and reports a data-only fault through the external park
fault port before another Instruction decision. Keep Newest evicts the oldest
eligible unpinned item by creation tick and stable ID, records every excluded
and retained item, and halts if pinned or ineligible Context still cannot fit.
No continuation helper accepts an over-capacity manifest, and conflicting fact
values fail explicitly instead of being silently selected.

Capacity states and quality diagnostics are separate. Staleness, duplication,
conflict, irrelevance, and missing requirements identify supporting items and
never produce a fabricated quality score. Priority Retention, compaction, and
externalization are Phase 4 integrations through the Memory public contract.
Focused verification is `npm test -- context` plus the Foundation Lab rendered
and browser scenarios.
