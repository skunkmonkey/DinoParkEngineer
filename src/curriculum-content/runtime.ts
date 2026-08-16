import { createContentRegistry, type ContentRegistry } from "../../content-registry/index.ts";
import { CURRICULUM_CONTENT_PACK, CURRICULUM_EVAL_SUITES, CURRICULUM_MANAGER_CONFIGS, CURRICULUM_SAFE_FEEDING_RECIPE, createCurriculumWorkflow, createScenarioDirector, runCurriculumAcceptance, type CurriculumAcceptanceReport, type CurriculumWorkflowPort, type ScenarioDirectorPort } from "../../curriculum-content/index.ts";
import type { EconomyProgressionService } from "../../economy-progression/index.ts";
import type { EvalService } from "../../eval-runner/index.ts";
import type { WorkbenchService } from "../../engineering-workbench/index.ts";
import type { ReviewDeploymentRuntime } from "../../review-deployment/index.ts";
import type { OrchestrationService } from "../../orchestration/index.ts";
import type { ParkOperationsService } from "../../park-operations/index.ts";
import { getActiveTraceReplayRuntime } from "../trace-replay/public.ts";
import type { TraceReplayRuntime } from "../trace-replay/public.ts";

export interface CurriculumCatalogRuntime {
  readonly registry: ContentRegistry;
  readonly director: ScenarioDirectorPort;
  readonly pack: typeof CURRICULUM_CONTENT_PACK;
  readonly acceptance: CurriculumAcceptanceReport;
  readonly evalSuites: typeof CURRICULUM_EVAL_SUITES;
  readonly managerConfigs: typeof CURRICULUM_MANAGER_CONFIGS;
  readonly commissionRecipes: readonly (typeof CURRICULUM_SAFE_FEEDING_RECIPE)[];
}

export interface CurriculumRuntime extends CurriculumCatalogRuntime {
  readonly workflow: CurriculumWorkflowPort;
}

export interface CurriculumProviderDependencies {
  readonly evals: EvalService;
  readonly economy: EconomyProgressionService;
  readonly reviews: ReviewDeploymentRuntime;
  readonly workbench: WorkbenchService;
  readonly traces: TraceReplayRuntime;
  readonly orchestration: OrchestrationService;
  readonly park: ParkOperationsService;
}

let activeRuntime: CurriculumRuntime | null = null;
let activeCatalog: CurriculumCatalogRuntime | null = null;

function asRegistry(value: unknown): ContentRegistry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ContentRegistry>;
  return typeof candidate.loadPack === "function" && typeof candidate.queryScenarios === "function" ? candidate as ContentRegistry : undefined;
}

export function createCurriculumCatalogProvider(): CurriculumCatalogRuntime {
  const shared = asRegistry(getActiveTraceReplayRuntime()?.content);
  const registry = shared ?? createContentRegistry();
  if (registry.queryScenarios({ id: "scenario.curriculum.onboarding" }).length === 0) {
    const loaded = registry.loadPack(CURRICULUM_CONTENT_PACK);
    if (!loaded.ok) throw new Error(`Curriculum content failed validation: ${loaded.error.map((item) => `${item.code}: ${item.message}`).join("; ")}`);
  }
  const runtime: CurriculumCatalogRuntime = Object.freeze({ registry, director: createScenarioDirector(0), pack: CURRICULUM_CONTENT_PACK, acceptance: runCurriculumAcceptance(), evalSuites: CURRICULUM_EVAL_SUITES, managerConfigs: CURRICULUM_MANAGER_CONFIGS, commissionRecipes: [CURRICULUM_SAFE_FEEDING_RECIPE] });
  activeCatalog = runtime;
  return runtime;
}

export function createCurriculumProvider(catalog: CurriculumCatalogRuntime, dependencies: CurriculumProviderDependencies): CurriculumRuntime {
  const workflow = createCurriculumWorkflow({ registry: catalog.registry, acceptance: catalog.acceptance, evals: dependencies.evals, economy: dependencies.economy, reviews: dependencies.reviews, workbench: dependencies.workbench, traces: dependencies.traces, orchestration: dependencies.orchestration, park: dependencies.park }, catalog.director);
  const runtime: CurriculumRuntime = Object.freeze({ ...catalog, workflow });
  activeRuntime = runtime;
  return runtime;
}

export function getActiveCurriculumCatalog(): CurriculumCatalogRuntime | null {
  return activeCatalog;
}

export function getActiveCurriculumRuntime(): CurriculumRuntime | null {
  return activeRuntime;
}

export function setActiveCurriculumRuntime(runtime: CurriculumRuntime | null): void {
  activeRuntime = runtime;
}

export function setActiveCurriculumCatalog(runtime: CurriculumCatalogRuntime | null): void {
  activeCatalog = runtime;
}
