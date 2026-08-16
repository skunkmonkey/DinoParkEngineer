# Plan: Context and Memory Engineering

## Implementation Boundary and Contracts

Own `context/**` and `memory/**`: CU calculation, snapshot assembly, memory policy/store port, authoritative-fact selection, analysis, and public contracts. Do not execute clauses, edit artifacts, charge credits, decide progression unlocks, or render feature routes.

```ts
interface ContextService {
  project(request: ContextRequest): Result<ContextSnapshot, ContextBlock>;
  buildActual(request: ContextRequest, logicalTime:number): Result<ContextSnapshot, ContextBlock>;
  analyze(snapshot: ContextSnapshot, evidence?: ContextUsageEvidence): readonly ContextFinding[];
}
interface MemoryService {
  record(input: NewMemory): MemoryRecord;
  retrieve(query: MemoryQuery, access: MemoryAccess, logicalTime:number): readonly MemoryRecord[];
  evaluate(record: MemoryRecord, logicalTime:number, policy: FreshnessPolicy): 'FRESH'|'STALE'|'EXPIRED';
}
```

All outputs are immutable and stably ordered. Artifact text/clauses come through registry ports; world observations through simulation query ports; memory persistence through an injected repository.

## Proposed Vertical Slices

1. Visible deterministic context meter for one feeding job
   - Blocked by: registry contracts and simulation working-state query
   - Implement UTF-8 text CU, fixed items, stable dependency expansion, projected snapshot, exact total/budget, and representative multi-byte tests.
2. Overflow blocks execution without truncation
   - Blocked by: #1
   - Return stable overflow diagnostics and item composition; prove no selection mutation and integrate a fake Instruction Engine preflight.
3. Scoped memory with freshness and observation precedence
   - Blocked by: #1
   - Add records, local/shared access, TTL/validUntil boundaries, provenance, retrieval, stale labels, direct-observation precedence, and repository port.
4. Duplicate, conflict, irrelevant, and over-broad findings
   - Blocked by: #2, #3
   - Analyze semantic keys/tags/dependency branches, calculate CU impact, and produce stable evidence-rich findings without auto-fixes.
5. Actual usage and profiler integration contract
   - Blocked by: #4
   - Accept execution evidence for unused findings, expose basic vs advanced result filtering for progression consumers, benchmark 500 items, and document snapshot schema.

## Completion Gate

Demonstrate totals reconcile exactly, identical inputs serialize identically, overflow blocks, stale memory loses to a fresh observation without disappearing, and profiler analysis is advisory. Run unit/property/golden tests, typecheck, and benchmark; verify no external tokenizer, wall clock, vector service, or source-prose interpretation.
