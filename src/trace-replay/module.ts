import { featureId, type FeatureModule, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createTraceReplayProvider, getActiveTraceReplayRuntime, setActiveTraceReplayRuntime } from "./runtime.ts";

const lazyTraceReplay = async (): Promise<RouteComponent> => (await import("./TraceReplayRoute.tsx")).TraceReplayRoute;

export const traceReplayModule: FeatureModule = Object.freeze({
  id: featureId("trace-replay"),
  routes: Object.freeze([createFramedRouteRegistration({
    id: "trace-replay-explorer",
    path: "/traces/:traceId?",
    title: "Trace Inspection / Replay",
    destinationId: "agents",
    load: lazyTraceReplay,
  })]),
  providers: Object.freeze([Object.freeze({
    id: "trace-replay.service",
    create: () => createTraceReplayProvider(),
    dispose: (instance: unknown) => {
      if (instance === getActiveTraceReplayRuntime()) setActiveTraceReplayRuntime(null);
    },
  })]),
});
