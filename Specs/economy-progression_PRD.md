# Economy and Progression - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`simulation-core` supplies authoritative operational facts/incidents; `content-registry` supplies balance/progression definitions; `platform-foundation` supplies Finance/Progress UI.

### Downstream Dependencies

`context-memory`, `eval-runner`, `engineering-workbench`, `review-deployment`, `park-operations`, `multi-agent-orchestration`, `curriculum-content`, `persistence`, and `telemetry` consume balances, transactions, entitlements, capabilities, and unlocks.

## Executive Summary

Economy and Progression makes engineering investment meaningful. Safe operation, attendance, satisfaction, uptime, dinosaur health, and completed work earn credits; incidents and inefficient operation cost credits/revenue. Credits buy park capacity, workers, context hardware, Park Developer capabilities, artifact commissions, and eval authoring/runs. Curriculum unlocks respond to conceptual pressure, never simply expose every solution at the start.

## User Stories

- **GIVEN** a park-day result, **WHEN** settled, **THEN** the player sees an auditable credit breakdown tied to operations rather than a mystery total.
- **GIVEN** a proposed purchase/commission/eval, **WHEN** cost is confirmed, **THEN** it succeeds exactly once or leaves balance/state unchanged.
- **GIVEN** repeated instruction cost or overflow, **WHEN** eligibility conditions are met, **THEN** relevant engineering capability/options unlock with a clear reason.
- **GIVEN** a production incident, **WHEN** resolved/settled, **THEN** costs matter but cannot produce an unrecoverable negative spiral in MVP.

## Functional Requirements

### FR-01: Credit Ledger
- FR-01.1: All balance changes SHALL be immutable ledger transactions with id, type, amount, logical time, source ref, correlation/idempotency key, and post-balance.
- FR-01.2: Credits SHALL be integer and SHALL not go below zero.
- FR-01.3: Duplicate correlation/idempotency keys SHALL return the original result.
- FR-01.4: Insufficient funds SHALL have no partial side effect.

### FR-02: Revenue and Costs
- FR-02.1: Settlement inputs include attendance, satisfaction, uptime, dinosaur health, completed/late/failed jobs, closures, and incidents.
- FR-02.2: Context use SHALL create small per-job cost/latency facts supplied by Context/operations policy; capacity upgrades do not remove quality findings.
- FR-02.3: Severity 0-4 impacts follow the application PRD and are data-driven.
- FR-02.4: Eval simulation failures do not incur production incident damage; author/run costs still apply.
- FR-02.5: Settlement SHALL be deterministic and show line items.

### FR-03: Purchases and Entitlements
- FR-03.1: Support worker robots, Manager Agent, context capacity, capability upgrades, park expansion, commissions, and eval build/run transaction categories.
- FR-03.2: Validate cost, prerequisites, progression gates, purchase limits, and expected state version atomically.
- FR-03.3: Entitlements/capabilities SHALL be queryable by stable id and level.
- FR-03.4: Manager default eligibility is four workers or an authored measured-intervention threshold, plus cost/prerequisites.

### FR-04: Curriculum Progression
- FR-04.1: Track phase 0-10, conceptual pressure signals, milestones, unlocks, and completed objectives.
- FR-04.2: Unlock rules SHALL be data-driven and evaluate deterministic gameplay events/metrics.
- FR-04.3: Create felt need before solution per application PRD phase ordering.
- FR-04.4: Unlock processing SHALL be idempotent and auditable.

### FR-05: Finance/Progress View
- FR-05.1: Show balance, recent ledger, revenue/cost breakdown, available/locked investments, capabilities, current phase/objectives, and unlock reasons.
- FR-05.2: Show safety, satisfaction, efficiency, reliability, and interventions alongside money; revenue is not the sole optimization target.

## Non-Functional Requirements

- **NFR-01: Determinism** - Same settlement/unlock events and balance version produce same result.
- **NFR-02: Atomicity** - Ledger plus entitlement/proposal/build state commit together via transaction coordinator.
- **NFR-03: Balance Data** - Tunable values live in validated content, not UI/business code.
- **NFR-04: Recovery** - MVP offers authored recovery assistance/floors so experimentation cannot irreversibly ruin a save.

## Invariants

- **INV-01:** Balance equals opening balance plus committed ledger amounts.
- **INV-02:** Credits never become negative.
- **INV-03:** One idempotency key causes at most one economic effect.
- **INV-04:** Context capacity changes budget only, not context quality.
- **INV-05:** Sandbox eval failures cannot damage production economics.

## Out of Scope

Real money, microtransactions, ads, salaries/developer roster, stock/loans, complex dynamic markets, achievement platform integration, and economy-driven random outcomes.

## Product Decisions

- **PD-01:** Failures motivate testing but experimentation remains rational.
- **PD-02:** Late-game success balances safety, satisfaction, cost, context efficiency, reliability, and attention.
- **PD-03:** Exact values are tunable content; relational principles above are fixed.

## Implementation Decisions

- **IMP-01:** Append-only double-entry is optional; append-only auditable single-currency ledger is required.
- **IMP-02:** External features request typed economic commands; they never edit balance.
- **IMP-03:** A transaction coordinator/repository provides compare-and-swap and idempotency.

## Testing Decisions

- **TST-01:** Property tests reconcile balance and enforce nonnegative/idempotent behavior.
- **TST-02:** Golden park-day settlements cover safe, inefficient, late, and severity incident days.
- **TST-03:** Unlock boundary tests cover every phase and out-of-order signals.

## Proposed Modules

- **MOD-01: CreditLedger** - Applies/query typed, idempotent transactions.
- **MOD-02: SettlementEngine** - Converts authoritative operational facts into line items.
- **MOD-03: PurchaseService** - Atomically coordinates ledger and entitlements through ports.
- **MOD-04: ProgressionEngine** - Evaluates data-driven phases, pressure, milestones, and unlocks.
- **MOD-05: FinanceProgressUI** - Explains money plus multidimensional operational success.

## Workflows

### Workflow 1: Park-Day Settlement
```text
Receive immutable operational summary -> validate unique period -> calculate revenue/cost lines -> commit ledger transaction(s) -> evaluate progression signals -> show balance and reasons.
```

### Workflow 2: Buy Eval Capability
```text
Open locked/available capability -> inspect cost/prerequisites -> confirm with idempotency key -> compare balance/progress versions -> commit debit+entitlement atomically -> emit unlock -> retry returns original result.
```
