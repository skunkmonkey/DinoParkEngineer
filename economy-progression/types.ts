/**
 * Public, headless contracts for the economy and progression feature.
 *
 * All economic values are integer credits.  The domain owns the in-memory
 * state used by a running game; persistence adapters may implement the ports
 * below without changing any of the rules.
 */

export type CreditTransactionType =
  | "SETTLEMENT_REVENUE"
  | "SETTLEMENT_COST"
  | "PURCHASE"
  | "COMMISSION"
  | "EVAL_BUILD"
  | "EVAL_RUN"
  | "WORKER_PURCHASE"
  | "CONTEXT_UPGRADE"
  | "MANAGER_PURCHASE"
  | "PARK_EXPANSION"
  | "INCIDENT_COST"
  | "RECOVERY_ASSISTANCE"
  | string;

export interface CreditBalance {
  readonly amount: number;
  readonly version: number;
}

export interface LedgerEntry {
  readonly id: string;
  readonly type: CreditTransactionType;
  /** Signed integer. Positive entries credit the player; negative entries debit. */
  readonly amount: number;
  readonly logicalTime: number;
  readonly sourceRef: string;
  readonly idempotencyKey: string;
  readonly postBalance: number;
  readonly balanceVersion: number;
}

export interface CreditCommand {
  readonly transactionId: string;
  readonly type: CreditTransactionType;
  readonly amount: number;
  readonly logicalTime?: number;
  readonly sourceRef: string;
  readonly expectedBalanceVersion: number;
  /** Optional alias accepted by callers that use the term correlation key. */
  readonly correlationKey?: string;
}

export type LedgerErrorCode =
  | "INVALID_COMMAND"
  | "NON_INTEGER_AMOUNT"
  | "NEGATIVE_BALANCE"
  | "INSUFFICIENT_FUNDS"
  | "BALANCE_VERSION_CONFLICT"
  | "DUPLICATE_TRANSACTION"
  | "INVALID_SOURCE"
  | "INVALID_TRANSACTION_ID";

export interface LedgerError {
  readonly code: LedgerErrorCode;
  readonly message: string;
  readonly transactionId?: string;
  readonly expected?: number;
  readonly actual?: number;
}

export type CreditResult =
  | {
      readonly ok: true;
      readonly balance: CreditBalance;
      readonly entry: LedgerEntry;
      readonly duplicate?: boolean;
    }
  | {
      readonly ok: false;
      readonly error: LedgerError;
      readonly balance: CreditBalance;
    };

export interface LedgerQuery {
  readonly type?: CreditTransactionType;
  readonly sourceRef?: string;
  readonly fromLogicalTime?: number;
  readonly toLogicalTime?: number;
  readonly idempotencyKey?: string;
}

export interface CreditLedger {
  readonly balance: () => CreditBalance;
  readonly transact: (command: CreditCommand) => CreditResult;
  readonly ledger: (query?: LedgerQuery) => readonly LedgerEntry[];
  readonly entryFor: (transactionId: string) => LedgerEntry | undefined;
  readonly reconcile: () => LedgerReconciliation;
  readonly canonical: () => string;
  readonly validate: () => LedgerValidation;
  readonly applyRecovery: (logicalTime: number, sourceRef?: string, amount?: number) => CreditResult | null;
  readonly checkpoint: () => LedgerCheckpoint;
  readonly restore: (checkpoint: LedgerCheckpoint) => void;
}

export interface LedgerCheckpoint {
  readonly openingBalance: number;
  readonly balance: CreditBalance;
  readonly entries: readonly LedgerEntry[];
  readonly results: readonly { readonly key: string; readonly result: CreditResult }[];
  readonly sequence: number;
  readonly recoveryAppliedAtVersion?: number;
}

export interface LedgerReconciliation {
  readonly openingBalance: number;
  readonly committedAmount: number;
  readonly balance: number;
  readonly reconciled: boolean;
  readonly entries: number;
}

export interface LedgerValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface SettlementConfig {
  readonly attendanceCredits: number;
  readonly satisfactionCreditsPerPoint: number;
  readonly uptimeCreditsPerPoint: number;
  readonly dinosaurHealthCreditsPerPoint: number;
  readonly completedJobCredits: number;
  readonly lateJobCost: number;
  readonly failedJobCost: number;
  readonly closureCost: number;
  readonly contextUnitCost: number;
  readonly severityCosts: Readonly<Record<0 | 1 | 2 | 3 | 4, number>>;
  readonly recoveryFloor?: number;
}

export interface IncidentSummary {
  readonly id: string;
  readonly severity: 0 | 1 | 2 | 3 | 4;
  readonly status?: "OPEN" | "CONTAINED" | "RECOVERED";
}

export interface ContextUseSummary {
  readonly contextUnits: number;
  readonly jobs?: number;
}

export interface ParkPeriodSummary {
  readonly periodId: string;
  readonly logicalTime: number;
  readonly attendance: number;
  /** 0..100. */
  readonly satisfaction: number;
  /** 0..100. */
  readonly uptime: number;
  /** 0..100. */
  readonly dinosaurHealth: number;
  readonly completedJobs: number;
  readonly lateJobs: number;
  readonly failedJobs: number;
  readonly closures: number;
  readonly incidents: readonly IncidentSummary[];
  readonly contextUse?: ContextUseSummary;
}

export interface SettlementLineItem {
  readonly id: string;
  readonly label: string;
  readonly category: "REVENUE" | "COST";
  /** Signed amount as applied to the ledger. */
  readonly amount: number;
  readonly sourceRef: string;
  readonly details?: Readonly<Record<string, number | string>>;
}

export interface SettlementResult {
  readonly ok: boolean;
  readonly periodId: string;
  readonly balance: CreditBalance;
  readonly lineItems: readonly SettlementLineItem[];
  readonly netAmount: number;
  readonly transactionIds: readonly string[];
  readonly duplicate?: boolean;
  readonly error?: LedgerError;
}

export interface SettlementConfigValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface EconomyService {
  readonly balance: () => CreditBalance;
  readonly transact: (command: CreditCommand) => CreditResult;
  readonly settle: (input: ParkPeriodSummary) => SettlementResult;
  readonly ledger: (query?: LedgerQuery) => readonly LedgerEntry[];
  readonly reconcile: () => LedgerReconciliation;
  readonly validateBalance: () => LedgerValidation;
}

export type PurchaseType =
  | "WORKER"
  | "CONTEXT_CAPACITY"
  | "CAPABILITY"
  | "PARK_EXPANSION"
  | "COMMISSION"
  | "EVAL_BUILD"
  | "EVAL_RUN"
  | "MANAGER"
  | string;

export interface PurchaseCommand {
  readonly transactionId: string;
  readonly itemId: string;
  readonly type: PurchaseType;
  readonly amount: number;
  readonly sourceRef?: string;
  readonly level?: number;
  readonly expectedBalanceVersion: number;
  /** Compare-and-swap against ProgressSnapshot.stateVersion on the public composed service. */
  readonly expectedStateVersion: number;
  readonly prerequisites?: readonly string[];
  readonly logicalTime?: number;
}

export type EligibilityCode =
  | "AVAILABLE"
  | "ALREADY_OWNED"
  | "INSUFFICIENT_FUNDS"
  | "PREREQUISITE_LOCKED"
  | "PHASE_LOCKED"
  | "STATE_VERSION_CONFLICT"
  | "BALANCE_VERSION_CONFLICT"
  | "PURCHASE_LIMIT"
  | "MANAGER_RULE"
  | "UNKNOWN_ITEM"
  | "INVALID_COST";

export interface Eligibility {
  readonly id: string;
  readonly eligible: boolean;
  readonly code: EligibilityCode;
  readonly reason: string;
  readonly cost: number;
  readonly requiredPhase?: number;
  readonly currentLevel: number;
  readonly targetLevel: number;
  readonly prerequisites: readonly string[];
}

export interface Entitlement {
  readonly id: string;
  readonly type: PurchaseType;
  readonly level: number;
  readonly quantity: number;
  readonly acquiredAt: number;
  readonly sourceTransactionId: string;
}

export type PurchaseErrorCode =
  | EligibilityCode
  | "TRANSACTION_FAILED"
  | "DUPLICATE_TRANSACTION"
  | "INVALID_COMMAND";

export type PurchaseResult =
  | {
      readonly ok: true;
      readonly transactionId: string;
      readonly entitlement: Entitlement;
      readonly balance: CreditBalance;
      readonly stateVersion: number;
      readonly duplicate?: boolean;
    }
  | {
      readonly ok: false;
      readonly transactionId: string;
      readonly error: { readonly code: PurchaseErrorCode; readonly message: string };
      readonly balance: CreditBalance;
      readonly stateVersion: number;
    };

export interface EntitlementSnapshot {
  readonly stateVersion: number;
  readonly entitlements: readonly Entitlement[];
}

export interface EntitlementPort {
  readonly snapshot: () => EntitlementSnapshot;
  readonly has: (id: string, level?: number) => boolean;
  readonly get: (id: string) => Entitlement | undefined;
  readonly commit: (entitlement: Entitlement) => void;
  readonly restore: (snapshot: EntitlementSnapshot) => void;
}

export interface PurchaseCatalogItem {
  readonly id: string;
  readonly type: PurchaseType;
  readonly title: string;
  readonly cost: number;
  readonly level?: number;
  readonly requiredPhase?: number;
  readonly prerequisites?: readonly string[];
  readonly maxQuantity?: number;
}

export interface PurchaseService {
  readonly catalog: () => readonly PurchaseCatalogItem[];
  readonly can: (id: string) => Eligibility;
  readonly purchase: (command: PurchaseCommand) => PurchaseResult;
  readonly entitlements: () => EntitlementSnapshot;
  readonly checkpoint: () => PurchaseCheckpoint;
  readonly restore: (snapshot: PurchaseCheckpoint) => void;
}

export interface PurchaseCheckpoint {
  readonly entitlements: EntitlementSnapshot;
  readonly results: readonly { readonly id: string; readonly result: PurchaseResult }[];
}

export interface ProgressionRule {
  readonly phase: number;
  readonly id: string;
  readonly title: string;
  readonly pressure: string;
  readonly lesson: string;
  readonly unlocks: readonly string[];
  readonly prerequisites?: readonly string[];
  readonly requiredSignals?: Readonly<Record<string, number>>;
}

export interface UnlockRecord {
  readonly id: string;
  readonly phase: number;
  readonly reason: string;
  readonly eventId: string;
  readonly logicalTime: number;
}

export interface ProgressSnapshot {
  readonly phase: number;
  readonly stateVersion: number;
  readonly signals: Readonly<Record<string, number>>;
  readonly milestones: readonly string[];
  readonly completedObjectives: readonly string[];
  readonly unlocks: readonly UnlockRecord[];
  readonly capabilities: readonly string[];
  readonly workerCount: number;
  readonly contextCapacity: number;
  readonly interventions: number;
  readonly metrics: Readonly<Record<string, number>>;
}

export type ProgressEventType =
  | "METRIC"
  | "MILESTONE"
  | "OBJECTIVE_COMPLETED"
  | "JOB_RESULT"
  | "INCIDENT"
  | "INTERVENTION"
  | "PURCHASE"
  | string;

export interface ProgressEvent {
  readonly id: string;
  readonly type: ProgressEventType;
  readonly logicalTime: number;
  readonly signal?: string;
  readonly value?: number;
  readonly metric?: string;
  readonly milestone?: string;
  readonly objectiveId?: string;
  readonly workerCount?: number;
  readonly contextCapacity?: number;
  readonly interventions?: number;
  readonly severity?: 0 | 1 | 2 | 3 | 4;
  readonly signals?: Readonly<Record<string, number | boolean>>;
  readonly metrics?: Readonly<Record<string, number>>;
  readonly reason?: string;
}

export interface ProgressEventValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface UnlockEvent extends UnlockRecord {
  readonly kind: "UNLOCK";
}

export interface ProgressionService {
  readonly snapshot: () => ProgressSnapshot;
  readonly process: (event: ProgressEvent) => readonly UnlockEvent[];
  readonly can: (id: string) => Eligibility;
  readonly purchase: (command: PurchaseCommand) => PurchaseResult;
  readonly rules: () => readonly ProgressionRule[];
  readonly checkpoint: () => ProgressionCheckpoint;
  readonly restore: (checkpoint: ProgressionCheckpoint) => void;
}

export interface ProgressionCheckpoint {
  readonly snapshot: ProgressSnapshot;
  readonly eventIds: readonly string[];
  readonly purchaseResults: readonly { readonly id: string; readonly result: PurchaseResult }[];
}

export interface EconomyPersistenceState {
  readonly ledger: LedgerCheckpoint;
  readonly progression: ProgressionCheckpoint;
  readonly purchases: PurchaseCheckpoint;
  readonly publicPurchaseResults: readonly { readonly id: string; readonly result: PurchaseResult }[];
  readonly lastSettlementLineItems: readonly SettlementLineItem[];
  readonly operationalMetrics: Readonly<{
    readonly safety: number;
    readonly satisfaction: number;
    readonly efficiency: number;
    readonly reliability: number;
  }>;
  readonly viewVersion: number;
}

export interface EconomyProgressionService extends EconomyService, ProgressionService {
  readonly purchases: () => PurchaseService;
  readonly ledgerPort: () => CreditLedger;
  readonly recover: (logicalTime?: number, amount?: number) => CreditResult | null;
  readonly recoveryPolicy: () => RecoveryPolicy;
  readonly readModel: () => FinanceProgressReadModel;
  readonly subscribe: (listener: () => void) => () => void;
  readonly persistenceSnapshot: () => EconomyPersistenceState;
  readonly restorePersistence: (state: EconomyPersistenceState) => void;
}

export interface InvestmentProjection {
  readonly id: string;
  readonly title: string;
  readonly type: PurchaseType;
  readonly cost: number;
  readonly status: "AVAILABLE" | "LOCKED" | "OWNED";
  readonly reason: string;
  readonly currentLevel: number;
  readonly targetLevel: number;
}

export interface FinanceOperationalMetrics {
  readonly safety: number;
  readonly satisfaction: number;
  readonly efficiency: number;
  readonly reliability: number;
  readonly interventions: number;
}

export interface FinanceProgressReadModel {
  readonly version: number;
  readonly balance: CreditBalance;
  readonly recentLedger: readonly LedgerEntry[];
  readonly settlementLineItems: readonly SettlementLineItem[];
  readonly investments: readonly InvestmentProjection[];
  readonly capabilities: readonly string[];
  readonly objectives: readonly string[];
  readonly unlocks: readonly UnlockRecord[];
  readonly phase: number;
  readonly metrics: FinanceOperationalMetrics;
}

export interface RecoveryPolicy {
  readonly floor: number;
  readonly assistanceAmount: number;
  readonly enabled: boolean;
}

export interface EconomyOptions {
  readonly openingBalance?: number;
  readonly logicalTime?: number;
  readonly settlementConfig?: Partial<SettlementConfig>;
  readonly progressionRules?: readonly ProgressionRule[];
  readonly purchaseCatalog?: readonly PurchaseCatalogItem[];
  readonly recoveryPolicy?: Partial<RecoveryPolicy>;
  /** Test seam for proving a failed transaction has no economic side effect. */
  readonly beforePurchaseCommit?: (command: PurchaseCommand, entitlement: Entitlement) => void;
}
