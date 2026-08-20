import { z } from "zod";

import {
  contextItemSchema,
} from "../context/public.js";
import {
  parkOperationsStateSchema,
} from "../park-operations/public.js";
import {
  traceSchema,
} from "../trace-replay/public.js";
import {
  worldStateSchema,
} from "../simulation/public.js";
import {
  PERSISTENCE_COMPLETION_MARKER,
  PERSISTENCE_FINGERPRINT_ALGORITHM,
  PERSISTENCE_SCHEMA_VERSION,
} from "./types.js";

const stableId = z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u);
const contentId = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const fingerprint = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u);
const reference = z.strictObject({
  id: contentId,
  version,
  expectedClass: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*$/u).optional(),
  expectedSchemaVersion: version.optional(),
});

const contextManifestEntrySchema = z.strictObject({
  item: contextItemSchema.optional(),
  itemId: stableId,
  lifecycle: z.enum(["included", "unavailable-required", "inapplicable", "excluded", "compacted", "externalized"]),
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]*$/u),
});
const contextManifestSchema = z.strictObject({
  id: stableId,
  agentId: stableId,
  jobId: stableId,
  decisionTick: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  segments: z.array(z.strictObject({
    category: z.enum(["Task", "SystemPrompt", "Skill", "Policy", "Knowledge", "Memory", "Tool", "Message", "Observation", "ToolResult", "TaskHistory", "IncidentEvidence"]),
    units: z.number().int().positive(),
  })),
  entries: z.array(contextManifestEntrySchema),
  previousManifestId: stableId.optional(),
});
const memoryReferenceSchema = z.strictObject({ id: z.string().min(1), version });
const retentionAuditSchema = z.strictObject({
  id: stableId,
  policy: z.enum(["Strict", "KeepNewest", "PriorityRetention", "CompactHistory", "ExternalizeRetrieve"]),
  beforeManifestId: stableId,
  afterManifestId: stableId,
  excess: z.number().int().nonnegative(),
  retainedItemIds: z.array(stableId),
  excludedItemIds: z.array(stableId),
  compactedItemIds: z.array(stableId).optional(),
  externalizedItemIds: z.array(stableId).optional(),
  memoryReferences: z.array(memoryReferenceSchema).optional(),
  knownLostDetail: z.array(z.string().min(1)).optional(),
  halted: z.boolean(),
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]*$/u),
});

export const contextPersistenceStateSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  manifests: z.array(contextManifestSchema),
  retentionAudits: z.array(retentionAuditSchema),
});

export const tracePersistenceStateSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  traces: z.array(traceSchema),
});

export const playerPreferencesSchema = z.strictObject({
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  textScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
  soundSubstitution: z.boolean(),
});

export const persistencePackageManifestSchema = z.strictObject({
  packageId: contentId,
  packageVersion: version,
  registrySchemaVersion: version,
  requirement: z.enum(["required", "optional"]),
  fingerprint,
});

export const persistenceContentManifestSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  packages: z.array(persistencePackageManifestSchema),
  references: z.array(reference),
  fingerprint,
});

const simulationSectionSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  fingerprint,
  data: worldStateSchema,
});
const operationsSectionSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  fingerprint,
  data: parkOperationsStateSchema,
});
const contextSectionSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  fingerprint,
  data: contextPersistenceStateSchema,
});
const traceSectionSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  fingerprint,
  data: tracePersistenceStateSchema,
});
const preferencesSectionSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  fingerprint,
  data: playerPreferencesSchema,
});

export const persistenceSectionSchemas = Object.freeze({
  simulation: simulationSectionSchema,
  parkOperations: operationsSectionSchema,
  context: contextSectionSchema,
  traceReplay: traceSectionSchema,
  preferences: preferencesSectionSchema,
});

export const persistenceSectionsSchema = z.strictObject({
  simulation: simulationSectionSchema,
  parkOperations: operationsSectionSchema,
  context: contextSectionSchema,
  traceReplay: traceSectionSchema,
  preferences: preferencesSectionSchema,
});

export const saveEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  saveSchemaVersion: z.literal(PERSISTENCE_SCHEMA_VERSION),
  applicationVersion: z.string().min(1),
  id: stableId,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  park: z.strictObject({
    tick: z.number().int().nonnegative(),
    day: z.number().int().positive(),
    seed: z.number().int().nonnegative().max(0xffffffff),
  }),
  contentManifest: persistenceContentManifestSchema,
  sections: persistenceSectionsSchema,
  integrity: z.strictObject({
    algorithm: z.literal(PERSISTENCE_FINGERPRINT_ALGORITHM),
    fingerprint,
  }),
  completionMarker: z.literal(PERSISTENCE_COMPLETION_MARKER),
});

export type SaveEnvelopeSchema = z.infer<typeof saveEnvelopeSchema>;

/** Keep these schemas available for focused contract tests without exposing internals. */
export const persistenceSchemas = Object.freeze({
  contextPersistenceStateSchema,
  tracePersistenceStateSchema,
  playerPreferencesSchema,
  persistencePackageManifestSchema,
  persistenceContentManifestSchema,
  persistenceSectionsSchema,
  saveEnvelopeSchema,
});
