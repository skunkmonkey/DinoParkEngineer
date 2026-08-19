/** The sole downstream import surface for authoritative deterministic park physics. */
export { createSimulation, loadScenarioFixture, replaySimulation, validateScenarioFixture } from "./engine.js";
export { createSimulationFoundationFixture } from "./foundation-fixture.js";
export { createRandomStreams, consumeRandom } from "./random.js";
export { scenarioFixtureSchema, worldCommandSchema, worldStateSchema } from "./schemas.js";
export type { CommandResult, DinosaurState, EnclosureBoundaryState, FixtureLoadResult, GateState, LocationState, NavigationEdge, RandomStreamState, ReplayInput, ReplayResult, RobotState, ScenarioFixture, ScheduledTransition, SimulationDiagnostic, SimulationDiagnosticCode, SimulationEngine, StableId, TickResult, ToolDefinition, ToolEvidence, VisitorGroupState, VisitorSafety, WorldCommand, WorldDelta, WorldEvent, WorldState } from "./types.js";
