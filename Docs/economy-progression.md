# Economy and Progression implementation notes

The economy foundation is headless and deterministic. Downstream features import
only `src/economy-progression/public.ts`.

## Credits and quotes

`createEconomyService` owns an append-only transaction ledger. A transaction has
an immutable ID, day/tick, signed amount, category, source, evidence links, and
the derived balance before/after it. `snapshot()` and `project()` calculate the
balance from `initialBalance + sum(transactions)`; no separate mutable balance
is authoritative. Projections and returned records are deeply frozen clones.

Costs use distinct categories: authoring, acquisition, runtime, eval-build,
eval-run, operation, maintenance, response, recovery, expansion, and
expression. Visitor revenue is recorded as the separate positive `revenue`
category.

The quote protocol is:

```text
quote(request) -> reserve(quote) -> commit(reservation) | cancel(reservation)
```

Quotes, reservations, commits, cancellations, and settlement IDs are
idempotent. A reservation reduces `availableBalance` without changing the
ledger. Commit writes one negative charge; cancellation releases the hold; an
insufficient or invalid operation leaves all authoritative state unchanged.

## Park-day settlement

`settleDay` consumes an exact `OperationalDaySummary` (or resolves one from a
`ParkOperationsState`) plus typed machine-readable outcome records. It never
parses human-readable incident prose. It derives three inspectable rating
contributors—safety, guest experience, and dinosaur welfare—then derives visitor
demand from the resulting single rating. Revenue is admitted attendance times
the authored visitor price. Costs are itemized and committed in one atomic
ledger batch. A stable settlement ID prevents double revenue or double costs.

The default rule set is versioned (`economy:foundation-rules@1.0.0`) and can be
provided to `createEconomyService`. The rule set is validated before use so
tuning remains content data rather than UI logic.

## Eval economics

`authorEval` records an exact `(evalId, evalVersion)` as a permanent asset and
charges one `eval-build` transaction. Re-authoring the same version is
idempotent and free. `runEval` requires that exact asset and charges the
comparatively cheap `eval-run` category once per stable `runId`.

## Capability progression

The foundation progression contains `capability:context-optimization@1.0.0`.
It starts `locked`; an explicit machine-readable pressure such as
`pressure:missing-context` changes it to `available`, without spending credits
or enabling the action. `purchaseCapability` is the separate intentional
acceptance step. A successful purchase records an `acquisition` transaction and
exposes the concrete `action:route-context` action. Repeating either pressure
or purchase commands is deterministic and idempotent.

## Expressive reward inventory

The foundation reward is
`reward:dinosaur-plushie@1.0.0`, bound to the approved runtime asset
`assets:reward-dinosaur-plushie@1.0.0`. When an exact runtime asset catalog is
provided, purchase fails closed if that asset cannot be resolved. The purchase
uses the separate `expression` category and creates one immutable inventory
item. `placeReward` and `removeReward` maintain exact placement records with a
location, visibility-to-visitors flag, and tick provenance; the projection is
serializable through `economyLedgerProjectionSchema` for persistence. The
definition fixes `mechanicalBonus` at zero, so the plushie personalizes the park
without increasing demand, rating, revenue, or future production leverage.

The `/economy` browser route exposes the first-day settlement, separate
capability offer and purchase, the resulting Workbench action, and the complete
reward inventory workflow. The placed plushie is cropped from the approved
local MVP atlas and has a persistent text equivalent naming its gift-shop
location, visitor visibility, exact asset identity, and zero mechanical bonus.
