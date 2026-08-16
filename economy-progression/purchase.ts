import type {
  CreditLedger,
  Entitlement,
  EntitlementPort,
  EntitlementSnapshot,
  Eligibility,
  PurchaseCatalogItem,
  PurchaseCommand,
  PurchaseErrorCode,
  PurchaseResult,
  PurchaseService,
} from "./types.ts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export const DEFAULT_PURCHASE_CATALOG: readonly PurchaseCatalogItem[] = Object.freeze([
  { id: "worker.robot", type: "WORKER", title: "Worker Robot", cost: 700, maxQuantity: 8 },
  { id: "context.capacity.1", type: "CONTEXT_CAPACITY", title: "Context Capacity Mk II", cost: 900, level: 1, requiredPhase: 4, prerequisites: ["capability.context-meter"], maxQuantity: 1 },
  { id: "context.capacity.2", type: "CONTEXT_CAPACITY", title: "Context Capacity Mk III", cost: 1_800, level: 2, requiredPhase: 4, prerequisites: ["context.capacity.1"], maxQuantity: 1 },
  { id: "capability.prompt.basic", type: "CAPABILITY", title: "Basic Prompt Selection", cost: 0, level: 1, requiredPhase: 0, maxQuantity: 1 },
  { id: "capability.skill.basic", type: "CAPABILITY", title: "Basic Skill Library", cost: 650, level: 1, requiredPhase: 1, prerequisites: ["capability.prompt.basic"], maxQuantity: 1 },
  { id: "capability.system-prompt", type: "CAPABILITY", title: "System Prompt Modules", cost: 950, level: 1, requiredPhase: 3, prerequisites: ["capability.skill.basic"], maxQuantity: 1 },
  { id: "capability.context-meter", type: "CAPABILITY", title: "Context Meter and Profiler", cost: 1_000, level: 1, requiredPhase: 4, prerequisites: ["capability.system-prompt"], maxQuantity: 1 },
  { id: "capability.evals", type: "CAPABILITY", title: "Eval Authoring", cost: 1_100, level: 1, requiredPhase: 5, prerequisites: ["capability.context-meter"], maxQuantity: 1 },
  { id: "capability.review", type: "CAPABILITY", title: "Review and Deployment", cost: 1_250, level: 1, requiredPhase: 6, prerequisites: ["capability.evals"], maxQuantity: 1 },
  { id: "capability.memory", type: "CAPABILITY", title: "Memory Controls", cost: 1_400, level: 1, requiredPhase: 7, prerequisites: ["capability.review"], maxQuantity: 1 },
  { id: "commission.artifact.basic", type: "COMMISSION", title: "Basic Artifact Commission", cost: 450, level: 1, requiredPhase: 1, prerequisites: ["capability.prompt.basic"], maxQuantity: 1 },
  { id: "eval.build.default", type: "EVAL_BUILD", title: "Eval Authoring Slot", cost: 500, level: 1, requiredPhase: 5, prerequisites: ["capability.evals"], maxQuantity: 1 },
  { id: "eval.run.default", type: "EVAL_RUN", title: "Eval Run", cost: 25, requiredPhase: 5 },
  { id: "park.expansion.1", type: "PARK_EXPANSION", title: "Park Expansion", cost: 2_500, level: 1, requiredPhase: 10, prerequisites: ["capability.advanced-routing"], maxQuantity: 1 },
  { id: "manager.agent", type: "MANAGER", title: "Manager Agent", cost: 3_500, level: 1, requiredPhase: 9, prerequisites: ["capability.memory"], maxQuantity: 1 },
]);

export function createEntitlementPort(initial: readonly Entitlement[] = []): EntitlementPort {
  const values = new Map<string, Entitlement>();
  for (const entitlement of initial) values.set(entitlement.id, freeze({ ...entitlement }));
  let stateVersion = 0;

  function snapshot(): EntitlementSnapshot {
    return freeze({ stateVersion, entitlements: Object.freeze([...values.values()].sort((a, b) => a.id.localeCompare(b.id))) });
  }
  function has(id: string, level = 1): boolean {
    const value = values.get(id);
    return !!value && value.level >= level && value.quantity > 0;
  }
  function get(id: string): Entitlement | undefined {
    return values.get(id);
  }
  function commit(entitlement: Entitlement): void {
    const previous = values.get(entitlement.id);
    if (previous) {
      values.set(entitlement.id, freeze({ ...entitlement, quantity: previous.quantity + entitlement.quantity, level: Math.max(previous.level, entitlement.level) }));
    } else {
      values.set(entitlement.id, freeze({ ...entitlement }));
    }
    stateVersion += 1;
  }
  function restore(value: EntitlementSnapshot): void {
    values.clear();
    for (const entitlement of value.entitlements) values.set(entitlement.id, freeze({ ...entitlement }));
    stateVersion = value.stateVersion;
  }
  return Object.freeze({ snapshot, has, get, commit, restore });
}

export interface PurchaseServiceOptions {
  readonly catalog?: readonly PurchaseCatalogItem[];
  readonly entitlements?: EntitlementPort;
  readonly getPhase?: () => number;
  readonly isUnlocked?: (id: string) => boolean;
  readonly getWorkerCount?: () => number;
  readonly getInterventions?: () => number;
  readonly beforeCommit?: (command: PurchaseCommand, entitlement: Entitlement) => void;
}

/**
 * Coordinates an economic debit and entitlement commit.  Validation and the
 * injected failure hook run before either mutation; the domain-owned commit
 * port is synchronous, so a failed transaction cannot leave a debit behind.
 */
export function createPurchaseService(ledger: CreditLedger, options: PurchaseServiceOptions = {}): PurchaseService {
  const catalog = Object.freeze([...(options.catalog ?? DEFAULT_PURCHASE_CATALOG)].map((item) => freeze({ ...item, prerequisites: Object.freeze([...(item.prerequisites ?? [])]) })));
  const entitlements = options.entitlements ?? createEntitlementPort();
  const results = new Map<string, PurchaseResult>();
  const getPhase = options.getPhase ?? (() => 0);
  const isUnlocked = options.isUnlocked ?? ((id: string) => entitlements.has(id));
  const getWorkerCount = options.getWorkerCount ?? (() => entitlements.get("worker.robot")?.quantity ?? 0);
  const getInterventions = options.getInterventions ?? (() => 0);

  function itemFor(id: string): PurchaseCatalogItem | undefined {
    return catalog.find((item) => item.id === id);
  }

  function can(id: string): Eligibility {
    const item = itemFor(id);
    if (!item) return freeze({ id, eligible: false, code: "UNKNOWN_ITEM", reason: `Investment ${id} is not in the authored catalog.`, cost: 0, currentLevel: 0, targetLevel: 1, prerequisites: Object.freeze([]) });
    const owned = entitlements.get(id);
    const currentLevel = owned?.level ?? 0;
    const targetLevel = item.level ?? Math.max(1, currentLevel + 1);
    const prerequisites = Object.freeze([...(item.prerequisites ?? [])]);
    if (item.maxQuantity !== undefined && (owned?.quantity ?? 0) >= item.maxQuantity) return freeze({ id, eligible: false, code: "PURCHASE_LIMIT", reason: `${item.title} has reached its authored purchase limit.`, cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
    if (item.type === "MANAGER" && getWorkerCount() < 4 && getInterventions() < 12) return freeze({ id, eligible: false, code: "MANAGER_RULE", reason: "Manager Agent requires four Worker Robots or twelve measured manual interventions.", cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
    if (item.requiredPhase !== undefined && getPhase() < item.requiredPhase) return freeze({ id, eligible: false, code: "PHASE_LOCKED", reason: `${item.title} unlocks in phase ${item.requiredPhase}; current phase is ${getPhase()}.`, cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
    const missing = prerequisites.filter((prerequisite) => !isUnlocked(prerequisite));
    if (missing.length > 0) return freeze({ id, eligible: false, code: "PREREQUISITE_LOCKED", reason: `Missing prerequisite: ${missing.join(", ")}.`, cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
    if (item.cost < 0 || !Number.isSafeInteger(item.cost)) return freeze({ id, eligible: false, code: "INVALID_COST", reason: "Authored investment costs must be non-negative integers.", cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
    if (ledger.balance().amount < item.cost) return freeze({ id, eligible: false, code: "INSUFFICIENT_FUNDS", reason: `Requires ${item.cost} credits; balance is ${ledger.balance().amount}.`, cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
    return freeze({ id, eligible: true, code: "AVAILABLE", reason: `${item.title} is available.`, cost: item.cost, requiredPhase: item.requiredPhase, currentLevel, targetLevel, prerequisites });
  }

  function purchase(command: PurchaseCommand): PurchaseResult {
    const duplicate = results.get(command.transactionId);
    if (duplicate) return duplicate.ok ? freeze({ ...duplicate, duplicate: true }) : freeze({ ...duplicate });
    const snapshot = entitlements.snapshot();
    const unavailable = (code: PurchaseErrorCode, message: string): PurchaseResult => {
      const result = freeze({
        ok: false as const,
        transactionId: command.transactionId,
        error: freeze({ code, message }),
        balance: ledger.balance(),
        stateVersion: snapshot.stateVersion,
      });
      results.set(command.transactionId, result);
      return result;
    };
    if (!command.transactionId || !command.itemId || !Number.isSafeInteger(command.amount) || command.amount < 0) return unavailable("INVALID_COMMAND", "Purchase id, item id, and non-negative integer cost are required.");
    const item = itemFor(command.itemId);
    if (!item) return unavailable("UNKNOWN_ITEM", `Investment ${command.itemId} is not in the authored catalog.`);
    if (command.amount !== item.cost) return unavailable("INVALID_COMMAND", `Purchase cost must match the authored cost of ${item.cost} credits.`);
    if (command.expectedStateVersion !== snapshot.stateVersion) return unavailable("STATE_VERSION_CONFLICT", `Expected entitlement version ${command.expectedStateVersion}; current version is ${snapshot.stateVersion}.`);
    const eligibility = can(command.itemId);
    if (!eligibility.eligible) return unavailable(eligibility.code, eligibility.reason);

    const entitlement: Entitlement = freeze({
      id: item.id,
      type: item.type,
      level: item.level ?? Math.max(1, eligibility.currentLevel + 1),
      quantity: 1,
      acquiredAt: command.logicalTime ?? 0,
      sourceTransactionId: command.transactionId,
    });
    try {
      options.beforeCommit?.(command, entitlement);
      // Stage the entitlement first, then debit. If the ledger rejects (for a
      // stale version or overdraw), restore the pre-transaction port snapshot
      // so the caller observes no partial entitlement.
      entitlements.commit(entitlement);
      const debit = ledger.transact({
        transactionId: command.transactionId,
        correlationKey: command.transactionId,
        type: item.type === "WORKER" ? "WORKER_PURCHASE" : item.type === "MANAGER" ? "MANAGER_PURCHASE" : item.type === "CONTEXT_CAPACITY" ? "CONTEXT_UPGRADE" : item.type === "EVAL_BUILD" ? "EVAL_BUILD" : item.type === "EVAL_RUN" ? "EVAL_RUN" : item.type === "COMMISSION" ? "COMMISSION" : item.type === "PARK_EXPANSION" ? "PARK_EXPANSION" : "PURCHASE",
        amount: -item.cost,
        logicalTime: command.logicalTime,
        sourceRef: command.sourceRef ?? `purchase:${item.id}`,
        expectedBalanceVersion: command.expectedBalanceVersion,
      });
      if (!debit.ok) {
        entitlements.restore(snapshot);
        const purchaseCode: PurchaseErrorCode = debit.error.code === "INSUFFICIENT_FUNDS"
          ? "INSUFFICIENT_FUNDS"
          : debit.error.code === "BALANCE_VERSION_CONFLICT"
            ? "BALANCE_VERSION_CONFLICT"
            : "TRANSACTION_FAILED";
        return unavailable(purchaseCode, debit.error.message);
      }
      const result: PurchaseResult = freeze({ ok: true, transactionId: command.transactionId, entitlement, balance: debit.balance, stateVersion: entitlements.snapshot().stateVersion });
      results.set(command.transactionId, result);
      return result;
    } catch (thrown) {
      // The hook is deliberately before mutation. This branch is a defensive
      // boundary for an adapter, and records a failed idempotency result.
      entitlements.restore(snapshot);
      return unavailable("TRANSACTION_FAILED", thrown instanceof Error ? thrown.message : "Purchase transaction failed before commit.");
    }
  }

  const checkpoint = () => freeze({ entitlements: entitlements.snapshot(), results: Object.freeze([...results.entries()].map(([id, result]) => freeze({ id, result }))) });
  const restore = (value: ReturnType<typeof checkpoint>) => { entitlements.restore(value.entitlements); results.clear(); for (const item of value.results) results.set(item.id, item.result); };
  return Object.freeze({ catalog: () => catalog, can, purchase, entitlements: () => entitlements.snapshot(), checkpoint, restore });
}

export const createPurchaseCoordinator = createPurchaseService;
