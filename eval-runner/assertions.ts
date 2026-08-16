import { canonicalSerialize } from "../simulation/index.ts";
import type { EvalAssertion, EvalAssertionType, JsonValue } from "../content-registry/index.ts";
import type { EvalAssertionResult, EvalExecutionOutput } from "./types.ts";

/** The MVP evaluator is intentionally closed and typed. Adding a new type is
 * a schema change rather than an arbitrary callback hidden in a suite. */
export const EVAL_ASSERTION_TYPES: readonly EvalAssertionType[] = Object.freeze([
  "STATE_EQUALS",
  "STATE_IN",
  "TOOL_CALLED",
  "TOOL_NOT_CALLED",
  "INCIDENT_MAX_SEVERITY",
  "JOB_STATUS",
  "TIME_BELOW",
  "CONTEXT_BELOW",
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asJson(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(JSON.stringify(value)) as JsonValue;
    return parsed;
  } catch {
    return String(value);
  }
}

function pathParts(path: string): readonly string[] {
  const source = path.replace(/^\$\.?/, "");
  const parts: string[] = [];
  const pattern = /(?:^|\.)([^.[]+)|\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const part = (match[1] ?? match[2] ?? "").trim();
    if (part) parts.push(part);
  }
  return parts;
}

function readPath(root: unknown, path: string | undefined): unknown {
  if (!path) return root;
  let value = root;
  for (const part of pathParts(path)) {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(part)) value = value[Number(part)];
    else if (Array.isArray(value)) value = value.find((item) => isRecord(item) && item.id === part);
    else if (isRecord(value)) value = value[part];
    else return undefined;
  }
  return value;
}

function expectedValue(assertion: EvalAssertion): unknown {
  return assertion.expected !== undefined ? assertion.expected : assertion.value;
}

function eventToolCalls(output: EvalExecutionOutput): readonly { readonly tool: string; readonly id?: string }[] {
  const calls: Array<{ readonly tool: string; readonly id?: string }> = [];
  for (const tool of output.toolCalls ?? []) calls.push({ tool });
  for (const event of output.events ?? []) {
    if (event.type !== "COMMAND_SCHEDULED" && event.type !== "TOOL_COMPLETED") continue;
    const payload = event.payload;
    const action = payload.action ?? payload.tool;
    if (typeof action === "string") calls.push({ tool: action, id: event.id });
  }
  for (const event of output.trace?.events ?? []) {
    if (event.type !== "TOOL_REQUESTED" && event.type !== "TOOL_RESULT") continue;
    const action = event.payload.tool ?? event.payload.action;
    if (typeof action === "string") calls.push({ tool: action, id: event.id });
  }
  return Object.freeze(calls);
}

function maxIncidentSeverity(output: EvalExecutionOutput): { readonly value: number; readonly evidence: readonly string[] } {
  const snapshotIncidents = output.finalSnapshot?.incidents ?? output.outcome?.worldSnapshot.incidents ?? [];
  let value = snapshotIncidents.reduce((max, incident) => Math.max(max, incident.severity), 0);
  const evidence: string[] = snapshotIncidents.map((incident) => incident.id).sort();
  for (const event of output.events ?? []) {
    if (event.type !== "INCIDENT_OPENED" && event.type !== "INCIDENT_UPDATED") continue;
    const severity = event.payload.severity;
    if (typeof severity === "number") value = Math.max(value, severity);
    evidence.push(event.id);
  }
  return { value, evidence: Object.freeze([...new Set(evidence)].sort()) };
}

export interface AssertionEvaluationContext {
  readonly output: EvalExecutionOutput;
  readonly startLogicalTime: number;
  readonly completionLogicalTime: number;
}

function result(type: EvalAssertionType, expected: unknown, observed: unknown, passed: boolean, evidenceRefs: readonly string[], message: string): EvalAssertionResult {
  return Object.freeze({ type, expected: asJson(expected), observed: asJson(observed), passed, evidenceRefs: Object.freeze([...evidenceRefs].sort()), message });
}

export function validateEvalAssertion(assertion: EvalAssertion, path = "assertion"): readonly { readonly code: string; readonly path: string; readonly message: string }[] {
  const errors: Array<{ readonly code: string; readonly path: string; readonly message: string }> = [];
  if (!EVAL_ASSERTION_TYPES.includes(assertion.type)) errors.push({ code: "INVALID_ASSERTION_TYPE", path: `${path}.type`, message: `Unsupported assertion type ${String(assertion.type)}.` });
  if (["STATE_EQUALS", "STATE_IN"].includes(assertion.type) && (!assertion.path || (assertion.expected === undefined && assertion.value === undefined))) errors.push({ code: "INVALID_ASSERTION", path, message: `${assertion.type} requires path and expected/value.` });
  if (["TOOL_CALLED", "TOOL_NOT_CALLED"].includes(assertion.type) && !assertion.toolId) errors.push({ code: "INVALID_ASSERTION", path: `${path}.toolId`, message: `${assertion.type} requires toolId.` });
  if (assertion.type === "INCIDENT_MAX_SEVERITY" && (!Number.isInteger(assertion.maxSeverity) || assertion.maxSeverity! < 0)) errors.push({ code: "INVALID_ASSERTION", path: `${path}.maxSeverity`, message: "INCIDENT_MAX_SEVERITY requires a non-negative integer maxSeverity." });
  if (assertion.type === "JOB_STATUS" && !assertion.status && assertion.expected === undefined && assertion.value === undefined) errors.push({ code: "INVALID_ASSERTION", path: `${path}.status`, message: "JOB_STATUS requires status or expected/value." });
  if (["TIME_BELOW", "CONTEXT_BELOW"].includes(assertion.type) && (!Number.isInteger(assertion.limit) || assertion.limit! < 0)) errors.push({ code: "INVALID_ASSERTION", path: `${path}.limit`, message: `${assertion.type} requires a non-negative integer limit.` });
  return Object.freeze(errors);
}

export function evaluateAssertion(assertion: EvalAssertion, context: AssertionEvaluationContext): EvalAssertionResult {
  const output = context.output;
  const snapshot = output.finalSnapshot ?? output.outcome?.worldSnapshot;
  const stateRoot = snapshot ?? output;
  const expected = expectedValue(assertion);
  switch (assertion.type) {
    case "STATE_EQUALS": {
      const observed = readPath(stateRoot, assertion.path);
      const passed = canonicalSerialize(observed) === canonicalSerialize(expected);
      return result(assertion.type, expected, observed, passed, [`snapshot:${assertion.path ?? ""}`], passed ? `State ${assertion.path} equals the expected value.` : `State ${assertion.path} did not equal the expected value.`);
    }
    case "STATE_IN": {
      const observed = readPath(stateRoot, assertion.path);
      const values = Array.isArray(expected) ? expected : [expected];
      const passed = values.some((candidate) => canonicalSerialize(candidate) === canonicalSerialize(observed));
      return result(assertion.type, expected, observed, passed, [`snapshot:${assertion.path ?? ""}`], passed ? `State ${assertion.path} is in the expected set.` : `State ${assertion.path} was outside the expected set.`);
    }
    case "TOOL_CALLED": {
      const calls = eventToolCalls(output).filter((call) => call.tool === assertion.toolId);
      return result(assertion.type, assertion.toolId, calls.length > 0, calls.length > 0, calls.flatMap((call) => call.id ? [call.id] : []), calls.length > 0 ? `Tool ${assertion.toolId} was called.` : `Tool ${assertion.toolId} was not called.`);
    }
    case "TOOL_NOT_CALLED": {
      const calls = eventToolCalls(output).filter((call) => call.tool === assertion.toolId);
      return result(assertion.type, assertion.toolId, calls.length > 0, calls.length === 0, calls.flatMap((call) => call.id ? [call.id] : []), calls.length === 0 ? `Tool ${assertion.toolId} was not called.` : `Tool ${assertion.toolId} was called unexpectedly.`);
    }
    case "INCIDENT_MAX_SEVERITY": {
      const severity = maxIncidentSeverity(output);
      const limit = assertion.maxSeverity ?? Number(expected ?? 0);
      const passed = severity.value <= limit;
      return result(assertion.type, limit, severity.value, passed, severity.evidence, passed ? `Maximum incident severity ${severity.value} is within ${limit}.` : `Maximum incident severity ${severity.value} exceeds ${limit}.`);
    }
    case "JOB_STATUS": {
      const observed = output.outcome?.status;
      const wanted = assertion.status ?? expected;
      const passed = canonicalSerialize(observed) === canonicalSerialize(wanted);
      return result(assertion.type, wanted, observed, passed, output.outcome ? [`job:${output.outcome.jobId}`] : [], passed ? `Job status is ${String(wanted)}.` : `Job status was ${String(observed)}; expected ${String(wanted)}.`);
    }
    case "TIME_BELOW": {
      const observed = output.durationLogicalTime ?? Math.max(0, context.completionLogicalTime - context.startLogicalTime);
      const limit = assertion.limit ?? Number(expected ?? 0);
      const passed = observed < limit;
      return result(assertion.type, limit, observed, passed, [`time:${context.startLogicalTime}-${context.completionLogicalTime}`], passed ? `Elapsed logical time ${observed} is below ${limit}.` : `Elapsed logical time ${observed} is not below ${limit}.`);
    }
    case "CONTEXT_BELOW": {
      const observed = output.contextLoad ?? output.replayManifest?.contextSnapshot?.totalLoad ?? output.replayManifest?.job?.contextSnapshot?.totalLoad;
      const limit = assertion.limit ?? Number(expected ?? 0);
      const passed = typeof observed === "number" && observed < limit;
      return result(assertion.type, limit, observed, passed, observed === undefined ? [] : [`context:${output.replayManifest?.contextSnapshotId ?? output.replayManifest?.contextSnapshot?.id ?? "unknown"}`], passed ? `Context load ${observed} is below ${limit}.` : `Context load ${String(observed)} is not below ${limit}.`);
    }
  }
}

export function evaluateAssertions(assertions: readonly EvalAssertion[], context: AssertionEvaluationContext): readonly EvalAssertionResult[] {
  return Object.freeze(assertions.map((assertion) => evaluateAssertion(assertion, context)));
}

export interface AssertionEngine {
  readonly evaluate: (assertion: EvalAssertion, context: AssertionEvaluationContext) => EvalAssertionResult;
  readonly evaluateAll: (assertions: readonly EvalAssertion[], context: AssertionEvaluationContext) => readonly EvalAssertionResult[];
  readonly validate: (assertion: EvalAssertion, path?: string) => readonly { readonly code: string; readonly path: string; readonly message: string }[];
}

export function createAssertionEngine(): AssertionEngine {
  return Object.freeze({ evaluate: evaluateAssertion, evaluateAll: evaluateAssertions, validate: validateEvalAssertion });
}

export const createEvalAssertionEngine = createAssertionEngine;
