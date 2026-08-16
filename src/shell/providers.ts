import { normalizeShellError } from "./errors.ts";
import type {
  ProviderComposer,
  ProviderLifecycleResult,
  ProviderRegistration,
  PublicRuntimeConfig,
  ShellError,
} from "./types.ts";

type ProviderState = "pending" | "ready" | "failed" | "disposed";

interface ProviderEntry {
  readonly registration: ProviderRegistration;
  state: ProviderState;
  instance?: unknown;
}

function providerError(code: string, summary: string): ShellError {
  return normalizeShellError(undefined, { category: "registration", code, summary });
}

function stableTopologicalOrder(providers: readonly ProviderRegistration[]): {
  readonly order: readonly ProviderRegistration[];
  readonly errors: readonly ShellError[];
} {
  const byId = new Map<string, ProviderRegistration>();
  const errors: ShellError[] = [];
  for (const provider of providers) {
    if (byId.has(provider.id)) errors.push(providerError("DUPLICATE_PROVIDER", `Provider id “${provider.id}” is duplicated.`));
    else byId.set(provider.id, provider);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: ProviderRegistration[] = [];

  function visit(id: string, path: readonly string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start >= 0 ? start : 0), id];
      errors.push(providerError("PROVIDER_DEPENDENCY_CYCLE", `Provider dependency cycle: ${cycle.join(" → ")}.`));
      return;
    }
    const provider = byId.get(id);
    if (!provider) {
      errors.push(providerError("MISSING_PROVIDER_DEPENDENCY", `Provider dependency path ${[...path, id].join(" → ")} is unavailable.`));
      return;
    }
    visiting.add(id);
    for (const dependency of [...(provider.dependsOn ?? [])].sort()) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
    order.push(provider);
  }

  for (const provider of [...providers].sort((a, b) => a.id.localeCompare(b.id))) visit(provider.id, []);
  const uniqueErrors = [...new Map(errors.map((error) => [`${error.code}:${error.summary}`, error])).values()];
  return { order: Object.freeze(order), errors: Object.freeze(uniqueErrors) };
}

export function createProviderComposer(
  providers: readonly ProviderRegistration[],
  config: PublicRuntimeConfig,
  onError?: (error: ShellError) => void,
): ProviderComposer {
  const plan = stableTopologicalOrder(providers);
  const entries = new Map<string, ProviderEntry>(
    plan.order.map((provider): [string, ProviderEntry] => [provider.id, { registration: provider, state: "pending" }]),
  );
  const initializedOrder: string[] = [];
  let generation = 0;
  let disposed = false;
  let initialization: Promise<ProviderLifecycleResult> | null = null;

  const report = (error: ShellError) => onError?.(error);

  async function disposeInstance(entry: ProviderEntry, errors: ShellError[]): Promise<void> {
    if (entry.state === "disposed") return;
    try {
      await Promise.resolve().then(() => entry.registration.dispose?.(entry.instance));
    } catch (thrown) {
      const error = normalizeShellError(thrown, {
        category: "disposal",
        code: "PROVIDER_DISPOSE_FAILED",
        summary: `Provider “${entry.registration.id}” could not stop cleanly.`,
      });
      errors.push(error);
      report(error);
    } finally {
      entry.instance = undefined;
      entry.state = "disposed";
    }
  }

  const composer: ProviderComposer = {
    initialize(signal?: AbortSignal): Promise<ProviderLifecycleResult> {
      if (initialization && !disposed) return initialization;
      if (plan.errors.length > 0) {
        for (const error of plan.errors) report(error);
        return Promise.resolve({ ok: false, errors: plan.errors });
      }
      disposed = false;
      const activeGeneration = ++generation;
      initialization = (async () => {
        const errors: ShellError[] = [];
        for (const provider of plan.order) {
          if (signal?.aborted || disposed || generation !== activeGeneration) break;
          const entry = entries.get(provider.id);
          if (!entry || entry.state === "ready") continue;
          const unavailableDependency = (provider.dependsOn ?? []).find((dependency) => entries.get(dependency)?.state !== "ready");
          if (unavailableDependency) {
            entry.state = "failed";
            const error = normalizeShellError(undefined, {
              category: "startup",
              code: "PROVIDER_DEPENDENCY_UNAVAILABLE",
              summary: `Provider “${provider.id}” could not start because a dependency is unavailable.`,
            });
            errors.push(error);
            report(error);
            continue;
          }
          const dependencies = new Map<string, unknown>();
          for (const dependency of provider.dependsOn ?? []) dependencies.set(dependency, entries.get(dependency)?.instance);
          try {
            const instance = await Promise.resolve().then(() => provider.create({ config, dependencies }));
            entry.instance = instance;
            if (signal?.aborted || disposed || generation !== activeGeneration) {
              entry.state = "ready";
              await disposeInstance(entry, errors);
              break;
            }
            entry.state = "ready";
            initializedOrder.push(provider.id);
          } catch (thrown) {
            entry.state = "failed";
            const error = normalizeShellError(thrown, {
              category: "startup",
              code: "PROVIDER_CREATE_FAILED",
              summary: `Provider “${provider.id}” could not initialize.`,
            });
            errors.push(error);
            report(error);
          }
        }
        return { ok: errors.length === 0 && !signal?.aborted && !disposed, errors: Object.freeze(errors) };
      })();
      return initialization;
    },
    async dispose(): Promise<ProviderLifecycleResult> {
      if (disposed && initializedOrder.length === 0) return { ok: true, errors: Object.freeze([]) };
      disposed = true;
      generation += 1;
      await initialization;
      const errors: ShellError[] = [];
      while (initializedOrder.length > 0) {
        const id = initializedOrder.pop();
        if (!id) continue;
        const entry = entries.get(id);
        if (entry) await disposeInstance(entry, errors);
      }
      initialization = null;
      return { ok: errors.length === 0, errors: Object.freeze(errors) };
    },
    readiness: () => Object.freeze(
      [...entries.entries()]
        .map(([id, entry]) => Object.freeze({ id, status: entry.state }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ),
  };
  return composer;
}
