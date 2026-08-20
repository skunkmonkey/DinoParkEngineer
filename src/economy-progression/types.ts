import type {
  OperationalDaySummary,
  ParkIncident,
  ParkJob,
  ParkOperationsState,
} from "../park-operations/public.js";
import type { RuntimeAssetCatalog } from "../rendering-assets/public.js";

/** Credit costs are intentionally itemized so a player can inspect tradeoffs. */
export type EconomyCostCategory =
  | "authoring"
  | "acquisition"
  | "runtime"
  | "eval-build"
  | "eval-run"
  | "operation"
  | "maintenance"
  | "response"
  | "recovery"
  | "expansion"
  | "expression"
  | "revenue";

export type CostCategory = EconomyCostCategory;
export type EconomyChargeCategory = Exclude<EconomyCostCategory, "revenue">;

export type EconomySourceKind =
  | "command"
  | "settlement"
  | "outcome"
  | "eval"
  | "system"
  | "recovery";

export interface EconomySource {
  readonly kind: EconomySourceKind;
  readonly id: string;
  readonly label?: string;
}

export interface EconomyRelatedIds {
  readonly relatedIds?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly artifactIds?: readonly string[];
  readonly evalIds?: readonly string[];
  readonly incidentIds?: readonly string[];
}

/** An append-only, signed credit change. Negative amounts are charges. */
export interface EconomyTransaction extends EconomyRelatedIds {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly day: number;
  readonly tick: number;
  readonly amount: number;
  readonly category: EconomyCostCategory;
  readonly currency: "credits";
  readonly source: EconomySource;
  readonly sourceId: string;
  readonly commandId?: string;
  readonly settlementId?: string;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
}

export interface EconomyRuleVersion {
  readonly id: string;
  readonly version: string;
}

export interface EconomyQuoteRequest extends EconomyRelatedIds {
  readonly id: string;
  readonly category: EconomyChargeCategory;
  readonly day: number;
  readonly tick: number;
  readonly source?: EconomySource;
  readonly sourceId?: string;
  readonly amount?: number;
  readonly quantity?: number;
  readonly unitAmount?: number;
  readonly ruleVersion?: EconomyRuleVersion;
  readonly expiresAtTick?: number;
  readonly description?: string;
}

export interface EconomyQuote extends EconomyRelatedIds {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly category: EconomyChargeCategory;
  readonly amount: number;
  readonly currency: "credits";
  readonly day: number;
  readonly tick: number;
  readonly source: EconomySource;
  readonly sourceId: string;
  readonly ruleVersion: EconomyRuleVersion;
  readonly expiresAtTick?: number;
  readonly description?: string;
}

export type EconomyReservationStatus = "reserved" | "committed" | "cancelled";

export interface EconomyReservation extends EconomyRelatedIds {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly quoteId: string;
  readonly status: EconomyReservationStatus;
  readonly amount: number;
  readonly category: EconomyChargeCategory;
  readonly day: number;
  readonly tick: number;
  readonly transactionId?: string;
  readonly cancellationReason?: string;
}

export interface EconomyLedgerState {
  readonly schemaVersion: "1";
  readonly initialBalance: number;
  readonly transactions: readonly EconomyTransaction[];
  readonly quotes: readonly EconomyQuote[];
  readonly reservations: readonly EconomyReservation[];
  readonly authoredEvals: readonly EvalAsset[];
  readonly evalRuns: readonly EvalRunRecord[];
  readonly settlements: readonly string[];
  readonly progression: ProgressionState;
  readonly rewards: RewardInventoryState;
}

export interface EconomyLedgerProjection extends EconomyLedgerState {
  /** Derived from initialBalance plus every immutable transaction amount. */
  readonly balance: number;
  /** Sum of active, not-yet-committed reservations. */
  readonly reservedBalance: number;
  /** Derived balance available for a new reservation. */
  readonly availableBalance: number;
}

export interface AppendTransactionInput extends EconomyRelatedIds {
  readonly id: string;
  readonly day: number;
  readonly tick: number;
  readonly amount: number;
  readonly category: EconomyCostCategory;
  readonly source: EconomySource;
  readonly commandId?: string;
  readonly settlementId?: string;
  readonly allowNegativeBalance?: boolean;
}

export interface AppendBatchResult {
  readonly transactions: readonly EconomyTransaction[];
  readonly idempotent: boolean;
}

export interface EconomyDiagnostic {
  readonly code:
    | "ECONOMY_INVALID_INPUT"
    | "ECONOMY_LEDGER_CONFLICT"
    | "ECONOMY_INSUFFICIENT_FUNDS"
    | "ECONOMY_QUOTE_NOT_FOUND"
    | "ECONOMY_QUOTE_CONFLICT"
    | "ECONOMY_QUOTE_EXPIRED"
    | "ECONOMY_RESERVATION_NOT_FOUND"
    | "ECONOMY_RESERVATION_CONFLICT"
    | "ECONOMY_RESERVATION_STATE"
    | "ECONOMY_SETTLEMENT_CONFLICT"
    | "ECONOMY_EVAL_NOT_AUTHORED"
    | "ECONOMY_EVAL_CONFLICT"
    | "ECONOMY_CAPABILITY_NOT_FOUND"
    | "ECONOMY_CAPABILITY_LOCKED"
    | "ECONOMY_CAPABILITY_NOT_AVAILABLE"
    | "ECONOMY_CAPABILITY_CONFLICT"
    | "ECONOMY_ACTION_UNAVAILABLE"
    | "ECONOMY_REWARD_NOT_FOUND"
    | "ECONOMY_REWARD_LOCKED"
    | "ECONOMY_REWARD_CONFLICT"
    | "ECONOMY_REWARD_ASSET_UNRESOLVED"
    | "ECONOMY_REWARD_NOT_OWNED"
    | "ECONOMY_REWARD_ALREADY_PLACED"
    | "ECONOMY_REWARD_PLACEMENT_NOT_FOUND"
    | "ECONOMY_REWARD_PLACEMENT_CONFLICT"
    | "ECONOMY_RECORD_INVALID";
  readonly path: string;
  readonly rule: string;
  readonly message: string;
}

export type EconomyResult<T> =
  | { readonly ok: true; readonly value: T; readonly projection: EconomyLedgerProjection }
  | { readonly ok: false; readonly diagnostics: readonly EconomyDiagnostic[]; readonly projection: EconomyLedgerProjection };

export interface RatingRules {
  readonly base: {
    readonly safety: number;
    readonly guestExperience: number;
    readonly dinosaurWelfare: number;
  };
  readonly penalties: {
    readonly failedJob: number;
    readonly incidentRiskDivisor: number;
    readonly unresolvedIncident: number;
    readonly intervention: number;
    readonly closure: number;
    readonly injury: number;
    readonly death: number;
    readonly welfareNeglect: number;
    readonly guestDissatisfaction: number;
    readonly unservedVisitor: number;
  };
  readonly bonuses: {
    readonly stableOperation: number;
    readonly demonstratedRecovery: number;
  };
}

export interface EconomyRuleSet {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly version: string;
  readonly currency: "credits";
  readonly costs: {
    readonly authoring: number;
    readonly acquisition: number;
    readonly runtime: number;
    readonly "eval-build": number;
    readonly "eval-run": number;
    readonly operation: number;
    readonly maintenance: number;
    readonly response: number;
    readonly recovery: number;
    readonly expansion: number;
    readonly expression: number;
  };
  readonly visitors: {
    readonly admissionPrice: number;
    readonly baseDemand: number;
    readonly capacity: number;
  };
  readonly rating: RatingRules;
}

export type CapabilityAvailability = "locked" | "available" | "purchased";

export interface CapabilityDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly actionId: string;
  readonly actionLabel: string;
  readonly prerequisites: readonly string[];
  readonly pressureIds: readonly string[];
  readonly cost: number;
}

export interface CapabilityState extends CapabilityDefinition {
  readonly status: CapabilityAvailability;
  readonly availableTick?: number;
  readonly purchasedTick?: number;
  readonly purchaseTransactionId?: string;
}

export interface CapabilityAction {
  readonly id: string;
  readonly label: string;
  readonly capabilityId: string;
  readonly available: boolean;
  readonly description: string;
}

export interface ProgressionState {
  readonly schemaVersion: "1";
  readonly pressureIds: readonly string[];
  readonly capabilities: readonly CapabilityState[];
  readonly actions: readonly CapabilityAction[];
}

export interface RewardDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly cost: number;
  /** Expressive rewards intentionally have no production multiplier. */
  readonly mechanicalBonus: 0;
  readonly visibleToVisitors: boolean;
  readonly prerequisites: readonly string[];
}

export interface RewardInventoryItem {
  readonly itemId: string;
  readonly rewardId: string;
  readonly rewardVersion: string;
  readonly status: "owned" | "placed" | "removed";
  readonly purchaseTransactionId: string;
  readonly purchasedDay: number;
  readonly purchasedTick: number;
  readonly placementId?: string;
}

export interface RewardPlacement {
  readonly placementId: string;
  readonly itemId: string;
  readonly rewardId: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly locationId: string;
  readonly visibleToVisitors: boolean;
  readonly placedTick: number;
  readonly removedTick?: number;
}

export interface RewardInventoryState {
  readonly schemaVersion: "1";
  readonly items: readonly RewardInventoryItem[];
  readonly placements: readonly RewardPlacement[];
}

export interface ProgressionProjection {
  readonly progression: ProgressionState;
  readonly rewards: RewardInventoryState;
}

export interface CapabilityAvailabilityInput {
  readonly capabilityId: string;
  readonly tick: number;
  readonly pressureIds?: readonly string[];
}

export interface CapabilityPurchaseInput {
  readonly capabilityId: string;
  readonly day: number;
  readonly tick: number;
  readonly commandId?: string;
}

export interface RewardPurchaseInput {
  readonly rewardId: string;
  readonly day: number;
  readonly tick: number;
  readonly commandId?: string;
}

export interface RewardPlacementInput {
  readonly itemId: string;
  readonly placementId: string;
  readonly locationId: string;
  readonly tick: number;
}

export interface RewardRemovalInput {
  readonly placementId: string;
  readonly tick: number;
}

export interface EconomyOptions {
  readonly initialBalance?: number;
  readonly startingCredits?: number;
  readonly rules?: EconomyRuleSet;
  readonly capabilities?: readonly CapabilityDefinition[];
  readonly rewards?: readonly RewardDefinition[];
  readonly assetCatalog?: Pick<RuntimeAssetCatalog, "resolveExact">;
  readonly pressureIds?: readonly string[];
}

export type ParkOutcomeKind =
  | "injury"
  | "death"
  | "visitor-injury"
  | "visitor-death"
  | "dinosaur-injury"
  | "dinosaur-death"
  | "closure"
  | "unresolved-incident"
  | "stable-safe-operation"
  | "recovery-demonstrated"
  | "welfare-neglect"
  | "guest-dissatisfaction";

/** Machine-readable Park Operations evidence; human-readable prose is not parsed. */
export interface ParkOutcomeRecord extends EconomyRelatedIds {
  readonly id: string;
  readonly kind: ParkOutcomeKind;
  readonly count: number;
  readonly sourceId: string;
}

export interface ParkOperationsSettlementRecords {
  readonly summary: OperationalDaySummary;
  readonly jobs?: readonly ParkJob[];
  readonly incidents?: readonly ParkIncident[];
  readonly outcomes?: readonly ParkOutcomeRecord[];
}

export interface RatingContributor extends EconomyRelatedIds {
  readonly id: string;
  readonly category: "safety" | "guest-experience" | "dinosaur-welfare";
  readonly label: string;
  readonly points: number;
  readonly rawPoints: number;
  readonly explanation: string;
}

export interface ParkRating {
  readonly schemaVersion: "1";
  readonly value: number;
  readonly previousValue?: number;
  readonly ruleVersion: EconomyRuleVersion;
  readonly contributors: readonly RatingContributor[];
  readonly evidenceIds: readonly string[];
}

export interface RatingEvaluationInput {
  readonly summary: OperationalDaySummary;
  readonly incidents?: readonly ParkIncident[];
  readonly outcomes?: readonly ParkOutcomeRecord[];
  readonly previousRating?: number;
  readonly rules?: EconomyRuleSet;
}

export interface VisitorDemand {
  readonly schemaVersion: "1";
  readonly rating: number;
  readonly baseDemand: number;
  readonly demand: number;
  readonly capacity: number;
  readonly ruleVersion: EconomyRuleVersion;
  readonly evidenceIds: readonly string[];
}

export interface SettlementCostInput extends EconomyRelatedIds {
  readonly category: EconomyChargeCategory;
  /** Costs are authored as positive amounts; the ledger records a negative charge. */
  readonly amount: number;
  readonly sourceId: string;
  readonly description?: string;
}

export interface SettlementCostLine extends SettlementCostInput {
  readonly transactionId: string;
}

export interface ParkDaySettlementInput extends EconomyRelatedIds {
  readonly settlementId: string;
  readonly day: number;
  readonly tick: number;
  readonly summary?: OperationalDaySummary;
  readonly operations?: ParkOperationsState;
  readonly jobs?: readonly ParkJob[];
  readonly incidents?: readonly ParkIncident[];
  readonly outcomes?: readonly ParkOutcomeRecord[];
  readonly costs?: readonly SettlementCostInput[];
  readonly visitorPrice?: number;
  readonly previousRating?: number;
  readonly sourceId?: string;
}

export interface DaySettlementSummary extends EconomyRelatedIds {
  readonly schemaVersion: "1";
  readonly settlementId: string;
  readonly day: number;
  readonly tick: number;
  readonly ruleVersion: EconomyRuleVersion;
  readonly rating: ParkRating;
  readonly demand: VisitorDemand;
  readonly attendance: number;
  readonly visitorPrice: number;
  readonly revenue: number;
  readonly costs: readonly SettlementCostLine[];
  readonly totalCosts: number;
  readonly netChange: number;
  readonly transactionIds: readonly string[];
  readonly balance: number;
  readonly idempotent: boolean;
  readonly evidenceIds: readonly string[];
}

export interface EvalAsset {
  readonly id: string;
  readonly version: string;
  readonly authoredDay: number;
  readonly authoredTick: number;
  readonly authoringTransactionId?: string;
}

export interface EvalRunRecord {
  readonly runId: string;
  readonly evalId: string;
  readonly evalVersion: string;
  readonly day: number;
  readonly tick: number;
  readonly transactionId?: string;
}

export interface EvalAuthoringInput extends EconomyRelatedIds {
  readonly evalId: string;
  readonly evalVersion: string;
  readonly day: number;
  readonly tick: number;
  readonly quote?: EconomyQuote;
  readonly amount?: number;
  readonly commandId?: string;
}

export interface EvalRunInput extends EconomyRelatedIds {
  readonly runId: string;
  readonly evalId: string;
  readonly evalVersion: string;
  readonly day: number;
  readonly tick: number;
  readonly quote?: EconomyQuote;
  readonly amount?: number;
  readonly commandId?: string;
}

export interface EvalAuthoringResult {
  readonly asset: EvalAsset;
  readonly transaction?: EconomyTransaction;
  readonly idempotent: boolean;
  readonly charged: number;
}

export interface EvalRunResult {
  readonly run: EvalRunRecord;
  readonly transaction?: EconomyTransaction;
  readonly charged: number;
  readonly idempotent: boolean;
}

export interface ReserveInput {
  readonly quote: EconomyQuote | string;
  readonly reservationId?: string;
  readonly commandId?: string;
}

export interface CommitInput {
  readonly commandId?: string;
  readonly tick?: number;
  readonly day?: number;
}

export interface CancelInput {
  readonly reason?: string;
  readonly commandId?: string;
}

export interface EconomyLedger {
  snapshot(): EconomyLedgerProjection;
  project(): EconomyLedgerProjection;
  append(input: AppendTransactionInput): EconomyResult<EconomyTransaction>;
  appendBatch(inputs: readonly AppendTransactionInput[]): EconomyResult<AppendBatchResult>;
}

export interface EconomyService extends EconomyLedger {
  quote(input: EconomyQuoteRequest): EconomyResult<EconomyQuote>;
  reserve(input: ReserveInput | EconomyQuote | string): EconomyResult<EconomyReservation>;
  commit(reservationId: string, input?: CommitInput): EconomyResult<EconomyTransaction>;
  cancel(reservationId: string, input?: CancelInput): EconomyResult<EconomyReservation>;
  settleDay(input: ParkDaySettlementInput): EconomyResult<DaySettlementSummary>;
  calculateRating(input: RatingEvaluationInput): ParkRating;
  calculateDemand(rating: number, evidenceIds?: readonly string[]): VisitorDemand;
  quoteEvalAuthoring(input: Omit<EconomyQuoteRequest, "category">): EconomyResult<EconomyQuote>;
  quoteEvalRun(input: Omit<EconomyQuoteRequest, "category">): EconomyResult<EconomyQuote>;
  authorEval(input: EvalAuthoringInput): EconomyResult<EvalAuthoringResult>;
  runEval(input: EvalRunInput): EconomyResult<EvalRunResult>;
  progression(): ProgressionState;
  rewards(): RewardInventoryState;
  availableActions(): readonly CapabilityAction[];
  markPressure(input: CapabilityAvailabilityInput): EconomyResult<ProgressionState>;
  purchaseCapability(input: CapabilityPurchaseInput): EconomyResult<CapabilityState>;
  purchaseReward(input: RewardPurchaseInput): EconomyResult<RewardInventoryItem>;
  placeReward(input: RewardPlacementInput): EconomyResult<RewardPlacement>;
  removeReward(input: RewardRemovalInput): EconomyResult<RewardPlacement>;
}
