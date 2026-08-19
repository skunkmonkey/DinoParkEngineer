# Plan: Review and Deployment

## Proposed Vertical Slices

1. **The opening candidate becomes an inspectable change request**
   - Blocked by: Workbench #1-#4, Content Registry #1-#3,
     Player Experience #4
   - Adds immutable request, goal/author/base/candidate, readable/behavioral diff,
     context/dependency/tool deltas, expected effect, risk evidence, Workbench
     and causal links.
   - Tests: exact projection, stale/mutated candidate rejection, stable diff
     identity, no production change, and accessible long diff.
   - Browser proof: inspect the opening fix end to end.

2. **Selected eval evidence remains attached to the review**
   - Blocked by: #1, Eval Runner #1-#4
   - Adds case/suite selection, cost quote link, immutable result binding,
     passed/failed/invalid/interrupted/omitted states, replay links, and evidence
     considered record.
   - Tests: exact case/result versions, stale result mismatch, omitted risk,
     failed evidence, rerun attachment, and no confidence score.
   - Browser proof: run the free eval, return to the same review, and inspect it.

3. **Intentional deployment changes only future jobs**
   - Blocked by: #2, Park Operations #1-#2
   - Adds review decision, exact confirmation, production slot, resolved manifest
     fingerprint, atomic activation, prior deployment link, and job pin adapter.
   - Tests: before/after jobs, unresolved dependency, required evidence, cancel,
     duplicate command, partial failure, and immutable records.
   - Browser proof: deploy, return to Park View, rerun successfully, and inspect
     the old job still pinned to the old version.

4. **Request changes and retain production create no hidden deployment**
   - Blocked by: #1-#2
   - Adds feedback linkage, decision records, new Workbench request entry, retain
     decision, and review history.
   - Tests: candidate preserved, feedback exact, current deployment unchanged,
     revised candidate requires new review, and invalid transitions.
   - Browser proof: request changes, revise, and compare both reviews.

5. **Revert creates a new explicit deployment and preserves failure history**
   - Blocked by: #3-#4
   - Adds history query, associated jobs/incidents/evals, historical selection,
     compatibility check, revert confirmation, and causal links.
   - Tests: new record, exact historical manifest, old failed record preserved,
     jobs after revert, missing version block, and repeated revert.
   - Browser proof: deploy a failing fixture, inspect incident, revert, and replay
     both histories.

6. **Review and Deployment validation gate**
   - Blocked by: #1-#5
   - Adds architecture lint, rendered accessibility tests, governance golden
     history, and full validation.
   - Browser proof: review, eval attach, request changes, retain, deploy, revert,
     deep-link, keyboard-only, text scaling, and non-color diffs.
