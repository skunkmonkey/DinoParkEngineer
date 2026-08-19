import { cloneJsonValue, isJsonValue, type JsonValue } from "./serializable";

export const PERSISTENCE_DIAGNOSTIC_CODES = {
  INVALID_KEY: "SHELL_PERSISTENCE_KEY_INVALID",
  INVALID_VALUE: "SHELL_PERSISTENCE_VALUE_INVALID",
  CHECKPOINT_UNSAFE: "SHELL_PERSISTENCE_CHECKPOINT_UNSAFE",
  CHECKPOINT_FAILED: "SHELL_PERSISTENCE_CHECKPOINT_FAILED",
} as const;

export interface PersistenceCheckpointRequest {
  readonly reason: string;
  readonly confirmNoMutableSessionState?: boolean;
}

export interface PersistenceCheckpoint {
  readonly safe: boolean;
  readonly checkpointId?: string;
  readonly sequence: number;
  readonly mutableSessionStatePending: boolean;
  readonly diagnosticCode?: string;
}

export interface PersistenceWriteResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly sequence: number;
}

export interface PersistencePort {
  readonly read: (key: string) => Promise<JsonValue | undefined>;
  readonly write: (key: string, value: JsonValue) => Promise<PersistenceWriteResult>;
  readonly remove: (key: string) => Promise<PersistenceWriteResult>;
  readonly requestSafeCheckpoint: (
    request: PersistenceCheckpointRequest,
  ) => Promise<PersistenceCheckpoint>;
  readonly getCheckpoint: () => PersistenceCheckpoint;
  /** Mark state that is not represented by a persisted key (for example, a live session). */
  readonly markMutableSessionStatePending: (pending: boolean) => void;
}

export interface MemoryPersistenceOptions {
  readonly initialEntries?: Readonly<Record<string, JsonValue>>;
  readonly rejectCheckpoints?: boolean;
}

export function createMemoryPersistencePort(
  options: MemoryPersistenceOptions = {},
): PersistencePort {
  const entries = new Map<string, JsonValue>();
  Object.entries(options.initialEntries ?? {}).forEach(([key, value]) => {
    if (key.length > 0 && isJsonValue(value)) {
      entries.set(key, cloneJsonValue(value));
    }
  });

  let sequence = 0;
  let mutableSessionStatePending = false;
  let checkpoint: PersistenceCheckpoint = Object.freeze({
    safe: false,
    sequence: 0,
    mutableSessionStatePending: false,
    diagnosticCode: PERSISTENCE_DIAGNOSTIC_CODES.CHECKPOINT_UNSAFE,
  });

  const validateKey = (key: string): string | undefined => {
    const normalized = key.trim();
    return normalized.length > 0 ? normalized : undefined;
  };

  const read = async (key: string): Promise<JsonValue | undefined> => {
    const normalized = validateKey(key);
    if (normalized === undefined) {
      return undefined;
    }

    const value = entries.get(normalized);
    return value === undefined ? undefined : cloneJsonValue(value);
  };

  const write = async (
    key: string,
    value: JsonValue,
  ): Promise<PersistenceWriteResult> => {
    const normalized = validateKey(key);
    if (normalized === undefined) {
      return {
        ok: false,
        code: PERSISTENCE_DIAGNOSTIC_CODES.INVALID_KEY,
        sequence,
      };
    }

    if (!isJsonValue(value)) {
      return {
        ok: false,
        code: PERSISTENCE_DIAGNOSTIC_CODES.INVALID_VALUE,
        sequence,
      };
    }

    entries.set(normalized, cloneJsonValue(value));
    sequence += 1;
    return { ok: true, sequence };
  };

  const remove = async (key: string): Promise<PersistenceWriteResult> => {
    const normalized = validateKey(key);
    if (normalized === undefined) {
      return {
        ok: false,
        code: PERSISTENCE_DIAGNOSTIC_CODES.INVALID_KEY,
        sequence,
      };
    }

    entries.delete(normalized);
    sequence += 1;
    return { ok: true, sequence };
  };

  const requestSafeCheckpoint = async (
    request: PersistenceCheckpointRequest,
  ): Promise<PersistenceCheckpoint> => {
    const reason = request.reason.trim();
    if (reason.length === 0) {
      checkpoint = Object.freeze({
        safe: false,
        sequence,
        mutableSessionStatePending,
        diagnosticCode: PERSISTENCE_DIAGNOSTIC_CODES.CHECKPOINT_FAILED,
      });
      return checkpoint;
    }

    if (
      options.rejectCheckpoints === true ||
      (mutableSessionStatePending &&
        request.confirmNoMutableSessionState !== true)
    ) {
      checkpoint = Object.freeze({
        safe: false,
        sequence,
        mutableSessionStatePending,
        diagnosticCode:
          options.rejectCheckpoints === true
            ? PERSISTENCE_DIAGNOSTIC_CODES.CHECKPOINT_FAILED
            : PERSISTENCE_DIAGNOSTIC_CODES.CHECKPOINT_UNSAFE,
      });
      return checkpoint;
    }

    sequence += 1;
    checkpoint = Object.freeze({
      safe: true,
      checkpointId: `checkpoint-${String(sequence).padStart(6, "0")}`,
      sequence,
      mutableSessionStatePending,
    });
    return checkpoint;
  };

  return Object.freeze({
    read,
    write,
    remove,
    requestSafeCheckpoint,
    getCheckpoint: (): PersistenceCheckpoint => checkpoint,
    markMutableSessionStatePending: (pending: boolean): void => {
      mutableSessionStatePending = pending;
    },
  });
}

/** Placeholder name used by bootstrap while a browser storage adapter is absent. */
export const createPlaceholderPersistencePort = createMemoryPersistencePort;
