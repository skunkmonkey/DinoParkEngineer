import { canonicalSerialize, createSimulationEngine, deepClone, deepFreeze } from "../simulation/index.ts";
import type { ExecutionUpdate } from "../instruction/index.ts";
import { createInstructionEngine } from "../instruction/index.ts";
import { firstCanonicalDifference, snapshotHash, stableHash } from "./canonical.ts";
import { createTraceRepository } from "./recorder.ts";
import type {
  ReplayControls,
  ReplayDifference,
  ReplayManifest,
  ReplayPorts,
  ReplayResult,
  ReplayService,
  TraceEventRecord,
  TraceRecord,
  ReplayManifest as ReplayManifestType,
} from "./types.ts";
import type { SimulationEngine, WorldEvent } from "../simulation/index.ts";
import type { ArtifactRef } from "../content-registry/index.ts";
import type { ContextRequest, ContextResult, ContextSnapshot } from "../context/index.ts";

function unavailable(code: string, message: string): ReplayResult {
  return { status: "UNAVAILABLE", unavailableReason: `${code}: ${message}`, firstDifference: { kind: "INPUT", code, message }, isolated: true };
}

function schemaUnavailable(code: string, message: string): ReplayResult {
  return { status: "UNAVAILABLE", unavailableReason: `${code}: ${message}`, firstDifference: { kind: "SCHEMA", code, message }, isolated: true };
}

function compare(expected: unknown, actual: unknown, kind: ReplayDifference["kind"], message: string): ReplayDifference | undefined {
  const difference = firstCanonicalDifference(expected, actual);
  if (!difference) return undefined;
  return {
    kind,
    ...(difference.index === undefined ? {} : { index: difference.index }),
    field: difference.field,
    expected: difference.expected,
    actual: difference.actual,
    message: `${message}: first difference at ${difference.field}`,
  };
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function stableRefs(refs: readonly ArtifactRef[]): readonly ArtifactRef[] {
  const byKey = new Map(refs.map((ref) => [refKey(ref), ref]));
  return [...byKey.values()].sort((a, b) => refKey(a) < refKey(b) ? -1 : refKey(a) > refKey(b) ? 1 : 0);
}

function rootArtifactRefs(manifest: ReplayManifest): readonly ArtifactRef[] {
  const job = manifest.job;
  const agent = manifest.agentDefinition;
  return stableRefs([
    ...(job?.promptRef ? [job.promptRef] : []),
    ...(job?.skillRefs ?? []),
    ...(job?.systemPromptRefs ?? []),
    ...(job?.managerDirectiveRefs ?? []),
    ...(agent?.skillRefs ?? []),
    ...(agent?.systemPromptRefs ?? []),
  ]);
}

function sameRefSet(a: readonly ArtifactRef[], b: readonly ArtifactRef[]): boolean {
  return canonicalSerialize(stableRefs(a)) === canonicalSerialize(stableRefs(b));
}

type ParsedBaselines = {
  readonly world?: readonly WorldEvent[];
  readonly trace?: readonly TraceEventRecord[];
};

function isReplayResult(value: unknown): value is ReplayResult {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "status" in value;
}

function parseCanonicalArray<T>(text: string, code: string, label: string): readonly T[] | ReplayResult {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return unavailable(code, `${label} must decode to an array`);
    return parsed as readonly T[];
  } catch {
    return unavailable(code, `${label} is not valid canonical JSON`);
  }
}

function parseBaselines(manifest: ReplayManifest): ParsedBaselines | ReplayResult {
  let world = manifest.expectedEvents;
  let trace = manifest.expectedTraceEvents;
  if (manifest.expectedEventCanonical !== undefined) {
    const parsed = parseCanonicalArray<WorldEvent>(manifest.expectedEventCanonical, "MALFORMED_EXPECTED_EVENTS", "expectedEventCanonical");
    if (isReplayResult(parsed)) return parsed;
    if (world && canonicalSerialize(world) !== canonicalSerialize(parsed)) return unavailable("CONFLICTING_EXPECTED_EVENTS", "expectedEvents and expectedEventCanonical disagree");
    world = parsed;
  }
  if (manifest.expectedTraceCanonical !== undefined) {
    const parsed = parseCanonicalArray<TraceEventRecord>(manifest.expectedTraceCanonical, "MALFORMED_EXPECTED_TRACE", "expectedTraceCanonical");
    if (isReplayResult(parsed)) return parsed;
    if (trace && canonicalSerialize(trace) !== canonicalSerialize(parsed)) return unavailable("CONFLICTING_EXPECTED_TRACE", "expectedTraceEvents and expectedTraceCanonical disagree");
    trace = parsed;
  }
  return { ...(world ? { world } : {}), ...(trace ? { trace } : {}) };
}

function replayEventRecords(update: ExecutionUpdate): readonly TraceEventRecord[] {
  const repository = createTraceRepository();
  const traceId = repository.begin({
    traceId: "replay.normalization",
    executionId: update.executionId,
    jobId: update.jobId,
    startLogicalTime: 0,
    schemaVersion: 1,
  });
  // Instruction provenance already contains observable WORLD_EVENT records.
  // Keep the explicit world event stream for command-stream replays only; this
  // avoids duplicating upstream facts in an instruction trace.
  for (const event of update.provenance) repository.append(traceId, event);
  const record = repository.get(traceId);
  return record?.events ?? Object.freeze([]);
}

function commandStreamRun(manifest: ReplayManifest, simulation: SimulationEngine): readonly WorldEvent[] | ReplayResult {
  const fixture = manifest.fixture;
  if (!fixture) return unavailable("MISSING_FIXTURE", "replay manifest does not contain an immutable fixture");
  const loaded = simulation.load(deepClone(fixture), manifest.seed);
  if (!loaded.ok) return unavailable("INVALID_FIXTURE", loaded.error.map((error) => `${error.code}:${error.path}`).join(", "));
  for (const command of manifest.commandStream ?? []) {
    const result = simulation.command(deepClone(command));
    if (!result.ok) {
      // Command failures are authoritative events only when the engine accepts
      // and schedules a command. A rejected input means history is unavailable,
      // not a reason to substitute another command.
      return unavailable("COMMAND_REJECTED", `${command.commandId}: ${result.code}`);
    }
  }
  const pending = simulation.pendingEvents();
  const target = manifest.untilLogicalTime ?? Math.max(simulation.snapshot().logicalTime, ...pending.map((event) => event.logicalTime), 0);
  simulation.advanceTo(target);
  return simulation.events();
}

function validatePinnedInputs(manifest: ReplayManifest, ports: ReplayPorts): ReplayResult | undefined {
  if (!Number.isInteger(manifest.schemaVersion)) return schemaUnavailable("INVALID_REPLAY_SCHEMA", "manifest schemaVersion must be an integer");
  if (manifest.schemaVersion !== 1) return schemaUnavailable("UNSUPPORTED_REPLAY_SCHEMA", `manifest schema ${manifest.schemaVersion} is not supported`);
  if (!Number.isFinite(manifest.seed)) return unavailable("INVALID_SEED", "manifest seed is not finite");
  const manifestEngineVersion = manifest.engineSchemaVersion ?? manifest.engineVersion;
  const runtimeEngineVersion = ports.engineSchemaVersion ?? ports.engineVersion;
  const manifestContentVersion = manifest.contentSchemaVersion ?? manifest.contentManifestVersion;
  const runtimeContentVersion = ports.contentSchemaVersion ?? ports.contentManifestVersion;
  const manifestContextVersion = manifest.contextSchemaVersion;
  const runtimeContextVersion = ports.contextSchemaVersion;
  if (manifestEngineVersion !== undefined && runtimeEngineVersion !== undefined && String(manifestEngineVersion) !== String(runtimeEngineVersion)) return schemaUnavailable("ENGINE_VERSION_MISMATCH", `manifest pins ${manifestEngineVersion}, runtime is ${runtimeEngineVersion}`);
  if (manifestContentVersion !== undefined && runtimeContentVersion !== undefined && String(manifestContentVersion) !== String(runtimeContentVersion)) return schemaUnavailable("CONTENT_SCHEMA_MISMATCH", `manifest pins ${manifestContentVersion}, runtime is ${runtimeContentVersion}`);
  if (manifestContextVersion !== undefined && runtimeContextVersion !== undefined && String(manifestContextVersion) !== String(runtimeContextVersion)) return schemaUnavailable("CONTEXT_SCHEMA_MISMATCH", `manifest pins ${manifestContextVersion}, runtime is ${runtimeContextVersion}`);
  if (manifest.artifactRefs && manifest.artifactVersions && !sameRefSet(manifest.artifactRefs, manifest.artifactVersions)) return unavailable("ARTIFACT_MANIFEST_MISMATCH", "artifactRefs and artifactVersions must name the same exact versions");
  const refs = stableRefs(manifest.artifactRefs ?? manifest.artifactVersions ?? []);
  const roots = rootArtifactRefs(manifest);
  if (manifest.job && refs.length === 0 && roots.length > 0) return unavailable("MISSING_ARTIFACT_MANIFEST", "instruction replay must bind job and agent refs in the replay artifact manifest");
  const versionsById = new Map<string, Set<number>>();
  for (const ref of refs) {
    const versions = versionsById.get(ref.artifactId) ?? new Set<number>();
    versions.add(ref.version);
    versionsById.set(ref.artifactId, versions);
  }
  for (const [artifactId, versions] of versionsById) if (versions.size > 1) return unavailable("AMBIGUOUS_ARTIFACT_VERSION", `manifest pins multiple versions of ${artifactId}`);
  for (const root of roots) {
    if (refs.some((ref) => refKey(ref) === refKey(root))) continue;
    const declared = refs.find((ref) => ref.artifactId === root.artifactId);
    if (declared) return unavailable("ARTIFACT_VERSION_MISMATCH", `job pins ${refKey(root)} but replay manifest pins ${refKey(declared)}`);
    return unavailable("MISSING_JOB_ARTIFACT_PIN", `job ref ${refKey(root)} is absent from replay artifact manifest`);
  }
  if (refs.length > 0 && !ports.content) return unavailable("CONTENT_PORT_UNAVAILABLE", "exact artifact refs require a content reader");
  if (ports.content) {
    for (const ref of refs) if (!ports.content.getArtifact(ref)) return unavailable("MISSING_ARTIFACT_VERSION", `exact artifact ${ref.artifactId}@${ref.version} is unavailable; the current version was not substituted`);
  }
  if (manifest.job && (!manifest.agentDefinition || !ports.content || !ports.context || !ports.instructionFactory && !ports.content)) {
    return unavailable("INSTRUCTION_PORTS_UNAVAILABLE", "job replay requires pinned content, context, agent definition, and instruction ports");
  }
  if (manifest.job && manifest.agentDefinition && manifest.job.assignedAgentId !== manifest.agentDefinition.id) return unavailable("AGENT_BINDING_MISMATCH", `job assigns ${manifest.job.assignedAgentId} but replay agent is ${manifest.agentDefinition.id}`);
  const pinnedSnapshot = manifest.contextSnapshot ?? manifest.job?.contextSnapshot;
  if (manifest.contextSnapshot && manifest.job?.contextSnapshot && canonicalSerialize(manifest.contextSnapshot) !== canonicalSerialize(manifest.job.contextSnapshot)) return unavailable("CONTEXT_SNAPSHOT_MISMATCH", "job and replay manifest contain different context snapshots");
  if (pinnedSnapshot) {
    if (manifest.contextSnapshotId && pinnedSnapshot.id !== manifest.contextSnapshotId) return unavailable("CONTEXT_SNAPSHOT_ID_MISMATCH", `manifest pins ${manifest.contextSnapshotId} but snapshot is ${pinnedSnapshot.id}`);
    if (manifest.job?.contextSnapshotId && pinnedSnapshot.id !== manifest.job.contextSnapshotId) return unavailable("CONTEXT_SNAPSHOT_ID_MISMATCH", `job pins ${manifest.job.contextSnapshotId} but snapshot is ${pinnedSnapshot.id}`);
    if (manifest.job && pinnedSnapshot.jobId !== manifest.job.id) return unavailable("CONTEXT_JOB_MISMATCH", `context snapshot belongs to ${pinnedSnapshot.jobId}, not ${manifest.job.id}`);
    if (manifest.agentDefinition && pinnedSnapshot.agentId !== manifest.agentDefinition.id) return unavailable("CONTEXT_AGENT_MISMATCH", `context snapshot belongs to ${pinnedSnapshot.agentId}, not ${manifest.agentDefinition.id}`);
    if (manifest.agentDefinition && pinnedSnapshot.budget !== manifest.agentDefinition.contextBudget) return unavailable("CONTEXT_BUDGET_MISMATCH", `context snapshot budget ${pinnedSnapshot.budget} differs from agent budget ${manifest.agentDefinition.contextBudget}`);
  }
  const policy = manifest.contextPolicyInputs;
  if (policy) {
    if (policy.agentId !== undefined && policy.agentId !== manifest.agentDefinition?.id) return unavailable("CONTEXT_POLICY_AGENT_MISMATCH", "contextPolicyInputs.agentId differs from the pinned agent");
    if (policy.jobId !== undefined && policy.jobId !== manifest.job?.id) return unavailable("CONTEXT_POLICY_JOB_MISMATCH", "contextPolicyInputs.jobId differs from the pinned job");
    if (policy.budget !== undefined && policy.budget !== manifest.agentDefinition?.contextBudget) return unavailable("CONTEXT_POLICY_BUDGET_MISMATCH", "contextPolicyInputs.budget differs from the pinned agent budget");
    if (policy.promptRef && manifest.job?.promptRef && refKey(policy.promptRef) !== refKey(manifest.job.promptRef)) return unavailable("CONTEXT_POLICY_ARTIFACT_MISMATCH", "contextPolicyInputs.promptRef differs from the pinned job prompt");
  }
  if (manifest.contextSnapshotId && manifest.job?.contextSnapshotId && manifest.contextSnapshotId !== manifest.job.contextSnapshotId) return unavailable("CONTEXT_SNAPSHOT_ID_MISMATCH", "job and replay manifest pin different context snapshot ids");
  return undefined;
}

function pinnedContextRequest(manifest: ReplayManifest, request: ContextRequest): ContextRequest {
  const policy = manifest.contextPolicyInputs ?? {};
  return {
    ...request,
    ...policy,
    agentId: request.agentId,
    jobId: request.jobId,
    budget: request.budget,
    ...(manifest.contextSnapshotId ? { id: manifest.contextSnapshotId, snapshotId: manifest.contextSnapshotId } : {}),
  };
}

function pinnedContextPort(manifest: ReplayManifest, base: NonNullable<ReplayPorts["context"]>): NonNullable<ReplayPorts["context"]> {
  const snapshot: ContextSnapshot | undefined = manifest.contextSnapshot ?? manifest.job?.contextSnapshot;
  if (snapshot) {
    const exact = deepFreeze(deepClone(snapshot));
    const result: ContextResult = { ok: true, value: exact };
    return {
      project: () => result,
      buildActual: () => result,
      ...("analyze" in base && typeof base.analyze === "function" ? { analyze: base.analyze.bind(base) } : {}),
      ...("profiler" in base && typeof base.profiler === "function" ? { profiler: base.profiler.bind(base) } : {}),
    } as NonNullable<ReplayPorts["context"]>;
  }
  return {
    project: (request: ContextRequest) => base.project(pinnedContextRequest(manifest, request)),
    ...(base.buildActual ? { buildActual: (request: ContextRequest, logicalTime: number) => base.buildActual!(pinnedContextRequest(manifest, request), logicalTime) } : {}),
    ...("analyze" in base && typeof base.analyze === "function" ? { analyze: base.analyze.bind(base) } : {}),
    ...("profiler" in base && typeof base.profiler === "function" ? { profiler: base.profiler.bind(base) } : {}),
  } as NonNullable<ReplayPorts["context"]>;
}

function deliverControls(events: readonly TraceEventRecord[], controls: ReplayControls | undefined): void {
  if (!controls?.onEvent) return;
  // Pause/speed/step are visualization controls. They intentionally do not
  // gate or reorder authoritative execution; a step simply limits callbacks.
  const visible = controls.step ? events.slice(0, 1) : events;
  for (const event of visible) controls.onEvent(event);
}

/** Replay orchestrator. Every run allocates a fresh simulation engine and
 * clones the manifest inputs before handing them to upstream public ports. */
export function createReplayService(ports: ReplayPorts = {}): ReplayService {
  return {
    async replay(manifest, controls = {}): Promise<ReplayResult> {
      const invalid = validatePinnedInputs(manifest, ports);
      if (invalid) return invalid;
      const parsedBaselines = parseBaselines(manifest);
      if ("status" in parsedBaselines) return parsedBaselines;
      const hasEventBaseline = parsedBaselines.world !== undefined || parsedBaselines.trace !== undefined;
      if (!hasEventBaseline) return unavailable("MISSING_EXPECTED_EVENT_BASELINE", "EXACT replay requires actual expected world events or normalized trace events; a hash alone is insufficient to diagnose divergence");
      if (!manifest.expectedFinalSnapshot && !manifest.expectedFinalSnapshotHash) return unavailable("MISSING_EXPECTED_SNAPSHOT_BASELINE", "EXACT replay requires an expected final snapshot or snapshot hash");
      if (parsedBaselines.world && manifest.expectedEventHash && stableHash(canonicalSerialize(parsedBaselines.world)) !== manifest.expectedEventHash) return unavailable("EXPECTED_EVENT_HASH_MISMATCH", "expectedEventHash does not match the supplied expected event baseline");
      if (parsedBaselines.trace && manifest.expectedTraceHash && stableHash(canonicalSerialize(parsedBaselines.trace)) !== manifest.expectedTraceHash) return unavailable("EXPECTED_TRACE_HASH_MISMATCH", "expectedTraceHash does not match the supplied expected trace baseline");
      if (manifest.expectedFinalSnapshot && manifest.expectedFinalSnapshotHash && snapshotHash(manifest.expectedFinalSnapshot) !== manifest.expectedFinalSnapshotHash) return unavailable("EXPECTED_SNAPSHOT_HASH_MISMATCH", "expectedFinalSnapshotHash does not match the supplied expected snapshot");
      if (!manifest.fixture && !manifest.job) return unavailable("MISSING_REPLAY_INPUT", "manifest needs a fixture or instruction job");
      const simulation = ports.simulationFactory?.() ?? createSimulationEngine();
      let worldEvents: readonly WorldEvent[] = [];
      let traceEvents: readonly TraceEventRecord[] = [];

      if (manifest.job) {
        if (!ports.content || !ports.context || !manifest.agentDefinition) return unavailable("INSTRUCTION_PORTS_UNAVAILABLE", "job replay requires exact content/context/agent inputs");
        if (!manifest.fixture) return unavailable("MISSING_FIXTURE", "instruction replay requires the immutable world fixture");
        const loaded = simulation.load(deepClone(manifest.fixture), manifest.seed);
        if (!loaded.ok) return unavailable("INVALID_FIXTURE", loaded.error.map((error) => `${error.code}:${error.path}`).join(", "));
        const factory = ports.instructionFactory ?? createInstructionEngine;
        const context = pinnedContextPort(manifest, ports.context);
        const engine = factory({ content: ports.content, context, simulation });
        const pinnedSnapshot = manifest.contextSnapshot ?? manifest.job.contextSnapshot;
        const job = {
          ...deepClone(manifest.job),
          ...(manifest.contextSnapshotId ? { contextSnapshotId: manifest.contextSnapshotId } : {}),
          ...(pinnedSnapshot ? { contextSnapshot: deepClone(pinnedSnapshot) } : {}),
        };
        const prepared = engine.prepare(job, deepClone(manifest.agentDefinition));
        if (!prepared.ok) return unavailable(prepared.error.code, prepared.error.diagnostics.join("; "));
        const started = engine.start(prepared.value);
        const done = engine.runToCompletion(started.executionId);
        worldEvents = simulation.events();
        traceEvents = replayEventRecords(done);
        deliverControls(traceEvents, controls);
        if (manifest.expectedTraceHash) {
          const actualHash = stableHash(canonicalSerialize(traceEvents));
          if (actualHash !== manifest.expectedTraceHash) {
            return { status: "DIVERGED", firstDifference: compare(parsedBaselines.trace ?? manifest.expectedTraceHash, parsedBaselines.trace ? traceEvents : actualHash, "TRACE", "Observable trace differs"), finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
          }
        }
        const expectedTrace = parsedBaselines.trace;
        if (expectedTrace) {
          const difference = compare(expectedTrace, traceEvents, "TRACE", "Observable trace differs");
          if (difference) return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
        }
        if (manifest.expectedEventHash) {
          const actualHash = stableHash(canonicalSerialize(worldEvents));
          if (actualHash !== manifest.expectedEventHash) return { status: "DIVERGED", firstDifference: compare(parsedBaselines.world ?? manifest.expectedEventHash, parsedBaselines.world ? worldEvents : actualHash, "EVENT", "World event stream differs"), finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
        }
        if (parsedBaselines.world) {
          const difference = compare(parsedBaselines.world, worldEvents, "EVENT", "World event stream differs");
          if (difference) return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
        }
      } else {
        const ran = commandStreamRun(manifest, simulation);
        if (typeof ran === "object" && ran !== null && "status" in ran) return ran;
        worldEvents = ran as readonly WorldEvent[];
        const repository = createTraceRepository();
        const traceId = repository.begin({ traceId: "replay.normalization", jobId: manifest.traceId, startLogicalTime: 0, schemaVersion: 1 });
        for (const event of worldEvents) repository.append(traceId, event);
        traceEvents = repository.get(traceId)?.events ?? [];
        deliverControls(traceEvents, controls);
        const expected = parsedBaselines.world;
        if (manifest.expectedEventHash) {
          const actualHash = stableHash(canonicalSerialize(worldEvents));
          if (actualHash !== manifest.expectedEventHash) {
            const difference = expected ? compare(expected, worldEvents, "EVENT", "World event stream differs") : { kind: "EVENT" as const, message: `World event hash differs: expected ${manifest.expectedEventHash}, actual ${actualHash}` };
            return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
          }
        }
        if (expected) {
          const difference = compare(expected, worldEvents, "EVENT", "World event stream differs");
          if (difference) return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
        }
        if (manifest.expectedTraceHash) {
          const actualHash = stableHash(canonicalSerialize(traceEvents));
          if (actualHash !== manifest.expectedTraceHash) return { status: "DIVERGED", firstDifference: compare(parsedBaselines.trace ?? manifest.expectedTraceHash, parsedBaselines.trace ? traceEvents : actualHash, "TRACE", "Normalized trace differs"), finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
        }
        if (parsedBaselines.trace) {
          const difference = compare(parsedBaselines.trace, traceEvents, "TRACE", "Normalized trace differs");
          if (difference) return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: snapshotHash(simulation.snapshot()), events: worldEvents, traceEvents, finalSnapshot: simulation.snapshot(), isolated: true };
        }
      }

      const snapshot = simulation.snapshot();
      const finalHash = snapshotHash(snapshot);
      if (manifest.expectedFinalSnapshotHash && manifest.expectedFinalSnapshotHash !== finalHash) {
        const difference = manifest.expectedFinalSnapshot ? compare(manifest.expectedFinalSnapshot, snapshot, "SNAPSHOT", "Final snapshot differs") : { kind: "SNAPSHOT" as const, message: `Final snapshot hash differs: expected ${manifest.expectedFinalSnapshotHash}, actual ${finalHash}` };
        return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: finalHash, events: worldEvents, traceEvents, finalSnapshot: snapshot, isolated: true };
      }
      if (manifest.expectedFinalSnapshot) {
        const difference = compare(manifest.expectedFinalSnapshot, snapshot, "SNAPSHOT", "Final snapshot differs");
        if (difference) return { status: "DIVERGED", firstDifference: difference, finalSnapshotHash: finalHash, events: worldEvents, traceEvents, finalSnapshot: snapshot, isolated: true };
      }
      return { status: "EXACT", finalSnapshotHash: finalHash, events: worldEvents, traceEvents, finalSnapshot: snapshot, isolated: true };
    },
  };
}

export const createReplayOrchestrator = createReplayService;

/** Build a replay manifest from a trace header without changing any pinned
 * reference. Callers supply the immutable fixture and execution inputs. */
export function createReplayManifest(input: Omit<ReplayManifestType, "schemaVersion"> & { readonly schemaVersion?: number }): ReplayManifestType {
  return deepFreeze(deepClone({ ...input, schemaVersion: input.schemaVersion ?? 1 }));
}

export function replayManifestFromTrace(trace: TraceRecord, input: Omit<ReplayManifestType, "schemaVersion" | "traceId" | "artifactRefs" | "contextSnapshotId" | "contextSnapshot" | "engineVersion" | "engineSchemaVersion" | "contentManifestVersion" | "contentSchemaVersion" | "contextSchemaVersion"> & { readonly schemaVersion?: number }): ReplayManifestType {
  return createReplayManifest({
    ...input,
    traceId: trace.header.traceId,
    artifactRefs: trace.header.artifactRefs,
    ...(trace.header.contextSnapshotId ? { contextSnapshotId: trace.header.contextSnapshotId } : {}),
    ...(trace.contextSnapshot ? { contextSnapshot: trace.contextSnapshot } : {}),
    ...(trace.header.engineVersion ? { engineVersion: trace.header.engineVersion } : {}),
    ...(trace.header.engineSchemaVersion !== undefined ? { engineSchemaVersion: trace.header.engineSchemaVersion } : {}),
    ...(trace.header.contentManifestVersion ? { contentManifestVersion: trace.header.contentManifestVersion } : {}),
    ...(trace.header.contentSchemaVersion !== undefined ? { contentSchemaVersion: trace.header.contentSchemaVersion } : {}),
    ...(trace.header.contextSchemaVersion !== undefined ? { contextSchemaVersion: trace.header.contextSchemaVersion } : {}),
  });
}
