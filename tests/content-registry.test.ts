import assert from "node:assert/strict";
import test from "node:test";
import {
  createContentRegistry,
  createInvalidDiagnosticPack,
  createValidReferencePack,
  type ArtifactVersion,
  type ContentPack,
} from "../content-registry/index.ts";

function artifact(overrides: Partial<ArtifactVersion> = {}): ArtifactVersion {
  return {
    artifactId: "fixture.registry.test.artifact",
    version: 1,
    type: "SKILL",
    title: "Registry Test Skill",
    sourceText: "Perform the deterministic test action.",
    clauses: [{ id: "fixture.registry.test.clause", sourceText: "Perform the action.", type: "ACTION", action: { tool: "observe" } }],
    dependencies: [],
    applicabilityTags: ["task:test"],
    requiredToolIds: ["observe"],
    status: "DRAFT",
    authoredByCapability: "fixture.registry.test",
    createdAtGameTime: 0,
    ...overrides,
  };
}

function pack(packId: string, artifacts: readonly ArtifactVersion[]): ContentPack {
  return { schemaVersion: 1, packId, artifacts };
}

test("slice 1 loads exact prompt/skill records atomically and returns diagnostics", () => {
  const registry = createContentRegistry();
  const loaded = registry.loadPack(createValidReferencePack());
  assert.equal(loaded.ok, true);
  assert.ok(registry.getArtifact({ artifactId: "fixture.registry.skill.safe-feed", version: 1 }));
  assert.equal(registry.getArtifact({ artifactId: "fixture.registry.skill.safe-feed", version: 2 }), undefined);
  assert.equal(Object.isFrozen(registry.getArtifact({ artifactId: "fixture.registry.skill.safe-feed", version: 1 })), true);
  const before = registry.canonicalManifest();
  const rejected = registry.loadPack(createInvalidDiagnosticPack());
  assert.equal(rejected.ok, false);
  assert.equal(registry.canonicalManifest(), before);
  if (!rejected.ok) {
    assert.ok(rejected.error.every((diagnostic) => diagnostic.packId === "fixture.registry.invalid"));
    assert.ok(rejected.error.some((diagnostic) => diagnostic.code === "MALFORMED_SOURCE"));
  }
});

test("slice 2 rejects dependency cycles and exposes stable dependency/used-by queries", () => {
  const first = artifact({ artifactId: "fixture.registry.test.a", version: 1, dependencies: [{ artifactId: "fixture.registry.test.b", version: 1 }] });
  const second = artifact({ artifactId: "fixture.registry.test.b", version: 1, dependencies: [{ artifactId: "fixture.registry.test.a", version: 1 }] });
  const registry = createContentRegistry();
  const rejected = registry.loadPack(pack("fixture.registry.cycle", [first, second]));
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.ok(rejected.error.some((diagnostic) => diagnostic.code === "DEPENDENCY_CYCLE"));
  assert.deepEqual(registry.manifest().artifacts, []);

  const base = artifact({ artifactId: "fixture.registry.test.base", version: 1 });
  const middle = artifact({ artifactId: "fixture.registry.test.middle", version: 1, dependencies: [{ artifactId: base.artifactId, version: 1 }] });
  const leaf = artifact({ artifactId: "fixture.registry.test.leaf", version: 1, dependencies: [{ artifactId: middle.artifactId, version: 1 }, { artifactId: base.artifactId, version: 1 }] });
  assert.equal(registry.loadPack(pack("fixture.registry.graph", [leaf, middle, base])).ok, true);
  assert.deepEqual(registry.dependencies({ artifactId: leaf.artifactId, version: 1 }), [
    { artifactId: base.artifactId, version: 1 },
    { artifactId: middle.artifactId, version: 1 },
  ]);
  assert.deepEqual(registry.dependencies({ artifactId: leaf.artifactId, version: 1 }, true), [
    { artifactId: base.artifactId, version: 1 },
    { artifactId: middle.artifactId, version: 1 },
  ]);
  assert.deepEqual(registry.usedBy({ artifactId: base.artifactId, version: 1 }), [
    { artifactId: leaf.artifactId, version: 1 },
    { artifactId: middle.artifactId, version: 1 },
  ]);
  assert.deepEqual(registry.queryArtifacts({ tag: "task:test" }).map((item) => `${item.artifactId}@${item.version}`), [
    "fixture.registry.test.base@1",
    "fixture.registry.test.leaf@1",
    "fixture.registry.test.middle@1",
  ]);
});

test("slice 3 stores eval/scenario definitions and validates simulation fixtures", () => {
  const registry = createContentRegistry();
  const packValue = createValidReferencePack();
  assert.equal(registry.loadPack(packValue).ok, true);
  assert.equal(registry.getEval({ artifactId: "fixture.registry.eval.safe-feed", version: 1 })?.built, false);
  assert.equal(registry.getScenario({ artifactId: "fixture.registry.scenario.feeding", version: 1 })?.fixture.id, "fixture.starter");
  assert.equal(registry.queryEvals({ tag: "risk:low" }).length, 1);
  const invalidFixture = { ...packValue, packId: "fixture.registry.bad-fixture", evals: [{ ...packValue.evals?.[0], id: "fixture.registry.eval.bad", fixture: { ...packValue.evals?.[0].fixture, id: "", zones: [] } }] } as ContentPack;
  const rejected = registry.loadPack(invalidFixture);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.ok(rejected.error.some((diagnostic) => diagnostic.code === "INVALID_FIXTURE"));
});

test("slice 4 preserves historical versions and rejects stale lifecycle writes", () => {
  const registry = createContentRegistry();
  const first = artifact({ artifactId: "fixture.registry.versioned.skill", version: 1, status: "DEPLOYED" });
  assert.equal(registry.loadPack(pack("fixture.registry.version.one", [first])).ok, true);
  const second = artifact({ artifactId: first.artifactId, version: 2, status: "REVIEW", sourceText: "A newer source." });
  assert.equal(registry.loadPack(pack("fixture.registry.version.two", [second])).ok, true);
  assert.equal(registry.getArtifact({ artifactId: first.artifactId, version: 1 })?.sourceText, first.sourceText);
  assert.equal(registry.transition({ artifactId: second.artifactId, version: 2 }, "REVIEW", "DEPLOYED").ok, true);
  assert.equal(registry.getCurrentArtifact(first.artifactId)?.version, 2);
  assert.equal(registry.getArtifact({ artifactId: first.artifactId, version: 1 })?.status, "RETIRED");
  const conflict = registry.transition({ artifactId: second.artifactId, version: 2 }, "REVIEW", "RETIRED");
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error[0]?.code, "LIFECYCLE_CONFLICT");
});

test("slice 5 emits deterministic canonical manifests", () => {
  const first = createContentRegistry();
  const second = createContentRegistry();
  const packValue = createValidReferencePack();
  assert.equal(first.loadPack(packValue).ok, true);
  assert.equal(second.loadPack({ ...packValue, artifacts: [...packValue.artifacts].reverse() }).ok, true);
  assert.equal(first.canonicalManifest(), second.canonicalManifest());
  assert.deepEqual(JSON.parse(first.canonicalManifest()), first.manifest());
});

test("diagnostics preserve exact artifact and clause indexes", () => {
  const valid = artifact({ artifactId: "fixture.registry.path.valid" });
  const invalid = artifact({
    artifactId: "fixture.registry.path.invalid",
    clauses: [
      { id: "fixture.registry.path.c0", sourceText: "First.", type: "GOAL" },
      { id: "fixture.registry.path.c1", sourceText: "Second.", type: "REPORTING" },
      { id: "fixture.registry.path.c2", sourceText: "Third.", type: "NOT_A_CATEGORY" as never },
    ],
  });
  const result = createContentRegistry().loadPack(pack("fixture.registry.paths", [valid, invalid]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.some((item) => item.code === "INVALID_CLAUSE_CATEGORY" && item.path === "artifacts[1].clauses[2].type"));
});

test("runtime-invalid eval and scenario fixtures return diagnostics without throwing", () => {
  const registry = createContentRegistry();
  const invalidEvalPack = {
    schemaVersion: 1,
    packId: "fixture.registry.runtime-invalid-eval",
    artifacts: [],
    evals: [{
      id: "fixture.registry.eval.runtime-invalid",
      version: 1,
      title: "Invalid runtime eval",
      description: "Fixture arrays are missing.",
      tags: [],
      buildCostCredits: 1,
      runCostCredits: 1,
      fixture: {},
      seed: 1,
      subjectType: "AGENT_CONFIG",
      assertions: [{ type: "TIME_BELOW", limit: 1 }],
    }],
  } as unknown as ContentPack;
  let evalResult: ReturnType<typeof registry.loadPack> | undefined;
  assert.doesNotThrow(() => { evalResult = registry.loadPack(invalidEvalPack); });
  assert.equal(evalResult?.ok, false);
  if (evalResult && !evalResult.ok) assert.ok(evalResult.error.some((item) => item.path === "evals[0].fixture.zones"));

  const starter = createValidReferencePack().scenarios?.[0]?.fixture;
  const invalidScenarioPack = {
    schemaVersion: 1,
    packId: "fixture.registry.runtime-invalid-scenario",
    artifacts: [],
    scenarios: [{
      id: "fixture.registry.scenario.runtime-invalid",
      version: 1,
      title: "Invalid runtime scenario",
      tags: [],
      seed: 1,
      fixture: { ...starter, enclosures: [{}] },
      artifactRefs: "not-an-array",
    }],
  } as unknown as ContentPack;
  let scenarioResult: ReturnType<typeof registry.loadPack> | undefined;
  assert.doesNotThrow(() => { scenarioResult = registry.loadPack(invalidScenarioPack); });
  assert.equal(scenarioResult?.ok, false);
  if (scenarioResult && !scenarioResult.ok) {
    assert.ok(scenarioResult.error.some((item) => item.code === "INVALID_FIXTURE"));
    assert.ok(scenarioResult.error.some((item) => item.path === "scenarios[0].artifactRefs"));
  }
  assert.deepEqual(registry.manifest().packs, []);
});

test("tool descriptions are immutable source-of-truth records in queries and manifests", () => {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(createValidReferencePack()).ok, true);
  const tool = registry.getToolDescription("fixture.registry.tool.audit-state");
  assert.equal(tool?.action, "audit_state");
  assert.equal(Object.isFrozen(tool), true);
  assert.deepEqual(registry.queryToolDescriptions({ tag: "fixture:contract" }).map((item) => item.id), ["fixture.registry.tool.audit-state"]);
  assert.deepEqual(registry.manifest().toolDescriptions, ["fixture.registry.tool.audit-state"]);
});

test("used-by includes eval subjects and scenario artifact references in stable order", () => {
  const registry = createContentRegistry();
  assert.equal(registry.loadPack(createValidReferencePack()).ok, true);
  assert.deepEqual(registry.usedBy({ artifactId: "fixture.registry.skill.safe-feed", version: 1 }), [
    { artifactId: "fixture.registry.eval.safe-feed", version: 1, kind: "EVAL" },
    { artifactId: "fixture.registry.scenario.feeding", version: 1, kind: "SCENARIO" },
  ]);
});

test("family records reject non-finite and structurally malformed values atomically", () => {
  const registry = createContentRegistry();
  const valid = createValidReferencePack();
  const invalid = {
    ...valid,
    packId: "fixture.registry.invalid-families",
    dinosaurProfiles: [{ ...valid.dinosaurProfiles?.[0], movementProfile: { ...valid.dinosaurProfiles?.[0]?.movementProfile, wanderChanceBasisPoints: Number.POSITIVE_INFINITY } }],
    enclosures: [{ ...valid.enclosures?.[0], hazardLevel: Number.NaN }],
    progressions: [{ ...valid.progressions?.[0], phase: Number.POSITIVE_INFINITY }],
  } as ContentPack;
  const result = registry.loadPack(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.some((item) => item.path === "dinosaurProfiles[0].movementProfile.wanderChanceBasisPoints"));
    assert.ok(result.error.some((item) => item.path === "enclosures[0].hazardLevel"));
    assert.ok(result.error.some((item) => item.path === "progressions[0].phase"));
  }
  assert.deepEqual(registry.manifest().packs, []);
});
