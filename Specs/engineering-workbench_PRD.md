# Engineering Asset Workbench - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`platform-foundation`, `content-registry`, `context-memory`, `economy-progression`, and `review-deployment` supply UI, exact asset data/context estimates, capability unlocks, commission transactions, and proposal intake.

### Downstream Dependencies

`curriculum-content` supplies commission recipes and unlock timing; other views deep-link to asset details.

## Executive Summary

The Engineering Workbench is the AI Workshop library and commissioning surface for Prompts, Skills, System Prompts, Knowledge, Tool Descriptions, and Memory configuration. Libraries lead with canonical artifact type, approachable title, version, deployment state, Context cost, and Eval coverage. Players progressively inspect worked source text, dependencies, semantic behavior, Tools, applicability, history, and used-by relationships as evidence. The single Park Developer progression mechanism creates authored changes from content-defined recipes; MVP does not offer arbitrary text/code execution or a developer hiring game.

## User Stories

- **GIVEN** an artifact, **WHEN** opened, **THEN** the player can understand its source, clauses, cost, requirements, status, versions, coverage, and consumers.
- **GIVEN** duplicated feeding instructions, **WHEN** Skill Design is unlocked, **THEN** the player can commission a reusable Skill proposal with explicit cost and expected impact.
- **GIVEN** a commission requiring a locked capability or unaffordable cost, **WHEN** attempted, **THEN** the workbench explains the prerequisite and performs no partial transaction.
- **GIVEN** a commissioned proposal, **WHEN** complete, **THEN** it enters Review rather than production.

## Functional Requirements

### FR-01: Asset Library and Detail
- FR-01.1: List/filter by type, title, tag, status, capability, tool, and deployment state.
- FR-01.2: Detail SHALL show exact version, source text, Context Cost, dependencies, applicability tags, tools, clause summary, eval coverage, status, history, and used-by.
- FR-01.3: Source is default; semantic clauses are an advanced/debug view.
- FR-01.4: Historical immutable versions SHALL remain inspectable.
- FR-01.5: Library/detail SHALL present canonical type + human-readable title + version before exact ref; exact ref, raw clauses, and machine metadata belong in Technical Details.
- FR-01.6: Locked artifact categories/capabilities SHALL not compete with current curriculum work, but direct links SHALL explain their prerequisite honestly.

### FR-02: Commission Catalog
- FR-02.1: Content-defined recipes SHALL state output artifact type/title/version intent, goal, capability requirement, credit cost, prerequisites, expected source/clause/dependency changes, and unlock conditions.
- FR-02.2: Available, locked, and completed recipes SHALL be distinguishable with reasons.
- FR-02.3: Confirming a recipe SHALL atomically charge credits and create one exact draft/proposal.
- FR-02.4: Repeat confirmation/retry SHALL not duplicate charges or proposals.

### FR-03: Park Developer Capabilities
- FR-03.1: Surface Prompt, Skill, Context, Tool, Eval, Memory, and Agent Orchestration capability levels/unlocks.
- FR-03.2: This feature consumes capability state but SHALL not calculate purchases/unlocks.
- FR-03.3: There SHALL be one workbench/developer mechanism, no roster, candidates, salaries, personalities, or team management.

### FR-04: Structured MVP Composition
- FR-04.1: MVP proposals come from authored recipes and structured selections; players SHALL not execute arbitrary prose.
- FR-04.2: Any allowed structured choice SHALL resolve to pre-authored source and semantic clauses together.
- FR-04.3: Every valid proposal SHALL be registry-valid and enter `REVIEW` workflow state, never auto-deploy.

## Non-Functional Requirements

- **NFR-01: Learnability** - Source and architecture impact are readable without requiring raw JSON.
- **NFR-05: Information Hierarchy** - Commission goal and expected operational impact precede registry metadata; no ordinary choice requires interpreting a raw id.
- **NFR-02: Accessibility** - Library/detail/commission flows are fully keyboard navigable; source is selectable.
- **NFR-03: Transaction Safety** - Charge and proposal creation are atomic/idempotent.
- **NFR-04: Isolation** - Workbench never mutates deployed artifact content.

## Invariants

- **INV-01:** A commission creates a new version/proposal; it never edits history.
- **INV-02:** Source and clauses remain a validated pair.
- **INV-03:** No commissioned change bypasses Review.
- **INV-04:** There is exactly one conceptual Park Developer/workbench in MVP.

## Out of Scope

Freeform prompt parsing/editing, developer staffing, diff/eval/deploy workflow, capability economy logic, runtime execution, and remote/community assets.

## Product Decisions

- **PD-01:** The player practices recognition, architecture, and engineering decisions rather than typing 4,000-token artifacts.
- **PD-02:** Workbench capabilities unlock only after felt need.
- **PD-03:** Context cost and dependency impact are first-class on every detail/proposal.
- **PD-04:** `SKILL · Carnivore Feeding · v3` is the model for artifact presentation: canonical type and approachable instance are both explicit.

## Implementation Decisions

- **IMP-01:** Commission recipes are content records and produce registry-valid exact artifact versions.
- **IMP-02:** Review intake is an injected command port; no direct review-store import.
- **IMP-03:** Context estimates call the Context Service; the workbench does not reimplement CU.

## Testing Decisions

- **TST-01:** Contract tests cover every artifact type’s detail projection.
- **TST-02:** Locked/unaffordable/idempotent commission cases prove no partial writes.
- **TST-03:** Test that generated proposal refs/source/clauses match authored recipe exactly.

## Proposed Modules

- **MOD-01: AssetCatalog** - Joins registry/context/coverage/history into stable view models.
- **MOD-02: CommissionService** - Validates recipe, capability, transaction, proposal, and review intake atomically.
- **MOD-03: EngineeringWorkbenchUI** - Library, detail, capability, and commission flows.

## Workflows

### Workflow 1: Inspect Skill
```text
Filter Skills -> open Carnivore Feeding v3 -> read source -> inspect 1.7k composition, dependencies/tools/tags -> view clauses/coverage/used-by -> open exact review/history link.
```

### Workflow 2: Commission Safer Skill
```text
Open unlocked recipe -> review goal/cost/prerequisites/impact -> confirm -> atomic charge and new proposal -> proposal validates -> review record opens -> deployed v3 remains unchanged.
```
