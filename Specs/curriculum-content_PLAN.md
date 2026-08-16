# Plan: MVP Curriculum, Scenarios, and Authored Content

## Implementation Boundary and Contracts

Own authored pack files, stable ids/copy, phase/scenario configuration, minimal Scenario Director using public ports, validation fixtures, and full curriculum acceptance tests. Do not change core engines to accommodate invalid content; file interface/contract defects against owners or adapt through published extension points.

Required stable id namespaces:

```text
park.*, enclosure.*, dinosaur.*, gate.*, device.*, agent.*, tool.*
artifact.<type>.*, clause.*, eval.*, suite.*, scenario.*, phase.*, offer.*, balance.*
```

Every phase definition includes `id`, prerequisites, entry signals, fixture/delta, objective ids, available/unlocked refs, incident trigger, success assertions, recovery, and completion outputs. Every exact ref exists in the loaded manifest.

## Proposed Vertical Slices

1. Phase 0 herbivore onboarding and validated MVP park skeleton
   - Blocked by: registry/simulation/progression contracts
   - Author one zone/three enclosure skeleton, archetypes, tools/routes, initial worker, explicit-goal Prompt, objectives, success/recovery, and headless golden run.
2. Mandatory carnivore vertical slice (phases 1, 5, and 6 path)
   - Blocked by: all first-slice engines/UI
   - Author unsafe Prompt, deterministic containment incident, trace evidence, safe Skill commissions/revision, three selected evals with one intended failure, passing deploy/rerun, exact browser acceptance.
3. Repetition, policy, and context phases 2-4
   - Blocked by: #2
   - Add routine jobs, Skill library, eight-total Skill/System Prompt target, duplicated safety then centralized policy, context overflow/duplication, profiler/capacity offers, and modular-cost comparison.
4. Full eval/review/memory phases 5-7
   - Blocked by: #3
   - Complete 12+ eval catalog/costs/assertions/suites, uncovered incident conversion, review regressions, stale memory/refresh/provenance content, and golden failure/success paths.
5. Parallelism/orchestration/scale phases 8-10
   - Blocked by: #4
   - Add workers/jobs/conflicts, intervention pressure, Manager configurations/routing/escalation/reporting failures, late-game park goals, and early-vs-late intervention comparison.
6. Balance, recovery, accessibility copy, and pack acceptance
   - Blocked by: #1-#5
   - Validate all refs/manifests, tune initial integer values without changing principles, ensure no dead ends/spoilers/freeform requirements, run every golden and integrated test, document content authoring/versioning.

## Completion Gate

All phase 0-10 definitions validate and both failure/success golden paths replay exactly. The browser first slice satisfies application PRD 26.2, content counts meet/exceed MVP minimums, source/clauses agree, no dead-end economy exists, and late-game scale shows fewer interventions. No core engine/UI edits are part of this feature unless a separately agreed contract change is made.
