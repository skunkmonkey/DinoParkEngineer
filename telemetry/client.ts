import { isEssentialTelemetryEvent, validateTelemetryEvent, type TelemetryEventInput } from "./schema.ts";
import { TelemetryQueue } from "./queue.ts";
import {
  TELEMETRY_SCHEMA_VERSION,
  type SanitizedTelemetryEvent,
  type TelemetryClientOptions,
  type TelemetryContext,
  type TelemetryDelivery,
  type TelemetryDiagnosticsPort,
  type TelemetryEventType,
  type TelemetryPayloads,
} from "./types.ts";

let fallbackId = 0;

/** IDs are random and contain no user/device-derived input. */
export function createAnonymousId(prefix = "anon"): string {
  const safePrefix = /^[a-z][a-z0-9-]{0,31}$/.test(prefix) ? prefix : "anon";
  try {
    const randomUuid = globalThis.crypto?.randomUUID;
    if (typeof randomUuid === "function") return `${safePrefix}.${randomUuid()}`;
  } catch { /* use the local random fallback */ }
  const random = Math.random().toString(36).slice(2, 12);
  fallbackId += 1;
  return `${safePrefix}.${Date.now().toString(36)}.${fallbackId.toString(36)}.${random}`;
}

export const noopTelemetryDelivery: TelemetryDelivery = Object.freeze({
  send: async (batch: readonly SanitizedTelemetryEvent[]) => Object.freeze({ acceptedIds: Object.freeze(batch.map((event) => event.eventId)) }),
});

export class LocalTelemetryDelivery implements TelemetryDelivery {
  private readonly records: SanitizedTelemetryEvent[] = [];
  public async send(batch: readonly SanitizedTelemetryEvent[]): Promise<{ readonly acceptedIds: readonly string[] }> {
    for (const event of batch) {
      if (!this.records.some((existing) => existing.eventId === event.eventId)) this.records.push(event);
    }
    return Object.freeze({ acceptedIds: Object.freeze(batch.map((event) => event.eventId)) });
  }
  public events(): readonly SanitizedTelemetryEvent[] { return Object.freeze(this.records.slice()); }
  public clear(): void { this.records.length = 0; }
}

export function createLocalTelemetryDelivery(): LocalTelemetryDelivery { return new LocalTelemetryDelivery(); }
export function createNoopTelemetryDelivery(): TelemetryDelivery { return noopTelemetryDelivery; }

/** A zero-work port for environments that do not collect telemetry. */
export class NoopTelemetryClient implements TelemetryDiagnosticsPort {
  public emit<E extends TelemetryEventType>(type: E, payload: TelemetryPayloads[E], context?: Partial<TelemetryContext>): void { void type; void payload; void context; }
  public setOptionalEnabled(enabled: boolean): void { void enabled; }
  public isOptionalEnabled(): boolean { return false; }
  public inspectQueue() { return Object.freeze({ entries: Object.freeze([]), droppedCount: 0, inFlight: false }); }
  public clearQueue(): void { /* nothing is retained */ }
  public pendingEvents(): readonly SanitizedTelemetryEvent[] { return Object.freeze([]); }
  public subscribe(listener: () => void): () => void { void listener; return () => undefined; }
}

export class TelemetryClient implements TelemetryDiagnosticsPort {
  public readonly installationId: string;
  public readonly sessionId: string;
  public readonly queue: TelemetryQueue;
  public readonly delivery: TelemetryDelivery;
  private readonly appVersion: string;
  private readonly contentVersion: string;
  private readonly defaultPhaseId?: string;
  private readonly defaultScenarioId?: string;
  private readonly logicalTime: () => number;
  private optionalEnabled: boolean;
  private readonly listeners = new Set<() => void>();
  private drainScheduled = false;
  private drainTimer: ReturnType<typeof setTimeout> | undefined;
  private flushInFlight: Promise<{ readonly acceptedIds: readonly string[]; readonly failed: number }> | undefined;

  public constructor(options: TelemetryClientOptions = {}) {
    this.installationId = options.installationId ?? createAnonymousId("installation");
    this.sessionId = options.sessionId ?? createAnonymousId("session");
    this.appVersion = options.appVersion ?? "0.1.0";
    this.contentVersion = options.contentVersion ?? "0.1.0";
    this.defaultPhaseId = options.phaseId;
    this.defaultScenarioId = options.scenarioId;
    this.logicalTime = options.logicalTime ?? (() => 0);
    this.optionalEnabled = options.optionalEnabled ?? true;
    this.delivery = options.delivery ?? noopTelemetryDelivery;
    this.queue = new TelemetryQueue(options.queue);
  }

  /**
   * Synchronous producer boundary. Validation, construction, and enqueue do
   * not await or call the adapter, so a slow/throwing adapter cannot alter a
   * gameplay command's result.
   */
  public emit<E extends TelemetryEventType>(type: E, payload: TelemetryPayloads[E], context: Partial<TelemetryContext> = {}): void {
    try {
      if (!this.optionalEnabled && !isEssentialTelemetryEvent(type)) return;
      const input: TelemetryEventInput<E> = {
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        eventId: createAnonymousId("event"),
        installationId: context.installationId ?? this.installationId,
        sessionId: context.sessionId ?? this.sessionId,
        type,
        logicalTime: context.logicalTime ?? this.logicalTime(),
        appVersion: context.appVersion ?? this.appVersion,
        contentVersion: context.contentVersion ?? this.contentVersion,
        ...(context.phaseId ?? this.defaultPhaseId ? { phaseId: context.phaseId ?? this.defaultPhaseId } : {}),
        ...(context.scenarioId ?? this.defaultScenarioId ? { scenarioId: context.scenarioId ?? this.defaultScenarioId } : {}),
        category: isEssentialTelemetryEvent(type) ? "essential" : "analytics",
        payload,
      };
      const result = validateTelemetryEvent(input);
      if (!result.valid || !result.event) return;
      if (this.queue.enqueue(result.event)) {
        this.notify();
        this.scheduleDrain();
      }
    } catch {
      // Telemetry must be observational only. A malformed producer payload or
      // adapter setup can never escape into authoritative gameplay code.
    }
  }

  public setOptionalEnabled(enabled: boolean): void {
    this.optionalEnabled = Boolean(enabled);
    if (!this.optionalEnabled) this.queue.clearOptional();
    this.notify();
  }
  public isOptionalEnabled(): boolean { return this.optionalEnabled; }
  public setConsent(enabled: boolean): void { this.setOptionalEnabled(enabled); }
  public inspectQueue() { return this.queue.snapshot(); }
  public clearQueue(): void { this.queue.clear(); this.notify(); }
  public pendingEvents(): readonly SanitizedTelemetryEvent[] { return this.queue.pending(); }
  public subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  public flush(): Promise<{ readonly acceptedIds: readonly string[]; readonly failed: number }> {
    if (this.flushInFlight) return this.flushInFlight;
    const operation = this.queue.flush(this.delivery).catch(() => Object.freeze({ acceptedIds: Object.freeze([] as string[]), failed: 0 }));
    this.flushInFlight = operation;
    void operation.finally(() => {
      this.flushInFlight = undefined;
      this.notify();
      this.scheduleNextPending();
    });
    return operation;
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try { listener(); } catch { /* diagnostics listeners cannot affect collection */ }
    }
  }

  private scheduleDrain(delayMs = 0): void {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    const drain = () => {
      this.drainScheduled = false;
      this.drainTimer = undefined;
      void this.flush();
    };
    if (delayMs <= 0) queueMicrotask(drain);
    else {
      this.drainTimer = setTimeout(drain, delayMs);
      const timer = this.drainTimer as ReturnType<typeof setTimeout> & { unref?: () => void };
      timer.unref?.();
    }
  }

  private scheduleNextPending(): void {
    const entries = this.queue.snapshot().entries;
    if (entries.length === 0) return;
    const nextAttemptAt = Math.min(...entries.map((entry) => entry.nextAttemptAt));
    this.scheduleDrain(Math.max(0, nextAttemptAt - Date.now()));
  }
}

export function createTelemetryClient(options?: TelemetryClientOptions): TelemetryClient {
  return new TelemetryClient(options);
}

export function createNoopTelemetryClient(): NoopTelemetryClient {
  return new NoopTelemetryClient();
}

export function createLocalTelemetryClient(options: Omit<TelemetryClientOptions, "delivery"> = {}): TelemetryClient & { readonly local: LocalTelemetryDelivery } {
  const local = new LocalTelemetryDelivery();
  const client = new TelemetryClient({ ...options, delivery: local }) as TelemetryClient & { readonly local: LocalTelemetryDelivery };
  Object.defineProperty(client, "local", { value: local, enumerable: false });
  return client;
}

let activeTelemetryClient: TelemetryDiagnosticsPort | undefined;

/** Optional application-wide port. The safe default is a zero-work no-op. */
export function getActiveTelemetryClient(): TelemetryDiagnosticsPort {
  activeTelemetryClient ??= new NoopTelemetryClient();
  return activeTelemetryClient;
}

export function setActiveTelemetryClient(client: TelemetryDiagnosticsPort | undefined): void {
  activeTelemetryClient = client;
}
