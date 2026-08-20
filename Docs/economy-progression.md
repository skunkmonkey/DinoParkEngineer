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

