import { featureId, type FeatureModule, type RegistrationDiagnostic } from "../shell/public.ts";

export interface FeatureDiscoveryFailure {
  readonly entry: string;
  readonly featureId: ReturnType<typeof featureId>;
  readonly diagnostic: RegistrationDiagnostic;
}

export interface FeatureDiscoveryResult {
  readonly modules: readonly FeatureModule[];
  readonly failures: readonly FeatureDiscoveryFailure[];
}

function looksLikeFeatureModule(value: unknown): value is FeatureModule {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return typeof candidate.id === "string" && (
    Array.isArray(candidate.routes) ||
    Array.isArray(candidate.providers) ||
    typeof candidate.initialize === "function"
  );
}

export function collectFeatureModules(
  entries: readonly { readonly order: string; readonly exports: Readonly<Record<string, unknown>> }[],
): readonly FeatureModule[] {
  const discovered: Array<{ readonly order: string; readonly module: FeatureModule }> = [];
  for (const entry of [...entries].sort((a, b) => a.order.localeCompare(b.order))) {
    for (const [exportName, exported] of Object.entries(entry.exports).sort(([a], [b]) => a.localeCompare(b))) {
      if (looksLikeFeatureModule(exported)) discovered.push({ order: `${entry.order}:${exportName}`, module: exported });
    }
  }
  return Object.freeze(
    discovered
      .sort((a, b) => a.module.id.localeCompare(b.module.id) || a.order.localeCompare(b.order))
      .map((entry) => entry.module),
  );
}

function entryFeatureId(entry: string): ReturnType<typeof featureId> {
  const segment = entry.replace(/\\/g, "/").split("/").filter(Boolean).at(-2) ?? "unknown-feature";
  const stable = segment.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z]+/, "") || "unknown-feature";
  return featureId(stable);
}

export async function loadFeatureModules(
  loaders: Readonly<Record<string, () => Promise<Readonly<Record<string, unknown>>>>>,
): Promise<FeatureDiscoveryResult> {
  const entries: Array<{ readonly order: string; readonly exports: Readonly<Record<string, unknown>> }> = [];
  const failures: FeatureDiscoveryFailure[] = [];
  for (const [entry, load] of Object.entries(loaders).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      entries.push({ order: entry, exports: await load() });
    } catch {
      const id = entryFeatureId(entry);
      failures.push(Object.freeze({
        entry,
        featureId: id,
        diagnostic: Object.freeze({
          code: "FEATURE_ENTRY_LOAD_FAILED",
          featureId: id,
          recoverable: true,
          summary: `Optional feature “${id}” could not be loaded.`,
        }),
      }));
    }
  }
  return Object.freeze({ modules: collectFeatureModules(entries), failures: Object.freeze(failures) });
}
