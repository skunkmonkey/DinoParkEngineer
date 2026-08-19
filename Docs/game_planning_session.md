# Dino Park Engineer - Game Planning Session Notes

## Session purpose

Define the user interface, user experience, design language, fun factor,
playability, and presentation of educational information so that Dino Park
Engineer feels like an enjoyable game rather than a course.

These notes capture working decisions, constraints, meaningful dissent, and
open questions from the planning panel. They are preparation for a future PRD,
not a replacement for one.

## Panel

- Ava Moreno - Management-Sim Systems Designer (28 years of experience)
- Micah Tan - Game UX and Information-Architecture Designer (26 years)
- Nia Okafor - Art Director and Motion/UI Designer (27 years)
- Luis Park - Narrative Systems Designer and Comedy UX Writer (25 years)
- Dr. Tessa Rao - Learning-Game Designer (29 years)
- Erin Walsh - Game User Researcher and Accessibility Specialist (25 years)
- Morgan Vale - Design Scribe (30 years); silent participant responsible only
  for maintaining this record

## Participation rules

- Panelists speak only when they have something uniquely valuable to add.
- Agreement or disagreement may be recorded as aggregate thumbs-up or
  thumbs-down counts rather than repetitive responses.
- Pushback is valuable.
- Every panelist remains within their professional perspective.
- The scribe does not participate in the discussion.

## Session TODO

- [x] Define the player fantasy and core moment-to-moment gameplay loop.
- [x] Map the main UI surfaces and the player's attention flow between park,
  robot, trace, workbench, eval, and deployment views.
- [x] Establish the visual and interaction language, including information
  hierarchy, animation, alerts, and dinosaur-park personality.
- [x] Design the opening experience and progressive disclosure of complexity.
- [x] Make educational content diegetic through discovery, consequences,
  feedback, incident reports, and character behavior rather than lessons or
  quizzes.
- [x] Define the sources of fun: mastery, experimentation, humor, spectacle,
  progression, optimization, and recoverable failure.
- [x] Establish playability and accessibility criteria, then outline
  representative playtests.
- [x] Consolidate decisions into the application PRD that governs downstream
  feature PRDs.

## 1. Player fantasy and core gameplay loop

### Working player fantasy

The player builds an automated dinosaur park that remains safe, profitable,
and entertaining because the intelligent systems they engineered can handle
routine operations without constant intervention.

The park is the emotional center of the game. Engineering interfaces provide
leverage and understanding; the living park provides desire, tension,
spectacle, personality, and consequences.

### Working gameplay loop

1. Encounter an operational situation in the park.
2. Choose, configure, or revise the automation responsible for it.
3. Commit the change.
4. Watch the deterministic operation unfold in the park.
5. Experience a success, inefficiency, or incident.
6. Investigate surprising behavior through structured evidence.
7. Improve and verify the responsible artifact.
8. Return the capability to production and take on greater complexity.

The intended emotional rhythm is confidence, surprise, curiosity, diagnosis,
insight, mastery, and then greater complexity.

### Experience principles

- Park first, engineering second.
- The world presents a reason to investigate before a trace is shown.
- Players learn through prediction, commitment, consequence, explanation, and
  revision.
- The game shows what a design caused rather than labeling an answer correct or
  incorrect.
- Successful but inefficient solutions are valid and create optimization
  opportunities.
- Routine deterministic execution must support acceleration, interruption, and
  replay so that observation does not become dead time.
- Park, job, robot, action, and evidence views should form a connected path of
  investigation rather than separate administrative screens.

### Diegetic communication

- Prefer visual world cues over explanatory text for common park state and
  operational needs.
- Example need cues include a hungry dinosaur thinking about food and a gate
  visibly producing sparks when it has an electrical fault.
- Approaching visitors should be visible in the distance and move toward the
  park at a predictable pace, turning time pressure into observable world
  state.
- Park-wide announcements at meaningful intervals before opening provide a
  redundant, accessible sense of time when approaching visitors are off-screen.
- Motion, symbols, sound, and environmental changes should communicate intent,
  urgency, and consequence before detailed text is required.
- Important state cannot depend on a visual cue alone; equivalent accessible
  presentation will be designed later.

#### Proposed cue hierarchy

Use three levels of communication rather than replacing all UI with world
animation:

1. **Ambient world state:** Visitors approaching, a dinosaur pacing, a gate
   flickering, weather changing, or a robot following a visible route.
2. **Attention cue:** A brief thought bubble, spark, sound, edge indicator, or
   concise announcement draws attention to a meaningful change.
3. **Inspection detail:** Selecting the object reveals exact state, provenance,
   timing, and relevant engineering evidence.

Common cues need a consistent visual grammar. A symbol, color, or animation
should not change meaning between the park and engineering views. Thought
bubbles should represent immediate needs or intent rather than becoming
permanent status panels floating over every entity.

Diegetic cues communicate state, not the solution. A hungry dinosaur may clearly
want food, and a damaged gate may clearly be unreliable, but the game should
not use those cues to prescribe which instruction or artifact the player must
choose.

Time pressure should also be redundantly communicated. Approaching visitors,
lighting changes, park activity, and scheduled announcements create an embodied
sense of time; a compact accessible time reference remains available when those
cues are off-screen, inaudible, or visually difficult to perceive.

### Motivators and consequences

- Park rating and money are the proposed primary player-facing motivators.
- Park rating affects visitor demand; visitor volume affects revenue.
- Serious safety failures, including visitor deaths, reduce park rating, which
  reduces future attendance and revenue.
- The economic model should make reliable engineering valuable without making
  experimentation prohibitively dangerous.
- The relationship between incident severity, rating loss, visitor demand, and
  recovery remains to be designed.

#### Current panel recommendation

Keep money and park rating as the two headline motivators. To preserve
explainability, the single park rating may expose contributing factors when
inspected, such as safety record, guest experience, and dinosaur welfare. These
are diagnostic causes of the rating rather than additional headline currencies.

Safety failures should affect more than a small, recoverable amount of revenue.
A severe incident may cap the current rating, close part or all of the park,
trigger recovery work, and reduce future attendance. This prevents a strategy
of treating visitor casualties as a profitable operating expense while keeping
the overall motivation legible.

### Tone and text budget

- Humor should come primarily from animation, juxtaposition, environmental
  reactions, concise announcements, and short incident summaries.
- Humor must not obscure the causal information needed to diagnose a system.
- Players should not be forced through walls of flavor text.
- Detailed written information should be available when the player deliberately
  investigates, not imposed during routine park operation.

#### Proposed humor delivery

Use a three-layer pattern:

1. An immediate visual or auditory gag communicates the event.
2. An optional one-line caption or announcement adds personality.
3. A detailed incident report and trace are available only when investigated.

Humor should target robot literalism, park bureaucracy, dinosaur behavior,
mascots, property damage, and near misses. Actual injury or death should retain
weight; jokes should not make victims the punchline or obscure the seriousness
of the engineering failure.

#### Visitor casualty decision

Visitor injuries and deaths are part of the game's fiction. A dangerous
dinosaur park should produce credible stakes, and players in the intended
audience are expected to accept casualties as possible outcomes.

Casualties must remain attributable to deterministic world state and system
behavior. They are operational consequences that the player can investigate,
learn from, and engineer against rather than arbitrary spectacle. Fatalities
may contribute to the game's darkly comic setting, but individual victims are
not treated as punchlines and diagnostic information is never sacrificed for a
joke.

The exact presentation, severity scale, economic consequences, and recovery
mechanics remain to be designed.

### First prototype learning test

A representative player should be able to:

1. Understand a visible park need.
2. Choose an automation approach.
3. Anticipate the likely behavior.
4. Observe an unexpected but fair outcome.
5. Locate the missing or incorrect input.
6. Revise the system.
7. Rerun the exact situation.
8. Recognize why the revision worked.

The initial target is to complete this loop in approximately five minutes
without facilitator explanation.

### Downstream tuning questions

- How much information can thought bubbles and status symbols convey before the
  park becomes visually noisy?
- When should the first serious casualty incident become possible?
- What rating-loss and demonstrated-recovery curves create meaningful stakes
  without a punishment spiral?

## 2. UI surfaces and attention flow

### Working navigation model

The interface should support one connected path:

**Park -> operational event -> job -> robot action -> evidence -> responsible
artifact -> eval/replay -> review and deployment -> park**

The player should not have to reconstruct this relationship across unrelated
administrative screens. Selecting an event or entity should preserve its
identity and causal connections as the player moves into deeper inspection.

### Proposed primary surfaces

1. **Park View:** The default emotional and operational home. It presents the
   living simulation, world cues, approaching visitors, robot activity, alerts,
   rating, money, and time controls.
2. **Contextual Inspector:** A docked or overlaid view for a selected dinosaur,
   gate, visitor group, robot, job, or alert. It provides concise exact state
   without immediately leaving the park.
3. **Engineering Workbench:** A focused surface for inspecting diffs, context
   and dependency deltas, authored clauses, expected behavior, and artifact
   versions.
4. **Eval and Incident Replay:** A clearly labeled simulation environment for
   selecting deterministic scenarios, watching execution, and tracing outcomes
   without confusing eval state with the live park.
5. **Review and Deployment:** The intentional decision point for evaluating
   results and deploying, retaining, revising, or reverting an exact artifact
   version.

These may be modes or layers of a smaller number of screens; they are distinct
player purposes, not yet a commitment to five separate pages.

### Initial interaction principles

- Preserve a direct return path to the park and the originating event.
- Use progressive disclosure: visible consequence first, concise exact state
  second, detailed trace and provenance on deliberate inspection.
- Clearly distinguish live production, paused production, and deterministic
  eval/replay through more than color alone.
- Use familiar, canonical AI-engineering terms in focused engineering views.
  Diegetic personality should frame those concepts, not rename them into
  obscurity.
- Time controls should make the game about engineering judgment rather than
  reflex speed. The current panel recommendation is to provide pause and speed
  controls while deriving difficulty from system complexity and concurrent
  consequences.
- Opening a deep engineering task should not leave the player uncertain about
  whether live park time is advancing.

### Time and mode decision

- Park View and the Contextual Inspector preserve the player's selected
  simulation speed.
- Entering the Engineering Workbench, Eval and Incident Replay, or Review and
  Deployment pauses live production by default.
- Focused modes display a persistent, unmistakable production-paused indicator.
- The design may later offer an explicit player preference for continuous
  operation, but continuous operation is not the default.
- Production, paused production, deterministic eval, and historical replay use
  distinct framing, motion, labels, and sound. Color may reinforce the
  distinction but cannot carry it alone.

### Focused-mode operational anchor

Focused engineering modes retain a thin, consistent operations strip rather
than a live miniature park. It contains only information needed to maintain
orientation:

- production state and current park time,
- park rating and money,
- unresolved emergency count,
- the selected artifact version, and
- a causal breadcrumb back to the originating park entity, job, or incident.

The originating event may also retain a frozen thumbnail or concise state
summary. Routine animations and non-critical activity remain out of view so
that focused engineering work is genuinely focused.

### Alert hierarchy

1. **Ambient condition:** Communicated in the world and through entity state;
   it does not create a notification merely because it exists.
2. **Operational warning:** Added non-disruptively to a prioritized incident
   queue and linked to the affected world entities.
3. **Emergency:** Creates a concise interrupt, spatially identifies the affected
   area, and pauses production by default. Auto-pause remains configurable for
   players who deliberately want continuous operation.

Correlated symptoms should be grouped into one evolving incident. A gate fault,
robot retry, containment warning, and nearby visitor risk should not become four
unrelated notifications when they share one causal event.

Later progression may intentionally create more coordination pressure, but the
interface should expose a meaningful routing and escalation problem rather than
manufacture difficulty through notification spam.

### Eval and replay distinction decision

Eval and replay preserve the same entities, symbols, spatial relationships, and
state semantics as production. Their status is distinguished through persistent
framing rather than a wholly different visual language:

- explicit **SIMULATION** or **HISTORICAL REPLAY** identification,
- scenario and pinned artifact-version labels,
- replay controls and timeline,
- a visible boundary around the instantiated scenario,
- different ambient motion and sound, and
- explicit confirmation that production rating and revenue cannot change.

This closes the remaining UI-surface and attention-flow questions for the
current planning pass.

## 3. Visual and interaction language

### Goals

- Make the park feel alive, appealing, and slightly dangerous rather than like
  an enterprise dashboard with dinosaur decoration.
- Make important world state readable at a glance while reserving precise
  technical detail for deliberate inspection.
- Give the park and engineering surfaces a shared visual grammar so that
  concepts transfer across views.
- Preserve clarity as the park grows from a few entities to many simultaneous
  operations.
- Support humor through motion, behavior, timing, and juxtaposition without
  depending on large amounts of text.

### Questions for discussion

- What is the overall art-direction fantasy and tone?
- Which visual properties communicate need, intent, risk, provenance, and
  severity?
- How should robots and dinosaurs express personality without obscuring system
  state?
- What interaction patterns should be consistent across the park and focused
  engineering modes?
- How should density, zoom, and prioritization evolve as the park scales?

### Art-direction decision

Use a stylized three-quarter management-sim presentation with a tone of
**competent absurdity**. The park is colorful, inviting, tactile, and slightly
retro-futuristic, but it remains a credible operation containing genuinely
dangerous animals. Robots are earnest machines whose visible behavior follows
their instructions; dinosaurs behave as animals rather than comedians. Humor
emerges from the collision of those systems.

Potential influences for the visual vocabulary include national-park signage,
industrial safety markings, optimistic visitor-attraction design, physical
control panels, and clean modern developer tools. Avoid both a sterile dark IDE
covering most of the game and a childish cartoon treatment that removes the
stakes.

Occlusion of gates, visitors, robots, or hazards must be handled through camera
behavior, cutaways, transparency, or alternate views.

### Screen-language decision

- Use a stable three-quarter camera orientation for the initial implementation,
  with pan, zoom, focus-on-event, and intelligent occlusion handling. Do not
  require camera rotation to understand an incident.
- Favor a stylized 2.5D presentation over photorealism. This supports readable
  silhouettes, deterministic animation, browser performance, and expressive
  systemic humor without deciding the exact rendering technique yet.
- Use natural park colors such as foliage, earth, water, and warm attraction
  materials as the base. Reserve stronger operational colors for selection,
  degraded state, warning, and emergency communication.
- Pair an approachable, highly legible interface typeface with monospace text
  only where exact artifacts, clauses, versions, traces, or diffs benefit from
  it. Do not make the entire park interface resemble a code editor.
- Use softer, rounded shapes for needs and ordinary operations; more angular,
  bounded shapes for hazards and containment; and stable badge silhouettes for
  provenance categories.
- Selecting an entity gives it a clear outline, reduces irrelevant local
  motion, reveals only its immediate intent and route, and opens a concise
  inspector. Additional engineering detail remains an explicit deeper action.
- Avoid essential hover-only interactions. Selection, inspection, and camera
  navigation must support pointer, keyboard, and other accessible input paths.

### Semantic visual grammar

- **Needs:** Brief, soft attention cues such as thought icons, body language,
  feeder state, and local environmental changes.
- **Intent:** On selection, show the robot's current objective, next action, and
  planned route without exposing hidden reasoning.
- **Risk:** Use location, boundary treatments, symbols, motion cadence, and
  sound in addition to color. Risk becomes more visually insistent as severity
  rises.
- **Provenance:** Give tasks, policies, Skills, observations, memories, tools,
  and manager instructions stable icons or shapes that recur in Park View,
  traces, context inspection, and the Workbench.
- **Outcome:** Make world changes visible first, then connect them to concise
  status and structured evidence on inspection.

No semantic category or severity level depends on color alone.

### Personality and motion

- Give dinosaur species recognizable silhouettes and readable behavior states
  before adding decorative personality animation.
- Communicate robot state through posture, facing, route, carried tool, action
  staging, and concise status symbols.
- Use animation timing and environmental reactions for humor instead of modal
  jokes or long dialogue.
- Reduce ambient motion around an active incident or selected entity so that
  diagnostic motion remains legible.
- Keep casualties consequential even when the surrounding park fiction is
  darkly comic.

### Scaling and accessibility

- Use semantic zoom: distant views show aggregated conditions and affected
  areas; closer views reveal entities, needs, intent, and exact local state.
- Suppress resolved, routine, and low-priority cues as density increases.
- Group related activity spatially and causally rather than stacking icons over
  every entity.
- Provide reduced-motion, screen-shake, flashing, sound-substitution, text-size,
  and color-contrast support.
- Make selection and focused engineering workflows operable without requiring
  precise pointer movement or rapid reaction.

The visual and interaction language is accepted for the current planning pass.

## 4. Opening experience and progressive disclosure

### Goals

- Establish the fantasy of operating an automated dinosaur park immediately.
- Let the player perform a meaningful action before presenting substantial
  explanation or technical terminology.
- Produce an early success so that the player understands the basic interaction
  and trusts the deterministic world.
- Follow success with an authentic, recoverable surprise that reveals the need
  to investigate and improve the system.
- Complete the first observe, diagnose, revise, verify, and redeploy loop without
  a lecture or facilitator.
- Introduce advanced concepts only when an experienced problem creates demand
  for them.

### Opening sequence decision

#### First minute: operate the park

- Open at dawn on the closed park rather than on a title-card tutorial or
  Workbench screen.
- An approaching visitor convoy and concise park announcement establish the
  opening deadline.
- One dinosaur expresses a clear need through body language and a temporary
  food cue.
- The camera and selection treatment naturally direct attention to the
  dinosaur, its enclosure, and the available robot.
- The player assigns or configures a simple feeding job and watches it succeed.

#### Minutes one through five: encounter a meaningful difference

- Present a similar feeding need in an enclosure with one relevant changed
  condition, such as an automatic gate closer disabled for maintenance.
- Make the changed world condition observable, but do not automatically include
  it in the worker's available context or prescribe the solution.
- Reusing the earlier instruction produces a deterministic, recoverable near
  miss rather than an onboarding fatality.
- The dinosaur may leave containment or approach an empty guest area before the
  park opens, creating urgency and spectacle without ending the session.
- Selecting the incident follows the established path from visible consequence
  to job, action, unavailable evidence, and responsible artifact.

#### First engineering loop

- The game exposes only the minimum Workbench concepts required to correct the
  diagnosed context or instruction problem.
- The player revises the responsible artifact, reruns the exact deterministic
  situation in a clearly labeled simulation, and sees why the revision works.
- Review and deployment return the improved behavior to the park.
- The park opens successfully, translating engineering success into rating,
  visitors, revenue, and a visibly calmer operation.

### Progressive-disclosure principle

Use **problem before tool** progression. A concept becomes available when the
player has experienced the pressure it resolves:

- repeated directions create demand for reusable Skills,
- missed information creates demand for context inspection and routing,
- uncertain changes create demand for evals,
- stale or conflicting state creates demand for memory and provenance,
- simultaneous jobs create demand for additional worker agents, and
- coordination overload creates demand for Manager Agents and orchestration.

The game may foreshadow unavailable capabilities, but it should not teach their
interfaces before the player has a reason to value them.

### Opening interaction decisions

- The first feeding job is partially configured. The player recognizes the
  need, selects the available robot, and assigns the instruction without first
  learning an artifact editor.
- Guidance is action-skippable. Experienced players bypass prompts by acting;
  assistance escalates from world cues to affordance emphasis, a concise hint,
  and finally explicit help only when needed.
- The second feeding situation has an automatic gate closer disabled for
  maintenance. That condition is visible in the world but absent from the
  worker's available context, creating the first authentic near miss.
- The first eval is introduced after the near miss and before the player's
  revised artifact is deployed. One relevant deterministic eval case is
  provided without cost for this introduction.
- Opening time pressure remains pausable, and neither speed nor use of guidance
  changes permanent rewards or starting resources.

The opening experience and progressive-disclosure approach are accepted for the
current planning pass.

## 5. Diegetic educational presentation

### Goals

- Make players encounter and use AI-engineering concepts as solutions to park
  problems rather than as curriculum chapters.
- Preserve canonical terms such as Prompt, Skill, System Prompt, context,
  memory, eval, trace, artifact version, deployment, Worker Agent, Manager Agent,
  and orchestration.
- Explain causality precisely without exposing hidden chain-of-thought.
- Keep routine play concise while making deeper technical detail available on
  deliberate inspection.
- Reward understanding through local mastery, visible park improvement, and
  expressive rewards rather than quiz scores or educational badges, while
  continuing to increase the overall challenge as the park grows.

### Educational rhythm decision

Use **experience -> inspect -> name -> apply -> reuse**:

1. The player experiences a visible system consequence.
2. Inspection exposes the relevant state, available context, applicable
   clauses, actions, evidence, and unavailable information.
3. The interface names the engineering concept when it becomes useful.
4. The player applies that concept to improve the system.
5. Later situations reuse the same term and visual grammar without reteaching
   it from the beginning.

The game does not announce that a lesson has begun or award points for recalling
a definition.

### Information layers decision

1. **World consequence:** Animation, sound, spatial change, and concise status
   communicate what happened.
2. **Operational explanation:** A short incident summary states expected versus
   observed behavior and identifies the immediate causal gap.
3. **Engineering evidence:** Optional inspection exposes context provenance,
   applicable clauses, tool calls, state transitions, versions, and eval output.
4. **Reference depth:** A searchable Engineering Handbook defines canonical
   terms and preserves previously encountered examples for players who want
   review.

Detailed evidence is available, not compulsory. A player should be able to
resume park operation after understanding the operational explanation, while a
player who wants mastery can follow the evidence further.

### Terminology and tone decision

- Use a diegetic wrapper with an explicit technical core. The park may have an
  Engineering Workbench, but it calls context **context** and an eval an
  **eval** rather than replacing them with cute fictional synonyms.
- Introduce one unfamiliar term at the moment its tool or distinction becomes
  useful, then use it consistently.
- Park Developer communication is brief and tied to an actionable artifact,
  diff, eval result, or deployment decision. The Park Developer does not become
  a lecturer or a team-management simulation.
- Flavor text, announcements, and humor remain optional or brief. They frame an
  event but do not carry essential engineering information.

### Context-capacity visualization decision

Represent each robot's finite context with a segmented capacity gauge rather
than a power meter. The gauge should communicate quantity without implying that
more context always makes the robot more capable.

- Display both used and total capacity numerically, for example `7.4k / 10k`.
- Fill the gauge immediately, or preview a ghosted delta, when the player adds
  information to the assembled context.
- Segment the used area by stable provenance categories such as task, System
  Prompt, Skill, policy, retrieved state, and memory.
- Progress from ordinary to caution and critical treatments as remaining
  capacity becomes operationally constrained. Use labels, patterns, shape, and
  numbers in addition to green, yellow, and red.
- The current application-level invariant blocks overflow explicitly and shows
  the exact excess; it never silently truncates context. The panel is evaluating
  an explicit deterministic eviction mechanic as a possible refinement that
  would require an intentional specification decision.
- Present staleness, duplication, conflict, and low relevance as separate
  diagnostics. A mostly empty context can still be poor, while a nearly full
  context can still be intentionally well designed.
- Show context-cost and capacity deltas during artifact review so the player can
  connect architectural changes to operational consequences.

### Context overflow and eviction decision

Teach both hard capacity and information loss by separating context assembly
from an explicit retention policy:

1. The player attempts to add information beyond the context window.
2. The interface previews the overflow amount and the exact artifacts or
   history entries affected.
3. A configured policy either blocks execution or deterministically evicts or
   compacts information until the context fits.
4. Eviction is shown through a brief physical animation and recorded in the
   context manifest and trace.
5. The job may then proceed with the retained context, allowing missing
   information to produce a fair, replayable behavioral consequence.

Potential policies include:

- **Strict:** Block the job until the player reduces context.
- **Keep newest:** Evict the oldest unpinned entries first.
- **Keep priority:** Evict the lowest-priority unpinned entries first.
- **Compact history:** Replace eligible history with a smaller deterministic
  summary artifact, preserving provenance and recording lost detail.

Dropping the oldest information is therefore one visible policy rather than a
false claim that every real context window behaves that way. Pinned System
Prompts or safety policies may be protected according to explicit rules, but
pinning them still consumes capacity.

The visual treatment should use both communication paths:

- Before execution, a bounded tray or gauge shows new material pushing affected
  segments into an **Excluded** area. The first occurrence may use a memorable
  comic physical animation, but exact labels remain readable.
- After execution, the trace states which material was excluded, by which
  policy, and which actions lacked that information. Misbehavior remains a
  consequence the player can observe and diagnose.

Overflow does not always cause failure. Evicting irrelevant history can be the
correct engineering decision; evicting a still-relevant instruction can create
an incident. The mechanic should teach deliberate retention, not merely keeping
the capacity gauge green.

#### Specification impact

The current application invariant requires overflow to block. Allowing a job to
continue after deterministic, visible eviction would refine that invariant and
must be recorded deliberately in the owning PRD before implementation. Silent
truncation remains prohibited in either design.

### Runtime context lifecycle decision

Context continues to grow while a robot operates. The simulation models this as
a sequence of explicit decision cycles rather than a continuously changing
hidden mind:

1. Assemble the robot's current context snapshot.
2. Select and execute an allowed action.
3. Add resulting observations, tool results, messages, and relevant task
   history.
4. Before the next decision, calculate the new context requirement.
5. If it exceeds capacity, apply the configured Retention Policy.
6. Assemble the retained context snapshot and continue, stop, or escalate
   according to the policy outcome.

Potential runtime growth sources include world observations, tool results,
inter-agent messages, task progress, retrieved memory, incident evidence, and
new instructions. Each addition has a deterministic capacity cost and visible
provenance.

The selected robot's context gauge updates between decision cycles. A fleet-level
view shows only normal, constrained, or critical context pressure so the park is
not covered with meters. Exact before-retention and after-retention snapshots
remain available in the trace.

### Upgradeable Retention Policies decision

Retention progression unlocks additional strategies and configuration rather
than a universally superior policy:

1. **Strict / Halt and Signal:** Refuse to assemble an over-capacity context and
   stop before the next decision. The deterministic host reports a context
   capacity fault to Park Operations without asking the stopped agent to reason
   or manufacture an escalation from unavailable context. The robot's physical
   situation may still be unsafe.
2. **Keep Newest:** Evict the oldest unpinned entries. This maintains activity
   but can remove longstanding instructions or early evidence.
3. **Priority Retention:** Protect explicitly pinned or higher-priority
   categories and evict lower-priority material first. Poor priorities can
   preserve the wrong information.
4. **Compact History:** Replace eligible history with smaller deterministic
   summary artifacts. This preserves broad facts while losing recorded detail.
5. **Externalize and Retrieve:** Store eligible information in versioned memory
   and retrieve it when relevant instead of carrying it in every context. This
   reduces routine load while introducing retrieval, staleness, and provenance
   risks.

#### Rejected alternative: emergency context reserve

Do not create hidden or specially reserved context capacity that allows the
robot to escape a full context window. That would weaken the lesson that context
limits are real. When Strict handling stops a robot, recovery comes from an
external system rather than secretly extending the failed agent's capability.

Upgrades therefore increase the player's available architectural choices, not
merely the robot's power. Strict handling remains useful for high-risk jobs;
rolling retention may suit long-running routine work; retrieval may suit large,
specialized systems. Context-window capacity upgrades remain possible but do
not eliminate the need for deliberate routing and retention.

### Runtime overflow presentation decision

- During normal operation, additions briefly animate into the selected robot's
  segmented gauge at decision boundaries.
- Approaching the configured limit changes the gauge's treatment and creates a
  concise context-pressure state, not a full-screen interruption.
- When retention activates, affected segments visibly move to Excluded,
  Compacted, or Externalized destinations according to the policy.
- If Strict handling stops a robot, its world animation, status, incident, and
  escalation make the operational consequence visible.
- If the robot continues after eviction, the player observes its resulting
  behavior before optionally investigating what information was unavailable.
- All retention events are replayable and identify the policy, removed or
  transformed content, capacity change, and downstream actions.

### External Incident Response Team decision

The park has an abstracted Incident Response Team that the player can
activate when ordinary automation has failed or stopped. It is external to the
robot and does not borrow, extend, or rewrite the robot's context.

1. A deterministic park-level monitor reports a context capacity fault or other
   qualifying emergency.
2. Production pauses according to the accepted emergency-alert behavior.
3. The incident card identifies the affected location, immediate risk, response
   cost, estimated arrival time, and available response actions.
4. The player may activate the Incident Response Team to evacuate visitors,
   establish containment, recover a stranded robot, or otherwise stabilize the
   world using explicit deterministic capabilities.
5. Stabilization does not repair the responsible Prompt, Skill, context route,
   Retention Policy, or deployment. The underlying engineering fault remains
   available for incident review and must be corrected separately.

The Incident Response Team is a safety net, not an optimal operating strategy.
Calling it may create a direct response cost, affected-area closure, downtime,
lost revenue, and rating consequences arising from the incident. Once lives are
at risk, activating the service should still be economically and operationally
better than allowing preventable casualties; the economy should not reward the
player for refusing rescue to avoid a callout fee.

Later progression may allow an explicit escalation policy to authorize a Worker
or Manager Agent to summon the Incident Response Team automatically. That
policy carries visible authority and cost. The team remains a park capability
rather than a staff hiring or team-management simulation.

### Difficulty and reward decision

Good performance makes a solved local problem require less attention; it does
not make the overall game progressively easier. The park uses the attention and
capacity the player earned to introduce greater scale, concurrency, novel
conditions, and coordination pressure.

Expressive rewards supplement rating and revenue without compounding mechanical
advantage. Examples include new gift-shop plushies, visitor merchandise,
decorations, signage, and other visible park personalization. These rewards can
appear in visitor behavior and the environment, but should not create a
rich-get-richer difficulty collapse through large stat bonuses.

### Engineering Handbook theming decision

The optional player reference is the **Engineering Handbook**, distinct from
versioned operational policies and procedures that may enter agent context.
The player was hired after the previous engineer experienced an ambiguously
described incident with local wildlife. Teeth marks on one corner of the
Handbook provide concise environmental humor and establish the park's danger.
Damage remains decorative and never obscures reference content or controls.
Institutional understatement is the target of the joke, not the casualty.

### Open questions

- What response-time, access, and capability limits keep the Incident Response
  Team useful without making prevention irrelevant?

### Educational presentation closure

- The initial incident view shows expected behavior, observed behavior,
  consequence, and the immediate causal gap. Full structured evidence is an
  explicit deeper action.
- The game may summarize demonstrated engineering changes in concrete
  operational language, but it does not announce abstract lesson completion.
- Strict capacity handling is introduced first. Keep Newest follows shortly;
  Priority Retention follows with broader context-routing pressure; compaction
  and retrieval arrive with memory engineering.
- The accepted educational presentation remains experience, inspect, name,
  apply, and reuse, with operational leverage and expressive park rewards
  replacing grades.

The diegetic educational-presentation approach is accepted for the current
planning pass. Detailed Incident Response tuning remains downstream design work.

## 6. Fun, mastery, failure, and progression

### Goals

- Make the park enjoyable even for a player who is not consciously pursuing an
  educational outcome.
- Make successful automation pleasurable to watch, not merely the absence of a
  penalty.
- Alternate pressure with periods of visible mastery and recovery.
- Make failures fair, attributable, spectacular, and recoverable at a cost.
- Increase overall challenge through scale and systems complexity rather than
  reflex demands or arbitrary stat inflation.
- Give players expressive reasons to care about their particular park.

### Fun pillars decision

1. **Living park spectacle:** Dinosaurs, robots, visitors, weather, attractions,
   and emergencies create an entertaining world to observe.
2. **Systems mastery:** A formerly fragile operation becomes calm and reliable
   because of an engineering change the player understands.
3. **Controlled chaos:** Interacting systems produce surprising but
   deterministic incidents that are enjoyable to diagnose and recover from.
4. **Automation leverage:** Better abstractions let the player manage more park
   with fewer direct interventions.
5. **Expansion and discovery:** New species, enclosures, tools, conditions, and
   agent arrangements create qualitatively new problems.
6. **Expression and collection:** Plushies, decorations, signage, robot
   cosmetics, and park memorabilia visibly personalize success.

### Difficulty rhythm decision

Use a repeating cadence:

**introduce pressure -> struggle -> diagnose -> engineer -> stabilize -> enjoy
mastery -> choose expansion -> encounter a new systems problem**

The game should allow a stable park to remain stable long enough for the player
to enjoy what they built. Expansion is primarily player-initiated after rating,
revenue, safety, or engineering prerequisites are met; an unlock creates an
opportunity rather than automatically adding another emergency.

Difficulty grows through:

- more simultaneous work,
- greater species and enclosure diversity,
- longer-running jobs and context accumulation,
- partial, stale, or conflicting information,
- shared resources and cross-agent interference,
- broader eval-selection and deployment risk, and
- delegation, escalation, and reporting complexity.

### Park-day cadence decision

1. **Pre-opening:** Observe needs, review scheduled work and relevant changes,
   and intentionally deploy any prepared artifact versions.
2. **Open operation:** Watch the living park, respond to meaningful exceptions,
   and inspect incidents as desired. Focused engineering remains available and
   pauses production according to the accepted time rules.
3. **Closing:** Visitors depart, lighting and activity settle, and the game
   presents a concise operational outcome rather than a long report.
4. **Engineering and expansion:** Review selected incidents, run evals, collect
   completed work, purchase or place expressive rewards, and decide whether to
   expand before beginning another day.

The cadence should create a natural “one more day” stopping and continuation
point. Later scenarios may add night operations or overlapping schedules, but
they should do so as explicit new complexity rather than erasing the player's
understanding of time.

### Failure and recovery decision

- Minor failures create humor, inefficiency, or property damage.
- Serious failures create injury risk, casualties, closures, rating loss, and
  recovery cost.
- Catastrophic outcomes remain deterministic and explainable; the player can
  inspect the exact system behavior that produced them.
- Safe eval environments make experimentation affordable, while untested
  production deployment remains meaningfully risky.
- Recovery requires stabilizing the world and addressing the engineering cause.
  Waiting out a timer alone does not restore trust.
- The economy avoids unrecoverable punishment spirals while preserving the
  possibility of genuine loss if the player repeatedly ignores systemic risk.

### Ultimate loss condition decision

Use **Operating License Suspended** as the main game's catastrophic failure
state rather than permanently deleting the park through bankruptcy or license
revocation.

A severe casualty event, repeated unresolved safety failures, or financial
collapse may trigger suspension:

1. The park closes and live revenue stops.
2. The Incident Response Team stabilizes any active danger.
3. The game preserves the park layout, unlocked capabilities, exact artifact
   versions, traces, eval assets, Engineering Handbook history, and expressive
   collectibles.
4. A recovery review identifies the incidents and deployed versions associated
   with the suspension without fabricating hidden reasoning.
5. The player revises or reverts the responsible artifacts, selects and passes
   mandated safety evals, and intentionally submits a reopening deployment.
6. The park reopens under reduced rating, visitor demand, and possibly temporary
   operational restrictions. Demonstrated safe operation restores trust.

Recovery is active engineering work, not a timer. Reduced attendance after
reopening lowers revenue but also reduces immediate operational pressure,
creating a manageable comeback rather than a punishment spiral.

If the player lacks funds required for recovery, provide restricted recovery
resources that can be used only for stabilization, required evals, and a
compliant reopening deployment. The assistance may impose a loan, rating cap,
or operating restriction, but it prevents an unrecoverable save.

Bounded challenge scenarios may define explicit failure and retry conditions.
A future optional high-stakes mode could allow bankruptcy or permanent license
revocation, but permanent loss should not govern the primary educational game.

The fun, mastery, failure, and progression model is accepted for the current
planning pass. Remaining frequency and economy values are balancing work rather
than unresolved experience direction.

### Expansion responsibility decision

Permanent expansion is player-initiated. Contracts and events may offer
temporary responsibilities or constraints, but accepting a new lasting species,
enclosure, or operating area remains an intentional player decision. Unexpected
conditions may affect responsibilities the player already accepted; they do not
silently expand the park's permanent scope.

### Downstream balancing questions

- How frequently should incidents occur after the player has engineered a
  reliable system?
- Which expressive rewards best reinforce attachment without becoming another
  optimization economy?

## 7. Playability, accessibility, and playtesting

### Goals

- Test observable player behavior rather than relying only on stated preference.
- Verify that the opening teaches through play without facilitator explanation.
- Confirm that deterministic failures feel attributable rather than artificial.
- Validate information hierarchy at both opening and late-game density.
- Confirm that accessibility alternatives preserve information and gameplay.
- Determine whether stable operation, incident diagnosis, and expansion create
  genuine desire to continue playing.

### Participant perspectives - panel proposal

Recruit across overlapping perspectives rather than treating professional
developers as one uniform audience:

- professional developers with little agent experience,
- developers who regularly use coding agents,
- management-simulation players,
- developers who rarely play management games, and
- participants who use relevant visual, auditory, motor, cognitive, or
  motion-sensitivity accessibility features.

Individual participants may represent more than one group.

### Initial playtest sequence - panel proposal

1. **First-look comprehension:** Show the opening park without explanation and
   observe what players notice, click, and believe is urgent.
2. **First five-minute loop:** Test the hungry dinosaur, successful feeding,
   changed gate condition, near miss, diagnosis, eval, and redeployment.
3. **Context-capacity test:** Add runtime information until retention activates;
   observe whether players understand what was retained, excluded, or compacted
   and can connect that to behavior.
4. **Transfer test:** Present a new species, enclosure, and surface situation
   that contains the same underlying missing-context or retention problem, with
   no repeated guidance. Observe whether the player applies the concept rather
   than reproducing memorized clicks.
5. **Incident-recovery test:** Halt a robot in a hazardous location, activate
   the Incident Response Team, and verify that players distinguish world
   stabilization from engineering correction.
6. **Density test:** Present a mature park with simultaneous operations and
   verify semantic zoom, cue suppression, incident grouping, and navigation.
7. **Mastery test:** Let a corrected system operate reliably and observe whether
   players enjoy watching it, understand the improvement, and voluntarily
   choose another day or expansion.

### Provisional behavioral success criteria - panel proposal

- Players perform a meaningful park action before encountering substantial
  mandatory text.
- Representative newcomers complete the opening engineering loop in roughly
  five minutes without facilitator explanation.
- Players can identify the changed world/context condition that caused the
  first near miss.
- Players can distinguish production, paused production, eval, and historical
  replay without relying on color alone.
- Players can predict or verify which information a Retention Policy removes and
  connect missing context to a downstream action.
- Players understand that Incident Response stabilizes the park but does not fix
  the deployed artifact.
- Experienced agent users consider failures technically credible and
  deterministic rather than manufactured by an artificially stupid robot.
- Players can locate critical state and exact evidence at both low and high park
  density.
- Accessibility-feature users receive equivalent state, urgency, provenance,
  and consequence information.
- Stable operation produces visible satisfaction and a meaningful desire to
  expand rather than boredom or distrust.

### Accessibility baseline - panel proposal

- Pause and speed controls are always available during live park operation.
- Essential state never depends only on color, sound, animation, transient
  timing, hover, or precise pointer movement.
- Announcements and transient cues enter a persistent accessible history.
- UI text supports scaling and reflow without hiding controls or evidence.
- Reduced-motion, screen-shake, flashing, contrast, and sound-substitution
  options preserve semantic information.
- Park navigation, entity selection, incident inspection, Workbench review,
  eval selection, and deployment are keyboard operable.
- Time pressure and tutorial assistance do not alter permanent rewards.

### Downstream validation parameters

- Which criteria should become numeric MVP acceptance thresholds after the
  first baseline tests?
- How long should one park day last for new and experienced players?
- Which consented, minimal event instrumentation is sufficient for each test
  without recording authored text or invasive input streams?
- Which late-game density represents the target upper bound for the initial
  release?

The playability, accessibility, and playtesting approach is accepted for the
current planning pass. Numeric thresholds are intentionally deferred until
baseline pilot data exists.

## 8. PRD handoff

The planning session has resolved the intended player fantasy, gameplay loop,
UI hierarchy, visual language, onboarding, educational presentation, context
capacity and retention mechanics, Incident Response, fun and failure model, and
validation approach.

### Completed specification reconciliation

The context-overflow decision intentionally refined the earlier rule that
overflow always blocks. Specs/application_PRD.md now states that overflow is
never silent: execution either blocks or applies an explicit deterministic
retention or compaction policy, and all excluded or transformed information
remains provenance-labeled and replayable.

### Deferred detailed design

The following do not block drafting the player-experience PRD:

- exact rating, revenue, response, and recovery values,
- incident-frequency curves,
- park-day duration,
- late-game density targets,
- exact expressive reward catalog,
- final accessibility acceptance thresholds, and
- final Incident Response timing and capability balance.

These require prototypes, baseline playtests, or owning feature specifications.
The PRD should identify them as testing or downstream design decisions rather
than inventing unsupported values.

The final session TODO is complete. Specs/application_PRD.md is the
application-level source of truth for downstream feature PRDs and implementation
PLANs.
