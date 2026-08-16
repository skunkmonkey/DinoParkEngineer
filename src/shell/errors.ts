import type {
  FeatureId,
  RegistrationDiagnostic,
  RouteId,
  ShellError,
  ShellMode,
} from "./types.ts";

const SAFE_FALLBACKS: Record<ShellError["category"], string> = {
  configuration: "Application configuration is unavailable.",
  registration: "A feature registration is unavailable.",
  startup: "Application startup could not complete.",
  "route-load": "This route could not be loaded.",
  "route-render": "This route could not be rendered.",
  disposal: "A feature could not be stopped cleanly.",
};

export interface ErrorContext {
  readonly category: ShellError["category"];
  readonly code: string;
  readonly recoverable?: boolean;
  readonly featureId?: FeatureId;
  readonly routeId?: RouteId;
  readonly summary?: string;
  readonly mode?: ShellMode;
}

/** Converts arbitrary thrown values into safe, stable shell diagnostics. */
export function normalizeShellError(
  _thrown: unknown,
  context: ErrorContext,
): ShellError {
  const fallback = context.summary ?? SAFE_FALLBACKS[context.category];

  return Object.freeze({
    category: context.category,
    code: context.code,
    featureId: context.featureId,
    routeId: context.routeId,
    recoverable: context.recoverable ?? true,
    summary: fallback,
  });
}

export function diagnosticsToErrors(
  diagnostics: readonly RegistrationDiagnostic[],
  mode: ShellMode,
): readonly ShellError[] {
  return Object.freeze(
    diagnostics.map((diagnostic) =>
      normalizeShellError(undefined, {
        category: "registration",
        code: diagnostic.code,
        featureId: diagnostic.featureId,
        routeId: diagnostic.routeId,
        summary: diagnostic.summary,
        mode,
      }),
    ),
  );
}
