import { createEconomyService } from "../economy-progression/public.js";
import { createParkOperations, createParkOperationsFoundationFixture } from "../park-operations/public.js";
import { createSimulation, createSimulationFoundationFixture, type ScenarioFixture, type StableId } from "../simulation/public.js";
import type { IncidentResponseFoundationFixture } from "./types.js";

const id = (value: string): StableId => value as StableId;

/** Exact hazardous stopped-job fixture shared by UI integration and domain tests. */
export function createIncidentResponseFoundationFixture(): IncidentResponseFoundationFixture {
  const simulationBase = createSimulationFoundationFixture();
  const simulationFixture: ScenarioFixture = {
    ...simulationBase,
    initialState: {
      ...simulationBase.initialState,
      tick: 10,
      gates: simulationBase.initialState.gates.map((gate) => ({ ...gate, position: "open" as const, sensorReading: "open" as const })),
      dinosaurs: simulationBase.initialState.dinosaurs.map((dinosaur) => ({ ...dinosaur, locationId: id("location:path"), contained: false })),
      visitors: simulationBase.initialState.visitors.map((visitor) => ({ ...visitor, exposedTo: id("dinosaur:tria"), panic: 25, safety: "exposed" as const })),
    },
  };
  const operationsBase = createParkOperationsFoundationFixture();
  const incident = {
    id: id("incident:strict-stop"), status: "active" as const, detectedTick: 10, updatedTick: 10,
    causalKeys: ["context-capacity"], spatialKeys: ["visitor-path"], locationId: id("location:path"), risk: 80,
    expected: "The feeding Agent stops safely before exposing visitors.", observed: ["The Agent Strict-stopped while the containment gate remained open."],
    consequence: ["Visitors are exposed to an uncontained dinosaur."], immediateGap: ["Evacuate visitors and restore temporary containment."],
    entityIds: [id("dinosaur:tria"), id("gate:alpha"), id("robot:alpha"), id("visitor:morning")], traceIds: [id("trace:strict-stop")], alertIds: [id("alert:strict-stop")],
  };
  const state = { ...operationsBase.state, tick: 10, incidents: [incident], jobs: [{ id: id("job:strict-stop"), task: { id: "task:feed-triceratops", version: "1.0.0" }, targetId: id("dinosaur:tria"), priority: 100, source: "system" as const, status: "stopped" as const, exactDeployedVersions: [], assignedAgentId: id("robot:alpha"), createdTick: 10, dueTick: 10, requiredForOpening: false, resultLinks: [id("trace:strict-stop")] }] };
  const parkOperations = createParkOperations(state, { resolver: operationsBase.resolver, knownAgentIds: operationsBase.knownAgentIds });
  return {
    incident,
    options: {
      ports: { simulation: createSimulation(simulationFixture), parkOperations, economy: createEconomyService({ initialBalance: 1_000 }) },
      rules: { id: "incident-response:mvp", version: "1.0.0", arrivalDelayTicks: 3, operatingDurationTicks: 2, baseCalloutCost: 100, riskCostPerPoint: 1, ratingPenalty: 8, evacuationActorId: id("robot:alpha"), evacuationTool: { id: "tool:evacuate", version: "1.0.0" }, safeZoneId: id("location:safe"), containmentActorId: id("robot:beta"), containmentTool: { id: "tool:gate-control", version: "1.0.0" }, containmentGateId: id("gate:alpha"), recoveryDestinationId: id("location:service"), maxEvacuationGroupSize: 20 },
      engineeringBoundary: { contextFingerprint: "context:strict-stop", artifactFingerprint: "artifact:skill-v1", routeFingerprint: "route:feeding-v1", retentionPolicyFingerprint: "retention:strict-v1", reviewFingerprint: "review:none", deploymentFingerprint: "deployment:production-v1" },
    },
  };
}
