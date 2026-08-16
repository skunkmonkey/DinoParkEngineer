import type { SimulationControlPort } from "../platform/public.ts";
import { getActivePresentationRegistry } from "../platform/public.ts";
import { getActiveTraceReplayRuntime } from "../trace-replay/public.ts";
import { createOperationsContentPack, createParkOperationsService, DEFAULT_OPERATIONS_ARTIFACTS, type ParkOperationsService } from "../../park-operations/index.ts";
import type { ArtifactRef, ContentRegistry } from "../../content-registry/index.ts";
import type { ContextService } from "../../context/index.ts";

let activeService: ParkOperationsService | null = null;
let activeControlPort: SimulationControlPort | null = null;

export interface ParkOperationsProviderOptions {
  readonly resolveActiveRef?: (artifactId: string) => ArtifactRef | undefined;
}

export function createParkOperationsProvider(options: ParkOperationsProviderOptions = {}): ParkOperationsService {
  const traces = getActiveTraceReplayRuntime();
  const content = traces?.content as ContentRegistry | undefined;
  const context = traces?.context as ContextService | undefined;
  if (content && !content.getArtifact(DEFAULT_OPERATIONS_ARTIFACTS.promptRef)) {
    const loaded = content.loadPack(createOperationsContentPack());
    if (!loaded.ok) throw new Error(`Park Operations shared content failed validation: ${loaded.error.map((item) => item.message).join("; ")}`);
  }
  const service = createParkOperationsService({ traces: traces?.repository, content, context, resolveActiveRef: options.resolveActiveRef });
  activeService = service;
  const port: SimulationControlPort = {
    getState: () => service.getControlState(),
    setPaused: (paused) => service.setPaused(paused),
    setSpeed: (speed) => service.setSpeed(speed),
    subscribe: (listener) => service.subscribe(listener),
  };
  activeControlPort = port;
  getActivePresentationRegistry()?.setSimulationControlPort(port);
  return service;
}

export function getActiveParkOperationsService(): ParkOperationsService | null {
  return activeService;
}

export function getActiveParkOperationsControlPort(): SimulationControlPort | null {
  return activeControlPort;
}

export function setActiveParkOperationsService(service: ParkOperationsService | null): void {
  if (!service && activeControlPort) getActivePresentationRegistry()?.setSimulationControlPort(null);
  activeService = service;
  activeControlPort = service ? {
    getState: () => service.getControlState(),
    setPaused: (paused) => service.setPaused(paused),
    setSpeed: (speed) => service.setSpeed(speed),
    subscribe: (listener) => service.subscribe(listener),
  } : null;
}
