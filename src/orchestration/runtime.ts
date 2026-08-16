import type { ContextService } from "../context/public.ts";
import type { ContentRegistry } from "../content-registry/public.ts";
import type { EconomyProgressionService } from "../economy-progression/public.ts";
import type { ParkOperationsService } from "../park-operations/public.ts";
import type { ReviewDeploymentRuntime } from "../review-deployment/public.ts";
import type { TraceReplayRuntime } from "../trace-replay/public.ts";
import {
  DEFAULT_MANAGER_CONFIG,
  createOrchestrationContentPack,
  createOrchestrationService,
  type ManagerConfig,
  type ManagerEligibility,
  type ManagerParkSummary,
  type OrchestrationService,
  type SchedulingJob,
  type SchedulingWorker,
} from "../../orchestration/index.ts";

let active: OrchestrationService | null = null;
let disposeSubscriptions: (() => void) | null = null;

function roleFor(agent: ReturnType<ParkOperationsService["getPark"]>["agents"][number]): string {
  const identity = `${agent.id} ${agent.definitionId}`.toLowerCase();
  if (identity.includes("security")) return "SECURITY";
  if (identity.includes("maintenance")) return "MAINTENANCE";
  return "KEEPER";
}

export function workersFromPark(park: ParkOperationsService): readonly SchedulingWorker[] {
  return park.getPark().agents.map((agent) => ({
    id: agent.id,
    role: roleFor(agent),
    status: agent.status,
    tools: agent.tools,
    toolIds: agent.tools,
    contextBudget: agent.contextBudget,
    contextLoad: agent.contextLoad,
    queueLength: agent.queue.length + (agent.currentTask ? 1 : 0),
    queueCapacity: 5,
    managerId: agent.managerId,
    enabled: !["DISABLED", "OFFLINE"].includes(agent.status),
    sourceId: agent.sourceId,
  }));
}

function requiredTools(type: string): readonly string[] {
  const normalized = type.toUpperCase();
  if (normalized.includes("EVACUAT")) return ["alert_security", "evacuate_visitors"];
  if (normalized.includes("RESCUE")) return ["alert_security", "rescue_visitors"];
  if (normalized.includes("SECURITY") || normalized.includes("CONTAIN")) return ["alert_security"];
  if (normalized.includes("FEED")) return ["dispense_food"];
  return [];
}

export function jobsFromPark(park: ParkOperationsService): readonly SchedulingJob[] {
  return park.jobs().filter((job) => job.status === "QUEUED").map((job) => ({
    id: job.id,
    type: job.type,
    targetRefs: job.targetRefs,
    priority: job.priority,
    dueTime: job.dueTime,
    requiredToolIds: requiredTools(job.type),
    requiredContextRefs: job.contextSnapshot?.items
      .filter((item) => item.version !== undefined)
      .map((item) => !item.ref.endsWith(`@${item.version}`) ? `${item.ref}@${item.version}` : item.ref) ?? [],
    requiredContextLoad: job.contextSnapshot?.totalLoad ?? 0,
    assignedAgentId: job.assignedAgentId,
    status: job.status,
    expectedVersion: job.observedVersion,
  }));
}

export function summaryFromPark(park: ParkOperationsService): ManagerParkSummary {
  const view = park.getPark();
  return {
    park: { version: view.version, logicalTime: view.snapshot.logicalTime, fixtureId: view.snapshot.fixtureId, credits: view.metrics.credits, openIncidents: view.metrics.openIncidents },
    incidents: view.incidentDetails.map((incident) => ({ id: incident.id, severity: incident.severity, status: incident.status, trigger: incident.trigger, affectedEntityIds: incident.affectedEntityIds, responsibleJobId: incident.responsibleJobId ?? null, traceId: incident.traceId ?? null })),
    schedules: jobsFromPark(park).map((job) => ({ ...job })),
    workers: workersFromPark(park).map((worker) => ({ id: worker.id, role: worker.role ?? "UNKNOWN", status: worker.status ?? "IDLE", queueLength: worker.queueLength ?? 0, contextLoad: worker.contextLoad ?? 0, contextBudget: worker.contextBudget, tools: worker.tools ?? [] })),
  };
}

export function economyEligibility(economy?: EconomyProgressionService): ManagerEligibility {
  if (!economy) return { eligible: false, code: "PRESSURE_REQUIRED", reason: "Economy/Progression is unavailable, so Manager eligibility cannot be verified." };
  const progress = economy.snapshot();
  const pressure = progress.workerCount >= 4 || progress.interventions >= 12;
  const unlocked = progress.capabilities.includes("manager.agent") || progress.capabilities.includes("capability.manager-agent");
  if (!pressure || !unlocked) return { eligible: false, code: "PRESSURE_REQUIRED", reason: "Experience coordination pressure with four workers or twelve interventions and unlock Manager Agent progression first.", workerCount: progress.workerCount, interventions: progress.interventions, purchased: false };
  const purchased = economy.purchases().entitlements().entitlements.some((entitlement) => entitlement.id === "manager.agent");
  if (!purchased) return { eligible: false, code: "PURCHASE_REQUIRED", reason: "Manager Agent is unlocked but must be purchased before activation.", workerCount: progress.workerCount, interventions: progress.interventions, purchased: false };
  return { eligible: true, code: "AVAILABLE", reason: "Manager pressure, unlock, and purchase requirements are satisfied.", workerCount: progress.workerCount, interventions: progress.interventions, purchased: true };
}

export interface OrchestrationProviderOptions {
  readonly park: ParkOperationsService;
  readonly economy?: EconomyProgressionService;
  readonly review?: ReviewDeploymentRuntime;
  readonly traces?: TraceReplayRuntime;
  readonly config?: ManagerConfig;
  readonly configs?: readonly ManagerConfig[];
}

export function createOrchestrationProvider(options: OrchestrationProviderOptions): OrchestrationService {
  disposeSubscriptions?.();
  const content = options.traces?.content as ContentRegistry | undefined;
  const context = options.traces?.context as ContextService | undefined;
  if (content && !content.getArtifact({ artifactId: "manager.operations.default", version: 2 })) {
    const loaded = content.loadPack(createOrchestrationContentPack());
    if (!loaded.ok) throw new Error(`Orchestration content failed validation: ${loaded.error.map((item) => item.message).join("; ")}`);
  }
  const liveWorkerIds = workersFromPark(options.park).map((worker) => worker.id);
  const base = options.config ?? DEFAULT_MANAGER_CONFIG;
  const fallbackConfig: ManagerConfig = { ...base, workerIds: liveWorkerIds, workerPool: liveWorkerIds, workerAgentIds: liveWorkerIds, maxWorkers: Math.max(1, liveWorkerIds.length), maxConcurrentWorkers: Math.max(1, liveWorkerIds.length) };
  const configs = options.configs?.length ? options.configs : [fallbackConfig];
  const service = createOrchestrationService({
    workers: () => workersFromPark(options.park),
    configs,
    content,
    context,
    traces: options.traces?.repository,
    jobs: options.park,
    jobLookup: (jobId) => jobsFromPark(options.park).find((job) => job.id === jobId),
    jobList: () => jobsFromPark(options.park),
    logicalTime: () => options.park.snapshot().logicalTime,
    parkSummary: () => summaryFromPark(options.park),
    eligibility: () => economyEligibility(options.economy),
    deployment: options.review?.deployments,
  });
  const unsubs = [options.park.subscribe(() => service.refresh()), ...(options.economy ? [options.economy.subscribe(() => service.refresh())] : [])];
  disposeSubscriptions = () => { for (const unsubscribe of unsubs) unsubscribe(); };
  active = service;
  return service;
}

export function getActiveOrchestrationService(): OrchestrationService | null {
  return active;
}

export function setActiveOrchestrationService(service: OrchestrationService | null): void {
  if (!service) {
    disposeSubscriptions?.();
    disposeSubscriptions = null;
  }
  active = service;
}
