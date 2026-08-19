import type {
  FeatureRegistry,
  FeatureRouteContribution,
  RegisteredFeature,
} from "./feature-registry.js";
import { normalizeRoutePath } from "./feature-registry.js";

/** JSON-like values carried across route transitions without shell semantics. */
export type SerializableValue =
  | null
  | boolean
  | number
  | string
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue };

/**
 * Domain-owned causal data.  The shell preserves this value opaquely; it does
 * not inspect, normalize, or derive meaning from entity identifiers inside it.
 */
export type CausalNavigationPayload = SerializableValue;

export const NOT_FOUND_MODE = "recovery";
export const NOT_FOUND_TITLE = "Route not found";

export type RouteRequest = Readonly<{
  pathname: string;
  basePath?: string;
  causalPayload?: CausalNavigationPayload;
  /** Explicit safe route selected by the owning shell configuration. */
  safeRouteId?: string;
}>;

export type RouteMatch<TFeature = unknown> = Readonly<{
  kind: "match";
  status: "matched";
  feature: RegisteredFeature<TFeature>;
  route: FeatureRouteContribution;
  /** Canonical application-relative route path, without the base path. */
  pathname: string;
  /** Canonical browser pathname, including the configured base path. */
  urlPathname: string;
  basePath: string;
  mode: string;
  title: string;
  causalPayload?: CausalNavigationPayload;
}>;

export type RouteNotFound<TFeature = unknown> = Readonly<{
  kind: "not-found";
  status: "not-found";
  pathname: string;
  urlPathname: string;
  basePath: string;
  mode: typeof NOT_FOUND_MODE;
  title: typeof NOT_FOUND_TITLE;
  causalPayload?: CausalNavigationPayload;
  /** Safe Park View target, when one was registered or configured. */
  safeFeature?: RegisteredFeature<TFeature>;
  safeRoute?: FeatureRouteContribution;
  safePath?: string;
  /** Safe route path including the configured deployment base. */
  safeUrlPathname?: string;
}>;

export type RouteResolution<TFeature = unknown> =
  | RouteMatch<TFeature>
  | RouteNotFound<TFeature>;

export type RouteMatcherOptions = Readonly<{
  basePath?: string;
  safeRouteId?: string;
}>;

export class RoutePathError extends Error {
  readonly code = "SHELL_ROUTE_PATH_INVALID";

  constructor(path: string) {
    super(`Route path must be a clean path: ${path}`);
    this.name = "RoutePathError";
  }
}

function normalizePathOrThrow(path: string, label: string): string {
  try {
    return normalizeRoutePath(path);
  } catch {
    throw new RoutePathError(`${label} ${path}`);
  }
}

/** Normalize the configured deployment base path without changing casing. */
export function normalizeBasePath(basePath = "/"): string {
  if (typeof basePath !== "string" || basePath.length === 0) {
    throw new RoutePathError(String(basePath));
  }
  if (basePath === "." || basePath === "./") return "/";
  return normalizePathOrThrow(
    basePath.startsWith("/") ? basePath : `/${basePath}`,
    "Base path",
  );
}

/**
 * Return a pathname suitable for matching.  Search and hash components are
 * ignored because the browser supplies them separately from location.path.
 */
export function normalizeRequestPath(pathname: string): string {
  if (typeof pathname !== "string" || pathname.length === 0) {
    throw new RoutePathError(String(pathname));
  }
  const queryIndex = pathname.search(/[?#]/u);
  const pathOnly = queryIndex === -1 ? pathname : pathname.slice(0, queryIndex);
  if (pathOnly.length === 0) return "/";
  return normalizePathOrThrow(
    pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`,
    "Request path",
  );
}

function applicationPath(
  pathname: string,
  basePath: string,
): { readonly applicationPath: string; readonly urlPathname: string } | undefined {
  if (basePath === "/") {
    return { applicationPath: pathname, urlPathname: pathname };
  }
  if (pathname === basePath) {
    return { applicationPath: "/", urlPathname: pathname };
  }
  const prefix = `${basePath}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  return {
    applicationPath: normalizeRoutePath(pathname.slice(basePath.length)),
    urlPathname: pathname,
  };
}

function safeFeature<TFeature>(
  registry: FeatureRegistry<TFeature>,
  safeRouteId: string | undefined,
): RegisteredFeature<TFeature> | undefined {
  if (safeRouteId !== undefined) {
    const configured = registry.getRoute(safeRouteId);
    if (configured !== undefined) return configured;
  }

  // Park View is a stable shell fallback convention.  An explicit configured
  // route remains authoritative when the application uses another route ID.
  const parkRoute = registry.getRoute("park") ?? registry.getFeature("park");
  if (parkRoute !== undefined) return parkRoute;

  const rootRoute = registry.getRouteByPath("/");
  if (rootRoute !== undefined) return rootRoute;

  return registry.features.find((feature) => feature.requirement === "required") ??
    registry.features[0];
}

function withBasePath(basePath: string, applicationPath: string): string {
  if (basePath === "/") return applicationPath;
  return applicationPath === "/" ? basePath : `${basePath}${applicationPath}`;
}

/**
 * Match a clean route against a validated feature registry.  Matching uses
 * exact case-sensitive path segments and is independent of loader completion.
 */
export function matchRoute<TFeature = unknown>(
  registry: FeatureRegistry<TFeature>,
  request: RouteRequest,
): RouteResolution<TFeature>;
export function matchRoute<TFeature = unknown>(
  registry: FeatureRegistry<TFeature>,
  pathname: string,
  basePath?: string,
  causalPayload?: CausalNavigationPayload,
): RouteResolution<TFeature>;
export function matchRoute<TFeature = unknown>(
  registry: FeatureRegistry<TFeature>,
  requestOrPathname: RouteRequest | string,
  basePath = "/",
  causalPayload?: CausalNavigationPayload,
): RouteResolution<TFeature> {
  const request: RouteRequest =
    typeof requestOrPathname === "string"
      ? { pathname: requestOrPathname, basePath, causalPayload }
      : requestOrPathname;
  const normalizedBasePath = normalizeBasePath(request.basePath ?? "/");
  const normalizedPathname = normalizeRequestPath(request.pathname);
  const application = applicationPath(normalizedPathname, normalizedBasePath);
  const payload = request.causalPayload;

  if (application !== undefined) {
    const feature = registry.getRouteByPath(application.applicationPath);
    if (feature !== undefined) {
      return {
        kind: "match",
        status: "matched",
        feature,
        route: feature.route,
        pathname: application.applicationPath,
        urlPathname: application.urlPathname,
        basePath: normalizedBasePath,
        mode: feature.route.mode,
        title: feature.route.title,
        ...(payload === undefined ? {} : { causalPayload: payload }),
      };
    }
  }

  const fallback = safeFeature(registry, request.safeRouteId);
  return {
    kind: "not-found",
    status: "not-found",
    pathname: application?.applicationPath ?? normalizedPathname,
    urlPathname: normalizedPathname,
    basePath: normalizedBasePath,
    mode: NOT_FOUND_MODE,
    title: NOT_FOUND_TITLE,
    ...(payload === undefined ? {} : { causalPayload: payload }),
    ...(fallback === undefined
      ? {}
      : {
          safeFeature: fallback,
          safeRoute: fallback.route,
          safePath: fallback.route.path,
          safeUrlPathname: withBasePath(normalizedBasePath, fallback.route.path),
        }),
  };
}

/** Alias for callers that want to make the clean-path intent explicit. */
export const matchCleanRoute = matchRoute;

/** Build an opaque navigation request without interpreting causal data. */
export function createRouteRequest(
  pathname: string,
  causalPayload?: CausalNavigationPayload,
  basePath?: string,
  safeRouteId?: string,
): RouteRequest {
  return Object.freeze({
    pathname,
    ...(basePath === undefined ? {} : { basePath }),
    ...(causalPayload === undefined ? {} : { causalPayload }),
    ...(safeRouteId === undefined ? {} : { safeRouteId }),
  });
}
