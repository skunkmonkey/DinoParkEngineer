# Plan: Memory

## Proposed Vertical Slices

1. **One enclosure observation is externalized and retrieved exactly**
   - Blocked by: Context #1-#5, Content Registry #1-#2
   - Adds versioned entries/stores, source lineage, scopes/tags, externalization
     rule, deterministic retrieval predicate, ranking, limit, and costed Context
     adapter.
   - Tests: atomic storage, exact retrieval, non-match, stable tie, failed store,
     and memory-outside-context invisibility.
   - Browser proof: externalize a gate note, inspect the store, retrieve it for
     a later job, and see provenance in context.

2. **A retrieval miss fails despite relevant stored memory**
   - Blocked by: #1
   - Adds considered/rejected result records, missing-route diagnostics, and a
     fixture whose relevant note exists under a nonmatching tag/location rule.
   - Tests: no phantom access, rejection reason, changed behavior, corrected
     rule success, and exact rerun.
   - Browser proof: trace stored-but-unavailable information to the retrieval
     rule rather than blaming the Agent randomly.

3. **Stale shared memory creates an inspectable version conflict**
   - Blocked by: #1-#2
   - Adds shared scope, explicit read/write authority, supersession, freshness,
     conflicting facts, and stable conflict diagnostics.
   - Tests: unauthorized read/write, exact old version, superseded result,
     conflicting entries, and no newest-version substitution.
   - Browser proof: compare what two Agents received and correct the route.

4. **Compact History trades detail for context units**
   - Blocked by: #1, Context #6
   - Adds deterministic summary rules, preserved facts, lost-detail classes,
     summary versions, summary-of-summary lineage, and cost reduction.
   - Tests: repeatability, source order, known lost detail, nested lineage,
     changed rule version, and downstream exception failure.
   - Browser proof: inspect before/after history, then observe a later action that
     needed a lost detail.

5. **Memory validation gate**
   - Blocked by: #1-#4
   - Adds mature-store performance fixtures, local persistence contracts,
     architecture rules, rendered diagnostics, and repository validation.
   - Browser proof: externalize, retrieve, miss, stale conflict, compact, inspect
     lineage, keyboard navigation, and text reflow.
