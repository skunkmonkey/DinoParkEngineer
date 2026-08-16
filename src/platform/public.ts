/**
 * Public Platform Foundation entry point.
 *
 * Downstream features may consume presentation contracts and primitives from
 * this module. Foundation internals and shell runtime modules stay private.
 */
export { platformFoundationModule } from "./module.ts";
export { PRIMARY_DESTINATIONS, destinationById, destinationForRoute } from "./destinations.ts";
export { FOUNDATION_ROUTE_DEFINITIONS, createFoundationRouteRegistrations } from "./contract.ts";
export { createPresentationRegistry, getActivePresentationRegistry, setActivePresentationRegistry } from "./presentationRegistry.ts";
export { SimulationControls } from "./SimulationControls.tsx";
export { executeSimulationRequest, resolveSimulationPort, type SimulationRequestResult } from "./simulationControlModel.ts";
export { createFramedRouteRegistration, type FramedRouteRegistrationOptions } from "./framedRoute.ts";
export { resolveFramedRouteContent, type FramedRouteLoadResult } from "./framedRouteModel.ts";
export { CANONICAL_GLOSSARY } from "./glossary.ts";
export { useDisplayPreferences, DISPLAY_PREFERENCES_KEY } from "./preferences.ts";
export type {
  Command,
  NotificationLevel,
  NotificationMessage,
  NotificationPort,
  PanelProps,
  PresentationRegistry,
  PrimaryDestination,
  PrimaryDestinationPresentation,
  SimulationControlPort,
  SimulationState,
} from "./types.ts";
export { Panel, Tabs, TabPanel, Drawer, Dialog, DataTable, Meter, StatusBadge, SemanticStatusBadge, SeverityBadge, EmptyState, ErrorState, NotificationRegion } from "../ui/components.tsx";
export { nextTabIndex, trappedFocusIndex, type TabNavigationKey } from "../ui/interaction.ts";
export { invokeNotificationAction } from "../ui/notifications.ts";
export { STATUS_PRESENTATIONS, SEVERITY_PRESENTATIONS, type SemanticStatus } from "../ui/status.ts";
export { formatContextUnits, formatCredits, formatGameTime, formatSeverity, formatStableId } from "../shared/formatters/game.ts";
