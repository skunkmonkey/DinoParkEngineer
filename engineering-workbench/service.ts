import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import type {
  ArtifactRef,
  ArtifactType,
  ArtifactVersion,
  ContentRegistry,
  Result,
} from "../content-registry/index.ts";
import type { ContextBlock, ContextRequest, ContextSnapshot } from "../context/index.ts";
import type { CreditBalance, ProgressSnapshot } from "../economy-progression/index.ts";
import type { EvalCaseResult, EvalService } from "../eval-runner/index.ts";
import type { ReviewService } from "../review-deployment/index.ts";
import { DEFAULT_COMMISSION_RECIPES, recipeArtifact } from "./recipes.ts";
import type {
  AssetContextProjection,
  AssetDetail,
  AssetQuery,
  AssetReviewLink,
  AssetSummary,
  CapabilityPresentation,
  ClauseSummary,
  CommissionEconomyPort,
  CommissionError,
  CommissionOffer,
  CommissionRecipe,
  CommissionResult,
  ContextProjectionProfile,
  EvalCoverageEntry,
  ReviewIntakePort,
  StructuredChoice,
  WorkbenchDeploymentPort,
  WorkbenchHistoryPort,
  WorkbenchProgressPort,
  WorkbenchService,
  WorkbenchServiceOptions,
} from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function sameRef(left: ArtifactRef | undefined, right: ArtifactRef | undefined): boolean {
  return Boolean(left && right && left.artifactId === right.artifactId && left.version === right.version);
}

function stableRefs(refs: readonly ArtifactRef[]): readonly ArtifactRef[] {
  return freeze([...new Map(refs.map((ref) => [refKey(ref), { artifactId: ref.artifactId, version: ref.version }])).values()].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function resultError(code: CommissionError["code"], message: string, transactionId?: string, extras: Partial<CommissionError> = {}): { readonly ok: false; readonly error: CommissionError } {
  return { ok: false, error: freeze({ code, message, ...(transactionId ? { transactionId } : {}), ...extras }) };
}

function readProgress(port: WorkbenchProgressPort | undefined, supplied?: ProgressSnapshot): ProgressSnapshot {
  if (supplied) return supplied;
  if (port) return port.snapshot();
  return freeze({ phase: 0, stateVersion: 0, signals: {}, milestones: [], completedObjectives: [], unlocks: [], capabilities: ["capability.prompt.basic"], workerCount: 1, contextCapacity: 8_000, interventions: 0, metrics: {} });
}

function balanceOf(economy: CommissionEconomyPort | undefined): CreditBalance {
  return economy?.balance() ?? freeze({ amount: Number.MAX_SAFE_INTEGER, version: 0 });
}

function profileDefaults(profiles: readonly ContextProjectionProfile[] | undefined): readonly ContextProjectionProfile[] {
  return profiles && profiles.length > 0 ? profiles : freeze([{ id: "workbench.default", agentId: "keeper-01", jobId: "workbench.inspect", budget: 8_000, toolIds: ["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security"], applicabilityTags: ["task:feeding", "safety:standard"], logicalTime: 0 }]);
}

function contextRequest(profile: ContextProjectionProfile, ref: ArtifactRef, type: ArtifactType, registry: ContentRegistry, suffix: string): ContextRequest {
  const base = { id: `workbench.${profile.id}.${suffix}.${ref.artifactId}.${ref.version}`, agentId: profile.agentId, jobId: profile.jobId, budget: profile.budget, logicalTime: profile.logicalTime ?? 0, registry, toolIds: profile.toolIds, applicabilityTags: profile.applicabilityTags };
  if (type === "PROMPT") return { ...base, promptRef: ref };
  if (type === "SKILL") return { ...base, skillRefs: [ref] };
  if (type === "SYSTEM_PROMPT") return { ...base, systemPromptRefs: [ref] };
  if (type === "KNOWLEDGE") return { ...base, knowledgeRefs: [ref] };
  return { ...base, artifactRefs: [ref] };
}

function projectionFromResult(profile: ContextProjectionProfile, value: ContextSnapshot | ContextBlock | undefined): AssetContextProjection {
  if (!value) return freeze({ profileId: profile.id, totalLoad: 0, budget: profile.budget, blocked: true, mode: "PROJECTED", items: [], diagnostics: ["Context Service unavailable."] });
  return freeze({ profileId: profile.id, totalLoad: value.totalLoad, budget: value.budget, blocked: "blocked" in value && value.blocked === true, mode: "mode" in value ? value.mode : "PROJECTED", items: "items" in value ? value.items : [], diagnostics: "diagnostics" in value ? value.diagnostics : [] });
}

function clauseBehavior(clause: ArtifactVersion["clauses"][number]): readonly string[] {
  const behavior: string[] = [];
  for (const [key, value] of Object.entries(clause.conditions ?? {})) behavior.push(`when ${key}=${String(value)}`);
  for (const [key, value] of Object.entries(clause.action ?? {})) behavior.push(`action ${key}=${String(value)}`);
  for (const [key, value] of Object.entries(clause.assert ?? {})) behavior.push(`assert ${key}=${String(value)}`);
  for (const [key, value] of Object.entries(clause.onFail ?? {})) behavior.push(`on-fail ${key}=${String(value)}`);
  return freeze(behavior);
}

function summarizeClause(clause: ArtifactVersion["clauses"][number]): ClauseSummary {
  return freeze({ id: clause.id, type: clause.type, sourceText: clause.sourceText, ...(clause.semanticKey ? { semanticKey: clause.semanticKey } : {}), ...(clause.priority === undefined ? {} : { priority: clause.priority }), behavior: clauseBehavior(clause) });
}

function resultStatus(result: EvalCaseResult | undefined, built: boolean): EvalCoverageEntry["status"] {
  if (!built) return "UNBUILT";
  if (!result) return "BUILT";
  if (result.status === "PASSED") return "PASSED";
  if (result.status === "FAILED") return "FAILED";
  if (result.status.startsWith("BLOCKED") || result.status === "ISOLATION_FAILED") return "BLOCKED";
  return "UNAVAILABLE";
}

function evalCoverage(evals: EvalService | undefined, ref: ArtifactRef): readonly EvalCoverageEntry[] {
  if (!evals) return freeze([]);
  return freeze(evals.catalog().filter((entry) => sameRef(entry.definition.subjectRef, ref)).map((entry) => {
    const results = evals.results(entry.ref);
    const lastResult = results.at(-1);
    return { ref: entry.ref, title: entry.definition.title, description: entry.definition.description, built: entry.built, buildCostCredits: entry.buildCostCredits, runCostCredits: entry.runCostCredits, ...(lastResult ? { lastResult } : {}), status: resultStatus(lastResult, entry.built) };
  }));
}

function reviewLinks(reviews: ReviewService | WorkbenchHistoryPort | undefined, ref: ArtifactRef): readonly AssetReviewLink[] {
  if (!reviews || typeof reviews.list !== "function") return freeze([]);
  return freeze(reviews.list().filter((review) => sameRef(review.proposedRef, ref)).map((review) => ({ reviewId: review.reviewId, state: review.state, version: review.version, revision: review.revision, href: `/reviews?review=${encodeURIComponent(review.reviewId)}&artifact=${encodeURIComponent(ref.artifactId)}&version=${ref.version}` })));
}

function readActive(deployment: WorkbenchDeploymentPort | undefined, artifact: ArtifactVersion): { deployed: boolean; current: boolean } {
  const active = deployment?.resolveActive?.(artifact.artifactId);
  if (active) return { deployed: sameRef(active, artifact) || artifact.status === "DEPLOYED", current: sameRef(active, artifact) };
  return { deployed: artifact.status === "DEPLOYED", current: artifact.status === "DEPLOYED" };
}

export function createWorkbenchService(options: WorkbenchServiceOptions): WorkbenchService {
  const registry = options.registry;
  const context = options.context;
  const profiles = profileDefaults(options.contextProfiles);
  const recipes = freeze([...(options.recipes ?? DEFAULT_COMMISSION_RECIPES)].map((recipe) => freeze(recipe)));
  const progressPort = options.progress ?? (options.economy as unknown as WorkbenchProgressPort | undefined);
  const successful = new Map<string, CommissionResult>();
  const retryAttempts = new Map<string, number>();
  const contextCache = new Map<string, readonly AssetContextProjection[]>();

  function project(ref: ArtifactRef, type: ArtifactType): readonly AssetContextProjection[] {
    const cacheKey = refKey(ref);
    const cached = contextCache.get(cacheKey);
    if (cached) return cached;
    const value = freeze(profiles.map((profile) => {
      if (!context) return projectionFromResult(profile, undefined);
      const result = context.project(contextRequest(profile, ref, type, registry, "projected"));
      return projectionFromResult(profile, result.ok ? result.value : result.error);
    }));
    contextCache.set(cacheKey, value);
    return value;
  }

  function summary(artifact: ArtifactVersion): AssetSummary {
    const contexts = project(artifact, artifact.type);
    const first = contexts[0];
    const active = readActive(options.deployment, artifact);
    const coverage = evalCoverage(options.evals, artifact);
    return freeze({ ref: { artifactId: artifact.artifactId, version: artifact.version }, artifactId: artifact.artifactId, version: artifact.version, type: artifact.type, title: artifact.title, status: artifact.status, authoredByCapability: artifact.authoredByCapability, applicabilityTags: artifact.applicabilityTags, requiredToolIds: artifact.requiredToolIds, contextCost: first?.totalLoad ?? 0, contextBlocked: first?.blocked ?? false, deployed: active.deployed, current: active.current, evalCount: coverage.length, usedByCount: registry.usedBy(artifact).length });
  }

  function listAssets(query: AssetQuery = {}): readonly AssetSummary[] {
    const types = query.type === undefined ? undefined : new Set(Array.isArray(query.type) ? query.type : [query.type]);
    const needle = (query.search ?? query.title)?.toLowerCase();
    return freeze(registry.queryArtifacts({}).filter((artifact) => !types || types.has(artifact.type)).filter((artifact) => !query.status || artifact.status === query.status).filter((artifact) => !query.tag || artifact.applicabilityTags.includes(query.tag)).filter((artifact) => !query.capability || artifact.authoredByCapability === query.capability).filter((artifact) => !query.toolId || artifact.requiredToolIds.includes(query.toolId)).filter((artifact) => !needle || artifact.title.toLowerCase().includes(needle) || artifact.artifactId.toLowerCase().includes(needle)).map(summary).filter((asset) => {
      if (query.deployed !== undefined && asset.deployed !== query.deployed) return false;
      if (query.deploymentState === "DEPLOYED" && !asset.deployed) return false;
      if (query.deploymentState === "HISTORICAL" && (asset.current || asset.status === "DEPLOYED")) return false;
      if (query.deploymentState === "REVIEW" && asset.status !== "REVIEW") return false;
      if (query.deploymentState === "DRAFT" && asset.status !== "DRAFT") return false;
      if (query.deploymentState === "RETIRED" && asset.status !== "RETIRED") return false;
      return true;
    }));
  }

  function getAsset(ref: ArtifactRef): AssetDetail | undefined {
    const artifact = registry.getArtifact(ref);
    if (!artifact) return undefined;
    const base = summary(artifact);
    const history = registry.queryArtifacts({ artifactId: artifact.artifactId }).filter((item) => !sameRef(item, artifact)).map(summary);
    const tools = artifact.requiredToolIds.map((id) => registry.getToolDescription(id)).filter((item): item is NonNullable<typeof item> => item !== undefined);
    const missingTools = artifact.requiredToolIds.filter((id) => registry.getToolDescription(id) === undefined && !["move_to", "open_gate", "dispense_food", "close_gate", "lock_gate", "alert_security", "observe", "wait", "report"].includes(id));
    return freeze({ ...base, sourceText: artifact.sourceText, clauses: artifact.clauses.map(summarizeClause), dependencies: registry.dependencies(ref, false), transitiveDependencies: registry.dependencies(ref, true), tools, missingTools, context: project(ref, artifact.type), evalCoverage: evalCoverage(options.evals, ref), history, usedBy: registry.usedBy(ref), reviews: reviewLinks(options.reviews, ref), createdAtGameTime: artifact.createdAtGameTime });
  }

  function capabilities(progress?: ProgressSnapshot): readonly CapabilityPresentation[] {
    const snapshot = readProgress(progressPort, progress);
    const unlocked = new Set(snapshot.capabilities);
    const unlockReason = (id: string): string => snapshot.unlocks.find((item) => item.id === id)?.reason ?? `${id} is not unlocked by the current Park Developer phase.`;
    const records: readonly Omit<CapabilityPresentation, "unlocked" | "level" | "reason">[] = [
      { id: "capability.prompt.basic", label: "Prompt selection", area: "PROMPT", phase: 0, prerequisites: [] },
      { id: "capability.skill.basic", label: "Skill design", area: "SKILL", phase: 1, prerequisites: ["capability.prompt.basic"] },
      { id: "capability.context-meter", label: "Context engineering", area: "CONTEXT", phase: 4, prerequisites: ["capability.skill.basic"] },
      { id: "capability.tooling", label: "Tool descriptions", area: "TOOL", phase: 2, prerequisites: ["capability.skill.basic"] },
      { id: "capability.evals", label: "Eval authoring", area: "EVAL", phase: 5, prerequisites: ["capability.context-meter"] },
      { id: "capability.memory", label: "Memory controls", area: "MEMORY", phase: 7, prerequisites: ["capability.review"] },
      { id: "capability.manager-agent", label: "Agent orchestration", area: "AGENT_ORCHESTRATION", phase: 9, prerequisites: ["capability.memory"] },
    ];
    return freeze(records.map((record) => {
      const effectiveUnlocked = unlocked.has(record.id) || (record.id === "capability.tooling" && unlocked.has("capability.source-inspection"));
      return { ...record, unlocked: effectiveUnlocked, level: effectiveUnlocked ? 1 : 0, reason: effectiveUnlocked ? `Unlocked in Park Developer phase ${snapshot.phase}.` : unlockReason(record.id) };
    }));
  }

  function offer(recipe: CommissionRecipe, progress: ProgressSnapshot): CommissionOffer {
    const existing = registry.getArtifact({ artifactId: recipe.output.artifactId, version: recipe.output.version });
    const completedResult = [...successful.values()].find((result) => refKey(result.recipeRef) === refKey(recipe.ref));
    const existingReview = reviewLinks(options.reviews, { artifactId: recipe.output.artifactId, version: recipe.output.version }).length > 0;
    const balance = balanceOf(options.economy);
    if (completedResult || (existing && existingReview)) return freeze({ ...recipe, status: "COMPLETED", reason: `Exact proposal ${refKey(recipe.output)} already exists in Review; deployed content remains unchanged.`, balance, existingProposalRef: { ...recipe.output } });
    if (recipe.requiredPhase !== undefined && progress.phase < recipe.requiredPhase) return freeze({ ...recipe, status: "LOCKED", reason: `Requires Park Developer phase ${recipe.requiredPhase}; current phase is ${progress.phase}.`, balance });
    if (recipe.capabilityRequirement && !progress.capabilities.includes(recipe.capabilityRequirement)) return freeze({ ...recipe, status: "LOCKED", reason: `Requires capability ${recipe.capabilityRequirement}; it is not unlocked yet.`, balance });
    const missing = recipe.prerequisites.filter((id) => !progress.capabilities.includes(id));
    if (missing.length > 0) return freeze({ ...recipe, status: "LOCKED", reason: `Missing prerequisite: ${missing.join(", ")}.`, balance });
    if (balance.amount < recipe.costCredits) return freeze({ ...recipe, status: "LOCKED", reason: `Requires ${recipe.costCredits} credits; current balance is ${balance.amount}.`, balance });
    return freeze({ ...recipe, status: "AVAILABLE", reason: "Recipe is unlocked and affordable. Confirming creates one exact Review proposal.", balance });
  }

  function listCommissions(progress?: ProgressSnapshot): readonly CommissionOffer[] {
    return freeze(recipes.map((recipe) => offer(recipe, readProgress(progressPort, progress))));
  }

  function validateChoices(recipe: CommissionRecipe, choices: readonly StructuredChoice[]): CommissionError | undefined {
    const definitions = new Map(recipe.choices.map((choice) => [choice.id, choice]));
    const supplied = new Map<string, StructuredChoice>();
    for (const choice of choices) {
      const definition = definitions.get(choice.id);
      if (!definition || supplied.has(choice.id)) return { code: "INVALID_CHOICE", message: `Choice ${choice.id} is not an authored unique choice for this recipe.` };
      if (!definition.options.some((option) => option.id === choice.optionId)) return { code: "INVALID_CHOICE", message: `Choice ${choice.id} must select one of the authored options.` };
      supplied.set(choice.id, choice);
    }
    const missing = recipe.choices.filter((choice) => choice.required && !supplied.has(choice.id));
    return missing.length > 0 ? { code: "INVALID_CHOICE", message: `Select an authored option for: ${missing.map((choice) => choice.label).join(", ")}.` } : undefined;
  }

  function compensate(transactionId: string, amount: number, reason: string): boolean {
    try {
      if (options.compensate) {
        options.compensate(transactionId, amount, reason);
        return true;
      }
      if (!options.economy || amount <= 0) return false;
      const result = options.economy.transact({ transactionId: `${transactionId}:compensation`, type: "COMMISSION", amount, sourceRef: `commission-compensation:${reason}`, expectedBalanceVersion: options.economy.balance().version, logicalTime: options.logicalTime ?? 0 });
      return result.ok;
    } catch {
      return false;
    }
  }

  function commission(recipeRef: { readonly artifactId: string; readonly version: number }, choices: readonly StructuredChoice[], transactionId: string): Result<CommissionResult, CommissionError> {
    const prior = successful.get(transactionId);
    if (prior) return { ok: true, value: freeze({ ...prior, duplicate: true }) };
    if (!transactionId.trim()) return resultError("INVALID_TRANSACTION", "A stable commission transaction id is required.", transactionId);
    const recipe = recipes.find((item) => sameRef(item.ref, recipeRef));
    if (!recipe) return resultError("UNKNOWN_RECIPE", `Commission recipe ${refKey(recipeRef)} is not available.`, transactionId);
    const choiceError = validateChoices(recipe, choices);
    if (choiceError) return resultError(choiceError.code, choiceError.message, transactionId);
    const progress = readProgress(progressPort);
    const unlocked = offer(recipe, progress);
    if (unlocked.status === "COMPLETED") return resultError("DUPLICATE_PROPOSAL", unlocked.reason, transactionId);
    if (unlocked.status === "LOCKED") {
      if (unlocked.reason.includes("phase")) return resultError("PHASE_LOCKED", unlocked.reason, transactionId);
      if (unlocked.reason.includes("capability")) return resultError("CAPABILITY_LOCKED", unlocked.reason, transactionId);
      if (unlocked.reason.includes("prerequisite")) return resultError("PREREQUISITE_LOCKED", unlocked.reason, transactionId);
      return resultError("INSUFFICIENT_FUNDS", unlocked.reason, transactionId);
    }
    const artifact = freeze({ ...recipeArtifact(recipe, choices), createdAtGameTime: options.logicalTime ?? 0 });
    const retryAttempt = retryAttempts.get(transactionId) ?? 0;
    const chargeTransactionId = retryAttempt === 0 ? transactionId : `${transactionId}:retry:${retryAttempt}`;
    const charge = options.economy?.transact({ transactionId: chargeTransactionId, type: "COMMISSION", amount: -recipe.costCredits, sourceRef: `commission:${refKey(recipe.ref)}`, expectedBalanceVersion: balanceOf(options.economy).version, logicalTime: options.logicalTime ?? 0 });
    if (options.economy && !charge?.ok) return resultError(charge?.error.code === "BALANCE_VERSION_CONFLICT" ? "BALANCE_VERSION_CONFLICT" : charge?.error.code === "INSUFFICIENT_FUNDS" ? "INSUFFICIENT_FUNDS" : "TRANSACTION_FAILED", charge?.error.message ?? "Commission charge failed.", transactionId);
    let charged = Boolean(options.economy);
    let proposalCreated = false;
    const rollbackProposal = (): boolean => {
      if (!proposalCreated) return true;
      const rolledBack = registry.removeUnpublishedArtifact({ artifactId: artifact.artifactId, version: artifact.version }, "REVIEW");
      if (rolledBack.ok) proposalCreated = false;
      return rolledBack.ok;
    };
    const commit = (): Result<CommissionResult, CommissionError> => {
      const existingArtifact = registry.getArtifact(artifact);
      if (existingArtifact && canonicalSerialize(existingArtifact) !== canonicalSerialize(artifact)) {
        const compensated = charged ? compensate(chargeTransactionId, recipe.costCredits, "proposal-content-conflict") : false;
        return resultError("DUPLICATE_PROPOSAL", `Exact proposal ${refKey(artifact)} already exists with different authored content.`, transactionId, { compensated });
      }
      if (!existingArtifact) {
        const loaded = registry.loadPack({ schemaVersion: 1, packId: `workbench.commission.${recipe.ref.artifactId}.${recipe.ref.version}.${transactionId.replace(/[^a-zA-Z0-9._-]/g, "-")}`, packVersion: 1, artifacts: [artifact] });
        if (!loaded.ok) {
          const compensated = charged ? compensate(chargeTransactionId, recipe.costCredits, "registry-validation") : false;
          if (compensated) retryAttempts.set(transactionId, retryAttempt + 1);
          return resultError("REGISTRY_VALIDATION_FAILED", loaded.error.map((item) => item.message).join(" "), transactionId, { diagnostics: loaded.error.map((item) => `${item.code}: ${item.path}`), compensated });
        }
        proposalCreated = true;
      }
      if (!options.reviewIntake && !options.reviews) {
        const proposalRolledBack = rollbackProposal();
        const compensated = charged ? compensate(chargeTransactionId, recipe.costCredits, "review-intake-unavailable") : false;
        if (compensated) retryAttempts.set(transactionId, retryAttempt + 1);
        return resultError("REVIEW_INTAKE_FAILED", "Review intake is unavailable; the proposal was not submitted.", transactionId, { compensated: compensated && proposalRolledBack });
      }
      const intake: ReviewIntakePort = options.reviewIntake ?? {
        submit(proposal, meta) {
          const reviewService = options.reviews as ReviewService;
          const result = reviewService.submit({ id: meta.reviewId ?? `review.commission.${proposal.artifactId}.${proposal.version}`, baseRef: meta.baseRef, proposedRef: { artifactId: proposal.artifactId, version: proposal.version }, author: meta.author, goal: meta.goal, createdAtGameTime: meta.createdAtGameTime, affectedDependencies: meta.affectedDependencies, affectedConsumers: meta.affectedConsumers });
          return result.ok ? { ok: true, value: { reviewId: result.value.reviewId } } : { ok: false, error: { code: result.error.code, message: result.error.message } };
        },
      };
      const submitted = intake.submit(artifact, { reviewId: `review.commission.${recipe.output.artifactId}.${recipe.output.version}`, baseRef: recipe.baseRef, goal: recipe.goal, author: recipe.author, createdAtGameTime: options.logicalTime ?? 0, affectedDependencies: stableRefs(artifact.dependencies), affectedConsumers: [] });
      if (!submitted.ok) {
        const proposalRolledBack = rollbackProposal();
        const compensated = charged ? compensate(chargeTransactionId, recipe.costCredits, "review-intake") : false;
        if (compensated) retryAttempts.set(transactionId, retryAttempt + 1);
        return resultError("REVIEW_INTAKE_FAILED", submitted.error.message, transactionId, { compensated: compensated && proposalRolledBack });
      }
      const result: CommissionResult = freeze({ transactionId, recipeRef: recipe.ref, artifact, proposalRef: { artifactId: artifact.artifactId, version: artifact.version }, reviewId: submitted.value.reviewId, chargedCredits: recipe.costCredits, choices });
      successful.set(transactionId, result);
      charged = false;
      return { ok: true, value: result };
    };
    try {
      return options.transactionCoordinator ? options.transactionCoordinator.run(commit) : commit();
    } catch (thrown) {
      const proposalRolledBack = rollbackProposal();
      const compensated = charged ? compensate(chargeTransactionId, recipe.costCredits, "commission-exception") : false;
      if (compensated) retryAttempts.set(transactionId, retryAttempt + 1);
      return resultError("TRANSACTION_FAILED", thrown instanceof Error ? thrown.message : "Commission transaction failed.", transactionId, { compensated: compensated && proposalRolledBack });
    }
  }

  // Keep method closures intact; the JSON deep-clone helper intentionally
  // drops functions and is reserved for data snapshots.
  return Object.freeze({ listAssets, getAsset, listCommissions, commission, capabilities, recipes: () => recipes });
}

export const createEngineeringWorkbenchService = createWorkbenchService;
export const createAssetWorkbenchService = createWorkbenchService;
