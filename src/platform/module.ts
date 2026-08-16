import type { FeatureModule, RouteComponent } from "../shell/public.ts";
import { featureId } from "../shell/public.ts";
import { createPresentationRegistry, getActivePresentationRegistry, setActivePresentationRegistry } from "./presentationRegistry.ts";
import { createFoundationRouteRegistrations } from "./contract.ts";

const lazyFrame = async (): Promise<RouteComponent> => (await import("./ProductFrame.tsx")).ProductFrameRoute;

export const platformFoundationModule: FeatureModule = Object.freeze({
  id: featureId("platform-foundation"),
  // Domain modules own every production primary destination route.
  // Foundation retains their navigation metadata and presentation provider.
  routes: createFoundationRouteRegistrations(lazyFrame, { exclude: ["park", "agents", "engineering", "evals", "reviews", "progress"] }),
  providers: Object.freeze([
    {
      id: "platform-foundation.presentation",
      create: () => {
        const registry = createPresentationRegistry();
        setActivePresentationRegistry(registry);
        return registry;
      },
      dispose: (instance: unknown) => {
        if (instance === getActivePresentationRegistry()) setActivePresentationRegistry(null);
      },
    },
  ]),
});
