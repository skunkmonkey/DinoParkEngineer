# Dino Park Engineer - Agent Instructions

## Application at a glance

Dino Park Engineer is a deterministic, browser-based game for professional
developers. The player operates an automated dinosaur park and learns prompt
engineering, Skills, System Prompts, context and memory engineering, evals,
review/deployment discipline, and multi-agent orchestration through observable
system consequences.

The north star is: the player starts by controlling actions and gradually learns
to control systems. Good engineering makes the park safer and more autonomous,
with less direct intervention required as complexity increases.

Core gameplay must work without a runtime LLM, account, secret, backend, or
network service. The authoritative simulation and evals are deterministic and
replayable.

## Source of truth

Read the relevant specification before changing behavior:

- `Specs/application_PRD.md` is the product baseline: intent, learning outcomes,
  canonical terminology, game loop, invariants, and MVP acceptance criteria.
- The owning feature spec is `Specs/<featureSlug>_<specType>.md`.
- `Docs/` contains implementation notes and operational checklists that explain
  the current behavior of completed features.
- `Docs/brainstorming_session.md` is background only. Consult it when the PRDs
  do not answer an unresolved product question; do not use it to override an
  explicit requirement.
- `Specs/Templates/template_PRD.md` is the template for new features.
  `Specs/Templates/template_PLAN.md` is the template for multi-step
  implementation plans and vertical slices. PLAN files are ephemeral and only
  exist during implementation. They allow AI to receive rapid end-to-end testing
  results rather than having to wait until the entire feature is implemented.

When a feature PRD refines the application PRD, follow the more specific
requirement while preserving the application-level invariants. Do not silently
resolve a contradiction in code; record the decision in the appropriate spec.

## Spec-driven development

For every change:

1. Identify the owning feature, its upstream/downstream dependencies, and the
   relevant acceptance criteria.
2. If the change meaningfully alters an existing requirement or workflow, update
   the owning spec in the same change. Keep dependencies, user stories,
   functional requirements, invariants, decisions, testing decisions, and
   workflows consistent with the intent.
3. For a new feature, create a PRD using the required
   `<featureSlug>_<specType>.md` naming convention and the PRD template before
   implementing behavior.
4. For work spanning multiple concerns, make a plan with vertical slices using
   `Specs/Templates/template_PLAN.md`. Each slice should produce a visible,
   testable result and identify dependencies and tests.
5. Implement against the spec, add or update focused tests, and update relevant
   `Docs/` implementation notes when user-visible or operational behavior
   changes.
6. Run the validation commands below and inspect the final diff for accidental
   scope or undocumented product decisions.

## Product invariants

- Human-readable Prompt/Skill/System Prompt text is inspectable content, but it
  is never parsed to decide runtime behavior. Machine-readable authored clauses
  drive execution.
- Context is visible, finite, provenance-labeled, and economically meaningful.
  Overflow is never silent: an explicit deterministic Retention Policy either
  blocks or records every eviction, compaction, or externalization. Larger
  context capacity is not automatically better.
- Jobs and deployments resolve exact, pinned artifact versions. Historical
  versions, traces, eval fixtures, and review records remain replayable.
- The central engineering workflow is inspect diff -> understand context and
  dependency deltas -> select/run risk-based evals -> diagnose -> revise ->
  intentionally deploy or revert.
- Traces expose inputs, available context, applicable clauses, tool calls,
  evidence, world changes, and outcomes. Never fabricate or expose hidden
  chain-of-thought.
- The Park Developer is one progression/workbench mechanism, not a developer
  hiring or team-management simulator. Manager Agents solve coordination
  pressure only through explicit delegation, authority, routing, escalation, and
  reporting rules.
- This is an AI-engineering teaching tool, so use the canonical AI-engineering
  terms from `Specs/application_PRD.md` for user-facing text where applicable,
  but other names / terminology should be approachable and commonplace.

## Architecture map and boundaries

- `app/` contains the browser entry/layout and route fallback surface.
- `src/shell/` owns generic application bootstrap contracts, route matching,
  provider composition, configuration, lifecycle, and error isolation. Downstream
  features consume `src/shell/public.ts`; they should not import shell internals.
- `src/features/` discovers feature public entries. Each feature exposes its
  browser-facing module through `src/<feature>/public.ts`; registration is lazy
  and deterministic, and an optional feature failure must not blank sibling
  features.
- Top-level domain packages contain the deep, mostly headless engines: `simulation`
  is authoritative world state; `instruction` executes authored clauses;
  `context` and `memory` build context; `content-registry` resolves versioned
  content; `eval-runner` runs regression cases; `trace-replay` provides
  provenance/replay; `park-operations`, `engineering-workbench`,
  `review-deployment`, `economy-progression`, `orchestration`, `persistence`,
  `telemetry`, and `curriculum-content` own their respective domains.
- `src/<feature>/` contains feature runtime/UI adapters and routes. Keep domain
  rules in the owning package rather than duplicating them in React components.
- `tests/` contains contract, domain, accessibility, architecture, and rendered
  HTML tests. `scripts/` contains repository validation/build helpers.
- `Specs/` defines requirements; `Docs/` records implementation guidance. Keep
  both aligned with code.

Prefer small public APIs and deep modules. Keep feature dependencies explicit,
validate dynamic or imported data at boundaries, use stable ordering and IDs,
and keep state transitions in owning services. UI code should render projections
and issue allowed commands, not mutate the simulation directly.

## Development and validation

The committed `package-lock.json` is the dependency source of truth. Use Node
`>=22.13.0` and npm `>=10`.

```text
npm install
npm run dev
npm run typecheck
npm run lint
npm run lint:architecture
npm run test:shell
npm test
npm run validate
```

Use the narrowest relevant checks while iterating, then run `npm run validate`
for a complete change. A change is not complete until its behavior, tests,
specification impact, and documentation impact have all been considered. All
behavioral changes must be tested successfully using the computer use skill to
verify they work before completing.
