import { normalizeShellError } from "./errors.ts";
import type { createFeatureRegistry } from "./registry.ts";
import type {
  FeatureModule,
  ProviderComposer,
  ProviderLifecycleResult,
  PublicRuntimeConfig,
  ShellError,
} from "./types.ts";

export interface ShellLifecycleController {
  start(signal?: AbortSignal): Promise<ProviderLifecycleResult>;
  stop(): Promise<ProviderLifecycleResult>;
}

export function createShellLifecycleController(
  features: readonly FeatureModule[],
  registry: ReturnType<typeof createFeatureRegistry>,
  providers: ProviderComposer,
  config: PublicRuntimeConfig,
  onError?: (error: ShellError) => void,
): ShellLifecycleController {
  const initializedFeatures: FeatureModule[] = [];
  let generation = 0;
  let activeAbort: AbortController | null = null;
  let starting: Promise<ProviderLifecycleResult> | null = null;
  let stopped = false;

  const report = (error: ShellError, errors: ShellError[]) => {
    errors.push(error);
    onError?.(error);
  };

  async function disposeFeature(feature: FeatureModule, errors: ShellError[]): Promise<void> {
    if (typeof feature.dispose !== "function") {
      registry.setFeatureStatus(feature.id, "stopped");
      return;
    }
    try {
      await Promise.resolve().then(() => feature.dispose?.());
      registry.setFeatureStatus(feature.id, "stopped");
    } catch (thrown) {
      const error = normalizeShellError(thrown, {
        category: "disposal",
        code: "FEATURE_DISPOSE_FAILED",
        featureId: feature.id,
        summary: `Feature “${feature.id}” could not stop cleanly.`,
      });
      registry.setFeatureStatus(feature.id, "failed", error);
      report(error, errors);
    }
  }

  return {
    start(externalSignal?: AbortSignal): Promise<ProviderLifecycleResult> {
      if (starting && !stopped) return starting;
      stopped = false;
      const activeGeneration = ++generation;
      const abort = new AbortController();
      activeAbort = abort;
      const relayAbort = () => abort.abort();
      externalSignal?.addEventListener("abort", relayAbort, { once: true });

      starting = (async () => {
        const errors: ShellError[] = [];
        const providerResult = await providers.initialize(abort.signal);
        errors.push(...providerResult.errors);
        for (const feature of [...features].sort((a, b) => a.id.localeCompare(b.id))) {
          if (abort.signal.aborted || stopped || activeGeneration !== generation) break;
          const readiness = registry.listFeatures().find((entry) => entry.id === feature.id);
          if (readiness?.status !== "registered" && readiness?.status !== "stopped") continue;
          registry.setFeatureStatus(feature.id, "initializing");
          try {
            await Promise.resolve().then(() => feature.initialize?.({
              config,
              featureId: feature.id,
              signal: abort.signal,
              report: (error) => report(error, errors),
            }));
            if (abort.signal.aborted || stopped || activeGeneration !== generation) {
              await disposeFeature(feature, errors);
              break;
            }
            initializedFeatures.push(feature);
            registry.setFeatureStatus(feature.id, "ready");
          } catch (thrown) {
            const error = normalizeShellError(thrown, {
              category: "startup",
              code: "FEATURE_INITIALIZE_FAILED",
              featureId: feature.id,
              summary: `Feature “${feature.id}” could not start.`,
            });
            report(error, errors);
            registry.setFeatureStatus(feature.id, "failed", error);
          }
        }
        externalSignal?.removeEventListener("abort", relayAbort);
        return { ok: errors.length === 0 && !abort.signal.aborted && !stopped, errors: Object.freeze(errors) };
      })();
      return starting;
    },
    async stop(): Promise<ProviderLifecycleResult> {
      if (stopped && initializedFeatures.length === 0) return { ok: true, errors: Object.freeze([]) };
      stopped = true;
      generation += 1;
      activeAbort?.abort();
      await starting;
      const errors: ShellError[] = [];
      while (initializedFeatures.length > 0) {
        const feature = initializedFeatures.pop();
        if (feature) await disposeFeature(feature, errors);
      }
      const providerResult = await providers.dispose();
      errors.push(...providerResult.errors);
      starting = null;
      activeAbort = null;
      return { ok: errors.length === 0, errors: Object.freeze(errors) };
    },
  };
}
