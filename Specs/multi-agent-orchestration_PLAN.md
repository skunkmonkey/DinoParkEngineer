# Plan: Multi-Agent Coordination and Orchestration

## Implementation Boundary and Contracts

Own deterministic assignment/priority decisions, manager runtime/config validation, routing orchestration, manager provenance, and Manager view. Do not own Job records, worker queue mutation, simulation contention rules, worker execution, CU/memory algorithms, active deployment mapping, purchase/unlock logic, or generic Park queues. Submit chosen assignments/priorities through the `park-operations` Job application contract.

```ts
interface OrchestrationService { decide(input:SchedulingInput):SchedulingDecision; handle(request:DelegationRequest|EscalationRequest|ReportEvent):readonly OrchestrationCommand[]; getManager(id:string):ManagerOperationsView; }
type SchedulingDecision={status:'ASSIGNED';workerId:string;matchedRuleId:string;eligibility:EligibilityFact[];tieBreak:string}|{status:'UNASSIGNED';reason:DelegationFailure;eligibility:EligibilityFact[]};
```

Commands go through job/context ports; provenance goes through TraceSink. Configuration proposals go to Review and active config resolution comes from Deployment Service.

## Proposed Vertical Slices

1. Two workers execute independently with explicit contention
   - Blocked by: simulation/jobs/operations
   - Add concurrent queues, stable assignments/resource failure visibility, manual switching pressure, and no Manager behavior.
2. Validate and display one Manager configuration
   - Blocked by: #1, progression entitlement, registry/review ports
   - Model mission/pool/max/rules/priorities/authority/routing/escalation/reporting; reject invalid configs; show exact deployed version.
3. Deterministic feeding/evacuation delegation
   - Blocked by: #2
   - Pure eligible-worker filtering and stable tie-break, context routing/preflight, pinned assignment, child trace links, and all typed failures.
4. Escalation and reporting contracts
   - Blocked by: #3
   - Severity/fallback thresholds, security dispatch within authority, immediate exception/batched routine reports, alert flood/under-escalation cases.
5. Four-worker orchestration failure curriculum and hardening
   - Blocked by: #4
   - Maintenance conflict, stale policy, missing tool, worker/manager overflow, conflicting command, performance/a11y, golden replays, and safety properties.

## Completion Gate

After multi-worker pressure, activate a reviewed Manager config, deterministically delegate feeding/evacuation, route bounded context, and escalate a failed gate. Exact replay, eligibility explanations, config validation, safety precedence, at-most-one assignment/manager properties, tests, typecheck, accessibility, and build pass.
