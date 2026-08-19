# Plan: Telemetry and Playtesting

## Proposed Vertical Slices

1. **Ordinary play proves research capture is absent**
   - Blocked by: Shell/Persistence stable provider ports
   - Adds typed event catalog and a disabled no-op public recorder, architecture
     rule preventing domain dependency, and exact on/off simulation comparison.
   - Tests: no log without study/consent, no network client, no state/reward
     effect, and prohibited imports.
   - Browser proof: play opening with no study and inspect zero research storage.

2. **Accessible versioned consent enables a bounded local study log**
   - Blocked by: #1, Player Experience preferences, Persistence local storage
   - Adds study config, consent/decline/renew/revoke/status, local pseudonymous
     session, allowlist, bounded IndexedDB log, capture indicator, and no penalty.
   - Tests: every consent transition, changed study renewal, storage quota,
     revocation, accessibility, and normal save separation.
   - Browser proof: decline, opt in, see status, revoke, and continue playing.

3. **Opening protocol records only meaningful semantic outcomes**
   - Blocked by: #2, Curriculum opening slice
   - Adds first-look/action, hint tier, job/incident/diagnosis/eval/deploy/opening,
     mode, and duration events plus strict privacy filter and protocol document.
   - Tests: exact allowlisted properties, authored/freeform/raw input/full trace/
     secret rejection, version tags, and non-interference.
   - Browser proof: complete study and inspect a human-readable local event list.

4. **Transfer, retention, recovery, density, and mastery protocols use minimal events**
   - Blocked by: #3 and corresponding curriculum scenarios
   - Adds semantic events/success definitions for prediction, retained/excluded
     connection, novel transfer, stabilization-versus-fix distinction, critical
     state location, stable enjoyment, continuation, and expansion choice.
   - Tests: each research question maps to necessary events only, missing data is
     explicit, accessibility settings are consented categories, and no extra input.
   - Browser proof: dry-run each protocol with representative fixture states.

5. **Explicit export and cautious report support baseline decisions**
   - Blocked by: #3-#4
   - Adds sanitized portable export, schema documentation, deletion, aggregate
     report with sample/version/missing data/caveats, and behavior/statement/
     inference separation.
   - Tests: no save/authored text in export, tamper validation, deletion, small
     cohort warning, overflow disclosure, and reproducible aggregation.
   - Browser proof: export a study, inspect contents, generate a baseline report,
     and delete local research data.

6. **Playtesting validation gate**
   - Blocked by: #1-#5
   - Adds recruitment matrix, facilitator scripts, accessibility review,
     privacy review, protocol dry-run checklist, and full validation.
   - Browser proof: no-consent, consent, study, revoke, export/delete, keyboard,
     text scale, and recording-on/off outcome equivalence.
