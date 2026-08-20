import {
  canonicalSerialize,
  fingerprint,
} from "../content-registry/public.js";
import type {
  PersistenceDiagnostic,
  PersistenceValidationResult,
} from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const diagnostic = (
  path: string,
  rule: string,
  message: string,
  code: PersistenceDiagnostic["code"] = "PERSISTENCE_PORTABLE_DATA_INVALID",
): PersistenceDiagnostic => ({ code, path, rule, message });

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const pathLooksPlatformSpecific = (field: string, value: string): boolean => {
  const normalized = field.toLowerCase();
  if (!normalized.includes("path")) return false;
  return value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:[\\/]/u.test(value) ||
    value.split(/[\\/]/u).some((segment) => segment === "..") || value.includes("\\");
};

const walkPortable = (value: unknown, path: string, output: PersistenceDiagnostic[]): void => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) output.push(diagnostic(path, "finite JSON numbers", "Non-finite numbers are not portable JSON data."));
    return;
  }
  if (typeof value === "function") {
    output.push(diagnostic(path, "data-only save sections", "Functions cannot be persisted."));
    return;
  }
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "undefined") {
    output.push(diagnostic(path, "JSON-compatible values", "Undefined, symbols, and bigint values cannot be persisted."));
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        output.push(diagnostic(`${path}[${index}]`, "dense arrays", "Sparse arrays are not portable save data."));
      } else {
        walkPortable(value[index], `${path}[${index}]`, output);
      }
    }
    return;
  }
  if (typeof value !== "object" || !isPlainObject(value)) {
    output.push(diagnostic(path, "plain declarative records", "DOM, renderer, class, Map, Set, Date, and other platform objects are not persisted."));
    return;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    output.push(diagnostic(path, "JSON object keys", "Symbol-keyed properties are not portable save data."));
  }
  for (const [field, entry] of Object.entries(value)) {
    // Existing domain snapshots use optional properties represented as
    // `undefined`. Canonical JSON omits those object keys, so they are safe at
    // an in-memory boundary while sparse-array values remain rejected above.
    if (entry === undefined) continue;
    if (pathLooksPlatformSpecific(field, typeof entry === "string" ? entry : "")) {
      output.push(diagnostic(`${path}.${field}`, "portable relative paths", "Platform-specific or absolute filesystem paths are not persisted."));
    }
    walkPortable(entry, `${path}.${field}`, output);
  }
};

/** Validate that a value is a data-only, structured-clone-compatible save value. */
export const validatePortableData = (value: unknown): PersistenceValidationResult<unknown> => {
  const diagnostics: PersistenceDiagnostic[] = [];
  walkPortable(value, "$", diagnostics);
  return diagnostics.length === 0
    ? { ok: true, value, diagnostics: [] }
    : { ok: false, diagnostics: diagnostics.sort((left, right) => lexical(`${left.path}\0${left.message}`, `${right.path}\0${right.message}`)) };
};

/** Canonical save serialization delegates to the registry's cross-platform JSON rules. */
export const canonicalSaveSerialize = (value: unknown): string => canonicalSerialize(value);

export const fingerprintSaveData = (value: unknown): string => fingerprint(value);

export const clonePortable = <T>(value: T): T => structuredClone(value);

export const freezePortable = <T>(value: T): T => {
  const copy = clonePortable(value);
  const freeze = (entry: unknown): void => {
    if (entry === null || typeof entry !== "object") return;
    Object.freeze(entry);
    for (const child of Object.values(entry)) freeze(child);
  };
  freeze(copy);
  return copy;
};
