import { createSimulationEngine } from "./engine.ts";
import { createStarterFixture } from "./fixture.ts";
import type { WorldCommand, WorldEvent, WorldSnapshot } from "./types.ts";

export interface HeadlessReplayResult {
  readonly events: readonly WorldEvent[];
  readonly snapshot: WorldSnapshot;
}

/**
 * Small integration entry point for eval runners and local diagnostics. It
 * deliberately has no browser, wall-clock, network, or LLM dependency.
 */
export function runHeadlessExample(commands: readonly WorldCommand[] = [], seed = 7, advanceTo = 60): HeadlessReplayResult {
  const engine = createSimulationEngine();
  const loaded = engine.load(createStarterFixture(), seed);
  if (!loaded.ok) throw new Error("starter fixture must remain valid");
  for (const command of commands) engine.command(command);
  engine.advanceTo(advanceTo);
  return { events: engine.events(), snapshot: engine.snapshot() };
}

