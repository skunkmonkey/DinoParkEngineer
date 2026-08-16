import { createContentRegistry, type ContentRegistry } from "../../content-registry/index.ts";
import { createContextService } from "../../context/index.ts";
import { createEvalService, createMvpEvalContentPack, type EvalService } from "../../eval-runner/index.ts";
import { createReviewDeploymentService, createReviewDemoContentPack, type ReviewDeploymentRuntime, type ReviewJobProfile, type ReviewRegistryPort } from "../../review-deployment/index.ts";
import type { CreditBalance, CreditCommand, CreditResult } from "../../economy-progression/index.ts";

let activeRuntime: ReviewDeploymentRuntime | null = null;

export type { ReviewDeploymentRuntime, ReviewJobProfile, ReviewRegistryPort };

export interface ReviewProviderOptions {
  readonly registry?: ReviewRegistryPort;
  readonly context?: ReturnType<typeof createContextService>;
  readonly evals?: EvalService;
  readonly economy?: { readonly transact: (command: CreditCommand) => CreditResult; readonly balance: () => CreditBalance };
  readonly jobProfiles?: readonly ReviewJobProfile[];
}

function loadDefaults(registry: ContentRegistry): void {
  if (registry.queryEvals({ id: "eval.standard-feeding" }).length === 0) {
    const evalPack = registry.loadPack(createMvpEvalContentPack());
    if (!evalPack.ok) throw new Error(`Review dependency eval pack failed validation: ${evalPack.error.map((item) => item.message).join("; ")}`);
  }
  if (registry.getArtifact({ artifactId: "review.skill.carnivore-feeding", version: 3 }) === undefined) {
    const demoPack = registry.loadPack(createReviewDemoContentPack());
    if (!demoPack.ok) throw new Error(`Review demo content failed validation: ${demoPack.error.map((item) => item.message).join("; ")}`);
  }
}

export function createReviewProvider(options: ReviewProviderOptions = {}): ReviewDeploymentRuntime {
  const registry = (options.registry as ContentRegistry | undefined) ?? createContentRegistry();
  if (!options.registry) loadDefaults(registry);
  const evals = options.evals ?? createEvalService({ registry });
  if (registry.getArtifact({ artifactId: "review.skill.carnivore-feeding", version: 3 }) === undefined) {
    const demoPack = registry.loadPack(createReviewDemoContentPack());
    if (!demoPack.ok) throw new Error(`Review demo content failed validation: ${demoPack.error.map((item) => item.message).join("; ")}`);
  }
  const context = options.context ?? createContextService();
  const jobProfiles = options.jobProfiles ?? Object.freeze([{
    id: "feeding-job",
    agentId: "keeper-01",
    jobId: "feed-rex",
    budget: 8_000,
    toolIds: ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"],
    applicabilityTags: ["task:feeding", "safety:standard"],
    logicalTime: 0,
  }]);
  const runtime = createReviewDeploymentService({ registry, context, evals, economy: options.economy, jobProfiles, initialActiveRefs: [{ artifactId: "review.skill.carnivore-feeding", version: 3 }] });
  activeRuntime = runtime;
  return runtime;
}

export interface ProductionReviewDependencies {
  readonly registry?: ContentRegistry;
  readonly context?: ReturnType<typeof createContextService>;
  readonly evals?: EvalService;
  readonly economy?: { readonly transact: (command: CreditCommand) => CreditResult; readonly balance: () => CreditBalance };
}

export function createProductionReviewProvider(dependencies: ProductionReviewDependencies = {}): ReviewDeploymentRuntime {
  const registry = dependencies.registry ?? createContentRegistry();
  if (registry.queryEvals({ id: "eval.standard-feeding" }).length === 0) {
    const evalPack = registry.loadPack(createMvpEvalContentPack());
    if (!evalPack.ok) throw new Error(`Review shared eval pack failed validation: ${evalPack.error.map((item) => item.message).join("; ")}`);
  }
  if (registry.getArtifact({ artifactId: "review.skill.carnivore-feeding", version: 3 }) === undefined) {
    const demoPack = registry.loadPack(createReviewDemoContentPack());
    if (!demoPack.ok) throw new Error(`Review shared demo content failed validation: ${demoPack.error.map((item) => item.message).join("; ")}`);
  }
  return createReviewProvider({ registry, context: dependencies.context, evals: dependencies.evals, economy: dependencies.economy });
}

export function getActiveReviewDeploymentRuntime(): ReviewDeploymentRuntime | null {
  return activeRuntime;
}

export function setActiveReviewDeploymentRuntime(runtime: ReviewDeploymentRuntime | null): void {
  activeRuntime = runtime;
}
