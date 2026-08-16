/** Public headless telemetry boundary. Gameplay features may emit summaries
 * through this package, but may not read queue state or delivery results. */
export * from "../../telemetry/index.ts";
export { TelemetryPrivacyPanel, type TelemetryPrivacyPanelProps } from "./TelemetryPrivacyPanel.tsx";
