import type { AutosaveScheduler, SaveResult, SaveService } from "./types.ts";

export interface AutosaveOptions {
  readonly intervalSeconds?: number;
  readonly slot?: "auto";
  readonly onStatus?: (status: ReturnType<AutosaveScheduler["status"]>) => void;
}

/** Coalescing logical-time scheduler. At most one save is in flight, and a
 * burst of major events results in one follow-up snapshot. */
export function createAutosaveScheduler(service: SaveService, options: AutosaveOptions = {}): AutosaveScheduler {
  const interval = Math.max(1, Math.trunc(options.intervalSeconds ?? 60));
  const slot = options.slot ?? "auto";
  let pending = false;
  let writing = false;
  let disposed = false;
  let requestedReason: string | undefined;
  let lastLogicalTime: number | undefined;
  let nextPeriodicTime = interval;
  let lastReason: string | undefined;
  let lastResult: SaveResult | undefined;
  let inFlight: Promise<SaveResult | undefined> | undefined;
  // Requests that arrive after a write starts belong to the next generation.
  // Keeping generations separate is important: a queued request must observe
  // the result of its follow-up save, not the write already in flight.
  let currentWaiters: Array<(result: SaveResult | undefined) => void> = [];
  let queuedWaiters: Array<(result: SaveResult | undefined) => void> = [];

  const notify = () => options.onStatus?.(status());
  function status() { return Object.freeze({ pending, writing, ...(lastLogicalTime === undefined ? {} : { lastLogicalTime }), ...(lastReason ? { lastReason } : {}), ...(lastResult ? { lastResult } : {}) }); }
  async function flush(): Promise<SaveResult | undefined> {
    if (disposed) return undefined;
    if (writing) return inFlight;
    if (!pending) return lastResult;
    pending = false; writing = true;
    const batchWaiters = currentWaiters;
    currentWaiters = [];
    const batchReason = requestedReason;
    requestedReason = undefined;
    notify();
    inFlight = service.save(slot).then((result) => {
      lastResult = result;
      lastReason = batchReason;
      batchWaiters.forEach((listener) => listener(result));
      return result;
    }).finally(() => {
      writing = false;
      inFlight = undefined;
      notify();
      if (pending && !disposed) {
        currentWaiters = queuedWaiters;
        queuedWaiters = [];
        void flush();
      }
    });
    return inFlight;
  }
  function request(reason = "periodic"): Promise<SaveResult> {
    if (disposed) return Promise.resolve({ ok: false, slot, error: { code: "STORAGE_UNAVAILABLE", message: "Autosave scheduler is disposed." } });
    pending = true; requestedReason = requestedReason ? `${requestedReason},${reason}` : reason; notify();
    const result = new Promise<SaveResult | undefined>((resolve) => (writing ? queuedWaiters : currentWaiters).push(resolve));
    void flush();
    return result.then((value) => value ?? { ok: false, slot, error: { code: "STORAGE_UNAVAILABLE", message: "Autosave did not run." } });
  }
  async function onLogicalTime(logicalTime: number): Promise<SaveResult | undefined> {
    lastLogicalTime = logicalTime;
    if (logicalTime < nextPeriodicTime) return undefined;
    while (nextPeriodicTime <= logicalTime) nextPeriodicTime += interval;
    return request("periodic");
  }
  function onMajorEvent(event: string, logicalTime?: number): Promise<SaveResult> { if (logicalTime !== undefined) lastLogicalTime = logicalTime; return request(`major:${event}`); }
  return Object.freeze({ request, onLogicalTime, onMajorEvent, flush, status, dispose: () => {
    disposed = true;
    pending = false;
    const result: SaveResult = { ok: false, slot, error: { code: "STORAGE_UNAVAILABLE", message: "Autosave scheduler is disposed." } };
    [...currentWaiters, ...queuedWaiters].forEach((listener) => listener(result));
    currentWaiters = [];
    queuedWaiters = [];
    notify();
  } });
}

export const createAutosaveService = createAutosaveScheduler;
