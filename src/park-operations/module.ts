import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createParkOperationsProvider, getActiveParkOperationsService, setActiveParkOperationsService } from "./runtime.ts";
import type { ReviewDeploymentRuntime } from "../review-deployment/public.ts";
import { createAuthoritativeActiveRefResolver } from "../../park-operations/index.ts";

const lazyPark = async (): Promise<RouteComponent> => (await import("./ParkOperationsRoute.tsx")).ParkOperationsRoute;
const lazyAgent = async (): Promise<RouteComponent> => (await import("./AgentOperationsRoute.tsx")).AgentOperationsRoute;

export const parkOperationsModule: FeatureModule = Object.freeze({
  id: featureId("park-operations"),
  routes: Object.freeze([
    createFramedRouteRegistration({ id: "platform-park", path: "/", title: "Park Operations", destinationId: "park", load: lazyPark }),
    createFramedRouteRegistration({ id: "platform-agents", path: "/agents/:agentId?", title: "Agent Operations", destinationId: "agents", load: lazyAgent }),
    createFramedRouteRegistration({ id: "park-operations-park", path: "/operations/park", title: "Park Operations", destinationId: "park", load: lazyPark }),
    createFramedRouteRegistration({ id: "park-operations-agent", path: "/operations/agents/:agentId", title: "Agent Operations", destinationId: "agents", load: lazyAgent }),
  ]),
  providers: Object.freeze([Object.freeze({
    id: "park-operations.service",
    dependsOn: ["platform-foundation.presentation", "trace-replay.service", "review-deployment.service"],
    create: (context: ProviderContext) => {
      const review = context.dependencies.get("review-deployment.service") as ReviewDeploymentRuntime | undefined;
      return createParkOperationsProvider({ resolveActiveRef: review ? createAuthoritativeActiveRefResolver(review.deployments.resolveActive) : undefined });
    },
    dispose: (instance: unknown) => {
      if (instance === getActiveParkOperationsService()) setActiveParkOperationsService(null);
    },
  })]),
});
