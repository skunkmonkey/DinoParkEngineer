import { createWorkbenchBaselineContentPack, createWorkbenchService, type WorkbenchService, type WorkbenchServiceOptions } from "../../engineering-workbench/index.ts";
import type { ContentRegistry } from "../../content-registry/index.ts";
import type { ContextService } from "../../context/index.ts";
import type { EconomyProgressionService } from "../../economy-progression/index.ts";
import type { ReviewDeploymentRuntime } from "../../review-deployment/index.ts";
import { getActiveTraceReplayRuntime } from "../trace-replay/public.ts";

export interface EngineeringWorkbenchRuntime {
  readonly service: WorkbenchService;
  readonly registry: ContentRegistry;
}

let activeRuntime: EngineeringWorkbenchRuntime | null = null;

export interface WorkbenchProviderDependencies {
  readonly registry?: ContentRegistry;
  readonly context?: ContextService;
  readonly economy?: EconomyProgressionService;
  readonly reviews?: ReviewDeploymentRuntime;
  readonly evals?: import("../../eval-runner/index.ts").EvalService;
  readonly recipes?: WorkbenchServiceOptions["recipes"];
}

function asRegistry(value: unknown): ContentRegistry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ContentRegistry>;
  return typeof candidate.getArtifact === "function" && typeof candidate.queryArtifacts === "function" && typeof candidate.loadPack === "function" ? candidate as ContentRegistry : undefined;
}

export function createWorkbenchProvider(options: WorkbenchServiceOptions | WorkbenchProviderDependencies = {}): EngineeringWorkbenchRuntime {
  const candidate = options as WorkbenchServiceOptions;
  const dependencies = options as WorkbenchProviderDependencies;
  const shared = getActiveTraceReplayRuntime();
  const registry = candidate.registry ?? dependencies.registry ?? asRegistry(shared?.content);
  const context = candidate.context ?? dependencies.context ?? shared?.context as ContextService | undefined;
  const economy = candidate.economy ?? dependencies.economy;
  const reviews = candidate.reviews ?? dependencies.reviews?.reviews;
  const deployment = candidate.deployment ?? dependencies.reviews?.deployments;
  const evals = candidate.evals ?? dependencies.evals;
  const recipes = candidate.recipes ?? dependencies.recipes;
  if (!registry) throw new Error("Engineering Workbench requires the public Content Registry provider.");
  const baselineRefs = ["workbench.tool.gate-observation", "workbench.eval.feeding-risk-suite", "workbench.memory.shared-retention"] as const;
  const baselineCount = baselineRefs.filter((artifactId) => registry.getArtifact({ artifactId, version: 1 })).length;
  if (baselineCount === 0) {
    const loaded = registry.loadPack(createWorkbenchBaselineContentPack());
    if (!loaded.ok) throw new Error(`Engineering Workbench baseline content is invalid: ${loaded.error.map((item) => item.message).join(" ")}`);
  }
  if (baselineCount > 0 && baselineCount !== baselineRefs.length) throw new Error("Engineering Workbench baseline content is incomplete; refusing to mix partial authored configuration state.");
  const service = createWorkbenchService({
    ...candidate,
    registry,
    ...(context ? { context } : {}),
    ...(economy ? { economy } : {}),
    ...(reviews ? { reviews } : {}),
    ...(deployment ? { deployment } : {}),
    ...(evals ? { evals } : {}),
    ...(recipes ? { recipes } : {}),
    ...(reviews ? {
      reviewIntake: {
        submit(proposal, meta) {
          const reviewService = reviews as import("../../review-deployment/index.ts").ReviewService;
          const result = reviewService.submit({ id: meta.reviewId ?? `review.commission.${proposal.artifactId}.${proposal.version}`, baseRef: meta.baseRef, proposedRef: { artifactId: proposal.artifactId, version: proposal.version }, author: meta.author, goal: meta.goal, createdAtGameTime: meta.createdAtGameTime, affectedDependencies: meta.affectedDependencies, affectedConsumers: meta.affectedConsumers });
          return result.ok ? { ok: true, value: { reviewId: result.value.reviewId } } : { ok: false, error: { code: result.error.code, message: result.error.message } };
        },
      },
    } : {}),
  });
  const runtime: EngineeringWorkbenchRuntime = Object.freeze({ service, registry });
  activeRuntime = runtime;
  return runtime;
}

export function getActiveWorkbenchRuntime(): EngineeringWorkbenchRuntime | null {
  return activeRuntime;
}

export function setActiveWorkbenchRuntime(runtime: EngineeringWorkbenchRuntime | null): void {
  activeRuntime = runtime;
}
