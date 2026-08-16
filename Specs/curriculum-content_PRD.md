# MVP Curriculum, Scenarios, and Authored Content - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

All gameplay engines and content schemas must expose stable contracts: simulation, registry, instruction, context/memory, eval, workbench, review/deployment, operations, economy/progression, orchestration, trace/replay, and persistence.

### Downstream Dependencies

This is the integrated MVP content pack consumed by the entire product; `telemetry` uses its stable scenario/lesson ids.

## Executive Summary

Curriculum Content supplies the authored named park, artifacts, clauses, tools, scenarios, evals, commission/revision recipes, balance data, progression rules, objectives, disclosure milestones, and contextual teaching copy that turn the engines into a complete game. It follows the learning arc Prompt → Skill → System Prompt → Context → Evals → Review → Memory → multiple Agents → Orchestration. Each solution and corresponding interface surface becomes prominent only after felt need, every failure is deterministic/replayable, and the first vertical slice matches the end-to-end contract in application PRD section 26.2 and `player-experience_PRD.md`.

## User Stories

- **GIVEN** a new game, **WHEN** the player completes early work, **THEN** they experience goal/specification mismatch before receiving the safer abstraction.
- **GIVEN** repeated tasks, duplicated policy, context pressure, an uncovered incident, stale memory, and worker overload, **WHEN** encountered in sequence, **THEN** each creates an understandable need for the next engineering capability.
- **GIVEN** any authored failure, **WHEN** inspected/replayed, **THEN** the exact missing/stale/conflicting/unavailable clause/context/tool/coordination cause is visible.
- **GIVEN** phase 10 completion, **WHEN** comparing park operation, **THEN** more simultaneous work completes with fewer manual interventions and reliable safety/eval coverage.

## Functional Requirements

### FR-01: MVP World and Operational Content
- FR-01.1: One park zone SHALL contain at least three distinct enclosures and docile herbivore, large herbivore, and carnivore archetypes.
- FR-01.2: Provide valid gates, zones, routes, feeders, sensors, visitor buffers, tools/devices, worker starts, jobs, schedules, incidents, and recovery requirements.
- FR-01.3: Provide one initial generalist worker and unlock/purchase path to at least three concurrent workers and Manager eligibility at four/threshold.
- FR-01.4: Every authored world entity SHALL include a stable player-facing name and optional short description/search aliases separate from its machine id.

### FR-02: Engineering Assets
- FR-02.1: Provide authored novice and improved Prompts plus at least eight total Skills/System Prompts with source text, semantic clauses, exact dependencies, tools, applicability, costs, and versions.
- FR-02.2: Include Carnivore Feeding evolution from unsafe direct Prompt through reusable Skill to centralized Containment Safety System Prompt with lower context cost and maintained safety.
- FR-02.3: Include memory/knowledge/tool descriptions and Manager configurations needed by phases.
- FR-02.4: Every source claim SHALL correspond to its clauses; source is instructional, clauses are executable.
- FR-02.5: Every player-visible artifact/eval/scenario SHALL have a human-readable title that appears with its canonical AI-engineering type and version.

### FR-03: Evals and Reviews
- FR-03.1: Provide at least 12 deterministic eval cases with fixtures, seeds, typed assertions, tags, severity, build/run costs, and expected behavior.
- FR-03.2: Include all ten feeding examples from application PRD section 12.4 plus at least food-dispenser offline and containment/escape response coverage.
- FR-03.3: Provide named starter suites/recipes while preserving player selection.
- FR-03.4: Provide review/revision paths that intentionally include a discoverable failing Gate Fails to Close version before the safe revision.

### FR-04: Phase Curriculum
- FR-04.1: Implement phases 0-10, pressure, lesson, and unlock sequence from application PRD section 16.
- FR-04.2: Each phase SHALL define entry conditions, starting state/fixture delta, player-facing objective, available assets/offers/evals, deterministic teaching incident, success criteria, unlock outputs, and fallback/recovery.
- FR-04.3: Teaching copy SHALL explain after consequence through trace/workflow context; it SHALL not spoil every failure beforehand.
- FR-04.4: No phase SHALL require freeform source authoring, twitch input, runtime LLM, or buying every eval.
- FR-04.5: Each phase SHALL define navigation/surface disclosure: what is primary, available contextually, directly reachable but locked, and newly introduced after consequence.
- FR-04.6: Phase 0 SHALL begin with a focused low-risk herbivore assignment and graphical observation before the first consequential specification/context gap; no more than three new choices receive equal prominence.

### FR-05: Economy and Balance Content
- FR-05.1: Supply validated integer costs/rewards/severity impacts/context fixed costs/durations/thresholds.
- FR-05.2: Preserve application PRD example eval costs unless playtest tuning explicitly versions replacements.
- FR-05.3: Include recovery assistance preventing dead-end saves and enough scarcity for meaningful risk-based eval investment.

### FR-06: Integrated First Vertical Slice
- FR-06.1: Player completes a focused herbivore orientation, then accepts the first carnivore job, runs an unsafe Prompt, observes a deterministic graphical containment consequence, diagnoses the absent postcondition through an outcome-first Trace, commissions/reviews a clearly labeled safer Skill, builds/selects three named Evals, sees one fail, revises, passes/deploys, reruns safely, and observes Context cost difference.
- FR-06.2: All exact ids/versions/fixtures/expected events for this slice SHALL be documented in content fixtures and integration tests.

## Non-Functional Requirements

- **NFR-01: Data-Driven** - Adding/rebalancing content requires no core engine/UI changes.
- **NFR-02: Validation** - Every content pack passes registry, fixture, clause, eval, progression, economy, and cross-reference validation.
- **NFR-03: Determinism** - Golden scenarios replay exactly.
- **NFR-04: Accessibility/Tone** - Concise professional-developer copy, canonical terms, non-graphic incidents, no color-only clues.
- **NFR-05: Localization Readiness** - Stable message/content ids separate player text from rule ids.

## Invariants

- **INV-01:** No core behavior depends on parsing source text.
- **INV-02:** A solution is not required before the player can encounter the pressure it solves.
- **INV-03:** Every required failure is recoverable and diagnosable.
- **INV-04:** Advanced modular context is not simply longer than novice context.
- **INV-05:** The Park Developer remains one workbench/capability mechanism.
- **INV-06:** Canonical AI-engineering types remain visible; approachable titles do not become fantasy-only replacements.
- **INV-07:** Curriculum disclosure does not hide active serious incidents, blocking Context overflow, failed selected Evals, or deployment safety gates.

## Out of Scope

Post-MVP scenarios, freeform Prompt Lab, community content, real-model sandbox, multiplayer, developer roster, mobile campaign, procedural construction, and final production tuning beyond initial playtest-ready values.

## Product Decisions

- **PD-01:** Curriculum order is normative unless versioned playtest evidence changes it.
- **PD-02:** The first carnivore slice is the mandatory integrated acceptance path.
- **PD-03:** Late-game success means safer scale and fewer interventions, not credits alone.

## Implementation Decisions

- **IMP-01:** One or more versioned content packs own all stable content ids.
- **IMP-02:** Phase scripts listen to public events/queries and issue public commands; they never reach into feature internals.
- **IMP-03:** Golden content tests pin manifests/hashes intentionally; version changes update expectations with review.

## Testing Decisions

- **TST-01:** Validate all packs and cross-refs in CI.
- **TST-02:** Golden headless tests cover each phase’s teaching failure and success path.
- **TST-03:** Full browser test covers the first vertical slice and late-game intervention comparison.

## Proposed Modules

- **MOD-01: MVPParkPack** - World/entity/tool/balance definitions.
- **MOD-02: EngineeringCurriculumPack** - Assets, clauses, commissions, reviews, capabilities, and phase rules.
- **MOD-03: MVPEvalPack** - Twelve-plus cases/suites/assertions/fixtures.
- **MOD-04: ScenarioDirector** - Minimal public-port coordinator for objectives, entry/success/recovery, and unlock signals.
- **MOD-05: ContentAcceptanceHarness** - Validates/golden-runs packs and integrated learning paths.
- **MOD-06: PlayerExperiencePack** - Names, descriptions, objective copy, search aliases, surface disclosure milestones, and visual scene metadata.

## Workflows

### Workflow 1: First Vertical Slice
```text
Unsafe Prompt -> real containment consequence -> trace diagnosis -> safer Skill proposal -> three eval investments -> gate-failure eval exposes gap -> revision -> passing suite -> deploy -> safe replay -> compare context.
```

### Workflow 2: Full Curriculum
```text
Explicit Prompt -> repeated Skills -> centralized System Prompt -> context pressure/profiler -> uncovered incident/evals -> review discipline -> stale memory -> worker parallelism -> Manager orchestration -> scaled autonomous park.
```
