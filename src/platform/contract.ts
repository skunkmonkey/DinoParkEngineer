import type { PrimaryDestinationPresentation } from "./types.ts";
import { routeId, type RouteComponent, type ShellRouteRegistration } from "../shell/public.ts";

export const FOUNDATION_ROUTE_DEFINITIONS: readonly PrimaryDestinationPresentation[] = Object.freeze([
  { id: "park", routeId: "platform-park", path: "/", label: "Park", iconLabel: "Map", order: 1 },
  { id: "agents", routeId: "platform-agents", path: "/agents", label: "Agents", iconLabel: "Bot", order: 2 },
  { id: "engineering", routeId: "platform-engineering", path: "/engineering", label: "Engineering", iconLabel: "Build", order: 3 },
  { id: "evals", routeId: "platform-evals", path: "/evals", label: "Evals", iconLabel: "Check", order: 4 },
  { id: "reviews", routeId: "platform-reviews", path: "/reviews", label: "Reviews", iconLabel: "Diff", order: 5 },
  { id: "progress", routeId: "platform-progress", path: "/progress", label: "Finance / Progress", iconLabel: "Chart", order: 6 },
]);

export function createFoundationRouteRegistrations(
  load: () => Promise<RouteComponent>,
  options: { readonly exclude?: readonly PrimaryDestinationPresentation["id"][] } = {},
): readonly ShellRouteRegistration[] {
  const excluded = new Set(options.exclude ?? []);
  return Object.freeze(FOUNDATION_ROUTE_DEFINITIONS.filter((destination) => !excluded.has(destination.id)).map((destination) => Object.freeze({
    id: routeId(destination.routeId),
    path: destination.path,
    title: destination.label,
    load,
  })));
}
