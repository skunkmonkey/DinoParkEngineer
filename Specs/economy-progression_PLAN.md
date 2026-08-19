# Plan: Economy and Progression

## Proposed Vertical Slices

1. **The first open park day produces explainable rating and credits**
   - Blocked by: Park Operations #1-#5, Review/Deployment #3
   - Adds append-only ledger, deterministic day settlement, rating contributors,
     demand/revenue, itemized costs, exact rule versions, and concise summary.
   - Tests: idempotent settlement, derived balance, safety/experience/welfare
     contributions, demand, no double revenue, and evidence links.
   - Browser proof: open, close, inspect rating and credits, and trace each value.

2. **Engineering and eval quotes create visible cost tradeoffs**
   - Blocked by: #1, Workbench #4, Eval Runner #1-#3
   - Adds quote/reserve/commit/cancel, authoring versus runtime/run categories,
     insufficient funds, one-time eval build cost, cheap rerun, and transaction
     links.
   - Tests: atomic cross-feature settlement, cancellation, interrupted run rule,
     permanent authored case, repeat cost, and no partial charge.
   - Browser proof: compare authoring and rerun costs and inspect the ledger.

3. **Park Developer capability unlocks a real new action after pressure**
   - Blocked by: #1-#2, Workbench capability adapter, Curriculum progression
   - Adds prerequisites, available versus purchased, capability actions, exact
     progression content, and problem-before-tool gating.
   - Tests: locked/available/purchased, missing pressure/prereq, idempotency,
     load restore, and no developer hiring fields.
   - Browser proof: experience context pressure, then unlock Context Optimization.

4. **One expressive reward visibly personalizes the park**
   - Blocked by: #1, Rendering Assets reward family, Player Experience Park View
   - Adds reward purchase/inventory/place/remove projections, exact asset ID,
     visitor/store appearance, and negligible/no mechanical bonus.
   - Tests: purchase, placement, persistence contract, duplicate policy, removal,
     and no compounding economy effect.
   - Browser proof: buy and see a gift-shop plushie or sign.

5. **Expansion is offered but never silently accepted**
   - Blocked by: #1-#4
   - Adds prerequisites, opportunity, previewed permanent responsibility,
     intentional acceptance, temporary contract distinction, and new scope
     activation.
   - Tests: no auto-expansion, decline/defer, exact acceptance, save/reload,
     contract expiry, and mastered reliability unchanged.
   - Browser proof: earn an enclosure opportunity, defer it, then accept later.

6. **Suspension finance prevents a dead save without erasing consequences**
   - Blocked by: #1-#5, Incident Response suspension slice
   - Adds catastrophic thresholds, revenue stop, restricted recovery wallet,
     allowed spending, debt/restriction records, reopening transition, and trust
     restoration through safe operation.
   - Tests: insufficient funds, restricted use rejection, mandated eval funding,
     preserved history, reduced demand, no timer recovery, and rescue economics.
   - Browser proof: enter suspension, fund required work, reopen, and inspect debt.

7. **Economy and Progression validation gate**
   - Blocked by: #1-#6
   - Adds balance fixtures, accessibility tests, architecture lint, and full
     validation.
   - Browser proof: settle, quote, unlock, reward, expansion, suspension/recovery,
     keyboard, text scale, and exact evidence.
