import type { PublicRuntimeConfig, Result, ShellMode } from "./types.ts";
import { normalizeShellError } from "./errors.ts";

export const DEFAULT_RUNTIME_CONFIG: PublicRuntimeConfig = Object.freeze({
  buildId: "local-shell",
  mode: "development",
  basePath: "/",
});

function isMode(value: unknown): value is ShellMode {
  return value === "development" || value === "test" || value === "production";
}

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

/** Validates only public configuration. Secrets are never accepted here. */
export function parseRuntimeConfig(
  raw: unknown,
): Result<PublicRuntimeConfig, ReturnType<typeof normalizeShellError>> {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: normalizeShellError(undefined, {
        category: "configuration",
        code: "CONFIG_MISSING",
        recoverable: false,
        summary: "Public runtime configuration is missing. Set buildId, mode, and basePath.",
      }),
    };
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.buildId !== "string" || candidate.buildId.trim() === "") {
    return {
      ok: false,
      error: normalizeShellError(undefined, {
        category: "configuration",
        code: "CONFIG_BUILD_ID_INVALID",
        recoverable: false,
        summary: "Public runtime configuration has an invalid build id.",
      }),
    };
  }
  if (!isMode(candidate.mode)) {
    return {
      ok: false,
      error: normalizeShellError(undefined, {
        category: "configuration",
        code: "CONFIG_MODE_INVALID",
        recoverable: false,
        summary: "Public runtime configuration has an invalid mode.",
      }),
    };
  }
  if (typeof candidate.basePath !== "string") {
    return {
      ok: false,
      error: normalizeShellError(undefined, {
        category: "configuration",
        code: "CONFIG_BASE_PATH_INVALID",
        recoverable: false,
        summary: "Public runtime configuration has an invalid base path.",
      }),
    };
  }

  return {
    ok: true,
    value: Object.freeze({
      buildId: candidate.buildId.trim(),
      mode: candidate.mode,
      basePath: normalizeBasePath(candidate.basePath),
    }),
  };
}

export function getBrowserRuntimeConfig(): Result<PublicRuntimeConfig, ReturnType<typeof normalizeShellError>> {
  if (typeof window === "undefined") {
    return { ok: true, value: DEFAULT_RUNTIME_CONFIG };
  }

  const raw = (window as Window & {
    __DINO_PARK_RUNTIME_CONFIG__?: unknown;
  }).__DINO_PARK_RUNTIME_CONFIG__;
  return parseRuntimeConfig(raw ?? DEFAULT_RUNTIME_CONFIG);
}
