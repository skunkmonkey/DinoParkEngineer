# Plan: Evals and Regression Suites

## Implementation Boundary and Contracts

Own player/runtime eval build state (separate from immutable catalog definitions), suites, isolated runner, assertion engine, result repository port, incident conversion, and Evals route. Do not implement authored definition storage, simulation/instruction rules, trace internals, generic artifact editing, deployment decisions, or economy ledger logic.

```ts
interface EvalService {
  catalog(query?:EvalCatalogQuery): readonly EvalCatalogEntry[];
  build(ref:EvalRef, transactionId:string): Result<BuiltEval, EvalBuildError>;
  run(request:EvalRunRequest): Promise<EvalBatchResult>;
  createSuite(input:EvalSuiteInput): Result<EvalSuite,ValidationError[]>;
  fromIncident(input:IncidentEvalInput, transactionId:string): Result<BuiltEval,IncidentEvalError>;
}
interface EvalExecutionPorts { createIsolatedRuntime(manifest:ReplayManifest):IsolatedRuntime; charge(command:CreditCommand):CreditResult; recordTrace:TraceSink; }
```

Exact refs are mandatory. Transaction ids make build/run charges idempotent. No eval service obtains a mutable live engine instance.

## Proposed Vertical Slices

1. Build and run Standard Feeding with visible assertions
   - Blocked by: core engine ports, trace, registry, economy transaction port
   - Catalog one case, atomic build charge, isolated run, state/job assertions, result details, and exact replay link.
2. Complete assertion registry and deterministic failure inspection
   - Blocked by: #1
   - Add all eight assertion types, expected/observed/evidence, canonical hash, negative cases, and rerun equivalence.
3. Named suites, overrides, costs, and batch isolation
   - Blocked by: #2
   - CRUD suites, preview cases/cost, override selection, stable order, partial results, per-case isolated runtimes, and retry-safe charges.
4. Twelve-case MVP catalog and risk/coverage view
   - Blocked by: #3 and curriculum pack
   - Integrate authored cases, tags/severity/build/run costs, last result by subject, keyboard selection, and no opaque aggregate-only UI.
5. Incident-to-regression conversion
   - Blocked by: #2 and reconstructable incident replay
   - Validate eligibility, capture exact manifest, require assertions, charge once, persist immutable case, and cover unavailable/corrupt inputs.

## Completion Gate

Build/run/replay Standard Feeding and Gate Fails to Close; rerun unchanged with exact output; change only subject and preserve fixture/seed; prove live state unchanged and credit operations atomic/idempotent. All assertion contracts, UI accessibility, typecheck, tests, and batch failure cases pass.
