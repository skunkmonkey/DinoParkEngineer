# Player Experience and Playability - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | `application-shell` and `platform-foundation` | Supply route composition, the persistent frame, presentation primitives, accessibility conventions, and global controls. |
| 2 | `simulation-core` and `park-operations` | Supply authoritative park state, commands, jobs, incidents, and entity selection. |
| 3 | `content-registry` and `curriculum-content` | Supply immutable content identities, player-facing names, authored objectives, phase rules, and unlock state. |
| 4 | `context-memory`, `trace-replay`, `eval-runner`, `engineering-workbench`, and `review-deployment` | Supply the AI-engineering evidence and workflows that must be presented progressively. |
| 5 | `economy-progression` and `multi-agent-orchestration` | Supply pressure, purchases, worker scaling, and Manager Agent progression. |

### Downstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Every browser-facing feature | Consumes the player-facing identity rules, disclosure levels, outcome-first hierarchy, and shared graphical language defined here. |
| 2 | `telemetry` and playtest tooling | Measure comprehension, time to first action, navigation load, intervention load, and learning-loop completion. |
| 3 | `persistence` | Retains campaign/unlock state while presentation-only selection and disclosure remain reconstructable. |

## Executive Summary

Dino Park Engineer currently exposes too much of its implementation and too many advanced systems at once. The result is technically inspectable but difficult to play: the park is primarily textual, raw identifiers compete with meaningful names, and the player encounters a dense operations console before the game has created a reason to use most of it.

This feature makes the park fantasy and current operational problem the default experience while preserving the real AI-engineering vocabulary and evidence required for learning transfer. The player sees a graphical, deterministic park; acts on a small number of relevant choices; observes consequences; and opens deeper Prompt, Skill, System Prompt, Context, Memory, Tool, Eval, Agent, Trace, and Review detail when the curriculum makes those concepts meaningful.

The feature does not make the simulation shallow or hide causality. It separates accidental interface complexity from intentional gameplay complexity. Raw ids, hashes, clauses, and manifests remain available for exact replay and advanced inspection, but they do not serve as ordinary customer-facing names.

## User Stories

### Park-First Play

- **GIVEN** a new game, **WHEN** the player enters the Park, **THEN** they can identify the current objective, relevant dinosaur, assigned robot, enclosure state, and primary available action without reading a table or opening a glossary.
  - **Acceptance Criteria:** The first meaningful action is reachable from the default Park view, and no debug/provider/build information competes with it.
- **GIVEN** an executing job, **WHEN** authoritative events advance, **THEN** the player sees corresponding robot, dinosaur, gate, visitor, and incident changes on the graphical Park surface.
  - **Acceptance Criteria:** Animation is presentation-only, derives from simulation state/events, and reduced-motion mode communicates the same changes.
- **GIVEN** a selected park entity, **WHEN** the player opens its inspector, **THEN** operationally relevant information appears before technical provenance.

### Transferable AI-Engineering Vocabulary

- **GIVEN** an authored AI artifact, **WHEN** shown anywhere in the game, **THEN** its canonical type and human-readable artifact name are both clear.
  - **Acceptance Criteria:** A Skill appears as `SKILL · Carnivore Feeding · v3`, not only as `skill.feed@3` and not as a fantasy-only substitute such as `Feeding Manual`.
- **GIVEN** a park-world entity, **WHEN** shown to the player, **THEN** it uses an approachable domain name while preserving its stable id in technical details.
  - **Acceptance Criteria:** `enclosure.gamma` is presented as a named habitat; searches and deep links can still resolve the exact id.
- **GIVEN** an advanced player or diagnostic need, **WHEN** technical details are expanded, **THEN** exact ids, versions, refs, clauses, hashes, provenance, and manifests remain inspectable and selectable.

### Progressive Disclosure and Curriculum

- **GIVEN** a capability the player has not yet needed or unlocked, **WHEN** navigating the product, **THEN** it does not compete as an equally prominent primary action.
- **GIVEN** a new pressure such as repetition, context overflow, an uncovered regression, stale memory, or worker overload, **WHEN** the player encounters it, **THEN** the corresponding Skill, Context, Eval, Memory, or Manager Agent surface becomes discoverable with an in-world reason.
- **GIVEN** an experienced late-game player, **WHEN** several agents and jobs operate concurrently, **THEN** intentional operational pressure remains visible and can motivate improved architecture rather than being simplified away.

### Consequence, Diagnosis, and Improvement

- **GIVEN** a surprising or unsafe outcome, **WHEN** the player inspects it, **THEN** the UI first explains intent, observed outcome, and the smallest relevant evidence set before exposing the complete trace.
- **GIVEN** a proposed artifact improvement, **WHEN** the player enters the engineering workflow, **THEN** they can recognize its canonical artifact type, compare versions and Context impact, select named Evals, inspect failures, revise, and intentionally deploy.
- **GIVEN** an Eval failure, **WHEN** replayed, **THEN** the player can watch the exact deterministic scenario on a park-like simulation surface and then inspect its evidence.

## Functional Requirements

### FR-01: Player-Facing Identity

- FR-01.1: Every player-visible world entity and authored content record SHALL support a stable human-readable display name separate from its immutable machine identity.
- FR-01.2: Authored AI artifacts SHALL display canonical type (`PROMPT`, `SKILL`, `SYSTEM PROMPT`, `CONTEXT`, `MEMORY`, `TOOL`, `EVAL`, `AGENT`, or `MANAGER AGENT` as applicable), human-readable title, and version before the raw ref.
- FR-01.3: World entities SHALL display approachable park-domain names; machine ids SHALL be available in an explicit Technical Details surface and resolvable by search/deep link.
- FR-01.4: Generated jobs, incidents, traces, reviews, and deployments SHALL receive deterministic player-facing labels derived from stable authored/entity names and logical metadata, never from an LLM.
- FR-01.5: Display aliases SHALL never participate in authoritative execution, identity, ordering, persistence keys, or replay equivalence.

### FR-02: Information Hierarchy

- FR-02.1: Every major screen SHALL order information as Outcome, Explanation, then Evidence.
- FR-02.2: Raw ids, hashes, JSON, complete manifests, clause graphs, provider state, telemetry queues, and build/runtime diagnostics SHALL be hidden from normal play unless required by the current task; they remain available through Technical Details or development diagnostics.
- FR-02.3: The default Park view SHALL prioritize current objective, live world state, selected entity, and urgent incidents over filters, configuration, history, and global preferences.
- FR-02.4: The UI SHALL avoid presenting more than three equally prominent new choices during onboarding; secondary actions may remain available through contextual menus or detail surfaces.
- FR-02.5: Tables SHALL be used for genuine comparison or accessibility equivalents, not as the default representation of spatial activity or narrative outcomes.

### FR-03: Graphical Park Surface

- FR-03.1: The Park SHALL provide a legible two-dimensional illustrated or schematic-diorama view of habitats, paths, gates, devices, dinosaurs, workers, visitors, jobs, and incidents.
- FR-03.2: Entity position, containment, gate state, worker activity, visitor risk, job target, and incident severity SHALL be visually distinguishable without relying on color alone.
- FR-03.3: World animation SHALL derive only from authoritative snapshots/events and SHALL not change timing, ordering, commands, or outcome.
- FR-03.4: Selection SHALL visually relate an entity to its habitat, gate, active job, assigned Agent, alerts, and relevant actions.
- FR-03.5: A complete keyboard/screen-reader-accessible nonvisual equivalent SHALL expose the same critical state and commands.

### FR-04: Navigation and Disclosure

- FR-04.1: Normal play SHALL present three player-level areas: Park, Operations, and AI Workshop. Direct routes for Agents, Engineering, Evals, Reviews, and Progress SHALL remain stable and accessible.
- FR-04.2: Park SHALL own live world play; Operations SHALL group jobs, Agents, incidents, schedules, and Manager coordination; AI Workshop SHALL group Prompts, Skills, System Prompts, Context, Memory, Tools, Evals, Reviews, and deployment.
- FR-04.3: Locked or not-yet-needed capabilities SHALL be absent or visually subordinate, with their route remaining honest when directly opened.
- FR-04.4: Unlocks SHALL be driven by curriculum/progression state, not browser-local presentation preferences.
- FR-04.5: Player location, back/forward navigation, bookmarks, and deep links SHALL remain deterministic and refresh safe.

### FR-05: Guided First Play

- FR-05.1: A new campaign SHALL begin with a focused low-risk herbivore objective that teaches basic assignment and observation before the first consequential specification gap.
- FR-05.2: The first consequential failure SHALL arise from an authentic missing context/instruction boundary, SHALL be visibly represented in the park, and SHALL be recoverable without threatening the save.
- FR-05.3: Post-consequence diagnosis SHALL compare player intent, Agent-available context/instructions, actions, and resulting world state without fabricating hidden reasoning.
- FR-05.4: The onboarding arc SHALL lead through Prompt improvement and introduce the first Skill/Eval only after repetition or regression need is experienced.
- FR-05.5: Returning players SHALL be able to resume current objective and park state without replaying completed guidance.

### FR-06: Learning Surfaces

- FR-06.1: Context SHALL be introduced first as a visible load/budget and named composition; exact CU items and profiler findings SHALL appear as the curriculum unlocks them.
- FR-06.2: Trace SHALL default to a concise outcome story and relevant evidence, with the complete filterable event stream available as advanced evidence.
- FR-06.3: Evals SHALL appear as named scenario cards with expected behavior, risk, build/run costs, build state, and last result; no aggregate score may replace case detail.
- FR-06.4: Review SHALL remain the convergence screen for source change, Context delta, dependencies, named Eval selection/results, revision, and deployment.
- FR-06.5: Manager Agent UI SHALL first communicate mission, worker assignments, pressure, escalations, and exceptions; exact routing rules and traces SHALL be inspectable evidence.

### FR-07: Development Diagnostics

- FR-07.1: Development-only diagnostics MAY expose shell/provider status, raw route registration, fixtures, telemetry inspection, and build metadata.
- FR-07.2: Development diagnostics SHALL be explicitly separated from the normal player frame and SHALL not be enabled by save-game progression.
- FR-07.3: Removing diagnostics from normal play SHALL not reduce recoverability; player-facing errors still require clear retry, return, and explanation actions.

## Non-Functional Requirements

- **NFR-01: Learnability** - A first-time target player should reach a meaningful park action within 45 seconds in moderated usability testing without external instruction.
- **NFR-02: Accessibility** - Meet WCAG 2.2 AA; critical state and commands remain operable without color, animation, pointer precision, or a graphical map.
- **NFR-03: Performance** - The active Park view should maintain responsive interaction at the MVP entity/event scale; decorative animation must degrade before input or state comprehension does.
- **NFR-04: Determinism** - Presentation changes cannot alter authoritative simulation, execution, Context, Eval, orchestration, persistence, or replay results.
- **NFR-05: Localization Readiness** - Display names and explanatory copy use stable content/message ids and are not embedded into execution keys.
- **NFR-06: Reduced Motion** - Reduced-motion mode replaces movement with clear state transitions and focus/highlight changes while preserving information.

## Invariants

- **INV-01:** The park fantasy leads presentation, but canonical AI-engineering terminology is never replaced by fantasy-only synonyms.
- **INV-02:** Machine ids and exact refs remain stable and available; player-facing aliases never drive behavior.
- **INV-03:** The application never hides Context overflow, failed Evals, stale/conflicting evidence, deployment risk, or serious incidents merely to reduce visual complexity.
- **INV-04:** Players encounter the pressure for an abstraction before that abstraction dominates the interface.
- **INV-05:** Robots and Agents are not made artificially incompetent to manufacture a lesson; failures arise from authored instructions, available Context, Tools, world state, Memory, or coordination.
- **INV-06:** The deterministic world remains authoritative; visuals and animations are projections.
- **INV-07:** Intentional late-game coordination pressure remains gameplay rather than being automatically collapsed away.
- **INV-08:** The Park Developer remains one progression/workbench mechanism, not a hiring or team-management simulation.

## Out of Scope

- Photorealistic graphics, 3D park construction, free camera control, or twitch gameplay.
- Replacing the deterministic simulation with a runtime LLM.
- Freeform natural-language parsing for core behavior.
- Removing advanced evidence, exact refs, versioning, Eval selection, or review/deployment discipline.
- Redesigning authoritative simulation balance, economy formulas, persistence format, or orchestration algorithms unless a planned vertical slice identifies a required compatibility change.
- Developer hiring, personalities, salaries, teams, or roster management.

## Product Decisions

- **PD-01: Park fantasy first** - The default surface is a playable dinosaur park, not a registry or infrastructure console.
- **PD-02: Canonical type plus approachable instance** - Show `SKILL · Carnivore Feeding · v3`; do not show only `skill.feed@3`, and do not rename Skill to a fantasy-only term.
- **PD-03: Outcome, explanation, evidence** - This hierarchy applies across Park, Agents, Context, Trace, Evals, Review, and orchestration.
- **PD-04: Three player-level areas** - Park, Operations, and AI Workshop reduce top-level navigation load while stable specialist routes remain available.
- **PD-05: Earn complexity** - Early UI is focused; late-game multi-agent pressure remains visible and meaningful.
- **PD-06: Two-dimensional graphical direction** - Use a readable illustrated/schematic diorama before considering expensive 3D presentation.
- **PD-07: Debug separation** - Implementation diagnostics belong in an explicit development surface, not the normal game frame.
- **PD-08: First polished loop before breadth** - One complete observe-act-consequence-diagnose-improve-redeploy loop is the acceptance path for the overhaul.

## Implementation Decisions

- **IMP-01: Presentation projection boundary** - Player-facing names, generated labels, disclosure state, and visual relationships are projected from public domain/content data; components do not rewrite domain identity.
- **IMP-02: Content-authored names** - Stable names for authored artifacts and world entities live in validated content records; deterministic fallback formatting is reserved for generated operational records.
- **IMP-03: Shared disclosure vocabulary** - Browser surfaces use consistent summary, detail, and technical-evidence levels.
- **IMP-04: Event-derived visuals** - Map animation consumes authoritative snapshots/events through the Park read model and never runs a parallel simulation.
- **IMP-05: Feature flags only for rollout** - Temporary development flags may stage the overhaul, but completed behavior is controlled by campaign unlock state and supported preferences.

## Testing Decisions

- **TST-01: Identity contracts** - Tests prove display-name uniqueness within a selection scope, deterministic fallback labels, raw-id lookup, and no change to exact refs/manifests.
- **TST-02: First-play browser acceptance** - A fresh campaign browser test covers objective, assignment, visible consequence, diagnosis, improvement, Eval, review/deploy, and safe replay.
- **TST-03: Computer-use verification** - Every behavioral slice requires manual computer-use verification at desktop and tablet layouts before completion.
- **TST-04: Accessibility equivalence** - Automated and manual tests compare graphical and nonvisual critical state/actions.
- **TST-05: Deterministic parity** - Golden simulations/traces/Evals before and after presentation changes produce identical canonical outcomes.
- **TST-06: Usability playtest** - Record time to first action, incorrect navigation attempts, visible-choice count, outcome comprehension, and canonical-term recognition.

## Proposed Modules

- **MOD-01: PlayerFacingIdentity** - Produces canonical type labels, display names, generated operational labels, raw-id metadata, and search aliases.
- **MOD-02: DisclosurePolicy** - Projects campaign phase/unlocks into visible navigation and summary/detail/evidence defaults.
- **MOD-03: ParkSceneProjection** - Converts the Park read model into spatial nodes, relationships, state cues, and event-derived presentation transitions.
- **MOD-04: CurrentObjective** - Presents curriculum-owned objective, relevant entities/actions, completion, and recovery without owning progression rules.
- **MOD-05: OutcomeStory** - Produces concise observable intent/outcome/evidence summaries for jobs, incidents, traces, and Evals.
- **MOD-06: DevelopmentDiagnostics** - Hosts implementation/runtime inspection outside the player frame.

## Workflows

### Workflow 1: First Meaningful Park Loop

```text
1. New campaign opens on a named habitat with one visible objective.
2. Player selects the relevant dinosaur or objective card and assigns the available Agent using a named Prompt.
3. Authoritative events animate on the Park surface.
4. The outcome appears as a concise world-state story.
5. A recoverable specification/context gap creates a visible consequence.
6. Player opens the smallest relevant evidence set, then the full Trace if desired.
7. Player improves the Prompt or commissions the newly motivated Skill.
8. Player selects named Evals, reviews results, deploys intentionally, and reruns safely.
```

### Workflow 2: Artifact Recognition and Exact Inspection

```text
1. Player opens AI Workshop > Skills.
2. Library shows SKILL, Carnivore Feeding, v3, deployment state, Context cost, and coverage summary.
3. Player opens the artifact and reads source/dependencies/Evals using human-readable names.
4. Player expands Technical Details to copy skill.feed@3 and inspect clauses/used-by refs.
5. Exact ref continues to resolve historical jobs, traces, Evals, and replay manifests unchanged.
```

### Workflow 3: Late-Game Coordination Pressure

```text
1. Several named workers and jobs operate concurrently on the graphical Park.
2. Operations shows queue pressure, conflicts, incidents, and manual intervention demand.
3. The player feels the need for Manager Agent orchestration before its configuration dominates navigation.
4. After unlock/deployment, routine work collapses into status summaries while exceptions remain visible.
5. Player inspects routing, authority, Context, and reporting evidence only when diagnosing or improving the Manager Agent.
```
