import {
  canonicalSerialize,
  fingerprint,
  type ContentReference,
  type ResolvedContentManifest,
} from "../content-registry/public.js";
import {
  replaySimulation,
  type CommandResult,
  type DinosaurState,
  type GateState,
  type RobotState,
  type VisitorGroupState,
  type WorldDelta,
  type WorldEvent,
  type WorldState,
} from "../simulation/public.js";
import {
  replaySessionSnapshotSchema,
  traceContentManifestSchema,
  traceEventSchema,
  traceSchema,
  traceSchemaVersionSchema,
} from "./schemas.js";
import type {
  ReplayDiagnostic,
  ReplaySession,
  ReplaySessionOptions,
  ReplaySessionSnapshot,
  ReplayStatus,
  ReplayVerificationMismatch,
  ReplayVerificationResult,
  Trace,
  TraceAuthority,
  TraceAuthorityCommand,
  TraceAvailabilityEntry,
  TraceCaptureFault,
  TraceCaptureInput,
  TraceCaptureResult,
  TraceComparisonAlignment,
  TraceComparisonDifference,
  TraceComparisonResult,
  TraceConciseProjection,
  TraceContentManifest,
  TraceContentManifestEntry,
  TraceContextPayload,
  TraceDecisionCycleProjection,
  TraceDetailedProjection,
  TraceDiagnostic,
  TraceEvent,
  TraceEventDraft,
  TraceEventKind,
  TraceIdentity,
  TraceLink,
  TraceOutcome,
  TraceProjection,
  TraceRecorder,
  TraceRerunOptions,
  TraceRoot,
  TraceStableId,
  TraceStatus,
  TraceValidationResult,
} from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const bySequence = (left: TraceEvent, right: TraceEvent): number => left.sequence - right.sequence || lexical(left.id, right.id);
const clone = <T>(value: T): T => structuredClone(value);
const deepFreeze = <T>(value: T): T => {
  const copy = clone(value);
  const freeze = (entry: unknown): void => {
    if (entry !== null && typeof entry === "object") {
      Object.freeze(entry);
      for (const child of Object.values(entry)) freeze(child);
    }
  };
  freeze(copy);
  return copy;
};
const key = (reference: ContentReference): string => `${reference.id}@${reference.version}`;
const idPattern = /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u;

/** Keys that are never accepted anywhere in a trace payload. */
export const PROHIBITED_TRACE_FIELDS: readonly string[] = Object.freeze([
  "analysis",
  "chain-of-thought",
  "chainofthought",
  "cot",
  "hidden-reasoning",
  "hiddenreasoning",
  "inner-thought",
  "innerthought",
  "private-analysis",
  "privateanalysis",
  "reasoning",
  "reasoning-text",
  "reasoningtext",
  "scratchpad",
  "thought-process",
  "thoughtprocess",
]);
const prohibitedKeys = new Set(PROHIBITED_TRACE_FIELDS);

const prohibitedPaths = (value: unknown, path = "$", output: string[] = []): readonly string[] => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => prohibitedPaths(entry, `${path}[${index}]`, output));
    return output;
  }
  if (value === null || typeof value !== "object") return output;
  for (const [field, entry] of Object.entries(value)) {
    const normalized = field.toLowerCase().replaceAll("_", "-");
    if (prohibitedKeys.has(normalized)) output.push(`${path}.${field}`);
    prohibitedPaths(entry, `${path}.${field}`, output);
  }
  return output;
};

export const containsProhibitedTraceField = (value: unknown): boolean => prohibitedPaths(value).length > 0;
export const prohibitedTraceFieldPaths = (value: unknown): readonly string[] => [...prohibitedPaths(value)].sort(lexical);

const diagnostic = (code: TraceDiagnostic["code"], path: string, message: string): TraceDiagnostic => ({ code, path, message });
const captureFault = (code: TraceCaptureFault["code"], scope: TraceCaptureFault["scope"], message: string, eventId?: TraceStableId, tick?: number): TraceCaptureFault => ({ code, scope, message, eventId, tick });

const sortedReferences = (references: readonly ContentReference[]): readonly ContentReference[] =>
  [...references].sort((left, right) => lexical(key(left), key(right))).map((entry) => ({ ...entry }));

const isResolvedManifest = (value: TraceCaptureInput["contentManifest"]): value is ResolvedContentManifest =>
  !Array.isArray(value) && typeof value === "object" && value !== null && "root" in value && "dependencies" in value;
const isTraceManifest = (value: TraceCaptureInput["contentManifest"]): value is TraceContentManifest =>
  !Array.isArray(value) && typeof value === "object" && value !== null && "entries" in value && "fingerprint" in value;

const normalizeContentManifest = (value: TraceCaptureInput["contentManifest"]): TraceContentManifest => {
  const entries: TraceContentManifestEntry[] = isResolvedManifest(value)
    ? [value.root, ...value.dependencies].map((record) => ({
      reference: { id: record.id, version: record.version },
      class: record.class,
      schemaVersion: record.schemaVersion,
      fingerprint: fingerprint(record),
    }))
    : isTraceManifest(value) ? value.entries.map((entry) => ({ ...entry, reference: { ...entry.reference } })) : value.map((reference) => ({ reference: { ...reference } }));
  const sortedEntries = [...entries].sort((left, right) => lexical(key(left.reference), key(right.reference)));
  return {
    schemaVersion: "1",
    entries: sortedEntries,
    fingerprint: isResolvedManifest(value) || isTraceManifest(value) ? value.fingerprint : fingerprint(sortedEntries),
  };
};

const defaultRoot = (root: TraceRoot): TraceRoot => ({ taskId: root.taskId, jobId: root.jobId, evalId: root.evalId });
const traceSuffix = (id: TraceStableId): string => id.split(":")[1] ?? "trace";
const generatedEventId = (traceId: TraceStableId, sequence: number): TraceStableId => `event:${traceSuffix(traceId)}-${sequence.toString().padStart(8, "0")}` as TraceStableId;
const generatedSessionId = (traceId: TraceStableId): TraceStableId => `replay:${traceSuffix(traceId)}` as TraceStableId;
const cycleId = (event: TraceEvent): TraceStableId => event.cycleId ?? `cycle:${event.tick.toString().padStart(8, "0")}` as TraceStableId;

const normalizeAuthority = (input: TraceCaptureInput, events: readonly TraceEvent[]): TraceAuthority => {
  const fromRequests: TraceAuthorityCommand[] = events
    .filter((event): event is Extract<TraceEvent, { readonly kind: "tool-request" }> => event.kind === "tool-request")
    .map((event) => ({ decisionTick: event.tick, command: event.payload.command }))
    .sort((left, right) => left.decisionTick - right.decisionTick || lexical(left.command.id, right.command.id));
  const fromResults: readonly CommandResult[] = events
    .filter((event): event is Extract<TraceEvent, { readonly kind: "tool-result" }> => event.kind === "tool-result")
    .map((event) => event.payload.commandResult);
  const fromEvents: readonly WorldEvent[] = events
    .filter((event): event is Extract<TraceEvent, { readonly kind: "tool-result" }> => event.kind === "tool-result")
    .flatMap((event) => event.payload.commandResult.accepted ? event.payload.commandResult.events : []);
  const fromDeltas: readonly WorldDelta[] = events
    .filter((event): event is Extract<TraceEvent, { readonly kind: "world-delta" }> => event.kind === "world-delta")
    .map((event) => event.payload.delta);
  const exactContent = input.authority?.exactContent === undefined
    ? input.contentManifest instanceof Array ? sortedReferences(input.contentManifest) : normalizeContentManifest(input.contentManifest).entries.map((entry) => entry.reference)
    : sortedReferences(input.authority.exactContent);
  const commands = input.authority?.commands === undefined ? fromRequests : [...input.authority.commands];
  const commandResults = input.authority?.commandResults === undefined ? fromResults : [...input.authority.commandResults];
  const worldEvents = input.authority?.worldEvents === undefined ? fromEvents : [...input.authority.worldEvents];
  const worldDeltas = input.authority?.worldDeltas === undefined ? fromDeltas : [...input.authority.worldDeltas];
  return {
    initialState: clone(input.authority?.initialState ?? input.initialState),
    exactContent,
    allowedCommandKinds: [...(input.authority?.allowedCommandKinds ?? ["move", "operate-gate", "observe-gate", "feed", "bait", "evacuate", "reserve", "release"])].sort(lexical) as TraceAuthority["allowedCommandKinds"],
    commands: [...commands].sort((left, right) => left.decisionTick - right.decisionTick || lexical(left.command.id, right.command.id)),
    commandResults: [...commandResults],
    worldEvents: [...worldEvents],
    worldDeltas: [...worldDeltas].sort((left, right) => left.tick - right.tick || lexical(left.id, right.id)),
  };
};

const makeIdentity = (input: TraceCaptureInput, manifest: TraceContentManifest, initialFingerprint: string): TraceIdentity => ({
  schemaVersion: "1",
  id: input.id,
  mode: input.mode,
  root: defaultRoot(input.root),
  contentManifest: clone(manifest),
  seed: input.seed,
  stateReference: { initialTick: input.initialState.tick, initialFingerprint },
  startTick: input.startTick,
});

const makeTrace = (
  input: TraceCaptureInput,
  identity: TraceIdentity,
  events: readonly TraceEvent[],
  faults: readonly TraceCaptureFault[],
  status: TraceStatus,
  finalState: WorldState | undefined,
  outcome: TraceOutcome | undefined,
  authority: TraceAuthority,
): Trace => {
  const endTick = finalState?.tick ?? events.reduce((maximum, event) => Math.max(maximum, event.tick), input.startTick);
  const result: Trace = {
    schemaVersion: "1",
    id: input.id,
    identity,
    mode: input.mode,
    root: defaultRoot(input.root),
    contentManifest: clone(identity.contentManifest),
    seed: input.seed,
    stateReference: clone(identity.stateReference),
    startTick: input.startTick,
    endTick,
    status,
    events: [...events].sort(bySequence),
    authority: clone(authority),
    finalState: finalState === undefined ? undefined : clone(finalState),
    outcome,
    captureFaults: [...faults],
  };
  return deepFreeze(result);
};

const validateIdentity = (input: TraceCaptureInput, manifest: TraceContentManifest): readonly TraceCaptureFault[] => {
  const output: TraceCaptureFault[] = [];
  if (!idPattern.test(input.id)) output.push(captureFault("TRACE_CAPTURE_INVALID", "identity", "Trace ID must be a stable namespaced identifier."));
  if (input.startTick < 0 || !Number.isInteger(input.startTick)) output.push(captureFault("TRACE_CAPTURE_INVALID", "identity", "Trace start tick must be a non-negative integer."));
  if (input.seed < 0 || !Number.isInteger(input.seed)) output.push(captureFault("TRACE_CAPTURE_INVALID", "identity", "Trace seed must be a non-negative integer."));
  if (traceContentManifestSchema.safeParse(manifest).success === false) output.push(captureFault("TRACE_CAPTURE_INVALID", "identity", "Trace content manifest failed schema validation."));
  if (containsProhibitedTraceField(input)) output.push(captureFault("TRACE_CAPTURE_PROHIBITED_FIELD", "identity", "Trace input contains a prohibited hidden-reasoning field."));
  return output;
};

const eventForDraft = (traceId: TraceStableId, draft: TraceEventDraft, nextSequence: number): TraceEvent => ({
  ...draft,
  schemaVersion: "1",
  id: draft.id ?? generatedEventId(traceId, nextSequence),
  sequence: draft.sequence ?? nextSequence,
} as TraceEvent);

class Recorder implements TraceRecorder {
  readonly id: TraceStableId;
  private readonly input: TraceCaptureInput;
  private readonly identity: TraceIdentity;
  private readonly authority: TraceAuthority;
  private readonly events: TraceEvent[] = [];
  private readonly faults: TraceCaptureFault[] = [];
  private finalized: Trace | undefined;

  constructor(input: TraceCaptureInput, identity: TraceIdentity, authority: TraceAuthority) {
    this.id = input.id;
    this.input = input;
    this.identity = identity;
    this.authority = authority;
  }

  append(candidate: TraceEventDraft | TraceEvent): { readonly ok: true; readonly event: TraceEvent } | { readonly ok: false; readonly fault: TraceCaptureFault } {
    if (this.finalized !== undefined) {
      const fault = captureFault("TRACE_CAPTURE_APPEND_FAILED", "event", "A finalized trace is immutable.");
      return { ok: false, fault };
    }
    const nextSequence = this.events.length + 1;
    const event = eventForDraft(this.id, candidate, nextSequence);
    const eventFault = this.validateEvent(event, nextSequence);
    if (eventFault !== undefined) {
      this.reportFailure(eventFault);
      return { ok: false, fault: eventFault };
    }
    this.events.push(clone(event));
    return { ok: true, event: deepFreeze(event) };
  }

  record(candidate: TraceEventDraft | TraceEvent): { readonly ok: true; readonly event: TraceEvent } | { readonly ok: false; readonly fault: TraceCaptureFault } {
    return this.append(candidate);
  }

  reportFailure(fault: TraceCaptureFault): void {
    this.faults.push(clone(fault));
    if (this.finalized !== undefined) return;
    const nextSequence = this.events.length + 1;
    const faultEvent: TraceEvent = {
      schemaVersion: "1",
      id: generatedEventId(this.id, nextSequence),
      tick: fault.tick ?? this.input.startTick,
      sequence: nextSequence,
      kind: "capture-fault",
      entityLinks: [],
      causalParentIds: this.events.length === 0 ? [] : [this.events[this.events.length - 1]!.id],
      payload: { fault: clone(fault) },
    };
    this.events.push(faultEvent);
  }

  snapshot(): Trace {
    return makeTrace(this.input, this.identity, this.events, this.faults, "recording", this.input.finalState, this.input.outcome, this.authority);
  }

  finalize(status: Exclude<TraceStatus, "recording"> = "complete", outcome = this.input.outcome, finalState = this.input.finalState): Trace {
    if (this.finalized !== undefined) return this.finalized;
    const hasInvalidFault = this.faults.some((fault) => fault.code === "TRACE_CAPTURE_INVALID" || fault.code === "TRACE_CAPTURE_PROHIBITED_FIELD" || fault.code === "TRACE_CAPTURE_SEQUENCE" || fault.code === "TRACE_CAPTURE_CAUSAL_LINK");
    const finalStatus: Exclude<TraceStatus, "recording"> = hasInvalidFault && status === "complete" ? "invalid" : status;
    const finalOutcome = outcome ?? (finalStatus === "complete" ? { kind: "complete" as const, reasonCode: "TRACE_COMPLETE" } : undefined);
    this.finalized = makeTrace(this.input, this.identity, this.events, this.faults, finalStatus, finalState, finalOutcome, this.authority);
    return this.finalized;
  }

  private validateEvent(event: TraceEvent, expectedSequence: number): TraceCaptureFault | undefined {
    if (containsProhibitedTraceField(event)) return captureFault("TRACE_CAPTURE_PROHIBITED_FIELD", "event", "Trace event contains a prohibited hidden-reasoning field.", event.id, event.tick);
    if (event.sequence !== expectedSequence) return captureFault("TRACE_CAPTURE_SEQUENCE", "event", `Expected sequence ${expectedSequence}; received ${event.sequence}.`, event.id, event.tick);
    const previous = this.events[this.events.length - 1];
    if (previous !== undefined && (event.tick < previous.tick || event.sequence <= previous.sequence)) return captureFault("TRACE_CAPTURE_SEQUENCE", "event", "Trace events must be ordered by non-decreasing tick and increasing sequence.", event.id, event.tick);
    const parentIds = new Set(this.events.map((entry) => entry.id));
    if (event.causalParentIds.some((parentId) => !parentIds.has(parentId))) return captureFault("TRACE_CAPTURE_CAUSAL_LINK", "event", "Every causal parent must identify an earlier event.", event.id, event.tick);
    const parsed = traceEventSchema.safeParse(event);
    if (!parsed.success) return captureFault("TRACE_CAPTURE_APPEND_FAILED", "event", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "), event.id, event.tick);
    return undefined;
  }
}

export const createTraceRecorder = (input: TraceCaptureInput): TraceRecorder => {
  const manifest = normalizeContentManifest(input.contentManifest);
  const identityFaults = validateIdentity(input, manifest);
  const stateResult = traceSchemaVersionSchema.safeParse("1");
  if (!stateResult.success || identityFaults.length > 0) {
    throw new TypeError(identityFaults.map((fault) => fault.message).join("; ") || "Invalid trace recorder input.");
  }
  const worldSchemaResult = traceEventSchema.safeParse({
    schemaVersion: "1", id: "event:validation", tick: input.initialState.tick, sequence: 1,
    kind: "snapshot", entityLinks: [], causalParentIds: [], payload: { state: input.initialState, stateFingerprint: fingerprint(input.initialState) },
  });
  if (!worldSchemaResult.success) throw new TypeError("Initial trace state failed schema validation.");
  const draftEvents = (input.events ?? []).map((entry, index) => eventForDraft(input.id, entry, index + 1));
  const authority = normalizeAuthority(input, draftEvents);
  const recorder = new Recorder(input, makeIdentity(input, manifest, fingerprint(input.initialState)), authority);
  for (const event of input.events ?? []) recorder.append(event);
  return recorder;
};

export const captureAuthoritativeTrace = (input: TraceCaptureInput): TraceCaptureResult => {
  try {
    const manifest = normalizeContentManifest(input.contentManifest);
    const identityFaults = validateIdentity(input, manifest);
    if (identityFaults.length > 0) {
      const authority = normalizeAuthority(input, []);
      const identity = makeIdentity(input, manifest, fingerprint(input.initialState));
      const firstFault = identityFaults[0] as TraceCaptureFault;
      const faultEvent: TraceEvent = {
        schemaVersion: "1",
        id: generatedEventId(input.id, 1),
        tick: firstFault.tick ?? input.startTick,
        sequence: 1,
        kind: "capture-fault",
        entityLinks: [],
        causalParentIds: [],
        payload: { fault: firstFault },
      };
      const trace = makeTrace(input, identity, [faultEvent], identityFaults, "invalid", input.finalState, input.outcome, authority);
      return { ok: false, trace, fault: firstFault };
    }
    const recorder = createTraceRecorder(input);
    const trace = recorder.finalize("complete");
    return trace.captureFaults.length === 0 ? { ok: true, trace } : { ok: false, trace, fault: trace.captureFaults[0] as TraceCaptureFault };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trace capture failed.";
    const manifest = normalizeContentManifest(input.contentManifest);
    const fault = captureFault("TRACE_CAPTURE_FINALIZE_FAILED", "finalize", message);
    const trace = makeTrace(input, makeIdentity(input, manifest, fingerprint(input.initialState)), [], [fault], "invalid", input.finalState, input.outcome, normalizeAuthority(input, []));
    return { ok: false, trace, fault };
  }
};

export const captureTrace = captureAuthoritativeTrace;

export const recordTraceEvent = (recorder: TraceRecorder, event: TraceEventDraft | TraceEvent) => recorder.record(event);
export const finalizeTrace = (recorder: TraceRecorder, status?: Exclude<TraceStatus, "recording">, outcome?: TraceOutcome, finalState?: WorldState): Trace => recorder.finalize(status, outcome, finalState);

const traceDiagnostics = (value: Trace): readonly TraceDiagnostic[] => {
  const diagnostics: TraceDiagnostic[] = [];
  const parsed = traceSchema.safeParse(value);
  if (!parsed.success) diagnostics.push(...parsed.error.issues.map((issue) => diagnostic("TRACE_INVALID", issue.path.map(String).join(".") || "$", issue.message)));
  for (const path of prohibitedTraceFieldPaths(value)) diagnostics.push(diagnostic("TRACE_PROHIBITED_FIELD", path, "Trace contains a prohibited hidden-reasoning field."));
  if (value.identity.id !== value.id || value.identity.mode !== value.mode || value.identity.contentManifest.fingerprint !== value.contentManifest.fingerprint) diagnostics.push(diagnostic("TRACE_IDENTITY_MISMATCH", "identity", "Flat and nested trace identity fields must match."));
  const manifestKeys = value.contentManifest.entries.map((entry) => key(entry.reference));
  if (new Set(manifestKeys).size !== manifestKeys.length || manifestKeys.some((entry, index) => entry !== [...manifestKeys].sort(lexical)[index])) diagnostics.push(diagnostic("TRACE_IDENTITY_MISMATCH", "contentManifest.entries", "Content manifest references must be unique and lexically ordered."));
  let previous: TraceEvent | undefined;
  const ids = new Set<string>();
  for (const [index, event] of value.events.entries()) {
    if (ids.has(event.id)) diagnostics.push(diagnostic("TRACE_EVENT_ORDER", `events.${event.sequence}`, "Trace event IDs must be unique."));
    ids.add(event.id);
    if (event.sequence !== index + 1 || (previous !== undefined && event.tick < previous.tick)) diagnostics.push(diagnostic("TRACE_EVENT_ORDER", `events.${event.sequence}`, "Trace events must be stored in contiguous sequence and non-decreasing tick order."));
    const earlier = new Set(value.events.filter((candidate) => candidate.sequence < event.sequence).map((candidate) => candidate.id));
    for (const parentId of event.causalParentIds) if (!earlier.has(parentId)) diagnostics.push(diagnostic("TRACE_CAUSAL_PARENT_MISSING", `events.${event.sequence}.causalParentIds`, `Causal parent ${parentId} is not an earlier event.`));
    previous = event;
  }
  return diagnostics.sort((left, right) => lexical(`${left.path}:${left.code}`, `${right.path}:${right.code}`));
};

export const validateTrace = (input: unknown): TraceValidationResult => {
  const parsed = traceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, diagnostics: parsed.error.issues.map((issue) => diagnostic("TRACE_INVALID", issue.path.map(String).join(".") || "$", issue.message)) };
  const trace = parsed.data as Trace;
  const diagnostics = traceDiagnostics(trace);
  return diagnostics.length === 0 ? { ok: true, trace: deepFreeze(trace) } : { ok: false, diagnostics };
};

const uniqueLinks = (links: readonly TraceLink[]): readonly TraceLink[] => {
  const map = new Map<string, TraceLink>();
  for (const link of links) map.set(`${link.kind}:${link.id}:${link.relation ?? ""}`, link);
  return [...map.values()].sort((left, right) => lexical(`${left.kind}:${left.id}:${left.relation ?? ""}`, `${right.kind}:${right.id}:${right.relation ?? ""}`));
};
const rootLinks = (root: TraceRoot): readonly TraceLink[] => ([
  root.taskId === undefined ? undefined : { kind: "task" as const, id: root.taskId },
  root.jobId === undefined ? undefined : { kind: "job" as const, id: root.jobId },
  root.evalId === undefined ? undefined : { kind: "eval" as const, id: root.evalId },
] as readonly (TraceLink | undefined)[]).filter((link): link is TraceLink => link !== undefined);
const linksFor = (trace: Trace): readonly TraceLink[] => uniqueLinks([
  ...rootLinks(trace.root),
  ...trace.events.flatMap((event) => [event.actor, ...event.entityLinks]).filter((link): link is TraceLink => link !== undefined),
]);

const contextAvailability = (payload: TraceContextPayload): readonly TraceAvailabilityEntry[] => payload.entries.length > 0 ? payload.entries : payload.afterManifest.entries.map((entry) => ({
  itemId: entry.itemId,
  availability: entry.lifecycle === "included" ? "available" : entry.lifecycle === "unavailable-required" ? "unavailable" : entry.lifecycle === "excluded" ? "excluded" : entry.lifecycle === "compacted" || entry.lifecycle === "externalized" ? "excluded" : "never-routed",
  used: entry.lifecycle === "included",
  sourceVersion: entry.item?.sourceVersion,
  reasonCode: entry.reasonCode,
}));

export const projectConciseTrace = (trace: Trace): TraceConciseProjection => {
  const outcome = trace.outcome ?? [...trace.events].reverse().find((event): event is Extract<TraceEvent, { readonly kind: "outcome" }> => event.kind === "outcome")?.payload.outcome;
  const links = linksFor(trace);
  const cycles = new Set(trace.events.map(cycleId));
  return deepFreeze({
    schemaVersion: "1", traceId: trace.id, mode: trace.mode, status: trace.status, root: clone(trace.root), startTick: trace.startTick, endTick: trace.endTick,
    outcome, expected: outcome?.expected, observed: outcome?.observed, consequence: outcome?.consequence, immediateCausalGap: outcome?.immediateCausalGap,
    eventCount: trace.events.length, cycleCount: cycles.size, availableDetail: trace.events.length > 0, links,
  });
};

const cycleProjection = (events: readonly TraceEvent[], id: TraceStableId): TraceDecisionCycleProjection => {
  const ordered = [...events].sort(bySequence);
  const firstContext = ordered.find((event): event is Extract<TraceEvent, { readonly kind: "context-assembly" }> => event.kind === "context-assembly");
  const cost = firstContext?.payload.afterManifest.used;
  return {
    cycleId: id,
    tick: ordered[0]?.tick ?? 0,
    eventIds: ordered.map((event) => event.id),
    context: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "context-assembly" }> => event.kind === "context-assembly").map((event) => event.payload),
    clauses: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "clause-applicability" }> => event.kind === "clause-applicability").map((event) => event.payload),
    decisions: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "decision" }> => event.kind === "decision").map((event) => event.payload),
    toolRequests: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "tool-request" }> => event.kind === "tool-request").map((event) => event.payload),
    toolResults: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "tool-result" }> => event.kind === "tool-result").map((event) => event.payload),
    evidence: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "evidence" }> => event.kind === "evidence").map((event) => event.payload),
    worldDeltas: ordered.filter((event): event is Extract<TraceEvent, { readonly kind: "world-delta" }> => event.kind === "world-delta").map((event) => event.payload.delta),
    cost,
  };
};

export const projectDetailedTrace = (trace: Trace): TraceDetailedProjection => {
  const grouped = new Map<TraceStableId, TraceEvent[]>();
  for (const event of [...trace.events].sort(bySequence)) grouped.set(cycleId(event), [...(grouped.get(cycleId(event)) ?? []), event]);
  const cycles = [...grouped.entries()].sort((left, right) => (left[1][0]?.tick ?? 0) - (right[1][0]?.tick ?? 0) || lexical(left[0], right[0])).map(([id, events]) => cycleProjection(events, id));
  const availability = trace.events.filter((event): event is Extract<TraceEvent, { readonly kind: "context-assembly" }> => event.kind === "context-assembly").flatMap((event) => contextAvailability(event.payload));
  return deepFreeze({ schemaVersion: "1", traceId: trace.id, mode: trace.mode, status: trace.status, cycles, events: [...trace.events].sort(bySequence), contextAvailability: availability, links: linksFor(trace) });
};

export const projectTrace = (trace: Trace): TraceProjection => deepFreeze({ concise: projectConciseTrace(trace), detailed: projectDetailedTrace(trace) });
export const projectCausalLinks = (trace: Trace, eventId?: TraceStableId): readonly TraceLink[] => {
  if (eventId === undefined) return linksFor(trace);
  const event = trace.events.find((candidate) => candidate.id === eventId);
  if (event === undefined) return [];
  const parentIds = new Set(event.causalParentIds);
  return uniqueLinks([...rootLinks(trace.root), ...event.entityLinks, ...(event.actor === undefined ? [] : [event.actor]), ...trace.events.filter((candidate) => parentIds.has(candidate.id)).flatMap((candidate) => candidate.entityLinks)]);
};
export const filterTraceProjection = (trace: Trace, kinds: readonly TraceEventKind[]): TraceDetailedProjection => {
  const allowed = new Set(kinds);
  const filtered = { ...trace, events: trace.events.filter((event) => allowed.has(event.kind)) };
  return projectDetailedTrace(filtered);
};
export const traceEventsAtTick = (trace: Trace, tick: number): readonly TraceEvent[] => trace.events.filter((event) => event.tick === tick).sort(bySequence);
export const traceEventById = (trace: Trace, eventId: TraceStableId): TraceEvent | undefined => trace.events.find((event) => event.id === eventId);

const latestEventAtOrBefore = (events: readonly TraceEvent[], tick: number): TraceEvent | undefined => [...events].sort(bySequence).reverse().find((event) => event.tick <= tick);
const replaceById = <T extends { readonly id: string }>(items: readonly T[], id: string, next: T): readonly T[] => items.map((item) => item.id === id ? next : item);

const scalarValue = (value: string | number | boolean | null | undefined): string | number | boolean | undefined => value === null ? undefined : value;
const applyDelta = (state: WorldState, delta: WorldDelta): WorldState => {
  const value = scalarValue(delta.after);
  const replaceGate = (gate: GateState): GateState | undefined => {
    switch (delta.field) {
      case "position": return { ...gate, position: value === "open" || value === "closed" ? value : gate.position };
      case "locked": return { ...gate, locked: typeof value === "boolean" ? value : gate.locked };
      case "jammed": return { ...gate, jammed: typeof value === "boolean" ? value : gate.jammed };
      case "sensorReading": return { ...gate, sensorReading: value === "open" || value === "closed" ? value : gate.sensorReading };
      case "reservedBy": return { ...gate, reservedBy: typeof value === "string" ? value as TraceStableId : undefined };
      default: return undefined;
    }
  };
  const replaceRobot = (robot: RobotState): RobotState | undefined => {
    switch (delta.field) {
      case "locationId": return { ...robot, locationId: typeof value === "string" ? value as TraceStableId : robot.locationId };
      case "battery": return { ...robot, battery: typeof value === "number" ? value : robot.battery };
      case "health": return { ...robot, health: typeof value === "number" ? value : robot.health };
      case "action": return { ...robot, action: value === "idle" || value === "moving" || value === "using-tool" || value === "disabled" ? value : robot.action };
      case "assignmentId": return { ...robot, assignmentId: typeof value === "string" ? value as TraceStableId : undefined };
      default: return undefined;
    }
  };
  const replaceDinosaur = (dinosaur: DinosaurState): DinosaurState | undefined => {
    switch (delta.field) {
      case "locationId": return { ...dinosaur, locationId: typeof value === "string" ? value as TraceStableId : dinosaur.locationId };
      case "contained": return { ...dinosaur, contained: typeof value === "boolean" ? value : dinosaur.contained };
      case "hunger": return { ...dinosaur, hunger: typeof value === "number" ? value : dinosaur.hunger };
      case "agitation": return { ...dinosaur, agitation: typeof value === "number" ? value : dinosaur.agitation };
      case "targetLocationId": return { ...dinosaur, targetLocationId: typeof value === "string" ? value as TraceStableId : undefined };
      case "baitedBy": return { ...dinosaur, baitedBy: typeof value === "string" ? value as TraceStableId : undefined };
      default: return undefined;
    }
  };
  const replaceVisitor = (visitor: VisitorGroupState): VisitorGroupState | undefined => {
    switch (delta.field) {
      case "locationId": return { ...visitor, locationId: typeof value === "string" ? value as TraceStableId : visitor.locationId };
      case "movingTo": return { ...visitor, movingTo: typeof value === "string" ? value as TraceStableId : undefined };
      case "exposedTo": return { ...visitor, exposedTo: typeof value === "string" ? value as TraceStableId : undefined };
      case "panic": return { ...visitor, panic: typeof value === "number" ? value : visitor.panic };
      case "safety": return { ...visitor, safety: value === "safe" || value === "exposed" || value === "injured" || value === "casualty" ? value : visitor.safety };
      default: return undefined;
    }
  };
  const gate = state.gates.find((entry) => entry.id === delta.entityId);
  if (gate !== undefined) {
    const next = replaceGate(gate);
    if (next !== undefined) return { ...state, gates: replaceById(state.gates, gate.id, next) };
  }
  const robot = state.robots.find((entry) => entry.id === delta.entityId);
  if (robot !== undefined) {
    const next = replaceRobot(robot);
    if (next !== undefined) return { ...state, robots: replaceById(state.robots, robot.id, next) };
  }
  const dinosaur = state.dinosaurs.find((entry) => entry.id === delta.entityId);
  if (dinosaur !== undefined) {
    const next = replaceDinosaur(dinosaur);
    if (next !== undefined) return { ...state, dinosaurs: replaceById(state.dinosaurs, dinosaur.id, next) };
  }
  const visitor = state.visitors.find((entry) => entry.id === delta.entityId);
  if (visitor !== undefined) {
    const next = replaceVisitor(visitor);
    if (next !== undefined) return { ...state, visitors: replaceById(state.visitors, visitor.id, next) };
  }
  throw new Error(`Replay cannot apply world delta ${delta.id} to ${delta.entityId}.${delta.field}.`);
};

const stateAtTick = (trace: Trace, tick: number): { readonly state: WorldState; readonly diagnostic?: ReplayDiagnostic } => {
  let state = clone(trace.authority.initialState);
  const boundedTick = Math.max(trace.startTick, Math.min(tick, trace.endTick ?? tick));
  const ordered = [...trace.events].sort(bySequence);
  const checkpoint = latestEventAtOrBefore(ordered.filter((event) => event.kind === "snapshot"), boundedTick);
  if (checkpoint !== undefined && checkpoint.kind === "snapshot") state = clone(checkpoint.payload.state);
  try {
    for (const event of ordered) {
      if (event.tick > boundedTick) break;
      if (checkpoint !== undefined && event.sequence <= checkpoint.sequence) continue;
      if (event.kind === "world-delta") state = applyDelta(state, event.payload.delta);
      if (event.kind === "snapshot") state = clone(event.payload.state);
      if (event.tick > state.tick) state = { ...state, tick: event.tick };
    }
    if (state.tick !== boundedTick) state = { ...state, tick: boundedTick };
    return { state: deepFreeze(state) };
  } catch (error) {
    return { state: deepFreeze(state), diagnostic: { code: "REPLAY_APPLY_FAILED", message: error instanceof Error ? error.message : "Replay could not apply a world delta." } };
  }
};

const contentDiagnostics = (trace: Trace, options: ReplaySessionOptions | undefined): readonly ReplayDiagnostic[] => {
  if (options?.registry !== undefined) {
    const missing = trace.contentManifest.entries.filter((entry) => !options.registry!.resolveExact(entry.reference.id, entry.reference.version).ok);
    return missing.map((entry) => ({ code: "REPLAY_CONTENT_MISSING" as const, message: `Exact content ${key(entry.reference)} is unavailable.`, path: `contentManifest.${key(entry.reference)}` }));
  }
  if (options?.availableContent === undefined) return [];
  const available = new Set(options.availableContent.map(key));
  return trace.contentManifest.entries.filter((entry) => !available.has(key(entry.reference))).map((entry) => ({ code: "REPLAY_CONTENT_MISSING" as const, message: `Exact content ${key(entry.reference)} is unavailable.`, path: `contentManifest.${key(entry.reference)}` }));
};

export const createReplaySession = (trace: Trace, options?: ReplaySessionOptions): ReplaySession => {
  const contentFaults = contentDiagnostics(trace, options);
  const traceValidation = validateTrace(trace);
  const initialDiagnostics: ReplayDiagnostic[] = [...contentFaults];
  if (!traceValidation.ok) initialDiagnostics.push({ code: "REPLAY_SCHEMA_INCOMPATIBLE", message: "Trace schema or identity validation failed." });
  if (trace.status === "incomplete" || trace.status === "invalid" || trace.status === "interrupted") initialDiagnostics.push({ code: "REPLAY_TRACE_INCOMPLETE", message: `Trace status ${trace.status} cannot be treated as a complete historical record.` });
  let paused = true;
  let speed: 1 | 2 | 4 = 1;
  let status: ReplayStatus = initialDiagnostics.length > 0 ? "unavailable" : "paused";
  let cursorTick = trace.startTick;
  let focusedLink: TraceLink | undefined;
  let selectedEventId: TraceStableId | undefined;
  let diagnostics = [...initialDiagnostics];
  const snapshot = (): ReplaySessionSnapshot => {
    const projected = stateAtTick(trace, cursorTick);
    const allDiagnostics = projected.diagnostic === undefined ? diagnostics : [...diagnostics, projected.diagnostic];
    const nextStatus = initialDiagnostics.length > 0 ? "unavailable" as const : status;
    const candidate: ReplaySessionSnapshot = {
      schemaVersion: "1", sessionId: generatedSessionId(trace.id), traceId: trace.id, mode: "historical-replay", status: nextStatus, paused,
      speed, cursor: { tick: cursorTick, sequence: selectedEventId === undefined ? traceEventsAtTick(trace, cursorTick).at(-1)?.sequence ?? 0 : trace.events.find((event) => event.id === selectedEventId)?.sequence ?? 0, eventId: selectedEventId },
      world: projected.state, focusedLink, selectedEventId, diagnostics: allDiagnostics,
    };
    const parsed = replaySessionSnapshotSchema.safeParse(candidate);
    if (!parsed.success) throw new Error(`Replay projection failed schema validation: ${parsed.error.message}`);
    return deepFreeze(candidate);
  };
  const seek = (target: number | { readonly tick?: number; readonly eventId?: TraceStableId }): ReplaySessionSnapshot => {
    if (initialDiagnostics.length > 0) return snapshot();
    const requested = typeof target === "number" ? target : target.eventId === undefined ? target.tick : trace.events.find((event) => event.id === target.eventId)?.tick;
    if (requested === undefined || !Number.isInteger(requested) || requested < trace.startTick || (trace.endTick !== undefined && requested > trace.endTick)) {
      diagnostics = [...diagnostics, { code: "REPLAY_SEEK_INVALID", message: "Replay seek target is outside the recorded tick range." }];
      status = "paused";
      paused = true;
      return snapshot();
    }
    cursorTick = requested;
    if (typeof target !== "number" && target.eventId !== undefined) selectedEventId = target.eventId;
    else selectedEventId = traceEventsAtTick(trace, cursorTick).at(-1)?.id;
    status = paused ? "paused" : "playing";
    return snapshot();
  };
  const session: ReplaySession = {
    trace,
    snapshot,
    play: () => { if (initialDiagnostics.length === 0) { paused = false; status = "playing"; } return snapshot(); },
    pause: () => { paused = true; status = "paused"; return snapshot(); },
    step: (count = 1) => { paused = true; status = "paused"; const next = cursorTick + Math.max(0, Math.trunc(count)); return seek(next); },
    advance: (ticks = speed) => { if (initialDiagnostics.length === 0) { const next = cursorTick + Math.max(0, Math.trunc(ticks)); return seek(next); } return snapshot(); },
    seek,
    setSpeed: (nextSpeed) => { speed = nextSpeed; return snapshot(); },
    focus: (link) => { focusedLink = link === undefined ? undefined : clone(link); return snapshot(); },
  };
  return session;
};

const expectedCommandResults = (trace: Trace): readonly CommandResult[] => trace.authority.commandResults.length > 0 ? trace.authority.commandResults : trace.events.filter((event): event is Extract<TraceEvent, { readonly kind: "tool-result" }> => event.kind === "tool-result").map((event) => event.payload.commandResult);
const expectedWorldDeltas = (trace: Trace): readonly WorldDelta[] => trace.authority.worldDeltas.length > 0 ? trace.authority.worldDeltas : trace.events.filter((event): event is Extract<TraceEvent, { readonly kind: "world-delta" }> => event.kind === "world-delta").map((event) => event.payload.delta);
const observedWorldDeltas = (results: readonly CommandResult[]): readonly WorldDelta[] => results.flatMap((result) => result.accepted ? result.deltas : []).sort((left, right) => left.tick - right.tick || lexical(left.id, right.id));
const observedWorldEvents = (results: readonly CommandResult[]): readonly WorldEvent[] => results.flatMap((result) => result.accepted ? result.events : []).sort((left, right) => left.tick - right.tick || lexical(left.id, right.id));

const mismatch = (kind: ReplayVerificationMismatch["kind"], path: string, expected: unknown, observed: unknown, tick?: number, sequence?: number, eventId?: TraceStableId): ReplayVerificationMismatch => ({ kind, path, expected: canonicalSerialize(expected), observed: canonicalSerialize(observed), tick, sequence, eventId });
const firstMismatchInArrays = <T>(kind: ReplayVerificationMismatch["kind"], expected: readonly T[], observed: readonly T[], path: string, ticks?: readonly number[], eventIds?: readonly TraceStableId[]): ReplayVerificationMismatch | undefined => {
  const limit = Math.max(expected.length, observed.length);
  for (let index = 0; index < limit; index += 1) {
    if (canonicalSerialize(expected[index]) !== canonicalSerialize(observed[index])) return mismatch(kind, `${path}.${index}`, expected[index], observed[index], ticks?.[index], undefined, eventIds?.[index]);
  }
  return undefined;
};

export const verifyTraceRerun = (trace: Trace, options?: TraceRerunOptions): ReplayVerificationResult => {
  const validation = validateTrace(trace);
  if (!validation.ok) return { status: "invalid", traceId: trace.id, comparedEvents: 0, diagnostics: [{ code: "REPLAY_SCHEMA_INCOMPATIBLE", message: "Trace schema or identity validation failed." }] };
  const missing = contentDiagnostics(trace, options);
  if (missing.length > 0) return { status: "unavailable", traceId: trace.id, comparedEvents: 0, diagnostics: missing };
  const commands = options?.commands ?? trace.authority.commands;
  const finalTick = trace.finalState?.tick ?? trace.endTick ?? trace.startTick;
  let result: ReturnType<typeof replaySimulation>;
  try {
    result = replaySimulation({ snapshot: trace.authority.initialState, exactContent: trace.authority.exactContent, allowedCommandKinds: trace.authority.allowedCommandKinds, commands, finalTick });
  } catch (error) {
    return { status: "mismatch", traceId: trace.id, comparedEvents: 0, firstMismatch: mismatch("schema", "rerun", "valid replay", error instanceof Error ? error.message : "replay failed"), diagnostics: [] };
  }
  const expectedResults = expectedCommandResults(trace);
  const observedResults = result.commandResults;
  const commandMismatch = firstMismatchInArrays("event", expectedResults, observedResults, "commandResults", expectedResults.map((entry) => entry.resultingTick), trace.events.filter((event) => event.kind === "tool-result").map((event) => event.id));
  if (commandMismatch !== undefined) return { status: "mismatch", traceId: trace.id, comparedEvents: trace.events.length, firstMismatch: commandMismatch, diagnostics: [] };
  const expectedDeltas = expectedWorldDeltas(trace);
  const observedDeltas = observedWorldDeltas(observedResults);
  const deltaMismatch = firstMismatchInArrays("event", expectedDeltas, observedDeltas, "worldDeltas", expectedDeltas.map((entry) => entry.tick), trace.events.filter((event) => event.kind === "world-delta").map((event) => event.id));
  if (deltaMismatch !== undefined) return { status: "mismatch", traceId: trace.id, comparedEvents: trace.events.length, firstMismatch: deltaMismatch, diagnostics: [] };
  const expectedEvents = trace.authority.worldEvents.length > 0 ? trace.authority.worldEvents : trace.events.filter((event): event is Extract<TraceEvent, { readonly kind: "outcome" }> => event.kind === "outcome").length === 0 ? [] : trace.authority.worldEvents;
  const eventMismatch = firstMismatchInArrays("event", expectedEvents, observedWorldEvents(observedResults), "worldEvents", expectedEvents.map((entry) => entry.tick));
  if (eventMismatch !== undefined) return { status: "mismatch", traceId: trace.id, comparedEvents: trace.events.length, firstMismatch: eventMismatch, diagnostics: [] };
  if (trace.finalState !== undefined && canonicalSerialize(trace.finalState) !== canonicalSerialize(result.state)) return { status: "mismatch", traceId: trace.id, comparedEvents: trace.events.length, firstMismatch: mismatch("final-state", "finalState", trace.finalState, result.state, result.state.tick), diagnostics: [] };
  return { status: "equivalent", traceId: trace.id, comparedEvents: trace.events.length, diagnostics: [] };
};

export const replayAndVerifyTrace = verifyTraceRerun;
export const verifyReplay = verifyTraceRerun;

const groupCycles = (trace: Trace): ReadonlyMap<TraceStableId, readonly TraceEvent[]> => {
  const groups = new Map<TraceStableId, TraceEvent[]>();
  for (const event of [...trace.events].sort(bySequence)) groups.set(cycleId(event), [...(groups.get(cycleId(event)) ?? []), event]);
  return groups;
};
const cycleTick = (events: readonly TraceEvent[]): number => events[0]?.tick ?? 0;
const cycleSignature = (events: readonly TraceEvent[], kind: TraceEventKind): string => canonicalSerialize(events.filter((event) => event.kind === kind).map((event) => event.payload));
const cycleCostSignature = (events: readonly TraceEvent[]): string => canonicalSerialize(events.filter((event): event is Extract<TraceEvent, { readonly kind: "context-assembly" }> => event.kind === "context-assembly").map((event) => event.payload.afterManifest.used));

export const compareTraces = (left: Trace, right: Trace): TraceComparisonResult => {
  const leftGroups = groupCycles(left);
  const rightGroups = groupCycles(right);
  const keys = [...new Set([...leftGroups.keys(), ...rightGroups.keys()])].sort((a, b) => {
    const leftTick = cycleTick(leftGroups.get(a) ?? []); const rightTick = cycleTick(rightGroups.get(b) ?? []);
    return leftTick - rightTick || lexical(a, b);
  });
  const alignments: TraceComparisonAlignment[] = [];
  const differences: TraceComparisonDifference[] = [];
  const compatible = left.schemaVersion === right.schemaVersion && left.contentManifest.fingerprint === right.contentManifest.fingerprint;
  if (!compatible) differences.push({ category: "alignment", path: "contentManifest", left: left.contentManifest.fingerprint, right: right.contentManifest.fingerprint });
  for (const cycle of keys) {
    const leftEvents = leftGroups.get(cycle); const rightEvents = rightGroups.get(cycle);
    if (leftEvents === undefined || rightEvents === undefined) {
      alignments.push({ leftCycleId: leftEvents === undefined ? undefined : cycle, rightCycleId: rightEvents === undefined ? undefined : cycle, leftTick: leftEvents === undefined ? undefined : cycleTick(leftEvents), rightTick: rightEvents === undefined ? undefined : cycleTick(rightEvents), status: leftEvents === undefined ? "right-only" : "left-only" });
      differences.push({ category: "alignment", path: `cycles.${cycle}`, left: leftEvents === undefined ? "unmatched" : "present", right: rightEvents === undefined ? "unmatched" : "present" });
      continue;
    }
    const fields: readonly [TraceComparisonAlignment["contextDelta"], TraceComparisonDifference["category"], TraceEventKind][] = [
      [cycleSignature(leftEvents, "context-assembly"), "context", "context-assembly"],
      [cycleSignature(leftEvents, "clause-applicability"), "clause", "clause-applicability"],
      [cycleSignature(leftEvents, "tool-request"), "action", "tool-request"],
      [cycleSignature(leftEvents, "evidence"), "evidence", "evidence"],
      [cycleCostSignature(leftEvents), "cost", "context-assembly"],
      [cycleSignature(leftEvents, "world-delta"), "world-outcome", "world-delta"],
    ];
    const alignment: TraceComparisonAlignment = { leftCycleId: cycle, rightCycleId: cycle, leftTick: cycleTick(leftEvents), rightTick: cycleTick(rightEvents), status: "matched", contextDelta: fields[0]?.[0], clauseSelection: cycleSignature(leftEvents, "clause-applicability"), actions: cycleSignature(leftEvents, "tool-request"), evidence: cycleSignature(leftEvents, "evidence"), cost: fields[4]?.[0], worldOutcome: cycleSignature(leftEvents, "world-delta") };
    const rightValues = [cycleSignature(rightEvents, "context-assembly"), cycleSignature(rightEvents, "clause-applicability"), cycleSignature(rightEvents, "tool-request"), cycleSignature(rightEvents, "evidence"), cycleCostSignature(rightEvents), cycleSignature(rightEvents, "world-delta")];
    fields.forEach(([leftValue, category], index) => { const rightValue = rightValues[index]; if (leftValue !== rightValue) differences.push({ category, path: `cycles.${cycle}.${category}`, left: leftValue ?? "", right: rightValue ?? "" }); });
    alignments.push(alignment);
  }
  const leftOutcome = canonicalSerialize(left.outcome ?? null); const rightOutcome = canonicalSerialize(right.outcome ?? null);
  if (leftOutcome !== rightOutcome) differences.push({ category: "outcome", path: "outcome", left: leftOutcome, right: rightOutcome });
  return deepFreeze({ schemaVersion: "1", compatible, leftTraceId: left.id, rightTraceId: right.id, alignments, differences });
};

export const compareTracePair = compareTraces;
export const compareTrace = compareTraces;
export const replayTrace = createReplaySession;
