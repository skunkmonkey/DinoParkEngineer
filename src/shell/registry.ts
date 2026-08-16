import type {
  FeatureId,
  FeatureReadiness,
  ProviderRegistration,
  RegistrationDiagnostic,
  Result,
  ShellRegistration,
  ShellRouteRegistration,
} from "./types.ts";
import { featureId as makeFeatureId, routeId as makeRouteId } from "./types.ts";

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const PARAM_PATTERN = /^:[A-Za-z][A-Za-z0-9_]*\??$/;
const WILDCARD_PATTERN = /^\*[A-Za-z][A-Za-z0-9_]*$/;

function freezeList<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === "object" ? value as Readonly<Record<string, unknown>> : null;
}

function normalizePath(path: string): string {
  const collapsed = path.replace(/\/+/g, "/").replace(/\/$/, "");
  return collapsed || "/";
}

function validRouteGrammar(path: string): boolean {
  if (!path.startsWith("/") || path.includes("#")) return false;
  const segments = path.split("/").filter(Boolean);
  return segments.every((segment, index) => {
    if (segment.startsWith("*")) return WILDCARD_PATTERN.test(segment) && index === segments.length - 1;
    if (segment.includes("*")) return false;
    if (segment.startsWith(":")) return PARAM_PATTERN.test(segment);
    return !segment.includes(":") && !segment.includes("?");
  });
}

function isPathWithin(parent: string, child: string): boolean {
  if (parent === "/") return child.startsWith("/");
  return child === parent || child.startsWith(`${parent}/`);
}

function findProviderCycles(providers: readonly ProviderRegistration[]): readonly string[][] {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles = new Map<string, string[]>();

  function visit(id: string, path: readonly string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start >= 0 ? start : 0), id];
      const members = [...new Set(cycle.slice(0, -1))].sort();
      cycles.set(members.join("|"), cycle);
      return;
    }
    const provider = byId.get(id);
    if (!provider) return;
    visiting.add(id);
    for (const dependency of provider.dependsOn ?? []) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of [...byId.keys()].sort()) visit(id, []);
  return Object.freeze([...cycles.values()].sort((a, b) => a.join(":").localeCompare(b.join(":"))));
}

function diagnostic(entry: Omit<RegistrationDiagnostic, "recoverable">): RegistrationDiagnostic {
  return Object.freeze({ ...entry, recoverable: true });
}

function sortDiagnostics(values: readonly RegistrationDiagnostic[]): readonly RegistrationDiagnostic[] {
  return freezeList(
    [...values].sort((a, b) =>
      `${a.code}:${a.featureId ?? ""}:${a.routeId ?? ""}:${a.providerId ?? ""}:${a.summary}`.localeCompare(
        `${b.code}:${b.featureId ?? ""}:${b.routeId ?? ""}:${b.providerId ?? ""}:${b.summary}`,
      ),
    ),
  );
}

function cloneRoute(raw: unknown, owner: FeatureId | undefined, diagnostics: RegistrationDiagnostic[]): ShellRouteRegistration | null {
  const value = asRecord(raw);
  if (!value) {
    diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: owner, summary: "Feature routes must contain route registration objects." }));
    return null;
  }
  const idValue = typeof value.id === "string" ? value.id : "";
  const id = idValue ? makeRouteId(idValue) : undefined;
  if (!idValue || !ID_PATTERN.test(idValue)) {
    diagnostics.push(diagnostic({ code: "INVALID_ROUTE_ID", featureId: owner, routeId: id, summary: "Route id must be a stable identifier." }));
  }
  const pathValue = typeof value.path === "string" ? value.path : "";
  if (!pathValue || !validRouteGrammar(pathValue)) {
    diagnostics.push(diagnostic({
      code: "INVALID_ROUTE_PATH",
      featureId: owner,
      routeId: id,
      summary: "Route path must be absolute and may use a wildcard only as its final named segment.",
    }));
  }
  if (typeof value.load !== "function") {
    diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: owner, routeId: id, summary: "Route registration must provide a lazy loader." }));
  }
  if (value.parentId !== undefined && (typeof value.parentId !== "string" || !ID_PATTERN.test(value.parentId))) {
    diagnostics.push(diagnostic({ code: "INVALID_ROUTE_PARENT", featureId: owner, routeId: id, summary: "Route parent id must be a stable route identifier." }));
  }
  if (!id || !ID_PATTERN.test(idValue) || !pathValue || !validRouteGrammar(pathValue) || typeof value.load !== "function") return null;

  return Object.freeze({
    id,
    path: normalizePath(pathValue),
    ...(typeof value.parentId === "string" ? { parentId: makeRouteId(value.parentId) } : {}),
    ...(typeof value.title === "string" ? { title: value.title.slice(0, 120) } : {}),
    load: value.load as ShellRouteRegistration["load"],
  });
}

function cloneProvider(raw: unknown, owner: FeatureId | undefined, diagnostics: RegistrationDiagnostic[]): ProviderRegistration | null {
  const value = asRecord(raw);
  if (!value) {
    diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: owner, summary: "Feature providers must contain provider registration objects." }));
    return null;
  }
  const id = typeof value.id === "string" ? value.id : "";
  if (!id || !ID_PATTERN.test(id)) {
    diagnostics.push(diagnostic({ code: "INVALID_PROVIDER_ID", featureId: owner, providerId: id || undefined, summary: "Provider id must be a stable identifier." }));
  }
  if (typeof value.create !== "function") {
    diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: owner, providerId: id || undefined, summary: "Provider registration must provide a factory." }));
  }

  const dependencies: string[] = [];
  if (value.dependsOn !== undefined) {
    if (!Array.isArray(value.dependsOn)) {
      diagnostics.push(diagnostic({ code: "INVALID_PROVIDER_DEPENDENCY", featureId: owner, providerId: id || undefined, summary: "Provider dependencies must be an array of stable provider ids." }));
    } else {
      for (const dependency of value.dependsOn) {
        if (typeof dependency !== "string" || !ID_PATTERN.test(dependency) || dependency === id) {
          diagnostics.push(diagnostic({ code: "INVALID_PROVIDER_DEPENDENCY", featureId: owner, providerId: id || undefined, summary: "Provider dependencies must be distinct stable ids and cannot reference themselves." }));
        } else if (!dependencies.includes(dependency)) {
          dependencies.push(dependency);
        }
      }
    }
  }
  if (!id || !ID_PATTERN.test(id) || typeof value.create !== "function" || (value.dependsOn !== undefined && !Array.isArray(value.dependsOn))) return null;

  return Object.freeze({
    id,
    dependsOn: Object.freeze([...dependencies].sort()),
    create: value.create as ProviderRegistration["create"],
    ...(typeof value.dispose === "function" ? { dispose: value.dispose as ProviderRegistration["dispose"] } : {}),
  });
}

interface FeatureRegistry extends ShellRegistration {
  register(
    module: unknown,
    batchProviderIds?: readonly string[],
    batchCycles?: readonly string[][],
  ): Result<void, readonly RegistrationDiagnostic[]>;
  setFeatureStatus(id: FeatureId, status: FeatureReadiness["status"], error?: FeatureReadiness["error"]): void;
  recordUnavailable(id: FeatureId, entryDiagnostic: RegistrationDiagnostic): void;
}

export function createFeatureRegistry(): FeatureRegistry {
  const features = new Map<string, FeatureReadiness>();
  const routes = new Map<string, ShellRouteRegistration>();
  const providers = new Map<string, ProviderRegistration>();
  const allDiagnostics: RegistrationDiagnostic[] = [];

  const registry = {
    register(
      rawModule: unknown,
      batchProviderIds: readonly string[] = [],
      batchCycles: readonly string[][] = [],
    ): Result<void, readonly RegistrationDiagnostic[]> {
      const candidateModule = asRecord(rawModule);
      const diagnostics: RegistrationDiagnostic[] = [];
      const incomingIdValue = typeof candidateModule?.id === "string" ? candidateModule.id : "";
      const incomingId = incomingIdValue ? makeFeatureId(incomingIdValue) : undefined;

      if (!candidateModule) diagnostics.push(diagnostic({ code: "INVALID_MODULE", summary: "Feature registration must be an object." }));
      if (!incomingIdValue || !ID_PATTERN.test(incomingIdValue)) {
        diagnostics.push(diagnostic({ code: "INVALID_FEATURE_ID", featureId: incomingId, summary: "Feature id must start with a lowercase letter and contain only stable identifier characters." }));
      } else if (features.has(incomingIdValue)) {
        diagnostics.push(diagnostic({ code: "DUPLICATE_FEATURE", featureId: incomingId, summary: `Feature id “${incomingIdValue}” is already registered.` }));
      }

      let rawRoutes: readonly unknown[] = [];
      if (candidateModule?.routes !== undefined) {
        if (Array.isArray(candidateModule.routes)) rawRoutes = candidateModule.routes;
        else diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: incomingId, summary: "Feature routes must be an array." }));
      }
      let rawProviders: readonly unknown[] = [];
      if (candidateModule?.providers !== undefined) {
        if (Array.isArray(candidateModule.providers)) rawProviders = candidateModule.providers;
        else diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: incomingId, summary: "Feature providers must be an array." }));
      }
      if (candidateModule?.initialize !== undefined && typeof candidateModule.initialize !== "function") diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: incomingId, summary: "Feature initialize hook must be a function." }));
      if (candidateModule?.dispose !== undefined && typeof candidateModule.dispose !== "function") diagnostics.push(diagnostic({ code: "INVALID_MODULE", featureId: incomingId, summary: "Feature dispose hook must be a function." }));

      const candidateRoutes = rawRoutes.map((route) => cloneRoute(route, incomingId, diagnostics)).filter((route): route is ShellRouteRegistration => route !== null);
      const candidateProviders = rawProviders.map((provider) => cloneProvider(provider, incomingId, diagnostics)).filter((provider): provider is ProviderRegistration => provider !== null);
      const seenRouteIds = new Set<string>();
      const seenRoutePaths = new Set<string>();
      for (const route of candidateRoutes) {
        if (seenRouteIds.has(route.id) || routes.has(route.id)) diagnostics.push(diagnostic({ code: "DUPLICATE_ROUTE", featureId: incomingId, routeId: route.id, summary: `Route id “${route.id}” is already registered.` }));
        if (seenRoutePaths.has(route.path) || [...routes.values()].some((existing) => existing.path === route.path)) diagnostics.push(diagnostic({ code: "DUPLICATE_ROUTE", featureId: incomingId, routeId: route.id, summary: `Route path “${route.path}” is already registered.` }));
        seenRouteIds.add(route.id);
        seenRoutePaths.add(route.path);
      }

      const allCandidateRoutes = [...routes.values(), ...candidateRoutes];
      for (const route of candidateRoutes) {
        if (!route.parentId) continue;
        const parent = allCandidateRoutes.find((candidate) => candidate.id === route.parentId);
        if (!parent) diagnostics.push(diagnostic({ code: "MISSING_ROUTE_PARENT", featureId: incomingId, routeId: route.id, summary: `Route “${route.id}” references a missing parent.` }));
        else if (!isPathWithin(parent.path, route.path)) diagnostics.push(diagnostic({ code: "INVALID_ROUTE_PARENT", featureId: incomingId, routeId: route.id, summary: `Route “${route.id}” is not nested beneath its declared parent.` }));
      }

      const seenProviderIds = new Set<string>();
      for (const provider of candidateProviders) {
        if (seenProviderIds.has(provider.id) || providers.has(provider.id)) diagnostics.push(diagnostic({ code: "DUPLICATE_PROVIDER", featureId: incomingId, providerId: provider.id, summary: `Provider id “${provider.id}” is already registered.` }));
        seenProviderIds.add(provider.id);
      }
      const allProviderIds = new Set([...providers.keys(), ...batchProviderIds, ...candidateProviders.map((provider) => provider.id)]);
      for (const provider of candidateProviders) {
        for (const dependency of provider.dependsOn ?? []) {
          if (!allProviderIds.has(dependency)) diagnostics.push(diagnostic({ code: "MISSING_PROVIDER_DEPENDENCY", featureId: incomingId, providerId: provider.id, summary: `Provider dependency path ${provider.id} → ${dependency} is unavailable.` }));
        }
      }
      for (const cycle of findProviderCycles([...providers.values(), ...candidateProviders])) {
        if (batchCycles.some((batchCycle) => batchCycle.join("|") === cycle.join("|"))) continue;
        diagnostics.push(diagnostic({
          code: "PROVIDER_DEPENDENCY_CYCLE",
          featureId: incomingId,
          providerId: cycle[0],
          summary: `Provider dependency cycle: ${cycle.join(" → ")}.`,
        }));
      }
      for (const cycle of batchCycles) {
        if (!candidateProviders.some((provider) => cycle.includes(provider.id))) continue;
        diagnostics.push(diagnostic({
          code: "PROVIDER_DEPENDENCY_CYCLE",
          featureId: incomingId,
          providerId: cycle[0],
          summary: `Provider dependency cycle: ${cycle.join(" → ")}.`,
        }));
      }

      const sorted = sortDiagnostics(diagnostics);
      if (sorted.length > 0) {
        allDiagnostics.push(...sorted);
        if (incomingId && ID_PATTERN.test(incomingIdValue) && !features.has(incomingIdValue)) {
          features.set(incomingIdValue, Object.freeze({
            id: incomingId,
            status: "unavailable",
            routeCount: rawRoutes.length,
            providerCount: rawProviders.length,
            error: Object.freeze({ category: "registration", code: sorted[0]?.code ?? "INVALID_MODULE", featureId: incomingId, recoverable: true, summary: sorted[0]?.summary ?? "Feature registration failed." }),
          }));
        }
        return { ok: false, error: sorted };
      }

      const acceptedId = incomingId as FeatureId;
      features.set(acceptedId, Object.freeze({ id: acceptedId, status: "registered", routeCount: candidateRoutes.length, providerCount: candidateProviders.length }));
      for (const route of candidateRoutes) routes.set(route.id, route);
      for (const provider of candidateProviders) providers.set(provider.id, provider);
      return { ok: true, value: undefined };
    },
    registerBatch(rawModules: readonly unknown[]): readonly Result<void, readonly RegistrationDiagnostic[]>[] {
      const providersFor = (moduleIndexes: ReadonlySet<number>): readonly ProviderRegistration[] =>
        rawModules.flatMap((rawModule, index) => {
          if (!moduleIndexes.has(index)) return [];
          const moduleRecord = asRecord(rawModule);
          if (!Array.isArray(moduleRecord?.providers)) return [];
          const owner = typeof moduleRecord.id === "string" ? makeFeatureId(moduleRecord.id) : undefined;
          const ignoredDiagnostics: RegistrationDiagnostic[] = [];
          return moduleRecord.providers
            .map((provider) => cloneProvider(provider, owner, ignoredDiagnostics))
            .filter((provider): provider is ProviderRegistration => provider !== null);
        });

      // Planning reaches a fixed point: once a module is rejected, providers it
      // owned leave the namespace and every dependent consumer is revalidated.
      let accepted = new Set(rawModules.map((_, index) => index));
      for (;;) {
        const candidateProviders = providersFor(accepted);
        const candidateCycles = findProviderCycles([...providers.values(), ...candidateProviders]);
        const cyclicProviderIds = new Set(candidateCycles.flat());
        const candidateProviderIds = candidateProviders
          .map((provider) => provider.id)
          .filter((providerId) => !cyclicProviderIds.has(providerId));
        const planningRegistry = createFeatureRegistry();
        const nextAccepted = new Set<number>();
        for (const index of accepted) {
          const planned = planningRegistry.register(rawModules[index], candidateProviderIds, candidateCycles);
          if (planned.ok) nextAccepted.add(index);
        }
        if (nextAccepted.size === accepted.size) break;
        accepted = nextAccepted;
      }

      const acceptedProviders = providersFor(accepted);
      const acceptedCycles = findProviderCycles([...providers.values(), ...acceptedProviders]);
      const cyclicProviderIds = new Set(acceptedCycles.flat());
      const acceptedProviderIds = acceptedProviders
        .map((provider) => provider.id)
        .filter((providerId) => !cyclicProviderIds.has(providerId));
      const results: Result<void, readonly RegistrationDiagnostic[]>[] = new Array(rawModules.length);
      for (let index = 0; index < rawModules.length; index += 1) {
        if (!accepted.has(index)) continue;
        results[index] = registry.register(rawModules[index], acceptedProviderIds, acceptedCycles);
      }
      for (let index = 0; index < rawModules.length; index += 1) {
        if (accepted.has(index)) continue;
        results[index] = registry.register(rawModules[index], acceptedProviderIds, acceptedCycles);
      }
      return freezeList(results);
    },
    listFeatures: () => freezeList([...features.values()].sort((a, b) => a.id.localeCompare(b.id))),
    listRoutes: () => freezeList([...routes.values()].sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id))),
    listProviders: () => freezeList([...providers.values()].sort((a, b) => a.id.localeCompare(b.id))),
    diagnostics: () => sortDiagnostics(allDiagnostics),
    recordUnavailable(id: FeatureId, entryDiagnostic: RegistrationDiagnostic): void {
      const frozenDiagnostic = diagnostic({
        code: entryDiagnostic.code,
        featureId: id,
        summary: entryDiagnostic.summary,
      });
      allDiagnostics.push(frozenDiagnostic);
      features.set(id, Object.freeze({
        id,
        status: "unavailable",
        routeCount: 0,
        providerCount: 0,
        error: Object.freeze({
          category: "registration",
          code: frozenDiagnostic.code,
          featureId: id,
          recoverable: true,
          summary: frozenDiagnostic.summary,
        }),
      }));
    },
    setFeatureStatus(id: FeatureId, status: FeatureReadiness["status"], error?: FeatureReadiness["error"]): void {
      const current = features.get(id);
      if (!current) return;
      features.set(id, Object.freeze({
        ...current,
        status,
        ...(error ? { error } : { error: undefined }),
      }));
    },
  };
  return registry;
}
