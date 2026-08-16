# Engineering Asset Workbench public boundary

The Workbench consumes the public `ContentRegistry`, `ContextService`, Economy
progression snapshot/transaction port, Eval summary port, and Review intake
port. Its headless entry point is `engineering-workbench/index.ts`; the framed
route/provider entry point is `src/engineering-workbench/public.ts`.

## Exact asset reads

`createWorkbenchService({ registry, context, contextProfiles, evals, reviews,
deployment })` exposes `listAssets(query)` and `getAsset(ref)`. Asset detail is
source-first and includes immutable version history, semantic clause summaries,
Context Service projections, direct/transitive dependencies, Tool descriptions,
applicability tags, eval coverage/results, Review links, and used-by records.
The Workbench does not calculate CU; each projection calls `ContextService` and
reports the returned total/items or explicit overflow diagnostics.

## Commission boundary

`commission(recipeRef, choices, transactionId)` accepts only authored
`StructuredChoice` records. It creates a registry-valid `REVIEW` artifact and
submits it through `ReviewIntakePort`; it never edits a deployed record. The
Economy transaction uses the authored commission cost and expected balance
version. Successful transaction ids return the original result with
`duplicate: true`. Failed Review intake removes the exact unpublished proposal
and its now-empty provisional pack, then compensates the charge; the error
reports recovery complete only when both steps succeed. A transient failure can
retry with the same public transaction id: internal retry charge keys preserve
ledger idempotency while leaving exactly one net charge after success.

The catalog includes authored Skill, Tool, Eval-configuration, and Memory-
configuration recipes. Each structured option selects a preauthored source and
semantic-clause pair; no arbitrary prose is accepted or executed. The first
authored recipe is
`workbench.recipe.safe-feeding-skill@1`, which proposes
`review.skill.carnivore-feeding@5` from deployed v3. Its source and semantic
clauses are authored as one immutable pair. The recipe intentionally uses the
existing standard feeding Prompt and Tool ids, adds bait/containment
postconditions, and escalates a failed closure.

## Integration notes

Workbench loads its own versioned baseline pack for Tool, Eval, and Memory
configuration proposals, then expects public providers for trace/content/context, economy,
evals, and review/deployment. The canonical route is `/engineering`. The
Platform Foundation placeholder route must be excluded when the Workbench is
registered so the shell has one owner for that path.
