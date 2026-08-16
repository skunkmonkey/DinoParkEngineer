import {
  featureId,
  routeId,
  type FeatureModule,
  type RouteComponent,
} from "../shell/public.ts";

const loadStatusRoute = async (): Promise<RouteComponent> =>
  (await import("./FeatureStatusRoute.tsx")).FeatureStatusRoute;

export const shellDiagnosticsModule: FeatureModule = Object.freeze({
  id: featureId("shell-diagnostics"),
  routes: Object.freeze([
    Object.freeze({
      id: routeId("shell-status"),
      path: "/shell/status",
      title: "Shell Status",
      load: loadStatusRoute,
    }),
    Object.freeze({
      id: routeId("shell-feature-status"),
      parentId: routeId("shell-status"),
      path: "/shell/status/features/:featureId",
      title: "Feature Boundary Status",
      load: loadStatusRoute,
    }),
  ]),
});
