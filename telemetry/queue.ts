import type {
  SanitizedTelemetryEvent,
  TelemetryDelivery,
  TelemetryQueueEntry,
  TelemetryQueueOptions,
  TelemetryQueueSnapshot,
} from "./types.ts";
import { isEssentialTelemetryEvent } from "./schema.ts";

const now = (): number => Date.now();

/**
 * Small in-memory outbox. `enqueue` is synchronous and never invokes a
 * delivery adapter; flushing is explicitly asynchronous and failure-contained.
 */
export class TelemetryQueue {
  private readonly maxItems: number;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly onDrop?: TelemetryQueueOptions["onDrop"];
  private readonly items: TelemetryQueueEntry[] = [];
  private readonly ids = new Set<string>();
  private droppedCount = 0;
  private flushing = false;

  public constructor(options: TelemetryQueueOptions = {}) {
    this.maxItems = Math.max(1, Math.floor(options.maxItems ?? options.maxSize ?? 500));
    this.batchSize = Math.max(1, Math.floor(options.batchSize ?? options.maxBatchSize ?? 25));
    this.maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 4));
    this.retryBaseMs = Math.max(0, Math.floor(options.retryBaseMs ?? options.retryBaseDelayMs ?? 250));
    this.onDrop = options.onDrop;
  }

  public enqueue(event: SanitizedTelemetryEvent): boolean {
    if (this.ids.has(event.eventId)) {
      this.onDrop?.(event, "DUPLICATE");
      return false;
    }
    if (this.items.length >= this.maxItems) {
      const dropIndex = this.items.findIndex((entry) => !isEssentialTelemetryEvent(entry.event.type));
      if (dropIndex >= 0) {
        const [dropped] = this.items.splice(dropIndex, 1);
        this.ids.delete(dropped.event.eventId);
        this.droppedCount += 1;
        this.onDrop?.(dropped.event, "BOUNDED");
      } else {
        // Preserve essential local diagnostics. The new optional item is the
        // only safe candidate to drop when every slot is essential.
        this.droppedCount += 1;
        this.onDrop?.(event, "BOUNDED");
        return false;
      }
    }
    this.items.push(Object.freeze({ event, attempts: 0, nextAttemptAt: 0 }));
    this.ids.add(event.eventId);
    return true;
  }

  public size(): number { return this.items.length; }
  public pending(): readonly SanitizedTelemetryEvent[] { return Object.freeze(this.items.map((entry) => entry.event)); }
  public snapshot(): TelemetryQueueSnapshot {
    return Object.freeze({ entries: Object.freeze(this.items.map((entry) => Object.freeze({ ...entry }))), droppedCount: this.droppedCount, inFlight: this.flushing });
  }
  public clear(): void { this.items.length = 0; this.ids.clear(); }
  /** Remove optional analytics while preserving essential local diagnostics. */
  public clearOptional(): void {
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      if (isEssentialTelemetryEvent(this.items[index].event.type)) continue;
      this.ids.delete(this.items[index].event.eventId);
      this.items.splice(index, 1);
    }
  }

  /**
   * Deliver one or more batches. Adapter errors and malformed responses are
   * treated as an offline attempt. Entries remain bounded and retry later.
   */
  public async flush(delivery: TelemetryDelivery, at = now()): Promise<{ readonly acceptedIds: readonly string[]; readonly failed: number }> {
    if (this.flushing || this.items.length === 0) return Object.freeze({ acceptedIds: Object.freeze([]), failed: 0 });
    this.flushing = true;
    const accepted: string[] = [];
    let failed = 0;
    try {
      const eligible = this.items.filter((entry) => entry.nextAttemptAt <= at).slice(0, this.batchSize);
      if (eligible.length === 0) return Object.freeze({ acceptedIds: Object.freeze([]), failed: 0 });
      let acceptedIds: readonly string[] = [];
      try {
        const response = await delivery.send(Object.freeze(eligible.map((entry) => entry.event)));
        acceptedIds = Array.isArray(response?.acceptedIds) ? response.acceptedIds.filter((id): id is string => typeof id === "string") : [];
      } catch {
        acceptedIds = [];
      }
      const acceptedSet = new Set(acceptedIds);
      for (const entry of eligible) {
        const index = this.items.indexOf(entry);
        if (index < 0) continue;
        if (acceptedSet.has(entry.event.eventId)) {
          this.items.splice(index, 1);
          this.ids.delete(entry.event.eventId);
          accepted.push(entry.event.eventId);
          continue;
        }
        failed += 1;
        const attempts = entry.attempts + 1;
        if (attempts > this.maxRetries) {
          this.items.splice(index, 1);
          this.ids.delete(entry.event.eventId);
          this.droppedCount += 1;
          this.onDrop?.(entry.event, "BOUNDED");
        } else {
          this.items[index] = Object.freeze({ event: entry.event, attempts, nextAttemptAt: at + this.retryBaseMs * Math.max(1, 2 ** (attempts - 1)) });
        }
      }
      return Object.freeze({ acceptedIds: Object.freeze(accepted), failed });
    } finally {
      this.flushing = false;
    }
  }
}

export function createTelemetryQueue(options?: TelemetryQueueOptions): TelemetryQueue {
  return new TelemetryQueue(options);
}
