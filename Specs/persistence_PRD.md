# Persistence - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Application Shell | Supplies lifecycle, safe checkpoints, diagnostics, and update coordination. |
| 2 | Content Registry | Resolves exact saved content and compatibility. |
| 3 | All state-owning domains | Supply versioned serializable state and migrations through public persistence ports. |

### Downstream Dependencies

Player Experience exposes save/load/recovery. Trace/Eval/Review rely on exact
history. Curriculum and Telemetry may record local progression/research consent.

## Executive Summary

Persistence saves and restores the exact park, history, content references,
progression, evals, reviews, deployments, incidents, recovery state, and player
preferences locally. It validates before replacing a running session, migrates
through explicit schema steps, preserves backups, and blocks rather than
silently floating missing historical versions. Core play needs no account,
cloud, or network.

## User Stories

### Save and Restore

- **GIVEN** a valid park at a safe checkpoint, **WHEN** saved and reloaded, **THEN**
  exact world state, time, seed, versions, jobs, traces, evals, deployments,
  economy, progression, incidents, preferences, and recovery state return.
  - **Acceptance Criteria:** A historical replay produces its original outcome.
- **GIVEN** automatic persistence is enabled, **WHEN** a material checkpoint
  completes, **THEN** a recoverable save is written without interrupting play.
  - **Acceptance Criteria:** A partial write cannot replace the last known-good
    save.

### Failure and Migration

- **GIVEN** a corrupt, incompatible, or incomplete save, **WHEN** load is
  attempted, **THEN** the current session remains safe and the player receives
  exact remediation options.
  - **Acceptance Criteria:** No current content is silently substituted for a
    missing historical version.
- **GIVEN** a supported older schema, **WHEN** loaded, **THEN** migrations run in
  explicit order and preserve an original backup.
  - **Acceptance Criteria:** Migration output validates completely before commit.

## Functional Requirements

### FR-01: Save Envelope

- FR-01.1: A save SHALL have stable ID, application/save schema version, created/
  updated time, logical park tick/day, content-package manifest/fingerprints,
  domain section versions, integrity metadata, and completion marker.
- FR-01.2: Domain sections SHALL preserve world/seed/time, content registry
  references, jobs/schedules, Agent/context/memory state, traces, eval assets/
  results, work/reviews/deployments, economy/progression/rewards, incidents/
  response/suspension, curriculum, preferences, and consent state as included.
- FR-01.3: Save serialization SHALL use canonical portable data, not class,
  function, DOM, renderer, or platform path state.

### FR-02: Local Storage

- FR-02.1: Primary saves SHALL use IndexedDB behind a replaceable persistence
  port.
- FR-02.2: Writes SHALL use staging, validation, atomic promotion, and prior
  known-good preservation.
- FR-02.3: The feature SHALL support manual save, autosave checkpoints, save
  listing/metadata, delete with confirmation, and export/import of a portable
  save package.
- FR-02.4: Storage quota or write failure SHALL be explicit and SHALL not report
  success.

### FR-03: Load and Validation

- FR-03.1: Load SHALL read, validate integrity/envelope, migrate supported
  versions, validate every domain section, resolve exact content, and construct
  a candidate session before replacing current state.
- FR-03.2: Domain restoration SHALL be atomic across sections.
- FR-03.3: Missing exact historical content SHALL block affected load/replay with
  remediation rather than float to current.
- FR-03.4: Unsupported future schemas SHALL not be rewritten or partially loaded.

### FR-04: Migration and Recovery

- FR-04.1: Migrations SHALL be explicit deterministic version-to-version steps
  with preconditions, transformed fields, validation, and audit result.
- FR-04.2: The original imported/stored bytes SHALL remain available as a backup
  before migration promotion.
- FR-04.3: Recovery SHALL offer retry, load last known-good, export diagnostics/
  original, remove only with confirmation, or start a new separate park.
- FR-04.4: A failed migration SHALL leave the previous save and current session
  unchanged.

### FR-05: Checkpoints and Updates

- FR-05.1: Owning domains SHALL declare safe checkpoint snapshots; Persistence
  SHALL not infer mid-transition consistency.
- FR-05.2: Autosave SHALL coalesce redundant requests and record the exact
  checkpoint tick.
- FR-05.3: The shell update coordinator SHALL activate a new static build only
  after Persistence confirms a safe checkpoint or explicit no-state condition.
- FR-05.4: Save format SHALL remain independent from browser cache version.

## Non-Functional Requirements

- **NFR-01: Exactness** - Save/load preserves exact state and historical version
  references.
- **NFR-02: Reliability** - Partial/corrupt writes do not replace known-good data.
- **NFR-03: Portability** - Exported saves transfer between supported Windows and
  macOS browsers subject to schema/content compatibility.
- **NFR-04: Privacy** - Saves remain local unless the player explicitly exports
  them; no authored text is transmitted.
- **NFR-05: Performance** - Checkpoint work avoids long visible main-thread
  stalls at measured save sizes.

## Invariants

- **INV-01:** Historical versions never float during load.
- **INV-02:** Candidate restoration validates before current-session replacement.
- **INV-03:** Failed writes/migrations preserve known-good data.
- **INV-04:** Core saves require no account or network.
- **INV-05:** Save data contains no executable functions or renderer objects.

## Out of Scope

- Required cloud saves, sync, accounts, or multiplayer state.
- Saving unapproved/generated source art in player saves.
- Permanent deletion without explicit confirmation.
- Long-term support promises for unspecified future schemas.

## Product Decisions

- **PD-01: Local exact saves** - Offline ownership and replay integrity are core.
- **PD-02: Recover before discard** - Corruption creates actionable options.
- **PD-03: Portable export** - Players/testers can move and report exact states.

## Implementation Decisions

- **IMP-01:** Use IndexedDB for primary structured/blob storage and a repository
  adapter that remains testable in memory.
- **IMP-02:** Use Zod at envelope/domain boundaries plus domain-owned migration
  functions and canonical serialization.
- **IMP-03:** Use staged records and transactional pointer promotion for atomic
  known-good saves.
- **IMP-04:** Expose only `src/persistence/public.ts`.

## Testing Decisions

- **TST-01:** Round-trip fixtures assert exact deep equality and replay outcomes.
- **TST-02:** Fault injection covers quota, transaction abort, truncation,
  corruption, missing package, unsupported future schema, and migration failure.
- **TST-03:** Recovery tests prove current session and known-good save remain.
- **TST-04:** Browser tests cover IndexedDB, export/import, offline reload, and
  Windows/macOS portability fixture.

## Proposed Modules

- **MOD-01: Save Coordinator** - Requests safe domain snapshots and assembles a
  complete exact candidate.
- **MOD-02: Save Repository** - Atomically stages/promotes IndexedDB records and
  known-good pointers.
- **MOD-03: Save Validator** - Validates envelope, integrity, domains, content,
  and portability.
- **MOD-04: Migration Pipeline** - Applies explicit deterministic steps with
  backup and audit.
- **MOD-05: Recovery Service** - Offers safe actions without discarding data.
- **MOD-06: Export/Import Service** - Produces and validates portable packages.

## Workflows

### Workflow 1: Autosave

```text
1. A domain-safe checkpoint completes.
2. Persistence requests versioned snapshots from every included domain.
3. It assembles and validates the complete save envelope.
4. It writes a staged IndexedDB record transactionally.
5. It validates stored data and atomically promotes the known-good pointer.
6. It reports exact saved tick or explicit failure.
```

### Workflow 2: Load and Migrate

```text
1. Read save bytes without changing current session.
2. Validate envelope/integrity and preserve original backup.
3. Apply supported ordered migrations.
4. Validate all domain sections and exact content dependencies.
5. Construct a candidate session and run restore invariants.
6. Atomically replace current session or leave it untouched on failure.
```
