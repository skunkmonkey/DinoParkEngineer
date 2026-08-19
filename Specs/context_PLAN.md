# Plan: Context

## Proposed Vertical Slices

1. **A feeding decision shows an exact segmented context manifest**
   - Blocked by: Instruction #1-#3, Content Registry #1-#2
   - Adds item/category schemas, provenance, exact versions, integer costs,
     deterministic assembly, used/total math, and immutable projection.
   - Tests: category math, stable order, missing route, duplicate ID, invalid
     item, and exact manifest.
   - Browser proof: inspect Task, Prompt/Skill, Policy, Tool, and Knowledge
     segments numerically and by keyboard.

2. **A missing maintenance route changes Agent behavior fairly**
   - Blocked by: #1, Simulation #2, Instruction #4
   - Adds required/unavailable classification, routing inputs, missing-context
     diagnostics, and a gate-maintenance fixture visible in the world but absent
     from the Agent snapshot.
   - Tests: included versus unavailable fact, behavior difference, provenance,
     no hidden world read, and stable diagnosis.
   - Browser proof: compare world state with actual Agent context and follow the
     missing item to the near miss.

3. **Runtime tool results grow context at decision boundaries**
   - Blocked by: #1-#2
   - Adds observations, tool results, history, messages, before/after snapshots,
     next-demand preview, and capacity-state projection.
   - Tests: addition costs, tick boundary, immutable history, preview accuracy,
     and speed/frame independence.
   - Browser proof: step a job and watch exact additions enter the gauge.

4. **Strict overflow halts and signals without hidden reserve**
   - Blocked by: #3
   - Adds Strict policy, over-capacity rejection, halt result, park-monitor fault
     port, and exact overflow projection.
   - Tests: boundary fit, one-unit excess, pinned excess, halt before action, no
     truncated snapshot, and no emergency capacity.
   - Browser proof: fill context, trigger Strict, and inspect the stopped robot
     and exact excess.

5. **Keep Newest visibly evicts information and changes behavior**
   - Blocked by: #4
   - Adds eligibility, age ordering, pins, excluded destination, retention audit,
     and retained-only instruction execution.
   - Tests: oldest eligible order, tie-break, pins, inability to fit, explicit
     exclusions, and downstream behavior difference.
   - Browser proof: preview eviction, continue, observe behavior, and inspect the
     excluded instruction in the trace.

6. **Priority, compaction, and externalization complete the retention contract**
   - Blocked by: #5, Memory #1-#4
   - Adds Priority Retention plus Memory ports for summary and externalization;
     separate diagnostics for capacity, staleness, duplication, conflict, and
     irrelevance.
   - Tests: full retention matrix and no fake quality score.
   - Browser proof: compare policies on the same exact manifest.

7. **Context validation gate**
   - Blocked by: #1-#6
   - Adds golden manifests, architecture rules, performance fixtures, accessible
     rendered tests, and full validation wiring.
   - Browser proof: composition, missing route, growth, Strict, Keep Newest,
     policy comparison, keyboard, screen reader labels, and reduced motion.
