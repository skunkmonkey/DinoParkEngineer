import { byteLength, canonicalSerialize, deepClone, stableHash } from "./canonical.ts";
import type {
  FeatureStateAdapter,
  FeatureStateSection,
  SaveEnvelope,
  SaveManifest,
  SaveMetadata,
  SaveSlot,
  StateDiagnostic,
  ValidationResult,
} from "./types.ts";

/* Canonical aggregation stores heterogeneous feature adapters. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const CURRENT_SAVE_FORMAT = 1;
export const DEFAULT_MAX_SAVE_BYTES = 4 * 1024 * 1024;

function diagnostic(code: StateDiagnostic["code"], path: string, message: string, details?: StateDiagnostic["details"]): StateDiagnostic {
  return Object.freeze({ code, path, message, ...(details ? { details } : {}) });
}

export function envelopeWithoutChecksum(envelope: Omit<SaveEnvelope, "checksum" | "sizeBytes"> | SaveEnvelope): unknown {
  const source = envelope as SaveEnvelope;
  return {
    formatVersion: source.formatVersion,
    metadata: source.metadata,
    manifest: source.manifest,
    features: source.features,
    contentRefs: source.contentRefs,
  };
}

export function computeEnvelopeChecksum(envelope: Omit<SaveEnvelope, "checksum" | "sizeBytes"> | SaveEnvelope): string {
  return stableHash(envelopeWithoutChecksum(envelope));
}

export function encodeEnvelope(envelope: SaveEnvelope): string {
  return canonicalSerialize(envelope);
}

export function decodeEnvelope(raw: string, maxBytes = DEFAULT_MAX_SAVE_BYTES): ValidationResult<SaveEnvelope> {
  if (typeof raw !== "string" || byteLength(raw) > maxBytes) {
    return { ok: false, error: [diagnostic("OVERSIZE", "$", `Save exceeds the ${maxBytes}-byte import limit.`, { maxBytes })] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: [diagnostic("INVALID_TYPE", "$", "Save is not valid JSON.")] };
  }
  const errors = validateEnvelopeShape(parsed, maxBytes);
  if (errors.length > 0) return { ok: false, error: errors };
  const envelope = parsed as SaveEnvelope;
  if (computeEnvelopeChecksum(envelope) !== envelope.checksum) {
    return { ok: false, error: [diagnostic("CHECKSUM_MISMATCH", "checksum", "Save checksum does not match its contents.")] };
  }
  return { ok: true, value: Object.freeze(deepClone(envelope)) };
}

export function validateEnvelopeShape(value: unknown, maxBytes = DEFAULT_MAX_SAVE_BYTES): readonly StateDiagnostic[] {
  const errors: StateDiagnostic[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [diagnostic("INVALID_TYPE", "$", "Save envelope must be an object.")];
  }
  const candidate = value as Partial<SaveEnvelope>;
  if (!Number.isSafeInteger(candidate.formatVersion) || (candidate.formatVersion as number) < 1) errors.push(diagnostic("SCHEMA_MISMATCH", "formatVersion", "Save format version must be a positive integer."));
  if (!candidate.metadata || typeof candidate.metadata !== "object") errors.push(diagnostic("MISSING_FIELD", "metadata", "Save metadata is required."));
  else {
    const metadata = candidate.metadata as Partial<SaveMetadata>;
    for (const key of ["saveId", "slot", "createdAt", "updatedAt"] as const) if (typeof metadata[key] !== "string" || metadata[key] === "") errors.push(diagnostic("INVALID_VALUE", `metadata.${key}`, `${key} must be a non-empty string.`));
  }
  if (!candidate.manifest || typeof candidate.manifest !== "object") errors.push(diagnostic("MISSING_FIELD", "manifest", "Save build/schema manifest is required."));
  else if (typeof (candidate.manifest as SaveManifest).buildId !== "string") errors.push(diagnostic("INVALID_VALUE", "manifest.buildId", "Save build id is required."));
  if (!candidate.features || typeof candidate.features !== "object" || Array.isArray(candidate.features)) errors.push(diagnostic("MISSING_FIELD", "features", "Save feature sections are required."));
  else for (const [id, section] of Object.entries(candidate.features as Record<string, FeatureStateSection>)) {
    if (!id || !section || typeof section !== "object") errors.push(diagnostic("INVALID_VALUE", `features.${id}`, "Feature section must be an object."));
    else {
      if (!Number.isSafeInteger(section.schemaVersion) || section.schemaVersion < 1) errors.push(diagnostic("SCHEMA_MISMATCH", `features.${id}.schemaVersion`, "Feature schema version must be a positive integer."));
      if (typeof section.canonicalHash !== "string" || section.canonicalHash === "") errors.push(diagnostic("INVALID_VALUE", `features.${id}.canonicalHash`, "Feature canonical hash is required."));
    }
  }
  if (!Array.isArray(candidate.contentRefs) || candidate.contentRefs.some((ref) => typeof ref !== "string")) errors.push(diagnostic("INVALID_VALUE", "contentRefs", "Content references must be a string array."));
  if (typeof candidate.checksum !== "string" || candidate.checksum === "") errors.push(diagnostic("MISSING_FIELD", "checksum", "Save checksum is required."));
  const encoded = (() => { try { return canonicalSerialize(value); } catch { return ""; } })();
  if (!Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes !== byteLength(encoded)) errors.push(diagnostic("SCHEMA_MISMATCH", "sizeBytes", "Save byte size does not match canonical bytes."));
  if (byteLength(encoded) > maxBytes) errors.push(diagnostic("OVERSIZE", "sizeBytes", `Save exceeds the ${maxBytes}-byte import limit.`, { maxBytes }));
  return Object.freeze(errors);
}

export function makeEnvelope(input: {
  readonly formatVersion: number;
  readonly metadata: SaveMetadata;
  readonly manifest: SaveManifest;
  readonly features: Readonly<Record<string, FeatureStateSection>>;
  readonly contentRefs?: readonly string[];
}): SaveEnvelope {
  const base = {
    formatVersion: input.formatVersion,
    metadata: deepClone(input.metadata),
    manifest: deepClone(input.manifest),
    features: deepClone(input.features),
    contentRefs: [...(input.contentRefs ?? [])].sort(),
  } as const;
  const checksum = computeEnvelopeChecksum(base);
  const withoutSize = { ...base, checksum };
  // `sizeBytes` describes the canonical envelope including itself. Iterate to
  // a fixed point because the decimal digit count can change at a boundary.
  let sizeBytes = 0;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const next = byteLength(canonicalSerialize({ ...withoutSize, sizeBytes }));
    if (next === sizeBytes) break;
    sizeBytes = next;
  }
  return Object.freeze({ ...withoutSize, sizeBytes });
}

export function rebindEnvelopeSlot(envelope: SaveEnvelope, slot: SaveSlot): SaveEnvelope {
  const base = { ...envelope, metadata: { ...envelope.metadata, slot } };
  const withChecksum = { ...base, checksum: computeEnvelopeChecksum(base) };
  let sizeBytes = 0;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const next = byteLength(canonicalSerialize({ ...withChecksum, sizeBytes }));
    if (next === sizeBytes) break;
    sizeBytes = next;
  }
  return Object.freeze({ ...withChecksum, sizeBytes });
}

export function validateFeatureSections(
  envelope: SaveEnvelope,
  adapters: readonly FeatureStateAdapter[],
): { readonly ok: true; readonly values: ReadonlyMap<string, unknown> } | { readonly ok: false; readonly error: readonly StateDiagnostic[] } {
  const errors: StateDiagnostic[] = [];
  const values = new Map<string, unknown>();
  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  for (const adapter of adapters) {
    const section = envelope.features[adapter.id];
    if (!section) {
      errors.push(diagnostic("MISSING_FIELD", `features.${adapter.id}`, `Save is missing required feature section “${adapter.id}”.`));
      continue;
    }
    if (section.schemaVersion !== adapter.schemaVersion) {
      errors.push(diagnostic("SCHEMA_MISMATCH", `features.${adapter.id}.schemaVersion`, `Feature “${adapter.id}” expects schema ${adapter.schemaVersion}, save contains ${section.schemaVersion}.`));
      continue;
    }
    try {
      const validation = adapter.validate(section.value);
      if (!validation.ok) errors.push(...validation.error.map((item) => ({ ...item, path: `features.${adapter.id}.${item.path === "$" ? "" : item.path}` })));
      else {
        const hash = adapter.canonicalHash(validation.value);
        if (hash !== section.canonicalHash) errors.push(diagnostic("CHECKSUM_MISMATCH", `features.${adapter.id}.canonicalHash`, `Feature “${adapter.id}” hash does not match its value.`));
        else values.set(adapter.id, validation.value);
      }
    } catch (thrown) {
      errors.push(diagnostic("INVALID_VALUE", `features.${adapter.id}`, `Feature “${adapter.id}” validation failed.`, { cause: thrown instanceof Error ? thrown.message : String(thrown) }));
    }
  }
  for (const id of Object.keys(envelope.features)) if (!byId.has(id)) errors.push(diagnostic("INVALID_REFERENCE", `features.${id}`, `Save contains unknown feature section “${id}”.`));
  return errors.length > 0 ? { ok: false, error: Object.freeze(errors) } : { ok: true, values };
}

export function canonicalFeatureHash(adapters: readonly FeatureStateAdapter<any>[]): string {
  return stableHash(Object.fromEntries(adapters.slice().sort((a, b) => a.id.localeCompare(b.id)).map((adapter) => [adapter.id, adapter.canonicalHash(adapter.snapshot())])));
}
