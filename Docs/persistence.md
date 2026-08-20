# Persistence foundation

The persistence foundation is a headless, local-first boundary for exact park
saves. Its public surface is [src/persistence/public.ts](../src/persistence/public.ts).

## Format

Every save is a schema-versioned `SaveEnvelope` with a stable save ID,
application and save schema versions, metadata timestamps, logical tick/day and
seed, an exact Content Registry manifest, five versioned domain sections, a
canonical FNV-1a-64 integrity fingerprint, and the `SAVE_COMPLETE` marker.
Sections currently cover Simulation, Park Operations, Context manifests and
Retention Policy audits, historical Trace records, and Player Experience
preferences. Renderer projections, DOM nodes, functions, classes, and platform
paths are rejected by the portable-data boundary.

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

The `/persistence` foundation route exposes the Phase 6 manual proof with
semantic keyboard controls: save the exact first-playable checkpoint, advance
the unsaved world, restore the validated candidate, replay the saved feeding,
and attempt an invalid load while observing that the current session remains
unchanged. The surface intentionally uses the in-memory repository so this
slice remains deterministic and does not imply that the later IndexedDB,
autosave, export/import, migration, and recovery slices are complete.

The repository and session ports remain replaceable so those later browser
adapters can be added without changing the save format.
