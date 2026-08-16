# Plan: Review, Evaluation, and Deployment

## Implementation Boundary and Contracts

Own review revisions/state, change analysis orchestration, eval association, active exact-ref mapping, deployment/revert transactions, audit records, and Reviews route. Do not author content, calculate CU/assertions, execute jobs, or mutate registry record bodies.

```ts
interface ReviewService { submit(input:ReviewProposal):Result<ReviewRecord,ReviewError>; analyze(reviewId:string):ChangeAnalysis; selectEvals(command:EvalSelectionCommand):Result<ReviewRecord,Conflict>; attachRun(command:AttachEvalRunCommand):Result<ReviewRecord,Conflict>; requestRevision(command:RevisionRequest):Result<ReviewRecord,Conflict>; }
interface DeploymentService { validate(reviewId:string):DeploymentAssessment; deploy(command:{reviewId:string; expectedReviewVersion:number; acknowledgeWarningCodes:string[]; transactionId:string}):Result<DeploymentRecord,DeploymentError>; revert(command:{artifactId:string; targetRef:ArtifactRef; transactionId:string}):Result<DeploymentRecord,DeploymentError>; resolveActive(artifactId:string):ArtifactRef|undefined; }
```

All commands carry expected versions/idempotency keys. Persistence provides the transaction boundary; registry stores immutable bodies/status transitions; running jobs remain pinned.

## Proposed Vertical Slices

1. Review safe feeding Skill source/clause diff and impact
   - Blocked by: registry, context, shell, workbench intake
   - Add review state/revision, exact base/proposal, source diff default, clause/dependency/tool/context analysis, and stale-action rejection.
2. Select/run evals and diagnose a failure from Review
   - Blocked by: #1 and Eval Service/Trace links
   - Add catalog/suite overrides, build/run cost flow, exact-subject association, failed assertion detail, replay, and stale-result invalidation.
3. Validated atomic deployment
   - Blocked by: #1, #2, persistence transaction contract
   - Check registry/deps/tools/context/hard gates, show warnings, require acknowledgements, activate exact ref atomically, and prove future-only effect.
4. Revision and rerun workflow
   - Blocked by: #2, #3 and workbench revision adapter
   - Capture reason, immutable review revision, historical/stale old results, rerun new exact subject, and transition tests.
5. Auditable revert and concurrency hardening
   - Blocked by: #3
   - Restore previous ref via new record, retain full history, reject racing deploy/revert, inject transaction failures, keyboard/a11y polish, and adapter docs.

## Completion Gate

Perform the PRD’s v3→v4 workflow including one failed eval, revision, passing rerun, deployment, and revert. Verify exact refs, future-only activation, stale-result handling, warning vs hard-gate behavior, atomicity under injected failures, optimistic conflicts, accessibility, tests, typecheck, and build.
