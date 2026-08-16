# Context and Memory Engineering

The headless context boundary is exported from `context/index.ts` (and
`src/context/public.ts`). `ContextService.project(request)` performs a
deterministic preflight; `buildActual(request, logicalTime)` repeats assembly
with a current working-state query. Both return either an immutable
`ContextSnapshot` or an immutable `BLOCKED_CONTEXT_OVERFLOW` diagnostic.

## Snapshot schema

`ContextSnapshot` contains `id`, `agentId`, `jobId`, integer `budget`, integer
`totalLoad`, stable `items`, `conflicts`, `duplicates`,
`createdAtLogicalTime`, `mode` (`PROJECTED` or `ACTUAL`), and
`authoritativeFacts`. Every item has a stable `ref`, `kind`, exact version when
applicable, integer `contextCost`, provenance, applicability status, and a
freshness/status pair for memory records. `totalLoad` is always the exact sum
of item costs.

Text costs are `ceil(UTF-8 byte length / 4)`. Tools, working state, and memory
records use explicit costs or deterministic defaults. Artifact costs include
the authored source and clause fragments. No external tokenizer or wall clock
is used.

Memory records are scoped (`LOCAL` or `SHARED`), have logical observation and
expiry boundaries, provenance, structured facts, and a repository port. At an
equal `validUntil` boundary records are `EXPIRED`; stale records remain visible
when allowed, and a direct current observation supersedes a conflicting memory
fact without removing the historical record.

`ContextService.analyze` is advisory and side-effect free. It reports stable
duplicate, semantic conflict, stale, applicability, unused-module, and
over-broad-dependency findings. `profiler(snapshot, "BASIC")` returns the
always-available meter/composition view; `"ADVANCED"` returns those findings
when progression has enabled the profiler.

