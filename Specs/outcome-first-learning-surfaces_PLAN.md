<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: Outcome-First AI-Engineering Learning Surfaces

## Goal and Owning Requirements

Reframe Trace, Context, Engineering, Evals, Review, and orchestration around Outcome -> Explanation -> Evidence while retaining complete exact data and canonical terminology. Owns `player-experience_PRD.md` FR-06.

Blocked by Player-Facing Identity plan #1-#5. Individual slices can run alongside later Graphical Park work once identity/disclosure primitives exist.

## Proposed Vertical Slices

1. Add a lossless OutcomeStory projection for one failed feeding trace
 - Blocked by: Player-Facing Identity plan #5
 - Checklist: OLS-001 through OLS-008
 - Project task intent, named Agent/entities/artifacts, Context availability, consequential actions, observed outcome, and relevant evidence refs from existing trace/events. Relevance rules must be deterministic and must not claim causality beyond observable facts/clauses. Keep the full 10k-capable trace explorer intact under Evidence.
 - Visible result: a player understands the missing containment postcondition before opening the raw event stream.
 - Tests: golden summary content/order, no fabricated fields, every summary evidence item resolves to the full trace, virtualization unaffected.

2. Make Context progressive and visual without hiding exact CU
 - Blocked by: #1
 - Checklist: OLS-009 through OLS-016
 - Present load/budget first, then named composition by canonical kind, then exact items/provenance/findings. Respect profiler unlock timing. Overflow, stale/conflict, and applicability warnings are never hidden. Reuse the exact Context snapshot totals and refs; do not recalculate in UI.
 - Visible result: early players see why the task is heavy; later players can diagnose the exact duplicate/stale refs.
 - Tests: total reconciliation, pre/post unlock disclosure, overflow and stale visibility, keyboard access.

3. Rebuild AI Workshop library/detail around recognizable artifacts
 - Blocked by: Player-Facing Identity plan #2, #5
 - Checklist: OLS-017 through OLS-024
 - Group canonical artifact categories in AI Workshop. Cards/detail lead with type/title/version, operational purpose, Context cost, deployment, and Eval coverage. Source remains a primary learning artifact; clauses/refs/registry metadata become Technical Details. Locked categories follow curriculum disclosure.
 - Visible result: Skills section lists `Carnivore Feeding v3` and makes its source, dependencies, coverage, and exact identity easy to inspect in the correct order.
 - Tests: every artifact kind, historical versions, locked categories, source selection, exact-ref links.

4. Present Evals as named deterministic scenarios and replay failures visually
 - Blocked by: #1 and Graphical Park plan #1-#2 for visual replay
 - Checklist: OLS-025 through OLS-033
 - Replace registry-like rows with scenario cards showing name, expected behavior, risk, build/run cost, state, and last result. Preserve explicit selection and suite overrides. Results lead with expected vs observed and link to assertions/evidence. Reuse Park scene projection for isolated replay; no fake score or animation state.
 - Visible result: player selects `Gate Fails During Exit`, watches the exact failure, and can inspect fixture/seed/assertions under Technical Details.
 - Tests: build/run economics, selection order, case-detail completeness, isolated replay parity, accessibility.

5. Make Review the clear change -> risk -> evidence -> deploy workflow
 - Blocked by: #2, #3, #4
 - Checklist: OLS-034 through OLS-042
 - Lead with named artifact/configuration, goal, versions, and expected operational impact. Present source change and Context/dependency impact, then named Eval selection/results, then deploy/revision action. Preserve semantic diff, exact refs, stale-result rules, warnings, hard gates, atomic deployment, and revert history.
 - Visible result: the first Skill revision can be understood and safely deployed without interpreting raw refs, while every exact record remains inspectable.
 - Tests: review state machine/rendering, stale Eval behavior, warning confirmation, hard gate, deploy/revert atomicity, keyboard flow.

6. Reframe Agent and Manager operations around work and exceptions
 - Blocked by: #2, #3
 - Checklist: OLS-043 through OLS-050
 - Worker surfaces lead with name, location, activity, queue pressure, Context load, and exceptions. Manager surfaces lead with mission, assignment graph, pressure reduction, escalations, and reports; routing rules, eligibility facts, tie-breaks, refs, and traces remain Evidence. Preserve deliberate pre-Manager overload and post-Manager routine summarization.
 - Visible result: the player can see why orchestration is needed and what it changes without losing explicit authority/routing evidence.
 - Tests: pre/post unlock presentation, assignment/rejection evidence, serious exception visibility, deterministic scheduling parity.

7. Connect deep links and complete the integrated learning workflow
 - Blocked by: #1-#6 and Graphical Park plan #6
 - Checklist: OLS-051 through OLS-057
 - Ensure Park outcome -> Trace summary -> Prompt/Skill -> Context -> Eval result/replay -> Review/revision/deploy -> safe Park rerun preserves selections, friendly labels, and exact refs. Update implementation docs and browser acceptance fixtures.
 - Visible result: the user can traverse the complete engineering loop without losing the park problem or artifact identity.
 - Tests: deep-link integration, history/back/refresh, saved state, full browser acceptance, `npm run validate`, computer-use verification.

## Exit Criteria

- Every learning surface follows Outcome -> Explanation -> Evidence.
- Canonical terms remain explicit and exact technical evidence remains complete.
- The integrated change/Eval/review/deploy loop is understandable without raw-id literacy.
- Deterministic outputs, economic transactions, and version/deployment rules remain unchanged.

