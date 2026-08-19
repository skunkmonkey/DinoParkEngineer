import {
  cloneJsonRecord,
  compareStrings,
  isJsonValue,
  type JsonValue,
} from "./serializable";

export const CONFIGURATION_DIAGNOSTIC_CODES = {
  INVALID_BASE_PATH: "SHELL_CONFIGURATION_BASE_PATH_INVALID",
  INVALID_BUILD_ID: "SHELL_CONFIGURATION_BUILD_ID_INVALID",
  INVALID_VALUE: "SHELL_CONFIGURATION_VALUE_INVALID",
} as const;

export interface ConfigurationSnapshot {
  readonly schemaVersion: number;
  readonly buildId: string;
  readonly basePath: string;
  readonly values: Readonly<Record<string, JsonValue>>;
}

export interface ConfigurationOptions {
  readonly schemaVersion?: number;
  readonly buildId: string;
  readonly basePath?: string;
  readonly values?: Readonly<Record<string, JsonValue>>;
}

/**
 * Configuration is intentionally a read-only port.  Bootstrap owns the
 * validated snapshot; UI and feature code can query it but cannot replace it
 * in place.
 */
export interface ConfigurationPort {
  readonly getSnapshot: () => ConfigurationSnapshot;
  readonly get: (key: string) => JsonValue | undefined;
}

export interface ConfigurationValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly field: string;
}

export type ConfigurationValidationResult =
  | { readonly ok: true; readonly snapshot: ConfigurationSnapshot }
  | {
      readonly ok: false;
      readonly issues: readonly ConfigurationValidationIssue[];
    };

export class ConfigurationValidationError extends Error {
  readonly issues: readonly ConfigurationValidationIssue[];

  constructor(issues: readonly ConfigurationValidationIssue[]) {
    super("Shell configuration is invalid.");
    this.name = "ConfigurationValidationError";
    this.issues = issues;
  }
}

export function validateConfiguration(
  options: ConfigurationOptions,
): ConfigurationValidationResult {
  const issues: ConfigurationValidationIssue[] = [];
  const buildId = options.buildId.trim();
  const basePath = normalizeBasePath(options.basePath ?? "/");

  if (buildId.length === 0) {
    issues.push({
      code: CONFIGURATION_DIAGNOSTIC_CODES.INVALID_BUILD_ID,
      field: "buildId",
      message: "Build ID must contain at least one non-whitespace character.",
    });
  }

  if (basePath === undefined) {
    issues.push({
      code: CONFIGURATION_DIAGNOSTIC_CODES.INVALID_BASE_PATH,
      field: "basePath",
      message: "Base path must be an absolute, slash-delimited path.",
    });
  }

  const values = options.values ?? {};
  Object.keys(values)
    .sort(compareStrings)
    .forEach((key) => {
      if (key.trim().length === 0 || !isJsonValue(values[key])) {
        issues.push({
          code: CONFIGURATION_DIAGNOSTIC_CODES.INVALID_VALUE,
          field: `values.${key}`,
          message: "Configuration values must be JSON-compatible.",
        });
      }
    });

  if (issues.length > 0 || basePath === undefined) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  const snapshot: ConfigurationSnapshot = Object.freeze({
    schemaVersion: options.schemaVersion ?? 1,
    buildId,
    basePath,
    values: cloneJsonRecord(values),
  });

  return { ok: true, snapshot };
}

export function createConfigurationPort(
  options: ConfigurationOptions,
): ConfigurationPort {
  const result = validateConfiguration(options);
  if (!result.ok) {
    throw new ConfigurationValidationError(result.issues);
  }

  const snapshot = result.snapshot;
  return Object.freeze({
    getSnapshot: (): ConfigurationSnapshot => snapshot,
    get: (key: string): JsonValue | undefined => snapshot.values[key],
  });
}

function normalizeBasePath(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !trimmed.startsWith("/")) {
    return undefined;
  }

  if (trimmed.includes("\\") || trimmed.includes("//")) {
    return undefined;
  }

  const withLeadingSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return withLeadingSlash;
}
