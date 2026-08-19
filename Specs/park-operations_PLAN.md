# Plan: Park Operations

## Proposed Vertical Slices

1. **A pre-opening schedule creates and assigns one exact feeding job**
   - Blocked by: Simulation #1-#3, Trace #1, Content Registry #1-#3
   - Adds day phases, deterministic schedule occurrence, job state machine,
     exact production-version resolution, queue, assignment, and projections.
   - Tests: occurrence idempotency, queue order, valid/invalid transitions,
     version pinning, and phase restrictions.
   - Browser proof: see the closed park phase, due need, assign the robot, and
     inspect the pinned job.

2. **The first job completes and permits park opening**
   - Blocked by: #1, Instruction #1-#4, Context #1-#3
   - Adds job execution adapter, completion/result links, readiness condition,
     open command, visitor-operation permission, and concise day status.
   - Tests: success/failure/stop, no mid-job version float, readiness, duplicate
     open, and pause/speed equivalence.
   - Browser proof: complete feeding, intentionally open, and see visitor entry.

3. **A changed gate condition becomes one actionable incident**
   - Blocked by: #2, Trace #2
   - Adds ambient/warning/emergency classification, priority queue, causal
     grouping, expected/observed/consequence/gap, entity/trace links, and pause
     request.
   - Tests: no ambient notification, grouped symptoms, separate causes, stable
     ordering, evolving incident, and persistent history.
   - Browser proof: experience the near miss, auto-pause, inspect one grouped
     incident, and return to the park.

4. **Strict context stop is detected outside the Agent**
   - Blocked by: #3, Context #4
   - Adds park fault monitor, authored qualifying conditions, stopped-job state,
     escalation signal, and engineering-unresolved incident state.
   - Tests: monitor independence, one fault/incident, no hidden context, clear
     after stabilization but not engineering resolution.
   - Browser proof: halt a robot and see an externally raised incident.

5. **Closing and another stable day prove repeatable mastery**
   - Blocked by: #2-#4
   - Adds closing/departure phase, operational day summary, repeated schedules,
     routine cue suppression, and next-day transition.
   - Tests: closing transitions, visitor departure, summary evidence, next-day
     occurrence IDs, and no hidden reliability degradation.
   - Browser proof: run a stable day, close, inspect summary, and start another.

6. **Park Operations validation gate**
   - Blocked by: #1-#5
   - Adds density fixtures, accessibility tests, architecture lint, and full
     repository validation.
   - Browser proof: day phases, job flow, grouped incident, Strict monitor,
     stable rerun, keyboard alerts, persistent history, and reduced motion.
