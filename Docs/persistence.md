# Persistence

Persistence is the local-first boundary for exact, replayable park saves. Its
only downstream import surface is `src/persistence/public.ts`.

## Format

The v1 `SaveEnvelope` retains the five foundation sections for Simulation, Park
Operations/jobs, Context, Trace history, and preferences. A versioned `mvp`
composite adds Memory, Eval assets/results, Workbench state, reviews, deployment
and revert history, economy, incidents, response/suspension state, progression,
rewards, curriculum, and consent. Omitting this new section remains valid, so
existing v1 saves and integrations continue to load unchanged.

Canonical serialization sorts record keys and uses JSON-compatible values. Save
creation copies data, and repository reads return copies, so a caller cannot
mutate a stored historical record through a projection.

## Save/load boundary

`createPersistenceCoordinator` assembles a candidate from a domain snapshot,
validates the envelope, each domain section, integrity fingerprints, and every
declared exact content reference, then stages and promotes it in the repository.
The in-memory repository keeps the prior known-good record until promotion.
Loading repeats validation and constructs a complete candidate `PersistenceSession`
before invoking the session port's atomic `replace`. Any validation or content
failure leaves both the active session and known-good save untouched.

The coordinator's `replay` operation verifies a saved Trace with the Trace and
Replay public contract. It uses the saved exact references and never resolves a
historical record to a newer version.

For a first-playable session, call `createPersistenceContentManifest` with the
current Content Registry packages and `session`; it collects the Simulation,
Park Operations, Context, and Trace exact references into the canonical
manifest. Wrap domain adapters with `createVersionedPersistencePort` when a
state-owning engine needs a small versioned snapshot/validation port.

The headless wiring is intentionally small:

```ts
const sessionPort = createMemorySessionPort(session);
const repository = createInMemorySaveRepository();
const contentManifest = createPersistenceContentManifest({ registry, session });
const persistence = createPersistenceCoordinator({
  repository,
  session: sessionPort,
  contentResolver: registry,
});

const saved = persistence.save({ id: "save:opening", contentManifest });
const loaded = persistence.load("save:opening");
```

## IndexedDB and checkpoints

`createIndexedDbSaveRepository` stores canonical text in separate `staging`,
`saves`, and `control` object stores. Promotion reads and validates staged bytes,
replaces the named save, moves the known-good pointer, and removes staging in
one transaction. An abort exposes either the former known-good save or the
complete new save. Typed diagnostics distinguish quota, transaction abort,
corrupt data, truncated JSON, missing data, and stale-stage cleanup.

`createAsyncPersistenceCoordinator` provides manual save/load.
`createAutosaveCoordinator` accepts only explicit safe checkpoints, verifies
the snapshot tick, coalesces redundant queued requests, and records the exact
logical tick. Persistence never infers safety from wall-clock time.

## Export, import, migration, and recovery

`exportPortableSave` emits a platform-neutral package with its own fingerprint.
`inspectPortableSave` keeps bytes quarantined until package, envelope, sections,
integrity, exact content, and migration output validate. ID conflicts block
instead of overwriting. `commitPortableImport` is separate so inspection cannot
mutate storage, and deletion requires explicit confirmation.

The deterministic `persistence:0-to-1-preferences-and-mvp` migration moves the
legacy root `accessibilityPreferences` into its versioned section and creates a
complete empty MVP composite. It returns the exact original bytes as a backup
and records before/after fingerprints. Missing steps, failed preconditions, or
invalid output leave the current session and known-good save unchanged.

Recovery callers can retry, load the last known-good save, retain/export the
original migration/import bytes, or use `exportPersistenceDiagnostics`. Starting
a separate park never removes a damaged save; removal always needs confirmation.

Focused tests cover legacy v1 compatibility, complete composite round trips,
deploy/revert history, portability, import quarantine/conflicts, migration and
backup, autosave coalescing, quota propagation, last-known-good recovery, and
diagnostic export. Integrated browser verification must also exercise real
IndexedDB, offline reload, recovery, export/import, migration, and keyboard use.
