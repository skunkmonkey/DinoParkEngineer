import type { AccessibilityPreferencesPort } from "./accessibility";
import type { AudioPort } from "./audio";
import type { ConfigurationPort } from "./configuration";
import {
  createDiagnosticsPort,
  type DiagnosticInput,
  type DiagnosticRecord,
  type DiagnosticsPort,
} from "./diagnostics";
import type { FeatureStatusPort } from "./feature-status";
import type { PersistencePort } from "./persistence";
import { compareStrings } from "./serializable";

export const PROVIDER_DIAGNOSTIC_CODES = {
  INVALID_ID: "SHELL_PROVIDER_ID_INVALID",
  DUPLICATE_ID: "SHELL_PROVIDER_DUPLICATE_ID",
  DUPLICATE_DEPENDENCY: "SHELL_PROVIDER_DEPENDENCY_DUPLICATE",
  MISSING_DEPENDENCY: "SHELL_PROVIDER_DEPENDENCY_MISSING",
  CYCLE: "SHELL_PROVIDER_DEPENDENCY_CYCLE",
  START_FAILED: "SHELL_PROVIDER_START_FAILED",
  DEPENDENCY_UNAVAILABLE: "SHELL_PROVIDER_DEPENDENCY_UNAVAILABLE",
  DISPOSE_FAILED: "SHELL_PROVIDER_DISPOSE_FAILED",
} as const;

export type ProviderRequirement = "required" | "optional";

export type ProviderLifecycleState =
  | "idle"
  | "starting"
  | "ready"
  | "degraded"
  | "failed"
  | "disposing"
  | "disposed";

export interface ProviderPorts {
  readonly configuration?: ConfigurationPort;
  readonly diagnostics?: DiagnosticsPort;
  readonly accessibility?: AccessibilityPreferencesPort;
  readonly audio?: AudioPort;
  readonly featureStatus?: FeatureStatusPort;
  readonly persistence?: PersistencePort;
}

export interface ProviderContext extends ProviderPorts {
  readonly reportDiagnostic: (input: DiagnosticInput) => DiagnosticRecord;
}

export type ProviderStartResult = unknown;

export interface ProviderDefinition {
  readonly id: string;
  readonly dependencies?: readonly string[];
  readonly requirement?: ProviderRequirement;
  readonly start: (context: ProviderContext) =>
    | ProviderStartResult
    | Promise<ProviderStartResult>;
  readonly dispose?: (
    runtime: ProviderStartResult,
    context: ProviderContext,
  ) => void | Promise<void>;
}

export interface ProviderValidationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly providerId?: string;
  readonly dependencyId?: string;
  readonly path?: readonly string[];
}

export type ProviderGraphValidationResult =
  | {
      readonly ok: true;
      readonly order: readonly string[];
      readonly definitions: readonly ProviderDefinition[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ProviderValidationDiagnostic[];
    };

export interface ProviderFailure {
  readonly providerId: string;
  readonly required: boolean;
  readonly code: string;
  readonly message: string;
}

export interface ProviderStartReport {
  readonly state: "ready" | "degraded" | "failed" | "disposed";
  readonly started: readonly string[];
  readonly failed: readonly ProviderFailure[];
  readonly diagnostics: readonly DiagnosticRecord[];
}

export interface ProviderDisposeReport {
  readonly disposed: readonly string[];
  readonly failed: readonly ProviderFailure[];
  readonly diagnostics: readonly DiagnosticRecord[];
}

export interface ProviderGraphOptions {
  readonly ports?: ProviderPorts;
}

export class ProviderGraphValidationError extends Error {
  readonly diagnostics: readonly ProviderValidationDiagnostic[];

  constructor(diagnostics: readonly ProviderValidationDiagnostic[]) {
    super("Provider graph validation failed.");
    this.name = "ProviderGraphValidationError";
    this.diagnostics = diagnostics;
  }
}

export class ProviderGraph {
  readonly order: readonly string[];
  readonly definitions: readonly ProviderDefinition[];
  readonly context: ProviderContext;

  private readonly definitionsById: ReadonlyMap<string, ProviderDefinition>;
  private readonly runtimes = new Map<string, ProviderStartResult>();
  private readonly started: string[] = [];
  private readonly failed = new Map<string, ProviderFailure>();
  private lifecycle: ProviderLifecycleState = "idle";
  private startPromise: Promise<ProviderStartReport> | undefined;
  private disposePromise: Promise<ProviderDisposeReport> | undefined;
  private startReport: ProviderStartReport | undefined;
  private disposeReport: ProviderDisposeReport | undefined;

  constructor(
    definitions: readonly ProviderDefinition[],
    options: ProviderGraphOptions = {},
  ) {
    const validation = validateProviderDefinitions(definitions);
    if (!validation.ok) {
      throw new ProviderGraphValidationError(validation.diagnostics);
    }

    this.order = validation.order;
    this.definitions = validation.definitions;
    this.definitionsById = new Map(
      this.definitions.map((definition) => [definition.id, definition]),
    );
    this.context = createProviderContext(options.ports);
  }

  getState(): ProviderLifecycleState {
    return this.lifecycle;
  }

  /** Start once. Repeated calls share the same report and never rerun a provider. */
  start(): Promise<ProviderStartReport> {
    if (this.startReport !== undefined) {
      return Promise.resolve(this.startReport);
    }

    if (this.startPromise !== undefined) {
      return this.startPromise;
    }

    if (this.lifecycle === "disposed") {
      const report: ProviderStartReport = Object.freeze({
        state: "disposed",
        started: Object.freeze([]),
        failed: Object.freeze([]),
        diagnostics: this.context.diagnostics?.getAll() ?? Object.freeze([]),
      });
      this.startReport = report;
      return Promise.resolve(report);
    }

    this.lifecycle = "starting";
    this.startPromise = this.startProviders();
    return this.startPromise;
  }

  /**
   * Dispose in exact reverse startup order. The returned promise is shared so
   * teardown from React strict-mode effects and test cleanup is idempotent.
   */
  dispose(): Promise<ProviderDisposeReport> {
    if (this.disposeReport !== undefined) {
      return Promise.resolve(this.disposeReport);
    }

    if (this.disposePromise !== undefined) {
      return this.disposePromise;
    }

    this.disposePromise = this.disposeProviders();
    return this.disposePromise;
  }

  private async startProviders(): Promise<ProviderStartReport> {
    const failures: ProviderFailure[] = [];

    for (const providerId of this.order) {
      const definition = this.definitionsById.get(providerId);
      if (definition === undefined) {
        // The graph is validated in the constructor; this is a programmer
        // invariant guard in case a future implementation changes storage.
        continue;
      }

      const unavailableDependency = (definition.dependencies ?? [])
        .slice()
        .sort(compareStrings)
        .find((dependencyId) => this.failed.has(dependencyId));
      if (unavailableDependency !== undefined) {
        const failure = this.recordFailure(
          definition,
          PROVIDER_DIAGNOSTIC_CODES.DEPENDENCY_UNAVAILABLE,
          `Provider ${definition.id} did not start because dependency ${unavailableDependency} failed.`,
        );
        failures.push(failure);
        if (isRequired(definition)) {
          break;
        }
        continue;
      }

      try {
        const runtime = await definition.start(this.context);
        this.runtimes.set(providerId, runtime);
        this.started.push(providerId);
      } catch (error: unknown) {
        const failure = this.recordFailure(
          definition,
          PROVIDER_DIAGNOSTIC_CODES.START_FAILED,
          getErrorMessage(error),
        );
        failures.push(failure);
        if (isRequired(definition)) {
          break;
        }
      }
    }

    this.failed.forEach((failure) => {
      if (!failures.some((entry) => entry.providerId === failure.providerId)) {
        failures.push(failure);
      }
    });

    const startedBeforeRollback = [...this.started];
    if (failures.some((failure) => failure.required)) {
      this.lifecycle = "failed";
      // A required provider failure blocks readiness. Already-started providers
      // are rolled back synchronously before the report is exposed.
      await this.disposeStartedProviders();
    } else {
      this.lifecycle = failures.length > 0 ? "degraded" : "ready";
    }

    const report: ProviderStartReport = Object.freeze({
      state: this.lifecycle,
      started: Object.freeze(startedBeforeRollback),
      failed: Object.freeze([...failures]),
      diagnostics: this.context.diagnostics?.getAll() ?? Object.freeze([]),
    });
    this.startReport = report;
    return report;
  }

  private async disposeProviders(): Promise<ProviderDisposeReport> {
    if (this.lifecycle === "idle" && this.startPromise === undefined) {
      this.lifecycle = "disposed";
      const report: ProviderDisposeReport = Object.freeze({
        disposed: Object.freeze([]),
        failed: Object.freeze([]),
        diagnostics: this.context.diagnostics?.getAll() ?? Object.freeze([]),
      });
      this.disposeReport = report;
      return report;
    }

    if (this.startPromise !== undefined && this.startReport === undefined) {
      await this.startPromise;
    }

    this.lifecycle = "disposing";
    const disposed: string[] = [];
    const failures: ProviderFailure[] = [];
    await this.disposeStartedProviders(disposed, failures);
    this.lifecycle = "disposed";

    const report: ProviderDisposeReport = Object.freeze({
      disposed: Object.freeze([...disposed]),
      failed: Object.freeze([...failures]),
      diagnostics: this.context.diagnostics?.getAll() ?? Object.freeze([]),
    });
    this.disposeReport = report;
    return report;
  }

  private async disposeStartedProviders(
    disposed: string[] = [],
    failures: ProviderFailure[] = [],
  ): Promise<void> {
    while (this.started.length > 0) {
      const providerId = this.started.pop();
      if (providerId === undefined) {
        continue;
      }

      const definition = this.definitionsById.get(providerId);
      if (definition === undefined) {
        continue;
      }

      const runtime = this.runtimes.get(providerId);
      try {
        if (definition.dispose !== undefined) {
          await definition.dispose(runtime, this.context);
        } else {
          await disposeRuntime(runtime);
        }
        this.runtimes.delete(providerId);
        disposed.push(providerId);
      } catch (error: unknown) {
        const failure: ProviderFailure = {
          providerId,
          required: isRequired(definition),
          code: PROVIDER_DIAGNOSTIC_CODES.DISPOSE_FAILED,
          message: getErrorMessage(error),
        };
        failures.push(failure);
        this.reportDiagnostic({
          code: failure.code,
          scope: "provider",
          severity: "error",
          message: `Provider ${providerId} failed during disposal: ${failure.message}`,
          recoveryActions: [{ id: "retry-dispose", label: "Retry shutdown" }],
          details: { providerId },
        });
      }
    }
  }

  private recordFailure(
    definition: ProviderDefinition,
    code: string,
    message: string,
  ): ProviderFailure {
    const failure: ProviderFailure = {
      providerId: definition.id,
      required: isRequired(definition),
      code,
      message,
    };
    this.failed.set(definition.id, failure);
    this.reportDiagnostic({
      code,
      scope: "provider",
      severity: failure.required ? "fatal" : "error",
      message: `Provider ${definition.id} failed: ${message}`,
      recoveryActions: failure.required
        ? [
            { id: "retry-startup", label: "Retry startup" },
            { id: "return-safe-route", label: "Return to Park View" },
          ]
        : [{ id: "retry-provider", label: "Retry provider" }],
      details: { providerId: definition.id },
    });
    return failure;
  }

  private reportDiagnostic(input: DiagnosticInput): DiagnosticRecord {
    if (this.context.diagnostics !== undefined) {
      return this.context.diagnostics.report(input);
    }

    return this.context.reportDiagnostic(input);
  }
}

export function createProviderGraph(
  definitions: readonly ProviderDefinition[],
  options: ProviderGraphOptions = {},
): ProviderGraph {
  return new ProviderGraph(definitions, options);
}

export function createProviderContext(ports: ProviderPorts = {}): ProviderContext {
  const diagnostics = ports.diagnostics ?? createDiagnosticsPort();
  return Object.freeze({
    ...ports,
    diagnostics,
    reportDiagnostic: (input: DiagnosticInput): DiagnosticRecord =>
      diagnostics.report(input),
  });
}

export function validateProviderDefinitions(
  definitions: readonly ProviderDefinition[],
): ProviderGraphValidationResult {
  const diagnostics: ProviderValidationDiagnostic[] = [];
  const byId = new Map<string, ProviderDefinition>();

  definitions.forEach((definition) => {
    const id = typeof definition.id === "string" ? definition.id.trim() : "";
    if (!isValidProviderId(id)) {
      diagnostics.push({
        code: PROVIDER_DIAGNOSTIC_CODES.INVALID_ID,
        providerId: definition.id,
        message: `Provider ID ${JSON.stringify(definition.id)} is invalid.`,
      });
      return;
    }

    if (byId.has(id)) {
      diagnostics.push({
        code: PROVIDER_DIAGNOSTIC_CODES.DUPLICATE_ID,
        providerId: id,
        message: `Provider ID ${id} is declared more than once.`,
      });
      return;
    }

    const normalizedDependencies = (definition.dependencies ?? [])
      .map((dependencyId) =>
        typeof dependencyId === "string" ? dependencyId.trim() : "",
      )
      .sort(compareStrings);
    byId.set(id, {
      ...definition,
      id,
      dependencies: Object.freeze(normalizedDependencies),
    });
  });

  const normalizedDefinitions = [...byId.values()].sort((left, right) =>
    compareStrings(left.id, right.id),
  );
  normalizedDefinitions.forEach((definition) => {
    const dependencies = definition.dependencies ?? [];
    const seenDependencies = new Set<string>();
    dependencies.forEach((dependencyId) => {
      const normalizedDependencyId = dependencyId.trim();
      if (seenDependencies.has(normalizedDependencyId)) {
        diagnostics.push({
          code: PROVIDER_DIAGNOSTIC_CODES.DUPLICATE_DEPENDENCY,
          providerId: definition.id,
          dependencyId: normalizedDependencyId,
          message: `Provider ${definition.id} repeats dependency ${normalizedDependencyId}.`,
        });
      }
      seenDependencies.add(normalizedDependencyId);
      if (!byId.has(normalizedDependencyId)) {
        diagnostics.push({
          code: PROVIDER_DIAGNOSTIC_CODES.MISSING_DEPENDENCY,
          providerId: definition.id,
          dependencyId: normalizedDependencyId,
          message: `Provider ${definition.id} depends on missing provider ${normalizedDependencyId}.`,
        });
      }
    });
  });

  const cycles = findCycles(normalizedDefinitions, byId);
  cycles.forEach((path) => {
    diagnostics.push({
      code: PROVIDER_DIAGNOSTIC_CODES.CYCLE,
      providerId: path[0],
      path,
      message: `Provider dependency cycle: ${path.join(" -> ")}.`,
    });
  });

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: Object.freeze(diagnostics) };
  }

  const order = topologicalOrder(normalizedDefinitions);
  return {
    ok: true,
    order: Object.freeze(order),
    definitions: Object.freeze(normalizedDefinitions),
  };
}

function topologicalOrder(
  definitions: readonly ProviderDefinition[],
): string[] {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const remaining = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  definitions.forEach((definition) => {
    const dependencies = definition.dependencies ?? [];
    remaining.set(definition.id, dependencies.length);
    dependencies.forEach((dependencyId) => {
      const list = dependents.get(dependencyId) ?? [];
      list.push(definition.id);
      dependents.set(dependencyId, list);
    });
  });

  const ready = definitions
    .filter((definition) => remaining.get(definition.id) === 0)
    .map((definition) => definition.id)
    .sort(compareStrings);
  const order: string[] = [];

  while (ready.length > 0) {
    const providerId = ready.shift();
    if (providerId === undefined) {
      continue;
    }

    order.push(providerId);
    const dependentIds = (dependents.get(providerId) ?? []).sort(compareStrings);
    dependentIds.forEach((dependentId) => {
      const count = remaining.get(dependentId);
      if (count === undefined) {
        return;
      }
      const nextCount = count - 1;
      remaining.set(dependentId, nextCount);
      if (nextCount === 0) {
        ready.push(dependentId);
        ready.sort(compareStrings);
      }
    });
  }

  // Validation guarantees this is complete; retain a deterministic fallback in
  // case this helper is reused independently in the future.
  return order.length === byId.size
    ? order
    : [...byId.keys()].sort(compareStrings);
}

function findCycles(
  definitions: readonly ProviderDefinition[],
  byId: ReadonlyMap<string, ProviderDefinition>,
): readonly (readonly string[])[] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];

  const visit = (providerId: string): void => {
    if (active.has(providerId)) {
      const index = stack.indexOf(providerId);
      if (index >= 0) {
        const cycle = [...stack.slice(index), providerId];
        const key = cycle.slice(0, -1).sort(compareStrings).join("\u0000");
        if (!cycles.some((entry) => entry.slice(0, -1).sort(compareStrings).join("\u0000") === key)) {
          cycles.push(cycle);
        }
      }
      return;
    }

    if (visited.has(providerId)) {
      return;
    }

    visited.add(providerId);
    active.add(providerId);
    stack.push(providerId);
    const dependencies = byId.get(providerId)?.dependencies ?? [];
    dependencies.slice().sort(compareStrings).forEach((dependencyId) => {
      if (byId.has(dependencyId)) {
        visit(dependencyId);
      }
    });
    stack.pop();
    active.delete(providerId);
  };

  definitions.forEach((definition) => visit(definition.id));
  return cycles;
}

function isValidProviderId(value: string): boolean {
  // Provider IDs are stable case-sensitive identities.  Uppercase and
  // namespaced IDs remain valid; ordering never relies on locale behavior.
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value);
}

function isRequired(definition: ProviderDefinition): boolean {
  return definition.requirement !== "optional";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "The provider reported an unspecified failure.";
}

async function disposeRuntime(runtime: ProviderStartResult): Promise<void> {
  if (typeof runtime === "function") {
    await runtime();
    return;
  }

  if (
    runtime !== null &&
    typeof runtime === "object" &&
    "dispose" in runtime &&
    typeof runtime.dispose === "function"
  ) {
    await runtime.dispose();
  }
}
