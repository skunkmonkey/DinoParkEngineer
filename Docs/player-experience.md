# Player Experience first playable

The Park route now renders the first playable dawn loop through the
`player-experience` public entry. It is a hybrid presentation:

- `runtime.ts` composes the Simulation and Park Operations public services. It
  issues only typed domain commands and keeps an immutable snapshot for React.
- `projection.ts` maps the authoritative world and operations read models to a
  stable three-quarter dawn scene. Camera movement, semantic zoom, occlusion,
  cues, and interpolation are view-only calculations.
- `pixi-scene.ts` initializes PixiJS 8 with `preference: "webgl"` and
  `powerPreference: "high-performance"`. The approved `assets:bundle-mvp-park@
  1.0.0` atlas is loaded when available. Shape placeholders remain visibly
  labeled if the atlas or renderer cannot initialize.
- `view.tsx` owns responsive DOM chrome, the semantic navigator, pointer hit
  targets, Inspector, time controls, mode framing, accessibility preferences,
  and persistent event history. Canvas content never carries the only copy of
  a state or action.
- `audio.ts` is a replaceable Web Audio adapter. Unlock is attempted only from
  user action, volume and mute are explicit, and every cue returns a persistent
  text substitute even when audio is unavailable or autoplay-blocked. The React
  adapter defers final disposal across Strict Mode's development-only effect
  rehearsal and requests the first tone only after asynchronous unlock resolves.

The opening fixture presents Tria, Robot Alpha, Gate Alpha, approaching
visitors, a due exact-version feeding job, and the tick-300 pausable deadline.
Assigning the job and choosing **Feed Tria through Inspector** runs a stable
gate-open, enter, close, feed, exit, restore-containment command batch. The
simulation batch is atomic; a rejected command leaves the authoritative world
unchanged. The Inspector's feeding delta is captured from the exact pre/post
world snapshots, so advancing logical time before feeding cannot leave stale
evidence. A separate one-shot **Stage recoverable near miss** action ingests correlated
warning/emergency signals, groups one incident, auto-pauses both services, and
exposes expected/observed/consequence/immediate-gap/Trace fields. The incident
can be stabilized, verified, closed, and resumed without a casualty.

The responsive grid removes intrinsic minimum widths from both primary columns.
At the narrow 390-pixel breakpoint, 100% and 150% player text therefore reflow
without horizontal document overflow.

Focused Shell routes are `/pause`, `/workbench`, `/eval`, `/replay`, and
`/review`. Each route has persistent text/shape mode framing and starts with
production paused.
The `/park` alias and `/` safe route both use the same Park projection.
