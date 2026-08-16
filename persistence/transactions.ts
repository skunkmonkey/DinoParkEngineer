import { deepClone } from "./canonical.ts";
import type { SaveError, TransactionCoordinator, TransactionParticipant, TransactionResult } from "./types.ts";

function transactionError(code: SaveError["code"], message: string, phase?: string): SaveError {
  return Object.freeze({ code, message, ...(phase ? { phase } : {}) });
}

function cloneCheckpoint(value: unknown): unknown {
  return value === undefined ? undefined : deepClone(value);
}

/** In-memory write-ahead transaction coordinator. Domain services remain
 * persistence-agnostic; participants expose optional checkpoint hooks. */
export function createTransactionCoordinator(): TransactionCoordinator {
  const committed = new Map<string, TransactionResult<unknown>>();
  const bindings = new Map<string, string>();
  const order = new Map<string, number>();
  let sequence = 0;

  async function execute<T>(transactionId: string, participants: readonly TransactionParticipant[], work: () => T | Promise<T>): Promise<TransactionResult<T>> {
    if (!transactionId || !transactionId.trim()) return { ok: false, transactionId, status: "ROLLED_BACK", error: transactionError("INVALID_VALUE", "A stable transaction id is required.") };
    const binding = participants.map((participant) => participant.id).sort().join("|");
    const priorBinding = bindings.get(transactionId);
    const prior = committed.get(transactionId);
    if (prior) {
      if (priorBinding !== binding) return { ok: false, transactionId, status: "ROLLED_BACK", error: transactionError("INVALID_VALUE", "Transaction id is already bound to different participants.") };
      return { ...prior as TransactionResult<T>, duplicate: true, status: "DUPLICATE" };
    }
    if (priorBinding && priorBinding !== binding) return { ok: false, transactionId, status: "ROLLED_BACK", error: transactionError("INVALID_VALUE", "Transaction id is already bound to different participants.") };
    if (new Set(participants.map((participant) => participant.id)).size !== participants.length) return { ok: false, transactionId, status: "ROLLED_BACK", error: transactionError("INVALID_VALUE", "Transaction participants must have unique ids.") };
    const unsupported = participants.find((participant) => {
      const canCheckpoint = typeof participant.snapshot === "function" || typeof participant.checkpoint === "function";
      const canRestore = typeof participant.restore === "function" || typeof participant.recover === "function";
      return !canCheckpoint || !canRestore;
    });
    if (unsupported) {
      return {
        ok: false,
        transactionId,
        status: "ROLLED_BACK",
        error: transactionError("INVALID_VALUE", `Transaction participant ${unsupported.id} must provide checkpoint and restore/recover hooks.`, "checkpoint"),
      };
    }
    bindings.set(transactionId, binding);
    const checkpoints = new Map<string, unknown>();
    for (const participant of participants) {
      try {
        const checkpoint = participant.snapshot ? participant.snapshot() : participant.checkpoint ? participant.checkpoint() : undefined;
        checkpoints.set(participant.id, cloneCheckpoint(checkpoint));
      } catch {
        const failed = { ok: false as const, transactionId, status: "ROLLED_BACK" as const, error: transactionError("WRITE_INTERRUPTED", `Participant ${participant.id} could not be checkpointed.`, "checkpoint") };
        committed.set(transactionId, failed); order.set(transactionId, sequence++); return failed as TransactionResult<T>;
      }
    }
    let phase = "prepare";
    try {
      for (const participant of participants) {
        const prepared = await participant.prepare?.(transactionId);
        if (prepared === false) throw new Error(`Participant ${participant.id} rejected prepare.`);
      }
      phase = "work";
      const value = await work();
      phase = "commit";
      for (const participant of participants) await participant.commit?.(transactionId);
      const result: TransactionResult<T> = { ok: true, transactionId, status: "COMMITTED", value };
      committed.set(transactionId, result as TransactionResult<unknown>); order.set(transactionId, sequence++);
      return result;
    } catch {
      let rollbackFailed = false;
      for (const participant of [...participants].reverse()) {
        try {
          if (checkpoints.has(participant.id)) {
            const checkpoint = checkpoints.get(participant.id);
            if (participant.restore) participant.restore(cloneCheckpoint(checkpoint));
            else participant.recover?.(cloneCheckpoint(checkpoint));
          }
          await participant.rollback?.(transactionId);
        } catch {
          rollbackFailed = true;
        }
      }
      const result: TransactionResult<T> = { ok: false, transactionId, status: rollbackFailed ? "RECOVERABLE" : "ROLLED_BACK", error: transactionError(rollbackFailed ? "ROLLBACK_FAILED" : "WRITE_INTERRUPTED", rollbackFailed ? "Transaction failed and rollback requires recovery." : `Transaction failed during ${phase}.`, phase) };
      committed.set(transactionId, result as TransactionResult<unknown>); order.set(transactionId, sequence++);
      return result;
    }
  }
  function recover(transactionId: string): TransactionResult<unknown> | undefined { return committed.get(transactionId); }
  return Object.freeze({ execute, run: execute, recover, results: () => Object.freeze([...committed.values()].sort((a, b) => (order.get(a.transactionId) ?? 0) - (order.get(b.transactionId) ?? 0))) });
}

export const createDurableTransactionCoordinator = createTransactionCoordinator;
