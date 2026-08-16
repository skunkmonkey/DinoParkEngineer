import type { RouteComponent } from "../shell/public.ts";

export type FramedRouteLoadResult =
  | { readonly ok: true; readonly Component: RouteComponent }
  | { readonly ok: false; readonly message: string };

export async function resolveFramedRouteContent(
  load: () => Promise<RouteComponent>,
): Promise<FramedRouteLoadResult> {
  try {
    return { ok: true, Component: await load() };
  } catch {
    return { ok: false, message: "This feature could not be loaded inside the product frame." };
  }
}
