export const simulationGoldens = {
  movement: { locationId: "location:safe", battery: 99, eventSequence: 1 },
  gate: { position: "open", sensorReading: "open", battery: 99, eventSequence: 1 },
  feeding: { hunger: 40, agitation: 10, foodQuantity: 1, battery: 98, eventSequence: 1 },
  escape: { locationId: "location:path", contained: false, hunger: 81, agitation: 32, visitorSafety: "exposed", visitorPanic: 25 },
  visitors: { safety: "casualty", panic: 75, exposedTo: "dinosaur:tria" },
  contention: { reservedBy: "robot:alpha", loserCode: "SIM_RESOURCE_RESERVED", eventSequence: 1 },
} as const;
