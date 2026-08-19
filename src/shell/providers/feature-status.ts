import { compareStrings } from "./serializable";

export const FEATURE_STATUS_DIAGNOSTIC_CODES = {
  INVALID_ID: "SHELL_FEATURE_STATUS_ID_INVALID",
  DUPLICATE: "SHELL_FEATURE_STATUS_DUPLICATE",
  UNKNOWN: "SHELL_FEATURE_STATUS_UNKNOWN",
} as const;

export type FeatureRequirement = "required" | "optional";

export type FeatureLifecycleStatus =
  | "registered"
  | "loading"
  | "ready"
  | "degraded"
  | "failed"
  | "unavailable";

export interface FeatureStatusRecord {
  readonly featureId: string;
  readonly requirement: FeatureRequirement;
  readonly status: FeatureLifecycleStatus;
  readonly diagnosticCode?: string;
}

export interface FeatureRegistration {
  readonly featureId: string;
  readonly requirement: FeatureRequirement;
}

export type FeatureStatusResult =
  | { readonly ok: true; readonly record: FeatureStatusRecord }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
    };

export interface FeatureStatusPort {
  readonly register: (
    registration: FeatureRegistration,
  ) => FeatureStatusResult;
  readonly setStatus: (
    featureId: string,
    status: FeatureLifecycleStatus,
    diagnosticCode?: string,
  ) => FeatureStatusResult;
  readonly getSnapshot: () => readonly FeatureStatusRecord[];
  readonly get: (featureId: string) => FeatureStatusRecord | undefined;
}

export function createFeatureStatusPort(): FeatureStatusPort {
  const statuses = new Map<string, FeatureStatusRecord>();

  const register = (
    registration: FeatureRegistration,
  ): FeatureStatusResult => {
    const featureId = registration.featureId.trim();
    if (featureId.length === 0) {
      return {
        ok: false,
        code: FEATURE_STATUS_DIAGNOSTIC_CODES.INVALID_ID,
        message: "Feature ID must contain at least one non-whitespace character.",
      };
    }

    if (statuses.has(featureId)) {
      return {
        ok: false,
        code: FEATURE_STATUS_DIAGNOSTIC_CODES.DUPLICATE,
        message: `Feature ${featureId} is already registered.`,
      };
    }

    const record = Object.freeze({
      featureId,
      requirement: registration.requirement,
      status: "registered" as const,
    });
    statuses.set(featureId, record);
    return { ok: true, record };
  };

  const setStatus = (
    featureId: string,
    status: FeatureLifecycleStatus,
    diagnosticCode?: string,
  ): FeatureStatusResult => {
    const record = statuses.get(featureId);
    if (record === undefined) {
      return {
        ok: false,
        code: FEATURE_STATUS_DIAGNOSTIC_CODES.UNKNOWN,
        message: `Feature ${featureId} has not been registered.`,
      };
    }

    const nextRecord: FeatureStatusRecord = Object.freeze({
      featureId: record.featureId,
      requirement: record.requirement,
      status,
      ...(diagnosticCode === undefined ? {} : { diagnosticCode }),
    });
    statuses.set(featureId, nextRecord);
    return { ok: true, record: nextRecord };
  };

  return Object.freeze({
    register,
    setStatus,
    getSnapshot: (): readonly FeatureStatusRecord[] =>
      [...statuses.values()].sort((left, right) =>
        compareStrings(left.featureId, right.featureId),
      ),
    get: (featureId: string): FeatureStatusRecord | undefined =>
      statuses.get(featureId),
  });
}
