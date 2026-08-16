import { routeId, type RouteComponent, type ShellRouteRegistration } from "../shell/public.ts";
import type { PrimaryDestination } from "./types.ts";

export interface FramedRouteRegistrationOptions {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly destinationId: PrimaryDestination;
  readonly parentId?: ShellRouteRegistration["parentId"];
  readonly load: () => Promise<RouteComponent>;
}

export function createFramedRouteRegistration(
  options: FramedRouteRegistrationOptions,
): ShellRouteRegistration {
  return Object.freeze({
    id: routeId(options.id),
    path: options.path,
    title: options.title,
    ...(options.parentId ? { parentId: options.parentId } : {}),
    load: async () => {
      const { createFramedRouteComponent } = await import("./FramedFeatureRoute.tsx");
      return createFramedRouteComponent(options.destinationId, options.load);
    },
  });
}
