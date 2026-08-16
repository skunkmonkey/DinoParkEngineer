import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { getActivePersistenceRuntime, createProductionPersistenceProvider, setActivePersistenceRuntime, type ProductionPersistenceDependencies } from "./runtime.ts";

const lazyRoute = async (): Promise<RouteComponent> => (await import("./PersistenceRoute.tsx")).PersistenceRoute;

export const persistenceModule: FeatureModule = Object.freeze({
  id: featureId("persistence"),
  routes: Object.freeze([createFramedRouteRegistration({ id: "persistence-save", path: "/save", title: "Save & Recovery", destinationId: "progress", load: lazyRoute })]),
  providers: Object.freeze([{ id: "persistence.service", dependsOn: Object.freeze(["park-operations.service", "economy-progression.service", "eval-runner.service", "review-deployment.service", "trace-replay.service", "curriculum-content.service"]), create: (context: ProviderContext) => createProductionPersistenceProvider({
    park: context.dependencies.get("park-operations.service"),
    economy: context.dependencies.get("economy-progression.service"),
    evals: context.dependencies.get("eval-runner.service"),
    reviews: context.dependencies.get("review-deployment.service"),
    traces: context.dependencies.get("trace-replay.service"),
    curriculum: context.dependencies.get("curriculum-content.service"),
  } as ProductionPersistenceDependencies, { buildManifest: { buildId: context.config.buildId } }), dispose: (instance: unknown) => { if (instance === getActivePersistenceRuntime()) setActivePersistenceRuntime(null); (instance as { dispose?: () => void }).dispose?.(); } }]),
});
