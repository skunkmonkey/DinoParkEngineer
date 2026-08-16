import type { SimulationControlPort, SimulationState } from "./types.ts";

export function resolveSimulationPort(
  explicitPort: SimulationControlPort | null | undefined,
  registeredPort: SimulationControlPort | null,
): SimulationControlPort | null {
  return explicitPort === undefined ? registeredPort : explicitPort;
}

export type SimulationRequestResult =
  | { readonly ok: true; readonly state: SimulationState }
  | { readonly ok: false; readonly state: SimulationState; readonly message: string };

export async function executeSimulationRequest(
  port: SimulationControlPort,
  action: () => Promise<void> | void,
): Promise<SimulationRequestResult> {
  const before = port.getState();
  try {
    await action();
    return { ok: true, state: port.getState() };
  } catch {
    let confirmed = before;
    try {
      confirmed = port.getState();
    } catch {
      // Preserve the last confirmed snapshot if the provider cannot be queried.
    }
    return {
      ok: false,
      state: confirmed,
      message: "The simulation provider rejected this request. Confirmed state was restored.",
    };
  }
}
