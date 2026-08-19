import {
  cloneJsonRecord,
  compareStrings,
  type JsonValue,
} from "./serializable";

export type DiagnosticSeverity = "info" | "warning" | "error" | "fatal";

export type DiagnosticScope =
  | "shell"
  | "configuration"
  | "provider"
  | "feature"
  | "route"
  | "offline-update"
  | "render";

export interface RecoveryAction {
  readonly id: string;
  readonly label: string;
}

export interface DiagnosticInput {
  readonly code: string;
  readonly scope: DiagnosticScope;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly recoveryActions?: readonly RecoveryAction[];
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export interface DiagnosticRecord extends DiagnosticInput {
  readonly sequence: number;
}

export interface DiagnosticsPort {
  readonly report: (input: DiagnosticInput) => DiagnosticRecord;
  readonly getAll: () => readonly DiagnosticRecord[];
  readonly getByCode: (code: string) => readonly DiagnosticRecord[];
  readonly clear: () => void;
}

export function createDiagnosticsPort(): DiagnosticsPort {
  let sequence = 0;
  let records: DiagnosticRecord[] = [];

  const report = (input: DiagnosticInput): DiagnosticRecord => {
    const recoveryActions = normalizeRecoveryActions(input.recoveryActions);
    const record: DiagnosticRecord = Object.freeze({
      code: input.code,
      scope: input.scope,
      severity: input.severity,
      message: input.message,
      recoveryActions,
      ...(input.details === undefined
        ? {}
        : { details: cloneJsonRecord(input.details) }),
      sequence: sequence + 1,
    });

    sequence += 1;
    records = [...records, record];
    return record;
  };

  return Object.freeze({
    report,
    getAll: (): readonly DiagnosticRecord[] => [...records],
    getByCode: (code: string): readonly DiagnosticRecord[] =>
      records.filter((record) => record.code === code),
    clear: (): void => {
      records = [];
    },
  });
}

function normalizeRecoveryActions(
  actions: readonly RecoveryAction[] | undefined,
): readonly RecoveryAction[] {
  if (actions === undefined) {
    return Object.freeze([]);
  }

  const unique = new Map<string, RecoveryAction>();
  actions.forEach((action) => {
    const id = action.id.trim();
    const label = action.label.trim();
    if (id.length > 0 && label.length > 0 && !unique.has(id)) {
      unique.set(id, Object.freeze({ id, label }));
    }
  });

  return Object.freeze(
    [...unique.values()].sort((left, right) => compareStrings(left.id, right.id)),
  );
}
