import { deepClone, stableHash } from "./canonical.ts";
import type { FeatureStateAdapter, FeatureStatePort, StandardAdapterSet, StandardPersistencePorts, StateDiagnostic, ValidationResult } from "./types.ts";

/* Feature adapters are intentionally heterogeneous at this coordination
 * boundary; `any` is the type-erasure mechanism for independently owned state. */
/* eslint-disable @typescript-eslint/no-explicit-any */

function validObject(value: unknown, id: string): ValidationResult<unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: [{ code: "INVALID_TYPE", path: "$", message: `Feature ${id} state must be an object.` }] };
  return { ok: true, value: deepClone(value) };
}

function adapter<T>(input: FeatureStateAdapter<T>): FeatureStateAdapter<T> { return Object.freeze(input); }

/** Wrap a state-owning feature's public versioned port without inspecting its
 * domain model. A save-only port can still export safely, but load reports the
 * restore failure instead of silently dropping state. */
export function createNamedStateAdapter(id: string, port: FeatureStatePort): FeatureStateAdapter<any> {
  return adapter({
    id,
    schemaVersion: port.schemaVersion ?? 1,
    snapshot: () => deepClone(port.snapshot()),
    validate: (value) => port.validate ? port.validate(value) : (value === null || typeof value !== "object" ? { ok: false, error: [{ code: "INVALID_TYPE", path: "$", message: `Feature ${id} state must be an object.` }] } : { ok: true, value: deepClone(value) }),
    restore: (value) => { if (!port.restore) throw new Error(`Feature ${id} does not expose a restore port.`); port.restore(deepClone(value)); },
    canonicalHash: (value) => port.canonicalHash?.(value) ?? stableHash(value),
    ...(port.references ? { references: (value: unknown) => [...port.references!(value)].sort() } : {}),
  });
}

export const createEconomyStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("economy", port);
export const createProgressStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("progression", port);
export const createAgentOperationsStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("agents", port);
export const createJobsIncidentsStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("operations", port);
export const createContextStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("context", port);
export const createEvalStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("evals", port);
export const createReviewDeploymentStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("deployments", port);
export const createCurriculumStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("curriculum", port);
export const createOrchestrationStateAdapter = (port: FeatureStatePort) => createNamedStateAdapter("orchestration", port);

export function createStateAdapter<T>(input: Omit<FeatureStateAdapter<T>, "canonicalHash"> & { readonly canonicalHash?: (value: T) => string }): FeatureStateAdapter<T> {
  return adapter({ ...input, canonicalHash: input.canonicalHash ?? ((value) => stableHash(value)) });
}

export function createSimulationStateAdapter(simulation: NonNullable<StandardPersistencePorts["simulation"]>): FeatureStateAdapter<ReturnType<typeof simulation.snapshot>> {
  return adapter({ id: "simulation", schemaVersion: 1, snapshot: () => deepClone(simulation.snapshot()), validate: (value) => {
    const required = validObject(value, "simulation"); if (!required.ok) return required as ValidationResult<ReturnType<typeof simulation.snapshot>>;
    const candidate = required.value as ReturnType<typeof simulation.snapshot>;
    const errors: StateDiagnostic[] = [];
    for (const key of ["fixtureId", "logicalTime", "seed", "prngState", "zones", "enclosures", "gates", "dinosaurs", "agents", "visitors", "devices", "incidents", "jobs", "routes", "pendingEvents", "resourceReservations", "eventSequence"] as const) if (!(key in candidate)) errors.push({ code: "MISSING_FIELD", path: key, message: `Simulation snapshot is missing ${key}.` });
    return errors.length ? { ok: false, error: errors } : { ok: true, value: deepClone(candidate) };
  }, restore: (value) => { const result = simulation.restore(deepClone(value)); if (!result.ok) throw new Error(`Simulation restore failed: ${result.error.map((item) => item.path).join(", ")}`); }, canonicalHash: (value) => stableHash(value) });
}

export function createContentRegistryStateAdapter(registry: NonNullable<StandardPersistencePorts["registry"]>): FeatureStateAdapter<any> {
  return adapter({ id: "content-registry", schemaVersion: 1, snapshot: () => deepClone({ manifest: registry.manifest(), lifecycle: registry.checkpointLifecycle() }), validate: (value) => {
    const valid = validObject(value, "content-registry"); if (!valid.ok) return valid;
    const candidate = valid.value as { manifest?: unknown; lifecycle?: unknown };
    if (!candidate.manifest || !candidate.lifecycle) return { ok: false, error: [{ code: "MISSING_FIELD", path: "$", message: "Content registry save requires manifest and lifecycle selectors." }] };
    return { ok: true, value: deepClone(candidate) };
  }, restore: (value) => {
    const candidate = value as { lifecycle: Parameters<NonNullable<typeof registry["restoreLifecycle"]>>[0] };
    registry.restoreLifecycle(candidate.lifecycle);
  }, canonicalHash: (value) => stableHash(value), references: (value) => {
    const refs = new Set<string>(); const manifest = (value as { manifest?: { artifacts?: readonly { artifactId: string; version: number }[] } }).manifest;
    for (const artifact of manifest?.artifacts ?? []) refs.add(`${artifact.artifactId}@${artifact.version}`);
    return [...refs].sort();
  } });
}

export function createMemoryStateAdapter(port: NonNullable<StandardPersistencePorts["memory"]>): FeatureStateAdapter<readonly any[]> {
  const repository = ("repository" in port && typeof port.repository === "function" ? port.repository() : port) as { readonly list: () => readonly any[]; readonly put: (record: any) => void; readonly replace: (records: readonly any[]) => void };
  return adapter({ id: "memory", schemaVersion: 1, snapshot: () => deepClone(repository.list()), validate: (value) => Array.isArray(value) ? { ok: true, value: deepClone(value) } : { ok: false, error: [{ code: "INVALID_TYPE", path: "$", message: "Memory state must be a record array." }] }, restore: (value) => repository.replace(deepClone(value) as never), canonicalHash: (value) => stableHash(value) });
}

export function createReviewStateAdapter(reviews: NonNullable<StandardPersistencePorts["reviews"]>): FeatureStateAdapter<ReturnType<typeof reviews.checkpoint>> {
  return adapter({ id: "reviews", schemaVersion: 1, snapshot: () => deepClone(reviews.checkpoint()), validate: (value) => { const valid = validObject(value, "reviews"); return valid as ValidationResult<ReturnType<typeof reviews.checkpoint>>; }, restore: (value) => reviews.restore(deepClone(value)), canonicalHash: (value) => stableHash(value), references: (value) => (value as { records?: readonly { proposedRef?: { artifactId: string; version: number }; baseRef?: { artifactId: string; version: number } }[] }).records?.flatMap((record) => [record.baseRef, record.proposedRef].filter(Boolean).map((ref) => `${ref!.artifactId}@${ref!.version}`)) ?? [] });
}

export function createTraceStateAdapter(traces: NonNullable<StandardPersistencePorts["traces"]>): FeatureStateAdapter<readonly any[]> {
  return adapter({ id: "traces", schemaVersion: 1, snapshot: () => deepClone(traces.records()), validate: (value) => Array.isArray(value) ? { ok: true, value: deepClone(value) } : { ok: false, error: [{ code: "INVALID_TYPE", path: "$", message: "Trace state must be a record array." }] }, restore: (value) => traces.replace(deepClone(value) as never), canonicalHash: (value) => stableHash(value), references: (value) => (value as readonly { header?: { artifactRefs?: readonly { artifactId: string; version: number }[] } }[]).flatMap((record) => record.header?.artifactRefs?.map((ref) => `${ref.artifactId}@${ref.version}`) ?? []) });
}

export function createStandardAdapterSet(ports: StandardPersistencePorts): StandardAdapterSet {
  const adapters: FeatureStateAdapter<any>[] = [
    ...(ports.simulation ? [createSimulationStateAdapter(ports.simulation)] : []),
    ...(ports.registry ? [createContentRegistryStateAdapter(ports.registry)] : []),
    ...(ports.memory ? [createMemoryStateAdapter(ports.memory)] : []),
    ...(ports.reviews ? [createReviewStateAdapter(ports.reviews)] : []),
    ...(ports.traces ? [createTraceStateAdapter(ports.traces)] : []),
    ...(ports.economy ? [createEconomyStateAdapter(ports.economy)] : []),
    ...(ports.operations ? [createJobsIncidentsStateAdapter(ports.operations)] : []),
    ...(ports.context ? [createContextStateAdapter(ports.context)] : []),
    ...(ports.evals ? [createEvalStateAdapter(ports.evals)] : []),
    ...(ports.deployments ? [createReviewDeploymentStateAdapter(ports.deployments)] : []),
    ...(ports.curriculum ? [createCurriculumStateAdapter(ports.curriculum)] : []),
    ...(ports.orchestration ? [createOrchestrationStateAdapter(ports.orchestration)] : []),
    ...Object.entries(ports.featureStatePorts ?? {}).map(([id, port]) => createNamedStateAdapter(id, port)),
    ...(ports.custom ?? []),
  ];
  const unique = [...new Map(adapters.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
  return Object.freeze({ adapters: Object.freeze(unique), byId: new Map(unique.map((item) => [item.id, item])) });
}

export const registerStandardAdapters = createStandardAdapterSet;
