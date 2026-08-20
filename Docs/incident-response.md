# Incident Response

Incident Response is an external, deterministic safety service. It reads an
exact grouped Park Operations incident and Simulation snapshot, presents an
inspectable plan, reserves its quoted callout through Economy, and acts only
after explicit manual activation.

The MVP plan includes location, immediate risks, authored capabilities,
unavailable reasons, dispatch and arrival ticks, duration, itemized quote,
closure, preconditions, and stabilization boundaries. Its lifecycle is driven
only by integer park ticks: requested, dispatched, en route, operating, an
optional limited or failed state, stabilized, and complete.

Stabilization uses the existing Simulation public commands. Visitor evacuation
uses `evacuate`, temporary containment uses `operate-gate` with `close`, and an
operational stranded robot follows an authored adjacent route with `move` to a
service location. Command rejection is retained as evidence and limits or fails
the response; the service never bypasses access, capacity, health, tool, gate,
or route constraints.

The service accepts only Simulation, Park Operations, and Economy mutation
ports. It has no Context, artifact, route, Retention Policy, review, or
deployment mutation capability. Its before/after engineering-boundary
fingerprints remain equal, original Trace IDs remain linked, and Park
Operations finishes stabilization in `engineering-unresolved`. Correcting and
deploying the engineering cause remains a separate workflow.

`createIncidentResponseFoundationFixture()` supplies the hazardous Strict-stop
scenario used by domain tests and player-facing integration. UI integration
should render the complete `ResponsePlan`, require a native-button confirmation
for `activate`, advance the service with park ticks, and persist the full
response record and command evidence.
