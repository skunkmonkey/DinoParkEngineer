/** The sole downstream import surface for deterministic authored Agent behavior. */
export {
  composeInstructionArtifacts,
  evaluateExpression,
  executeInstruction,
  executeInstructionTool,
  resolveInstructionArtifacts,
  validateInstructionRecord,
} from "./engine.js";
export { createInstructionFoundationFixture } from "./foundation-fixture.js";
export {
  decisionOutcomeSchema,
  expressionSchema,
  instructionArtifactClassSchema,
  instructionArtifactDataSchema,
  instructionClauseSchema,
  instructionEvidenceSchema,
  verificationRuleSchema,
} from "./schemas.js";
export type {
  ClauseProvenance,
  ComposedInstructionSet,
  CompositionFinding,
  DecisionOutcome,
  Expression,
  FactValue,
  InstructionArtifactClass,
  InstructionArtifactData,
  InstructionClause,
  InstructionDecision,
  InstructionDecisionInput,
  InstructionDiagnostic,
  InstructionEvidence,
  InstructionToolExecution,
  ResolvedInstructionArtifact,
  VerificationRule,
} from "./types.js";
