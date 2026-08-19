/**
 * Public feature-registration contracts used by the application shell.
 *
 * The loader is deliberately the only non-serializable part of a
 * registration.  Its surrounding metadata is copied and validated before it
 * is exposed to the rest of the application.  This keeps route discovery
 * deterministic while still allowing features to remain lazy.
 */

export type FeatureRequirement = "required" | "optional";

export type FeatureRecoveryAction = Readonly<{
  id: string;
  label: string;
  /** Optional clean route to which the action navigates. */
  path?: string;
}>;

export type FeatureFailurePresentation = Readonly<{
  diagnosticCode: string;
  title: string;
  message: string;
  recoveryActions?: readonly FeatureRecoveryAction[];
}>;

/** A route contributed by one browser-facing feature. */
export type FeatureRouteContribution = Readonly<{
  /** Stable route identity, distinct from its display title and path. */
  id: string;
  /** Clean, application-relative path (for example, "/park"). */
  path: string;
  /** Stable mode identity exposed to navigation and accessibility surfaces. */
  mode: string;
  /** Stable document/surface title for this route. */
  title: string;
}>;

export type FeatureLoader<TFeature> = () => Promise<TFeature>;

/**
 * Input registration contract.  The two failure-property spellings are kept
 * as a compatibility bridge for early feature adapters; exactly one must be
 * supplied.  Normalized registrations always expose `failure`.
 */
export type FeatureRegistration<TFeature = unknown> = Readonly<{
  id: string;
  order: number;
  requirement: FeatureRequirement;
  route: FeatureRouteContribution;
  load: FeatureLoader<TFeature>;
  failure?: FeatureFailurePresentation;
  failurePresentation?: FeatureFailurePresentation;
}>;

/** A validated immutable registration returned by the registry. */
export type RegisteredFeature<TFeature = unknown> = Readonly<{
  id: string;
  order: number;
  requirement: FeatureRequirement;
  route: FeatureRouteContribution;
  load: FeatureLoader<TFeature>;
  failure: FeatureFailurePresentation;
}>;

export type FeatureRegistryIssueCode =
  | "invalid-registration"
  | "invalid-feature-id"
  | "duplicate-feature-id"
  | "invalid-order"
  | "invalid-requirement"
  | "invalid-loader"
  | "invalid-route"
  | "invalid-route-id"
  | "duplicate-route-id"
  | "duplicate-route-path"
  | "invalid-mode"
  | "invalid-title"
  | "invalid-failure-presentation"
  | "invalid-required-feature-id"
  | "duplicate-required-feature-id"
  | "missing-required-feature";

export type FeatureRegistryIssue = Readonly<{
  code: FeatureRegistryIssueCode;
  message: string;
  featureId?: string;
  routeId?: string;
  path?: string;
}>;

export type FeatureRegistryOptions = Readonly<{
  /** Feature IDs that must be present before the shell can report ready. */
  requiredFeatureIds?: readonly string[];
}>;

export class FeatureRegistryValidationError extends Error {
  readonly code = "SHELL_FEATURE_REGISTRY_INVALID";
  readonly issues: readonly FeatureRegistryIssue[];

  constructor(issues: readonly FeatureRegistryIssue[]) {
    const stableIssues = [...issues];
    super(stableIssues.map((issue) => issue.message).join("; "));
    this.name = "FeatureRegistryValidationError";
    this.issues = Object.freeze(stableIssues);
  }
}

export class FeatureNotFoundError extends Error {
  readonly code = "SHELL_FEATURE_NOT_FOUND";
  readonly featureId: string;

  constructor(featureId: string) {
    super(`Feature "${featureId}" is not registered`);
    this.name = "FeatureNotFoundError";
    this.featureId = featureId;
  }
}

export interface FeatureRegistry<TFeature = unknown> {
  /** Entries sorted by explicit order, then stable case-sensitive ID. */
  readonly features: readonly RegisteredFeature<TFeature>[];
  /** Alias useful to callers that treat the registry as a collection. */
  readonly registrations: readonly RegisteredFeature<TFeature>[];
  readonly routes: readonly FeatureRouteContribution[];
  getFeature(featureId: string): RegisteredFeature<TFeature> | undefined;
  getRoute(routeId: string): RegisteredFeature<TFeature> | undefined;
  getRouteByPath(path: string): RegisteredFeature<TFeature> | undefined;
  load(featureId: string): Promise<TFeature>;
}

type UnknownRecord = Record<string, unknown>;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStableIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    IDENTIFIER_PATTERN.test(value)
  );
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function issueSortKey(issue: FeatureRegistryIssue): string {
  return [
    issue.featureId ?? "",
    issue.routeId ?? "",
    issue.path ?? "",
    issue.code,
    issue.message,
  ].join("\u0000");
}

function sortIssues(issues: readonly FeatureRegistryIssue[]): FeatureRegistryIssue[] {
  return [...issues].sort((left, right) =>
    compareCodeUnits(issueSortKey(left), issueSortKey(right)),
  );
}

/**
 * Return a canonical clean path.  Route IDs remain case-sensitive; only the
 * leading/trailing slash convention is normalized here.
 */
export function normalizeRoutePath(path: string): string {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.trim() !== path ||
    !path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw new Error(`Route path must be a clean absolute path: ${String(path)}`);
  }

  const segments = path.split("/");
  if (
    segments.some(
      (segment, index) =>
        index > 0 && segment.length === 0 && index !== segments.length - 1,
    )
  ) {
    throw new Error(`Route path contains an empty segment: ${path}`);
  }

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Route path contains a traversal segment: ${path}`);
  }

  if (path === "/") return path;
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function normalizeRoutePathForValidation(path: unknown):
  | { readonly value: string }
  | { readonly issue: FeatureRegistryIssue } {
  if (typeof path !== "string") {
    return {
      issue: {
        code: "invalid-route",
        message: "Feature route path must be a string.",
      },
    };
  }

  try {
    return { value: normalizeRoutePath(path) };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "invalid path";
    return {
      issue: {
        code: "invalid-route",
        message: detail,
        path,
      },
    };
  }
}

function normalizeRecoveryActions(
  value: unknown,
): readonly FeatureRecoveryAction[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;

  const actions: FeatureRecoveryAction[] = [];
  for (const actionValue of value) {
    if (!isRecord(actionValue)) return undefined;
    const id = actionValue.id;
    const label = actionValue.label;
    const path = actionValue.path;
    if (!isStableIdentifier(id) || !isNonEmptyText(label)) return undefined;
    if (path !== undefined && typeof path !== "string") return undefined;
    if (path !== undefined) {
      try {
        normalizeRoutePath(path);
      } catch {
        return undefined;
      }
    }
    actions.push(
      Object.freeze({
        id,
        label,
        ...(path === undefined ? {} : { path: normalizeRoutePath(path) }),
      }),
    );
  }

  return Object.freeze(actions);
}

function readFailurePresentation(
  candidate: UnknownRecord,
): FeatureFailurePresentation | undefined {
  if (candidate.failure !== undefined && candidate.failurePresentation !== undefined) {
    return undefined;
  }
  const failureValue = candidate.failure ?? candidate.failurePresentation;
  if (!isRecord(failureValue)) return undefined;
  const diagnosticCode = failureValue.diagnosticCode;
  const title = failureValue.title;
  const message = failureValue.message;
  if (
    !isStableIdentifier(diagnosticCode) ||
    !isNonEmptyText(title) ||
    !isNonEmptyText(message)
  ) {
    return undefined;
  }

  const recoveryActions = normalizeRecoveryActions(failureValue.recoveryActions);
  if (failureValue.recoveryActions !== undefined && recoveryActions === undefined) {
    return undefined;
  }

  return Object.freeze({
    diagnosticCode,
    title,
    message,
    ...(recoveryActions === undefined ? {} : { recoveryActions }),
  });
}

type RegistrationCandidate<TFeature> = {
  readonly source: FeatureRegistration<TFeature>;
  readonly value: UnknownRecord;
  readonly featureId: string | undefined;
  readonly routeId: string | undefined;
  readonly routePath: string | undefined;
  readonly order: number | undefined;
  readonly failure: FeatureFailurePresentation | undefined;
};

function issueForCandidate(
  code: FeatureRegistryIssueCode,
  message: string,
  candidate: Pick<RegistrationCandidate<unknown>, "featureId" | "routeId" | "routePath">,
): FeatureRegistryIssue {
  return {
    code,
    message,
    ...(candidate.featureId === undefined ? {} : { featureId: candidate.featureId }),
    ...(candidate.routeId === undefined ? {} : { routeId: candidate.routeId }),
    ...(candidate.routePath === undefined ? {} : { path: candidate.routePath }),
  };
}

function inspectRegistration<TFeature>(
  source: FeatureRegistration<TFeature>,
): { readonly candidate: RegistrationCandidate<TFeature>; readonly issues: FeatureRegistryIssue[] } {
  const value: unknown = source;
  if (!isRecord(value)) {
    return {
      candidate: {
        source,
        value: {},
        featureId: undefined,
        routeId: undefined,
        routePath: undefined,
        order: undefined,
        failure: undefined,
      },
      issues: [
        {
          code: "invalid-registration",
          message: "Feature registration must be an object.",
        },
      ],
    };
  }

  const featureId = isStableIdentifier(value.id) ? value.id : undefined;
  const order =
    typeof value.order === "number" &&
    Number.isSafeInteger(value.order) &&
    value.order >= 0
      ? value.order
      : undefined;
  const requirement = value.requirement;
  const load = value.load;
  const routeValue = isRecord(value.route) ? value.route : undefined;
  const routeId = routeValue && isStableIdentifier(routeValue.id) ? routeValue.id : undefined;
  const pathResult = routeValue
    ? normalizeRoutePathForValidation(routeValue.path)
    : {
        issue: {
          code: "invalid-route" as const,
          message: "Feature registration must declare a route object.",
        },
      };
  const routePath = "value" in pathResult ? pathResult.value : undefined;
  const failure = readFailurePresentation(value);
  const issues: FeatureRegistryIssue[] = [];

  if (featureId === undefined) {
    issues.push(
      issueForCandidate(
        "invalid-feature-id",
        "Feature ID must be a non-empty case-sensitive stable identifier.",
        { featureId: typeof value.id === "string" ? value.id : undefined, routeId, routePath },
      ),
    );
  }
  if (order === undefined) {
    issues.push(
      issueForCandidate(
        "invalid-order",
        "Feature order must be a non-negative safe integer.",
        { featureId, routeId, routePath },
      ),
    );
  }
  if (requirement !== "required" && requirement !== "optional") {
    issues.push(
      issueForCandidate(
        "invalid-requirement",
        "Feature requirement must be either required or optional.",
        { featureId, routeId, routePath },
      ),
    );
  }
  if (typeof load !== "function") {
    issues.push(
      issueForCandidate(
        "invalid-loader",
        "Feature registration must provide a lazy loader function.",
        { featureId, routeId, routePath },
      ),
    );
  }
  if (routeValue === undefined || routeId === undefined) {
    issues.push(
      issueForCandidate(
        "invalid-route-id",
        "Feature route must declare a non-empty stable route ID.",
        { featureId, routeId, routePath },
      ),
    );
  }
  if (!("value" in pathResult)) {
    issues.push(
      issueForCandidate(pathResult.issue.code, pathResult.issue.message, {
        featureId,
        routeId,
        routePath,
      }),
    );
  }
  if (
    routeValue !== undefined &&
    (!isNonEmptyText(routeValue.mode) || !isStableIdentifier(routeValue.mode))
  ) {
    issues.push(
      issueForCandidate(
        "invalid-mode",
        "Feature route mode must be a non-empty stable identifier.",
        { featureId, routeId, routePath },
      ),
    );
  }
  if (routeValue !== undefined && !isNonEmptyText(routeValue.title)) {
    issues.push(
      issueForCandidate(
        "invalid-title",
        "Feature route title must be non-empty text.",
        { featureId, routeId, routePath },
      ),
    );
  }
  if (failure === undefined) {
    issues.push(
      issueForCandidate(
        "invalid-failure-presentation",
        "Feature registration must provide a diagnostic code, title, and message for failure presentation.",
        { featureId, routeId, routePath },
      ),
    );
  }

  return {
    candidate: {
      source,
      value,
      featureId,
      routeId,
      routePath,
      order,
      failure,
    },
    issues,
  };
}

function normalizeRegistration<TFeature>(
  candidate: RegistrationCandidate<TFeature>,
): RegisteredFeature<TFeature> {
  const routeValue = candidate.value.route;
  if (!isRecord(routeValue)) {
    throw new Error("Cannot normalize an invalid feature route");
  }
  if (
    candidate.featureId === undefined ||
    candidate.order === undefined ||
    candidate.routeId === undefined ||
    candidate.routePath === undefined ||
    candidate.failure === undefined
  ) {
    throw new Error("Cannot normalize an invalid feature registration");
  }

  const load = candidate.value.load;
  if (typeof load !== "function") {
    throw new Error("Cannot normalize an invalid feature loader");
  }

  // The runtime check above proves this is the loader supplied by the typed
  // registration contract; the cast only restores its generic return type.
  const typedLoad = load as FeatureLoader<TFeature>;
  const requirement = candidate.value.requirement;
  if (requirement !== "required" && requirement !== "optional") {
    throw new Error("Cannot normalize an invalid feature requirement");
  }
  const mode = routeValue.mode;
  const title = routeValue.title;
  if (!isStableIdentifier(mode) || !isNonEmptyText(title)) {
    throw new Error("Cannot normalize an invalid route mode or title");
  }

  return Object.freeze({
    id: candidate.featureId,
    order: candidate.order,
    requirement,
    route: Object.freeze({
      id: candidate.routeId,
      path: candidate.routePath,
      mode,
      title,
    }),
    load: typedLoad,
    failure: candidate.failure,
  });
}

/**
 * Validate registrations without invoking any lazy loader.  Issues are
 * sorted by stable identifiers so the same set produces the same diagnostics
 * regardless of discovery/import completion order.
 */
export function validateFeatureRegistrations<TFeature = unknown>(
  registrations: readonly FeatureRegistration<TFeature>[],
  options: FeatureRegistryOptions = {},
): readonly FeatureRegistryIssue[] {
  const issues: FeatureRegistryIssue[] = [];
  const candidates: RegistrationCandidate<TFeature>[] = [];
  const featureIds = new Map<string, RegistrationCandidate<TFeature>>();
  const routeIds = new Map<string, RegistrationCandidate<TFeature>>();
  const routePaths = new Map<string, RegistrationCandidate<TFeature>>();

  for (const source of registrations) {
    const inspected = inspectRegistration(source);
    candidates.push(inspected.candidate);
    issues.push(...inspected.issues);
    const { candidate } = inspected;

    if (candidate.featureId !== undefined) {
      const previous = featureIds.get(candidate.featureId);
      if (previous !== undefined) {
        issues.push(
          issueForCandidate(
            "duplicate-feature-id",
            `Feature ID "${candidate.featureId}" is registered more than once.`,
            candidate,
          ),
        );
      } else {
        featureIds.set(candidate.featureId, candidate);
      }
    }
    if (candidate.routeId !== undefined) {
      const previous = routeIds.get(candidate.routeId);
      if (previous !== undefined) {
        issues.push(
          issueForCandidate(
            "duplicate-route-id",
            `Route ID "${candidate.routeId}" is owned by more than one feature.`,
            candidate,
          ),
        );
      } else {
        routeIds.set(candidate.routeId, candidate);
      }
    }
    if (candidate.routePath !== undefined) {
      const previous = routePaths.get(candidate.routePath);
      if (previous !== undefined) {
        issues.push(
          issueForCandidate(
            "duplicate-route-path",
            `Route path "${candidate.routePath}" is owned by more than one feature.`,
            candidate,
          ),
        );
      } else {
        routePaths.set(candidate.routePath, candidate);
      }
    }
  }

  const requiredFeatureIds = options.requiredFeatureIds;
  if (requiredFeatureIds !== undefined) {
    const seenRequiredIds = new Set<string>();
    for (const requiredFeatureId of requiredFeatureIds) {
      if (!isStableIdentifier(requiredFeatureId)) {
        issues.push({
          code: "invalid-required-feature-id",
          message: "Required feature IDs must be non-empty stable identifiers.",
          featureId:
            typeof requiredFeatureId === "string" ? requiredFeatureId : undefined,
        });
        continue;
      }
      if (seenRequiredIds.has(requiredFeatureId)) {
        issues.push({
          code: "duplicate-required-feature-id",
          message: `Required feature ID "${requiredFeatureId}" is listed more than once.`,
          featureId: requiredFeatureId,
        });
        continue;
      }
      seenRequiredIds.add(requiredFeatureId);
      const registeredRequired = featureIds.get(requiredFeatureId);
      if (
        registeredRequired === undefined ||
        registeredRequired.value.requirement !== "required"
      ) {
        issues.push({
          code: "missing-required-feature",
          message:
            registeredRequired === undefined
              ? `Required feature "${requiredFeatureId}" is not registered.`
              : `Feature "${requiredFeatureId}" is registered as optional but is required by shell configuration.`,
          featureId: requiredFeatureId,
        });
      }
    }
  }

  // Keep this local so the validation function remains useful on its own and
  // does not need to expose partially normalized registrations.
  void candidates;
  return Object.freeze(sortIssues(issues));
}

/** Throw a stable aggregate error when registration validation fails. */
export function assertValidFeatureRegistrations<TFeature = unknown>(
  registrations: readonly FeatureRegistration<TFeature>[],
  options: FeatureRegistryOptions = {},
): void {
  const issues = validateFeatureRegistrations(registrations, options);
  if (issues.length > 0) throw new FeatureRegistryValidationError(issues);
}

class ValidatedFeatureRegistry<TFeature> implements FeatureRegistry<TFeature> {
  readonly features: readonly RegisteredFeature<TFeature>[];
  readonly registrations: readonly RegisteredFeature<TFeature>[];
  readonly routes: readonly FeatureRouteContribution[];
  private readonly byFeatureId: ReadonlyMap<string, RegisteredFeature<TFeature>>;
  private readonly byRouteId: ReadonlyMap<string, RegisteredFeature<TFeature>>;
  private readonly byRoutePath: ReadonlyMap<string, RegisteredFeature<TFeature>>;
  private readonly pendingLoads = new Map<string, Promise<TFeature>>();

  constructor(
    features: readonly RegisteredFeature<TFeature>[],
  ) {
    this.features = Object.freeze([...features]);
    this.registrations = this.features;
    this.routes = Object.freeze(this.features.map((feature) => feature.route));
    this.byFeatureId = new Map(this.features.map((feature) => [feature.id, feature]));
    this.byRouteId = new Map(this.features.map((feature) => [feature.route.id, feature]));
    this.byRoutePath = new Map(this.features.map((feature) => [feature.route.path, feature]));
  }

  getFeature(featureId: string): RegisteredFeature<TFeature> | undefined {
    return this.byFeatureId.get(featureId);
  }

  getRoute(routeId: string): RegisteredFeature<TFeature> | undefined {
    return this.byRouteId.get(routeId);
  }

  getRouteByPath(path: string): RegisteredFeature<TFeature> | undefined {
    let normalizedPath: string;
    try {
      normalizedPath = normalizeRoutePath(path);
    } catch {
      return undefined;
    }
    return this.byRoutePath.get(normalizedPath);
  }

  load(featureId: string): Promise<TFeature> {
    const feature = this.getFeature(featureId);
    if (feature === undefined) return Promise.reject(new FeatureNotFoundError(featureId));

    const pending = this.pendingLoads.get(featureId);
    if (pending !== undefined) return pending;

    const load = Promise.resolve().then(() => feature.load());
    this.pendingLoads.set(featureId, load);
    // A failed lazy import may be retried by a later shell slice.  Successful
    // imports remain memoized to avoid duplicate feature initialization.
    void load.catch(() => {
      if (this.pendingLoads.get(featureId) === load) this.pendingLoads.delete(featureId);
    });
    return load;
  }
}

/**
 * Validate, normalize, and deterministically order feature registrations.
 * No loader is invoked by this function.
 */
export function createFeatureRegistry<TFeature = unknown>(
  registrations: readonly FeatureRegistration<TFeature>[],
  options: FeatureRegistryOptions = {},
): FeatureRegistry<TFeature> {
  assertValidFeatureRegistrations(registrations, options);
  const inspected = registrations.map((source) => inspectRegistration(source).candidate);
  const features = inspected
    .map(normalizeRegistration)
    .sort((left, right) => {
      const orderDifference = left.order - right.order;
      return orderDifference !== 0
        ? orderDifference
        : compareCodeUnits(left.id, right.id);
    });
  return new ValidatedFeatureRegistry(features);
}

/** Alias with an explicit verb for callers building a shell at startup. */
export const buildFeatureRegistry = createFeatureRegistry;
