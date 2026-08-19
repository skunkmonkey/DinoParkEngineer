import { z } from "zod";
import type { ContentClassDefinition } from "./types.js";

export const portableIdentityPattern = /^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u;
export const portableVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const contentClassPattern = /^[A-Za-z][A-Za-z0-9._-]*$/u;
const tagPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

const portablePath = z.string().min(1).superRefine((path, context) => {
  const invalid = path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/u.test(path) ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
  if (invalid) context.addIssue({ code: "custom", message: "must be a portable relative POSIX path" });
});

const referenceSchema = z.strictObject({
  id: z.string().regex(portableIdentityPattern),
  version: z.string().regex(portableVersionPattern),
  expectedClass: z.string().regex(contentClassPattern).optional(),
  expectedSchemaVersion: z.string().regex(portableVersionPattern).optional(),
});

export const contentRecordEnvelopeSchema = z.strictObject({
  id: z.string().regex(portableIdentityPattern),
  version: z.string().regex(portableVersionPattern),
  class: z.string().regex(contentClassPattern),
  schemaVersion: z.string().regex(portableVersionPattern),
  displayName: z.string().min(1),
  author: z.string().min(1),
  provenance: z.strictObject({
    source: z.string().min(1),
    path: portablePath,
    author: z.string().min(1),
    license: z.string().min(1).optional(),
  }),
  contextCost: z.number().int().nonnegative(),
  dependencies: z.array(referenceSchema),
  tags: z.array(z.string().regex(tagPattern)),
  availability: z.enum(["available", "hidden", "unavailable"]),
  readableSource: z.string().optional(),
  data: z.unknown(),
});

export const catalogPackageSchema = z.strictObject({
  packageId: z.string().regex(portableIdentityPattern),
  packageVersion: z.string().regex(portableVersionPattern),
  registrySchemaVersion: z.string().regex(portableVersionPattern),
  requirement: z.enum(["required", "optional"]),
  entries: z.array(z.unknown()),
  fingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
});

export const promptDataSchema = z.strictObject({
  purpose: z.string().min(1),
  tradeoffs: z.array(z.string().min(1)),
});

export interface ContentClassSchemaCatalog {
  get(contentClass: string, schemaVersion: string): z.ZodType<unknown> | undefined;
}

export const createContentClassSchemaCatalog = (
  definitions: readonly ContentClassDefinition[],
): ContentClassSchemaCatalog => {
  const schemas = new Map<string, z.ZodType<unknown>>();
  for (const definition of definitions) {
    const key = `${definition.class}\u0000${definition.schemaVersion}`;
    if (schemas.has(key)) throw new Error(`Duplicate content class schema: ${definition.class}@${definition.schemaVersion}`);
    schemas.set(key, definition.schema);
  }
  return Object.freeze({ get: (contentClass: string, schemaVersion: string) => schemas.get(`${contentClass}\u0000${schemaVersion}`) });
};
