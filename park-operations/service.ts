import { createContextService, type ContextRequest, type ContextSnapshot } from "../context/index.ts";
import { type ArtifactRef, type ArtifactVersion, type ContentRegistry } from "../content-registry/index.ts";
import { createInstructionEngine, type AgentDefinition, type ExecutionUpdate, type InstructionContentPort, type InstructionEngine } from "../instruction/index.ts";
import { createMemoryService, type MemoryService } from "../memory/index.ts";
import { createSimulationEngine, deepClone, deepFreeze, type SimulationEngine, type WorldCommand, type WorldEvent, type WorldFixture, type WorldSnapshot } from "../simulation/index.ts";
import type { EconomyProgressionService } from "../economy-progression/index.ts";
import type { TraceQuery, TraceSink } from "../trace-replay/index.ts";
import { createParkReadModel } from "./read-model.ts";
import { createOperationsContentRegistry, createOperationsFixture, DEFAULT_OPERATIONS_TEMPLATES } from "./defaults.ts";
import type {
  AgentOperationsView,
  EligibleAgent,
  JobCommandError,
  JobCommandResult,
  JobDraft,
  JobPreflight,
  JobTemplate,
  OperationsChange,
  OperationsJob,
  OperationsJobStatus,
  ParkOperationsDependencies,
  ParkOperationsService,
  ParkOperationsPersistenceState,
  ParkOperationsView,
} from "./types.ts";

function cloneFreeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function isArtifactRef(value: unknown): value is ArtifactRef {
  return Boolean(value) && typeof value === "object" && typeof (value as ArtifactRef).artifactId === "string" && (value as ArtifactRef).artifactId.length > 0 && Number.isInteger((value as ArtifactRef).version) && (value as ArtifactRef).version > 0;
}

function stableId(prefix: string, id: string): string {
  return `${prefix}.${id.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
}

function error(code: JobCommandError["code"], message: string, commandId?: string, extras: Partial<JobCommandError> = {}): JobCommandError {
  return { code, message, ...(commandId ? { commandId } : {}), ...extras };
}

function asOperationStatus(value: string | undefined): OperationsJobStatus {
  if (value === "SUCCEEDED" || value === "FAILED" || value === "ESCALATED" || value === "BLOCKED" || value === "PAUSED" || value === "CANCELLED" || value === "RUNNING") return value;
  return "QUEUED";
}

function bindJson(value: unknown, bindings: Readonly<Record<string, string>>): unknown {
  if (typeof value === "string") return bindings[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => bindJson(item, bindings));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bindJson(item, bindings)]));
  return value;
}

function bindArtifact(artifact: ArtifactVersion, bindings: Readonly<Record<string, string>>): ArtifactVersion {
  return cloneFreeze({
    ...artifact,
    clauses: artifact.clauses.map((clause) => ({
      ...clause,
      ...(clause.conditions ? { conditions: bindJson(clause.conditions, bindings) as typeof clause.conditions } : {}),
      ...(clause.action ? { action: bindJson(clause.action, bindings) as typeof clause.action } : {}),
      ...(clause.assert ? { assert: bindJson(clause.assert, bindings) as typeof clause.assert } : {}),
      ...(clause.onFail ? { onFail: bindJson(clause.onFail, bindings) as typeof clause.onFail } : {}),
    })),
  });
}

export interface ParkOperationsServiceOptions extends ParkOperationsDependencies {
  readonly simulation?: SimulationEngine;
  readonly content?: ContentRegistry;
  readonly context?: ReturnType<typeof createContextService>;
  readonly memory?: MemoryService;
  readonly instruction?: InstructionEngine;
  readonly templates?: readonly JobTemplate[];
  readonly fixture?: WorldFixture;
}

class ParkOperationsRuntime implements ParkOperationsService {
  private readonly simulation: SimulationEngine;
  private readonly content: ContentRegistry;
  private readonly context: ReturnType<typeof createContextService>;
  private readonly memory: MemoryService;
  private readonly instruction?: InstructionEngine;
  private readonly traces?: TraceSink & TraceQuery;
  private readonly economy?: EconomyProgressionService;
  private readonly resolveActiveRef?: (artifactId: string) => ArtifactRef | undefined;
  private readonly templates: readonly JobTemplate[];
  private readonly agentDefinitions: ReadonlyMap<string, AgentDefinition>;
  private readonly jobsById = new Map<string, OperationsJob>();
  private readonly commandResults = new Map<string, JobCommandResult>();
  private readonly executions = new Map<string, string>();
  private readonly enginesByJob = new Map<string, InstructionEngine>();
  private readonly listeners = new Set<(change: OperationsChange) => void>();
  private readonly acknowledged = new Set<string>();
  private readonly acknowledgementResults = new Map<string, { readonly ok: true; readonly commandId: string } | { readonly ok: false; readonly error: JobCommandError; readonly commandId: string }>();
  private readonly interventionResults = new Map<string, { readonly ok: true; readonly events: readonly WorldEvent[] } | { readonly ok: false; readonly error: JobCommandError }>();
  private operationVersion = 0;
  private paused = false;
  private speed: 1 | 2 | 4 = 1;
  private viewCache?: ParkOperationsView;

  constructor(options: ParkOperationsServiceOptions = {}) {
    this.simulation = options.simulation ?? createSimulationEngine();
    const fixture = options.fixture ?? createOperationsFixture();
    const loaded = this.simulation.snapshot().fixtureId === fixture.id ? true : this.simulation.load(fixture, 7).ok;
    if (!loaded) throw new Error("Park Operations could not load its deterministic fixture.");
    this.content = options.content ?? createOperationsContentRegistry();
    this.context = options.context ?? createContextService();
    this.memory = options.memory ?? createMemoryService();
    this.instruction = options.instruction;
    this.traces = options.traces;
    this.economy = options.economy;
    this.resolveActiveRef = options.resolveActiveRef;
    this.templates = options.templates ?? DEFAULT_OPERATIONS_TEMPLATES;
    const definitions = options.agentDefinitions ?? this.simulation.snapshot().agents.map((agent) => ({
      id: agent.agentDefinitionId,
      name: agent.id,
      role: "WORKER" as const,
      contextBudget: agent.contextBudget,
      toolIds: agent.tools,
      tools: agent.tools,
      memoryPolicyId: "memory.local.default",
    }));
    this.agentDefinitions = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  snapshot(): WorldSnapshot {
    return this.simulation.snapshot();
  }

  jobs(): readonly OperationsJob[] {
    return cloneFreeze([...this.jobsById.values()].sort((a, b) => b.priority - a.priority || a.dueTime - b.dueTime || a.id.localeCompare(b.id)));
  }

  private contextFor(agentId: string, job?: OperationsJob): { readonly load: number; readonly snapshotId?: string; readonly items: readonly unknown[] } {
    const current = job?.contextSnapshot;
    return { load: current?.totalLoad ?? 0, ...(current?.id ? { snapshotId: current.id } : {}), items: current?.items ?? [] };
  }

  private rebuildView(): ParkOperationsView {
    const snapshot = this.simulation.snapshot();
    const traceIdsByAgent: Record<string, readonly string[]> = {};
    if (this.traces) {
      for (const agent of snapshot.agents) traceIdsByAgent[agent.id] = this.traces.list({ agentId: agent.id }).map((item) => item.traceId);
    }
    this.viewCache = createParkReadModel({
      version: this.operationVersion,
      snapshot,
      jobs: this.jobs(),
      credits: this.economy?.balance().amount ?? 0,
      paused: this.paused,
      speed: this.speed,
      getAgentContext: (agentId, job) => this.contextFor(agentId, job),
      memory: this.memory,
      traceIdsByAgent,
      acknowledgedIncidentIds: [...this.acknowledged].sort(),
      incidentCosts: Object.fromEntries(snapshot.incidents.map((incident) => [incident.id, Math.abs((this.economy?.ledger({ sourceRef: incident.id }) ?? []).reduce((sum, entry) => sum + entry.amount, 0))])),
    });
    return this.viewCache;
  }

  getPark(): ParkOperationsView {
    return this.viewCache ?? this.rebuildView();
  }

  getAgent(id: string): AgentOperationsView | undefined {
    return this.getPark().agents.find((agent) => agent.id === id);
  }

  subscribe(listener: (change: OperationsChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(kind: OperationsChange["kind"], ids: readonly string[] = []): void {
    this.operationVersion += 1;
    this.viewCache = undefined;
    const snapshot = this.simulation.snapshot();
    const change: OperationsChange = cloneFreeze({ version: this.operationVersion, kind, ids: [...ids].sort(), logicalTime: snapshot.logicalTime });
    for (const listener of this.listeners) listener(change);
  }

  refresh(): void {
    this.changed("SNAPSHOT", []);
  }

  getControlState(): { readonly paused: boolean; readonly speed: 1 | 2 | 4 } {
    return { paused: this.paused, speed: this.speed };
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.changed("METRIC", []);
  }

  setSpeed(speed: 1 | 2 | 4): void {
    this.speed = speed;
    this.changed("METRIC", []);
  }

  advanceTo(logicalTime: number): readonly WorldEvent[] {
    if (this.paused) return [];
    const previousLogicalTime = this.simulation.snapshot().logicalTime;
    const events = this.simulation.advanceTo(logicalTime);
    if (events.length > 0) {
      for (const job of this.jobsById.values()) {
        const executionId = this.executions.get(job.id);
        const engine = this.enginesByJob.get(job.id) ?? this.instruction;
        if (!executionId || !engine || job.status !== "RUNNING") continue;
        const update = engine.handleWorldEvents(executionId, events);
        this.applyExecutionUpdate(job.id, update);
      }
      this.changed("SNAPSHOT", events.map((event) => event.id));
    } else if (this.simulation.snapshot().logicalTime !== previousLogicalTime) {
      // Logical time is authoritative save state even when no world event was
      // emitted; subscribers such as periodic autosave must still observe it.
      this.changed("SNAPSHOT", []);
    }
    return cloneFreeze(events);
  }

  private findTemplate(templateId: string | undefined): JobTemplate | undefined {
    if (!templateId) return undefined;
    return this.templates.find((template) => template.id === templateId);
  }

  private agentDefinition(agentId: string): AgentDefinition | undefined {
    const agent = this.simulation.snapshot().agents.find((item) => item.id === agentId);
    const configured = agent ? this.agentDefinitions.get(agent.agentDefinitionId) : undefined;
    return agent ? configured ? { ...configured, id: agentId } : {
      id: agentId,
      contextBudget: agent.contextBudget,
      toolIds: agent.tools,
      tools: agent.tools,
    } : undefined;
  }

  private targetBindings(job: Pick<OperationsJob, "targetRefs">): Readonly<Record<string, string>> | undefined {
    const snapshot = this.simulation.snapshot();
    const dinosaur = snapshot.dinosaurs.find((item) => job.targetRefs.includes(item.id));
    if (!dinosaur) return undefined;
    const enclosure = snapshot.enclosures.find((item) => item.id === dinosaur.enclosureId);
    const gate = snapshot.gates.find((item) => item.enclosureId === dinosaur.enclosureId);
    const serviceZone = enclosure?.zoneIds.find((id) => snapshot.zones.find((zone) => zone.id === id)?.kind === "SERVICE");
    const interiorZone = enclosure?.zoneIds.find((id) => snapshot.zones.find((zone) => zone.id === id)?.kind === "INTERIOR");
    const bufferZone = enclosure?.visitorBufferZoneIds[0];
    const feeder = enclosure?.feederIds[0];
    if (!enclosure || !gate || !serviceZone || !interiorZone || !feeder) return undefined;
    return cloneFreeze({ "$target": dinosaur.id, "$enclosure": enclosure.id, "$gate": gate.id, "$serviceZone": serviceZone, "$interiorZone": interiorZone, "$bufferZone": bufferZone ?? serviceZone, "$feeder": feeder });
  }

  private engineForJob(job: OperationsJob): InstructionEngine | undefined {
    if (this.instruction) return this.instruction;
    const existing = this.enginesByJob.get(job.id);
    if (existing) return existing;
    const bindings = this.targetBindings(job);
    if (!bindings) return undefined;
    const content: InstructionContentPort = {
      getArtifact: (ref) => {
        const artifact = this.content.getArtifact(ref);
        return artifact ? bindArtifact(artifact, bindings) : undefined;
      },
      getToolDescription: (toolId) => this.content.getToolDescription(toolId),
      dependencies: (ref, transitive) => this.content.dependencies(ref, transitive),
    };
    const engine = createInstructionEngine({ content, context: this.context, simulation: this.simulation });
    this.enginesByJob.set(job.id, engine);
    return engine;
  }

  private contextRequest(input: JobDraft, agentId: string): ContextRequest {
    const agent = this.simulation.snapshot().agents.find((item) => item.id === agentId);
    const definition = this.agentDefinition(agentId);
    const snapshot = this.simulation.snapshot();
    return {
      id: `context.${input.type}.${agentId}`,
      agentId,
      jobId: `preflight.${input.type}.${input.targetRefs.join(".")}`,
      budget: definition?.contextBudget ?? agent?.contextBudget ?? 0,
      logicalTime: snapshot.logicalTime,
      promptRef: input.promptRef,
      skillRefs: input.skillRefs ?? [],
      systemPromptRefs: input.systemPromptRefs ?? [],
      toolIds: definition?.toolIds ?? agent?.tools ?? [],
      registry: this.content,
      memoryService: this.memory,
      memoryAccess: { agentId },
      applicabilityTags: [input.type.toUpperCase() === "FEED" ? "task:feeding" : `task:${input.type.toLowerCase()}`, ...(input.skillRefs && input.skillRefs.length > 0 ? ["safety:standard"] : [])],
      workingState: {
        ref: `simulation:working-state:${snapshot.logicalTime}`,
        provenance: "simulation:snapshot",
        contextCost: 18,
        facts: snapshot.dinosaurs.flatMap((dinosaur) => [
          { key: "DINOSAUR_HUNGER", value: dinosaur.hunger, subjectRef: dinosaur.id, observedAt: snapshot.logicalTime, provenance: "simulation:snapshot" },
          { key: "DINOSAUR_CONTAINMENT", value: dinosaur.containmentState, subjectRef: dinosaur.id, observedAt: snapshot.logicalTime, provenance: "simulation:snapshot" },
        ]),
      },
    };
  }

  preflight(input: JobDraft): JobPreflight {
    const raw = (input && typeof input === "object" ? input : {}) as Partial<JobDraft>;
    const priorityValid = typeof raw.priority === "number" && Number.isInteger(raw.priority);
    const dueTimeValid = typeof raw.dueTime === "number" && Number.isInteger(raw.dueTime);
    const expectedParkVersionValid = raw.expectedParkVersion === undefined || (typeof raw.expectedParkVersion === "number" && Number.isInteger(raw.expectedParkVersion));
    input = {
      ...(typeof raw.templateId === "string" ? { templateId: raw.templateId } : {}),
      type: typeof raw.type === "string" ? raw.type : "",
      targetRefs: Array.isArray(raw.targetRefs) ? raw.targetRefs.filter((target): target is string => typeof target === "string") : [],
      priority: priorityValid ? raw.priority! : 0,
      dueTime: dueTimeValid ? raw.dueTime! : 0,
      promptRef: raw.promptRef as ArtifactRef,
      skillRefs: Array.isArray(raw.skillRefs) ? raw.skillRefs.filter(isArtifactRef) : [],
      systemPromptRefs: Array.isArray(raw.systemPromptRefs) ? raw.systemPromptRefs.filter(isArtifactRef) : [],
      ...(typeof raw.assignedAgentId === "string" ? { assignedAgentId: raw.assignedAgentId } : {}),
      ...(expectedParkVersionValid && raw.expectedParkVersion !== undefined ? { expectedParkVersion: raw.expectedParkVersion } : {}),
    };
    const resolve = (ref: ArtifactRef): ArtifactRef => {
      if (!isArtifactRef(ref) || !this.resolveActiveRef) return ref;
      try {
        const active = this.resolveActiveRef(ref.artifactId);
        return isArtifactRef(active) ? active : ref;
      } catch {
        return ref;
      }
    };
    input = {
      ...input,
      promptRef: resolve(input.promptRef),
      skillRefs: (input.skillRefs ?? []).map(resolve),
      systemPromptRefs: (input.systemPromptRefs ?? []).map(resolve),
    };
    const template = this.findTemplate(input.templateId);
    const diagnostics: string[] = [];
    const remediation: string[] = [];
    if (!input.type || !input.promptRef || input.targetRefs.length === 0 || !priorityValid || !dueTimeValid) diagnostics.push("A job type, target, exact Prompt ref, integer priority, and due time are required.");
    if (!expectedParkVersionValid) {
      diagnostics.push("Expected Park version must be an integer when provided.");
      remediation.push("Refresh the Park view and submit its integer version.");
    }
    if (template && template.type !== input.type) diagnostics.push(`Template ${template.id} only supports ${template.type} jobs.`);
    const snapshot = this.simulation.snapshot();
    const targetKinds = new Map<string, string>([
      ...snapshot.dinosaurs.map((item) => [item.id, "DINOSAUR"] as const),
      ...snapshot.enclosures.map((item) => [item.id, "ENCLOSURE"] as const),
      ...snapshot.gates.map((item) => [item.id, "GATE"] as const),
      ...snapshot.agents.map((item) => [item.id, "AGENT"] as const),
      ...snapshot.visitors.map((item) => [item.id, "VISITOR"] as const),
      ...snapshot.devices.map((item) => [item.id, "DEVICE"] as const),
    ]);
    for (const target of input.targetRefs) {
      const kind = targetKinds.get(target);
      if (!kind) diagnostics.push(`Unknown target ${target}.`);
      else if (template && !template.targetKinds.includes(kind)) diagnostics.push(`Target ${target} is ${kind}; template ${template.id} requires ${template.targetKinds.join(" or ")}.`);
    }
    const prompt = isArtifactRef(input.promptRef) ? this.content.getArtifact(input.promptRef) : undefined;
    if (!isArtifactRef(input.promptRef)) {
      diagnostics.push("Prompt selection must be an exact {artifactId, version} reference.");
      remediation.push("Select an authored Prompt version from the job template.");
    } else if (!prompt) diagnostics.push(`Missing exact Prompt ${refKey(input.promptRef)}.`);
    for (const ref of input.skillRefs ?? []) if (!this.content.getArtifact(ref)) diagnostics.push(`Missing exact Skill ${refKey(ref)}.`);
    for (const ref of input.systemPromptRefs ?? []) if (!this.content.getArtifact(ref)) diagnostics.push(`Missing exact System Prompt ${refKey(ref)}.`);
    const selectedRefs = [isArtifactRef(input.promptRef) ? input.promptRef : undefined, ...(input.skillRefs ?? []), ...(input.systemPromptRefs ?? [])].filter((ref): ref is ArtifactRef => Boolean(ref));
    const dependencyRefs = [...new Set(selectedRefs.flatMap((ref) => this.content.dependencies(ref, true).map(refKey)))].sort();
    const requiredToolIds = [...new Set(selectedRefs.flatMap((ref) => this.content.getArtifact(ref)?.requiredToolIds ?? []))].sort();
    const candidateAgents = input.assignedAgentId ? snapshot.agents.filter((agent) => agent.id === input.assignedAgentId) : snapshot.agents;
    const eligibleAgents: EligibleAgent[] = [];
    let selectedContext: ContextSnapshot | undefined;
    for (const agent of [...candidateAgents].sort((a, b) => a.id.localeCompare(b.id))) {
      const definition = this.agentDefinition(agent.id);
      const available = new Set(definition?.toolIds ?? agent.tools);
      const missingToolIds = requiredToolIds.filter((toolId) => !available.has(toolId));
      const contextResult = diagnostics.length === 0 ? this.context.project({ ...this.contextRequest(input, agent.id), jobId: `preflight.${agent.id}.${input.targetRefs.join(".")}`, budget: agent.contextBudget }) : undefined;
      const context = contextResult?.ok ? contextResult.value : undefined;
      if (!selectedContext && context) selectedContext = context;
      const projectedContextLoad = context?.totalLoad;
      const contextOk = Boolean(context);
      const eligible = missingToolIds.length === 0 && contextOk;
      eligibleAgents.push({ agentId: agent.id, reason: eligible ? "Tools and projected Context are available." : missingToolIds.length > 0 ? `Missing tools: ${missingToolIds.join(", ")}.` : "Projected Context is blocked.", contextBudget: agent.contextBudget, ...(projectedContextLoad === undefined ? {} : { projectedContextLoad }), missingToolIds });
    }
    const selectedAgentId = eligibleAgents.find((agent) => agent.agentId === input.assignedAgentId)?.agentId ?? eligibleAgents.find((agent) => agent.missingToolIds.length === 0 && agent.projectedContextLoad !== undefined)?.agentId;
    if (!selectedAgentId) {
      diagnostics.push("No eligible worker can satisfy the exact Prompt/Skill/Tool configuration.");
      remediation.push("Select an available worker with the required tools or reduce the selected Context.");
    }
    if (selectedContext && selectedContext.totalLoad > selectedContext.budget) {
      diagnostics.push(`Context load ${selectedContext.totalLoad} CU exceeds budget ${selectedContext.budget} CU.`);
      remediation.push("Remove irrelevant modules or upgrade Context capacity; selected items are never silently truncated.");
    }
    return cloneFreeze({ ok: diagnostics.length === 0, draft: input, ...(template ? { template } : {}), ...(selectedContext ? { context: selectedContext } : {}), contextFindings: selectedContext ? this.context.analyze(selectedContext) : [], eligibleAgents, ...(selectedAgentId ? { selectedAgentId } : {}), projectedLoad: selectedContext?.totalLoad ?? 0, budget: selectedContext?.budget ?? (selectedAgentId ? snapshot.agents.find((agent) => agent.id === selectedAgentId)?.contextBudget ?? 0 : 0), diagnostics, remediation, dependencyRefs, requiredToolIds });
  }

  private cached(commandId: string): JobCommandResult | undefined {
    const previous = this.commandResults.get(commandId);
    return previous ? cloneFreeze({ ...previous, ...(previous.ok ? { duplicate: true } : {}) }) : undefined;
  }

  private resultOk(job: OperationsJob, commandId: string, duplicate = false): JobCommandResult {
    const result = cloneFreeze({ ok: true as const, job, commandId, ...(duplicate ? { duplicate: true as const } : {}) });
    this.commandResults.set(commandId, result);
    return result;
  }

  private resultError(commandId: string, issue: JobCommandError): JobCommandResult {
    const result = cloneFreeze({ ok: false as const, commandId, error: { ...issue, commandId } });
    this.commandResults.set(commandId, result);
    return result;
  }

  private currentJob(jobId: string): OperationsJob | undefined {
    return this.jobsById.get(jobId);
  }

  private addJob(job: OperationsJob): void {
    this.jobsById.set(job.id, cloneFreeze(job));
    this.changed("JOB", [job.id]);
  }

  create(input: JobDraft, commandId: string): JobCommandResult {
    const previous = this.cached(commandId);
    if (previous) return previous;
    const preflight = this.preflight(input);
    const normalized = preflight.draft;
    const view = this.getPark();
    if (normalized.expectedParkVersion !== undefined && normalized.expectedParkVersion !== view.version) return this.resultError(commandId, error("STALE_SNAPSHOT", `Park view version ${view.version} is newer than observed version ${normalized.expectedParkVersion}.`, commandId, { observedVersion: view.version, expectedVersion: normalized.expectedParkVersion }));
    if (!preflight.ok || !preflight.selectedAgentId) return this.resultError(commandId, error("PREFLIGHT_BLOCKED", preflight.diagnostics.join(" ") || "Job preflight is blocked.", commandId, { remediation: preflight.remediation }));
    const now = this.simulation.snapshot().logicalTime;
    const id = stableId("job", commandId);
    const projected = this.context.project({ ...this.contextRequest(normalized, preflight.selectedAgentId), id: `context.${id}`, jobId: id });
    const actualContext = projected.ok ? projected.value : preflight.context;
    const job: OperationsJob = {
      id,
      type: normalized.type,
      targetRefs: [...normalized.targetRefs].sort(),
      priority: normalized.priority,
      dueTime: normalized.dueTime,
      assignedAgentId: preflight.selectedAgentId,
      status: "QUEUED",
      promptRef: normalized.promptRef,
      skillRefs: [...(normalized.skillRefs ?? [])].sort((a, b) => refKey(a).localeCompare(refKey(b))),
      systemPromptRefs: [...(normalized.systemPromptRefs ?? [])].sort((a, b) => refKey(a).localeCompare(refKey(b))),
      ...(actualContext ? { contextSnapshotId: actualContext.id, contextSnapshot: actualContext } : {}),
      observedVersion: this.operationVersion + 1,
      createdAtLogicalTime: now,
      updatedAtLogicalTime: now,
      safePoint: "IDLE",
      diagnostics: [],
    };
    this.jobsById.set(job.id, cloneFreeze(job));
    this.changed("JOB", [job.id]);
    return this.resultOk(this.jobsById.get(job.id)!, commandId);
  }

  assign(jobId: string, agentId: string, commandId: string, expectedVersion?: number): JobCommandResult {
    const previous = this.cached(commandId);
    if (previous) return previous;
    const job = this.currentJob(jobId);
    if (!job) return this.resultError(commandId, error("UNKNOWN_JOB", `Job ${jobId} does not exist.`, commandId));
    if (expectedVersion !== undefined && expectedVersion !== job.observedVersion) return this.resultError(commandId, error("STALE_SNAPSHOT", `Job ${jobId} changed since version ${expectedVersion}.`, commandId, { observedVersion: job.observedVersion, expectedVersion }));
    const agent = this.simulation.snapshot().agents.find((item) => item.id === agentId);
    if (!agent) return this.resultError(commandId, error("UNKNOWN_AGENT", `Agent ${agentId} does not exist.`, commandId));
    const eligibility = this.preflight({ type: job.type, targetRefs: job.targetRefs, priority: job.priority, dueTime: job.dueTime, promptRef: job.promptRef, skillRefs: job.skillRefs, systemPromptRefs: job.systemPromptRefs, assignedAgentId: agentId });
    if (!eligibility.ok || eligibility.selectedAgentId !== agentId) return this.resultError(commandId, error("NOT_ELIGIBLE", eligibility.diagnostics.join(" ") || `Agent ${agentId} is not eligible.`, commandId, { remediation: eligibility.remediation }));
    const next: OperationsJob = { ...job, assignedAgentId: agentId, observedVersion: this.operationVersion + 1, updatedAtLogicalTime: this.simulation.snapshot().logicalTime };
    this.jobsById.set(jobId, cloneFreeze(next));
    this.changed("JOB", [jobId, agentId]);
    return this.resultOk(next, commandId);
  }

  reprioritize(jobId: string, priority: number, commandId: string, expectedVersion?: number): JobCommandResult {
    const previous = this.cached(commandId);
    if (previous) return previous;
    const job = this.currentJob(jobId);
    if (!job) return this.resultError(commandId, error("UNKNOWN_JOB", `Job ${jobId} does not exist.`, commandId));
    if (!Number.isInteger(priority)) return this.resultError(commandId, error("INVALID_COMMAND", "Priority must be an integer.", commandId));
    if (expectedVersion !== undefined && expectedVersion !== job.observedVersion) return this.resultError(commandId, error("STALE_SNAPSHOT", `Job ${jobId} changed since version ${expectedVersion}.`, commandId, { observedVersion: job.observedVersion, expectedVersion }));
    if (job.status !== "QUEUED") return this.resultError(commandId, error("INVALID_TRANSITION", "Only queued jobs can be reprioritized.", commandId));
    const next: OperationsJob = { ...job, priority, observedVersion: this.operationVersion + 1, updatedAtLogicalTime: this.simulation.snapshot().logicalTime };
    this.jobsById.set(jobId, cloneFreeze(next));
    this.changed("JOB", [jobId]);
    return this.resultOk(next, commandId);
  }

  cancelOrPauseAtSafePoint(jobId: string, commandId: string, expectedVersion?: number): JobCommandResult {
    const previous = this.cached(commandId);
    if (previous) return previous;
    const job = this.currentJob(jobId);
    if (!job) return this.resultError(commandId, error("UNKNOWN_JOB", `Job ${jobId} does not exist.`, commandId));
    if (expectedVersion !== undefined && expectedVersion !== job.observedVersion) return this.resultError(commandId, error("STALE_SNAPSHOT", `Job ${jobId} changed since version ${expectedVersion}.`, commandId, { observedVersion: job.observedVersion, expectedVersion }));
    if (job.status === "QUEUED") {
      const next: OperationsJob = { ...job, status: "CANCELLED", safePoint: "IDLE", observedVersion: this.operationVersion + 1, updatedAtLogicalTime: this.simulation.snapshot().logicalTime };
      this.jobsById.set(jobId, cloneFreeze(next));
      this.changed("JOB", [jobId]);
      return this.resultOk(next, commandId);
    }
    if (job.status !== "RUNNING") return this.resultError(commandId, error("INVALID_TRANSITION", "Only queued or running jobs can be cancelled or paused.", commandId));
    const executionId = this.executions.get(jobId);
    const engine = this.enginesByJob.get(jobId) ?? this.instruction;
    const update = executionId && engine ? engine.cancelAtSafePoint(executionId) : undefined;
    const paused = update?.status === "PAUSED";
    const next: OperationsJob = { ...job, status: paused ? "PAUSED" : "RUNNING", safePoint: paused ? "PAUSED" : "PENDING", observedVersion: this.operationVersion + 1, updatedAtLogicalTime: this.simulation.snapshot().logicalTime, diagnostics: paused ? [...job.diagnostics, "Pause requested and applied after the current atomic safety action."] : [...job.diagnostics, "Pause requested; the current atomic safety action must complete first."] };
    this.jobsById.set(jobId, cloneFreeze(next));
    this.changed("JOB", [jobId]);
    return this.resultOk(next, commandId);
  }

  start(jobId: string, commandId = `start.${jobId}`): JobCommandResult {
    const previous = this.cached(commandId);
    if (previous) return previous;
    const job = this.currentJob(jobId);
    if (!job) return this.resultError(commandId, error("UNKNOWN_JOB", `Job ${jobId} does not exist.`, commandId));
    if (job.status !== "QUEUED") return this.resultError(commandId, error("INVALID_TRANSITION", `Job ${jobId} is ${job.status}, not QUEUED.`, commandId));
    const definition = this.agentDefinition(job.assignedAgentId);
    if (!definition) return this.resultError(commandId, error("UNKNOWN_AGENT", `Agent ${job.assignedAgentId} does not exist.`, commandId));
    const now = this.simulation.snapshot().logicalTime;
    const traceId = stableId("trace", job.id);
    const withRunning: OperationsJob = { ...job, status: "RUNNING", traceId, safePoint: "PENDING", updatedAtLogicalTime: now, observedVersion: this.operationVersion + 1 };
    this.jobsById.set(jobId, cloneFreeze(withRunning));
    this.changed("JOB", [jobId]);
    const engine = this.engineForJob(withRunning);
    if (!engine) {
      const blocked: OperationsJob = { ...withRunning, status: "BLOCKED", safePoint: "IDLE", diagnostics: ["The selected target cannot be bound to an enclosure, gate, service zone, interior zone, and feeder."], updatedAtLogicalTime: now, observedVersion: this.operationVersion + 1 };
      this.jobsById.set(jobId, cloneFreeze(blocked));
      this.changed("JOB", [jobId]);
      return this.resultOk(blocked, commandId);
    }
    const prepared = engine.prepare(withRunning, definition);
    if (!prepared.ok) {
      const blocked: OperationsJob = { ...withRunning, status: "BLOCKED", safePoint: "IDLE", diagnostics: prepared.error.diagnostics, updatedAtLogicalTime: now, observedVersion: this.operationVersion + 1 };
      this.jobsById.set(jobId, cloneFreeze(blocked));
      this.changed("JOB", [jobId]);
      return this.resultOk(blocked, commandId);
    }
    if (this.traces) this.traces.begin({ traceId, executionId: `execution.${job.id}`, jobId, agentId: job.assignedAgentId, startLogicalTime: now, artifactRefs: [job.promptRef, ...job.skillRefs, ...job.systemPromptRefs], contextSnapshotId: prepared.value.contextSnapshot.id, contextSnapshot: prepared.value.contextSnapshot, fixtureRef: this.simulation.snapshot().fixtureId, seed: this.simulation.snapshot().seed, engineVersion: "park-operations", contentManifestVersion: this.content.manifest().packs.map((pack) => pack.packId).join(",") });
    const update = engine.start(prepared.value);
    this.executions.set(jobId, update.executionId);
    this.recordTrace(traceId, update);
    this.applyExecutionUpdate(jobId, update);
    return this.resultOk(this.jobsById.get(jobId)!, commandId);
  }

  runToCompletion(jobId: string, commandId = `run.${jobId}`): JobCommandResult {
    const previous = this.cached(commandId);
    if (previous) return previous;
    if (this.paused) return this.resultError(commandId, error("INVALID_TRANSITION", "The Park is paused; resume before running a queued job.", commandId));
    const started = this.start(jobId, `${commandId}.start`);
    if (!started.ok) return started;
    const executionId = this.executions.get(jobId);
    const engine = this.enginesByJob.get(jobId) ?? this.instruction;
    if (executionId && engine) {
      const update = engine.runToCompletion(executionId);
      const traceId = this.jobsById.get(jobId)?.traceId;
      if (traceId) this.recordTrace(traceId, update);
      this.applyExecutionUpdate(jobId, update);
    }
    const result = this.resultOk(this.jobsById.get(jobId)!, commandId);
    return result;
  }

  private recordTrace(traceId: string, update: ExecutionUpdate): void {
    if (!this.traces) return;
    for (const event of update.events) this.traces.append(traceId, event);
    if (update.outcome) this.traces.finalize(traceId, update.outcome);
  }

  private applyExecutionUpdate(jobId: string, update: ExecutionUpdate): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    const status = update.outcome ? asOperationStatus(update.outcome.status) : update.status === "PAUSED" ? "PAUSED" : "RUNNING";
    const next: OperationsJob = { ...job, status, safePoint: status === "PAUSED" ? "PAUSED" : status === "RUNNING" ? "PENDING" : "IDLE", ...(update.outcome ? { outcome: update.outcome, contextSnapshotId: update.outcome.contextSnapshotId } : {}), updatedAtLogicalTime: this.simulation.snapshot().logicalTime, observedVersion: this.operationVersion + 1 };
    this.jobsById.set(jobId, cloneFreeze(next));
    this.changed("JOB", [jobId]);
  }

  acknowledgeIncident(incidentId: string, commandId: string, expectedVersion?: number): { readonly ok: true; readonly commandId: string } | { readonly ok: false; readonly error: JobCommandError; readonly commandId: string } {
    const previous = this.acknowledgementResults.get(commandId);
    if (previous) return cloneFreeze(previous);
    const view = this.getPark();
    if (expectedVersion !== undefined && expectedVersion !== view.version) {
      const result = { ok: false as const, commandId, error: error("STALE_SNAPSHOT", "Incident acknowledgement used a stale Park snapshot.", commandId, { observedVersion: view.version, expectedVersion }) };
      this.acknowledgementResults.set(commandId, result);
      return result;
    }
    if (!view.incidents.some((incident) => incident.id === incidentId)) {
      const result = { ok: false as const, commandId, error: error("INVALID_COMMAND", `Incident ${incidentId} does not exist.`, commandId) };
      this.acknowledgementResults.set(commandId, result);
      return result;
    }
    this.acknowledged.add(incidentId);
    this.changed("INCIDENT", [incidentId]);
    const result = { ok: true as const, commandId };
    this.acknowledgementResults.set(commandId, result);
    return result;
  }

  intervene(command: WorldCommand, commandId = command.commandId): { readonly ok: true; readonly events: readonly WorldEvent[] } | { readonly ok: false; readonly error: JobCommandError } {
    const previous = this.interventionResults.get(commandId);
    if (previous) return cloneFreeze(previous);
    if (!command || typeof command !== "object" || typeof commandId !== "string" || commandId.length === 0 || command.commandId !== commandId) {
      const failed = { ok: false as const, error: error("INVALID_COMMAND", "Interventions require one stable commandId shared by the request and world command.", commandId) };
      this.interventionResults.set(commandId, failed);
      return failed;
    }
    const result = this.simulation.command(command);
    if (!result.ok) {
      const failed = { ok: false as const, error: error("INVALID_COMMAND", `${result.code}: ${Object.entries(result.details).map(([key, value]) => `${key}=${value}`).join(", ")}`, commandId) };
      this.interventionResults.set(commandId, failed);
      return failed;
    }
    const scheduled = this.simulation.pendingEvents().find((event) => event.commandId === commandId);
    const events = this.paused || !scheduled ? [] : this.simulation.advanceTo(scheduled.logicalTime).filter((event) => event.commandId === commandId || event.type === "INCIDENT_OPENED" || event.type === "INCIDENT_RECOVERED");
    this.changed("INCIDENT", events.map((event) => event.id));
    const completed = { ok: true as const, events: cloneFreeze(events) };
    this.interventionResults.set(commandId, completed);
    return completed;
  }

  persistenceSnapshot(): ParkOperationsPersistenceState {
    return cloneFreeze({ world: this.simulation.snapshot(), jobs: this.jobs(), commandResults: [...this.commandResults.entries()].map(([id, result]) => ({ id, result })), acknowledgedIncidentIds: [...this.acknowledged].sort(), memory: this.memory.repository().list(), operationVersion: this.operationVersion, paused: this.paused, speed: this.speed });
  }

  restoreWorld(snapshot: WorldSnapshot): void {
    const restored = this.simulation.restore(cloneFreeze(snapshot));
    if (!restored.ok) throw new Error(`Park world restore failed: ${restored.error.map((item) => `${item.path}:${item.code}`).join("; ")}`);
    this.viewCache = undefined;
  }

  restorePersistence(state: ParkOperationsPersistenceState): void {
    this.restoreWorld(state.world);
    this.jobsById.clear(); for (const job of state.jobs) this.jobsById.set(job.id, cloneFreeze(job));
    this.commandResults.clear(); for (const item of state.commandResults) this.commandResults.set(item.id, cloneFreeze(item.result));
    this.acknowledged.clear(); for (const id of state.acknowledgedIncidentIds) this.acknowledged.add(id);
    this.memory.repository().replace(state.memory);
    this.executions.clear(); this.enginesByJob.clear(); this.acknowledgementResults.clear(); this.interventionResults.clear();
    this.operationVersion = state.operationVersion; this.paused = state.paused; this.speed = state.speed; this.viewCache = undefined;
    for (const listener of [...this.listeners]) listener({ version: this.operationVersion, kind: "SNAPSHOT", ids: [], logicalTime: state.world.logicalTime });
  }

  memoryRepository() { return this.memory.repository(); }

  isPersistenceSafe(): boolean {
    return this.paused || !this.jobs().some((job) => job.status === "RUNNING" && job.safePoint === "PENDING");
  }

  enterPersistenceSafeBoundary(): () => void {
    const previous = { paused: this.paused, speed: this.speed };
    this.paused = true;
    return () => { this.paused = previous.paused; this.speed = previous.speed; };
  }
}

export function createParkOperationsService(options: ParkOperationsServiceOptions = {}): ParkOperationsService & { readonly runToCompletion: (jobId: string, commandId?: string) => JobCommandResult } {
  return new ParkOperationsRuntime(options);
}

export const createJobApplicationService = createParkOperationsService;
