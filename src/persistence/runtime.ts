import {
  createAutosaveScheduler,
  createContentRegistryStateAdapter,
  createCurriculumStateAdapter,
  createEconomyStateAdapter,
  createEvalStateAdapter,
  createJobsIncidentsStateAdapter,
  createMemoryStateAdapter,
  createPersistenceService,
  createReviewDeploymentStateAdapter,
  createStateAdapter,
  createTraceStateAdapter,
  createTransactionCoordinator,
  type AutosaveScheduler,
  type FeatureStateAdapter,
  type PersistenceOptions,
  type SaveService,
  type TransactionCoordinator,
  type TransactionParticipant,
  type TransactionResult,
} from "../../persistence/index.ts";
import type { ContentRegistry } from "../../content-registry/index.ts";
import type { ParkOperationsService } from "../../park-operations/index.ts";
import type { EconomyProgressionService } from "../../economy-progression/index.ts";
import type { EvalService } from "../../eval-runner/index.ts";
import type { ReviewDeploymentRuntime } from "../../review-deployment/index.ts";
import type { TraceReplayRuntime } from "../trace-replay/public.ts";
import type { CurriculumRuntime } from "../curriculum-content/public.ts";

export interface PersistenceRuntime {
  readonly service: SaveService;
  readonly autosave: AutosaveScheduler;
  readonly transactions: TransactionCoordinator;
  readonly workflows?: PersistenceTransactionalWorkflows;
  readonly dispose: () => void;
}

export interface PersistenceTransactionalWorkflows {
  readonly purchase: <T>(transactionId: string, work: () => T | Promise<T>) => Promise<TransactionResult<T>>;
  readonly commission: <T>(transactionId: string, work: () => T | Promise<T>) => Promise<TransactionResult<T>>;
  readonly eval: <T>(transactionId: string, work: () => T | Promise<T>) => Promise<TransactionResult<T>>;
  readonly deploy: <T>(transactionId: string, work: () => T | Promise<T>) => Promise<TransactionResult<T>>;
}

export interface ProductionPersistenceDependencies {
  readonly park: ParkOperationsService;
  readonly economy: EconomyProgressionService;
  readonly evals: EvalService;
  readonly reviews: ReviewDeploymentRuntime;
  readonly traces: TraceReplayRuntime;
  readonly curriculum: CurriculumRuntime;
}

export interface ProductionPersistenceOptions extends Omit<PersistenceOptions, "adapters" | "boundary" | "resolveContentRef"> {
  readonly autosaveIntervalSeconds?: number;
}

let activeRuntime: PersistenceRuntime | null = null;

export function createPersistenceProvider(options: PersistenceOptions = {}): PersistenceRuntime {
  const service = createPersistenceService(options);
  const autosave = createAutosaveScheduler(service);
  const runtime: PersistenceRuntime = Object.freeze({ service, autosave, transactions: createTransactionCoordinator(), dispose: () => autosave.dispose() });
  activeRuntime = runtime;
  return runtime;
}

function sharedRegistry(traces: TraceReplayRuntime): ContentRegistry {
  const candidate = traces.content as Partial<ContentRegistry>;
  if (typeof candidate.getArtifact !== "function" || typeof candidate.manifest !== "function" || typeof candidate.checkpointLifecycle !== "function") throw new Error("Production persistence requires the shared versioned content registry.");
  return candidate as ContentRegistry;
}

function parseArtifactRef(value: string): { readonly artifactId: string; readonly version: number } | undefined {
  const separator = value.lastIndexOf("@");
  if (separator <= 0) return undefined;
  const version = Number(value.slice(separator + 1));
  return Number.isSafeInteger(version) && version > 0 ? { artifactId: value.slice(0, separator), version } : undefined;
}

export function createProductionPersistenceProvider(dependencies: ProductionPersistenceDependencies, options: ProductionPersistenceOptions = {}): PersistenceRuntime {
  const registry = sharedRegistry(dependencies.traces);
  let safeControlSnapshot: ReturnType<ParkOperationsService["getControlState"]> | undefined;
  const operationsPort = { snapshot: () => ({ ...dependencies.park.persistenceSnapshot(), ...(safeControlSnapshot ?? {}) }), restore: (value: unknown) => dependencies.park.restorePersistence(value as ReturnType<ParkOperationsService["persistenceSnapshot"]>) };
  const reviewPort = {
    snapshot: () => ({ reviews: dependencies.reviews.reviews.checkpoint(), deployments: dependencies.reviews.deployments.checkpoint() }),
    restore: (value: unknown) => {
      const checkpoint = value as { reviews: ReturnType<ReviewDeploymentRuntime["reviews"]["checkpoint"]>; deployments: ReturnType<ReviewDeploymentRuntime["deployments"]["checkpoint"]> };
      dependencies.reviews.reviews.restore(checkpoint.reviews);
      dependencies.reviews.deployments.restore(checkpoint.deployments);
    },
  };
  const curriculumPort = { snapshot: dependencies.curriculum.director.state, restore: (value: unknown) => dependencies.curriculum.director.restore(value as ReturnType<CurriculumRuntime["director"]["state"]>) };
  const adapters = [
    createStateAdapter({ id: "simulation", schemaVersion: 1, snapshot: () => dependencies.park.snapshot(), validate: (value) => value && typeof value === "object" && "logicalTime" in value ? { ok: true, value: value as ReturnType<ParkOperationsService["snapshot"]> } : { ok: false, error: [{ code: "INVALID_TYPE", path: "$", message: "Simulation state must be a world snapshot." }] }, restore: (value) => dependencies.park.restoreWorld(value) }),
    createEconomyStateAdapter({ snapshot: dependencies.economy.persistenceSnapshot, restore: (value) => dependencies.economy.restorePersistence(value as ReturnType<EconomyProgressionService["persistenceSnapshot"]>) }),
    createStateAdapter({ id: "agents", schemaVersion: 1, snapshot: operationsPort.snapshot, validate: (value) => value && typeof value === "object" ? { ok: true, value: value as ReturnType<typeof operationsPort.snapshot> } : { ok: false, error: [{ code: "INVALID_TYPE", path: "$", message: "Agent operations state must be an object." }] }, restore: operationsPort.restore }),
    createJobsIncidentsStateAdapter(operationsPort),
    createMemoryStateAdapter(dependencies.park.memoryRepository()),
    createEvalStateAdapter({ snapshot: dependencies.evals.persistenceSnapshot, restore: (value) => dependencies.evals.restorePersistence(value as ReturnType<EvalService["persistenceSnapshot"]>) }),
    createReviewDeploymentStateAdapter(reviewPort),
    createTraceStateAdapter(dependencies.traces.repository),
    createCurriculumStateAdapter(curriculumPort),
    createContentRegistryStateAdapter(registry),
  ];
  const service = createPersistenceService({
    ...options,
    adapters,
    boundary: { awaitSafePoint: async () => { const previous = dependencies.park.getControlState(); safeControlSnapshot = previous; const release = dependencies.park.enterPersistenceSafeBoundary(); return () => { release(); safeControlSnapshot = undefined; }; }, isSafe: () => dependencies.park.isPersistenceSafe() },
    resolveContentRef: (value) => { const ref = parseArtifactRef(value); return ref !== undefined && registry.getArtifact(ref) !== undefined; },
  });
  const autosave = createAutosaveScheduler(service, { intervalSeconds: options.autosaveIntervalSeconds });
  let transactionDepth = 0;
  const unsubscribers = [
    dependencies.park.subscribe((change) => {
      if (transactionDepth > 0) return;
      void autosave.onLogicalTime(change.logicalTime);
      if (change.kind === "INCIDENT" || change.kind === "JOB") void autosave.onMajorEvent(change.kind.toLowerCase(), change.logicalTime);
    }),
    dependencies.economy.subscribe(() => { if (transactionDepth === 0) void autosave.onMajorEvent("economy", dependencies.park.snapshot().logicalTime); }),
  ];
  const transactions = createTransactionCoordinator();
  const participants = {
    economy: { id: "economy", checkpoint: () => dependencies.economy.persistenceSnapshot(), recover: (value: unknown) => dependencies.economy.restorePersistence(value as ReturnType<EconomyProgressionService["persistenceSnapshot"]>) },
    evals: { id: "evals", checkpoint: () => dependencies.evals.persistenceSnapshot(), recover: (value: unknown) => dependencies.evals.restorePersistence(value as ReturnType<EvalService["persistenceSnapshot"]>) },
    reviews: { id: "reviews-deployments", checkpoint: reviewPort.snapshot, recover: reviewPort.restore },
    registry: { id: "content-registry", checkpoint: () => registry.checkpointLifecycle(), recover: (value: unknown) => registry.restoreLifecycle(value as ReturnType<ContentRegistry["checkpointLifecycle"]>) },
    traces: { id: "traces", checkpoint: () => dependencies.traces.repository.records(), recover: (value: unknown) => dependencies.traces.repository.replace(value as ReturnType<TraceReplayRuntime["repository"]["records"]>) },
  } satisfies Readonly<Record<string, TransactionParticipant>>;
  const workflow = async <T>(transactionId: string, event: string, members: readonly TransactionParticipant[], work: () => T | Promise<T>): Promise<TransactionResult<T>> => {
    transactionDepth += 1;
    let result: TransactionResult<T>;
    try { result = await transactions.execute(transactionId, members, work); }
    finally { transactionDepth -= 1; }
    if (result.ok && !result.duplicate) await autosave.onMajorEvent(event, dependencies.park.snapshot().logicalTime);
    return result;
  };
  const workflows: PersistenceTransactionalWorkflows = Object.freeze({
    purchase: <T>(transactionId: string, work: () => T | Promise<T>) => workflow(transactionId, "purchase", [participants.economy], work),
    commission: <T>(transactionId: string, work: () => T | Promise<T>) => workflow(transactionId, "commission", [participants.economy, participants.registry, participants.reviews], work),
    eval: <T>(transactionId: string, work: () => T | Promise<T>) => workflow(transactionId, "eval", [participants.economy, participants.evals, participants.traces], work),
    deploy: <T>(transactionId: string, work: () => T | Promise<T>) => workflow(transactionId, "deployment", [participants.registry, participants.reviews], work),
  });
  const runtime: PersistenceRuntime = Object.freeze({ service, autosave, transactions, workflows, dispose: () => { for (const unsubscribe of unsubscribers) unsubscribe(); autosave.dispose(); } });
  activeRuntime = runtime;
  return runtime;
}

export function getActivePersistenceRuntime(): PersistenceRuntime | null { return activeRuntime; }
export function getActivePersistenceService(): SaveService | null { return activeRuntime?.service ?? null; }
export function setActivePersistenceRuntime(runtime: PersistenceRuntime | null): void { activeRuntime = runtime; }
export function registerPersistenceAdapter<T>(adapter: FeatureStateAdapter<T>): void { activeRuntime?.service.registerAdapter(adapter); }
