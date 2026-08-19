# Plan: Orchestration

## Proposed Vertical Slices

1. **A second Worker executes a parallel independent job**
   - Blocked by: Instruction #1-#5, Context #1-#5, Park Operations #1-#5,
     Trace #1-#4, Economy capability unlock
   - Adds exact Agent configurations, fleet topology with Workers only, parallel
     job assignments, deterministic queues, separate contexts, and fleet
     projections.
   - Tests: exact versions, simultaneous completion, stable ordering, capacity,
     independent failures, and no shared hidden state.
   - Browser proof: observe and inspect two parallel jobs.

2. **Two Workers create a shared-gate coordination failure**
   - Blocked by: #1, Simulation #5, Memory #3
   - Adds shared-resource visibility boundaries, messages, maintenance task,
     locally reasonable gate choice, complete cross-Worker trace, and diagnostic
     categories.
   - Tests: deterministic conflict, altered route success, missing message,
     stale shared memory, and exact causal chain.
   - Browser proof: replay feeding Worker and maintenance Worker in sync.

3. **Specialized Worker routing trades context for dependency**
   - Blocked by: #1-#2
   - Adds Worker capabilities/job eligibility, specialization routes, lower
     context projection, unavailable capability/dependency failure, and
     assignment limits.
   - Tests: eligible/ineligible jobs, context reduction, missing tool, queue
     pressure, and no universal specialization bonus.
   - Browser proof: compare generalist and specialized job execution.

4. **Manager configuration delegates exact work through explicit authority**
   - Blocked by: #1-#3, Economy Manager opportunity
   - Adds one Manager topology, authority, priority, delegation, Worker
     selection, version pinning, context routing, success evidence, and vague
     configuration that intentionally lacks needed rules.
   - Tests: authorized/unauthorized actions, stable ties, vague config failure,
     exact pinning, missing route, and evidence-based completion.
   - Browser proof: first fail with vague management, then configure a successful
     exact delegation.

5. **Reporting and escalation reduce attention only as configured**
   - Blocked by: #4
   - Adds costed messages, routine aggregation, exception thresholds, cadence,
     omission/delay/overflow, player escalation, and Incident Response authority
     port.
   - Tests: routine suppression, exception report, omitted critical state,
     capacity cost, delivery failure, unauthorized rescue call, and complete trace.
   - Browser proof: run a mature fixture with concise reports, then diagnose an
     omitted exception.

6. **Orchestration validation gate**
   - Blocked by: #1-#5
   - Adds mature-fleet density/performance fixtures, architecture lint,
     accessibility tests, and full validation.
   - Browser proof: parallel Workers, conflict, specialization, Manager config,
     report/escalation, causal drill-down, keyboard, and semantic zoom.
