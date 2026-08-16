import type { DinosaurArchetype, MovementProfile, WorldFixture } from "../simulation/index.ts";

/** Stable identity for an immutable authored artifact version. */
export interface ArtifactRef {
  readonly artifactId: string;
  readonly version: number;
}

export type VersionedRef = ArtifactRef;

export type ArtifactType =
  | "PROMPT"
  | "SKILL"
  | "SYSTEM_PROMPT"
  | "KNOWLEDGE"
  | "TOOL_DESCRIPTION";

export type ArtifactStatus = "DRAFT" | "REVIEW" | "DEPLOYED" | "RETIRED";

export type ClauseCategory =
  | "GOAL"
  | "PRECONDITION"
  | "ACTION"
  | "SEQUENCE"
  | "CONSTRAINT"
  | "POSTCONDITION"
  | "FALLBACK"
  | "ESCALATION"
  | "DELEGATION"
  | "REPORTING"
  | "RETRIEVAL"
  | "PRIORITY";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * A deterministic semantic instruction. `sourceText` is display-only; the
 * instruction engine consumes the structured fields.
 */
export interface Clause {
  readonly id: string;
  readonly sourceText: string;
  readonly type: ClauseCategory;
  readonly conditions?: Readonly<Record<string, JsonValue>>;
  readonly action?: Readonly<Record<string, JsonValue>>;
  readonly assert?: Readonly<Record<string, JsonValue>>;
  readonly onFail?: Readonly<Record<string, JsonValue>>;
  readonly priority?: number;
  readonly semanticKey?: string;
}

export interface ArtifactVersion extends ArtifactRef {
  readonly type: ArtifactType;
  readonly title: string;
  readonly sourceText: string;
  readonly clauses: readonly Clause[];
  readonly dependencies: readonly ArtifactRef[];
  readonly applicabilityTags: readonly string[];
  readonly requiredToolIds: readonly string[];
  readonly status: ArtifactStatus;
  readonly authoredByCapability: string;
  readonly createdAtGameTime: number;
}

export interface ToolDescriptionDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly requiredCapability?: string;
  readonly tags?: readonly string[];
}

export type EvalSubjectType = "SKILL" | "PROMPT" | "SYSTEM_PROMPT" | "AGENT_CONFIG";

export type EvalAssertionType =
  | "STATE_EQUALS"
  | "STATE_IN"
  | "TOOL_CALLED"
  | "TOOL_NOT_CALLED"
  | "INCIDENT_MAX_SEVERITY"
  | "JOB_STATUS"
  | "TIME_BELOW"
  | "CONTEXT_BELOW";

export interface EvalAssertion {
  readonly type: EvalAssertionType;
  readonly path?: string;
  readonly expected?: JsonValue;
  readonly value?: JsonValue;
  readonly toolId?: string;
  readonly maxSeverity?: number;
  readonly status?: string;
  readonly limit?: number;
}

/** Immutable catalog definition. Built state belongs to eval-runner. */
export interface EvalCaseDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly buildCostCredits: number;
  readonly runCostCredits: number;
  readonly built?: boolean;
  readonly fixture: WorldFixture;
  readonly seed: number;
  readonly subjectType: EvalSubjectType;
  readonly subjectRef?: ArtifactRef;
  readonly assertions: readonly EvalAssertion[];
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly fixture: WorldFixture;
  readonly seed: number;
  readonly entryObjective?: string;
  readonly successCriteria?: readonly string[];
  readonly recoveryCriteria?: readonly string[];
  readonly artifactRefs?: readonly ArtifactRef[];
}

export interface DinosaurProfileDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly speciesId: string;
  readonly archetype: DinosaurArchetype;
  readonly movementProfile: MovementProfile;
  readonly tags?: readonly string[];
}

export interface EnclosureDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly speciesAllowed: readonly string[];
  readonly hazardLevel: number;
  readonly tags?: readonly string[];
  readonly fixtureId?: string;
}

export interface ProgressionDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly phase: number;
  readonly pressure?: string;
  readonly lesson?: string;
  readonly unlocks: readonly string[];
  readonly prerequisites?: readonly string[];
}

export type ContentRecord =
  | ArtifactVersion
  | ToolDescriptionDefinition
  | EvalCaseDefinition
  | ScenarioDefinition
  | DinosaurProfileDefinition
  | EnclosureDefinition
  | ProgressionDefinition;

/** A reference to a record in a relationship index. Artifact refs are used for
 * dependency relationships; the optional kind helps future family indexes. */
export interface ContentRef extends ArtifactRef {
  readonly kind?: "ARTIFACT" | "EVAL" | "SCENARIO" | "DINOSAUR_PROFILE" | "ENCLOSURE" | "PROGRESSION";
}

export interface ContentPack {
  readonly schemaVersion: number | string;
  readonly packId: string;
  readonly packVersion?: number;
  readonly artifacts: readonly ArtifactVersion[];
  readonly toolDescriptions?: readonly ToolDescriptionDefinition[];
  readonly evals?: readonly EvalCaseDefinition[];
  readonly scenarios?: readonly ScenarioDefinition[];
  readonly dinosaurProfiles?: readonly DinosaurProfileDefinition[];
  readonly enclosures?: readonly EnclosureDefinition[];
  readonly progressions?: readonly ProgressionDefinition[];
}

export interface ArtifactQuery {
  readonly ref?: ArtifactRef;
  readonly artifactId?: string;
  readonly version?: number;
  readonly type?: ArtifactType;
  readonly tag?: string;
  readonly status?: ArtifactStatus;
  readonly title?: string;
  readonly requiredToolId?: string;
  readonly toolId?: string;
  readonly dependency?: ArtifactRef;
  readonly dependencyRef?: ArtifactRef;
}

export interface RecordQuery {
  readonly id?: string;
  readonly version?: number;
  readonly tag?: string;
  readonly title?: string;
  readonly phase?: number;
}

export interface ToolDescriptionQuery {
  readonly id?: string;
  readonly title?: string;
  readonly action?: string;
  readonly tag?: string;
}

export type ContentDiagnosticCode =
  | "INVALID_PACK"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "DUPLICATE_PACK"
  | "INVALID_ID"
  | "DUPLICATE_REF"
  | "INVALID_VERSION"
  | "INVALID_TYPE"
  | "INVALID_STATUS"
  | "INVALID_VALUE"
  | "MALFORMED_SOURCE"
  | "MALFORMED_CLAUSE"
  | "INVALID_CLAUSE_CATEGORY"
  | "INVALID_TAG"
  | "MISSING_DEPENDENCY"
  | "DUPLICATE_DEPENDENCY"
  | "DEPENDENCY_CYCLE"
  | "MISSING_REQUIRED_TOOL"
  | "DUPLICATE_RECORD"
  | "INVALID_FIXTURE"
  | "MISSING_RECORD_REFERENCE"
  | "INVALID_ASSERTION"
  | "INVALID_LIFECYCLE_TRANSITION"
  | "LIFECYCLE_CONFLICT"
  | "IMMUTABLE_VERSION"
  | "BUILT_STATE_NOT_AUTHORED";

export interface ContentDiagnostic {
  readonly code: ContentDiagnosticCode;
  readonly packId: string;
  readonly recordId?: string;
  readonly ref?: ArtifactRef;
  readonly path: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface PackManifestEntry {
  readonly packId: string;
  readonly schemaVersion: number | string;
  readonly packVersion?: number;
}

export interface ContentManifest {
  readonly schemaVersion: 1;
  readonly packs: readonly PackManifestEntry[];
  readonly artifacts: readonly ArtifactRef[];
  readonly toolDescriptions: readonly string[];
  readonly evals: readonly ArtifactRef[];
  readonly scenarios: readonly ArtifactRef[];
  readonly dinosaurProfiles: readonly ArtifactRef[];
  readonly enclosures: readonly ArtifactRef[];
  readonly progressions: readonly ArtifactRef[];
  readonly dependencies: readonly { readonly from: ArtifactRef; readonly to: ArtifactRef }[];
  readonly deployed: readonly ArtifactRef[];
}

export interface LifecycleTransitionResult {
  readonly ref: ArtifactRef;
  readonly previousStatus: ArtifactStatus;
  readonly status: ArtifactStatus;
}

export interface ArtifactRollbackResult {
  readonly ref: ArtifactRef;
  readonly previousStatus: "DRAFT" | "REVIEW";
  readonly removed: true;
}

/** Opaque lifecycle snapshot used by transactional consumers. Artifact bodies
 * remain immutable; only lifecycle selectors can change during deployment. */
export interface ContentLifecycleSnapshot {
  readonly statuses: readonly { readonly ref: ArtifactRef; readonly status: ArtifactStatus }[];
}

export interface ContentRegistry {
  loadPack(pack: ContentPack): Result<ContentManifest, readonly ContentDiagnostic[]>;
  getArtifact(ref: ArtifactRef): ArtifactVersion | undefined;
  getToolDescription(toolId: string): ToolDescriptionDefinition | undefined;
  /** Explicitly selected current version. This method never changes an exact ref. */
  getCurrentArtifact(artifactId: string): ArtifactVersion | undefined;
  /** Alias used by consumers that call the deployed selector `getCurrent`. */
  getCurrent(artifactId: string): ArtifactVersion | undefined;
  queryArtifacts(query: ArtifactQuery): readonly ArtifactVersion[];
  queryToolDescriptions(query?: ToolDescriptionQuery): readonly ToolDescriptionDefinition[];
  dependencies(ref: ArtifactRef, transitive?: boolean): readonly ArtifactRef[];
  usedBy(ref: ArtifactRef): readonly ContentRef[];
  getEval(ref: VersionedRef): EvalCaseDefinition | undefined;
  getScenario(ref: VersionedRef): ScenarioDefinition | undefined;
  queryEvals(query?: RecordQuery): readonly EvalCaseDefinition[];
  queryScenarios(query?: RecordQuery): readonly ScenarioDefinition[];
  queryDinosaurProfiles(query?: RecordQuery): readonly DinosaurProfileDefinition[];
  queryEnclosures(query?: RecordQuery): readonly EnclosureDefinition[];
  queryProgressions(query?: RecordQuery): readonly ProgressionDefinition[];
  transition(ref: ArtifactRef, expectedStatus: ArtifactStatus, nextStatus: ArtifactStatus): Result<LifecycleTransitionResult, readonly ContentDiagnostic[]>;
  /** Compensating boundary for an application transaction that created an
   * unpublished artifact but failed before Review intake committed. */
  removeUnpublishedArtifact(ref: ArtifactRef, expectedStatus?: "DRAFT" | "REVIEW"): Result<ArtifactRollbackResult, readonly ContentDiagnostic[]>;
  checkpointLifecycle(): ContentLifecycleSnapshot;
  restoreLifecycle(snapshot: ContentLifecycleSnapshot): void;
  manifest(): ContentManifest;
  canonicalManifest(): string;
}
