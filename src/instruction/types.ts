import type { ContentReference } from "../content-registry/public.js";
import type { CommandResult, SimulationEngine, ToolEvidence, WorldCommand } from "../simulation/public.js";

export type InstructionArtifactClass =
  | "Task"
  | "Prompt"
  | "Skill"
  | "SystemPrompt"
  | "Policy"
  | "ToolInstruction"
  | "KnowledgeSelection"
  | "Verification"
  | "Failure"
  | "Escalation"
  | "Delegation"
  | "Reporting";

export type FactValue = string | number | boolean | null;

export type Expression =
  | { readonly operator: "always" }
  | { readonly operator: "fact-exists"; readonly fact: string }
  | { readonly operator: "fact-equals" | "fact-not-equals"; readonly fact: string; readonly value: FactValue }
  | { readonly operator: "fact-in"; readonly fact: string; readonly values: readonly FactValue[] }
  | { readonly operator: "fact-gte" | "fact-lte"; readonly fact: string; readonly value: number }
  | { readonly operator: "all" | "any"; readonly expressions: readonly Expression[] }
  | { readonly operator: "not"; readonly expression: Expression };

export interface InstructionEvidence extends ToolEvidence {
  readonly observedAtTick: number;
}

export type DecisionOutcome =
  | { readonly kind: "tool-request"; readonly command: WorldCommand }
  | { readonly kind: "complete"; readonly reasonCode: string }
  | { readonly kind: "wait"; readonly reasonCode: string }
  | { readonly kind: "stop"; readonly reasonCode: string }
  | { readonly kind: "escalate"; readonly reasonCode: string; readonly target: string };

export interface VerificationRule {
  readonly claim: { readonly sourceId: string; readonly field: string; readonly expected: FactValue };
  readonly acceptableSources: readonly InstructionEvidence["source"][];
  readonly acceptableReliability: readonly InstructionEvidence["reliability"][];
  readonly maxAgeTicks: number;
  readonly minimumAgreement: number;
  readonly maxRetries: number;
  readonly failureOutcome: DecisionOutcome;
}

export interface InstructionClause {
  readonly id: string;
  readonly type: "action" | "completion" | "wait" | "stop" | "escalation" | "delegation" | "reporting" | "knowledge-selection" | "verification" | "failure";
  readonly applicability: Expression;
  readonly priority: number;
  readonly requiredFacts: readonly string[];
  readonly preconditions: readonly Expression[];
  readonly postconditions: readonly Expression[];
  readonly conflictGroup?: string;
  readonly conflictResolution: "select" | "combine" | "stop" | "escalate";
  readonly outcome: DecisionOutcome;
  readonly verification?: VerificationRule;
}

export interface InstructionArtifactData {
  readonly schemaVersion: "1";
  readonly requiredTools: readonly ContentReference[];
  readonly clauses: readonly InstructionClause[];
  readonly knownTradeoffs: readonly string[];
}

export interface ResolvedInstructionArtifact {
  readonly reference: ContentReference;
  readonly class: InstructionArtifactClass;
  readonly readableSource: string;
  readonly author: string;
  readonly contextCost: number;
  readonly dependencies: readonly ContentReference[];
  readonly requiredTools: readonly ContentReference[];
  readonly clauses: readonly InstructionClause[];
  readonly knownTradeoffs: readonly string[];
}

export interface ClauseProvenance {
  readonly clauseId: string;
  readonly source: ContentReference;
  readonly sourceClass: InstructionArtifactClass;
  readonly status: "applied" | "rejected" | "conflicting";
  readonly reasonCode: string;
}

export interface CompositionFinding {
  readonly kind: "duplicate" | "conflict";
  readonly clauseIds: readonly string[];
  readonly sourceReferences: readonly ContentReference[];
  readonly reasonCode: string;
}

export interface ComposedInstructionSet {
  readonly artifacts: readonly ResolvedInstructionArtifact[];
  readonly clauses: readonly { readonly clause: InstructionClause; readonly source: ResolvedInstructionArtifact }[];
  readonly findings: readonly CompositionFinding[];
}

export interface InstructionDecisionInput {
  readonly artifacts: readonly ResolvedInstructionArtifact[];
  readonly facts: Readonly<Record<string, FactValue>>;
  readonly evidence: readonly InstructionEvidence[];
  readonly currentTick: number;
  readonly retryCounts?: Readonly<Record<string, number>>;
}

export interface InstructionDecision {
  readonly schemaVersion: "1";
  readonly outcome: DecisionOutcome;
  readonly provenance: readonly ClauseProvenance[];
  readonly unsatisfiedRequirements: readonly string[];
  readonly compositionFindings: readonly CompositionFinding[];
}

export type InstructionValidationResult =
  | { readonly ok: true; readonly artifact: ResolvedInstructionArtifact }
  | { readonly ok: false; readonly diagnostics: readonly InstructionDiagnostic[] };

export interface InstructionDiagnostic {
  readonly code: "INSTRUCTION_INVALID" | "INSTRUCTION_CONTENT_MISSING" | "INSTRUCTION_CONTENT_INCOMPATIBLE";
  readonly path: string;
  readonly message: string;
}

export interface InstructionToolExecution {
  readonly decision: InstructionDecision;
  readonly commandResult: CommandResult;
  readonly evidence: readonly InstructionEvidence[];
}

export type InstructionToolPort = Pick<SimulationEngine, "execute">;
