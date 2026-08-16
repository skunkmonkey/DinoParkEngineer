# Park and Agent Operations - Product Requirements Document

<!-- This file answers the what and why of the product/feature. It is from the
customer's PoV and should not contain architecture or technical information
beyond user-level things like OS / memory requirements / etc. Keep this comment
when using this template -->

## Feature Dependencies

### Upstream Dependencies

`platform-foundation`, `simulation-core`, `instruction-engine`, `context-memory`, `trace-replay`, `content-registry`, and `economy-progression` supply UI, live state, commands/jobs, context, diagnostics, and metrics.

### Downstream Dependencies

`curriculum-content`, `multi-agent-orchestration`, `telemetry`, and `persistence` integrate scenarios, assignments, interventions, and view state.

## Executive Summary

Park and Agent Operations is the main playable world and control room. The default Park view is a graphical two-dimensional park diorama with a focused current objective, visible dinosaurs/robots/gates/visitors, selected-entity inspector, urgent alerts, and contextual actions. Operations surfaces expose queues, schedules, worker and Manager Agent pressure, Context, Tools, Memory, traces, and advanced controls when relevant. Players create/approve jobs from authored options, observe them in the world, inspect surprising outcomes, and intervene at safe points without directly manipulating world state.

## User Stories

- **GIVEN** a running park, **WHEN** the player opens Park, **THEN** they can understand the current objective, dinosaurs, gates, visitors, workers, live jobs, incidents, and priorities without inspecting raw data or reading a table.
- **GIVEN** a feeding opportunity, **WHEN** the player creates a job, **THEN** they select exact available Prompt/Skills, see projected context/eligibility, and submit it to an eligible agent.
- **GIVEN** an alert, **WHEN** selected, **THEN** the player jumps to the affected entities/job/trace and sees recovery state.
- **GIVEN** an active worker, **WHEN** “pause after current safe point” is requested, **THEN** the current atomic safety action completes and the job pauses explicitly.

## Functional Requirements

### FR-01: Park View
- FR-01.1: Show one zone with at least three named habitats, entity locations/states, gate/device state, visitor groups, and worker positions from authoritative snapshots on a graphical two-dimensional scene.
- FR-01.2: The graphical park and current objective dominate the default layout. Jobs/agents, filters, metrics, alerts, and inspector render contextually as panels/drawers; they SHALL not all receive equal permanent weight during onboarding.
- FR-01.3: Show alerts ordered by severity then logical time then id; state is never color-only.
- FR-01.4: Show credits, park time/speed, attendance/satisfaction, dinosaur health, uptime/closures, and incident summary without making Finance dominant.
- FR-01.5: Named entities, selection, gate/containment state, worker activity, job target, visitor risk, paths, and incidents SHALL be visually related; animation derives only from authoritative state/events.
- FR-01.6: The same critical state and commands SHALL be available through a keyboard/screen-reader nonvisual equivalent.
- FR-01.7: The current curriculum objective SHALL identify relevant entities and the next available decision without owning progression rules.

### FR-02: Job Creation and Assignment
- FR-02.1: Job creation SHALL use authored job templates and approachable target/Agent/artifact names while retaining exact Prompt/Skill refs, priority, and due time in the submitted configuration.
- FR-02.2: Before submit, show the decision-relevant Context load/budget and eligibility. Exact dependencies, Tool validation, and raw refs SHALL remain available in details and become more prominent when blocked or curriculum-relevant.
- FR-02.3: Invalid/missing/overflow jobs SHALL not start and SHALL expose remediation.
- FR-02.4: Submit SHALL create a job with statuses from application PRD section 18.3 and an exact pinned configuration.
- FR-02.5: Job commands SHALL use an application service; UI SHALL not mutate queues or simulation.

### FR-03: Agent View
- FR-03.1: Show status, location, battery, tools, current task, ordered queue, context budget/load, loaded composition, memory summary, manager, and recent traces.
- FR-03.2: Switch between workers while preserving filter/selection context.
- FR-03.3: Link exact artifacts, context snapshot, trace, job, and affected entities.
- FR-03.4: Manual intervention counts SHALL be emitted for learning metrics.
- FR-03.5: Agent display SHALL lead with human-readable name, current activity, location, and pressure; exact id, complete Context composition, Tool list, Memory refs, and traces are inspectable evidence.

### FR-04: Live Controls and Incidents
- FR-04.1: Integrate shell pause/1x/2x/4x controls with simulation coordinator.
- FR-04.2: Allow pause-after-safe-point, reprioritize queued jobs, cancel unstarted jobs, and acknowledge alerts through explicit commands.
- FR-04.3: Running jobs can only cancel/pause at engine-declared safe points; emergency response commands remain available when paused.
- FR-04.4: Incident detail shows severity, trigger, affected entities, current response/recovery requirements, responsible job/trace, and costs supplied by owning services.

## Non-Functional Requirements

- **NFR-01: Responsiveness** - Update visible state within 100 ms of receiving a snapshot/event; do not render every engine event as a full app rerender.
- **NFR-02: Accessibility** - Schematic information has an equivalent keyboard-accessible list/table; alerts/status do not rely on color.
- **NFR-03: Usability** - Desktop split view; at tablet width panels become drawers/tabs without losing functions.
- **NFR-04: Integrity** - UI projections cannot become authoritative or issue duplicate commands on rerender/retry.
- **NFR-05: Visual Performance** - Decorative movement yields before input responsiveness or critical state legibility; the MVP scene remains responsive at authored maximum entity count.

## Invariants

- **INV-01:** The UI never directly mutates world, job, queue, incident, or credit state.
- **INV-02:** Display animation/speed cannot change simulation outcome.
- **INV-03:** Every submitted job pins exact artifact versions and context snapshot.
- **INV-04:** Acknowledging an alert does not resolve its underlying incident.
- **INV-05:** Map-only information has a nonvisual equivalent.
- **INV-06:** Friendly names and animation never drive commands, identity, ordering, or simulation outcomes.

## Out of Scope

Deep park construction, freeform job prose, source editing, manager policy configuration, simulation/instruction rules, review/deploy, and finance transaction logic.

## Product Decisions

- **PD-01:** Park is the default route and primary gameplay surface.
- **PD-02:** A readable illustrated/schematic diorama beats decorative realism and text-filled enclosure cards.
- **PD-03:** Manual multi-agent switching should be usable yet create motivating coordination pressure.
- **PD-04:** Outcome and current objective precede queue/configuration detail; evidence remains one action away when relevant.

## Implementation Decisions

- **IMP-01:** A read-model adapter projects domain snapshots/events into UI view models.
- **IMP-02:** Job application service coordinates registry/context/instruction ports; components do not.
- **IMP-03:** Selection/filter state is URL/local UI state, not save-game domain state unless explicitly promoted.

## Testing Decisions

- **TST-01:** Contract-fake integration tests cover create→run→incident→trace flow.
- **TST-02:** Duplicate-submit and stale-snapshot actions must fail safely.
- **TST-03:** Keyboard/table equivalent and reduced-motion checks are acceptance gates.

## Proposed Modules

- **MOD-01: ParkReadModel** - Joins snapshots/jobs/incidents/metrics into stable incremental projections.
- **MOD-02: JobApplicationService** - Preflights, creates, assigns, and commands jobs through ports.
- **MOD-03: ParkOperationsUI** - Schematic, queues, inspector, alerts, and controls.
- **MOD-04: AgentOperationsUI** - Agent switching, context/tool/memory/queue/status inspection.
- **MOD-05: ParkSceneProjection** - Converts ParkReadModel state/events into named spatial nodes, relationships, visual state cues, and reduced-motion transitions.
- **MOD-06: CurrentObjectivePanel** - Projects curriculum-owned objective, relevant entities, permitted actions, completion, and recovery.

## Workflows

### Workflow 1: Assign Feeding Job
```text
Select Rex -> choose Feed template -> select exact Prompt/Skill -> inspect context/dependencies/tools/eligible worker -> submit once -> job queues/runs -> live state and trace links update.
```

### Workflow 2: Respond to Incident
```text
Severity alert appears -> open affected gate/dinosaur/job -> pause or issue allowed emergency command -> inspect trace -> follow recovery requirements -> acknowledge only after understanding state.
```
