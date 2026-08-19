# Curriculum Content - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Content Registry | Validates, packages, versions, and resolves all authored content. |
| 2 | Rendering Asset Pipeline | Supplies approved assets for scenarios and rewards before visual implementation. |
| 3 | All gameplay domains | Supply the stable mechanics and schemas exercised by scenarios. |
| 4 | Player Experience | Supplies onboarding, guidance, Handbook, mode, and accessibility presentation contracts. |

### Downstream Dependencies

Telemetry and Playtesting measures curriculum behavior. Persistence saves exact
progression, encountered examples, and content versions.

## Executive Summary

Curriculum Content is the authored game campaign that teaches AI engineering
through park operation. It sequences scenarios, Tasks, artifacts, clauses,
context routes, memory, tools, evals, incidents, rewards, transfer cases,
guidance, and Handbook entries according to problem-before-tool progression.
Content never bypasses owning domain rules. Each lesson is an operational
pressure, observable consequence, engineering action, and later transfer—not a
quiz or abstract completion badge.

## User Stories

### Opening Loop

- **GIVEN** a new park, **WHEN** the player begins, **THEN** one successful
  feeding builds trust before a visible maintenance-context difference creates
  a recoverable near miss.
  - **Acceptance Criteria:** The player diagnoses, revises, runs a provided free
    eval, reviews, intentionally deploys, and opens in approximately five minutes
    subject to baseline testing.
- **GIVEN** the concept has been applied once, **WHEN** a novel transfer case
  appears, **THEN** the same underlying missing-context concept is solvable
  without repeated click-by-click guidance.
  - **Acceptance Criteria:** Content tests transfer rather than memorization.

### Progressive Curriculum

- **GIVEN** repeated directions, context pressure, uncertain changes, stale
  state, concurrency, or coordination overload, **WHEN** experienced, **THEN**
  Skills/System Prompts, Context/Retention, Evals/Review, Memory, Workers, or
  Manager Orchestration become motivated and available in order.
  - **Acceptance Criteria:** A tool is not taught before demand exists.
- **GIVEN** a mastered system, **WHEN** it continues running, **THEN** content
  allows calm visible operation before optional expansion introduces a new kind
  of pressure.
  - **Acceptance Criteria:** Old mechanics do not fail arbitrarily to force review.

## Functional Requirements

### FR-01: Content Package and Arc Model

- FR-01.1: Curriculum packages SHALL declare stable ID/version, compatible
  domain schemas, exact dependencies, scenario arcs, unlock graph, asset bundle
  versions, localization-ready copy IDs, and fingerprint.
- FR-01.2: An arc SHALL declare experienced pressure, target transferable
  concept, available mechanics, prerequisite demonstrations, scenarios,
  transfer case, mastery/stability period, optional expansion, and playtest tags.
- FR-01.3: Content SHALL use canonical application terminology in engineering
  surfaces and approachable park terms in ordinary operations.
- FR-01.4: Content SHALL not contain executable arbitrary code.

### FR-02: Opening Content

- FR-02.1: Opening SHALL begin at dawn with closed park, visitor convoy,
  pausable deadline, hungry dinosaur, one Worker, gate, and partially configured
  feeding job.
- FR-02.2: The first feeding SHALL succeed deterministically.
- FR-02.3: The second feeding SHALL use an enclosure whose automatic closer is
  visibly disabled for maintenance but absent from Worker context.
- FR-02.4: Reuse SHALL cause a deterministic recoverable pre-opening containment
  near miss without onboarding fatality.
- FR-02.5: Content SHALL supply concise incident explanation, minimum Workbench
  choices, one relevant free eval, candidate/review/deploy path, successful rerun,
  and opening reward.

### FR-03: Ordered Learning Arcs

- FR-03.1: Content SHALL cover Prompts; Skills and System Prompts/Policies;
  Context and Tools; Retention; Memory/retrieval/compaction; Evals/Review/
  Deployment; multiple Workers; and Manager Orchestration.
- FR-03.2: Representative scenarios SHALL include degraded sensor, missing
  maintenance context, context bloat, stale policy, runtime overflow, compaction
  loss, retrieval failure, shared-gate conflict, eval coverage gap, vague
  management, and external escalation recovery.
- FR-03.3: Each concept SHALL follow experience, inspect, name, apply, and reuse.
- FR-03.4: Scenarios SHALL expose multiple valid engineering approaches and
  tradeoffs rather than one hidden answer.

### FR-04: Guidance, Copy, and Handbook

- FR-04.1: Guidance records SHALL define world cue, affordance emphasis, concise
  hint, explicit help, skip condition, and accessibility equivalent.
- FR-04.2: Essential engineering information SHALL not live only in flavor copy.
- FR-04.3: Announcements and Park Developer copy SHALL be concise, operational,
  and optional/persistent as appropriate.
- FR-04.4: Handbook entries SHALL define canonical terms, visual grammar, and
  encountered examples and remain separate from Agent context.
- FR-04.5: The game SHALL not announce lesson completion, grade definitions, or
  award recall points.

### FR-05: Transfer, Mastery, and Expansion

- FR-05.1: Every major concept SHALL have at least one novel transfer case with
  changed surface details and withheld original guidance.
- FR-05.2: Content SHALL define observable transfer success through game actions
  and outcomes, not self-report alone.
- FR-05.3: Mastery periods SHALL allow stable automation and visible benefits.
- FR-05.4: Permanent expansions SHALL be optional opportunities with explicit new
  responsibility and qualitatively new pressure.

### FR-06: Validation and Asset Readiness

- FR-06.1: Every scenario SHALL validate exact entities, artifacts, clauses,
  context routes, tools, eval cases, expected outcomes, progression prerequisites,
  asset IDs, and accessible equivalents before packaging.
- FR-06.2: Every planned visual slice SHALL declare and complete required asset
  briefs/approved runtime bundle dependencies before implementation begins.
- FR-06.3: Content validation SHALL detect unreachable unlocks, circular arcs,
  missing transfer cases, prohibited fatal onboarding, missing exact versions,
  and unsupported mechanics.
- FR-06.4: Golden scenario runs SHALL assert intended deterministic outcomes.

## Non-Functional Requirements

- **NFR-01: Transfer orientation** - Content practices skills applicable outside
  the game.
- **NFR-02: Technical authenticity** - Experienced Agent users find failures
  attributable and credible.
- **NFR-03: Extensibility** - New content packages add species/scenarios without
  changing unrelated domain rules.
- **NFR-04: Accessibility** - Every required cue/action has equivalent supported
  presentation and no timing penalty.
- **NFR-05: Localization readiness** - Player copy uses stable IDs and avoids
  layout assumptions even if localization is post-MVP.

## Invariants

- **INV-01:** Problem precedes tool.
- **INV-02:** Content uses domains; it never bypasses their rules.
- **INV-03:** Prose is never executable behavior.
- **INV-04:** Evals are real scenarios and history is exact-versioned.
- **INV-05:** Stable mastery is not sabotaged by hidden failure inflation.
- **INV-06:** Transfer cases test concepts, not memorized clicks.

## Out of Scope

- Runtime procedural curriculum from an LLM.
- Quizzes, lesson points, or certification.
- Content with no gameplay/curriculum/expressive purpose.
- Final full campaign quantity or balance before playtest evidence.

## Product Decisions

- **PD-01: Hidden curriculum** - Gameplay remains the visible purpose.
- **PD-02: Professionally authored exemplars** - Players study strong artifacts
  when failure creates motivation.
- **PD-03: Transfer over recall** - Novel application proves learning.
- **PD-04: Asset-first dependency** - Visual content contracts are produced early
  enough for OpenAI-assisted asset creation and approval.

## Implementation Decisions

- **IMP-01:** Store content as validated data packages with exact IDs/versions
  and domain-specific schema composition.
- **IMP-02:** Use deterministic content-build scripts to cross-validate packages,
  run golden scenarios, and check asset bundle readiness.
- **IMP-03:** Keep copy in stable keyed catalogs and executable clauses separate.
- **IMP-04:** Expose only `src/curriculum-content/public.ts`.

## Testing Decisions

- **TST-01:** Every scenario has a golden deterministic outcome and expected
  causal evidence.
- **TST-02:** Opening tests cover success, near miss, diagnosis, free eval,
  review/deploy, opening, timing instrumentation, and no fatality.
- **TST-03:** Each major concept has a transfer fixture with guidance disabled.
- **TST-04:** Package validation covers unlock reachability, exact dependencies,
  required assets, accessible cues, and Handbook separation.
- **TST-05:** Human playtesting validates comprehension, authenticity, mastery,
  and desire to continue.

## Proposed Modules

- **MOD-01: Curriculum Package Loader** - Validates exact cross-domain authored
  packages and fingerprints.
- **MOD-02: Arc and Unlock Graph** - Owns problem-before-tool progression and
  mastery/expansion opportunities.
- **MOD-03: Scenario Catalog** - Resolves production, eval, transfer, density,
  and recovery scenarios.
- **MOD-04: Guidance Catalog** - Supplies escalating action-skippable cues and
  accessibility equivalents.
- **MOD-05: Handbook Content** - Supplies canonical term/example entries outside
  Agent context.
- **MOD-06: Curriculum Validator** - Cross-checks domains, assets, outcomes,
  transfer, and reachability.

## Workflows

### Workflow 1: Opening Arc

```text
1. Load exact dawn scenario and approved MVP asset bundle.
2. Present one need and partially configured successful feeding.
3. Present changed gate maintenance state outside Worker context.
4. Produce recoverable near miss and concise causal diagnosis.
5. Unlock minimum Workbench fix and one free real eval.
6. Review, deploy, rerun, and open successfully.
7. Record encountered concept and later present a novel transfer case.
```

### Workflow 2: Add a New Learning Arc

```text
1. Define transferable concept and experienced pressure.
2. Identify owning domain mechanics and exact prerequisites.
3. Define scenario, artifact/eval content, guidance, transfer, and mastery period.
4. Complete rendering asset briefs and approved bundles before visual slices.
5. Validate exact dependencies, accessibility, and golden outcomes.
6. Package/version content and baseline playtest before numeric thresholds.
```
