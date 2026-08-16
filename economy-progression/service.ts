import { createCreditLedger } from "./ledger.ts";
import { createProgressionService, type MutableProgressionService } from "./progression.ts";
import { createPurchaseService } from "./purchase.ts";
import { calculateSettlement, createSettlementEngine, DEFAULT_SETTLEMENT_CONFIG, validateParkPeriodSummary, validateSettlementProducts } from "./settlement.ts";
import type {
  CreditLedger,
  CreditCommand,
  CreditResult,
  EconomyOptions,
  EconomyProgressionService,
  Eligibility,
  FinanceProgressReadModel,
  LedgerQuery,
  LedgerReconciliation,
  LedgerValidation,
  ParkPeriodSummary,
  ProgressEvent,
  ProgressionService,
  PurchaseCommand,
  PurchaseResult,
  RecoveryPolicy,
  SettlementConfig,
  SettlementResult,
} from "./types.ts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = Object.freeze({ floor: 250, assistanceAmount: 500, enabled: true });

export interface EconomyServiceOptions extends EconomyOptions {
  readonly ledger?: CreditLedger;
}

/** Composes the domain ports while leaving durable transaction coordination to item 15. */
export function createEconomyProgressionService(options: EconomyServiceOptions = {}): EconomyProgressionService {
  const config: SettlementConfig = freeze({
    ...DEFAULT_SETTLEMENT_CONFIG,
    ...(options.settlementConfig ?? {}),
    severityCosts: freeze({ ...DEFAULT_SETTLEMENT_CONFIG.severityCosts, ...(options.settlementConfig?.severityCosts ?? {}) }),
  });
  const policy: RecoveryPolicy = freeze({ ...DEFAULT_RECOVERY_POLICY, ...(options.recoveryPolicy ?? {}) });
  const ledger = options.ledger ?? createCreditLedger(options.openingBalance ?? 2_500, options.logicalTime ?? 0);
  const progression = createProgressionService({ rules: options.progressionRules });
  const purchases = createPurchaseService(ledger, {
    catalog: options.purchaseCatalog,
    getPhase: () => progression.snapshot().phase,
    isUnlocked: (id) => progression.snapshot().capabilities.includes(id),
    getWorkerCount: () => progression.snapshot().workerCount,
    getInterventions: () => progression.snapshot().interventions,
    beforeCommit: options.beforePurchaseCommit,
  });
  const settlement = createSettlementEngine(ledger, config);
  progression.attachPurchase((command) => purchases.purchase(command), (id) => purchases.can(id), () => purchases.entitlements().stateVersion);
  const publicPurchaseResults = new Map<string, PurchaseResult>();
  const listeners = new Set<() => void>();
  let lastSettlementLineItems: SettlementResult["lineItems"] = Object.freeze([]);
  let lastOperationalMetrics = freeze({ safety: 100, satisfaction: 100, efficiency: 100, reliability: 100 });
  let viewVersion = 0;
  let cachedReadModel: FinanceProgressReadModel | undefined;

  function notify(): void {
    viewVersion += 1;
    cachedReadModel = undefined;
    for (const listener of [...listeners]) listener();
  }

  function eligibility(id: string): Eligibility {
    const investment = purchases.can(id);
    if (investment.code === "UNKNOWN_ITEM" && progression.snapshot().capabilities.includes(id)) {
      return { ...investment, eligible: true, code: "AVAILABLE", reason: `${id} is unlocked by the current progression phase.` };
    }
    return investment;
  }

  function applyRecovery(logicalTime: number, requestedAmount: number | undefined, publish: boolean): CreditResult | null {
    if (!policy.enabled || (requestedAmount === undefined && ledger.balance().amount >= policy.floor)) return null;
    const needed = policy.floor - ledger.balance().amount;
    const amount = Math.max(policy.assistanceAmount, needed, requestedAmount ?? 0);
    if (amount <= 0) return null;
    const result = ledger.applyRecovery(logicalTime, "recovery.authored-floor", amount);
    if (publish && result?.ok && !result.duplicate) notify();
    return result;
  }

  function recover(logicalTime = options.logicalTime ?? 0, requestedAmount?: number): CreditResult | null {
    return applyRecovery(logicalTime, requestedAmount, true);
  }

  function settle(input: ParkPeriodSummary): SettlementResult {
    const prior = settlement.resultFor(input.periodId);
    if (prior) return { ...prior, duplicate: true };
    if (policy.enabled && validateParkPeriodSummary(input) === null && validateSettlementProducts(input, config) === null) {
      const calculated = calculateSettlement(input, config);
      if (ledger.balance().amount + calculated.netAmount < policy.floor) applyRecovery(input.logicalTime, policy.floor - ledger.balance().amount - calculated.netAmount, false);
    }
    const result = settlement.settle(input);
    if (!result.ok || result.duplicate) return result;
    lastSettlementLineItems = result.lineItems;
    const highestSeverity = input.incidents.reduce((highest, incident) => Math.max(highest, incident.severity), 0);
    const totalJobs = input.completedJobs + input.lateJobs + input.failedJobs;
    const efficiency = totalJobs === 0 ? 100 : Math.floor(input.completedJobs * 100 / totalJobs);
    const safety = Math.max(0, 100 - highestSeverity * 20 - Math.min(20, input.closures * 5));
    lastOperationalMetrics = freeze({ safety, satisfaction: input.satisfaction, efficiency, reliability: input.uptime });
    progression.process({
      id: `settlement:${input.periodId}:progress`,
      type: "PARK_PERIOD_SETTLED",
      logicalTime: input.logicalTime,
      ...(input.failedJobs === 0 && input.incidents.length === 0 ? { objectiveId: "park-day.safe" } : {}),
      signals: {
        "containment.pressure": highestSeverity >= 2 ? 1 : 0,
        "repetition.pressure": input.lateJobs + input.failedJobs > 0 ? 1 : 0,
        "policy.pressure": input.closures > 0 ? 1 : 0,
        "context.pressure": (input.contextUse?.contextUnits ?? 0) > progression.snapshot().contextCapacity ? 1 : 0,
        "eval.pressure": highestSeverity >= 3 ? 1 : 0,
      },
      metrics: {
        attendance: input.attendance,
        satisfaction: input.satisfaction,
        safety,
        efficiency,
        reliability: input.uptime,
        dinosaurHealth: input.dinosaurHealth,
        completedJobs: input.completedJobs,
        lateJobs: input.lateJobs,
        failedJobs: input.failedJobs,
        closures: input.closures,
        incidents: input.incidents.length,
      },
    });
    notify();
    return result;
  }

  function purchase(command: PurchaseCommand): PurchaseResult {
    const prior = publicPurchaseResults.get(command.transactionId);
    if (prior) return prior.ok ? { ...prior, duplicate: true } : prior;
    // The public CAS always means ProgressSnapshot.stateVersion. Only after it
    // passes do we translate to the private entitlement-port version used by
    // the synchronous domain transaction. Persistent coordination remains an
    // adapter concern for item 15.
    const progressionVersion = progression.snapshot().stateVersion;
    if (command.expectedStateVersion !== progressionVersion) {
      const conflict: PurchaseResult = freeze({
        ok: false,
        transactionId: command.transactionId,
        error: freeze({ code: "STATE_VERSION_CONFLICT" as const, message: `Expected progression version ${command.expectedStateVersion}; current version is ${progressionVersion}.` }),
        balance: ledger.balance(),
        stateVersion: progressionVersion,
      });
      publicPurchaseResults.set(command.transactionId, conflict);
      return conflict;
    }
    const result = progression.purchase(command);
    const publicResult: PurchaseResult = result.ok
      ? freeze({ ...result, stateVersion: progression.snapshot().stateVersion })
      : freeze({ ...result, stateVersion: progression.snapshot().stateVersion });
    publicPurchaseResults.set(command.transactionId, publicResult);
    if (publicResult.ok && !publicResult.duplicate) notify();
    return publicResult;
  }

  function readModel(): FinanceProgressReadModel {
    if (cachedReadModel) return cachedReadModel;
    const progress = progression.snapshot();
    const owned = purchases.entitlements();
    const investments = purchases.catalog().map((item) => {
      const itemEligibility = eligibility(item.id);
      const entitlement = owned.entitlements.find((value) => value.id === item.id);
      return freeze({
        id: item.id,
        title: item.title,
        type: item.type,
        cost: item.cost,
        status: entitlement ? "OWNED" as const : itemEligibility.eligible ? "AVAILABLE" as const : "LOCKED" as const,
        reason: entitlement ? `Owned at level ${entitlement.level}.` : itemEligibility.reason,
        currentLevel: entitlement?.level ?? itemEligibility.currentLevel,
        targetLevel: itemEligibility.targetLevel,
      });
    });
    cachedReadModel = freeze({
      version: viewVersion,
      balance: ledger.balance(),
      recentLedger: Object.freeze(ledger.ledger().slice(-20)),
      settlementLineItems: lastSettlementLineItems,
      investments: Object.freeze(investments),
      capabilities: progress.capabilities,
      objectives: progress.completedObjectives,
      unlocks: progress.unlocks,
      phase: progress.phase,
      metrics: freeze({
        ...lastOperationalMetrics,
        interventions: progress.interventions,
      }),
    });
    return cachedReadModel;
  }

  function persistenceSnapshot() {
    return freeze({ ledger: ledger.checkpoint(), progression: progression.checkpoint(), purchases: purchases.checkpoint(), publicPurchaseResults: Object.freeze([...publicPurchaseResults.entries()].map(([id, result]) => freeze({ id, result })).sort((a, b) => a.id.localeCompare(b.id))), lastSettlementLineItems, operationalMetrics: lastOperationalMetrics, viewVersion });
  }

  function restorePersistence(state: ReturnType<typeof persistenceSnapshot>): void {
    // Validate the complete candidate on isolated domain instances before
    // mutating this live service.
    const stagedLedger = createCreditLedger(state.ledger.openingBalance);
    stagedLedger.restore(state.ledger);
    ledger.restore(state.ledger);
    progression.restore(state.progression);
    purchases.restore(state.purchases);
    publicPurchaseResults.clear(); for (const item of state.publicPurchaseResults) publicPurchaseResults.set(item.id, item.result);
    lastSettlementLineItems = Object.freeze([...state.lastSettlementLineItems]);
    lastOperationalMetrics = freeze({ safety: state.operationalMetrics.safety ?? 100, satisfaction: state.operationalMetrics.satisfaction ?? 100, efficiency: state.operationalMetrics.efficiency ?? 100, reliability: state.operationalMetrics.reliability ?? 100 });
    viewVersion = state.viewVersion; cachedReadModel = undefined; for (const listener of [...listeners]) listener();
  }

  const service: EconomyProgressionService = Object.freeze({
    balance: () => ledger.balance(),
    transact: (command: CreditCommand) => {
      const result = ledger.transact(command);
      if (result.ok && !result.duplicate) notify();
      return result;
    },
    settle,
    ledger: (query?: LedgerQuery) => ledger.ledger(query),
    reconcile: (): LedgerReconciliation => ledger.reconcile(),
    validateBalance: (): LedgerValidation => ledger.validate(),
    snapshot: () => progression.snapshot(),
    process: (event: ProgressEvent) => {
      const before = progression.snapshot().stateVersion;
      const result = progression.process(event);
      if (progression.snapshot().stateVersion !== before) notify();
      return result;
    },
    can: eligibility,
    purchase,
    rules: () => progression.rules(),
    purchases: () => purchases,
    ledgerPort: () => ledger,
    recover,
    recoveryPolicy: () => policy,
    readModel,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    checkpoint: () => progression.checkpoint(),
    restore: (value: Parameters<ProgressionService["restore"]>[0]) => progression.restore(value),
    persistenceSnapshot,
    restorePersistence,
  });
  return service;
}

export const createEconomyService = createEconomyProgressionService;
export const createEconomy = createEconomyProgressionService;

export type { MutableProgressionService, ProgressionService };
