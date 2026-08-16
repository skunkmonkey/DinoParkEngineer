export type SemanticStatus = "passed" | "failed" | "stale" | "conflict" | "blocked";

export const STATUS_PRESENTATIONS = Object.freeze({
  passed: Object.freeze({ label: "Passed", symbol: "✓", tone: "success" as const }),
  failed: Object.freeze({ label: "Failed", symbol: "!", tone: "error" as const }),
  stale: Object.freeze({ label: "Stale", symbol: "↻", tone: "warning" as const }),
  conflict: Object.freeze({ label: "Conflict", symbol: "⇄", tone: "warning" as const }),
  blocked: Object.freeze({ label: "Blocked", symbol: "×", tone: "error" as const }),
});

export const SEVERITY_PRESENTATIONS = Object.freeze([
  Object.freeze({ label: "Info", symbol: "S0" }),
  Object.freeze({ label: "Service", symbol: "S1" }),
  Object.freeze({ label: "Near miss", symbol: "S2" }),
  Object.freeze({ label: "Incident", symbol: "S3" }),
  Object.freeze({ label: "Emergency", symbol: "S4" }),
] as const);
