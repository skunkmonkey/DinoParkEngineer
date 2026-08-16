import type { ArtifactRef, ArtifactVersion, Clause, ClauseCategory, ContentRegistry } from "../content-registry/index.ts";
import type { ContextRequest, ContextResult, ContextSnapshot } from "../context/index.ts";
import type { SimulationEngine, WorldEvent, WorldSnapshot } from "../simulation/index.ts";

export type JobTerminalStatus = "SUCCEEDED" | "FAILED" | "ESCALATED" | "BLOCKED";
export type ExecutionStatus = JobTerminalStatus | "RUNNING" | "PAUSED";

/** The minimum job shape needed by the instruction boundary. */
export interface InstructionJob {
  readonly id: string;
  readonly type: string;
  readonly targetRefs: readonly string[];
  readonly priority: number;
  readonly dueTime: number;
  readonly assignedAgentId: string;
  readonly status?: string;
  readonly promptRef?: ArtifactRef;
  readonly skillRefs?: readonly ArtifactRef[];
  readonly systemPromptRefs?: readonly ArtifactRef[];
  readonly managerDirectiveRefs?: readonly ArtifactRef[];
  readonly contextSnapshotId?: string;
  /** A caller may supply an already-built immutable context snapshot. */
  readonly contextSnapshot?: ContextSnapshot;
  readonly maxSteps?: number;
}

export interface AgentDefinition {
  readonly id: string;
  readonly name?: string;
  readonly role?: "WORKER" | "MANAGER" | string;
  readonly contextBudget: number;
  readonly systemPromptRefs?: readonly ArtifactRef[];
  readonly skillRefs?: readonly ArtifactRef[];
  readonly toolIds?: readonly string[];
  readonly tools?: readonly string[];
  readonly memoryPolicyId?: string;
  readonly managerConfig?: Readonly<Record<string, unknown>>;
}

export interface InstructionContentPort {
  getArtifact(ref: ArtifactRef): ArtifactVersion | undefined;
  getToolDescription?(toolId: string): unknown;
  dependencies?(ref: ArtifactRef, transitive?: boolean): readonly ArtifactRef[];
}

export interface InstructionContextPort {
  project(request: ContextRequest): ContextResult;
  buildActual?(request: ContextRequest, logicalTime: number): ContextResult;
}

/** Simulation is injected so instruction execution can never mutate a world directly. */
export type InstructionSimulationPort = Pick<SimulationEngine, "command" | "snapshot" | "advanceTo"> & Partial<Pick<SimulationEngine, "runNext" | "events">>;

export interface InstructionPorts {
  readonly content: InstructionContentPort | ContentRegistry;
  readonly context: InstructionContextPort;
  readonly simulation: InstructionSimulationPort;
  readonly provenance?: ProvenanceSink;
}

export type ClauseTier = "HARD_SAFETY" | "SYSTEM_PROMPT" | "MANAGER" | "SKILL" | "PROMPT" | "HEURISTIC";

export interface CompiledRuleNode {
  readonly nodeId: string;
  readonly clauseId: string;
  readonly artifactRef: ArtifactRef;
  readonly artifactType: ArtifactVersion["type"];
  readonly category: ClauseCategory;
  readonly tier: ClauseTier;
  readonly priority: number;
  readonly semanticKey?: string;
  readonly clause: Clause;
  readonly applicable: boolean;
  readonly skipReason?: string;
  readonly order: number;
}

export interface RuleConflict {
  readonly conflictId: string;
  readonly semanticKey: string;
  readonly contenders: readonly string[];
  readonly winnerNodeId: string;
  readonly winnerReason: string;
}

export interface CompiledRuleGraph {
  readonly id: string;
  readonly jobId: string;
  readonly nodes: readonly CompiledRuleNode[];
  readonly conflicts: readonly RuleConflict[];
  readonly skippedNodeIds: readonly string[];
  readonly canonical: string;
}

export interface AssertionResult {
  readonly clauseId: string;
  readonly category: "GOAL" | "POSTCONDITION" | "PRECONDITION" | "CONSTRAINT";
  readonly passed: boolean;
  readonly reasonCode: string;
  readonly fact?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

export interface JobOutcome {
  readonly jobId: string;
  readonly status: JobTerminalStatus;
  readonly reasonCode: string;
  readonly goalResults: readonly AssertionResult[];
  readonly postconditionResults: readonly AssertionResult[];
  readonly preconditionResults: readonly AssertionResult[];
  readonly incidentIds: readonly string[];
  readonly contextSnapshotId: string;
  readonly graphId: string;
  readonly diagnostics: readonly string[];
  readonly missingPostconditions: readonly string[];
  readonly worldSnapshot: WorldSnapshot;
}

export interface JobBlock {
  readonly blocked: true;
  readonly jobId: string;
  readonly code: string;
  readonly reasonCode: string;
  readonly diagnostics: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly context?: ContextSnapshot;
}

export interface PreparedJob {
  readonly job: InstructionJob;
  readonly agent: AgentDefinition;
  readonly contextSnapshot: ContextSnapshot;
  readonly graph: CompiledRuleGraph;
  readonly preparedAtLogicalTime: number;
  readonly maxSteps: number;
}

export type ProvenanceEventType =
  | "JOB_RECEIVED"
  | "VALIDATION"
  | "CONTEXT_BOUND"
  | "CLAUSE_COMPILED"
  | "CLAUSE_SKIPPED"
  | "CLAUSE_SELECTED"
  | "CONFLICT_RESOLVED"
  | "TOOL_REQUESTED"
  | "TOOL_RESULT"
  | "WORLD_EVENT"
  | "ASSERTION"
  | "RETRIEVAL_REQUEST"
  | "DELEGATION_REQUEST"
  | "REPORT"
  | "STATUS"
  | "OUTCOME";

export interface ProvenanceEvent {
  readonly id: string;
  readonly sequence: number;
  readonly executionId: string;
  readonly jobId: string;
  readonly type: ProvenanceEventType;
  readonly logicalTime: number;
  readonly clauseId?: string;
  readonly artifactRef?: ArtifactRef;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ProvenanceSink {
  append(event: ProvenanceEvent): void;
}

export interface DelegationRequest {
  readonly executionId: string;
  readonly jobId: string;
  readonly clauseId: string;
  readonly targetAgentId?: string;
  readonly taskType?: string;
  readonly targetRefs: readonly string[];
}

export interface ReportingUpdate {
  readonly clauseId: string;
  readonly status: string;
  readonly message?: string;
  readonly facts?: Readonly<Record<string, unknown>>;
}

export interface RetrievalRequest {
  readonly clauseId: string;
  readonly refs: readonly string[];
  readonly query?: string;
}

export interface ExecutionUpdate {
  readonly executionId: string;
  readonly jobId: string;
  readonly status: ExecutionStatus;
  readonly events: readonly ProvenanceEvent[];
  readonly provenance: readonly ProvenanceEvent[];
  readonly graph: CompiledRuleGraph;
  readonly outcome?: JobOutcome;
  readonly pendingCommandId?: string;
  readonly delegationRequests: readonly DelegationRequest[];
  readonly retrievalRequests: readonly RetrievalRequest[];
  readonly reports: readonly ReportingUpdate[];
}

export interface InstructionEngine {
  prepare(job: InstructionJob, agent: AgentDefinition): { readonly ok: true; readonly value: PreparedJob } | { readonly ok: false; readonly error: JobBlock };
  start(prepared: PreparedJob): ExecutionUpdate;
  handleWorldEvents(executionId: string, events: readonly WorldEvent[]): ExecutionUpdate;
  cancelAtSafePoint(executionId: string): ExecutionUpdate;
  resume(executionId: string): ExecutionUpdate;
  /** Convenience for headless callers: consume simulation events until idle. */
  runToCompletion(executionId: string): ExecutionUpdate;
}
