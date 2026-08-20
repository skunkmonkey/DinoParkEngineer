import assert from "node:assert/strict";
import test from "node:test";

import {
  compareEvalResults,
  createEvalCatalog,
  createEvalOpeningCase,
  planEvalSelection,
  rerunEvalCase,
  runEvalCase,
  runEvalSuite,
  validateEvalCase,
  type EvalCase,
  type EvalSuite,
} from "../../src/eval-runner/public.js";
import {
  validateTrace,
  verifyTraceRerun,
} from "../../src/trace-replay/public.js";

const opening = createEvalOpeningCase();

test("opening maintenance Context Eval is a real isolated pass with exact result evidence", () => {
  const productionBefore = structuredClone(opening.fixture.scenario.initialState);
  const result = runEvalCase(opening);

  assert.equal(result.status, "passed");
  assert.equal(result.mode, "simulation");
  assert.equal(result.surface.label, "SIMULATION");
  assert.equal(result.surface.production, false);
  assert.equal(result.cost.totalUnits, 0);
  assert.ok(result.trace);
  assert.equal(validateTrace(result.trace).ok, true);
  assert.equal(verifyTraceRerun(result.trace).status, "equivalent");
  assert.equal(result.assertionSummary.passed, result.assertionSummary.executed);
  assert.deepEqual(opening.fixture.scenario.initialState, productionBefore);
  assert.equal(result.observation?.world.gates.find((gate) => gate.id === "gate:beta")?.position, "closed");
  assert.equal(result.observation?.context.after.entries.find((entry) => entry.itemId === "context:maintenance-policy")?.lifecycle, "included");
});

test("missing maintenance Context produces a replayable failed result without a fake score", () => {
  const missing = structuredClone(opening) as EvalCase;
  missing.fixture = {
    ...missing.fixture,
    context: {
      ...missing.fixture.context,
      availableSources: missing.fixture.context.availableSources.filter((item) => item.id !== "context:maintenance-policy"),
    },
  };
  const result = runEvalCase(missing);

  assert.equal(result.status, "failed");
  assert.ok(result.assertions.some((assertion) => assertion.passed === false));
  assert.equal(Object.hasOwn(result, "reliability"), false);
  assert.equal(Object.hasOwn(result, "confidence"), false);
  assert.ok(result.trace);
  assert.equal(verifyTraceRerun(result.trace).status, "equivalent");
  assert.equal(result.observation?.context.after.entries.find((entry) => entry.itemId === "context:maintenance-policy")?.lifecycle, "unavailable-required");
});

test("declarative assertions reject arbitrary executable grader content", () => {
  const invalid = { ...opening, grader: "() => true" };
  const result = validateEvalCase(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((entry) => entry.path === "$" || entry.path.includes("grader")));
});

test("selection preserves named suite order, shows risk and cost, and rejects duplicate entries", () => {
  const second = { ...opening, id: "eval:opening-maintenance-second", title: "Second opening case" } as EvalCase;
  const suite: EvalSuite = { schemaVersion: "1", id: "suite:containment", version: "1.0.0", title: "Containment", description: "Opening containment cases", availability: "available", caseReferences: [{ id: second.id, version: second.version }, { id: opening.id, version: opening.version }] };
  const catalog = createEvalCatalog([opening, second], [suite]);
  const plan = planEvalSelection(catalog, { suiteReferences: [{ id: suite.id, version: suite.version }] });
  assert.deepEqual(plan.selectedCases.map((entry) => entry.id), [second.id, opening.id]);
  assert.deepEqual(plan.includedRisks, ["high"]);
  assert.equal(plan.estimatedCost.totalUnits, 0);
  const duplicate = planEvalSelection(catalog, { caseReferences: [{ id: opening.id, version: opening.version }], suiteReferences: [{ id: suite.id, version: suite.version }] });
  assert.ok(duplicate.diagnostics.some((entry) => entry.code === "EVAL_DUPLICATE"));
});

test("suite totals derive from case statuses and each case receives a fresh environment", () => {
  const failed = structuredClone(opening) as EvalCase;
  failed.id = "eval:opening-failure";
  failed.title = "Expected failure";
  failed.assertions = failed.assertions.map((assertion) => assertion.id === "assertion:gate-closed" ? { ...assertion, expected: "open" } : assertion);
  const suite = runEvalSuite([opening, failed]);
  assert.equal(suite.summary.totalSelected, 2);
  assert.equal(suite.summary.passed, 1);
  assert.equal(suite.summary.failed, 1);
  assert.equal(suite.summary.completed, 2);
  assert.equal(suite.summary.passRate, 0.5);
  assert.deepEqual(suite.results.map((result) => result.status), ["passed", "failed"]);
  assert.equal(suite.surface.production, false);
  assert.equal(suite.progress.filter((entry) => entry.status === "running").length, 2);
});

test("rerun compares exact assertions and blocks a different candidate version", () => {
  const first = runEvalCase(opening);
  const rerun = rerunEvalCase(first, opening);
  assert.equal(rerun.ok, true);
  if (!rerun.ok) return;
  assert.equal(rerun.comparison.compatible, true);
  assert.deepEqual(rerun.comparison.changedAssertions, []);
  assert.equal(compareEvalResults(first, rerun.rerun).differences.length, 0);

  const changed = structuredClone(opening) as EvalCase;
  changed.defaultCandidate = { ...changed.defaultCandidate!, reference: { id: "prompt:opening-maintenance-revised-v2", version: "2.0.0" } };
  const blocked = rerunEvalCase(first, changed);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.ok(blocked.diagnostics.some((entry) => entry.code === "EVAL_COMPARISON_BLOCKED"));
});

test("wait-only behavior respects the deterministic timeout bound", () => {
  const timeoutCase = structuredClone(opening) as EvalCase;
  timeoutCase.id = "eval:opening-timeout";
  timeoutCase.title = "Timeout fixture";
  const candidate = timeoutCase.defaultCandidate;
  assert.ok(candidate?.artifacts?.[0]);
  if (candidate === undefined || candidate.artifacts === undefined || candidate.artifacts[0] === undefined) return;
  timeoutCase.defaultCandidate = { ...candidate, artifacts: [{ ...candidate.artifacts[0], clauses: [{ ...candidate.artifacts[0].clauses[0]!, outcome: { kind: "wait", reasonCode: "WAIT_FOR_MAINTENANCE" } }] }] };
  const result = runEvalCase(timeoutCase);
  assert.equal(result.status, "timed-out");
  assert.equal(result.reasonCode, "EVAL_TIMEOUT");
  assert.equal(result.trace?.status, "incomplete");
  assert.equal(result.replay.available, false);
});

test("interruption is an explicit status and does not become an invalid case", () => {
  const result = runEvalCase(opening, { shouldInterrupt: () => true });
  assert.equal(result.status, "interrupted");
  assert.equal(result.reasonCode, "EVAL_INTERRUPTED");
  assert.equal(result.replay.available, false);
});
