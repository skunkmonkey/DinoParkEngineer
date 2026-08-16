import type { PrimaryDestination, PrimaryDestinationPresentation } from "./types.ts";
import { FOUNDATION_ROUTE_DEFINITIONS } from "./contract.ts";

export const PRIMARY_DESTINATIONS = FOUNDATION_ROUTE_DEFINITIONS;

export function destinationForRoute(routeId: string): PrimaryDestinationPresentation {
  return PRIMARY_DESTINATIONS.find((destination) => destination.routeId === routeId) ?? PRIMARY_DESTINATIONS[0]!;
}

export function destinationById(id: PrimaryDestination): PrimaryDestinationPresentation {
  return PRIMARY_DESTINATIONS.find((destination) => destination.id === id) ?? PRIMARY_DESTINATIONS[0]!;
}
