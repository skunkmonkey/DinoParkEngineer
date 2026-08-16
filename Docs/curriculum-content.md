# Curriculum Content Pack

The authored MVP lives in `curriculum-content/` and is loaded through the
public Content Registry contract. The pack is immutable, versioned as
`curriculum.mvp.authored-content@1`, and exposes stable `artifact.*`, `eval.*`,
`suite.*`, `scenario.*`, `phase.*`, and `manager.*` references. The production
route is `/curriculum`; it is browser-recognizable without requiring storage,
telemetry, or a browser-only runner.

## Vertical-slice coverage

| Slice | Authored surface | Immediate proof |
| --- | --- | --- |
| 1. Onboarding | phase 0, park skeleton, explicit Fern Prompt, recovery | pack load, fixture validation, ordered phase test |
| 2. Carnivore first slice | unsafe Prompt, incident evidence, explicit Prompt, safe Skill v1, containment policy | unsafe `INCIDENT` with missing containment postcondition; safe `SUCCEEDED` with locked gate |
| 3. Repetition/policy/context | reusable Skills, centralized visitor policy, overflow fixture, context minimizer | executable context builds measure 1,002 CU duplicated versus 658 CU centralized |
| 4. Evals/review/memory | 14 executable evals, four production suites, stale-memory and provenance lessons, Skill revisions | V1 gate-jam run is `PASSED, PASSED, FAILED`; V2 rerun passes and the final safe trace replays exactly |
| 5. Parallelism/orchestration/scale | worker reporting, maintenance fallback, two production Manager versions, escape response | three unsafe and three safe simulations measure 3 early interventions versus 0 late interventions |
| 6. Balance/recovery | production Economy costs, context capacities, recovery floor and assistance amount | the complete first slice remains above the 250-credit recovery floor |

## Acceptance gates

`validateCurriculumPack()` checks all 11 phases in order, cross-references,
fixture validity, source/clauses agreement, manager configuration refs, and
the minimum content counts. `runCurriculumAcceptance()` additionally proves
the first browser slice, deterministic failure/success replays, and lower
modular context load.

The current pack reports 11 phases, 23 artifacts, 10 Skill/System Prompt
artifacts, 14 evals, and 11 scenarios. The opening balance is 3,200 credits;
recovery retains a 250-credit floor and 500-credit assistance path. All 14
evals resolve an executable Prompt, and Standard Feeding asserts that the
containment gate ends locked. The production `/curriculum` route exposes the
ordered production Park job acceptance/run, linked incident and Trace inspection,
commission, review, the exact PRD starter eval build/run, revision, deployment,
successful production Park rerun, and exact replay controls; phase buttons and objectives
remain locked until their evidence exists. Later controls execute the stale
memory/conflicting-clause profiler lesson, three coordinated safe simulations,
an exact evaluation of the deployed authored Manager configuration, and the
six-run phase-10 intervention comparison, allowing the same route to progress
all the way through phase 10.

## Verification commands

Use the bundled Node runtime (no dependency installation is required):

```text
node --experimental-strip-types --test tests/curriculum-content.test.ts
node --experimental-strip-types --test tests/*.test.ts
tsc --noEmit --pretty false
eslint curriculum-content src/curriculum-content tests/curriculum-content.test.ts
node scripts/check-architecture.mjs
```

The targeted suite contains production, golden-path, and adversarial coverage.
The checklist item is marked complete only after targeted tests, the complete
repository suite, typecheck, lint, architecture checks, and production build
all pass.
