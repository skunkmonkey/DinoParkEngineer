# Plan: Save, Load, Autosave, and Migrations

## Implementation Boundary and Contracts

Own save envelope/manifest, repository adapters, snapshot/restore orchestration, autosave scheduling, migrations, transaction coordinator, and save-status controls. Do not own feature state models/rules; each feature supplies a registered adapter.

```ts
interface FeatureStateAdapter<T> { id:string; schemaVersion:number; snapshot():T; validate(value:unknown):Result<T,StateDiagnostic[]>; restore(value:T):void; canonicalHash(value:T):string; }
interface SaveService { save(slot:'auto'|'manual'):Promise<SaveResult>; load(slot:string):Promise<LoadResult>; export(slot:string):Promise<Blob>; import(file:Blob):Promise<ImportPreview|ImportError>; }
interface TransactionCoordinator { execute<T>(transactionId:string, participants:readonly TransactionParticipant[], work:()=>Promise<T>):Promise<TransactionResult<T>>; }
```

Restore is staged: validate all adapters before any is activated. If adapter activation cannot be made atomic in memory, capture old snapshots and rollback on failure, treating rollback failure as fatal recovery mode.

## Proposed Vertical Slices

1. Save/load Simulation Core exactly and continue replay
   - Blocked by: simulation state adapter and shell feedback
   - Add envelope/checksum, memory repository, manual slot, safe snapshot, staged restore, canonical round-trip, and current-session preservation on failure.
2. Autosave with atomic browser commit and backup
   - Blocked by: #1
   - Add browser repository, temp/chunk/active-pointer strategy, coalescing, logical periodic trigger, major-event triggers, quota/interruption recovery, last-known-good.
3. Register all stateful feature adapters
   - Blocked by: #1 and public adapters as features land
   - Cover economy/progress, registry/active versions, agents/jobs/incidents, context/memory, evals/suites/runs, reviews/deployments, traces/manifests, curriculum; validate cross-refs.
4. Atomic cross-feature transaction coordinator
   - Blocked by: #2, #3
   - Implement idempotent purchase, commission, eval, deploy participants with prepare/commit/rollback or write-ahead equivalent; inject failure at every phase.
5. Migrations, import/export, and recovery UX
   - Blocked by: #3
   - Add sequential migrations/fixtures, original backup, corrupt/future/oversize handling, import preview/confirmation, export, delete/overwrite safeguards, and accessibility.

## Completion Gate

Save a representative full park, load it, continue with an exact replay, and resolve historical versions. Kill/fail each write/transaction phase and recover to exactly pre- or post-commit state. Migrate every supported fixture, reject corrupt/future imports without mutation, and pass canonical hashes, tests, typecheck, storage performance, accessibility, and build.
