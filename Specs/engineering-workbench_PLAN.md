# Plan: Engineering Asset Workbench

## Implementation Boundary and Contracts

Own Engineering route, asset/detail projections, commission catalog/service, and capability presentation. Do not own registry internals, CU algorithms, economy ledger, review state machine, eval execution, or deployed mutation.

```ts
interface WorkbenchService {
  listAssets(query:AssetQuery):readonly AssetSummary[];
  getAsset(ref:ArtifactRef):AssetDetail|undefined;
  listCommissions(progress:ProgressSnapshot):readonly CommissionOffer[];
  commission(recipeRef:VersionedRef, choices:StructuredChoice[], transactionId:string):Result<CommissionResult,CommissionError>;
}
interface ReviewIntakePort { submit(proposal:ArtifactVersion, meta:ChangeIntent):Result<{reviewId:string},ReviewIntakeError>; }
```

Use registry/context/economy/progression/eval-summary adapters through ports. Proposal creation plus charge plus review intake must have an application-level atomic/idempotent coordinator or compensating transaction defined by the persistence implementation.

## Proposed Vertical Slices

1. Inspect Prompt and Skill source plus exact architecture data
   - Blocked by: shell, registry, context projection
   - Build library/detail, filters, source default, clause advanced view, context composition, deps/tools/tags/status/history/used-by.
2. Commission one safe feeding Skill into Review
   - Blocked by: #1, economy transaction port, review intake port
   - Add authored offer, cost/prerequisites, confirmation, exact proposal generation, atomic/idempotent submission, and no deployed mutation.
3. Capability-gated catalog for all artifact families
   - Blocked by: #2 and progression query
   - Display seven capability areas; locked reasons; Prompt/Skill/System Prompt/Knowledge/Tool/memory recipes; structured choices only.
4. Eval coverage and cross-feature navigation
   - Blocked by: #1 and eval summary/review query ports
   - Add authored coverage, last results, exact history/review links, deep-link targets, unavailable adapter states, and accessibility.
5. Failure recovery and contract hardening
   - Blocked by: #3, #4
   - Cover insufficient credits, stale progress, registry validation, duplicate submit, review rejection, retry/compensation, keyboard flows, and public adapter docs.

## Completion Gate

Inspect historical/deployed assets and commission a new safe Skill proposal exactly once into Review while the deployed version stays unchanged. Verify all detail fields, locked reasons, context totals from the source service, transaction failure recovery, no arbitrary prose execution, accessibility, tests, typecheck, and build.
