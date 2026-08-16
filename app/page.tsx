import type { Metadata } from "next";
import { ShellApp } from "../src/shell/ShellApp";
import { getFeatureRouteManifest } from "../src/features/registration.ts";

export const metadata: Metadata = {
  title: "Dino Park Engineer",
  description: "Engineer reliable AI agents while operating a deterministic automated dinosaur park.",
};

interface HomeProps {
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

export default async function Home({ searchParams }: HomeProps) {
  const search = searchParams ? await searchParams : {};
  return <ShellApp initialPath={appendQuery("/", search)} initialRoutes={await getFeatureRouteManifest()} />;
}
