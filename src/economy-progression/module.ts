import { routeId, featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createEconomyProgressionProvider, getActiveEconomyProgressionService, setActiveEconomyProgressionService } from "./runtime.ts";

const lazyFinanceProgress = async (): Promise<RouteComponent> => (await import("./FinanceProgressRoute.tsx")).FinanceProgressRoute;

export const economyProgressionModule: FeatureModule = Object.freeze({
  id: featureId("economy-progression"),
  routes: Object.freeze([
    createFramedRouteRegistration({
      id: "platform-progress",
      path: "/progress",
      title: "Finance / Progress",
      destinationId: "progress",
      load: lazyFinanceProgress,
    }),
    createFramedRouteRegistration({
      id: "economy-progression-finance",
      parentId: routeId("platform-progress"),
      path: "/progress/economy",
      title: "Finance / Progress",
      destinationId: "progress",
      load: lazyFinanceProgress,
    }),
  ]),
  providers: Object.freeze([Object.freeze({
    id: "economy-progression.service",
    dependsOn: Object.freeze(["curriculum-content.catalog"]),
    create: (context: ProviderContext) => {
      const curriculum = context.dependencies.get("curriculum-content.catalog") as { readonly pack?: { readonly balance?: import("./runtime.ts").CurriculumBalancePort } } | undefined;
      return createEconomyProgressionProvider(curriculum?.pack?.balance);
    },
    dispose: (instance: unknown) => {
      if (instance === getActiveEconomyProgressionService()) setActiveEconomyProgressionService(null);
    },
  })]),
});
