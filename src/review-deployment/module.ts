import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createProductionReviewProvider, getActiveReviewDeploymentRuntime, setActiveReviewDeploymentRuntime } from "./runtime.ts";
import type { CreditBalance, CreditCommand, CreditResult } from "../../economy-progression/index.ts";
import type { TraceReplayRuntime } from "../trace-replay/public.ts";
import type { EvalService } from "../../eval-runner/index.ts";
import type { ContentRegistry } from "../../content-registry/index.ts";
import type { ContextService } from "../../context/index.ts";

const lazyReviews = async (): Promise<RouteComponent> => (await import("./ReviewsRoute.tsx")).ReviewsRoute;

type EconomyPort = { readonly transact: (command: CreditCommand) => CreditResult; readonly balance: () => CreditBalance };

export const reviewDeploymentModule: FeatureModule = Object.freeze({
  id: featureId("review-deployment"),
  routes: Object.freeze([createFramedRouteRegistration({
    id: "review-deployment-reviews",
    path: "/reviews",
    title: "Reviews / Deploy",
    destinationId: "reviews",
    load: lazyReviews,
  })]),
  providers: Object.freeze([Object.freeze({
    id: "review-deployment.service",
    dependsOn: Object.freeze(["economy-progression.service", "eval-runner.service", "trace-replay.service"]),
    create: (context: ProviderContext) => {
      const economy = context.dependencies.get("economy-progression.service") as EconomyPort | undefined;
      const evals = context.dependencies.get("eval-runner.service") as EvalService | undefined;
      const traces = context.dependencies.get("trace-replay.service") as TraceReplayRuntime | undefined;
      return createProductionReviewProvider({
        ...(economy ? { economy } : {}),
        ...(evals ? { evals } : {}),
        ...(traces ? { registry: traces.content as unknown as ContentRegistry, context: traces.context as unknown as ContextService } : {}),
      });
    },
    dispose: (instance: unknown) => {
      if (instance === getActiveReviewDeploymentRuntime()) setActiveReviewDeploymentRuntime(null);
    },
  })]),
});
