import type { RouteMatch, ShellRouteManifestEntry, ShellRouteRegistration } from "./types.ts";

interface SegmentMatch {
  readonly params: Record<string, string>;
}

export interface BrowserNavigationPort {
  readonly location: Pick<Location, "pathname" | "search" | "hash">;
  readonly history: Pick<History, "pushState">;
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function matchSegments(pattern: string, pathname: string): SegmentMatch | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  let pathIndex = 0;

  for (let patternIndex = 0; patternIndex < patternSegments.length; patternIndex += 1) {
    const patternSegment = patternSegments[patternIndex] ?? "";
    if (patternSegment.startsWith("*")) {
      params[patternSegment.slice(1) || "splat"] = pathSegments.slice(pathIndex).map(decode).join("/");
      pathIndex = pathSegments.length;
      break;
    }
    const actual = pathSegments[pathIndex];
    const optional = patternSegment.endsWith("?");
    const token = optional ? patternSegment.slice(0, -1) : patternSegment;
    if (actual === undefined) {
      if (optional) continue;
      return null;
    }
    if (token.startsWith(":")) {
      params[token.slice(1)] = decode(actual);
    } else if (token !== actual) {
      return null;
    }
    pathIndex += 1;
  }

  if (pathIndex !== pathSegments.length) return null;
  return { params };
}

function parseQuery(search: string): Readonly<Record<string, string | readonly string[]>> {
  const values = new Map<string, string | readonly string[]>();
  const params = new URLSearchParams(search);
  for (const [key, value] of params.entries()) {
    const current = values.get(key);
    if (current === undefined) values.set(key, value);
    else if (typeof current !== "string") values.set(key, Object.freeze([...current, value]));
    else values.set(key, Object.freeze([current, value]));
  }
  const result: Record<string, string | readonly string[]> = {};
  for (const [key, value] of values) result[key] = value;
  return Object.freeze(result);
}

function specificity(route: ShellRouteRegistration): number {
  return route.path.split("/").filter(Boolean).reduce((score, segment) => {
    if (segment.startsWith("*")) return score;
    if (segment.startsWith(":")) return score + 2;
    return score + 4;
  }, 0);
}

export function matchRoute(
  routes: readonly ShellRouteRegistration[],
  href: string,
  basePath = "/",
): RouteMatch | null {
  let url: URL;
  try {
    const normalized = normalizeClientHref(href, basePath);
    if (normalized === null) return null;
    url = new URL(normalized, "http://shell.local");
  } catch {
    return null;
  }
  const orderedRoutes = [...routes].sort(
    (a, b) => specificity(b) - specificity(a) || a.id.localeCompare(b.id),
  );
  for (const route of orderedRoutes) {
    const result = matchSegments(route.path, url.pathname);
    if (result) {
      return Object.freeze({
        route,
        params: Object.freeze(result.params),
        query: parseQuery(url.search),
      });
    }
  }
  return null;
}

function normalizedBasePath(basePath: string): string {
  const value = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return value === "/" ? "" : value.replace(/\/+$/, "");
}

export function normalizeClientHref(href: string, basePath = "/"): string | null {
  let url: URL;
  try {
    url = new URL(href.startsWith("/") ? href : `/${href}`, "http://shell.local");
  } catch {
    return null;
  }
  const base = normalizedBasePath(basePath);
  if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null;
  const internalPath = base ? url.pathname.slice(base.length) || "/" : url.pathname;
  return `${internalPath}${url.search}${url.hash}`;
}

export function applyBasePath(href: string, basePath = "/"): string {
  const url = new URL(href.startsWith("/") ? href : `/${href}`, "http://shell.local");
  const base = normalizedBasePath(basePath);
  const pathname = url.pathname === "/" ? base || "/" : `${base}${url.pathname}`;
  return `${pathname}${url.search}${url.hash}`;
}

export function matchesRouteManifest(
  routes: readonly ShellRouteManifestEntry[],
  href: string,
  basePath = "/",
): boolean {
  const normalized = normalizeClientHref(href, basePath);
  if (normalized === null) return false;
  const url = new URL(normalized, "http://shell.local");
  return routes.some((route) => matchSegments(route.path, url.pathname) !== null);
}

export function readBrowserHref(browser: BrowserNavigationPort): string {
  return `${browser.location.pathname}${browser.location.search}${browser.location.hash}`;
}

export function subscribeToBrowserNavigation(
  browser: BrowserNavigationPort,
  onNavigate: (href: string) => void,
): () => void {
  const onPopState = () => onNavigate(readBrowserHref(browser));
  browser.addEventListener("popstate", onPopState);
  return () => browser.removeEventListener("popstate", onPopState);
}

export function pushBrowserNavigation(
  browser: BrowserNavigationPort,
  href: string,
  basePath = "/",
): string {
  const externalHref = applyBasePath(href, basePath);
  browser.history.pushState({}, "", externalHref);
  return externalHref;
}
