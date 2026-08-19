# Review and Deployment - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Engineering Workbench | Supplies immutable candidate versions, goals, and semantic diffs. |
| 2 | Eval Runner | Supplies exact selected cases, results, traces, and comparisons. |
| 3 | Content Registry | Resolves exact candidate/base/dependency manifests. |
| 4 | Player Experience | Supplies focused-mode framing and causal navigation. |

### Downstream Dependencies

Park Operations pins production jobs from deployments. Economy may price work
and recovery. Incident Response and license recovery link responsible versions.
Persistence saves review/deployment history. Curriculum Content teaches the loop.

## Executive Summary

Review and Deployment is the intentional governance gate between authored work
and production. It combines readable and behavioral diffs, context and
dependency deltas, selected risks, executed eval evidence, diagnosis links, and
the player's decision. Deployment pins an exact reviewed version and resolved
dependencies for future jobs. Revert is a new explicit deployment record, never
history rewriting.

## User Stories

### Review Evidence

- **GIVEN** a Park Developer candidate, **WHEN** review opens, **THEN** the player
  sees goal, author, base/candidate versions, readable/behavioral diff, context
  delta, dependency delta, expected effect, risks, and eval choices/results.
  - **Acceptance Criteria:** All values derive from exact registered records.
- **GIVEN** insufficient or failed evidence, **WHEN** deciding, **THEN** the
  player can run more evals, request changes, retain production, or accept risk
  explicitly.
  - **Acceptance Criteria:** Merely opening or completing review changes nothing.

### Deploy and Revert

- **GIVEN** an exact candidate, **WHEN** deployed, **THEN** a deployment record
  pins its resolved manifest for future matching production jobs.
  - **Acceptance Criteria:** Existing jobs and history retain prior versions.
- **GIVEN** a bad deployment, **WHEN** reverted, **THEN** a new deployment record
  intentionally selects an exact historical version.
  - **Acceptance Criteria:** The bad record and all associated evidence remain.

## Functional Requirements

### FR-01: Change Requests

- FR-01.1: A change request SHALL record stable ID, status, author, goal, owning
  artifact, exact base/candidate versions, created/completed ticks, and Workbench
  links.
- FR-01.2: It SHALL preserve readable diff, behavioral clause diff, context
  delta, dependency delta, required-tool delta, known tradeoffs, expected effect,
  and evidence-backed risk areas.
- FR-01.3: Candidate or base mutation SHALL invalidate review rather than
  silently refresh it.

### FR-02: Eval Selection and Evidence

- FR-02.1: Review SHALL expose authored cases/suites, prior relevant evidence,
  selected risks, estimated run cost, and exact selected case versions.
- FR-02.2: Review SHALL attach immutable Eval Runner results and diagnosis/replay
  links.
- FR-02.3: Failed, invalid, interrupted, omitted, and passed evidence SHALL
  remain distinguishable.
- FR-02.4: The application SHALL not invent a confidence or approval score.

### FR-03: Review Decisions

- FR-03.1: Decisions SHALL include request changes, retain current production,
  deploy candidate, deploy another reviewed exact version where allowed, and
  revert through deployment.
- FR-03.2: A decision SHALL record exact evidence considered, player action,
  stated structured rationale selection/note where offered, and tick/time.
- FR-03.3: Request changes SHALL create linked Workbench feedback and preserve
  the reviewed candidate.
- FR-03.4: Deployment eligibility rules SHALL be explicit, including mandatory
  evals for recovery or authored safety governance.

### FR-04: Deployment

- FR-04.1: A deployment SHALL record stable ID, production slot/scope, exact root
  artifact version, resolved dependency manifest/fingerprint, source review,
  prior deployment, actor, and effective tick.
- FR-04.2: New jobs SHALL resolve the active deployment at job pinning and retain
  it thereafter.
- FR-04.3: Authoring, review, eval, or catalog publication SHALL not change
  active production.
- FR-04.4: Activation SHALL be atomic; unresolved dependencies or invalid review
  evidence SHALL prevent deployment.

### FR-05: Revert and History

- FR-05.1: Revert SHALL create a new deployment selecting an exact historical
  reviewed manifest.
- FR-05.2: Deployment history SHALL preserve chronological and causal links,
  associated jobs, incidents, evals, reviews, and later reverts.
- FR-05.3: Historical inspection/replay SHALL resolve exact versions or block
  explicitly.
- FR-05.4: Reopening deployment SHALL support mandated recovery evidence without
  erasing the suspension-causing deployment.

## Non-Functional Requirements

- **NFR-01: Intentionality** - Production changes require a clear explicit final
  action with exact version/scope.
- **NFR-02: Historical integrity** - Reviews and deployments are immutable
  auditable records.
- **NFR-03: Accessibility** - Diffs, evidence, decisions, and confirmations are
  keyboard operable and non-color-redundant.
- **NFR-04: Reliability** - Deployment is atomic and fails closed on unresolved
  exact content.

## Invariants

- **INV-01:** Candidate creation never changes production.
- **INV-02:** Deployment always pins exact versions and dependencies.
- **INV-03:** Historical jobs never float after deployment changes.
- **INV-04:** Revert creates history; it does not rewrite history.
- **INV-05:** Eval evidence is executed, not fabricated.

## Out of Scope

- Authoring artifacts or running case internals.
- Automatically approving “good enough” changes.
- Continuous deployment without player intent.
- Git hosting or real software repository integration.

## Product Decisions

- **PD-01: Code-review-like core loop** - Familiar discipline supports transfer.
- **PD-02: Risk-based evidence** - Players decide what to test under constraints.
- **PD-03: Explicit production boundary** - Safe experimentation remains separate
  from consequential operation.

## Implementation Decisions

- **IMP-01:** Store immutable review and deployment records with exact manifest
  fingerprints.
- **IMP-02:** Use domain-owned semantic diff inputs; Review composes but does not
  reimplement clause/context/dependency analysis.
- **IMP-03:** Resolve active deployment through a small slot/scope registry;
  Park Operations receives immutable pin results.
- **IMP-04:** Expose only `src/review-deployment/public.ts`.

## Testing Decisions

- **TST-01:** Tests cover every decision, invalid transition, mandatory evidence,
  and immutable feedback link.
- **TST-02:** Version-pinning tests create jobs before/after deploy and revert.
- **TST-03:** Atomicity tests cover missing dependency, stale review, duplicate
  activation, and partial failure.
- **TST-04:** Rendered tests cover long diffs, failed/omitted evidence, exact
  confirmation, keyboard flow, and non-color changes.

## Proposed Modules

- **MOD-01: Change Request Projector** - Combines exact candidate, diffs, deltas,
  effects, and risks.
- **MOD-02: Evidence Binder** - Attaches immutable exact eval selections/results
  and diagnosis links.
- **MOD-03: Review Service** - Validates and records player decisions/feedback.
- **MOD-04: Deployment Registry** - Atomically pins active exact manifests by
  production slot/scope.
- **MOD-05: Governance History** - Queries causal review/deployment/revert/job/
  incident history.

## Workflows

### Workflow 1: Review and Deploy

```text
1. Open an immutable change request from Workbench.
2. Inspect goal, source/behavior diff, context/dependency deltas, and risks.
3. Select and run exact eval cases or inspect attached results.
4. Diagnose failures and revise, request changes, retain, or proceed.
5. Confirm exact candidate, dependencies, production scope, and evidence.
6. Atomically create the deployment record.
7. Future matching jobs pin the new manifest; existing jobs remain unchanged.
```

### Workflow 2: Revert

```text
1. Follow a production incident to its deployment.
2. Select a compatible reviewed historical manifest.
3. Inspect intervening dependencies and relevant evidence.
4. Confirm a new revert deployment.
5. Preserve both the failed deployment and the revert in history.
```
