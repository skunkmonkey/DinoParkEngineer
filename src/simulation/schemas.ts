import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u);
const ref = z.strictObject({ id, version: z.string().min(1), expectedClass: z.string().optional(), expectedSchemaVersion: z.string().optional() });
const nonnegative = z.number().int().nonnegative();
const location = z.strictObject({ id, kind: z.enum(["enclosure", "path", "service", "safe-zone"]), enclosureId: id.optional() });
const edge = z.strictObject({ id, from: id, to: id, gateId: id.optional() });
const boundary = z.strictObject({ id, enclosureId: id, edgeIds: z.array(id), gateIds: z.array(id) });
const gate = z.strictObject({ id, locationA: id, locationB: id, position: z.enum(["open", "closed"]), locked: z.boolean(), jammed: z.boolean(), closer: z.enum(["enabled", "disabled"]), sensorReading: z.enum(["open", "closed"]), sensorHealth: z.enum(["healthy", "degraded", "offline"]), accessZones: z.array(id), reservedBy: id.optional() });
const robot = z.strictObject({ id, locationId: id, toolRefs: z.array(ref), carried: z.array(z.strictObject({ itemId: id, quantity: z.number().int().positive() })), battery: z.number().int().min(0).max(100), health: z.number().int().min(0).max(100), assignmentId: id.optional(), action: z.enum(["idle", "moving", "using-tool", "disabled"]), accessZones: z.array(id) });
const dinosaur = z.strictObject({ id, species: z.string().min(1), locationId: id, homeEnclosureId: id, contained: z.boolean(), hunger: z.number().int().min(0).max(100), agitation: z.number().int().min(0).max(100), targetLocationId: id.optional(), baitedBy: id.optional(), allowedTerrain: z.array(z.enum(["enclosure", "path", "service", "safe-zone"])), hazardInteraction: z.enum(["avoid", "ignore"]) });
const visitor = z.strictObject({ id, locationId: id, size: z.number().int().positive(), movingTo: id.optional(), exposedTo: id.optional(), panic: z.number().int().min(0).max(100), evacuating: z.boolean(), safety: z.enum(["safe", "exposed", "injured", "casualty"]) });
const hazard = z.strictObject({ id, locationId: id, severity: z.number().int().min(0).max(100), active: z.boolean() });
const tool = z.strictObject({ reference: ref, capability: z.enum(["gate-control", "gate-observation", "feed", "bait", "evacuate"]), batteryCost: nonnegative, requiresSameLocation: z.boolean() });
const stream = z.strictObject({ name: z.string().min(1), state: nonnegative.max(0xffffffff), consumed: nonnegative });
const scheduled = z.strictObject({ id, tick: nonnegative, priority: z.number().int(), kind: z.enum(["gate-auto-close", "visitor-arrival"]), entityId: id });
const action = z.strictObject({ id, actorId: id, kind: z.string().min(1), startedTick: nonnegative, completesTick: nonnegative });

export const worldStateSchema = z.strictObject({ schemaVersion: z.literal("1"), scenario: ref, tick: nonnegative, paused: z.boolean(), speed: z.union([z.literal(1), z.literal(2), z.literal(4)]), seed: nonnegative.max(0xffffffff), randomStreams: z.array(stream), eventSequence: nonnegative, locations: z.array(location), enclosureBoundaries: z.array(boundary), navigationEdges: z.array(edge), gates: z.array(gate), robots: z.array(robot), dinosaurs: z.array(dinosaur), visitors: z.array(visitor), hazards: z.array(hazard), weather: z.strictObject({ condition: z.enum(["clear", "rain", "storm"]), intensity: z.number().int().min(0).max(100) }), tools: z.array(tool), scheduled: z.array(scheduled), activeActions: z.array(action) });
export const scenarioFixtureSchema = z.strictObject({ schemaVersion: z.literal("1"), scenario: ref, exactContent: z.array(ref), allowedCommandKinds: z.array(z.enum(["move", "operate-gate", "observe-gate", "feed", "bait", "evacuate", "reserve", "release"])), initialState: worldStateSchema });

const base = { id, expectedTick: nonnegative, actorId: id };
export const worldCommandSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.literal("move"), destinationId: id }),
  z.strictObject({ ...base, kind: z.literal("operate-gate"), gateId: id, operation: z.enum(["open", "close", "lock", "unlock"]), tool: ref }),
  z.strictObject({ ...base, kind: z.literal("observe-gate"), gateId: id, tool: ref }),
  z.strictObject({ ...base, kind: z.literal("feed"), dinosaurId: id, itemId: id, tool: ref }),
  z.strictObject({ ...base, kind: z.literal("bait"), dinosaurId: id, destinationId: id, itemId: id, tool: ref }),
  z.strictObject({ ...base, kind: z.literal("evacuate"), visitorId: id, destinationId: id, tool: ref }),
  z.strictObject({ ...base, kind: z.literal("reserve"), gateId: id }),
  z.strictObject({ ...base, kind: z.literal("release"), gateId: id }),
]);
