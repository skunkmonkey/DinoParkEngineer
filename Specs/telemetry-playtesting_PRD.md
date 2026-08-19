# Telemetry and Playtesting - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Player Experience | Supplies consent UI, semantic event sources, accessibility modes, and study surfaces. |
| 2 | Curriculum Content | Supplies study scenarios, success definitions, cohorts/tags, and baseline questions. |
| 3 | Persistence | Stores local consent and event records and supports explicit export. |

### Downstream Dependencies

Product balancing, accessibility validation, curriculum revision, performance
budgets, and future feature PRDs consume aggregated playtest findings, not live
runtime dependencies.

## Executive Summary

Telemetry and Playtesting measures whether players understand, enjoy, and can
access the game through observable behavior. Instrumentation is off unless
explicitly enabled for a study, remains minimal and local by default, never
captures authored Prompt/Skill text or raw input streams, and requires explicit
export or separately consented transport. Study protocols cover first look,
opening loop, retention, transfer, recovery, mature density, and mastery across
the target participant perspectives.

## User Stories

### Consent and Privacy

- **GIVEN** ordinary play, **WHEN** no study consent is active, **THEN** no
  behavioral telemetry is transmitted or recorded beyond normal save needs.
  - **Acceptance Criteria:** Core play and saves work identically.
- **GIVEN** a playtest invitation, **WHEN** consent is requested, **THEN** the
  participant sees purpose, event categories, storage, export/recipient,
  duration, withdrawal, and prohibited data before opting in.
  - **Acceptance Criteria:** Declining has no gameplay or reward penalty.

### Behavioral Research

- **GIVEN** an enabled study, **WHEN** the participant plays, **THEN** only
  allowlisted semantic events needed by the protocol are recorded.
  - **Acceptance Criteria:** Authored text, keystrokes, pointer paths, audio,
    screenshots, and raw trace payloads are not captured.
- **GIVEN** a completed session, **WHEN** researchers inspect results, **THEN**
  they can evaluate first action, opening completion, diagnosis, transfer,
  mode distinction, retention understanding, recovery boundary, density, and
  voluntary continuation.
  - **Acceptance Criteria:** Behavior precedes preference self-report in analysis.

## Functional Requirements

### FR-01: Consent

- FR-01.1: Study configuration SHALL declare stable study ID/version, purpose,
  event allowlist, retention, storage/export behavior, participant information,
  and owner/contact supplied outside runtime where applicable.
- FR-01.2: Consent SHALL be explicit, versioned, revocable, and separate from
  game terms or rewards.
- FR-01.3: Changed study configuration SHALL require renewed consent.
- FR-01.4: Revocation SHALL stop new capture and offer deletion/export handling
  according to disclosed local behavior.

### FR-02: Event Schema and Privacy Filter

- FR-02.1: Events SHALL use stable semantic names, study/session pseudonymous ID,
  logical/monotonic time, scenario/content versions, mode, accessibility
  settings categories when consented, and bounded structured properties.
- FR-02.2: Events MAY cover meaningful actions/outcomes such as first selection,
  job assignment, hint tier, incident open, diagnosis path, eval selection/run,
  deployment, retention prediction/action, response call, transfer outcome,
  continuation, and expansion acceptance.
- FR-02.3: Schemas SHALL prohibit authored artifact text, freeform user text,
  raw keys, raw pointer movement, audio/video, secrets, full saves, and hidden
  reasoning.
- FR-02.4: A privacy filter SHALL reject unknown event names/properties and scan
  string-bearing fields against strict schema limits before storage/export.

### FR-03: Local Recording and Export

- FR-03.1: Consented events SHALL be stored locally in a study-specific bounded
  log with exact schema/config versions.
- FR-03.2: Retention limits and quota behavior SHALL be explicit; overflow SHALL
  drop or aggregate only according to documented study policy and report it.
- FR-03.3: Export SHALL require an explicit participant/researcher action and
  produce a documented portable package without save/authored text.
- FR-03.4: Remote transmission, if ever added, requires a separate PRD,
  configuration, consent, security review, and failure behavior; it is not
  implied by this feature.

### FR-04: Study Protocols

- FR-04.1: Baseline protocols SHALL cover first-look comprehension, five-minute
  opening, context retention, novel transfer, Incident Response distinction,
  mature density, stable mastery, and voluntary continuation/expansion.
- FR-04.2: Recruitment SHALL include developers with low/high Agent experience,
  management-sim and non-management-sim players, and relevant accessibility users.
- FR-04.3: Protocols SHALL define observable tasks, facilitator boundaries,
  assistance rules, event interpretation, qualitative notes, and stop/safety
  criteria.
- FR-04.4: Numeric thresholds beyond the provisional five-minute target SHALL be
  set only after baseline data.

### FR-05: Analysis and Reporting

- FR-05.1: Reports SHALL aggregate defined measures with sample size, study/
  content versions, accessibility context, missing/overflow data, and caveats.
- FR-05.2: Reports SHALL separate observed behavior, participant statement, and
  researcher inference.
- FR-05.3: Small cohorts SHALL not be represented as statistically conclusive.
- FR-05.4: Findings SHALL link to owning feature/scenario requirements and
  proposed validation decisions without silently rewriting them.

## Non-Functional Requirements

- **NFR-01: Privacy by default** - Capture is disabled in ordinary play and
  excludes sensitive/raw content by schema.
- **NFR-02: Non-interference** - Enabling recording does not change simulation,
  timing semantics, rewards, or outcomes.
- **NFR-03: Transparency** - Consent, capture status, local storage, and export
  are understandable and inspectable.
- **NFR-04: Accessibility** - Consent, withdrawal, study tasks, and export are
  accessible and never penalize accommodations.

## Invariants

- **INV-01:** No authored text or invasive raw input capture.
- **INV-02:** No consent means no research event capture/transmission.
- **INV-03:** Declining or using accessibility/guidance has no reward penalty.
- **INV-04:** Telemetry cannot affect authoritative game state.
- **INV-05:** Behavior and evidence are reported separately from inference.

## Out of Scope

- Advertising, profiling, account analytics, crash-upload services, or covert
  telemetry.
- Remote dashboards or automatic uploads in the baseline.
- Recording screens, voices, keystrokes, or full pointer paths.
- Final product thresholds before baseline studies.

## Product Decisions

- **PD-01: Local explicit research** - Ordinary play remains private/offline.
- **PD-02: Behavior before opinion** - Observe transferable action first.
- **PD-03: Diverse participant perspectives** - Professional developers are not
  treated as one homogeneous audience.

## Implementation Decisions

- **IMP-01:** Use a compile-time allowlisted discriminated event catalog and a
  runtime privacy filter before a local IndexedDB study log.
- **IMP-02:** Instrument semantic domain/UI outcomes, not raw browser events.
- **IMP-03:** Export newline-delimited JSON or a documented JSON package through
  a sanitized schema; no network client exists in the baseline module.
- **IMP-04:** Expose only `src/telemetry/public.ts` and ensure domain packages do
  not depend on it.

## Testing Decisions

- **TST-01:** Privacy tests attempt prohibited text, raw input, secrets, unknown
  fields, full traces, and saves and require rejection.
- **TST-02:** Consent tests cover decline, renew, revoke, delete, export, and no
  gameplay penalty.
- **TST-03:** Non-interference tests compare exact simulations with recording on/off.
- **TST-04:** Protocol dry runs validate that events answer study questions
  without collecting extra data.
- **TST-05:** Reports are manually reviewed for behavior/inference separation.

## Proposed Modules

- **MOD-01: Study Configuration** - Validates exact protocols, consent copy, and
  event allowlists.
- **MOD-02: Consent Service** - Owns versioned opt-in, renewal, revocation, and
  participant-visible status.
- **MOD-03: Semantic Event Recorder** - Accepts only typed meaningful events.
- **MOD-04: Privacy Filter** - Rejects prohibited/unknown data before local storage.
- **MOD-05: Local Study Log** - Stores bounded versioned events independently
  from normal saves.
- **MOD-06: Research Export and Reporter** - Produces sanitized packages and
  evidence/caveat-aware summaries.

## Workflows

### Workflow 1: Run a Consented Opening Study

```text
1. Load exact study and opening content versions.
2. Present accessible consent and permit decline without penalty.
3. On opt-in, record only allowlisted semantic events locally.
4. Participant completes first-look and opening tasks with declared facilitation.
5. Participant explicitly exports the sanitized study package if requested.
6. Report separates observed actions, statements, and researcher inference.
```

### Workflow 2: Revoke Consent

```text
1. Participant opens study status and revokes consent.
2. Recorder rejects all subsequent research events.
3. Participant chooses disclosed local-log deletion or export where applicable.
4. Core save and gameplay continue unchanged.
```
