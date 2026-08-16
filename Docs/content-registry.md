# Content Registry authoring

The headless entry point is `content-registry/index.ts` (also re-exported from
`src/content-registry/public.ts`). Authored data is loaded as a `ContentPack`;
no route or UI code is involved.

## Adding a pack

1. Give the pack a unique `packId` and `schemaVersion: 1`.
2. Give every artifact and family record a namespaced stable id and positive
   version.
3. Keep display `sourceText` beside machine-readable `clauses`. Runtime
   behavior is driven by clauses, never by parsing source text.
4. Reference dependencies by exact `{ artifactId, version }` refs. Missing refs,
   cycles, missing tools, malformed clauses, and invalid simulation fixtures
   reject the complete pack atomically.
5. Load the pack through `createContentRegistry().loadPack(pack)`. A successful
   result returns a canonical manifest; a failed result returns diagnostics with
   pack, record/ref, field path, stable code, and an actionable message.

Authored `toolDescriptions` are immutable registry records as well: use
`getToolDescription`, `queryToolDescriptions`, and the manifest's sorted
`toolDescriptions` ids. Declaring a Tool Description makes that tool id
available to artifact validation. `usedBy` reports artifact dependencies plus
eval `subjectRef` and scenario `artifactRefs` consumers.

`createValidReferencePack()` and `createInvalidDiagnosticPack()` are small,
namespaced contract fixtures. MVP curriculum prose and authored gameplay packs
remain owned by the curriculum-content feature.

## Versioning and deployment

Exact refs never float. Resolve historical content with `getArtifact({
artifactId, version })`; resolve the explicitly deployed current version with
`getCurrentArtifact(artifactId)`. Use `transition(ref, expectedStatus,
nextStatus)` for lifecycle changes. A stale expected status returns a conflict,
and deploying a newer version retires the previous deployed version without
deleting its history.
