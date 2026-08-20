# Park Operations implementation notes

Park Operations owns the serializable park-day phase,
exact-version-pinned jobs, deterministic schedules, assignments, and queue
projection through `src/park-operations/public.ts`.

- Schedule occurrences use stable day-and-tick IDs and are idempotent.
- Queue order is priority descending, due tick ascending, then stable job ID.
- Jobs resolve their Task and deployed artifact references before creation and
  never float afterward.
- Job and phase commands validate completely before replacing immutable state.
- Opening is intentional and blocks on required job readiness. Visitors enter
  only while open, depart during closing or an emergency pause, and must be gone
  before engineering begins.
- Ambient signals remain queryable without notifications. Warnings use a stable
  risk-prioritized queue; emergencies request pause and identify location and
  immediate risk.
- Signals group into one evolving incident by explicit causal or spatial keys
  inside a five-tick window. Incident evidence retains expected state, observed
  symptoms, consequence, immediate gap, entities, and trace links.
- Stabilization and engineering repair are separate incident states. Strict
  Context faults enter the park monitor directly, without relying on Agent
  decision context.
- Entering engineering records an exact day summary with attendance, departures,
  job outcomes, incidents, and intervention commands.
- Park View renders a read-only projection, issues typed commands, and retains
  success or rejection evidence in persistent text.
