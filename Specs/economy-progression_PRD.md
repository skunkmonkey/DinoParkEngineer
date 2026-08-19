# Economy and Progression - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Park Operations | Supplies attendance, day outcomes, incidents, closures, and interventions. |
| 2 | Review and Deployment | Supplies governed engineering milestones and recovery deployments. |
| 3 | Content Registry | Resolves exact cost, reward, unlock, and expansion definitions. |

### Downstream Dependencies

Workbench, Eval Runner, Rendering/Player Experience, Incident Response,
Orchestration, Persistence, Curriculum Content, and Telemetry consume quotes,
transactions, capabilities, rating, credits, unlocks, or rewards.

## Executive Summary

Economy and Progression turns safe enjoyable park operation into resources and
new engineering leverage. Money and park rating are the two headline
motivators. Rating explains safety, guest experience, and dinosaur welfare and
drives demand; attendance produces revenue. Credits fund engineering, evals,
robots, context choices, rescue, expansion, and expression. Upgrades introduce
tradeoffs and new player actions rather than a linear better-is-bigger ladder.

## User Stories

### Earn and Understand

- **GIVEN** a completed park day, **WHEN** outcomes are settled, **THEN** rating,
  demand, attendance, revenue, costs, and resulting balance derive from exact
  operational records.
  - **Acceptance Criteria:** Rating inspection exposes contributing causes
    without creating extra headline currencies.
- **GIVEN** a serious incident, **WHEN** consequences settle, **THEN** rating,
  demand, closures, and recovery costs make preventive engineering valuable.
  - **Acceptance Criteria:** Refusing rescue solely to avoid a fee cannot be the
    optimal outcome once lives are at risk.

### Progress and Choose

- **GIVEN** earned credits and prerequisites, **WHEN** a capability unlocks,
  **THEN** the player chooses whether and when to buy/accept it and gains a new
  action or architectural option.
  - **Acceptance Criteria:** Permanent park expansion is never silently imposed.
- **GIVEN** stable mastery, **WHEN** the player wants expression rather than
  power, **THEN** visible rewards personalize the park without large mechanical
  bonuses.
  - **Acceptance Criteria:** Expression does not create a rich-get-richer spiral.

## Functional Requirements

### FR-01: Ledger and Transactions

- FR-01.1: Every credit change SHALL be an immutable transaction with stable ID,
  tick/day, amount, category, source command/outcome, balance before/after, and
  related entity/artifact/eval/incident IDs.
- FR-01.2: Transactions SHALL be atomic, idempotent by command/settlement ID, and
  reject insufficient funds unless an explicit recovery rule applies.
- FR-01.3: Quotes SHALL identify acquisition/authoring, runtime, eval run,
  maintenance, response, recovery, expansion, and expression costs separately.
- FR-01.4: Displayed balances and summaries SHALL derive from the ledger.

### FR-02: Rating, Demand, and Revenue

- FR-02.1: Park rating SHALL be the single headline reputation measure and use
  authored deterministic contribution rules.
- FR-02.2: Inspectable contributors SHALL include safety, guest experience, and
  dinosaur welfare as applicable without becoming separate spendable currencies.
- FR-02.3: Rating SHALL influence visitor demand; admitted/served visitors and
  authored prices/costs SHALL determine revenue.
- FR-02.4: Injury, death, unresolved incidents, closure, stable safe operation,
  and demonstrated recovery SHALL have explicit deterministic effects.
- FR-02.5: Waiting alone SHALL not restore safety trust after suspension.

### FR-03: Engineering Economy

- FR-03.1: Artifact authoring/acquisition cost SHALL be distinct from runtime
  context/tool/operation cost.
- FR-03.2: Eval case authoring SHALL have meaningful one-time cost and later runs
  SHALL be comparatively cheap.
- FR-03.3: Context capacity MAY provide relief while retaining recurring cost
  and relevance/duplication/staleness/retention tradeoffs.
- FR-03.4: More expensive, larger, or higher-capacity options SHALL not be
  universally superior.

### FR-04: Capability Progression

- FR-04.1: Progression SHALL unlock Park Developer capabilities, artifacts,
  evals, tools, memory, robots, Agent configurations, retention strategies,
  orchestration, Incident Response authority, expansion, and expression through
  exact prerequisites.
- FR-04.2: Capabilities SHALL unlock new actions, content, or configuration;
  pure invisible percentage upgrades require explicit justification.
- FR-04.3: Problem pressure SHALL precede the tool intended to resolve it.
- FR-04.4: Unlock availability and purchase/acceptance SHALL be separate states.

### FR-05: Expansion and Expression

- FR-05.1: Permanent species, enclosure, area, or operating-scope expansion
  SHALL require intentional acceptance after prerequisites.
- FR-05.2: Temporary contracts MAY impose bounded responsibilities with explicit
  duration and reward.
- FR-05.3: Expressive rewards SHALL include visible park/store merchandise,
  decorations, signage, robot cosmetics, or memorabilia as content permits.
- FR-05.4: Expressive rewards SHALL not provide large compounding production
  advantages.

### FR-06: Suspension and Restricted Recovery Economy

- FR-06.1: Catastrophic safety or financial conditions MAY trigger Operating
  License Suspended through authored exact thresholds and evidence.
- FR-06.2: Suspension SHALL stop visitor revenue and preserve history, layout,
  unlocks, artifacts, evals, and collectibles.
- FR-06.3: If mandatory recovery is unaffordable, restricted resources SHALL fund
  only stabilization, mandated evals, and compliant reopening deployment.
- FR-06.4: Restricted support MAY create explicit debt, rating cap, or temporary
  restriction but SHALL prevent an unrecoverable primary save.

## Non-Functional Requirements

- **NFR-01: Explainability** - Every displayed economic value traces to exact
  rules and records.
- **NFR-02: Balance evidence** - Numeric tuning follows prototypes/playtests and
  lives in versioned content rather than hard-coded UI.
- **NFR-03: Recoverability** - The primary campaign cannot become permanently
  unplayable due only to insufficient recovery funds.
- **NFR-04: Determinism** - Identical outcomes and commands produce exact ledger,
  rating, unlock, and suspension transitions.

## Invariants

- **INV-01:** Money and rating are the headline motivators.
- **INV-02:** Permanent expansion is player-paced.
- **INV-03:** Higher price/context/capacity is not universally better.
- **INV-04:** Rescue economics never reward avoidable casualties.
- **INV-05:** Primary campaign catastrophe creates active recoverable work, not
  save deletion.

## Out of Scope

- Real-money purchases, ads, subscriptions, or online economy.
- Developer salaries/candidates/team management.
- Exact final balance values before prototype evidence.
- Direct ownership of incident stabilization or deployment rules.

## Product Decisions

- **PD-01: Rating plus money** - Clear motivations with inspectable contributors.
- **PD-02: Evals compound in value** - Author once, rerun cheaply.
- **PD-03: Local mastery, global challenge** - Stable systems remain stable;
  chosen scale adds new pressure.
- **PD-04: Expression supplements power** - Success personalizes the park.

## Implementation Decisions

- **IMP-01:** Use an append-only ledger and pure versioned rule evaluators.
- **IMP-02:** Keep tunable values in validated content packages with exact
  versions used by settlements.
- **IMP-03:** Quote/reserve/commit/cancel ports prevent partial cross-feature
  charges.
- **IMP-04:** Expose only `src/economy-progression/public.ts`.

## Testing Decisions

- **TST-01:** Ledger tests cover idempotency, atomicity, insufficiency, refund/
  cancellation policy, and derived balances.
- **TST-02:** Rating/demand fixtures trace every contribution and casualty rule.
- **TST-03:** Progression tests cover prerequisites, opportunity versus
  acceptance, problem-before-tool, and no silent expansion.
- **TST-04:** Recovery tests prove no dead save and fair rescue economics.

## Proposed Modules

- **MOD-01: Economy Ledger** - Owns immutable exact transactions and balances.
- **MOD-02: Quote Coordinator** - Reserves and settles cross-feature costs safely.
- **MOD-03: Rating and Demand Engine** - Derives explainable reputation and
  attendance demand from exact outcomes.
- **MOD-04: Progression Service** - Owns capability prerequisites, availability,
  purchase, and acceptance.
- **MOD-05: Expansion and Rewards Catalog** - Owns optional permanent scope and
  expressive inventory/placement eligibility.
- **MOD-06: Recovery Finance** - Provides restricted non-deadlocking support.

## Workflows

### Workflow 1: Settle a Park Day

```text
1. Receive exact day outcomes and operational records.
2. Evaluate rating contributors and demand effects with pinned rules.
3. Calculate attendance revenue and itemized operating costs.
4. Commit idempotent ledger transactions.
5. Evaluate capability/expansion opportunities without auto-accepting them.
6. Present a concise summary with drill-down evidence.
```

### Workflow 2: Author and Run an Eval

```text
1. Workbench requests an eval-authoring quote.
2. Economy reserves and commits the one-time cost on successful creation.
3. The case becomes a permanent asset.
4. Later Review requests a much smaller run-cost quote.
5. Completed or policy-defined interrupted execution settles the transaction.
```
