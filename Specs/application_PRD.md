# Dino Park Engineer - Product Requirements Document

## Feature Dependencies

This document is the application baseline. Every feature PRD SHALL trace its
requirements to this document, preserve its invariants, and explicitly record
any refinement or conflict rather than resolving it silently in code.

### Upstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Modern desktop web browser | The game requires standards-based browser rendering, local storage, keyboard input, pointer input, animation, and audio support. |
| 2 | None | Core gameplay SHALL NOT require an LLM, account, secret, backend, cloud save, analytics service |

### Downstream Dependencies

| # | Feature | Relationship |
|---|---|---|
| 1 | Player Experience | Owns Park View, inspection, focused modes, visual language, onboarding, information hierarchy, and accessibility presentation. |
| 2 | Simulation | Owns authoritative deterministic world state, time, entities, actions, consequences, fixtures, and replayable scenarios. |
| 3 | Instruction Artifacts | Owns deterministic Prompt, Skill, System Prompt, Policy, knowledge, tool, and escalation clauses. |
| 4 | Context and Memory | Owns context assembly, capacity, provenance, runtime growth, Retention Policies, memory, retrieval, compaction, and diagnostics. |
| 5 | Content Registry | Owns immutable artifact identity, dependencies, exact versions, authored content validation, and historical resolution. |
| 6 | Trace and Replay | Owns structured evidence, action provenance, world deltas, context snapshots, incident replay, and historical replay. |
| 7 | Park Operations | Owns jobs, schedules, alerts, incidents, park-day cadence, visitors, rating inputs, and operational commands. |
| 8 | Engineering Workbench | Owns Park Developer progression, artifact inspection, comparison, composition, change requests, and Engineering Handbook access. |
| 9 | Eval Runner | Owns authored eval cases and suites, deterministic execution, expected/observed results, cost, and replay. |
| 10 | Review and Deployment | Owns risk-based eval selection, review records, pinned deployment, rollback, reopening submissions, and production history. |
| 11 | Economy and Progression | Owns credits, rating, demand, costs, unlocks, expansion, expressive rewards, and recovery economics. |
| 12 | Orchestration | Owns Worker Agents, Manager Agents, delegation, routing, authority, escalation, reporting, and multi-agent coordination. |
| 13 | Incident Response | Owns the external Incident Response Team, response eligibility, stabilization, cost, timing, and recovery boundaries. |
| 14 | Persistence | Owns local saves and exact restoration of world, content, history, progression, incidents, evals, and deployments. |
| 15 | Curriculum Content | Owns the ordered scenario catalog and transfer cases that teach the application curriculum through play. |
| 16 | Telemetry and Playtesting | Owns local or explicitly consented behavioral instrumentation and playtest reporting without capturing authored text. |
| 17 | Rendering Asset Pipeline | Owns pre-runtime generation, provenance, review, validation, normalization, compilation, and versioned delivery of visual and rendering assets, including assets produced with OpenAI models. |

## Executive Summary

Dino Park Engineer is a deterministic, browser-based management game for
professional developers. The player operates an automated dinosaur park whose
robots follow versioned Prompts, Skills, System Prompts, Policies, tools,
context, memory, and orchestration rules. The player learns modern AI
engineering because system quality produces visible park consequences. While
gameplay is #1, education is the underlying, invisible purpose.

The player fantasy is:

> Build an automated dinosaur park that remains safe, profitable, and
> entertaining because the intelligent systems you engineered can handle
> routine operations without constant intervention.

The north star is:

> The player starts by controlling actions and gradually learns to control
> systems.

Early play concerns one robot and concrete work such as feeding a dinosaur,
closing a gate, verifying containment, and escalating an escape. Growth makes
direct control increasingly impractical. The player progresses from inspecting
and using task Prompts, to composing reusable Skills and persistent constraints,
to designing context and memory lifecycles, selecting risk-based evals,
reviewing versioned changes, and orchestrating Manager and Worker Agents. All
prompts, skills, evals, etc. are hard-coded entities rather than free-form text.
The user will be able to view the actual text when selecting them, so the user
can learn what makes one prompt/skill/eval better than another, and thus teach
the user prompt engineering, context engineering, evals, etc.

The game is not an LLM sandbox and is not scored on clever prose. Human-readable
artifact text is inspectable educational content, while explicit
machine-readable clauses drive deterministic behavior. The simulation
adjudicates hard world state. Every important outcome can therefore be
reproduced, inspected, evaluated, and replayed without a runtime model,
probabilistic interpretation, account, secret, backend, or network service.

The park is the emotional center. Dinosaurs, robots, visitors, gates, weather,
time pressure, property damage, casualties, emergency response, rating, and
revenue provide spectacle and stakes. Engineering surfaces provide leverage
and understanding. The intended emotional rhythm is confidence, surprise,
curiosity, diagnosis, insight, mastery, and then greater complexity.

Two signature pillars distinguish the product:

1. Context is a visible, finite, provenance-labeled, economically meaningful
   resource whose composition and lifecycle affect behavior.
2. Evals and code-review-like deployment turn AI work into an engineering
   discipline: inspect the change, understand context and dependency deltas,
   select risks, run deterministic scenarios, diagnose, revise, then
   intentionally deploy or revert.

The ideal late-game park is large but calm. Routine operations are reliable,
context is efficiently routed, regression suites protect critical behavior,
Manager Agents coordinate explicit responsibilities, incidents are rare, and
the player handles meaningful exceptions rather than micromanaging every robot.
Good engineering makes each mastered area require less attention while chosen
expansion makes the overall game more challenging.

Revenue is not the sole optimization target. Across visible outcomes and
inspectable diagnostics, the player balances safety, guest experience, dinosaur
welfare, operating cost, context efficiency, Agent reliability, and their own
limited attention. These pressures do not all require separate headline meters.

## Canonical Terminology

These terms SHALL be used consistently in player-facing engineering surfaces.
Approachable park terms such as gate, robot, incident, dinosaur, and park policy
remain ordinary domain language.

| Term | Canonical meaning |
|---|---|
| Task | The concrete objective and situation assigned to an Agent for a job. |
| Prompt | A task-specific instruction artifact. Its readable text is inspectable; deterministic clauses specify behavior. |
| Skill | A reusable, versioned capability or instruction bundle that an Agent can apply to classes of tasks. |
| System Prompt | A versioned artifact containing persistent role, priority, and behavioral constraints for an Agent. |
| Policy | A reusable park-domain constraint, such as containment or visitor safety, referenced by applicable System Prompts or Skills. |
| Context | The finite set of task, instruction, knowledge, state, memory, and tool information assembled for one Agent decision. |
| Context capacity | The maximum context units available to an Agent for one decision snapshot. |
| Retention Policy | The explicit deterministic strategy used when required context exceeds capacity. |
| Knowledge | Versioned facts about species, enclosures, equipment, schedules, or park state sources. |
| Memory | Prior state that has been retained or externalized and may later be retrieved into context. |
| Tool | An explicit action interface available to an Agent, including its capabilities, requirements, and observable results. |
| Agent | An automated actor that receives context and uses allowed tools according to applicable deterministic clauses. |
| Worker Agent | An Agent responsible for bounded operational work. |
| Manager Agent | An Agent responsible for explicitly authorized delegation, routing, escalation, prioritization, and reporting. |
| Job | A scheduled or active unit of park work resolved against exact artifact versions. |
| Eval case | An authored deterministic simulation scenario with expected observable behavior. |
| Eval suite | A reusable selected collection of eval cases. |
| Trace | Structured provenance for inputs, context, clauses, tool calls, evidence, world changes, and outcomes. A trace is not hidden chain-of-thought. |
| Artifact version | An immutable historical version of a Prompt, Skill, System Prompt, Policy, knowledge item, memory summary, tool definition, or other authored asset. |
| Review | Inspection of a proposed artifact change, its diff, context and dependency deltas, selected risks, and eval evidence. |
| Deployment | The intentional act of pinning an exact reviewed artifact version for production jobs. |
| Orchestration | Engineering how Manager and Worker Agents divide work through explicit delegation, authority, context routing, escalation, and reporting. |
| Park Developer | The single progression and Workbench mechanism that produces engineering work. It is not a hiring or developer-team simulator. |
| Incident Response Team | An external park capability that stabilizes dangerous world state without extending Agent context or repairing the engineering cause. |

## Curriculum and Progression

The hidden curriculum is:

> Prompts -> Skills and System Prompts -> Context -> Tools -> Memory -> Evals
> and review -> Agents -> Orchestration

The interaction progression is:

> purchase or commission -> inspect -> compare -> compose -> modularize ->
> architect -> orchestrate

The abstraction progression is:

> direct actions -> reusable behavior -> persistent constraints -> selective
> context -> versioned memory and retrieval -> risk-based evaluation ->
> delegation -> governed agent organization

The game SHALL teach through problem before tool:

| Experienced pressure | Capability that becomes valuable |
|---|---|
| Repeating the same directions | Reusable Skills |
| Rules duplicated across tasks | System Prompts and Policies |
| Missing or irrelevant information | Context inspection, routing, and profiling |
| Long-running work fills context | Retention Policies, compaction, and external memory |
| Uncertain behavior after a change | Evals, suites, and review |
| Stale or conflicting state | Provenance, versions, retrieval, and memory lifecycle |
| Simultaneous independent jobs | Additional Worker Agents |
| Cross-agent interference and alert overload | Manager Agents and orchestration |

Early play SHALL use professionally authored exemplars as desirable game
objects. Midgame SHALL require deterministic composition and comparison rather
than mere selection. Late play SHALL emphasize architecture: what belongs in
global constraints, what is retrieved, what workers and managers receive, what
must be verified, and what gets escalated.

Typing long natural-language Prompts is incidental, not the learning goal. The
player SHALL practice recognizing, constructing, evaluating, versioning, and
governing reliable AI systems.

### Representative Curriculum Scenarios

These scenarios communicate required concepts and SHALL guide downstream
curriculum and feature PRDs. Exact names, species, and values may change while
preserving the lesson and deterministic causality.

| Scenario | Observable situation | Transferable concept |
|---|---|---|
| Basic feeding | Bait a dinosaur away from the gate, enter, close, feed, exit, restore containment, verify, and escalate an escape | Intended goal differs from specified and verified behavior |
| Reusable containment | Several jobs duplicate gate steps until a shared containment Policy or Skill replaces repetition | Prompts to reusable Skills and System Prompts |
| Degraded sensor | A gate sensor reports closed while sensor health is degraded; visual or secondary verification is absent | Verification quality and trustworthy evidence |
| Missing maintenance context | An automatic closer is disabled and visible in the world but not included in Worker context | Context boundaries and selective routing |
| Context bloat | A self-contained Prompt carries duplicated global safety and irrelevant emergency material | Context cost, duplication, modularity, and profiling |
| Stale policy | One Worker receives Containment Safety v1 while the reviewed deployment expects v2 | Version pinning, provenance, and lifecycle management |
| Runtime overflow | Long work accumulates results and messages until Keep Newest excludes an early unpinned instruction | Retention strategy and diagnosable forgetting |
| Compaction loss | History compaction preserves a broad fact but loses a detail needed for a later exception | Summary tradeoffs and lost detail |
| Retrieval failure | External memory contains the relevant enclosure note but retrieval rules do not select it | Memory is useful only when retrieval is correct |
| Shared gate conflict | A feeding Worker selects the nearest gate while a maintenance Worker has disabled its closer | Locally reasonable Agents need shared context and coordination |
| Eval coverage gap | A Skill passes selected normal cases but later fails an unauthored sensor or visitor scenario | Evals define expected behavior and coverage |
| Vague management | A Manager told to keep things running lacks authority, priorities, delegation, or escalation rules | Orchestration requires explicit governance |
| Escalation recovery | A Worker stops at context capacity in a dangerous location and Park Operations summons Incident Response | External monitoring, escalation, and defense in depth |

## User Stories

### Park Operation

- **GIVEN** a closed park approaching opening time, **WHEN** the player observes
  the world, **THEN** dinosaur needs, equipment faults, approaching visitors,
  time pressure, and robot activity are understandable primarily through
  diegetic cues with accessible equivalents.
  - **Acceptance Criteria:** The player can take a meaningful first action
    before encountering substantial mandatory text.

- **GIVEN** a robot with a job and exact deployed artifacts, **WHEN** park time
  advances, **THEN** the robot acts through allowed tools and the authoritative
  world resolves deterministic consequences.
  - **Acceptance Criteria:** Replaying the same starting state, inputs, versions,
    and decisions produces the same actions and world outcome.

- **GIVEN** a well-engineered routine operation, **WHEN** it runs repeatedly,
  **THEN** the player can enjoy visible stable automation with fewer direct
  interventions.
  - **Acceptance Criteria:** Mastered areas do not acquire hidden failure-rate
    inflation merely because the player succeeded.

- **GIVEN** an unsafe production outcome, **WHEN** visitors are exposed to a
  dinosaur or other hazard, **THEN** injuries and deaths may occur and affect
  rating, attendance, revenue, closure, and recovery.
  - **Acceptance Criteria:** Casualties are attributable to deterministic world
    state and system behavior and remain inspectable.

### Prompt, Skill, and Context Engineering

- **GIVEN** an available Prompt or Skill, **WHEN** the player inspects it,
  **THEN** they can see its readable source, deterministic clauses, context
  cost, dependencies, applicable constraints, version, and tradeoffs.
  - **Acceptance Criteria:** No runtime behavior depends on parsing the readable
    prose.

- **GIVEN** two valid approaches to the same job, **WHEN** the player compares
  them, **THEN** the game exposes meaningful tradeoffs among purchase or
  authoring cost, runtime context, speed, dependencies, verification, and
  exception risk rather than ranking them as simply good, better, and best.
  - **Acceptance Criteria:** A smaller modular Skill can outperform a larger
    self-contained Prompt when its dependencies are current and available.

- **GIVEN** a robot context snapshot, **WHEN** the player inspects or changes its
  composition, **THEN** a segmented Context Capacity gauge shows used and total
  units, provenance, additions, exclusions, and quality diagnostics.
  - **Acceptance Criteria:** The display does not imply that more context is
    automatically better or that low utilization proves high quality.

- **GIVEN** a long-running job, **WHEN** actions, observations, tool results,
  messages, task history, or memory retrieval add context, **THEN** capacity
  changes at deterministic decision boundaries.
  - **Acceptance Criteria:** Before-retention and after-retention context
    snapshots are replayable.

- **GIVEN** required context beyond capacity, **WHEN** the configured Retention
  Policy runs, **THEN** execution either blocks or explicitly and
  deterministically excludes, prioritizes, compacts, or externalizes
  information.
  - **Acceptance Criteria:** Nothing is silently truncated; affected items,
    policy, reason, and downstream effect remain inspectable.

### Evals, Review, and Deployment

- **GIVEN** a proposed artifact change, **WHEN** the player opens its review,
  **THEN** they can inspect the readable and behavioral diff, context delta,
  dependency delta, expected effect, author, version, and relevant eval choices.
  - **Acceptance Criteria:** Review supports request changes, run evals, retain,
    deploy, and revert as applicable.

- **GIVEN** authored eval cases, **WHEN** the player selects and runs a subset,
  **THEN** each case instantiates a real deterministic simulation state and
  reports expected versus observed behavior.
  - **Acceptance Criteria:** Scores are derived from actual case results; no
    fake probability or fabricated pass percentage is used.

- **GIVEN** an eval failure, **WHEN** the player replays it, **THEN** they can
  follow the same world behavior, structured trace, applicable clauses, and
  missing or conflicting context that caused the result.
  - **Acceptance Criteria:** Revising an artifact and rerunning the same case
    provides a like-for-like comparison.

- **GIVEN** a reviewed exact artifact version, **WHEN** the player deploys it,
  **THEN** future production jobs resolve that pinned version until another
  intentional deployment or revert.
  - **Acceptance Criteria:** Historical jobs never silently resolve to the newest
    artifact.

### Progression and Orchestration

- **GIVEN** one Park Developer, **WHEN** the player invests credits in its
  capabilities, **THEN** new engineering work such as Prompt authoring, Skill
  authoring, context optimization, eval creation, tool integration, memory
  architecture, and Agent design becomes available.
  - **Acceptance Criteria:** Progression does not introduce developer
    recruiting, salaries, candidate selection, or team management.

- **GIVEN** multiple Worker Agents, **WHEN** they use shared gates, tools,
  schedules, or context sources, **THEN** locally reasonable actions can create
  deterministic coordination failures that the player can diagnose.
  - **Acceptance Criteria:** Failures arise from explicit state, context, and
    rules rather than random Agent incompetence.

- **GIVEN** coordination pressure that makes direct oversight impractical,
  **WHEN** the Manager Agent becomes available, **THEN** the player can define
  authority, priorities, delegation, routing, escalation, reporting, shared
  context, and success conditions.
  - **Acceptance Criteria:** A vague manager instruction does not magically
    solve coordination; the Manager operates only within explicit authority and
    available context.

### Economy, Incidents, and Recovery

- **GIVEN** park operation, **WHEN** visitors experience safe and satisfying
  days, **THEN** park rating supports demand and visitors produce revenue used
  for engineering, robots, park expansion, and expression.
  - **Acceptance Criteria:** Money and park rating are the two headline
    motivators; safety, guest experience, and dinosaur welfare may explain the
    rating without becoming additional headline currencies.

- **GIVEN** an available eval case, **WHEN** the player authors it, **THEN** its
  larger one-time engineering cost creates a permanent reusable asset whose
  later runs are comparatively cheap.
  - **Acceptance Criteria:** Risk-based selection is economically meaningful;
    buying every eval is not always the only sensible short-term choice.

- **GIVEN** a dangerous incident that ordinary automation cannot stabilize,
  **WHEN** the player activates the Incident Response Team, **THEN** the team
  visibly stabilizes the park at a stated cost without changing Agent context
  or repairing the responsible artifact.
  - **Acceptance Criteria:** Once lives are at risk, calling for rescue is
    better than refusing it merely to avoid the callout fee.

- **GIVEN** catastrophic casualties, repeated unresolved safety failures, or
  financial collapse, **WHEN** the operating license is suspended, **THEN** the
  park closes into an active engineering recovery workflow rather than deleting
  the save.
  - **Acceptance Criteria:** The player retains layout, versions, traces, evals,
    unlocks, Handbook history, and expressive rewards and can earn reopening.

### Player Experience and Accessibility

- **GIVEN** a visible park event, **WHEN** the player investigates it, **THEN**
  navigation follows Park to event to job to Agent action to evidence to
  responsible artifact to eval/replay to review/deployment and back to the park.
  - **Acceptance Criteria:** Entity and causal identity remain preserved across
    focused surfaces.

- **GIVEN** production, paused production, an eval, or a historical replay,
  **WHEN** the mode is displayed, **THEN** the player can distinguish it through
  labels, framing, motion, controls, and sound without relying on color alone.
  - **Acceptance Criteria:** The player never reasonably mistakes an eval
    incident for production.

- **GIVEN** a player using reduced motion, sound substitution, enlarged text,
  keyboard input, or high-contrast presentation, **WHEN** they operate and
  investigate the park, **THEN** they receive equivalent state, urgency,
  location, provenance, context, and consequence information.
  - **Acceptance Criteria:** Essential actions and information do not depend
    only on color, sound, animation, transient timing, hover, or precise pointer
    movement.

## Functional Requirements

### FR-01: Platform and Deterministic Authority

- FR-01.1: The application SHALL run as a browser-based game on supported modern
  desktop browsers.
- FR-01.2: Core gameplay SHALL operate without a runtime LLM, account, secret,
  backend, cloud service, analytics service, or network connection.
- FR-01.3: The authoritative simulation SHALL resolve explicit hard world state
  for at least gates, dinosaurs, robots, visitors, tools, schedules, hazards,
  and incidents.
- FR-01.4: The same initial state, seed, artifact versions, player commands, and
  decision order SHALL produce the same state transitions, actions, trace, eval
  results, and outcome.
- FR-01.5: The simulation SHALL use stable identifiers and stable ordering so
  saved games, traces, eval fixtures, and historical replays remain resolvable.
- FR-01.6: Optional feature failure SHALL NOT blank the core game or unrelated
  features; the player SHALL receive an actionable degraded-state message.
- FR-01.7: The UI SHALL issue allowed commands to owning systems and SHALL NOT
  directly mutate authoritative world state.

### FR-02: Park World and Day Loop

- FR-02.1: The world SHALL support a repeating cadence of pre-opening, open
  operation, closing, and engineering or expansion.
- FR-02.2: Park View SHALL show a living automated park with dinosaurs, robots,
  enclosures, gates, visitors, time, jobs, and relevant environmental state.
- FR-02.3: The player SHALL be able to pause and change simulation speed during
  live park operation without changing permanent rewards.
- FR-02.4: Approaching visitors, lighting, park activity, announcements, and an
  accessible time reference SHALL redundantly communicate time pressure.
- FR-02.5: Dinosaurs SHALL have deterministic state sufficient to communicate
  at least location, containment, hunger or need, agitation, and current target
  or behavior.
- FR-02.6: Gates and other critical equipment SHALL expose deterministic
  operational state, including degraded and faulty conditions that can affect
  tool results.
- FR-02.7: Robots SHALL have deterministic state sufficient to communicate at
  least location, assignment, tools, battery or operational health, action,
  status, and context pressure.
- FR-02.8: Visitors SHALL have deterministic state sufficient to communicate at
  least location, movement, exposure, panic or evacuation, safety, injury, and
  casualty outcomes.
- FR-02.9: The simulation SHALL support fair emergent interaction, including
  shared-resource and cross-agent conflicts in which no individual rule is
  random or secretly violated.
- FR-02.10: Stable operation SHALL remain visibly stable long enough for the
  player to enjoy mastery; difficulty SHALL NOT be manufactured by secretly
  increasing failure rates in mastered systems.
- FR-02.11: Permanent park expansion SHALL require an intentional player action.
  Optional contracts may create temporary constraints, and unexpected events
  may affect already accepted responsibilities.

### FR-03: Jobs, Prompts, Skills, and Authored Clauses

- FR-03.1: Each job SHALL resolve a Task and exact deployed artifact versions
  before execution.
- FR-03.2: Human-readable Prompt, Skill, and System Prompt text SHALL be
  inspectable but SHALL NOT be parsed to determine runtime behavior.
- FR-03.3: Runtime behavior SHALL be driven by validated machine-readable
  authored clauses describing applicable conditions, priorities, allowed
  actions, preconditions, postconditions, verification, failure handling,
  context selection, delegation, and escalation as appropriate.
- FR-03.4: Clause applicability, conflict handling, and execution order SHALL be
  deterministic and visible in structured traces.
- FR-03.5: Artifacts SHALL expose readable source, class, version, author,
  context cost, dependencies, required tools, included behavior, and known
  tradeoffs.
- FR-03.6: The game SHALL offer multiple valid engineering approaches rather
  than a linear Basic, Better, Best ladder.
- FR-03.7: Self-contained artifacts MAY trade high context and broad local
  coverage for independence; modular artifacts MAY trade lower routine context
  for dependency and staleness risk.
- FR-03.8: The player SHALL be able to inspect professional exemplars after the
  relevant need or failure has created motivation to study them.
- FR-03.9: The player SHALL progress from selecting or commissioning authored
  artifacts to composing deterministic components and eventually architecting
  policies, retrieval, context routes, verification, and escalation.
- FR-03.10: Freeform prose MAY be displayed or edited, but changing prose alone
  SHALL NOT change simulation behavior without corresponding explicit clause
  changes.

### FR-04: Context Assembly and Capacity

- FR-04.1: Context SHALL be visible, finite, provenance-labeled, version-aware,
  and economically meaningful.
- FR-04.2: Every context item SHALL have a deterministic context-unit cost.
- FR-04.3: The selected Agent SHALL expose a segmented Context Capacity gauge
  with numerical used and total values.
- FR-04.4: Gauge segments SHALL distinguish provenance categories including
  Task, System Prompt, Skill, Policy, knowledge or retrieved state, memory, tool
  definitions, and messages as applicable.
- FR-04.5: Adding or removing context SHALL preview or immediately show the
  capacity delta and affected segments.
- FR-04.6: Normal, constrained, critical, and overflow states SHALL use labels,
  numbers, patterns, shape, and optional color; color alone SHALL NOT carry the
  meaning.
- FR-04.7: The game SHALL distinguish capacity from quality. Staleness,
  duplication, conflict, irrelevance, and missing required context SHALL use
  separate diagnostics.
- FR-04.8: Context diagnostics SHALL be introduced progressively. A later
  Context Profiler capability SHALL expose issues such as irrelevant load and
  duplicated Policy only after the player has experienced the pressure; the
  game SHALL NOT solve early optimization problems in advance.
- FR-04.9: Larger context capacity SHALL be a tradeoff, not an automatic best
  choice. It MAY reduce immediate capacity pressure while increasing economic
  cost, execution cost, and opportunity for duplication or conflict.

### FR-05: Runtime Context Lifecycle and Retention

- FR-05.1: Agent operation SHALL proceed through explicit decision cycles:
  assemble context, choose an allowed action, execute a tool, record results and
  observations, calculate the next required context, apply retention if needed,
  and assemble the next snapshot.
- FR-05.2: Runtime context MAY grow from observations, tool results, task
  history, incident evidence, inter-agent messages, retrieved memory, and new
  instructions.
- FR-05.3: Every runtime addition SHALL have deterministic cost and provenance.
- FR-05.4: If required context exceeds capacity, the application SHALL either
  block or apply the configured explicit deterministic Retention Policy.
- FR-05.5: Context SHALL never be silently truncated.
- FR-05.6: Before execution continues after overflow, the application SHALL
  identify the overflow amount, affected items, configured policy, and
  resulting retained context.
- FR-05.7: Strict / Halt and Signal SHALL refuse the over-capacity snapshot,
  stop the Agent before its next decision, and let a deterministic park-level
  monitor report the capacity fault.
- FR-05.8: Keep Newest SHALL evict the oldest eligible unpinned entries first.
- FR-05.9: Priority Retention SHALL protect explicitly pinned or prioritized
  eligible entries and evict lower-priority eligible material first.
- FR-05.10: Compact History SHALL replace eligible history with a smaller
  deterministic summary artifact while preserving provenance and recording
  lost detail.
- FR-05.11: Externalize and Retrieve SHALL store eligible information in
  versioned memory and later retrieve it according to explicit deterministic
  rules.
- FR-05.12: Retention strategies SHALL be contextual choices rather than a
  universally improving upgrade ladder.
- FR-05.13: Excluded, compacted, externalized, and retained items SHALL remain
  inspectable in the context manifest and trace.
- FR-05.14: The first memorable overflow MAY use a concise physical animation;
  later occurrences SHALL use a faster treatment. Animation SHALL NOT replace
  exact accessible information.
- FR-05.15: The game SHALL NOT create hidden emergency context capacity.
  Recovery from a stopped Agent SHALL come from an explicit external system.

### FR-06: Memory and Provenance

- FR-06.1: Memory SHALL exist outside active context until explicitly retained
  or retrieved.
- FR-06.2: Memory entries and summaries SHALL carry stable identity, source,
  time, version, and transformation provenance.
- FR-06.3: Retrieval rules SHALL be explicit, deterministic, and traceable.
- FR-06.4: Shared memory MAY reduce repetition but SHALL introduce observable
  lifecycle risks such as stale, missing, conflicting, overly broad, or
  incorrectly routed state.
- FR-06.5: A historical instruction or memory version SHALL NOT silently become
  current merely because a newer version exists.
- FR-06.6: The player SHALL be able to determine which version an Agent actually
  received for a decision.
- FR-06.7: Compaction SHALL identify the source material, produced summary,
  preserved facts, and unavailable detail without pretending to preserve
  everything.

### FR-07: Tools, Agent Decisions, and Traces

- FR-07.1: Tools SHALL define explicit allowed actions, requirements, observable
  inputs, deterministic results, and world-state effects.
- FR-07.2: The simulation, not the instruction artifact, SHALL adjudicate
  physical reality.
- FR-07.3: A structured trace SHALL expose the Task, exact artifact versions,
  available context, unavailable relevant information when known, applicable
  clauses, tool calls, evidence, state transitions, world changes, and outcome.
- FR-07.4: Traces SHALL expose structured decision provenance and SHALL NOT
  expose, fabricate, or imply hidden chain-of-thought.
- FR-07.5: Selecting an action SHALL show which explicit context and clauses
  made it applicable, which tool was used, and what evidence resulted.
- FR-07.6: Trace and world replay SHALL remain synchronized so the player can
  follow an action in the park and its structured evidence together.
- FR-07.7: Incident inspection SHALL initially show expected behavior, observed
  behavior, consequence, and immediate causal gap; full trace detail SHALL
  require deliberate expansion.

### FR-08: Evals and Regression Suites

- FR-08.1: Every eval case SHALL instantiate a real deterministic simulation
  state and evaluate observable expected behavior.
- FR-08.2: Eval scores and pass rates SHALL be derived from executed cases; the
  application SHALL NOT generate fake reliability percentages.
- FR-08.3: Eval case authoring SHALL have a meaningful one-time engineering
  cost, and rerunning an authored case SHALL be comparatively cheap.
- FR-08.4: Authored eval cases SHALL become permanent reusable engineering
  assets unless explicitly removed through a separate future requirement.
- FR-08.5: The player SHALL explicitly select relevant eval cases or suites for
  a proposed change and see the estimated run cost before execution.
- FR-08.6: The application SHALL support named reusable eval suites.
- FR-08.7: Results SHALL show expected versus observed behavior for each case
  and link failures to replay and trace evidence.
- FR-08.8: The same eval fixture and exact artifact versions SHALL be rerunnable
  after revision for a like-for-like comparison.
- FR-08.9: The safe eval environment SHALL NOT change production world state,
  park rating, visitor safety, or production revenue.
- FR-08.10: The eval UI SHALL clearly distinguish simulation from production
  through persistent labels, framing, controls, timeline, and state treatment
  without relying only on color.

### FR-09: Park Developer and Engineering Workbench

- FR-09.1: The park SHALL have one Park Developer represented as a progression
  mechanism with a face and a coherent Workbench presence.
- FR-09.2: The application SHALL NOT require recruiting, comparing, hiring,
  replacing, paying, or managing a team of human developers.
- FR-09.3: Park Developer progression SHALL unlock capability categories
  including Prompt engineering, Skill authoring, context optimization, eval
  creation, tool integration, memory architecture, Agent design, and
  orchestration.
- FR-09.4: Each unlocked capability SHALL enable a new player action or artifact
  workflow rather than functioning only as a numerical stat.
- FR-09.5: The Park Developer SHALL support commissioning or producing
  professional exemplars, artifact revisions, context optimizations, eval cases,
  tool integrations, memory designs, and Agent configurations as progression
  permits.
- FR-09.6: The player SHALL remain the learner and decision-maker by inspecting
  output, understanding tradeoffs, choosing evals, requesting changes, and
  deciding whether to deploy.
- FR-09.7: The Engineering Workbench SHALL support source inspection,
  deterministic clause inspection, artifact comparison, context composition,
  dependency inspection, and version history.
- FR-09.8: Workbench communication SHALL be brief and attached to actionable
  changes, evals, or deployment decisions rather than lectures.
- FR-09.9: The optional Engineering Handbook SHALL define canonical terms,
  preserve encountered examples, explain visual symbols, and link to relevant
  incidents without becoming required reading.
- FR-09.10: The Engineering Handbook SHALL remain distinct from operational
  manuals, Policies, and other artifacts that can enter Agent context.
- FR-09.11: The Handbook MAY use decorative teeth marks and institutional
  understatement about the previous engineer's wildlife incident, but damage
  SHALL NOT obscure content or controls.

### FR-10: Review, Deployment, and Version Governance

- FR-10.1: Proposed engineering work SHALL produce a versioned change request
  with author, goal, base version, proposed version, readable diff, behavioral
  clause diff, context delta, dependency delta, and expected effect.
- FR-10.2: Review SHALL expose additions, removals, changed dependencies,
  context-cost changes, execution changes, and relevant risk areas.
- FR-10.3: Review SHALL let the player select authored eval cases and suites and
  inspect estimated run cost.
- FR-10.4: Review records SHALL preserve selected cases, results, failures,
  diagnosis links, and the resulting player decision.
- FR-10.5: Deployment SHALL always pin an exact artifact version and its resolved
  dependencies.
- FR-10.6: The player SHALL intentionally deploy, retain, request changes, or
  revert. Merely authoring or reviewing a new version SHALL NOT change
  production behavior.
- FR-10.7: Revert SHALL create an explicit production deployment decision rather
  than rewriting history.
- FR-10.8: Historical versions, change requests, eval fixtures, review records,
  deployments, jobs, traces, and incidents SHALL remain replayable.
- FR-10.9: The primary engineering workflow SHALL be:
  inspect diff, understand context and dependency deltas, select and run
  risk-based evals, diagnose, revise, and intentionally deploy or revert.

### FR-11: Worker and Manager Agent Orchestration

- FR-11.1: Progression SHALL begin with one Worker Agent and introduce additional
  workers only after the player understands basic operation.
- FR-11.2: Additional workers SHALL create throughput and concurrency while also
  creating attention, shared-resource, routing, and coordination pressure.
- FR-11.3: Specialized workers MAY reduce irrelevant context and improve bounded
  work while increasing dependency and coordination complexity.
- FR-11.4: The game SHALL create demand for a Manager Agent before presenting it
  as an available progression option.
- FR-11.5: A Manager Agent SHALL NOT provide magical coordination. It SHALL act
  only through explicit authority boundaries, priorities, delegation rules,
  routing rules, context, escalation criteria, reporting requirements, and
  success conditions.
- FR-11.6: Manager and Worker messages SHALL have explicit provenance and
  context cost.
- FR-11.7: Manager reports SHALL reduce player attention only according to
  configured reporting and escalation behavior; omitted information MAY create
  inspectable failures.
- FR-11.8: The player SHALL be able to trace a delegated job from Manager
  instruction through Worker assignment, context, action, report, and outcome.
- FR-11.9: Later progression MAY authorize a Worker or Manager Agent to summon
  the Incident Response Team automatically through an explicit escalation rule
  with visible authority and cost.

### FR-12: Economy, Rating, and Progression

- FR-12.1: Money and park rating SHALL be the two headline motivators.
- FR-12.2: Visitor attendance SHALL contribute revenue, and rating SHALL affect
  visitor demand.
- FR-12.3: Inspecting rating SHALL explain contributing factors such as safety,
  guest experience, and dinosaur welfare without requiring separate headline
  currencies.
- FR-12.4: Credits SHALL fund appropriate combinations of Park Developer
  capability, authored artifacts, eval creation and runs, robots, Agent
  capabilities, context capacity, Incident Response, recovery, expansion, and
  expressive rewards.
- FR-12.5: The economy SHALL distinguish acquisition or authoring cost from
  runtime context cost and eval run cost.
- FR-12.6: Purchasable or authored artifacts SHALL form a tradeoff ecosystem;
  higher price or larger context SHALL NOT guarantee universally superior
  behavior.
- FR-12.7: Context-capacity upgrades MAY offer genuine short-term relief but
  SHALL NOT eliminate routing, duplication, staleness, conflict, retention, or
  runtime-cost pressure.
- FR-12.8: Failures SHALL cost enough that pre-production evaluation has visible
  return on investment, but safe experimentation SHALL remain affordable.
- FR-12.9: Good engineering SHALL make a mastered local problem need less
  attention, while progression SHALL increase overall challenge through scale,
  concurrency, heterogeneous state, memory, and orchestration.
- FR-12.10: Unlocking permanent expansion SHALL create an opportunity; the
  player SHALL decide when to accept the new species, enclosure, area, or
  lasting responsibility.
- FR-12.11: Expressive rewards such as plushies, merchandise, decorations,
  signage, robot cosmetics, and memorabilia SHALL visibly personalize the park
  without large mechanical bonuses that create a rich-get-richer collapse.
- FR-12.12: Player attention SHALL remain an implicit scarce resource:
  automation, reporting, and orchestration reduce direct intervention, while
  chosen scale and complexity create new demands on that attention.

### FR-13: Alerts, Incidents, and Incident Response

- FR-13.1: Ambient conditions SHALL remain visible world state and SHALL NOT
  generate notifications merely because they exist.
- FR-13.2: Operational warnings SHALL enter a prioritized non-disruptive
  incident queue linked to affected entities.
- FR-13.3: Emergencies SHALL create concise interrupts, spatially identify the
  affected area, and pause production by default.
- FR-13.4: Related symptoms SHALL be grouped into one evolving incident when
  they share a causal event.
- FR-13.5: Later coordination pressure SHALL arise from meaningful routing and
  escalation decisions rather than notification spam.
- FR-13.6: A deterministic park-level monitor SHALL report qualifying faults,
  including a Strict context-capacity stop, without requiring the failed Agent
  to reason.
- FR-13.7: The Incident Response Team SHALL be external to the failed Agent and
  SHALL NOT borrow, extend, replace, or rewrite Agent context.
- FR-13.8: An Incident Response card SHALL show location, immediate risk,
  expected response, cost, arrival time, and available deterministic response
  capabilities.
- FR-13.9: The team SHALL be able to perform explicitly defined stabilization
  such as evacuation, containment, and robot recovery.
- FR-13.10: Stabilization SHALL NOT revise or repair the responsible Prompt,
  Skill, Policy, context route, Retention Policy, or deployment.
- FR-13.11: Response MAY cause direct cost, area closure, downtime, lost revenue,
  and rating consequences, but rescue SHALL remain preferable to allowing
  preventable casualties once lives are at risk.
- FR-13.12: The team SHALL remain an abstract park capability and SHALL NOT
  become a staff hiring or direct-control minigame.

### FR-14: Failure, License Suspension, and Recovery

- FR-14.1: Minor failures MAY create humor, inefficiency, property damage, or
  guest dissatisfaction.
- FR-14.2: Serious failures MAY create injury, death, closures, rating loss,
  recovery cost, and reduced demand.
- FR-14.3: Catastrophic failure in the primary game SHALL use Operating License
  Suspended rather than permanently deleting the park.
- FR-14.4: Suspension SHALL close the park, stop visitor revenue, stabilize
  active danger, and preserve layout, unlocked capabilities, exact artifact
  versions, traces, eval assets, history, and expressive collectibles.
- FR-14.5: Recovery SHALL identify associated incidents and deployed versions
  without fabricating hidden reasoning.
- FR-14.6: Reopening SHALL require an engineering action such as revising or
  reverting responsible artifacts, selecting and passing mandated safety evals,
  and intentionally submitting a reopening deployment.
- FR-14.7: Recovery SHALL be active work and SHALL NOT complete solely by
  waiting for a timer.
- FR-14.8: Reopening MAY impose reduced rating, demand, and temporary operating
  restrictions. Demonstrated safe operation SHALL restore trust.
- FR-14.9: If the player cannot fund mandatory recovery, restricted recovery
  resources SHALL prevent an unrecoverable save and MAY impose debt, a rating
  cap, or temporary restrictions.
- FR-14.10: Bounded challenge scenarios MAY define explicit failure and retry
  conditions.
- FR-14.11: Permanent bankruptcy or license revocation SHALL NOT govern the
  primary game. A future opt-in high-stakes mode is outside the MVP.

### FR-15: Player Experience and Visual Language

- FR-15.1: The park SHALL be the default emotional and operational home.
- FR-15.2: Primary player purposes SHALL include Park View, Contextual
  Inspector, Engineering Workbench, Eval and Incident Replay, and Review and
  Deployment, whether implemented as distinct screens or focused modes.
- FR-15.3: Investigation SHALL preserve a causal navigation path from park event
  through job, Agent action, evidence, artifact, eval, review, and return.
- FR-15.4: Park View and Contextual Inspector SHALL preserve the player's
  selected simulation speed.
- FR-15.5: Entering Workbench, Eval or Incident Replay, and Review or Deployment
  SHALL pause production by default and display a persistent unmistakable
  paused indicator.
- FR-15.6: Focused modes SHALL retain a thin operational anchor with production
  state and time, rating, money, emergency count, selected version, and a
  breadcrumb to the originating entity or incident.
- FR-15.7: Focused modes SHALL NOT require a distracting live miniature park.
- FR-15.8: Production, paused production, eval, and historical replay SHALL use
  distinct labels, framing, motion, controls, and sound without changing world
  semantics.
- FR-15.9: The art direction SHALL use a stylized three-quarter management-sim
  presentation with competent absurdity: colorful, tactile, slightly
  retro-futuristic, operationally credible, and genuinely dangerous.
- FR-15.10: The initial presentation SHALL use a stable three-quarter
  orientation with pan, zoom, focus-on-event, and intelligent occlusion handling
  so rotation is not required to understand an incident.
- FR-15.11: The visual target SHALL favor readable stylized 2.5D presentation
  over photorealism without prescribing the rendering technology.
- FR-15.12: Natural park colors SHALL form the base; stronger operational color
  SHALL be reserved for selection, degradation, warning, and emergency and
  SHALL have non-color equivalents.
- FR-15.13: Ordinary park UI SHALL use approachable legible typography;
  monospace SHALL be reserved for exact clauses, versions, traces, and diffs.
- FR-15.14: Needs, intent, risk, provenance, and outcomes SHALL use a stable
  semantic visual grammar across park and engineering surfaces.
- FR-15.15: Selecting an entity SHALL outline it, reduce irrelevant local
  motion, expose immediate state, intent, and route as applicable, and open a
  concise inspector.
- FR-15.16: Semantic zoom SHALL aggregate conditions and affected areas at
  distance and reveal entity detail at closer levels.
- FR-15.17: Resolved, routine, and low-priority cues SHALL be suppressed as
  density grows.
- FR-15.18: Humor SHALL primarily use animation, timing, juxtaposition,
  environmental reaction, concise announcements, and optional one-line text.
- FR-15.19: Individual casualties SHALL NOT be the punchline, and humor SHALL
  NOT obscure causal or safety information.

### FR-16: Onboarding and Diegetic Learning

- FR-16.1: The first session SHALL open at dawn in the closed park rather than
  on a lecture, Handbook, or Workbench screen.
- FR-16.2: A visitor convoy and concise announcement SHALL establish a pausable
  opening deadline.
- FR-16.3: A dinosaur SHALL express a visible feeding need, and the camera and
  selection affordance SHALL direct attention without prescribing the solution.
- FR-16.4: The first feeding job SHALL be partially configured so the player can
  recognize the need, select the robot, assign the instruction, and watch an
  immediate success.
- FR-16.5: A second similar job SHALL include an observable changed condition:
  an automatic gate closer disabled for maintenance but absent from the
  Worker's available context.
- FR-16.6: Reusing the earlier instruction SHALL create a deterministic,
  recoverable pre-opening containment near miss rather than an onboarding
  fatality.
- FR-16.7: Investigation SHALL reveal the visible consequence, expected versus
  observed behavior, unavailable maintenance information, context boundary, and
  responsible artifact.
- FR-16.8: The game SHALL expose only the minimum Workbench concepts required to
  revise the problem.
- FR-16.9: One relevant introductory eval SHALL be provided without authoring
  cost after the near miss and before the player's first revised deployment.
- FR-16.10: The player SHALL rerun the exact scenario, review the result, deploy
  intentionally, and open the park successfully.
- FR-16.11: Guidance SHALL be action-skippable and SHALL escalate from world
  cues to affordance emphasis, a concise contextual hint, and explicit help
  only if needed.
- FR-16.12: Use of guidance, pause, or slower speed SHALL NOT reduce permanent
  rewards or starting resources.
- FR-16.13: Educational presentation SHALL follow experience, inspect, name,
  apply, and reuse.
- FR-16.14: The application SHALL NOT announce abstract lesson completion or
  grade recall. It MAY summarize concrete operational improvement.
- FR-16.15: A novel scenario with the same underlying concept SHALL test
  transfer without repeating the original guidance.

### FR-17: Accessibility, Persistence, and Privacy

- FR-17.1: Essential state SHALL NOT depend only on color, sound, animation,
  transient timing, hover, precise pointer movement, or rapid reaction.
- FR-17.2: Announcements and transient cues SHALL enter a persistent accessible
  event history.
- FR-17.3: Text SHALL support scaling and reflow without hiding required
  controls, state, or evidence.
- FR-17.4: The application SHALL provide reduced-motion, screen-shake, flashing,
  contrast, and sound-substitution options that preserve semantic information.
- FR-17.5: Park navigation, entity selection, incident inspection, Workbench
  review, eval selection, and deployment SHALL be keyboard operable.
- FR-17.6: Local persistence SHALL restore the exact saved world, seed, time,
  rating, money, progression, artifact registry, deployments, jobs, incidents,
  traces, eval assets, Handbook history, and recovery state.
- FR-17.7: Save and reload SHALL NOT resolve historical references to newer
  versions.
- FR-17.8: Core play SHALL NOT transmit authored text, saves, or behavioral
  telemetry.
- FR-17.9: Playtest instrumentation, if enabled, SHALL be explicit, minimal,
  consented, and SHALL NOT capture authored text or invasive raw input streams.

### FR-18: Rendering Asset Production

- FR-18.1: The development workflow SHALL support producing source rendering
  assets with OpenAI image-generation or image-editing models before the
  features that consume those assets are implemented.
- FR-18.2: Generated output SHALL be treated as untrusted source material and
  SHALL require explicit review, validation, and approval before it enters a
  runtime asset bundle.
- FR-18.3: Each generated source asset SHALL record stable identity, intended
  use, prompt or brief revision, model and model snapshot when available,
  reference inputs, generation parameters, creation time, reviewer decision,
  and transformation provenance without storing API secrets.
- FR-18.4: The asset pipeline SHALL normalize approved sources into
  deterministic, versioned runtime artifacts with declared dimensions,
  anchors, bounds, animation frames, semantic role, variants, and source
  linkage as applicable.
- FR-18.5: Runtime gameplay SHALL load only compiled local assets and SHALL NOT
  require an OpenAI request, model account, API key, network connection, or
  model availability.
- FR-18.6: Missing, invalid, or unapproved assets SHALL fail the build or use an
  explicit development placeholder; production SHALL NOT silently substitute
  an unrelated asset.
- FR-18.7: Visual assets SHALL support the stable semantic grammar and
  accessibility equivalents owned by Player Experience and SHALL NOT be the
  sole carrier of essential state.

## Non-Functional Requirements

- **NFR-01: Determinism** - Authoritative behavior, evals, retention,
  orchestration, economy transitions, and replays SHALL be deterministic for
  the same versioned inputs and ordered commands.
- **NFR-02: Offline availability** - Core play SHALL load, save, progress, eval,
  and replay without network access after the application assets are available.
- **NFR-03: Reliability** - Invalid content, unresolved versions, impossible
  dependencies, corrupt saves, or failed optional features SHALL fail explicitly
  with actionable information and SHALL NOT silently substitute behavior.
- **NFR-04: Replayability** - Historical jobs, incidents, evals, reviews, and
  deployments SHALL preserve enough state and version identity for exact replay.
- **NFR-05: Information integrity** - Context, trace, rating, eval, and
  comparison displays SHALL be derived from authoritative state rather than
  decorative or fabricated values.
- **NFR-06: Performance** - The MVP SHALL remain responsive during supported
  park density, time acceleration, context updates, trace inspection, and eval
  replay. Exact budgets SHALL be established by feature PRDs and measured
  prototypes rather than invented here.
- **NFR-07: Accessibility equivalence** - Supported alternatives SHALL preserve
  state, urgency, location, provenance, context pressure, consequences, and
  actions rather than simply removing inaccessible effects.
- **NFR-08: Learnability** - Representative newcomers SHALL be able to complete
  the opening engineering loop in approximately five minutes without
  facilitator explanation, subject to validation with baseline playtests.
- **NFR-09: Technical authenticity** - Experienced Agent users SHALL regard
  failure causes as credible system, context, version, tool, memory, or
  coordination problems rather than artificially stupid behavior.
- **NFR-10: Inspectability** - Any material action or consequence SHALL be
  traceable to inputs, available context, applicable clauses, tool results,
  evidence, and world changes without exposing hidden chain-of-thought.
- **NFR-11: Modularity** - Each owning feature SHALL expose a small stable public
  contract and keep domain transitions inside the owning service.
- **NFR-12: Compatibility** - The initial release SHALL prioritize desktop
  browser play with keyboard and pointer input. Additional form factors require
  their own acceptance criteria.
- **NFR-13: Content scalability** - New species, scenarios, artifacts, eval
  cases, and progression content SHALL be addable without changing the
  authoritative rules of unrelated existing content.
- **NFR-14: Privacy** - No account or remote telemetry is required. Optional
  research instrumentation SHALL follow explicit consent and data minimization.
- **NFR-15: Cross-platform development** - Repository setup, validation, asset
  compilation, and content authoring SHALL be supported on current Windows and
  macOS development environments without OS-specific product behavior.
- **NFR-16: Asset reproducibility** - Compiled runtime assets SHALL be
  reproducible from committed approved sources and manifests without making a
  new model request. Regeneration MAY produce a new reviewed source version.

## Invariants

- **INV-01: Deterministic core** - Core gameplay SHALL NOT depend on runtime LLM
  output or other uncontrolled probabilistic interpretation.
- **INV-02: Simulation authority** - The simulation owns physical truth.
  Prompts, Skills, Agents, and UI projections cannot directly declare a world
  change successful.
- **INV-03: Prose is not behavior** - Human-readable Prompt, Skill, System
  Prompt, and Policy text is inspectable content and is never parsed to decide
  runtime behavior. Validated machine-readable clauses drive execution.
- **INV-04: Visible context** - Context is finite, visible, provenance-labeled,
  version-aware, and economically meaningful.
- **INV-05: No silent overflow** - Context overflow is never silent. Execution
  either blocks or applies an explicit deterministic Retention Policy, and all
  excluded or transformed information remains inspectable and replayable.
- **INV-06: No hidden reserve** - A full context window is not escaped through
  secret emergency capacity. External Incident Response is separate from Agent
  context.
- **INV-07: Capacity is not quality** - Larger or fuller context is not
  automatically better; relevance, duplication, conflict, staleness,
  dependencies, and runtime cost remain meaningful.
- **INV-08: Pinned history** - Jobs and deployments resolve exact artifact
  versions. Historical content, traces, eval fixtures, reviews, and deployments
  never silently float to current versions.
- **INV-09: Real evals** - Every eval result derives from an executed
  deterministic scenario. Fake reliability percentages are prohibited.
- **INV-10: Structured provenance, not chain-of-thought** - Traces expose
  inputs, context, clauses, tool calls, evidence, world changes, and outcomes.
  They never fabricate or expose hidden reasoning.
- **INV-11: Intentional production change** - New artifact versions do not
  affect production until intentionally deployed; reversion is also an explicit
  deployment.
- **INV-12: Central engineering workflow** - The product centers inspect diff,
  understand context and dependencies, select and run risk-based evals,
  diagnose, revise, and intentionally deploy or revert.
- **INV-13: Trustworthy failure** - Failures are attributable to explicit world
  state, context, artifacts, tools, versions, memory, or coordination. The game
  does not make Agents arbitrarily stupid to force a lesson.
- **INV-14: Park first** - The living park supplies goals, stakes, spectacle,
  personality, and consequences. Engineering interfaces provide leverage and
  explanation rather than replacing the park.
- **INV-15: Learning through consequences** - The game presents a problem and
  consequence before teaching the tool or abstract lesson that resolves it.
- **INV-16: Canonical language** - Player-facing engineering concepts use the
  canonical AI-engineering terms in this PRD. Diegetic flavor does not rename
  them into obscurity.
- **INV-17: One Park Developer** - The Park Developer is one progression and
  Workbench mechanism, not a developer hiring, replacement, salary, or
  team-management simulator.
- **INV-18: Explicit orchestration** - Manager Agents solve coordination only
  through explicit delegation, authority, routing, escalation, reporting,
  context, and success rules.
- **INV-19: External stabilization** - The Incident Response Team may stabilize
  the world but never fixes the responsible engineering artifact or extends the
  failed Agent.
- **INV-20: Fair rescue economics** - Once lives are at risk, refusing rescue
  solely to avoid its fee cannot be the economically optimal choice.
- **INV-21: Persistent casualties** - Visitor injury and death are valid
  consequences and carry weight. Individual victims are not jokes, and
  casualties remain deterministic and diagnosable.
- **INV-22: Recoverable primary campaign** - Catastrophic failure suspends the
  operating license and creates an engineering recovery loop; it does not
  permanently delete the primary save.
- **INV-23: Player-paced permanent scope** - Permanent expansion is an
  intentional player choice. Success does not silently add lasting
  responsibilities.
- **INV-24: Local mastery, global challenge** - Good engineering reduces
  attention required by solved systems; overall challenge grows through chosen
  scale and new systems rather than undoing local mastery.
- **INV-25: Accessible meaning** - Essential meaning and actions never depend on
  one sensory channel, hover, precise pointer movement, or rapid reaction.
- **INV-26: Domain ownership** - UI code renders projections and issues allowed
  commands; authoritative transitions remain in owning domain services.
- **INV-27: Generated media is not authority** - AI-generated or manually
  authored media may represent world state, but it never determines simulation
  truth or replaces semantic and accessible state projections.
- **INV-28: No runtime model dependency** - OpenAI models may assist the
  development-time asset workflow, but the shipped game never calls them and
  never requires their credentials or availability.

## MVP Definition and Acceptance Criteria

The MVP is a cohesive vertical slice that proves the core fantasy and
engineering loop. It is not required to include the full multi-agent curriculum,
but it SHALL use production-quality domain contracts and version semantics so
later features do not require replacing fake systems.

### MVP Included Scope

- A deterministic closed-to-open park day with a stylized three-quarter Park
  View.
- At least one Worker robot, two feeding situations, dinosaurs, visitors,
  enclosure gates, a degraded gate condition, jobs, time controls, rating, and
  credits.
- The accepted first-five-minute opening: one success, changed maintenance
  context, recoverable near miss, diagnosis, free introductory eval, review,
  deployment, and successful opening.
- Inspectable Prompt or Skill source backed by deterministic authored clauses.
- Exact artifact versions and one intentional production deployment plus revert
  capability.
- Context Capacity gauge with numerical values, provenance segments, live
  runtime growth, Strict handling, and at least one explicit visible eviction
  policy such as Keep Newest.
- Structured trace and synchronized deterministic replay for the opening
  incident and eval.
- Authored eval cases selected explicitly, actual expected/observed results, and
  a reusable suite or equivalent saved selection.
- A minimal Park Developer and code-review-like Workbench.
- A minimal rating and revenue loop with one visible expressive reward, such as
  a gift-shop plushie.
- Incident grouping, emergency pause, and a minimal external Incident Response
  Team demonstration.
- Local persistence of exact world, versions, trace, eval, deployment, and
  progression state.
- The accessibility baseline in FR-17 for every included path.
- A reviewed and versioned rendering-asset pipeline that can compile the MVP
  park, dinosaur, robot, gate, visitor, cue, and effects assets from approved
  sources with recorded provenance.

### MVP Acceptance Criteria

- **MVP-AC-01:** Core play succeeds with network access disabled and without an
  account, secret, backend, or runtime LLM.
- **MVP-AC-02:** Replaying the opening near miss from the same state and exact
  versions produces the same actions, trace, and outcome.
- **MVP-AC-03:** Changing readable prose without changing authored clauses does
  not change behavior.
- **MVP-AC-04:** The player can follow the maintenance-condition failure from
  world consequence to job, action, missing context, responsible artifact,
  eval, review, deployment, and return to the park.
- **MVP-AC-05:** The context gauge accurately shows composition, runtime growth,
  overflow, retained or excluded items, and the responsible Retention Policy.
- **MVP-AC-06:** No over-capacity execution silently drops information.
- **MVP-AC-07:** Every displayed eval result matches a real executed
  deterministic fixture and can be replayed.
- **MVP-AC-08:** Historical jobs and replays continue resolving their original
  versions after a new deployment.
- **MVP-AC-09:** Incident Response visibly stabilizes the park without altering
  the failed artifact or its trace.
- **MVP-AC-10:** Production, pause, eval, and replay are distinguishable without
  relying on color.
- **MVP-AC-11:** Every included critical action is keyboard operable and every
  included transient cue has a persistent accessible equivalent.
- **MVP-AC-12:** Representative newcomers complete the opening engineering loop
  in approximately five minutes without facilitator explanation in baseline
  playtesting.
- **MVP-AC-13:** A novel follow-up fixture verifies that players can transfer
  the missing-context concept rather than repeat memorized clicks.
- **MVP-AC-14:** Experienced Agent users judge the first failure credible and
  attributable rather than arbitrary.
- **MVP-AC-15:** Save, reload, replay, revert, and redeploy preserve exact
  outcomes and history.
- **MVP-AC-16:** A behavioral change is not complete until automated validation
  passes and the implemented flow is successfully verified through computer
  use in the browser.

### Post-MVP Full-Vision Scope

- Progressive Prompt, Skill, System Prompt, Policy, tool, memory, and context
  architecture content.
- Full Retention Policy progression: Priority Retention, deterministic
  compaction, and Externalize and Retrieve.
- Broader eval authoring, reusable suites, coverage gaps, and regression
  economics.
- Multiple Worker Agents, specialization, shared resources, and context
  switching.
- Manager Agents and full orchestration rules.
- Broader park economy, species, enclosures, expansion, expressive rewards,
  casualties, Incident Response capabilities, and license-suspension recovery.
- Mature-park semantic zoom, density, alert routing, and reporting pressure.
- Additional challenge scenarios and optional future high-stakes modes.

## Out of Scope

- **Runtime LLM dependency** - Core behavior does not call or simulate an
  uncontrolled natural-language model.
- **Freeform prose as executable behavior** - Arbitrary player text is not
  parsed to decide actions.
- **Chatbot-first play** - The primary game is park operation and system
  engineering, not an edit-prompt-and-chat loop.
- **Developer hiring simulation** - Multiple developer candidates, salaries,
  recruiting, replacement, specialization management, and engineering teams
  are excluded.
- **Job-security anxiety messaging** - The game demonstrates that developer work
  moves toward architecture; it does not lecture or threaten the player about
  replacement.
- **Raw chain-of-thought** - Hidden reasoning is neither shown nor fabricated.
- **Fake evals or reliability scores** - All scores derive from real cases.
- **Silent context truncation** - Retention is explicit and inspectable.
- **Magic Manager Agent** - A vague instruction cannot grant undeclared
  authority, context, coordination, or competence.
- **Magic Incident Response** - Stabilization does not fix engineering causes.
- **Direct-control rescue minigame** - The Incident Response Team is an explicit
  deterministic park capability.
- **Permanent primary-save deletion** - Bankruptcy or permanent license
  revocation is not the main campaign loss model.
- **Multiplayer and social services** - Competitive, cooperative, account, and
  social features are not part of the baseline.
- **Required cloud persistence or telemetry** - Saves and core play remain
  local.
- **Mobile-first interface** - The initial product targets desktop browser play.
- **Full night-operations simulation in MVP** - Night or overlapping shifts are
  later explicit complexity.
- **Content without curriculum value** - New mechanics must practice a desired
  transferable skill, deepen park play, or displace an existing system rather
  than simply joining the feature pile.

## Product Decisions

- **PD-01: Operate a park, not a chatbot** - Prompts are a control surface; the
  player's fantasy is running an absurdly complicated park through intelligent
  systems.
- **PD-02: Actions to systems** - Direct action control becomes less viable as
  complexity grows, making abstraction a player-earned capability.
- **PD-03: Deterministic AI-engineering simulation** - Reproducibility and
  debuggability provide stronger learning than stochastic model output.
- **PD-04: Context as a signature resource** - Capacity, composition,
  provenance, lifecycle, and runtime cost are visible gameplay.
- **PD-05: Explicit retention refines hard blocking** - Overflow may continue
  only through a named deterministic Retention Policy; silent truncation remains
  prohibited.
- **PD-06: No emergency context reserve** - A stopped Agent is recovered by an
  external system, preserving the reality of the capacity limit.
- **PD-07: Evals are authored assets** - Initial construction is expensive,
  reruns are cheap, suites compound in value, and cases define expected
  behavior.
- **PD-08: Every eval is a real scenario** - Failure is replayable world
  behavior rather than a fabricated percentage.
- **PD-09: Code-review-like governance** - Diff, context, dependencies, selected
  evals, diagnosis, deployment, and revert converge in the central workflow.
- **PD-10: One Park Developer** - The character provides capability progression
  and engineering work without introducing human-team management.
- **PD-11: Recognition grows into construction** - Early exemplars teach
  inspection, midgame composition teaches structure, and late architecture
  teaches system design.
- **PD-12: Canonical vocabulary supports transfer** - Prompt, Skill, System
  Prompt, context, memory, tool, eval, Agent, Manager Agent, and orchestration
  keep their professional meanings.
- **PD-13: Problem before tool** - Players experience pressure or failure before
  receiving the mechanic that resolves it.
- **PD-14: Park first, engineering second** - Technical screens answer questions
  created by visible park events.
- **PD-15: Rating and money are headline motivators** - Rating explains safety,
  guest experience, and dinosaur welfare and drives demand and revenue.
- **PD-16: Casualties are real** - Injury and death match the dangerous-park
  fantasy but remain weighty, attributable, and non-exploitative.
- **PD-17: Incident Response is external** - It creates defense in depth and
  escalation learning without magically fixing the failed Agent.
- **PD-18: License suspension is the main catastrophic state** - Recovery
  preserves learning and history while making failure consequential.
- **PD-19: Local mastery does not flatten the game** - Solved areas become calm;
  chosen expansion adds qualitatively new difficulty.
- **PD-20: Permanent expansion is intentional** - Unlocks offer opportunity and
  never silently impose permanent scope.
- **PD-21: Expression supplements power** - Plushies, merchandise, decoration,
  signs, and cosmetics celebrate success without large stat bonuses.
- **PD-22: Competent absurdity defines tone** - The institution is earnest, the
  robots follow systems, dinosaurs behave as animals, and humor emerges from
  collision and bureaucracy.
- **PD-23: Humor is concise and mostly visual** - Animation, timing,
  juxtaposition, and short announcements replace walls of flavor text.
- **PD-24: Three-quarter stylized presentation** - A readable 2.5D
  management-sim view supports spectacle, diagnosis, accessibility, and browser
  performance.
- **PD-25: Diegetic first, redundantly readable** - World cues lead; attention
  cues and exact inspection preserve clarity and accessibility.
- **PD-26: Engineering modes pause by default** - Difficulty comes from systems
  judgment, not reading speed.
- **PD-27: Stable operation is part of the fun** - The player must see and enjoy
  automation working, not only repair constant emergencies.
- **PD-28: Primary play remains recoverable** - Safe evals encourage
  experimentation; production remains costly; catastrophic errors create a
  comeback rather than erased progress.
- **PD-29: Engineering Handbook is player reference** - It is distinct from
  operational context and may carry the chewed previous-engineer visual gag.
- **PD-30: Full-product tuning follows evidence** - Exact day duration,
  incident curves, economy values, density limits, and final playtest
  percentages require feature prototypes and baseline testing.

## Implementation Decisions

- **IMP-01: Authoritative headless simulation** - World rules SHALL be deep,
  mostly headless domain behavior that UI surfaces project and command.
- **IMP-02: Clause-driven execution** - Instruction schemas SHALL encode
  deterministic applicability, actions, verification, context selection, and
  failure behavior separately from readable prose.
- **IMP-03: Boundary validation** - Dynamic, saved, and imported content SHALL
  be validated before entering authoritative systems.
- **IMP-04: Stable identity and order** - Entities, artifacts, fixtures,
  commands, context items, trace events, and deployments SHALL use stable IDs
  and deterministic ordering.
- **IMP-05: Immutable historical resolution** - Content Registry SHALL resolve
  exact versions and dependencies without mutating historical records.
- **IMP-06: Shared eval and production rules** - Evals SHALL instantiate the
  same simulation and instruction semantics as production rather than a mock
  scoring path.
- **IMP-07: Structured trace schema** - Trace data SHALL store input and
  provenance fields explicitly and SHALL NOT store hidden reasoning text.
- **IMP-08: Explicit context snapshots** - Context assembly and retention SHALL
  produce inspectable before and after manifests at decision boundaries.
- **IMP-09: Deterministic summary artifacts** - Compaction SHALL create a
  versioned summary with explicit source linkage and known lost detail.
- **IMP-10: Feature isolation** - Browser-facing feature registration SHALL be
  lazy and deterministic, and failure of an optional feature SHALL not blank
  sibling features.
- **IMP-11: Public package boundaries** - Downstream features SHALL consume
  small public APIs rather than internal files from other domains.
- **IMP-12: Local-first persistence** - The baseline save system SHALL not
  require an account or remote database.
- **IMP-13: Presentation from projections** - UI components SHALL render
  read-only projections and issue allowed commands; they SHALL not own domain
  transitions.
- **IMP-14: No premature numeric tuning** - Feature PRDs may establish measured
  budgets and balance only when a prototype or explicit product decision
  supports them.
- **IMP-15: Hybrid DOM and canvas presentation** - Semantic application and
  engineering surfaces SHALL use React-rendered DOM; the Park View SHALL use a
  PixiJS WebGL canvas as a read-only projection of authoritative state.
- **IMP-16: Static cross-platform toolchain** - The application SHALL use
  strict TypeScript, React, PixiJS, and Vite and SHALL produce static browser
  assets from the same repository commands on Windows and macOS.
- **IMP-17: Pre-runtime model use** - OpenAI image generation and editing MAY
  produce source assets during development, but model integration SHALL remain
  outside runtime gameplay and compiled bundles SHALL be independently usable.

## Testing Decisions

- **TST-01: Deterministic contract fixtures** - Given exact state, versions, and
  commands, tests SHALL assert exact actions, world deltas, trace events,
  context manifests, and outcomes.
- **TST-02: Replay equivalence** - Production incident and eval replays SHALL
  match their original authoritative records.
- **TST-03: Prose independence** - Tests SHALL prove that readable text changes
  alone do not change behavior.
- **TST-04: Version pinning** - Tests SHALL prove that historical jobs, evals,
  and deployments do not float after new versions are authored or deployed.
- **TST-05: Real eval results** - Tests SHALL derive displayed results from
  executed cases and reject fabricated scores.
- **TST-06: Retention matrix** - Strict, Keep Newest, Priority Retention,
  compaction, and retrieval SHALL each be tested for capacity math, eligibility,
  deterministic order, provenance, and downstream behavior.
- **TST-07: No silent truncation** - Any over-capacity path that neither blocks
  nor records an explicit policy transformation SHALL fail validation.
- **TST-08: No chain-of-thought fields** - Trace contracts and rendered
  projections SHALL be checked for structured evidence only.
- **TST-09: Incident boundaries** - Tests SHALL prove that Incident Response
  changes allowed world state but does not alter Agent context or responsible
  artifacts.
- **TST-10: Recovery preservation** - License suspension, restricted recovery,
  reopening, save, and reload SHALL preserve exact history and avoid an
  unrecoverable save.
- **TST-11: Accessibility contracts** - Tests SHALL cover keyboard operation,
  persistent alternatives for transient cues, non-color state distinction,
  text scaling, reduced motion, and mode identification.
- **TST-12: Architecture enforcement** - Automated checks SHALL prevent
  cross-domain internal imports and direct UI mutation of authoritative state.
- **TST-13: Rendered experience checks** - Critical Park, Inspector, Workbench,
  Eval, Replay, Review, and suspension states SHALL have rendered HTML or
  equivalent presentation tests in addition to domain tests.
- **TST-14: Behavioral playtests** - The initial sequence SHALL test first-look
  comprehension, the five-minute loop, context retention, transfer, Incident
  Response, mature density, and voluntary mastery or expansion.
- **TST-15: Participant diversity** - Playtesting SHALL include developers with
  low and high Agent experience, management-sim and non-management-sim players,
  and participants using relevant accessibility features.
- **TST-16: Behavior over self-report** - Research SHALL observe action,
  assistance, navigation, diagnosis, retention understanding, replay,
  deployment, and voluntary continuation before relying on preference surveys.
- **TST-17: Baseline before thresholds** - Numeric usability and density
  thresholds other than the provisional five-minute opening target SHALL follow
  baseline pilot data.
- **TST-18: Minimal instrumentation** - Research instrumentation SHALL capture
  consented meaningful game events and SHALL not capture authored text or
  invasive raw input.
- **TST-19: Full repository validation** - Completed behavioral changes SHALL
  pass type checking, linting, architecture linting, relevant focused tests, and
  the repository's complete validation command.
- **TST-20: Browser verification** - Every behavioral change SHALL be exercised
  successfully through computer use in the running browser before completion.

## Proposed Modules

Each module SHOULD be deep: small public API, clear ownership, hidden internal
complexity, stable deterministic contracts, and focused tests.

- **MOD-01: Application Shell** - Browser entry, route matching, provider
  composition, configuration, lifecycle, error isolation, and optional-feature
  fallback. Feature code consumes only the shell public API.
- **MOD-02: Feature Registry** - Lazy deterministic discovery of
  browser-facing feature public entries.
- **MOD-03: Simulation** - Authoritative world state, clock, deterministic
  commands, entities, tools' physical effects, scenarios, and state transitions.
- **MOD-04: Instruction** - Authored clause schemas, applicability, conflict
  handling, allowed Agent actions, verification, failure handling, and
  deterministic execution.
- **MOD-05: Context** - Context-item schemas, assembly, capacity, provenance,
  runtime growth, Retention Policies, pinning, diagnostics, and manifests.
- **MOD-06: Memory** - Versioned external memory, deterministic retrieval,
  staleness, sharing, compaction summaries, and provenance.
- **MOD-07: Content Registry** - Immutable artifacts, exact versions,
  dependencies, validation, historical resolution, and authored content
  catalog.
- **MOD-08: Eval Runner** - Eval cases, suites, simulation fixture
  instantiation, expected behavior, cost, results, and rerun.
- **MOD-09: Trace Replay** - Structured trace capture, incident timeline,
  synchronized world replay, context snapshots, and historical projections.
- **MOD-10: Park Operations** - Jobs, schedules, day cadence, alerts, incidents,
  visitor opening and closing, and operational projections.
- **MOD-11: Engineering Workbench** - Park Developer capabilities, artifact
  source, comparison, composition, change requests, and Engineering Handbook.
- **MOD-12: Review Deployment** - Diff and dependency review, eval selection,
  review records, exact deployment, rollback, and reopening submission.
- **MOD-13: Economy Progression** - Rating, demand, credits, costs, unlocks,
  expansion, expressive rewards, and recovery resources.
- **MOD-14: Orchestration** - Worker and Manager Agent topology, delegation,
  authority, routing, escalation, reporting, shared context, and coordination
  traces.
- **MOD-15: Incident Response** - Park-level fault monitor, response
  eligibility, deterministic stabilization, timing, cost, and Incident Response
  Team projections.
- **MOD-16: Persistence** - Local save schema, migrations, exact restoration,
  content and history references, and corruption handling.
- **MOD-17: Curriculum Content** - Ordered learning arcs, authored scenarios,
  artifacts, eval fixtures, transfer cases, unlock requirements, and concise
  Park Developer or announcement copy.
- **MOD-18: Telemetry** - Local or consented test events, privacy filters,
  research export, and no-author-text enforcement.
- **MOD-19: Player Experience** - Park and focused-mode adapters, semantic
  visual grammar, camera and zoom, accessible interactions, state projection,
  and route integration.
- **MOD-20: Rendering Asset Pipeline** - Asset briefs, OpenAI-generation
  provenance, source review, deterministic transformations, atlases, manifests,
  validation, development placeholders, and versioned runtime bundles.

## Required Feature PRD Decomposition

Before implementing a new domain, create an owning
Specs/<featureSlug>_PRD.md from the PRD template. Each feature PRD SHALL:

1. Trace its user stories and requirements to relevant application FRs, NFRs,
   invariants, decisions, and MVP acceptance criteria.
2. Identify exact upstream and downstream features.
3. Define its public behavior and state ownership without duplicating another
   domain's rules.
4. Preserve deterministic IDs, ordering, versions, provenance, and replay.
5. Identify content schemas and validate dynamic data at the boundary.
6. Specify accessibility and failure behavior for its visible surfaces.
7. Record any application-level refinement explicitly before implementation.
8. Define focused automated tests and visible computer-use verification.

Recommended owning PRDs and dependency order:

| Order | Suggested PRD | Primary scope | Blocked by |
|---|---|---|---|
| 1 | application-shell_PRD.md | Browser bootstrap, routes, fallback, feature contracts | None |
| 2 | content-registry_PRD.md | Artifact identity, validation, exact versions, dependencies | Application Shell |
| 3 | rendering-assets_PRD.md | OpenAI-assisted source generation, provenance, review, compilation, and runtime asset bundles | Application Shell, Content Registry |
| 4 | simulation_PRD.md | World state, time, entities, deterministic commands and fixtures | Content Registry |
| 5 | instruction_PRD.md | Machine-readable clauses and deterministic Agent execution | Simulation, Content Registry |
| 6 | context_PRD.md | Context items, capacity, assembly, runtime growth, retention | Instruction, Content Registry |
| 7 | memory_PRD.md | External state, retrieval, compaction, provenance | Context, Content Registry |
| 8 | trace-replay_PRD.md | Trace schema, world timeline, replay, historical projection | Simulation, Instruction, Context |
| 9 | park-operations_PRD.md | Jobs, day loop, alerts, incidents, visitors, operational commands | Simulation, Trace Replay |
| 10 | player-experience_PRD.md | Park View, inspector, focused modes, visual grammar, onboarding | Park Operations, Rendering Asset Pipeline, and relevant projections |
| 11 | engineering-workbench_PRD.md | Park Developer, artifacts, comparison, composition, Handbook | Content Registry, Context |
| 12 | eval-runner_PRD.md | Cases, suites, expected behavior, cost, deterministic rerun | Simulation, Instruction, Context, Trace Replay |
| 13 | review-deployment_PRD.md | Review records, eval selection, pinned deployment, revert | Workbench, Eval Runner, Content Registry |
| 14 | economy-progression_PRD.md | Rating, money, costs, unlocks, expansion, expression | Park Operations, Review Deployment |
| 15 | incident-response_PRD.md | Fault monitoring, response, stabilization, suspension support | Park Operations, Economy, Trace Replay |
| 16 | orchestration_PRD.md | Multiple Workers, Manager Agent, authority and routing | Instruction, Context, Park Operations |
| 17 | persistence_PRD.md | Exact local save, restore, migration, failure handling | Stable schemas from owning domains |
| 18 | curriculum-content_PRD.md | Scenario progression, authored artifacts, evals, transfer cases | All curriculum-owning domains |
| 19 | telemetry-playtesting_PRD.md | Consented event instrumentation and research outputs | Player Experience, Privacy requirements |

Feature boundaries may be combined only when a PRD explains why the combined
module remains deep and dependency ownership stays clear. They SHALL NOT be
combined merely to avoid specifying contracts.

## PLAN and Vertical-Slice Guidance

For work spanning multiple concerns, create an ephemeral PLAN from
Specs/Templates/template_PLAN.md. Prefer vertical tracer bullets that produce a
visible and testable player outcome across the required domains.

The first playable PLAN SHOULD use these slices rather than building all engines
horizontally:

1. **Park opens with one visible need**
   - Render the closed park, one dinosaur, one robot, a gate, approaching
     visitors, time controls, accessible cues, and deterministic selection.
   - Validate the simulation-to-UI command boundary.
2. **First feeding succeeds**
   - Resolve one partially configured job against an exact Prompt or Skill
     version and show the resulting tool actions and world changes.
   - Add the minimal trace needed to prove determinism and prose independence.
3. **Changed gate context creates a near miss**
   - Add the disabled gate closer, missing maintenance context, visible escape,
     grouped incident, expected/observed summary, and synchronized trace replay.
4. **Revise, eval, review, and deploy**
   - Add minimal Park Developer change request, context delta, free eval,
     deterministic replay, intentional deployment, and successful rerun.
5. **Complete and persist the first park day**
   - Open to visitors, calculate rating and credits, show one expressive reward,
     save exact history, reload it, and verify keyboard and reduced-motion paths.
6. **Demonstrate runtime context pressure**
   - Add context growth, the segmented gauge, Strict stop, Keep Newest eviction,
     inspectable before/after manifests, and a behavior difference caused by
     retained context.
7. **Demonstrate external recovery**
   - Halt a robot in a hazardous state, group the emergency, activate Incident
     Response, stabilize the park, and prove the artifact remains unresolved.

Every slice SHALL identify:

- the application stories and requirement IDs it satisfies,
- upstream slice dependencies,
- the visible result the user can exercise,
- deterministic automated tests,
- accessibility checks,
- save/replay/version implications, and
- the browser computer-use scenario that proves completion.

## Workflows

### Workflow 1: Opening Learning Loop

    1. Load the closed park at dawn with no required account or network.
    2. Show approaching visitors, an opening announcement, one hungry dinosaur,
       one available robot, and a partially configured feeding job.
    3. Let the player select the dinosaur or robot and assign the job.
    4. Resolve the job deterministically and show a clean success.
    5. Present a second feeding need at an enclosure whose automatic gate closer
       is visibly disabled for maintenance.
    6. Omit that maintenance condition from the Worker's assembled context.
    7. Reuse of the earlier instruction produces a recoverable pre-opening
       containment near miss.
    8. Group the world symptoms into one incident and pause on emergency.
    9. Show expected, observed, consequence, and immediate missing-context cause.
    10. Follow the incident to the trace and responsible artifact.
    11. Use the minimum Workbench controls to revise the behavior or context
        route.
    12. Run the provided free deterministic eval and replay it.
    13. Review the diff, context and dependency deltas, and eval evidence.
    14. Deploy the exact revised version intentionally.
    15. Rerun the job successfully and open the park.

### Workflow 2: Routine Agent Decision Cycle

    1. Resolve the job's exact Task, Agent, artifact versions, dependencies, and
       tools.
    2. Assemble the current provenance-labeled context snapshot.
    3. Apply deterministic clauses to select an allowed action.
    4. Execute the tool against authoritative simulation state.
    5. Record tool result, evidence, and world delta in the trace.
    6. Add eligible observations, results, messages, history, or retrieved
       memory and calculate the next required context.
    7. If capacity is exceeded, block or apply the configured Retention Policy
       and record every transformation.
    8. Assemble the next snapshot and continue, stop, complete, or escalate.

### Workflow 3: Commission, Inspect, and Compare an Artifact

    1. A park problem creates demand for a capability.
    2. The player opens the single Park Developer in the Engineering Workbench.
    3. Available work reflects unlocked engineering capabilities.
    4. The player commissions or selects an artifact option.
    5. The Workbench shows source, clauses, context cost, dependencies, required
       tools, version, and tradeoffs.
    6. Comparison highlights missing verification, escalation, safety checks,
       duplicated policy, irrelevant context, or dependency differences.
    7. The player chooses to use, compose, revise, or defer the artifact.

### Workflow 4: Risk-Based Review and Deployment

    1. The Park Developer submits a versioned change request with a stated goal.
    2. Review shows readable and behavioral diffs, context delta, dependency
       delta, exact versions, and expected operational effect.
    3. The player inspects available authored eval cases and their one-time or
       rerun economics.
    4. The player selects the risks worth testing and sees estimated run cost.
    5. The Eval Runner instantiates each selected deterministic scenario.
    6. Results show expected versus observed behavior and link failures to
       replay and trace.
    7. The player diagnoses and revises, requests changes, retains the old
       version, or accepts the evidence.
    8. The player intentionally deploys an exact version or reverts through a
       new deployment record.

### Workflow 5: Context Overflow and Retention

    1. A running Agent accumulates observations, tool results, messages, history,
       or retrieved memory at decision boundaries.
    2. The segmented gauge previews that the next context exceeds capacity.
    3. The UI identifies the excess, affected items, pinning or priority, and
       configured Retention Policy.
    4. Strict stops and emits a park-level fault; Keep Newest excludes oldest
       eligible items; Priority excludes lower-priority items; Compact History
       creates a versioned summary; Externalize and Retrieve moves eligible state
       to memory.
    5. Excluded or transformed items move to a labeled destination through
       concise accessible presentation.
    6. If execution continues, the Agent acts using only the retained context.
    7. The player observes the resulting behavior before inspecting the
       retention event and downstream effect in the trace.

### Workflow 6: Incident Response

    1. An emergency or stopped Agent leaves the park in a dangerous state.
    2. A park-level monitor creates or updates one causally grouped incident.
    3. Production pauses and the incident identifies location, risk, response
       cost, arrival time, and capabilities.
    4. The player activates the external Incident Response Team.
    5. The team deterministically evacuates, contains, or recovers according to
       its explicit capability and world access.
    6. The world becomes stable and production consequences are recorded.
    7. The engineering artifact, deployment, and context remain unchanged.
    8. The player follows the unresolved fault into incident review.

### Workflow 7: Multi-Agent Orchestration

    1. Additional Worker Agents create parallel throughput and shared-resource
       pressure.
    2. The player experiences overlapping jobs, context switching, routing gaps,
       or cross-agent interference.
    3. Manager Agent progression becomes available after that demand is visible.
    4. The player defines Manager authority, priority, delegation, context
       routes, escalation, reporting, and success conditions.
    5. The Manager delegates exact jobs and versions to Workers.
    6. Workers execute bounded work and report according to explicit rules.
    7. The player inspects meaningful exceptions and can trace the complete
       Manager-to-Worker-to-world chain.
    8. Poor orchestration remains diagnosable and does not receive magical
       correction.

### Workflow 8: Park Day, Mastery, and Expansion

    1. Pre-opening exposes needs, scheduled work, and proposed deployments.
    2. During open operation, the player watches automation and handles
       meaningful exceptions.
    3. At closing, visitors leave and the world visibly settles.
    4. A concise summary shows rating, attendance, revenue, incidents, and manual
       interventions without becoming a wall of text.
    5. Completed engineering work and expressive rewards become available.
    6. The player may continue another stable day, customize the park, or
       intentionally accept an unlocked expansion.
    7. Expansion introduces qualitatively new scale, state, context, eval, or
       coordination pressure without undoing mastered local reliability.

### Workflow 9: Operating License Suspension and Reopening

    1. Catastrophic casualties, repeated unresolved safety failures, or
       financial collapse trigger Operating License Suspended.
    2. Visitor operation and revenue stop; active danger is stabilized.
    3. The park preserves exact layout, history, artifacts, evals, traces,
       unlocks, and collectibles.
    4. Recovery review identifies associated incidents and deployed versions.
    5. The player revises or reverts responsible artifacts.
    6. The player selects and passes mandated deterministic safety evals.
    7. The player submits an intentional compliant reopening deployment.
    8. If funds are insufficient, restricted recovery support prevents a dead
       save while applying explicit debt, caps, or restrictions.
    9. The park reopens with reduced rating and demand.
    10. Demonstrated safe operation restores trust; waiting alone does not.

### Workflow 10: Save, Reload, and Historical Replay

    1. Persist world state, seed, time, progression, exact content references,
       deployments, jobs, incidents, traces, eval assets, and recovery state.
    2. Reload and validate the save against supported schemas.
    3. Resolve historical references to their pinned versions.
    4. Restore current production without rewriting history.
    5. Replay a historical job, incident, or eval and reproduce its recorded
       outcome.
    6. If required historical content is missing or invalid, block explicitly
       and present actionable remediation rather than substituting current
       content.
