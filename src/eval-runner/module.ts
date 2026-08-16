import type { CreditBalance, CreditCommand, CreditResult } from "../../economy-progression/index.ts";
import type { TraceSink } from "../../trace-replay/index.ts";
import { featureId, type FeatureModule, type ProviderContext, type RouteComponent } from "../shell/public.ts";
import { createFramedRouteRegistration } from "../platform/public.ts";
import { createProductionEvalProvider, getActiveEvalService, setActiveEvalService } from "./runtime.ts";

const lazyEvals = async (): Promise<RouteComponent> => (await import("./EvalsRoute.tsx")).EvalsRoute;

type EconomyRuntimePort = {
  readonly transact: (command: CreditCommand) => CreditResult;
  readonly balance: () => CreditBalance;
};

type TraceRuntimePort = { readonly recorder: TraceSink; readonly content?: unknown };

function createProductionProvider(context: ProviderContext) {
  const economy = context.dependencies.get("economy-progression.service") as EconomyRuntimePort | undefined;
  const traces = context.dependencies.get("trace-replay.service") as TraceRuntimePort | undefined;
  const curriculum = context.dependencies.get("curriculum-content.catalog") as { readonly evalSuites?: readonly import("../../eval-runner/index.ts").EvalSuiteInput[] } | undefined;
  return createProductionEvalProvider({ ...(economy ? { economy } : {}), ...(traces ? { traces } : {}), ...(curriculum?.evalSuites ? { suites: curriculum.evalSuites } : {}) });
}

export const evalRunnerModule: FeatureModule = Object.freeze({
  id: featureId("eval-runner"),
  routes: Object.freeze([createFramedRouteRegistration({
    id: "eval-runner-catalog",
    path: "/evals",
    title: "Evals / Regression",
    destinationId: "evals",
    load: lazyEvals,
  })]),
  providers: Object.freeze([Object.freeze({
    id: "eval-runner.service",
    dependsOn: Object.freeze(["economy-progression.service", "trace-replay.service", "curriculum-content.catalog"]),
    create: createProductionProvider,
    dispose: (instance: unknown) => {
      if (instance === getActiveEvalService()) setActiveEvalService(null);
    },
  })]),
});
