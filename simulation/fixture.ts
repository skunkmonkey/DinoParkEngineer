import { deepClone, deepFreeze, sortById } from "./canonical.ts";
import type {
  Dinosaur,
  Enclosure,
  FixtureError,
  Gate,
  RobotAgent,
  ToolDevice,
  VisitorGroup,
  WorldFixture,
} from "./types.ts";

const outside: { id: string; kind: "OUTSIDE" } = { id: "zone.outside", kind: "OUTSIDE" };
const safeZone: { id: string; kind: "SAFE" } = { id: "zone.safe", kind: "SAFE" };

function enclosure(id: string, speciesId: string, gateId: string, serviceZone: string, interiorZone: string, bufferZone: string, feederId: string, hazardLevel: number): Enclosure {
  return {
    id,
    speciesAllowed: [speciesId],
    gateIds: [gateId],
    zoneIds: [serviceZone, interiorZone, bufferZone],
    feederIds: [feederId],
    hazardLevel,
    visitorBufferZoneIds: [bufferZone],
    closed: true,
  };
}

function gate(id: string, enclosureId: string, zoneId: string): Gate {
  return {
    id,
    enclosureId,
    zoneId,
    state: "CLOSED",
    sensorState: "CLOSED",
    sensorHealth: 100,
    autoCloseEnabled: false,
    maintenanceLock: false,
    transitionZoneOccupants: [],
  };
}

function dino(id: string, speciesId: string, archetype: Dinosaur["archetype"], enclosureId: string, currentZone: string, preferredZoneIds: readonly string[], hunger: number, health: number): Dinosaur {
  return {
    id,
    speciesId,
    archetype,
    enclosureId,
    currentZone,
    hunger,
    agitation: archetype === "CARNIVORE" ? 22 : 5,
    health,
    targetInterest: null,
    containmentState: "CONTAINED",
    movementProfile: {
      archetype,
      wanderChanceBasisPoints: archetype === "CARNIVORE" ? 3500 : archetype === "LARGE_HERBIVORE" ? 2500 : 1500,
      preferredZoneIds,
      escapeRiskBasisPoints: archetype === "CARNIVORE" ? 8500 : archetype === "LARGE_HERBIVORE" ? 4500 : 1500,
    },
  };
}

/**
 * Canonical MVP content: one park zone, three enclosures, and the three
 * required dinosaur archetypes. It is deliberately data-only so content
 * authors can clone/edit a fixture without changing engine code.
 */
export function createStarterFixture(): WorldFixture {
  const zones = [
    outside,
    safeZone,
    { id: "zone.alpha.service", enclosureId: "enclosure.alpha", kind: "SERVICE" as const },
    { id: "zone.alpha.interior", enclosureId: "enclosure.alpha", kind: "INTERIOR" as const },
    { id: "zone.alpha.buffer", enclosureId: "enclosure.alpha", kind: "VISITOR_BUFFER" as const },
    { id: "zone.beta.service", enclosureId: "enclosure.beta", kind: "SERVICE" as const },
    { id: "zone.beta.interior", enclosureId: "enclosure.beta", kind: "INTERIOR" as const },
    { id: "zone.beta.buffer", enclosureId: "enclosure.beta", kind: "VISITOR_BUFFER" as const },
    { id: "zone.gamma.service", enclosureId: "enclosure.gamma", kind: "SERVICE" as const },
    { id: "zone.gamma.interior", enclosureId: "enclosure.gamma", kind: "INTERIOR" as const },
    { id: "zone.gamma.buffer", enclosureId: "enclosure.gamma", kind: "VISITOR_BUFFER" as const },
  ];
  const enclosures = [
    enclosure("enclosure.alpha", "species.triceratops", "gate.alpha", "zone.alpha.service", "zone.alpha.interior", "zone.alpha.buffer", "feeder.alpha", 1),
    enclosure("enclosure.beta", "species.brachiosaurus", "gate.beta", "zone.beta.service", "zone.beta.interior", "zone.beta.buffer", "feeder.beta", 2),
    enclosure("enclosure.gamma", "species.tyrannosaurus", "gate.gamma", "zone.gamma.service", "zone.gamma.interior", "zone.gamma.buffer", "feeder.gamma", 4),
  ];
  const gates = [
    gate("gate.alpha", "enclosure.alpha", "zone.alpha.service"),
    gate("gate.beta", "enclosure.beta", "zone.beta.service"),
    gate("gate.gamma", "enclosure.gamma", "zone.gamma.service"),
  ];
  const dinosaurs = [
    dino("dino.fern", "species.triceratops", "DOCILE_HERBIVORE", "enclosure.alpha", "zone.alpha.interior", ["zone.alpha.interior", "zone.alpha.service"], 48, 100),
    dino("dino.atlas", "species.brachiosaurus", "LARGE_HERBIVORE", "enclosure.beta", "zone.beta.interior", ["zone.beta.interior", "zone.beta.service"], 55, 100),
    dino("dino.rex", "species.tyrannosaurus", "CARNIVORE", "enclosure.gamma", "zone.gamma.interior", ["zone.gamma.interior", "zone.gamma.service"], 68, 96),
  ];
  const agents: RobotAgent[] = [{
    id: "agent.keeper01",
    agentDefinitionId: "agent-definition.keeper",
    location: "zone.outside",
    battery: 100,
    tools: ["move_to", "observe", "bait_dinosaur", "open_gate", "close_gate", "lock_gate", "dispense_food", "alert_security", "evacuate_visitors", "rescue_visitors"],
    contextBudget: 8000,
    activeTask: null,
    queue: [],
    memoryRefs: [],
    status: "IDLE",
    authorizedEnclosureIds: enclosures.map((item) => item.id),
  }];
  const visitors: VisitorGroup[] = [{
    id: "visitors.group01",
    location: "zone.outside",
    size: 6,
    satisfaction: 85,
    panic: 0,
    safetyState: "SAFE",
    destination: "zone.alpha.buffer",
  }];
  const devices: ToolDevice[] = [
    ...enclosures.map((item) => ({ id: item.feederIds[0], type: "FEEDER" as const, enclosureId: item.id, zoneId: item.zoneIds[0], health: 100, available: true, state: "READY" as const, inventory: 100 })),
    { id: "device.bait", type: "BAIT_DISPENSER", health: 100, available: true, state: "READY", inventory: 100 },
    { id: "device.radio", type: "RADIO", health: 100, available: true, state: "READY", inventory: 1 },
    { id: "device.rescue", type: "RESCUE_UNIT", health: 100, available: true, state: "READY", inventory: 1 },
  ];
  const routes = [
    { fromZoneId: "zone.outside", toZoneId: "zone.alpha.service", durationSeconds: 2 },
    { fromZoneId: "zone.outside", toZoneId: "zone.beta.service", durationSeconds: 3 },
    { fromZoneId: "zone.outside", toZoneId: "zone.gamma.service", durationSeconds: 4 },
    { fromZoneId: "zone.alpha.service", toZoneId: "zone.outside", durationSeconds: 2 },
    { fromZoneId: "zone.beta.service", toZoneId: "zone.outside", durationSeconds: 3 },
    { fromZoneId: "zone.gamma.service", toZoneId: "zone.outside", durationSeconds: 4 },
    { fromZoneId: "zone.alpha.service", toZoneId: "zone.alpha.interior", durationSeconds: 1 },
    { fromZoneId: "zone.alpha.interior", toZoneId: "zone.alpha.service", durationSeconds: 1 },
    { fromZoneId: "zone.beta.service", toZoneId: "zone.beta.interior", durationSeconds: 1 },
    { fromZoneId: "zone.beta.interior", toZoneId: "zone.beta.service", durationSeconds: 1 },
    { fromZoneId: "zone.gamma.service", toZoneId: "zone.gamma.interior", durationSeconds: 1 },
    { fromZoneId: "zone.gamma.interior", toZoneId: "zone.gamma.service", durationSeconds: 1 },
  ];
  return {
    id: "fixture.starter",
    zones,
    enclosures,
    gates,
    dinosaurs,
    agents,
    visitors,
    devices,
    routes,
    enableAutonomy: false,
  };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArray(source: UnknownRecord, key: string, errors: FixtureError[], required = true): UnknownRecord[] {
  const value = source[key];
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) {
    errors.push({ code: "INVALID_VALUE", path: key, details: { reason: `${key} must be an array` } });
    return [];
  }
  const records: UnknownRecord[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) errors.push({ code: "INVALID_VALUE", path: `${key}[${index}]`, details: { reason: "item must be an object" } });
    else records.push(item);
  }
  return records;
}

function stringField(record: UnknownRecord, key: string, path: string, errors: FixtureError[], allowEmpty = false): string | null {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    errors.push({ code: key === "id" ? "INVALID_ID" : "INVALID_VALUE", path: `${path}.${key}`, details: { reason: `${key} must be a non-empty string` } });
    return null;
  }
  return value;
}

function numberField(record: UnknownRecord, key: string, path: string, errors: FixtureError[]): number | null {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ code: "INVALID_VALUE", path: `${path}.${key}`, details: { reason: `${key} must be a finite number` } });
    return null;
  }
  return value;
}

function booleanField(record: UnknownRecord, key: string, path: string, errors: FixtureError[]): boolean | null {
  const value = record[key];
  if (typeof value !== "boolean") {
    errors.push({ code: "INVALID_VALUE", path: `${path}.${key}`, details: { reason: `${key} must be a boolean` } });
    return null;
  }
  return value;
}

function stringArrayField(record: UnknownRecord, key: string, path: string, errors: FixtureError[]): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    errors.push({ code: "INVALID_VALUE", path: `${path}.${key}`, details: { reason: `${key} must be an array` } });
    return [];
  }
  const strings: string[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim() === "") errors.push({ code: "INVALID_VALUE", path: `${path}.${key}[${index}]`, details: { reason: "item must be a non-empty string" } });
    else strings.push(item);
  }
  return strings;
}

function idsOf(values: readonly UnknownRecord[], path: string, errors: FixtureError[]): Set<string> {
  const ids = new Set<string>();
  for (const [index, item] of values.entries()) {
    const id = stringField(item, "id", `${path}[${index}]`, errors);
    if (id === null) continue;
    if (ids.has(id)) errors.push({ code: "DUPLICATE_ID", path: `${path}[${index}].id`, details: { id } });
    ids.add(id);
  }
  return ids;
}

export function validateFixture(fixture: unknown): readonly FixtureError[] {
  const errors: FixtureError[] = [];
  if (!isRecord(fixture)) return [{ code: "INVALID_VALUE", path: "fixture", details: { reason: "fixture must be an object" } }];
  const zones = recordArray(fixture, "zones", errors);
  const enclosures = recordArray(fixture, "enclosures", errors);
  const gates = recordArray(fixture, "gates", errors);
  const dinosaurs = recordArray(fixture, "dinosaurs", errors);
  const agents = recordArray(fixture, "agents", errors);
  const visitors = recordArray(fixture, "visitors", errors);
  const devices = recordArray(fixture, "devices", errors);
  const routes = recordArray(fixture, "routes", errors);
  const faults = recordArray(fixture, "faults", errors, false);
  const jobs = recordArray(fixture, "jobs", errors, false);
  const incidents = recordArray(fixture, "incidents", errors, false);
  const zoneIds = idsOf(zones, "zones", errors);
  const enclosureIds = idsOf(enclosures, "enclosures", errors);
  const gateIds = idsOf(gates, "gates", errors);
  const dinoIds = idsOf(dinosaurs, "dinosaurs", errors);
  const agentIds = idsOf(agents, "agents", errors);
  const visitorIds = idsOf(visitors, "visitors", errors);
  const deviceIds = idsOf(devices, "devices", errors);
  const incidentIds = idsOf(incidents, "incidents", errors);
  const jobIds = idsOf(jobs, "jobs", errors);
  const entityIds = new Set([...zoneIds, ...enclosureIds, ...gateIds, ...dinoIds, ...agentIds, ...visitorIds, ...deviceIds, ...incidentIds, ...jobIds]);
  const occupantIds = new Set([...dinoIds, ...agentIds, ...visitorIds]);
  const ensure = (condition: boolean, code: FixtureError["code"], path: string, details: Record<string, string | number>) => {
    if (!condition) errors.push({ code, path, details });
  };
  stringField(fixture, "id", "fixture", errors);
  for (const [index, zone] of zones.entries()) {
    stringField(zone, "kind", `zones[${index}]`, errors);
    const enclosureId = zone.enclosureId;
    if (enclosureId !== undefined) ensure(typeof enclosureId === "string" && enclosureIds.has(enclosureId), "DANGLING_REFERENCE", `zones[${index}].enclosureId`, { id: typeof enclosureId === "string" ? enclosureId : "invalid" });
  }
  ensure(zones.some((zone) => zone.kind === "SAFE"), "INVALID_VALUE", "zones", { reason: "at least one SAFE zone is required" });
  for (const [index, item] of enclosures.entries()) {
    stringArrayField(item, "speciesAllowed", `enclosures[${index}]`, errors);
    for (const [j, gateId] of stringArrayField(item, "gateIds", `enclosures[${index}]`, errors).entries()) ensure(gateIds.has(gateId), "DANGLING_REFERENCE", `enclosures[${index}].gateIds[${j}]`, { id: gateId });
    for (const [j, zoneId] of stringArrayField(item, "zoneIds", `enclosures[${index}]`, errors).entries()) ensure(zoneIds.has(zoneId), "DANGLING_REFERENCE", `enclosures[${index}].zoneIds[${j}]`, { id: zoneId });
    for (const [j, feederId] of stringArrayField(item, "feederIds", `enclosures[${index}]`, errors).entries()) ensure(deviceIds.has(feederId), "DANGLING_REFERENCE", `enclosures[${index}].feederIds[${j}]`, { id: feederId });
    for (const [j, zoneId] of stringArrayField(item, "visitorBufferZoneIds", `enclosures[${index}]`, errors).entries()) ensure(zoneIds.has(zoneId), "DANGLING_REFERENCE", `enclosures[${index}].visitorBufferZoneIds[${j}]`, { id: zoneId });
    numberField(item, "hazardLevel", `enclosures[${index}]`, errors);
    booleanField(item, "closed", `enclosures[${index}]`, errors);
  }
  for (const [index, item] of gates.entries()) {
    const enclosureId = stringField(item, "enclosureId", `gates[${index}]`, errors);
    const zoneId = stringField(item, "zoneId", `gates[${index}]`, errors);
    if (enclosureId) ensure(enclosureIds.has(enclosureId), "DANGLING_REFERENCE", `gates[${index}].enclosureId`, { id: enclosureId });
    if (zoneId) ensure(zoneIds.has(zoneId), "DANGLING_REFERENCE", `gates[${index}].zoneId`, { id: zoneId });
    const sensorHealth = numberField(item, "sensorHealth", `gates[${index}]`, errors);
    if (sensorHealth !== null) ensure(sensorHealth >= 0 && sensorHealth <= 100, "INVALID_VALUE", `gates[${index}].sensorHealth`, { value: sensorHealth });
    const state = stringField(item, "state", `gates[${index}]`, errors);
    const sensorState = stringField(item, "sensorState", `gates[${index}]`, errors);
    booleanField(item, "autoCloseEnabled", `gates[${index}]`, errors);
    booleanField(item, "maintenanceLock", `gates[${index}]`, errors);
    for (const [j, occupantId] of stringArrayField(item, "transitionZoneOccupants", `gates[${index}]`, errors).entries()) ensure(occupantIds.has(occupantId), "DANGLING_REFERENCE", `gates[${index}].transitionZoneOccupants[${j}]`, { id: occupantId });
    ensure(state !== "LOCKED" || sensorState !== "OPEN", "INVALID_VALUE", `gates[${index}]`, { reason: "a locked gate cannot report open" });
  }
  for (const [index, item] of dinosaurs.entries()) {
    const enclosureId = stringField(item, "enclosureId", `dinosaurs[${index}]`, errors);
    const currentZone = stringField(item, "currentZone", `dinosaurs[${index}]`, errors);
    const containmentState = stringField(item, "containmentState", `dinosaurs[${index}]`, errors);
    stringField(item, "speciesId", `dinosaurs[${index}]`, errors);
    stringField(item, "archetype", `dinosaurs[${index}]`, errors);
    if (enclosureId) ensure(enclosureIds.has(enclosureId), "DANGLING_REFERENCE", `dinosaurs[${index}].enclosureId`, { id: enclosureId });
    if (currentZone) ensure(zoneIds.has(currentZone) || containmentState === "ESCAPED", "DANGLING_REFERENCE", `dinosaurs[${index}].currentZone`, { id: currentZone });
    for (const key of ["hunger", "agitation", "health"] as const) {
      const value = numberField(item, key, `dinosaurs[${index}]`, errors);
      if (value !== null) ensure(value >= 0 && value <= 100, "INVALID_VALUE", `dinosaurs[${index}].${key}`, { value });
    }
    const profile = item.movementProfile;
    if (!isRecord(profile)) errors.push({ code: "INVALID_VALUE", path: `dinosaurs[${index}].movementProfile`, details: { reason: "movementProfile must be an object" } });
    else {
      stringField(profile, "archetype", `dinosaurs[${index}].movementProfile`, errors);
      numberField(profile, "wanderChanceBasisPoints", `dinosaurs[${index}].movementProfile`, errors);
      numberField(profile, "escapeRiskBasisPoints", `dinosaurs[${index}].movementProfile`, errors);
      for (const [j, zoneId] of stringArrayField(profile, "preferredZoneIds", `dinosaurs[${index}].movementProfile`, errors).entries()) ensure(zoneIds.has(zoneId), "DANGLING_REFERENCE", `dinosaurs[${index}].movementProfile.preferredZoneIds[${j}]`, { id: zoneId });
    }
  }
  for (const [index, item] of agents.entries()) {
    const location = stringField(item, "location", `agents[${index}]`, errors);
    if (location) ensure(zoneIds.has(location), "DANGLING_REFERENCE", `agents[${index}].location`, { id: location });
    stringField(item, "agentDefinitionId", `agents[${index}]`, errors);
    stringField(item, "status", `agents[${index}]`, errors);
    numberField(item, "battery", `agents[${index}]`, errors);
    numberField(item, "contextBudget", `agents[${index}]`, errors);
    stringArrayField(item, "tools", `agents[${index}]`, errors);
    stringArrayField(item, "queue", `agents[${index}]`, errors);
    stringArrayField(item, "memoryRefs", `agents[${index}]`, errors);
    for (const [j, enclosureId] of stringArrayField(item, "authorizedEnclosureIds", `agents[${index}]`, errors).entries()) ensure(enclosureIds.has(enclosureId), "DANGLING_REFERENCE", `agents[${index}].authorizedEnclosureIds[${j}]`, { id: enclosureId });
  }
  for (const [index, item] of visitors.entries()) {
    const location = stringField(item, "location", `visitors[${index}]`, errors);
    const destination = stringField(item, "destination", `visitors[${index}]`, errors);
    if (location) ensure(zoneIds.has(location), "DANGLING_REFERENCE", `visitors[${index}].location`, { id: location });
    if (destination) ensure(zoneIds.has(destination), "DANGLING_REFERENCE", `visitors[${index}].destination`, { id: destination });
    stringField(item, "safetyState", `visitors[${index}]`, errors);
    for (const key of ["size", "satisfaction", "panic"] as const) numberField(item, key, `visitors[${index}]`, errors);
  }
  for (const [index, item] of devices.entries()) {
    if (item.enclosureId !== undefined) {
      const enclosureId = typeof item.enclosureId === "string" ? item.enclosureId : null;
      if (enclosureId === null) errors.push({ code: "INVALID_VALUE", path: `devices[${index}].enclosureId`, details: { reason: "enclosureId must be a string" } });
      else ensure(enclosureIds.has(enclosureId), "DANGLING_REFERENCE", `devices[${index}].enclosureId`, { id: enclosureId });
    }
    if (item.zoneId !== undefined) {
      const zoneId = typeof item.zoneId === "string" ? item.zoneId : null;
      if (zoneId === null) errors.push({ code: "INVALID_VALUE", path: `devices[${index}].zoneId`, details: { reason: "zoneId must be a string" } });
      else ensure(zoneIds.has(zoneId), "DANGLING_REFERENCE", `devices[${index}].zoneId`, { id: zoneId });
    }
    stringField(item, "type", `devices[${index}]`, errors);
    stringField(item, "state", `devices[${index}]`, errors);
    booleanField(item, "available", `devices[${index}]`, errors);
    const health = numberField(item, "health", `devices[${index}]`, errors);
    const inventory = numberField(item, "inventory", `devices[${index}]`, errors);
    if (health !== null) ensure(health >= 0 && health <= 100, "INVALID_VALUE", `devices[${index}].health`, { value: health });
    if (inventory !== null) ensure(inventory >= 0, "INVALID_VALUE", `devices[${index}].inventory`, { value: inventory });
  }
  for (const [index, route] of routes.entries()) {
    const from = stringField(route, "fromZoneId", `routes[${index}]`, errors);
    const to = stringField(route, "toZoneId", `routes[${index}]`, errors);
    if (from && to) ensure(zoneIds.has(from) && zoneIds.has(to), "INVALID_ROUTE", `routes[${index}]`, { from, to });
    const duration = numberField(route, "durationSeconds", `routes[${index}]`, errors);
    if (duration !== null) ensure(Number.isInteger(duration) && duration >= 0, "INVALID_ROUTE", `routes[${index}].durationSeconds`, { value: duration });
  }
  for (const [index, fault] of faults.entries()) {
    const type = stringField(fault, "type", `faults[${index}]`, errors);
    const targetId = stringField(fault, "targetId", `faults[${index}]`, errors);
    const targetExists = targetId !== null && (type === "GATE_JAM" || type === "SENSOR_DEGRADE" ? gateIds.has(targetId) : deviceIds.has(targetId));
    ensure(targetExists, "INVALID_FAULT", `faults[${index}].targetId`, { id: targetId ?? "invalid" });
    const logicalTime = numberField(fault, "logicalTime", `faults[${index}]`, errors);
    if (logicalTime !== null) ensure(Number.isInteger(logicalTime) && logicalTime >= 0, "INVALID_FAULT", `faults[${index}].logicalTime`, { value: logicalTime });
  }
  for (const [index, item] of jobs.entries()) {
    const assignedAgentId = stringField(item, "assignedAgentId", `jobs[${index}]`, errors);
    if (assignedAgentId) ensure(agentIds.has(assignedAgentId), "DANGLING_REFERENCE", `jobs[${index}].assignedAgentId`, { id: assignedAgentId });
    for (const [j, id] of stringArrayField(item, "targetRefs", `jobs[${index}]`, errors).entries()) ensure(entityIds.has(id), "DANGLING_REFERENCE", `jobs[${index}].targetRefs[${j}]`, { id });
    stringField(item, "type", `jobs[${index}]`, errors);
    stringField(item, "status", `jobs[${index}]`, errors);
    numberField(item, "priority", `jobs[${index}]`, errors);
    numberField(item, "dueTime", `jobs[${index}]`, errors);
  }
  for (const [index, item] of incidents.entries()) {
    for (const [j, id] of stringArrayField(item, "affectedEntities", `incidents[${index}]`, errors).entries()) ensure(entityIds.has(id), "DANGLING_REFERENCE", `incidents[${index}].affectedEntities[${j}]`, { id });
    stringArrayField(item, "recoveryRequirements", `incidents[${index}]`, errors);
    stringField(item, "trigger", `incidents[${index}]`, errors);
    stringField(item, "status", `incidents[${index}]`, errors);
    numberField(item, "severity", `incidents[${index}]`, errors);
    numberField(item, "startTime", `incidents[${index}]`, errors);
  }
  return errors;
}

export function cloneFixture(fixture: WorldFixture): WorldFixture {
  return deepFreeze(deepClone({
    ...fixture,
    zones: sortById(fixture.zones),
    enclosures: sortById(fixture.enclosures),
    gates: sortById(fixture.gates),
    dinosaurs: sortById(fixture.dinosaurs),
    agents: sortById(fixture.agents),
    visitors: sortById(fixture.visitors),
    devices: sortById(fixture.devices),
    incidents: sortById(fixture.incidents ?? []),
    jobs: sortById(fixture.jobs ?? []),
  }));
}
