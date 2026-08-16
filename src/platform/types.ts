import type { ReactNode } from "react";

export type PrimaryDestination =
  | "park"
  | "agents"
  | "engineering"
  | "evals"
  | "reviews"
  | "progress";

export interface PrimaryDestinationPresentation {
  readonly id: PrimaryDestination;
  readonly routeId: string;
  readonly path: string;
  readonly label: string;
  readonly iconLabel: string;
  readonly order: number;
}

export interface SimulationState {
  readonly paused: boolean;
  readonly speed: 1 | 2 | 4;
}

export interface SimulationControlPort {
  getState(): SimulationState;
  setPaused(paused: boolean): Promise<void> | void;
  setSpeed(speed: 1 | 2 | 4): Promise<void> | void;
  subscribe(listener: () => void): () => void;
}

export interface Command {
  readonly id: string;
  readonly label: string;
  readonly run: () => void | Promise<void>;
}

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface NotificationMessage {
  readonly id: string;
  readonly level: NotificationLevel;
  readonly title: string;
  readonly detail?: string;
  readonly action?: Command;
}

export interface NotificationPort {
  publish(message: NotificationMessage): void;
}

export interface PresentationRegistry extends NotificationPort {
  getSimulationControlPort(): SimulationControlPort | null;
  setSimulationControlPort(port: SimulationControlPort | null): void;
  getNotifications(): readonly NotificationMessage[];
  subscribe(listener: () => void): () => void;
}

export interface PanelProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly eyebrow?: string;
  readonly className?: string;
}
