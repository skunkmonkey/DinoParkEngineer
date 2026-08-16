"use client";

import { useCallback, useReducer, useState, useSyncExternalStore } from "react";
import { getActivePresentationRegistry } from "./presentationRegistry.ts";
import type { SimulationControlPort } from "./types.ts";
import { StatusBadge } from "../ui/components.tsx";
import { executeSimulationRequest, resolveSimulationPort } from "./simulationControlModel.ts";

const subscribeUnavailable = () => () => undefined;
const unavailableSnapshot = () => null;

function useResolvedSimulationPort(explicitPort: SimulationControlPort | null | undefined): SimulationControlPort | null {
  const registry = getActivePresentationRegistry();
  const subscribe = useCallback((listener: () => void) => registry?.subscribe(listener) ?? subscribeUnavailable(), [registry]);
  const getSnapshot = useCallback(() => registry?.getSimulationControlPort() ?? null, [registry]);
  const registeredPort = useSyncExternalStore(subscribe, getSnapshot, unavailableSnapshot);
  return resolveSimulationPort(explicitPort, registeredPort);
}

function useSimulationSnapshot(port: SimulationControlPort | null): string | null {
  const subscribe = useCallback((listener: () => void) => port?.subscribe(listener) ?? subscribeUnavailable(), [port]);
  const getSnapshot = useCallback(() => {
    if (!port) return null;
    const state = port.getState();
    return `${state.paused ? "paused" : "running"}:${state.speed}`;
  }, [port]);
  return useSyncExternalStore(subscribe, getSnapshot, unavailableSnapshot);
}

export function SimulationControls({ port: explicitPort }: { readonly port?: SimulationControlPort | null }) {
  const port = useResolvedSimulationPort(explicitPort);
  const snapshot = useSimulationSnapshot(port);
  const [, forceRender] = useReducer((version: number) => version + 1, 0);
  const [pending, setPending] = useState<{ readonly port: SimulationControlPort; readonly label: string } | null>(null);
  const [failure, setFailure] = useState<{ readonly port: SimulationControlPort; readonly message: string } | null>(null);
  const state = port && snapshot ? port.getState() : null;
  const pendingLabel = pending?.port === port ? pending.label : null;

  const request = async (label: string, action: () => Promise<void> | void) => {
    if (!port || pendingLabel) return;
    setPending({ port, label });
    const result = await executeSimulationRequest(port, action);
    setFailure(result.ok ? null : { port, message: result.message });
    forceRender();
    setPending((current) => current?.port === port ? null : current);
  };

  if (!port || !state) {
    return (
      <div className="foundation-controls" aria-label="Simulation controls">
        <div className="foundation-controls__heading"><p className="foundation-eyebrow">Simulation</p><StatusBadge label="Unavailable" status="warning" /></div>
        <p className="foundation-controls__unavailable">A simulation provider will expose pause and speed controls when Park Operations is connected.</p>
      </div>
    );
  }

  return (
    <div className="foundation-controls" aria-label="Simulation controls">
      <div className="foundation-controls__heading"><p className="foundation-eyebrow">Simulation</p><StatusBadge label={pendingLabel ? `Requesting ${pendingLabel}` : state.paused ? "Confirmed paused" : `Confirmed ${state.speed}x`} status={pendingLabel ? "pending" : "success"} /></div>
      <div className="foundation-controls__buttons">
        <button type="button" className={state.paused ? "is-selected" : ""} aria-pressed={state.paused} disabled={Boolean(pendingLabel)} onClick={() => void request("pause", () => port.setPaused(true))}>Pause</button>
        <button type="button" className={!state.paused && state.speed === 1 ? "is-selected" : ""} aria-pressed={!state.paused && state.speed === 1} disabled={Boolean(pendingLabel)} onClick={() => void request("1x", async () => { await port.setPaused(false); await port.setSpeed(1); })}>1x</button>
        <button type="button" className={!state.paused && state.speed === 2 ? "is-selected" : ""} aria-pressed={!state.paused && state.speed === 2} disabled={Boolean(pendingLabel)} onClick={() => void request("2x", async () => { await port.setPaused(false); await port.setSpeed(2); })}>2x</button>
        <button type="button" className={!state.paused && state.speed === 4 ? "is-selected" : ""} aria-pressed={!state.paused && state.speed === 4} disabled={Boolean(pendingLabel)} onClick={() => void request("4x", async () => { await port.setPaused(false); await port.setSpeed(4); })}>4x</button>
      </div>
      {failure?.port === port ? <p className="foundation-controls__error" role="alert">{failure.message}</p> : null}
      <p className="foundation-controls__hint">Controls request state from the simulation provider. The frame never advances logical time.</p>
    </div>
  );
}
