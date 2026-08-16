# Reviews / Deploy adapter

The review/deployment feature exposes two public services from
`review-deployment/index.ts` and the production route from
`src/review-deployment/public.ts`.

## Exact-reference workflow

1. `ReviewService.submit` stores immutable `baseRef` and `proposedRef` values.
2. `selectEvals` and `attachRun` require optimistic review versions and retain
   the exact subject ref on every result.
3. `requestRevision` creates a new immutable revision and marks prior
   associations `STALE`; stale results never satisfy the current selection.
4. `DeploymentService.validate` separates hard gates from acknowledged risk
   warnings. `deploy` requires the expected review version, warning codes, and
   a transaction id before changing lifecycle, active mapping, and audit state.
5. `revert` accepts a concrete historical `ArtifactRef` only and appends a new
   audit record. It also requires the caller's observed deployment version.
   Active mappings therefore affect only subsequently resolved work; running
   jobs retain their pinned refs.

Deployment takes lifecycle, review, active-map, audit, and known-ref snapshots
before entering the persistence adapter. Any injected failure—or an adapter
that executes its callback and then throws—restores every snapshot before the
error is returned.

Park Operations receives `DeploymentService.resolveActive` through its public
provider dependency. The authored Park Safe Feeding selector is explicitly
aliased to the canonical `review.skill.carnivore-feeding` identity; no title or
version inference is used. Preflight/job intake resolves that identity once and
stores the resulting exact ref on the new job. Previously created jobs are
never retargeted.

Transaction ids are permanently bound to a canonical command kind and payload.
An exact retry returns its prior record, while reuse for a different deploy or
revert payload returns `IDEMPOTENCY_CONFLICT` even if the first attempt failed.

The `/reviews` route is registered lazily by `reviewDeploymentModule` and is
safe to initialize with the shared Trace/Context/Eval providers. The demo
fixture seeds the v3 active ref and exposes the v3 → v4 review workflow for
local verification.

Scoped verification:

```text
node --experimental-strip-types --test tests/review-deployment.test.ts
node scripts/check-architecture.mjs
```
