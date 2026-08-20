import {
  canonicalSerialize,
  fingerprint,
} from "../content-registry/public.js";
import {
  assembleContext,
  contextFacts,
} from "../context/public.js";
import type {
  ContentReference,
  ContentRegistry,
  ResolvedContentManifest,
} from "../content-registry/public.js";
import {
  executeInstruction,
  instructionArtifactDataSchema,
  resolveInstructionArtifacts,
} from "../instruction/public.js";
import type {
  InstructionDecision,
  InstructionEvidence,
  ResolvedInstructionArtifact,
} from "../instruction/public.js";
import {
  createSimulation,
} from "../simulation/public.js";
import type {
  CommandResult,
  ScenarioFixture,
  StableId,
  ToolEvidence,
  WorldCommand,
  WorldDelta,
  WorldEvent,
} from "../simulation/public.js";
import {
  compareTraces,
  createTraceRecorder,
  type TraceEventDraft,
} from "../trace-replay/public.js";
import type {
  Trace,
  TraceContentManifest,
  TraceLink,
  TraceOutcome,
} from "../trace-replay/public.js";
import {
  evalCaseSchema,
  evalSelectionRequestSchema,
  evalSuiteSchema,
} from "./schemas.js";
import type {
  EvalAssertion,
  EvalAssertionEvidence,
  EvalAssertionOperator,
  EvalAssertionResult,
  EvalCandidate,
  EvalCase,
  EvalCaseResult,
  EvalCatalog,
  EvalComparison,
  EvalComparisonDifference,
  EvalContextObservation,
  EvalDependencyManifest,
  EvalDiagnostic,
  EvalExecutionObservation,
  EvalFixture,
  EvalId,
  EvalOutcomeObservation,
  EvalProgress,
  EvalReplayReference,
  EvalRisk,
  EvalRunOptions,
  EvalSelectionItem,
  EvalSelectionPlan,
  EvalSelectionRequest,
  EvalStatus,
  EvalSuite,
  EvalSuiteResult,
  EvalSuiteRunOptions,
  EvalToolObservation,
  EvalValidationResult,
  JsonValue,
} from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const clone = <T>(value: T): T => structuredClone(value);
const freeze = <T>(value: T): T => {
  const copy = clone(value);
  const visit = (entry: unknown): void => {
    if (entry !== null && typeof entry === "object") {
      Object.freeze(entry);
      for (const child of Object.values(entry)) visit(child);
    }
  };
  visit(copy);
  return copy;
};
const refKey = (reference: Pick<ContentReference, "id" | "version">): string => `${reference.id}@${reference.version}`;
const ref = (id: string, version = "1"): ContentReference => ({ id, version });
const stableSuffix = (value: string): string => value.split(":")[1]?.replace(/[^A-Za-z0-9._-]/gu, "-") ?? "eval";
const diagnostic = (code: EvalDiagnostic["code"], path: string, message: string): EvalDiagnostic => ({ code, path, message });
const sortedRefs = (references: readonly ContentReference[]): readonly ContentReference[] =>
  [...references].sort((left, right) => lexical(refKey(left), refKey(right))).map((entry) => ({ ...entry }));
const uniqueRefs = (references: readonly ContentReference[]): readonly ContentReference[] => {
  const seen = new Set<string>();
  const result: ContentReference[] = [];
  for (const reference of references) {
    const key = refKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...reference });
  }
  return result;
};
const asJson = (value: unknown): JsonValue | undefined => {
  if (value === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(canonicalSerialize(value));
    return parsed as JsonValue;
  } catch {
    return undefined;
  }
};

const caseReference = (value: Pick<EvalCase, "id" | "version">): ContentReference => ({ id: value.id, version: value.version });
const fixtureReference = (value: EvalFixture): ContentReference => ({ id: value.id, version: value.version });
const assertExpected = (assertion: EvalAssertion): EvalDiagnostic | undefined => {
  const requiresExpected = assertion.operator !== "exists" && assertion.operator !== "not-exists";
  if (requiresExpected && assertion.expected === undefined) return diagnostic("EVAL_INVALID", `assertions.${assertion.id}.expected`, "This bounded assertion operator requires an expected value.");
  if ((assertion.operator === "in" || assertion.operator === "contains") && !Array.isArray(assertion.expected) && typeof assertion.expected !== "string") {
    return diagnostic("EVAL_INVALID", `assertions.${assertion.id}.expected`, `${assertion.operator} requires a string or bounded array expected value.`);
  }
  if ((assertion.operator === "gte" || assertion.operator === "lte" || assertion.operator === "count-equals") && typeof assertion.expected !== "number") {
    return diagnostic("EVAL_INVALID", `assertions.${assertion.id}.expected`, `${assertion.operator} requires a numeric expected value.`);
  }
  return undefined;
};

const validateIds = (values: readonly string[], path: string): EvalDiagnostic | undefined => {
  if (new Set(values).size !== values.length) return diagnostic("EVAL_DUPLICATE", path, "Stable IDs must be unique within an Eval asset.");
  return undefined;
};

export const validateEvalCase = (input: unknown): EvalValidationResult => {
  const parsed = evalCaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, diagnostics: freeze(parsed.error.issues.map((issue) => diagnostic("EVAL_INVALID", issue.path.map(String).join(".") || "$", issue.message))) };
  const value = parsed.data as EvalCase;
  const diagnostics: EvalDiagnostic[] = [];
  const assertionIds = validateIds(value.assertions.map((entry) => entry.id), "assertions");
  if (assertionIds !== undefined) diagnostics.push(assertionIds);
  for (const assertion of value.assertions) {
    const expected = assertExpected(assertion);
    if (expected !== undefined) diagnostics.push(expected);
  }
  if (value.fixture.id === value.id && value.fixture.version !== value.version) diagnostics.push(diagnostic("EVAL_CONTENT_MISMATCH", "fixture.version", "The fixture version must remain exact for the case version."));
  if (value.timeoutTicks > value.fixture.maxTicks) diagnostics.push(diagnostic("EVAL_INVALID", "timeoutTicks", "The case timeout cannot exceed the fixture tick bound."));
  if (value.cost.build.kind !== "build" || value.cost.run.kind !== "run") diagnostics.push(diagnostic("EVAL_INVALID", "cost", "Build and run cost references must retain their declared kinds."));
  if (value.availability === "available" && value.availabilityReason !== undefined) diagnostics.push(diagnostic("EVAL_INVALID", "availabilityReason", "Available cases do not carry an unavailable reason."));
  if (value.availability !== "available" && value.availabilityReason === undefined) diagnostics.push(diagnostic("EVAL_INVALID", "availabilityReason", "Unavailable or hidden cases must explain their availability state."));
  if (value.defaultCandidate !== undefined) {
    const candidateRefs = validateIds(value.defaultCandidate.artifactReferences.map((entry) => refKey(entry)), "defaultCandidate.artifactReferences");
    if (candidateRefs !== undefined) diagnostics.push(candidateRefs);
    if (value.defaultCandidate.artifacts !== undefined && value.defaultCandidate.artifacts.length !== value.defaultCandidate.artifactReferences.length) diagnostics.push(diagnostic("EVAL_CONTENT_MISMATCH", "defaultCandidate.artifacts", "Direct candidate artifacts must have one exact reference per injected artifact."));
  }
  return { ok: diagnostics.length === 0, diagnostics: freeze(diagnostics.sort((left, right) => lexical(`${left.path}:${left.code}`, `${right.path}:${right.code}`))) };
};

export const validateEvalSuite = (input: unknown): EvalValidationResult => {
  const parsed = evalSuiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, diagnostics: freeze(parsed.error.issues.map((issue) => diagnostic("EVAL_INVALID", issue.path.map(String).join(".") || "$", issue.message))) };
  const suite = parsed.data as EvalSuite;
  const duplicate = validateIds(suite.caseReferences.map(refKey), "caseReferences");
  return duplicate === undefined ? { ok: true, diagnostics: [] } : { ok: false, diagnostics: [duplicate] };
};

export const createEvalCatalog = (cases: readonly EvalCase[], suites: readonly EvalSuite[] = []): EvalCatalog => {
  const diagnostics: EvalDiagnostic[] = [];
  const caseKeys = new Set<string>();
  for (const [index, value] of cases.entries()) {
    const validation = validateEvalCase(value);
    diagnostics.push(...validation.diagnostics.map((entry) => ({ ...entry, path: `cases.${index}.${entry.path}` })));
    const key = refKey(value);
    if (caseKeys.has(key)) diagnostics.push(diagnostic("EVAL_DUPLICATE", `cases.${index}`, `Duplicate exact Eval case ${key}.`));
    caseKeys.add(key);
  }
  const suiteKeys = new Set<string>();
  for (const [index, value] of suites.entries()) {
    const validation = validateEvalSuite(value);
    diagnostics.push(...validation.diagnostics.map((entry) => ({ ...entry, path: `suites.${index}.${entry.path}` })));
    const key = refKey(value);
    if (suiteKeys.has(key)) diagnostics.push(diagnostic("EVAL_DUPLICATE", `suites.${index}`, `Duplicate exact Eval suite ${key}.`));
    suiteKeys.add(key);
    for (const caseRef of value.caseReferences) if (!caseKeys.has(refKey(caseRef))) diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", `suites.${index}.caseReferences`, `Suite references missing exact case ${refKey(caseRef)}.`));
  }
  if (diagnostics.length > 0) throw new TypeError(diagnostics.map((entry) => `${entry.path}: ${entry.message}`).join("; "));
  return freeze({ cases: [...cases], suites: [...suites] });
};

const findCase = (catalog: EvalCatalog, reference: ContentReference): EvalCase | undefined => catalog.cases.find((entry) => refKey(entry) === refKey(reference));
const findSuite = (catalog: EvalCatalog, reference: ContentReference): EvalSuite | undefined => catalog.suites.find((entry) => refKey(entry) === refKey(reference));

const selectionItem = (value: EvalCase | undefined, reference: ContentReference, source: EvalSelectionItem["source"], suiteReference?: ContentReference): EvalSelectionItem => {
  if (value === undefined) return { caseReference: { ...reference }, source, suiteReference, availability: "unavailable", availabilityReason: "Exact case is not present in the catalog.", previousResultIds: [], estimatedRunCost: { id: `cost:missing-${stableSuffix(reference.id)}` as EvalId, kind: "run", units: 0, label: "Unavailable case" } };
  return {
    caseReference: caseReference(value),
    source,
    suiteReference,
    title: value.title,
    risk: value.risk,
    availability: value.availability,
    availabilityReason: value.availabilityReason,
    previousResultIds: [...value.previousResultIds],
    estimatedRunCost: { ...value.cost.run },
  };
};

export const planEvalSelection = (catalog: EvalCatalog, rawRequest: EvalSelectionRequest): EvalSelectionPlan => {
  const parsed = evalSelectionRequestSchema.safeParse(rawRequest);
  if (!parsed.success) return freeze({ schemaVersion: "1", items: [], selectedCases: [], unavailableCases: [], includedRisks: [], estimatedCost: { buildUnits: 0, runUnits: 0, totalUnits: 0, references: [] }, diagnostics: parsed.error.issues.map((issue) => diagnostic("EVAL_INVALID", issue.path.map(String).join(".") || "$", issue.message)) });
  const request = parsed.data as EvalSelectionRequest;
  const items: EvalSelectionItem[] = [];
  const seenCases = new Set<string>();
  const diagnostics: EvalDiagnostic[] = [];
  const append = (reference: ContentReference, source: EvalSelectionItem["source"], suiteReference?: ContentReference): void => {
    const key = refKey(reference);
    if (seenCases.has(key)) {
      diagnostics.push(diagnostic("EVAL_DUPLICATE", "selection", `Exact case ${key} was selected more than once; duplicate entries are rejected.`));
      return;
    }
    seenCases.add(key);
    const value = findCase(catalog, reference);
    const item = selectionItem(value, reference, source, suiteReference);
    items.push(item);
    if (value === undefined) diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", "selection", `Exact case ${key} is unavailable.`));
  };
  for (const reference of request.caseReferences ?? []) append(reference, "case");
  for (const suiteReference of request.suiteReferences ?? []) {
    const suite = findSuite(catalog, suiteReference);
    if (suite === undefined) {
      diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", "suiteReferences", `Exact suite ${refKey(suiteReference)} is unavailable.`));
      continue;
    }
    if (suite.availability !== "available") {
      diagnostics.push(diagnostic("EVAL_UNAVAILABLE", `suiteReferences.${refKey(suiteReference)}`, `Suite ${refKey(suiteReference)} is ${suite.availability}.`));
    }
    for (const reference of suite.caseReferences) append(reference, "suite", suiteReference);
  }
  if (items.length === 0 && diagnostics.length === 0) diagnostics.push(diagnostic("EVAL_INVALID", "selection", "Select at least one exact case or named suite."));
  const selected = items.filter((item) => item.availability === "available" && findCase(catalog, item.caseReference) !== undefined);
  const unavailable = items.filter((item) => item.availability !== "available" || findCase(catalog, item.caseReference) === undefined);
  const risks = [...new Set(selected.flatMap((item) => item.risk === undefined ? [] : [item.risk]))].sort(lexical) as EvalRisk[];
  const references = selected.flatMap((item) => {
    const value = findCase(catalog, item.caseReference);
    return value === undefined ? [] : [value.cost.build, value.cost.run];
  });
  const buildUnits = selected.reduce((sum, item) => sum + (findCase(catalog, item.caseReference)?.cost.build.units ?? 0), 0);
  const runUnits = selected.reduce((sum, item) => sum + (findCase(catalog, item.caseReference)?.cost.run.units ?? 0), 0);
  return freeze({ schemaVersion: "1", items, selectedCases: selected.map((item) => item.caseReference), unavailableCases: unavailable, includedRisks: risks, estimatedCost: { buildUnits, runUnits, totalUnits: buildUnits + runUnits, references }, diagnostics: diagnostics.sort((left, right) => lexical(`${left.path}:${left.code}`, `${right.path}:${right.code}`)) });
};

const mergeFacts = (contextValues: Readonly<Record<string, import("../instruction/public.js").FactValue>>, fixtureValues: Readonly<Record<string, import("../instruction/public.js").FactValue>>): { readonly facts?: Readonly<Record<string, import("../instruction/public.js").FactValue>>; readonly diagnostic?: EvalDiagnostic } => {
  const result: Record<string, import("../instruction/public.js").FactValue> = { ...contextValues };
  for (const [key, value] of Object.entries(fixtureValues).sort(([left], [right]) => lexical(left, right))) {
    if (Object.hasOwn(result, key) && result[key] !== value) return { diagnostic: diagnostic("EVAL_CONTENT_MISMATCH", `facts.${key}`, `Fixture fact conflicts with routed Context fact ${key}.`) };
    result[key] = value;
  }
  return { facts: freeze(result) };
};

const resolveArtifact = (value: EvalCandidate, fixture: EvalFixture, registry: Pick<ContentRegistry, "resolveExact"> | undefined): { readonly artifacts?: readonly ResolvedInstructionArtifact[]; readonly manifest?: ResolvedContentManifest; readonly diagnostics: readonly EvalDiagnostic[] } => {
  const diagnostics: EvalDiagnostic[] = [];
  let resolvedManifest: ResolvedContentManifest | undefined;
  if (registry !== undefined) {
    const root = registry.resolveExact(value.reference.id, value.reference.version);
    if (!root.ok) diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", "candidate.reference", `Exact candidate ${refKey(value.reference)} could not be resolved.`));
    else resolvedManifest = root.manifest;
  }
  let artifacts: readonly ResolvedInstructionArtifact[] | undefined = value.artifacts;
  if (artifacts === undefined && registry !== undefined) {
    const resolved = resolveInstructionArtifacts(registry, value.artifactReferences);
    if ("diagnostics" in resolved) diagnostics.push(...resolved.diagnostics.map((entry) => diagnostic("EVAL_CONTENT_MISSING", "candidate.artifactReferences", entry.message)));
    else artifacts = resolved.artifacts;
  }
  if (artifacts === undefined) diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", "candidate.artifacts", "An exact candidate requires declarative instruction artifacts or a registry resolver."));
  if (artifacts !== undefined) {
    const artifactKeys = artifacts.map((entry) => refKey(entry.reference));
    const expectedKeys = value.artifactReferences.map(refKey);
    if (new Set(artifactKeys).size !== artifactKeys.length) diagnostics.push(diagnostic("EVAL_DUPLICATE", "candidate.artifacts", "Candidate artifact versions must be unique."));
    if (expectedKeys.some((entry) => !artifactKeys.includes(entry)) || artifactKeys.some((entry) => !expectedKeys.includes(entry))) diagnostics.push(diagnostic("EVAL_CONTENT_MISMATCH", "candidate.artifactReferences", "Injected artifacts do not match the exact candidate artifact manifest."));
    for (const artifact of artifacts) {
      const parsed = instructionArtifactDataSchema.safeParse({ schemaVersion: "1", requiredTools: artifact.requiredTools, clauses: artifact.clauses, knownTradeoffs: artifact.knownTradeoffs });
      if (!parsed.success) diagnostics.push(diagnostic("EVAL_INVALID", `candidate.artifacts.${refKey(artifact.reference)}`, "Candidate artifact data failed the declarative instruction schema."));
      if (fixture.candidateInjection.requiredArtifactClasses.length > 0 && !fixture.candidateInjection.requiredArtifactClasses.includes(artifact.class)) diagnostics.push(diagnostic("EVAL_CONTENT_MISMATCH", "candidateInjection.requiredArtifactClasses", `Candidate artifact ${refKey(artifact.reference)} has an unexpected class.`));
    }
  }
  return { artifacts, manifest: resolvedManifest, diagnostics };
};

const dependencyManifest = (value: EvalCase, candidate: EvalCandidate, artifacts: readonly ResolvedInstructionArtifact[], resolvedContent: ResolvedContentManifest | undefined): EvalDependencyManifest => {
  const fixtureRefs = value.fixture.scenario.exactContent;
  const contextRefs = [...value.fixture.context.availableSources, ...value.fixture.context.priorRetained, ...value.fixture.context.additions].map((entry) => entry.sourceVersion);
  const artifactRefs = artifacts.flatMap((entry) => [...entry.dependencies, ...entry.requiredTools, entry.reference]);
  const dependencies = sortedRefs(uniqueRefs([...fixtureRefs, ...contextRefs, ...candidate.artifactReferences, ...artifactRefs]));
  const base = { schemaVersion: "1" as const, runnerSchemaVersion: "1" as const, traceSchemaVersion: "1" as const, case: caseReference(value), fixture: fixtureReference(value.fixture), candidate: { ...candidate.reference }, dependencies, ...(resolvedContent === undefined ? {} : { resolvedContent }) };
  return freeze({ ...base, fingerprint: fingerprint(base) });
};

const traceLink = (kind: TraceLink["kind"], id: string, relation?: string): TraceLink => ({ kind, id: id as StableId, ...(relation === undefined ? {} : { relation }) });
const traceManifest = (references: readonly ContentReference[]): TraceContentManifest => {
  const entries = sortedRefs(references).map((reference) => ({ reference }));
  return { schemaVersion: "1", entries, fingerprint: fingerprint(entries) };
};
const outcomeFor = (kind: EvalOutcomeObservation["kind"], reasonCode: string, expected?: string, observed?: string): EvalOutcomeObservation => ({ kind, reasonCode, ...(expected === undefined ? {} : { expected }), ...(observed === undefined ? {} : { observed }) });
const traceOutcomeFor = (outcome: EvalOutcomeObservation, finalStateFingerprint?: string): TraceOutcome => ({ kind: outcome.kind, reasonCode: outcome.reasonCode, ...(outcome.expected === undefined ? {} : { expected: outcome.expected }), ...(outcome.observed === undefined ? {} : { observed: outcome.observed }), ...(finalStateFingerprint === undefined ? {} : { consequence: `final-state:${finalStateFingerprint}` }) });

const contextAvailability = (context: EvalContextObservation): readonly { readonly itemId: string; readonly availability: "available" | "unavailable" | "excluded" | "stale" | "never-routed"; readonly used: boolean; readonly sourceVersion?: ContentReference; readonly reasonCode: string }[] => context.after.entries.map((entry) => {
  const availability = entry.lifecycle === "included" ? "available" : entry.lifecycle === "unavailable-required" ? "unavailable" : entry.lifecycle === "excluded" || entry.lifecycle === "compacted" || entry.lifecycle === "externalized" ? "excluded" : "never-routed";
  return { itemId: entry.itemId, availability, used: entry.lifecycle === "included", ...(entry.item === undefined ? {} : { sourceVersion: entry.item.sourceVersion }), reasonCode: entry.reasonCode };
});

const makeTrace = (value: EvalCase, candidate: EvalCandidate, fixture: EvalFixture, manifest: EvalDependencyManifest, context: EvalContextObservation, decision: InstructionDecision | undefined, tools: readonly EvalToolObservation[], outcome: EvalOutcomeObservation, finalState: import("../simulation/public.js").WorldState, commands: readonly { readonly decisionTick: number; readonly command: WorldCommand }[], commandResults: readonly CommandResult[], worldDeltas: readonly WorldDelta[], traceStatus: "complete" | "incomplete" | "interrupted" | "invalid"): Trace | undefined => {
  const traceId = `trace:${stableSuffix(value.id)}-${stableSuffix(candidate.reference.id)}-${value.version.replaceAll(".", "-")}` as StableId;
  const exactReferences = sortedRefs(uniqueRefs([...manifest.dependencies, manifest.case, manifest.fixture, manifest.candidate]));
  const content = traceManifest(exactReferences);
  const events: TraceEventDraft[] = [];
  const previous = (): readonly StableId[] => events.length === 0 ? [] : [`event:${stableSuffix(traceId)}-${events.length.toString().padStart(8, "0")}` as StableId];
  const append = (event: Omit<TraceEventDraft, "schemaVersion" | "causalParentIds"> & { readonly causalParentIds?: readonly StableId[] }): void => {
    events.push({ schemaVersion: "1", ...event, causalParentIds: event.causalParentIds ?? previous() });
  };
  append({ kind: "task", tick: fixture.context.decisionTick, entityLinks: [traceLink("eval", value.id), traceLink("job", fixture.job.id), traceLink("agent", fixture.job.agentId)], payload: { taskId: fixture.job.taskId, jobId: fixture.job.id, evalId: value.id, artifactReferences: candidate.artifactReferences, exactContentManifest: content } });
  append({ kind: "context-assembly", tick: context.after.decisionTick, cycleId: `cycle:${context.after.decisionTick.toString().padStart(8, "0")}` as StableId, entityLinks: [traceLink("job", fixture.job.id), traceLink("agent", fixture.job.agentId)], payload: { beforeManifest: context.before, afterManifest: context.after, entries: contextAvailability(context), diagnostics: [] } });
  if (decision !== undefined) {
    for (const provenance of decision.provenance) append({ kind: "clause-applicability", tick: fixture.context.decisionTick, cycleId: `cycle:${fixture.context.decisionTick.toString().padStart(8, "0")}` as StableId, entityLinks: [traceLink("artifact", provenance.source.id), traceLink("job", fixture.job.id)], payload: { clauseId: provenance.clauseId as StableId, source: provenance.source, sourceClass: provenance.sourceClass, status: provenance.status, reasonCode: provenance.reasonCode } });
    append({ kind: "decision", tick: fixture.context.decisionTick, cycleId: `cycle:${fixture.context.decisionTick.toString().padStart(8, "0")}` as StableId, entityLinks: [traceLink("job", fixture.job.id), traceLink("agent", fixture.job.agentId)], payload: { outcome: decision.outcome, provenance: decision.provenance, compositionFindings: decision.compositionFindings, availableContextItemIds: context.after.entries.filter((entry) => entry.lifecycle === "included").map((entry) => entry.itemId), unavailableContextItemIds: context.after.entries.filter((entry) => entry.lifecycle !== "included").map((entry) => entry.itemId) } });
  }
  const lastCycle = `cycle:${fixture.context.decisionTick.toString().padStart(8, "0")}` as StableId;
  for (const observation of tools) {
    append({ kind: "tool-request", tick: observation.command.expectedTick, cycleId: lastCycle, entityLinks: [traceLink("job", fixture.job.id), traceLink("entity", observation.command.actorId)], payload: { command: observation.command, tool: "tool" in observation.command ? observation.command.tool : undefined } });
    append({ kind: "tool-result", tick: observation.result.resultingTick, cycleId: lastCycle, entityLinks: [traceLink("job", fixture.job.id)], payload: { commandResult: observation.result } });
    if (observation.evidence.length > 0) append({ kind: "evidence", tick: observation.result.resultingTick, cycleId: lastCycle, entityLinks: [traceLink("job", fixture.job.id)], payload: { evidence: observation.evidence } });
    if (observation.result.accepted) for (const delta of observation.result.deltas) append({ kind: "world-delta", tick: delta.tick, cycleId: lastCycle, entityLinks: [traceLink("entity", delta.entityId)], payload: { delta } });
  }
  // Trace replay's authority comparison treats an empty delta authority as a
  // legacy event-derived authority. A no-command stop/wait case therefore
  // omits passive tick deltas while retaining the final state and outcome.
  if (tools.length > 0) for (const delta of worldDeltas.filter((entry) => !tools.some((tool) => tool.result.accepted && tool.result.deltas.some((candidateDelta) => candidateDelta.id === entry.id)))) append({ kind: "world-delta", tick: delta.tick, cycleId: `cycle:${delta.tick.toString().padStart(8, "0")}` as StableId, entityLinks: [traceLink("entity", delta.entityId)], payload: { delta } });
  append({ kind: "outcome", tick: finalState.tick, entityLinks: [traceLink("eval", value.id), traceLink("job", fixture.job.id)], payload: { outcome: traceOutcomeFor(outcome, fingerprint(finalState)), finalStateFingerprint: fingerprint(finalState) } });
  try {
    const commandEvents = commandResults.flatMap((entry) => entry.accepted ? entry.events : []);
    const commandDeltas = commandResults.flatMap((entry) => entry.accepted ? entry.deltas : []);
    const recorder = createTraceRecorder({ id: traceId, mode: "eval", root: { evalId: value.id, jobId: fixture.job.id, taskId: fixture.job.taskId }, contentManifest: exactReferences, seed: fixture.scenario.initialState.seed, startTick: fixture.scenario.initialState.tick, initialState: fixture.scenario.initialState, authority: { initialState: fixture.scenario.initialState, exactContent: fixture.scenario.exactContent, allowedCommandKinds: fixture.scenario.allowedCommandKinds, commands, commandResults, worldEvents: commandEvents, worldDeltas: commandDeltas }, finalState, outcome: traceOutcomeFor(outcome, fingerprint(finalState)) });
    for (const event of events) {
      const appended = recorder.append(event);
      if (!appended.ok) return undefined;
    }
    return recorder.finalize(traceStatus, traceOutcomeFor(outcome, fingerprint(finalState)), finalState);
  } catch {
    return undefined;
  }
};

const getPath = (root: unknown, path: string): unknown => {
  const resolve = (current: unknown, parts: readonly string[], depth: number): unknown => {
    if (depth > 32 || current === null || current === undefined) return undefined;
    const part = parts[0];
    if (part === undefined) return current;
    if (part === "length" && Array.isArray(current)) return resolve(current.length, parts.slice(1), depth + 1);
    if (Array.isArray(current)) {
      if (part === "*") return current.flatMap((entry) => {
        const resolved = resolve(entry, parts.slice(1), depth + 1);
        return resolved === undefined ? [] : [resolved];
      });
      if (/^\d+$/u.test(part)) return resolve(current[Number(part)], parts.slice(1), depth + 1);
      const byId = current.find((entry) => entry !== null && typeof entry === "object" && (("id" in entry && entry.id === part) || ("itemId" in entry && entry.itemId === part)));
      return resolve(byId, parts.slice(1), depth + 1);
    }
    if (typeof current !== "object" || !Object.hasOwn(current, part)) return undefined;
    return resolve((current as Record<string, unknown>)[part], parts.slice(1), depth + 1);
  };
  return resolve(root, path.split("."), 0);
};

const equalValue = (left: unknown, right: unknown): boolean => canonicalSerialize(left) === canonicalSerialize(right);
const assertionPasses = (operator: EvalAssertionOperator, observed: unknown, expected: unknown): boolean => {
  switch (operator) {
    case "equals": return observed !== undefined && equalValue(observed, expected);
    case "not-equals": return !equalValue(observed, expected);
    case "in": return Array.isArray(expected) && expected.some((entry) => equalValue(observed, entry));
    case "contains": return typeof observed === "string" && typeof expected === "string" ? observed.includes(expected) : Array.isArray(observed) && Array.isArray(expected) ? expected.every((entry) => observed.some((candidate) => equalValue(candidate, entry))) : Array.isArray(observed) && expected !== undefined ? observed.some((entry) => equalValue(entry, expected)) : false;
    case "exists": return observed !== undefined;
    case "not-exists": return observed === undefined;
    case "gte": return typeof observed === "number" && typeof expected === "number" && observed >= expected;
    case "lte": return typeof observed === "number" && typeof expected === "number" && observed <= expected;
    case "count-equals": return (Array.isArray(observed) || typeof observed === "string") && typeof expected === "number" && observed.length === expected;
  }
};

const assertionRoot = (observation: EvalExecutionObservation, subject: EvalAssertion["subject"]): unknown => {
  switch (subject) {
    case "world": return observation.world;
    case "job": return observation.job;
    case "context": return observation.context;
    case "trace": return observation.trace;
    case "tool": return observation.tools;
    case "message": return observation.messages;
    case "outcome": return observation.outcome;
  }
};

const assertionEventIds = (observation: EvalExecutionObservation, assertion: EvalAssertion): readonly StableId[] => {
  const kind = assertion.subject === "context" ? "context-assembly" : assertion.subject === "tool" ? "tool-result" : assertion.subject === "trace" || assertion.subject === "outcome" ? "outcome" : assertion.subject === "world" ? "world-delta" : "task";
  return observation.trace.events.filter((event) => event.kind === kind).map((event) => event.id);
};

const evaluateAssertions = (assertions: readonly EvalAssertion[], observation: EvalExecutionObservation): readonly EvalAssertionResult[] => assertions.map((assertion) => {
  const observed = getPath(assertionRoot(observation, assertion.subject), assertion.path);
  const passed = assertionPasses(assertion.operator, observed, assertion.expected);
  const evidence: EvalAssertionEvidence = { traceEventIds: assertionEventIds(observation, assertion), links: [{ kind: "eval", id: observation.trace.root.evalId ?? "eval:unknown" as StableId }, { kind: "trace", id: observation.trace.id }] };
  return freeze({ id: assertion.id, subject: assertion.subject, path: assertion.path, operator: assertion.operator, ...(assertion.expected === undefined ? {} : { expected: assertion.expected }), ...(observed === undefined ? {} : { observed: asJson(observed) }), passed, evidence, ...(passed ? {} : { mismatch: { path: assertion.path, expected: assertion.expected, observed: asJson(observed), reasonCode: observed === undefined ? "OBSERVED_VALUE_MISSING" : "ASSERTION_MISMATCH" } }) });
});

const replayReference = (trace: Trace | undefined, failedAssertions: readonly EvalAssertionResult[] = [], fallbackTraceId?: StableId): EvalReplayReference => {
  const traceId = trace?.id ?? fallbackTraceId ?? "trace:unavailable" as StableId;
  const firstEvent = failedAssertions.flatMap((entry) => entry.evidence.traceEventIds)[0];
  const first = firstEvent === undefined || trace === undefined ? undefined : trace.events.find((event) => event.id === firstEvent);
  return { sessionId: `replay:${stableSuffix(traceId)}` as StableId, traceId, mode: "historical-replay", available: trace?.status === "complete", ...(firstEvent === undefined ? {} : { firstMismatchEventId: firstEvent }), ...(first === undefined ? {} : { firstMismatchTick: first.tick }) };
};

const invalidCaseResult = (value: EvalCase, candidate: EvalCandidate | undefined, diagnostics: readonly EvalDiagnostic[], resultId: EvalId): EvalCaseResult => {
  const candidateReference = candidate?.reference ?? ref("candidate:unresolved");
  const caseRef = typeof value?.id === "string" && typeof value?.version === "string" ? caseReference(value) : ref("eval:invalid");
  const fixture = value?.fixture;
  const fixtureObject = fixture !== null && typeof fixture === "object" ? fixture : undefined;
  const fixtureRef = fixtureObject !== undefined && typeof fixtureObject.id === "string" && typeof fixtureObject.version === "string" ? fixtureReference(fixtureObject) : ref("fixture:invalid");
  const buildUnits = typeof value?.cost?.build?.units === "number" ? value.cost.build.units : 0;
  const runUnits = typeof value?.cost?.run?.units === "number" ? value.cost.run.units : 0;
  const cost = { buildUnits, runUnits, totalUnits: buildUnits + runUnits };
  const traceId = `trace:invalid-${stableSuffix(typeof value?.id === "string" ? value.id : "eval:invalid")}-${stableSuffix(resultId)}` as StableId;
  const fallbackManifestBase = { schemaVersion: "1" as const, runnerSchemaVersion: "1" as const, traceSchemaVersion: "1" as const, case: caseRef, fixture: fixtureRef, candidate: { ...candidateReference }, dependencies: [] as readonly ContentReference[] };
  const manifest = freeze({ ...fallbackManifestBase, fingerprint: fingerprint(fallbackManifestBase) });
  const replay = replayReference(undefined, [], traceId);
  return freeze({ schemaVersion: "1", resultId, mode: "simulation", caseReference: caseRef, fixtureReference: fixtureRef, candidateReference: { ...candidateReference }, dependencyManifest: manifest, fixtureFingerprint: fixtureObject === undefined ? fingerprint(fixtureRef) : fingerprint(fixtureObject), cost, status: "invalid", reasonCode: diagnostics[0]?.code ?? "EVAL_INVALID", assertions: [], assertionSummary: { total: Array.isArray(value?.assertions) ? value.assertions.length : 0, passed: 0, failed: 0, executed: 0 }, replay, surface: { mode: "simulation", label: "SIMULATION", production: false, paused: true, caseReference: caseRef, traceReference: { id: traceId, version: "1" }, replayReference: replay, accessibleNotice: "SIMULATION: isolated Eval result; production world, Economy, and Persistence were not changed." }, diagnostics });
};

const interruptedCaseResult = (value: EvalCase, candidate: EvalCandidate | undefined, resultId: EvalId): EvalCaseResult => {
  const invalid = invalidCaseResult(value, candidate, [diagnostic("EVAL_INTERRUPTED", "execution", "Eval execution was interrupted before the isolated case started.")], resultId);
  return freeze({ ...invalid, status: "interrupted" as const, reasonCode: "EVAL_INTERRUPTED", diagnostics: [diagnostic("EVAL_INTERRUPTED", "execution", "Eval execution was interrupted before the isolated case started.")] });
};

const runCaseInternal = (value: EvalCase, options: EvalRunOptions): EvalCaseResult => {
  const candidate = options.candidate ?? value?.defaultCandidate;
  const resultId = options.resultId ?? `result:${stableSuffix(typeof value?.id === "string" ? value.id : "eval:invalid")}-${typeof value?.version === "string" ? value.version.replaceAll(".", "-") : "invalid"}` as EvalId;
  const validation = validateEvalCase(value);
  if (!validation.ok) return invalidCaseResult(value, candidate, validation.diagnostics, resultId);
  if (value.availability !== "available") return invalidCaseResult(value, candidate, [diagnostic("EVAL_UNAVAILABLE", "availability", `Eval case ${refKey(value)} is ${value.availability}${value.availabilityReason === undefined ? "." : `: ${value.availabilityReason}`}`)], resultId);
  if (candidate === undefined) return invalidCaseResult(value, undefined, [diagnostic("EVAL_CONTENT_MISSING", "candidate", "No exact candidate was injected for this Eval case.")], resultId);
  const resolved = resolveArtifact(candidate, value.fixture, options.registry);
  if (resolved.diagnostics.length > 0 || resolved.artifacts === undefined) return invalidCaseResult(value, candidate, resolved.diagnostics, resultId);
  const manifest = dependencyManifest(value, candidate, resolved.artifacts, resolved.manifest);
  if (options.shouldInterrupt?.() === true) return interruptedCaseResult(value, candidate, resultId);
  let simulation;
  try {
    simulation = createSimulation(value.fixture.scenario);
  } catch (error) {
    return invalidCaseResult(value, candidate, [diagnostic("EVAL_INVALID", "fixture.scenario", error instanceof Error ? error.message : "Scenario fixture could not be instantiated.")], resultId);
  }
  const assembled = assembleContext({ ...value.fixture.context });
  if (!assembled.ok) return invalidCaseResult(value, candidate, assembled.diagnostics.map((entry) => diagnostic("EVAL_INVALID", "fixture.context", entry.message)), resultId);
  let facts: Readonly<Record<string, import("../instruction/public.js").FactValue>>;
  try {
    const merged = mergeFacts(contextFacts(assembled.afterRetention), value.fixture.facts);
    if (merged.diagnostic !== undefined || merged.facts === undefined) return invalidCaseResult(value, candidate, merged.diagnostic === undefined ? [diagnostic("EVAL_INVALID", "facts", "Could not merge Eval facts.")] : [merged.diagnostic], resultId);
    facts = merged.facts;
  } catch (error) {
    return invalidCaseResult(value, candidate, [diagnostic("EVAL_INVALID", "fixture.context", error instanceof Error ? error.message : "Context facts could not be projected.")], resultId);
  }
  const contextObservation: EvalContextObservation = { before: assembled.beforeRetention, after: assembled.afterRetention, diagnostics: assembled.diagnostics.map((entry) => entry.message) };
  const commands: { decisionTick: number; command: WorldCommand }[] = [];
  const commandResults: CommandResult[] = [];
  const worldEvents: WorldEvent[] = [];
  const worldDeltas: WorldDelta[] = [];
  const tools: EvalToolObservation[] = [];
  const decision = executeInstruction({ artifacts: resolved.artifacts, facts, evidence: value.fixture.evidence, currentTick: value.fixture.context.decisionTick, retryCounts: value.fixture.retryCounts });
  let executionOutcome: EvalOutcomeObservation;
  if (decision.outcome.kind === "tool-request") {
    const command = decision.outcome.command;
    const commandResult = simulation.execute(command);
    commands.push({ decisionTick: command.expectedTick, command });
    commandResults.push(commandResult);
    if (commandResult.accepted) {
      worldEvents.push(...commandResult.events);
      worldDeltas.push(...commandResult.deltas);
    }
    const evidence: readonly (ToolEvidence | InstructionEvidence)[] = commandResult.accepted ? commandResult.evidence.map((entry) => ({ ...entry, observedAtTick: commandResult.resultingTick })) : [];
    tools.push({ command, result: commandResult, evidence });
    executionOutcome = commandResult.accepted ? outcomeFor("complete", "TOOL_REQUEST_ACCEPTED") : outcomeFor("failure", commandResult.diagnostics[0]?.code ?? "TOOL_REQUEST_REJECTED");
  } else if (decision.outcome.kind === "complete") executionOutcome = outcomeFor("complete", decision.outcome.reasonCode);
  else if (decision.outcome.kind === "stop") executionOutcome = outcomeFor("stop", decision.outcome.reasonCode);
  else if (decision.outcome.kind === "escalate") executionOutcome = outcomeFor("escalate", decision.outcome.reasonCode);
  else executionOutcome = outcomeFor("failure", "EVAL_WAIT_NO_TERMINAL_OUTCOME");
  const tickLimit = value.fixture.scenario.initialState.tick + Math.min(value.timeoutTicks, value.fixture.maxTicks);
  const tickRequest = Math.max(0, tickLimit - simulation.snapshot().tick);
  if (tickRequest > 0) {
    const ticks = simulation.requestTicks(tickRequest);
    worldEvents.push(...ticks.events);
    worldDeltas.push(...ticks.deltas);
  }
  const interrupted = options.shouldInterrupt?.() === true;
  const timedOut = !interrupted && executionOutcome.kind === "failure" && executionOutcome.reasonCode === "EVAL_WAIT_NO_TERMINAL_OUTCOME" && simulation.snapshot().tick >= tickLimit;
  if (interrupted) executionOutcome = outcomeFor("interrupted", "EVAL_INTERRUPTED");
  else if (timedOut) executionOutcome = outcomeFor("failure", "EVAL_TIMEOUT");
  const finalState = simulation.snapshot();
  const traceStatus = interrupted ? "interrupted" : timedOut ? "incomplete" : "complete";
  const trace = makeTrace(value, candidate, value.fixture, manifest, contextObservation, decision, tools, executionOutcome, finalState, commands, commandResults, worldDeltas, traceStatus);
  if (trace === undefined) return invalidCaseResult(value, candidate, [diagnostic("EVAL_INVALID", "trace", "Eval trace could not be captured from the isolated execution.")], resultId);
  const observationWithoutTrace: Omit<EvalExecutionObservation, "trace"> = { world: finalState, job: value.fixture.job, context: contextObservation, tools, messages: [], outcome: executionOutcome, decision };
  const observation: EvalExecutionObservation = { ...observationWithoutTrace, trace };
  const assertionResults = interrupted || timedOut ? evaluateAssertions(value.assertions, observation) : evaluateAssertions(value.assertions, observation);
  const passed = assertionResults.filter((entry) => entry.passed).length;
  const failed = assertionResults.length - passed;
  const status: EvalStatus = interrupted ? "interrupted" : timedOut ? "timed-out" : failed > 0 ? "failed" : assertionResults.length === 0 ? "completed" : "passed";
  const replay = replayReference(trace, assertionResults.filter((entry) => !entry.passed));
  const firstFailure = assertionResults.find((entry) => !entry.passed);
  const surface = { mode: "simulation" as const, label: "SIMULATION" as const, production: false as const, paused: true, caseReference: caseReference(value), traceReference: { id: trace.id, version: "1" }, replayReference: replay, accessibleNotice: "SIMULATION: isolated Eval result; production world, Economy, and Persistence were not changed." };
  return freeze({ schemaVersion: "1", resultId, mode: "simulation", caseReference: caseReference(value), fixtureReference: fixtureReference(value.fixture), candidateReference: { ...candidate.reference }, dependencyManifest: manifest, fixtureFingerprint: fingerprint(value.fixture), cost: { buildUnits: value.cost.build.units, runUnits: value.cost.run.units, totalUnits: value.cost.build.units + value.cost.run.units }, status, reasonCode: status === "passed" || status === "completed" ? "EVAL_ASSERTIONS_PASSED" : status === "failed" ? "EVAL_ASSERTION_FAILED" : status === "timed-out" ? "EVAL_TIMEOUT" : "EVAL_INTERRUPTED", assertions: assertionResults, assertionSummary: { total: assertionResults.length, passed, failed, executed: assertionResults.length }, observation, trace, replay, surface, diagnostics: [...(firstFailure === undefined ? [] : [diagnostic("EVAL_ASSERTION_FAILED", `assertions.${firstFailure.id}`, firstFailure.mismatch?.reasonCode ?? "ASSERTION_MISMATCH")])] });
};

export const runEvalCase = (value: EvalCase, options: EvalRunOptions = {}): EvalCaseResult => runCaseInternal(value, options);

const interruptedResult = (value: EvalCase, resultId: EvalId): EvalCaseResult => interruptedCaseResult(value, value.defaultCandidate, resultId);

export function runEvalSuite(cases: readonly EvalCase[], options?: EvalSuiteRunOptions): EvalSuiteResult;
export function runEvalSuite(input: { readonly cases: readonly EvalCase[]; readonly options?: EvalSuiteRunOptions }): EvalSuiteResult;
export function runEvalSuite(input: readonly EvalCase[] | { readonly cases: readonly EvalCase[]; readonly options?: EvalSuiteRunOptions }, directOptions: EvalSuiteRunOptions = {}): EvalSuiteResult {
  let cases: readonly EvalCase[];
  let options: EvalSuiteRunOptions;
  if (!Array.isArray(input) && "cases" in input) {
    cases = input.cases;
    options = input.options ?? {};
  } else {
    cases = input as readonly EvalCase[];
    options = directOptions;
  }
  const results: EvalCaseResult[] = [];
  const progress: EvalProgress[] = [];
  const diagnostics: EvalDiagnostic[] = [];
  const total = cases.length;
  for (const [index, value] of cases.entries()) {
    const reference = typeof value?.id === "string" && typeof value?.version === "string" ? caseReference(value) : ref(`eval:invalid-${index.toString()}`);
    const queued = { caseReference: reference, index, total, status: "queued" as const };
    progress.push(queued);
    options.onProgress?.(queued);
    if (options.shouldInterrupt?.() === true) {
      const interrupted = interruptedResult(value, `result:interrupted-${stableSuffix(value.id)}` as EvalId);
      results.push(interrupted);
      const status = { caseReference: reference, index, total, status: "interrupted" as const };
      progress.push(status);
      options.onProgress?.(status);
      diagnostics.push(...interrupted.diagnostics);
      continue;
    }
    const running = { caseReference: reference, index, total, status: "running" as const };
    progress.push(running);
    options.onProgress?.(running);
    const result = runCaseInternal(value, { ...options, resultId: `result:suite-${stableSuffix(value.id)}-${index.toString()}` as EvalId });
    results.push(result);
    const finished = { caseReference: reference, index, total, status: result.status };
    progress.push(finished);
    options.onProgress?.(finished);
    diagnostics.push(...result.diagnostics);
  }
  const completed = results.filter((entry) => entry.status === "completed" || entry.status === "passed" || entry.status === "failed");
  const passed = results.filter((entry) => entry.status === "passed" || entry.status === "completed").length;
  const failed = results.filter((entry) => entry.status === "failed").length;
  const invalid = results.filter((entry) => entry.status === "invalid").length;
  const timedOut = results.filter((entry) => entry.status === "timed-out").length;
  const interrupted = results.filter((entry) => entry.status === "interrupted").length;
  const resultId = `result:suite-${options.suiteReference === undefined ? "selection" : stableSuffix(options.suiteReference.id)}` as EvalId;
  return freeze({ schemaVersion: "1", resultId, mode: "simulation", ...(options.suiteReference === undefined ? {} : { suiteReference: { ...options.suiteReference } }), selectedCases: cases.map(caseReference), results, progress, summary: { totalSelected: cases.length, completed: completed.length, passed, failed, invalid, timedOut, interrupted, ...(completed.length === 0 ? {} : { passRate: passed / completed.length }) }, surface: { mode: "simulation", label: "SIMULATION", production: false, accessibleNotice: "SIMULATION: every selected case ran in its own isolated environment; production world, Economy, and Persistence were not changed." }, diagnostics });
}

const comparisonJson = (value: unknown): JsonValue => asJson(value) ?? null;
const compareField = (differences: EvalComparisonDifference[], category: EvalComparisonDifference["category"], path: string, left: unknown, right: unknown): void => {
  if (!equalValue(left, right)) differences.push({ category, path, left: comparisonJson(left), right: comparisonJson(right) });
};

export const compareEvalResults = (left: EvalCaseResult, right: EvalCaseResult): EvalComparison => {
  const differences: EvalComparisonDifference[] = [];
  const compatible = refKey(left.caseReference) === refKey(right.caseReference) && refKey(left.fixtureReference) === refKey(right.fixtureReference) && refKey(left.candidateReference) === refKey(right.candidateReference) && left.dependencyManifest.fingerprint === right.dependencyManifest.fingerprint;
  if (!compatible) differences.push({ category: "dependency", path: "dependencyManifest", left: left.dependencyManifest.fingerprint, right: right.dependencyManifest.fingerprint });
  const leftAssertions = new Map(left.assertions.map((entry) => [entry.id, entry]));
  const rightAssertions = new Map(right.assertions.map((entry) => [entry.id, entry]));
  const changedAssertions: EvalId[] = [];
  for (const id of [...new Set([...leftAssertions.keys(), ...rightAssertions.keys()])].sort(lexical)) {
    const leftAssertion = leftAssertions.get(id);
    const rightAssertion = rightAssertions.get(id);
    if (leftAssertion === undefined || rightAssertion === undefined) {
      changedAssertions.push(id);
      differences.push({ category: "assertion", path: `assertions.${id}`, left: comparisonJson(leftAssertion), right: comparisonJson(rightAssertion) });
      continue;
    }
    if (!equalValue(leftAssertion, rightAssertion)) {
      changedAssertions.push(id);
      differences.push({ category: "assertion", path: `assertions.${id}`, left: comparisonJson(leftAssertion), right: comparisonJson(rightAssertion) });
    }
  }
  compareField(differences, "outcome", "status", left.status, right.status);
  compareField(differences, "outcome", "reasonCode", left.reasonCode, right.reasonCode);
  compareField(differences, "context", "observation.context", left.observation?.context, right.observation?.context);
  compareField(differences, "action", "observation.tools", left.observation?.tools, right.observation?.tools);
  compareField(differences, "cost", "cost", left.cost, right.cost);
  const traceComparison = left.trace === undefined || right.trace === undefined ? undefined : compareTraces(left.trace, right.trace);
  if (traceComparison !== undefined && traceComparison.differences.length > 0) differences.push({ category: "trace", path: "trace", left: comparisonJson(traceComparison.differences), right: comparisonJson([]) });
  return freeze({ schemaVersion: "1", compatible, leftResultId: left.resultId, rightResultId: right.resultId, changedAssertions, differences, ...(traceComparison === undefined ? {} : { traceComparison }) });
};

export const rerunEvalCase = (prior: EvalCaseResult, value: EvalCase, options: EvalRunOptions = {}): import("./types.js").EvalRerunResult => {
  const diagnostics: EvalDiagnostic[] = [];
  if (refKey(prior.caseReference) !== refKey(caseReference(value)) || refKey(prior.fixtureReference) !== refKey(fixtureReference(value.fixture))) diagnostics.push(diagnostic("EVAL_COMPARISON_BLOCKED", "caseReference", "Rerun requires the exact historical case and fixture versions."));
  const candidate = options.candidate ?? value.defaultCandidate;
  if (candidate === undefined || refKey(prior.candidateReference) !== refKey(candidate.reference)) diagnostics.push(diagnostic("EVAL_COMPARISON_BLOCKED", "candidateReference", "Rerun requires the exact historical candidate version."));
  if (prior.dependencyManifest.resolvedContent !== undefined && options.registry === undefined) diagnostics.push(diagnostic("EVAL_COMPARISON_BLOCKED", "dependencyManifest", "Historical exact dependencies require a resolver before rerun."));
  if (candidate !== undefined && options.registry !== undefined) {
    const exactCandidate = options.registry.resolveExact(candidate.reference.id, candidate.reference.version);
    if (!exactCandidate.ok) diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", "candidateReference", `Exact candidate ${refKey(candidate.reference)} is no longer resolvable.`));
    for (const artifactReference of candidate.artifactReferences) {
      const exactArtifact = options.registry.resolveExact(artifactReference.id, artifactReference.version);
      if (!exactArtifact.ok) diagnostics.push(diagnostic("EVAL_CONTENT_MISSING", "candidate.artifactReferences", `Exact artifact ${refKey(artifactReference)} is no longer resolvable.`));
    }
  }
  if (diagnostics.length > 0) return { ok: false, prior, diagnostics: freeze(diagnostics) };
  const rerun = runCaseInternal(value, { ...options, candidate, resultId: `result:rerun-${stableSuffix(prior.resultId)}` as EvalId });
  return { ok: true, prior, rerun, comparison: compareEvalResults(prior, rerun) };
};

export const createEvalOpeningCase = (): EvalCase => {
  const gateControl = { id: "tool:gate-control", version: "1.0.0" };
  const gateObserve = { id: "tool:gate-observe", version: "1.0.0" };
  const scenarioReference = { id: "scenario:opening-maintenance-context", version: "1.0.0" };
  const scenario: ScenarioFixture = {
    schemaVersion: "1",
    scenario: scenarioReference,
    exactContent: [gateControl, gateObserve],
    allowedCommandKinds: ["observe-gate", "operate-gate"],
    initialState: {
      schemaVersion: "1", scenario: scenarioReference, tick: 0, paused: false, speed: 1, seed: 1601, randomStreams: [{ name: "behavior", state: 1601, consumed: 0 }, { name: "weather", state: 1601, consumed: 0 }], eventSequence: 0,
      locations: [
        { id: "location:beta-enclosure", kind: "enclosure", enclosureId: "enclosure:beta" },
        { id: "location:beta-path", kind: "path" },
        { id: "location:beta-safe", kind: "safe-zone" },
        { id: "location:beta-service", kind: "service" },
      ],
      enclosureBoundaries: [{ id: "boundary:beta", enclosureId: "enclosure:beta", edgeIds: ["edge:beta-path"], gateIds: ["gate:beta"] }],
      navigationEdges: [{ id: "edge:beta-path", from: "location:beta-enclosure", to: "location:beta-path", gateId: "gate:beta" }, { id: "edge:beta-safe", from: "location:beta-path", to: "location:beta-safe" }, { id: "edge:beta-service", from: "location:beta-path", to: "location:beta-service" }],
      gates: [{ id: "gate:beta", locationA: "location:beta-enclosure", locationB: "location:beta-path", position: "open", locked: false, jammed: false, closer: "disabled", sensorReading: "open", sensorHealth: "healthy", accessZones: ["zone:keepers"] }],
      robots: [{ id: "robot:alpha", locationId: "location:beta-path", toolRefs: [gateControl, gateObserve], carried: [], battery: 100, health: 100, action: "idle", accessZones: ["zone:keepers"] }],
      dinosaurs: [{ id: "dinosaur:stella", species: "Triceratops", locationId: "location:beta-enclosure", homeEnclosureId: "location:beta-enclosure", contained: true, hunger: 40, agitation: 10, allowedTerrain: ["enclosure", "path"], hazardInteraction: "avoid" }],
      visitors: [{ id: "visitor:morning", locationId: "location:beta-path", size: 8, panic: 0, evacuating: false, safety: "safe" }],
      hazards: [{ id: "hazard:maintenance", locationId: "location:beta-service", severity: 0, active: false }],
      weather: { condition: "clear", intensity: 0 },
      tools: [{ reference: gateControl, capability: "gate-control", batteryCost: 1, requiresSameLocation: true }, { reference: gateObserve, capability: "gate-observation", batteryCost: 1, requiresSameLocation: true }],
      scheduled: [], activeActions: [],
    },
  };
  const maintenanceItem = { id: "context:maintenance-policy", category: "Policy" as const, provenance: { source: "maintenance-record", routeId: "route:maintenance-policy" }, sourceVersion: { id: "content:maintenance-policy", version: "1.0.0" }, cost: 3, createdTick: 0, priority: 100, retentionEligible: false, pinned: true, payload: { reference: "content:maintenance-policy@1.0.0", facts: { "gate.maintenance": "closer-disabled" } }, quality: { relevance: "relevant" as const } };
  const gateItem = { id: "context:gate-state", category: "Observation" as const, provenance: { source: "gate-sensor", routeId: "route:gate-state" }, sourceVersion: { id: "content:gate-state", version: "1.0.0" }, cost: 2, createdTick: 0, priority: 80, retentionEligible: true, pinned: false, payload: { reference: "gate:beta", facts: { "gate.position": "open" } }, quality: { relevance: "relevant" as const } };
  const taskItem = { id: "context:maintenance-task", category: "Task" as const, provenance: { source: "eval-task", routeId: "route:maintenance-task" }, sourceVersion: { id: "task:maintenance-context", version: "1.0.0" }, cost: 2, createdTick: 0, priority: 90, retentionEligible: false, pinned: true, payload: { reference: "task:maintenance-context", facts: { "task.kind": "containment" } }, quality: { relevance: "relevant" as const } };
  const closeCommand: WorldCommand = { id: "command:close-maintenance-gate", kind: "operate-gate", expectedTick: 0, actorId: "robot:alpha", gateId: "gate:beta", operation: "close", tool: gateControl };
  const candidateArtifact: ResolvedInstructionArtifact = { reference: { id: "prompt:opening-maintenance-revised", version: "1.0.0" }, class: "Prompt", readableSource: "Close an open gate when maintenance has disabled its automatic closer.", author: "Park Engineering", contextCost: 4, dependencies: [], requiredTools: [gateControl], knownTradeoffs: ["Requires maintenance Context before acting."], clauses: [{ id: "clause:close-disabled-closer", type: "action", applicability: { operator: "fact-equals", fact: "task.kind", value: "containment" }, priority: 100, requiredFacts: ["task.kind", "gate.position", "gate.maintenance"], preconditions: [{ operator: "all", expressions: [{ operator: "fact-equals", fact: "gate.position", value: "open" }, { operator: "fact-equals", fact: "gate.maintenance", value: "closer-disabled" }] }], postconditions: [{ operator: "fact-equals", fact: "gate.position", value: "closed" }], conflictResolution: "select", outcome: { kind: "tool-request", command: closeCommand } }] };
  const candidate: EvalCandidate = { reference: candidateArtifact.reference, artifactReferences: [candidateArtifact.reference], artifacts: [candidateArtifact] };
  const fixture: EvalFixture = { schemaVersion: "1", id: "fixture:opening-maintenance-context", version: "1.0.0", scenario, job: { id: "job:eval-maintenance-context", taskId: "task:maintenance-context", agentId: "agent:robot-alpha", targetId: "gate:beta", goal: "Restore containment when the automatic closer is disabled for maintenance." }, context: { agentId: "agent:robot-alpha", jobId: "job:eval-maintenance-context", decisionTick: 0, capacity: 12, routes: [{ id: "route:gate-state", itemId: gateItem.id, required: true, applicable: true }, { id: "route:maintenance-policy", itemId: maintenanceItem.id, required: true, applicable: true }, { id: "route:maintenance-task", itemId: taskItem.id, required: true, applicable: true }], availableSources: [gateItem, maintenanceItem, taskItem], priorRetained: [], additions: [], retentionPolicy: "Strict" }, candidateInjection: { point: "instruction-artifacts", requiredArtifactClasses: ["Prompt"] }, facts: {}, evidence: [], maxTicks: 2 };
  return { schemaVersion: "1", id: "eval:opening-maintenance-context", version: "1.0.0", title: "Maintenance Context restores containment", description: "The free opening Eval proves that a revised candidate receives the disabled-closer record before acting.", category: "context-boundary", risk: "high", availability: "available", oneTime: true, fixture, assertions: [{ id: "assertion:gate-closed", subject: "world", path: "gates.gate:beta.position", operator: "equals", expected: "closed", evidenceKinds: ["world-delta"] }, { id: "assertion:closer-remains-disabled", subject: "world", path: "gates.gate:beta.closer", operator: "equals", expected: "disabled" }, { id: "assertion:maintenance-routed", subject: "context", path: "after.entries.context:maintenance-policy.lifecycle", operator: "equals", expected: "included" }, { id: "assertion:eval-trace", subject: "trace", path: "mode", operator: "equals", expected: "eval" }, { id: "assertion:completed", subject: "outcome", path: "kind", operator: "equals", expected: "complete" }], timeoutTicks: 2, cost: { build: { id: "cost:opening-eval-build", kind: "build", units: 0, label: "Free opening Eval authoring" }, run: { id: "cost:opening-eval-run", kind: "run", units: 0, label: "Free opening Eval run" } }, defaultCandidate: candidate, previousResultIds: [] };
};

export const createOpeningMaintenanceContextEvalCase = createEvalOpeningCase;
export const runOpeningMaintenanceContextEval = (options: EvalRunOptions = {}): EvalCaseResult => runEvalCase(createEvalOpeningCase(), options);
