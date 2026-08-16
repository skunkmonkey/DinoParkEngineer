/// <reference types="vite/client" />

import type { FeatureModule, ShellRouteManifestEntry } from "../shell/public.ts";
import { loadFeatureModules, type FeatureDiscoveryResult } from "./discovery.ts";

/** Feature public entries remain separate chunks and are loaded through this manifest. */
const publicEntryLoaders = import.meta.glob<Readonly<Record<string, unknown>>>(
  ["../*/public.ts", "!../shell/public.ts"],
);

let discovery: Promise<FeatureDiscoveryResult> | undefined;

async function discoverFeatureModules(): Promise<FeatureDiscoveryResult> {
  return loadFeatureModules(publicEntryLoaders);
}

export function getFeatureDiscovery(): Promise<FeatureDiscoveryResult> {
  discovery ??= discoverFeatureModules();
  return discovery;
}

export async function getFeatureModules(): Promise<readonly FeatureModule[]> {
  return (await getFeatureDiscovery()).modules;
}

export async function getFeatureRouteManifest(): Promise<readonly ShellRouteManifestEntry[]> {
  const routes = (await getFeatureModules()).flatMap((feature) => feature.routes ?? []);
  return Object.freeze(routes.map((route) => Object.freeze({
    id: route.id,
    path: route.path,
    ...(route.parentId ? { parentId: route.parentId } : {}),
    ...(route.title ? { title: route.title } : {}),
  })).sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id)));
}
