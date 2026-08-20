# Eval Runner

Eval Runner is the deterministic, offline evaluation boundary. Cases and
suites are versioned declarative assets; their assertions inspect only bounded
world, job, Context, Trace, tool, message, and outcome projections. Authored
content cannot provide executable grader code.

## Public surface

`src/eval-runner/public.ts` is the only downstream import surface. It exposes:

- `validateEvalCase` / `validateEvalSuite` and the Zod schemas;
- `createEvalCatalog` and `planEvalSelection` for exact case and named-suite
  selection, risk/availability/previous-result display, and cost estimates;
- `runEvalCase` / `runEvalSuite` for fresh isolated Simulation, Context, and
  Instruction execution;
- `rerunEvalCase` and `compareEvalResults` for exact like-for-like reruns;
- `createOpeningMaintenanceContextEvalCase` and
  `runOpeningMaintenanceContextEval` for the free opening Eval;
- `EvalRunnerView`, a semantic UI projection with persistent `SIMULATION`
  framing, keyboard-operable selection/run/replay/rerun controls, and
  expected-versus-observed assertion records.

## Deterministic decisions

Selection preserves explicit suite case order. Duplicate exact case entries
are rejected with `EVAL_DUPLICATE`; this prevents a suite from silently
changing its denominator. Every run creates a new Simulation and assembles a
new Context. No production world, Economy, or Persistence port is accepted by
the runner. Candidate artifacts are either supplied as validated declarative
records or resolved through exact Content Registry references.

Case status is derived from execution and assertion records: `passed`,
`failed`, `completed`, `invalid`, `timed-out`, or `interrupted`. Suite totals
and `passRate` are computed only from completed executed cases; invalid and
interrupted cases remain separate counts. No reliability or confidence
percentage is generated.

Traces use Trace Replay's `eval` mode and retain exact case, fixture,
candidate, dependency, Context, command, evidence, delta, and outcome data.
Complete traces expose a historical replay reference. Incomplete or
interrupted traces explicitly mark replay unavailable. A rerun blocks when the
historical case, fixture, candidate, or dependency versions cannot align; a
successful rerun compares assertion IDs, Context, actions, cost, outcome, and
Trace differences while preserving both immutable results.

