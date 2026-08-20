import {
  type ContentReference,
  type ContentRegistry,
} from "../content-registry/public.js";
import { parkOperationsStateSchema } from "../park-operations/public.js";
import {
  validateScenarioFixture,
  type WorldCommand,
  type WorldState,
} from "../simulation/public.js";
import {
  validateTrace,
  verifyTraceRerun,
  type Trace,
} from "../trace-replay/public.js";
import type { PlayerPreferences } from "../player-experience/public.js";
import {
  contextPersistenceStateSchema,
  persistenceContentManifestSchema,
  persistenceSectionsSchema,
  playerPreferencesSchema,
  saveEnvelopeSchema,
  tracePersistenceStateSchema,
} from "./schemas.js";
import {
  canonicalSaveSerialize,
  clonePortable,
  fingerprintSaveData,
  freezePortable,
  validatePortableData,
} from "./canonical.js";
import {
  PERSISTENCE_COMPLETION_MARKER,
  PERSISTENCE_FINGERPRINT_ALGORITHM,
  PERSISTENCE_SCHEMA_VERSION,
  type ContextPersistenceState,
  type HistoricalReplayOptions,
  type HistoricalReplayResult,
  type LoadOperationResult,
  type MemorySessionPort,
  type PersistenceContentManifest,
  type PersistenceContentResolver,
  type PersistenceCoordinator,
  type PersistenceCoordinatorOptions,
  type PersistenceDiagnostic,
  type PersistencePackageManifest,
  type PersistenceSession,
  type PersistenceSessionPort,
  type PersistenceDomain,
  type PersistenceValidationResult,
  type SaveEnvelope,
  type SaveEnvelopeInput,
  type SaveOperationResult,
  type SaveRequest,
  type TracePersistenceState,
  type VersionedPersistencePort,
} from "./types.js";
import { createInMemorySaveRepository } from "./repository.js";

const EPOCH = "1970-01-01T00:00:00.000Z";
const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const referenceKey = (reference: ContentReference): string => `${reference.id}\0${reference.version}`;
const packageKey = (entry: PersistencePackageManifest): string => `${entry.packageId}\0${entry.packageVersion}`;

const diagnostic = (
  code: PersistenceDiagnostic["code"],
  path: string,
  rule: string,
  message: string,
): PersistenceDiagnostic => ({ code, path, rule, message });

const sortedReferences = (references: readonly ContentReference[]): readonly ContentReference[] =>
  [...references]
    .map((reference) => ({ ...reference }))
    .sort((left, right) => lexical(referenceKey(left), referenceKey(right)));

const sortedPackages = (packages: readonly PersistencePackageManifest[]): readonly PersistencePackageManifest[] =>
  [...packages]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => lexical(packageKey(left), packageKey(right)));

const sameOrder = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const uniqueSortedDiagnostics = (diagnostics: readonly PersistenceDiagnostic[]): readonly PersistenceDiagnostic[] =>
  [...diagnostics].sort((left, right) => lexical(`${left.path}\0${left.code}\0${left.message}`, `${right.path}\0${right.code}\0${right.message}`));

const section = <T>(data: T): { readonly schemaVersion: "1"; readonly fingerprint: string; readonly data: T } => ({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  fingerprint: fingerprintSaveData(data),
  data: clonePortable(data),
});

export const createVersionedPersistencePort = <Domain extends PersistenceDomain, T>(input: {
  readonly domain: Domain;
  readonly snapshot: () => T;
  readonly validate: (value: unknown) => PersistenceValidationResult<T>;
}): VersionedPersistencePort<Domain, T> => Object.freeze({
  domain: input.domain,
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  snapshot: input.snapshot,
  validate: input.validate,
});

const allCommandKinds: readonly WorldCommand["kind"][] = Object.freeze([
  "bait",
  "evacuate",
  "feed",
  "move",
  "observe-gate",
  "operate-gate",
  "release",
  "reserve",
]);

const toContextState = (context: ContextPersistenceState): ContextPersistenceState => ({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  manifests: context.manifests.map((manifest) => clonePortable(manifest)),
  retentionAudits: context.retentionAudits.map((audit) => clonePortable(audit)),
});

const toTraceState = (traces: readonly Trace[]): TracePersistenceState => ({
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  traces: traces.map((trace) => clonePortable(trace)),
});

const sessionFromEnvelope = (envelope: SaveEnvelope): PersistenceSession => ({
  world: clonePortable(envelope.sections.simulation.data),
  operations: clonePortable(envelope.sections.parkOperations.data),
  context: clonePortable(envelope.sections.context.data),
  traces: clonePortable(envelope.sections.traceReplay.data.traces),
  preferences: clonePortable(envelope.sections.preferences.data),
  ...(envelope.sections.mvp === undefined ? {} : { mvp: clonePortable(envelope.sections.mvp.data) }),
});

/** Constructs a detached restoration candidate; callers replace only after validation. */
export const createPersistenceSessionCandidate = (envelope: SaveEnvelope): PersistenceSession => sessionFromEnvelope(envelope);

const collectReferences = (session: PersistenceSession): readonly ContentReference[] => {
  const references: ContentReference[] = [];
  const add = (reference: ContentReference | undefined): void => {
    if (reference !== undefined) references.push({ ...reference });
  };
  add(session.world.scenario);
  for (const tool of session.world.tools) add(tool.reference);
  for (const robot of session.world.robots) for (const tool of robot.toolRefs) add(tool);
  for (const schedule of session.operations.schedules) {
    add(schedule.task);
    for (const reference of schedule.artifactVersions) add(reference);
  }
  for (const job of session.operations.jobs) {
    add(job.task);
    for (const pin of job.exactDeployedVersions) add(pin.reference);
  }
  for (const manifest of session.context.manifests) {
    for (const entry of manifest.entries) add(entry.item?.sourceVersion);
  }
  for (const trace of session.traces) {
    for (const entry of trace.contentManifest.entries) add(entry.reference);
    for (const reference of trace.authority.exactContent) add(reference);
    for (const event of trace.events) {
      if (event.kind === "task") for (const reference of event.payload.artifactReferences) add(reference);
      if (event.kind === "delegation") for (const reference of event.payload.artifactReferences) add(reference);
      if (event.kind === "tool-request") add(event.payload.tool);
    }
  }
  const unique = new Map<string, ContentReference>();
  for (const reference of references) unique.set(referenceKey(reference), reference);
  return sortedReferences([...unique.values()]);
};

const validateContentManifest = (
  manifest: PersistenceContentManifest,
  session: PersistenceSession | undefined,
  options: SaveValidationOptionsLike,
): readonly PersistenceDiagnostic[] => {
  const diagnostics: PersistenceDiagnostic[] = [];
  const parsed = persistenceContentManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => diagnostic(
      "PERSISTENCE_CONTENT_MANIFEST_INVALID",
      issue.path.join(".") || "contentManifest",
      "content manifest schema",
      issue.message,
    ));
  }
  const sortedRefs = sortedReferences(manifest.references);
  const sortedPackageEntries = sortedPackages(manifest.packages);
  if (!sameOrder(manifest.references.map(referenceKey), sortedRefs.map(referenceKey))) {
    diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MANIFEST_INVALID", "contentManifest.references", "lexical exact references", "Content references must be in stable lexical order."));
  }
  if (!sameOrder(manifest.packages.map(packageKey), sortedPackageEntries.map(packageKey))) {
    diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MANIFEST_INVALID", "contentManifest.packages", "lexical package identity", "Content packages must be in stable lexical order."));
  }
  const referenceKeys = manifest.references.map(referenceKey);
  if (new Set(referenceKeys).size !== referenceKeys.length) diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MANIFEST_INVALID", "contentManifest.references", "unique exact references", "Content manifest contains a duplicate exact reference."));
  const packageKeys = manifest.packages.map(packageKey);
  if (new Set(packageKeys).size !== packageKeys.length) diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MANIFEST_INVALID", "contentManifest.packages", "unique package identity", "Content manifest contains a duplicate package identity."));
  const manifestPayload = {
    schemaVersion: manifest.schemaVersion,
    packages: manifest.packages,
    references: manifest.references,
  };
  const expectedFingerprint = fingerprintSaveData(manifestPayload);
  if (manifest.fingerprint !== expectedFingerprint) diagnostics.push(diagnostic("PERSISTENCE_INTEGRITY_MISMATCH", "contentManifest.fingerprint", "canonical content manifest fingerprint", "The content manifest fingerprint does not match its canonical contents."));

  if (session !== undefined) {
    const expected = collectReferences(session);
    const actual = new Set(manifest.references.map(referenceKey));
    for (const reference of expected) {
      if (!actual.has(referenceKey(reference))) diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MANIFEST_INVALID", "contentManifest.references", "all saved exact content is declared", `Missing exact content declaration ${reference.id}@${reference.version}.`));
    }
  }
  const resolver = options.contentResolver;
  if (options.requireContentResolution === true && resolver === undefined) {
    diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MISSING", "contentManifest", "exact content resolver", "Exact content resolution was requested but no Content Registry resolver was supplied."));
  }
  if (resolver !== undefined) {
    manifest.references.forEach((reference, index) => {
      if (!resolver.resolveExact(reference.id, reference.version).ok) diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MISSING", `contentManifest.references.${index}`, "exact historical content resolution", `Exact content ${reference.id}@${reference.version} is unavailable; current content will not be substituted.`));
    });
  }
  return diagnostics;
};

interface SaveValidationOptionsLike {
  readonly contentResolver?: PersistenceContentResolver;
  readonly requireContentResolution?: boolean;
}

const validateWorld = (world: WorldState): readonly PersistenceDiagnostic[] => {
  const result = validateScenarioFixture({
    schemaVersion: "1",
    scenario: world.scenario,
    exactContent: world.tools.map((tool) => tool.reference).sort((left, right) => lexical(referenceKey(left), referenceKey(right))),
    allowedCommandKinds: allCommandKinds,
    initialState: world,
  });
  if (result.ok) return [];
  return result.diagnostics.map((entry) => diagnostic("PERSISTENCE_SECTION_INVALID", `sections.simulation.data.${entry.path}`, entry.rule, entry.message));
};

const validateOperations = (operations: PersistenceSession["operations"]): readonly PersistenceDiagnostic[] => {
  const diagnostics: PersistenceDiagnostic[] = [];
  const parsed = parkOperationsStateSchema.safeParse(operations);
  if (!parsed.success) return parsed.error.issues.map((issue) => diagnostic("PERSISTENCE_SECTION_INVALID", `sections.parkOperations.data.${issue.path.join(".")}`, "Park Operations state schema", issue.message));
  const collections: readonly [string, readonly { readonly id: string }[]][] = [
    ["jobs", operations.jobs], ["schedules", operations.schedules], ["occurrences", operations.occurrences],
    ["signals", operations.signals], ["alerts", operations.alerts], ["incidents", operations.incidents], ["daySummaries", operations.daySummaries],
  ];
  for (const [name, entries] of collections) {
    const ids = entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", `sections.parkOperations.data.${name}`, "unique stable IDs", `${name} contains a duplicate ID.`));
  }
  return diagnostics;
};

const validateContext = (context: ContextPersistenceState): readonly PersistenceDiagnostic[] => {
  const diagnostics: PersistenceDiagnostic[] = [];
  const parsed = contextPersistenceStateSchema.safeParse(context);
  if (!parsed.success) return parsed.error.issues.map((issue) => diagnostic("PERSISTENCE_SECTION_INVALID", `sections.context.data.${issue.path.join(".")}`, "Context persistence schema", issue.message));
  const manifestIds = context.manifests.map((manifest) => manifest.id);
  if (new Set(manifestIds).size !== manifestIds.length) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", "sections.context.data.manifests", "unique manifest IDs", "Context persistence contains a duplicate manifest ID."));
  for (const [index, manifest] of context.manifests.entries()) {
    for (const [entryIndex, entry] of manifest.entries.entries()) {
      if (entry.item !== undefined && entry.item.id !== entry.itemId) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", `sections.context.data.manifests.${index}.entries.${entryIndex}.itemId`, "manifest item identity", "Context manifest itemId must match the embedded item ID."));
    }
  }
  return diagnostics;
};

const validateTraces = (
  traceState: TracePersistenceState,
  contentManifest: PersistenceContentManifest,
): readonly PersistenceDiagnostic[] => {
  const diagnostics: PersistenceDiagnostic[] = [];
  const parsed = tracePersistenceStateSchema.safeParse(traceState);
  if (!parsed.success) return parsed.error.issues.map((issue) => diagnostic("PERSISTENCE_SECTION_INVALID", `sections.traceReplay.data.${issue.path.join(".")}`, "Trace persistence schema", issue.message));
  const available = new Set(contentManifest.references.map(referenceKey));
  traceState.traces.forEach((trace, index) => {
    const validation = validateTrace(trace);
    if (!validation.ok) {
      for (const issue of validation.diagnostics) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", `sections.traceReplay.data.traces.${index}.${issue.path}`, issue.code, issue.message));
    }
    for (const reference of trace.authority.exactContent) {
      if (!available.has(referenceKey(reference))) diagnostics.push(diagnostic("PERSISTENCE_CONTENT_MANIFEST_INVALID", `sections.traceReplay.data.traces.${index}.authority.exactContent`, "historical trace content is declared", `Trace ${trace.id} requires undeclared exact content ${reference.id}@${reference.version}.`));
    }
  });
  const ids = traceState.traces.map((trace) => trace.id);
  if (new Set(ids).size !== ids.length) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", "sections.traceReplay.data.traces", "unique trace IDs", "Trace persistence contains a duplicate trace ID."));
  return diagnostics;
};

const validatePreferences = (preferences: PlayerPreferences): readonly PersistenceDiagnostic[] => {
  const parsed = playerPreferencesSchema.safeParse(preferences);
  return parsed.success ? [] : parsed.error.issues.map((issue) => diagnostic("PERSISTENCE_SECTION_INVALID", `sections.preferences.data.${issue.path.join(".")}`, "Player preferences schema", issue.message));
};

const payloadWithoutIntegrity = (envelope: SaveEnvelope): Omit<SaveEnvelope, "integrity"> => {
  const payload = Object.fromEntries(
    Object.entries(envelope).filter(([key]) => key !== "integrity"),
  );
  return payload as Omit<SaveEnvelope, "integrity">;
};

export const createPersistenceContentManifest = (input: {
  readonly registry?: Pick<ContentRegistry, "packages">;
  readonly packages?: readonly PersistencePackageManifest[];
  readonly references?: readonly ContentReference[];
  readonly session?: PersistenceSession;
}): PersistenceContentManifest => {
  const packages = sortedPackages(input.packages ?? input.registry?.packages ?? []);
  const referencesByKey = new Map<string, ContentReference>();
  for (const reference of [...(input.references ?? []), ...(input.session === undefined ? [] : collectReferences(input.session))]) referencesByKey.set(referenceKey(reference), { ...reference });
  const references = sortedReferences([...referencesByKey.values()]);
  const payload = { schemaVersion: PERSISTENCE_SCHEMA_VERSION, packages, references };
  return freezePortable({ ...payload, fingerprint: fingerprintSaveData(payload) });
};

export const createSaveEnvelope = (input: SaveEnvelopeInput): SaveEnvelope => {
  const session = clonePortable(input.session);
  const context = toContextState(session.context);
  const traces = toTraceState(session.traces);
  const sections = {
    simulation: section(session.world),
    parkOperations: section(session.operations),
    context: section(context),
    traceReplay: section(traces),
    preferences: section(session.preferences),
    ...(session.mvp === undefined ? {} : { mvp: section(session.mvp) }),
  };
  const payload = {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    saveSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
    applicationVersion: input.applicationVersion ?? "0.0.0",
    id: input.id,
    createdAt: input.createdAt ?? EPOCH,
    updatedAt: input.updatedAt ?? input.createdAt ?? EPOCH,
    park: { tick: session.world.tick, day: session.operations.day, seed: session.world.seed },
    contentManifest: clonePortable(input.contentManifest),
    sections,
    completionMarker: PERSISTENCE_COMPLETION_MARKER,
  } as const;
  const envelope = {
    ...payload,
    integrity: {
      algorithm: PERSISTENCE_FINGERPRINT_ALGORITHM,
      fingerprint: fingerprintSaveData(payload),
    },
  };
  return freezePortable(envelope);
};

export const validateSaveEnvelope = (
  input: unknown,
  options: SaveValidationOptionsLike = {},
): PersistenceValidationResult<SaveEnvelope> => {
  const portable = validatePortableData(input);
  if (!portable.ok) return { ok: false, diagnostics: portable.diagnostics.map((entry) => ({ ...entry, code: "PERSISTENCE_PORTABLE_DATA_INVALID" })) };
  const parsed = saveEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    const schemaUnsupported = parsed.error.issues.some((issue) => issue.path.includes("schemaVersion") || issue.path.includes("saveSchemaVersion"));
    return {
      ok: false,
      diagnostics: uniqueSortedDiagnostics(parsed.error.issues.map((issue) => diagnostic(
        issue.path.includes("completionMarker")
          ? "PERSISTENCE_COMPLETION_MISSING"
          : schemaUnsupported ? "PERSISTENCE_SCHEMA_UNSUPPORTED" : "PERSISTENCE_ENVELOPE_INVALID",
        issue.path.join(".") || "$",
        "save envelope schema",
        issue.message,
      ))),
    };
  }
  const envelope = parsed.data as unknown as SaveEnvelope;
  const diagnostics: PersistenceDiagnostic[] = [];
  if (envelope.completionMarker !== PERSISTENCE_COMPLETION_MARKER) diagnostics.push(diagnostic("PERSISTENCE_COMPLETION_MISSING", "completionMarker", "complete save marker", "Save completion marker is missing."));
  const manifestDiagnostics = validateContentManifest(envelope.contentManifest, sessionFromEnvelope(envelope), options);
  diagnostics.push(...manifestDiagnostics);
  const sectionResults = persistenceSectionsSchema.safeParse(envelope.sections);
  if (!sectionResults.success) diagnostics.push(...sectionResults.error.issues.map((issue) => diagnostic("PERSISTENCE_SECTION_INVALID", `sections.${issue.path.join(".")}`, "domain section schema", issue.message)));
  const sectionEntries: ReadonlyArray<readonly [string, { readonly data: unknown; readonly fingerprint: string }]> = [
    ["simulation", envelope.sections.simulation],
    ["parkOperations", envelope.sections.parkOperations],
    ["context", envelope.sections.context],
    ["traceReplay", envelope.sections.traceReplay],
    ["preferences", envelope.sections.preferences],
    ...(envelope.sections.mvp === undefined ? [] : [["mvp", envelope.sections.mvp] as const]),
  ];
  for (const [name, entry] of sectionEntries) {
    if (entry.fingerprint !== fingerprintSaveData(entry.data)) diagnostics.push(diagnostic("PERSISTENCE_INTEGRITY_MISMATCH", `sections.${name}.fingerprint`, "canonical domain section fingerprint", `The ${name} section fingerprint does not match its data.`));
  }
  const expectedIntegrity = fingerprintSaveData(payloadWithoutIntegrity(envelope));
  if (envelope.integrity.algorithm !== PERSISTENCE_FINGERPRINT_ALGORITHM || envelope.integrity.fingerprint !== expectedIntegrity) diagnostics.push(diagnostic("PERSISTENCE_INTEGRITY_MISMATCH", "integrity.fingerprint", "canonical save envelope fingerprint", "Save integrity data does not match the complete envelope."));

  const session = sessionFromEnvelope(envelope);
  diagnostics.push(...validateWorld(session.world));
  diagnostics.push(...validateOperations(session.operations));
  diagnostics.push(...validateContext(session.context));
  diagnostics.push(...validateTraces(envelope.sections.traceReplay.data, envelope.contentManifest));
  diagnostics.push(...validatePreferences(session.preferences));
  if (envelope.park.tick !== session.world.tick) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", "park.tick", "world tick authority", "Save logical tick does not match Simulation state."));
  if (envelope.park.day !== session.operations.day) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", "park.day", "Park Operations day authority", "Save logical day does not match Park Operations state."));
  if (envelope.park.seed !== session.world.seed) diagnostics.push(diagnostic("PERSISTENCE_SECTION_INVALID", "park.seed", "Simulation seed authority", "Save seed does not match Simulation state."));
  return diagnostics.length === 0
    ? { ok: true, value: freezePortable(envelope), diagnostics: [] }
    : { ok: false, diagnostics: uniqueSortedDiagnostics(diagnostics) };
};

export const createMemorySessionPort = (initial: PersistenceSession): MemorySessionPort => {
  let current = freezePortable(clonePortable(initial));
  return Object.freeze({
    snapshot: (): PersistenceSession => clonePortable(current),
    current: (): PersistenceSession => clonePortable(current),
    replace: (candidate: PersistenceSession): void => {
      const portable = validatePortableData(candidate);
      if (!portable.ok) throw new TypeError("Cannot replace session with non-portable persistence data.");
      current = freezePortable(clonePortable(candidate));
    },
  });
};

const failure = (diagnostics: readonly PersistenceDiagnostic[]): { readonly ok: false; readonly diagnostics: readonly PersistenceDiagnostic[] } => ({ ok: false, diagnostics: uniqueSortedDiagnostics(diagnostics) });

const asSaveEnvelope = (request: SaveRequest, fallbackApplicationVersion: string, now: () => string, session: PersistenceSession): SaveEnvelope => createSaveEnvelope({
  id: request.id,
  applicationVersion: request.applicationVersion ?? fallbackApplicationVersion,
  createdAt: request.createdAt ?? now(),
  updatedAt: request.updatedAt ?? now(),
  contentManifest: request.contentManifest,
  session,
});

export const createPersistenceCoordinator = (options: PersistenceCoordinatorOptions): PersistenceCoordinator => {
  const now = options.now ?? (() => EPOCH);
  const validateOptions = { contentResolver: options.contentResolver };
  const save = (request: SaveRequest): SaveOperationResult => {
    const session = clonePortable(request.session ?? options.session.snapshot());
    let envelope: SaveEnvelope;
    try {
      envelope = asSaveEnvelope(request, options.applicationVersion ?? "0.0.0", now, session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save envelope construction failed.";
      return failure([diagnostic("PERSISTENCE_ENVELOPE_INVALID", "$", "construct a canonical save envelope", message)]);
    }
    const validation = validateSaveEnvelope(envelope, validateOptions);
    if (!validation.ok) return failure(validation.diagnostics);
    const staged = options.repository.stage(validation.value);
    if (!staged.ok) return failure(staged.diagnostics);
    const promoted = options.repository.promote(validation.value.id);
    if (!promoted.ok) return failure(promoted.diagnostics);
    return { ok: true, envelope: validation.value };
  };
  const load = (id?: string): LoadOperationResult => {
    const envelope = options.repository.read(id);
    if (envelope === undefined) return failure([diagnostic("PERSISTENCE_SAVE_NOT_FOUND", "id", "known-good save exists", id === undefined ? "No known-good save is available." : `Save ${id} was not found.`)]);
    const validation = validateSaveEnvelope(envelope, validateOptions);
    if (!validation.ok) return failure(validation.diagnostics);
    const candidate = sessionFromEnvelope(validation.value);
    try {
      options.session.replace(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Session replacement failed.";
      return failure([diagnostic("PERSISTENCE_SESSION_REPLACEMENT_FAILED", "session", "atomic candidate session replacement", message)]);
    }
    return { ok: true, envelope: validation.value, session: clonePortable(candidate) };
  };
  const replay = (saveId: string, traceId: string, replayOptions: HistoricalReplayOptions = {}): HistoricalReplayResult => {
    const envelope = options.repository.read(saveId);
    if (envelope === undefined) return { ok: false, traceId, diagnostics: [diagnostic("PERSISTENCE_SAVE_NOT_FOUND", "id", "known-good save exists", `Save ${saveId} was not found.`)] };
    const validation = validateSaveEnvelope(envelope, validateOptions);
    if (!validation.ok) return { ok: false, traceId, diagnostics: validation.diagnostics };
    const trace = validation.value.sections.traceReplay.data.traces.find((entry) => entry.id === traceId);
    if (trace === undefined) return { ok: false, traceId, diagnostics: [diagnostic("PERSISTENCE_REPLAY_INVALID", "traceId", "saved historical trace exists", `Trace ${traceId} was not found in save ${saveId}.`)] };
    const availableContent = replayOptions.availableContent ?? validation.value.contentManifest.references;
    const verification = verifyTraceRerun(trace, {
      availableContent,
      ...(replayOptions.resolver === undefined ? {} : { registry: replayOptions.resolver }),
    });
    if (verification.status !== "equivalent") {
      return { ok: false, traceId, verification, diagnostics: [diagnostic("PERSISTENCE_REPLAY_INVALID", "traceReplay", "historical replay equivalence", `Historical replay for ${traceId} returned ${verification.status}.`)] };
    }
    return { ok: true, traceId, verification, diagnostics: [] };
  };
  return Object.freeze({ save, load, replay });
};

export const createDefaultInMemoryPersistence = (session: PersistenceSession, options: Omit<PersistenceCoordinatorOptions, "repository" | "session"> = {}): {
  readonly coordinator: PersistenceCoordinator;
  readonly repository: ReturnType<typeof createInMemorySaveRepository>;
  readonly session: PersistenceSessionPort;
} => {
  const repository = createInMemorySaveRepository();
  const sessionPort = createMemorySessionPort(session);
  return { repository, session: sessionPort, coordinator: createPersistenceCoordinator({ ...options, repository, session: sessionPort }) };
};

/** Stable alias for callers that describe this operation as manual save/load. */
export const createManualPersistence = createPersistenceCoordinator;

/** Keep the canonical serializer visible to persistence contract tests. */
export { canonicalSaveSerialize };
