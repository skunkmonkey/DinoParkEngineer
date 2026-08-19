import type { ContentReference } from "../content-registry/public.js";
import { scenarioFixtureSchema, worldCommandSchema } from "./schemas.js";
import type { CommandResult, DinosaurState, FixtureLoadResult, ReplayInput, ReplayResult, RobotState, ScenarioFixture, SimulationDiagnostic, SimulationEngine, StableId, TickResult, ToolDefinition, ToolEvidence, VisitorGroupState, WorldCommand, WorldDelta, WorldEvent, WorldState } from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const clone = <T>(value: T): T => structuredClone(value);
const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
};
const sameRef = (left: ContentReference, right: ContentReference): boolean => left.id === right.id && left.version === right.version;
const diagnostic = (code: SimulationDiagnostic["code"], path: string, rule: string, message: string): SimulationDiagnostic => ({ code, path, rule, message });
const rejected = (commandId: StableId, tick: number, diagnostics: readonly SimulationDiagnostic[]): CommandResult => deepFreeze({ accepted: false, commandId, resultingTick: tick, diagnostics: [...diagnostics].sort((a, b) => lexical(`${a.path}\0${a.code}`, `${b.path}\0${b.code}`)), deltas: [], evidence: [], events: [] });
const find = <T extends { readonly id: StableId }>(items: readonly T[], id: StableId): T | undefined => items.find((entry) => entry.id === id);
const sorted = <T extends { readonly id: StableId }>(items: readonly T[]): T[] => [...items].sort((a, b) => lexical(a.id, b.id));
const replace = <T extends { readonly id: StableId }>(items: readonly T[], value: T): readonly T[] => sorted(items.map((entry) => entry.id === value.id ? value : entry));
const scalar = (value: unknown): string | number | boolean | null => value === undefined ? null : value as string | number | boolean | null;

const invariantDiagnostics = (fixture: ScenarioFixture): SimulationDiagnostic[] => {
  const state = fixture.initialState;
  const output: SimulationDiagnostic[] = [];
  const collections: readonly [string, readonly { readonly id: StableId }[]][] = [["locations", state.locations], ["enclosureBoundaries", state.enclosureBoundaries], ["navigationEdges", state.navigationEdges], ["gates", state.gates], ["robots", state.robots], ["dinosaurs", state.dinosaurs], ["visitors", state.visitors], ["hazards", state.hazards], ["scheduled", state.scheduled], ["activeActions", state.activeActions]];
  const allIds = new Set<string>();
  for (const [name, entries] of collections) {
    const ids = entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) output.push(diagnostic("SIM_FIXTURE_INVALID", name, "unique stable IDs", `${name} contains a duplicate ID.`));
    if (ids.some((entry, index) => entry !== [...ids].sort(lexical)[index])) output.push(diagnostic("SIM_FIXTURE_INVALID", name, "lexical stable order", `${name} must be ordered by ID.`));
    for (const entry of ids) {
      if (allIds.has(entry)) output.push(diagnostic("SIM_FIXTURE_INVALID", name, "world-wide unique IDs", `${entry} is reused across entity collections.`));
      allIds.add(entry);
    }
  }
  const locations = new Set(state.locations.map((entry) => entry.id));
  for (const edge of state.navigationEdges) if (!locations.has(edge.from) || !locations.has(edge.to)) output.push(diagnostic("SIM_FIXTURE_INVALID", `navigationEdges.${edge.id}`, "existing endpoints", "Navigation edge references a missing location."));
  const edges = new Set(state.navigationEdges.map((entry) => entry.id)); const gates = new Set(state.gates.map((entry) => entry.id));
  for (const boundary of state.enclosureBoundaries) if (boundary.edgeIds.some((entry) => !edges.has(entry)) || boundary.gateIds.some((entry) => !gates.has(entry))) output.push(diagnostic("SIM_FIXTURE_INVALID", `enclosureBoundaries.${boundary.id}`, "existing edge and gate references", "Enclosure boundary references a missing edge or gate."));
  for (const gate of state.gates) if (!locations.has(gate.locationA) || !locations.has(gate.locationB)) output.push(diagnostic("SIM_FIXTURE_INVALID", `gates.${gate.id}`, "existing endpoints", "Gate references a missing location."));
  for (const entity of [...state.robots, ...state.dinosaurs, ...state.visitors, ...state.hazards]) if (!locations.has(entity.locationId)) output.push(diagnostic("SIM_FIXTURE_INVALID", `entities.${entity.id}.locationId`, "existing location", `${entity.id} references a missing location.`));
  const streamNames = state.randomStreams.map((entry) => entry.name);
  if (new Set(streamNames).size !== streamNames.length || streamNames.some((entry, index) => entry !== [...streamNames].sort(lexical)[index])) output.push(diagnostic("SIM_FIXTURE_INVALID", "initialState.randomStreams", "unique lexical named streams", "Random streams must have unique names in lexical order."));
  if (!sameRef(fixture.scenario, state.scenario)) output.push(diagnostic("SIM_CONTENT_MISMATCH", "initialState.scenario", "fixture scenario matches world", "World scenario reference differs from fixture reference."));
  if (new Set(fixture.allowedCommandKinds).size !== fixture.allowedCommandKinds.length) output.push(diagnostic("SIM_FIXTURE_INVALID", "allowedCommandKinds", "unique values", "Allowed command kinds contain duplicates."));
  const exactKeys = fixture.exactContent.map((entry) => `${entry.id}\0${entry.version}`); const toolKeys = state.tools.map((entry) => `${entry.reference.id}\0${entry.reference.version}`);
  if (new Set(exactKeys).size !== exactKeys.length || exactKeys.some((entry, index) => entry !== [...exactKeys].sort(lexical)[index])) output.push(diagnostic("SIM_FIXTURE_INVALID", "exactContent", "unique lexical exact references", "Exact content references must be unique and lexically ordered."));
  if (new Set(toolKeys).size !== toolKeys.length || toolKeys.some((entry, index) => entry !== [...toolKeys].sort(lexical)[index]) || toolKeys.some((entry) => !exactKeys.includes(entry))) output.push(diagnostic("SIM_FIXTURE_INVALID", "initialState.tools", "unique lexical pinned tool definitions", "Tool definitions must be unique, ordered, and pinned by exact content."));
  for (const robot of state.robots) if (robot.toolRefs.some((entry) => !toolKeys.includes(`${entry.id}\0${entry.version}`))) output.push(diagnostic("SIM_FIXTURE_INVALID", `robots.${robot.id}.toolRefs`, "defined exact tools", "Robot references an undefined exact tool."));
  if (state.scheduled.some((entry) => entry.tick <= state.tick)) output.push(diagnostic("SIM_FIXTURE_INVALID", "initialState.scheduled", "future scheduled ticks", "Scheduled transitions must occur after the fixture tick."));
  return output.sort((a, b) => lexical(`${a.path}\0${a.code}`, `${b.path}\0${b.code}`));
};

export const validateScenarioFixture = (input: unknown): FixtureLoadResult => {
  const parsed = scenarioFixtureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, diagnostics: parsed.error.issues.map((issue) => diagnostic("SIM_FIXTURE_INVALID", issue.path.map(String).join(".") || "$", "scenario fixture schema", issue.message)) };
  const fixture = parsed.data as ScenarioFixture;
  const diagnostics = invariantDiagnostics(fixture);
  return diagnostics.length === 0 ? { ok: true, fixture: deepFreeze(clone(fixture)) } : { ok: false, diagnostics };
};

export const loadScenarioFixture = (source: import("./types.js").RegistryFixtureSource): FixtureLoadResult => {
  const resolution = source.registry.resolveExact(source.reference.id, source.reference.version);
  if (!resolution.ok) return { ok: false, diagnostics: [diagnostic("SIM_CONTENT_MISSING", "scenario", "exact registry resolution", `Exact scenario ${source.reference.id}@${source.reference.version} could not be resolved.`)] };
  const root = resolution.manifest.root;
  if (root.class !== (source.reference.expectedClass ?? "SimulationScenario") || (source.reference.expectedSchemaVersion !== undefined && root.schemaVersion !== source.reference.expectedSchemaVersion)) return { ok: false, diagnostics: [diagnostic("SIM_CONTENT_MISMATCH", "scenario", "expected content class and schema", "Resolved scenario has an incompatible content class or schema version.")] };
  const result = validateScenarioFixture(root.data);
  if (!result.ok) return result;
  const resolved = new Set([root, ...resolution.manifest.dependencies].map((entry) => `${entry.id}\0${entry.version}`));
  const missing = result.fixture.exactContent.filter((entry) => !resolved.has(`${entry.id}\0${entry.version}`));
  return missing.length === 0 ? result : { ok: false, diagnostics: missing.map((entry) => diagnostic("SIM_CONTENT_MISSING", "exactContent", "resolved pinned dependency", `Missing exact content ${entry.id}@${entry.version}.`)) };
};

class DeterministicSimulation implements SimulationEngine {
  private state: WorldState;
  private readonly allowed: ReadonlySet<WorldCommand["kind"]>;
  constructor(fixture: ScenarioFixture) { this.state = clone(fixture.initialState); this.allowed = new Set(fixture.allowedCommandKinds); }
  snapshot(): WorldState { return clone(this.state); }
  project(): Readonly<WorldState> { return deepFreeze(clone(this.state)); }
  setPaused(paused: boolean): void { this.state = { ...this.state, paused }; }
  setSpeed(speed: 1 | 2 | 4): void { this.state = { ...this.state, speed }; }
  requestedTicksPerFrame(): 0 | 1 | 2 | 4 { return this.state.paused ? 0 : this.state.speed; }
  requestTicks(count: number): TickResult {
    if (!Number.isInteger(count) || count < 0) throw new RangeError("Tick request count must be a non-negative integer.");
    if (this.state.paused) return deepFreeze({ resultingTick: this.state.tick, deltas: [], events: [] });
    const deltas: WorldDelta[] = []; const events: WorldEvent[] = [];
    for (let index = 0; index < count; index += 1) this.advanceOne(deltas, events);
    return deepFreeze({ resultingTick: this.state.tick, deltas, events });
  }
  execute(input: unknown): CommandResult {
    const parsed = worldCommandSchema.safeParse(input);
    if (!parsed.success) {
      const candidate = input !== null && typeof input === "object" && "id" in input && typeof input.id === "string" && /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(input.id) ? input.id as StableId : "command:invalid";
      return rejected(candidate, this.state.tick, parsed.error.issues.map((issue) => diagnostic("SIM_COMMAND_INVALID", issue.path.map(String).join(".") || "$", "command schema", issue.message)));
    }
    const command = parsed.data as WorldCommand;
    if (!this.allowed.has(command.kind)) return rejected(command.id, this.state.tick, [diagnostic("SIM_COMMAND_UNAUTHORIZED", "kind", "fixture command allowlist", `${command.kind} is not allowed by this scenario.`)]);
    if (command.expectedTick !== this.state.tick) return rejected(command.id, this.state.tick, [diagnostic("SIM_COMMAND_STALE", "expectedTick", "current logical tick", `Expected tick ${command.expectedTick}; current tick is ${this.state.tick}.`)]);
    const draft = clone(this.state); const deltas: WorldDelta[] = []; const evidence: ToolEvidence[] = []; const events: WorldEvent[] = [];
    const error = this.apply(draft, command, deltas, evidence, events);
    if (error !== undefined) return rejected(command.id, this.state.tick, [error]);
    this.state = draft;
    return deepFreeze({ accepted: true, commandId: command.id, resultingTick: draft.tick, deltas, evidence, events });
  }
  executeBatch(inputs: readonly unknown[]): readonly CommandResult[] {
    const before = clone(this.state); const results: CommandResult[] = [];
    for (const input of inputs) { const result = this.execute(input); results.push(result); if (!result.accepted) { this.state = before; return deepFreeze(results.map((entry) => entry.accepted ? rejected(entry.commandId, before.tick, [diagnostic("SIM_COMMAND_INVALID", "batch", "atomic batch", "Batch rolled back because a command was rejected.")]) : entry)); } }
    return deepFreeze(results);
  }
  private delta(deltas: WorldDelta[], command: WorldCommand, entityId: StableId, field: string, before: unknown, after: unknown): void { if (before !== after) deltas.push({ id: `delta:${command.id.split(":")[1] ?? "command"}-${deltas.length.toString().padStart(3, "0")}` as StableId, tick: this.state.tick, entityId, field, before: scalar(before), after: scalar(after), causeId: command.id }); }
  private event(state: WorldState, events: WorldEvent[], kind: string, entityId: StableId, causeId: StableId): void { const sequence = state.eventSequence + 1; Object.assign(state, { eventSequence: sequence }); events.push({ id: `event:${sequence.toString().padStart(8, "0")}` as StableId, tick: state.tick, kind, entityId, causeId }); }
  private actorAndTool(state: WorldState, actorId: StableId, reference: ContentReference, capability: ToolDefinition["capability"]): { robot?: RobotState; tool?: ToolDefinition; error?: SimulationDiagnostic } {
    const robot = find(state.robots, actorId); if (robot === undefined) return { error: diagnostic("SIM_COMMAND_UNAUTHORIZED", "actorId", "existing robot actor", "Actor is not an available robot.") };
    if (robot.action === "disabled" || robot.health === 0) return { error: diagnostic("SIM_COMMAND_IMPOSSIBLE", "actorId", "operational robot", "Robot is disabled.") };
    const tool = state.tools.find((entry) => sameRef(entry.reference, reference) && entry.capability === capability);
    if (tool === undefined || !robot.toolRefs.some((entry) => sameRef(entry, reference))) return { error: diagnostic("SIM_COMMAND_UNAUTHORIZED", "tool", "exact equipped tool and capability", "Robot does not have the exact required tool version.") };
    if (robot.battery < tool.batteryCost) return { error: diagnostic("SIM_COMMAND_IMPOSSIBLE", "actorId", "sufficient battery", "Robot battery is insufficient for the tool.") };
    return { robot, tool };
  }
  private gateAuthorization(robot: RobotState, gate: WorldState["gates"][number]): SimulationDiagnostic | undefined { return gate.accessZones.length === 0 || gate.accessZones.some((zone) => robot.accessZones.includes(zone)) ? undefined : diagnostic("SIM_COMMAND_UNAUTHORIZED", "gateId", "shared gate access zone", "Robot is not authorized for this gate's access zone."); }
  private apply(state: WorldState, command: WorldCommand, deltas: WorldDelta[], evidence: ToolEvidence[], events: WorldEvent[]): SimulationDiagnostic | undefined {
    const impossible = (path: string, rule: string, message: string): SimulationDiagnostic => diagnostic("SIM_COMMAND_IMPOSSIBLE", path, rule, message);
    if (command.kind === "move") {
      const robot = find(state.robots, command.actorId); if (robot === undefined) return diagnostic("SIM_COMMAND_UNAUTHORIZED", "actorId", "existing robot", "Actor is not a robot.");
      const edge = state.navigationEdges.find((entry) => (entry.from === robot.locationId && entry.to === command.destinationId) || (entry.to === robot.locationId && entry.from === command.destinationId));
      if (edge === undefined) return impossible("destinationId", "adjacent navigation location", "Destination is not adjacent.");
      const gate = edge.gateId === undefined ? undefined : find(state.gates, edge.gateId);
      if (gate !== undefined && (gate.position !== "open" || (gate.reservedBy !== undefined && gate.reservedBy !== robot.id))) return impossible("destinationId", "traversable unreserved edge", "A closed or reserved gate blocks movement.");
      if (robot.battery === 0 || robot.action === "disabled") return impossible("actorId", "operational robot", "Robot cannot move.");
      const next = { ...robot, locationId: command.destinationId, battery: robot.battery - 1, action: "moving" as const }; this.delta(deltas, command, robot.id, "locationId", robot.locationId, next.locationId); this.delta(deltas, command, robot.id, "battery", robot.battery, next.battery); Object.assign(state, { robots: replace(state.robots, next) }); this.event(state, events, "robot-moved", robot.id, command.id); return;
    }
    if (command.kind === "reserve" || command.kind === "release") {
      const robot = find(state.robots, command.actorId); const gate = find(state.gates, command.gateId);
      if (robot === undefined) return diagnostic("SIM_COMMAND_UNAUTHORIZED", "actorId", "existing robot", "Actor is not a robot."); if (gate === undefined) return impossible("gateId", "existing gate", "Gate does not exist.");
      const authorization = this.gateAuthorization(robot, gate); if (authorization !== undefined) return authorization;
      if (command.kind === "reserve" && gate.reservedBy !== undefined && gate.reservedBy !== robot.id) return diagnostic("SIM_RESOURCE_RESERVED", "gateId", "unreserved resource", `Gate is reserved by ${gate.reservedBy}.`);
      if (command.kind === "release" && gate.reservedBy !== robot.id) return diagnostic("SIM_COMMAND_UNAUTHORIZED", "gateId", "reservation owner", "Only the reservation owner can release this gate.");
      const next = { ...gate, reservedBy: command.kind === "reserve" ? robot.id : undefined }; this.delta(deltas, command, gate.id, "reservedBy", gate.reservedBy, next.reservedBy); Object.assign(state, { gates: replace(state.gates, next) }); this.event(state, events, command.kind === "reserve" ? "resource-reserved" : "resource-released", gate.id, command.id); return;
    }
    if (command.kind === "operate-gate" || command.kind === "observe-gate") {
      const found = this.actorAndTool(state, command.actorId, command.tool, command.kind === "observe-gate" ? "gate-observation" : "gate-control"); if (found.error !== undefined || found.robot === undefined || found.tool === undefined) return found.error;
      const gate = find(state.gates, command.gateId); if (gate === undefined) return impossible("gateId", "existing gate", "Gate does not exist.");
      const authorization = this.gateAuthorization(found.robot, gate); if (authorization !== undefined) return authorization;
      if (found.tool.requiresSameLocation && found.robot.locationId !== gate.locationA && found.robot.locationId !== gate.locationB) return impossible("gateId", "actor at gate", "Robot is not at the gate.");
      if (gate.reservedBy !== undefined && gate.reservedBy !== found.robot.id) return diagnostic("SIM_RESOURCE_RESERVED", "gateId", "reservation ownership", `Gate is reserved by ${gate.reservedBy}.`);
      if (command.kind === "observe-gate") { evidence.push({ source: "gate-sensor", sourceId: gate.id, field: "sensorReading", value: gate.sensorReading, reliability: gate.sensorHealth === "healthy" ? "healthy" : gate.sensorHealth === "degraded" ? "degraded" : "unavailable" }); evidence.push({ source: "physical-gate", sourceId: gate.id, field: "position", value: gate.position, reliability: "direct" }); return; }
      let next = gate;
      if (command.operation === "open") { if (gate.locked || gate.jammed) return impossible("operation", "unlocked operable gate", "Locked or jammed gate cannot open."); next = { ...gate, position: "open", sensorReading: gate.sensorHealth === "healthy" ? "open" : gate.sensorReading }; }
      if (command.operation === "close") { if (gate.jammed) return impossible("operation", "unjammed gate", "Jammed gate cannot close."); next = { ...gate, position: "closed", sensorReading: gate.sensorHealth === "healthy" ? "closed" : gate.sensorReading }; }
      if (command.operation === "lock") { if (gate.position !== "closed") return impossible("operation", "closed gate", "Open gate cannot lock."); next = { ...gate, locked: true }; }
      if (command.operation === "unlock") next = { ...gate, locked: false };
      this.delta(deltas, command, gate.id, "position", gate.position, next.position); this.delta(deltas, command, gate.id, "locked", gate.locked, next.locked); this.delta(deltas, command, gate.id, "sensorReading", gate.sensorReading, next.sensorReading); Object.assign(state, { gates: replace(state.gates, next), robots: replace(state.robots, { ...found.robot, battery: found.robot.battery - found.tool.batteryCost, action: "using-tool" }) }); this.event(state, events, `gate-${command.operation}`, gate.id, command.id); evidence.push({ source: "physical-gate", sourceId: gate.id, field: "position", value: next.position, reliability: "direct" }); return;
    }
    if (command.kind === "feed" || command.kind === "bait") {
      const found = this.actorAndTool(state, command.actorId, command.tool, command.kind); if (found.error !== undefined || found.robot === undefined || found.tool === undefined) return found.error;
      const dinosaur = find(state.dinosaurs, command.dinosaurId); if (dinosaur === undefined) return impossible("dinosaurId", "existing dinosaur", "Dinosaur does not exist.");
      const carried = found.robot.carried.find((entry) => entry.itemId === command.itemId); if (carried === undefined) return impossible("itemId", "carried consumable", "Robot is not carrying the required item.");
      if (command.kind === "feed" && found.robot.locationId !== dinosaur.locationId) return impossible("dinosaurId", "robot and dinosaur co-located", "Robot is not at the dinosaur.");
      const destination = command.kind === "bait" ? find(state.locations, command.destinationId) : undefined;
      if (command.kind === "bait" && destination === undefined) return impossible("destinationId", "existing location", "Bait destination does not exist.");
      if (command.kind === "bait" && destination !== undefined && (!dinosaur.allowedTerrain.includes(destination.kind) || (dinosaur.hazardInteraction === "avoid" && state.hazards.some((entry) => entry.active && entry.locationId === destination.id)))) return impossible("destinationId", "species terrain and hazard constraints", "Dinosaur cannot be baited into this location.");
      const nextDinosaur: DinosaurState = command.kind === "feed" ? { ...dinosaur, hunger: Math.max(0, dinosaur.hunger - 40), agitation: Math.max(0, dinosaur.agitation - 20), targetLocationId: undefined, baitedBy: undefined } : { ...dinosaur, targetLocationId: command.destinationId, baitedBy: found.robot.id };
      const carriedNext = found.robot.carried.flatMap((entry) => entry.itemId !== command.itemId ? [entry] : entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []);
      this.delta(deltas, command, dinosaur.id, command.kind === "feed" ? "hunger" : "targetLocationId", command.kind === "feed" ? dinosaur.hunger : dinosaur.targetLocationId, command.kind === "feed" ? nextDinosaur.hunger : nextDinosaur.targetLocationId); Object.assign(state, { dinosaurs: replace(state.dinosaurs, nextDinosaur), robots: replace(state.robots, { ...found.robot, carried: carriedNext, battery: found.robot.battery - found.tool.batteryCost, action: "using-tool" }) }); this.event(state, events, command.kind === "feed" ? "dinosaur-fed" : "dinosaur-baited", dinosaur.id, command.id); evidence.push({ source: "dinosaur", sourceId: dinosaur.id, field: command.kind === "feed" ? "hunger" : "targetLocationId", value: command.kind === "feed" ? nextDinosaur.hunger : command.destinationId, reliability: "direct" }); return;
    }
    const found = this.actorAndTool(state, command.actorId, command.tool, "evacuate"); if (found.error !== undefined || found.robot === undefined || found.tool === undefined) return found.error;
    const visitors = find(state.visitors, command.visitorId); const destination = find(state.locations, command.destinationId); if (visitors === undefined || destination?.kind !== "safe-zone") return impossible("destinationId", "existing safe-zone", "Evacuation requires a safe-zone destination.");
    const nextVisitors: VisitorGroupState = { ...visitors, locationId: destination.id, movingTo: undefined, exposedTo: undefined, panic: Math.max(0, visitors.panic - 20), evacuating: true, safety: visitors.safety === "casualty" ? "casualty" : visitors.safety === "injured" ? "injured" : "safe" }; this.delta(deltas, command, visitors.id, "locationId", visitors.locationId, nextVisitors.locationId); Object.assign(state, { visitors: replace(state.visitors, nextVisitors), robots: replace(state.robots, { ...found.robot, battery: found.robot.battery - found.tool.batteryCost, action: "using-tool" }) }); this.event(state, events, "visitors-evacuated", visitors.id, command.id); evidence.push({ source: "visitor", sourceId: visitors.id, field: "safety", value: nextVisitors.safety, reliability: "direct" }); return;
  }
  private advanceOne(deltas: WorldDelta[], events: WorldEvent[]): void {
    const prior = this.state; const nextTick = prior.tick + 1; let state: WorldState = { ...prior, tick: nextTick, robots: prior.robots.map((entry) => entry.action === "disabled" ? entry : { ...entry, action: "idle" }), scheduled: prior.scheduled.filter((entry) => entry.tick !== nextTick) };
    const due = this.state.scheduled.filter((entry) => entry.tick === nextTick).sort((a, b) => a.priority - b.priority || lexical(a.id, b.id));
    for (const transition of due) {
      if (transition.kind === "gate-auto-close") { const gate = find(state.gates, transition.entityId); if (gate !== undefined && gate.closer === "enabled" && !gate.jammed) { const next = { ...gate, position: "closed" as const, sensorReading: gate.sensorHealth === "healthy" ? "closed" as const : gate.sensorReading }; state = { ...state, gates: replace(state.gates, next) }; events.push({ id: `event:${(state.eventSequence + 1).toString().padStart(8, "0")}` as StableId, tick: nextTick, kind: "gate-auto-closed", entityId: gate.id, causeId: transition.id }); state = { ...state, eventSequence: state.eventSequence + 1 }; } }
      else { const visitors = find(state.visitors, transition.entityId); if (visitors !== undefined) { const destinationId = visitors.movingTo; const edge = destinationId === undefined ? undefined : state.navigationEdges.filter((entry) => entry.from === visitors.locationId || entry.to === visitors.locationId).sort((a, b) => lexical(a.id, b.id)).find((entry) => { const destination = entry.from === visitors.locationId ? entry.to : entry.from; const gate = entry.gateId === undefined ? undefined : find(state.gates, entry.gateId); return destination === destinationId && (gate === undefined || gate.position === "open"); }); if (edge !== undefined && destinationId !== undefined) { state = { ...state, visitors: replace(state.visitors, { ...visitors, locationId: destinationId, movingTo: undefined }) }; this.event(state, events, "visitors-arrived", visitors.id, transition.id); } } }
    }
    const movedDinosaurs = state.dinosaurs.map((dinosaur) => {
      let next = { ...dinosaur, hunger: Math.min(100, dinosaur.hunger + 1), agitation: Math.min(100, dinosaur.agitation + (dinosaur.hunger >= 80 ? 2 : 0)) };
      if (dinosaur.targetLocationId !== undefined && dinosaur.locationId !== dinosaur.targetLocationId) { const edge = state.navigationEdges.filter((entry) => entry.from === dinosaur.locationId || entry.to === dinosaur.locationId).sort((a, b) => lexical(a.id, b.id)).find((entry) => { const destination = entry.from === dinosaur.locationId ? entry.to : entry.from; const gate = entry.gateId === undefined ? undefined : find(state.gates, entry.gateId); return destination === dinosaur.targetLocationId && (gate === undefined || gate.position === "open"); }); if (edge !== undefined) next = { ...next, locationId: edge.from === dinosaur.locationId ? edge.to : edge.from }; }
      return { ...next, contained: next.locationId === next.homeEnclosureId };
    }); state = { ...state, dinosaurs: sorted(movedDinosaurs) };
    const visitors = state.visitors.map((group) => {
      let next = group;
      if (group.movingTo !== undefined) { const edge = state.navigationEdges.filter((entry) => entry.from === group.locationId || entry.to === group.locationId).sort((a, b) => lexical(a.id, b.id)).find((entry) => { const destination = entry.from === group.locationId ? entry.to : entry.from; const gate = entry.gateId === undefined ? undefined : find(state.gates, entry.gateId); return destination === group.movingTo && (gate === undefined || gate.position === "open"); }); if (edge !== undefined) next = { ...next, locationId: group.movingTo, movingTo: undefined }; }
      const threat = state.dinosaurs.find((entry) => !entry.contained && entry.locationId === next.locationId); if (threat === undefined || next.safety === "casualty") return next; const panic = Math.min(100, next.panic + 25); return { ...next, exposedTo: threat.id, panic, safety: panic >= 75 ? "casualty" as const : panic >= 50 ? "injured" as const : "exposed" as const };
    }); state = { ...state, visitors: sorted(visitors) };
    const causeId = `tick:${nextTick.toString().padStart(8, "0")}` as StableId;
    const recordTickDelta = (entityId: StableId, field: string, before: unknown, after: unknown): void => { if (before !== after) deltas.push({ id: `delta:tick-${nextTick.toString().padStart(8, "0")}-${deltas.length.toString().padStart(3, "0")}` as StableId, tick: nextTick, entityId, field, before: scalar(before), after: scalar(after), causeId }); };
    for (const dinosaur of state.dinosaurs) { const before = find(prior.dinosaurs, dinosaur.id); if (before !== undefined) { recordTickDelta(dinosaur.id, "locationId", before.locationId, dinosaur.locationId); recordTickDelta(dinosaur.id, "contained", before.contained, dinosaur.contained); recordTickDelta(dinosaur.id, "hunger", before.hunger, dinosaur.hunger); recordTickDelta(dinosaur.id, "agitation", before.agitation, dinosaur.agitation); if (before.contained && !dinosaur.contained) this.event(state, events, "dinosaur-escaped", dinosaur.id, causeId); } }
    for (const visitor of state.visitors) { const before = find(prior.visitors, visitor.id); if (before !== undefined) { recordTickDelta(visitor.id, "locationId", before.locationId, visitor.locationId); recordTickDelta(visitor.id, "panic", before.panic, visitor.panic); recordTickDelta(visitor.id, "safety", before.safety, visitor.safety); recordTickDelta(visitor.id, "exposedTo", before.exposedTo, visitor.exposedTo); if (before.safety !== visitor.safety) this.event(state, events, `visitor-${visitor.safety}`, visitor.id, causeId); } }
    for (const gate of state.gates) { const before = find(prior.gates, gate.id); if (before !== undefined) { recordTickDelta(gate.id, "position", before.position, gate.position); recordTickDelta(gate.id, "sensorReading", before.sensorReading, gate.sensorReading); } }
    this.state = state;
  }
}

export const createSimulation = (fixture: unknown): SimulationEngine => { const validated = validateScenarioFixture(fixture); if (!validated.ok) throw new TypeError(`Invalid simulation fixture: ${validated.diagnostics.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`); return new DeterministicSimulation(validated.fixture); };
export const replaySimulation = (input: ReplayInput): ReplayResult => {
  const fixture: ScenarioFixture = { schemaVersion: "1", scenario: input.snapshot.scenario, exactContent: input.exactContent, allowedCommandKinds: input.allowedCommandKinds, initialState: input.snapshot };
  const engine = createSimulation(fixture); const results: CommandResult[] = []; const events: WorldEvent[] = [];
  for (const entry of input.commands) { if (entry.decisionTick < engine.snapshot().tick) throw new RangeError("Replay commands must be ordered and must not precede the current replay tick."); events.push(...engine.requestTicks(entry.decisionTick - engine.snapshot().tick).events); const result = engine.execute(entry.command); results.push(result); events.push(...result.events); }
  events.push(...engine.requestTicks(input.finalTick - engine.snapshot().tick).events); return deepFreeze({ state: engine.snapshot(), commandResults: results, events });
};
