import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type { MemoryService } from "../memory/index.ts";
import type {
  AgentOperationsView,
  OperationsEntityRow,
  OperationsJob,
  ParkMetrics,
  ParkOperationsView,
} from "./types.ts";
import type { WorldSnapshot } from "../simulation/index.ts";

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function incidentOrder(a: { severity: number; startTime: number; id: string }, b: { severity: number; startTime: number; id: string }): number {
  return b.severity - a.severity || a.startTime - b.startTime || compare(a.id, b.id);
}

function jobOrder(a: OperationsJob, b: OperationsJob): number {
  return b.priority - a.priority || a.dueTime - b.dueTime || compare(a.id, b.id);
}

function row(kind: OperationsEntityRow["kind"], id: string, label: string, state: string, location?: string, severity?: 0 | 1 | 2 | 3 | 4): OperationsEntityRow {
  return {
    id,
    kind,
    label,
    state,
    ...(location ? { location } : {}),
    sourceId: id,
    deepLink: `/operations/park?entity=${encodeURIComponent(id)}`,
    ...(severity === undefined ? {} : { severity }),
  };
}

export function projectMapRows(snapshot: WorldSnapshot): readonly OperationsEntityRow[] {
  const rows: OperationsEntityRow[] = [];
  for (const zone of snapshot.zones) rows.push(row("ZONE", zone.id, zone.id, zone.kind, zone.enclosureId));
  for (const enclosure of snapshot.enclosures) rows.push(row("ENCLOSURE", enclosure.id, enclosure.id, enclosure.closed ? "CLOSED" : "OPEN"));
  for (const gate of snapshot.gates) rows.push(row("GATE", gate.id, gate.id, `${gate.state} · sensor ${gate.sensorState}`, gate.zoneId));
  for (const dinosaur of snapshot.dinosaurs) rows.push(row("DINOSAUR", dinosaur.id, dinosaur.id, `${dinosaur.containmentState} · hunger ${dinosaur.hunger}%`, dinosaur.currentZone));
  for (const agent of snapshot.agents) rows.push(row("AGENT", agent.id, agent.id, agent.status, agent.location));
  for (const visitor of snapshot.visitors) rows.push(row("VISITOR", visitor.id, visitor.id, visitor.safetyState, visitor.location));
  for (const device of snapshot.devices) rows.push(row("DEVICE", device.id, device.id, `${device.state} · ${device.type}`, device.zoneId));
  for (const incident of snapshot.incidents) rows.push(row("INCIDENT", incident.id, incident.id, `${incident.status} · severity ${incident.severity}`, incident.enclosureId, incident.severity));
  return cloneFreeze(rows.sort((a, b) => a.kind.localeCompare(b.kind) || compare(a.id, b.id)));
}

function metrics(snapshot: WorldSnapshot, credits: number, paused: boolean, speed: 1 | 2 | 4): ParkMetrics {
  const attendance = snapshot.visitors.reduce((sum, visitor) => sum + visitor.size, 0);
  const satisfaction = snapshot.visitors.length === 0 ? 0 : Math.round(snapshot.visitors.reduce((sum, visitor) => sum + visitor.satisfaction, 0) / snapshot.visitors.length);
  const dinosaurHealth = snapshot.dinosaurs.length === 0 ? 0 : Math.round(snapshot.dinosaurs.reduce((sum, dinosaur) => sum + dinosaur.health, 0) / snapshot.dinosaurs.length);
  const openIncidents = snapshot.incidents.filter((incident) => incident.status !== "RECOVERED").length;
  const closures = snapshot.enclosures.filter((enclosure) => !enclosure.closed).length;
  return cloneFreeze({
    credits,
    logicalTime: snapshot.logicalTime,
    speed,
    paused,
    attendance,
    satisfaction,
    dinosaurHealth,
    uptime: openIncidents === 0 ? 100 : Math.max(0, 100 - openIncidents * 10 - closures * 5),
    closures,
    openIncidents,
    recoveredIncidents: snapshot.incidents.filter((incident) => incident.status === "RECOVERED").length,
  });
}

export interface ReadModelInputs {
  readonly version?: number;
  readonly snapshot: WorldSnapshot;
  readonly jobs: readonly OperationsJob[];
  readonly selectedEntityId?: string;
  readonly credits?: number;
  readonly paused?: boolean;
  readonly speed?: 1 | 2 | 4;
  readonly getAgentContext?: (agentId: string, job?: OperationsJob) => { readonly load: number; readonly snapshotId?: string; readonly items: readonly unknown[] };
  readonly memory?: MemoryService;
  readonly managerByWorker?: Readonly<Record<string, string>>;
  readonly traceIdsByAgent?: Readonly<Record<string, readonly string[]>>;
  readonly acknowledgedIncidentIds?: readonly string[];
  readonly incidentCosts?: Readonly<Record<string, number>>;
}

export function projectAgentViews(input: ReadModelInputs): readonly AgentOperationsView[] {
  const jobsByAgent = new Map<string, OperationsJob[]>();
  for (const job of input.jobs) {
    const list = jobsByAgent.get(job.assignedAgentId) ?? [];
    list.push(job);
    jobsByAgent.set(job.assignedAgentId, list);
  }
  return cloneFreeze(input.snapshot.agents.map((agent) => {
    const jobs = (jobsByAgent.get(agent.id) ?? []).slice().sort(jobOrder);
    const currentTask = jobs.find((job) => job.status === "RUNNING" || job.status === "PAUSED");
    const context = input.getAgentContext?.(agent.id, currentTask);
    const memorySummary = input.memory
      ? agent.memoryRefs.map((id) => input.memory?.repository().get(id)).filter((record): record is NonNullable<typeof record> => Boolean(record)).map((record) => ({ id: record.id, status: input.memory?.evaluate(record, input.snapshot.logicalTime, { maxAgeSeconds: 300 }) ?? "FRESH", provenance: record.provenance }))
      : [];
    return {
      id: agent.id,
      definitionId: agent.agentDefinitionId,
      status: agent.status,
      location: agent.location,
      battery: agent.battery,
      tools: agent.tools,
      ...(currentTask ? { currentTask } : {}),
      queue: jobs.filter((job) => job.id !== currentTask?.id),
      contextBudget: agent.contextBudget,
      contextLoad: context?.load ?? currentTask?.contextSnapshot?.totalLoad ?? 0,
      ...(context?.snapshotId || currentTask?.contextSnapshotId ? { contextSnapshotId: context?.snapshotId ?? currentTask?.contextSnapshotId } : {}),
      contextItems: (context?.items ?? currentTask?.contextSnapshot?.items ?? []) as AgentOperationsView["contextItems"],
      memorySummary,
      ...(input.managerByWorker?.[agent.id] ? { managerId: input.managerByWorker[agent.id] } : {}),
      recentTraceIds: input.traceIdsByAgent?.[agent.id] ?? jobs.flatMap((job) => job.traceId ? [job.traceId] : []),
      sourceId: agent.id,
    } satisfies AgentOperationsView;
  }));
}

export function createParkReadModel(input: ReadModelInputs): ParkOperationsView {
  const jobs = input.jobs.slice().sort(jobOrder);
  const mapRows = projectMapRows(input.snapshot);
  const incidents = input.snapshot.incidents.slice().sort(incidentOrder);
  const sourceIds: Record<string, string> = {};
  const responsibleJobs = new Map(incidents.map((incident) => [incident.id, jobs.find((candidate) => candidate.targetRefs.some((target) => incident.affectedEntities.includes(target) || target === incident.enclosureId))]));
  for (const entity of mapRows) sourceIds[entity.id] = entity.sourceId;
  return cloneFreeze({
    version: input.version ?? input.snapshot.eventSequence,
    snapshot: input.snapshot,
    metrics: metrics(input.snapshot, input.credits ?? 0, input.paused ?? false, input.speed ?? 1),
    jobs,
    agents: projectAgentViews(input),
    incidents,
    alerts: incidents.filter((incident) => incident.status !== "RECOVERED"),
    acknowledgedIncidentIds: input.acknowledgedIncidentIds ?? [],
    incidentTraceLinks: Object.fromEntries(incidents.flatMap((incident) => {
      const job = responsibleJobs.get(incident.id);
      return job?.traceId ? [[incident.id, job.traceId] as const] : [];
    })),
    incidentDetails: incidents.map((incident) => {
      const job = responsibleJobs.get(incident.id);
      const acknowledged = input.acknowledgedIncidentIds?.includes(incident.id) ?? false;
      return {
        id: incident.id,
        severity: incident.severity,
        trigger: incident.trigger,
        status: incident.status,
        affectedEntityIds: incident.affectedEntities,
        recoveryRequirements: incident.recoveryRequirements,
        currentResponse: incident.status === "RECOVERED" ? "Recovery verified" : incident.status === "CONTAINED" ? "Security response active" : acknowledged ? "Acknowledged; response pending" : "Awaiting acknowledgement",
        ...(job ? { responsibleJobId: job.id } : {}),
        ...(job?.traceId ? { traceId: job.traceId } : {}),
        costCredits: input.incidentCosts?.[incident.id] ?? 0,
      };
    }),
    mapRows,
    accessibleRows: mapRows,
    ...(input.selectedEntityId ? { selectedEntityId: input.selectedEntityId } : {}),
    sourceIds,
  });
}

export function equivalentMapAndTable(view: Pick<ParkOperationsView, "mapRows" | "accessibleRows">): boolean {
  return canonicalSerialize(view.mapRows) === canonicalSerialize(view.accessibleRows);
}
