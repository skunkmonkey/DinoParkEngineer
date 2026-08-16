import type {
  NotificationMessage,
  PresentationRegistry,
  SimulationControlPort,
} from "./types.ts";

export function createPresentationRegistry(): PresentationRegistry {
  let simulationControlPort: SimulationControlPort | null = null;
  let notifications: readonly NotificationMessage[] = Object.freeze([]);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    publish(message) {
      notifications = Object.freeze([
        message,
        ...notifications.filter((current) => current.id !== message.id),
      ].slice(0, 6));
      notify();
    },
    getSimulationControlPort: () => simulationControlPort,
    setSimulationControlPort(port) {
      simulationControlPort = port;
      notify();
    },
    getNotifications: () => notifications,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let activePresentationRegistry: PresentationRegistry | null = null;

export function setActivePresentationRegistry(registry: PresentationRegistry | null): void {
  activePresentationRegistry = registry;
}

export function getActivePresentationRegistry(): PresentationRegistry | null {
  return activePresentationRegistry;
}
