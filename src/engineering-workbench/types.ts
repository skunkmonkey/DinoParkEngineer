import type { ContentReference } from "../content-registry/public.js";
import type { ContextCategory, ContextDiagnostic, ContextItem } from "../context/public.js";
import type { InstructionClause, ResolvedInstructionArtifact } from "../instruction/public.js";

export interface ArtifactHistoryEntry {
  readonly reference: ContentReference;
  readonly status: "historical" | "candidate" | "deployed";
  readonly summary: string;
}

export interface ArtifactInspection {
  readonly reference: ContentReference;
  readonly class: ResolvedInstructionArtifact["class"];
  readonly author: string;
  readonly readableSource: string;
  readonly clauses: readonly InstructionClause[];
  readonly contextCost: number;
  readonly contextComposition: readonly ContextCategory[];
  readonly dependencies: readonly ContentReference[];
  readonly requiredTools: readonly ContentReference[];
  readonly tradeoffs: readonly string[];
  readonly deploymentStatus: "historical" | "candidate" | "deployed";
  readonly history: readonly ArtifactHistoryEntry[];
}

export type ComparisonDimension = "readable" | "behavioral" | "context" | "dependency" | "tool" | "verification" | "failure" | "tradeoff";
export interface ComparisonEvidence { readonly id: string; readonly source: string; readonly detail: string }
export interface SemanticDifference {
  readonly id: string;
  readonly dimension: ComparisonDimension;
  readonly change: "added" | "removed" | "changed";
  readonly summary: string;
  readonly evidence: readonly ComparisonEvidence[];
}
export interface SemanticComparison {
  readonly left: ContentReference;
  readonly right: ContentReference;
  readonly differences: readonly SemanticDifference[];
  readonly findings: readonly { readonly kind: "duplicate" | "missing" | "stale" | "conflicting" | "irrelevant"; readonly evidence: readonly ComparisonEvidence[] }[];
}

export interface ContextRouteDraft {
  readonly id: string;
  readonly item: ContextItem;
  readonly included: boolean;
}
export interface CompositionPreview {
  readonly clauses: readonly InstructionClause[];
  readonly routes: readonly ContextRouteDraft[];
  readonly contextUsed: number;
  readonly contextCapacity: number;
  readonly contextDelta: number;
  readonly diagnostics: readonly ContextDiagnostic[];
  readonly valid: boolean;
}

export type ParkDeveloperCapability = "Prompt engineering" | "Skill authoring" | "Context optimization" | "Eval creation" | "Tool integration" | "Memory architecture" | "Agent design" | "Orchestration";
export interface ParkDeveloperProfile { readonly id: "park-developer:ada"; readonly name: string; readonly capabilities: Readonly<Record<ParkDeveloperCapability, "available" | "locked">> }
export interface WorkQuote { readonly id: string; readonly credits: number; readonly durationTicks: number; readonly category: "authoring" | "acquisition" }
export interface WorkRequest {
  readonly id: string;
  readonly goal: string;
  readonly baseVersion: ContentReference;
  readonly capability: ParkDeveloperCapability;
  readonly inputs: readonly string[];
  readonly quote: WorkQuote;
  readonly status: "quoted" | "accepted" | "completed" | "cancelled";
  readonly feedbackForCandidateId?: string;
}
export interface ArtifactCandidate {
  readonly id: string;
  readonly reference: ContentReference;
  readonly baseVersion: ContentReference;
  readonly requestId: string;
  readonly goal: string;
  readonly readableSource: string;
  readonly clauses: readonly InstructionClause[];
  readonly contextRoutes: readonly string[];
  readonly changeSummary: readonly string[];
  readonly productionAffected: false;
}

export interface HandbookEntry {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
  readonly visualGrammar: string;
  readonly encounteredExample: string;
  readonly tags: readonly string[];
  readonly incidentIds: readonly string[];
  readonly unlocked: boolean;
  readonly contextEligible: false;
}

export interface EngineeringWorkbenchService {
  readonly inspect: (artifact: ResolvedInstructionArtifact, history?: readonly ArtifactHistoryEntry[]) => ArtifactInspection;
  readonly compare: (left: ResolvedInstructionArtifact, right: ResolvedInstructionArtifact, contextFindings?: readonly ContextDiagnostic[]) => SemanticComparison;
  readonly compose: (artifacts: readonly ResolvedInstructionArtifact[], routes: readonly ContextRouteDraft[], capacity: number, baselineUsed: number) => CompositionPreview;
  readonly requestWork: (input: Omit<WorkRequest, "status">) => { readonly ok: true; readonly request: WorkRequest } | { readonly ok: false; readonly code: "WORKBENCH_CAPABILITY_LOCKED" | "WORKBENCH_INVALID_REQUEST" };
  readonly acceptWork: (requestId: string) => WorkRequest;
  readonly cancelWork: (requestId: string) => WorkRequest;
  readonly completeWork: (requestId: string, artifact: ResolvedInstructionArtifact, routes: readonly string[]) => ArtifactCandidate;
  readonly requestRevision: (candidateId: string, request: Omit<WorkRequest, "status" | "feedbackForCandidateId">) => WorkRequest;
  readonly candidates: () => readonly ArtifactCandidate[];
  readonly productionReference: () => ContentReference;
  readonly handbook: (query?: string, tag?: string) => readonly HandbookEntry[];
}
