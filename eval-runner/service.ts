import { createContextService } from "../context/index.ts";
import { createCreditLedger } from "../economy-progression/index.ts";
import type { CreditCommand, CreditLedger, CreditResult } from "../economy-progression/index.ts";
import { createInstructionEngine } from "../instruction/index.ts";
import type { AgentDefinition, InstructionContentPort, InstructionJob, JobOutcome } from "../instruction/index.ts";
import { canonicalSerialize, createSimulationEngine, deepClone, deepFreeze } from "../simulation/index.ts";
import type { WorldEvent, WorldFixture } from "../simulation/index.ts";
import { createTraceRepository, stableHash } from "../trace-replay/index.ts";
import type { ReplayManifest, TraceRecord, TraceSink, TraceOutcome } from "../trace-replay/index.ts";
import type { ArtifactRef, EvalCaseDefinition } from "../content-registry/index.ts";
import {
  evaluateAssertions,
  validateEvalAssertion,
} from "./assertions.ts";
import type {
  BuiltEval,
  EvalBatchResult,
  EvalCatalogEntry,
  EvalCatalogQuery,
  EvalCaseResult,
  EvalExecutionOutput,
  EvalExecutionPorts,
  EvalRef,
  EvalRegistryPort,
  EvalRunRequest,
  EvalService,
  EvalServiceOptions,
  EvalPersistenceState,
  EvalSuite,
  EvalSuiteInput,
  EvalSuiteResult,
  EvalSuiteUpdate,
  EvalSubject,
  EvalBuildError,
  IncidentEvalError,
  IncidentEvalInput,
  ValidationError,
  IsolatedRuntime,
} from "./types.ts";
import { evalRefFromDefinition, evalRefKey } from "./types.ts";
import { MVP_EVAL_CATALOG } from "./catalog.ts";

type BuildState = {
  readonly definition: EvalCaseDefinition;
  built: boolean;
  builtEval?: BuiltEval;
};

function freeze<T>(value: T): T {
  return deepFreeze(value);
}

function stableRefs(refs: readonly EvalRef[]): readonly EvalRef[] {
  const seen = new Set<string>();
  const result: EvalRef[] = [];
  for (const ref of refs) {
    const key = evalRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: ref.id, version: ref.version });
  }
  return Object.freeze(result);
}

function artifactKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function stableArtifactRefs(refs: readonly ArtifactRef[]): readonly ArtifactRef[] {
  const byKey = new Map(refs.map((ref) => [artifactKey(ref), { artifactId: ref.artifactId, version: ref.version }]));
  return Object.freeze([...byKey.values()].sort((a, b) => artifactKey(a).localeCompare(artifactKey(b))));
}

function asRegistry(value: EvalRegistryPort | undefined): EvalRegistryPort | undefined {
  return value && typeof value.queryEvals === "function" ? value : undefined;
}

function severityFor(definition: EvalCaseDefinition): number {
  const tagged = definition.tags.find((tag) => /^severity[:=]/i.test(tag));
  if (!tagged) return 0;
  const value = Number(tagged.split(/[:=]/)[1]);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function definitionErrors(definition: EvalCaseDefinition): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  if (!definition.id || !/^[a-z][a-z0-9._-]*$/.test(definition.id)) errors.push({ code: "INVALID_ID", path: "id", message: "Eval id must be a stable lowercase identifier." });
  if (!Number.isSafeInteger(definition.version) || definition.version <= 0) errors.push({ code: "INVALID_VERSION", path: "version", message: "Eval version must be a positive safe integer." });
  if (!definition.title.trim()) errors.push({ code: "INVALID_TITLE", path: "title", message: "Eval title is required." });
  if (!Number.isSafeInteger(definition.buildCostCredits) || definition.buildCostCredits <= 0) errors.push({ code: "INVALID_COST", path: "buildCostCredits", message: "Build cost must be a positive safe integer." });
  if (!Number.isSafeInteger(definition.runCostCredits) || definition.runCostCredits <= 0) errors.push({ code: "INVALID_COST", path: "runCostCredits", message: "Run cost must be a positive safe integer." });
  if (!definition.fixture || typeof definition.fixture.id !== "string") errors.push({ code: "INVALID_FIXTURE", path: "fixture", message: "A complete deterministic fixture is required." });
  if (!Number.isFinite(definition.seed)) errors.push({ code: "INVALID_SEED", path: "seed", message: "Eval seed must be finite." });
  if (definition.assertions.length === 0) errors.push({ code: "ASSERTIONS_REQUIRED", path: "assertions", message: "At least one expected assertion is required." });
  for (const [index, assertion] of definition.assertions.entries()) for (const error of validateEvalAssertion(assertion, `assertions[${index}]`)) errors.push(error);
  return Object.freeze(errors);
}

function defaultAgent(fixture: WorldFixture): AgentDefinition {
  const robot = fixture.agents[0];
  if (!robot) return { id: "agent.eval", contextBudget: 8_000, toolIds: [] };
  return {
    id: robot.id,
    name: robot.id,
    role: "WORKER",
    contextBudget: robot.contextBudget,
    toolIds: robot.tools,
    tools: robot.tools,
  };
}

function targetRefs(fixture: WorldFixture): readonly string[] {
  const existing = fixture.jobs?.[0]?.targetRefs;
  if (existing && existing.length > 0) return existing;
  const carnivore = fixture.dinosaurs.find((dinosaur) => dinosaur.archetype === "CARNIVORE");
  return [carnivore ?? fixture.dinosaurs[0]].filter((dinosaur): dinosaur is NonNullable<typeof dinosaur> => dinosaur !== undefined).map((dinosaur) => dinosaur.id);
}

function subjectFor(definition: EvalCaseDefinition, request: EvalRunRequest): EvalSubject {
  if (request.subject) return freeze({ ...request.subject, ...(request.subject.ref ? { ref: { ...request.subject.ref } } : {}) });
  return freeze({
    type: request.subjectType ?? definition.subjectType,
    ...(request.subjectRef ? { ref: { ...request.subjectRef } } : definition.subjectRef ? { ref: { ...definition.subjectRef } } : {}),
    ...(request.agentDefinition ? { agentDefinition: deepClone(request.agentDefinition) } : {}),
  });
}

function refsForSubject(subject: EvalSubject, agent: AgentDefinition): readonly ArtifactRef[] {
  return stableArtifactRefs([
    ...(subject.ref ? [subject.ref] : []),
    ...(agent.skillRefs ?? []),
    ...(agent.systemPromptRefs ?? []),
  ]);
}

function buildManifest(definition: EvalCaseDefinition, subject: EvalSubject, fixture: WorldFixture, agent: AgentDefinition, options: EvalServiceOptions, manifestOverride?: ReplayManifest): ReplayManifest {
  const ref = evalRefFromDefinition(definition);
  const assignedAgentId = agent.id;
  const executablePromptRef = subject.type === "PROMPT" && subject.ref
    ? subject.ref
    : definition.subjectType === "PROMPT" ? definition.subjectRef : undefined;
  const jobBase: InstructionJob = {
    id: `eval.job.${ref.id}.${ref.version}`,
    type: `EVAL_${definition.id}`,
    targetRefs: targetRefs(fixture),
    priority: 100,
    dueTime: 10_000,
    assignedAgentId,
    ...(executablePromptRef ? { promptRef: executablePromptRef } : {}),
    ...(subject.type === "SKILL" && subject.ref ? { skillRefs: [subject.ref] } : {}),
    ...(subject.type === "SYSTEM_PROMPT" && subject.ref ? { systemPromptRefs: [subject.ref] } : {}),
  };
  const base: Partial<ReplayManifest> = manifestOverride ? deepClone(manifestOverride) : {};
  const job = base.job ? { ...base.job, ...jobBase, id: jobBase.id, assignedAgentId } : jobBase;
  return freeze({
    ...base,
    schemaVersion: 1,
    id: `eval.manifest.${ref.id}.${ref.version}`,
    fixtureRef: fixture.id,
    fixture: deepClone(fixture),
    seed: definition.seed,
    artifactRefs: stableArtifactRefs([...(base.artifactRefs ?? base.artifactVersions ?? []), ...(executablePromptRef ? [executablePromptRef] : []), ...refsForSubject(subject, agent)]),
    artifactVersions: stableArtifactRefs([...(base.artifactRefs ?? base.artifactVersions ?? []), ...(executablePromptRef ? [executablePromptRef] : []), ...refsForSubject(subject, agent)]),
    agentDefinition: deepClone(agent),
    job,
    engineVersion: options.engineVersion,
    contentManifestVersion: options.contentManifestVersion,
    contextSchemaVersion: options.contextSchemaVersion,
  });
}

function extractToolCalls(events: readonly WorldEvent[]): readonly string[] {
  const calls = events
    .filter((event) => event.type === "COMMAND_SCHEDULED" || event.type === "TOOL_COMPLETED")
    .map((event) => {
      const action = event.payload.action ?? event.payload.tool;
      return typeof action === "string" ? action : undefined;
    })
    .filter((action): action is string => action !== undefined);
  return Object.freeze(calls);
}

function traceOutcome(outcome: JobOutcome | undefined, reason: string): TraceOutcome {
  return outcome ? { ...outcome } : { status: "BLOCKED", reasonCode: reason };
}

function getTraceRecord(sink: TraceSink, traceId: string): TraceRecord | undefined {
  const candidate = sink as TraceSink & { get?: (id: string) => TraceRecord | undefined };
  return candidate.get?.(traceId);
}

function defaultRuntimeFactory(options: EvalServiceOptions, sink: TraceSink, contextFactory = createContextService): (manifest: ReplayManifest) => IsolatedRuntime {
  return (manifest) => ({
    run: () => {
      const simulation = createSimulationEngine();
      const fixture = manifest.fixture;
      if (!fixture) return { error: "MISSING_FIXTURE", replayManifest: manifest };
      const loaded = simulation.load(deepClone(fixture), manifest.seed);
      if (!loaded.ok) return { error: `INVALID_FIXTURE:${loaded.error.map((item) => item.path).join(",")}`, replayManifest: manifest };
      const traceId = sink.begin({
        traceId: `trace.eval.${manifest.id ?? manifest.fixtureRef ?? "case"}.${manifest.seed}`,
        executionId: manifest.job ? `execution.${manifest.job.id}` : undefined,
        jobId: manifest.job?.id,
        agentId: manifest.agentDefinition?.id,
        startLogicalTime: 0,
        fixtureRef: manifest.fixtureRef,
        seed: manifest.seed,
        artifactRefs: manifest.artifactRefs,
        ...(manifest.contextSnapshot ? { contextSnapshot: manifest.contextSnapshot } : {}),
        replayManifest: manifest,
        schemaVersion: 1,
        engineVersion: options.engineVersion,
        contentManifestVersion: options.contentManifestVersion,
        contextSchemaVersion: options.contextSchemaVersion,
      });
      const content = options.registry as unknown as InstructionContentPort | undefined;
      if (!content || typeof content.getArtifact !== "function") {
        sink.finalize(traceId, traceOutcome(undefined, "CONTENT_PORT_UNAVAILABLE"));
        return { error: "CONTENT_PORT_UNAVAILABLE", traceRef: traceId, replayManifest: manifest };
      }
      const context = contextFactory();
      const engine = createInstructionEngine({
        content,
        context,
        simulation,
        provenance: { append: (event) => sink.append(traceId, event) },
      });
      const agent = manifest.agentDefinition ?? defaultAgent(fixture);
      const job = manifest.job;
      if (!job) {
        sink.finalize(traceId, traceOutcome(undefined, "MISSING_JOB"));
        return { error: "MISSING_JOB", traceRef: traceId, replayManifest: manifest };
      }
      const prepared = engine.prepare(job, agent);
      if (!prepared.ok) {
        sink.finalize(traceId, traceOutcome(undefined, prepared.error.code));
        return { error: `${prepared.error.code}:${prepared.error.diagnostics.join(" | ")}`, traceRef: traceId, replayManifest: manifest, contextLoad: prepared.error.context?.totalLoad, contextBudget: prepared.error.context?.budget };
      }
      const started = engine.start(prepared.value);
      const done = engine.runToCompletion(started.executionId);
      if (!done.outcome) {
        sink.finalize(traceId, traceOutcome(undefined, "INCOMPLETE_EXECUTION"));
        return { error: "INCOMPLETE_EXECUTION", traceRef: traceId, replayManifest: manifest, events: simulation.events(), contextLoad: prepared.value.contextSnapshot.totalLoad, contextBudget: prepared.value.contextSnapshot.budget };
      }
      sink.finalize(traceId, done.outcome);
      const trace = getTraceRecord(sink, traceId);
      const finalSnapshot = simulation.snapshot();
      const events = simulation.events();
      const completedAtLogicalTime = finalSnapshot.logicalTime;
      const output: EvalExecutionOutput = {
        outcome: done.outcome,
        finalSnapshot,
        events,
        ...(trace ? { trace } : {}),
        traceRef: traceId,
        replayManifest: freeze({ ...manifest, expectedTraceEvents: trace?.events, expectedFinalSnapshot: finalSnapshot }),
        contextLoad: prepared.value.contextSnapshot.totalLoad,
        contextBudget: prepared.value.contextSnapshot.budget,
        durationLogicalTime: Math.max(0, completedAtLogicalTime - (manifest.contextSnapshot?.createdAtLogicalTime ?? 0)),
        toolCalls: extractToolCalls(events),
      };
      return output;
    },
  });
}

function runErrorResult(definition: EvalCaseDefinition, subject: EvalSubject, status: EvalCaseResult["status"], runTransactionId: string, start: number, error: string, output?: EvalExecutionOutput): EvalCaseResult {
  return freeze({
    id: `eval.result.${evalRefKey(evalRefFromDefinition(definition))}.${runTransactionId}`,
    ref: evalRefFromDefinition(definition),
    caseRef: evalRefFromDefinition(definition),
    subject,
    status,
    passed: false,
    assertions: [],
    expectedAssertions: definition.assertions,
    fixtureId: definition.fixture.id,
    seed: definition.seed,
    ...(subject.ref ? { subjectRef: subject.ref } : {}),
    buildCostCredits: definition.buildCostCredits,
    runCostCredits: definition.runCostCredits,
    runTransactionId,
    ...(output?.traceRef ? { traceRef: output.traceRef } : {}),
    ...(output?.replayManifest ? { replayManifest: output.replayManifest } : {}),
    canonicalHash: stableHash({ caseRef: evalRefFromDefinition(definition), subject, status, error, fixtureId: definition.fixture.id, seed: definition.seed }),
    startLogicalTime: start,
    completionLogicalTime: start,
    error,
    reasonCode: status,
    ...(output ? { output } : {}),
  });
}

function invalidRunResult(ref: EvalRef, request: EvalRunRequest, runTransactionId: string, start: number, error: string): EvalCaseResult {
  const subject: EvalSubject = freeze({
    type: request.subject?.type ?? request.subjectType ?? "PROMPT",
    ...(request.subject?.ref ? { ref: request.subject.ref } : request.subjectRef ? { ref: request.subjectRef } : {}),
    ...(request.subject?.agentDefinition ? { agentDefinition: request.subject.agentDefinition } : request.agentDefinition ? { agentDefinition: request.agentDefinition } : {}),
  });
  return freeze({
    id: `eval.result.${evalRefKey(ref)}.${runTransactionId}`,
    ref: { ...ref },
    caseRef: { ...ref },
    subject,
    status: "BLOCKED_INPUT",
    passed: false,
    assertions: [],
    expectedAssertions: [],
    fixtureId: "unavailable",
    seed: 0,
    ...(subject.ref ? { subjectRef: subject.ref } : {}),
    buildCostCredits: 0,
    runCostCredits: 0,
    runTransactionId,
    canonicalHash: stableHash({ ref, subject, status: "BLOCKED_INPUT", error }),
    startLogicalTime: start,
    completionLogicalTime: start,
    error,
    reasonCode: "INVALID_CASE_REF",
  });
}

function chargeMismatch(command: CreditCommand, result: CreditResult): string | undefined {
  if (!result.ok) return undefined;
  const expectedKey = command.correlationKey ?? command.transactionId;
  if (result.entry.idempotencyKey !== expectedKey) return `Transaction result key ${result.entry.idempotencyKey} does not match ${expectedKey}.`;
  if (result.entry.type !== command.type) return `Transaction result type ${result.entry.type} does not match ${command.type}.`;
  if (result.entry.amount !== command.amount) return `Transaction result amount ${result.entry.amount} does not match ${command.amount}.`;
  if (result.entry.sourceRef !== command.sourceRef) return `Transaction result source ${result.entry.sourceRef} does not match ${command.sourceRef}.`;
  return undefined;
}

function validationError(code: string, path: string, message: string): ValidationError {
  return { code, path, message };
}

/** Headless eval catalog, runner, assertion registry, suite state, and
 * incident conversion implementation. All runtime work receives an isolated
 * fixture through a public port; it never receives a live simulation engine. */
export function createEvalService(options: EvalServiceOptions = {}): EvalService {
  const registry = asRegistry(options.registry);
  const definitions = new Map<string, BuildState>();
  const registryDefinitions = registry?.queryEvals?.() ?? [];
  const sourceDefinitions = options.catalog ?? (registryDefinitions.length > 0 ? registryDefinitions : MVP_EVAL_CATALOG);
  for (const definition of sourceDefinitions) {
    const key = evalRefKey(evalRefFromDefinition(definition));
    if (!definitions.has(key)) {
      const immutableDefinition = freeze(deepClone(definition));
      const initiallyBuilt = definition.built === true;
      definitions.set(key, {
        definition: immutableDefinition,
        built: initiallyBuilt,
        ...(initiallyBuilt ? { builtEval: freeze({ ref: evalRefFromDefinition(immutableDefinition), definition: immutableDefinition, buildTransactionId: "authored", builtAtLogicalTime: options.logicalTime ?? 0, canonicalHash: stableHash({ ref: evalRefFromDefinition(immutableDefinition), definition: immutableDefinition }) }) } : {}),
      });
    }
  }
  const suitesById = new Map<string, EvalSuite>();
  const resultsById = new Map<string, EvalCaseResult>();
  const resultsByRef = new Map<string, EvalCaseResult[]>();
  const incidentManifests = new Map<string, ReplayManifest>();
  const buildTransactions = new Map<string, string>();
  const incidentConversions = new Map<string, { readonly ref: EvalRef; readonly fingerprint: string }>();
  const incidentTransactions = new Map<string, string>();
  const defaultLedger: CreditLedger = createCreditLedger(options.openingCredits ?? 25_000, options.logicalTime ?? 0);
  const execution: EvalExecutionPorts = options.executionPorts ?? options.execution ?? {};
  const charge = execution.charge ?? ((command: CreditCommand) => defaultLedger.transact(command));
  const balance = execution.balance ?? (() => defaultLedger.balance());
  const traceRepository = execution.recordTrace ?? createTraceRepository();
  const runtimeFactory = execution.createIsolatedRuntime ?? defaultRuntimeFactory(options, traceRepository);
  let requestSequence = 0;

  function entryFor(state: BuildState): EvalCatalogEntry {
    const ref = evalRefFromDefinition(state.definition);
    const last = resultsByRef.get(evalRefKey(ref))?.at(-1);
    return freeze({ ref, definition: state.definition, buildStatus: state.built ? "BUILT" : "UNBUILT", built: state.built, buildCostCredits: state.definition.buildCostCredits, runCostCredits: state.definition.runCostCredits, severityCoverage: severityFor(state.definition), ...(last ? { lastResult: last } : {}) });
  }

  function getState(ref: EvalRef): BuildState | undefined { return definitions.get(evalRefKey(ref)); }

  function catalog(query: EvalCatalogQuery = {}): readonly EvalCatalogEntry[] {
    const entries = [...definitions.values()].map(entryFor).filter((entry) => {
      const definition = entry.definition;
      if (query.id !== undefined && definition.id !== query.id) return false;
      if (query.version !== undefined && definition.version !== query.version) return false;
      if (query.tag !== undefined && !definition.tags.includes(query.tag)) return false;
      if (query.severity !== undefined && entry.severityCoverage !== query.severity) return false;
      if (query.subjectType !== undefined && definition.subjectType !== query.subjectType) return false;
      if (query.built !== undefined && entry.built !== query.built) return false;
      if (query.search !== undefined && !`${definition.id} ${definition.title} ${definition.description}`.toLowerCase().includes(query.search.toLowerCase())) return false;
      return true;
    });
    return Object.freeze(entries.sort((a, b) => evalRefKey(a.ref).localeCompare(evalRefKey(b.ref))));
  }

  function build(ref: EvalRef, transactionId: string, logicalTime = options.logicalTime ?? 0): { readonly ok: true; readonly value: BuiltEval } | { readonly ok: false; readonly error: EvalBuildError } {
    const state = getState(ref);
    if (!state) return { ok: false, error: { code: "UNKNOWN_EVAL", message: `Eval ${evalRefKey(ref)} is not in the catalog.`, ref } };
    if (state.built && state.builtEval) return { ok: true, value: state.builtEval };
    if (!transactionId.trim()) return { ok: false, error: { code: "INVALID_TRANSACTION", message: "A build transaction id is required.", ref } };
    const priorRef = buildTransactions.get(transactionId);
    if (priorRef && priorRef !== evalRefKey(ref)) return { ok: false, error: { code: "INVALID_TRANSACTION", message: `Build transaction ${transactionId} is already bound to ${priorRef}; it cannot unlock ${evalRefKey(ref)}.`, ref, transactionId } };
    const priorIncident = incidentTransactions.get(transactionId);
    if (priorIncident && !state.built) return { ok: false, error: { code: "INVALID_TRANSACTION", message: `Build transaction ${transactionId} is already bound to incident ${priorIncident}.`, ref, transactionId } };
    const definitionDiagnostics = definitionErrors(state.definition);
    if (definitionDiagnostics.length > 0) return { ok: false, error: { code: "INVALID_DEFINITION", message: definitionDiagnostics.map((item) => `${item.path}: ${item.message}`).join("; "), ref } };
    if (state.definition.subjectRef && registry?.getArtifact && !registry.getArtifact(state.definition.subjectRef)) return { ok: false, error: { code: "CONTENT_UNAVAILABLE", message: `Exact subject ${artifactKey(state.definition.subjectRef)} is unavailable; current content was not substituted.`, ref } };
    let command: CreditCommand;
    let charged: CreditResult;
    try {
      command = { transactionId, type: "EVAL_BUILD", amount: -state.definition.buildCostCredits, logicalTime, sourceRef: `eval-build:${evalRefKey(ref)}`, expectedBalanceVersion: balance().version };
      charged = charge(command);
    } catch (cause) {
      return { ok: false, error: { code: "TRANSACTION_FAILED", message: `Build transaction failed: ${cause instanceof Error ? cause.message : String(cause)}`, ref, transactionId } };
    }
    if (!charged.ok) return { ok: false, error: { code: charged.error.code === "INSUFFICIENT_FUNDS" ? "INSUFFICIENT_FUNDS" : charged.error.code === "BALANCE_VERSION_CONFLICT" ? "BALANCE_VERSION_CONFLICT" : "TRANSACTION_FAILED", message: charged.error.message, ref, transactionId } };
    const mismatch = chargeMismatch(command, charged);
    if (mismatch) return { ok: false, error: { code: "INVALID_TRANSACTION", message: mismatch, ref, transactionId } };
    buildTransactions.set(transactionId, evalRefKey(ref));
    const built: BuiltEval = freeze({ ref: { ...ref }, definition: state.definition, buildTransactionId: transactionId, builtAtLogicalTime: logicalTime, canonicalHash: stableHash({ ref, definition: state.definition }) });
    state.built = true;
    state.builtEval = built;
    return { ok: true, value: built };
  }

  function suiteValidation(input: EvalSuiteInput | EvalSuiteUpdate, currentId?: string): readonly ValidationError[] {
    const errors: ValidationError[] = [];
    if ("id" in input && (!input.id || !/^[a-z][a-z0-9._-]*$/.test(input.id))) errors.push(validationError("INVALID_SUITE_ID", "id", "Suite id must be a stable lowercase identifier."));
    if ("id" in input && input.id !== currentId && suitesById.has(input.id)) errors.push(validationError("DUPLICATE_SUITE", "id", `Suite ${input.id} already exists.`));
    if (input.title !== undefined && !input.title.trim()) errors.push(validationError("INVALID_TITLE", "title", "Suite title cannot be empty."));
    if (input.evalRefs !== undefined) {
      const seen = new Set<string>();
      for (const [index, ref] of input.evalRefs.entries()) {
        const key = evalRefKey(ref);
        if (seen.has(key)) errors.push(validationError("DUPLICATE_REF", `evalRefs[${index}]`, `Suite contains ${key} more than once.`));
        seen.add(key);
        if (!getState(ref)) errors.push(validationError("UNKNOWN_EVAL", `evalRefs[${index}]`, `Eval ${key} is not in the catalog.`));
      }
    }
    return Object.freeze(errors);
  }

  function createSuite(input: EvalSuiteInput): EvalSuiteResult<EvalSuite> {
    const errors = suiteValidation(input);
    if (errors.length > 0) return { ok: false, errors };
    const suite = freeze({ id: input.id, title: input.title ?? input.id, description: input.description ?? "", evalRefs: stableRefs(input.evalRefs), version: 1 });
    suitesById.set(suite.id, suite);
    return { ok: true, value: suite };
  }

  function renameSuite(id: string, title: string): EvalSuiteResult<EvalSuite> {
    const existing = suitesById.get(id);
    if (!existing) return { ok: false, errors: [validationError("UNKNOWN_SUITE", "id", `Suite ${id} does not exist.`)] };
    const errors = suiteValidation({ title });
    if (errors.length > 0) return { ok: false, errors };
    const next = freeze({ ...existing, title, version: existing.version + 1 });
    suitesById.set(id, next);
    return { ok: true, value: next };
  }

  function updateSuite(id: string, update: EvalSuiteUpdate): EvalSuiteResult<EvalSuite> {
    const existing = suitesById.get(id);
    if (!existing) return { ok: false, errors: [validationError("UNKNOWN_SUITE", "id", `Suite ${id} does not exist.`)] };
    const errors = suiteValidation(update, id);
    if (errors.length > 0) return { ok: false, errors };
    const next = freeze({ ...existing, ...(update.title !== undefined ? { title: update.title } : {}), ...(update.description !== undefined ? { description: update.description } : {}), ...(update.evalRefs !== undefined ? { evalRefs: stableRefs(update.evalRefs) } : {}), version: existing.version + 1 });
    suitesById.set(id, next);
    return { ok: true, value: next };
  }

  function selection(request: EvalRunRequest): { readonly refs: readonly EvalRef[]; readonly errors: readonly ValidationError[] } {
    const errors: ValidationError[] = [];
    const suiteId = request.suiteId ?? request.suiteRef;
    const suite = suiteId ? suitesById.get(suiteId) : undefined;
    if (suiteId && !suite) errors.push(validationError("UNKNOWN_SUITE", "suiteId", `Suite ${suiteId} does not exist.`));
    const explicit = request.evalRefs ?? request.caseRefs;
    let refs = stableRefs(explicit ?? suite?.evalRefs ?? []);
    if (request.overrides?.remove || request.removeRefs) {
      const remove = new Set((request.overrides?.remove ?? request.removeRefs ?? []).map(evalRefKey));
      refs = Object.freeze(refs.filter((ref) => !remove.has(evalRefKey(ref))));
    }
    const adds = request.overrides?.add ?? request.addRefs ?? [];
    refs = stableRefs([...refs, ...adds]);
    for (const ref of refs) if (!getState(ref)) errors.push(validationError("UNKNOWN_EVAL", "evalRefs", `Eval ${evalRefKey(ref)} is not in the catalog.`));
    return { refs, errors: Object.freeze(errors) };
  }

  function preview(request: EvalRunRequest) {
    const selected = selection(request);
    const cases = selected.refs.map((ref) => getState(ref)).filter((state): state is BuildState => state !== undefined).map(entryFor);
    return freeze({ evalRefs: selected.refs, cases: Object.freeze(cases), totalRunCostCredits: cases.reduce((sum, entry) => sum + entry.runCostCredits, 0), behavior: Object.freeze(cases.map((entry) => entry.definition.description)), errors: selected.errors });
  }

  function remember(result: EvalCaseResult): void {
    resultsById.set(result.id, result);
    const key = evalRefKey(result.ref);
    const list = resultsByRef.get(key) ?? [];
    list.push(result);
    resultsByRef.set(key, list);
  }

  function runInputError(state: BuildState, subject: EvalSubject, ref: EvalRef): string | undefined {
    if (subject.type !== "AGENT_CONFIG" && !subject.ref) return `Eval ${evalRefKey(ref)} requires an exact ${subject.type} subject ref.`;
    if (subject.ref && registry?.getArtifact && !registry.getArtifact(subject.ref)) return `Exact subject ${artifactKey(subject.ref)} is unavailable; the run was not charged.`;
    const pinned = incidentManifests.get(evalRefKey(ref))?.artifactRefs ?? incidentManifests.get(evalRefKey(ref))?.artifactVersions ?? [];
    if (registry?.getArtifact) for (const artifactRef of pinned) if (!registry.getArtifact(artifactRef)) return `Pinned incident artifact ${artifactKey(artifactRef)} is unavailable; the run was not charged.`;
    const errors = definitionErrors(state.definition);
    return errors.length > 0 ? errors.map((error) => `${error.path}: ${error.message}`).join("; ") : undefined;
  }

  async function run(request: EvalRunRequest): Promise<EvalBatchResult> {
    const selected = selection(request);
    const start = request.logicalTime ?? options.logicalTime ?? 0;
    const requestId = request.transactionId ?? `request.${requestSequence++}`;
    const resultList: EvalCaseResult[] = [];
    let chargedCost = 0;
    for (const ref of selected.refs) {
      const state = getState(ref);
      if (!state) {
        const runTransactionId = `${requestId}:eval-run:${evalRefKey(ref)}`;
        const blocked = invalidRunResult(ref, request, runTransactionId, start, `Eval ${evalRefKey(ref)} is not in the catalog.`);
        remember(blocked);
        resultList.push(blocked);
        continue;
      }
      const definition = state.definition;
      const subject = subjectFor(definition, request);
      const runTransactionId = `${requestId}:eval-run:${evalRefKey(ref)}`;
      const existing = resultsById.get(`eval.result.${evalRefKey(ref)}.${runTransactionId}`);
      if (existing) {
        resultList.push(existing);
        continue;
      }
      if (!state.built) {
        const blocked = runErrorResult(definition, subject, "BLOCKED_UNBUILT", runTransactionId, start, `Eval ${evalRefKey(ref)} must be built before it can run.`);
        remember(blocked);
        resultList.push(blocked);
        continue;
      }
      const inputError = runInputError(state, subject, ref);
      if (inputError) {
        const blocked = runErrorResult(definition, subject, "BLOCKED_INPUT", runTransactionId, start, inputError);
        remember(blocked);
        resultList.push(blocked);
        continue;
      }
      let command: CreditCommand;
      let charged: CreditResult;
      try {
        command = { transactionId: runTransactionId, type: "EVAL_RUN", amount: -definition.runCostCredits, logicalTime: start, sourceRef: `eval-run:${evalRefKey(ref)}`, expectedBalanceVersion: balance().version };
        charged = charge(command);
      } catch (cause) {
        const blocked = runErrorResult(definition, subject, "BLOCKED_CREDIT", runTransactionId, start, `Run transaction failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        remember(blocked);
        resultList.push(blocked);
        continue;
      }
      if (!charged.ok) {
        const blocked = runErrorResult(definition, subject, "BLOCKED_CREDIT", runTransactionId, start, charged.error.message);
        remember(blocked);
        resultList.push(blocked);
        continue;
      }
      const mismatch = chargeMismatch(command, charged);
      if (mismatch) {
        const blocked = runErrorResult(definition, subject, "BLOCKED_CREDIT", runTransactionId, start, mismatch);
        remember(blocked);
        resultList.push(blocked);
        continue;
      }
      chargedCost += definition.runCostCredits;
      const baseManifest = incidentManifests.get(evalRefKey(ref));
      const agent = subject.agentDefinition ?? defaultAgent(definition.fixture);
      const manifest = buildManifest(definition, subject, definition.fixture, agent, options, baseManifest);
      let output: EvalExecutionOutput;
      try {
        const isolated = await runtimeFactory(manifest);
        output = await isolated.run(manifest);
      } catch (cause) {
        const failed = runErrorResult(definition, subject, "ISOLATION_FAILED", runTransactionId, start, `Isolated runtime failed: ${cause instanceof Error ? cause.message : String(cause)}`, { replayManifest: manifest, error: String(cause) });
        remember(failed);
        resultList.push(failed);
        continue;
      }
      const completion = output.finalSnapshot?.logicalTime ?? start + (output.durationLogicalTime ?? 0);
      const assertions = evaluateAssertions(definition.assertions, { output, startLogicalTime: start, completionLogicalTime: completion });
      const passed = assertions.every((assertion) => assertion.passed);
      const status: EvalCaseResult["status"] = output.error ? "UNAVAILABLE" : passed ? "PASSED" : "FAILED";
      const replayManifest = output.replayManifest ?? manifest;
      const result: EvalCaseResult = freeze({
        id: `eval.result.${evalRefKey(ref)}.${runTransactionId}`,
        ref: { ...ref },
        caseRef: { ...ref },
        subject,
        status,
        passed,
        assertions,
        expectedAssertions: definition.assertions,
        fixtureId: definition.fixture.id,
        seed: definition.seed,
        ...(subject.ref ? { subjectRef: subject.ref } : {}),
        buildCostCredits: definition.buildCostCredits,
        runCostCredits: definition.runCostCredits,
        runTransactionId,
        ...(output.traceRef ? { traceRef: output.traceRef } : {}),
        replayManifest,
        canonicalHash: stableHash({ ref, subject, status, passed, assertions, fixtureId: definition.fixture.id, seed: definition.seed, finalSnapshot: output.finalSnapshot, events: output.events, traceEvents: output.trace?.events }),
        startLogicalTime: start,
        completionLogicalTime: completion,
        ...(output.error ? { error: output.error } : {}),
        output,
      });
      remember(result);
      resultList.push(result);
    }
    const partial = selected.errors.length > 0 || resultList.some((result) => ["BLOCKED_UNBUILT", "BLOCKED_CREDIT", "BLOCKED_INPUT", "UNAVAILABLE", "ISOLATION_FAILED"].includes(result.status));
    const complete = resultList.length === selected.refs.length && resultList.every((result) => !["BLOCKED_UNBUILT", "BLOCKED_CREDIT", "BLOCKED_INPUT", "UNAVAILABLE", "ISOLATION_FAILED"].includes(result.status));
    return freeze({ ok: selected.errors.length === 0 && complete, requestId, evalRefs: selected.refs, results: Object.freeze(resultList), totalRunCostCredits: selected.refs.reduce((sum, ref) => sum + (getState(ref)?.definition.runCostCredits ?? 0), 0), chargedRunCostCredits: chargedCost, partial, startedAtLogicalTime: start, completedAtLogicalTime: Math.max(start, ...resultList.map((result) => result.completionLogicalTime), start) });
  }

  function fromIncident(input: IncidentEvalInput, transactionId?: string): { readonly ok: true; readonly value: BuiltEval } | { readonly ok: false; readonly error: IncidentEvalError } {
    const manifest = input.manifest;
    const fixture = input.fixture ?? manifest?.fixture;
    const seed = input.seed ?? manifest?.seed;
    const effectiveTransactionId = input.transactionId ?? transactionId ?? "";
    if (!input.incidentId.trim() || !fixture || seed === undefined || !Number.isFinite(seed)) return { ok: false, error: { code: "INCIDENT_NOT_RECONSTRUCTABLE", message: "Incident must include an exact fixture and finite seed.", incidentId: input.incidentId } };
    if (manifest?.fixture && input.fixture && canonicalSerialize(manifest.fixture) !== canonicalSerialize(input.fixture)) return { ok: false, error: { code: "INCIDENT_NOT_RECONSTRUCTABLE", message: "Incident fixture and replay manifest fixture disagree; conversion would not preserve exact history.", incidentId: input.incidentId } };
    if (manifest && input.seed !== undefined && manifest.seed !== input.seed) return { ok: false, error: { code: "INCIDENT_NOT_RECONSTRUCTABLE", message: "Incident seed and replay manifest seed disagree; conversion would not preserve exact history.", incidentId: input.incidentId } };
    if (input.assertions.length === 0) return { ok: false, error: { code: "ASSERTIONS_REQUIRED", message: "Author at least one assertion before converting the incident.", incidentId: input.incidentId } };
    const assertionErrors = input.assertions.flatMap((assertion, index) => validateEvalAssertion(assertion, `assertions[${index}]`));
    if (assertionErrors.length > 0) return { ok: false, error: { code: "INVALID_ASSERTION", message: assertionErrors.map((item) => item.message).join("; "), incidentId: input.incidentId } };
    if (!effectiveTransactionId.trim()) return { ok: false, error: { code: "INVALID_TRANSACTION", message: "Incident conversion requires a stable build transaction id.", incidentId: input.incidentId } };
    const priorIncident = incidentTransactions.get(effectiveTransactionId);
    if (priorIncident && priorIncident !== input.incidentId) return { ok: false, error: { code: "INVALID_TRANSACTION", message: `Transaction ${effectiveTransactionId} is already bound to incident ${priorIncident}.`, incidentId: input.incidentId } };
    const inferredSubjectRef = input.subjectRef ?? (input.subjectType === "PROMPT" ? manifest?.job?.promptRef : input.subjectType === "SKILL" ? manifest?.job?.skillRefs?.[0] : input.subjectType === "SYSTEM_PROMPT" ? manifest?.job?.systemPromptRefs?.[0] : undefined);
    const refs = stableArtifactRefs([...(manifest?.artifactRefs ?? manifest?.artifactVersions ?? []), ...[inferredSubjectRef].filter((ref): ref is ArtifactRef => ref !== undefined)]);
    if (registry?.getArtifact) for (const ref of refs) if (!registry.getArtifact(ref)) return { ok: false, error: { code: "CONTENT_UNAVAILABLE", message: `Exact content ${artifactKey(ref)} is unavailable; conversion cannot float to current.`, incidentId: input.incidentId } };
    const fingerprint = stableHash({ incidentId: input.incidentId, fixture, seed, manifest, subjectType: input.subjectType, subjectRef: inferredSubjectRef, assertions: input.assertions, buildCostCredits: input.buildCostCredits ?? 1_200, runCostCredits: input.runCostCredits ?? 8 });
    const priorConversion = incidentConversions.get(input.incidentId);
    if (priorConversion) {
      if (priorConversion.fingerprint !== fingerprint) return { ok: false, error: { code: "INVALID_INCIDENT", message: `Incident ${input.incidentId} was already converted from different pinned inputs.`, incidentId: input.incidentId } };
      const built = getState(priorConversion.ref)?.builtEval;
      if (!built) return { ok: false, error: { code: "TRANSACTION_FAILED", message: `Incident ${input.incidentId} conversion state is incomplete.`, incidentId: input.incidentId } };
      incidentTransactions.set(effectiveTransactionId, input.incidentId);
      return { ok: true, value: built };
    }
    const baseId = `regression.incident.${input.incidentId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown"}`;
    let version = 1;
    while (definitions.has(evalRefKey({ id: baseId, version }))) version += 1;
    const definition: EvalCaseDefinition = freeze({ id: baseId, version, title: input.title ?? `Regression: ${input.incidentId}`, description: input.description ?? `Regression eval captured from incident ${input.incidentId}.`, tags: Object.freeze([...new Set(["regression", "incident", ...(input.tags ?? []), ...(input.severity === undefined ? [] : [`severity:${input.severity}`])])].sort()), buildCostCredits: input.buildCostCredits ?? 1_200, runCostCredits: input.runCostCredits ?? 8, fixture: deepClone(fixture), seed, subjectType: input.subjectType, ...(inferredSubjectRef ? { subjectRef: deepClone(inferredSubjectRef) } : {}), assertions: deepClone(input.assertions) });
    definitions.set(evalRefKey(evalRefFromDefinition(definition)), { definition, built: false });
    const capturedManifest: ReplayManifest = freeze({ ...(manifest ? deepClone(manifest) : {}), schemaVersion: 1, id: manifest?.id ?? `incident.manifest.${input.incidentId}`, fixtureRef: manifest?.fixtureRef ?? fixture.id, fixture: deepClone(fixture), seed, artifactRefs: refs, artifactVersions: refs });
    incidentManifests.set(evalRefKey(evalRefFromDefinition(definition)), capturedManifest);
    const built = build(evalRefFromDefinition(definition), effectiveTransactionId, input.logicalTime ?? options.logicalTime ?? 0);
    if (!built.ok) {
      definitions.delete(evalRefKey(evalRefFromDefinition(definition)));
      incidentManifests.delete(evalRefKey(evalRefFromDefinition(definition)));
      return { ok: false, error: { code: built.error.code, message: built.error.message, incidentId: input.incidentId } };
    }
    const enriched: BuiltEval = freeze({ ...built.value, replayManifest: capturedManifest, sourceIncidentId: input.incidentId, artifactRefs: refs, canonicalHash: stableHash({ ...built.value, replayManifest: capturedManifest, sourceIncidentId: input.incidentId, artifactRefs: refs }) });
    const state = getState(enriched.ref);
    if (state) state.builtEval = enriched;
    incidentConversions.set(input.incidentId, { ref: enriched.ref, fingerprint });
    incidentTransactions.set(effectiveTransactionId, input.incidentId);
    return { ok: true, value: enriched };
  }

  function persistenceSnapshot(): EvalPersistenceState {
    return freeze({ definitions: [...definitions.entries()].map(([key, state]) => ({ key, definition: deepClone(state.definition), built: state.built, ...(state.builtEval ? { builtEval: deepClone(state.builtEval) } : {}) })).sort((a, b) => a.key.localeCompare(b.key)), suites: [...suitesById.values()].map(deepClone), results: [...resultsById.values()].map(deepClone), incidentManifests: [...incidentManifests.entries()].map(([key, manifest]) => ({ key, manifest: deepClone(manifest) })).sort((a, b) => a.key.localeCompare(b.key)), buildTransactions: [...buildTransactions.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key)), incidentConversions: [...incidentConversions.entries()].map(([key, value]) => ({ key, ref: deepClone(value.ref), fingerprint: value.fingerprint })).sort((a, b) => a.key.localeCompare(b.key)), incidentTransactions: [...incidentTransactions.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key)), requestSequence });
  }

  function restorePersistence(state: EvalPersistenceState): void {
    definitions.clear(); for (const item of state.definitions) definitions.set(item.key, { definition: freeze(deepClone(item.definition)), built: item.built, ...(item.builtEval ? { builtEval: freeze(deepClone(item.builtEval)) } : {}) });
    suitesById.clear(); for (const suite of state.suites) suitesById.set(suite.id, freeze(deepClone(suite)));
    resultsById.clear(); resultsByRef.clear(); for (const result of state.results) remember(freeze(deepClone(result)));
    incidentManifests.clear(); for (const item of state.incidentManifests) incidentManifests.set(item.key, freeze(deepClone(item.manifest)));
    buildTransactions.clear(); for (const item of state.buildTransactions) buildTransactions.set(item.key, item.value);
    incidentConversions.clear(); for (const item of state.incidentConversions) incidentConversions.set(item.key, { ref: freeze(deepClone(item.ref)), fingerprint: item.fingerprint });
    incidentTransactions.clear(); for (const item of state.incidentTransactions) incidentTransactions.set(item.key, item.value);
    requestSequence = state.requestSequence;
  }

  return freeze({
    catalog,
    build,
    run,
    preview,
    createSuite,
    renameSuite,
    updateSuite,
    removeSuite: (id: string) => suitesById.delete(id),
    suite: (id: string) => suitesById.get(id),
    suites: () => Object.freeze([...suitesById.values()].sort((a, b) => a.id.localeCompare(b.id))),
    results: (ref?: EvalRef) => Object.freeze(ref ? [...(resultsByRef.get(evalRefKey(ref)) ?? [])] : [...resultsById.values()]),
    fromIncident,
    persistenceSnapshot,
    restorePersistence,
  });
}

export const createEvalRunner = createEvalService;
export const createEvaluationService = createEvalService;
export const createEvalCatalogService = createEvalService;
export const createEvalSuiteService = createEvalService;
export const createIncidentEvalFactory = createEvalService;

export { EVAL_ASSERTION_TYPES, evaluateAssertion, evaluateAssertions, validateEvalAssertion } from "./assertions.ts";
