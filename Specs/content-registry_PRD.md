# Versioned Content Registry - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | `simulation-core` | Supplies world-fixture and entity-profile schema contracts. |

### Downstream Dependencies

`instruction-engine`, `context-memory`, `eval-runner`, `engineering-workbench`, `review-deployment`, `economy-progression`, `curriculum-content`, and `persistence` resolve authored/versioned records through this feature.

## Executive Summary

The Content Registry is the single source of truth for data-driven Prompts, Skills, System Prompts, Knowledge, Tool Descriptions, eval definitions, scenarios, dinosaur profiles, and progression content. It validates dependencies and compatibility, preserves immutable historical versions, separates stable identity from versions, and lets designers add content without changing simulation or UI code.

## User Stories

- **GIVEN** a deployed Skill version, **WHEN** a newer version is created, **THEN** historical jobs still resolve the exact old version while new work can select the new one.
- **GIVEN** invalid content, **WHEN** it is loaded, **THEN** authors receive precise field paths and stable diagnostic codes before gameplay begins.
- **GIVEN** a Skill and job, **WHEN** the UI asks about compatibility, **THEN** tags, dependencies, required tools, status, and used-by relationships are consistently available.

## Functional Requirements

### FR-01: Versioned Records
- FR-01.1: Implement `ArtifactVersion` exactly as the application PRD baseline, with immutable `(artifactId, version)` identity.
- FR-01.2: Support types `PROMPT`, `SKILL`, `SYSTEM_PROMPT`, `KNOWLEDGE`, and `TOOL_DESCRIPTION`.
- FR-01.3: Support `DRAFT`, `REVIEW`, `DEPLOYED`, and `RETIRED` lifecycle states while preserving all pinned versions.
- FR-01.4: The registry SHALL expose exact lookup and explicitly selected-current lookup; it SHALL never silently substitute a newer version.
- FR-01.5: Authored eval definitions SHALL contain immutable case fields and a default unbuilt catalog state; player-owned built status, suites, and run history belong exclusively to `eval-runner` state and SHALL not be mutated in content records.

### FR-02: Validation
- FR-02.1: Validate schemas, unique ids, positive versions/costs, references, allowed clause categories, tags, and tool ids.
- FR-02.2: Artifact dependency graphs SHALL reject cycles and report the full cycle.
- FR-02.3: Missing required dependencies/tools SHALL be errors; applicability mismatch SHALL be queryable metadata rather than a load error.
- FR-02.4: Human-readable source text and semantic clauses SHALL both be required for actionable artifacts.

### FR-03: Query and Relationship Index
- FR-03.1: Query by exact ref, type, tag, lifecycle status, title, required tool, and dependency.
- FR-03.2: Expose direct and transitive dependencies plus `usedBy` references.
- FR-03.3: Return records in stable id/version order.

### FR-04: Data-Driven Packs
- FR-04.1: Load content packs from documented data files without UI edits.
- FR-04.2: Packs SHALL declare schema version and unique pack id.
- FR-04.3: Pack loading SHALL be atomic: any error prevents partial registration.
- FR-04.4: Registry exports SHALL be canonically serializable for saves and replay manifests.

## Non-Functional Requirements

- **NFR-01: Diagnostics** - Every validation error includes code, pack, record id/ref, field path, and actionable message.
- **NFR-02: Determinism** - Queries and dependency traversal are stable across runs.
- **NFR-03: Extensibility** - New authored content instances do not require engine changes; new schema kinds require explicit migrations.
- **NFR-04: Independence** - The core registry is headless and has no route/UI dependency.

## Invariants

- **INV-01:** Published artifact version content is immutable.
- **INV-02:** Exact refs never float to latest.
- **INV-03:** No circular artifact dependency can enter the registry.
- **INV-04:** Failed pack loading has no observable partial result.
- **INV-05:** Display text never drives behavior; clauses do.

## Out of Scope

Editing UI, diff/review/deploy decisions, job execution, context calculation, eval execution, runtime persistence, remote content delivery, and user-generated content.

## Product Decisions

- **PD-01:** All MVP content is authored and local.
- **PD-02:** Version history and used-by data are visible product concepts.
- **PD-03:** Generic AI terminology is used; vendor-specific skill formats are not required.

## Implementation Decisions

- **IMP-01:** Runtime validation occurs at the content boundary even when static typing is present.
- **IMP-02:** Artifact refs always contain both id and version.
- **IMP-03:** Lifecycle transitions are requested by review/deployment; the registry enforces legal transitions but does not decide them.

## Testing Decisions

- **TST-01:** Contract fixtures cover every record and clause category.
- **TST-02:** Negative fixtures cover cycles, missing refs/tools, duplicate refs, malformed source/clauses, and atomic rollback.
- **TST-03:** Snapshot tests cover canonical indexes and manifests, not UI rendering.

## Proposed Modules

- **MOD-01: ContentRegistry** - Loads packs and exposes small exact/query APIs.
- **MOD-02: ContentValidator** - Owns schemas and diagnostics.
- **MOD-03: DependencyIndex** - Computes stable dependencies, cycles, and used-by.
- **MOD-04: ContentManifest** - Produces replay/save-friendly canonical manifests.

## Workflows

### Workflow 1: Load Pack
```text
1. Parse a versioned content pack.
2. Validate all records and external references.
3. Build dependency and relationship indexes.
4. Commit all records atomically or return diagnostics without changing the registry.
```

### Workflow 2: Resolve Historical Job
```text
1. Caller supplies exact Prompt and Skill refs from the job.
2. Registry resolves those immutable versions and transitive dependencies.
3. Missing exact history is an explicit error; latest is never substituted.
```
