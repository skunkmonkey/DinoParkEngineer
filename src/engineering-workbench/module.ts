import { createFramedRouteRegistration } from "../platform/public.ts";
import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createWorkbenchProvider, getActiveWorkbenchRuntime, setActiveWorkbenchRuntime } from "./runtime.ts";
import { DEFAULT_COMMISSION_RECIPES } from "../../engineering-workbench/index.ts";

const lazyWorkbench = async (): Promise<RouteComponent> => (await import("./EngineeringWorkbenchRoute.tsx")).EngineeringWorkbenchRoute;

export const engineeringWorkbenchModule: FeatureModule = Object.freeze({
  id: featureId("engineering-workbench"),
  routes: Object.freeze([createFramedRouteRegistration({ id: "engineering-workbench", path: "/engineering", title: "Engineering Workbench", destinationId: "engineering", load: lazyWorkbench })]),
  providers: Object.freeze([Object.freeze({
    id: "engineering-workbench.service",
    dependsOn: Object.freeze(["trace-replay.service", "economy-progression.service", "eval-runner.service", "review-deployment.service", "curriculum-content.catalog"]),
    create: (context: ProviderContext) => {
      const traces = context.dependencies.get("trace-replay.service") as { readonly content?: unknown; readonly context?: unknown } | undefined;
      const economy = context.dependencies.get("economy-progression.service") as import("../../economy-progression/index.ts").EconomyProgressionService | undefined;
      const evals = context.dependencies.get("eval-runner.service") as import("../../eval-runner/index.ts").EvalService | undefined;
      const reviews = context.dependencies.get("review-deployment.service") as import("../../review-deployment/index.ts").ReviewDeploymentRuntime | undefined;
      const curriculum = context.dependencies.get("curriculum-content.catalog") as { readonly commissionRecipes?: import("../../engineering-workbench/index.ts").CommissionRecipe[] } | undefined;
      return createWorkbenchProvider({
        ...(traces?.content ? { registry: traces.content as import("../../content-registry/index.ts").ContentRegistry } : {}),
        ...(traces?.context ? { context: traces.context as import("../../context/index.ts").ContextService } : {}),
        ...(economy ? { economy } : {}),
        ...(evals ? { evals } : {}),
        ...(reviews ? { reviews } : {}),
        ...(curriculum?.commissionRecipes ? { recipes: [...DEFAULT_COMMISSION_RECIPES, ...curriculum.commissionRecipes] } : {}),
      });
    },
    dispose: (instance: unknown) => {
      if (instance === getActiveWorkbenchRuntime()) setActiveWorkbenchRuntime(null);
    },
  })]),
});
