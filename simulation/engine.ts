import { canonicalSerialize, compareStable, deepClone, deepFreeze, sortById } from "./canonical.ts";
import { cloneFixture, validateFixture } from "./fixture.ts";
import type {
  Dinosaur,
  Enclosure,
  FixtureError,
  Gate,
  Incident,
  Job,
  LogicalTime,
  RobotAgent,
  ScheduledEvent,
  ScheduledFault,
  SimulationEngine,
  SimulationResult,
  ToolDevice,
  ToolFailureCode,
  VisitorGroup,
  WorldCommand,
  WorldEvent,
  WorldEventPayloadValue,
  WorldFixture,
  WorldSnapshot,
} from "./types.ts";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
type MutableWorld = {
  fixtureId: string;
  seed: number;
  logicalTime: number;
  prngState: number;
  zones: Mutable<WorldFixture["zones"][number]>[];
  enclosures: Mutable<Enclosure>[];
  gates: Mutable<Gate>[];
  dinosaurs: Mutable<Dinosaur>[];
  agents: Mutable<RobotAgent>[];
  visitors: Mutable<VisitorGroup>[];
  devices: Mutable<ToolDevice>[];
  incidents: Mutable<Incident>[];
  jobs: Mutable<Job>[];
  routes: WorldFixture["routes"];
};

type InternalScheduledEvent = ScheduledEvent & {
  readonly resources: readonly string[];
};

interface ProcessOutcome {
  readonly ok: boolean;
  readonly code?: ToolFailureCode;
  readonly details?: Readonly<Record<string, string | number>>;
  readonly payload?: Readonly<Record<string, WorldEventPayloadValue>>;
  readonly type?: WorldEvent["type"];
}

const PRIORITY = {
  fault: 5,
  tool: 20,
  autonomy: 40,
} as const;

const ACTION_DURATIONS: Record<WorldCommand["action"], number> = {
  move_to: 0,
  observe: 0,
  bait_dinosaur: 1,
  open_gate: 1,
  close_gate: 1,
  lock_gate: 1,
  dispense_food: 2,
  alert_security: 1,
  evacuate_visitors: 2,
  rescue_visitors: 2,
};

function success<T>(value: T): SimulationResult<T, never> {
  return { ok: true, value };
}

function failure<E>(error: E): SimulationResult<never, E> {
  return { ok: false, error };
}

function asSeed(seed: number): number {
  const normalized = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

function persistedSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.trunc(seed) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function cloneMutable<T>(value: T): T {
  return deepClone(value);
}

function cloneArray<T>(values: readonly T[]): Mutable<T>[] {
  return values.map((value) => deepClone(value) as Mutable<T>);
}

function eventOrder(a: Pick<ScheduledEvent, "logicalTime" | "priority" | "agentId" | "id">, b: Pick<ScheduledEvent, "logicalTime" | "priority" | "agentId" | "id">): number {
  return a.logicalTime - b.logicalTime
    || a.priority - b.priority
    || compareStable(a.agentId ?? "", b.agentId ?? "")
    || compareStable(a.id, b.id);
}

function entityKind(world: MutableWorld, id: string): "gate" | "dinosaur" | "agent" | "visitor" | "device" | "zone" | "incident" | null {
  if (world.gates.some((item) => item.id === id)) return "gate";
  if (world.dinosaurs.some((item) => item.id === id)) return "dinosaur";
  if (world.agents.some((item) => item.id === id)) return "agent";
  if (world.visitors.some((item) => item.id === id)) return "visitor";
  if (world.devices.some((item) => item.id === id)) return "device";
  if (world.zones.some((item) => item.id === id)) return "zone";
  if (world.incidents.some((item) => item.id === id)) return "incident";
  return null;
}

export class DeterministicSimulationEngine implements SimulationEngine {
  private world: MutableWorld | null = null;
  private fixture: WorldFixture | null = null;
  private queue: InternalScheduledEvent[] = [];
  private eventLog: WorldEvent[] = [];
  private resourceWinners = new Map<string, string>();
  private seenCommands = new Set<string>();
  private sequence = 0;

  load(fixture: WorldFixture, seed: number): SimulationResult<void, readonly FixtureError[]> {
    const errors = validateFixture(fixture);
    if (errors.length > 0) return failure(errors);
    const canonicalFixture = cloneFixture(fixture);
    this.fixture = canonicalFixture;
    this.world = {
      fixtureId: canonicalFixture.id,
      seed: persistedSeed(seed),
      logicalTime: 0,
      prngState: asSeed(seed),
      zones: cloneArray(canonicalFixture.zones),
      enclosures: cloneArray(canonicalFixture.enclosures),
      gates: cloneArray(canonicalFixture.gates),
      dinosaurs: cloneArray(canonicalFixture.dinosaurs),
      agents: cloneArray(canonicalFixture.agents),
      visitors: cloneArray(canonicalFixture.visitors),
      devices: cloneArray(canonicalFixture.devices),
      incidents: cloneArray(canonicalFixture.incidents ?? []),
      jobs: cloneArray(canonicalFixture.jobs ?? []),
      routes: cloneMutable(canonicalFixture.routes),
    };
    this.queue = [];
    this.eventLog = [];
    this.resourceWinners = new Map();
    this.seenCommands = new Set();
    this.sequence = 0;
    for (const fault of [...(canonicalFixture.faults ?? [])].sort((a, b) => a.logicalTime - b.logicalTime || compareStable(a.id, b.id))) {
      this.scheduleFault(fault);
    }
    if (canonicalFixture.enableAutonomy) this.scheduleAutonomy(1);
    return success(undefined);
  }

  command(command: WorldCommand): import("./types.ts").ToolResult {
    if (!this.world || !this.fixture) return this.failedResult(command?.commandId ?? "unknown", "INVALID_TARGET", { reason: "no fixture is loaded" });
    if (!command || typeof command !== "object" || typeof command.commandId !== "string" || typeof command.agentId !== "string") {
      return this.failedResult("unknown", "INVALID_TARGET", { reason: "command, commandId, and agentId are required" });
    }
    if (this.seenCommands.has(command.commandId)) return this.failedResult(command.commandId, "PREREQUISITE_FAILED", { reason: "command id already used" });
    const validation = this.validateCommand(command);
    if (!validation.ok) {
      this.seenCommands.add(command.commandId);
      return this.failedResult(command.commandId, validation.code, validation.details);
    }
    this.seenCommands.add(command.commandId);
    const agent = this.world.agents.find((item) => item.id === command.agentId);
    if (!agent) return this.failedResult(command.commandId, "INVALID_TARGET", { agentId: command.agentId });
    const duration = command.action === "move_to"
      ? this.routeDuration(agent.location, command.zoneId)
      : ACTION_DURATIONS[command.action];
    const id = this.nextId("event");
    const resourceKeys = this.resourceKeys(command, id);
    const scheduled: InternalScheduledEvent = {
      id,
      logicalTime: this.world.logicalTime + duration,
      priority: PRIORITY.tool,
      agentId: command.agentId,
      commandId: command.commandId,
      action: command.action,
      command: deepFreeze(deepClone(command)),
      resourceKey: resourceKeys[0],
      resourceKeys,
      resources: resourceKeys,
    };
    this.queue.push(scheduled);
    this.sortQueue();
    agent.activeTask = command.commandId;
    agent.status = "BUSY";
    this.eventLog.push(this.makeEvent("COMMAND_SCHEDULED", this.world.logicalTime, PRIORITY.tool, command.agentId, command.commandId, {
      action: command.action,
      completionEventId: id,
      completionTime: scheduled.logicalTime,
    }));
    return { ok: true, commandId: command.commandId, completionEventIds: [id] };
  }

  advanceTo(logicalTime: LogicalTime): readonly WorldEvent[] {
    if (!this.world || !Number.isFinite(logicalTime) || logicalTime < this.world.logicalTime) return [];
    const start = this.eventLog.length;
    const target = Math.trunc(logicalTime);
    while (this.queue.length > 0 && (this.queue[0]?.logicalTime ?? Number.POSITIVE_INFINITY) <= target) this.runNext();
    if (this.world.logicalTime < target) this.world.logicalTime = target;
    return deepFreeze(deepClone(this.eventLog.slice(start)));
  }

  runNext(): WorldEvent | null {
    if (!this.world || this.queue.length === 0) return null;
    const scheduled = this.queue.shift();
    if (!scheduled) return null;
    this.world.logicalTime = scheduled.logicalTime;
    if (scheduled.action === "fault") return this.processFault(scheduled);
    if (scheduled.action === "autonomy") return this.processAutonomy(scheduled);
    const agent = scheduled.agentId ? this.world.agents.find((item) => item.id === scheduled.agentId) : undefined;
    const command = scheduled.command;
    let outcome: ProcessOutcome;
    if (!agent || !command) {
      outcome = { ok: false, code: "INVALID_TARGET", details: { reason: "scheduled command is incomplete" } };
    } else {
      const conflict = this.resourceConflict(scheduled);
      outcome = conflict ?? this.processCommand(agent, command);
      agent.activeTask = null;
      agent.status = agent.status === "DISABLED" ? "DISABLED" : "IDLE";
    }
    const event = outcome.ok
      ? this.makeEvent(outcome.type ?? "TOOL_COMPLETED", scheduled.logicalTime, scheduled.priority, scheduled.agentId, scheduled.commandId, {
        ...(outcome.payload ?? {}),
        action: scheduled.action,
        completed: true,
      })
      : this.makeEvent("TOOL_FAILED", scheduled.logicalTime, scheduled.priority, scheduled.agentId, scheduled.commandId, {
        action: scheduled.action,
        code: outcome.code ?? "PREREQUISITE_FAILED",
        ...(outcome.details ?? {}),
    });
    this.eventLog.push(event);
    const currentTime = this.world.logicalTime;
    if (!this.queue.some((item) => item.logicalTime === currentTime)) {
      const bucketPrefix = `${currentTime}:`;
      for (const key of this.resourceWinners.keys()) if (key.startsWith(bucketPrefix)) this.resourceWinners.delete(key);
    }
    return event;
  }

  snapshot(): WorldSnapshot {
    if (!this.world) return this.emptySnapshot();
    const snapshot: WorldSnapshot = {
      fixtureId: this.world.fixtureId,
      seed: this.world.seed,
      logicalTime: this.world.logicalTime,
      prngState: this.world.prngState,
      zones: sortById(this.world.zones),
      enclosures: sortById(this.world.enclosures),
      gates: sortById(this.world.gates),
      dinosaurs: sortById(this.world.dinosaurs),
      agents: sortById(this.world.agents),
      visitors: sortById(this.world.visitors),
      devices: sortById(this.world.devices),
      incidents: sortById(this.world.incidents),
      jobs: sortById(this.world.jobs),
      routes: this.world.routes.slice().sort((a, b) => compareStable(a.fromZoneId, b.fromZoneId) || compareStable(a.toZoneId, b.toZoneId)),
      pendingEvents: this.queue.map((item) => this.publicScheduled(item)).sort(eventOrder),
      resourceReservations: [...this.resourceWinners.entries()].map(([key, winnerEventId]) => {
        const separator = key.indexOf(":");
        return { logicalTime: Number(key.slice(0, separator)), resourceKey: key.slice(separator + 1), winnerEventId };
      }).sort((a, b) => a.logicalTime - b.logicalTime || compareStable(a.resourceKey, b.resourceKey) || compareStable(a.winnerEventId, b.winnerEventId)),
      eventSequence: this.sequence,
    };
    return deepFreeze(deepClone(snapshot));
  }

  pendingEvents(): readonly ScheduledEvent[] {
    return deepFreeze(deepClone(this.queue.map((item) => this.publicScheduled(item)).sort(eventOrder)));
  }

  events(): readonly WorldEvent[] {
    return deepFreeze(deepClone(this.eventLog));
  }

  canonicalSnapshot(): string {
    return canonicalSerialize(this.snapshot());
  }

  canonicalEvents(): string {
    return canonicalSerialize(this.eventLog);
  }

  restore(snapshot: WorldSnapshot): SimulationResult<void, readonly FixtureError[]> {
    const fixture: WorldFixture = {
      id: snapshot.fixtureId,
      zones: snapshot.zones,
      enclosures: snapshot.enclosures,
      gates: snapshot.gates,
      dinosaurs: snapshot.dinosaurs,
      agents: snapshot.agents,
      visitors: snapshot.visitors,
      devices: snapshot.devices,
      incidents: snapshot.incidents,
      jobs: snapshot.jobs,
      routes: snapshot.routes,
    };
    const loaded = this.load(fixture, snapshot.seed);
    if (!loaded.ok || !this.world) return loaded;
    this.world.logicalTime = snapshot.logicalTime;
    this.world.prngState = snapshot.prngState >>> 0;
    this.queue = snapshot.pendingEvents.map((item) => ({
      ...deepClone(item),
      resources: [...item.resourceKeys],
    }));
    this.resourceWinners = new Map(snapshot.resourceReservations.map((reservation) => [`${reservation.logicalTime}:${reservation.resourceKey}`, reservation.winnerEventId]));
    this.sequence = snapshot.eventSequence;
    for (const agent of this.world.agents) {
      if (agent.activeTask) agent.status = "BUSY";
    }
    return success(undefined);
  }

  private emptySnapshot(): WorldSnapshot {
    return deepFreeze({
      fixtureId: "empty",
      seed: 0,
      logicalTime: 0,
      prngState: 0,
      zones: [],
      enclosures: [],
      gates: [],
      dinosaurs: [],
      agents: [],
      visitors: [],
      devices: [],
      incidents: [],
      jobs: [],
      routes: [],
      pendingEvents: [],
      resourceReservations: [],
      eventSequence: 0,
    });
  }

  private failedResult(commandId: string, code: ToolFailureCode, details: Record<string, string | number>): import("./types.ts").ToolResult {
    // A rejected command is not accepted into the event queue. In particular,
    // it must not alter the authoritative snapshot (including replay state).
    return { ok: false, commandId, code, details: deepFreeze({ ...details }) };
  }

  private validateCommand(command: WorldCommand): { ok: true } | { ok: false; code: ToolFailureCode; details: Record<string, string | number> } {
    if (!(command.action in ACTION_DURATIONS)) return { ok: false, code: "INVALID_TARGET", details: { reason: "unknown action" } };
    const agent = this.world?.agents.find((item) => item.id === command.agentId);
    if (!agent) return { ok: false, code: "INVALID_TARGET", details: { agentId: command.agentId } };
    if (agent.status === "DISABLED") return { ok: false, code: "UNAVAILABLE", details: { agentId: agent.id, reason: "agent disabled" } };
    if (agent.activeTask) return { ok: false, code: "TOOL_BUSY", details: { agentId: agent.id, activeTask: agent.activeTask } };
    if (!agent.tools.includes(command.action)) return { ok: false, code: "NOT_AUTHORIZED", details: { agentId: agent.id, tool: command.action } };
    const targetEntity = (id: string): boolean => entityKind(this.world as MutableWorld, id) !== null;
    if (command.action === "move_to") {
      if (!this.world?.zones.some((item) => item.id === command.zoneId)) return { ok: false, code: "INVALID_TARGET", details: { zoneId: command.zoneId } };
      if (!this.hasRoute(agent.location, command.zoneId)) return { ok: false, code: "OUT_OF_RANGE", details: { fromZoneId: agent.location, toZoneId: command.zoneId } };
      return { ok: true };
    }
    if (command.action === "observe") {
      if (!targetEntity(command.targetId)) return { ok: false, code: "INVALID_TARGET", details: { targetId: command.targetId } };
      return { ok: true };
    }
    if (command.action === "bait_dinosaur") {
      const dino = this.world?.dinosaurs.find((item) => item.id === command.dinosaurId);
      if (!dino || !this.world?.zones.some((item) => item.id === command.zoneId)) return { ok: false, code: "INVALID_TARGET", details: { targetId: dino ? command.zoneId : command.dinosaurId } };
      const enclosure = this.world.enclosures.find((item) => item.id === dino.enclosureId);
      if (!enclosure?.zoneIds.includes(command.zoneId)) return { ok: false, code: "PREREQUISITE_FAILED", details: { reason: "bait zone is outside dinosaur enclosure" } };
      const bait = this.world.devices.find((item) => item.type === "BAIT_DISPENSER");
      if (!bait?.available || bait.state !== "READY" || bait.inventory <= 0) return { ok: false, code: "UNAVAILABLE", details: { deviceId: bait?.id ?? "bait" } };
      if (!agent.authorizedEnclosureIds.includes(dino.enclosureId)) return { ok: false, code: "NOT_AUTHORIZED", details: { enclosureId: dino.enclosureId } };
      return { ok: true };
    }
    if (command.action === "open_gate" || command.action === "close_gate" || command.action === "lock_gate") {
      const gate = this.world?.gates.find((item) => item.id === command.gateId);
      if (!gate) return { ok: false, code: "INVALID_TARGET", details: { gateId: command.gateId } };
      if (!agent.authorizedEnclosureIds.includes(gate.enclosureId)) return { ok: false, code: "NOT_AUTHORIZED", details: { enclosureId: gate.enclosureId } };
      if (agent.location !== gate.zoneId) return { ok: false, code: "OUT_OF_RANGE", details: { agentLocation: agent.location, gateZoneId: gate.zoneId } };
      if (gate.maintenanceLock) return { ok: false, code: "MAINTENANCE_LOCKED", details: { gateId: gate.id } };
      if (gate.state === "JAMMED") return { ok: false, code: "JAMMED", details: { gateId: gate.id } };
      if (command.action === "open_gate" && gate.state !== "CLOSED") return { ok: false, code: "PREREQUISITE_FAILED", details: { gateState: gate.state } };
      if (command.action === "close_gate" && gate.state !== "OPEN") return { ok: false, code: "PREREQUISITE_FAILED", details: { gateState: gate.state } };
      if (command.action === "lock_gate" && gate.state !== "CLOSED") return { ok: false, code: "PREREQUISITE_FAILED", details: { gateState: gate.state } };
      return { ok: true };
    }
    if (command.action === "dispense_food") {
      const dino = this.world?.dinosaurs.find((item) => item.id === command.dinosaurId);
      if (!dino) return { ok: false, code: "INVALID_TARGET", details: { dinosaurId: command.dinosaurId } };
      if (!agent.authorizedEnclosureIds.includes(dino.enclosureId)) return { ok: false, code: "NOT_AUTHORIZED", details: { enclosureId: dino.enclosureId } };
      const enclosure = this.world?.enclosures.find((item) => item.id === dino.enclosureId);
      if (!enclosure || !enclosure.zoneIds.includes(agent.location)) return { ok: false, code: "OUT_OF_RANGE", details: { agentLocation: agent.location, enclosureId: dino.enclosureId } };
      const feeder = this.world?.devices.find((item) => enclosure.feederIds.includes(item.id));
      if (!feeder?.available || feeder.state !== "READY") return { ok: false, code: "UNAVAILABLE", details: { deviceId: feeder?.id ?? "feeder" } };
      if (feeder.inventory <= 0) return { ok: false, code: "UNAVAILABLE", details: { deviceId: feeder.id, reason: "empty" } };
      return { ok: true };
    }
    if (command.action === "alert_security") {
      const radio = this.world?.devices.find((item) => item.type === "RADIO");
      if (!radio?.available || radio.state !== "READY") return { ok: false, code: "UNAVAILABLE", details: { deviceId: radio?.id ?? "radio" } };
      if (command.incidentId && !this.world?.incidents.some((item) => item.id === command.incidentId)) return { ok: false, code: "INVALID_TARGET", details: { incidentId: command.incidentId } };
      if (command.targetZoneId && !this.world?.zones.some((item) => item.id === command.targetZoneId)) return { ok: false, code: "INVALID_TARGET", details: { targetZoneId: command.targetZoneId } };
      return { ok: true };
    }
    if (command.action === "evacuate_visitors") {
      if (!this.world?.zones.some((item) => item.id === command.zoneId)) return { ok: false, code: "INVALID_TARGET", details: { zoneId: command.zoneId } };
      if (!this.safeZoneId()) return { ok: false, code: "PREREQUISITE_FAILED", details: { reason: "no safe zone is configured" } };
      return { ok: true };
    }
    if (command.action === "rescue_visitors") {
      if (!this.world?.visitors.some((item) => item.id === command.visitorGroupId)) return { ok: false, code: "INVALID_TARGET", details: { visitorGroupId: command.visitorGroupId } };
      const rescue = this.world.devices.find((item) => item.type === "RESCUE_UNIT");
      if (!rescue?.available || rescue.state !== "READY") return { ok: false, code: "UNAVAILABLE", details: { deviceId: rescue?.id ?? "rescue" } };
      if (!this.safeZoneId()) return { ok: false, code: "PREREQUISITE_FAILED", details: { reason: "no safe zone is configured" } };
      return { ok: true };
    }
    return { ok: false, code: "INVALID_TARGET", details: { reason: "unsupported command" } };
  }

  private processCommand(agent: Mutable<RobotAgent>, command: WorldCommand): ProcessOutcome {
    if (!this.world) return { ok: false, code: "INVALID_TARGET", details: { reason: "no world" } };
    switch (command.action) {
      case "move_to": {
        const occupant = this.world.agents.find((item) => item.id !== agent.id && item.location === command.zoneId);
        if (occupant) return { ok: false, code: "ZONE_OCCUPIED", details: { zoneId: command.zoneId, occupantId: occupant.id } };
        const from = agent.location;
        agent.location = command.zoneId;
        agent.battery = clamp(agent.battery - this.routeDuration(from, command.zoneId), 0, 100);
        return { ok: true, payload: { fromZoneId: from, toZoneId: command.zoneId } };
      }
      case "observe": {
        const facts = this.observeFacts(command.targetId);
        const payload: Record<string, WorldEventPayloadValue> = { targetId: command.targetId, observedAt: this.world.logicalTime };
        for (const [key, value] of Object.entries(facts)) payload[key] = value;
        return { ok: true, type: "OBSERVATION", payload };
      }
      case "bait_dinosaur": {
        const dino = this.world.dinosaurs.find((item) => item.id === command.dinosaurId);
        const bait = this.world.devices.find((item) => item.type === "BAIT_DISPENSER");
        if (!dino || !bait) return { ok: false, code: "INVALID_TARGET", details: { dinosaurId: command.dinosaurId } };
        bait.inventory = Math.max(0, bait.inventory - 1);
        dino.targetInterest = { zoneId: command.zoneId, until: this.world.logicalTime + 5 };
        dino.agitation = clamp(dino.agitation - 4, 0, 100);
        return { ok: true, payload: { dinosaurId: dino.id, interestZoneId: command.zoneId, interestUntil: this.world.logicalTime + 5 } };
      }
      case "open_gate": {
        const gate = this.world.gates.find((item) => item.id === command.gateId);
        if (!gate) return { ok: false, code: "INVALID_TARGET", details: { gateId: command.gateId } };
        if (gate.state !== "CLOSED") return { ok: false, code: "PREREQUISITE_FAILED", details: { gateState: gate.state } };
        const enclosure = this.world.enclosures.find((item) => item.id === gate.enclosureId);
        const visitorInBuffer = enclosure?.visitorBufferZoneIds.some((zoneId) => this.world?.visitors.some((visitor) => visitor.location === zoneId && visitor.safetyState !== "SAFE_ZONE"));
        if (gate.transitionZoneOccupants.length > 0 || visitorInBuffer) return { ok: false, code: "ZONE_OCCUPIED", details: { gateId: gate.id, reason: "transition buffer occupied" } };
        gate.state = "OPEN";
        gate.sensorState = gate.sensorHealth >= 50 ? "OPEN" : "UNKNOWN";
        if (enclosure) enclosure.closed = false;
        const nearby = this.world.dinosaurs.filter((item) => item.enclosureId === gate.enclosureId && (item.currentZone === gate.zoneId || gate.transitionZoneOccupants.includes(item.id)));
        for (const dino of nearby) {
          dino.containmentState = "AT_RISK";
          this.openIncident(dino.archetype === "CARNIVORE" ? 3 : 2, "gate-open-near-dinosaur", [gate.id, dino.id], gate.enclosureId);
        }
        return { ok: true, payload: { gateId: gate.id, state: gate.state } };
      }
      case "close_gate": {
        const gate = this.world.gates.find((item) => item.id === command.gateId);
        if (!gate) return { ok: false, code: "INVALID_TARGET", details: { gateId: command.gateId } };
        if (gate.state !== "OPEN") return { ok: false, code: "PREREQUISITE_FAILED", details: { gateState: gate.state } };
        const dinosaurInTransition = this.world.dinosaurs.some((item) => item.enclosureId === gate.enclosureId && item.currentZone === gate.zoneId);
        if (gate.transitionZoneOccupants.length > 0 || dinosaurInTransition) return { ok: false, code: "ZONE_OCCUPIED", details: { gateId: gate.id, reason: "transition zone occupied" } };
        gate.state = "CLOSED";
        gate.sensorState = gate.sensorHealth >= 50 ? "CLOSED" : "UNKNOWN";
        const enclosure = this.world.enclosures.find((item) => item.id === gate.enclosureId);
        if (enclosure) enclosure.closed = true;
        return { ok: true, payload: { gateId: gate.id, state: gate.state } };
      }
      case "lock_gate": {
        const gate = this.world.gates.find((item) => item.id === command.gateId);
        if (!gate) return { ok: false, code: "INVALID_TARGET", details: { gateId: command.gateId } };
        if (gate.state !== "CLOSED") return { ok: false, code: "PREREQUISITE_FAILED", details: { gateState: gate.state } };
        gate.state = "LOCKED";
        gate.sensorState = gate.sensorHealth >= 50 ? "CLOSED" : "UNKNOWN";
        const enclosure = this.world.enclosures.find((item) => item.id === gate.enclosureId);
        if (enclosure) enclosure.closed = true;
        for (const dino of this.world.dinosaurs.filter((item) => item.enclosureId === gate.enclosureId && item.containmentState === "AT_RISK")) dino.containmentState = "CONTAINED";
        this.recoverIncidents(gate.enclosureId);
        return { ok: true, payload: { gateId: gate.id, state: gate.state } };
      }
      case "dispense_food": {
        const dino = this.world.dinosaurs.find((item) => item.id === command.dinosaurId);
        if (!dino) return { ok: false, code: "INVALID_TARGET", details: { dinosaurId: command.dinosaurId } };
        const enclosure = this.world.enclosures.find((item) => item.id === dino.enclosureId);
        const feeder = this.world.devices.find((item) => enclosure?.feederIds.includes(item.id));
        if (!feeder || feeder.inventory <= 0) return { ok: false, code: "UNAVAILABLE", details: { reason: "feeder unavailable" } };
        feeder.inventory -= 1;
        dino.hunger = clamp(dino.hunger - 40, 0, 100);
        dino.health = clamp(dino.health + 2, 0, 100);
        dino.agitation = clamp(dino.agitation - 8, 0, 100);
        return { ok: true, payload: { dinosaurId: dino.id, hunger: dino.hunger, health: dino.health } };
      }
      case "alert_security": {
        const severity = command.severity ?? 2;
        if (command.incidentId) {
          const incident = this.world.incidents.find((item) => item.id === command.incidentId);
          if (!incident) return { ok: false, code: "INVALID_TARGET", details: { incidentId: command.incidentId } };
          incident.status = "CONTAINED";
          return { ok: true, payload: { incidentId: incident.id, status: incident.status } };
        }
        const zone = command.targetZoneId;
        const enclosure = zone ? this.world.enclosures.find((item) => item.zoneIds.includes(zone)) : undefined;
        const incident = this.openIncident(severity, "security-alert", zone ? [zone] : [], enclosure?.id);
        return { ok: true, payload: { incidentId: incident.id, severity } };
      }
      case "evacuate_visitors": {
        const safeZoneId = this.safeZoneId();
        if (!safeZoneId) return { ok: false, code: "PREREQUISITE_FAILED", details: { reason: "no safe zone is configured" } };
        const affected = this.world.visitors.filter((item) => item.location === command.zoneId);
        for (const visitor of affected) {
          visitor.location = safeZoneId;
          visitor.destination = safeZoneId;
          visitor.safetyState = "SAFE_ZONE";
          visitor.panic = 0;
        }
        return { ok: true, payload: { zoneId: command.zoneId, evacuatedCount: affected.length } };
      }
      case "rescue_visitors": {
        const visitor = this.world.visitors.find((item) => item.id === command.visitorGroupId);
        if (!visitor) return { ok: false, code: "INVALID_TARGET", details: { visitorGroupId: command.visitorGroupId } };
        const safeZoneId = this.safeZoneId();
        if (!safeZoneId) return { ok: false, code: "PREREQUISITE_FAILED", details: { reason: "no safe zone is configured" } };
        visitor.location = safeZoneId;
        visitor.destination = safeZoneId;
        visitor.safetyState = "SAFE_ZONE";
        visitor.panic = 0;
        return { ok: true, payload: { visitorGroupId: visitor.id, safetyState: visitor.safetyState } };
      }
    }
  }

  private processFault(scheduled: InternalScheduledEvent): WorldEvent {
    if (!this.world || !scheduled.fault) return this.makeEvent("TOOL_FAILED", scheduled.logicalTime, scheduled.priority, undefined, undefined, { code: "INVALID_TARGET" });
    const fault = scheduled.fault;
    if (fault.type === "GATE_JAM" || fault.type === "SENSOR_DEGRADE") {
      const gate = this.world.gates.find((item) => item.id === fault.targetId);
      if (gate) {
        if (fault.type === "GATE_JAM") gate.state = "JAMMED";
        gate.sensorHealth = fault.type === "SENSOR_DEGRADE" ? Math.min(gate.sensorHealth, 20) : gate.sensorHealth;
        gate.sensorState = "UNKNOWN";
      }
    } else {
      const device = this.world.devices.find((item) => item.id === fault.targetId);
      if (device) {
        device.available = false;
        device.state = "OFFLINE";
      }
    }
    const event = this.makeEvent("FAULT_APPLIED", scheduled.logicalTime, scheduled.priority, undefined, undefined, { faultId: fault.id, faultType: fault.type, targetId: fault.targetId });
    this.eventLog.push(event);
    return event;
  }

  private processAutonomy(scheduled: InternalScheduledEvent): WorldEvent {
    if (!this.world) return this.makeEvent("DINO_MOVED", scheduled.logicalTime, scheduled.priority, undefined, undefined, { movedCount: 0 });
    let movedCount = 0;
    for (const dino of this.world.dinosaurs.slice().sort((a, b) => compareStable(a.id, b.id))) {
      if (dino.containmentState === "ESCAPED") continue;
      dino.hunger = clamp(dino.hunger + 1, 0, 100);
      const draw = this.nextRandomBasisPoints();
      const target = dino.targetInterest && dino.targetInterest.until >= this.world.logicalTime ? dino.targetInterest.zoneId : null;
      const gate = this.world.gates.find((item) => item.enclosureId === dino.enclosureId);
      if (gate?.state === "OPEN" && dino.currentZone === gate.zoneId && draw < dino.movementProfile.escapeRiskBasisPoints) {
        dino.currentZone = "zone.outside";
        dino.containmentState = "ESCAPED";
        const threatenedVisitors = this.world.visitors.filter((item) => item.location === "zone.outside" && item.safetyState !== "SAFE_ZONE");
        for (const visitor of threatenedVisitors) {
          visitor.safetyState = "AT_RISK";
          visitor.panic = clamp(visitor.panic + 40, 0, 100);
        }
        this.openIncident(threatenedVisitors.length > 0 ? 4 : 3, "dinosaur-escaped", [dino.id, gate.id], dino.enclosureId);
        movedCount += 1;
        continue;
      }
      let nextZone: string | null = null;
      if (target && target !== dino.currentZone) nextZone = target;
      else if (draw < dino.movementProfile.wanderChanceBasisPoints && dino.movementProfile.preferredZoneIds.length > 0) nextZone = dino.movementProfile.preferredZoneIds[this.nextRandomInt(dino.movementProfile.preferredZoneIds.length)] ?? null;
      if (nextZone && this.allowedDinosaurZone(dino, nextZone, gate)) {
        dino.currentZone = nextZone;
        movedCount += 1;
      }
    }
    this.scheduleAutonomy(this.world.logicalTime + 1);
    const event = this.makeEvent("DINO_MOVED", scheduled.logicalTime, scheduled.priority, undefined, undefined, { movedCount, prngState: this.world.prngState });
    this.eventLog.push(event);
    return event;
  }

  private allowedDinosaurZone(dino: Mutable<Dinosaur>, zoneId: string, gate: Mutable<Gate> | undefined): boolean {
    const zone = this.world?.zones.find((item) => item.id === zoneId);
    if (!zone || zone.enclosureId !== dino.enclosureId) return false;
    if (zoneId === gate?.zoneId && gate.state !== "OPEN") return false;
    return true;
  }

  private openIncident(severity: 0 | 1 | 2 | 3 | 4, trigger: string, affectedEntities: readonly string[], enclosureId?: string): Mutable<Incident> {
    if (!this.world) throw new Error("world is not loaded");
    const existing = this.world.incidents.find((item) => item.status === "OPEN" && item.trigger === trigger && item.enclosureId === enclosureId);
    if (existing) {
      if (severity > existing.severity) existing.severity = severity;
      return existing;
    }
    const incident: Mutable<Incident> = {
      id: this.nextId("incident"),
      severity,
      startTime: this.world.logicalTime,
      affectedEntities: [...affectedEntities].sort(),
      trigger,
      status: "OPEN",
      recoveryRequirements: severity >= 3 ? ["secure-gate", "verify-containment", "alert-security"] : ["secure-gate"],
      enclosureId,
    };
    this.world.incidents.push(incident);
    this.eventLog.push(this.makeEvent("INCIDENT_OPENED", this.world.logicalTime, PRIORITY.tool, undefined, undefined, { incidentId: incident.id, severity, trigger, enclosureId: enclosureId ?? "" }));
    return incident;
  }

  private recoverIncidents(enclosureId: string): void {
    if (!this.world) return;
    const escaped = this.world.dinosaurs.some((item) => item.enclosureId === enclosureId && item.containmentState === "ESCAPED");
    if (escaped) return;
    for (const incident of this.world.incidents.filter((item) => item.enclosureId === enclosureId && item.status !== "RECOVERED")) {
      incident.status = "RECOVERED";
      this.eventLog.push(this.makeEvent("INCIDENT_RECOVERED", this.world.logicalTime, PRIORITY.tool, undefined, undefined, { incidentId: incident.id, enclosureId }));
    }
  }

  private observeFacts(targetId: string): Record<string, WorldEventPayloadValue> {
    if (!this.world) return {};
    const kind = entityKind(this.world, targetId);
    if (kind === "gate") {
      const gate = this.world.gates.find((item) => item.id === targetId);
      return gate ? { entityType: "gate", state: gate.state, sensorState: gate.sensorState, sensorHealth: gate.sensorHealth, maintenanceLock: gate.maintenanceLock } : {};
    }
    if (kind === "dinosaur") {
      const dino = this.world.dinosaurs.find((item) => item.id === targetId);
      return dino ? { entityType: "dinosaur", currentZone: dino.currentZone, hunger: dino.hunger, containmentState: dino.containmentState, health: dino.health } : {};
    }
    if (kind === "visitor") {
      const visitor = this.world.visitors.find((item) => item.id === targetId);
      return visitor ? { entityType: "visitor", location: visitor.location, safetyState: visitor.safetyState, panic: visitor.panic } : {};
    }
    if (kind === "agent") {
      const agent = this.world.agents.find((item) => item.id === targetId);
      return agent ? { entityType: "agent", location: agent.location, battery: agent.battery, status: agent.status } : {};
    }
    if (kind === "device") {
      const device = this.world.devices.find((item) => item.id === targetId);
      return device ? { entityType: "device", available: device.available, state: device.state, health: device.health, inventory: device.inventory } : {};
    }
    return { entityType: kind ?? "unknown", id: targetId };
  }

  private routeDuration(fromZoneId: string, toZoneId: string): number {
    return this.world?.routes.find((route) => route.fromZoneId === fromZoneId && route.toZoneId === toZoneId)?.durationSeconds ?? 0;
  }

  private safeZoneId(): string | null {
    const safeZones = this.world?.zones.filter((zone) => zone.kind === "SAFE").map((zone) => zone.id).sort(compareStable) ?? [];
    return safeZones[0] ?? null;
  }

  private hasRoute(fromZoneId: string, toZoneId: string): boolean {
    return fromZoneId === toZoneId || Boolean(this.world?.routes.some((route) => route.fromZoneId === fromZoneId && route.toZoneId === toZoneId));
  }

  private resourceKeys(command: WorldCommand, eventId: string): string[] {
    const resources = [`agent:${command.agentId}`];
    if (command.action === "open_gate" || command.action === "close_gate" || command.action === "lock_gate") resources.push(`gate:${command.gateId}`);
    if (command.action === "move_to") resources.push(`zone:${command.zoneId}`);
    if (command.action === "bait_dinosaur") resources.push(`dinosaur:${command.dinosaurId}`, "device:bait");
    if (command.action === "dispense_food") resources.push(`dinosaur:${command.dinosaurId}`);
    if (command.action === "rescue_visitors") resources.push(`visitor:${command.visitorGroupId}`);
    // Include an event id only in the debugging payload, not in reservation keys.
    return resources.length > 0 ? resources : [`event:${eventId}`];
  }

  private resourceConflict(scheduled: InternalScheduledEvent): ProcessOutcome | null {
    const bucket = `${scheduled.logicalTime}`;
    for (const resource of scheduled.resources) {
      const key = `${bucket}:${resource}`;
      const winner = this.resourceWinners.get(key);
      if (winner && winner !== scheduled.id) return { ok: false, code: "TOOL_BUSY", details: { resource, winnerEventId: winner } };
      this.resourceWinners.set(key, scheduled.id);
    }
    return null;
  }

  private scheduleFault(fault: ScheduledFault): void {
    const id = this.nextId("fault");
    this.queue.push({ id, logicalTime: fault.logicalTime, priority: PRIORITY.fault, action: "fault", fault: deepFreeze(deepClone(fault)), resourceKey: `fault:${fault.targetId}`, resourceKeys: [`fault:${fault.targetId}`], resources: [`fault:${fault.targetId}`] });
    this.sortQueue();
  }

  private scheduleAutonomy(logicalTime: number): void {
    const id = this.nextId("autonomy");
    this.queue.push({ id, logicalTime, priority: PRIORITY.autonomy, action: "autonomy", resourceKey: "autonomy", resourceKeys: ["autonomy"], resources: ["autonomy"] });
    this.sortQueue();
  }

  private sortQueue(): void {
    this.queue.sort(eventOrder);
  }

  private publicScheduled(event: InternalScheduledEvent): ScheduledEvent {
    return {
      id: event.id,
      logicalTime: event.logicalTime,
      priority: event.priority,
      ...(event.agentId ? { agentId: event.agentId } : {}),
      ...(event.commandId ? { commandId: event.commandId } : {}),
      action: event.action,
      ...(event.command ? { command: event.command } : {}),
      ...(event.fault ? { fault: event.fault } : {}),
      resourceKeys: event.resourceKeys,
      ...(event.resourceKey ? { resourceKey: event.resourceKey } : {}),
    };
  }

  private makeEvent(type: WorldEvent["type"], logicalTime: number, priority: number, agentId: string | undefined, commandId: string | undefined, payload: Record<string, WorldEventPayloadValue>): WorldEvent {
    return deepFreeze({ id: this.nextId("event-log"), type, logicalTime, priority, ...(agentId ? { agentId } : {}), ...(commandId ? { commandId } : {}), payload: deepFreeze({ ...payload }) });
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(8, "0")}`;
  }

  private nextRandomBasisPoints(): number {
    return Math.floor(this.nextRandom() * 10000);
  }

  private nextRandomInt(maximumExclusive: number): number {
    return maximumExclusive <= 1 ? 0 : Math.floor(this.nextRandom() * maximumExclusive);
  }

  private nextRandom(): number {
    if (!this.world) return 0;
    let value = this.world.prngState >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.world.prngState = value >>> 0;
    return this.world.prngState / 0x100000000;
  }
}

export function createSimulationEngine(): SimulationEngine {
  return new DeterministicSimulationEngine();
}
