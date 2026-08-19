# Dino Park Engineer Coding Standards

These standards apply to every implementation change in this repository. They
exist to keep work produced across many fresh AI contexts coherent,
deterministic, portable, testable, and maintainable.

## Authority and scope

Follow instructions in this order:

1. The current user request and repository `AGENTS.md`.
2. `Specs/application_PRD.md` for product-wide requirements and invariants.
3. The owning feature PRD for feature behavior and acceptance criteria.
4. The owning feature PLAN for implementation slices and verification intent.
5. This document for engineering conventions.
6. `checklist.md` for implementation order and completion state.

Do not silently resolve a conflict. Preserve the higher-authority requirement
and record the decision in the owning PRD before implementing it. Brainstorming
documents are background context only.

## Platform and technology baseline

- Use strict TypeScript, React 19, React DOM, PixiJS 8, Vite, and npm.
- Use Node.js `>=22.13.0`; Node.js 24 LTS is the development baseline.
- Support current Windows and macOS development environments.
- Produce a client-only static browser application. Core gameplay must not
  require a backend, account, network request, runtime LLM, API key, or secret.
- Treat the committed `package-lock.json` as the dependency source of truth.
- Keep local hosting the primary experience. Optional static hosting must not
  weaken gameplay, determinism, offline behavior, accessibility, or fidelity.

## Architecture and module boundaries

- Prefer small public APIs backed by deep modules. Export only what another
  package needs.
- Cross-package imports must use the owning package's `public.ts`. Never import
  another package's internal files.
- Keep authoritative rules and state transitions in the owning domain package.
  React and PixiJS may render projections and issue typed commands; they must
  not mutate authoritative state.
- Use explicit typed ports for cross-domain collaboration. Do not introduce an
  untyped global event bus, mutable singleton domain state, or hidden service
  locator.
- Keep feature dependencies explicit and acyclic. Dependency direction follows
  the architecture map in `AGENTS.md` and the feature PRDs.
- Validate dynamic, persisted, generated, and imported data at its boundary
  before it reaches domain logic.
- Keep public contracts serializable and structured-clone compatible unless an
  owning spec explicitly requires otherwise.
- Use stable, namespaced IDs and exact versions. File paths and display labels
  are not domain identities.
- A failure in an optional feature must remain isolated. Required dependency
  failures must block safely with stable diagnostics and recovery guidance.

## TypeScript conventions

- Keep all strict compiler checks enabled. Do not weaken project-wide compiler
  settings to make a local change compile.
- Do not use `any`. At uncertain boundaries, accept `unknown`, validate it, and
  narrow it. A narrowly isolated compatibility cast requires a comment stating
  the external contract that makes it safe.
- Prefer immutable inputs and read-only projections. Copy at ownership
  boundaries instead of sharing mutable collections.
- Model state machines and results with discriminated unions. Make switches
  exhaustive and fail compilation when a new variant is unhandled.
- Prefer literal unions and data objects over TypeScript enums when values are
  serialized or cross a package boundary.
- Public functions, commands, ports, and adapters require explicit parameter
  and return types. Local inference is encouraged when unambiguous.
- Use type-only imports where appropriate. Avoid barrel files other than the
  deliberate `public.ts` package surfaces.
- Avoid non-null assertions. Establish the invariant with validation or an
  explicit guard.
- Use domain names from `Specs/application_PRD.md` in code and user-facing text.
  Do not create synonyms for Prompt, Skill, System Prompt, Context, Memory,
  Retention Policy, Eval, Trace, Agent, or Manager Agent.

## Deterministic simulation rules

- The simulation advances on explicit integer logical ticks, never wall-clock
  time, frame rate, locale, time zone, or animation completion.
- All randomness must come from an injected, seeded pseudo-random source whose
  state is included in replay/save authority. Never use `Math.random()` in an
  authoritative path.
- Give every unordered operation an explicit stable ordering and tie-breaker.
  Do not depend on filesystem enumeration, object-key insertion, platform path
  casing, or locale-sensitive sorting.
- Represent authoritative quantities with integers or deliberately bounded
  fixed-point units. Do not allow floating-point rendering differences to
  influence simulation truth.
- Commands validate completely before mutation and commit atomically. A rejected
  command leaves authoritative state unchanged and returns a stable diagnostic.
- Resolve jobs, deployments, content, traces, and evals against exact pinned
  versions. A newer artifact must not change a historical result.
- Canonical serialization, hashing, and fingerprints must specify ordering and
  normalization. Identical input and seed must produce identical observable
  state in Node, Windows browsers, and macOS browsers.
- Human-readable Prompt, Skill, and System Prompt prose is inspectable content;
  it is never parsed to decide runtime behavior. Machine-readable clauses own
  execution.
- Context overflow is never silent. It either blocks or records the configured
  deterministic Retention Policy action and provenance.

## React, PixiJS, and browser UI

- React owns application chrome, focused workbenches, forms, inspectors,
  history, dialogs, and all semantic accessibility surfaces.
- PixiJS is a read-only Park View projection. It consumes authoritative
  snapshots/selectors and emits typed user intents; it never owns gameplay
  truth.
- Keep view components thin. Put rules, transitions, sorting, filtering, and
  expensive derivations in tested domain services or selectors.
- Subscribe through narrow selectors/projections and clean up every listener,
  timer, worker, audio node, and Pixi resource on disposal.
- Use asset registry IDs and declared metadata, not hard-coded generated file
  paths or dimensions.
- Every canvas action and meaningful cue requires a persistent semantic DOM
  equivalent. Keyboard users must be able to perform the same gameplay actions
  and inspect the same exact information.
- Do not encode meaning only through color, sound, animation, pointer hover, or
  spatial position. Honor reduced motion, text scaling, contrast, focus, and
  audio-substitution requirements.
- Transient notifications must enter a persistent accessible history when they
  carry gameplay information.
- A rendering asset may illustrate state but never determine state or replace
  its semantic representation.

## Content, persistence, and generated assets

- Define schemas for imported content and persisted data with Zod at the
  boundary. Reject malformed, incompatible, duplicate, or ambiguous records
  with actionable diagnostics.
- Content packages are declarative data. Do not execute arbitrary imported code.
- Persist schema versions, exact content versions, deterministic authority, and
  enough provenance to diagnose and replay a save.
- Migrations are explicit, ordered, tested, and preserve a recoverable original
  before committing replacement data.
- OpenAI-generated rendering assets are development-time candidates, not trusted
  runtime inputs. Quarantine them until validation and human approval record
  prompt/brief provenance, source model, dimensions, rights/usage metadata,
  accessibility equivalent, and deterministic transformation history.
- Generated artifacts must not introduce runtime OpenAI dependencies or secrets.
  Runtime bundles contain only approved, versioned results and manifests.

## Errors, diagnostics, and observability

- Expected failures use typed results or typed domain errors with stable codes.
  Reserve thrown exceptions for violated programmer invariants or adapter
  failures that cannot be represented locally.
- Never silently catch, truncate, evict, migrate, substitute, retry, or fall
  back. Expose the action and its cause through an appropriate diagnostic,
  trace, or persistent history record.
- User-facing errors state what failed, what remained safe, and the available
  recovery action without exposing secrets or implementation noise.
- Traces expose inputs, available Context, applicable clauses, tool calls,
  evidence, world changes, and outcomes. Never fabricate or expose hidden
  chain-of-thought.
- Structured logs and diagnostics use stable identifiers and redact sensitive
  imported values by default.

## Testing standards

- Test observable behavior through the narrowest owning public boundary. Avoid
  tests that merely mirror implementation structure or private helper calls.
- Every testable acceptance criterion and user-visible failure/recovery path
  changed by a slice needs meaningful automated coverage.
- Domain tests cover state transitions, rejected commands, boundary values,
  stable ordering, version pinning, provenance, and deterministic replay.
- Golden fixtures prove the same seed and input produce the same result across
  repeated runs and, where required, Node and browser implementations.
- Contract and architecture tests enforce `public.ts` boundaries, dependency
  direction, immutable projections, and UI command-only mutation.
- Rendered tests cover semantic HTML, keyboard behavior, focus, accessible
  names, persistent alternatives, text scaling, reduced motion, and failures.
- Integration tests cover cross-package workflows using real public contracts;
  mocks belong only at true process, browser, storage, audio, or network ports.
- Tests must be deterministic and independent. Do not use arbitrary sleeps,
  live network services, current dates, or order-dependent shared state.
- A behavioral slice must be verified as a user through the computer-use skill
  whenever any affected or integrated behavior is reachable in the running
  browser. Exercise success, relevant failure/recovery, keyboard access, and
  the persistent accessible equivalent. A slice cannot be marked complete if
  this verification is possible but has not passed.
- If browser verification is genuinely impossible, record the precise missing
  prerequisite and unblocking condition in `checklist.md`. Do not substitute a
  unit test for required computer-use verification or mark the item complete.
- A purely headless slice with no reachable browser surface still requires its
  public contract tests. Record why computer use did not apply in the handoff.

## Cross-platform and repository hygiene

- Use Node scripts and Node path/URL APIs for repository automation. Do not make
  required workflows depend on Bash, PowerShell, GNU-only utilities, drive
  letters, backslashes, or case-insensitive filesystems.
- Use portable lowercase file names where a convention is not already fixed,
  forward-slash logical paths in manifests, and import casing that exactly
  matches the file on disk.
- Normalize text inputs deliberately; behavior must not depend on LF versus
  CRLF line endings.
- Add a dependency only when it materially reduces risk or complexity. Prefer
  maintained packages with browser compatibility, TypeScript support, and an
  acceptable license; document architectural dependencies in the owning spec.
- Never commit secrets, local machine paths, transient generated output,
  coverage output, or editor state.
- Preserve unrelated changes in a dirty worktree. Keep diffs scoped, inspect the
  final diff, and do not reformat unrelated files.
- Comments explain non-obvious intent, invariants, or tradeoffs. Do not narrate
  obvious syntax or leave stale TODOs without an owning checklist/spec item.

## Definition of done

A checklist item or coherent vertical slice is complete only when all applicable
conditions are true:

1. The owning PRD and PLAN were read, and any product decision change is
   reflected in the owning spec.
2. The implementation follows public boundaries and these standards.
3. Focused automated tests cover all changed testable behavior and pass.
4. Browser computer-use verification passes whenever the behavior is reachable.
5. Accessibility and failure/recovery behavior have been exercised.
6. Relevant documentation is updated.
7. The narrow checks pass during iteration and `npm run validate` passes for the
   completed integration/phase gate.
8. The final diff contains no accidental scope, secrets, generated debris, or
   undocumented decisions.
9. `checklist.md` accurately records `[x]`, `[ ]`, or `[!]` state and any
   blocker, followed by a concise evidence-based handoff.
