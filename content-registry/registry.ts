import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import {
  contentRefKey,
  stableRefSort,
  validateContentPack,
  type ValidationContext,
} from "./validator.ts";
import type {
  ArtifactQuery,
  ArtifactRef,
  ArtifactRollbackResult,
  ArtifactStatus,
  ArtifactVersion,
  ContentDiagnostic,
  ContentManifest,
  ContentPack,
  ContentRef,
  ContentRegistry,
  DinosaurProfileDefinition,
  EnclosureDefinition,
  EvalCaseDefinition,
  LifecycleTransitionResult,
  ProgressionDefinition,
  RecordQuery,
  Result,
  ScenarioDefinition,
  ToolDescriptionDefinition,
  ToolDescriptionQuery,
} from "./types.ts";

interface StoredPack {
  readonly packId: string;
  readonly schemaVersion: number | string;
  readonly packVersion?: number;
  /** Internal membership count used to remove an otherwise empty provisional pack. */
  readonly recordCount: number;
}

const statusTransitions: Readonly<Record<ArtifactStatus, readonly ArtifactStatus[]>> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "DEPLOYED"],
  DEPLOYED: ["RETIRED"],
  RETIRED: [],
};

function compareRef(a: ArtifactRef, b: ArtifactRef): number {
  return a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version;
}

function sameRef(a: ArtifactRef | undefined, b: ArtifactRef | undefined): boolean {
  return Boolean(a && b && a.artifactId === b.artifactId && a.version === b.version);
}

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function resultError(packId: string, path: string, code: ContentDiagnostic["code"], message: string, ref?: ArtifactRef): ContentDiagnostic {
  return { code, packId, path, message, ...(ref ? { ref: { artifactId: ref.artifactId, version: ref.version }, recordId: ref.artifactId } : {}) };
}

function queryRecord<T extends { readonly id: string; readonly version: number; readonly title: string; readonly tags?: readonly string[] }>(records: Iterable<T>, query: RecordQuery = {}): readonly T[] {
  const title = query.title?.toLowerCase();
  return [...records]
    .filter((record) => query.id === undefined || record.id === query.id)
    .filter((record) => query.version === undefined || record.version === query.version)
    .filter((record) => query.tag === undefined || record.tags?.includes(query.tag) === true)
    .filter((record) => title === undefined || record.title.toLowerCase().includes(title))
    .filter((record) => query.phase === undefined || ("phase" in record && record.phase === query.phase))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version);
}

export function createContentRegistry(): ContentRegistry {
  const artifacts = new Map<string, ArtifactVersion>();
  const artifactPacks = new Map<string, string>();
  const packs = new Map<string, StoredPack>();
  const evals = new Map<string, EvalCaseDefinition>();
  const toolDescriptions = new Map<string, ToolDescriptionDefinition>();
  const scenarios = new Map<string, ScenarioDefinition>();
  const dinosaurProfiles = new Map<string, DinosaurProfileDefinition>();
  const enclosures = new Map<string, EnclosureDefinition>();
  const progressions = new Map<string, ProgressionDefinition>();
  const availableToolIds = new Set<string>();

  const buildManifest = (): ContentManifest => {
    const artifactRefs = stableRefSort([...artifacts.values()]);
    const evalRefs = stableRefSort([...evals.values()].map((item) => ({ artifactId: item.id, version: item.version })));
    const scenarioRefs = stableRefSort([...scenarios.values()].map((item) => ({ artifactId: item.id, version: item.version })));
    const dinosaurRefs = stableRefSort([...dinosaurProfiles.values()].map((item) => ({ artifactId: item.id, version: item.version })));
    const enclosureRefs = stableRefSort([...enclosures.values()].map((item) => ({ artifactId: item.id, version: item.version })));
    const progressionRefs = stableRefSort([...progressions.values()].map((item) => ({ artifactId: item.id, version: item.version })));
    const dependencyEdges = [...artifacts.values()]
      .flatMap((artifact) => artifact.dependencies.map((dependency) => ({ from: { artifactId: artifact.artifactId, version: artifact.version }, to: { ...dependency } })))
      .sort((a, b) => compareRef(a.from, b.from) || compareRef(a.to, b.to));
    const deployed = stableRefSort([...artifacts.values()].filter((artifact) => artifact.status === "DEPLOYED"));
    return cloneFreeze({
      schemaVersion: 1,
      packs: [...packs.values()].map(({ packId, schemaVersion, packVersion }) => ({ packId, schemaVersion, ...(packVersion === undefined ? {} : { packVersion }) })).sort((a, b) => a.packId < b.packId ? -1 : a.packId > b.packId ? 1 : 0),
      artifacts: artifactRefs.map(({ artifactId, version }) => ({ artifactId, version })),
      toolDescriptions: [...toolDescriptions.keys()].sort(),
      evals: evalRefs,
      scenarios: scenarioRefs,
      dinosaurProfiles: dinosaurRefs,
      enclosures: enclosureRefs,
      progressions: progressionRefs,
      dependencies: dependencyEdges,
      deployed: deployed.map(({ artifactId, version }) => ({ artifactId, version })),
    });
  };

  const validateRelationships = (pack: ContentPack, candidateArtifacts: readonly ArtifactVersion[], candidateEvals: readonly EvalCaseDefinition[], candidateScenarios: readonly ScenarioDefinition[]): ContentDiagnostic[] => {
    const diagnostics: ContentDiagnostic[] = [];
    const allArtifacts = new Map<string, ArtifactVersion>(artifacts);
    for (const artifact of candidateArtifacts) allArtifacts.set(contentRefKey(artifact), artifact);
    const packId = pack.packId;
    const sortedArtifacts = [...allArtifacts.values()].sort(compareRef);
    for (const artifact of candidateArtifacts) {
      const artifactIndex = Math.max(0, pack.artifacts.indexOf(artifact));
      for (const [dependencyIndex, dependency] of artifact.dependencies.entries()) {
        const dependencyArtifact = allArtifacts.get(contentRefKey(dependency));
        if (!dependencyArtifact) diagnostics.push(resultError(packId, `artifacts[${artifactIndex}].dependencies[${dependencyIndex}]`, "MISSING_DEPENDENCY", `dependency '${contentRefKey(dependency)}' is not registered`, artifact));
      }
    }
    const state = new Map<string, "unvisited" | "visiting" | "visited">();
    const stack: string[] = [];
    const reported = new Set<string>();
    const visit = (key: string): void => {
      const current = state.get(key) ?? "unvisited";
      if (current === "visited") return;
      if (current === "visiting") {
        const cycleStart = stack.indexOf(key);
        const cycle = [...stack.slice(cycleStart), key];
        const cycleKey = cycle.join("->");
        if (!reported.has(cycleKey)) {
          reported.add(cycleKey);
          const edgeOwnerKey = stack.at(-1) ?? key;
          const owner = allArtifacts.get(edgeOwnerKey);
          const ownerIndex = owner ? pack.artifacts.indexOf(owner) : -1;
          const dependencyIndex = owner?.dependencies.findIndex((dependency) => contentRefKey(dependency) === key) ?? -1;
          diagnostics.push({
            code: "DEPENDENCY_CYCLE",
            packId,
            recordId: owner?.artifactId,
            ref: owner ? { artifactId: owner.artifactId, version: owner.version } : undefined,
            path: ownerIndex >= 0 && dependencyIndex >= 0 ? `artifacts[${ownerIndex}].dependencies[${dependencyIndex}]` : "artifacts.dependencies",
            message: `artifact dependency cycle: ${cycle.join(" -> ")}`,
            details: { cycle },
          });
        }
        return;
      }
      state.set(key, "visiting");
      stack.push(key);
      const artifact = allArtifacts.get(key);
      for (const dependency of artifact?.dependencies.toSorted(compareRef) ?? []) visit(contentRefKey(dependency));
      stack.pop();
      state.set(key, "visited");
    };
    for (const artifact of sortedArtifacts) visit(contentRefKey(artifact));
    for (const [evalIndex, item] of candidateEvals.entries()) if (item.subjectRef && !allArtifacts.has(contentRefKey(item.subjectRef))) diagnostics.push(resultError(packId, `evals[${evalIndex}].subjectRef`, "MISSING_RECORD_REFERENCE", `subject artifact '${contentRefKey(item.subjectRef)}' is not registered`, { artifactId: item.id, version: item.version }));
    for (const [scenarioIndex, item] of candidateScenarios.entries()) for (const [refIndex, ref] of (item.artifactRefs ?? []).entries()) if (!allArtifacts.has(contentRefKey(ref))) diagnostics.push(resultError(packId, `scenarios[${scenarioIndex}].artifactRefs[${refIndex}]`, "MISSING_RECORD_REFERENCE", `artifact '${contentRefKey(ref)}' is not registered`, { artifactId: item.id, version: item.version }));
    return diagnostics;
  };

  const loadPack = (pack: ContentPack): Result<ContentManifest, readonly ContentDiagnostic[]> => {
    const context: ValidationContext = {
      existingArtifactRefs: new Set(artifacts.keys()),
      existingPackIds: new Set(packs.keys()),
      availableToolIds,
    };
    const validation = validateContentPack(pack, context);
    const diagnostics = [...validation.diagnostics];
    if (!validation.value) return { ok: false, error: cloneFreeze(diagnostics.sort((a, b) => `${a.path}\u0000${a.code}` < `${b.path}\u0000${b.code}` ? -1 : 1)) };
    if (diagnostics.length > 0) return { ok: false, error: cloneFreeze(diagnostics) };
    let clonedPack: ContentPack;
    try {
      clonedPack = cloneFreeze(deepClone(pack));
    } catch (error) {
      return { ok: false, error: cloneFreeze([resultError(pack?.packId ?? "", "pack", "INVALID_PACK", `content pack must be canonically cloneable: ${error instanceof Error ? error.message : String(error)}`)]) };
    }
    const candidateArtifacts = Array.isArray(clonedPack.artifacts) ? clonedPack.artifacts : [];
    const candidateToolDescriptions = (Array.isArray(clonedPack.toolDescriptions) ? clonedPack.toolDescriptions : []).map((item) => cloneFreeze(item));
    const candidateEvals = (Array.isArray(clonedPack.evals) ? clonedPack.evals : []).map((item) => cloneFreeze({ ...item, built: false }));
    const candidateScenarios = (Array.isArray(clonedPack.scenarios) ? clonedPack.scenarios : []).map((item) => cloneFreeze(item));
    const candidateDinosaurProfiles = (Array.isArray(clonedPack.dinosaurProfiles) ? clonedPack.dinosaurProfiles : []).map((item) => cloneFreeze(item));
    const candidateEnclosures = (Array.isArray(clonedPack.enclosures) ? clonedPack.enclosures : []).map((item) => cloneFreeze(item));
    const candidateProgressions = (Array.isArray(clonedPack.progressions) ? clonedPack.progressions : []).map((item) => cloneFreeze(item));
    diagnostics.push(...validateRelationships(clonedPack, candidateArtifacts, candidateEvals, candidateScenarios));
    for (const [index, item] of candidateToolDescriptions.entries()) if (toolDescriptions.has(item.id)) diagnostics.push(resultError(clonedPack.packId, `toolDescriptions[${index}].id`, "DUPLICATE_RECORD", `tool description '${item.id}' is already registered`));
    for (const [kind, records, existing] of [
      ["eval", candidateEvals, evals],
      ["scenario", candidateScenarios, scenarios],
      ["dinosaur profile", candidateDinosaurProfiles, dinosaurProfiles],
      ["enclosure", candidateEnclosures, enclosures],
      ["progression", candidateProgressions, progressions],
    ] as const) {
      for (const item of records) {
        if (existing.has(contentRefKey({ artifactId: item.id, version: item.version }))) diagnostics.push(resultError(clonedPack.packId, `${kind}s`, "DUPLICATE_RECORD", `${kind} '${contentRefKey({ artifactId: item.id, version: item.version })}' is already registered`, { artifactId: item.id, version: item.version }));
      }
    }
    if (diagnostics.length > 0) {
      diagnostics.sort((a, b) => `${a.path}\u0000${a.code}\u0000${a.message}` < `${b.path}\u0000${b.code}\u0000${b.message}` ? -1 : 1);
      return { ok: false, error: cloneFreeze(diagnostics) };
    }
    const recordCount = candidateArtifacts.length + candidateToolDescriptions.length + candidateEvals.length + candidateScenarios.length + candidateDinosaurProfiles.length + candidateEnclosures.length + candidateProgressions.length;
    packs.set(clonedPack.packId, cloneFreeze({ packId: clonedPack.packId, schemaVersion: clonedPack.schemaVersion, ...(clonedPack.packVersion === undefined ? {} : { packVersion: clonedPack.packVersion }), recordCount }));
    for (const artifact of candidateArtifacts) {
      const key = contentRefKey(artifact);
      artifacts.set(key, artifact);
      artifactPacks.set(key, clonedPack.packId);
    }
    for (const item of candidateToolDescriptions) toolDescriptions.set(item.id, item);
    for (const item of candidateEvals) evals.set(contentRefKey({ artifactId: item.id, version: item.version }), item);
    for (const item of candidateScenarios) scenarios.set(contentRefKey({ artifactId: item.id, version: item.version }), item);
    for (const item of candidateDinosaurProfiles) dinosaurProfiles.set(contentRefKey({ artifactId: item.id, version: item.version }), item);
    for (const item of candidateEnclosures) enclosures.set(contentRefKey({ artifactId: item.id, version: item.version }), item);
    for (const item of candidateProgressions) progressions.set(contentRefKey({ artifactId: item.id, version: item.version }), item);
    for (const toolId of validation.value.toolIds) availableToolIds.add(toolId);
    return { ok: true, value: buildManifest() };
  };

  const getArtifact = (ref: ArtifactRef): ArtifactVersion | undefined => artifacts.get(contentRefKey(ref));
  const getToolDescription = (toolId: string): ToolDescriptionDefinition | undefined => toolDescriptions.get(toolId);
  const queryToolDescriptions = (query: ToolDescriptionQuery = {}): readonly ToolDescriptionDefinition[] => {
    const title = query.title?.toLowerCase();
    return cloneFreeze([...toolDescriptions.values()]
      .filter((item) => query.id === undefined || item.id === query.id)
      .filter((item) => query.action === undefined || item.action === query.action)
      .filter((item) => query.tag === undefined || item.tags?.includes(query.tag) === true)
      .filter((item) => title === undefined || item.title.toLowerCase().includes(title))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };
  const queryArtifacts = (query: ArtifactQuery): readonly ArtifactVersion[] => {
    const title = query.title?.toLowerCase();
    const dependency = query.dependency ?? query.dependencyRef;
    return [...artifacts.values()]
      .filter((artifact) => query.ref === undefined || sameRef(artifact, query.ref))
      .filter((artifact) => query.artifactId === undefined || artifact.artifactId === query.artifactId)
      .filter((artifact) => query.version === undefined || artifact.version === query.version)
      .filter((artifact) => query.type === undefined || artifact.type === query.type)
      .filter((artifact) => query.tag === undefined || artifact.applicabilityTags.includes(query.tag))
      .filter((artifact) => query.status === undefined || artifact.status === query.status)
      .filter((artifact) => title === undefined || artifact.title.toLowerCase().includes(title))
      .filter((artifact) => query.requiredToolId === undefined && query.toolId === undefined || artifact.requiredToolIds.includes(query.requiredToolId ?? query.toolId ?? ""))
      .filter((artifact) => dependency === undefined || artifact.dependencies.some((item) => sameRef(item, dependency)))
      .sort(compareRef);
  };

  const dependencies = (ref: ArtifactRef, transitive = false): readonly ArtifactRef[] => {
    const artifact = getArtifact(ref);
    if (!artifact) return [];
    const direct = artifact.dependencies.toSorted(compareRef).map((item) => ({ artifactId: item.artifactId, version: item.version }));
    if (!transitive) return cloneFreeze(direct);
    const found = new Map<string, ArtifactRef>();
    const visit = (item: ArtifactRef): void => {
      const key = contentRefKey(item);
      if (found.has(key)) return;
      found.set(key, { artifactId: item.artifactId, version: item.version });
      const next = getArtifact(item);
      for (const dependency of next?.dependencies.toSorted(compareRef) ?? []) visit(dependency);
    };
    for (const item of direct) visit(item);
    return cloneFreeze([...found.values()].sort(compareRef));
  };

  const usedBy = (ref: ArtifactRef): readonly ContentRef[] => {
    const matches: ContentRef[] = [...artifacts.values()]
      .filter((artifact) => artifact.dependencies.some((dependency) => sameRef(dependency, ref)))
      .map((artifact) => ({ artifactId: artifact.artifactId, version: artifact.version }));
    for (const item of evals.values()) if (sameRef(item.subjectRef, ref)) matches.push({ artifactId: item.id, version: item.version, kind: "EVAL" });
    for (const item of scenarios.values()) if (item.artifactRefs?.some((artifactRef) => sameRef(artifactRef, ref))) matches.push({ artifactId: item.id, version: item.version, kind: "SCENARIO" });
    return cloneFreeze(matches.sort((a, b) => {
      const refOrder = compareRef(a, b);
      if (refOrder !== 0) return refOrder;
      const leftKind = a.kind ?? "ARTIFACT";
      const rightKind = b.kind ?? "ARTIFACT";
      return leftKind < rightKind ? -1 : leftKind > rightKind ? 1 : 0;
    }));
  };

  const getCurrentArtifact = (artifactId: string): ArtifactVersion | undefined => [...artifacts.values()]
    .filter((artifact) => artifact.artifactId === artifactId && artifact.status === "DEPLOYED")
    .sort((a, b) => b.version - a.version)[0];

  const transition = (ref: ArtifactRef, expectedStatus: ArtifactStatus, nextStatus: ArtifactStatus): Result<LifecycleTransitionResult, readonly ContentDiagnostic[]> => {
    const artifact = getArtifact(ref);
    if (!artifact) return { ok: false, error: cloneFreeze([resultError("registry", "artifact", "MISSING_RECORD_REFERENCE", `artifact '${contentRefKey(ref)}' is not registered`, ref)]) };
    if (artifact.status !== expectedStatus) return { ok: false, error: cloneFreeze([resultError(artifactPacks.get(contentRefKey(ref)) ?? "registry", "status", "LIFECYCLE_CONFLICT", `expected ${expectedStatus} for '${contentRefKey(ref)}' but current status is ${artifact.status}`, ref)]) };
    if (!statusTransitions[expectedStatus].includes(nextStatus)) return { ok: false, error: cloneFreeze([resultError(artifactPacks.get(contentRefKey(ref)) ?? "registry", "status", "INVALID_LIFECYCLE_TRANSITION", `${expectedStatus} cannot transition to ${nextStatus}`, ref)]) };
    const replacement = cloneFreeze({ ...artifact, status: nextStatus });
    artifacts.set(contentRefKey(ref), replacement);
    if (nextStatus === "DEPLOYED") {
      for (const [key, other] of artifacts) if (other.artifactId === artifact.artifactId && key !== contentRefKey(ref) && other.status === "DEPLOYED") artifacts.set(key, cloneFreeze({ ...other, status: "RETIRED" }));
    }
    return { ok: true, value: cloneFreeze({ ref: { artifactId: ref.artifactId, version: ref.version }, previousStatus: expectedStatus, status: nextStatus }) };
  };

  const removeUnpublishedArtifact = (ref: ArtifactRef, expectedStatus: "DRAFT" | "REVIEW" = "REVIEW"): Result<ArtifactRollbackResult, readonly ContentDiagnostic[]> => {
    const artifact = getArtifact(ref);
    if (!artifact) return { ok: false, error: cloneFreeze([resultError("registry", "artifact", "MISSING_RECORD_REFERENCE", `artifact '${contentRefKey(ref)}' is not registered`, ref)]) };
    if (artifact.status !== expectedStatus) return { ok: false, error: cloneFreeze([resultError(artifactPacks.get(contentRefKey(ref)) ?? "registry", "status", "LIFECYCLE_CONFLICT", `expected unpublished status ${expectedStatus} for '${contentRefKey(ref)}' but current status is ${artifact.status}`, ref)]) };
    if (artifact.status !== "DRAFT" && artifact.status !== "REVIEW") return { ok: false, error: cloneFreeze([resultError(artifactPacks.get(contentRefKey(ref)) ?? "registry", "status", "IMMUTABLE_VERSION", `published artifact '${contentRefKey(ref)}' cannot be removed`, ref)]) };
    const consumers = usedBy(ref);
    if (consumers.length > 0) return { ok: false, error: cloneFreeze([resultError(artifactPacks.get(contentRefKey(ref)) ?? "registry", "artifact", "IMMUTABLE_VERSION", `unpublished artifact '${contentRefKey(ref)}' still has ${consumers.length} registered consumer(s)`, ref)]) };
    const key = contentRefKey(ref);
    const packId = artifactPacks.get(key);
    artifacts.delete(key);
    artifactPacks.delete(key);
    if (packId && packs.get(packId)?.recordCount === 1) packs.delete(packId);
    return { ok: true, value: cloneFreeze({ ref: { artifactId: ref.artifactId, version: ref.version }, previousStatus: expectedStatus, removed: true as const }) };
  };

  const checkpointLifecycle = (): import("./types.ts").ContentLifecycleSnapshot => cloneFreeze({
    statuses: [...artifacts.values()]
      .map((artifact) => ({ ref: { artifactId: artifact.artifactId, version: artifact.version }, status: artifact.status }))
      .sort((left, right) => compareRef(left.ref, right.ref)),
  });

  const restoreLifecycle = (snapshot: import("./types.ts").ContentLifecycleSnapshot): void => {
    for (const entry of snapshot.statuses) {
      const key = contentRefKey(entry.ref);
      const artifact = artifacts.get(key);
      if (artifact) artifacts.set(key, cloneFreeze({ ...artifact, status: entry.status }));
    }
  };

  return {
    loadPack,
    getArtifact,
    getToolDescription,
    getCurrentArtifact,
    getCurrent: getCurrentArtifact,
    queryArtifacts,
    queryToolDescriptions,
    dependencies,
    usedBy,
    getEval: (ref) => evals.get(contentRefKey(ref)),
    getScenario: (ref) => scenarios.get(contentRefKey(ref)),
    queryEvals: (query = {}) => cloneFreeze(queryRecord(evals.values(), query)),
    queryScenarios: (query = {}) => cloneFreeze(queryRecord(scenarios.values(), query)),
    queryDinosaurProfiles: (query = {}) => cloneFreeze(queryRecord(dinosaurProfiles.values(), query)),
    queryEnclosures: (query = {}) => cloneFreeze(queryRecord(enclosures.values(), query)),
    queryProgressions: (query = {}) => cloneFreeze(queryRecord(progressions.values(), query)),
    transition,
    removeUnpublishedArtifact,
    checkpointLifecycle,
    restoreLifecycle,
    manifest: buildManifest,
    canonicalManifest: () => canonicalSerialize(buildManifest()),
  };
}

/** Concise alias for adapters that refer to this subsystem simply as the registry. */
export const createRegistry = createContentRegistry;
