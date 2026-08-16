"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getFeatureDiscovery } from "../features/registration.ts";
import type { FeatureDiscoveryFailure } from "../features/discovery.ts";
import { DEFAULT_RUNTIME_CONFIG, getBrowserRuntimeConfig } from "./config.ts";
import { DiagnosticHome } from "./DiagnosticHome.tsx";
import { diagnosticsToErrors, normalizeShellError } from "./errors.ts";
import { ShellFallback, ShellLoading } from "./fallbacks.tsx";
import { createShellLifecycleController } from "./lifecycle.ts";
import { createProviderComposer } from "./providers.ts";
import { createFeatureRegistry } from "./registry.ts";
import {
  applyBasePath,
  matchRoute,
  matchesRouteManifest,
  normalizeClientHref,
  pushBrowserNavigation,
  readBrowserHref,
  subscribeToBrowserNavigation,
} from "./router.ts";
import type {
  FeatureModule,
  PublicRuntimeConfig,
  RouteComponent,
  ShellAppProps,
  ShellError,
  ShellRouteProps,
} from "./types.ts";

interface BoundaryProps {
  readonly children: ReactNode;
  readonly onHome: () => void;
  readonly onRetry: () => void;
}

interface BoundaryState {
  readonly error: ShellError | null;
}

class RouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(): BoundaryState {
    return { error: normalizeShellError(undefined, { category: "route-render", code: "ROUTE_RENDER_FAILED", summary: "This feature encountered a rendering error." }) };
  }

  componentDidCatch(thrown: unknown): void {
    this.setState({ error: normalizeShellError(thrown, { category: "route-render", code: "ROUTE_RENDER_FAILED", summary: "This feature encountered a rendering error." }) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ShellFallback
        title="Feature unavailable"
        summary={this.state.error.summary}
        actionLabel="Try again"
        onAction={this.props.onRetry}
        secondaryActionLabel="Return home"
        onSecondaryAction={this.props.onHome}
      />
    );
  }
}

class RootErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(): BoundaryState {
    return { error: normalizeShellError(undefined, { category: "startup", code: "ROOT_RENDER_FAILED", recoverable: true, summary: "The application shell encountered an unexpected rendering error." }) };
  }

  componentDidCatch(thrown: unknown): void {
    this.setState({ error: normalizeShellError(thrown, { category: "startup", code: "ROOT_RENDER_FAILED", recoverable: true, summary: "The application shell encountered an unexpected rendering error." }) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ShellFallback
        title="Application unavailable"
        summary={this.state.error.summary}
        actionLabel="Restart application"
        onAction={this.props.onRetry}
        secondaryActionLabel="Return home"
        onSecondaryAction={this.props.onHome}
      />
    );
  }
}

interface BootstrapState {
  readonly registry: ReturnType<typeof createFeatureRegistry>;
  readonly modules: readonly FeatureModule[];
  readonly config: PublicRuntimeConfig;
  readonly errors: readonly ShellError[];
}

function bootstrap(
  config: PublicRuntimeConfig,
  modules: readonly FeatureModule[],
  discoveryFailures: readonly FeatureDiscoveryFailure[],
): BootstrapState {
  const registry = createFeatureRegistry();
  const errors: ShellError[] = [];
  for (const failure of discoveryFailures) registry.recordUnavailable(failure.featureId, failure.diagnostic);
  for (const result of registry.registerBatch(modules)) {
    if (!result.ok) errors.push(...diagnosticsToErrors(result.error, config.mode));
  }
  errors.push(...discoveryFailures.flatMap((failure) => diagnosticsToErrors([failure.diagnostic], config.mode)));
  return { registry, modules, config, errors: Object.freeze(errors) };
}

function RouteView({ Component: Route, routeProps }: { readonly Component: RouteComponent; readonly routeProps: ShellRouteProps }) {
  return <Route {...routeProps} />;
}

function ShellRuntime({ initialPath = "/", initialRoutes = [] }: ShellAppProps) {
  const configResult = useMemo(
    () => (typeof window === "undefined" ? { ok: true as const, value: DEFAULT_RUNTIME_CONFIG } : getBrowserRuntimeConfig()),
    [],
  );
  const config = configResult.ok ? configResult.value : null;
  const [boot, setBoot] = useState<{ readonly value: BootstrapState | null; readonly error: ShellError | null } | null>(null);
  const [path, setPath] = useState(initialPath || "/");
  const [loadedRoute, setLoadedRoute] = useState<{ readonly key: string; readonly Component: RouteComponent } | null>(null);
  const [routeError, setRouteError] = useState<{ readonly key: string; readonly error: ShellError } | null>(null);
  const [routeAttempt, setRouteAttempt] = useState(0);
  const [lifecycleErrors, setLifecycleErrors] = useState<readonly ShellError[]>([]);
  const lifecycleQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!config) return;
    let active = true;
    void getFeatureDiscovery()
      .then((discovery) => {
        if (active) setBoot({ value: bootstrap(config, discovery.modules, discovery.failures), error: null });
      })
      .catch((thrown: unknown) => {
        if (active) setBoot({
          value: null,
          error: normalizeShellError(thrown, { category: "startup", code: "BOOTSTRAP_FAILED", recoverable: false, summary: "The application could not initialize its shell." }),
        });
      });
    return () => { active = false; };
  }, [config]);

  useEffect(() => {
    return subscribeToBrowserNavigation(window, setPath);
  }, []);

  useEffect(() => {
    if (!boot?.value || !config) return;
    const abort = new AbortController();
    let mounted = true;
    const { registry, modules } = boot.value;
    const reportLifecycleError = (error: ShellError) => {
      if (mounted) setLifecycleErrors((current) => Object.freeze([...current, error]));
      else if (config.mode !== "production") console.error(`[${error.code}] ${error.summary}`);
    };
    const composer = createProviderComposer(registry.listProviders(), config, reportLifecycleError);
    const lifecycle = createShellLifecycleController(modules, registry, composer, config, reportLifecycleError);
    lifecycleQueue.current = lifecycleQueue.current.then(async () => {
      if (abort.signal.aborted) return;
      const result = await lifecycle.start(abort.signal);
      if (mounted) setLifecycleErrors(result.errors);
    }).catch((thrown: unknown) => {
      reportLifecycleError(normalizeShellError(thrown, { category: "startup", code: "LIFECYCLE_START_FAILED", summary: "Feature lifecycle startup could not complete." }));
    });
    return () => {
      mounted = false;
      abort.abort();
      lifecycleQueue.current = lifecycleQueue.current.then(async () => {
        await lifecycle.stop();
      }).catch((thrown: unknown) => {
        reportLifecycleError(normalizeShellError(thrown, { category: "disposal", code: "LIFECYCLE_STOP_FAILED", summary: "Feature lifecycle cleanup could not complete." }));
      });
    };
  }, [boot, config]);

  const navigate = (href: string) => {
    if (!config) return;
    pushBrowserNavigation(window, href, config.basePath);
    setPath(readBrowserHref(window));
  };

  const internalHref = config ? normalizeClientHref(path, config.basePath) : null;
  const manifestHasRoute = config ? matchesRouteManifest(initialRoutes, path, config.basePath) : false;
  const matched = useMemo(
    () => (boot?.value && internalHref ? matchRoute(boot.value.registry.listRoutes(), internalHref) : null),
    [boot, internalHref],
  );
  const routeKey = matched ? `${matched.route.id}:${internalHref}:${routeAttempt}` : null;

  useEffect(() => {
    if (!matched || !routeKey) return;
    let active = true;
    void Promise.resolve()
      .then(() => matched.route.load())
      .then((Component) => {
        if (active) setLoadedRoute({ key: routeKey, Component });
      })
      .catch((thrown: unknown) => {
        if (active) setRouteError({
          key: routeKey,
          error: normalizeShellError(thrown, { category: "route-load", code: "ROUTE_LOAD_FAILED", routeId: matched.route.id, summary: `Route “${matched.route.id}” could not be loaded.` }),
        });
      });
    return () => { active = false; };
  }, [matched, routeKey]);

  useEffect(() => {
    document.title = matched?.route.title ? `${matched.route.title} · Dino Park Engineer` : "Dino Park Engineer";
  }, [matched]);

  if (!configResult.ok) {
    return (
      <ShellFallback
        title="Configuration unavailable"
        summary={`${configResult.error.summary} Diagnostic: ${configResult.error.code}.`}
        actionLabel="Reload"
        onAction={() => window.location.reload()}
        secondaryActionLabel="Return home"
        onSecondaryAction={() => window.location.assign("/")}
      />
    );
  }
  if (boot?.error) {
    return <ShellFallback title="Application unavailable" summary={boot.error.summary} actionLabel="Reload" onAction={() => window.location.reload()} />;
  }
  if (!boot?.value || !config) {
    if (internalHref && internalHref !== "/" && !manifestHasRoute) {
      return <ShellFallback title="Page not found" summary="No registered feature owns this route." actionLabel="Return home" onAction={() => navigate("/")} />;
    }
    return <ShellLoading />;
  }

  if (!internalHref || (!matched && internalHref !== "/")) {
    return <ShellFallback title="Page not found" summary="No registered feature owns this route." actionLabel="Return home" onAction={() => navigate("/")} />;
  }
  if (!matched) {
    return <DiagnosticHome config={config} features={boot.value.registry.listFeatures()} errors={[...boot.value.errors, ...lifecycleErrors]} />;
  }

  const retryRoute = () => setRouteAttempt((attempt) => attempt + 1);
  if (routeError?.key === routeKey) {
    return (
      <ShellFallback
        title="Feature unavailable"
        summary={routeError.error.summary}
        actionLabel="Try again"
        onAction={retryRoute}
        secondaryActionLabel="Return home"
        onSecondaryAction={() => navigate("/")}
      />
    );
  }
  if (!loadedRoute || loadedRoute.key !== routeKey) return <ShellLoading />;

  return (
    <RouteErrorBoundary key={routeKey} onHome={() => navigate("/")} onRetry={retryRoute}>
      <RouteView Component={loadedRoute.Component} routeProps={{ params: matched.params, query: matched.query, route: matched.route, navigate }} />
    </RouteErrorBoundary>
  );
}

export function ShellApp(props: ShellAppProps) {
  const [rootAttempt, setRootAttempt] = useState(0);
  const returnHome = () => {
    const runtimeConfig = getBrowserRuntimeConfig();
    window.location.assign(runtimeConfig.ok ? applyBasePath("/", runtimeConfig.value.basePath) : "/");
  };
  return (
    <RootErrorBoundary
      key={rootAttempt}
      onRetry={() => setRootAttempt((attempt) => attempt + 1)}
      onHome={returnHome}
    >
      <ShellRuntime {...props} />
    </RootErrorBoundary>
  );
}
