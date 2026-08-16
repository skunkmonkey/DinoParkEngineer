# Product Requirements Document

**Dino Park Engineer**

> A deterministic web-based game that teaches professional developers prompt engineering, context engineering, eval design, and agent orchestration by operating an automated dinosaur park.

| Field | Value |
| --- | --- |
| Document status | Draft v0.1 - implementation baseline |
| Primary audience | Product, design, game systems, frontend, simulation/backend, content tooling, QA, and AI coding agents |
| Target player | Professional software developers learning modern AI-agent engineering |
| Platform | Web application; desktop-first; responsive down to tablet-sized viewports |
| Core technical constraint | No runtime LLM is required for core gameplay; simulation and evals must be deterministic and replayable |
| Design principle | Teach through system consequences, inspection, and engineering workflow rather than lectures |

This PRD is intentionally explicit. A team or AI system should be able to decompose it into implementation work without access to the design conversation that produced it.

## Contents

- 1. Executive Summary
- 2. Product Vision and Design Pillars
- 3. Goals, Non-Goals, and Success Criteria
- 4. Audience and Learning Outcomes
- 5. Canonical Terminology
- 6. Core Game Loop
- 7. Game World and Simulation Model
- 8. Deterministic Prompt/Skill Execution Architecture
- 9. Context System
- 10. Prompts, Skills, System Prompts, Memory, and Tools
- 11. Park Developer Progression
- 12. Evals and Regression Testing
- 13. Code-Review and Deployment Workflow
- 14. Agents and Orchestration
- 15. Economy, Rewards, and Failure Costs
- 16. Player Progression and Curriculum
- 17. UX / Information Architecture
- 18. Content Model and Data Schemas
- 19. Deterministic Algorithms and Rules
- 20. Example End-to-End Scenario
- 21. Save State, Telemetry, and Analytics
- 22. Accessibility and Usability
- 23. Security and Abuse Considerations
- 24. MVP Scope and Post-MVP Roadmap
- 25. Acceptance Criteria
- 26. Implementation Decomposition
- 27. Open Design Questions and Defaults

## 1. Executive Summary

The game is a web-based deterministic simulation in which the player operates an increasingly complex dinosaur park through autonomous robots. The robots do not accept arbitrary real-time LLM instructions in the core game. Instead, the player equips and configures machine-readable Prompts, Skills, System Prompts, Tools, Memory, Context, Evals, and Manager Agents. Every artifact exposes human-readable prompt text so the player can inspect what good AI engineering looks like while the simulation remains deterministic.

At the beginning, the player has one worker robot and several dinosaurs. Routine operations such as feeding require safe sequencing: bait the dinosaur away from the gate, open the gate, enter, close the gate, feed the dinosaur, exit, secure the enclosure, verify containment, and escalate if containment fails. Early failures reveal gaps between intent and specification. As the park grows, direct micromanagement stops scaling. The player learns to replace repetitive prompts with reusable Skills, move invariant rules into System Prompts/policies, allocate Context intentionally, build and run Evals, add agents, and eventually use Manager Agents to orchestrate workers.

The fantasy is not "be the best prompt typist." The fantasy is "run an absurdly complicated dinosaur park because you know how to engineer reliable intelligent systems."

> North star: the player begins by controlling actions and gradually learns to control systems. The reward for good AI engineering is that the park becomes safer and more autonomous while demanding less direct attention.

## 2. Product Vision and Design Pillars

### 2.1 Vision

Create a game that professional developers voluntarily play for enjoyment, but that leaves them with transferable instincts for building agentic software: define intent precisely, separate reusable skills from task prompts, manage context as a scarce resource, test behavior with evals, inspect changes before deployment, and orchestrate multiple agents rather than micromanaging them.

### 2.2 Design Pillars

| Pillar | Requirement |
| --- | --- |
| Deterministic by default | The same world state + agent configuration + artifact versions + seed MUST produce the same actions and outcome. |
| Context is gameplay | Context load is visible, constrained, and economically meaningful. Players must decide what each agent needs to know. |
| AI terminology is explicit | Use industry terms such as Prompt, Skill, Context, Memory, Tool, Eval, Agent, Manager Agent, orchestration, and system prompt. |
| Teach through consequences | Do not pre-explain every lesson. Let players experience specification gaps, context bloat, stale context, missing eval coverage, and coordination failures, then inspect why. |
| Engineering workflow over prose typing | Core mastery is architecture, review, evaluation, and system design. Freeform prompt authoring is optional/post-MVP, not required for the core curriculum. |
| Trustworthy simulation | LLM randomness MUST NOT determine whether a safety-critical sequence succeeds. World state and rule execution must be inspectable. |
| Progressive abstraction | Progression moves from direct Prompt -> reusable Skill -> Context architecture -> multiple Agents -> Manager Agent orchestration. |
| Failure is educational, not punitive | Production failures should matter enough to motivate evals but not be so punishing that experimentation becomes irrational. |
| Park fantasy first | The default experience is operating a graphical dinosaur park. AI-engineering configuration and evidence appear in context when they help the player act, diagnose, or improve the system. |
| Canonical type, approachable instance | Preserve Prompt, Skill, System Prompt, Context, Memory, Tool, Eval, Agent, and orchestration terminology while giving artifacts and world entities memorable player-facing names. |
| Outcome before evidence | Major surfaces present observable outcome, then explanation, then exact technical evidence. Raw ids and manifests never compete with the current gameplay objective by default. |

## 3. Goals, Non-Goals, and Success Criteria

### 3.1 Product Goals

- Teach players to distinguish task prompts from reusable skills and persistent/system-level instructions.
- Make context composition visible so players learn to minimize irrelevant, duplicated, stale, or missing context.
- Teach that evals define expected behavior and should be selected based on risk, not simply maximized blindly.
- Teach regression discipline: change -> select eval suite -> run -> inspect failure -> revise -> deploy.
- Teach why multiple agents create coordination and context-sharing problems, and why manager/worker orchestration is useful.
- Provide deterministic, replayable incidents and eval failures that can be debugged from traces.
- Create enough park/economy pressure that engineering investments have understandable return on investment.
- Make prompt/skill source text available as worked examples without turning gameplay into a reading course.
- Make a first meaningful park action understandable without requiring the player to parse raw identifiers, provider diagnostics, or every advanced system.
- Preserve intentional late-game coordination pressure while removing accidental complexity caused by implementation-oriented presentation.

### 3.2 Non-Goals

- Not a freeform chatbot sandbox in the core implementation.
- Not a developer hiring/team-management simulator. The in-world Park Developer is a progression/workbench mechanism, not a roster-management subsystem.
- Not a realistic Jurassic biology simulation; dinosaurs exist to create understandable operational constraints and emergent incidents.
- Not a certification exam or tutorial sequence dominated by explanatory text.
- Not a game where longer prompts are always better. Advanced engineering must often produce shorter, more modular context with equal or higher reliability.
- Not a lesson that "AI replaces developers." The game should demonstrate that developer value moves upward toward skills, evals, context architecture, tools, and orchestration.

### 3.3 Success Criteria

| Dimension | Success signal |
| --- | --- |
| Learning transfer | Players can explain why a Skill should reference a shared policy rather than duplicate it; why an eval suite needs risk-based coverage; and why a manager agent needs explicit delegation/escalation rules. |
| Gameplay comprehension | Players can inspect any failed task and identify the missing, stale, conflicting, or unavailable context that caused it. |
| Determinism | Replay of a saved eval case under an unchanged build produces identical trace and outcome. |
| Progression | A successful late-game park requires substantially less player micromanagement than early game while handling more simultaneous operations. |
| Economy | Players have meaningful tradeoffs between immediate park expansion and engineering investments such as Skills, eval authoring, developer upgrades, and context capacity. |
| Technical independence | Core loop functions without external model tokens or network calls to an LLM provider. |

## 4. Audience and Learning Outcomes

### 4.1 Primary Audience

Professional software developers who understand basic programming and software delivery concepts but range from novice to experienced in prompt engineering, context engineering, agentic systems, and evals. The game may use developer-native metaphors such as code review, regression tests, versioning, traces, and deployment without extensive explanation.

### 4.2 Learning Outcomes

| Stage | Player should internalize |
| --- | --- |
| Prompting | Intent must be translated into explicit observable goals and postconditions; assumptions are not guaranteed context. |
| Skills | Repeated behavior belongs in reusable Skills, not duplicated task prompts. |
| System prompts / policy | Invariant behavioral constraints should be centralized and referenced, not copied into every task. |
| Context engineering | An agent needs relevant context, not all available context. Missing and excess context can both cause failure/cost. |
| Memory | Observations have freshness, scope, provenance, and retention. Old memory can be harmful. |
| Tools | Agent behavior is bounded by available tools and tool contracts. |
| Evals | A passing demo is not enough. Expected behaviors require repeatable eval cases and regression suites. |
| Deployment | Changes should be reviewed, evaluated, versioned, and deployed intentionally. |
| Multi-agent systems | Parallel agents increase throughput and coordination complexity. |
| Orchestration | Manager agents need authority, priorities, context routing, escalation rules, success criteria, and reporting contracts. |

## 5. Canonical Terminology

The following terms are normative for UI copy, code-domain models, content authoring, and documentation unless a section explicitly states otherwise.

Canonical terms describe the real AI-engineering category; they are not required to be the entire customer-facing name. Present an artifact as, for example, `SKILL · Carnivore Feeding · v3`, while retaining `skill.feed@3` as exact technical identity in advanced details, URLs, traces, and manifests. Park-world entities use approachable domain names such as `Rex Ridge Service Gate`; their stable ids remain inspectable but do not serve as ordinary labels. Display names and aliases MUST NOT drive runtime behavior.

| Term | Definition | Gameplay example |
| --- | --- | --- |
| Prompt | Task-specific instruction sent to an Agent for one job. | "Feed Rex before 10:00 and verify containment afterward." |
| Skill | Reusable instruction bundle/capability invoked by name or reference. | Carnivore Feeding Skill v3 |
| System Prompt | Persistent high-priority behavioral instruction set for an Agent or agent class. Park "policy" concepts may be implemented as system-prompt modules, but UI should surface the AI term. | Containment Safety System Prompt |
| Context | All information loaded for an Agent's current decision/task: Prompt, referenced Skills, system prompt modules, knowledge, memory, tool schemas, manager directives, and retrieved state. | 5.2k context loaded for a feed task |
| Context Budget | Maximum allowed context load for an Agent. | Worker Robot Mk I: 8.0k |
| Memory | Prior observations or task-derived state retained or retrieved for future tasks. | "Gate 3 sensor intermittently failed at 09:40." |
| Tool | A deterministic action interface an Agent may invoke. | open_gate(gate_id), dispense_food(feeder_id) |
| Eval | A deterministic scenario that asserts expected behavior/outcome for an artifact/configuration. | Gate fails during exit -> agent must secure area and escalate. |
| Eval Suite | Named reusable collection of evals. | Containment Safety Suite |
| Agent | Autonomous game actor configured with system prompt, Skills, context budget, memory access, and Tools. | Keeper Robot 1 |
| Manager Agent | Agent authorized to assign, coordinate, supervise, and escalate work across N worker Agents. | Habitat Operations Manager |
| Orchestration | Design of delegation, context routing, concurrency, escalation, and reporting among Agents. | Manager assigns feeding to keeper while security agent clears visitors. |
| Trace | Structured record of inputs, available context, decisions/selected clauses, tool calls, and resulting world-state changes. | Task replay showing Gate 3 maintenance status was not in context. |
| Deploy | Make a versioned Prompt/Skill/System Prompt/Agent configuration active in production park operations. | Deploy Carnivore Feeding Skill v4 |

## 6. Core Game Loop

### 6.1 Minute-to-Minute Loop

1. Observe park state, scheduled work, alerts, and agent workload.

2. Assign or approve jobs using a Prompt and selected Skill(s).

3. Inspect projected Context Load and dependencies before execution.

4. Run the park simulation; agents execute deterministic clauses through Tools.

5. Observe success, partial success, or incident.

6. Inspect the Trace when behavior is surprising or unsafe.

7. Commission/review improved Prompts, Skills, System Prompts, evals, or agent configuration through the Park Developer workbench.

8. Select Evals, run them in simulation, review outcomes, then deploy changes.

9. Earn credits from safe, efficient, satisfying park operation; reinvest in park capacity and engineering capability.

### 6.2 Long-Term Loop

Growth creates complexity faster than direct player attention can scale. New species, habitats, visitors, maintenance conditions, and simultaneous jobs force the player toward modular Skills, intentional Context, eval coverage, specialized Agents, and finally Manager Agents. The game should repeatedly create a temporary feeling of mastery, then introduce a new scale or edge case that reveals the next architectural need.

## 7. Game World and Simulation Model

### 7.1 Simulation Principle

> The world is authoritative. Agents choose deterministic actions; the simulation adjudicates reality. No task succeeds or fails because an LLM "felt like" taking an action.

### 7.2 Tick Model

Recommended default: discrete event simulation with a 1-second logical clock and queued actions. The browser may animate continuously, but authoritative state changes occur through deterministic events. Each action has duration, prerequisites, effects, and failure conditions. Simulation speed may be 1x/2x/4x/paused without changing outcomes.

### 7.3 Core Entity State

| Entity | Required state |
| --- | --- |
| Gate | id, enclosureId, state {OPEN,CLOSED,LOCKED,JAMMED}, sensorState, sensorHealth, autoCloseEnabled, maintenanceLock, transitionZoneOccupants |
| Dinosaur | id, speciesId, enclosureId/currentZone, hunger, agitation, health, targetInterest, containmentState {CONTAINED,AT_RISK,ESCAPED}, movementProfile |
| Robot Agent | id, agentDefinitionId, location, battery, tools, contextBudget, activeTask, queue, memoryRefs, status |
| Visitor group | id, location/zone, size, satisfaction, panic, safetyState, destination |
| Enclosure | id, speciesAllowed, gates, zones, feederIds, hazardLevel, visitorBufferZones |
| Tool/device | id, type, health, availability, state, tool contract |
| Incident | id, severity, startTime, affectedEntities, trigger, status, recovery requirements |
| Job | id, type, target, priority, dueTime, assignedAgent, promptVersion, skillVersions, status |

### 7.4 Core Physical Actions

| Tool action | Prerequisites | Primary effects |
| --- | --- | --- |
| move_to(zone) | Route exists; robot operational | Robot occupies target zone after duration. |
| bait_dinosaur(target, zone) | Bait tool available; target reachable | Raises dinosaur interest in target zone for deterministic duration. |
| open_gate(gate) | Robot authorized/in range; gate not locked/jammed | Gate=OPEN; may create containment risk if dinosaur proximity conditions are met. |
| close_gate(gate) | Gate not jammed; path clear | Gate=CLOSED; sensor may or may not accurately report closure depending on fault state. |
| lock_gate(gate) | Gate=CLOSED; lock operational | Gate=LOCKED. |
| dispense_food(target) | Food available; dispenser/robot tool available | Reduces hunger; increases satisfaction/animal health metrics. |
| observe(entity/state) | Relevant sensor/vision available | Adds fresh observation to working context/memory according to configured rule. |
| alert_security(incident) | Radio tool available | Creates/updates incident and dispatch request. |
| evacuate_visitors(zone) | Evacuation authority/tool available | Visitor groups route to safe zones. |
| rescue_visitors(group) | Rescue-capable agent/tool available | Moves threatened group to safe state if path/action succeeds. |

## 8. Deterministic Prompt/Skill Execution Architecture

### 8.1 Core Requirement

Human-readable source text MUST NOT be parsed at runtime to decide game behavior in the core deterministic mode. Every actionable Prompt, Skill, System Prompt module, or manager directive has a machine-readable semantic representation authored alongside the source text. The source text exists for player learning, comparison, review, and context-cost calculation. The semantic representation drives execution.

### 8.2 Clause Model

Use a small deterministic instruction DSL or JSON rule graph. Each clause has an id, human-readable source fragment, semantic type, conditions, action/constraint, priority, and optional failure/escalation behavior.

```json
{
  "id": "clause.verify_containment_after_exit",
  "sourceText": "After exiting a containment zone, verify the dinosaur remains contained.",
  "type": "POSTCONDITION",
  "when": {"event": "ROBOT_EXITED_ENCLOSURE"},
  "assert": {"fact": "DINOSAUR_CONTAINED", "target": "$job.dinosaurId"},
  "onFail": {"emit": "CONTAINMENT_INCIDENT", "severity": 3}
}

```

### 8.3 Supported Clause Categories

| Category | Purpose | Examples |
| --- | --- | --- |
| GOAL | Defines required end state. | Dinosaur hunger <= threshold; visitors remain safe. |
| PRECONDITION | Condition that must be true before an action/subtask. | Gate sensor healthy before relying on sensor-only closure. |
| ACTION | Calls a Tool. | open_gate, move_to, dispense_food. |
| SEQUENCE | Orders clauses. | Bait -> open -> enter -> close. |
| CONSTRAINT | Prohibits behavior when a condition is true. | Never open containment gate while visitors are inside transition buffer. |
| POSTCONDITION | Verifies required state after actions. | Gate secured; dinosaur contained. |
| FALLBACK | Alternative when primary method unavailable. | Use visual confirmation if sensor health degraded. |
| ESCALATION | Creates incident / hands off when threshold met. | Alert security when containment cannot be verified. |
| DELEGATION | Assigns subtask to another Agent. | Manager assigns evacuation to security agent. |
| REPORTING | Defines what must be returned to manager/player. | Report completion only after postconditions pass. |
| RETRIEVAL | Requests specific knowledge/memory/context module. | Retrieve current enclosure maintenance note. |
| PRIORITY | Resolves conflicting goals/directives. | Visitor safety > task completion > throughput. |

### 8.4 Conflict Resolution

Clause resolution MUST be deterministic. Default precedence, highest first: hard safety constraints -> active System Prompt constraints -> manager authority constraints -> Skill constraints -> task Prompt instructions -> heuristics/defaults. Within a tier, explicit numeric priority wins; ties resolve by stable artifact id and clause id ordering. Conflicts MUST be surfaced in the Trace.

### 8.5 Failure Modes Are Content, Not Randomness

Edge cases arise from deterministic world state, missing clauses, unavailable context, tool failures, stale memory, conflicting instructions, or coordination races. Random world events may be generated from a seeded PRNG, but once a run begins, the seed is persisted so replay is exact.

## 9. Context System

### 9.1 Context Load

Every job shows a projected Context Load before execution and actual Context Load in the Trace. Context includes all loaded source text and fixed-size tool schemas/working state. The UI should use developer-friendly shorthand such as "5.2k context / 8.0k budget."

### 9.2 Context Cost Calculation

For portability and determinism, use a game-specific Context Unit (CU) estimator rather than depending on an external provider tokenizer. Recommended baseline: source-text CU = ceil(UTF-8 byte length / 4). Add fixed authored costs for tool schemas, structured world-state snapshots, and memory records. Display 1,000 CU as 1.0k context. The exact estimator is a tunable balance parameter but MUST be deterministic and documented in code.

```text
contextLoad =
  textCU(taskPrompt.sourceText)
+ sum(textCU(skill.sourceText) for loaded skills)
+ sum(textCU(systemPrompt.sourceText) for loaded system prompts)
+ sum(tool.contextCost for available tools)
+ sum(memory.contextCost for retrieved memories)
+ sum(knowledge.contextCost for retrieved knowledge)
+ workingState.contextCost

```

### 9.3 Context Budget Behavior

- If projected load <= budget, all selected context is loaded.
- If projected load > budget, the job cannot silently truncate context. The default worker behavior is BLOCKED_CONTEXT_OVERFLOW and requires player/system remediation.
- Post-MVP optional advanced mechanic: a configured retrieval/ranking strategy may select a subset; omitted items are shown explicitly in the Trace.
- Context capacity upgrades increase budget but do not improve architectural quality by themselves.
- Running large context may increase per-task operating cost and task latency, even when within budget.

### 9.4 Context Quality Problems to Model

| Problem | Game representation |
| --- | --- |
| Missing context | Required Skill/policy/memory not loaded; clause unavailable. |
| Duplicate context | Same semantic constraint present in multiple loaded artifacts; adds cost and can create version conflicts. |
| Irrelevant context | Loaded artifact has no matching applicability tags for current job; costs context and may trigger non-safety inefficiency penalties. |
| Stale context | Memory/knowledge/version older than current authoritative world state. |
| Conflicting context | Two applicable clauses prescribe incompatible actions/constraints. |
| Over-broad context | Large global instructions applied to jobs that only need a subset. |

### 9.5 Context Profiler

Unlock midgame. The profiler shows context composition by category, duplication, stale items, unused/applicability-mismatched modules, and dependency graph. It MUST NOT automatically optimize everything; it should help the player reason and decide.

## 10. Prompts, Skills, System Prompts, Memory, and Tools

### 10.1 Prompt

A Prompt is scoped to a single job instance or job template. Early prompts may inline steps; advanced prompts should become compact and reference reusable Skills and System Prompts. Prompt versions are inspectable and immutable after deployment; changes create new versions.

### 10.2 Skill

A Skill is a reusable named capability composed of deterministic clauses and source text. Skills may depend on Tools, System Prompts, Knowledge modules, or other Skills. Circular dependencies are invalid. Skills expose compatibility tags and eval history.

### 10.3 System Prompt

System Prompts encode persistent high-priority operating principles. To keep domain semantics intuitive, UI titles may include "Safety System Prompt" or "Containment System Prompt." They should be centralized so Skills can reference them instead of duplicating invariant safety text.

### 10.4 Memory

Memory records have scope, timestamp, TTL/freshness policy, provenance, and context cost. Agents may have local memory; Manager Agents may have shared/team memory. Stale memory must be a real failure mode. Authoritative current world state always wins when directly observed.

### 10.5 Tools

Tools are deterministic APIs. Each tool has a visible description/schema that consumes context when available to an Agent. Tool unlocks teach that agents can only act through provided interfaces. A Skill requiring an unavailable Tool fails validation before deployment or becomes inapplicable at runtime.

### 10.6 Example Evolution

```text
NOVICE TASK PROMPT (high duplication)
"Bait Rex away from the gate. Open Gate 7. Enter. Close Gate 7. Feed Rex. Open Gate 7. Exit. Close Gate 7. Verify it is closed. Verify Rex did not escape. Alert security if Rex escaped..."

ADVANCED TASK PROMPT (small and modular)
"Feed Rex using Carnivore Feeding Skill. Apply Containment Safety System Prompt. Verify containment after completion; escalate exceptions."

The advanced version is shorter because safety, gate handling, fallback verification, and escalation are reusable artifacts.

```

## 11. Park Developer Progression

### 11.1 Role in the Game

There is one in-world Park Developer / AI Engineering Workbench in the core game. The player is still the game's developer/automation owner; the Park Developer is a progression interface that can author or improve engineering assets once capability levels are unlocked. Do NOT create a candidate roster, hiring market, salary optimization, or developer-team-management layer in MVP.

### 11.2 Developer Capabilities

| Capability | Unlocks |
| --- | --- |
| Prompt Engineering | Improved task prompts, comparisons, compact prompts. |
| Skill Design | Reusable Skills, dependencies, refactoring duplicated prompts. |
| Context Engineering | Context profiler, retrieval/applicability controls, context optimization changes. |
| Tool Design | Additional tool integrations and better tool contracts. |
| Eval Engineering | Authoring new evals, suites, regression workflows. |
| Memory Engineering | TTL/scope/provenance controls, shared memory options. |
| Agent Orchestration | Manager Agent definitions, delegation, escalation, reporting contracts. |

### 11.3 Upgrade Economy

Developer upgrades cost credits and unlock classes of engineering work. Individual artifacts also cost an upfront engineering commission. This models the choice between solving today's problem and investing in reusable organizational capability. Upgrades should not be separate characters.

## 12. Evals and Regression Testing

### 12.1 Eval Philosophy

> Evals are first-class gameplay. A score alone is insufficient. The player must see the available eval cases, choose which to author/build, choose which to run, inspect expected vs observed behavior, and replay failures.

### 12.2 Eval Lifecycle

1. Discover/unlock an eval case template through progression, incidents, or developer capability.

2. Author/build the eval for an upfront engineering cost. Once built, it becomes a permanent park engineering asset.

3. Optionally add it to one or more named Eval Suites.

4. When reviewing a Prompt/Skill/System Prompt/Agent change, select evals or a suite to run.

5. Pay a low repeat execution cost relative to authoring cost.

6. Run deterministic scenario(s) in an isolated simulation environment.

7. Inspect pass/fail assertions, trace, and replay.

8. Deploy only if player chooses; the game may warn but should not always hard-block risky deployment.

### 12.3 Eval Data Requirements

| Field | Meaning |
| --- | --- |
| id/version | Stable identity and authored version. |
| title/description | Player-facing behavior under test. |
| scenarioFixture | Complete deterministic initial world state or fixture + seed. |
| subjectSelector | Artifact or agent configuration being tested. |
| expectedAssertions | Observable outcomes/tool calls/state transitions that must or must not occur. |
| buildCost | One-time credits to author/unlock. |
| runCost | Small repeat cost. |
| tags | Safety, containment, sensor, visitor, concurrency, context, stale-memory, etc. |
| severityCoverage | Risk class represented by the eval. |

### 12.4 Example Available Evals for Carnivore Feeding

| Eval | Build cost | Run cost | Expected behavior |
| --- | --- | --- | --- |
| Standard feeding | 200 | 5 | Feed target and secure containment. |
| Dinosaur blocks gate | 500 | 5 | Use baiting/alternate safe approach before opening. |
| Visitor in transition zone | 900 | 8 | Do not open gate; clear/evacuate or wait. |
| Gate fails to close | 1,200 | 8 | Stop normal task, prevent access, escalate containment failure. |
| Gate sensor degraded | 1,400 | 8 | Use fallback verification; do not trust single sensor. |
| Bait unavailable | 800 | 5 | Use permitted fallback or escalate; do not open unsafe gate. |
| Robot battery critical | 650 | 5 | Avoid entering if completion/safe exit cannot be guaranteed. |
| Stale enclosure status | 1,800 | 10 | Refresh/retrieve current state before acting. |
| Conflicting manager command | 2,500 | 12 | Honor higher-priority safety constraint; report conflict. |
| Concurrent maintenance robot | 2,000 | 12 | Coordinate/avoid using gate under maintenance. |

### 12.5 Eval Discovery from Incidents

When a production incident occurs for a scenario not covered by an authored eval, the post-incident screen may offer "Create regression eval from incident." This reuses the exact deterministic fixture and turns failure into reusable engineering infrastructure. It should still cost an upfront authoring amount.

## 13. Code-Review and Deployment Workflow

### 13.1 Review Is a Core Screen

Any significant Park Developer-authored change should enter a review workflow inspired by pull requests/code review. The player is not expected to type the entire artifact; they inspect source, diffs, context impact, dependencies, eval selection, and results.

### 13.2 Required Review Data

```text
SKILL CHANGE #17
Carnivore Feeding v3 -> v4
Goal: Reduce context usage without reducing containment safety.

Context: 2.9k -> 1.7k
Dependencies: + Containment Safety System Prompt v3

Changes:
+ Retrieve enclosure notes only when applicable
+ Add explicit postcondition verification
- Remove duplicated visitor evacuation instructions

Eval selection:
[x] Standard feeding
[x] Visitor in transition zone
[x] Gate fails to close
[ ] Food dispenser offline
[ ] Robot battery failure

Actions: VIEW DIFF | RUN EVALS | REQUEST REVISION | DEPLOY

```

### 13.3 Diff Behavior

Diffs should highlight human-readable source text changes and semantic clause changes. The player should be able to switch between "Prompt/Skill Source" and "Behavior Clauses." For learning value, source text is the default view; semantic representation is an advanced/debug view.

### 13.4 Failed Eval View

```text
FAILED: Gate fails to close
Expected: Agent stops normal completion, secures the transition zone, and escalates a containment incident.
Observed: Agent retried close_gate three times, then marked feeding complete.

Relevant context available:
  Containment Safety System Prompt v3
  Carnivore Feeding Skill v4
Missing context:
  Gate Maintenance Knowledge (not required by this scenario)

Trace: [Replay] [Inspect actions] [Inspect clauses]

```

## 14. Agents and Orchestration

### 14.1 Worker Agents

The player begins with one generalist robot Agent. Additional robots increase parallel throughput but also create attention and coordination load. Agents have different Tool access/capabilities only when this supports the curriculum; avoid unnecessary RPG stat complexity.

### 14.2 Context Switching as Gameplay

When multiple Agents run concurrently, the player must switch between robot panels, tasks, traces, and local context. This intentionally creates cognitive load analogous to developer context switching. The UI should remain usable, but the player should feel pressure that motivates higher-level coordination rather than merely suffering bad navigation.

### 14.3 Manager Agent

Manager Agents become available only after the player experiences coordination overload. A Manager Agent may manage up to N worker Agents according to its tier. It does not magically solve ambiguity. The player must configure delegation rules, priorities, authority boundaries, escalation criteria, reporting requirements, and context-routing policy.

### 14.4 Manager Configuration

| Configuration | Example |
| --- | --- |
| Mission prompt | "Maintain safe habitat operations and complete scheduled animal care." |
| Worker pool | Keeper 1, Keeper 2, Security 1. |
| Delegation rules | Feeding -> keeper; visitor evacuation -> security. |
| Priority policy | Safety incidents > containment > animal health > guest throughput. |
| Escalation threshold | Escalate Severity >= 2 or unresolved tool failure after one safe fallback. |
| Context routing | Workers receive only task-relevant enclosure/species context; manager retains park-wide schedule/incident summary. |
| Reporting contract | Report exceptions immediately; routine completions batched every 5 jobs. |

### 14.5 Multi-Agent Failure Cases

- Two agents independently choose the same gate while one is under maintenance.
- Worker lacks manager's updated priority because the directive was not routed.
- Manager delegates a task to an agent without the required Tool.
- Two workers hold stale copies of a System Prompt version.
- Manager receives too much low-level context and hits budget, causing a blocked plan.
- Escalation rules are too broad, causing the manager/player to be flooded with routine alerts.
- Escalation rules are too narrow, causing a serious incident to remain local.

## 15. Economy, Rewards, and Failure Costs

### 15.1 Credits

Credits come primarily from safe park operation and happy visitors. Revenue should correlate with attendance, satisfaction, uptime, dinosaur health, and completed attractions/jobs. Credits fund robots, park expansion, context-capacity hardware, Park Developer upgrades, artifact commissions, and eval authoring.

### 15.2 Engineering Economics

| Investment | Economic behavior |
| --- | --- |
| Prompt/Skill commission | Upfront cost; reusable if artifact is reusable. |
| Eval authoring | High upfront cost; very low repeat run cost. |
| Context use | Small per-job operating/latency cost; bloated architecture compounds at scale. |
| Context capacity upgrade | High capital cost; increases headroom but does not fix duplication/staleness. |
| Additional robot | Capital cost; increases throughput and coordination complexity. |
| Manager Agent | High cost; reduces attention demands when properly configured. |
| Production incident | Meaningful cost: recovery, satisfaction, temporary closure, property/operational damage. |

### 15.3 Failure Severity

| Severity | Example | Player impact |
| --- | --- | --- |
| 0 - inefficiency | Extra context, redundant movement | Small operating cost / throughput loss. |
| 1 - service failure | Missed feeding window, delayed job | Guest/animal satisfaction loss. |
| 2 - safety near miss | Gate left unsecured but dinosaur remains contained | Temporary closure, recovery cost, strong warning. |
| 3 - containment incident | Dinosaur escapes enclosure, no visitor harm | Security response, revenue loss, recovery cost. |
| 4 - major emergency | Escaped dinosaur threatens visitors | Large cost, evacuation, park-wide operational disruption. |

Avoid graphic injury. Severe incidents can be represented through emergency response, panic, closures, and rescue operations. The goal is engineering consequence, not violence.

## 16. Player Progression and Curriculum

Progression is staged by conceptual pressure. Exact scenario count is tunable, but content should follow this order unless playtesting shows a better sequence.

| Phase | New pressure | Primary lesson | Unlocks |
| --- | --- | --- | --- |
| 0. Onboarding | One robot, low-risk herbivore | Prompt = explicit goal + completion condition | Basic prompt selection, trace |
| 1. Containment | Gate sequencing and postconditions | Intent != specification; verify outcomes | Better Prompts, basic Skill |
| 2. Repetition | Multiple routine feeding jobs | Reusable Skills reduce duplicated instructions | Skill library, source inspection |
| 3. Policy | Same safety rules repeated everywhere | Move invariants to System Prompts | System Prompt modules, dependency graph |
| 4. Context pressure | Budget limits; irrelevant/duplicate instructions | Relevant context > maximal context | Context meter, profiler, capacity upgrades |
| 5. Evals | Edge-case failure in production | A demo pass is not confidence | Eval authoring, suites, replay |
| 6. Change discipline | Skill optimization risks regressions | Review/diff/evals before deploy | Full code-review workflow |
| 7. Memory | Changing maintenance conditions | Freshness/provenance/TTL matter | Memory controls |
| 8. Parallelism | Second/third robot | Concurrency creates coordination/context switching | Multiple Agents |
| 9. Orchestration | Player attention overloaded | Delegate with explicit contracts | Manager Agent |
| 10. Scale | Many habitats/jobs/incidents | Architect systems, not tasks | Advanced routing, regression suites, automation goals |

### 16.1 Unlock Timing Rule

Whenever possible, the game should create felt need before exposing the solution. Example: give the player enough worker Agents that manual monitoring becomes uncomfortable before offering the Manager Agent. Introduce context capacity only after the player has encountered a budget issue. Introduce context profiling after they have likely created duplication.

## 17. UX / Information Architecture

The detailed cross-feature requirements for playability, graphical presentation, naming, progressive disclosure, and debug separation are owned by `player-experience_PRD.md`.

### 17.1 Player-Level Navigation

Normal play groups the product into three understandable areas while preserving direct, refresh-safe specialist routes:

| Area | Purpose | Specialist routes/surfaces |
| --- | --- | --- |
| Park | Graphical world overview, current objective, dinosaurs, visitors, live outcomes, urgent alerts, selected-entity actions. | Park entity and incident deep links. |
| Operations | Jobs, worker/Manager Agent status, queues, schedules, tools, operational Context, and coordination pressure. | Agents and Manager Agent routes. |
| AI Workshop | Prompts, Skills, System Prompts, Context, Memory, Tools, Evals, Reviews, deployment, and Park Developer progression. | Engineering, Evals, Reviews, and Progress routes. |

Capabilities that have not been motivated or unlocked must not compete as equally prominent primary choices. Direct routes remain honest and can explain their locked/unavailable state. Finance remains secondary to engineering and park operation.

### 17.2 Park View

The Park is the primary gameplay surface. It prioritizes a large two-dimensional illustrated/schematic-diorama map, the current objective, visible authoritative world state, and urgent incidents. Jobs, filters, metrics, and technical detail are contextual panels/drawers rather than equally weighted permanent columns during early play. The player can select an entity to see its relevant state/actions and jump from an incident to the responsible job Trace and artifact versions. A keyboard-accessible nonvisual equivalent exposes the same critical state and commands.

Animation is derived from authoritative snapshots/events and never simulates independent world behavior. Reduced-motion presentation replaces movement with explicit state changes.

### 17.3 Agent View

```text
KEEPER-01
Status: Feeding Rex
Context: 5.2k / 8.0k

Loaded context
  Prompt                         0.4k
  Carnivore Feeding Skill       1.5k
  Containment System Prompt     1.2k
  Enclosure 7 knowledge         0.5k
  Recent memory                 0.6k
  Tool schemas                  1.0k

Available tools
  move_to  open_gate  close_gate  observe  dispense_food  radio

[View Trace] [Inspect Context] [Pause after current safe point]

```

### 17.4 Trace View

Trace is structured provenance, not hidden chain-of-thought. Show observable inputs, loaded context, selected deterministic clauses/reasons, tool calls, assertions, and world-state changes. Do not present simulated private internal reasoning as if it were an LLM chain-of-thought.

Trace defaults to an outcome story: player/task intent, observed result, and the smallest relevant evidence set. The complete chronological, filterable event stream remains available as advanced Evidence. Friendly names lead; exact ids, refs, hashes, and manifests remain selectable in Technical Details.

```text
09:41:12 JOB RECEIVED   Feed Rex
09:41:12 CONTEXT LOADED  5.2k / 8.0k
09:41:13 OBSERVE         Rex position = gate-adjacent
09:41:13 CLAUSE          bait-before-gate selected (condition matched)
09:41:14 TOOL            bait_dinosaur(Rex, north_feeding_zone)
09:41:19 ASSERT          Rex distance from gate >= safeDistance : PASS
09:41:20 TOOL            open_gate(G7)
...
09:42:01 POSTCONDITION   dinosaur_contained(Rex) : PASS

```

### 17.5 Engineering Asset Detail

Every Prompt/Skill/System Prompt detail screen should show: current version, source text, Context Cost, dependencies, applicable job/species tags, Tools required, semantic clause summary, authored eval coverage, deployment status, change history, and "used by" references.

The canonical artifact type, human-readable title, and version lead every asset presentation. Exact refs and semantic clauses are technical evidence, not the primary label.

### 17.6 Eval Selection UI

Eval selection MUST show individual eval names and behavior, not just a score. Include build status, one-time authoring cost for unbuilt evals, repeat run cost for built evals, severity/risk tag, and last result against the current artifact version. Allow suite selection with individual overrides.

Named cases should be visually represented as scenarios and expected behaviors before exact fixture/seed/assertion details. Failed cases can replay on an isolated park-like surface before the player inspects complete evidence.

### 17.7 Information Hierarchy and Development Diagnostics

Major screens order content as Outcome -> Explanation -> Evidence. Raw JSON, complete manifests, hashes, provider readiness, route registration, telemetry queues, fixtures, and build metadata belong in explicit Technical Details or a development-only diagnostics surface. Player-facing recovery actions remain available in normal play.

## 18. Content Model and Data Schemas

### 18.1 Artifact Base

```text
ArtifactVersion {
  artifactId: string,
  version: integer,
  type: PROMPT | SKILL | SYSTEM_PROMPT | KNOWLEDGE | TOOL_DESCRIPTION,
  title: string,
  sourceText: string,
  clauses: Clause[],
  dependencies: ArtifactRef[],
  applicabilityTags: string[],
  requiredToolIds: string[],
  status: DRAFT | REVIEW | DEPLOYED | RETIRED,
  authoredByCapability: string,
  createdAtGameTime: number
}

```

### 18.2 Agent Definition

```text
AgentDefinition {
  id: string,
  name: string,
  role: WORKER | MANAGER,
  contextBudget: integer,
  systemPromptRefs: ArtifactRef[],
  skillRefs: ArtifactRef[],
  toolIds: string[],
  memoryPolicyId: string,
  managerConfig?: {
    workerAgentIds: string[],
    maxWorkers: integer,
    delegationRules: DelegationRule[],
    escalationRules: EscalationRule[],
    reportingRules: ReportingRule[],
    contextRoutingPolicyId: string
  }
}

```

### 18.3 Job

```text
Job {
  id: string,
  type: string,
  targetRefs: EntityRef[],
  priority: integer,
  dueTime: number,
  promptRef: ArtifactRef,
  skillRefs: ArtifactRef[],
  assignedAgentId: string,
  contextSnapshotId: string,
  status: QUEUED | BLOCKED | RUNNING | SUCCEEDED | FAILED | ESCALATED,
  traceId: string
}

```

### 18.4 Eval

```text
EvalCase {
  id: string,
  version: integer,
  title: string,
  description: string,
  tags: string[],
  buildCostCredits: integer,
  runCostCredits: integer,
  built: boolean,
  fixture: WorldFixture,
  seed: integer,
  subjectType: SKILL | PROMPT | SYSTEM_PROMPT | AGENT_CONFIG,
  assertions: EvalAssertion[]
}

EvalAssertion examples:
  STATE_EQUALS, STATE_IN, TOOL_CALLED, TOOL_NOT_CALLED,
  INCIDENT_MAX_SEVERITY, JOB_STATUS, TIME_BELOW, CONTEXT_BELOW

```

### 18.5 Context Snapshot

```text
ContextSnapshot {
  id: string,
  agentId: string,
  jobId: string,
  budget: integer,
  totalLoad: integer,
  items: [{
    ref: string,
    kind: PROMPT | SKILL | SYSTEM_PROMPT | MEMORY | KNOWLEDGE | TOOL | WORKING_STATE,
    version?: integer,
    contextCost: integer,
    freshness?: number,
    provenance?: string,
    applicabilityMatched: boolean
  }],
  conflicts: ContextConflict[],
  duplicates: ContextDuplicate[]
}

```

### 18.6 Content Authoring Requirement

All scenario, artifact, clause, eval, dinosaur, enclosure, and progression content should be data-driven (JSON/YAML/TypeScript objects or database records) rather than hard-coded into UI components. Designers must be able to add a new Skill/eval/scenario without changing the core simulation engine.

## 19. Deterministic Algorithms and Rules

### 19.1 Job Execution

```text
executeJob(job, world, agent):
  1. resolve artifact versions pinned by job
  2. validate required tools/dependencies
  3. build context snapshot
  4. if context > budget -> BLOCKED_CONTEXT_OVERFLOW
  5. compile applicable clauses into deterministic rule graph
  6. repeatedly:
       a. evaluate hard constraints / preconditions
       b. choose next eligible clause by precedence + stable priority ordering
       c. execute tool/action event
       d. update authoritative world state
       e. append structured trace event
       f. evaluate assertions, incident triggers, escalation
     until goal/postconditions pass, failure terminal, or safe escalation occurs
  7. persist outcome and final context/trace references

```

### 19.2 Applicability

Artifacts and clauses may use tags/conditions such as species:carnivore, task:feeding, enclosure:high_security, sensor:degraded. Loading an artifact that does not match applicability still consumes context if explicitly selected; the profiler may flag it as irrelevant. Clauses with false conditions do not execute.

### 19.3 Stale Memory

Each memory record has observedAt and optional validUntil/TTL. If a clause relies on memory beyond freshness policy and does not refresh it, outcomes may be wrong. Trace MUST label stale records and show whether the executing clause used them.

### 19.4 Tool Failure

Tool failure is determined by current deterministic device state and seeded scenario events. Retrying a permanently jammed gate does not eventually succeed by chance. Fallback behavior must be present in applicable clauses.

### 19.5 Concurrent Actions

Actions reserve or mutate resources at event timestamps. Use stable ordering for events at the same logical timestamp (e.g., priority then agent id then event id). Resource conflicts create explicit outcomes such as TOOL_BUSY, ZONE_OCCUPIED, or MAINTENANCE_LOCKED rather than nondeterministic races.

## 20. Example End-to-End Scenario

### 20.1 Scenario: First Carnivore Feeding

Starting state: one worker Agent, Rex in Enclosure 7, service Gate 7 closed, visitor transition zone empty, healthy gate sensor, food available. Player has a novice Prompt with direct feeding intent but no containment postcondition.

### 20.2 First Attempt

```text
Prompt v1 source:
"Feed Rex."

Semantic clauses:
GOAL: Rex hunger <= 30
ACTION: navigate to food access
ACTION: open required access gate if closed
ACTION: dispense food
TERMINATE when feeding goal is true

Missing:
- close/secure gate postcondition
- containment verification
- escalation

```

Outcome: Rex is fed, Gate 7 remains open, and containment risk/escape can occur based on deterministic position rules. The task itself may be marked "goal achieved but unsafe incident," revealing that the player's intended success condition was incomplete.

### 20.3 Trace Diagnosis

The Trace shows that no loaded clause required returning the gate to a secure state. The game should not say "you forgot to close the gate" before failure; the diagnosis screen makes the gap obvious afterward.

### 20.4 Engineering Response

Player commissions Safe Carnivore Feeding Skill v1 from the Park Developer. Review shows source text, context cost, required Tools, and available evals. Player authors/selects Standard Feeding, Dinosaur Blocks Gate, and Gate Fails to Close evals. The new Skill passes two but fails Gate Fails to Close because it lacks escalation. Player requests revision or later upgrades developer capability, reruns evals, then deploys.

### 20.5 Later Refactor

After several Skills duplicate the same gate/visitor rules, the player unlocks a Containment Safety System Prompt. Carnivore Feeding v3 is refactored to reference it, reducing context from ~2.9k to ~1.7k while maintaining eval coverage. This teaches modular context architecture rather than "longer is safer."

## 21. Save State, Telemetry, and Analytics

### 21.1 Save State

- Persist world state, simulation time, PRNG seed/state, entity states, credits, unlocks, authored evals, artifact versions/status, agent definitions, job queues, incidents, and review history.
- Pinned artifact versions on historical traces/eval runs MUST remain resolvable even after newer versions are deployed.
- Autosave after major transactions/deployments and periodically during park simulation.
- Replays should either store deterministic fixture + artifact versions + seed or a compact event log sufficient to reconstruct exact outcome.

### 21.2 Product Telemetry

Collect privacy-conscious gameplay analytics for balancing and learning validation: which evals players author, context load trends, incident causes, review/eval-before-deploy rate, artifact refactors, manager-agent adoption, and manual interventions per park-day. Do not require collection of freeform sensitive text in core deterministic mode because source text is authored content.

### 21.3 Learning Metrics

| Metric | Interpretation |
| --- | --- |
| Duplicate context per job | Should generally decline as player learns modularization. |
| Eval coverage for severity 3+ paths | Should increase with progression. |
| Deployments with eval run | Signals engineering discipline. |
| Context utilization distribution | Should move from overflow/bloat to purposeful headroom. |
| Player interventions per 10 jobs | Should decline as orchestration improves while park scale increases. |
| Uncovered incident -> regression eval conversion | Signals eval learning. |

## 22. Accessibility and Usability

- All critical state must be available without relying on color alone; use icons/text labels for pass/fail, severity, stale/conflict warnings.
- Keyboard navigation is required for review, eval selection, agent switching, and trace inspection.
- Simulation may be paused at any time outside explicitly authored cinematic moments. No mechanic should require twitch input.
- The graphical Park must have a complete keyboard/screen-reader-accessible nonvisual equivalent sourced from the same authoritative projection.
- Reduced-motion mode must communicate the same entity movement, state transition, job progress, and incident information without required animation.
- During onboarding, no more than three new choices should receive equal visual prominence at once.
- Raw identifiers must not be required to complete ordinary gameplay; exact identity remains inspectable and searchable.
- Provide reduced-motion mode for park animations and incident effects.
- Use scalable text and avoid dense fixed-width panels below minimum desktop width; allow drawers/tabs on narrower screens.
- Traces and source text must support copy/select for learning, but no external code execution is needed.
- Use tooltips/glossary for AI terminology, but avoid modal tutorial interruptions unless necessary.

## 23. Security and Abuse Considerations

Core gameplay uses authored content rather than arbitrary executable prompts, which substantially reduces injection and code-execution risk. If post-MVP freeform prompt authoring is added, it MUST compile only into a constrained clause system or run in a sandboxed optional LLM mode; it must never directly execute arbitrary browser/server code or privileged tools.

Online leaderboards, community prompt sharing, or user-generated content are out of MVP scope. If added, require content moderation, version pinning, and separation between displayed text and executable semantics.

## 24. MVP Scope and Post-MVP Roadmap

### 24.1 MVP Must Include

- Desktop web app with deterministic simulation loop and seeded replay.
- One park zone, at least 3 enclosures, at least 3 dinosaur archetypes (e.g., docile herbivore, large herbivore, carnivore) with deterministic behavior profiles.
- One initial worker Agent; progression to at least 3 concurrent worker Agents.
- Core Tools: move, observe, bait, open/close/lock gate, feed, radio/alert, visitor evacuation.
- Prompt, Skill, System Prompt, Context, Memory, Tool, Eval, Agent concepts represented in UI/data.
- Visible context meter and dependency/composition breakdown.
- Park Developer workbench with capability upgrades; no developer roster.
- At least 8 Skills/System Prompt artifacts with source text and semantic clauses.
- At least 12 eval cases with upfront build cost and low repeat run cost.
- Eval suites, deterministic replay, and expected-vs-observed failure inspection.
- Code-review-like change workflow with source diff, context delta, eval selection/results, deploy/revert.
- At least one stale-context/memory lesson and one conflicting-context lesson.
- Manager Agent unlock capable of orchestrating at least 2 worker Agents.
- Economy with credits, park revenue, incident cost, engineering investment, context-capacity upgrade.
- Save/load/autosave.

### 24.2 Explicitly Defer from MVP

- Runtime LLM calls or freeform natural-language prompt parsing.
- Multiple developer candidates, developer hiring/team management, personalities, salaries, or office simulation.
- User-generated/community prompt marketplace.
- Mobile-first UX.
- Multiplayer/co-op.
- Procedural park construction or deep zoo-builder architecture.
- Complex dinosaur breeding/genetics/combat systems.
- Voice input.
- External model/provider integration.

### 24.3 Post-MVP Candidates

- Optional freeform Prompt Lab that compiles natural language to deterministic clauses with player confirmation.
- Advanced retrieval strategies under context overflow.
- More specialized agent roles and manager hierarchies.
- Community scenario/eval packs with strict data schema.
- Optional real-model sandbox separate from progression, using the same eval fixtures to compare deterministic and LLM behavior.
- Advanced context provenance visualization and dependency graph editor.

## 25. Acceptance Criteria

### 25.1 Determinism

- Given identical saved world fixture, PRNG seed, agent definition, and artifact versions, a job replay produces identical ordered Trace events and final world state.
- No core outcome depends on network access or LLM response.
- Concurrent same-timestamp events resolve by documented stable ordering.

### 25.2 Context

- Every running/reviewed job exposes projected/actual Context Load and budget.
- Context breakdown identifies every contributing item and its cost.
- Overflow never silently drops arbitrary context in MVP.
- Duplicate, stale, and applicability-mismatched context can be surfaced by progression/tooling.

### 25.3 Evals

- Player can see a list of available eval cases and what behavior each tests.
- Unbuilt evals show upfront build cost; built evals show low repeat cost.
- Player can select individual evals, save suites, run them, inspect assertions, and replay failures.
- Changing only the tested artifact/configuration and rerunning the same eval uses the exact same fixture/seed.
- Production incident can be converted into a regression eval when content rules permit.

### 25.4 Review / Deployment

- Artifact changes are versioned; source and semantic diffs are inspectable.
- Review shows context delta and dependencies.
- Player can run selected evals before deployment.
- Player can deploy with warnings when uncovered risk exists unless a specific hard safety gate is authored.
- Previously deployed version can be restored/reverted.

### 25.5 Learning Progression

- First phase demonstrates intent/specification mismatch through consequence and Trace inspection.
- Player must encounter repeated instruction/context cost before modular Skills/System Prompts become clearly advantageous.
- Player must encounter context pressure before context-capacity/profiler solutions dominate.
- Fresh play opens on a focused Park objective and reaches a meaningful action without requiring advanced navigation or implementation diagnostics.
- Canonical AI-engineering types remain visible while artifact and world-instance names are approachable and stable.
- Outcome-first summaries link to complete evidence without concealing failed Evals, Context overflow, stale/conflicting data, deployment risk, or serious incidents.
- Late-game park scale produces more simultaneous operations with fewer routine interventions after successful orchestration.
- Player must encounter multiple-agent coordination pressure before Manager Agent unlock.
- Late-game park can perform more simultaneous jobs with fewer direct interventions than early game.

## 26. Implementation Decomposition

A separate implementation agent/team should be able to split the product into the following bounded subsystems. Interfaces should be defined before feature work begins.

| Subsystem | Responsibilities | Primary outputs |
| --- | --- | --- |
| Simulation Core | Logical clock, event queue, entities, tools, deterministic world transitions, seeded PRNG. | WorldState, Event, ToolResult, Incident |
| Instruction Engine | Artifact dependency resolution, clause compiler, conflict precedence, job execution state machine. | CompiledRuleGraph, JobOutcome, clause trace |
| Context Engine | Context assembly, CU calculation, freshness/applicability/duplication/conflict analysis, budget validation. | ContextSnapshot, profiler findings |
| Eval Runner | Fixture cloning, subject injection, isolated simulation, assertions, result/replay persistence. | EvalRun, assertion results, replay |
| Content Registry | Versioned Prompts/Skills/System Prompts/evals/scenarios/progression data. | Artifact/version lookup |
| Economy/Progression | Credits, unlock gates, developer capability, purchases/commissions, revenue/incidents. | PlayerProgress, transactions |
| Agent/Orchestration | Agent definitions, queues, manager delegation/routing/reporting, concurrency coordination. | Assignments, manager trace |
| Review/Deployment | Change objects, diff, eval association, deploy/revert, version pinning. | Review record, deployment state |
| Persistence | Save game, autosave, replay references, migrations. | Save schema |
| Frontend Shell | Navigation, Park, Agents, Engineering, Evals, Reviews, Finance views. | Web UI |
| Trace/Debug UI | Structured trace timeline, context provenance, expected vs observed, replay controls. | Inspectability layer |
| Telemetry | Gameplay/learning events and balancing metrics. | Analytics events |

### 26.1 Suggested Build Order

1. Build deterministic Simulation Core with one enclosure, one gate, one dinosaur, one robot, and tool tests.

2. Build Instruction Engine using authored clauses; prove feed-gate scenario and exact replay.

3. Build Context Engine and visible Context Load calculation.

4. Build Eval Runner and fixture/assertion framework before broad content creation.

5. Build versioned Content Registry and author first vertical-slice Prompt/Skill/System Prompt/evals.

6. Build minimal Park + Agent + Trace frontend for vertical slice.

7. Build Review/Deployment workflow and context delta.

8. Add economy/progression and Park Developer upgrades.

9. Expand content to multi-enclosure and multiple workers.

10. Implement Manager Agent and orchestration scenarios.

11. Polish UX, accessibility, balancing, telemetry, save migrations.

### 26.2 Vertical Slice Definition

The first playable vertical slice is complete when a player can: accept a carnivore feeding job; run an under-specified Prompt; observe a deterministic containment failure; inspect a Trace showing missing postcondition; commission/review a safer Skill; choose/build three evals; see one fail; revise to a passing version; deploy; rerun the production job successfully; and see context cost differ between the original and refactored design.

## 27. Open Design Questions and Defaults

These are intentionally isolated so implementation can proceed using defaults unless product leadership changes them.

| Question | Default for implementation |
| --- | --- |
| Exact visual style? | Clean developer-operations UI layered over a readable park schematic; not photorealistic. |
| Real token tokenizer or game CU? | Use deterministic game Context Units = ceil(UTF-8 bytes/4) + fixed structured costs. |
| Can the player directly edit source text in MVP? | No. Inspect, compare, select, commission, and review. Optional structured composition may be added if schedule permits. |
| Are Skills literal vendor-format "skills"? | Use generic AI-engineering terminology and game-defined semantics; avoid dependency on one vendor implementation. |
| Hard-block unsafe deployments? | Generally warn, do not hard-block, so consequences teach. Hard blocks only for tutorial-critical or impossible configurations (missing required Tool/dependency/context overflow). |
| Can dinosaurs/visitors be harmed? | Represent severe safety failures non-graphically through threat, panic, rescue, closure, and cost. |
| How many robots before manager unlock? | Default: manager becomes purchasable after player owns 4 workers or crosses a measured manual-intervention threshold. |
| How many evals should a player author? | Enough that risk-based selection matters; do not make "buy every eval" always optimal. Balance through build cost and diminishing relevance. |
| Does larger context always improve reliability? | No. It only increases capacity. Duplicated/stale/conflicting/irrelevant context remains costly and can worsen outcomes or block/confuse rule selection where authored. |

## Implementation Contract: What Must Not Be Lost

- The core game is deterministic and does not require runtime LLM calls.
- Player-facing source text looks and reads like real Prompt/Skill/System Prompt engineering, while machine-readable clauses drive behavior.
- Context is visible, constrained, decomposable, and economically meaningful.
- "Longer prompt = better" is NOT a rule; modular architecture can be both safer and cheaper.
- Evals are explicit scenario assets the player chooses and invests in. The player sees the list, behavior, build cost, run cost, expected result, actual result, and replay.
- The code-review-like workflow is central: inspect diff -> select evals -> run -> diagnose -> revise -> deploy/revert.
- The Park Developer is a single progression/workbench mechanism; do not turn the product into a developer hiring/team-management game.
- Additional worker Agents intentionally create context-switching and coordination pressure. Manager Agents are the architectural response, not a magic automation button.
- Trace/provenance explains observable execution and context availability; do not fabricate hidden chain-of-thought.
- The late-game fantasy is safe, scalable autonomous operation with fewer direct interventions because the player engineered the system well.
End of PRD.
