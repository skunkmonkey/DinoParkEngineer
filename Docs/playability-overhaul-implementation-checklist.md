# Playability Overhaul Implementation Checklist

This is the master handoff and status file for the Dino Park Engineer playability overhaul. A fresh implementation context should begin here and follow the referenced PRD/PLAN files rather than reconstructing intent from code.

## Status Legend

- `[ ]` - not started
- `[-]` - in progress
- `[x]` - completed and verified
- `[!]` - blocked; add the blocking condition and evidence directly beneath the item

Only mark a task `[x]` after its focused tests, specification/documentation impact, and required visual/computer-use verification have passed. Keep exactly one implementation task `[-]` at a time unless the user explicitly requests parallel agent work.

## Fresh-Context Start Protocol

- [x] PLAN-001 Read `Docs/brainstorming_session.md` and preserve its original intent: operate the park; teach through consequences; use authentic context boundaries; make abstraction an earned superpower; keep the deterministic world trustworthy.
- [x] PLAN-002 Add and align `Specs/player-experience_PRD.md` as the cross-feature source of truth for the overhaul.
- [x] PLAN-003 Update affected existing PRDs for naming, graphical Park, navigation/disclosure, outcome-first evidence, and curriculum behavior.
- [x] PLAN-004 Create the four vertical-slice PLAN files referenced below.
- [ ] START-001 At the beginning of a fresh implementation context, read `AGENTS.md`, this checklist, `Specs/player-experience_PRD.md`, `Specs/application_PRD.md` sections 2, 5, 6, 16, 17, 22, and 25, and the PLAN containing the next unchecked task.
- [ ] START-002 Inspect `git status --short` and preserve all unrelated/user changes. `AGENTS.md` was already modified before planning and must not be overwritten casually.
- [ ] START-003 Confirm the next task's owning feature PRD and update that PRD first if implementation discoveries change behavior, workflow, acceptance, or a locked decision.
- [ ] START-004 Change the selected task to `[-]` before implementation. Change it to `[x]` only after focused verification; use `[!]` only with a concrete repeated blocker.
- [ ] START-005 Use stable machine ids and exact refs for behavior. Never parse or depend on display names, aliases, animation, or visible copy.
- [ ] START-006 For every behavioral slice, run the narrowest relevant checks while iterating, then the plan's exit checks. Use the computer-use skill for desktop/tablet behavioral verification before completion.

## Governing Product Rules

These are acceptance rules, not tasks to delete after implementation:

- Park fantasy leads; AI-engineering evidence remains complete and accessible.
- Preserve canonical terms: Prompt, Skill, System Prompt, Context, Memory, Tool, Eval, Agent, Manager Agent, Trace, Review, Deploy, orchestration.
- Use canonical type + approachable instance: `SKILL · Carnivore Feeding · v3`.
- World names are approachable: `Rex Ridge Service Gate`; raw ids remain in Technical Details and search/deep links.
- Present Outcome -> Explanation -> Evidence.
- Do not hide serious incidents, Context overflow, failed selected Evals, stale/conflicting evidence, deployment risk, or hard gates.
- Do not make Agents artificially stupid. Teaching failures must arise from authored instructions, available Context, Tools, Memory, world state, or coordination.
- Graphical animation is a projection of authoritative events and cannot influence outcomes.
- Early accidental complexity is removed; late intentional multi-Agent pressure remains gameplay.
- The Park Developer remains one capability/workbench mechanism, not a developer hiring simulator.

## Program 1: Player-Facing Identity and Product Frame

Plan: `Specs/player-facing-identity-and-frame_PLAN.md`

### Slice 1 — Starter identity contract

- [ ] PXF-001 Inspect `ArtifactVersion`, Eval, world-fixture/entity, Agent, job, incident, trace, review, and Manager presentation models; document exact schema/migration touchpoints in the active implementation notes.
- [ ] PXF-002 Add required artifact `title` and world-profile/entity `displayName` plus optional `shortDescription` and scoped `aliases` at the content boundary; preserve immutable ids and version refs.
- [ ] PXF-003 Add validation diagnostics for missing/blank titles/names, malformed aliases, and alias collisions within declared search/selection scope.
- [ ] PXF-004 Backfill the starter habitat, service gate, dinosaur, worker Agent, feeding Prompt, Carnivore Feeding Skill, and Containment Safety System Prompt with approved names.
- [ ] PXF-005 Expose canonical artifact type, title, version, exact ref, display name, raw id, and aliases through public registry/profile projections without importing registry internals into UI.
- [ ] PXF-006 Add raw-id and friendly-alias lookup tests; exact lookup must remain authoritative when an alias resembles an id.
- [ ] PXF-007 Add canonical manifest/replay parity tests proving display-only changes cannot alter ordering, hashes used for authoritative equivalence, dependencies, clauses, or execution.
- [ ] PXF-008 Render the starter Skill/entity with friendly identity first and an accessible Technical Details disclosure containing exact refs; verify by keyboard and computer use.

### Slice 2 — Shared identity projection and full content backfill

- [ ] PXF-009 Create a small `PlayerFacingIdentity` public module/API; define supported inputs/outputs and deterministic fallback policy.
- [ ] PXF-010 Implement artifact labels as canonical type + title + version; do not bake type words into every authored title.
- [ ] PXF-011 Implement world entity labels from content-authored names with deterministic raw-id fallback for corrupted/legacy data and explicit diagnostic status.
- [ ] PXF-012 Implement deterministic generated labels for jobs, incidents, traces, reviews, deployments, and runtime-created records using named subjects plus logical metadata.
- [ ] PXF-013 Add search alias indexing that resolves to exact records and returns stable results; deep links continue carrying exact ids/refs.
- [ ] PXF-014 Backfill all MVP artifacts, Evals, suites, scenarios, habitats, gates, devices, dinosaurs, visitor groups, Agents, and Manager configurations.
- [ ] PXF-015 Add content acceptance validation ensuring every player-visible MVP record has required presentation metadata and no unintended scoped collisions.
- [ ] PXF-016 Migrate one projection in every browser-facing feature to the shared identity API; add contract tests preventing local raw-id-as-label regressions.

### Slice 3 — Three player-level areas

- [ ] PXF-017 Update destination presentation types to represent Park, Operations, AI Workshop, specialist route ownership, and disclosure state without changing route identity.
- [ ] PXF-018 Update ProductFrame desktop navigation to three player-level areas with canonical specialist links inside Operations and AI Workshop.
- [ ] PXF-019 Update tablet/mobile navigation and focus behavior to match the same hierarchy.
- [ ] PXF-020 Add a public disclosure projection consuming curriculum/progression unlock state; presentation must not calculate or grant unlocks.
- [ ] PXF-021 Define pre-unlock behavior for direct specialist URLs: honest locked explanation, current prerequisite/pressure when known, and return-to-Park action.
- [ ] PXF-022 Preserve existing `/agents`, `/engineering`, `/evals`, `/reviews`, `/progress`, traces, entity deep links, and browser history behavior.
- [ ] PXF-023 Update shell/platform contract tests for fresh, partially unlocked, and mature campaign navigation matrices.
- [ ] PXF-024 Computer-use verify desktop and tablet navigation, direct URLs, refresh, back/forward, focus movement, and no inaccessible hidden action.

### Slice 4 — Development diagnostics separation

- [ ] PXF-025 Inventory normal-frame implementation copy/controls: frame/provider readiness, deterministic/local build labels, destination numbering, fixture status, telemetry queue inspection, platform footer, and placeholder integration language.
- [ ] PXF-026 Remove or replace those elements in normal play with park-relevant HUD/status/recovery information only.
- [ ] PXF-027 Keep reduced motion and appropriate player privacy/telemetry consent reachable without exposing telemetry event queues by default.
- [ ] PXF-028 Add an explicit development diagnostics route/drawer enabled by development configuration, using public diagnostic ports.
- [ ] PXF-029 Move provider/route/build/fixture/telemetry-queue inspection to diagnostics; do not import feature internals into Platform Foundation.
- [ ] PXF-030 Add production-render tests that reject known implementation diagnostic copy and development-render tests that prove diagnostics remain usable.
- [ ] PXF-031 Verify feature load failure still offers concise Retry and Return to Park actions in normal play.

### Slice 5 — Shared disclosure primitives

- [ ] PXF-032 Define semantic summary/detail/Technical Details primitives and guidance in the shared UI/public presentation API.
- [ ] PXF-033 Add reusable artifact identity header showing canonical type, title, version, state, and optional exact-ref copy action in Technical Details.
- [ ] PXF-034 Add named entity link/identity component with raw id available to assistive technology only when useful and visibly under Technical Details.
- [ ] PXF-035 Add consistent Outcome, Explanation, Evidence sections/drawers with correct heading hierarchy and focus restoration.
- [ ] PXF-036 Migrate a Park inspector exemplar to operational summary first, relationships second, exact id/source/deep link last.
- [ ] PXF-037 Migrate a Skill detail exemplar to identity/purpose/source/Context/coverage first and clauses/registry metadata last.
- [ ] PXF-038 Add accessibility, keyboard, selectable-source, collapsed/expanded, and no-color-only component tests; computer-use verify both exemplars.

### Slice 6 — Frame completion

- [ ] PXF-039 Migrate all shared navigation, headings, status, notification, entity links, and artifact headers to the new frame/identity/disclosure contracts.
- [ ] PXF-040 Remove superseded foundation placeholder content and styles only after confirming no registered/unavailable path relies on them.
- [ ] PXF-041 Update platform/content-registry/curriculum implementation Docs and architecture tests for the presentation boundary.
- [ ] PXF-042 Run focused typecheck, lint, architecture, shell, registry, curriculum, and rendered HTML tests.
- [ ] PXF-043 Run authoritative simulation/trace/Eval parity fixtures and compare canonical output with pre-overhaul baselines.
- [ ] PXF-044 Run `npm run validate` and computer-use desktop/tablet frame acceptance; resolve failures before starting dependent graphical work.

## Program 2: Graphical Park and Guided First Play

Plan: `Specs/graphical-park-and-onboarding_PLAN.md`

### Slice 1 — One authoritative graphical habitat

- [ ] GPO-001 Inspect current ParkReadModel and starter fixture; define the minimum public scene projection without duplicating domain rules.
- [ ] GPO-002 Add validated authored scene metadata for habitat bounds, zones, paths, gate/device anchors, entity anchors, and layer/order hints.
- [ ] GPO-003 Backfill one starter habitat scene and validate that every referenced scene id resolves to an authoritative entity/zone/device.
- [ ] GPO-004 Implement `ParkSceneProjection` from ParkReadModel + scene metadata with stable ordering and no command/simulation behavior.
- [ ] GPO-005 Render habitat terrain/boundary, paths, gate, feeder/device, dinosaur, worker, and visitors using local code/assets.
- [ ] GPO-006 Add visible textual/icon state cues for hunger, containment, gate state, worker status, and visitor safety without relying on color.
- [ ] GPO-007 Keep the existing accessible entity list sourced from the same projection and add scene-to-list selection equivalence.
- [ ] GPO-008 Add projection/render tests for every starter state and missing/invalid visual metadata fallback.
- [ ] GPO-009 Computer-use verify that a first-time viewer can identify habitat, dinosaur, worker, gate, and current need at desktop/tablet size.

### Slice 2 — Event-derived presentation

- [ ] GPO-010 Define the closed presentational transition vocabulary for move, bait, open/close/lock gate, feed, observe/verify, alert, evacuate, rescue, and terminal job state.
- [ ] GPO-011 Map authoritative snapshots/events to transitions without inferring commands or creating a second timeline.
- [ ] GPO-012 Render worker movement and current action state from authoritative location/event progression.
- [ ] GPO-013 Render gate/device/dinosaur/visitor changes and incident attention from authoritative state.
- [ ] GPO-014 Integrate pause/1x/2x/4x presentation pacing without changing logical ordering or issuing commands.
- [ ] GPO-015 Implement reduced-motion equivalents using highlights, state labels, and discrete transitions.
- [ ] GPO-016 Add deterministic parity and duplicate-command regression tests around animation/presentation updates.
- [ ] GPO-017 Computer-use verify a feeding sequence at normal, paused/resumed, 4x, and reduced-motion settings.

### Slice 3 — Objective, relationships, and contextual actions

- [ ] GPO-018 Add a public current-objective projection from ScenarioDirector/curriculum state; Park UI must not own phase completion.
- [ ] GPO-019 Render current objective, named subject, urgency/success criteria appropriate to the current phase, and concise recovery status.
- [ ] GPO-020 Relate selection among habitat, dinosaur, gate, worker, active job, and incident; keep URL/deep-link selection synchronized.
- [ ] GPO-021 Add one contextual primary action path from objective/entity to authored job creation/assignment.
- [ ] GPO-022 Move full queues, filters, detailed metrics, and advanced job preflight into contextual panels/drawers without deleting commands.
- [ ] GPO-023 Ensure no more than three new choices receive equal visual prominence in the fresh-campaign fixture.
- [ ] GPO-024 Add keyboard navigation/focus order and nonvisual commands equivalent to scene selection/actions.
- [ ] GPO-025 Test selection/history/command parity and computer-use verify the focused default Park layout.

### Slice 4 — Herbivore orientation

- [ ] GPO-026 Author Phase 0 named herbivore habitat/dinosaur/worker, starting fixture delta, objective, Prompt option, success criteria, reward, and recovery.
- [ ] GPO-027 Add disclosure state so only currently useful Park/Operations/AI Workshop entry points and actions are prominent.
- [ ] GPO-028 Connect objective assignment to exact authored Prompt/Agent configuration and deterministic feeding execution.
- [ ] GPO-029 Add concise post-success feedback showing the observable park result without teaching the later failure in advance.
- [ ] GPO-030 Persist phase completion/current objective and resume without repeating completed guidance.
- [ ] GPO-031 Add golden headless Phase 0 and fresh/resume browser tests.
- [ ] GPO-032 Computer-use run a fresh profile; record time to first action, visible choices, navigation mistakes, and comprehension notes.

### Slice 5 — First authentic consequence

- [ ] GPO-033 Reconcile the first containment lesson with the brainstorming constraint that a competent Agent is not made artificially stupid; record the exact missing instruction/Context boundary in curriculum content.
- [ ] GPO-034 Author the exact named job, Prompt, fixture delta, clauses, available Context/Tools, expected actions, failure event, incident, cost, and recovery.
- [ ] GPO-035 Run the golden headless failure and prove same seed/config yields identical events/world state.
- [ ] GPO-036 Represent the gate/containment consequence and affected entities on the graphical Park with severity/state text.
- [ ] GPO-037 Add outcome-first incident summary: intended job, Agent-available instruction/Context, consequential actions, resulting world state.
- [ ] GPO-038 Link every summary evidence item to the exact trace/context/artifact/entity record; do not fabricate causality.
- [ ] GPO-039 Keep the production cost memorable but recoverable and prove no dead-end save or required foreknowledge.
- [ ] GPO-040 Add recovery actions using existing domain commands and authoritative incident requirements.
- [ ] GPO-041 Browser/computer-use verify consequence visibility, diagnosis comprehension, exact deep links, recovery, and keyboard equivalence.

### Slice 6 — Improvement, Evals, Review, and safe rerun

- [ ] GPO-042 Author/connect the structured improved Prompt or Carnivore Feeding Skill commission with canonical identity and exact source/clauses/dependencies.
- [ ] GPO-043 Show before/after Context load/composition without teaching that longer always means better.
- [ ] GPO-044 Unlock the motivated Skill/Eval/Review surfaces at the correct consequence boundary.
- [ ] GPO-045 Build/select three named Evals with explicit expected behavior, risk, one-time build cost, and repeat run cost.
- [ ] GPO-046 Ensure one selected Eval fails deterministically for the proposed version and links to the relevant outcome/trace.
- [ ] GPO-047 Request/apply the authored revision, invalidate stale result applicability, and rerun the same exact cases.
- [ ] GPO-048 Review and deploy the passing exact version through the real deployment boundary; preserve running/historical refs.
- [ ] GPO-049 Rerun the production job safely and visually compare outcome, Context, and manual intervention.
- [ ] GPO-050 Persist the full learning-loop progress and verify refresh/resume/back navigation across every deep link.
- [ ] GPO-051 Add integrated headless/browser/computer-use acceptance and update curriculum/operations Docs.

### Slice 7 — Full MVP zone and responsive accessibility

- [ ] GPO-052 Author and validate scene metadata/names for all three MVP habitats, dinosaurs, gates, devices, paths, visitor buffers, and worker starts.
- [ ] GPO-053 Render visually distinct but stylistically coherent habitat terrain/silhouettes and state cues.
- [ ] GPO-054 Add responsive scene framing and contextual drawers for desktop and tablet without hiding critical incidents/objective.
- [ ] GPO-055 Add keyboard spatial navigation or an equivalent predictable entity traversal order with visible focus.
- [ ] GPO-056 Add screen-reader Park summary, entity relationships, state changes, and live-region restraint.
- [ ] GPO-057 Complete high-contrast, zoom, reduced-motion, and no-color-only state treatment.
- [ ] GPO-058 Add authored maximum entity/event performance fixture and optimize update granularity before removing evidence.
- [ ] GPO-059 Run desktop/tablet screenshots plus keyboard/screen-reader/computer-use acceptance for every habitat and incident class.
- [ ] GPO-060 Run `npm run validate`; reconcile Park Operations, curriculum, Player Experience, and implementation Docs.

## Program 3: Outcome-First Learning Surfaces

Plan: `Specs/outcome-first-learning-surfaces_PLAN.md`

### Slice 1 — Trace OutcomeStory

- [ ] OLS-001 Define the deterministic `OutcomeStory` schema for intent/task, named subjects, available Context/instructions, consequential actions, observed result, and evidence refs.
- [ ] OLS-002 Implement projection from existing trace records/events without inferred hidden reasoning or unsupported causal language.
- [ ] OLS-003 Add deterministic relevance rules for the first failed feeding trace; each included item must cite an observable event/clause/context/world state.
- [ ] OLS-004 Render outcome, explanation, and relevant evidence before the complete timeline.
- [ ] OLS-005 Preserve full filters, raw structured detail, copying, hashes, manifests, and 10k-event virtualization under Evidence.
- [ ] OLS-006 Lead labels/search with friendly identity while supporting exact trace/entity/artifact/clause filters.
- [ ] OLS-007 Add golden summary/parity/accessibility tests proving the summary is a lossless projection over full evidence.
- [ ] OLS-008 Computer-use verify the first failure can be explained from summary and exact evidence remains reachable.

### Slice 2 — Progressive Context

- [ ] OLS-009 Define Context disclosure states: load/budget, named composition, exact items/provenance, profiler findings.
- [ ] OLS-010 Render load/budget and canonical named categories from the exact Context snapshot; no UI recalculation.
- [ ] OLS-011 Render item titles/types/costs with raw refs and exact versions under detail.
- [ ] OLS-012 Consume curriculum profiler unlock and make findings prominent only after felt Context pressure.
- [ ] OLS-013 Keep overflow, stale/conflict, applicability mismatch, and blocking remediation visible regardless of disclosure level.
- [ ] OLS-014 Add visual composition treatment that reconciles exactly to total CU and remains meaningful without color.
- [ ] OLS-015 Test totals, ordering, pre/post unlock, overflow, stale Memory, conflict, and 500-item performance.
- [ ] OLS-016 Computer-use verify early and advanced Context scenarios at desktop/tablet and with keyboard/reduced motion.

### Slice 3 — AI Workshop artifact experience

- [ ] OLS-017 Group Prompts, Skills, System Prompts, Context, Memory, Tools, Evals, and Reviews inside AI Workshop while preserving direct routes.
- [ ] OLS-018 Rebuild catalog cards around canonical type, title, version, purpose, Context cost, deployment, and coverage.
- [ ] OLS-019 Rebuild detail hierarchy around identity, operational purpose, source, dependencies, Context, Evals, history, then Technical Details.
- [ ] OLS-020 Keep source selectable and educational; keep clauses/registry metadata/refs complete under Evidence.
- [ ] OLS-021 Apply curriculum disclosure to locked categories/commission recipes with honest prerequisite explanations.
- [ ] OLS-022 Migrate every artifact kind and historical version to the shared identity/disclosure contracts.
- [ ] OLS-023 Add catalog/detail/search/deep-link/accessibility tests, including `Carnivore Feeding v3` acceptance.
- [ ] OLS-024 Computer-use verify artifact recognition, source inspection, exact ref retrieval, and commission path.

### Slice 4 — Eval scenarios and visual replay

- [ ] OLS-025 Define Eval scenario-card projection: title, expected behavior, risk/severity, build state/cost, run cost, tags, last relevant result, exact ref.
- [ ] OLS-026 Replace default registry-like Eval rows with scenario selection cards while preserving explicit selection, suite order, and individual overrides.
- [ ] OLS-027 Preserve atomic build/run economics, confirmation, and insufficient-credit behavior.
- [ ] OLS-028 Rebuild result hierarchy around case outcome and expected vs observed before assertion/evidence detail.
- [ ] OLS-029 Link failed result to OutcomeStory, complete trace, exact fixture/seed/assertions, and responsible artifact version.
- [ ] OLS-030 Reuse Park scene projection for isolated Eval replay without touching live state or authoritative Eval output.
- [ ] OLS-031 Keep nonvisual replay/timeline equivalence and pause/step/speed parity.
- [ ] OLS-032 Add selection/economy/order/isolation/replay/accessibility tests for named cases.
- [ ] OLS-033 Computer-use verify build/select/run/fail/replay/detail flow for `Gate Fails During Exit`.

### Slice 5 — Review workflow

- [ ] OLS-034 Rebuild review header around canonical type, title, base/proposed versions, goal, and expected park impact.
- [ ] OLS-035 Present source change and Context/dependency/Tool/applicability impact before raw refs and semantic diff.
- [ ] OLS-036 Integrate named Eval scenario selection/build/run and expected/observed results in the review flow.
- [ ] OLS-037 Preserve exact review revisions, stale Eval invalidation, optimistic concurrency, warnings, hard gates, and evidence links.
- [ ] OLS-038 Make request-revision reason and next authored workbench path clear from a failed named Eval.
- [ ] OLS-039 Make deploy/revert actions clear, intentional, auditable, and explicit about future-job activation boundaries.
- [ ] OLS-040 Add full review state-machine UI/accessibility tests plus deployment transaction regression tests.
- [ ] OLS-041 Computer-use verify Skill v3->v4 failure, revision, passing rerun, warning/hard-gate behavior, deploy, and revert.
- [ ] OLS-042 Update review/workbench/eval implementation Docs and run focused validation.

### Slice 6 — Agent and Manager operations

- [ ] OLS-043 Rebuild worker summary around name, activity, location, queue pressure, Context load, and exceptions.
- [ ] OLS-044 Move complete Tools, Memory refs, exact ids, ordered queue internals, and traces into detail/evidence without hiding blocks/incidents.
- [ ] OLS-045 Rebuild Manager summary around mission, worker assignments, capacity/pressure, escalations, exceptions, and reporting state.
- [ ] OLS-046 Visualize named assignment relationships and pressure without changing scheduler decisions.
- [ ] OLS-047 Keep routing rules, authority, Context included/omitted/blocked inputs, eligibility facts, tie-breaks, refs, and manager trace complete under Evidence.
- [ ] OLS-048 Verify deliberate manual pressure remains before Manager unlock and routine success summarizes only after valid deployment.
- [ ] OLS-049 Add assignment/rejection/escalation/safety/context-block/disclosure/accessibility tests and deterministic scheduling parity.
- [ ] OLS-050 Computer-use verify pre-Manager overload, Manager need/unlock, valid/poor configuration consequences, and exception visibility.

### Slice 7 — Integrated deep-link workflow

- [ ] OLS-051 Audit every link in Park -> outcome -> Trace -> artifact -> Context -> Eval -> Review -> deploy -> Park and replace ambiguous/raw labels with shared identity.
- [ ] OLS-052 Preserve exact ids/refs in URL/query state, selection, back/forward, refresh, and saved workflow state.
- [ ] OLS-053 Preserve the original park problem/current objective when opening and returning from technical evidence.
- [ ] OLS-054 Add one integrated browser test traversing the entire first engineering loop with exact version assertions.
- [ ] OLS-055 Add production-render assertions that technical evidence is complete but implementation diagnostics are absent.
- [ ] OLS-056 Run computer-use desktop/tablet/keyboard walkthrough of the complete linked workflow.
- [ ] OLS-057 Run `npm run validate` and reconcile all affected PRDs/Docs before polish.

## Program 4: Playability Validation and Polish

Plan: `Specs/playability-validation-and-polish_PLAN.md`

### Slice 1 — Cohesive game feedback language

- [ ] PVP-001 Inventory visual tokens/assets and define the supported park palette, typography, spacing, elevation, state icons, motion, and feedback hierarchy.
- [ ] PVP-002 Define habitat, dinosaur, robot, gate/device, visitor, job, Context, Eval, review, and incident icon/silhouette rules.
- [ ] PVP-003 Create/reuse local vector/code-native assets where practical; use ImageGen only for raster assets that materially improve the game and document prompts/source.
- [ ] PVP-004 Verify every critical state has text/icon/shape treatment independent of color.
- [ ] PVP-005 Add restrained job success, warning, failure, selection, and incident visual feedback consistent across Park and replay.
- [ ] PVP-006 Add optional local sound cues only if they improve state awareness; provide mute and never make audio required.
- [ ] PVP-007 Verify reduced-motion/audio-off/high-contrast equivalence and target-size readability.
- [ ] PVP-008 Computer-use visually review all core states and update design/implementation Docs.

### Slice 2 — Responsive scale and performance

- [ ] PVP-009 Define supported desktop/tablet viewport matrix and capture baseline screenshots for Park, Operations, AI Workshop, Trace, Context, Evals, Review, and Manager.
- [ ] PVP-010 Fix responsive hierarchy so contextual panels become drawers/stacked detail without returning to an all-panels wall.
- [ ] PVP-011 Profile/max-test graphical Park updates at authored entity/event scale.
- [ ] PVP-012 Profile/max-test 10k Trace events and preserve virtualization/full evidence.
- [ ] PVP-013 Profile/max-test 500 Context items and preserve exact totals/findings.
- [ ] PVP-014 Profile/max-test Eval catalog/results and multi-Agent operations at MVP maximum.
- [ ] PVP-015 Optimize projections/render boundaries and decorative effects before removing information or weakening authoritative updates.
- [ ] PVP-016 Record budgets/results and computer-use verify responsive interaction at every supported viewport.

### Slice 3 — Accessibility certification

- [ ] PVP-017 Run automated accessibility checks across all routes and states in the first learning loop.
- [ ] PVP-018 Complete keyboard-only navigation/action flow, including map/list equivalence, drawers/dialogs, source, Eval selection, diff, replay, and deployment.
- [ ] PVP-019 Verify visible focus, logical order, skip behavior, and focus restoration after route/dialog/drawer changes.
- [ ] PVP-020 Verify screen-reader names/roles/headings/live regions for Park state, objectives, incidents, Context, Evals, and reviews.
- [ ] PVP-021 Verify 200% zoom and tablet layout without loss of critical state/actions.
- [ ] PVP-022 Verify contrast and no-color-only states.
- [ ] PVP-023 Verify reduced-motion equivalence for job/replay/entity state changes.
- [ ] PVP-024 Verify ordinary play never requires typing/recognizing a raw id; exact ids remain selectable under Technical Details.
- [ ] PVP-025 Document and computer-use verify the complete accessibility acceptance checklist.

### Slice 4 — Comprehension playtests

- [ ] PVP-026 Define privacy-respecting metrics/events for time to first action, navigation mistakes, visible-choice count, objective completion, evidence opening, Eval completion, canonical-term recognition, and interventions per jobs.
- [ ] PVP-027 Update telemetry specification/schema and consent behavior before emitting any new event.
- [ ] PVP-028 Add stable scenario/phase/artifact ids to measurements without transmitting unnecessary content or source text.
- [ ] PVP-029 Create a repeatable fresh-profile playtest script and observation sheet in Docs.
- [ ] PVP-030 Run at least one internal fresh-profile desktop walkthrough and record evidence, not just impressions.
- [ ] PVP-031 Run at least one tablet/keyboard/reduced-motion walkthrough and record evidence.
- [ ] PVP-032 Record whether the tester can explain the first failure and distinguish Prompt, Skill, Context, and Eval using real terms.
- [ ] PVP-033 Summarize findings and prioritized changes in Docs; do not silently alter normative curriculum/economy.

### Slice 5 — Evidence-based tuning

- [ ] PVP-034 Classify each finding as naming, hierarchy, navigation, objective/pacing, graphical legibility, accessibility, learning transfer, or intentional gameplay pressure.
- [ ] PVP-035 Update the owning PRD before any finding changes a requirement, workflow, curriculum order, failure cause/cost, economy, or domain behavior.
- [ ] PVP-036 Fix highest-severity comprehension blockers with focused tests and computer-use verification.
- [ ] PVP-037 Fix naming/terminology issues without replacing canonical AI terms or changing machine identity.
- [ ] PVP-038 Fix pacing/disclosure issues without hiding evidence or pre-teaching consequences.
- [ ] PVP-039 Re-run affected golden deterministic and full learning-loop browser tests after each meaningful tuning batch.
- [ ] PVP-040 Repeat playtest script and record before/after results against agreed targets.

### Slice 6 — Release reconciliation

- [ ] PVP-041 Inventory temporary flags, legacy frame/park components, placeholder copy, duplicate naming formatters, and obsolete styles.
- [ ] PVP-042 Remove an obsolete path only after code/reference/test search proves no supported route or saved state uses it.
- [ ] PVP-043 Update all affected `Docs/` implementation notes, operational checklists, architecture guidance, and keyboard smoke documentation.
- [ ] PVP-044 Re-read all affected PRDs and reconcile requirements, dependencies, decisions, workflows, tests, and actual behavior.
- [ ] PVP-045 Inspect final diff and `git status`; preserve unrelated/user changes and identify accidental product decisions.
- [ ] PVP-046 Run focused checks, then full `npm run validate`, production build/start smoke, persistence resume, and deterministic golden parity.
- [ ] PVP-047 Run final computer-use desktop/tablet fresh-game and saved-game acceptance; capture issues and resolve before completion.
- [ ] PVP-048 Mark all genuinely complete checklist tasks `[x]`, leave any remaining work explicit, and remove PLAN files only if the user requests cleanup after implementation is fully accepted.

## Global Completion Gate

The overhaul is complete only when all of the following are true:

- [ ] DONE-001 A fresh player reaches a meaningful graphical Park action without reading a raw table or implementation diagnostic.
- [ ] DONE-002 Canonical AI types are recognizable and every ordinary artifact/world instance has an approachable name.
- [ ] DONE-003 One complete consequence -> Trace -> improvement -> named Evals -> Review -> deploy -> safe replay loop passes.
- [ ] DONE-004 Exact ids, refs, versions, Context totals, traces, Eval fixtures/results, deployment history, and replay determinism remain intact.
- [ ] DONE-005 Graphical and nonvisual experiences expose equivalent critical state and commands.
- [ ] DONE-006 Intentional late-game multi-Agent pressure remains visible and Manager Agent orchestration reduces routine intervention without hiding exceptions.
- [ ] DONE-007 All affected specs and Docs match implementation.
- [ ] DONE-008 `npm run validate` and required computer-use desktop/tablet verification pass.

