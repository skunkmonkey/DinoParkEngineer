# Player Experience first playable

## Management-game remediation

Park View is now a viewport-bound management-game shell instead of a stacked
document. The root route and `/park` both load the living park. A compact HUD
keeps Park time, rating, credits, emergencies, and the current objective above
the dominant scene; pause/speed and the persistent Park log stay in the bottom
action strip. The selected Inspector is an independently scrolling dock that
can be dismissed and reopened without leaving the park.

Global destinations and accessibility/offline controls live in **Game menu**
and **Settings** drawers. Diagnostics are nested and Shell history renders only
in diagnostic modes. Focused Workbench, Eval, Review, Incident Response, Save,
Economy, and Scenario routes scroll inside the application viewport; primary
review/response decisions remain sticky while long evidence uses explicit
disclosures or an internal evidence scroller.

`presentation.ts` maps stable domain identity to deterministic routine names
such as Tria, Vera, Robot Alpha, South Habitat Gate, North Paddock Gate, and
Opening-Day Near Miss. Stable IDs, versions, fingerprints, reason codes, and
manifests remain in **Inspect evidence**, **Advanced details**, replay, export,
or diagnostics. The permanent Visual grammar legend, renderer narration,
authoritative-state narration, retention demo, and acceptance-test copy were
removed from routine play.

`pixi-scene.ts` now authors two bounded habitats with distinct ground, water,
shade, feeders, fence posts, gates, connected visitor and service routes, a
Robot depot, arrival pavilion, and landscaping. Projection-frame animation
adds restrained dinosaur, Worker Agent, visitor, route, need, degraded-gate,
selection, and emergency feedback. It is presentation-only; reduced motion
returns static positions and the DOM retains every state and action.

The Shell accessibility port is the only application text-scale source. It is
provided to every route, persisted in local storage, and applied through the
root `--dpe-player-font-scale`. Feature CSS no longer redeclares that property.
An automated ownership test fails if a feature shadows the root scale.

Connected-Chrome verification covers 1366×768 and 1440×900 desktop viewports,
keyboard drawer dismissal with focus return, standard/high-contrast and
standard/reduced-motion presentation, sound substitutes, independently
scrolling Inspector evidence, and the Park → incident → Workbench → Eval →
Review → Park path at narrow 200%-zoom-equivalent reflow geometry. The
Shell-owned 100%, 125%, and 150% text preference was also exercised across
every Phase 7 route without feature-level variable shadowing.

## Phase 6 near-miss diagnosis

The opening includes Enclosure Beta, Vera, and a visibly disabled Gate Beta automatic closer before the second feeding. Reusing the first feeding instruction executes authoritative gate and bait commands, advances one logical tick, fails the exact second job, moves Vera onto the keeper path, groups the world and Context symptoms into one incident, focuses the enclosure, and pauses production. Stabilization returns Vera and physically closes Gate Beta while leaving the engineering cause unresolved.

The incident Inspector exposes the preserved route from Park event through job, action, unavailable Context, Trace evidence, and responsible Prompt. Its Workbench link carries those stable IDs, and the Workbench return link retains the incident ID.

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
- `view.tsx` owns the viewport HUD, optional Park roster, pointer hit targets,
  Inspector, time strip, mode framing, and persistent Park log. Canvas content
  never carries the only copy of
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
evidence. The second-feeding action ingests correlated warning/emergency
signals, groups one incident, auto-pauses both services, and
exposes expected/observed/consequence/immediate-gap/Trace fields. The incident
can be stabilized, verified, closed, and resumed without a casualty.

The responsive grid removes intrinsic minimum widths from both primary columns.
At the narrow 390-pixel breakpoint, 100% and 150% player text therefore reflow
without horizontal document overflow.

Focused Shell routes are `/pause`, `/workbench`, `/eval`, `/replay`, and
`/review`. Each route has persistent text/shape mode framing and starts with
production paused.
The `/park` alias and `/` safe route both use the same Park projection.

## Phase 7 focused continuity and Context presentation

The Player Experience snapshot now owns a thin, read-only operational anchor
for every mode. It includes exact production pause/phase/day/tick state, rating,
credits, active emergency count, selected production artifact version, and a
stable causal breadcrumb. These values are presentation inputs or projections;
Player Experience does not own Economy, deployment, Eval, Replay, or Context
rules.

The Gate Beta near miss creates one `CausalNavigation` record pinned to the
incident, originating park event, Gate Beta, failed job, Trace, artifact
version, and logical tick. Workbench, Eval, and Historical Replay links carry
that identity plus an encoded return URL. Eval and Historical Replay display a
shared synchronization key and explicitly say that their isolated/frozen views
do not mutate production. Returning selects the exact originating entity and
reconstructs the grouped event.
The displayed status, result ID, candidate, Trace, and historical-replay
session come from `runOpeningMaintenanceContextEval()`; the presentation does
not invent Eval evidence.

Opening guidance advances only through explicit player interactions: world cue,
affordance emphasis, concise hint, and explicit help. Selecting the relevant
entity or assigning the job completes the guidance immediately, and the player
can dismiss it at any stage. The permanent reward projection is invariant under
guidance, pause, and speed choices.

Retention presentation is likewise deterministic and non-authoritative. The
first event uses a 1,200 ms memorable presentation, later events use 240 ms,
and reduced-motion mode uses a static 0 ms presentation. Animation is never the
only evidence: every event remains in the semantic DOM and persistent history
with exact item ID, `Excluded`, `Compacted`, or `Externalized` lifecycle,
reason code, and destination.
