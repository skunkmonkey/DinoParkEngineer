# Save, Load, Autosave, and Migrations - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

All state-owning MVP features provide versioned export/import repositories or transaction participants. `platform-foundation` provides global feedback/error UI.

### Downstream Dependencies

Every stateful feature relies on persistence recovery, durable transactions, and historical resolvability.

## Executive Summary

Persistence keeps the deterministic park trustworthy across browser sessions. It saves world/logical clock/PRNG, credits/unlocks, artifacts and active versions, agents/jobs/incidents, memory, eval assets/runs/suites, reviews/deployments, traces/replay manifests, and curriculum state. Autosave occurs after major transactions and periodically during simulation. Versioned migrations preserve supported saves, transaction boundaries prevent partial cross-feature purchases/deployments, and corrupt/incompatible saves fail safely with recovery options.

## User Stories

- **GIVEN** a saved park, **WHEN** reloaded, **THEN** every authoritative state and pinned historical ref is restored so continued execution remains deterministic.
- **GIVEN** a deployment/purchase/eval build, **WHEN** persistence fails mid-operation, **THEN** the game restores the pre-transaction state or completes exactly once after recovery.
- **GIVEN** an older supported save, **WHEN** loaded by a newer build, **THEN** migrations run in order and preserve a recoverable backup.
- **GIVEN** corrupt/incompatible data, **WHEN** load is attempted, **THEN** the player gets actionable recovery choices and the current data is not overwritten.

## Functional Requirements

### FR-01: Save Envelope and Coverage
- FR-01.1: Save envelope SHALL contain format version, save id/slot, created/updated timestamps as metadata, build/schema manifests, checksum, and feature state sections.
- FR-01.2: Persist every item listed in application PRD section 21.1, including simulation logical time and PRNG state.
- FR-01.3: Historical traces/eval runs/reviews SHALL retain or resolve pinned artifact/content versions through saved content manifest/reference data.
- FR-01.4: Non-gameplay display preferences remain separate from save data.

### FR-02: Save/Load
- FR-02.1: Support at least one autosave and one manual save slot in MVP, with clear game-time/update metadata.
- FR-02.2: Save SHALL collect an immutable consistent snapshot at a simulation safe boundary.
- FR-02.3: Load SHALL validate envelope/checksum/schemas/references before replacing active state.
- FR-02.4: Failed load SHALL leave the active session unchanged.
- FR-02.5: New game SHALL use a content-defined initial state.

### FR-03: Autosave and Recovery
- FR-03.1: Autosave after deployments/reverts, purchases/builds, unlocks, major incidents/recovery, scenario transitions, and periodically at an authored logical interval.
- FR-03.2: Autosave requests SHALL coalesce and SHALL not overlap writes.
- FR-03.3: Use atomic replace/commit strategy appropriate to browser storage; retain last-known-good backup.
- FR-03.4: Unexpected close/reopen SHALL choose latest valid committed save, never a partial write.

### FR-04: Migrations
- FR-04.1: Each save format change SHALL add a deterministic forward migration with source/target version.
- FR-04.2: Migrations SHALL run sequentially, validate each output, and never mutate source bytes.
- FR-04.3: Unsupported future versions SHALL be rejected without overwrite.
- FR-04.4: Migration failure SHALL retain original and report version/step/code.

### FR-05: Cross-Feature Transactions
- FR-05.1: Provide atomic/idempotent coordination for ledger+entitlement, commission+proposal+review, eval build/run charge+record, and deploy+active mapping+audit/lifecycle.
- FR-05.2: Transaction recovery SHALL use stable transaction ids and result records.
- FR-05.3: Feature code SHALL not depend directly on browser storage APIs.

### FR-06: Data Management
- FR-06.1: Allow export/import of a save as a versioned file where platform APIs permit.
- FR-06.2: Import SHALL validate and preview metadata before replacement.
- FR-06.3: Deleting/overwriting a material save SHALL require explicit confirmation; no cloud sync in MVP.

## Non-Functional Requirements

- **NFR-01: Reliability** - Injected write interruption cannot produce an accepted partial save.
- **NFR-02: Performance** - Typical MVP autosave completes within 250 ms off the main interaction path; large traces may use referenced/chunked storage.
- **NFR-03: Determinism** - Save/load round-trip preserves canonical authoritative hashes.
- **NFR-04: Security** - Treat imported data as untrusted; validate sizes/types/refs and never execute embedded code.
- **NFR-05: Storage Failure** - Quota/unavailable storage errors provide export/retry/continue-with-warning options as applicable.

## Invariants

- **INV-01:** Only a fully validated committed save can become active.
- **INV-02:** Load failure does not mutate the current session.
- **INV-03:** Transaction id causes at most one committed cross-feature effect.
- **INV-04:** Migration preserves original recoverable data.
- **INV-05:** Save round-trip preserves exact pinned refs, logical time, and PRNG state.

## Out of Scope

Cloud accounts/sync, multiplayer, server database, save editing, sharing marketplace, backward migration, and indefinite support for every development format.

## Product Decisions

- **PD-01:** Autosave is primary; manual save/export provide confidence and recovery.
- **PD-02:** Historical engineering artifacts are gameplay evidence and must remain resolvable.
- **PD-03:** Real wall timestamps are metadata only and cannot affect simulation.

## Implementation Decisions

- **IMP-01:** Feature-state adapters implement versioned snapshot/restore/validate; persistence orchestrates but does not understand every internal rule.
- **IMP-02:** Browser storage is behind a repository; tests use memory/failure-injection adapters.
- **IMP-03:** Chunk/hash large append-only trace data while keeping one atomic manifest pointer.

## Testing Decisions

- **TST-01:** Golden full-state save/load compares canonical feature hashes and continued replay.
- **TST-02:** Failure injection at every transaction/write phase proves rollback/recovery/idempotency.
- **TST-03:** Migration fixtures include every supported version plus corrupt/future/oversize imports.

## Proposed Modules

- **MOD-01: SaveCoordinator** - Collects consistent feature snapshots and validates/restores atomically.
- **MOD-02: SaveRepository** - Abstracts slots, atomic commit, backup, chunks, import/export.
- **MOD-03: MigrationRunner** - Sequential deterministic migration and validation.
- **MOD-04: TransactionCoordinator** - Idempotent cross-feature commit/recovery.
- **MOD-05: SaveStatusUI** - Manual save/load/export/import, autosave status, and recovery messages.

## Workflows

### Workflow 1: Autosave
```text
Major transaction commits -> request autosave -> reach safe snapshot boundary -> collect/version/validate sections -> write chunks/temp envelope -> verify checksum -> atomically move active pointer -> retain prior backup.
```

### Workflow 2: Load Older Save
```text
Read untrusted bytes -> size/envelope/checksum validation -> copy source backup -> migrate sequentially -> validate all schemas/refs -> stage feature restores -> atomically activate -> verify canonical state; otherwise keep session unchanged.
```
