const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

export const canonicalSerialize = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

export const fingerprint = (value: unknown): string => {
  const bytes = new TextEncoder().encode(canonicalSerialize(value));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

export const fingerprintCatalogPackage = (
  packageValue: Omit<import("./types.js").CatalogPackage, "fingerprint">,
): string => fingerprint(packageValue);
