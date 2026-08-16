import type {
  CreditBalance,
  CreditCommand,
  CreditLedger,
  CreditResult,
  LedgerEntry,
  LedgerError,
  LedgerQuery,
  LedgerReconciliation,
  LedgerValidation,
} from "./types.ts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function isInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

function errorResult(balance: CreditBalance, error: LedgerError): CreditResult {
  return freeze({ ok: false as const, error: freeze(error), balance: freeze({ ...balance }) });
}

/**
 * Creates an append-only integer credit ledger.  The opening balance is not a
 * synthetic ledger entry: reconciliation reports it separately and all later
 * mutations are represented by immutable entries.
 */
export function createCreditLedger(openingBalance = 0, logicalTime = 0): CreditLedger {
  if (!isInteger(openingBalance) || openingBalance < 0) throw new Error("openingBalance must be a non-negative safe integer");
  if (!isInteger(logicalTime) || logicalTime < 0) throw new Error("logicalTime must be a non-negative safe integer");

  const opening = openingBalance;
  let current: CreditBalance = freeze({ amount: opening, version: 0 });
  const entries: LedgerEntry[] = [];
  const results = new Map<string, CreditResult>();
  let sequence = 0;
  let recoveryAppliedAtVersion: number | undefined;

  function balance(): CreditBalance {
    return current;
  }

  function transact(command: CreditCommand): CreditResult {
    const key = command.correlationKey ?? command.transactionId;
    const prior = results.get(key);
    if (prior) {
      if (prior.ok) return freeze({ ...prior, duplicate: true });
      return freeze({ ...prior });
    }

    const invalid = (error: LedgerError): CreditResult => {
      const result = errorResult(current, { ...error, transactionId: command.transactionId });
      results.set(key, result);
      return result;
    };

    if (!command.transactionId || typeof command.transactionId !== "string") {
      return invalid({ code: "INVALID_TRANSACTION_ID", message: "A stable transaction id is required." });
    }
    if (!command.sourceRef || typeof command.sourceRef !== "string") {
      return invalid({ code: "INVALID_SOURCE", message: "A source reference is required." });
    }
    if (!isInteger(command.amount)) {
      return invalid({ code: "NON_INTEGER_AMOUNT", message: "Credit amounts must be safe integers." });
    }
    if (!isInteger(command.expectedBalanceVersion) || command.expectedBalanceVersion !== current.version) {
      return invalid({
        code: "BALANCE_VERSION_CONFLICT",
        message: `Balance version ${command.expectedBalanceVersion} is stale; current version is ${current.version}.`,
        expected: command.expectedBalanceVersion,
        actual: current.version,
      });
    }

    const nextAmount = current.amount + command.amount;
    if (nextAmount < 0) {
      return invalid({
        code: "INSUFFICIENT_FUNDS",
        message: `Transaction would overdraw the balance by ${Math.abs(nextAmount)} credits.`,
      });
    }
    if (!isInteger(nextAmount) || nextAmount < 0) {
      return invalid({ code: "NEGATIVE_BALANCE", message: "The resulting balance must remain non-negative." });
    }

    const id = `ledger.${String(current.version + 1).padStart(8, "0")}.${sequence++}`;
    const nextVersion = current.version + 1;
    const entry: LedgerEntry = freeze({
      id,
      type: command.type,
      amount: command.amount,
      logicalTime: command.logicalTime ?? logicalTime,
      sourceRef: command.sourceRef,
      idempotencyKey: key,
      postBalance: nextAmount,
      balanceVersion: nextVersion,
    });
    current = freeze({ amount: nextAmount, version: nextVersion });
    entries.push(entry);
    const result: CreditResult = freeze({ ok: true as const, balance: current, entry });
    results.set(key, result);
    return result;
  }

  function ledger(query: LedgerQuery = {}): readonly LedgerEntry[] {
    return Object.freeze(entries.filter((entry) =>
      (query.type === undefined || entry.type === query.type) &&
      (query.sourceRef === undefined || entry.sourceRef === query.sourceRef) &&
      (query.idempotencyKey === undefined || entry.idempotencyKey === query.idempotencyKey) &&
      (query.fromLogicalTime === undefined || entry.logicalTime >= query.fromLogicalTime) &&
      (query.toLogicalTime === undefined || entry.logicalTime <= query.toLogicalTime),
    ));
  }

  function reconcile(): LedgerReconciliation {
    const committedAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    return freeze({
      openingBalance: opening,
      committedAmount,
      balance: current.amount,
      reconciled: opening + committedAmount === current.amount && current.amount >= 0,
      entries: entries.length,
    });
  }

  function validate(): LedgerValidation {
    const errors: string[] = [];
    let previousBalance = opening;
    let previousVersion = 0;
    const ids = new Set<string>();
    const idempotency = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) errors.push(`duplicate entry id ${entry.id}`);
      if (idempotency.has(entry.idempotencyKey)) errors.push(`duplicate idempotency key ${entry.idempotencyKey}`);
      ids.add(entry.id);
      idempotency.add(entry.idempotencyKey);
      if (!isInteger(entry.amount)) errors.push(`non-integer amount ${entry.id}`);
      if (entry.balanceVersion !== previousVersion + 1) errors.push(`non-contiguous version ${entry.id}`);
      if (entry.postBalance !== previousBalance + entry.amount) errors.push(`post-balance mismatch ${entry.id}`);
      if (entry.postBalance < 0) errors.push(`negative post-balance ${entry.id}`);
      previousBalance = entry.postBalance;
      previousVersion = entry.balanceVersion;
    }
    if (previousBalance !== current.amount || previousVersion !== current.version) errors.push("current balance does not reconcile");
    const reconciliation = reconcile();
    if (!reconciliation.reconciled) errors.push("opening balance plus entries does not reconcile");
    return freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function entryFor(transactionId: string): LedgerEntry | undefined {
    const result = results.get(transactionId);
    return result?.ok ? result.entry : undefined;
  }

  function canonical(): string {
    return JSON.stringify({ openingBalance: opening, balance: current, entries });
  }

  function applyRecovery(at: number, sourceRef = "recovery.authored-floor", amount = 100): CreditResult | null {
    if (current.amount >= 0 && recoveryAppliedAtVersion === current.version) return null;
    if (!isInteger(amount) || amount <= 0) return null;
    const recoveryVersion = current.version;
    const result = transact({
      transactionId: `recovery:${recoveryVersion}:${amount}`,
      type: "RECOVERY_ASSISTANCE",
      amount,
      logicalTime: at,
      sourceRef,
      expectedBalanceVersion: current.version,
    });
    if (result.ok) recoveryAppliedAtVersion = result.balance.version;
    return result;
  }

  function checkpoint() {
    return freeze({ openingBalance: opening, balance: freeze({ ...current }), entries: Object.freeze(entries.map((entry) => freeze({ ...entry }))), results: Object.freeze([...results.entries()].map(([key, result]) => freeze({ key, result }))), sequence, ...(recoveryAppliedAtVersion === undefined ? {} : { recoveryAppliedAtVersion }) });
  }

  function restore(checkpointValue: ReturnType<typeof checkpoint>): void {
    if (checkpointValue.openingBalance !== opening) throw new Error("Ledger opening balance does not match this service.");
    current = freeze({ ...checkpointValue.balance });
    entries.splice(0, entries.length, ...checkpointValue.entries.map((entry) => freeze({ ...entry })));
    results.clear();
    for (const item of checkpointValue.results) results.set(item.key, item.result);
    sequence = checkpointValue.sequence;
    recoveryAppliedAtVersion = checkpointValue.recoveryAppliedAtVersion;
    const validation = validate();
    if (!validation.valid) throw new Error(`Ledger restore failed validation: ${validation.errors.join("; ")}`);
  }

  return Object.freeze({ balance, transact, ledger, entryFor, reconcile, canonical, validate, applyRecovery, checkpoint, restore });
}

export const createCreditLedgerPort = createCreditLedger;
