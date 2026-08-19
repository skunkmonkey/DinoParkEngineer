import { fingerprint, fingerprintCatalogPackage } from "./canonical.js";
import { catalogPackageSchema, contentRecordEnvelopeSchema, createContentClassSchemaCatalog } from "./schemas.js";
import type {
  CatalogPackage, ContentAvailability, ContentClassDefinition, ContentRecord, ContentReference,
  ContentRegistry, LoadedPackage, PackageLoadResult, RegistryDiagnostic, RegistryInspectionProjection,
  RegistryResolutionResult,
} from "./types.js";

const keyOf = (id: string, version: string): string => `${id}\u0000${version}`;
const refLabel = (reference: Pick<ContentReference, "id" | "version">): string => `${reference.id}@${reference.version}`;
const compareRecords = (left: ContentRecord, right: ContentRecord): number =>
  left.id < right.id ? -1 : left.id > right.id ? 1 : left.version < right.version ? -1 : left.version > right.version ? 1 : 0;
const compareDiagnostics = (left: RegistryDiagnostic, right: RegistryDiagnostic): number =>
  [left.packageId, left.source, left.record ?? "", left.field, left.code, left.message].join("\u0000")
    .localeCompare([right.packageId, right.source, right.record ?? "", right.field, right.code, right.message].join("\u0000"), "en", { sensitivity: "variant" });

const cloneFreeze = <T>(value: T): T => {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFreeze)) as T;
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = cloneFreeze(entry);
    return Object.freeze(result) as T;
  }
  return value;
};

const isSerializableData = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isSerializableData);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([, entry]) => entry !== undefined && isSerializableData(entry));
};

const diagnostic = (
  code: RegistryDiagnostic["code"], packageId: string, source: string, field: string, rule: string,
  message: string, record?: string,
): RegistryDiagnostic => Object.freeze({ code, packageId, source, field, rule, message, ...(record === undefined ? {} : { record }) });

const zodDiagnostics = (packageId: string, source: string, record: string | undefined, issues: readonly { path: PropertyKey[]; message: string }[]): RegistryDiagnostic[] =>
  issues.map((issue) => diagnostic(
    record === undefined ? "REGISTRY_PACKAGE_VALIDATION_FAILED" : "REGISTRY_RECORD_VALIDATION_FAILED",
    packageId, source, issue.path.map(String).join(".") || "$", "zod", issue.message, record,
  ));

const validatePackage = (
  value: unknown,
  expectedSchema: string,
  schemas: ReturnType<typeof createContentClassSchemaCatalog>,
  existing: ReadonlyMap<string, ContentRecord>,
): { package?: CatalogPackage; records?: readonly ContentRecord[]; diagnostics: RegistryDiagnostic[] } => {
  const parsedPackage = catalogPackageSchema.safeParse(value);
  if (!parsedPackage.success) return { diagnostics: zodDiagnostics("unknown", "package", undefined, parsedPackage.error.issues) };
  const pkg = parsedPackage.data as CatalogPackage;
  const source = `${pkg.packageId}@${pkg.packageVersion}`;
  const diagnostics: RegistryDiagnostic[] = [];
  if (pkg.registrySchemaVersion !== expectedSchema) diagnostics.push(diagnostic("REGISTRY_PACKAGE_SCHEMA_INCOMPATIBLE", pkg.packageId, source, "registrySchemaVersion", "exact registry schema", `Expected ${expectedSchema}, received ${pkg.registrySchemaVersion}.`));
  const unsigned: Omit<CatalogPackage, "fingerprint"> = {
    packageId: pkg.packageId,
    packageVersion: pkg.packageVersion,
    registrySchemaVersion: pkg.registrySchemaVersion,
    requirement: pkg.requirement,
    entries: pkg.entries,
  };
  const calculated = fingerprintCatalogPackage(unsigned);
  if (calculated !== pkg.fingerprint) diagnostics.push(diagnostic("REGISTRY_PACKAGE_FINGERPRINT_MISMATCH", pkg.packageId, source, "fingerprint", "canonical package fingerprint", `Expected ${calculated}, received ${pkg.fingerprint}.`));

  const records: ContentRecord[] = [];
  for (const [index, entry] of pkg.entries.entries()) {
    const parsed = contentRecordEnvelopeSchema.safeParse(entry);
    if (!parsed.success) {
      diagnostics.push(...zodDiagnostics(pkg.packageId, source, `entries[${index}]`, parsed.error.issues));
      continue;
    }
    const record = parsed.data as ContentRecord;
    const label = refLabel(record);
    const classSchema = schemas.get(record.class, record.schemaVersion);
    if (classSchema === undefined) diagnostics.push(diagnostic("REGISTRY_CLASS_SCHEMA_MISSING", pkg.packageId, source, "class", "registered class and schema version", `No schema is registered for ${record.class}@${record.schemaVersion}.`, label));
    else {
      const data = classSchema.safeParse(record.data);
      if (!data.success) diagnostics.push(...zodDiagnostics(pkg.packageId, source, label, data.error.issues.map((issue) => ({ ...issue, path: ["data", ...issue.path] }))));
      else if (!isSerializableData(data.data)) diagnostics.push(diagnostic("REGISTRY_RECORD_VALIDATION_FAILED", pkg.packageId, source, "data", "plain serializable data", "Class data must contain only finite JSON-compatible values.", label));
    }
    const sortedTags = [...record.tags].sort();
    if (new Set(record.tags).size !== record.tags.length || record.tags.some((tag, tagIndex) => tag !== sortedTags[tagIndex])) diagnostics.push(diagnostic("REGISTRY_RECORD_VALIDATION_FAILED", pkg.packageId, source, "tags", "unique lexical order", "Tags must be unique and lexically ordered.", label));
    const depKeys = record.dependencies.map((dependency) => refLabel(dependency));
    const sortedDeps = [...depKeys].sort();
    if (new Set(depKeys).size !== depKeys.length) diagnostics.push(diagnostic("REGISTRY_DEPENDENCY_DUPLICATE", pkg.packageId, source, "dependencies", "unique exact references", "Dependencies must not contain duplicate exact references.", label));
    if (depKeys.some((dep, depIndex) => dep !== sortedDeps[depIndex])) diagnostics.push(diagnostic("REGISTRY_RECORD_VALIDATION_FAILED", pkg.packageId, source, "dependencies", "lexical order", "Dependencies must be lexically ordered by exact reference.", label));
    if (depKeys.includes(label)) diagnostics.push(diagnostic("REGISTRY_DEPENDENCY_SELF", pkg.packageId, source, "dependencies", "no self dependency", `${label} cannot depend on itself.`, label));
    records.push(cloneFreeze(record));
  }

  const combined = new Map(existing);
  const identities = new Map<string, string>();
  for (const key of existing.keys()) identities.set(key.toLocaleLowerCase("en-US"), key);
  const paths = new Map<string, string>();
  for (const record of existing.values()) paths.set(record.provenance.path.toLocaleLowerCase("en-US"), record.provenance.path);
  for (const record of records) {
    const key = keyOf(record.id, record.version);
    if (combined.has(key)) diagnostics.push(diagnostic("REGISTRY_IDENTITY_DUPLICATE", pkg.packageId, source, "id/version", "append-only unique version", `${refLabel(record)} is already registered.`, refLabel(record)));
    const priorCase = identities.get(key.toLocaleLowerCase("en-US"));
    if (priorCase !== undefined && priorCase !== key) diagnostics.push(diagnostic("REGISTRY_CASE_COLLISION", pkg.packageId, source, "id/version", "case-distinct portable identity", `${refLabel(record)} collides by case with ${priorCase.replace("\u0000", "@")}.`, refLabel(record)));
    identities.set(key.toLocaleLowerCase("en-US"), key);
    const priorPath = paths.get(record.provenance.path.toLocaleLowerCase("en-US"));
    if (priorPath !== undefined && priorPath !== record.provenance.path) diagnostics.push(diagnostic("REGISTRY_PATH_CASE_COLLISION", pkg.packageId, source, "provenance.path", "case-consistent path", `${record.provenance.path} collides by case with ${priorPath}.`, refLabel(record)));
    paths.set(record.provenance.path.toLocaleLowerCase("en-US"), record.provenance.path);
    combined.set(key, record);
  }

  for (const record of records) {
    const versions = new Map<string, string>();
    for (const dependency of record.dependencies) {
      const prior = versions.get(dependency.id);
      if (prior !== undefined && prior !== dependency.version) diagnostics.push(diagnostic("REGISTRY_DEPENDENCY_CONFLICT", pkg.packageId, source, "dependencies", "one exact version per identity", `${record.id} requires conflicting versions ${prior} and ${dependency.version} of ${dependency.id}.`, refLabel(record)));
      versions.set(dependency.id, dependency.version);
      const target = combined.get(keyOf(dependency.id, dependency.version));
      if (target === undefined) diagnostics.push(diagnostic("REGISTRY_DEPENDENCY_MISSING", pkg.packageId, source, "dependencies", "exact dependency exists", `Missing ${refLabel(dependency)} required by ${refLabel(record)}.`, refLabel(record)));
      else if ((dependency.expectedClass !== undefined && dependency.expectedClass !== target.class) || (dependency.expectedSchemaVersion !== undefined && dependency.expectedSchemaVersion !== target.schemaVersion)) diagnostics.push(diagnostic("REGISTRY_DEPENDENCY_INCOMPATIBLE", pkg.packageId, source, "dependencies", "compatible exact dependency", `${refLabel(dependency)} is incompatible with the declared class or schema.`, refLabel(record)));
    }
  }
  diagnostics.push(...detectGraphProblems(combined, pkg.packageId, source, records));
  return { package: pkg, records, diagnostics: diagnostics.sort(compareDiagnostics) };
};

const detectGraphProblems = (records: ReadonlyMap<string, ContentRecord>, packageId: string, source: string, roots: readonly ContentRecord[]): RegistryDiagnostic[] => {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const found = new Set<string>();
  const output: RegistryDiagnostic[] = [];
  const visit = (record: ContentRecord): void => {
    const key = keyOf(record.id, record.version);
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      const cycle = [...stack.slice(start), key].map((entry) => entry.replace("\u0000", "@")).join(" -> ");
      if (!found.has(cycle)) {
        found.add(cycle);
        output.push(diagnostic("REGISTRY_DEPENDENCY_CYCLE", packageId, source, "dependencies", "acyclic dependency graph", `Dependency cycle: ${cycle}.`, refLabel(record)));
      }
      return;
    }
    visiting.add(key); stack.push(key);
    for (const dependency of [...record.dependencies].sort((left, right) => refLabel(left).localeCompare(refLabel(right), "en", { sensitivity: "variant" }))) {
      const target = records.get(keyOf(dependency.id, dependency.version));
      if (target !== undefined) visit(target);
    }
    stack.pop(); visiting.delete(key); visited.add(key);
  };
  for (const root of [...roots].sort(compareRecords)) visit(root);
  for (const root of [...roots].sort(compareRecords)) {
    const selected = new Map<string, string>();
    const walked = new Set<string>();
    const inspect = (record: ContentRecord): void => {
      const recordKey = keyOf(record.id, record.version);
      if (walked.has(recordKey)) return;
      walked.add(recordKey);
      for (const dependency of record.dependencies) {
        const prior = selected.get(dependency.id);
        if (prior !== undefined && prior !== dependency.version) {
          output.push(diagnostic("REGISTRY_DEPENDENCY_CONFLICT", packageId, source, "dependencies", "one transitive exact version per identity", `${refLabel(root)} transitively requires both ${dependency.id}@${prior} and ${refLabel(dependency)}.`, refLabel(root)));
        } else selected.set(dependency.id, dependency.version);
        const target = records.get(keyOf(dependency.id, dependency.version));
        if (target !== undefined) inspect(target);
      }
    };
    inspect(root);
  }
  return output;
};

class ImmutableContentRegistry implements ContentRegistry {
  readonly packages: readonly LoadedPackage[];
  constructor(
    readonly registrySchemaVersion: string,
    private readonly schemas: ReturnType<typeof createContentClassSchemaCatalog>,
    private readonly records: ReadonlyMap<string, ContentRecord> = new Map(),
    packages: readonly LoadedPackage[] = [],
  ) { this.packages = cloneFreeze([...packages].sort((left, right) => `${left.packageId}@${left.packageVersion}`.localeCompare(`${right.packageId}@${right.packageVersion}`, "en", { sensitivity: "variant" }))); }

  loadPackages(values: readonly unknown[]): PackageLoadResult {
    const records = new Map(this.records);
    const packages = [...this.packages];
    const diagnostics: RegistryDiagnostic[] = [];
    let blocked = false;
    const packageIdentities = new Map(this.packages.map((pkg) => [keyOf(pkg.packageId, pkg.packageVersion).toLocaleLowerCase("en-US"), keyOf(pkg.packageId, pkg.packageVersion)]));
    for (const value of values) {
      const result = validatePackage(value, this.registrySchemaVersion, this.schemas, records);
      const requirement = result.package?.requirement ?? ((value !== null && typeof value === "object" && "requirement" in value && value.requirement === "optional") ? "optional" : "required");
      if (result.package !== undefined) {
        const packageKey = keyOf(result.package.packageId, result.package.packageVersion);
        const prior = packageIdentities.get(packageKey.toLocaleLowerCase("en-US"));
        if (prior !== undefined) result.diagnostics.push(diagnostic(prior === packageKey ? "REGISTRY_IDENTITY_DUPLICATE" : "REGISTRY_CASE_COLLISION", result.package.packageId, `${result.package.packageId}@${result.package.packageVersion}`, "packageId/packageVersion", "unique package identity", `${result.package.packageId}@${result.package.packageVersion} collides with an already loaded package.`));
        result.diagnostics.sort(compareDiagnostics);
      }
      if (result.diagnostics.length > 0 || result.package === undefined || result.records === undefined) {
        diagnostics.push(...result.diagnostics);
        if (requirement === "required") blocked = true;
        continue;
      }
      const loadedPackageKey = keyOf(result.package.packageId, result.package.packageVersion);
      packageIdentities.set(loadedPackageKey.toLocaleLowerCase("en-US"), loadedPackageKey);
      for (const record of result.records) records.set(keyOf(record.id, record.version), record);
      packages.push(cloneFreeze({ packageId: result.package.packageId, packageVersion: result.package.packageVersion, requirement, fingerprint: result.package.fingerprint }));
    }
    if (blocked) return { status: "blocked", registry: this, diagnostics: cloneFreeze(diagnostics.sort(compareDiagnostics)) };
    return { status: "ready", registry: new ImmutableContentRegistry(this.registrySchemaVersion, this.schemas, records, packages), diagnostics: cloneFreeze(diagnostics.sort(compareDiagnostics)) };
  }

  getExact(id: string, version: string): ContentRecord | undefined { return this.records.get(keyOf(id, version)); }
  resolveExact(id: string, version: string): RegistryResolutionResult {
    const root = this.getExact(id, version);
    if (root === undefined) return { ok: false, diagnostics: [diagnostic("REGISTRY_DEPENDENCY_MISSING", "registry", "resolution", "root", "exact root exists", `Missing exact root ${id}@${version}.`, `${id}@${version}`)] };
    const ordered: ContentRecord[] = []; const visited = new Set<string>();
    const visit = (record: ContentRecord): void => {
      for (const dependency of [...record.dependencies].sort((left, right) => refLabel(left).localeCompare(refLabel(right), "en", { sensitivity: "variant" }))) {
        const target = this.records.get(keyOf(dependency.id, dependency.version));
        if (target !== undefined && !visited.has(keyOf(target.id, target.version))) { visit(target); visited.add(keyOf(target.id, target.version)); ordered.push(target); }
      }
    };
    visit(root);
    const schemaVersions = [root, ...ordered].map((record) => ({ id: record.id, version: record.version, schemaVersion: record.schemaVersion }));
    const manifestBase = { root, dependencies: ordered, schemaVersions };
    return { ok: true, manifest: cloneFreeze({ ...manifestBase, fingerprint: fingerprint(manifestBase) }) };
  }
  private query(predicate: (record: ContentRecord) => boolean): readonly ContentRecord[] { return Object.freeze([...this.records.values()].filter(predicate).sort(compareRecords)); }
  queryByClass(contentClass: string): readonly ContentRecord[] { return this.query((record) => record.class === contentClass); }
  queryByTag(tag: string): readonly ContentRecord[] { return this.query((record) => record.tags.includes(tag)); }
  queryByDependency(reference: ContentReference): readonly ContentRecord[] { return this.query((record) => record.dependencies.some((dependency) => dependency.id === reference.id && dependency.version === reference.version)); }
  queryByAvailability(availability: ContentAvailability): readonly ContentRecord[] { return this.query((record) => record.availability === availability); }
  history(id: string): readonly ContentRecord[] { return this.query((record) => record.id === id); }
  inspect(id: string, version: string): RegistryInspectionProjection | undefined {
    const record = this.getExact(id, version); if (record === undefined) return undefined;
    return cloneFreeze({ identity: record.id, contentClass: record.class, version: record.version, schemaVersion: record.schemaVersion, displayName: record.displayName, author: record.author, dependencies: record.dependencies.map(refLabel), contextCost: record.contextCost, sourceProvenance: `${record.provenance.source}:${record.provenance.path}`, availability: record.availability, ...(record.readableSource === undefined ? {} : { readableSource: record.readableSource }) });
  }
}

export const createContentRegistry = (options: { readonly registrySchemaVersion: string; readonly classDefinitions: readonly ContentClassDefinition[] }): ContentRegistry =>
  new ImmutableContentRegistry(options.registrySchemaVersion, createContentClassSchemaCatalog(options.classDefinitions));
