# Plan: Economy and Progression

## Implementation Boundary and Contracts

Own credit ledger, deterministic settlement, purchase/entitlement coordination, capability/progression rules/state, and Finance/Progress route. Do not own operational fact generation, context algorithms, eval/artifact creation, review, robot behavior, or save storage implementation.

```ts
interface EconomyService { balance():CreditBalance; transact(command:CreditCommand):CreditResult; settle(input:ParkPeriodSummary):SettlementResult; ledger(query?:LedgerQuery):readonly LedgerEntry[]; }
interface ProgressionService { snapshot():ProgressSnapshot; process(event:ProgressEvent):readonly UnlockEvent[]; can(id:string):Eligibility; purchase(command:PurchaseCommand):PurchaseResult; }
type CreditCommand={transactionId:string; type:string; amount:number; sourceRef:string; expectedBalanceVersion:number};
```

Amounts are signed integers; debits cannot overdraw. Cross-feature purchase results rely on a persistence transaction coordinator or explicit reservation/commit/cancel protocol documented by the adapter.

## Proposed Vertical Slices

1. Earn credits from one safe park-day with visible ledger
   - Blocked by: content balance config and operation summary contract
   - Add integer ledger, unique period settlement, line-item UI, reconciliation/property tests, and deterministic safe/late/incident fixtures.
2. Idempotent purchase/transaction port
   - Blocked by: #1 and persistence transaction contract
   - Add insufficient funds, expected-version conflicts, duplicate keys, atomic entitlement port, failure injection, and consumer contract tests.
3. Park Developer capability phases 0-7
   - Blocked by: #2 and progression content
   - Track pressure/milestones, unlock Prompt→Skill→System Prompt→Context→Evals→Review→Memory in authored order with reasons/audit.
4. Workers, context capacity, and orchestration phases 8-10
   - Blocked by: #2, #3
   - Purchase workers/capacity, track interventions, gate Manager at four workers or threshold, expose late-game multidimensional metrics, and prove capacity does not alter findings.
5. Recovery, balancing adapters, and UI hardening
   - Blocked by: #3, #4
   - Add authored recovery floor/assistance, no double settlement, sandbox-vs-production costs, full investment catalog projections, accessibility, and balance-config validation.

## Completion Gate

Settle safe and incident days, buy a capability exactly once, reject overdraw/races, progress through authored pressure gates, and unlock Manager only at its rule. Reconcile all balances, inject transaction failures, verify no sandbox damage or hidden UI constants, and pass tests/typecheck/accessibility/build.
