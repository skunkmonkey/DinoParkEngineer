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

Priority Retention evicts lower-priority eligible unpinned items first, then
uses creation tick and stable ID for ties. Compact History accepts only exact
Memory sources that correspond to eligible Task History items, replaces those
items with the returned versioned summary, and records known lost detail.
Externalize and Retrieve removes an item only after Memory returns a successful
storage event; failed storage leaves the item visible and halts if Context
still cannot fit. Explicit retrieval results enter as costed Memory items at a
decision boundary. `compareRetentionResults` projects exact outcomes for every
policy without a best-policy score.

Capacity states and quality diagnostics are separate. Staleness, duplication,
conflict, irrelevance, and missing requirements identify supporting items and
never produce a fabricated quality score. Advanced retention is integrated
through the Memory public contract.
Focused verification is `npm test -- context` plus the Foundation Lab rendered
and browser scenarios.
