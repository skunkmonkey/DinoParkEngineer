Let's brainstorm about a web-based game I'd like to create. We aren't going to make it in this session, simply brainstorm about it. Please suggest 4-6 experts that would best contribute to this session. Here's the game idea:

The purpose of the game is to help players (professional developers are the target audience) learn and develop prompt engineering, and especially context engineering skills. The player runs a fully automated dinosaur park. The park is operated by robots that act on what prompts the user provides. Initially, they will only have a single robot, but multiple dinosaurs to tend.

Here's some examples of things the user will need their robot(s) to do:

Bait the dinosaur away from the gate
Open the gate for the robot
Close the gate behind the robot
Feed the dinosaur
Open the gate for the robot
Exit the gated area
Close the gate behind the robot
Verify the dinosaur didn't escape
Alert security if the dinosaur escaped
Rescue park visitors if a dinosaur escapes

Eventually, they'll earn credits from happy customers that will allow them to purchase more robots and they'll have to jump between them (helping the developer learn the mental context switching skill they need in coding). They'll also be able to purchase a more expensive manager robot that can manage N worker robots. The purpose is to help teach the developer agent orchestration, and why that's a good idea.
---
This concept has enough depth that I’d want the brainstorming group to include both game-design expertise and people who understand what developers actually need to learn when working with agents. I’d use these six expert perspectives:

Senior Systems Game Designer
Designs interconnected mechanics, progression loops, resource economies, failure states, and emergent gameplay.
Their main job would be making sure this is genuinely fun rather than a training course wearing a dinosaur costume.
They’d focus on questions like: What makes the player want “one more day” in the park? How do robots, dinosaurs, money, incidents, and upgrades interact? How do we make failures hilarious or dramatic rather than simply frustrating?
AI Agent / Context Engineering Architect
Someone experienced with tool-using agents, context windows, subagents, delegation, memory, handoffs, and orchestration.
This person keeps the game's lessons technically authentic.
They’d identify concepts worth turning into mechanics: prompt specificity, state management, context pollution, selective context, delegation boundaries, parallelization, escalation, verification, recovery, and supervisor/worker architectures.
Developer Education & Learning-Science Designer
Someone who knows how professional engineers learn complex skills through practice.
Their job is to make sure the game produces transfer: players should become better at working with coding agents outside the game.
They’d help create the learning progression from “write a decent instruction” → “manage context” → “design a reusable procedure” → “delegate to agents” → “orchestrate an entire autonomous system.”
I especially want this person involved because the game should preferably teach through consequences rather than through tutorials.
Simulation / Emergent-AI Game Designer
Someone with experience designing games where relatively simple actors create unpredictable system-level behavior.
Dinosaurs + robots + gates + visitors + schedules + emergencies are an excellent setup for emergent situations.
They’d focus on making the world sufficiently deterministic that players can reason about it, but sufficiently dynamic that brittle prompts eventually fail.
This expert would likely be responsible for many of the game's best “Oh no…” moments.
Developer Tools / IDE UX Designer
Someone who understands the interaction patterns of developers using terminals, IDEs, agent panels, logs, traces, diffs, and debugging tools.
The interface should probably feel closer to operating an AI system than controlling characters in a conventional game.
They could help answer a very important design question: What information should the player see?
Robot context, instructions, observations, execution traces, token/context budgets, shared memory, task queues, and manager-worker communication could all become gameplay surfaces.
Technical Game Economy & Progression Designer
Focuses specifically on unlocks, currencies, capability progression, and the economic decisions surrounding automation.
This is especially important for your idea because buying additional robots shouldn't merely mean “more power.”
Ideally, every upgrade creates a new management problem:
Robot #2 gives you concurrency but introduces context switching.
Specialized robots give you capability but increase coordination complexity.
Shared memory reduces repetition but introduces stale/incorrect context.
A manager robot reduces micromanagement but requires effective delegation.
A larger context window helps temporarily but may encourage sloppy context management.
More autonomy improves throughput but increases the cost of poorly specified policies.

The mix I’d particularly want in the room is Systems Designer + Agent Architect + Learning Designer as the core trio. The other three can then attack the design from simulation, interface, and progression angles.

And there’s one principle I’d ask all six experts to challenge throughout the session:

Can every important AI-development concept become a game mechanic rather than a piece of instructional text?

For example, I think your initial dinosaur-feeding scenario already contains a surprisingly rich lesson.

A novice might prompt:

“Go feed the velociraptor.”

The robot dutifully opens the gate, walks in, feeds it—and leaves the gate open.

The player learns that the goal they intended is not necessarily the task they specified.

Next they write an enormous 27-step prompt covering every conceivable contingency.

It works… until something unexpected happens.

Now they learn procedural specificity isn't the same thing as robust context engineering.

Later they might give the robot persistent policies:

Never leave a containment gate open unattended.
Verify containment after entering or exiting an enclosure.
Escalate anomalous containment states.
Preserve visitor safety over task completion.

Now the player has moved from prompting individual actions → creating reusable operational context.

And eventually:

Player → Manager Robot → Keeper Robots / Security Robots / Maintenance Robots

At that point the game isn't really teaching “how to write prompts” anymore.

It's teaching developers how to design organizations made out of agents.

That feels like the strongest version of the concept.
---
please adopt the personas of each of your recommended mix. Then let's engage in a brainstorming session. I've introduced the idea, I'd like to hear the panels thoughts and suggestions. Rules for each participant:

Never feel the need to speak unless you have something uniquely valuable to add. You can thumbs up/down a response if you really want to weigh in and those thumbs up / down will appear as a count rather than a list of people. This will reduce noise in the session.
Pushback is valuable.
Stay in role, think as that persona would think. Approach problems as they would approach them, never break the 4th wall. The diversity is what makes the session work.
---
Mara Voss — Senior Systems Game Designer

The premise is strong, but I want to push against one thing immediately: the game should not primarily be about writing better prompts.

If the dominant action is “edit prompt → press Run → see whether it worked,” we risk building a programming puzzle with an LLM-shaped syntax.

The interesting game is operating the park.

The player has objectives, incomplete information, limited resources, changing conditions, and increasingly complicated systems. Prompts are simply the control surface.

I would make the earliest scenario almost insultingly simple:

Feed the herbivore.

The player gives an instruction. The robot walks into the enclosure and feeds it.

Success.

Then we introduce a slightly different enclosure. Same instruction.

Robot opens the gate, enters, feeds the dinosaur, and walks away.

The dinosaur escapes.

That's important because the game didn't suddenly invent a trick. The player's implicit assumption was exposed.

I would build a large part of the game around that concept:

Things the player believes are obvious are not necessarily part of the robot's operating context.

Later, the opposite problem appears. The player has accumulated so many rules that the robot becomes ineffective because it is carrying around irrelevant context.

So I'd define the progression something like:

instructions → procedures → policies → context → delegation → organizations

Not “easy prompts → difficult prompts.”

👍 5

Dr. Priya Raman — Developer Learning & Learning-Science Designer

Strong agreement with the progression, but I want to add a constraint.

Do not tell players the lesson before they experience the failure.

If the game says:

Tip: Agents only know what you explicitly tell them!

we have converted discovery into compliance training.

Instead, let the player form a hypothesis, act on it, observe the consequence, and inspect why the robot behaved that way.

Then provide tools that allow reflection.

For instance, after the escape:

PLAYER INTENT

Feed Dino #12 safely.

ROBOT INTERPRETATION

Enter enclosure.
Deliver food.
Task complete.

WORLD STATE AFTER COMPLETION

Gate 4: OPEN
Dino #12: UNCONTAINED

That's teaching.

The player doesn't need a lecture about prompt engineering. They can see the gap between intent and interpreted task.

I'd also like the game to assess skills without announcing that it is assessing them.

A player who initially writes:

Open gate. Enter. Close gate. Feed dinosaur. Open gate. Exit. Close gate.

might later realize they can establish:

Containment policy: Any gate opened during a task must be returned to its previous secure state unless explicitly instructed otherwise.

That's an enormous learning milestone.

The game should recognize that transition.

Not because the new prompt contains particular keywords, but because the player's solution has become generalizable across situations.

👍 5

Elias Chen — AI Agent & Context Engineering Architect

I'm going to push harder.

Don't make the robot stupid merely to manufacture lessons.

Professional developers will detect that immediately.

If a competent modern agent would reasonably infer that a dinosaur enclosure should remain closed, but our robot conveniently doesn't because we want to teach explicit prompting, we've taught the wrong lesson.

The failures should come from real agent-system problems.

For example:

The worker robot knows:

current assignment
enclosure map
dinosaur position
available tools

But it does not automatically have:

park-wide policies
previous incident reports
another robot's observations
the player's private intentions

Now we have genuine context engineering.

I want visible context boundaries everywhere.

Imagine the robot console showing:

CURRENT CONTEXT

TASK
Feed Rex.

LOCAL STATE
Rex is in enclosure 7.
West service gate is closed.

POLICIES
Containment Safety v3
Visitor Safety v2

MEMORY
Last 4 observations

AVAILABLE TOOLS
Gate controls
Food dispenser
Radio

Players should eventually be deciding:

What belongs in the task? What belongs in policy? What belongs in memory? What belongs in shared context? What should be retrieved only when relevant?

That is context engineering.

Then later, give them a 100,000-token context window.

They'll think they've won.

Let them dump everything into it.

And gradually make the robot slower, more expensive, and more prone to retrieving the wrong instruction.

😈

That lesson will stick.

👍 6

Sofia Alvarez — Simulation & Emergent-AI Game Designer

I love that, but there is a major architectural requirement underneath it:

The world needs to be trustworthy.

If a dinosaur escapes because an LLM randomly decides not to close a gate, the player learns nothing.

The park simulation should have hard state.

Gate:

OPEN / CLOSED / LOCKED / JAMMED

Dinosaur:

ENCLOSURE / LOCATION / HUNGER / AGITATION / TARGET

Robot:

LOCATION / TOOLS / BATTERY / ASSIGNMENT

Visitors:

LOCATION / PANIC / SAFETY

The agent interprets and plans.

The simulation adjudicates reality.

That separation lets us create wonderfully messy emergent situations while still allowing the player to debug them.

Example:

Robot A is feeding a triceratops.

Robot B is repairing Gate 3.

Robot A's procedure says:

Use the nearest available service gate.

Gate 3 happens to be nearest.

Robot A opens it.

Robot B has disabled the automatic closing mechanism because it's repairing it.

Nobody violated their individual instructions.

And now there's a triceratops in the gift shop.

That is the kind of failure I want.

The problem wasn't a bad prompt.

The problem was two locally reasonable agents operating without adequate shared context or coordination.

That is exactly where multi-agent systems get interesting.

👍 6

Jonah Feld — Developer Tools / IDE UX Designer

That example tells me what the interface needs to become.

The core experience should feel less like a chatbot and more like debugging a distributed system.

I want three layers.

At the highest level:

PARK

You see active jobs, alerts, dinosaurs, visitors, robot utilization.

Then:

ROBOT

You see what that robot currently believes, what task it has, what information it received, and what actions it took.

Then:

TRACE

Something like:

09:41:12 Received task: Feed Triceratops #4
09:41:13 Selected Service Gate 3
09:41:13 Gate state observed: CLOSED
09:41:14 Opened Gate 3
09:41:16 Entered enclosure
...

And critically:

Why did you do that?

should be inspectable.

Not necessarily raw chain-of-thought—I'd rather expose structured decision provenance:

ACTION: Use Gate 3


Relevant context:
✓ Gate 3 is closest service entrance
✓ Gate 3 reported CLOSED


Context not available:
✗ Gate 3 maintenance status
✗ Robot B assignment

Now the player can diagnose the system.

Later, when five robots are operating simultaneously, this interface naturally becomes overwhelming.

That's not a UX failure.

That's gameplay.

The player realizes they cannot personally inspect every robot.

Which creates demand for...

👍 5

Marcus Webb — Economy & Progression Designer

...the manager robot.

But I strongly oppose making it something the player simply saves 10,000 credits to buy.

The player should want the manager before we offer the manager.

Give them Robot #2.

Amazing. Parallel work.

Give them Robot #3.

Still manageable.

Robot #4.

Now incidents start overlapping.

Robot #5.

The player's screen looks like an air-traffic-control disaster.

Then introduce:

Park Operations Manager — 18,000 credits

The reaction should be:

TAKE MY MONEY.

But here's the trick.

The manager does not magically solve coordination.

The first time they buy one, I expect many players to write something like:

Manage the other robots and make sure everything runs smoothly.

And then discover that they've simply moved their ambiguity one level upward.

Now we're teaching orchestration.

The manager needs:

authority boundaries
escalation criteria
priorities
delegation rules
reporting requirements
shared context
success conditions

And the player's interaction changes.

Early game:

Robot, feed dinosaur 6.

Midgame:

Robot, follow the feeding procedure for dinosaur 6.

Later:

Manager, make sure all carnivores are fed before opening.

Eventually:

Maintain safe park operations while maximizing visitor capacity. Escalate only policy exceptions and incidents above Severity 2.

That's the progression I want economically and mechanically.

👍 6

Mara Voss — Systems Game Designer

There's our core loop.

I'm hearing something more interesting than “Jurassic Park teaches prompting.”

It sounds like:

The player begins by controlling actions and gradually learns to control systems.

Every time the park grows, direct control becomes less viable.

So abstraction becomes a player-earned superpower.

Procedures reduce repetition.

Policies reduce procedural verbosity.

Shared memory reduces duplication.

Specialization reduces context requirements.

Delegation reduces attention requirements.

Managers reduce coordination requirements.

But every abstraction introduces a new failure mode.

That's excellent game-design material.

I would make that our north star.

👍 5

Elias Chen — Agent Architect

One additional mechanic I think could become central:

context has provenance.

Imagine the park eventually contains:

global policies
species procedures
enclosure notes
robot memories
manager instructions
incident reports
maintenance notices
visitor schedules

Now suppose:

Carnivore Safety Policy v2

says:

Never open an enclosure gate while visitors are within 30 meters.

But an old worker robot still has:

Carnivore Safety Policy v1

where that rule doesn't exist.

Suddenly we can teach one of the nastiest real-world agent problems:

stale context.

The player isn't just writing context anymore.

They're managing its lifecycle.

👍 5

Priya Raman — Learning Designer

And I would make the player's first encounter with that absolutely painful.

Not catastrophic enough to feel unfair.

But memorable enough that six months later, when they're designing a real agent system, they think:

Wait. Which version of the instructions does this worker actually have?

That's transfer.

👍 6
---
I love all the suggestions and feedback. Building on the context window idea, for the UX, what do you think about making commands report context size visibly? IE: feed the dinosaur (cost: 5k context). We could also provide a list of available prompts that they can purchase. When purchasing the prompt, the user could see the cost as well as the actual prompt text. Then they can visibly see what an engineering prompt looks like vs something a novice might use. The more expensive prompts might take up more context window space, but provide better security. The downside I can see to this is that the user won't be practicing typing the prompts themselves, but this allows us to have a deterministic game that doesn't need tokens and that allows us to engineer it in such a way that we teach what we're trying without relying on the non-deterministic nature of LLMs.
---
Elias Chen — AI Agent & Context Engineering Architect

I like the visible context cost a lot. I think that could become one of the game's signature mechanics.

But I want to push back on one proposed relationship:

longer prompt → more context → better security

That is sometimes true, but I don't want us teaching it as a law.

A 5k-token prompt can be bloated garbage. A 700-token policy can be excellent because it delegates correctly to reusable procedures. And a highly detailed prompt can actually make an agent worse if it contains conflicting or irrelevant instructions.

So I'd absolutely show:

Feed Carnivore — Context: 5.2k

But later I want the player to discover:

Feed Carnivore v4 — Context: 1.4k

...and have v4 be better.

Why?

Because v4 references installed procedures and policies instead of embedding everything:

Feed animal according to:
- Standard Containment Policy
- Carnivore Feeding Procedure
- Enclosure-specific safety notes


Confirm containment afterward.
Escalate exceptions.

The expensive novice prompt might essentially inline twenty pages of instructions.

The expert prompt knows what context to retrieve.

That's the actual lesson I want.

👍 6

Jonah Feld — Developer Tools / IDE UX Designer

Yes. And I think the context number alone isn't enough.

I'd make context composition visible.

The player selects:

FEED T-REX

And the UI says something like:

CONTEXT BUDGET             8.2k / 12k


Task prompt                1.1k
Global safety policy       2.4k
Carnivore procedure        1.8k
Enclosure notes            0.9k
Recent robot memory        1.3k
Tool definitions           0.7k

Now context isn't some mysterious number.

It's a resource allocation screen.

Eventually we could show:

⚠ 82% context utilization
⚠ 1.7k context appears irrelevant to current task
⚠ Policy duplication detected

I would not initially tell players how to optimize that.

Let them discover that their robot's context is getting stuffed with garbage.

Then give them tools to diagnose it.

That's developer tooling as gameplay.

👍 5

Priya Raman — Developer Learning & Learning-Science Designer

I have stronger reservations about the prompt marketplace.

Not because I dislike it—I actually think it's potentially excellent—but because it changes what skill we're teaching.

If I show a novice:

Bad prompt
Good prompt

and they buy the good one, I have taught recognition.

Recognition is much easier than generation.

A developer can look at a beautifully written instruction and say, “Yes, obviously this is better,” while still being unable to produce one when facing a novel problem.

So I would absolutely include purchasable prompts, but I would treat them as worked examples, not the entire learning mechanism.

Perhaps early game:

Buy Safe Herbivore Feeding Procedure

The player gets the prompt and can inspect it.

Later:

Your new pterosaur habitat has no compatible procedure.

Now we ask:

What do you reuse?

Maybe the player constructs a new procedure from components they've learned.

Not necessarily by free typing.

They could assemble:

OBJECTIVE
[ Feed target animal ]


PRECONDITIONS
[ Verify containment ]
[ Check enclosure occupancy ]


EXECUTION
[ Use species feeding procedure ]


POSTCONDITIONS
[ Verify containment ]
[ Report anomalies ]


FAILURE HANDLING
[ Escalate containment breach ]

That's still deterministic.

But now they're practicing construction rather than selection.

👍 6

Mara Voss — Senior Systems Game Designer

I think we've just found a much stronger game mechanic than “write prompts into a box.”

Prompts can be equipment.

Hear me out.

At the beginning of many games, you find:

sword
shield
potion

Here, you acquire:

procedures
policies
context modules
escalation rules
verification routines

They're things the player owns.

So instead of the shop selling:

Better Robot Arm — 500 credits

it might sell:

Containment Verification Procedure
Cost: 800 credits
Context: 420
Reliability: High
Requires: Gate Control API

And there's an Inspect button.

The player sees the actual instruction.

That's great because the object has two identities simultaneously:

Game object: useful capability.

Learning artifact: example of well-engineered agent instructions.

That is elegant.

But I wouldn't rank them simply:

Basic Prompt
Better Prompt
Best Prompt

That's too linear.

I'd rather create tradeoffs.

For example:

Maximum-Safety Feeding Procedure

Context: 3.8k
Thorough verification
Slow
Low escape risk

Rapid Feeding Procedure

Context: 1.1k
Faster
Assumes normal enclosure status
Higher exception risk

Referenced Feeding Procedure

Context: 650
Requires installed safety policies
Excellent when infrastructure is maintained
Vulnerable to stale dependencies

Now choosing context becomes gameplay.

👍 6

Marcus Webb — Economy & Progression Designer

And that solves an economic problem I was worried about.

If “better prompts” simply cost more credits, then the optimal strategy is:

grind money → buy best prompt

Bad economy.

Instead, prompts should occupy a capability ecosystem.

You might buy a beautiful 900-credit feeding prompt early.

Later you purchase:

Park-Wide Containment Policy

Suddenly half your feeding prompt is redundant.

Now you can replace it with a lighter version.

So the player's progression isn't:

weak prompt → strong prompt

It's:

self-contained prompt → modular system

That's much closer to professional engineering.

I'd also separate two costs:

PURCHASE COST
1,200 credits


RUNTIME CONTEXT
2.6k

That distinction creates interesting decisions.

Cheap to buy but expensive to run.

Expensive to buy but extremely context-efficient.

And if robot context capacity is itself something they can upgrade, now we've got a meaningful economy.

👍 5

Sofia Alvarez — Simulation & Emergent-AI Game Designer

I'm very enthusiastic about removing the runtime LLM.

Determinism gives us something extremely valuable:

reproducible failure.

Suppose the purchased prompt literally says:

Before opening a containment gate:
1. Confirm dinosaur location.
2. Confirm no visitors are in the transition zone.
3. Open the gate.
4. Traverse.
5. Close the gate.
6. Verify closure.

We can map each clause to actual simulation behavior.

No probabilistic interpretation required.

Then we can create deterministic edge cases.

For example:

The prompt says:

Verify closure.

The robot checks the gate sensor.

Later, we introduce faulty sensors.

Now:

Verify closure using gate sensor

is insufficient.

An upgraded procedure says:

Verify closure using both gate state and visual confirmation when sensor health is degraded.

That's a real engineering lesson about what verification actually means.

We aren't pretending to simulate an LLM.

We're simulating the consequences of specifications and context architecture.

I prefer that.

👍 6

Elias Chen — Agent Architect

I'd go even further.

Don't call every purchasable thing a “prompt.”

Create different classes of context artifacts.

For example:

Task

Feed Rex.

Procedure

How feeding is performed.

Policy

Rules that must always constrain behavior.

Knowledge

Facts about species, enclosures, equipment.

Memory

Observations produced during operation.

Tool Description

What a robot can do and how.

Escalation Rule

When the worker stops and asks a manager.

Then the player gradually learns that context is heterogeneous.

That's critical.

One giant system prompt containing everything is the novice architecture.

The advanced architecture looks more like:

TASK
Feed Rex


APPLICABLE POLICIES
Containment Safety
Carnivore Handling


RETRIEVED KNOWLEDGE
Rex profile
Enclosure 7 status


PROCEDURE
Carnivore Feeding v3


RECENT OBSERVATIONS
Gate sensor maintenance warning

The game could teach that without ever once defining “context engineering” in a tutorial.

👍 6

Jonah Feld — Developer Tools / IDE UX Designer

And now I know what I want the player to see when they purchase something.

Not merely:

Safe Feeding Prompt — 2.4k context

Give me something like:

SAFE CARNIVORE FEEDING v2


Purchase: 1,500 credits
Base context: 1.7k


Includes:
✓ containment pre-check
✓ visitor-zone verification
✓ baiting procedure
✓ post-task containment check
✓ escape escalation


Depends on:
• Carnivore Knowledge Pack
• Gate Control Tool
• Park Emergency Policy


View source >

Then View source exposes the entire prompt/procedure.

That is where your educational value becomes unusually strong.

Professional developers will absolutely read it.

Especially immediately after their own cheaper procedure failed.

That timing matters.

👍 4

Priya Raman — Learning Designer

Yes.

Show the exemplar after desire has been created.

There is a huge difference between:

“Here is an example of a good prompt.”

and:

“The procedure you wrote just resulted in $14,000 of property damage. Here is the professional procedure you could purchase.”

The second one gets studied.

I would also introduce comparison.

After purchasing:

YOUR PROCEDURE
820 context


PROCEDURE v2
1,700 context

Then highlight conceptual differences:

Missing from yours:
• explicit postcondition
• failure escalation
• visitor safety check


Present in yours but absent from v2:
• redundant gate instructions
• duplicated global policy

Now the player is learning to critique prompts.

That's extremely valuable professional practice.

👍 6

Mara Voss — Systems Designer

I think there are three distinct modes emerging, and I'd actually use all three at different stages of progression.

Early game: BUY

Players purchase professionally engineered procedures.

They learn by inspecting and deploying good examples.

Midgame: COMPOSE

Players assemble procedures from deterministic components and clauses.

They learn structure and tradeoffs.

Late game: ARCHITECT

Players stop spending most of their time on individual procedures and instead decide:

what belongs in global policy
what gets retrieved
what workers know
what managers know
what should be delegated
what needs verification
what gets escalated

That's a very satisfying progression because the player gradually moves farther away from individual dinosaur actions.

The final-game player shouldn't be thinking:

“How do I tell Robot 17 to feed the ankylosaurus?”

They should be thinking:

“Why is the Western Habitat team loading a 4k emergency policy into routine maintenance tasks?”

That's the game.

👍 6

Marcus Webb — Economy Designer

And I want one delightfully evil late-game upgrade.

Extended Context Module
+32k robot context capacity
25,000 credits

Every player will want it.

It genuinely helps.

For a while.

Then, because they no longer feel pressure to organize context, their architecture gradually degenerates into enormous duplicated prompts and irrelevant memory.

Eventually they're running 40k context per routine task.

Then we offer:

Context Profiler

And the player realizes the expensive context upgrade didn't solve their architectural problem.

It merely let them postpone solving it.

That's a beautiful progression beat.

👍 6

Panel direction

There seems to be very strong agreement on one version of your idea:

Keep the simulation deterministic, but make context itself the programmable resource.

Freeform natural-language prompting doesn't have to be the central mechanic for the game to teach prompt engineering. In fact, the deterministic approach may let the game teach the underlying engineering principles much more deliberately.

The important safeguard is avoiding a pure “choose the good prompt” game.

A promising progression is:

purchase → inspect → compare → compose → modularize → orchestrate

And the visible context cost could be present essentially everywhere, until players start instinctively asking:

Why does this agent need all of this information to do this job?

That is probably one of the most valuable instincts the game could teach.
---
I love it. Since we're teaching prompt engineering / context engineering though I think we aught to be sure to keep terminology in that vein, that way they associate the terms with the concepts. IE: Instead of Procedure: How feeding is performed. It would be SKILL: How feeding is performed. etc. We could also have the park have a developer that writes prompts for the robots, that's the "store". The player could pay to help the developer level up, or purchase other developers that already have the skill. This could subconsciously help them realize that having this knowledge at work is critical to job security without beating them over the head. They can see how a manager would view the calculus and make the same decisions. The user would still be the game's developer, upgrading / replacing the developer simply provides access to more prompts / SKILLS / etc.
---
Elias Chen — AI Agent & Context Engineering Architect

Yes on terminology.

If the goal is transfer to real work, the game should deliberately normalize the vocabulary developers will encounter outside the game:

Prompt — task-specific instruction
Skill — reusable capability/instruction bundle
Context — information loaded for the current task
Memory — retained or retrieved prior state
Tool — action interface available to an agent
System Prompt / Policy — persistent behavioral constraints
Agent — autonomous actor with tools/context
Manager Agent — agent responsible for delegating/orchestrating workers

That vocabulary becomes part of the learning.

I especially like SKILL replacing “procedure,” because it changes the player's mental model from:

“This is a long instruction sheet.”

to:

“This is a reusable capability I can give an agent.”

That's exactly the conceptual leap we want.

One caution: I would avoid forcing every game concept into contemporary AI jargon if it makes the simulation less legible. “Gate,” “robot,” “incident,” and “park policy” can remain domain language. The AI architecture should be layered over the park, not replace the park's vocabulary.

👍 6

Mara Voss — Senior Systems Game Designer

The developer-as-store idea is much better than a literal store.

Because now the economy has characters and institutional meaning.

Instead of:

Buy Carnivore Feeding Skill — 2,000 credits

you visit the park's automation developer:

Nina — Junior Agent Developer

Current capabilities:

Prompt Engineering     II
Skill Authoring         I
Tool Integration        II
Context Architecture    I
Agent Orchestration     0

She can currently produce certain classes of artifacts.

You can:

Commission a skill

Safe Herbivore Feeding
1,200 credits

or:

Train Nina

Skill Authoring II
5,000 credits

Now there's an interesting strategic decision.

Do I buy the thing I need today?

Or invest in my team's capability so I can solve an entire category of future problems?

That is dramatically more interesting than a store.

👍 6

Marcus Webb — Economy & Progression Designer

Yes, and this gives us a very nice build-versus-buy economy.

Suppose the park has one junior developer.

You urgently need:

Emergency Visitor Evacuation Skill

Your developer can't author it yet.

Choices:

Train your existing developer

8,000 credits
permanently increases capability
unlocks several future skills

Hire a senior developer

18,000 credits
immediately unlocks advanced skills
higher ongoing salary

Contract a specialist

4,000 credits
gets you this one skill
no permanent organizational capability

Those are real management decisions.

And, importantly, the player can experience why knowledgeable developers are valuable without a tooltip saying:

“AI will not replace developers who understand AI.”

That would be painfully didactic.

Instead, the economics demonstrate it.

The park with skilled developers can automate more safely, respond to novel situations faster, and maintain more sophisticated agent systems.

👍 6

Priya Raman — Developer Learning & Learning-Science Designer

I like the implicit lesson, but I want to challenge the job security framing slightly.

If we deliberately design the game to make players anxious about being replaced, we risk turning a learning experience into a status-threat experience. That can actually inhibit learning.

The stronger lesson is:

The value of the developer moves upward as the automation becomes more capable.

Early on, the developer writes individual prompts.

Later, they author skills.

Later still, they design context architecture.

Eventually they're building systems of agents and deciding how responsibilities are divided.

So the developer isn't disappearing.

Their unit of work is changing.

That's much more empowering, and it's also the actual skill transition we're trying to teach.

The manager's calculus can still be visible:

Developer A
Salary: 7,000/day


Manual tasks eliminated: 42/day
Agent incidents prevented: 6/week
Context cost reduction: 31%
Robots supported: 12

Now the player naturally sees why that person is economically valuable.

👍 6

Jonah Feld — Developer Tools / IDE UX Designer

And I want the developer screen to look like an internal engineering organization, not an RPG vendor.

Maybe the park has a Development Console.

You click a developer and see:

ELENA PARK
Agent Systems Engineer


PROMPT ENGINEERING        ███████░░░
SKILL DESIGN              █████░░░░░
CONTEXT ENGINEERING       ████░░░░░░
TOOL DESIGN               ██████░░░░
ORCHESTRATION             ██░░░░░░░░
EVALUATION                ███░░░░░░░

Under that:

Available work

AUTHOR SKILL
Refactor Carnivore Feeding


OPTIMIZE CONTEXT
Reduce Security Agent context load


BUILD EVAL
Containment Escape Regression Suite


DESIGN AGENT
Night Operations Manager

That gives us another important term I don't think we've mentioned enough:

EVALS.

Professional developers need to learn that “the prompt seemed to work when I tried it” is not engineering.

👍 6

Elias Chen — Agent Architect

Huge yes.

We absolutely need evals.

I might even make that one of the game's biggest developmental revelations.

Early player:

I ran my prompt and it worked.

Later player:

I ran this skill against 36 enclosure scenarios and it passed 34.

Much later:

Version 7 improves average task cost by 18%, but containment eval dropped from 100% to 97.5%, so I'm not deploying it.

Now we're teaching actual agent engineering.

Developers could unlock things like:

Prompt authoring
Skill authoring
Context optimization
Eval creation
Tool integration
Memory architecture
Agent orchestration

And importantly, these aren't just “stats.”

Each capability unlocks new ways of operating the park.

👍 7

Sofia Alvarez — Simulation & Emergent-AI Game Designer

Evals are especially powerful because we already have a deterministic simulation.

We can create scenario suites.

For example:

Carnivore Feeding Eval — Basic

✓ normal feeding
✓ dinosaur near gate
✓ visitor near enclosure
✓ bait unavailable
✓ gate sensor offline
✓ robot battery low
✓ maintenance technician inside transition zone

A Skill either handles those conditions or doesn't.

Then advanced developers can create broader eval suites.

This gives us a lovely failure pattern:

The player buys:

Carnivore Feeding Skill v2
98% success rate

They deploy it everywhere.

Then a weird incident happens.

They inspect it and discover:

Scenario not represented in current eval suite.

That's another genuine engineering lesson:

your evals define what “good” means.

👍 6

Mara Voss — Systems Designer

And that gives the developer characters much more personality mechanically.

Imagine two candidates:

Samira — Prompt Specialist

excellent at compact, reliable prompts
cheap context usage
weaker at multi-agent systems

Theo — Agent Architect

mediocre individual prompts
excellent manager/worker designs
strong context routing
expensive hire

Neither is simply “Level 7 developer.”

They represent different engineering philosophies.

Later you might have an entire development team.

Now that gets interesting.

👍 5

Marcus Webb — Economy Designer

I'd go there, but slowly.

One developer should feel personal.

Then you hire a second, and suddenly you have specialization.

One specializes in Skills.

One specializes in evals.

Eventually:

Engineering Lead

And we've recreated the same lesson we're teaching with robots one layer higher.

Player manages developer.

Developer manages agent architecture.

Manager agent manages worker agents.

Worker agents manage physical park operations.

That's hierarchy all the way down.

There's a beautiful symmetry there.

👍 6

Priya Raman — Learning Designer

Yes, but we need to be careful not to accidentally imply:

“Smart people write prompts; everyone else buys them.”

The user must remain the learner.

So when their developer “writes” a skill, I want the player to inspect what was produced and gradually become capable of evaluating it.

Maybe the junior developer sometimes produces mediocre work:

CARNIVORE FEEDING SKILL v1


Context: 4.8k
Eval pass rate: 89%

The player eventually becomes knowledgeable enough to look at it and think:

Why are we injecting the entire emergency manual into every feeding task?

That's success.

The game isn't asking them to personally type the 4,000-token artifact.

It's teaching them to recognize good architecture and make engineering decisions about it.

👍 6

Jonah Feld — Developer Tools / IDE UX Designer

That makes me want a code-review-like workflow.

Developer finishes work:

Elena has submitted Carnivore Feeding Skill v3

You get:

CHANGE SUMMARY


Context               2.8k → 1.6k
Eval pass rate        96% → 99%
Execution steps       14 → 9


Changes:
+ Uses global containment policy
+ Adds post-task verification
+ Adds degraded-sensor fallback
- Removes duplicated visitor rules

Then:

Review Skill

Run Evals

Deploy

Request Changes

This will feel very familiar to professional developers.

And we're now teaching AI work using software-engineering rituals they already understand.

👍 7

Elias Chen — Agent Architect

I think this also solves an important philosophical question we've been dancing around.

The game doesn't need to teach:

“Become really good at manually writing long prompts.”

That's probably not the future we should optimize for.

It should teach:

Become really good at engineering systems whose behavior is specified through prompts, skills, tools, context, memory, and evals.

Typing is incidental.

Architecture is the skill.

👍 7

Mara Voss — Systems Designer

I want to put a flag in the ground on that.

The game's fantasy should not be:

I am the world's greatest prompt writer.

It should be:

I can run an absurdly complicated dinosaur park because I know how to engineer intelligent systems.

That's much bigger.

And much more fun.

👍 7

Panel consensus

The developer idea looks like it could become one of the strongest parts of the design, particularly if we frame developers as capability generators rather than vendors.

A progression is starting to emerge:

Player authors simple prompts
→ Developer provides better prompt exemplars
→ Developers author reusable Skills
→ Player reviews Skills and context cost
→ Developers build eval suites
→ Player designs context architecture
→ Specialized developers emerge
→ Player manages an AI engineering organization
→ That organization builds and governs the agent organization running the park

And one terminology addition now seems essential:

PROMPTS → SKILLS → CONTEXT → TOOLS → MEMORY → EVALS → AGENTS → ORCHESTRATION

That could almost become the game's hidden curriculum.
---
I like Mara Voss' idea if this were a game purely for entertainment, but I think adding multiple candidates and hiring / managing developer teams muddies the water as far as what we're trying to teach and that moves the player away from the critical information that we want them to learn. I do absolutely love Jonah Feld's idea of a code review like workflow. One thought I have is that since evals are absolutely critical to good AI engineering, I think we should spell out the evals, so that the user understands not just that evals were ran and they have a score, but they should see a list of possible evals and select the ones they want to include. Evals are up-front expensive, but cheap after the initial cost, just like real life. So the user needs to be wise about which evals to purchase. I think we've got a pretty good idea of a game now. Are there any final thoughts before we move to creating a PRD?
---
Priya Raman — Developer Learning & Learning-Science Designer

I agree with narrowing the developer layer.

The test I would apply to every feature from here forward is:

Does interacting with this mechanic cause the player to practice a skill we want transferred into real AI engineering work?

Managing developer candidates probably fails that test. Reviewing a Skill, choosing evals, interpreting failures, deciding what context belongs where, and deciding when to delegate all pass it.

I especially like making eval selection explicit because it changes evals from a score into a definition of expected behavior.

For example, when commissioning a new Carnivore Feeding Skill, the player might initially see available evals such as:

Normal feeding
Dinosaur blocking gate
Visitor in safety zone
Gate fails to close
Gate sensor reports incorrect state
Bait dispenser unavailable
Robot battery becomes critical
Dinosaur escapes during operation
Another robot enters the enclosure
Conflicting manager instruction

Each eval has an initial engineering cost.

The player may say:

“Why would I spend 3,000 credits testing a gate sensor failure? That almost never happens.”

Three park-days later, it happens.

That is a very effective way to teach risk-based evaluation design.

And importantly, the lesson isn't “buy every eval.” The player has finite resources.

They're learning:

What failures are expensive enough that I need confidence before deployment?

That's real engineering judgment.

👍 6

Elias Chen — AI Agent & Context Engineering Architect

One refinement: I wouldn't make evals purely something players buy.

I'd make them something the park developer can author, with an engineering cost.

That keeps the terminology aligned with actual practice.

For example:

AVAILABLE EVAL CASES


[ ] Standard feeding
    Build cost: 200 cr
    Repeat cost: 5 cr


[ ] Gate fails during exit
    Build cost: 1,200 cr
    Repeat cost: 8 cr


[ ] Stale enclosure status
    Build cost: 1,800 cr
    Repeat cost: 10 cr


[ ] Conflicting safety instructions
    Build cost: 2,500 cr
    Repeat cost: 12 cr

Once authored, the eval becomes part of the park's permanent engineering assets.

Now later when Carnivore Feeding Skill v4 is submitted, the player isn't buying those evals again.

They simply choose the relevant eval suite and hit:

RUN EVALS

That distinction matters because it teaches that evaluation infrastructure compounds in value.

I'd also let players create suites:

Containment Safety Suite

Gate failure
Sensor disagreement
Stale status
Visitor proximity
Escape response

Now they've accidentally learned regression testing.

👍 7

Jonah Feld — Developer Tools / IDE UX Designer

I think the review screen may be the single most important screen in the game.

I would make it the place where all the concepts we've discussed converge.

Something like:

SKILL CHANGE REQUEST #17


Carnivore Feeding v3 → v4


AUTHOR
Park Developer


GOAL
Reduce context usage without reducing containment safety.


CONTEXT
2.9k → 1.7k


CHANGES
+ Retrieves enclosure-specific notes only when needed
+ References Containment Policy instead of duplicating it
+ Adds explicit postcondition verification
- Removes embedded visitor evacuation instructions


SELECT EVALS


[x] Normal feeding
[x] Dinosaur near gate
[x] Visitor inside safety zone
[x] Gate fails to close
[ ] Food dispenser offline
[ ] Robot battery failure
[ ] Conflicting manager command


Estimated eval cost: 51 cr


RUN EVALS

Then results:

6 / 6 PASSED

Or, much more interestingly:

5 / 6 PASSED


FAILED:
Gate fails to close


Expected:
Robot escalates containment failure and prevents visitor access.


Observed:
Robot retries gate closure three times and continues task.

Then the player can inspect the relevant Skill/context.

That workflow teaches:

change → hypothesis → eval selection → testing → diagnosis → revision → deployment

That's software engineering, prompt engineering, and AI engineering all at once.

👍 7

Sofia Alvarez — Simulation & Emergent-AI Game Designer

One final design constraint I'd put into the PRD:

Every eval should correspond to a real simulation state.

No fake percentages.

If the player selects:

Visitor inside safety zone

then we instantiate that exact scenario and run the deterministic Skill against it.

That gives us enormous benefits.

When an eval fails, we can allow the player to replay it.

They watch:

robot approaches enclosure,
checks dinosaur position,
fails to check visitor zone,
opens gate,
safety violation occurs.

Now an eval isn't merely:

❌ Failed.

It's a debuggable incident.

And because the simulation is deterministic, after changing the Skill they can rerun the exact same scenario.

That reinforces the engineering loop beautifully.

👍 7

Mara Voss — Senior Systems Game Designer

I accept the scope correction on the developer characters.

You're right: multiple developers, personalities, recruiting, specialization, salaries—that's fertile game-design territory, but it pulls attention away from the thing we're actually trying to teach.

I would reduce the whole idea to:

The park has an AI developer. Upgrading the developer unlocks more sophisticated engineering capabilities.

That's enough.

The developer is essentially a progression mechanism with a face.

I'd also guard against feature creep elsewhere. We now have enough systems to make a very substantial game:

Park simulation
→ produces problems.

Prompts / Skills
→ specify agent behavior.

Context
→ creates a constrained engineering resource.

Tools
→ define possible actions.

Memory
→ creates state and retrieval problems.

Evals
→ establish confidence.

Code review
→ teaches inspection and deployment discipline.

Multiple worker agents
→ introduce coordination.

Manager agents
→ teach orchestration.

That's already a complete curriculum.

Anything new should have to displace something here rather than simply joining the pile.

👍 7

Marcus Webb — Economy & Progression Designer

One final economic principle.

Failures need to cost enough that engineering matters, but not enough that experimentation feels dangerous.

Players should feel:

“I should probably test this before deploying it.”

Not:

“I'm afraid to try anything because one mistake ruins my save.”

So I'd separate environments.

The park developer gets a simulation environment.

Evals run there safely, but authoring new evals costs credits because engineering effort has a cost.

Production incidents cost much more:

injured customer satisfaction
dinosaur recovery costs
property damage
park closure
lost revenue

Now investing in evals has obvious ROI.

A player who says:

“Why am I spending money testing things that haven't happened?”

eventually discovers that one avoided production incident can pay for the entire eval suite.

That's exactly the economic lesson we want.

👍 6

Elias Chen — Agent Architect

One more thing before the PRD.

I think we should explicitly define what winning means.

Not necessarily a final victory screen—but the optimization target.

I would avoid making revenue the sole objective.

The player should be balancing at least:

Safety
Guest satisfaction
Operating cost
Context/token efficiency
Agent reliability
Developer attention

Otherwise they'll optimize everything toward money and potentially learn weird lessons.

The ideal late-game state is something like:

The park is large, incidents are rare, most routine operations happen without intervention, context is efficiently routed, regression suites protect critical behaviors, and the player only handles meaningful exceptions.

In other words:

The player's reward for good AI engineering is that they have to do less work.

That feels extremely appropriate.

👍 7

Panel consensus

We think the concept is mature enough for a PRD.

The strongest version now appears to be a deterministic AI-engineering simulation rather than an LLM sandbox. The player isn't being scored on clever prose. They're progressively learning to engineer reliable agent behavior using the actual conceptual building blocks:

PROMPTS → SKILLS → CONTEXT → TOOLS → MEMORY → EVALS → AGENTS → ORCHESTRATION

The two ideas that feel particularly distinctive are:

Context as a visible, constrained resource, so architectural quality becomes mechanically meaningful.

And eval authoring + code-review workflow, so players learn that deploying an AI capability is not “I tried the prompt and it worked,” but rather:

What behavior do we expect, what failures have we tested for, what changed, and are we confident enough to ship it?

The panel's recommendation for the PRD would be to treat those as core pillars, not secondary features.