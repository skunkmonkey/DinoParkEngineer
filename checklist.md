# Dino Park Engineer - Full Implementation Checklist

This checklist is the implementation control document for the complete game.
The owning requirements remain in `Specs/application_PRD.md` and the feature
PRDs. The feature PLAN files define the intended vertical slices in more detail.

## AI Execution Protocol - "Implement the next item"

This protocol makes the checklist usable from a completely fresh AI context.
The prior conversation is never required context. When asked to read this file
and implement the next item, the orchestrating AI SHALL execute the following
workflow rather than treating an isolated checkbox as the entire specification.

### 1. Load the required context

Read these files before changing a checklist status or editing implementation
code:

1. `AGENTS.md` in full for product invariants, architecture, workflow, and
   orchestration responsibilities.
2. This AI Execution Protocol, Status Legend, and Parallelization Legend in
   full.
3. `Specs/application_PRD.md` in full for the overall game, canonical terms,
   feature map, learning journey, acceptance criteria, and product invariants.
4. `coding_standards.md` in full for implementation and definition-of-done
   requirements.
5. The complete owning feature PRD and PLAN named above the selected checklist
   group.
6. The directly relevant upstream feature public contracts/specifications and
   downstream acceptance criteria identified by that PRD/PLAN.
7. Existing code, tests, implementation docs, and `git status` for the selected
   scope. Preserve unrelated or user-authored work already in the worktree.

Read `Docs/brainstorming_session.md` and `Docs/game_planning_session.md` only if
the application PRD and owning feature PRD leave a genuine product question
unresolved. Background documents never override a PRD.

### 2. Select the next actionable item

"Next" means the first item in document order that satisfies all of these
conditions:

- Its status is `[ ]`.
- Its phase's sequential gate and all named prerequisites are `[x]`.
- It is not downstream of an unresolved `[!]` item.
- It belongs to the currently open sequential section or an explicitly open
  parallel group.
- No active `[-]` item owns the same files, public contract, or authoritative
  state.

Skip `[x]` items. Do not take over `[-]` work. Reconsider a `[!]` item only after
its recorded unblocking condition has changed. If a sequential gate is blocked,
report that gate instead of silently starting a later phase. Independent work
may proceed around a blocked sibling only when both are in the same explicit
parallel group and the shared gate is already complete.

A checkbox is a control point, not permission to leave the repository in a
broken or untestable intermediate state. Select the smallest coherent vertical
slice that can produce a working, observable result. When that necessarily
includes adjacent checklist lines, state the slice boundaries up front and
update each included line separately when complete. Do not absorb unrelated
"while here" work.

### 3. Establish ownership and a plan

- Confirm the owning domain, public API boundary, dependencies, acceptance
  criteria, failure behavior, accessibility behavior, and tests before editing.
- Mark only the selected checklist item(s) `[-]` before implementation. The Sol
  orchestrator is the sole writer of checklist status during a coordinated run.
- Use the owning PLAN's vertical slices. If current code or a discovered
  requirement makes the PLAN invalid, update the PRD/PLAN explicitly rather than
  silently inventing a different architecture.
- For a material multi-file slice, maintain a short working plan that includes
  implementation, automated tests, browser verification, documentation, and
  integration validation.

### 4. Orchestrate bounded parallel work

The intended team configuration is a Sol orchestrator at medium reasoning
effort coordinating Luna subagents at max reasoning effort. The user or runtime
selects those models and efforts; repository text cannot configure them.

The Sol orchestrator SHALL:

- Own context gathering, dependency/gate decisions, decomposition, checklist
  statuses, architecture consistency, integration, and the final handoff.
- Give each Luna subagent a bounded task containing the owning PRD/PLAN paths,
  exact checklist lines and acceptance criteria, allowed file scope, relevant
  public contracts, prohibited overlaps, and required test evidence.
- Keep one owner for each authoritative domain and overlapping file set.
- Review every subagent diff and result rather than accepting a completion claim
  at face value.
- Integrate the full slice, run combined tests, inspect user-visible behavior,
  and decide whether the checklist status may change to `[x]`.

Luna subagents SHALL:

- Read the provided owning documents and relevant repository instructions before
  editing.
- Work only inside the assigned boundary and communicate discovered contract or
  scope conflicts instead of changing another domain opportunistically.
- Implement code, focused tests, and relevant docs for their bounded assignment.
- Return changed files, decisions, commands and results, remaining risks, and
  browser-verification needs to the orchestrator.
- Never edit `checklist.md`, declare an integration gate complete, or overwrite
  another agent's work.

Parallelize only within the explicit groups below and only after their shared
gate is complete. Tasks that modify the same public contract, state owner, route,
test fixture, manifest, or generated output are not independent. Complete the
group's integration gate before opening downstream work.

### 5. Implement to repository standards

- Follow `coding_standards.md` and import other packages only through their
  `public.ts` surfaces.
- Keep domain rules in the owning package. React and PixiJS render projections
  and issue commands; they do not own or mutate simulation truth.
- Preserve deterministic IDs, ordering, seeds, logical ticks, exact versions,
  provenance, replay, atomicity, and explicit Context retention behavior.
- Validate all imported, persisted, generated, and otherwise dynamic data at
  boundaries.
- Implement defined errors, safe failure/recovery paths, semantic accessibility
  equivalents, and cross-platform behavior as part of the slice, not as later
  cleanup.
- Update the owning PRD in the same change when implementation reveals or
  requires a meaningful product decision. Keep the PLAN and Docs aligned.

### 6. Test and verify before completion

Use the narrowest tests while iterating, then verify the whole slice. Evidence
must cover every changed testable user-observable behavior, not merely internal
helper functions.

At minimum, as applicable:

1. Run typechecking, lint, architecture checks, and focused unit/domain/contract
   tests for the changed packages.
2. Add rendered and integration tests for semantic UI, keyboard/focus behavior,
   public workflows, defined failures, and recovery.
3. Run deterministic golden/replay, exact-version, boundary, and cross-platform
   cases required by the owning PRD.
4. Start the real application and use the computer-use skill to test as a user
   whenever the changed or integrated behavior is reachable in a browser.
5. Through computer use, exercise the success path, relevant failure/recovery,
   keyboard path, and persistent accessible equivalent. Inspect the visible
   result; a server starting successfully is not user verification.
6. Run `npm run validate` at every integration or phase-completion gate and
   whenever the slice is presented as a complete repository change.
7. Inspect `git diff` and `git status` for accidental scope, secrets, generated
   debris, missing docs, and undocumented decisions.

Computer-use verification is mandatory whenever possible. If a reachable
browser behavior cannot be tested because a runtime, browser, dependency,
fixture, or integration surface is unavailable, record the exact missing
prerequisite and unblocking condition and mark the affected item `[!]`; do not
mark it `[x]`. For a genuinely headless slice with no reachable browser surface,
state why computer use does not apply and verify its real public contract with
automated tests. A unit test never substitutes for possible user verification.

### 7. Update status and hand off evidence

Use status transitions truthfully:

- `[ ] -> [-]` when the orchestrator begins and owns the item.
- `[-] -> [x]` only after the implementation, applicable specification/docs,
  automated tests, computer-use verification, and required validation pass.
- `[-] -> [!]` only for a concrete blocker outside the current task's ability to
  resolve. Append the exact cause, evidence, and unblocking condition.
- `[-] -> [ ]` when work stops incomplete without an external blocker and no
  active continuation owns it.

Do not use `[x]` for code that is untested, unintegrated, awaiting browser
verification, or known to violate an acceptance criterion. Do not use `[!]` for
work that is merely difficult.

The final handoff SHALL state:

- Checklist item(s) completed or blocked.
- Owning PRD and PLAN used.
- Files and public contracts changed.
- Automated commands run and their outcomes.
- Computer-use scenarios run and their outcomes, or the exact reason they were
  genuinely inapplicable/blocked.
- Remaining risks or blockers and the next actionable checklist item.

## Status Legend

- `[ ]` - Not started
- `[-]` - In progress
- `[x]` - Implemented and verified
- `[!]` - Blocked; the blocking condition must be recorded on the item

An item is not `[x]` until its implementation, focused automated tests,
specification/documentation impact, accessibility impact, and required browser
computer-use verification are complete. A whole phase is not complete until
`npm run validate` succeeds.

## Parallelization Legend

- **Sequential gate** - Complete before starting the dependent group.
- **Parallel group** - Items within the named group may be implemented
  concurrently after their shared gate is complete.
- **Integration gate** - Merge and verify the parallel outputs together before
  dependent work proceeds.

Parallel work must not bypass public package APIs or allow two efforts to edit
the same authoritative state owner independently.

---

## Phase 0 - Product, Architecture, and Environment

### Completed planning

- [x] Establish the application product baseline in
  `Specs/application_PRD.md`.
- [x] Reconcile the brainstorming and game-planning sessions with the
  application baseline.
- [x] Confirm strict TypeScript, React, PixiJS, and Vite as the application
  stack.
- [x] Confirm a static, local-first, offline-capable browser application with no
  runtime backend or runtime model dependency.
- [x] Confirm Windows and macOS as supported development environments.
- [x] Define all owning feature PRDs and vertical-slice PLANs.
- [x] Add the development-time OpenAI-assisted Rendering Asset Pipeline.
- [x] Define repository-wide implementation standards in
  `coding_standards.md`.
- [x] Define the fresh-context checklist execution and Sol/Luna orchestration
  protocol.
- [x] Document missing development software in
  `Docs/required_software.md`.

### Sequential environment gate

- [x] Install Node.js 24 LTS and its bundled npm on the current Windows machine.
  - Verify `node --version` satisfies `>=22.13.0`.
  - Verify `npm --version` satisfies `>=10`.
- [x] Verify Node.js and npm on the macOS development machine.
- [x] Verify Git and at least one supported browser on macOS.
- [x] Open a new terminal and confirm the repository sees Node.js and npm.
- [x] Create the initial npm package manifest and committed `package-lock.json`
  required by dependency installation. This prerequisite was moved from Phase
  1 because the environment gate cannot install from a lockfile that does not
  yet exist.
- [x] Install dependencies from the committed lockfile with `npm install`.
- [x] Record exact tool versions used for the first implementation baseline.

---

## Phase 1 - Application Shell Foundation

**Sequential gate:** Phase 0 environment is ready.

Owning documents:
`Specs/application-shell_PRD.md` and `Specs/application-shell_PLAN.md`.

### Project and build foundation

The initial npm package manifest and committed lockfile are established by the
Phase 0 environment gate so dependency installation has a valid source of
truth.

- [x] Configure strict TypeScript project references and browser/Node targets.
- [x] Configure React 19 and client-only React DOM startup.
- [x] Configure Vite development and static production builds.
- [x] Configure base-path-aware asset and route behavior.
- [x] Add portable Node-based repository scripts that work from Windows
  PowerShell and macOS shells.
- [x] Add baseline CSS design tokens, text scaling, focus, contrast, and reduced
  motion foundations.
- [x] Render an immediate accessible boot state.
- [x] Render actionable invalid-configuration and unsupported-browser states.

### Shell contracts and routing

- [x] Create `src/shell/public.ts` as the only public shell import surface.
- [x] Define the browser feature registration contract.
- [x] Validate stable feature IDs, deterministic order, route contributions,
  requirement level, lazy loaders, and failure presentations.
- [x] Reject duplicate feature IDs and duplicate route ownership.
- [x] Implement deterministic, base-aware clean route matching.
- [x] Implement stable mode identity and route titles.
- [x] Implement causal navigation payload pass-through without interpreting
  domain identifiers.
- [x] Implement an accessible not-found route with a safe Park View action.
- [x] Verify direct deep-link reload and static-host fallback behavior.

### Providers, lifecycle, and failure isolation

- [x] Implement explicit provider dependency validation and stable startup order.
- [x] Implement deterministic reverse disposal order and idempotent teardown.
- [x] Add configuration, diagnostics, accessibility preference, audio, feature
  status, and placeholder persistence ports.
- [x] Ensure providers expose commands and read-only projections rather than
  mutable domain state.
- [x] Add lazy feature error boundaries.
- [x] Keep optional feature failure scoped to its own route.
- [x] Block required feature/provider failure with a stable diagnostic code and
  recovery actions.
- [x] Add retry and safe-route recovery.

### Offline and update behavior

- [x] Generate Workbox precaching from Vite build output.
- [x] Report first install, offline ready, update ready, and update failure.
- [x] Implement safe-checkpoint coordination before activating an update.
- [x] Prevent automatic refresh over mutable unsaved play.
- [x] Add local, generic static-host, and optional Hostinger SPA fallback
  documentation.

### Shell validation gate

- [x] Add feature-registry, route, provider, lifecycle, and failure contract
  tests.
- [x] Add rendered tests for boot, not-found, required failure, optional failure,
  offline-ready, and update-ready states.
- [x] Add architecture lint preventing shell-internal imports and direct UI
  domain mutation.
- [x] Add Windows and macOS CI jobs.
- [x] Verify startup, deep links, fallback, offline reload, keyboard navigation,
  reduced motion, text scaling, and safe update through browser computer use.
- [x] Run the complete validation command successfully.

---

## Phase 2 - Foundational Domain and Asset Infrastructure

**Sequential gate:** The Application Shell public contracts are stable.

### Parallel Group A - Content Registry and initial rendering preparation

The Content Registry core starts first. Rendering asset briefs may begin as soon
as stable registry IDs and versions exist.

#### A1 - Content Registry

Owning documents:
`Specs/content-registry_PRD.md` and `Specs/content-registry_PLAN.md`.

- [x] Define namespaced content IDs, immutable versions, schema versions, and
  provenance.
- [x] Create the extensible content-class schema catalog with Zod.
- [x] Implement atomic catalog-package loading.
- [x] Reject malformed records, duplicate IDs/versions, case collisions,
  impossible constraints, and non-portable paths.
- [x] Implement exact dependency resolution with deterministic topological order.
- [x] Detect missing, cyclic, conflicting, and incompatible dependencies.
- [x] Create canonical serialization and deterministic manifest fingerprints.
- [x] Implement read-only queries by exact ID/version, class, tag, dependency,
  availability, and history.
- [x] Ensure production resolution exposes no floating newest-version shortcut.
- [x] Keep hidden historical versions exactly resolvable.
- [x] Support required and optional local content packages.
- [x] Isolate optional package failure and block required package failure.
- [x] Create one validated Prompt fixture and registry inspection projection.
- [x] Prove adding a newer version cannot change historical resolution.
- [x] Add golden validation, resolution, mutation, and cross-platform path tests.
- [x] Verify invalid and historical catalog states in the browser.

#### A2 - Rendering Asset Pipeline: briefs and provenance

Owning documents:
`Specs/rendering-assets_PRD.md` and `Specs/rendering-assets_PLAN.md`.

- [x] Create `assets/briefs`, `assets/source`, `assets/manifests`, and generated
  runtime-output boundaries.
- [x] Define stable asset-family, brief, source, candidate, runtime-asset,
  bundle, and version IDs.
- [x] Define shared three-quarter art-direction constraints.
- [x] Define brief fields for semantic role, owning feature, required views,
  display scale, source canvas, safe bounds, pivot, animation, variants, and
  accessibility equivalents.
- [x] Validate brief revisions through the Content Registry.
- [x] Author and validate the first MVP robot asset brief.
- [x] Define candidate provenance for model alias/snapshot, prompt/brief revision,
  reference inputs, generation parameters, creation time, hashes, lineage, and
  reviewer state.
- [x] Ensure manifests can never store API secrets.
- [x] Implement candidate quarantine; every generated output begins unapproved.
- [x] Implement explicit approve, reject, supersede, and request-revision records.
- [x] Generate a human-reviewable HTML contact sheet and checklist.
- [x] Add tests proving unapproved candidates cannot enter runtime bundles.

### Parallel Group B - Simulation foundation

Simulation may start after the minimal Content Registry exact-resolution API is
stable and can proceed while the Rendering Asset Pipeline is being developed.

Owning documents: `Specs/simulation_PRD.md` and `Specs/simulation_PLAN.md`.

- [x] Define serializable authoritative world state with stable IDs/order.
- [x] Implement integer logical ticks and deterministic scheduling.
- [x] Implement pause and speed as tick-request controls rather than changed
  semantics.
- [x] Implement named seeded random streams and ban ambient `Math.random`.
- [x] Define validated world commands and atomic command results.
- [x] Reject invalid, stale, unauthorized, and physically impossible commands
  without partial mutation.
- [x] Implement locations, enclosure boundaries, navigation graph/grid, and
  deterministic movement.
- [x] Implement robot location, tools, carried state, battery/health, assignment,
  and physical action state.
- [x] Implement gate open/closed/locked/jammed state, closer, sensor reading,
  sensor health, and transition zones.
- [x] Keep reported sensor state distinct from physical gate state.
- [x] Implement dinosaur location, containment, hunger/need, agitation, target,
  species constraints, baiting, feeding, and escape behavior.
- [x] Implement visitor groups, movement, exposure, panic, evacuation, injury,
  and casualty outcomes.
- [x] Implement deterministic shared-resource contention and reservations.
- [x] Implement tool requirements, effects, failures, and source-labeled evidence.
- [x] Implement validated exact scenario fixtures.
- [x] Implement snapshot plus ordered-command replay inputs.
- [x] Create read-only world projections.
- [x] Keep all simulation data structured-clone compatible and worker-ready.
- [x] Add golden fixtures for movement, gates, feeding, escape, visitors, and
  shared-gate contention.
- [x] Prove results are independent of display frame rate and requested speed.
- [x] Run identical fixtures in Node and browser.

### Integration Gate A

- [x] Load exact simulation fixtures through the Content Registry.
- [x] Display one robot and gate projection in a shell fixture without allowing
  UI mutation.
  - Chrome computer-use verification on 2026-08-19 confirmed Enter and Space
    activate the native simulation control and Tab moves focus to the next
    control. The immutable robot/gate projection and persistent evidence stayed
    synchronized with the authoritative command result.
- [x] Verify exact replay after a newer content version is registered.
- [x] Run registry and simulation focused tests together.

---

## Phase 3 - Deterministic Agent Core

**Sequential gate:** Integration Gate A is complete.

### Instruction Artifacts

Owning documents: `Specs/instruction_PRD.md` and `Specs/instruction_PLAN.md`.

- [x] Define exact Task, Prompt, Skill, System Prompt, Policy, tool instruction,
  knowledge-selection, verification, failure, escalation, delegation, and
  reporting artifact schemas.
- [x] Keep readable source text distinct from machine-readable behavior clauses.
- [x] Define declarative clause applicability, priority, required facts,
  preconditions, allowed action, postconditions, verification, and failure path.
- [x] Implement bounded declarative expression operators and reject arbitrary
  executable code.
- [x] Implement deterministic applicability ordering and conflict resolution.
- [x] Return one tool request, completion, wait, stop, or escalation result.
- [x] Return applied/rejected/conflicting clause provenance without hidden
  chain-of-thought.
- [x] Ensure the executor can see only its supplied context snapshot.
- [x] Forward physical actions to Simulation and consume Simulation evidence.
- [x] Implement evidence source, freshness, agreement, alternate verification,
  bounded retry, stop, and escalation.
- [x] Implement composition across Prompt, Skill, System Prompt, and Policy.
- [x] Preserve clause-source provenance and detect duplicates/conflicts.
- [x] Create self-contained and modular feeding approaches with real tradeoffs.
- [x] Prove changing prose alone changes no behavior.
- [x] Prove degraded gate-sensor evidence requires explicit fallback.
- [x] Add complete clause, conflict, verification, security, and production/eval
  equivalence tests.

### Context foundation

Owning documents: `Specs/context_PRD.md` and `Specs/context_PLAN.md`.

- [x] Define provenance-labeled context items for Task, System Prompt, Skill,
  Policy, Knowledge, Memory, Tool, Message, Observation, Tool Result, and
  Task History.
- [x] Assign deterministic integer context-unit cost, exact source version,
  tick, priority, eligibility, and pin state to every item.
- [x] Implement deterministic assembly from Agent/job/routes/sources/prior state.
- [x] Identify included, unavailable-required, inapplicable, excluded,
  compacted, and externalized items.
- [x] Calculate exact numerical used/total capacity and category segments.
- [x] Add immutable before-retention and after-retention manifests.
- [x] Add runtime observations, results, messages, history, incident evidence,
  and instructions only at decision boundaries.
- [x] Add next-decision demand and overflow preview.
- [x] Implement missing-context diagnostics without hidden world access.
- [x] Implement Strict / Halt and Signal.
- [x] Halt before the next decision and notify the external park fault port.
- [x] Prove there is no hidden emergency context capacity.
- [x] Implement Keep Newest with oldest-eligible-unpinned stable ordering.
- [x] Record every retained and excluded item plus downstream behavior.
- [x] Separate capacity from stale, duplicate, conflicting, irrelevant, and
  missing-required diagnostics.
- [x] Create the opening missing-maintenance-context fixture.
- [x] Create runtime-growth and behavior-changing eviction fixtures.
- [x] Add exact capacity and retention-matrix tests.
- [x] Fail any execution path that continues after unrecorded overflow.

---

## Phase 4 - Context Lifecycle Evidence

**Sequential gate:** Context assembly, Strict, and Keep Newest are stable.

### Parallel Group C - Memory and Trace/Replay

#### C1 - Memory

Owning documents: `Specs/memory_PRD.md` and `Specs/memory_PLAN.md`.

- [x] Define exact versioned memory entries, stores, scopes, facts, tags,
  source lineage, creation/observation ticks, supersession, and provenance.
- [x] Keep memory unavailable until explicitly retrieved into Context.
- [x] Implement atomic externalization with Context retention events.
- [x] Prevent failed storage from creating phantom externalization.
- [x] Implement explicit deterministic retrieval predicates, ranking, limits,
  authority, and stable tie-breaking.
- [x] Return selected, considered, rejected, unavailable, and conflicting entries
  with reasons and context costs.
- [x] Implement Agent, team/Manager, enclosure, park, and scenario scopes as
  content enables them.
- [x] Implement read/write authority for shared memory.
- [x] Implement staleness, supersession, conflict, broadness, duplication, and
  routing diagnostics.
- [x] Implement deterministic Compact History reducers.
- [x] Record preserved facts, exact sources, known lost detail, summary version,
  cost, and summary-of-summary lineage.
- [x] Implement Externalize and Retrieve ports used by Context.
- [x] Create retrieval-miss, stale-shared-memory, and compaction-loss fixtures.
- [x] Add retrieval, authority, failure, lineage, repeatability, and behavior
  tests.

#### C2 - Trace and Replay

Owning documents: `Specs/trace-replay_PRD.md` and
`Specs/trace-replay_PLAN.md`.

- [x] Define versioned trace identity and event schemas.
- [x] Record exact Task/job/eval, resolved content manifest, seed/state,
  decision cycles, context manifests, retention, clauses, conflicts, tool
  requests/results, evidence, world deltas, messages, delegation, outcomes, and
  incident links.
- [x] Add stable logical tick, sequence, entity links, and causal parent links.
- [x] Prohibit hidden-reasoning/chain-of-thought fields by schema and tests.
- [x] Capture authoritative subsystem records rather than reconstructing causes
  from UI state.
- [x] Finalize traces as complete, interrupted, invalid, or incomplete.
- [x] Surface trace-capture failure without changing simulation behavior.
- [x] Implement concise outcome and detailed decision-cycle projections.
- [x] Distinguish available, unavailable, excluded, stale, and never-routed data.
- [x] Preserve causal navigation identity across park, job, Agent, evidence,
  artifact, eval, review, and deployment links.
- [x] Implement isolated historical replay with play, pause, step, seek, speed,
  and entity/event focus.
- [x] Keep replay and production state strictly isolated.
- [x] Implement exact authoritative rerun verification and first-mismatch report.
- [x] Implement trace comparison by aligned cycles, context, clauses, actions,
  evidence, cost, and world outcome.
- [x] Add golden traces, prohibited-field tests, causal-link tests, replay
  equivalence, mismatch, and long-trace seek tests.

### Context advanced-retention integration

- [x] Implement Priority Retention using pins, explicit priorities, and stable
  ties.
- [x] Integrate deterministic Compact History through the Memory public API.
- [x] Integrate Externalize and Retrieve through the Memory public API.
- [x] Prove every retention strategy records exact before/after manifests and
  downstream behavior.
- [x] Expose full retention comparisons without implying a universal best policy.

### Integration Gate B

- [x] Run a complete Agent decision cycle from exact job versions through
  Context, Instruction, Simulation, and Trace.
- [x] Replay the exact result with the same state and versions.
- [x] Demonstrate missing maintenance context without implying the Agent saw it.
- [x] Demonstrate Strict stop, Keep Newest loss, compaction loss, and retrieval
  failure.
- [x] Prove prose changes alone do not change any result or trace.
  - In-app browser computer-use verification on 2026-08-19 exercised exact
    Trace inspection, isolated historical replay, Priority Retention,
    Externalize and Retrieve, a retrieval miss, Enter-key activation,
    persistent evidence, 150% text, high contrast, and reduced motion. The
    browser reported no runtime warnings or errors; `npm run validate` passed
    all 95 tests and the production build.

---

## Phase 5 - Park Operations and First Playable Presentation

**Sequential gate:** Integration Gate B is complete.

### Parallel Group D - Operations, approved MVP assets, and opening content

#### D1 - Park Operations

Owning documents: `Specs/park-operations_PRD.md` and
`Specs/park-operations_PLAN.md`.

- [x] Implement pre-opening, open operation, closing, and engineering/expansion
  phase state machine.
- [x] Define stable jobs with Task, target, priority, schedule, exact deployed
  versions, assignment, due ticks, status, and result links.
- [x] Implement job create, assign, start, pause, resume, cancel, complete, fail,
  stop, and escalate commands.
- [x] Resolve and pin exact production versions before first Agent decision.
- [x] Implement deterministic schedules with idempotent occurrence IDs.
- [x] Implement stable job-queue priority.
  - Chrome computer-use verification on 2026-08-19 confirmed Enter-key rejected
    assignment recovery, Shift+Tab focus movement to Robot Alpha, Enter-key
    successful assignment, exact pinned Task/Skill/Policy versions, persistent
    failure/success history, 150% text without horizontal overflow, high contrast,
    reduced motion, and no browser warnings or errors. Eight focused tests and
    all 103 repository tests passed.
- [x] Implement allowed time, opening, closing, assignment, and incident commands.
- [x] Implement readiness conditions and intentional park opening.
- [x] Implement visitor entry and departure phase permissions.
- [x] Classify ambient conditions, operational warnings, and emergencies.
- [x] Keep ambient state out of the notification queue.
- [x] Implement prioritized non-disruptive warning queue.
- [x] Implement emergency interrupt, location, immediate risk, and pause request.
- [x] Implement explicit causal/spatial/time incident grouping.
- [x] Implement incident detected, active, stabilized, engineering-unresolved,
  resolved, and closed states.
- [x] Expose expected, observed, consequence, immediate gap, entities, and trace
  links.
- [x] Implement park-level fault monitoring independent of Agent context.
- [x] Detect Strict context stops externally.
- [x] Implement closing and exact operational day summary.
- [x] Add job, schedule, phase, alert, grouping, monitor, and stable-repeat tests.

#### D2 - Runtime rendering asset compilation

- [x] Import OpenAI-generated candidate assets with complete provenance.
- [x] Review robot, dinosaur, gate, environment, visitor, cue, effect, thumbnail,
  and expressive-reward candidates against approved briefs.
- [x] Reject or revise inconsistent view, silhouette, lighting, transparent edge,
  pivot, scale, embedded text, or accessibility behavior.
- [x] Approve exact source hashes explicitly.
- [x] Implement deterministic crop, trim, padding, scale, format conversion, and
  atlas packing.
- [x] Emit exact asset/version, atlas rectangle, source size, trim, pivot, hit
  region, depth/occlusion hint, animation frames/timing, and semantic tags.
- [x] Implement explicit development placeholders.
- [x] Reject placeholders for required production assets.
- [x] Validate atlas overlap, missing frames, stale output, duplicate IDs, case
  collisions, unsupported formats, and orphaned assets.
- [x] Build a small deterministic PixiJS fixture bundle.
- [x] Compile the same fixture on Windows and macOS and compare canonical output.
- [x] Keep all generation tooling and secrets out of browser bundles.
  - Chrome verification on 2026-08-19 displayed the approved 1254×1254 RGBA
    source and exact hash-bound review decisions with no warnings or errors.
    Sixteen focused asset tests, canonical darwin/win32 logical comparison, and
    production asset validation passed.

#### D3 - Opening curriculum package foundation

Owning documents: `Specs/curriculum-content_PRD.md` and
`Specs/curriculum-content_PLAN.md`.

- [x] Define curriculum package, arc, scenario, unlock, guidance, transfer,
  Handbook, copy-ID, asset-bundle, and playtest-tag schemas.
- [x] Author exact dawn park scenario and approved asset dependencies.
- [x] Author the partially configured first feeding job and successful behavior.
- [x] Author the second enclosure with visibly disabled automatic closer.
- [x] Omit maintenance state from the Worker's routed context.
- [x] Author the deterministic recoverable near miss without onboarding fatality.
- [x] Author concise incident explanation and causal links.
- [x] Author minimum Workbench choices, free eval, review/deploy path, opening
  reward, and Handbook entry placeholders.
- [x] Validate cross-domain exact references, unlock reachability, asset readiness,
  accessible cues, and deterministic golden outcomes.

### Player Experience: first playable

Owning documents: `Specs/player-experience_PRD.md` and
`Specs/player-experience_PLAN.md`.

- [x] Register Park View and focused-mode routes through the Shell.
- [x] Initialize PixiJS 8 with production WebGL preference.
- [x] Create a projection-only Park Scene adapter.
- [x] Create the stable three-quarter park projection.
- [x] Implement pan, zoom, focus-on-event, bounds, and intelligent occlusion.
- [x] Implement responsive React DOM application chrome.
- [x] Implement production/pause/eval/replay mode framing without color-only
  distinction.
- [x] Implement synchronized semantic DOM entity navigator for canvas content.
- [x] Implement pointer and keyboard selection using the same stable entity ID.
- [x] Implement selection outline, local motion suppression, immediate state,
  intent, and route.
- [x] Implement contextual inspectors for dinosaur, robot, gate, visitor group,
  job, alert, and incident.
- [x] Implement time controls and accessible current-time reference.
- [x] Implement needs, intent, risk, provenance, outcome, degraded, warning, and
  emergency visual grammar.
- [x] Implement persistent event/announcement history.
- [x] Implement reduced motion, screen shake, flashing, contrast, text scaling,
  and sound-substitution preferences.
- [x] Implement Web Audio adapter, mute/volume, autoplay-safe start, and semantic
  substitutes.
- [x] Render dawn, approaching visitors, hungry dinosaur, available robot, gate,
  and one immediate meaningful action.
- [x] Assign and watch the first successful feeding through the Inspector.
- [x] Verify canvas animations never advance authoritative state.

### First Playable Integration Gate

- [x] Start the game locally with no account, backend, secret, model call, or
  network dependency after assets are cached.
- [x] Show a meaningful dawn park state before substantial mandatory text.
- [x] Assign and complete the first deterministic feeding job.
- [x] Inspect exact job versions, context, clause, tool evidence, and world delta.
- [x] Pause and change speed without changing the result.
- [x] Save a golden screenshot/contact sheet for visual regression.
- [x] Complete pointer, keyboard, enlarged-text, high-contrast, reduced-motion,
  and sound-substitution paths through browser computer use.
  - Connected Chrome verification on 2026-08-19 covered approved Pixi/WebGL art,
    pointer and Arrow/Space keyboard selection using the same stable IDs, exact
    feeding evidence, 4×/pause result equivalence, grouped near-miss pause and
    recovery, every focused-mode deep link, 150% text, high contrast, reduced
    motion, audio mute/volume/autoplay fallback, and persistent semantic history.
    No runtime warnings or errors remained. The golden is
    `tests/fixtures/player-experience/first-playable-golden.jpg`.
  - A second connected-Chrome customer audit on 2026-08-19 retested dawn,
    rejected and successful assignment, exact evidence at 1× and after a 4×
    logical tick, alert priority and acknowledgement, near-miss recovery, every
    focused route, pointer/keyboard parity, Web Audio fallback, 150% text, high
    contrast, reduced motion, sound substitution, and 390-pixel reflow. It fixed
    dynamic feeding-delta evidence, the completed one-shot near-miss affordance,
    and narrow-grid overflow. Browser logs were clean and `npm run validate`
    passed 128 tests plus the production build.
  - Follow-up connected-Chrome verification fixed a Strict Mode audio lifecycle
    bug that left optional audio permanently locked and ordered the first cue
    after asynchronous browser unlock. Both the explicit enable action and the
    first assignment action now report `Audio unlocked after user action` with
    clean browser logs.

---

## Phase 6 - Engineering Workflow

**Sequential gate:** First Playable Integration Gate is complete.

### Parallel Group E - Workbench, Eval Runner, initial Economy, and base Persistence

#### E1 - Engineering Workbench

Owning documents:
`Specs/engineering-workbench_PRD.md` and
`Specs/engineering-workbench_PLAN.md`.

- [ ] Implement focused Workbench mode with production paused by default.
- [ ] Add the single Park Developer presence and capability profile.
- [ ] Explicitly exclude developer hiring, candidates, salaries, replacement,
  and teams.
- [ ] Implement exact artifact inspection for source, clauses, context,
  dependencies, tools, tradeoffs, deployment, and history.
- [ ] Visually and semantically distinguish prose from executable clauses.
- [ ] Implement semantic comparison across readable, behavioral, context,
  dependency, tool, verification, failure, and tradeoff differences.
- [ ] Link duplicate, missing, stale, conflicting, and irrelevant findings to
  exact supporting evidence.
- [ ] Implement bounded deterministic component/clause composition.
- [ ] Implement context-route composition and exact capacity preview.
- [ ] Implement work request goal, base version, capability, inputs, quote, and
  status.
- [ ] Implement immutable candidate creation and linked revision feedback.
- [ ] Ensure candidate work never changes production.
- [ ] Implement Engineering Handbook term, visual grammar, encountered example,
  search, filter, and incident links.
- [ ] Keep Handbook content outside Agent context.
- [ ] Add artifact, comparison, composition, work, immutability, Handbook, and
  accessibility tests.

#### E2 - Eval Runner

Owning documents: `Specs/eval-runner_PRD.md` and
`Specs/eval-runner_PLAN.md`.

- [ ] Define exact versioned eval case, fixture, assertion, suite, risk, and cost
  reference schemas.
- [ ] Define bounded deterministic assertions over world, job, context, trace,
  tool, message, and outcome records.
- [ ] Reject arbitrary executable grader code.
- [ ] Implement exact case and named-suite selection.
- [ ] Show risks, unavailable cases, previous results, and estimated run cost.
- [ ] Instantiate a fresh isolated production-equivalent domain environment per
  case.
- [ ] Prevent all access to production world/economy/persistence mutation paths.
- [ ] Inject the exact candidate and resolved dependency manifest.
- [ ] Implement completed, passed, failed, invalid, timed-out, and interrupted
  results.
- [ ] Record expected, observed, pass/fail, evidence, mismatch, trace, and replay.
- [ ] Derive all case/suite scores only from executed assertions.
- [ ] Prohibit fabricated reliability/confidence percentages.
- [ ] Implement exact rerun and like-for-like result/trace comparison.
- [ ] Implement persistent SIMULATION framing distinct from production.
- [ ] Create and run the free opening maintenance-context eval.
- [ ] Add isolation, result derivation, ordering, timeout, interruption, rerun,
  comparison, and accessibility tests.

#### E3 - Economy foundation

Owning documents:
`Specs/economy-progression_PRD.md` and
`Specs/economy-progression_PLAN.md`.

- [ ] Implement immutable transaction ledger and derived balance.
- [ ] Implement atomic idempotent quote/reserve/commit/cancel protocol.
- [ ] Separate authoring/acquisition, runtime, eval build/run, operation,
  response, recovery, expansion, and expression costs.
- [ ] Implement deterministic day settlement from exact Park Operations records.
- [ ] Implement park rating with inspectable safety, guest experience, and
  dinosaur welfare contributors.
- [ ] Implement rating-driven demand and visitor revenue.
- [ ] Implement one-time eval authoring cost and cheap reruns.
- [ ] Add transaction, settlement, quote, rating, demand, and no-double-charge
  tests.

#### E4 - Persistence foundation

Owning documents: `Specs/persistence_PRD.md` and
`Specs/persistence_PLAN.md`.

- [ ] Define versioned save envelope, content manifest, domain sections,
  integrity data, and completion marker.
- [ ] Define public versioned persistence ports for stable implemented domains.
- [ ] Implement canonical serializable save data without functions, DOM,
  renderer, or platform paths.
- [ ] Implement in-memory repository for tests.
- [ ] Implement complete candidate validation before session replacement.
- [ ] Implement exact manual save/load of first-playable world, jobs, versions,
  context, trace, and preferences.
- [ ] Prove historical replay after reload.
- [ ] Keep current session unchanged when validation fails.
- [ ] Add first round-trip, missing-content, invalid-domain, and isolation tests.

### Integration Gate C - Near miss diagnosis

- [ ] Present the visible disabled gate closer before the second feeding.
- [ ] Reuse the first instruction with maintenance information absent from
  Worker context.
- [ ] Produce the exact recoverable near miss.
- [ ] Group related symptoms into one evolving incident.
- [ ] Pause production and focus the affected enclosure.
- [ ] Present expected, observed, consequence, and immediate causal gap.
- [ ] Navigate Park → incident → job → action → context → evidence → responsible
  artifact.
- [ ] Open Workbench with the correct paused operational anchor.
- [ ] Compare the deployed artifact with a valid correction.
- [ ] Compose or commission the minimum context/instruction fix.
- [ ] Produce an immutable candidate without changing production.
- [ ] Run and replay the free exact eval.
- [ ] Return to the same causal event and preserve all IDs.

---

## Phase 7 - Review, Deployment, and MVP Completion

**Sequential gate:** Integration Gate C is complete.

### Review and Deployment

Owning documents:
`Specs/review-deployment_PRD.md` and
`Specs/review-deployment_PLAN.md`.

- [ ] Implement immutable change requests with goal, author, exact base and
  candidate, readable/behavioral diff, context/dependency/tool delta, expected
  effect, tradeoffs, and risks.
- [ ] Bind exact selected eval cases/suites and immutable results.
- [ ] Distinguish passed, failed, invalid, interrupted, and omitted evidence.
- [ ] Link every failure to trace/replay diagnosis.
- [ ] Implement request changes, retain production, deploy, and revert decisions.
- [ ] Preserve reviewed candidates and linked feedback.
- [ ] Implement explicit exact deployment confirmation by production slot/scope.
- [ ] Resolve and fingerprint exact dependency manifests before activation.
- [ ] Make activation atomic and fail closed.
- [ ] Ensure only future jobs use the new deployment.
- [ ] Preserve all existing job and historical version pins.
- [ ] Implement explicit revert as a new deployment record.
- [ ] Preserve deployment, review, eval, job, incident, and revert causal history.
- [ ] Add decision, atomicity, evidence, before/after job, history, and
  accessibility tests.

### Incident Response MVP

Owning documents:
`Specs/incident-response_PRD.md` and
`Specs/incident-response_PLAN.md`.

- [ ] Implement external eligibility based on exact incident/world state.
- [ ] Present location, immediate risk, capabilities, arrival, duration, cost,
  closures, and limitations.
- [ ] Implement explicit manual activation and idempotency.
- [ ] Reserve and settle response cost through Economy.
- [ ] Implement deterministic requested, dispatched, en route, operating,
  stabilized, limited/failed, and complete states.
- [ ] Implement visitor evacuation, temporary containment, and stranded-robot
  recovery through Simulation commands.
- [ ] Record response evidence, closures, downtime, cost, and rating effects.
- [ ] Prove response never changes Context, artifacts, routes, Retention Policy,
  review, or deployment.
- [ ] Keep stabilized incidents engineering-unresolved.
- [ ] Add response eligibility, timing, limitations, boundary, economy, and
  accessibility tests.

### Persistence MVP completion

- [ ] Implement IndexedDB staged writes and transactional known-good promotion.
- [ ] Implement coalesced autosave at domain-declared safe checkpoints.
- [ ] Handle quota, transaction abort, corruption, truncation, and stale staging.
- [ ] Save/load every MVP domain: world, seed, time, content, jobs, context,
  memory, traces, evals, Workbench, reviews, deployments, economy, incidents,
  response, progression, rewards, curriculum, preferences, and consent state as
  applicable.
- [ ] Preserve exact historical versions after deploy and revert.
- [ ] Implement save listing and metadata.
- [ ] Implement portable export/import quarantine and validation.
- [ ] Implement explicit delete confirmation.
- [ ] Implement one real deterministic schema migration with original backup.
- [ ] Implement last-known-good and diagnostic-export recovery.
- [ ] Add composite round-trip, fault injection, migration, export/import, and
  Windows/macOS portability tests.

### Economy and expression MVP completion

- [ ] Settle the first full park day with explainable rating and credits.
- [ ] Implement one Park Developer capability unlock that creates a real action.
- [ ] Keep capability availability separate from purchase/acceptance.
- [ ] Implement one expressive reward with approved rendering asset.
- [ ] Implement reward inventory, placement, removal, persistence, and visible
  visitor/park use.
- [ ] Prove the expressive reward has no large compounding mechanical bonus.

### Player Experience MVP completion

- [ ] Implement focused-mode operational anchor with production state/time,
  rating, credits, emergency count, selected version, and causal breadcrumb.
- [ ] Implement route restoration to the exact originating park event.
- [ ] Implement visible degraded gate state and near-miss staging.
- [ ] Implement grouped incident card and emergency auto-pause.
- [ ] Implement synchronized Eval and Historical Replay presentation.
- [ ] Implement action-skippable onboarding guidance escalation.
- [ ] Ensure guidance use, pause, and slower speed do not change rewards.
- [ ] Implement the first memorable retention animation plus exact persistent
  Excluded/Compacted/Externalized information.
- [ ] Keep later retention presentations faster and reduced-motion compatible.

### Curriculum opening and transfer completion

- [ ] Complete the exact five-minute opening content package.
- [ ] Add concrete success copy rather than lesson-completion language.
- [ ] Unlock the first relevant Handbook entry after the incident.
- [ ] Add a novel species/enclosure transfer case for missing context.
- [ ] Disable repeated opening guidance during the transfer attempt.
- [ ] Define observable transfer success and optional delayed assistance.

### MVP Acceptance Gate

- [ ] Verify network-disabled core play without account, secret, backend, or
  runtime model.
- [ ] Verify exact near-miss replay with identical state, versions, actions,
  trace, and outcome.
- [ ] Verify prose-only changes do not change behavior.
- [ ] Verify complete causal path from park consequence through deployment and
  back.
- [ ] Verify exact Context Capacity composition, growth, overflow, retention,
  exclusions, and policy.
- [ ] Verify no silent over-capacity execution path.
- [ ] Verify every displayed eval result comes from a real fixture.
- [ ] Verify historical jobs remain pinned after deployment.
- [ ] Verify Incident Response stabilizes without repairing engineering.
- [ ] Verify production, pause, eval, and replay without relying on color.
- [ ] Verify all critical actions by keyboard and all transient cues in
  persistent history.
- [ ] Verify save, reload, replay, revert, and redeploy exactness.
- [ ] Verify the novel transfer case.
- [ ] Run the opening with representative newcomers and measure the provisional
  five-minute target.
- [ ] Obtain experienced Agent-user credibility feedback.
- [ ] Run `npm run validate` and all browser computer-use scenarios.

---

## Phase 8 - Full Context, Memory, and Engineering Progression

**Sequential gate:** MVP Acceptance Gate is complete.

### Parallel Group F - Advanced engineering systems

#### F1 - Context and Memory curriculum/mechanics

- [ ] Add context-bloat scenario and Context Profiler capability progression.
- [ ] Add independent staleness, duplication, conflict, and irrelevance evidence
  views.
- [ ] Add Priority Retention configuration and failure cases.
- [ ] Add Compact History progression and detail-loss cases.
- [ ] Add Externalize and Retrieve progression and retrieval-miss cases.
- [ ] Add stale/conflicting shared-memory cases.
- [ ] Add context-capacity upgrade with real short-term benefit and ongoing cost.
- [ ] Demonstrate why larger capacity does not fix routing, duplication,
  staleness, conflict, retention, or runtime cost.
- [ ] Add transfer cases for each advanced context/memory concept.

#### F2 - Eval and review progression

- [ ] Add case authoring through Park Developer capability and Economy cost.
- [ ] Add permanent authored-case ownership and cheap reruns.
- [ ] Add named reusable suite creation/editing with exact case versions.
- [ ] Add degraded sensor, visitor zone, unavailable bait, low battery, tool
  failure, stale context, conflict, and orchestration cases.
- [ ] Add explicit eval-coverage-gap scenario.
- [ ] Add risk-based selection under constrained credits.
- [ ] Add regression comparisons across multiple artifact versions.
- [ ] Add mandatory recovery eval selection and evidence rules.
- [ ] Add transfer cases for coverage and version governance.

#### F3 - Workbench progression

- [ ] Implement Prompt authoring/selection capability progression.
- [ ] Implement Skill authoring and composition progression.
- [ ] Implement System Prompt and Policy modularization progression.
- [ ] Implement Context Optimization and Context Profiler progression.
- [ ] Implement Eval Creation progression.
- [ ] Implement Tool Integration progression.
- [ ] Implement Memory Architecture progression.
- [ ] Implement Agent Design progression.
- [ ] Implement Orchestration progression.
- [ ] Ensure every capability unlocks a concrete action or workflow.
- [ ] Expand professional exemplars and tradeoff comparisons.
- [ ] Expand Handbook terms and encountered examples without becoming required.

#### F4 - Asset pipeline expansion

- [ ] Author briefs before each new visual feature or curriculum slice.
- [ ] Generate, review, and approve new species and state variants.
- [ ] Generate, review, and approve additional robot/tool/Manager variants.
- [ ] Generate, review, and approve memory, eval, review, incident, and
  orchestration thumbnails/cues where raster media is appropriate.
- [ ] Generate, review, and approve expansion environments and expressive rewards.
- [ ] Maintain shared silhouette, orientation, pivot, lighting, palette, and
  semantic-state consistency.
- [ ] Version every replacement without mutating historical runtime bundles.
- [ ] Continuously validate atlas/bundle budgets and cross-platform compilation.

### Integration Gate D

- [ ] Complete experience → inspect → name → apply → reuse for every advanced
  engineering concept.
- [ ] Verify all advanced retention/memory actions remain deterministic and
  replayable.
- [ ] Verify all new engineering candidates still require explicit review and
  deployment.
- [ ] Verify exact save/load of new versions, summaries, cases, suites, and
  capability progression.

---

## Phase 9 - Multi-Agent Orchestration

**Sequential gate:** Relevant Instruction, Context, Memory, Park Operations,
Trace, Economy, Workbench, and Persistence contracts are stable.

Owning documents:
`Specs/orchestration_PRD.md` and `Specs/orchestration_PLAN.md`.

### Worker fleet

- [ ] Define exact versioned Worker/Manager configurations and topology.
- [ ] Validate topology ownership, cycles, roles, tools, capacity, and routes.
- [ ] Unlock a second Worker only after basic operation is understood.
- [ ] Execute parallel independent jobs with deterministic queue order.
- [ ] Give each Worker exact separate Context and Trace.
- [ ] Create shared-gate feeding/maintenance coordination failure.
- [ ] Trace both locally reasonable Worker chains to the world incident.
- [ ] Implement Worker specialization, eligibility, tool/capability requirements,
  lower relevant context, and dependency/handoff risks.
- [ ] Add fleet workload/context pressure projections.

### Manager Agent

- [ ] Create demand for a Manager before making it available.
- [ ] Implement Manager topology activation and exact versioning.
- [ ] Implement explicit authority over Workers, job classes, resources,
  commands, messages, escalation, deployment limits, and response calls.
- [ ] Reject and trace out-of-authority actions.
- [ ] Implement explicit deterministic priorities and conflict handling.
- [ ] Implement delegation eligibility, Worker selection, limits, prerequisites,
  exact artifact pinning, deadlines, and failure behavior.
- [ ] Route only explicitly configured Task, instruction, state, memory, and
  messages.
- [ ] Implement structured message/report identity, provenance, context cost,
  delivery state, and retention.
- [ ] Implement routine aggregation, exception thresholds, cadence, required
  evidence, and recipients.
- [ ] Implement omission, delay, delivery failure, and overflow consequences.
- [ ] Implement explicit escalation target, urgency, authority, evidence,
  expected response, and fallback.
- [ ] Require observable structured success evidence.
- [ ] Prove a vague “keep things running” configuration cannot magically solve
  coordination.
- [ ] Implement complete Manager → Worker → Context → action → report → outcome
  trace.
- [ ] Implement explicit Worker/Manager authority to call Incident Response.

### Orchestration presentation and curriculum

- [ ] Add fleet semantic zoom and routine-cue suppression.
- [ ] Add Manager configuration and diagnostics surfaces.
- [ ] Show assignment gaps, authority violations, missing routes, shared-resource
  conflicts, report omissions, message overflow, stale shared state, and
  conflicting priorities.
- [ ] Add parallel Worker, shared conflict, specialization, vague Manager,
  explicit Manager, report omission, escalation, and transfer scenarios.
- [ ] Add a calm mature-park mastery scenario with meaningful exception-only
  attention.

### Orchestration validation gate

- [ ] Add topology, authority, priority, delegation, routing, messaging,
  reporting, escalation, and success-evidence tests.
- [ ] Add mature-fleet density and performance fixtures.
- [ ] Verify deterministic cross-Agent replay.
- [ ] Verify keyboard Manager configuration and causal drill-down.
- [ ] Verify no hidden Manager context, authority, or competence.
- [ ] Run full validation and browser computer-use scenarios.

---

## Phase 10 - Expansion, Failure, Suspension, and Comeback

**Sequential gate:** Economy, Incident Response, Review/Deployment, Persistence,
and Orchestration full contracts are stable.

### Economy and progression expansion

- [ ] Define versioned progression prerequisites and unlock graph.
- [ ] Keep unlock availability separate from intentional purchase/acceptance.
- [ ] Add additional robots, tools, Agent capabilities, context capacity,
  Retention Policies, memory, eval, orchestration, and response authority costs.
- [ ] Add intentional permanent species, enclosure, and park-area expansion.
- [ ] Preview every permanent responsibility before acceptance.
- [ ] Add bounded optional contracts with explicit temporary constraints.
- [ ] Add additional decorations, signage, robot cosmetics, merchandise, and
  memorabilia without large compounding bonuses.
- [ ] Tune rating, demand, incident, response, recovery, and day-duration values
  only from prototypes and playtest evidence.
- [ ] Preserve stable mastered systems while accepted scope adds new pressure.

### Operating License Suspension and recovery

- [ ] Define exact versioned catastrophic casualty, repeated unresolved safety,
  and financial-collapse suspension rules.
- [ ] Stop visitor operation and revenue on suspension.
- [ ] Stabilize active danger through explicit Incident Response actions.
- [ ] Preserve layout, world, unlocks, exact artifacts, evals, traces, reviews,
  deployments, history, rewards, and Handbook state.
- [ ] Present recovery review with exact associated incidents and deployments.
- [ ] Require revision or revert of responsible engineering.
- [ ] Require exact mandated safety eval passes.
- [ ] Require intentional compliant reopening deployment.
- [ ] Add restricted recovery funds usable only for stabilization, mandated
  evals, and compliant deployment.
- [ ] Add explicit debt, rating cap, or temporary restrictions where used.
- [ ] Prevent an unrecoverable primary save.
- [ ] Reopen with reduced rating/demand and explicit restrictions.
- [ ] Restore trust through demonstrated safe operation, never waiting alone.
- [ ] Keep permanent bankruptcy/revocation limited to future optional modes.

### Recovery validation gate

- [ ] Test every suspension trigger and false-positive boundary.
- [ ] Test complete preservation across suspension save/reload.
- [ ] Test insufficient-funds recovery and restricted-spending rejection.
- [ ] Test failed mandatory eval and noncompliant deployment.
- [ ] Test successful reopening and evidence-based trust restoration.
- [ ] Test rescue economics so avoidable death is never cheaper once lives are
  at risk.
- [ ] Verify non-exploitative casualty presentation and exact causal evidence.
- [ ] Complete suspension/recovery through browser computer use.

---

## Phase 11 - Full Campaign and Curriculum Content

**Sequential gate:** All owning mechanics used by an arc are stable before that
arc is authored as production content. Asset briefs and approved bundles precede
each visual slice.

### Campaign package and validation

- [ ] Finalize versioned curriculum packages, arcs, scenarios, unlock graphs,
  exact mechanics, assets, copy IDs, Handbook entries, and fingerprints.
- [ ] Validate no arbitrary code, unreachable unlock, circular arc, missing
  dependency, missing asset, missing accessibility equivalent, or unsupported
  mechanic.
- [ ] Run every scenario as an exact golden fixture.
- [ ] Keep localization-ready stable copy IDs and layout-independent text.

### Required learning arcs

- [ ] Complete Prompt selection, inspection, comparison, and transfer arc.
- [ ] Complete reusable Skill and System Prompt/Policy modularization arc.
- [ ] Complete visible Context composition and missing-route arc.
- [ ] Complete explicit Tool capability and evidence-quality arc.
- [ ] Complete context-bloat and Context Profiler arc.
- [ ] Complete Strict, Keep Newest, Priority, compaction, and retrieval arc.
- [ ] Complete versioned Memory, staleness, conflict, and retrieval arc.
- [ ] Complete Eval authoring, selection, suite, coverage-gap, and regression arc.
- [ ] Complete code-review-like diff, evidence, deployment, and revert arc.
- [ ] Complete multiple Worker, specialization, shared-resource, and handoff arc.
- [ ] Complete Manager authority, routing, reporting, and escalation arc.
- [ ] Complete Incident Response stabilization-versus-fix arc.
- [ ] Complete suspension and active comeback arc.
- [ ] Complete mature semantic-zoom and attention-management arc.
- [ ] Add at least one novel transfer case for every major concept.
- [ ] Add a stable mastery period after each major pressure/engineering cycle.
- [ ] Offer optional expansion rather than silently increasing permanent scope.

### Content tone and accessibility

- [ ] Use canonical AI-engineering terms consistently.
- [ ] Keep ordinary park language approachable.
- [ ] Keep detailed evidence optional and concise operational explanation primary.
- [ ] Deliver humor through motion, timing, juxtaposition, environment, and brief
  optional text.
- [ ] Never make individual casualties the punchline.
- [ ] Ensure every required cue/action has a persistent accessible equivalent.
- [ ] Ensure guidance is action-skippable and accommodations never reduce reward.
- [ ] Ensure Handbook material remains outside Agent Context.

---

## Phase 12 - Telemetry and Playtesting

Owning documents:
`Specs/telemetry-playtesting_PRD.md` and
`Specs/telemetry-playtesting_PLAN.md`.

### Privacy-first instrumentation

- [ ] Implement a disabled-by-default typed semantic event recorder.
- [ ] Ensure no domain package depends on Telemetry.
- [ ] Define versioned study configurations and event allowlists.
- [ ] Implement accessible explicit consent, decline, renewal, revocation, and
  visible capture status.
- [ ] Ensure declining has no gameplay/reward penalty.
- [ ] Require renewed consent after study configuration changes.
- [ ] Record only pseudonymous study/session IDs and meaningful bounded events.
- [ ] Prohibit authored text, freeform user text, raw keys, raw pointer paths,
  audio, video, screenshots, secrets, full saves, raw traces, and hidden
  reasoning.
- [ ] Implement strict runtime privacy filtering before storage/export.
- [ ] Store consented research events in a separate bounded local IndexedDB log.
- [ ] Report retention overflow or aggregation explicitly.
- [ ] Implement explicit sanitized export and local deletion.
- [ ] Keep remote upload out of the baseline.
- [ ] Prove recording on/off produces identical simulation and rewards.

### Study protocols

- [ ] Write and dry-run first-look comprehension protocol.
- [ ] Write and dry-run the approximately five-minute opening protocol.
- [ ] Write and dry-run Context Capacity/Retention understanding protocol.
- [ ] Write and dry-run novel transfer protocol.
- [ ] Write and dry-run Incident Response stabilization-versus-fix protocol.
- [ ] Write and dry-run mature-density navigation protocol.
- [ ] Write and dry-run stable-mastery and voluntary-continuation protocol.
- [ ] Recruit developers with low and high Agent experience.
- [ ] Recruit management-sim and non-management-sim players.
- [ ] Recruit participants using relevant accessibility features.
- [ ] Define facilitator boundaries, assistance rules, observable outcomes,
  qualitative notes, and stop/safety criteria.
- [ ] Separate observed behavior, participant statements, and researcher inference.
- [ ] Report study/content versions, sample size, missing data, accessibility
  context, caveats, and small-cohort limitations.
- [ ] Establish numeric thresholds only after baseline data, except the existing
  provisional opening target.

### Playtest findings integration

- [ ] Link every finding to its owning feature/scenario requirement.
- [ ] Update specifications when evidence changes a product decision.
- [ ] Retune day length, incident frequency, economy, response timing, recovery,
  density, cue suppression, and accessibility thresholds from evidence.
- [ ] Rerun affected regression, transfer, accessibility, and mastery protocols.
- [ ] Preserve prior study versions and rationale for changed thresholds.

---

## Phase 13 - Cross-Platform, Accessibility, Performance, and Release Hardening

### Cross-platform and browser matrix

- [ ] Run clean `npm install` from the committed lockfile on Windows.
- [ ] Run clean `npm install` from the committed lockfile on macOS.
- [ ] Run typecheck, lint, architecture lint, tests, build, asset compilation,
  and validation on both operating systems.
- [ ] Check case-sensitive imports and portable path/file-name rules.
- [ ] Test static output at root and non-root base paths.
- [ ] Test Chrome/Edge, Firefox, and Safari/WebKit supported desktop paths.
- [ ] Verify WebGL unavailable/degraded behavior is actionable.
- [ ] Verify offline startup and service-worker update behavior in supported
  browsers.
- [ ] Verify portable save export/import between Windows and macOS.

### Accessibility completion

- [ ] Audit every critical action for keyboard operation and visible focus.
- [ ] Audit canvas entities against synchronized semantic DOM equivalents.
- [ ] Audit color, sound, animation, transient timing, hover, precision, and
  rapid-response dependencies.
- [ ] Audit production, pause, eval, and replay distinction without color.
- [ ] Audit text scaling/reflow across Park, Inspector, Workbench, Eval, Replay,
  Review, deployment, suspension, settings, and consent.
- [ ] Audit reduced motion, screen shake, flashing, contrast, and sound
  substitution for semantic equivalence.
- [ ] Audit announcements and transient cues in persistent event history.
- [ ] Run automated axe checks while recognizing their limitations.
- [ ] Complete manual screen-reader, keyboard-only, low-vision, hearing-
  substitution, motor, cognitive-load, and motion-sensitivity testing.

### Performance and reliability

- [ ] Establish measured budgets for startup, asset bundles, texture memory,
  frame time, simulation tick, context assembly, trace seeking, eval batches,
  save/load, and mature fleet density.
- [ ] Profile Pixi batching, blend modes, masks, filters, atlas use, and draw calls.
- [ ] Profile React rendering and selector/projection update frequency.
- [ ] Move eval batches or simulation work to Web Workers only where measurement
  justifies it.
- [ ] Keep worker messages deterministic and structured-clone compatible.
- [ ] Test long sessions, accelerated time, long traces, large memory stores,
  mature incidents, and save quota boundaries.
- [ ] Test optional feature, asset, content, storage, worker, audio, renderer,
  and service-worker failures.
- [ ] Confirm every failure has a stable code, scope, and recovery action.

### Architecture and security

- [ ] Enforce public package boundaries for every domain.
- [ ] Enforce UI projection/command-only access.
- [ ] Reject arbitrary executable imported/authored content.
- [ ] Reject runtime model imports and API secrets.
- [ ] Reject prohibited trace and telemetry fields.
- [ ] Validate all dynamic, generated, saved, and imported data at boundaries.
- [ ] Confirm exact version pinning through jobs, evals, traces, reviews,
  deployments, saves, replays, and recovery.
- [ ] Confirm no silent context truncation or hidden capacity.
- [ ] Confirm eval and production use the same domain rules.

### Documentation and release readiness

- [ ] Add implementation notes/checklists under `Docs/` for every completed
  feature where operational guidance is needed.
- [ ] Keep every PRD's dependencies, decisions, tests, modules, and workflows
  aligned with implementation.
- [ ] Remove or archive ephemeral PLAN files only according to repository policy
  after their work is fully implemented and captured elsewhere.
- [ ] Document local development, production build, static hosting, offline
  update, save recovery, asset generation/import/review, and playtest workflows.
- [ ] Document supported browsers, operating systems, known limitations, privacy,
  and accessibility features.
- [ ] Review third-party licenses and generated-asset provenance for release.
- [ ] Verify production bundles contain no unapproved candidates, placeholders,
  secrets, source prompts not intended to ship, test fixtures, or debug tools.
- [ ] Perform a complete final diff and repository audit.
- [ ] Run `npm run validate` successfully from a clean checkout.
- [ ] Complete the full critical-path browser computer-use test suite.

---

## Phase 14 - Definition of Fully Implemented

The game is fully implemented only when all of the following are `[x]`:

- [ ] Every functional and testable non-functional requirement in every feature
  PRD has a corresponding implementation and meaningful verification.
- [ ] Every application invariant and MVP acceptance criterion is demonstrably
  preserved.
- [ ] Every post-MVP full-vision system listed in the application PRD is present
  or explicitly re-scoped through an approved specification change.
- [ ] The complete campaign teaches Prompts → Skills/System Prompts → Context →
  Tools → Memory → Evals/Review → Agents → Orchestration through play.
- [ ] The ideal mature park can operate calmly with reliable routine automation,
  efficient context, regression protection, explicit Manager governance, and
  meaningful exception-only player attention.
- [ ] The player can suffer serious deterministic consequences, use external
  response, enter suspension, actively recover, and continue the same park.
- [ ] Core play, save, eval, replay, and progression work offline without an
  account, backend, secret, or runtime LLM/model.
- [ ] Windows and macOS development and the supported browser matrix pass.
- [ ] Accessibility alternatives preserve state, urgency, location, provenance,
  context pressure, consequences, and actions.
- [ ] Playtesting demonstrates opening comprehension, technical credibility,
  concept transfer, retention understanding, recovery understanding, mature
  readability, and desire to continue.
- [ ] All automated validation and required browser computer-use verification
  pass from a clean release candidate.
