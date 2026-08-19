# Plan: Simulation

## Proposed Vertical Slices

1. **A headless clock moves one robot in an exact fixture**
   - Blocked by: Content Registry #1-#2
   - Adds serializable world state, integer ticks, stable IDs/order, pause/speed
     request semantics, validated movement commands, projections, and a seed.
   - Tests: exact state, invalid move, pause, speed-equivalence, serialization,
     and Node/browser parity.
   - Visible proof: a shell fixture displays tick, robot position, pause, and
     speed without PixiJS owning state.

2. **Gate traversal proves simulation authority**
   - Blocked by: #1
   - Adds enclosure graph, gate/closer/sensor state, open/close/lock commands,
     scheduled transitions, source-labeled evidence, and atomic rejection.
   - Tests: normal gate, disabled closer, jam, degraded sensor disagreement,
     stale command, and exact deltas.
   - Visible proof: command buttons change a projected gate while reported and
     physical state remain separately inspectable.

3. **Dinosaur feeding creates a deterministic containment outcome**
   - Blocked by: #2
   - Adds dinosaur need, agitation, target behavior, feeding/bait tools, robot
     carried state, containment calculation, and escape movement.
   - Tests: safe feeding, open-gate escape, baiting, failed tool, and replay
     equivalence.
   - Visible proof: run and replay the same feeding fixture with matching events.

4. **Visitors turn containment into credible stakes**
   - Blocked by: #3
   - Adds visitor groups, movement, exposure, panic, evacuation, injury/casualty
     resolution, hazards, and accessible projection fields.
   - Tests: safe opening, exposure, evacuation, injury, casualty, deterministic
     tie-breaking, and no humor/state coupling.
   - Visible proof: inspect exact visitor safety state and event history.

5. **Two robots contend for one gate without hidden randomness**
   - Blocked by: #2-#4
   - Adds shared-resource contention/reservations, deterministic command-batch
     order, maintenance interaction, and mature fixture density hooks.
   - Tests: simultaneous commands, stable winner, released reservation,
     maintenance-disabled closer, and frame-rate independence.
   - Visible proof: run the shared-gate conflict twice with identical outcome.

6. **Simulation validation gate**
   - Blocked by: #1-#5
   - Adds golden fixtures, worker-ready serialization contracts, performance
     measurements, architecture lint, and full validation integration.
   - Tests: focused domain suite plus repository validation.
   - Browser proof: pause/speed, safe feeding, escape, visitor exposure,
     contention, replay, keyboard inspection, and reduced motion.
