# Plan: Trace Inspection and Replay

## Implementation Boundary and Contracts

Own trace schema/recorder/repository port, replay manifest/orchestrator/verifier, and Trace route/components. Do not produce domain decisions, mutate live state, execute eval assertions, or deploy artifacts.

```ts
interface TraceSink { begin(header:TraceStart):string; append(traceId:string,event:ProvenanceEvent|WorldEvent):void; finalize(traceId:string,outcome:JobOutcome):void; }
interface TraceQuery { get(traceId:string):TraceRecord|undefined; list(query:TraceListQuery):readonly TraceSummary[]; }
interface ReplayService { replay(manifest:ReplayManifest, controls?:ReplayControls):Promise<ReplayResult>; }
type ReplayResult = { status:'EXACT'|'DIVERGED'|'UNAVAILABLE'; firstDifference?:ReplayDifference; finalSnapshotHash?:string };
```

Persistence is injected; initial in-memory repository is allowed. Producers import only the sink contract. Trace UI imports only query/replay services and public artifact/context readers.

## Proposed Vertical Slices

1. Record and inspect the under-specified feeding trace
   - Blocked by: simulation/instruction event contracts and shell route
   - Add schema, recorder, in-memory query, chronological view, event details, terminal summary, and golden record.
2. Context, clause, artifact, entity links and diagnostic filters
   - Blocked by: #1 and context/registry queries
   - Add category/entity/ref filters; missing/stale/conflict labels; linked exact versions; copy/select; keyboard interaction.
3. Exact isolated replay
   - Blocked by: #1 and public simulation/instruction factories
   - Build pinned manifest, isolated run, hash/event comparison, pause/step/speed presentation, and live-state non-mutation tests.
4. Divergence and unavailable-history handling
   - Blocked by: #3
   - Report missing versions/schema incompatibility and first canonical difference; never substitute current content.
5. Scale, persistence adapter contract, and deep-link polish
   - Blocked by: #2, #4
   - Virtualize 10k events, support incident/eval deep links, running traces, repository adapter conformance, accessibility checks, and corrupted-event detection.

## Completion Gate

The first-feeding incident can be opened, diagnosed to absent postcondition, and replayed exactly without touching live state. A changed/missing input produces a precise divergent/unavailable result. Tests, typecheck, accessibility checks, 10k-event performance, and canonical golden outputs pass; no private reasoning is generated.
