# Telemetry boundary

Gameplay features may import the public entry at `src/telemetry/public.ts` and
call `TelemetryPort.emit`. Producers supply stable ids, categories, counts, and
bounded measurements only. They do not pass source text, memory, traces, save
contents, or arbitrary error strings.

All events carry schema version, event id, anonymous installation/session ids,
logical game time, app/content versions, and optional curriculum phase/scenario
ids. `TelemetryClient` defaults to a no-op delivery adapter. Local inspection
uses `createLocalTelemetryClient`; production delivery is replaceable through
the `TelemetryDelivery` port.

The queue is bounded, deduplicates by event id, sends batches, and retains
failed batches with exponential backoff. `SAVE_ERROR` and `APPLICATION_ERROR`
are classified as essential local diagnostics; all other events obey optional
analytics consent. No queue or delivery result is exposed to gameplay feature
logic.

The six version-1 learning metrics are exported from `LEARNING_METRIC_DEFINITIONS`
and `computeLearningMetrics`: duplicate context per job, severity-3+ eval
coverage, deployments with an eval run, context-utilization distribution,
interventions per 10 jobs, and uncovered-incident-to-regression conversion.

