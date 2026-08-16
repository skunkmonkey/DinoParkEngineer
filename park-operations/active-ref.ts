import type { ArtifactRef } from "../content-registry/index.ts";

/** UI-facing authored ids that are governed by a different canonical review
 * identity. The mapping is explicit so job intake never guesses by title. */
export const DEFAULT_ACTIVE_REF_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "park.operations.skill.safe-feeding": "review.skill.carnivore-feeding",
});

export function createAuthoritativeActiveRefResolver(
  resolveActive: (artifactId: string) => ArtifactRef | undefined,
  aliases: Readonly<Record<string, string>> = DEFAULT_ACTIVE_REF_ALIASES,
): (artifactId: string) => ArtifactRef | undefined {
  return (artifactId: string) => resolveActive(aliases[artifactId] ?? artifactId);
}
