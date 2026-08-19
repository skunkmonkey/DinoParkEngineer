# Plan: Persistence

## Proposed Vertical Slices

1. **Save and reload the first deterministic park state exactly**
   - Blocked by: stable Shell/Content Registry/Simulation/Park Operations schemas
   - Adds save envelope, domain persistence ports, canonical serialization,
     in-memory repository, manual checkpoint, validation, candidate restore, and
     exact world/job/version round trip.
   - Tests: equality, current-session isolation, invalid domain, missing exact
     content, stable ordering, and replay outcome.
   - Browser proof: save, change state, reload, and replay the original feeding.

2. **IndexedDB autosave cannot replace known-good data partially**
   - Blocked by: #1, Shell provider/update slice
   - Adds IndexedDB repository, staged transaction, validation/promotion,
     known-good pointer, coalesced autosave, quota/write diagnostics, and saved
     tick projection.
   - Tests: transaction abort, truncated/stale stage, quota, duplicate request,
     last-good preservation, and offline reload.
   - Browser proof: force a failed save and load the prior known-good park.

3. **Every MVP domain and historical record round-trips**
   - Blocked by: #1-#2 and stable included-domain schemas
   - Adds context/memory, trace, eval, Workbench/review/deployment, economy,
     incident/response/suspension, progression/rewards, curriculum, preferences,
     and consent sections.
   - Tests: exact composite round trip, historical version resolution, old/new
     deployment jobs, suspension recovery, and no renderer/source-art state.
   - Browser proof: save after the complete opening loop, reload, inspect/replay
     history, revert, and continue.

4. **Portable export/import moves an exact save across environments**
   - Blocked by: #3
   - Adds save listing/metadata, export package, import quarantine/validation,
     conflict naming, explicit delete, and path/platform-neutral data.
   - Tests: Windows/macOS fixture, duplicate import, tamper/corruption, unknown
     future schema, delete confirmation, and no automatic overwrite.
   - Browser proof: export, import as a separate park, and verify exact replay.

5. **Supported migration preserves backup and blocks safely on failure**
   - Blocked by: #3-#4
   - Adds one real version migration, ordered migration registry, original backup,
     audit, post-migration validation, last-good recovery, and diagnostic export.
   - Tests: success, missing step, bad precondition, thrown transform, invalid
     output, unsupported future, original unchanged, and retry.
   - Browser proof: load an old fixture, migrate, inspect history, then exercise
     a failed fixture and recover.

6. **Persistence validation gate**
   - Blocked by: #1-#5
   - Adds large-save performance measurements, privacy review, architecture
     lint, browser storage tests, and full validation.
   - Browser proof: manual/autosave, failure, load, export/import, migrate,
     recovery, offline, keyboard, and update-safe checkpoint.
