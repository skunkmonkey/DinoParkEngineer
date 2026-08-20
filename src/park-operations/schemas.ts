import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u);
const nonnegative = z.number().int().nonnegative();
const reference = z.strictObject({ id, version: z.string().min(1), expectedClass: z.string().optional(), expectedSchemaVersion: z.string().optional() });
const phase = z.enum(["pre-opening", "open", "closing", "engineering"]);
const status = z.enum(["queued", "assigned", "running", "paused", "cancelled", "completed", "failed", "stopped", "escalated"]);
const pin = z.strictObject({ reference, manifestFingerprint: z.string().min(1) });
const job = z.strictObject({ id, occurrenceId: id.optional(), task: reference, targetId: id, priority: z.number().int(), scheduleId: id.optional(), source: z.enum(["schedule", "player", "system"]), status, exactDeployedVersions: z.array(pin), assignedAgentId: id.optional(), createdTick: nonnegative, dueTick: nonnegative, requiredForOpening: z.boolean(), resultLinks: z.array(id) });
const schedule = z.strictObject({ id, task: reference, targetId: id, priority: z.number().int(), dueTickOffset: nonnegative, artifactVersions: z.array(reference).min(1), requiredForOpening: z.boolean(), enabled: z.boolean() });
const occurrence = z.strictObject({ id, scheduleId: id, day: z.number().int().positive(), dueTick: nonnegative, jobId: id });
const signal = z.strictObject({ id, tick: nonnegative, classification: z.enum(["ambient", "warning", "emergency"]), source: z.enum(["world", "job", "context", "system"]), causalKey: z.string().min(1), spatialKey: z.string().min(1), locationId: id, risk: z.number().int().min(0).max(100), expected: z.string().min(1), observed: z.string().min(1), consequence: z.string().min(1), immediateGap: z.string().min(1), entityIds: z.array(id), traceIds: z.array(id) });
const alert = z.strictObject({ id, signalId: id, tick: nonnegative, severity: z.enum(["warning", "emergency"]), status: z.enum(["queued", "interrupted", "acknowledged", "grouped"]), locationId: id, immediateRisk: z.string().min(1), risk: z.number().int().min(0).max(100), entityIds: z.array(id), traceIds: z.array(id), incidentId: id.optional(), pauseRequested: z.boolean() });
const incident = z.strictObject({ id, status: z.enum(["detected", "active", "stabilized", "engineering-unresolved", "resolved", "closed"]), detectedTick: nonnegative, updatedTick: nonnegative, causalKeys: z.array(z.string().min(1)), spatialKeys: z.array(z.string().min(1)), locationId: id, risk: z.number().int().min(0).max(100), expected: z.string().min(1), observed: z.array(z.string().min(1)), consequence: z.array(z.string().min(1)), immediateGap: z.array(z.string().min(1)), entityIds: z.array(id), traceIds: z.array(id), alertIds: z.array(id), stabilizedTick: nonnegative.optional(), resolvedTick: nonnegative.optional(), closedTick: nonnegative.optional() });
const summary = z.strictObject({ id, day: z.number().int().positive(), startTick: nonnegative, endTick: nonnegative, attendance: nonnegative, departedVisitors: nonnegative, completedJobIds: z.array(id), failedJobIds: z.array(id), incidentIds: z.array(id), interventionCommandIds: z.array(id) });

export const operationalSignalSchema = signal;
export const parkOperationsStateSchema = z.strictObject({ schemaVersion: z.literal("1"), day: z.number().int().positive(), dayStartedTick: nonnegative, tick: nonnegative, phase, paused: z.boolean(), speed: z.union([z.literal(1), z.literal(2), z.literal(4)]), visitorsPresent: nonnegative, totalAttendance: nonnegative, departedVisitors: nonnegative, jobs: z.array(job), schedules: z.array(schedule), occurrences: z.array(occurrence), signals: z.array(signal), alerts: z.array(alert), incidents: z.array(incident), interventionCommandIds: z.array(id), daySummaries: z.array(summary) });

const base = { id, expectedTick: nonnegative };
const createJobInput = job.omit({ status: true, exactDeployedVersions: true, resultLinks: true });
export const parkOperationsCommandSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.literal("create-job"), job: createJobInput, artifactVersions: z.array(reference).min(1) }),
  z.strictObject({ ...base, kind: z.literal("assign-job"), jobId: id, agentId: id }),
  ...(["start-job", "pause-job", "resume-job", "cancel-job", "complete-job", "fail-job", "stop-job", "escalate-job"] as const).map((kind) => z.strictObject({ ...base, kind: z.literal(kind), jobId: id, resultLink: id.optional() })),
  z.strictObject({ ...base, kind: z.literal("transition-phase"), phase }),
  z.strictObject({ ...base, kind: z.literal("set-time-control"), paused: z.boolean(), speed: z.union([z.literal(1), z.literal(2), z.literal(4)]) }),
  ...(["open-park", "begin-closing", "enter-engineering", "start-next-day"] as const).map((kind) => z.strictObject({ ...base, kind: z.literal(kind) })),
  ...(["admit-visitors", "depart-visitors"] as const).map((kind) => z.strictObject({ ...base, kind: z.literal(kind), count: z.number().int().positive() })),
  z.strictObject({ ...base, kind: z.literal("acknowledge-alert"), alertId: id }),
  ...(["activate-incident", "stabilize-incident", "mark-engineering-unresolved", "resolve-incident", "close-incident"] as const).map((kind) => z.strictObject({ ...base, kind: z.literal(kind), incidentId: id })),
]);
