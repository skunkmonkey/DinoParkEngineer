# Plan: Park and Agent Operations

## Implementation Boundary and Contracts

Own Park/Agents routes, their read models/view state, the authoritative Job repository and worker queues, the job application coordinator, and operation command adapters. Do not own simulation/entity repositories or rules, instruction execution internals, artifact/eval editors, manager assignment policy, or ledger. The Job service consumes Instruction Engine updates and is the only feature allowed to mutate Job status/queue/assignee; orchestration requests assignment through this service.

```ts
interface OperationsQuery { getPark():ParkOperationsView; getAgent(id:string):AgentOperationsView|undefined; subscribe(listener:(change:OperationsChange)=>void):()=>void; }
interface JobApplicationService { preflight(input:JobDraft):JobPreflight; create(input:JobDraft,commandId:string):Result<Job,JobCommandError>; assign(jobId:string,agentId:string,commandId:string):Result<Job,JobCommandError>; reprioritize(...):Result<Job,JobCommandError>; cancelOrPauseAtSafePoint(...):Result<Job,JobCommandError>; }
```

All mutation commands are idempotent and carry observed versions where state can race. Read models expose source ids/refs for deep links and never feed back as authoritative input.

## Proposed Vertical Slices

1. Observe one enclosure and worker in Park/Agents
   - Blocked by: shell, simulation snapshot, minimal job/trace query
   - Add split layout, accessible schematic/table, selection inspector, queue, worker status/tools/context shell, and incremental projection.
2. Create and run first feeding job
   - Blocked by: #1 plus registry/context/instruction ports
   - Add authored template, target/artifact selection, preflight, eligible worker, idempotent create/assign, live status, and final outcome.
3. Incident alert to exact trace and recovery state
   - Blocked by: #2 and trace route
   - Add severity ordering, affected links, pause/emergency controls, recovery requirements, acknowledgement semantics, and goal-success-with-incident display.
4. Three enclosures and multi-worker switching pressure
   - Blocked by: #2 and multiple agent data
   - Scale schematic/queues, filters, agent switching with preserved context, queued reprioritize/cancel, safe-point pause, and intervention metrics.
5. Tablet/accessibility/performance hardening
   - Blocked by: #3, #4
   - Drawers/tabs, nonvisual equivalent, focus/deep links, reduced motion, event batching, stale command rejection, duplicate-submit tests, and production build.

## Completion Gate

From Park, assign and run first feeding, observe deterministic incident, open exact trace, safely intervene, and inspect the worker’s context/tools/memory. Validate three-enclosure/multi-worker performance, map equivalence, keyboard flow, idempotency, stale actions, typecheck, tests, accessibility, and build.
