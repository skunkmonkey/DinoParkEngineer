import { ShellApp } from "../../src/shell/ShellApp";
import { getFeatureRouteManifest } from "../../src/features/registration.ts";

interface CatchAllPageProps {
  readonly params: Promise<{ readonly path: readonly string[] }> | { readonly path: readonly string[] };
  readonly searchParams?: Promise<Record<string, string | readonly string[] | undefined>> | Record<string, string | readonly string[] | undefined>;
}

function appendQuery(path: string, search: Record<string, string | readonly string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(search)) {
    if (raw === undefined) continue;
    for (const value of Array.isArray(raw) ? raw : [raw]) query.append(key, value);
  }
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export default async function CatchAllPage({ params, searchParams }: CatchAllPageProps) {
  const resolved = await params;
  const path = `/${resolved.path.map((segment) => encodeURIComponent(segment)).join("/")}`;
  const search = searchParams ? await searchParams : {};
  const initialPath = appendQuery(path, search);
  return <ShellApp initialPath={initialPath} initialRoutes={await getFeatureRouteManifest()} />;
}
