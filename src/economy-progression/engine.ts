import {
  economyQuoteSchema,
  economyRuleSetSchema,
  economyTransactionSchema,
} from "./schemas.js";
import { parkOperationsStateSchema } from "../park-operations/public.js";
import type {
  AppendBatchResult,
  AppendTransactionInput,
  CancelInput,
  CommitInput,
  DaySettlementSummary,
  EconomyChargeCategory,
  EconomyCostCategory,
  EconomyDiagnostic,
  EconomyLedger,
  EconomyLedgerProjection,
  EconomyOptions,
  EconomyQuote,
  EconomyQuoteRequest,
  EconomyReservation,
  EconomyResult,
  EconomyRuleSet,
  EconomyService,
  EconomySource,
  EconomyTransaction,
  EvalAsset,
  EvalAuthoringInput,
  EvalAuthoringResult,
  EvalRunInput,
  EvalRunRecord,
  EvalRunResult,
  ParkDaySettlementInput,
  ParkOperationsSettlementRecords,
  ParkOutcomeRecord,
  ParkRating,
  RatingContributor,
  RatingEvaluationInput,
  ReserveInput,
  SettlementCostInput,
  SettlementCostLine,
  VisitorDemand,
} from "./types.js";
import type { ParkIncident, ParkJob } from "../park-operations/public.js";

const COST_CATEGORIES: readonly EconomyCostCategory[] = [
  "authoring",
  "acquisition",
  "runtime",
  "eval-build",
  "eval-run",
  "operation",
  "maintenance",
  "response",
  "recovery",
  "expansion",
  "expression",
  "revenue",
];

const CHARGE_CATEGORIES: readonly EconomyChargeCategory[] = COST_CATEGORIES.filter(
  (category): category is EconomyChargeCategory => category !== "revenue",
);

const clone = <T>(value: T): T => structuredClone(value);

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
};

const immutable = <T>(value: T): T => deepFreeze(clone(value));

const lexical = (left: string, right: string): number => left.localeCompare(right, "en");

const uniqueSorted = (values: readonly string[] | undefined): readonly string[] =>
  [...new Set(values ?? [])].sort(lexical);

const token = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";

const diagnostic = (
  code: EconomyDiagnostic["code"],
  path: string,
  rule: string,
  message: string,
): EconomyDiagnostic => ({ code, path, rule, message });

const validId = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const validNonnegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const validInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const defaultRules = (): EconomyRuleSet => ({
  schemaVersion: "1",
  id: "economy:foundation-rules",
  version: "1.0.0",
  currency: "credits",
  costs: {
    authoring: 30,
    acquisition: 20,
    runtime: 1,
    "eval-build": 20,
    "eval-run": 2,
    operation: 1,
    maintenance: 4,
    response: 15,
    recovery: 25,
    expansion: 50,
    expression: 10,
  },
  visitors: { admissionPrice: 10, baseDemand: 100, capacity: 100 },
  rating: {
    base: { safety: 40, guestExperience: 30, dinosaurWelfare: 30 },
    penalties: {
      failedJob: 5,
      incidentRiskDivisor: 20,
      unresolvedIncident: 12,
      intervention: 2,
      closure: 8,
      injury: 15,
      death: 35,
      welfareNeglect: 12,
      guestDissatisfaction: 8,
      unservedVisitor: 1,
    },
    bonuses: { stableOperation: 2, demonstratedRecovery: 4 },
  },
});

export const DEFAULT_ECONOMY_RULE_SET: EconomyRuleSet = immutable(defaultRules());

const normalizeRules = (input: EconomyRuleSet | undefined): EconomyRuleSet => {
  const candidate = input === undefined ? defaultRules() : clone(input);
  const parsed = economyRuleSetSchema.safeParse(candidate);
  if (!parsed.success) throw new TypeError(`Economy rule set is invalid: ${parsed.error.message}`);
  return immutable(candidate);
};

const relatedFields = (input: {
  readonly relatedIds?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly artifactIds?: readonly string[];
  readonly evalIds?: readonly string[];
  readonly incidentIds?: readonly string[];
}): {
  readonly relatedIds?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly artifactIds?: readonly string[];
  readonly evalIds?: readonly string[];
  readonly incidentIds?: readonly string[];
} => {
  const output: {
    relatedIds?: readonly string[];
    entityIds?: readonly string[];
    artifactIds?: readonly string[];
    evalIds?: readonly string[];
    incidentIds?: readonly string[];
  } = {};
  const add = (key: keyof typeof output, value: readonly string[] | undefined): void => {
    const cleaned = uniqueSorted(value);
    if (cleaned.length > 0) output[key] = cleaned;
  };
  add("relatedIds", input.relatedIds);
  add("entityIds", input.entityIds);
  add("artifactIds", input.artifactIds);
  add("evalIds", input.evalIds);
  add("incidentIds", input.incidentIds);
  return output;
};

const sourceFor = (
  source: EconomySource | undefined,
  sourceId: string | undefined,
  fallbackKind: EconomySource["kind"],
  fallbackId: string,
): EconomySource | undefined => {
  if (source !== undefined) {
    if (!validId(source.id)) return undefined;
    return immutable({ ...source });
  }
  const id = sourceId ?? fallbackId;
  if (!validId(id)) return undefined;
  return immutable({ kind: fallbackKind, id });
};

const sourceSignature = (source: EconomySource): string => `${source.kind}:${source.id}:${source.label ?? ""}`;

const relatedSignature = (input: {
  readonly relatedIds?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly artifactIds?: readonly string[];
  readonly evalIds?: readonly string[];
  readonly incidentIds?: readonly string[];
}): string => JSON.stringify(relatedFields(input));

const deriveBalance = (initialBalance: number, transactions: readonly EconomyTransaction[]): number =>
  initialBalance + transactions.reduce((total, transaction) => total + transaction.amount, 0);

interface InternalState {
  readonly initialBalance: number;
  readonly rules: EconomyRuleSet;
  readonly transactions: EconomyTransaction[];
  readonly quotes: Map<string, EconomyQuote>;
  readonly reservations: Map<string, EconomyReservation>;
  readonly authoredEvals: Map<string, EvalAsset>;
  readonly evalRuns: Map<string, EvalRunRecord>;
  readonly settlements: Map<string, DaySettlementSummary>;
}

const reservationAmount = (state: InternalState): number => [...state.reservations.values()]
  .filter((reservation) => reservation.status === "reserved")
  .reduce((total, reservation) => total + reservation.amount, 0);

const projection = (state: InternalState): EconomyLedgerProjection => immutable({
  schemaVersion: "1",
  initialBalance: state.initialBalance,
  transactions: state.transactions,
  quotes: [...state.quotes.values()].sort((left, right) => lexical(left.id, right.id)),
  reservations: [...state.reservations.values()].sort((left, right) => lexical(left.id, right.id)),
  authoredEvals: [...state.authoredEvals.values()].sort((left, right) => lexical(`${left.id}@${left.version}`, `${right.id}@${right.version}`)),
  evalRuns: [...state.evalRuns.values()].sort((left, right) => lexical(left.runId, right.runId)),
  settlements: [...state.settlements.keys()],
  balance: deriveBalance(state.initialBalance, state.transactions),
  reservedBalance: reservationAmount(state),
  availableBalance: deriveBalance(state.initialBalance, state.transactions) - reservationAmount(state),
});

const success = <T>(state: InternalState, value: T): EconomyResult<T> => ({
  ok: true,
  value: immutable(value),
  projection: projection(state),
});

const failure = <T>(state: InternalState, ...diagnostics: EconomyDiagnostic[]): EconomyResult<T> => ({
  ok: false,
  diagnostics: immutable(diagnostics),
  projection: projection(state),
});

const categoryIsValid = (category: string): category is EconomyCostCategory => COST_CATEGORIES.includes(category as EconomyCostCategory);
const chargeCategoryIsValid = (category: string): category is EconomyChargeCategory => CHARGE_CATEGORIES.includes(category as EconomyChargeCategory);

const transactionEquivalent = (left: EconomyTransaction, right: AppendTransactionInput): boolean =>
  left.day === right.day &&
  left.tick === right.tick &&
  left.amount === right.amount &&
  left.category === right.category &&
  sourceSignature(left.source) === sourceSignature(right.source) &&
  (left.commandId ?? "") === (right.commandId ?? "") &&
  (left.settlementId ?? "") === (right.settlementId ?? "") &&
  relatedSignature(left) === relatedSignature(right);

const validateAppendInput = (input: AppendTransactionInput): readonly EconomyDiagnostic[] => {
  const diagnostics: EconomyDiagnostic[] = [];
  if (!validId(input.id)) diagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", "id", "stable-id", "Transaction ID is required for idempotency."));
  if (!validNonnegativeInteger(input.day)) diagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", "day", "non-negative-integer", "Transaction day must be a non-negative integer."));
  if (!validNonnegativeInteger(input.tick)) diagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", "tick", "non-negative-integer", "Transaction tick must be a non-negative integer."));
  if (!validInteger(input.amount)) diagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", "amount", "integer-credits", "Transaction amount must be an integer number of credits."));
  if (!categoryIsValid(input.category)) diagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", "category", "known-category", "Transaction category is not recognized."));
  if (!validId(input.source?.id)) diagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", "source.id", "stable-id", "Transaction source ID is required."));
  return diagnostics;
};

const appendTransactions = (
  state: InternalState,
  inputs: readonly AppendTransactionInput[],
): EconomyResult<AppendBatchResult> => {
  if (inputs.length === 0) return success(state, { transactions: [], idempotent: true });
  const diagnostics = inputs.flatMap(validateAppendInput);
  if (diagnostics.length > 0) return failure(state, ...diagnostics);
  const inputIds = new Set<string>();
  for (const input of inputs) {
    if (inputIds.has(input.id)) return failure(state, diagnostic("ECONOMY_LEDGER_CONFLICT", "id", "unique-transaction-id", `Transaction ${input.id} appears more than once.`));
    inputIds.add(input.id);
    const settlementConflict = input.settlementId === undefined ? undefined : state.transactions.find((entry) => entry.settlementId === input.settlementId && entry.id !== input.id);
    if (settlementConflict !== undefined) return failure(state, diagnostic("ECONOMY_SETTLEMENT_CONFLICT", "settlementId", "one-ledger-batch-per-settlement", `Settlement ${input.settlementId} already has transaction ${settlementConflict.id}.`));
  }

  const existing = inputs.map((input) => state.transactions.find((entry) => entry.id === input.id));
  if (existing.some((entry) => entry !== undefined)) {
    if (existing.every((entry, index) => entry !== undefined && transactionEquivalent(entry, inputs[index]!))) {
      return success(state, { transactions: existing.filter((entry): entry is EconomyTransaction => entry !== undefined), idempotent: true });
    }
    return failure(state, diagnostic("ECONOMY_LEDGER_CONFLICT", "id", "idempotent-command", "A transaction ID was reused with different immutable contents; no ledger entry changed."));
  }

  let balance = deriveBalance(state.initialBalance, state.transactions);
  let availableBalance = balance - reservationAmount(state);
  const built: EconomyTransaction[] = [];
  for (const input of inputs) {
    const nextBalance = balance + input.amount;
    const nextAvailableBalance = availableBalance + input.amount;
    if (!input.allowNegativeBalance && (nextBalance < 0 || nextAvailableBalance < 0)) {
      return failure(state, diagnostic("ECONOMY_INSUFFICIENT_FUNDS", "amount", "non-negative-available-balance", `The charge would consume reserved or unavailable credits (available balance ${availableBalance}).`));
    }
    const transaction: EconomyTransaction = {
      schemaVersion: "1",
      id: input.id,
      day: input.day,
      tick: input.tick,
      amount: input.amount,
      category: input.category,
      currency: "credits",
      source: immutable(input.source),
      sourceId: input.source.id,
      ...(input.commandId === undefined ? {} : { commandId: input.commandId }),
      ...(input.settlementId === undefined ? {} : { settlementId: input.settlementId }),
      ...relatedFields(input),
      balanceBefore: balance,
      balanceAfter: nextBalance,
    };
    const parsed = economyTransactionSchema.safeParse(transaction);
    if (!parsed.success) return failure(state, diagnostic("ECONOMY_RECORD_INVALID", "transaction", "ledger-schema", parsed.error.message));
    built.push(transaction);
    balance = nextBalance;
    availableBalance = nextAvailableBalance;
  }
  state.transactions.push(...built);
  return success(state, { transactions: built, idempotent: false });
};

const quoteEquivalent = (left: EconomyQuote, right: EconomyQuote): boolean =>
  left.category === right.category && left.amount === right.amount && left.day === right.day && left.tick === right.tick &&
  sourceSignature(left.source) === sourceSignature(right.source) && left.sourceId === right.sourceId &&
  left.ruleVersion.id === right.ruleVersion.id && left.ruleVersion.version === right.ruleVersion.version &&
  (left.expiresAtTick ?? -1) === (right.expiresAtTick ?? -1) && (left.description ?? "") === (right.description ?? "") &&
  relatedSignature(left) === relatedSignature(right);

const makeQuote = (state: InternalState, input: EconomyQuoteRequest): EconomyResult<EconomyQuote> => {
  if (!validId(input.id)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "id", "stable-id", "Quote ID is required."));
  if (!chargeCategoryIsValid(input.category)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "category", "known-charge-category", "Quotes cannot use the revenue category."));
  if (!validNonnegativeInteger(input.day) || !validNonnegativeInteger(input.tick)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "day/tick", "non-negative-integer", "Quote day and tick must be non-negative integers."));
  const quantity = input.quantity ?? 1;
  if (!validNonnegativeInteger(quantity) || quantity === 0) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "quantity", "positive-integer", "Quote quantity must be a positive integer."));
  const unitAmount = input.unitAmount ?? state.rules.costs[input.category];
  if (!validNonnegativeInteger(unitAmount)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "unitAmount", "non-negative-integer", "Quote unit amount must be a non-negative integer."));
  const amount = input.amount ?? unitAmount * quantity;
  if (!validNonnegativeInteger(amount)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "amount", "non-negative-integer", "Quote amount must be a non-negative integer."));
  if (input.expiresAtTick !== undefined && (!validNonnegativeInteger(input.expiresAtTick) || input.expiresAtTick < input.tick)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "expiresAtTick", "after-quote-tick", "Quote expiry must be at or after its creation tick."));
  const source = sourceFor(input.source, input.sourceId, "command", input.id);
  if (source === undefined) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "source", "stable-source", "Quote source ID is required."));
  const quote: EconomyQuote = {
    schemaVersion: "1",
    id: input.id,
    category: input.category,
    amount,
    currency: "credits",
    day: input.day,
    tick: input.tick,
    source,
    sourceId: source.id,
    ruleVersion: immutable(input.ruleVersion ?? { id: state.rules.id, version: state.rules.version }),
    ...(input.expiresAtTick === undefined ? {} : { expiresAtTick: input.expiresAtTick }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...relatedFields(input),
  };
  const parsed = economyQuoteSchema.safeParse(quote);
  if (!parsed.success) return failure(state, diagnostic("ECONOMY_RECORD_INVALID", "quote", "quote-schema", parsed.error.message));
  const existing = state.quotes.get(quote.id);
  if (existing !== undefined) {
    if (quoteEquivalent(existing, quote)) return success(state, existing);
    return failure(state, diagnostic("ECONOMY_QUOTE_CONFLICT", "id", "immutable-quote", `Quote ${quote.id} already exists with different contents.`));
  }
  state.quotes.set(quote.id, immutable(quote));
  return success(state, quote);
};

const isReserveInput = (input: ReserveInput | EconomyQuote | string): input is ReserveInput =>
  typeof input === "object" && input !== null && "quote" in input && !("schemaVersion" in input);

const quoteFromInput = (state: InternalState, input: ReserveInput | EconomyQuote | string): EconomyResult<EconomyQuote> => {
  const candidate: EconomyQuote | string | undefined = typeof input === "string" ? undefined : isReserveInput(input) ? input.quote : input;
  const quoteId = typeof input === "string" ? input : typeof candidate === "string" ? candidate : candidate?.id;
  if (quoteId === undefined) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "quote", "quote-or-quote-id", "A quote or quote ID is required."));
  const existing = state.quotes.get(quoteId);
  if (existing !== undefined) {
    if (candidate !== undefined && typeof candidate !== "string" && !quoteEquivalent(existing, candidate)) return failure(state, diagnostic("ECONOMY_QUOTE_CONFLICT", "quote.id", "immutable-quote", `Quote ${quoteId} conflicts with the stored quote.`));
    return success(state, existing);
  }
  if (candidate === undefined || typeof candidate === "string") return failure(state, diagnostic("ECONOMY_QUOTE_NOT_FOUND", "quoteId", "known-quote", `Quote ${quoteId} does not exist.`));
  const parsed = economyQuoteSchema.safeParse(candidate);
  if (!parsed.success) return failure(state, diagnostic("ECONOMY_RECORD_INVALID", "quote", "quote-schema", parsed.error.message));
  state.quotes.set(candidate.id, immutable(candidate));
  return success(state, candidate);
};

const reserveQuoteInternal = (state: InternalState, input: ReserveInput | EconomyQuote | string): EconomyResult<EconomyReservation> => {
  const quoteResult = quoteFromInput(state, input);
  if (!quoteResult.ok) return quoteResult;
  const quote = quoteResult.value;
  const explicitReservationId = isReserveInput(input) ? input.reservationId : undefined;
  const reservationId = explicitReservationId ?? `reservation:${token(quote.id)}`;
  if (!validId(reservationId)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "reservationId", "stable-id", "Reservation ID is required."));
  const existing = state.reservations.get(reservationId);
  if (existing !== undefined) {
    if (existing.quoteId === quote.id) return success(state, existing);
    return failure(state, diagnostic("ECONOMY_RESERVATION_CONFLICT", "reservationId", "idempotent-reservation", `Reservation ${reservationId} belongs to another quote.`));
  }
  const duplicateQuote = [...state.reservations.values()].find((reservation) => reservation.quoteId === quote.id && reservation.status !== "cancelled");
  if (duplicateQuote !== undefined) return success(state, duplicateQuote);
  if (quote.expiresAtTick !== undefined && quote.expiresAtTick < quote.tick) return failure(state, diagnostic("ECONOMY_QUOTE_EXPIRED", "quote.expiresAtTick", "quote-validity", `Quote ${quote.id} is expired.`));
  const available = deriveBalance(state.initialBalance, state.transactions) - reservationAmount(state);
  if (available < quote.amount) return failure(state, diagnostic("ECONOMY_INSUFFICIENT_FUNDS", "amount", "available-balance", `Cannot reserve ${quote.amount} credits; only ${available} credits are available.`));
  const reservation: EconomyReservation = {
    schemaVersion: "1",
    id: reservationId,
    quoteId: quote.id,
    status: "reserved",
    amount: quote.amount,
    category: quote.category,
    day: quote.day,
    tick: quote.tick,
    ...relatedFields(quote),
  };
  state.reservations.set(reservation.id, immutable(reservation));
  return success(state, reservation);
};

const commitQuoteInternal = (state: InternalState, reservationId: string, input: CommitInput | undefined): EconomyResult<EconomyTransaction> => {
  const reservation = state.reservations.get(reservationId);
  if (reservation === undefined) return failure(state, diagnostic("ECONOMY_RESERVATION_NOT_FOUND", "reservationId", "known-reservation", `Reservation ${reservationId} does not exist.`));
  if (reservation.status === "committed") {
    if (reservation.transactionId === undefined) return failure(state, diagnostic("ECONOMY_RESERVATION_STATE", "transactionId", "committed-has-transaction", "Committed reservation is missing its transaction link."));
    const transaction = state.transactions.find((entry) => entry.id === reservation.transactionId);
    if (transaction === undefined) return failure(state, diagnostic("ECONOMY_RESERVATION_STATE", "transactionId", "committed-has-transaction", "Committed reservation transaction is not in the ledger."));
    return success(state, transaction);
  }
  if (reservation.status === "cancelled") return failure(state, diagnostic("ECONOMY_RESERVATION_STATE", "status", "reserved-before-commit", `Reservation ${reservationId} was cancelled and cannot commit.`));
  const quote = state.quotes.get(reservation.quoteId);
  if (quote === undefined) return failure(state, diagnostic("ECONOMY_QUOTE_NOT_FOUND", "quoteId", "known-quote", `Quote ${reservation.quoteId} does not exist.`));
  const commitTick = input?.tick ?? quote.tick;
  const commitDay = input?.day ?? quote.day;
  if (!validNonnegativeInteger(commitTick) || !validNonnegativeInteger(commitDay)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "day/tick", "non-negative-integer", "Commit day and tick must be non-negative integers."));
  if (quote.expiresAtTick !== undefined && commitTick > quote.expiresAtTick) return failure(state, diagnostic("ECONOMY_QUOTE_EXPIRED", "quote.expiresAtTick", "commit-before-expiry", `Quote ${quote.id} expired before commit.`));
  const transactionId = `transaction:${token(reservation.id)}`;
  const appended = appendTransactions(state, [{
    id: transactionId,
    day: commitDay,
    tick: commitTick,
    amount: -reservation.amount,
    category: reservation.category,
    source: quote.source,
    commandId: input?.commandId,
    ...relatedFields(quote),
  }]);
  if (!appended.ok) return appended;
  const next: EconomyReservation = { ...reservation, status: "committed", transactionId };
  state.reservations.set(reservation.id, immutable(next));
  return success(state, appended.value.transactions[0]!);
};

const cancelQuoteInternal = (state: InternalState, reservationId: string, input: CancelInput | undefined): EconomyResult<EconomyReservation> => {
  const reservation = state.reservations.get(reservationId);
  if (reservation === undefined) return failure(state, diagnostic("ECONOMY_RESERVATION_NOT_FOUND", "reservationId", "known-reservation", `Reservation ${reservationId} does not exist.`));
  if (reservation.status === "committed") return failure(state, diagnostic("ECONOMY_RESERVATION_STATE", "status", "commit-is-final", `Committed reservation ${reservationId} cannot be cancelled.`));
  if (reservation.status === "cancelled") return success(state, reservation);
  const next: EconomyReservation = {
    ...reservation,
    status: "cancelled",
    ...(input?.reason === undefined ? {} : { cancellationReason: input.reason }),
  };
  state.reservations.set(reservation.id, immutable(next));
  return success(state, next);
};

const outcomeCount = (outcomes: readonly ParkOutcomeRecord[], kinds: readonly ParkOutcomeRecord["kind"][]): number => outcomes.filter((outcome) => kinds.includes(outcome.kind)).reduce((sum, outcome) => sum + outcome.count, 0);

const incidentUnresolved = (incident: ParkIncident): boolean => !["resolved", "closed"].includes(incident.status);

const evidenceFor = (
  summaryId: string,
  summary: { readonly completedJobIds: readonly string[]; readonly failedJobIds: readonly string[]; readonly incidentIds: readonly string[]; readonly interventionCommandIds: readonly string[] },
  incidents: readonly ParkIncident[],
  outcomes: readonly ParkOutcomeRecord[],
): readonly string[] => uniqueSorted([
  summaryId,
  ...summary.completedJobIds,
  ...summary.failedJobIds,
  ...summary.incidentIds,
  ...summary.interventionCommandIds,
  ...incidents.map((incident) => incident.id),
  ...outcomes.map((outcome) => outcome.id),
]);

const contributor = (
  id: string,
  category: RatingContributor["category"],
  label: string,
  rawPoints: number,
  explanation: string,
  evidenceIds: readonly string[],
): RatingContributor => ({
  id,
  category,
  label,
  points: rawPoints,
  rawPoints,
  explanation,
  relatedIds: evidenceIds,
});

export const calculateParkRating = (input: RatingEvaluationInput): ParkRating => {
  const rules = input.rules === undefined ? DEFAULT_ECONOMY_RULE_SET : normalizeRules(input.rules);
  const incidentIds = new Set(input.summary.incidentIds);
  const incidents = [...(input.incidents ?? [])].filter((incident) => incidentIds.has(incident.id)).sort((left, right) => lexical(left.id, right.id));
  const outcomes = [...(input.outcomes ?? [])].sort((left, right) => lexical(left.id, right.id));
  const failedJobs = input.summary.failedJobIds.length;
  const interventions = input.summary.interventionCommandIds.length;
  const unresolved = incidents.filter(incidentUnresolved).length + outcomeCount(outcomes, ["unresolved-incident"]);
  const incidentRiskPenalty = incidents.reduce((sum, incident) => sum + Math.ceil(incident.risk / rules.rating.penalties.incidentRiskDivisor), 0);
  const injuryCount = outcomeCount(outcomes, ["injury", "visitor-injury", "dinosaur-injury"]);
  const deathCount = outcomeCount(outcomes, ["death", "visitor-death", "dinosaur-death"]);
  const closureCount = outcomeCount(outcomes, ["closure"]);
  const stableCount = outcomeCount(outcomes, ["stable-safe-operation"]);
  const recoveryCount = outcomeCount(outcomes, ["recovery-demonstrated"]);
  const welfareNeglect = outcomeCount(outcomes, ["welfare-neglect"]);
  const guestDissatisfaction = outcomeCount(outcomes, ["guest-dissatisfaction"]);
  const unservedVisitors = Math.max(0, input.summary.attendance - input.summary.departedVisitors);
  const safety = rules.rating.base.safety -
    failedJobs * rules.rating.penalties.failedJob -
    incidentRiskPenalty -
    unresolved * rules.rating.penalties.unresolvedIncident -
    injuryCount * rules.rating.penalties.injury -
    deathCount * rules.rating.penalties.death -
    closureCount * rules.rating.penalties.closure +
    stableCount * rules.rating.bonuses.stableOperation +
    recoveryCount * rules.rating.bonuses.demonstratedRecovery;
  const guestExperience = rules.rating.base.guestExperience -
    interventions * rules.rating.penalties.intervention -
    closureCount * rules.rating.penalties.closure -
    guestDissatisfaction * rules.rating.penalties.guestDissatisfaction -
    unservedVisitors * rules.rating.penalties.unservedVisitor;
  const dinosaurWelfare = rules.rating.base.dinosaurWelfare -
    failedJobs * rules.rating.penalties.failedJob -
    injuryCount * rules.rating.penalties.injury -
    deathCount * rules.rating.penalties.death -
    welfareNeglect * rules.rating.penalties.welfareNeglect +
    stableCount * rules.rating.bonuses.stableOperation;
  const evidenceIds = evidenceFor(input.summary.id, input.summary, incidents, outcomes);
  const contributors = [
    contributor("rating:safety", "safety", "Safety", safety, "Safety reflects failed work, incident risk, unresolved hazards, casualties, closure, and explicit safe recovery evidence.", evidenceIds),
    contributor("rating:guest-experience", "guest-experience", "Guest experience", guestExperience, "Guest experience reflects interventions, closure, unserved visitors, and explicit guest dissatisfaction evidence.", evidenceIds),
    contributor("rating:dinosaur-welfare", "dinosaur-welfare", "Dinosaur welfare", dinosaurWelfare, "Dinosaur welfare reflects failed care work, explicit welfare neglect, casualties, and stable safe operation evidence.", evidenceIds),
  ];
  return immutable({
    schemaVersion: "1",
    value: Math.max(0, Math.min(100, contributors.reduce((sum, entry) => sum + entry.points, 0))),
    ...(input.previousRating === undefined ? {} : { previousValue: input.previousRating }),
    ruleVersion: { id: rules.id, version: rules.version },
    contributors,
    evidenceIds,
  });
};

export const calculateVisitorDemand = (
  rating: number,
  rules: EconomyRuleSet = DEFAULT_ECONOMY_RULE_SET,
  evidenceIds: readonly string[] = [],
): VisitorDemand => {
  const parsedRules = normalizeRules(rules);
  const safeRating = validInteger(rating) ? Math.max(0, Math.min(100, rating)) : 0;
  const demand = Math.max(0, Math.min(parsedRules.visitors.capacity, Math.floor(parsedRules.visitors.baseDemand * safeRating / 100)));
  return immutable({
    schemaVersion: "1",
    rating: safeRating,
    baseDemand: parsedRules.visitors.baseDemand,
    demand,
    capacity: parsedRules.visitors.capacity,
    ruleVersion: { id: parsedRules.id, version: parsedRules.version },
    evidenceIds: uniqueSorted(evidenceIds),
  });
};

const resolveSettlementRecords = (
  input: ParkDaySettlementInput,
): { readonly summary: ParkOperationsSettlementRecords["summary"] | undefined; readonly jobs: readonly ParkJob[]; readonly incidents: readonly ParkIncident[]; readonly outcomes: readonly ParkOutcomeRecord[] } => {
  const summary = input.summary ?? input.operations?.daySummaries.find((candidate) => candidate.day === input.day);
  const completedAndFailedIds = new Set([...(summary?.completedJobIds ?? []), ...(summary?.failedJobIds ?? [])]);
  const incidentIds = new Set(summary?.incidentIds ?? []);
  const jobs = (input.jobs ?? input.operations?.jobs ?? []).filter((job) => completedAndFailedIds.has(job.id));
  const incidents = (input.incidents ?? input.operations?.incidents ?? []).filter((incident) => incidentIds.has(incident.id));
  return { summary, jobs, incidents, outcomes: input.outcomes ?? [] };
};

const validateSummary = (summary: ParkOperationsSettlementRecords["summary"]): readonly EconomyDiagnostic[] => {
  const diagnostics: EconomyDiagnostic[] = [];
  if (!validId(summary.id)) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", "summary.id", "park-operations-summary-id", "Park Operations summary ID is required."));
  if (!validNonnegativeInteger(summary.day) || summary.day === 0) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", "summary.day", "positive-day", "Park Operations summary day must be a positive integer."));
  if (!validNonnegativeInteger(summary.startTick) || !validNonnegativeInteger(summary.endTick) || summary.endTick < summary.startTick) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", "summary.startTick/endTick", "ordered-ticks", "Park Operations summary ticks must be ordered non-negative integers."));
  if (!validNonnegativeInteger(summary.attendance) || !validNonnegativeInteger(summary.departedVisitors)) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", "summary.attendance/departedVisitors", "non-negative-visitors", "Attendance and departures must be non-negative integers."));
  for (const [path, ids] of [["completedJobIds", summary.completedJobIds], ["failedJobIds", summary.failedJobIds], ["incidentIds", summary.incidentIds], ["interventionCommandIds", summary.interventionCommandIds]] as const) {
    if (ids.some((value) => !validId(value))) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", `summary.${path}`, "stable-evidence-ids", "Park Operations evidence IDs must be non-empty strings."));
  }
  return diagnostics;
};

const validateOutcomes = (outcomes: readonly ParkOutcomeRecord[]): readonly EconomyDiagnostic[] => {
  const diagnostics: EconomyDiagnostic[] = [];
  for (const [index, outcome] of outcomes.entries()) {
    if (!validId(outcome.id)) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", `outcomes.${index}.id`, "stable-outcome-id", "Outcome ID is required."));
    if (!validId(outcome.sourceId)) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", `outcomes.${index}.sourceId`, "stable-source-id", "Outcome source ID is required."));
    if (!validNonnegativeInteger(outcome.count)) diagnostics.push(diagnostic("ECONOMY_RECORD_INVALID", `outcomes.${index}.count`, "non-negative-count", "Outcome count must be a non-negative integer."));
  }
  return diagnostics;
};

const defaultSettlementCosts = (
  summary: ParkOperationsSettlementRecords["summary"],
  rules: EconomyRuleSet,
): readonly SettlementCostInput[] => {
  const lines: SettlementCostInput[] = [];
  for (const jobId of [...summary.completedJobIds].sort(lexical)) {
    if (rules.costs.operation > 0) lines.push({ category: "operation", amount: rules.costs.operation, sourceId: jobId, relatedIds: [jobId], description: "Routine completed-operation cost." });
  }
  for (const jobId of [...summary.failedJobIds].sort(lexical)) {
    if (rules.costs.maintenance > 0) lines.push({ category: "maintenance", amount: rules.costs.maintenance, sourceId: jobId, relatedIds: [jobId], description: "Maintenance cost for failed operational work." });
  }
  for (const commandId of [...summary.interventionCommandIds].sort(lexical)) {
    if (rules.costs.response > 0) lines.push({ category: "response", amount: rules.costs.response, sourceId: commandId, relatedIds: [commandId], description: "Operational intervention cost." });
  }
  return lines;
};

const settleDay = (state: InternalState, input: ParkDaySettlementInput): EconomyResult<DaySettlementSummary> => {
  if (!validId(input.settlementId)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "settlementId", "stable-id", "Settlement ID is required for no-double-charge semantics."));
  if (!validNonnegativeInteger(input.day) || !validNonnegativeInteger(input.tick)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "day/tick", "non-negative-integer", "Settlement day and tick must be non-negative integers."));
  const existing = state.settlements.get(input.settlementId);
  if (existing !== undefined) return success(state, { ...existing, idempotent: true });
  const records = resolveSettlementRecords(input);
  if (records.summary === undefined) return failure(state, diagnostic("ECONOMY_RECORD_INVALID", "summary", "exact-park-operations-summary", `No Park Operations day summary exists for day ${input.day}.`));
  const summary = records.summary;
  if (input.operations !== undefined && !parkOperationsStateSchema.safeParse(input.operations).success) return failure(state, diagnostic("ECONOMY_RECORD_INVALID", "operations", "park-operations-state-schema", "Park Operations state failed its public schema validation."));
  const summaryDiagnostics = validateSummary(summary);
  if (summaryDiagnostics.length > 0) return failure(state, ...summaryDiagnostics);
  const outcomeDiagnostics = validateOutcomes(records.outcomes);
  if (outcomeDiagnostics.length > 0) return failure(state, ...outcomeDiagnostics);
  if (summary.day !== input.day) return failure(state, diagnostic("ECONOMY_RECORD_INVALID", "summary.day", "settlement-day-match", "Settlement day must match the exact Park Operations summary."));
  const rules = state.rules;
  const rating = calculateParkRating({ summary, incidents: records.incidents, outcomes: records.outcomes, previousRating: input.previousRating, rules });
  const demand = calculateVisitorDemand(rating.value, rules, [summary.id]);
  const visitorPrice = input.visitorPrice ?? rules.visitors.admissionPrice;
  if (!validNonnegativeInteger(visitorPrice)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "visitorPrice", "non-negative-integer", "Visitor price must be a non-negative integer."));
  const attendance = summary.attendance;
  const revenue = attendance * visitorPrice;
  const providedCosts = input.costs ?? defaultSettlementCosts(summary, rules);
  const costs = [...providedCosts].sort((left, right) => lexical(`${left.category}:${left.sourceId}`, `${right.category}:${right.sourceId}`));
  const costDiagnostics: EconomyDiagnostic[] = [];
  for (const [index, cost] of costs.entries()) {
    if (!chargeCategoryIsValid(cost.category)) costDiagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", `costs.${index}.category`, "known-charge-category", `Cost category ${cost.category} is not chargeable.`));
    if (!validNonnegativeInteger(cost.amount)) costDiagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", `costs.${index}.amount`, "non-negative-integer", "Settlement cost must be a non-negative integer."));
    if (!validId(cost.sourceId)) costDiagnostics.push(diagnostic("ECONOMY_INVALID_INPUT", `costs.${index}.sourceId`, "stable-id", "Settlement cost source ID is required."));
  }
  if (costDiagnostics.length > 0) return failure(state, ...costDiagnostics);
  const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const netChange = revenue - totalCosts;
  const currentBalance = deriveBalance(state.initialBalance, state.transactions);
  if (currentBalance + netChange < 0) return failure(state, diagnostic("ECONOMY_INSUFFICIENT_FUNDS", "costs", "atomic-day-settlement", "Day settlement cannot afford its itemized costs; no revenue or cost transaction was written."));
  const evidenceIds = evidenceFor(summary.id, summary, records.incidents, records.outcomes);
  const settlementSource: EconomySource = { kind: "settlement", id: input.sourceId ?? `settlement:${input.settlementId}` };
  const revenueId = `transaction:${token(input.settlementId)}-revenue`;
  const appendInputs: AppendTransactionInput[] = [{
    id: revenueId,
    day: input.day,
    tick: input.tick,
    amount: revenue,
    category: "revenue",
    source: settlementSource,
    settlementId: input.settlementId,
    relatedIds: evidenceIds,
    incidentIds: summary.incidentIds,
  }];
  const costIds: string[] = [];
  for (const [index, cost] of costs.entries()) {
    const transactionId = `transaction:${token(input.settlementId)}-cost-${index + 1}-${token(cost.category)}-${token(cost.sourceId)}`;
    costIds.push(transactionId);
    appendInputs.push({
      id: transactionId,
      day: input.day,
      tick: input.tick,
      amount: -cost.amount,
      category: cost.category,
      source: { kind: cost.category === "recovery" ? "recovery" : "settlement", id: cost.sourceId },
      settlementId: input.settlementId,
      relatedIds: [...evidenceIds, ...(cost.relatedIds ?? [])],
      entityIds: cost.entityIds,
      artifactIds: cost.artifactIds,
      evalIds: cost.evalIds,
      incidentIds: cost.incidentIds ?? summary.incidentIds,
    });
  }
  const appended = appendTransactions(state, appendInputs);
  if (!appended.ok) return appended;
  const transactionIds = appended.value.transactions.map((transaction) => transaction.id);
  const costLines: SettlementCostLine[] = costs.map((cost, index) => ({ ...cost, transactionId: costIds[index]! }));
  const result: DaySettlementSummary = {
    schemaVersion: "1",
    settlementId: input.settlementId,
    day: input.day,
    tick: input.tick,
    ruleVersion: { id: rules.id, version: rules.version },
    rating,
    demand,
    attendance,
    visitorPrice,
    revenue,
    costs: costLines,
    totalCosts,
    netChange,
    transactionIds,
    balance: deriveBalance(state.initialBalance, state.transactions),
    idempotent: false,
    evidenceIds,
    ...relatedFields(input),
  };
  state.settlements.set(input.settlementId, immutable(result));
  return success(state, result);
};

const evalKey = (id: string, version: string): string => `${id}@${version}`;

const evalQuoteRequest = (
  state: InternalState,
  input: Omit<EconomyQuoteRequest, "category">,
  category: "eval-build" | "eval-run",
): EconomyResult<EconomyQuote> => {
  const source = input.source ?? { kind: "eval" as const, id: input.sourceId ?? input.id };
  return makeQuote(state, { ...input, category, source });
};

const transactionById = (state: InternalState, id: string | undefined): EconomyTransaction | undefined => id === undefined ? undefined : state.transactions.find((entry) => entry.id === id);

const authorEval = (state: InternalState, input: EvalAuthoringInput): EconomyResult<EvalAuthoringResult> => {
  if (!validId(input.evalId) || !validId(input.evalVersion)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "evalId/evalVersion", "exact-eval-identity", "Eval ID and version are required."));
  if (!validNonnegativeInteger(input.day) || !validNonnegativeInteger(input.tick)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "day/tick", "non-negative-integer", "Eval authoring day and tick must be non-negative integers."));
  const key = evalKey(input.evalId, input.evalVersion);
  const existing = state.authoredEvals.get(key);
  if (existing !== undefined) return success(state, { asset: existing, transaction: transactionById(state, existing.authoringTransactionId), idempotent: true, charged: 0 });
  let quote: EconomyQuote;
  if (input.quote !== undefined) {
    quote = input.quote;
  } else {
    const quoteResult = evalQuoteRequest(state, {
      id: `quote:eval-build-${token(key)}`,
      day: input.day,
      tick: input.tick,
      amount: input.amount,
      source: { kind: "eval", id: `eval:${token(key)}` },
      evalIds: [input.evalId],
      ...relatedFields(input),
    }, "eval-build");
    if (!quoteResult.ok) return quoteResult;
    quote = quoteResult.value;
  }
  if (quote.category !== "eval-build") return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "quote.category", "eval-build-authoring", "Eval authoring requires an eval-build quote."));
  const reservation = reserveQuoteInternal(state, { quote, reservationId: `reservation:eval-build-${token(key)}`, commandId: input.commandId });
  if (!reservation.ok) return reservation;
  const committed = commitQuoteInternal(state, reservation.value.id, { commandId: input.commandId, day: input.day, tick: input.tick });
  if (!committed.ok) return committed;
  const asset: EvalAsset = {
    id: input.evalId,
    version: input.evalVersion,
    authoredDay: input.day,
    authoredTick: input.tick,
    ...(committed.value.id === undefined ? {} : { authoringTransactionId: committed.value.id }),
  };
  state.authoredEvals.set(key, immutable(asset));
  return success(state, { asset, transaction: committed.value, idempotent: false, charged: quote.amount });
};

const runEval = (state: InternalState, input: EvalRunInput): EconomyResult<EvalRunResult> => {
  if (!validId(input.runId) || !validId(input.evalId) || !validId(input.evalVersion)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "runId/evalId/evalVersion", "exact-eval-identity", "Eval run ID, eval ID, and version are required."));
  if (!validNonnegativeInteger(input.day) || !validNonnegativeInteger(input.tick)) return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "day/tick", "non-negative-integer", "Eval run day and tick must be non-negative integers."));
  const key = evalKey(input.evalId, input.evalVersion);
  if (!state.authoredEvals.has(key)) return failure(state, diagnostic("ECONOMY_EVAL_NOT_AUTHORED", "evalId/evalVersion", "author-before-rerun", `Eval ${key} has not been authored.`));
  const existing = state.evalRuns.get(input.runId);
  if (existing !== undefined) {
    if (existing.evalId !== input.evalId || existing.evalVersion !== input.evalVersion) return failure(state, diagnostic("ECONOMY_EVAL_CONFLICT", "runId", "immutable-eval-run", `Run ${input.runId} belongs to another eval.`));
    return success(state, { run: existing, transaction: transactionById(state, existing.transactionId), charged: 0, idempotent: true });
  }
  let quote: EconomyQuote;
  if (input.quote !== undefined) {
    quote = input.quote;
  } else {
    const quoteResult = evalQuoteRequest(state, {
      id: `quote:eval-run-${token(input.runId)}`,
      day: input.day,
      tick: input.tick,
      amount: input.amount,
      source: { kind: "eval", id: `eval:${token(key)}` },
      evalIds: [input.evalId],
      ...relatedFields(input),
    }, "eval-run");
    if (!quoteResult.ok) return quoteResult;
    quote = quoteResult.value;
  }
  if (quote.category !== "eval-run") return failure(state, diagnostic("ECONOMY_INVALID_INPUT", "quote.category", "eval-run-rerun", "Eval reruns require an eval-run quote."));
  const reservation = reserveQuoteInternal(state, { quote, reservationId: `reservation:eval-run-${token(input.runId)}`, commandId: input.commandId });
  if (!reservation.ok) return reservation;
  const committed = commitQuoteInternal(state, reservation.value.id, { commandId: input.commandId, day: input.day, tick: input.tick });
  if (!committed.ok) return committed;
  const run: EvalRunRecord = { runId: input.runId, evalId: input.evalId, evalVersion: input.evalVersion, day: input.day, tick: input.tick, transactionId: committed.value.id };
  state.evalRuns.set(run.runId, immutable(run));
  return success(state, { run, transaction: committed.value, charged: quote.amount, idempotent: false });
};

const createState = (options: EconomyOptions = {}): InternalState => {
  const initialBalance = options.initialBalance ?? options.startingCredits ?? 100;
  if (!validNonnegativeInteger(initialBalance)) throw new TypeError("Economy initialBalance must be a non-negative integer.");
  return {
    initialBalance,
    rules: normalizeRules(options.rules),
    transactions: [],
    quotes: new Map(),
    reservations: new Map(),
    authoredEvals: new Map(),
    evalRuns: new Map(),
    settlements: new Map(),
  };
};

export const createEconomyService = (options: EconomyOptions = {}): EconomyService => {
  const state = createState(options);
  const service: EconomyService = {
    snapshot: () => projection(state),
    project: () => projection(state),
    append: (input) => {
      const result = appendTransactions(state, [input]);
      return result.ok ? success(state, result.value.transactions[0]!) : result;
    },
    appendBatch: (inputs) => appendTransactions(state, inputs),
    quote: (input) => makeQuote(state, input),
    reserve: (input) => reserveQuoteInternal(state, input),
    commit: (reservationId, input) => commitQuoteInternal(state, reservationId, input),
    cancel: (reservationId, input) => cancelQuoteInternal(state, reservationId, input),
    settleDay: (input) => settleDay(state, input),
    calculateRating: (input) => calculateParkRating({ ...input, rules: input.rules ?? state.rules }),
    calculateDemand: (rating, evidenceIds = []) => calculateVisitorDemand(rating, state.rules, evidenceIds),
    quoteEvalAuthoring: (input) => evalQuoteRequest(state, input, "eval-build"),
    quoteEvalRun: (input) => evalQuoteRequest(state, input, "eval-run"),
    authorEval: (input) => authorEval(state, input),
    runEval: (input) => runEval(state, input),
  };
  return service;
};

export const createEconomyLedger = (options: EconomyOptions = {}): EconomyLedger => {
  const service = createEconomyService(options);
  return {
    snapshot: service.snapshot,
    project: service.project,
    append: service.append,
    appendBatch: service.appendBatch,
  };
};

export const settleParkDay = (service: EconomyService, input: ParkDaySettlementInput): EconomyResult<DaySettlementSummary> => service.settleDay(input);
export const quoteCost = (service: EconomyService, input: EconomyQuoteRequest): EconomyResult<EconomyQuote> => service.quote(input);
export const reserveQuote = (service: EconomyService, input: ReserveInput | EconomyQuote | string): EconomyResult<EconomyReservation> => service.reserve(input);
export const commitQuote = (service: EconomyService, reservationId: string, input?: CommitInput): EconomyResult<EconomyTransaction> => service.commit(reservationId, input);
export const cancelQuote = (service: EconomyService, reservationId: string, input?: CancelInput): EconomyResult<EconomyReservation> => service.cancel(reservationId, input);
