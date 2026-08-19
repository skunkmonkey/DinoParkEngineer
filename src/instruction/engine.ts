import type { ContentRecord, ContentReference, ContentRegistry } from "../content-registry/public.js";
import type { SimulationEngine } from "../simulation/public.js";
import { instructionArtifactClassSchema, instructionArtifactDataSchema } from "./schemas.js";
import type {
  ClauseProvenance,
  ComposedInstructionSet,
  CompositionFinding,
  DecisionOutcome,
  Expression,
  FactValue,
  InstructionArtifactClass,
  InstructionArtifactData,
  InstructionDecision,
  InstructionDecisionInput,
  InstructionDiagnostic,
  InstructionEvidence,
  InstructionToolExecution,
  InstructionValidationResult,
  ResolvedInstructionArtifact,
  VerificationRule,
} from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const cloneFreeze = <T>(value: T): T => {
  const clone = structuredClone(value);
  const freeze = (entry: unknown): void => {
    if (entry !== null && typeof entry === "object") {
      Object.freeze(entry);
      for (const child of Object.values(entry)) freeze(child);
    }
  };
  freeze(clone);
  return clone;
};
const key = (reference: ContentReference): string => `${reference.id}@${reference.version}`;
const artifactPrecedence: Readonly<Record<InstructionArtifactClass, number>> = {
  SystemPrompt: 12,
  Policy: 11,
  Task: 10,
  Skill: 9,
  Prompt: 8,
  ToolInstruction: 7,
  KnowledgeSelection: 6,
  Verification: 5,
  Failure: 4,
  Escalation: 3,
  Delegation: 2,
  Reporting: 1,
};

const diagnostic = (code: InstructionDiagnostic["code"], path: string, message: string): InstructionDiagnostic => ({ code, path, message });

export const validateInstructionRecord = (record: ContentRecord): InstructionValidationResult => {
  const contentClass = instructionArtifactClassSchema.safeParse(record.class);
  if (!contentClass.success) return { ok: false, diagnostics: [diagnostic("INSTRUCTION_CONTENT_INCOMPATIBLE", "class", `Unsupported instruction class ${record.class}.`)] };
  const parsed = instructionArtifactDataSchema.safeParse(record.data);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.error.issues.map((issue) => diagnostic("INSTRUCTION_INVALID", issue.path.map(String).join(".") || "$", issue.message)),
    };
  }
  if (record.readableSource === undefined) return { ok: false, diagnostics: [diagnostic("INSTRUCTION_INVALID", "readableSource", "Instruction artifacts require inspectable readable source text.")] };
  // Zod has validated the stable-ID template constraints that TypeScript cannot
  // infer from a regular-expression-backed string schema.
  const data = parsed.data as InstructionArtifactData;
  const clauseIds = data.clauses.map((clause) => clause.id);
  if (new Set(clauseIds).size !== clauseIds.length) return { ok: false, diagnostics: [diagnostic("INSTRUCTION_INVALID", "clauses", "Clause IDs must be unique within an artifact.")] };
  return {
    ok: true,
    artifact: cloneFreeze({
      reference: { id: record.id, version: record.version },
      class: contentClass.data,
      readableSource: record.readableSource,
      author: record.author,
      contextCost: record.contextCost,
      dependencies: record.dependencies,
      requiredTools: data.requiredTools,
      clauses: data.clauses,
      knownTradeoffs: data.knownTradeoffs,
    }),
  };
};

export const resolveInstructionArtifacts = (
  registry: Pick<ContentRegistry, "resolveExact">,
  references: readonly ContentReference[],
): { readonly ok: true; readonly artifacts: readonly ResolvedInstructionArtifact[] } | { readonly ok: false; readonly diagnostics: readonly InstructionDiagnostic[] } => {
  const artifacts: ResolvedInstructionArtifact[] = [];
  const diagnostics: InstructionDiagnostic[] = [];
  for (const reference of [...references].sort((a, b) => lexical(key(a), key(b)))) {
    const result = registry.resolveExact(reference.id, reference.version);
    if (!result.ok) {
      diagnostics.push(diagnostic("INSTRUCTION_CONTENT_MISSING", key(reference), `Exact instruction ${key(reference)} could not be resolved.`));
      continue;
    }
    const validated = validateInstructionRecord(result.manifest.root);
    if (!validated.ok) diagnostics.push(...validated.diagnostics);
    else artifacts.push(validated.artifact);
  }
  return diagnostics.length > 0 ? { ok: false, diagnostics: cloneFreeze(diagnostics) } : { ok: true, artifacts: cloneFreeze(artifacts) };
};

const outcomeSignature = (outcome: DecisionOutcome): string => JSON.stringify(outcome);

export const composeInstructionArtifacts = (artifacts: readonly ResolvedInstructionArtifact[]): ComposedInstructionSet => {
  const sortedArtifacts = [...artifacts].sort((a, b) => lexical(key(a.reference), key(b.reference)));
  const clauses = sortedArtifacts.flatMap((source) => source.clauses.map((clause) => ({ clause, source }))).sort((left, right) =>
    right.clause.priority - left.clause.priority
    || artifactPrecedence[right.source.class] - artifactPrecedence[left.source.class]
    || lexical(left.clause.id, right.clause.id)
    || lexical(key(left.source.reference), key(right.source.reference)),
  );
  const findings: CompositionFinding[] = [];
  const byId = new Map<string, typeof clauses>();
  for (const entry of clauses) byId.set(entry.clause.id, [...(byId.get(entry.clause.id) ?? []), entry]);
  for (const [clauseId, entries] of byId) {
    if (entries.length > 1) findings.push({ kind: "duplicate", clauseIds: [clauseId], sourceReferences: entries.map((entry) => entry.source.reference), reasonCode: "DUPLICATE_CLAUSE_ID" });
  }
  const groups = new Map<string, typeof clauses>();
  for (const entry of clauses) if (entry.clause.conflictGroup !== undefined) groups.set(entry.clause.conflictGroup, [...(groups.get(entry.clause.conflictGroup) ?? []), entry]);
  for (const entries of groups.values()) {
    if (new Set(entries.map((entry) => outcomeSignature(entry.clause.outcome))).size > 1) findings.push({ kind: "conflict", clauseIds: entries.map((entry) => entry.clause.id), sourceReferences: entries.map((entry) => entry.source.reference), reasonCode: "CONFLICTING_OUTCOMES" });
  }
  return cloneFreeze({ artifacts: sortedArtifacts, clauses, findings: findings.sort((a, b) => lexical(`${a.kind}:${a.clauseIds.join(",")}`, `${b.kind}:${b.clauseIds.join(",")}`)) });
};

export const evaluateExpression = (expression: Expression, facts: Readonly<Record<string, FactValue>>): boolean => {
  const value = "fact" in expression ? facts[expression.fact] : undefined;
  switch (expression.operator) {
    case "always": return true;
    case "fact-exists": return Object.hasOwn(facts, expression.fact);
    case "fact-equals": return Object.hasOwn(facts, expression.fact) && value === expression.value;
    case "fact-not-equals": return Object.hasOwn(facts, expression.fact) && value !== expression.value;
    case "fact-in": return expression.values.some((entry) => entry === value);
    case "fact-gte": return typeof value === "number" && value >= expression.value;
    case "fact-lte": return typeof value === "number" && value <= expression.value;
    case "all": return expression.expressions.every((entry) => evaluateExpression(entry, facts));
    case "any": return expression.expressions.some((entry) => evaluateExpression(entry, facts));
    case "not": return !evaluateExpression(expression.expression, facts);
  }
};

const verificationOutcome = (
  rule: VerificationRule,
  evidence: readonly InstructionEvidence[],
  currentTick: number,
  retryCount: number,
): { readonly satisfied: boolean; readonly outcome?: DecisionOutcome; readonly reasonCode: string } => {
  const relevant = evidence.filter((entry) =>
    entry.sourceId === rule.claim.sourceId
    && entry.field === rule.claim.field
    && rule.acceptableSources.includes(entry.source)
    && rule.acceptableReliability.includes(entry.reliability)
    && currentTick - entry.observedAtTick >= 0
    && currentTick - entry.observedAtTick <= rule.maxAgeTicks,
  );
  const agreeing = relevant.filter((entry) => entry.value === rule.claim.expected);
  const disagreeing = relevant.filter((entry) => entry.value !== rule.claim.expected);
  if (agreeing.length >= rule.minimumAgreement && disagreeing.length === 0) return { satisfied: true, reasonCode: "VERIFICATION_SATISFIED" };
  if (retryCount < rule.maxRetries && rule.failureOutcome.kind === "tool-request") return { satisfied: false, outcome: rule.failureOutcome, reasonCode: "VERIFICATION_RETRY" };
  if (rule.failureOutcome.kind === "tool-request") return { satisfied: false, outcome: { kind: "stop", reasonCode: "VERIFICATION_RETRY_EXHAUSTED" }, reasonCode: "VERIFICATION_RETRY_EXHAUSTED" };
  return { satisfied: false, outcome: rule.failureOutcome, reasonCode: disagreeing.length > 0 ? "VERIFICATION_DISAGREEMENT" : "VERIFICATION_INSUFFICIENT" };
};

export const executeInstruction = (input: InstructionDecisionInput): InstructionDecision => {
  const composed = composeInstructionArtifacts(input.artifacts);
  const provenance: ClauseProvenance[] = [];
  const unsatisfied = new Set<string>();
  const candidates: { readonly clause: import("./types.js").InstructionClause; readonly source: ResolvedInstructionArtifact }[] = [];
  const duplicateIds = new Set(composed.findings.filter((entry) => entry.kind === "duplicate").flatMap((entry) => entry.clauseIds));
  for (const entry of composed.clauses) {
    const missing = entry.clause.requiredFacts.filter((fact) => !Object.hasOwn(input.facts, fact));
    if (missing.length > 0) {
      missing.forEach((fact) => unsatisfied.add(fact));
      provenance.push({ clauseId: entry.clause.id, source: entry.source.reference, sourceClass: entry.source.class, status: "rejected", reasonCode: "MISSING_REQUIRED_FACT" });
      continue;
    }
    if (duplicateIds.has(entry.clause.id)) {
      provenance.push({ clauseId: entry.clause.id, source: entry.source.reference, sourceClass: entry.source.class, status: "conflicting", reasonCode: "DUPLICATE_CLAUSE_ID" });
      continue;
    }
    if (!evaluateExpression(entry.clause.applicability, input.facts) || !entry.clause.preconditions.every((condition) => evaluateExpression(condition, input.facts))) {
      provenance.push({ clauseId: entry.clause.id, source: entry.source.reference, sourceClass: entry.source.class, status: "rejected", reasonCode: "NOT_APPLICABLE" });
      continue;
    }
    candidates.push(entry);
  }
  const fallback = (reasonCode: string): InstructionDecision => cloneFreeze({ schemaVersion: "1", outcome: { kind: "stop", reasonCode }, provenance, unsatisfiedRequirements: [...unsatisfied].sort(lexical), compositionFindings: composed.findings });
  if (candidates.length === 0) return fallback(unsatisfied.size > 0 ? "REQUIRED_CONTEXT_UNAVAILABLE" : "NO_APPLICABLE_CLAUSE");

  const selected = candidates[0];
  if (selected === undefined) return fallback("NO_APPLICABLE_CLAUSE");
  const sameConflict = selected.clause.conflictGroup === undefined ? [selected] : candidates.filter((entry) => entry.clause.conflictGroup === selected.clause.conflictGroup && entry.clause.priority === selected.clause.priority);
  const signatures = new Set(sameConflict.map((entry) => outcomeSignature(entry.clause.outcome)));
  if (signatures.size > 1) {
    const resolution = sameConflict.some((entry) => entry.clause.conflictResolution === "escalate") ? "escalate" : sameConflict.some((entry) => entry.clause.conflictResolution === "stop") ? "stop" : "select";
    for (const entry of sameConflict.filter((candidate) => resolution !== "select" || candidate !== selected)) provenance.push({ clauseId: entry.clause.id, source: entry.source.reference, sourceClass: entry.source.class, status: "conflicting", reasonCode: "CONFLICTING_OUTCOMES" });
    if (resolution === "escalate") return cloneFreeze({ schemaVersion: "1", outcome: { kind: "escalate", reasonCode: "CLAUSE_CONFLICT", target: "agent:manager" }, provenance, unsatisfiedRequirements: [...unsatisfied].sort(lexical), compositionFindings: composed.findings });
    if (resolution === "stop") return fallback("CLAUSE_CONFLICT");
  }

  let outcome = selected.clause.outcome;
  let appliedReason = "CLAUSE_SELECTED";
  if (selected.clause.verification !== undefined) {
    const result = verificationOutcome(selected.clause.verification, input.evidence, input.currentTick, input.retryCounts?.[selected.clause.id] ?? 0);
    if (!result.satisfied && result.outcome !== undefined) outcome = result.outcome;
    appliedReason = result.reasonCode;
  }
  const combined = signatures.size === 1 && sameConflict.length > 1 && sameConflict.some((entry) => entry.clause.conflictResolution === "combine");
  for (const entry of combined ? sameConflict : [selected]) provenance.push({ clauseId: entry.clause.id, source: entry.source.reference, sourceClass: entry.source.class, status: "applied", reasonCode: combined ? "CLAUSES_COMBINED" : appliedReason });
  for (const entry of candidates.slice(1)) if (!sameConflict.includes(entry)) provenance.push({ clauseId: entry.clause.id, source: entry.source.reference, sourceClass: entry.source.class, status: "rejected", reasonCode: "LOWER_PRECEDENCE" });
  return cloneFreeze({ schemaVersion: "1", outcome, provenance, unsatisfiedRequirements: [...unsatisfied].sort(lexical), compositionFindings: composed.findings });
};

export const executeInstructionTool = (simulation: Pick<SimulationEngine, "execute">, decision: InstructionDecision): InstructionToolExecution | undefined => {
  if (decision.outcome.kind !== "tool-request") return undefined;
  const commandResult = simulation.execute(decision.outcome.command);
  const evidence = commandResult.accepted ? commandResult.evidence.map((entry) => ({ ...entry, observedAtTick: commandResult.resultingTick })) : [];
  return cloneFreeze({ decision, commandResult, evidence });
};
