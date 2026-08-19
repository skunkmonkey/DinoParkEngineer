# Plan: Trace and Replay

## Proposed Vertical Slices

1. **One feeding action yields a navigable structured trace**
   - Blocked by: Simulation #1-#3, Instruction #1-#4, Context #1-#3
   - Adds trace/event identity, exact content manifest, decision-cycle capture,
     tool evidence, world deltas, outcome, and concise/detail projections.
   - Tests: exact ordering, causal links, authoritative values, prohibited-field
     schema, and atomic finalize.
   - Browser proof: follow feeding outcome to Task, context, clause, tool, and
     world delta by keyboard.

2. **Missing maintenance context is visible without implying Agent knowledge**
   - Blocked by: #1, Context #2
   - Adds unavailable/excluded/stale distinctions, immediate causal-gap
     projection, entity/artifact links, filters, and persistent exact details.
   - Tests: absent data never appears as used, filter immutability, stable links,
     and concise expected/observed/consequence/gap view.
   - Browser proof: diagnose the opening near miss from park consequence.

3. **Historical replay synchronizes world and trace**
   - Blocked by: #1-#2
   - Adds isolated replay session, play/pause/step/seek/speed, event focus,
     snapshots/deltas, and persistent historical framing.
   - Tests: seek correctness, mode isolation, production unchanged, long trace,
     and version-resolution failure.
   - Browser proof: step through the near miss with world and selected event in
     sync and distinguish it without color.

4. **Authoritative rerun proves exact equivalence**
   - Blocked by: #3
   - Adds fixture/command rerun, exact event/final-state comparison, mismatch
     report, schema compatibility, and trace pair comparison.
   - Tests: exact pass, changed command, changed version, missing content,
     mismatched event, and aligned/unmatched comparison.
   - Browser proof: compare failed and revised feeding traces cycle by cycle.

5. **Trace and Replay validation gate**
   - Blocked by: #1-#4
   - Adds indexed mature traces, performance measurement, architecture lint,
     accessibility tests, and full validation wiring.
   - Browser proof: causal navigation, replay controls, compare, long trace,
     keyboard, text scaling, and reduced motion.
