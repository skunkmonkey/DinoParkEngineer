import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createCurriculumCatalogProvider, createCurriculumProvider, getActiveCurriculumCatalog, getActiveCurriculumRuntime, setActiveCurriculumCatalog, setActiveCurriculumRuntime, type CurriculumCatalogRuntime, type CurriculumProviderDependencies } from "./runtime.ts";

const lazyCurriculum = async (): Promise<RouteComponent> => (await import("./CurriculumRoute.tsx")).CurriculumRoute;

export const curriculumContentModule: FeatureModule = Object.freeze({
  id: featureId("curriculum-content"),
  routes: Object.freeze([createFramedRouteRegistration({ id: "curriculum-content", path: "/curriculum", title: "Curriculum / Scenarios", destinationId: "engineering", load: lazyCurriculum })]),
  providers: Object.freeze([Object.freeze({
    id: "curriculum-content.catalog",
    dependsOn: Object.freeze(["trace-replay.service"]),
    create: () => createCurriculumCatalogProvider(),
    dispose: (instance: unknown) => { if (instance === getActiveCurriculumCatalog()) setActiveCurriculumCatalog(null); },
  }), Object.freeze({
    id: "curriculum-content.service",
    dependsOn: Object.freeze(["curriculum-content.catalog", "eval-runner.service", "economy-progression.service", "review-deployment.service", "engineering-workbench.service", "park-operations.service", "multi-agent-orchestration.service", "trace-replay.service"]),
    create: (context: ProviderContext) => createCurriculumProvider(context.dependencies.get("curriculum-content.catalog") as CurriculumCatalogRuntime, {
      evals: context.dependencies.get("eval-runner.service"),
      economy: context.dependencies.get("economy-progression.service"),
      reviews: context.dependencies.get("review-deployment.service"),
      workbench: (context.dependencies.get("engineering-workbench.service") as { readonly service: CurriculumProviderDependencies["workbench"] }).service,
      traces: context.dependencies.get("trace-replay.service"),
      orchestration: context.dependencies.get("multi-agent-orchestration.service"),
      park: context.dependencies.get("park-operations.service"),
    } as CurriculumProviderDependencies),
    dispose: (instance: unknown) => { if (instance === getActiveCurriculumRuntime()) setActiveCurriculumRuntime(null); },
  })]),
});
