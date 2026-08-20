# Review and Deployment

The public boundary is `src/review-deployment/public.ts`. The service owns
immutable change requests, exact Eval selections and results, review decisions,
active production slots, future-job pins, explicit revert records, and causal
governance history.

Creating or evaluating a candidate never changes production. A deployment must
be confirmed with the exact reviewed version, production slot/scope, manifest
fingerprint, evidence IDs, actor, and logical tick. Manifest resolution uses the
Content Registry public contract when the candidate is registered; an immutable
candidate snapshot is the explicit opening-workflow fallback. Validation occurs
before any active-slot mutation, so unresolved content or mismatched confirmation
fails closed.

Jobs call `pinJob` when created. That records the deployment and all exact
manifest versions once; later deployment or revert records cannot float the job.
A revert is a new deployment record pointing at a reviewed historical manifest.
Review, Eval, Trace/replay, deployment, job, incident, feedback, and revert links
remain queryable through the append-only governance history.

The service exposes structured evidence states for passed, failed, invalid,
timed-out, interrupted, and omitted Evals. Failed or invalid evidence is rejected
unless it includes a real Trace/replay diagnosis link. No confidence or approval
score is synthesized.
