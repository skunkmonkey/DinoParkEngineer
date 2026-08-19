# Content Registry - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Application Shell | Supplies configuration, diagnostics, and feature lifecycle. |

### Downstream Dependencies

Simulation fixtures, Instructions, Context, Memory, Evals, Workbench, Review and
Deployment, Persistence, Curriculum Content, and Rendering Assets resolve or
publish exact versioned content through this feature.

## Executive Summary

The Content Registry makes authored game content trustworthy and historical. It
validates content at entry, assigns stable identity, preserves immutable
versions, resolves exact dependencies, and refuses ambiguous or missing
references. It is the foundation that prevents a saved job, eval, incident, or
deployment from silently changing when newer content is added.

## User Stories

### Exact Resolution

- **GIVEN** a job or historical record references an exact artifact version,
  **WHEN** it is resolved, **THEN** the registry returns that version and its
  exact dependency graph.
  - **Acceptance Criteria:** Publishing a newer version does not alter prior
    resolution.
- **GIVEN** a required version or dependency is missing, **WHEN** content loads,
  **THEN** the application reports the precise unresolved reference and blocks
  affected behavior.
  - **Acceptance Criteria:** Current content is never silently substituted.

### Inspection and Validation

- **GIVEN** a registered artifact, **WHEN** the player inspects it through an
  owning surface, **THEN** identity, class, version, author, dependencies,
  context cost, source provenance, and availability are consistent.
  - **Acceptance Criteria:** Every surface derives these fields from the same
    registry record.
- **GIVEN** malformed imported or authored content, **WHEN** registration is
  attempted, **THEN** granular validation errors identify the affected file,
  record, field, and rule.
  - **Acceptance Criteria:** Invalid records never partially enter the
    authoritative catalog.

## Functional Requirements

### FR-01: Identity and Versions

- FR-01.1: Every content item SHALL have a stable namespaced ID, content class,
  immutable version ID, schema version, and provenance.
- FR-01.2: Artifact versions SHALL be append-only within a loaded catalog.
- FR-01.3: IDs and versions SHALL use a portable case-sensitive syntax.
- FR-01.4: Display names and readable source MAY change only through a new
  version when the item is historically addressable.

### FR-02: Validation

- FR-02.1: Dynamic, generated, imported, and saved content SHALL be validated
  at the registry boundary before use.
- FR-02.2: Validation SHALL reject unknown required fields, invalid enums,
  duplicate identities, unordered collections where order matters, impossible
  dependency constraints, and non-portable asset paths.
- FR-02.3: A catalog SHALL commit atomically after all records and dependencies
  validate.
- FR-02.4: Validation results SHALL be stably ordered and machine-readable.

### FR-03: Dependency Resolution

- FR-03.1: Dependencies SHALL name exact versions unless an authoring-only query
  explicitly asks for available candidates.
- FR-03.2: Resolution SHALL be deterministic and cycle-aware.
- FR-03.3: Resolved manifests SHALL include the root, ordered transitive
  dependencies, schema versions, and a deterministic fingerprint.
- FR-03.4: Missing, conflicting, cyclic, or incompatible dependencies SHALL
  block the affected resolution explicitly.

### FR-04: Catalog Queries

- FR-04.1: The registry SHALL provide read-only queries by exact identity,
  content class, tag, dependency, version history, and availability.
- FR-04.2: Query results SHALL use documented stable ordering.
- FR-04.3: Production resolution SHALL not expose a floating newest-version
  shortcut.
- FR-04.4: Historical content MAY be hidden from ordinary selection while
  remaining exactly resolvable for replay and inspection.

### FR-05: Packaging and Failure

- FR-05.1: Built-in content SHALL be packaged locally and require no network.
- FR-05.2: Catalog packages SHALL declare package ID, package version, compatible
  registry schema, content entries, and fingerprint.
- FR-05.3: Optional package failure SHALL be scoped and reported through the
  shell without invalidating unrelated packages.
- FR-05.4: Required base-package failure SHALL block affected startup with
  remediation details.

## Non-Functional Requirements

- **NFR-01: Determinism** - Validation, resolution, queries, and fingerprints
  are stable for identical inputs.
- **NFR-02: Historical integrity** - Existing versions cannot be mutated or
  floated by later registration.
- **NFR-03: Portability** - Catalogs validate identically on Windows and macOS.
- **NFR-04: Extensibility** - New content classes can register schemas without
  widening the core query API unnecessarily.

## Invariants

- **INV-01:** Exact historical references never float to current versions.
- **INV-02:** Invalid content never partially commits.
- **INV-03:** Human-readable prose is stored and exposed but never interpreted
  as executable behavior by the registry.
- **INV-04:** Registry queries are read-only and stably ordered.
- **INV-05:** Content identity is independent from display name and file path.

## Out of Scope

- Executing instruction clauses.
- Deciding deployment eligibility.
- Save-medium selection and migration orchestration.
- Rendering or transforming image pixels.

## Product Decisions

- **PD-01: Exact versions by default** - Reliability and replay outweigh the
  convenience of floating dependencies.
- **PD-02: Atomic catalogs** - A package is usable only when its complete
  validated dependency graph is coherent.

## Implementation Decisions

- **IMP-01:** Use Zod schemas with strict TypeScript inferred boundary types.
- **IMP-02:** Store canonical registry records as plain serializable data;
  executable functions never enter content packages.
- **IMP-03:** Produce deterministic fingerprints from canonical serialized
  manifests, not filesystem timestamps.
- **IMP-04:** Expose only `src/content-registry/public.ts` to downstream code.

## Testing Decisions

- **TST-01:** Golden fixtures assert exact valid manifests and error ordering.
- **TST-02:** Mutation tests prove new versions cannot change prior records.
- **TST-03:** Dependency tests cover missing, cyclic, conflicting, duplicated,
  incompatible, and deeply transitive graphs.
- **TST-04:** The same fixture set runs with Windows and POSIX-style path inputs
  and rejects non-portable content paths.

## Proposed Modules

- **MOD-01: Schema Catalog** - Registers content-class validators through a
  small class-to-schema contract.
- **MOD-02: Atomic Catalog Loader** - Parses complete packages and commits only
  validated catalogs.
- **MOD-03: Exact Resolver** - Produces ordered immutable dependency manifests.
- **MOD-04: Catalog Index** - Serves stable read-only discovery and history
  queries.
- **MOD-05: Canonical Fingerprinter** - Creates repeatable package and resolved
  manifest fingerprints.

## Workflows

### Workflow 1: Load Built-In Content

```text
1. Read a local package manifest.
2. Validate package metadata and every content record.
3. Resolve and validate the complete dependency graph.
4. Calculate canonical fingerprints.
5. Atomically expose the catalog for read-only queries.
```

### Workflow 2: Resolve a Historical Artifact

```text
1. Receive an exact artifact ID and version from a job or replay.
2. Locate the immutable version.
3. Resolve exact dependencies in stable order.
4. Return the resolved manifest or a precise blocking error.
```
