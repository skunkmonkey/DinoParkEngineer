# Plan: Eval Runner

## Proposed Vertical Slices

1. **The free opening eval executes one real gate-maintenance scenario**
   - Blocked by: Simulation #1-#3, Instruction #1-#4, Context #1-#3,
     Trace #1-#3, Content Registry #1-#3
   - Adds case/assertion schemas, exact fixture/candidate injection, isolated
     runner, expected/observed records, trace, result status, and persistent
     SIMULATION framing.
   - Tests: actual pass/fail, production unchanged, exact versions, invalid case,
     and no fabricated score field.
   - Browser proof: run the provided case and replay the failure.

2. **Players select risks and see exact run cost before execution**
   - Blocked by: #1, Economy quote port
   - Adds case catalog, risk/category, availability, individual selection,
     selected order, estimated cost, prior result links, and confirmation.
   - Tests: selection totals, unavailable case, duplicate handling, cancel,
     declined cost, and keyboard selection.
   - Browser proof: choose normal and degraded-sensor cases and review cost.

3. **A named suite runs multiple cases and derives its score**
   - Blocked by: #2
   - Adds versioned suites, fresh per-case environments, deterministic progress,
     pass/fail/invalid/timeout/interrupted handling, and derived suite summaries.
   - Tests: suite order, mixed status denominator, timeout, interrupt, parallel-
     order equivalence, and result immutability.
   - Browser proof: run a containment suite and inspect each result.

4. **Revised behavior reruns like for like and compares traces**
   - Blocked by: #3, Workbench #4
   - Adds exact rerun, assertion alignment, changed outcome/context/action/cost,
     Trace comparison links, and missing historical input block.
   - Tests: unchanged rerun, fixed regression, new regression, missing version,
     changed case rejection, and exact comparison.
   - Browser proof: compare failed opening candidate with revised candidate.

5. **Eval validation gate**
   - Blocked by: #1-#4
   - Adds worker-backed performance option after profiling, isolation security
     tests, rendered accessibility coverage, architecture lint, and validation.
   - Browser proof: select, quote, run, cancel, fail, replay, rerun, compare,
     keyboard, text scale, and non-color mode distinction.
