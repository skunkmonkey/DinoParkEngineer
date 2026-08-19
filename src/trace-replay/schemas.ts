import { z } from "zod";

import { contextItemSchema } from "../context/public.js";
import { decisionOutcomeSchema, instructionEvidenceSchema } from "../instruction/public.js";
import { worldCommandSchema, worldStateSchema } from "../simulation/public.js";

const stableId = z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const reasonCode = z.string().regex(/^[A-Z][A-Z0-9_]*$/u);
const reference = z.strictObject({
  id: stableId,
  version: z.string().min(1),
  expectedClass: z.string().optional(),
  expectedSchemaVersion: z.string().optional(),
});
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export const traceSchemaVersionSchema = z.literal("1");
export const traceModeSchema = z.enum(["production", "eval", "historical-replay"]);
export const traceStatusSchema = z.enum(["recording", "complete", "interrupted", "invalid", "incomplete"]);
export const traceEventKindSchema = z.enum([
  "task", "context-assembly", "retention", "clause-applicability", "decision",
  "tool-request", "tool-result", "evidence", "world-delta", "message", "delegation",
  "outcome", "incident-link", "capture-fault", "snapshot",
]);

export const traceLinkKindSchema = z.enum([
  "park", "task", "job", "agent", "entity", "evidence", "artifact", "eval",
  "review", "deployment", "incident", "trace", "replay",
]);
export const traceLinkSchema = z.strictObject({ kind: traceLinkKindSchema, id: stableId, relation: z.string().min(1).optional() });
export const traceRootSchema = z.strictObject({ taskId: stableId.optional(), jobId: stableId.optional(), evalId: stableId.optional() }).refine(
  (root) => root.taskId !== undefined || root.jobId !== undefined || root.evalId !== undefined,
  { message: "Trace root must identify a Task, job, or eval." },
);

export const traceContentManifestEntrySchema = z.strictObject({
  reference,
  class: z.string().min(1).optional(),
  schemaVersion: version.optional(),
  fingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u).optional(),
});
export const traceContentManifestSchema = z.strictObject({
  schemaVersion: traceSchemaVersionSchema,
  entries: z.array(traceContentManifestEntrySchema),
  fingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
});
export const traceStateReferenceSchema = z.strictObject({
  initialTick: z.number().int().nonnegative(),
  initialFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
});
export const traceOutcomeSchema = z.strictObject({
  kind: z.enum(["complete", "failure", "stop", "escalate", "interrupted"]),
  reasonCode,
  expected: z.string().optional(),
  observed: z.string().optional(),
  consequence: z.string().optional(),
  immediateCausalGap: z.string().optional(),
});
export const traceCaptureFaultSchema = z.strictObject({
  code: z.enum([
    "TRACE_CAPTURE_INVALID", "TRACE_CAPTURE_APPEND_FAILED", "TRACE_CAPTURE_FINALIZE_FAILED",
    "TRACE_CAPTURE_PROHIBITED_FIELD", "TRACE_CAPTURE_SEQUENCE", "TRACE_CAPTURE_CAUSAL_LINK",
  ]),
  scope: z.enum(["identity", "event", "finalize", "authority"]),
  message: z.string().min(1),
  eventId: stableId.optional(),
  tick: z.number().int().nonnegative().optional(),
});

const contextManifestEntrySchema = z.strictObject({
  item: contextItemSchema.optional(),
  itemId: stableId,
  lifecycle: z.enum(["included", "unavailable-required", "inapplicable", "excluded", "compacted", "externalized"]),
  reasonCode,
});
const contextManifestSchema = z.strictObject({
  id: stableId,
  agentId: stableId,
  jobId: stableId,
  decisionTick: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  segments: z.array(z.strictObject({
    category: z.enum(["Task", "SystemPrompt", "Skill", "Policy", "Knowledge", "Memory", "Tool", "Message", "Observation", "ToolResult", "TaskHistory", "IncidentEvidence"]),
    units: z.number().int().positive(),
  })),
  entries: z.array(contextManifestEntrySchema),
  previousManifestId: stableId.optional(),
});
const availabilityEntrySchema = z.strictObject({
  itemId: z.string().min(1),
  availability: z.enum(["available", "unavailable", "excluded", "stale", "never-routed"]),
  used: z.boolean(),
  sourceVersion: reference.optional(),
  reasonCode,
});
const clauseProvenanceSchema = z.strictObject({
  clauseId: stableId,
  source: reference,
  sourceClass: z.string().min(1),
  status: z.enum(["applied", "rejected", "conflicting"]),
  reasonCode,
});
const compositionFindingSchema = z.strictObject({
  kind: z.enum(["duplicate", "conflict"]),
  clauseIds: z.array(stableId).min(1),
  sourceReferences: z.array(reference).min(1),
  reasonCode,
});

const toolEvidenceSchema = z.strictObject({
  source: z.enum(["physical-gate", "gate-sensor", "dinosaur", "visitor", "robot"]),
  sourceId: stableId,
  field: z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u),
  value: scalar,
  reliability: z.enum(["direct", "healthy", "degraded", "unavailable"]),
});
const worldDeltaSchema = z.strictObject({
  id: stableId,
  tick: z.number().int().nonnegative(),
  entityId: stableId,
  field: z.string().min(1),
  before: scalar,
  after: scalar,
  causeId: stableId,
});
const worldEventSchema = z.strictObject({ id: stableId, tick: z.number().int().nonnegative(), kind: z.string().min(1), entityId: stableId, causeId: stableId });
const simulationDiagnosticSchema = z.strictObject({
  code: z.string().regex(/^SIM_[A-Z0-9_]+$/u),
  path: z.string().min(1),
  rule: z.string().min(1),
  message: z.string().min(1),
});
const commandResultSchema = z.discriminatedUnion("accepted", [
  z.strictObject({
    accepted: z.literal(true),
    commandId: stableId,
    resultingTick: z.number().int().nonnegative(),
    deltas: z.array(worldDeltaSchema),
    evidence: z.array(toolEvidenceSchema),
    events: z.array(worldEventSchema),
  }),
  z.strictObject({
    accepted: z.literal(false),
    commandId: stableId,
    resultingTick: z.number().int().nonnegative(),
    diagnostics: z.array(simulationDiagnosticSchema),
    deltas: z.array(worldDeltaSchema).length(0),
    evidence: z.array(toolEvidenceSchema).length(0),
    events: z.array(worldEventSchema).length(0),
  }),
]);

export const traceContextPayloadSchema = z.strictObject({
  beforeManifest: contextManifestSchema.optional(),
  afterManifest: contextManifestSchema,
  entries: z.array(availabilityEntrySchema),
  diagnostics: z.array(z.string()),
});
export const traceTaskPayloadSchema = z.strictObject({
  taskId: stableId,
  jobId: stableId.optional(),
  evalId: stableId.optional(),
  artifactReferences: z.array(reference),
  exactContentManifest: traceContentManifestSchema,
});
export const retentionAuditSchema = z.strictObject({
  id: stableId,
  policy: z.enum(["Strict", "KeepNewest", "PriorityRetention", "CompactHistory", "ExternalizeRetrieve"]),
  beforeManifestId: stableId,
  afterManifestId: stableId,
  excess: z.number().int().nonnegative(),
  retainedItemIds: z.array(stableId),
  excludedItemIds: z.array(stableId),
  compactedItemIds: z.array(stableId).optional(),
  externalizedItemIds: z.array(stableId).optional(),
  memoryReferences: z.array(reference).optional(),
  knownLostDetail: z.array(z.string().min(1)).optional(),
  halted: z.boolean(),
  reasonCode,
});
export const traceRetentionPayloadSchema = z.strictObject({
  audit: retentionAuditSchema,
  beforeEntries: z.array(contextManifestEntrySchema),
  afterEntries: z.array(contextManifestEntrySchema),
});
export const traceClausePayloadSchema = z.strictObject({
  clauseId: stableId,
  source: reference,
  sourceClass: z.string().min(1),
  status: z.enum(["applied", "rejected", "conflicting"]),
  reasonCode,
  conflictGroup: z.string().min(1).optional(),
});
export const traceDecisionPayloadSchema = z.strictObject({
  outcome: decisionOutcomeSchema,
  provenance: z.array(clauseProvenanceSchema),
  compositionFindings: z.array(compositionFindingSchema),
  availableContextItemIds: z.array(z.string().min(1)),
  unavailableContextItemIds: z.array(z.string().min(1)),
});
export const traceToolRequestPayloadSchema = z.strictObject({ command: worldCommandSchema, tool: reference.optional() });
export const traceToolResultPayloadSchema = z.strictObject({ commandResult: commandResultSchema });
export const traceEvidencePayloadSchema = z.strictObject({ evidence: z.array(z.union([toolEvidenceSchema, instructionEvidenceSchema])) });
export const traceWorldDeltaPayloadSchema = z.strictObject({ delta: worldDeltaSchema });
export const traceMessagePayloadSchema = z.strictObject({
  messageId: stableId,
  senderId: stableId,
  recipientId: stableId.optional(),
  messageType: z.enum(["report", "request", "escalation", "handoff", "notice"]),
  summary: z.string().min(1),
  contextItemIds: z.array(z.string().min(1)),
});
export const traceDelegationPayloadSchema = z.strictObject({
  delegationId: stableId,
  managerId: stableId,
  workerId: stableId,
  jobId: stableId,
  authority: z.array(z.string().min(1)),
  artifactReferences: z.array(reference),
});
export const traceOutcomePayloadSchema = z.strictObject({ outcome: traceOutcomeSchema, finalStateFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u).optional() });
export const traceIncidentLinkPayloadSchema = z.strictObject({
  incidentId: stableId,
  relation: z.enum(["detected-by", "caused-by", "evidence-for", "stabilized-by", "resolved-by"]),
});
export const traceCaptureFaultPayloadSchema = z.strictObject({ fault: traceCaptureFaultSchema });
export const traceSnapshotPayloadSchema = z.strictObject({ state: worldStateSchema, stateFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u) });

const eventBase = {
  schemaVersion: traceSchemaVersionSchema,
  id: stableId,
  tick: z.number().int().nonnegative(),
  sequence: z.number().int().positive(),
  cycleId: stableId.optional(),
  actor: traceLinkSchema.optional(),
  entityLinks: z.array(traceLinkSchema),
  causalParentIds: z.array(stableId),
};
export const traceEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...eventBase, kind: z.literal("task"), payload: traceTaskPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("context-assembly"), payload: traceContextPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("retention"), payload: traceRetentionPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("clause-applicability"), payload: traceClausePayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("decision"), payload: traceDecisionPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("tool-request"), payload: traceToolRequestPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("tool-result"), payload: traceToolResultPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("evidence"), payload: traceEvidencePayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("world-delta"), payload: traceWorldDeltaPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("message"), payload: traceMessagePayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("delegation"), payload: traceDelegationPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("outcome"), payload: traceOutcomePayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("incident-link"), payload: traceIncidentLinkPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("capture-fault"), payload: traceCaptureFaultPayloadSchema }),
  z.strictObject({ ...eventBase, kind: z.literal("snapshot"), payload: traceSnapshotPayloadSchema }),
]);

export const traceIdentitySchema = z.strictObject({
  schemaVersion: traceSchemaVersionSchema,
  id: stableId,
  mode: traceModeSchema,
  root: traceRootSchema,
  contentManifest: traceContentManifestSchema,
  seed: z.number().int().nonnegative().max(0xffffffff),
  stateReference: traceStateReferenceSchema,
  startTick: z.number().int().nonnegative(),
});
const authorityCommandSchema = z.strictObject({ decisionTick: z.number().int().nonnegative(), command: worldCommandSchema });
const authoritySchema = z.strictObject({
  initialState: worldStateSchema,
  exactContent: z.array(reference),
  allowedCommandKinds: z.array(z.enum(["move", "operate-gate", "observe-gate", "feed", "bait", "evacuate", "reserve", "release"])),
  commands: z.array(authorityCommandSchema),
  commandResults: z.array(commandResultSchema),
  worldEvents: z.array(worldEventSchema),
  worldDeltas: z.array(worldDeltaSchema),
});
export const traceSchema = z.strictObject({
  schemaVersion: traceSchemaVersionSchema,
  id: stableId,
  identity: traceIdentitySchema,
  mode: traceModeSchema,
  root: traceRootSchema,
  contentManifest: traceContentManifestSchema,
  seed: z.number().int().nonnegative().max(0xffffffff),
  stateReference: traceStateReferenceSchema,
  startTick: z.number().int().nonnegative(),
  endTick: z.number().int().nonnegative().optional(),
  status: traceStatusSchema,
  events: z.array(traceEventSchema),
  authority: authoritySchema,
  finalState: worldStateSchema.optional(),
  outcome: traceOutcomeSchema.optional(),
  captureFaults: z.array(traceCaptureFaultSchema),
});
export const traceRecordSchema = traceSchema;

export const replayCursorSchema = z.strictObject({ tick: z.number().int().nonnegative(), sequence: z.number().int().nonnegative(), eventId: stableId.optional() });
export const replayDiagnosticSchema = z.strictObject({
  code: z.enum(["REPLAY_SCHEMA_INCOMPATIBLE", "REPLAY_CONTENT_MISSING", "REPLAY_TRACE_INCOMPLETE", "REPLAY_SEEK_INVALID", "REPLAY_APPLY_FAILED"]),
  message: z.string().min(1),
  path: z.string().min(1).optional(),
});
export const replaySessionSnapshotSchema = z.strictObject({
  schemaVersion: traceSchemaVersionSchema,
  sessionId: stableId,
  traceId: stableId,
  mode: z.literal("historical-replay"),
  status: z.enum(["ready", "playing", "paused", "unavailable", "invalid"]),
  paused: z.boolean(),
  speed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  cursor: replayCursorSchema,
  world: worldStateSchema,
  focusedLink: traceLinkSchema.optional(),
  selectedEventId: stableId.optional(),
  diagnostics: z.array(replayDiagnosticSchema),
});

export const traceSchemas = Object.freeze({ traceSchema, traceEventSchema, traceContentManifestSchema, replaySessionSnapshotSchema });
