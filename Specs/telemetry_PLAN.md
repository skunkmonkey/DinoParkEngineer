# Plan: Privacy-Conscious Product and Learning Telemetry

## Implementation Boundary and Contracts

Own typed event catalog/schema validation, sanitizer, consent/config, bounded queue, no-op/local/remote adapter interfaces, learning metric definitions, and privacy diagnostics. Do not own production analytics vendor/dashboard, domain stores, experiments, or gameplay decisions.

```ts
interface TelemetryPort { emit<E extends TelemetryEventType>(type:E,payload:TelemetryPayloads[E],context:TelemetryContext):void; setOptionalEnabled(enabled:boolean):void; }
interface TelemetryDelivery { send(batch:readonly SanitizedTelemetryEvent[]):Promise<{acceptedIds:string[]}>; }
```

Provide a no-op implementation as the safe default. Domain features depend only on the port package and cannot read telemetry state/results.

## Proposed Vertical Slices

1. Typed local telemetry for first-feeding learning loop
   - Blocked by: stable public events/ids
   - Add schema/version/context, no-op/local sinks, job/incident/context/eval/review/deploy/intervention events, allowlist validation, and acceptance-test inspection.
2. Privacy exclusions and enable/disable controls
   - Blocked by: #1 and shell preferences/status
   - Add disclosure, optional collection control, anonymous random ids, forbidden field tests, queue clear/inspection, and no text/trace/save/PII payloads.
3. Bounded queue and resilient delivery abstraction
   - Blocked by: #1, #2
   - Batch/deduplicate/retry/backoff/bounds, offline/no-op adapter, throwing/slow adapter isolation, nonblocking performance test, and optional persistence adapter.
4. Complete event catalog across all MVP features
   - Blocked by: feature public events
   - Add typed minimal events for all FR-01.2 areas, version compatibility, stable scenario/phase ids, schema fixtures, and integration contract docs.
5. Versioned learning metric specifications
   - Blocked by: #4
   - Define/test six required metrics with numerator/denominator/eligibility/missing data, synthetic datasets, and verify source/PII unnecessary.

## Completion Gate

Run the first vertical slice with local, no-op, disabled, offline, slow, and throwing adapters; authoritative outputs remain identical. Validate all events against allowlists, reject forbidden data, keep bounded queue, compute all required metrics from synthetic events, and pass tests/typecheck/performance/accessibility/build.
