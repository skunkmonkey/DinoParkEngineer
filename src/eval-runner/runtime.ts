import { createContentRegistry, type ContentRegistry } from "../../content-registry/index.ts";
import { createEvalService, createMvpEvalContentPack, type EvalExecutionPorts, type EvalService, type EvalServiceOptions, type EvalSuiteInput } from "../../eval-runner/index.ts";
import type { CreditBalance, CreditCommand, CreditResult } from "../../economy-progression/index.ts";
import type { TraceSink } from "../../trace-replay/index.ts";

let activeService: EvalService | null = null;

export interface EvalProviderOptions extends EvalServiceOptions {
  readonly initialSuites?: readonly EvalSuiteInput[];
}

export function createEvalProvider(options: EvalProviderOptions = {}): EvalService {
  const registry = options.registry ?? createContentRegistry();
  if (!options.registry) {
    const loaded = (registry as ContentRegistry).loadPack(createMvpEvalContentPack());
    if (!loaded.ok) throw new Error(`Evals content pack failed validation: ${loaded.error.map((error) => `${error.path}: ${error.message}`).join("; ")}`);
  }
  const supplied: EvalExecutionPorts = options.executionPorts ?? options.execution ?? {};
  const execution: EvalExecutionPorts = { ...supplied };
  const service = createEvalService({ ...options, registry, catalog: options.catalog ?? registry.queryEvals(), execution, executionPorts: undefined });
  for (const suite of options.initialSuites ?? []) {
    const created = service.createSuite(suite);
    if (!created.ok) throw new Error(`Authored Eval suite ${suite.id} failed validation: ${created.errors.map((error) => error.message).join("; ")}`);
  }
  activeService = service;
  return service;
}

export interface ProductionEvalDependencies {
  readonly economy?: { readonly transact: (command: CreditCommand) => CreditResult; readonly balance: () => CreditBalance };
  readonly traces?: { readonly recorder: TraceSink; readonly content?: unknown };
  readonly suites?: readonly EvalSuiteInput[];
}

function sharedRegistry(value: unknown): ContentRegistry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ContentRegistry>;
  return typeof candidate.loadPack === "function" && typeof candidate.queryEvals === "function" && typeof candidate.getArtifact === "function" ? candidate as ContentRegistry : undefined;
}

/** Production composition through public runtime contracts. The Eval pack is
 * loaded into the same registry instance consumed by Trace Replay. */
export function createProductionEvalProvider(dependencies: ProductionEvalDependencies): EvalService {
  const registry = sharedRegistry(dependencies.traces?.content);
  if (registry && registry.queryEvals({ id: "eval.standard-feeding" }).length === 0) {
    const loaded = registry.loadPack(createMvpEvalContentPack());
    if (!loaded.ok) throw new Error(`Shared Evals content pack failed validation: ${loaded.error.map((error) => `${error.path}: ${error.message}`).join("; ")}`);
  }
  return createEvalProvider({ ...(registry ? { registry } : {}), initialSuites: dependencies.suites, execution: {
    ...(dependencies.economy ? { charge: dependencies.economy.transact, balance: dependencies.economy.balance } : {}),
    ...(dependencies.traces ? { recordTrace: dependencies.traces.recorder } : {}),
  } });
}

export function getActiveEvalService(): EvalService | null {
  return activeService;
}

export function setActiveEvalService(service: EvalService | null): void {
  activeService = service;
}
