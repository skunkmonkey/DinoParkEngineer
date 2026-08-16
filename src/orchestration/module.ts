import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createOrchestrationProvider, getActiveOrchestrationService, setActiveOrchestrationService } from "./runtime.ts";
import type { EconomyProgressionService } from "../economy-progression/public.ts";
import type { ParkOperationsService } from "../park-operations/public.ts";
import type { ReviewDeploymentRuntime } from "../review-deployment/public.ts";
import type { TraceReplayRuntime } from "../trace-replay/public.ts";

const lazyManager = async (): Promise<RouteComponent> => (await import("./ManagerRoute.tsx")).ManagerRoute;

export const orchestrationModule: FeatureModule = Object.freeze({
  id: featureId("multi-agent-orchestration"),
  routes: Object.freeze([
    createFramedRouteRegistration({ id: "orchestration-manager", path: "/orchestration", title: "Manager Orchestration", destinationId: "agents", load: lazyManager }),
    createFramedRouteRegistration({ id: "orchestration-manager-detail", path: "/orchestration/manager/:managerId", title: "Manager Orchestration", destinationId: "agents", load: lazyManager }),
  ]),
  providers: Object.freeze([Object.freeze({
    id: "multi-agent-orchestration.service",
    dependsOn: ["park-operations.service", "economy-progression.service", "review-deployment.service", "trace-replay.service", "curriculum-content.catalog"],
    create: (context: ProviderContext) => createOrchestrationProvider({
      park: context.dependencies.get("park-operations.service") as ParkOperationsService,
      economy: context.dependencies.get("economy-progression.service") as EconomyProgressionService,
      review: context.dependencies.get("review-deployment.service") as ReviewDeploymentRuntime,
      traces: context.dependencies.get("trace-replay.service") as TraceReplayRuntime,
      configs: (context.dependencies.get("curriculum-content.catalog") as { readonly managerConfigs?: readonly import("../../orchestration/index.ts").ManagerConfig[] } | undefined)?.managerConfigs,
    }),
    dispose: (instance: unknown) => {
      if (instance === getActiveOrchestrationService()) setActiveOrchestrationService(null);
    },
  })]),
});
