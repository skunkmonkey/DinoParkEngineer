# Review, Evaluation, and Deployment - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`content-registry`, `context-memory`, `eval-runner`, `economy-progression`, and `platform-foundation` supply exact content, context delta, eval runs, state, and UI. Proposal intake is a public boundary and can be exercised with fixtures before the Workbench is present.

### Downstream Dependencies

`engineering-workbench` submits proposals; `instruction-engine` and operations resolve active exact versions; `persistence`, `telemetry`, and `curriculum-content` retain/observe workflow history.

## Executive Summary

Review is the game's central engineering workflow and the convergence point of the AI Workshop: understand the operational goal and expected park impact, inspect a clearly named proposed artifact/configuration change, compare source/Context/dependencies, choose/build/run named Evals, diagnose failures, request revision, and intentionally deploy or revert. Exact refs and semantic evidence remain available without becoming the primary labels. Risk warnings inform rather than universally block; impossible configurations and authored hard gates cannot deploy.

## User Stories

- **GIVEN** a Skill proposal, **WHEN** reviewing it, **THEN** the player sees goal, author, exact old/new refs, source and clause diff, Context delta, dependencies, tools, risk/coverage, and eval selection/results.
- **GIVEN** an eval failure, **WHEN** inspected, **THEN** expected/observed/evidence and replay are available before the player revises or accepts risk.
- **GIVEN** uncovered risk but valid configuration, **WHEN** deploying, **THEN** the player receives a specific warning and may explicitly proceed unless a content-defined hard gate applies.
- **GIVEN** a bad deployment, **WHEN** reverting, **THEN** a new deployment record restores a prior exact version without deleting history.

## Functional Requirements

### FR-01: Review Records and States
- FR-01.1: Store immutable change intent plus exact base/proposed refs, author, goal, created game time, affected dependencies/consumers, and state.
- FR-01.2: States SHALL be `PENDING`, `EVALS_RUNNING`, `CHANGES_REQUESTED`, `READY`, `DEPLOYED`, `CLOSED`, with validated transitions.
- FR-01.3: Concurrent/stale actions SHALL fail with a visible conflict; no last-write-wins.

### FR-02: Diff and Impact
- FR-02.1: Source diff is default; semantic clause diff is switchable.
- FR-02.2: Show added/removed/changed dependencies, tools, tags, and direct/transitive used-by.
- FR-02.3: Context delta SHALL be computed by Context Service for representative authored job profiles and reconcile its totals.
- FR-02.4: No-change and missing-base cases SHALL be explicit.
- FR-02.5: Review header SHALL lead with canonical artifact/configuration type, human-readable title, base/proposed versions, goal, and operational impact before exact refs.

### FR-03: Eval Workflow
- FR-03.1: Show individual available eval behavior/build/run cost/risk/last result.
- FR-03.2: Allow suite and individual selection, building through Eval Service, run cost confirmation, and run initiation.
- FR-03.3: Associate results with exact proposed ref/review revision; stale results SHALL not count after proposal revision.
- FR-03.4: Failed results link to assertions, trace, replay, and relevant diff/context.
- FR-03.5: Eval selection/results SHALL use human-readable scenario titles and expected/observed behavior before exact case refs and evidence.

### FR-04: Deploy and Revert
- FR-04.1: Validate exact dependencies, required tools, registry validity, context overflow for required profiles, and authored hard gates.
- FR-04.2: Present coverage/failure warnings and require explicit confirmation for permitted risk.
- FR-04.3: Deployment SHALL atomically change active exact ref(s), lifecycle state, and audit record at a safe boundary.
- FR-04.4: Running/historical jobs retain pinned refs; deployment affects only subsequently created/resolved work.
- FR-04.5: Revert SHALL create an auditable deployment pointing to a previous exact version.

### FR-05: Revision
- FR-05.1: Request Revision SHALL capture structured reason and return proposal to a content-defined revision recipe/workbench path.
- FR-05.2: A revised proposal SHALL create a new immutable review revision and invalidate stale eval applicability without deleting results.

## Non-Functional Requirements

- **NFR-01: Auditability** - Every transition includes game time, actor, expected prior state, and exact refs.
- **NFR-02: Atomicity** - Active deployment and audit/lifecycle updates commit together.
- **NFR-03: Accessibility** - Diff, eval selection, warnings, and actions are keyboard/screen-reader usable.
- **NFR-04: Integrity** - No route or consumer can bypass deployment commands to set active refs.
- **NFR-05: Comprehension** - A player can identify what is changing, why, and which named risks were tested without interpreting machine ids.

## Invariants

- **INV-01:** Deployed artifact versions are immutable and exactly referenced.
- **INV-02:** Old eval results never silently apply to a revised subject.
- **INV-03:** Deploy does not retarget running/historical jobs.
- **INV-04:** Revert preserves full history.
- **INV-05:** Invalid/impossible configurations cannot be force-deployed.

## Out of Scope

Arbitrary source editing, eval execution internals, artifact authoring recipes, simulation hot-patching, real Git/GitHub integration, and multiplayer approval.

## Product Decisions

- **PD-01:** Generally warn rather than hard-block risk to preserve consequence-based learning.
- **PD-02:** Missing tools/dependencies, required-profile overflow, invalid content, and authored tutorial safety gates hard-block.
- **PD-03:** Source is default because player learning matters; clauses remain inspectable.

## Implementation Decisions

- **IMP-01:** Active version mapping is owned by a deployment repository behind one command service.
- **IMP-02:** Diff operates on structured records and text; it never infers behavior from prose.
- **IMP-03:** Optimistic concurrency uses expected review/deployment version.

## Testing Decisions

- **TST-01:** State-machine tests cover every allowed/forbidden transition.
- **TST-02:** Deployment transaction tests inject failures at each write and prove atomicity.
- **TST-03:** Stale eval/review action/concurrent deploy cases are mandatory.

## Proposed Modules

- **MOD-01: ReviewService** - Owns records, transitions, revisions, and eval association.
- **MOD-02: ChangeAnalyzer** - Produces source/clause/dependency/tool/context impact.
- **MOD-03: DeploymentService** - Validates and atomically activates/reverts exact refs.
- **MOD-04: ReviewUI** - Converges diff, impact, eval selection/results, warnings, and actions.

## Workflows

### Workflow 1: Review and Deploy
```text
Open proposal -> inspect source/clause/context/dependency changes -> build/select evals -> confirm/run -> inspect results/replay -> validate deploy -> acknowledge warnings -> atomically activate exact version -> future jobs use it.
```

### Workflow 2: Request Revision
```text
Failed eval -> inspect expected vs observed and trace -> request revision with reason -> new proposal revision arrives -> old results remain historical/stale -> rerun selected evals -> deploy only new exact ref.
```
