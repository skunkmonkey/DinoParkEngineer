# Plan: Versioned Content Registry

## Implementation Boundary

Own content schemas, pack loader, validation, immutable record storage, dependency/used-by indexes, canonical manifest, and tests. Do not own editor screens, lifecycle business workflow, execution, context costs, save slots, or starter curriculum prose (owned by `curriculum-content`). Eval definitions are authored content; player built status, suites, and run history are runtime state owned by `eval-runner`.

## Required Public Contracts

```ts
type ArtifactRef = { artifactId: string; version: number };
interface ContentRegistry {
  loadPack(pack: ContentPack): Result<ContentManifest, ContentDiagnostic[]>;
  getArtifact(ref: ArtifactRef): ArtifactVersion | undefined;
  queryArtifacts(query: ArtifactQuery): readonly ArtifactVersion[];
  dependencies(ref: ArtifactRef, transitive?: boolean): readonly ArtifactRef[];
  usedBy(ref: ArtifactRef): readonly ContentRef[];
  getEval(ref: VersionedRef): EvalCaseDefinition | undefined;
  getScenario(ref: VersionedRef): ScenarioDefinition | undefined;
  manifest(): ContentManifest;
}
```

The registry returns immutable values or defensive copies; list order is stable. `loadPack` is atomic. Lifecycle mutation, if exposed, accepts an exact ref plus expected current status and returns a conflict instead of last-write-wins.

## Proposed Vertical Slices

1. Load and exactly resolve one Prompt/Skill pack
   - Blocked by: simulation fixture/entity schemas
   - Add pack versioning, artifact/ref schemas, runtime diagnostics, atomic loading, stable lookup, and source-plus-clause validation.
2. Dependency graph, tools, applicability, and relationship queries
   - Blocked by: #1
   - Add cycle rejection, transitive dependencies, required tool validation, tags, used-by, stable queries, and negative fixtures.
3. Eval, scenario, dinosaur, enclosure, and progression record families
   - Blocked by: #1 and the simulation public schema
   - Validate/store/query remaining content families without embedding their execution logic.
4. Immutable version history and legal lifecycle transitions
   - Blocked by: #2
   - Enforce exact version identity, no published mutation, no floating ref substitution, expected-status conflicts, retirement without deletion, and historical resolution.
5. Canonical manifests and authoring documentation
   - Blocked by: #3, #4
   - Export stable save/replay manifests, provide one valid reference pack and invalid diagnostic pack, document how to add content without core-code changes, and run all contract tests.

## Integration and Completion Gate

Prove a pack with two Skill versions can resolve both after the newer version is deployed; prove cycles and partial packs do not mutate the registry; prove every query is stably ordered; and prove consumers need only the public entry point. Typecheck, tests, schema fixture validation, and canonical-manifest snapshots must pass.
