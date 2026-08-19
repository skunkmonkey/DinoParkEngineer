# Rendering asset briefs and provenance

The A2 pipeline establishes authoring and review boundaries before any final art
is generated. Runtime code addresses stable namespaced asset IDs. Brief,
candidate, source, runtime asset, and bundle revisions use exact immutable
versions; filenames and display names are never identities.

## Boundaries

- `assets/briefs` contains Content Registry records for shared art direction and
  exact asset-brief revisions.
- `assets/source` is quarantine for generated or edited source candidates.
- `assets/manifests` contains candidate provenance, immutable review records,
  and the generated human-review report.
- `public/assets` is reserved for later deterministic compiler output. An asset
  can enter this boundary only through an exact hash-bound approval.

The built-in MVP robot brief is validated as `AssetBrief@1` through the Content
Registry public API. It depends on the exact shared three-quarter art-direction
record and declares its semantic role, required view, scale, source canvas, safe
bounds, pivot, animation behavior, variant, and non-image accessibility
equivalents.

## Candidate import and review

Candidate provenance records the model alias and optional snapshot, prompt and
brief revisions, reference inputs, generation parameters, timestamp, exact
source hash, parent lineage, and usage rights. Import compares the manifest hash
with the candidate bytes and rejects secret-like keys or values. Successful
imports are deeply immutable and always return `quarantine: "unapproved"`.

Review never mutates a candidate. `approved`, `rejected`, `superseded`, and
`request-revision` are append-only records attributed to a reviewer and time,
and bind an exact candidate, source version, and hash. Runtime-input selection
uses only the latest valid `approved` record for those exact bytes. A later
supersede or rejection removes the candidate from new bundle inputs without
changing historical records. Duplicate or case-colliding candidate and review
identities invalidate their catalogs and are excluded from bundle inputs.

Run `npm run assets:review-report` to validate the built-in catalog and
deterministically regenerate the HTML checklist. The report is a human review
aid; it never records approval itself. Normal build, test, and play workflows do
not call an image model or require a network connection, account, or secret.
Run `npm run assets:review-report:serve`, then open the reported loopback URL,
to inspect the generated report in a browser without copying authoring artifacts
into the shipped runtime asset boundary.
