import assert from "node:assert/strict";
import test from "node:test";
import {
  TelemetryClient,
  TelemetryQueue,
  computeLearningMetrics,
  createLocalTelemetryClient,
  sanitizeTelemetryPayload,
  validateTelemetryEvent,
  type SanitizedTelemetryEvent,
} from "../telemetry/index.ts";

const context = { logicalTime: 4, appVersion: "test", contentVersion: "content.test" };

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for telemetry condition");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

test("typed local first-feeding events are allowlisted and inspectable", async () => {
  const client = createLocalTelemetryClient({ installationId: "installation.test", sessionId: "session.test" });
  client.emit("CONTEXT_SNAPSHOT", { jobId: "job.feed", budget: 100, totalLoad: 42, duplicateCu: 8 }, context);
  client.emit("JOB_OUTCOME", { jobId: "job.feed", status: "SUCCEEDED", duplicateCu: 8 }, context);
  client.emit("INCIDENT", { incidentId: "incident.gate", severity: 3, category: "CONTAINMENT", uncovered: true }, context);
  await client.flush();
  assert.equal(client.local.events().length, 3);
  assert.equal((client.local.events()[0]?.payload as { readonly totalLoad?: number }).totalLoad, 42);
  assert.equal("sourceText" in client.local.events()[0]!.payload, false);
});

test("unknown, source, memory, trace, save, and PII fields are rejected", () => {
  const result = validateTelemetryEvent({
    eventId: "event.bad",
    installationId: "installation.test",
    sessionId: "session.test",
    type: "JOB_OUTCOME",
    logicalTime: 0,
    appVersion: "test",
    contentVersion: "test",
    payload: { status: "FAILED", sourceText: "private prompt", tracePayload: "hidden", email: "a@b.test", unknown: 1 } as never,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === "UNKNOWN_FIELD"));
  assert.ok(result.errors.some((entry) => entry.code === "FORBIDDEN_FIELD"));
  const sanitized = sanitizeTelemetryPayload("JOB_OUTCOME", { status: "FAILED", unknown: "drop", sourceText: "drop" });
  assert.equal(sanitized.payload, undefined);
});

test("required metadata and privacy-safe typed string values are enforced", () => {
  const missing = validateTelemetryEvent({
    eventId: "event.missing",
    type: "JOB_OUTCOME",
    logicalTime: 0,
    payload: { status: "FAILED" },
  } as never);
  assert.equal(missing.valid, false);
  for (const field of ["installationId", "sessionId", "appVersion", "contentVersion"]) assert.ok(missing.errors.some((entry) => entry.path === `context.${field}`), `${field} must be required`);

  for (const payload of [
    { status: "FAILED", jobId: "developer@example.com" },
    { status: "FAILED", jobId: "+1 (206) 555-0199" },
    { status: "arbitrary private sentence with spaces", jobId: "job.safe" },
  ]) {
    const rejected = validateTelemetryEvent({ eventId: "event.adversarial", installationId: "installation.safe", sessionId: "session.safe", type: "JOB_OUTCOME", logicalTime: 0, appVersion: "1.0.0", contentVersion: "curriculum.v1", payload } as never);
    assert.equal(rejected.valid, false);
    assert.ok(rejected.errors.some((entry) => entry.code === "PII_FIELD" || entry.code === "INVALID_FIELD"));
  }
  const sensitiveMetadata = validateTelemetryEvent({ eventId: "event.metadata", installationId: "owner@example.com", sessionId: "+12065550199", type: "JOB_OUTCOME", logicalTime: 0, appVersion: "https://private.example/path", contentVersion: "curriculum v1 freeform", payload: { status: "FAILED" } });
  assert.equal(sensitiveMetadata.valid, false);
  assert.ok(sensitiveMetadata.errors.filter((entry) => entry.code === "PII_FIELD" || entry.code === "INVALID_CONTEXT").length >= 4);
  const safe = validateTelemetryEvent({ eventId: "event.safe:v1", installationId: "installation.018f", sessionId: "session.42", type: "JOB_OUTCOME", logicalTime: 0, appVersion: "1.0.0-beta.1", contentVersion: "curriculum.v1", payload: { status: "SUCCEEDED", jobId: "job.feeding-1/step:2@v1" } });
  assert.equal(safe.valid, true);
});

test("disabled telemetry keeps essential errors but ignores analytics", async () => {
  const client = createLocalTelemetryClient({ optionalEnabled: false });
  client.emit("JOB_OUTCOME", { status: "SUCCEEDED" }, context);
  client.emit("APPLICATION_ERROR", { errorCode: "ROUTE_FAILED", recoverable: true }, context);
  await client.flush();
  assert.equal(client.local.events().length, 1);
  assert.equal(client.local.events()[0]?.type, "APPLICATION_ERROR");
});

test("queue bounds, deduplicates, retries, and isolates throwing adapters", async () => {
  const queue = new TelemetryQueue({ maxItems: 2, maxRetries: 1, retryBaseMs: 0 });
  const makeEvent = (id: string, type: SanitizedTelemetryEvent["type"] = "JOB_OUTCOME"): SanitizedTelemetryEvent => ({
    schemaVersion: 1, eventId: id, installationId: "i", sessionId: "s", type, logicalTime: 0, appVersion: "a", contentVersion: "c", category: type === "APPLICATION_ERROR" ? "essential" : "analytics", payload: (type === "APPLICATION_ERROR" ? { errorCode: "E" } : { status: "SUCCEEDED" }) as never,
  });
  assert.equal(queue.enqueue(makeEvent("one")), true);
  assert.equal(queue.enqueue(makeEvent("one")), false);
  assert.equal(queue.enqueue(makeEvent("two")), true);
  assert.equal(queue.enqueue(makeEvent("three")), true);
  assert.equal(queue.size(), 2);
  await queue.flush({ send: async () => { throw new Error("offline"); } });
  assert.equal(queue.size(), 2);
  await queue.flush({ send: async (batch) => ({ acceptedIds: batch.map((event) => event.eventId) }) });
  assert.equal(queue.size(), 0);
});

test("client auto-drains every batch and schedules retry until the queue is empty", async () => {
  const delivered: string[] = [];
  let attempts = 0;
  const client = new TelemetryClient({
    queue: { batchSize: 2, retryBaseMs: 1, maxRetries: 3 },
    delivery: { send: async (batch) => {
      attempts += 1;
      if (attempts === 1) return { acceptedIds: [] };
      delivered.push(...batch.map((event) => event.eventId));
      return { acceptedIds: batch.map((event) => event.eventId) };
    } },
  });
  for (let index = 0; index < 5; index += 1) client.emit("JOB_OUTCOME", { status: "SUCCEEDED", jobId: `job.autodrain.${index}` }, { logicalTime: index });
  await waitFor(() => client.inspectQueue().entries.length === 0);
  assert.equal(new Set(delivered).size, 5);
  assert.ok(attempts >= 4, "one failed attempt and at least three two-item batches are required");
});

test("six learning metrics calculate from privacy-safe synthetic events", () => {
  const make = (eventId: string, type: SanitizedTelemetryEvent["type"], payload: Record<string, unknown>): SanitizedTelemetryEvent => ({ schemaVersion: 1, eventId, installationId: "i", sessionId: "s", type, logicalTime: 0, appVersion: "a", contentVersion: "c", category: "analytics", payload: payload as never });
  const events = [
    make("ctx1", "CONTEXT_SNAPSHOT", { jobId: "j1", budget: 100, totalLoad: 50, duplicateCu: 10 }),
    make("ctx2", "CONTEXT_SNAPSHOT", { jobId: "j2", budget: 100, totalLoad: 120, duplicateCu: 0 }),
    make("j1", "JOB_OUTCOME", { jobId: "j1", status: "SUCCEEDED" }),
    make("j2", "JOB_OUTCOME", { jobId: "j2", status: "SUCCEEDED" }),
    make("incident", "INCIDENT", { incidentId: "inc1", severity: 3, category: "GATE", uncovered: true }),
    make("eval", "EVAL_RUN", { evalId: "eval1", incidentId: "inc1", severity: 3, passed: true }),
    make("deploy1", "DEPLOY", { deploymentId: "d1", evalRunCount: 1 }),
    make("deploy2", "DEPLOY", { deploymentId: "d2", evalRunCount: 0 }),
    make("intervention", "MANUAL_INTERVENTION", { interventionType: "RESCUE" }),
    make("refactor", "ARTIFACT_REFACTOR", { artifactId: "skill.safe", incidentId: "inc1" }),
  ];
  const metrics = computeLearningMetrics(events);
  assert.equal(metrics.duplicateContextPerJob.value, 5);
  assert.equal(metrics.deploymentsWithEvalRun.value, 0.5);
  assert.equal(metrics.interventionsPer10Jobs.value, 5);
  assert.equal(metrics.uncoveredIncidentToRegression.value, 1);
  assert.equal(metrics.contextUtilizationDistribution.denominator, 2);
  assert.equal(metrics.severity3PlusEvalCoverage.value, 1);
});

test("learning metric eligibility excludes selections, invalid utilization, missing incidents, and duplicate job snapshots", () => {
  const make = (eventId: string, type: SanitizedTelemetryEvent["type"], payload: Record<string, unknown>, logicalTime = 0): SanitizedTelemetryEvent => ({ schemaVersion: 1, eventId, installationId: "i", sessionId: "s", type, logicalTime, appVersion: "a", contentVersion: "c", category: "analytics", payload: payload as never });
  const selectionOnly = computeLearningMetrics([
    make("selection", "EVAL_SELECTION", { evalId: "eval.high", selected: true, severity: 4 }),
  ]);
  assert.equal(selectionOnly.severity3PlusEvalCoverage.denominator, 1);
  assert.equal(selectionOnly.severity3PlusEvalCoverage.numerator, 0);
  const withRunEvidence = computeLearningMetrics([
    make("selection", "EVAL_SELECTION", { evalId: "eval.high", selected: true, severity: 4 }),
    make("run", "EVAL_RUN", { evalId: "eval.high", passed: true }),
  ]);
  assert.equal(withRunEvidence.severity3PlusEvalCoverage.numerator, 1);

  const metrics = computeLearningMetrics([
    make("ctx.projected", "CONTEXT_SNAPSHOT", { snapshotId: "snapshot.same", jobId: "job.1", mode: "PROJECTED", duplicateCu: 100, budget: 100, totalLoad: 50 }),
    make("ctx.actual.1", "CONTEXT_SNAPSHOT", { snapshotId: "snapshot.actual", jobId: "job.1", mode: "ACTUAL", duplicateCu: 10, budget: 100, totalLoad: 50 }),
    make("ctx.actual.duplicate", "CONTEXT_SNAPSHOT", { snapshotId: "snapshot.actual", jobId: "job.1", mode: "ACTUAL", duplicateCu: 10, budget: 100, totalLoad: 50 }),
    make("job.duplicate", "JOB_OUTCOME", { jobId: "job.1", status: "SUCCEEDED", duplicateCu: 999 }),
    make("ctx.nojob", "CONTEXT_SNAPSHOT", { duplicateCu: 500, budget: 100, totalLoad: 50 }),
    make("ctx.util-only", "CONTEXT_SNAPSHOT", { jobId: "job.2", utilization: 0.5 }),
    make("ctx.zero-budget", "CONTEXT_SNAPSHOT", { jobId: "job.3", budget: 0, totalLoad: 50 }),
    make("ctx.zero-load", "CONTEXT_SNAPSHOT", { jobId: "job.4", budget: 100, totalLoad: 0 }),
    make("incident.missing", "INCIDENT", { severity: 3, category: "GATE", uncovered: true }, 1),
    make("incident.invalid", "INCIDENT", { incidentId: "not valid freeform", severity: 3, category: "GATE", uncovered: true }, 1),
    make("incident.valid", "INCIDENT", { incidentId: "incident.valid", severity: 3, category: "GATE", uncovered: true }, 5),
    make("incident.duplicate", "INCIDENT", { incidentId: "incident.valid", severity: 3, category: "GATE", uncovered: true }, 6),
    make("eval.too-early", "EVAL_BUILD", { evalId: "eval.early", incidentId: "incident.valid", built: true }, 4),
    make("eval.later", "EVAL_BUILD", { evalId: "eval.later", incidentId: "incident.valid", built: true }, 7),
  ]);
  assert.equal(metrics.duplicateContextPerJob.numerator, 10);
  assert.equal(metrics.duplicateContextPerJob.denominator, 1);
  assert.equal(metrics.contextUtilizationDistribution.denominator, 4, "only positive finite budget/load snapshots are eligible");
  assert.equal(metrics.uncoveredIncidentToRegression.denominator, 1);
  assert.equal(metrics.uncoveredIncidentToRegression.numerator, 1);
});

test("emit stays below the one millisecond synchronous p95 budget", () => {
  const client = new TelemetryClient({ delivery: { send: async (batch) => ({ acceptedIds: batch.map((event) => event.eventId) }) } });
  const durations: number[] = [];
  for (let index = 0; index < 300; index += 1) {
    const started = performance.now();
    client.emit("JOB_OUTCOME", { status: "SUCCEEDED", jobId: `job.${index}` }, { logicalTime: index });
    durations.push(performance.now() - started);
  }
  durations.sort((a, b) => a - b);
  assert.ok(durations[Math.floor(durations.length * 0.95)] < 1, `p95 synchronous emit was ${durations[Math.floor(durations.length * 0.95)]}ms`);
});

test("local/no-op/disabled/offline/slow/throwing adapters cannot change authoritative output", async () => {
  const adapters = [
    { name: "local", delivery: createLocalTelemetryClient().delivery },
    { name: "no-op", delivery: undefined },
    { name: "disabled", delivery: undefined, optionalEnabled: false },
    { name: "offline", delivery: { send: async () => ({ acceptedIds: [] as readonly string[] }) } },
    { name: "slow", delivery: { send: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); return { acceptedIds: [] as readonly string[] }; } } },
    { name: "throwing", delivery: { send: async () => { throw new Error("adapter failure"); } } },
  ] as const;
  const outputs: string[] = [];
  for (const adapter of adapters) {
    const client = new TelemetryClient({
      ...(adapter.delivery ? { delivery: adapter.delivery } : {}),
      ...("optionalEnabled" in adapter ? { optionalEnabled: adapter.optionalEnabled } : {}),
    });
    const state = { hunger: 100, gate: "CLOSED", completed: false };
    client.emit("JOB_OUTCOME", { status: "SUCCEEDED", jobId: "job.same" }, { logicalTime: 1 });
    state.hunger -= 20;
    state.completed = state.hunger === 80;
    outputs.push(`${adapter.name}:${JSON.stringify(state)}`);
    await client.flush();
  }
  assert.deepEqual(new Set(outputs.map((output) => output.slice(output.indexOf(":") + 1))), new Set([JSON.stringify({ hunger: 80, gate: "CLOSED", completed: true })]));
});
