import { validateFixture, type WorldFixture } from "../simulation/index.ts";
import type { ArtifactRef, ArtifactVersion, ClauseCategory, ContentDiagnostic, ContentPack, EvalAssertion, EvalCaseDefinition, JsonValue, ScenarioDefinition, ToolDescriptionDefinition } from "./types.ts";

export const SUPPORTED_CONTENT_SCHEMA_VERSION = 1;

export const CLAUSE_CATEGORIES: readonly ClauseCategory[] = [
  "GOAL",
  "PRECONDITION",
  "ACTION",
  "SEQUENCE",
  "CONSTRAINT",
  "POSTCONDITION",
  "FALLBACK",
  "ESCALATION",
  "DELEGATION",
  "REPORTING",
  "RETRIEVAL",
  "PRIORITY",
];

/** Tool names that the simulation public contract exposes. Packs may extend
 * this list with TOOL_DESCRIPTION records in the same pack. */
export const STANDARD_TOOL_IDS: readonly string[] = [
  "move_to",
  "observe",
  "bait_dinosaur",
  "open_gate",
  "close_gate",
  "lock_gate",
  "dispense_food",
  "alert_security",
  "evacuate_visitors",
  "rescue_visitors",
  "radio",
];

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function compareDiagnostic(a: ContentDiagnostic, b: ContentDiagnostic): number {
  const left = `${a.path}\u0000${a.code}\u0000${a.recordId ?? ""}`;
  const right = `${b.path}\u0000${b.code}\u0000${b.recordId ?? ""}`;
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnostic(
  code: ContentDiagnostic["code"],
  packId: string,
  path: string,
  message: string,
  recordId?: string,
  ref?: ArtifactRef,
  details?: Readonly<Record<string, JsonValue>>,
): ContentDiagnostic {
  return {
    code,
    packId,
    path,
    message,
    ...(recordId ? { recordId } : {}),
    ...(ref ? { ref: { artifactId: ref.artifactId, version: ref.version } } : {}),
    ...(details ? { details } : {}),
  };
}

function idVersionKey(id: string, version: number): string {
  return `${id}@${version}`;
}

function validateRef(value: unknown, packId: string, path: string, recordId: string | undefined, diagnostics: ContentDiagnostic[]): value is ArtifactRef {
  if (!isRecord(value) || !nonEmptyString(value.artifactId) || !isPositiveInteger(value.version)) {
    diagnostics.push(diagnostic("INVALID_VERSION", packId, path, "artifact ref requires a non-empty artifactId and positive integer version", recordId));
    return false;
  }
  return true;
}

function validateTags(tags: unknown, packId: string, path: string, recordId: string | undefined, diagnostics: ContentDiagnostic[]): tags is readonly string[] {
  if (!Array.isArray(tags)) {
    diagnostics.push(diagnostic("INVALID_TAG", packId, path, "tags must be an array of non-empty strings", recordId));
    return false;
  }
  const seen = new Set<string>();
  for (const [index, tag] of tags.entries()) {
    if (!nonEmptyString(tag)) diagnostics.push(diagnostic("INVALID_TAG", packId, `${path}[${index}]`, "tag must be a non-empty string", recordId));
    else if (seen.has(tag)) diagnostics.push(diagnostic("INVALID_TAG", packId, `${path}[${index}]`, `duplicate tag '${tag}'`, recordId));
    else seen.add(tag);
  }
  return diagnostics.every((item) => !(item.path.startsWith(path) && item.recordId === recordId && item.code === "INVALID_TAG"));
}

function validateClause(clause: unknown, artifact: ArtifactVersion, artifactIndex: number, clauseIndex: number, packId: string, diagnostics: ContentDiagnostic[]): void {
  const path = `artifacts[${artifactIndex}].clauses`;
  if (!isRecord(clause)) {
    diagnostics.push(diagnostic("MALFORMED_CLAUSE", packId, `${path}[${clauseIndex}]`, "clause must be an object", artifact.artifactId, artifact));
    return;
  }
  if (!nonEmptyString(clause.id)) diagnostics.push(diagnostic("MALFORMED_CLAUSE", packId, `${path}[${clauseIndex}].id`, "clause id is required", artifact.artifactId, artifact));
  if (!nonEmptyString(clause.sourceText)) diagnostics.push(diagnostic("MALFORMED_SOURCE", packId, `${path}[${clauseIndex}].sourceText`, "clause sourceText is required", artifact.artifactId, artifact));
  if (typeof clause.type !== "string" || !CLAUSE_CATEGORIES.includes(clause.type as ClauseCategory)) {
    diagnostics.push(diagnostic("INVALID_CLAUSE_CATEGORY", packId, `${path}[${clauseIndex}].type`, "clause type is not a supported category", artifact.artifactId, artifact));
  }
  if (clause.priority !== undefined && (!Number.isInteger(clause.priority) || (clause.priority as number) < 0)) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}[${clauseIndex}].priority`, "clause priority must be a non-negative integer", artifact.artifactId, artifact));
  }
  for (const field of ["conditions", "action", "assert", "onFail"] as const) {
    if (clause[field] !== undefined && (!isRecord(clause[field]) || !Object.values(clause[field]).every(isJsonValue))) {
      diagnostics.push(diagnostic("MALFORMED_CLAUSE", packId, `${path}[${clauseIndex}].${field}`, `${field} must contain JSON values`, artifact.artifactId, artifact));
    }
  }
  // Category-specific semantic fields are intentionally extensible. The
  // instruction engine owns execution-shape validation; this boundary only
  // guarantees a typed category, display source, and JSON-safe semantics.
}

function validateArtifact(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): value is ArtifactVersion {
  const diagnosticsBefore = diagnostics.length;
  const path = `artifacts[${index}]`;
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, path, "artifact must be an object"));
    return false;
  }
  const artifactId = typeof value.artifactId === "string" ? value.artifactId : undefined;
  const ref = artifactId && typeof value.version === "number" ? { artifactId, version: value.version } : undefined;
  const recordId = artifactId;
  if (!nonEmptyString(value.artifactId)) diagnostics.push(diagnostic("INVALID_ID", packId, `${path}.artifactId`, "artifactId must be a non-empty string", recordId));
  if (!isPositiveInteger(value.version)) diagnostics.push(diagnostic("INVALID_VERSION", packId, `${path}.version`, "version must be a positive integer", recordId, ref));
  if (!["PROMPT", "SKILL", "SYSTEM_PROMPT", "KNOWLEDGE", "TOOL_DESCRIPTION"].includes(String(value.type))) diagnostics.push(diagnostic("INVALID_TYPE", packId, `${path}.type`, "unsupported artifact type", recordId, ref));
  if (!nonEmptyString(value.title)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.title`, "title is required", recordId, ref));
  if (!nonEmptyString(value.sourceText)) diagnostics.push(diagnostic("MALFORMED_SOURCE", packId, `${path}.sourceText`, "human-readable sourceText is required", recordId, ref));
  if (!Array.isArray(value.clauses)) diagnostics.push(diagnostic("MALFORMED_CLAUSE", packId, `${path}.clauses`, "clauses must be an array", recordId, ref));
  else {
    if (["PROMPT", "SKILL", "SYSTEM_PROMPT"].includes(String(value.type)) && value.clauses.length === 0) diagnostics.push(diagnostic("MALFORMED_CLAUSE", packId, `${path}.clauses`, "actionable artifacts require at least one semantic clause", recordId, ref));
    const clauseIds = new Set<string>();
    for (const [clauseIndex, clause] of value.clauses.entries()) {
      validateClause(clause, value as unknown as ArtifactVersion, index, clauseIndex, packId, diagnostics);
      if (isRecord(clause) && typeof clause.id === "string") {
        if (clauseIds.has(clause.id)) diagnostics.push(diagnostic("DUPLICATE_REF", packId, `${path}.clauses[${clauseIndex}].id`, `duplicate clause id '${clause.id}'`, recordId, ref));
        clauseIds.add(clause.id);
      }
    }
  }
  if (!Array.isArray(value.dependencies)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.dependencies`, "dependencies must be an array", recordId, ref));
  else {
    const refs = new Set<string>();
    for (const [dependencyIndex, dependency] of value.dependencies.entries()) {
      if (!validateRef(dependency, packId, `${path}.dependencies[${dependencyIndex}]`, recordId, diagnostics)) continue;
      const key = idVersionKey(dependency.artifactId, dependency.version);
      if (refs.has(key)) diagnostics.push(diagnostic("DUPLICATE_DEPENDENCY", packId, `${path}.dependencies[${dependencyIndex}]`, `duplicate dependency '${key}'`, recordId, ref));
      refs.add(key);
    }
  }
  validateTags(value.applicabilityTags, packId, `${path}.applicabilityTags`, recordId, diagnostics);
  if (!Array.isArray(value.requiredToolIds)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.requiredToolIds`, "requiredToolIds must be an array", recordId, ref));
  else for (const [toolIndex, toolId] of value.requiredToolIds.entries()) if (!nonEmptyString(toolId)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.requiredToolIds[${toolIndex}]`, "tool id must be a non-empty string", recordId, ref));
  if (!["DRAFT", "REVIEW", "DEPLOYED", "RETIRED"].includes(String(value.status))) diagnostics.push(diagnostic("INVALID_STATUS", packId, `${path}.status`, "unsupported lifecycle status", recordId, ref));
  if (!nonEmptyString(value.authoredByCapability)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.authoredByCapability`, "authoredByCapability is required", recordId, ref));
  if (typeof value.createdAtGameTime !== "number" || !Number.isFinite(value.createdAtGameTime) || value.createdAtGameTime < 0) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.createdAtGameTime`, "createdAtGameTime must be a non-negative number", recordId, ref));
  return diagnostics.length === diagnosticsBefore;
}

function validateAssertion(assertion: unknown, path: string, packId: string, recordId: string, diagnostics: ContentDiagnostic[]): assertion is EvalAssertion {
  if (!isRecord(assertion) || typeof assertion.type !== "string" || !["STATE_EQUALS", "STATE_IN", "TOOL_CALLED", "TOOL_NOT_CALLED", "INCIDENT_MAX_SEVERITY", "JOB_STATUS", "TIME_BELOW", "CONTEXT_BELOW"].includes(assertion.type)) {
    diagnostics.push(diagnostic("INVALID_ASSERTION", packId, path, "assertion type is unsupported", recordId));
    return false;
  }
  if (["STATE_EQUALS", "STATE_IN"].includes(assertion.type) && (!nonEmptyString(assertion.path) || (!isJsonValue(assertion.expected) && !isJsonValue(assertion.value)))) diagnostics.push(diagnostic("INVALID_ASSERTION", packId, path, "state assertions require a path and expected value", recordId));
  if (["TOOL_CALLED", "TOOL_NOT_CALLED"].includes(assertion.type) && !nonEmptyString(assertion.toolId)) diagnostics.push(diagnostic("INVALID_ASSERTION", packId, path, "tool assertions require toolId", recordId));
  if (assertion.type === "INCIDENT_MAX_SEVERITY" && (typeof assertion.maxSeverity !== "number" || !Number.isInteger(assertion.maxSeverity) || assertion.maxSeverity < 0 || assertion.maxSeverity > 4)) diagnostics.push(diagnostic("INVALID_ASSERTION", packId, path, "severity must be an integer from 0 through 4", recordId));
  if (["TIME_BELOW", "CONTEXT_BELOW"].includes(assertion.type) && (!isFiniteNumber(assertion.limit) || assertion.limit < 0)) diagnostics.push(diagnostic("INVALID_ASSERTION", packId, path, "limit must be a finite non-negative number", recordId));
  return true;
}

function validateWorldFixture(value: unknown, path: string, packId: string, recordId: string | undefined, ref: ArtifactRef | undefined, diagnostics: ContentDiagnostic[]): value is WorldFixture {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("INVALID_FIXTURE", packId, path, "fixture must be an object", recordId, ref));
    return false;
  }
  const requiredArrays = ["zones", "enclosures", "gates", "dinosaurs", "agents", "visitors", "devices", "routes"] as const;
  let structurallyValid = true;
  for (const field of requiredArrays) {
    if (!Array.isArray(value[field])) {
      structurallyValid = false;
      diagnostics.push(diagnostic("INVALID_FIXTURE", packId, `${path}.${field}`, `${field} must be an array`, recordId, ref));
    }
  }
  if (!structurallyValid) return false;
  try {
    for (const error of validateFixture(value as unknown as WorldFixture)) {
      diagnostics.push(diagnostic("INVALID_FIXTURE", packId, `${path}.${error.path}`, `${error.code}: ${JSON.stringify(error.details)}`, recordId, ref));
    }
  } catch (error) {
    diagnostics.push(diagnostic("INVALID_FIXTURE", packId, path, `fixture structure is invalid: ${error instanceof Error ? error.message : String(error)}`, recordId, ref));
    return false;
  }
  return true;
}

function validateEval(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): value is EvalCaseDefinition {
  const diagnosticsBefore = diagnostics.length;
  const path = `evals[${index}]`;
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, path, "eval must be an object"));
    return false;
  }
  const id = typeof value.id === "string" ? value.id : undefined;
  const ref = id && typeof value.version === "number" ? { artifactId: id, version: value.version } : undefined;
  if (!nonEmptyString(value.id)) diagnostics.push(diagnostic("INVALID_ID", packId, `${path}.id`, "eval id is required"));
  if (!isPositiveInteger(value.version)) diagnostics.push(diagnostic("INVALID_VERSION", packId, `${path}.version`, "eval version must be a positive integer", id, ref));
  if (!nonEmptyString(value.title)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.title`, "eval title is required", id, ref));
  if (!nonEmptyString(value.description)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.description`, "eval description is required", id, ref));
  validateTags(value.tags, packId, `${path}.tags`, id, diagnostics);
  if (typeof value.buildCostCredits !== "number" || !Number.isInteger(value.buildCostCredits) || value.buildCostCredits <= 0) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.buildCostCredits`, "build cost must be positive", id, ref));
  if (typeof value.runCostCredits !== "number" || !Number.isInteger(value.runCostCredits) || value.runCostCredits <= 0) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.runCostCredits`, "run cost must be positive", id, ref));
  if (value.built !== undefined && value.built !== false) diagnostics.push(diagnostic("BUILT_STATE_NOT_AUTHORED", packId, `${path}.built`, "built status belongs to eval-runner and authored definitions must be unbuilt", id, ref));
  if (!isNonNegativeInteger(value.seed)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.seed`, "seed must be a non-negative integer", id, ref));
  if (!["SKILL", "PROMPT", "SYSTEM_PROMPT", "AGENT_CONFIG"].includes(String(value.subjectType))) diagnostics.push(diagnostic("INVALID_TYPE", packId, `${path}.subjectType`, "unsupported eval subject type", id, ref));
  if (value.subjectRef !== undefined) validateRef(value.subjectRef, packId, `${path}.subjectRef`, id, diagnostics);
  if (!Array.isArray(value.assertions) || value.assertions.length === 0) diagnostics.push(diagnostic("INVALID_ASSERTION", packId, `${path}.assertions`, "eval must contain at least one assertion", id, ref));
  else for (const [assertionIndex, assertion] of value.assertions.entries()) validateAssertion(assertion, `${path}.assertions[${assertionIndex}]`, packId, id ?? "", diagnostics);
  validateWorldFixture(value.fixture, `${path}.fixture`, packId, id, ref, diagnostics);
  return diagnostics.length === diagnosticsBefore;
}

function validateVersionedCommon(value: unknown, path: string, packId: string, diagnostics: ContentDiagnostic[]): value is AnyRecord {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, path, "record must be an object"));
    return false;
  }
  const id = typeof value.id === "string" ? value.id : undefined;
  if (!nonEmptyString(value.id)) diagnostics.push(diagnostic("INVALID_ID", packId, `${path}.id`, "record id is required", id));
  if (!isPositiveInteger(value.version)) diagnostics.push(diagnostic("INVALID_VERSION", packId, `${path}.version`, "record version must be a positive integer", id));
  if (!nonEmptyString(value.title)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.title`, "record title is required", id));
  return true;
}

function validateScenario(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): value is ScenarioDefinition {
  const diagnosticsBefore = diagnostics.length;
  const path = `scenarios[${index}]`;
  if (!validateVersionedCommon(value, path, packId, diagnostics)) return false;
  const id = typeof value.id === "string" ? value.id : "";
  const ref = typeof value.version === "number" ? { artifactId: id, version: value.version } : undefined;
  validateTags(value.tags, packId, `${path}.tags`, id, diagnostics);
  if (!isNonNegativeInteger(value.seed)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.seed`, "seed must be a non-negative integer", id));
  validateWorldFixture(value.fixture, `${path}.fixture`, packId, id, ref, diagnostics);
  if (value.description !== undefined && !nonEmptyString(value.description)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.description`, "description must be a non-empty string when provided", id, ref));
  for (const field of ["successCriteria", "recoveryCriteria"] as const) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].some((item) => !nonEmptyString(item)))) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.${field}`, `${field} must be an array of non-empty strings`, id, ref));
  }
  if (value.entryObjective !== undefined && !nonEmptyString(value.entryObjective)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.entryObjective`, "entryObjective must be a non-empty string when provided", id, ref));
  if (value.artifactRefs !== undefined) {
    if (!Array.isArray(value.artifactRefs)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.artifactRefs`, "artifactRefs must be an array", id, ref));
    else for (const [refIndex, artifactRef] of value.artifactRefs.entries()) validateRef(artifactRef, packId, `${path}.artifactRefs[${refIndex}]`, id, diagnostics);
  }
  return diagnostics.length === diagnosticsBefore;
}

function validateStringArray(value: unknown, path: string, packId: string, recordId: string, diagnostics: ContentDiagnostic[], allowEmpty = false): value is readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => !nonEmptyString(item))) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, path, `${path.split(".").at(-1)} must be ${allowEmpty ? "" : "a non-empty "}array of non-empty strings`, recordId));
    return false;
  }
  return true;
}

function validateDinosaurProfile(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): void {
  const path = `dinosaurProfiles[${index}]`;
  if (!validateVersionedCommon(value, path, packId, diagnostics)) return;
  const id = value.id as string;
  if (!nonEmptyString(value.speciesId)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.speciesId`, "speciesId is required", id));
  const archetypes = ["DOCILE_HERBIVORE", "LARGE_HERBIVORE", "CARNIVORE"];
  if (!archetypes.includes(String(value.archetype))) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.archetype`, "archetype is unsupported", id));
  if (!isRecord(value.movementProfile)) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.movementProfile`, "movementProfile must be an object", id));
  } else {
    const profile = value.movementProfile;
    if (!archetypes.includes(String(profile.archetype)) || profile.archetype !== value.archetype) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.movementProfile.archetype`, "movementProfile archetype must match the dinosaur archetype", id));
    for (const field of ["wanderChanceBasisPoints", "escapeRiskBasisPoints"] as const) {
      const amount = profile[field];
      if (!isFiniteNumber(amount) || !Number.isInteger(amount) || amount < 0 || amount > 10_000) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.movementProfile.${field}`, `${field} must be an integer from 0 through 10000`, id));
    }
    validateStringArray(profile.preferredZoneIds, `${path}.movementProfile.preferredZoneIds`, packId, id, diagnostics);
  }
  if (value.tags !== undefined) validateTags(value.tags, packId, `${path}.tags`, id, diagnostics);
}

function validateEnclosure(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): void {
  const path = `enclosures[${index}]`;
  if (!validateVersionedCommon(value, path, packId, diagnostics)) return;
  const id = value.id as string;
  validateStringArray(value.speciesAllowed, `${path}.speciesAllowed`, packId, id, diagnostics);
  if (!isFiniteNumber(value.hazardLevel) || !Number.isInteger(value.hazardLevel) || value.hazardLevel < 0 || value.hazardLevel > 4) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.hazardLevel`, "hazardLevel must be an integer from 0 through 4", id));
  if (value.tags !== undefined) validateTags(value.tags, packId, `${path}.tags`, id, diagnostics);
  if (value.fixtureId !== undefined && !nonEmptyString(value.fixtureId)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.fixtureId`, "fixtureId must be a non-empty string when provided", id));
}

function validateProgression(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): void {
  const path = `progressions[${index}]`;
  if (!validateVersionedCommon(value, path, packId, diagnostics)) return;
  const id = value.id as string;
  if (!isNonNegativeInteger(value.phase)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.phase`, "phase must be a finite non-negative integer", id));
  validateStringArray(value.unlocks, `${path}.unlocks`, packId, id, diagnostics);
  if (value.prerequisites !== undefined) validateStringArray(value.prerequisites, `${path}.prerequisites`, packId, id, diagnostics, true);
  for (const field of ["pressure", "lesson"] as const) if (value[field] !== undefined && !nonEmptyString(value[field])) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.${field}`, `${field} must be a non-empty string when provided`, id));
}

function validateToolDescription(value: unknown, index: number, packId: string, diagnostics: ContentDiagnostic[]): value is ToolDescriptionDefinition {
  const path = `toolDescriptions[${index}]`;
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("INVALID_VALUE", packId, path, "tool description must be an object"));
    return false;
  }
  const before = diagnostics.length;
  const id = typeof value.id === "string" ? value.id : undefined;
  for (const field of ["id", "title", "description", "action"] as const) if (!nonEmptyString(value[field])) diagnostics.push(diagnostic(field === "id" ? "INVALID_ID" : "INVALID_VALUE", packId, `${path}.${field}`, `${field} is required`, id));
  if (value.requiredCapability !== undefined && !nonEmptyString(value.requiredCapability)) diagnostics.push(diagnostic("INVALID_VALUE", packId, `${path}.requiredCapability`, "requiredCapability must be a non-empty string when provided", id));
  if (value.tags !== undefined) validateTags(value.tags, packId, `${path}.tags`, id, diagnostics);
  return diagnostics.length === before;
}

export interface ValidationContext {
  readonly existingArtifactRefs?: ReadonlySet<string>;
  readonly existingPackIds?: ReadonlySet<string>;
  readonly availableToolIds?: ReadonlySet<string>;
}

export interface ValidatedPack {
  readonly artifacts: readonly ArtifactVersion[];
  readonly toolIds: ReadonlySet<string>;
}

export function validateContentPack(pack: ContentPack, context: ValidationContext = {}): { readonly diagnostics: readonly ContentDiagnostic[]; readonly value?: ValidatedPack } {
  const diagnostics: ContentDiagnostic[] = [];
  const packId = isRecord(pack) && typeof pack.packId === "string" ? pack.packId : "";
  if (!isRecord(pack)) return { diagnostics: [diagnostic("INVALID_PACK", "", "pack", "content pack must be an object")] };
  if (!nonEmptyString(pack.packId)) diagnostics.push(diagnostic("INVALID_ID", packId, "packId", "packId must be a non-empty string"));
  if (context.existingPackIds?.has(packId)) diagnostics.push(diagnostic("DUPLICATE_PACK", packId, "packId", `pack '${packId}' has already been loaded`));
  if (pack.schemaVersion !== SUPPORTED_CONTENT_SCHEMA_VERSION && pack.schemaVersion !== String(SUPPORTED_CONTENT_SCHEMA_VERSION)) diagnostics.push(diagnostic("UNSUPPORTED_SCHEMA_VERSION", packId, "schemaVersion", `schema version '${String(pack.schemaVersion)}' is unsupported`));
  if (!Array.isArray(pack.artifacts)) diagnostics.push(diagnostic("INVALID_VALUE", packId, "artifacts", "artifacts must be an array"));

  const artifacts: ArtifactVersion[] = [];
  const artifactRefs = new Set<string>();
  const existingRefs = context.existingArtifactRefs ?? new Set<string>();
  if (Array.isArray(pack.artifacts)) {
    for (const [index, artifact] of pack.artifacts.entries()) {
      const valid = validateArtifact(artifact, index, packId, diagnostics);
      if (!valid) continue;
      const key = idVersionKey(artifact.artifactId, artifact.version);
      if (artifactRefs.has(key) || existingRefs.has(key)) diagnostics.push(diagnostic("DUPLICATE_REF", packId, `artifacts[${index}]`, `artifact ref '${key}' is already registered in this registry`, artifact.artifactId, artifact));
      artifactRefs.add(key);
      artifacts.push(artifact);
    }
  }

  const availableToolIds = new Set<string>([...STANDARD_TOOL_IDS, ...(context.availableToolIds ?? [])]);
  for (const artifact of artifacts) if (artifact.type === "TOOL_DESCRIPTION") availableToolIds.add(artifact.artifactId);
  if (pack.toolDescriptions !== undefined && !Array.isArray(pack.toolDescriptions)) diagnostics.push(diagnostic("INVALID_VALUE", packId, "toolDescriptions", "toolDescriptions must be an array"));
  if (Array.isArray(pack.toolDescriptions)) {
    const toolIds = new Set<string>();
    for (const [index, tool] of pack.toolDescriptions.entries()) {
      if (validateToolDescription(tool, index, packId, diagnostics)) {
        if (toolIds.has(tool.id)) diagnostics.push(diagnostic("DUPLICATE_RECORD", packId, `toolDescriptions[${index}].id`, `duplicate tool id '${tool.id}'`, tool.id));
        toolIds.add(tool.id);
        availableToolIds.add(tool.id);
      }
    }
  }
  for (const artifact of artifacts) for (const [index, toolId] of artifact.requiredToolIds.entries()) if (!availableToolIds.has(toolId)) diagnostics.push(diagnostic("MISSING_REQUIRED_TOOL", packId, `artifacts[${Math.max(0, pack.artifacts.indexOf(artifact))}].requiredToolIds[${index}]`, `required tool '${toolId}' is not available`, artifact.artifactId, artifact));

  const evalRefs = new Set<string>();
  if (Array.isArray(pack.evals)) for (const [index, item] of pack.evals.entries()) {
    if (validateEval(item, index, packId, diagnostics)) {
      const key = idVersionKey(item.id, item.version);
      if (evalRefs.has(key)) diagnostics.push(diagnostic("DUPLICATE_RECORD", packId, `evals[${index}]`, `duplicate eval ref '${key}'`, item.id, { artifactId: item.id, version: item.version }));
      evalRefs.add(key);
      if (item.subjectRef && !artifactRefs.has(idVersionKey(item.subjectRef.artifactId, item.subjectRef.version)) && !existingRefs.has(idVersionKey(item.subjectRef.artifactId, item.subjectRef.version))) diagnostics.push(diagnostic("MISSING_RECORD_REFERENCE", packId, `evals[${index}].subjectRef`, `subject artifact '${idVersionKey(item.subjectRef.artifactId, item.subjectRef.version)}' is missing`, item.id));
    }
  }
  const familySets = [
    { field: "scenarios", validate: validateScenario },
    { field: "dinosaurProfiles", validate: validateDinosaurProfile },
    { field: "enclosures", validate: validateEnclosure },
    { field: "progressions", validate: validateProgression },
  ] as const;
  for (const { field, validate } of familySets) {
    const values = pack[field] as readonly unknown[] | undefined;
    if (values === undefined) continue;
    if (!Array.isArray(values)) {
      diagnostics.push(diagnostic("INVALID_VALUE", packId, field, `${field} must be an array`));
      continue;
    }
    const ids = new Set<string>();
    for (const [index, value] of values.entries()) {
      validate(value, index, packId, diagnostics);
      if (isRecord(value) && typeof value.id === "string" && typeof value.version === "number") {
        const key = idVersionKey(value.id, value.version);
        if (ids.has(key)) diagnostics.push(diagnostic("DUPLICATE_RECORD", packId, `${field}[${index}]`, `duplicate ${field} ref '${key}'`, value.id, { artifactId: value.id, version: value.version }));
        ids.add(key);
      }
    }
  }
  // Keep the valid subset available to the registry so it can report
  // relationship errors (for example a missing dependency) alongside a
  // malformed record. The caller still commits nothing when diagnostics are
  // present, preserving atomicity.
  return { diagnostics: diagnostics.sort(compareDiagnostic), value: { artifacts, toolIds: availableToolIds } };
}

export const validatePack = validateContentPack;

export function contentRefKey(ref: ArtifactRef): string {
  return idVersionKey(ref.artifactId, ref.version);
}

export function stableRefSort<T extends ArtifactRef>(values: readonly T[]): T[] {
  return values.slice().sort((a, b) => a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : a.version - b.version);
}
