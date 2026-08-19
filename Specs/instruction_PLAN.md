# Plan: Instruction Artifacts

## Proposed Vertical Slices

1. **A readable Prompt drives one deterministic feeding action through clauses**
   - Blocked by: Simulation #1-#3, Content Registry #1-#2
   - Adds Task/Prompt schemas, readable source, one applicability/action clause,
     exact resolution, executor result, and Simulation tool adapter.
   - Tests: applicable/not-applicable, exact tool request, missing fact, invalid
     clause, and structured result.
   - Visible proof: inspect source and clauses, run the action, and see linked
     evidence.

2. **Changing prose alone changes no behavior**
   - Blocked by: #1
   - Adds source-versus-behavior separation in projections and a fixture pair
     with identical clauses and different readable text.
   - Tests: exact decision/world equivalence and rejection of prose-parsing
     hooks.
   - Visible proof: compare and run both versions with identical outcome.

3. **System Prompt and Policy composition constrains gate behavior**
   - Blocked by: #1-#2
   - Adds persistent constraint classes, provenance, precedence, composition,
     duplicate detection, conflict stop/escalation, and stable clause order.
   - Tests: combined artifacts, duplicate policy, contradictory constraints,
     source precedence, and missing included policy.
   - Visible proof: inspect which exact source clause permitted or blocked gate
     opening.

4. **Degraded sensor evidence requires explicit verification fallback**
   - Blocked by: #3, Simulation #2
   - Adds postconditions, evidence-source and freshness rules, bounded retry,
     secondary visual evidence, failure handling, and completion validation.
   - Tests: healthy sensor, false report, degraded sensor, agreeing secondary
     evidence, disagreement, retry limit, stop, and escalation.
   - Visible proof: replay normal and degraded cases and inspect structured
     evidence rather than hidden reasoning.

5. **Reusable Skill and modular Prompt expose real tradeoffs**
   - Blocked by: #3-#4
   - Adds Skill dependencies, self-contained versus modular fixtures,
     composition analysis, required tools, and known-tradeoff projections.
   - Tests: exact dependency versions, stale dependency behavior, lower context
     composition, and no “best” ranking field.
   - Visible proof: compare both approaches and execute under normal and stale
     dependency conditions.

6. **Instruction validation gate**
   - Blocked by: #1-#5
   - Adds complete clause schema documentation, security/architecture lint,
     golden decision fixtures, and repository validation wiring.
   - Tests: focused suite plus full validation.
   - Browser proof: source/clauses, prose independence, conflicts, verification,
     Skill composition, keyboard navigation, and text scaling.
