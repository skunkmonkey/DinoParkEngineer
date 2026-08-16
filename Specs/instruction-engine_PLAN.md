# Plan: Deterministic Instruction Engine

## Implementation Boundary and Contracts

Own instruction compilation, clause resolution, per-execution job state machine, outcomes, and provenance event production under `instruction/**`. Do not own the authoritative Job repository, worker queues/assignment, artifact storage, context analysis, world mutation, trace persistence/UI, or manager scheduling. `park-operations` owns Job commands/read storage and applies the execution updates returned here.

```ts
interface InstructionEngine {
  prepare(job: Job, agent: AgentDefinition): Result<PreparedJob, JobBlock>;
  start(prepared: PreparedJob): ExecutionUpdate;
  handleWorldEvents(executionId: string, events: readonly WorldEvent[]): ExecutionUpdate;
  cancelAtSafePoint(executionId: string): ExecutionUpdate;
}
type JobTerminalStatus = 'SUCCEEDED'|'FAILED'|'ESCALATED'|'BLOCKED';
interface JobOutcome { jobId:string; status:JobTerminalStatus; reasonCode:string; goalResults:AssertionResult[]; postconditionResults:AssertionResult[]; incidentIds:string[]; contextSnapshotId:string; }
```

Ports for content, context, and simulation are injected. Provenance events are immutable and emitted through a sink; trace persistence is not imported.

## Proposed Vertical Slices

1. Under-specified feeding job end to end
   - Blocked by: simulation, registry, minimal context port
   - Resolve pinned Prompt, compile GOAL/ACTION/SEQUENCE, call simulation, achieve hunger goal, and expose missing containment postcondition in deterministic provenance.
2. Preconditions, constraints, postconditions, and safety precedence
   - Blocked by: #1
   - Add tier/priority/tie resolution, conflicts, gate/visitor safety cases, explicit postcondition outcomes, and exhaustive precedence tests.
3. Fallback, escalation, retrieval, and blocked starts
   - Blocked by: #2
   - Add tool/dependency/context validation; JAMMED/degraded sensor paths; retrieval requests; safe escalation; no-mutation blocked tests.
4. Delegation, reporting, cancellation safe points, and resumability
   - Blocked by: #2
   - Emit typed orchestration requests and reports, resume solely from explicit events/state, and support pause-after-safe-point without owning assignment.
5. Complete clause contract and replay hardening
   - Blocked by: #3, #4
   - Cover every category, loop/step guards, goal-achieved-but-incident outcome, canonical graph serialization, golden replays, and public API docs.

## Completion Gate

Run the application PRD first-feeding example twice with identical inputs and exact matching graph/provenance/outcome; run a safe Skill, gate-jam escalation, context-overflow block, and all precedence conflicts. Ensure no source-text parser, direct world mutation, trace UI, or orchestration policy exists in this package.
