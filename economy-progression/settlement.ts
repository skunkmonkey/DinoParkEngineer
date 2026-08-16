import type {
  CreditLedger,
  IncidentSummary,
  ParkPeriodSummary,
  SettlementConfig,
  SettlementConfigValidation,
  SettlementLineItem,
  SettlementResult,
} from "./types.ts";

export const DEFAULT_SETTLEMENT_CONFIG: SettlementConfig = Object.freeze({
  attendanceCredits: 5,
  satisfactionCreditsPerPoint: 1,
  uptimeCreditsPerPoint: 2,
  dinosaurHealthCreditsPerPoint: 1,
  completedJobCredits: 40,
  lateJobCost: 25,
  failedJobCost: 70,
  closureCost: 150,
  contextUnitCost: 1,
  severityCosts: Object.freeze({ 0: 8, 1: 40, 2: 120, 3: 300, 4: 700 }),
  recoveryFloor: 250,
});

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function isInt(value: number): boolean {
  return Number.isSafeInteger(value);
}

function mergedConfig(config: Partial<SettlementConfig> = {}): SettlementConfig {
  return freeze({
    ...DEFAULT_SETTLEMENT_CONFIG,
    ...config,
    severityCosts: freeze({ ...DEFAULT_SETTLEMENT_CONFIG.severityCosts, ...(config.severityCosts ?? {}) }),
  });
}

/** Validates authored balance content before a game session consumes it. */
export function validateSettlementConfig(configInput: Partial<SettlementConfig> = {}): SettlementConfigValidation {
  const config = mergedConfig(configInput);
  const errors: string[] = [];
  const scalarKeys: readonly (keyof Omit<SettlementConfig, "severityCosts" | "recoveryFloor">)[] = [
    "attendanceCredits",
    "satisfactionCreditsPerPoint",
    "uptimeCreditsPerPoint",
    "dinosaurHealthCreditsPerPoint",
    "completedJobCredits",
    "lateJobCost",
    "failedJobCost",
    "closureCost",
    "contextUnitCost",
  ];
  for (const key of scalarKeys) {
    const value = config[key];
    if (!Number.isSafeInteger(value) || value < 0) errors.push(`${String(key)} must be a non-negative safe integer`);
  }
  for (const severity of [0, 1, 2, 3, 4] as const) {
    const value = config.severityCosts[severity];
    if (!Number.isSafeInteger(value) || value < 0) errors.push(`severityCosts.${severity} must be a non-negative safe integer`);
  }
  if (config.recoveryFloor !== undefined && (!Number.isSafeInteger(config.recoveryFloor) || config.recoveryFloor < 0)) errors.push("recoveryFloor must be a non-negative safe integer");
  return freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateParkPeriodSummary(input: ParkPeriodSummary): string | null {
  if (!input.periodId || !Number.isSafeInteger(input.logicalTime) || input.logicalTime < 0) return "periodId and non-negative logicalTime are required";
  const values = [input.attendance, input.satisfaction, input.uptime, input.dinosaurHealth, input.completedJobs, input.lateJobs, input.failedJobs, input.closures];
  if (values.some((value) => !isInt(value) || value < 0)) return "settlement counts and metrics must be non-negative integers";
  if (input.satisfaction > 100 || input.uptime > 100 || input.dinosaurHealth > 100) return "satisfaction, uptime, and dinosaurHealth must be in the range 0..100";
  if (!Array.isArray(input.incidents)) return "incidents must be an array";
  if (input.contextUse && (!isInt(input.contextUse.contextUnits) || input.contextUse.contextUnits < 0 || (input.contextUse.jobs !== undefined && (!isInt(input.contextUse.jobs) || input.contextUse.jobs < 0)))) {
    return "context use must contain non-negative integers";
  }
  for (const incident of input.incidents) {
    if (!incident.id || !isInt(incident.severity) || incident.severity < 0 || incident.severity > 4) return "incidents must have stable ids and severity 0..4";
  }
  return null;
}

export function validateSettlementProducts(input: ParkPeriodSummary, configInput: Partial<SettlementConfig> = {}): string | null {
  const inputError = validateParkPeriodSummary(input);
  if (inputError) return inputError;
  const configValidation = validateSettlementConfig(configInput);
  if (!configValidation.valid) return configValidation.errors.join("; ");
  const config = mergedConfig(configInput);
  const products = [
    input.attendance * config.attendanceCredits,
    input.satisfaction * config.satisfactionCreditsPerPoint,
    input.uptime * config.uptimeCreditsPerPoint,
    input.dinosaurHealth * config.dinosaurHealthCreditsPerPoint,
    input.completedJobs * config.completedJobCredits,
    input.lateJobs * config.lateJobCost,
    input.failedJobs * config.failedJobCost,
    input.closures * config.closureCost,
    (input.contextUse?.contextUnits ?? 0) * config.contextUnitCost,
    ...input.incidents.map((incident) => config.severityCosts[incident.severity]),
  ];
  if (products.some((value) => !Number.isSafeInteger(value) || value < 0)) return "settlement line-item products must be non-negative safe integers";
  const signed = [products[0]!, products[1]!, products[2]!, products[3]!, products[4]!, -products[5]!, -products[6]!, -products[7]!, -products[8]!, ...products.slice(9).map((value) => -value)];
  let total = 0;
  for (const value of signed) {
    total += value;
    if (!Number.isSafeInteger(total)) return "settlement net amount must remain a safe integer";
  }
  return null;
}

function item(
  id: string,
  label: string,
  category: SettlementLineItem["category"],
  amount: number,
  sourceRef: string,
  details?: Readonly<Record<string, number | string>>,
): SettlementLineItem {
  return freeze({ id, label, category, amount, sourceRef, ...(details ? { details: freeze({ ...details }) } : {}) });
}

function incidentItems(input: ParkPeriodSummary, config: SettlementConfig): readonly SettlementLineItem[] {
  return [...input.incidents]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((incident: IncidentSummary) => item(
      `incident.${incident.id}`,
      `Severity ${incident.severity} incident: ${incident.id}`,
      "COST",
      -Math.max(0, config.severityCosts[incident.severity]),
      `incident:${incident.id}`,
      { severity: incident.severity },
    ));
}

/** Converts an immutable operational period summary into deterministic ledger lines. */
export function calculateSettlement(input: ParkPeriodSummary, configInput: Partial<SettlementConfig> = {}): {
  readonly lineItems: readonly SettlementLineItem[];
  readonly netAmount: number;
} {
  const productError = validateSettlementProducts(input, configInput);
  if (productError) throw new RangeError(productError);
  const config = mergedConfig(configInput);
  const source = `period:${input.periodId}`;
  const lines: SettlementLineItem[] = [
    item("revenue.attendance", "Attendance revenue", "REVENUE", input.attendance * config.attendanceCredits, source, { attendance: input.attendance }),
    item("revenue.satisfaction", "Visitor satisfaction", "REVENUE", input.satisfaction * config.satisfactionCreditsPerPoint, source, { satisfaction: input.satisfaction }),
    item("revenue.uptime", "Operational uptime", "REVENUE", input.uptime * config.uptimeCreditsPerPoint, source, { uptime: input.uptime }),
    item("revenue.dinosaur-health", "Dinosaur health", "REVENUE", input.dinosaurHealth * config.dinosaurHealthCreditsPerPoint, source, { dinosaurHealth: input.dinosaurHealth }),
    item("revenue.completed-jobs", "Completed jobs", "REVENUE", input.completedJobs * config.completedJobCredits, source, { completedJobs: input.completedJobs }),
    item("cost.late-jobs", "Late jobs", "COST", -input.lateJobs * config.lateJobCost, source, { lateJobs: input.lateJobs }),
    item("cost.failed-jobs", "Failed jobs", "COST", -input.failedJobs * config.failedJobCost, source, { failedJobs: input.failedJobs }),
    item("cost.closures", "Temporary closures", "COST", -input.closures * config.closureCost, source, { closures: input.closures }),
    ...(input.contextUse ? [item("cost.context", "Context operating cost", "COST", -input.contextUse.contextUnits * config.contextUnitCost, source, { contextUnits: input.contextUse.contextUnits })] : []),
    ...incidentItems(input, config),
  ];
  return freeze({ lineItems: Object.freeze(lines), netAmount: lines.reduce((sum, line) => sum + line.amount, 0) });
}

export interface SettlementEngine {
  readonly settle: (input: ParkPeriodSummary) => SettlementResult;
  readonly config: () => SettlementConfig;
  readonly resultFor: (periodId: string) => SettlementResult | undefined;
}

export function createSettlementEngine(ledger: CreditLedger, configInput: Partial<SettlementConfig> = {}): SettlementEngine {
  const configValidation = validateSettlementConfig(configInput);
  if (!configValidation.valid) throw new Error(`Invalid settlement config: ${configValidation.errors.join("; ")}`);
  const config = mergedConfig(configInput);
  const settled = new Map<string, SettlementResult>();

  function settle(input: ParkPeriodSummary): SettlementResult {
    const previous = settled.get(input.periodId);
    if (previous) return freeze({ ...previous, duplicate: true });
    const invalid = validateParkPeriodSummary(input);
    if (invalid) {
      const result: SettlementResult = freeze({
        ok: false,
        periodId: input.periodId,
        balance: ledger.balance(),
        lineItems: Object.freeze([]),
        netAmount: 0,
        transactionIds: Object.freeze([]),
        error: freeze({ code: "INVALID_COMMAND", message: invalid }),
      });
      settled.set(input.periodId, result);
      return result;
    }

    const unsafeProducts = validateSettlementProducts(input, config);
    if (unsafeProducts) {
      const result: SettlementResult = freeze({
        ok: false,
        periodId: input.periodId,
        balance: ledger.balance(),
        lineItems: Object.freeze([]),
        netAmount: 0,
        transactionIds: Object.freeze([]),
        error: freeze({ code: "INVALID_COMMAND", message: unsafeProducts }),
      });
      settled.set(input.periodId, result);
      return result;
    }

    const calculated = calculateSettlement(input, config);
    // A period is committed as one ledger transaction so an overdrawn period
    // cannot leave revenue lines committed while cost lines are rejected.
    const result = ledger.transact({
      transactionId: `settlement:${input.periodId}`,
      correlationKey: `settlement:${input.periodId}`,
      type: calculated.netAmount >= 0 ? "SETTLEMENT_REVENUE" : "SETTLEMENT_COST",
      amount: calculated.netAmount,
      logicalTime: input.logicalTime,
      sourceRef: `period:${input.periodId}`,
      expectedBalanceVersion: ledger.balance().version,
    });
    if (!result.ok) {
      const failed: SettlementResult = freeze({
        ok: false,
        periodId: input.periodId,
        balance: result.balance,
        lineItems: calculated.lineItems,
        netAmount: calculated.netAmount,
        transactionIds: Object.freeze([]),
        error: result.error,
      });
      settled.set(input.periodId, failed);
      return failed;
    }
    const success: SettlementResult = freeze({
      ok: true,
      periodId: input.periodId,
      balance: result.balance,
      lineItems: calculated.lineItems,
      netAmount: calculated.netAmount,
      transactionIds: Object.freeze([result.entry.id]),
    });
    settled.set(input.periodId, success);
    return success;
  }

  return Object.freeze({ settle, config: () => config, resultFor: (periodId: string) => settled.get(periodId) });
}

export const SAFE_PARK_PERIOD: ParkPeriodSummary = Object.freeze({
  periodId: "fixture.period.safe",
  logicalTime: 86_400,
  attendance: 120,
  satisfaction: 92,
  uptime: 99,
  dinosaurHealth: 96,
  completedJobs: 8,
  lateJobs: 0,
  failedJobs: 0,
  closures: 0,
  incidents: Object.freeze([]),
  contextUse: Object.freeze({ contextUnits: 120 }),
});

export const LATE_PARK_PERIOD: ParkPeriodSummary = Object.freeze({
  periodId: "fixture.period.late",
  logicalTime: 172_800,
  attendance: 84,
  satisfaction: 61,
  uptime: 82,
  dinosaurHealth: 77,
  completedJobs: 4,
  lateJobs: 3,
  failedJobs: 1,
  closures: 1,
  incidents: Object.freeze([]),
  contextUse: Object.freeze({ contextUnits: 310 }),
});

export const INCIDENT_PARK_PERIOD: ParkPeriodSummary = Object.freeze({
  periodId: "fixture.period.incident",
  logicalTime: 259_200,
  attendance: 40,
  satisfaction: 30,
  uptime: 55,
  dinosaurHealth: 65,
  completedJobs: 2,
  lateJobs: 2,
  failedJobs: 2,
  closures: 3,
  incidents: Object.freeze([
    Object.freeze({ id: "incident.near-miss", severity: 2 as const, status: "CONTAINED" as const }),
    Object.freeze({ id: "incident.escape", severity: 3 as const, status: "RECOVERED" as const }),
  ]),
  contextUse: Object.freeze({ contextUnits: 250 }),
});
