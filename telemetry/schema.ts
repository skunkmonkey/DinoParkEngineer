import {
  TELEMETRY_SCHEMA_VERSION,
  type SanitizedTelemetryEvent,
  type TelemetryContext,
  type TelemetryEventType,
  type TelemetryPayload,
  type TelemetryPayloads,
  type TelemetryValidationError,
  type TelemetryValidationResult,
} from "./types.ts";

type FieldKind = "string" | "number" | "boolean";
interface EventSchema {
  readonly fields: Readonly<Record<string, FieldKind>>;
  readonly required: readonly string[];
}

const stringFields = (names: readonly string[]): Readonly<Record<string, FieldKind>> => Object.fromEntries(names.map((name) => [name, "string" as const]));
const numberFields = (names: readonly string[]): Readonly<Record<string, FieldKind>> => Object.fromEntries(names.map((name) => [name, "number" as const]));
const booleanFields = (names: readonly string[]): Readonly<Record<string, FieldKind>> => Object.fromEntries(names.map((name) => [name, "boolean" as const]));
const joinFields = (...parts: readonly Readonly<Record<string, FieldKind>>[]): Readonly<Record<string, FieldKind>> => Object.assign({}, ...parts);

const contextFields = joinFields(
  stringFields(["snapshotId", "jobId", "agentId", "mode"]),
  numberFields(["budget", "totalLoad", "utilization", "itemCount", "duplicateCu", "duplicateContextCu", "findingCount"]),
  booleanFields(["overflow"]),
);
const schemas: Readonly<Record<TelemetryEventType, EventSchema>> = {
  CONTEXT_SNAPSHOT: { fields: contextFields, required: [] },
  CONTEXT_SUMMARY: { fields: contextFields, required: [] },
  CONTEXT_FINDING: {
    fields: joinFields(stringFields(["snapshotId", "findingCode"]), numberFields(["severity", "cuImpact"]), booleanFields(["duplicate", "stale", "applicabilityMismatch"])),
    required: ["findingCode"],
  },
  JOB_OUTCOME: {
    fields: joinFields(stringFields(["jobId", "status"]), numberFields(["duration", "severity", "toolCallCount", "contextLoad", "contextBudget", "duplicateCu", "duplicateContextCu"]), booleanFields(["interventionRequired", "evalRun"])),
    required: ["status"],
  },
  INCIDENT: {
    fields: joinFields(stringFields(["incidentId", "category", "status", "jobId"]), numberFields(["severity"]), booleanFields(["uncovered"])),
    required: ["severity", "category"],
  },
  EVAL_BUILD: {
    fields: joinFields(stringFields(["evalId", "riskLevel", "incidentId", "fromIncidentId"]), numberFields(["evalVersion", "severity", "buildCost"]), booleanFields(["built"])),
    required: ["evalId"],
  },
  EVAL_RUN: {
    fields: joinFields(stringFields(["evalId", "runId", "incidentId", "fromIncidentId"]), numberFields(["evalVersion", "severity", "assertionCount", "failedAssertionCount", "runCost", "contextLoad"]), booleanFields(["passed"])),
    required: ["evalId", "passed"],
  },
  EVAL_SELECTION: {
    fields: joinFields(stringFields(["evalId", "suiteId"]), numberFields(["evalVersion", "severity"]), booleanFields(["selected"])),
    required: ["evalId", "selected"],
  },
  REVIEW: {
    fields: joinFields(stringFields(["reviewId", "artifactId", "decision", "riskLevel"]), numberFields(["artifactVersion", "evalRunCount", "contextDeltaCu"])),
    required: ["reviewId"],
  },
  DEPLOY: {
    fields: joinFields(stringFields(["deploymentId", "artifactId", "outcome"]), numberFields(["artifactVersion", "evalRunCount", "coveredSeverity", "warningCount"]), booleanFields(["evalRun", "hasEvalRun"])),
    required: [],
  },
  REVERT: {
    fields: joinFields(stringFields(["deploymentId", "artifactId", "reasonCategory"]), numberFields(["artifactVersion"])),
    required: [],
  },
  ARTIFACT_REFACTOR: {
    fields: joinFields(stringFields(["artifactId", "incidentId", "fromIncidentId"]), numberFields(["fromVersion", "toVersion", "fromCu", "toCu", "duplicateCu", "moduleCount"])),
    required: ["artifactId"],
  },
  CAPABILITY: {
    fields: joinFields(stringFields(["capabilityId", "currency", "reasonCode"]), numberFields(["level", "amount"]), booleanFields(["success"])),
    required: ["capabilityId"],
  },
  UNLOCK: {
    fields: joinFields(stringFields(["capabilityId", "reasonCode"]), numberFields(["level"])),
    required: ["capabilityId"],
  },
  PURCHASE: {
    fields: joinFields(stringFields(["purchaseId", "capabilityId", "currency", "reasonCode"]), numberFields(["amount"]), booleanFields(["success"])),
    required: ["amount"],
  },
  MANUAL_INTERVENTION: {
    fields: joinFields(stringFields(["jobId", "interventionType", "reasonCategory"]), numberFields(["severity", "jobsSinceLast", "count"])),
    required: ["interventionType"],
  },
  MANAGER_ADOPTION: {
    fields: joinFields(stringFields(["managerId", "reasonCode"]), numberFields(["managerVersion", "workerCount"]), booleanFields(["eligible", "adopted"])),
    required: ["managerId", "adopted"],
  },
  MANAGER_ASSIGNMENT: {
    fields: joinFields(stringFields(["managerId", "jobId", "workerId", "reasonCategory"]), numberFields(["concurrentCount"]), booleanFields(["accepted"])),
    required: ["managerId", "accepted"],
  },
  MANAGER_ESCALATION: {
    fields: joinFields(stringFields(["managerId", "jobId", "incidentId", "reasonCategory"]), numberFields(["severity", "fallbackAttempts"])),
    required: ["managerId", "severity"],
  },
  SAVE_ERROR: {
    fields: joinFields(stringFields(["operation", "errorCode"]), numberFields(["stateVersion"]), booleanFields(["recoverable"])),
    required: ["operation", "errorCode"],
  },
  APPLICATION_ERROR: {
    fields: joinFields(stringFields(["errorCode", "surface", "featureId"]), numberFields(["count"]), booleanFields(["recoverable"])),
    required: ["errorCode"],
  },
};

export const TELEMETRY_EVENT_SCHEMAS = schemas;
export const TELEMETRY_EVENT_TYPES = Object.freeze(Object.keys(schemas) as TelemetryEventType[]);

/**
 * Names which are never legal in telemetry. The check is intentionally
 * conservative: an unknown value is safer to drop than to accidentally send.
 */
const FORBIDDEN_NAME = /(?:source|text|prompt|memory|trace|save(?:Data|Contents|State)?|stack|exception|errorMessage|message|raw|payload|content|reason(?!Category|Code)|email|phone|user|name|ip|address|cookie|token|password|secret|device)/i;
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const EMAIL_VALUE = /(?:^|[^A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:$|[^A-Za-z0-9.-])/;
const IPV4_VALUE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const PHONE_VALUE = /^\+?[\d\s().-]{7,}$/;
const URL_VALUE = /^(?:https?|file):\/\//i;

function error(code: TelemetryValidationError["code"], path: string, message: string): TelemetryValidationError {
  return Object.freeze({ code, path, message });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateSafeString(value: unknown, path: string): TelemetryValidationError | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return error("INVALID_FIELD", path, `${path} must be a short non-empty string`);
  if (EMAIL_VALUE.test(value) || IPV4_VALUE.test(value) || URL_VALUE.test(value) || (PHONE_VALUE.test(value) && value.replace(/\D/g, "").length >= 7)) {
    return error("PII_FIELD", path, `${path} resembles personally identifying data`);
  }
  if (!SAFE_TOKEN.test(value)) return error("INVALID_FIELD", path, `${path} must be a stable id or allowlisted category token, not freeform text`);
  return undefined;
}

function validateContext(context: TelemetryContext): readonly TelemetryValidationError[] {
  const errors: TelemetryValidationError[] = [];
  if (!Number.isInteger(context.logicalTime) || context.logicalTime < 0) errors.push(error("INVALID_CONTEXT", "context.logicalTime", "logicalTime must be a non-negative integer"));
  for (const key of ["installationId", "sessionId", "appVersion", "contentVersion"] as const) {
    const value = context[key];
    const invalid = validateSafeString(value, `context.${key}`);
    if (invalid) errors.push(error(invalid.code === "PII_FIELD" ? "PII_FIELD" : "INVALID_CONTEXT", invalid.path, `${key} is required and must be a privacy-safe stable token`));
  }
  for (const key of ["phaseId", "scenarioId"] as const) {
    const value = context[key];
    if (value === undefined) continue;
    const invalid = validateSafeString(value, `context.${key}`);
    if (invalid) errors.push(invalid);
  }
  return errors;
}

function clonePayload(type: TelemetryEventType, payload: TelemetryPayload): { readonly value?: Record<string, string | number | boolean>; readonly errors: readonly TelemetryValidationError[] } {
  const schema = schemas[type];
  if (!schema) return { errors: [error("UNKNOWN_EVENT_TYPE", "type", `Unknown event type ${type}`)] };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return { errors: [error("INVALID_EVENT", "payload", "payload must be a plain object")] };
  const errors: TelemetryValidationError[] = [];
  const value: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(payload as Record<string, unknown>)) {
    const path = `payload.${key}`;
    if (FORBIDDEN_NAME.test(key)) {
      errors.push(error("FORBIDDEN_FIELD", path, `${key} is excluded from telemetry`));
      continue;
    }
    const expected = schema.fields[key];
    if (!expected) {
      errors.push(error("UNKNOWN_FIELD", path, `${key} is not allowlisted for ${type}`));
      continue;
    }
    if (expected === "string") {
      const invalid = validateSafeString(raw, path);
      if (invalid) errors.push(invalid);
      else value[key] = raw as string;
    }
    else if (expected === "number" && !isFiniteNumber(raw)) errors.push(error("INVALID_FIELD", path, `${key} must be a finite number`));
    else if (expected === "boolean" && typeof raw !== "boolean") errors.push(error("INVALID_FIELD", path, `${key} must be boolean`));
    else value[key] = raw as number | boolean;
  }
  for (const required of schema.required) if (!(required in value)) errors.push(error("INVALID_FIELD", `payload.${required}`, `${required} is required`));
  return { value: errors.length === 0 ? Object.freeze(value) : undefined, errors: Object.freeze(errors) };
}

export interface TelemetryEventInput<E extends TelemetryEventType = TelemetryEventType> {
  readonly schemaVersion?: number;
  readonly eventId?: string;
  readonly id?: string;
  readonly installationId: string;
  readonly sessionId: string;
  readonly type: E;
  readonly logicalTime: number;
  readonly appVersion: string;
  readonly contentVersion: string;
  readonly phaseId?: string;
  readonly scenarioId?: string;
  readonly category?: "analytics" | "essential";
  readonly payload: TelemetryPayloads[E];
}

/** Strict validation and sanitization. Invalid/unknown/forbidden fields are rejected. */
export function validateTelemetryEvent<E extends TelemetryEventType>(input: TelemetryEventInput<E>): TelemetryValidationResult<E> {
  const errors: TelemetryValidationError[] = [];
  const allowedEventKeys = new Set(["schemaVersion", "eventId", "id", "installationId", "sessionId", "type", "logicalTime", "appVersion", "contentVersion", "phaseId", "scenarioId", "category", "payload"]);
  for (const key of Object.keys(input as unknown as Record<string, unknown>)) {
    if (!allowedEventKeys.has(key)) errors.push(error(FORBIDDEN_NAME.test(key) ? "FORBIDDEN_FIELD" : "UNKNOWN_FIELD", key, `${key} is not allowlisted on telemetry events`));
  }
  if (input.schemaVersion !== undefined && input.schemaVersion !== TELEMETRY_SCHEMA_VERSION) errors.push(error("INVALID_EVENT", "schemaVersion", "unsupported telemetry schema version"));
  const eventId = input.eventId ?? input.id;
  const invalidEventId = validateSafeString(eventId, "eventId");
  if (invalidEventId) errors.push(invalidEventId.code === "PII_FIELD" ? invalidEventId : error("INVALID_EVENT", "eventId", "eventId (or id) must be a privacy-safe stable token"));
  if (input.eventId !== undefined && input.id !== undefined && input.eventId !== input.id) errors.push(error("INVALID_EVENT", "id", "id and eventId must match when both are present"));
  if (input.category !== undefined && input.category !== "analytics" && input.category !== "essential") errors.push(error("INVALID_EVENT", "category", "category must be analytics or essential"));
  errors.push(...validateContext(input));
  if (!schemas[input.type]) errors.push(error("UNKNOWN_EVENT_TYPE", "type", `Unknown event type ${String(input.type)}`));
  const payload = schemas[input.type] ? clonePayload(input.type, input.payload as TelemetryPayload) : { errors: [] as readonly TelemetryValidationError[] };
  errors.push(...payload.errors);
  if (errors.length > 0 || !payload.value) return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  const event = Object.freeze({
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    eventId: eventId as string,
    id: eventId as string,
    installationId: input.installationId,
    sessionId: input.sessionId,
    type: input.type,
    logicalTime: input.logicalTime,
    appVersion: input.appVersion,
    contentVersion: input.contentVersion,
    ...(input.phaseId === undefined ? {} : { phaseId: input.phaseId }),
    ...(input.scenarioId === undefined ? {} : { scenarioId: input.scenarioId }),
    category: isEssentialTelemetryEvent(input.type) ? "essential" : input.category ?? "analytics",
    payload: payload.value,
  }) as unknown as SanitizedTelemetryEvent<E>;
  return Object.freeze({ valid: true, event, errors: Object.freeze([]) });
}

/**
 * Sanitizes a loose producer object by dropping unknown fields. It is useful at
 * an integration edge that cannot use the generic payload type. The strict
 * validator remains the default for TelemetryClient.
 */
export function sanitizeTelemetryPayload<E extends TelemetryEventType>(type: E, payload: unknown): { readonly payload?: TelemetryPayloads[E]; readonly errors: readonly TelemetryValidationError[] } {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return { errors: [error("INVALID_EVENT", "payload", "payload must be a plain object")] };
  const schema = schemas[type];
  if (!schema) return { errors: [error("UNKNOWN_EVENT_TYPE", "type", `Unknown event type ${type}`)] };
  const safe: Record<string, unknown> = {};
  const errors: TelemetryValidationError[] = [];
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN_NAME.test(key)) {
      errors.push(error("FORBIDDEN_FIELD", `payload.${key}`, `${key} is excluded from telemetry`));
      continue;
    }
    if (schema.fields[key]) safe[key] = value;
    else errors.push(error("UNKNOWN_FIELD", `payload.${key}`, `${key} is not allowlisted for ${type}`));
  }
  const checked = clonePayload(type, safe as TelemetryPayload);
  errors.push(...checked.errors);
  return { payload: errors.length === 0 && checked.errors.length === 0 ? checked.value as unknown as TelemetryPayloads[E] : undefined, errors: Object.freeze([...errors, ...checked.errors]) };
}

export function isTelemetryEventType(value: unknown): value is TelemetryEventType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(schemas, value);
}

export function isEssentialTelemetryEvent(type: TelemetryEventType): boolean {
  return type === "SAVE_ERROR" || type === "APPLICATION_ERROR";
}

/** Small registry facade for feature adapters and contract tests. */
export class EventSchemaRegistry {
  public readonly version = TELEMETRY_SCHEMA_VERSION;
  public readonly types = TELEMETRY_EVENT_TYPES;
  public isKnown(type: unknown): type is TelemetryEventType { return isTelemetryEventType(type); }
  public allowedFields(type: TelemetryEventType): readonly string[] { return Object.freeze(Object.keys(schemas[type]?.fields ?? {}).sort()); }
  public validate<E extends TelemetryEventType>(event: TelemetryEventInput<E>): TelemetryValidationResult<E> { return validateTelemetryEvent(event); }
  public sanitizePayload<E extends TelemetryEventType>(type: E, payload: unknown) { return sanitizeTelemetryPayload(type, payload); }
}

export function createTelemetrySchemaRegistry(): EventSchemaRegistry { return new EventSchemaRegistry(); }
export const validateEvent = validateTelemetryEvent;
export const sanitizeTelemetryEvent = validateTelemetryEvent;

export const TELEMETRY_DISCLOSURE = Object.freeze({
  title: "Privacy-conscious telemetry",
  collected: Object.freeze([
    "stable gameplay and learning categories",
    "counts, bounded measurements, and stable content ids",
    "logical game time and anonymous installation/session ids",
  ]),
  excluded: Object.freeze([
    "source text or prompts",
    "memory contents or full traces",
    "save data and imported files",
    "names, contact details, device identifiers, and arbitrary error text",
  ]),
  optional: true,
});
