import React, {
  Component,
  createElement,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ConfigurationValidationError,
  createAccessibilityPreferencesPort,
  createAudioPort,
  createConfigurationPort,
  createDiagnosticsPort,
  createFeatureRegistry,
  createFeatureStatusPort,
  createMemoryOfflineAssetAdapter,
  createPlaceholderPersistencePort,
  createProviderGraph,
  createOfflineUpdateCoordinator,
  matchRoute,
  type AccessibilityPreferences,
  type FeatureRegistration,
  type OfflineUpdateCoordinator,
  type OfflineUpdateState,
  type PersistencePort,
  type RouteResolution,
} from "./shell/public.js";

interface LoadedFeature {
  readonly render: ComponentType;
}

interface FeatureBoundaryProps {
  readonly children: ReactNode;
  readonly onError: (error: Error) => void;
}

interface FeatureBoundaryState {
  readonly error?: Error;
}

class FeatureBoundary extends Component<
  FeatureBoundaryProps,
  FeatureBoundaryState
> {
  override state: FeatureBoundaryState = {};

  static getDerivedStateFromError(error: Error): FeatureBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    void info;
    this.props.onError(error);
  }

  override render(): ReactNode {
    if (this.state.error !== undefined) {
      return null;
    }
    return this.props.children;
  }
}

const BUILD_ID = "shell-phase-1";
const ACCESSIBILITY_STORAGE_KEY = "dpe.shell.accessibility.v1";

function currentQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function loadAccessibilityPreferences(): Partial<AccessibilityPreferences> {
  try {
    const stored = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (stored === null) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return {};
    const candidate = parsed as Record<string, unknown>;
    return {
      ...(typeof candidate.reducedMotion === "boolean"
        ? { reducedMotion: candidate.reducedMotion }
        : {}),
      ...(typeof candidate.highContrast === "boolean"
        ? { highContrast: candidate.highContrast }
        : {}),
      ...(typeof candidate.textScale === "number"
        ? { textScale: candidate.textScale }
        : {}),
      ...(typeof candidate.soundSubstitution === "boolean"
        ? { soundSubstitution: candidate.soundSubstitution }
        : {}),
    };
  } catch {
    return {};
  }
}

function supportsRequiredBrowserCapabilities(query: URLSearchParams): boolean {
  if (query.get("unsupported") === "1") return false;
  return (
    typeof window.history?.pushState === "function" &&
    typeof window.addEventListener === "function" &&
    typeof URL === "function" &&
    typeof Promise === "function"
  );
}

function withBase(basePath: string, path: string): string {
  if (basePath === "/") return path;
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return path === "/" ? base : `${base}${path}`;
}

export function BootSurface(): React.JSX.Element {
  return (
    <main className="centered-shell" aria-busy="true" aria-live="polite">
      <p className="eyebrow">Application shell</p>
      <h1>Dino Park Engineer</h1>
      <p>Validating park systems…</p>
    </main>
  );
}

interface FailureSurfaceProps {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly onSafeRoute: () => void;
}

export function FailureSurface({
  code,
  title,
  message,
  onRetry,
  onSafeRoute,
}: FailureSurfaceProps): React.JSX.Element {
  return (
    <main className="centered-shell" aria-labelledby="failure-heading">
      <p className="eyebrow">Startup blocked safely</p>
      <h1 id="failure-heading">{title}</h1>
      <p>{message}</p>
      <p><strong>Diagnostic:</strong> <code>{code}</code></p>
      <div className="button-row">
        <button type="button" onClick={onRetry}>Retry startup</button>
        <button type="button" onClick={onSafeRoute}>Return to Park View</button>
      </div>
      <p className="safe-state">No authoritative park state was changed.</p>
    </main>
  );
}

export function UnsupportedBrowserSurface(): React.JSX.Element {
  return (
    <main className="centered-shell" aria-labelledby="unsupported-heading">
      <p className="eyebrow">Unsupported browser</p>
      <h1 id="unsupported-heading">This browser cannot start the park safely</h1>
      <p>
        Dino Park Engineer needs a current desktop browser with standard module,
        navigation, and storage support. Update the browser, then retry.
      </p>
      <p><strong>Diagnostic:</strong> <code>SHELL_BROWSER_UNSUPPORTED</code></p>
      <button type="button" onClick={() => clearQueryAndReload("unsupported")}>Retry</button>
    </main>
  );
}

interface NotFoundSurfaceProps {
  readonly pathname: string;
  readonly onSafeRoute: () => void;
}

export function NotFoundSurface({
  pathname,
  onSafeRoute,
}: NotFoundSurfaceProps): React.JSX.Element {
  return (
    <section className="feature-card" aria-labelledby="not-found-heading">
      <p className="eyebrow">Route recovery</p>
      <h2 id="not-found-heading">Route not found</h2>
      <p><code>{pathname}</code> is not owned by a registered feature.</p>
      <button type="button" onClick={onSafeRoute}>Return to Park View</button>
    </section>
  );
}

interface OptionalFeatureFailureSurfaceProps {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly onSafeRoute: () => void;
}

export function OptionalFeatureFailureSurface({
  code,
  title,
  message,
  onRetry,
  onSafeRoute,
}: OptionalFeatureFailureSurfaceProps): React.JSX.Element {
  return (
    <section className="feature-card" aria-labelledby="optional-failure-heading">
      <p className="eyebrow">Optional feature unavailable</p>
      <h2 id="optional-failure-heading">{title}</h2>
      <p>{message}</p>
      <p><strong>Diagnostic:</strong> <code>{code}</code></p>
      <div className="button-row">
        <button type="button" onClick={onRetry}>Retry feature</button>
        <button type="button" onClick={onSafeRoute}>Return to Park View</button>
      </div>
    </section>
  );
}

export function OfflineStatus({ state }: { readonly state: OfflineUpdateState }): React.JSX.Element {
  return <p role="status">Offline status: <strong>{state.state}</strong></p>;
}

function createRegistrations(
  query: URLSearchParams,
): readonly FeatureRegistration<LoadedFeature>[] {
  return [
    {
      id: "park",
      order: 0,
      requirement: "required",
      route: { id: "park", path: "/", mode: "production", title: "Park View" },
      load: async (): Promise<LoadedFeature> => {
        const module = await import("./park/public.js");
        return { render: module.ParkPlaceholder };
      },
      failure: {
        diagnosticCode: "SHELL_REQUIRED_FEATURE_FAILED",
        title: "Park View could not load",
        message: "The required safe route is unavailable.",
      },
    },
    {
      id: "shell-lab",
      order: 10,
      requirement: "optional",
      route: {
        id: "shell-lab",
        path: "/shell-lab",
        mode: "diagnostics",
        title: "Shell Diagnostics",
      },
      load: async (): Promise<LoadedFeature> => {
        if (query.get("featureFailure") === "1") {
          throw new Error("The optional diagnostics feature was forced to fail.");
        }
        const module = await import("./shell-lab/public.js");
        return { render: module.ShellLab };
      },
      failure: {
        diagnosticCode: "SHELL_OPTIONAL_FEATURE_FAILED",
        title: "Optional diagnostics unavailable",
        message: "Park View remains safe and available.",
      },
    },
  ];
}

export function AppShell(): React.JSX.Element {
  const query = currentQuery();
  if (!supportsRequiredBrowserCapabilities(query)) {
    return <UnsupportedBrowserSurface />;
  }

  try {
    createConfigurationPort({
      buildId: query.get("config") === "invalid" ? "" : BUILD_ID,
      basePath: import.meta.env.BASE_URL,
    });
  } catch (error: unknown) {
    const code = error instanceof ConfigurationValidationError
      ? "SHELL_CONFIGURATION_INVALID"
      : "SHELL_BOOTSTRAP_FAILED";
    return (
      <FailureSurface
        code={code}
        title="Park configuration is invalid"
        message="Startup stopped before feature or provider state could change."
        onRetry={() => clearQueryAndReload("config")}
        onSafeRoute={() => {
          window.location.assign(import.meta.env.BASE_URL);
        }}
      />
    );
  }

  return <RunningShell />;
}

function clearQueryAndReload(name: string): void {
  const next = new URL(window.location.href);
  next.searchParams.delete(name);
  window.location.assign(next);
}

function RunningShell(): React.JSX.Element {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [query, setQuery] = useState(currentQuery);
  const [startupState, setStartupState] = useState<"booting" | "ready" | "failed">("booting");
  const [startupFailure, setStartupFailure] = useState<string>();
  const [loadedFeature, setLoadedFeature] = useState<LoadedFeature>();
  const [loadFailure, setLoadFailure] = useState<Error>();
  const [eventHistory, setEventHistory] = useState<readonly string[]>([
    "Shell boot started.",
  ]);
  const updateServiceWorker = useRef<
    ((reloadPage?: boolean) => Promise<void>) | undefined
  >(undefined);
  const basePath = import.meta.env.BASE_URL;

  const accessibility = useMemo(
    () => createAccessibilityPreferencesPort(loadAccessibilityPreferences()),
    [],
  );
  const preferences = useSyncExternalStore(
    accessibility.subscribe,
    accessibility.getSnapshot,
    accessibility.getSnapshot,
  );
  const persistence = useMemo<PersistencePort>(
    () => createPlaceholderPersistencePort(),
    [],
  );
  const offlineAssets = useMemo(
    () => createMemoryOfflineAssetAdapter({
      installed: true,
      version: BUILD_ID,
      ...(query.get("update") === "ready"
        ? { availableVersion: `${BUILD_ID}-next` }
        : {}),
    }),
    [query],
  );
  const offline = useMemo<OfflineUpdateCoordinator>(
    () => createOfflineUpdateCoordinator({ assets: offlineAssets, checkpoint: persistence }),
    [offlineAssets, persistence],
  );
  const offlineState = useSyncExternalStore(
    offline.subscribe,
    offline.getState,
    offline.getState,
  );

  const registry = useMemo(
    () => createFeatureRegistry<LoadedFeature>(createRegistrations(query), {
      requiredFeatureIds: ["park"],
    }),
    [query],
  );
  const resolution = useMemo<RouteResolution<LoadedFeature>>(
    () => matchRoute(registry, {
      pathname,
      basePath,
      safeRouteId: "park",
      causalPayload: { source: "browser-navigation" },
    }),
    [basePath, pathname, registry],
  );

  useEffect(() => {
    const onPopState = (): void => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return (): void => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.contrast = preferences.highContrast ? "high" : "standard";
    document.documentElement.dataset.motion = preferences.reducedMotion ? "reduced" : "standard";
    document.documentElement.style.setProperty("--dpe-font-size", `${preferences.textScale}rem`);
    try {
      window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preference persistence can be unavailable in a restricted browser. The
      // active immutable preference projection remains usable for this session.
    }
  }, [preferences]);

  useEffect(() => {
    const configuration = createConfigurationPort({ buildId: BUILD_ID, basePath });
    const diagnostics = createDiagnosticsPort();
    const featureStatus = createFeatureStatusPort();
    const audio = createAudioPort();
    const providerFailure = currentQuery().get("providerFailure") === "1";
    const graph = createProviderGraph(
      [
        {
          id: "configuration",
          start: () => {
            if (providerFailure) throw new Error("Forced required provider failure.");
            return configuration.getSnapshot();
          },
        },
        { id: "persistence", dependencies: ["configuration"], start: () => persistence },
        { id: "accessibility", dependencies: ["persistence"], start: () => accessibility },
        { id: "audio", dependencies: ["accessibility"], requirement: "optional", start: () => audio },
        { id: "feature-status", dependencies: ["configuration"], start: () => featureStatus },
      ],
      { ports: { configuration, diagnostics, featureStatus, audio, persistence, accessibility } },
    );
    let active = true;
    void graph.start().then((report) => {
      if (!active) return;
      if (report.state === "failed") {
        setStartupState("failed");
        setStartupFailure(report.failed[0]?.message ?? "A required provider failed.");
        setEventHistory((items) => [...items, "Required provider startup failed safely."]);
      } else {
        setStartupState("ready");
        setEventHistory((items) => [...items, "Shell providers ready in deterministic order."]);
      }
    });
    return (): void => {
      active = false;
      void graph.dispose();
    };
  }, [accessibility, basePath, persistence, query]);

  useEffect(() => {
    void offline.initialize().then((state) => {
      setEventHistory((items) => [...items, describeOfflineState(state)]);
    });
  }, [offline]);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      if (cancelled) return;
      updateServiceWorker.current = registerSW({
        immediate: true,
        onOfflineReady: () => {
          setEventHistory((items) => [...items, "Offline assets are ready."]);
        },
        onNeedRefresh: () => {
          offline.announceUpdate(`${BUILD_ID}-next`);
          setEventHistory((items) => [...items, "A static update is ready."]);
        },
        onRegisterError: () => {
          setEventHistory((items) => [...items, "Offline update registration failed."]);
        },
      });
    });
    return (): void => {
      cancelled = true;
    };
  }, [offline]);

  useEffect(() => {
    document.title = `${resolution.title} · Dino Park Engineer`;
    if (resolution.kind === "not-found" || startupState !== "ready") {
      setLoadedFeature(undefined);
      setLoadFailure(undefined);
      return;
    }
    let active = true;
    setLoadedFeature(undefined);
    setLoadFailure(undefined);
    void registry.load(resolution.feature.id).then(
      (feature) => {
        if (active) setLoadedFeature(feature);
      },
      (error: unknown) => {
        if (active) setLoadFailure(error instanceof Error ? error : new Error("Feature load failed."));
      },
    );
    return (): void => {
      active = false;
    };
  }, [registry, resolution, startupState]);

  const navigate = useCallback((path: string): void => {
    const target = withBase(basePath, path);
    window.history.pushState({}, "", target);
    setPathname(window.location.pathname);
  }, [basePath]);

  const retry = useCallback((): void => {
    const next = new URL(window.location.href);
    next.searchParams.delete("featureFailure");
    next.searchParams.delete("providerFailure");
    window.history.replaceState({}, "", next);
    setQuery(currentQuery());
    setStartupState("booting");
    setStartupFailure(undefined);
  }, []);

  if (startupState === "booting") return <BootSurface />;
  if (startupState === "failed") {
    return (
      <FailureSurface
        code="SHELL_PROVIDER_START_FAILED"
        title="A required park service could not start"
        message={startupFailure ?? "Startup stopped before the park became interactive."}
        onRetry={retry}
        onSafeRoute={() => navigate("/")}
      />
    );
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <div>
          <p className="eyebrow">Dino Park Engineer</p>
          <h1>{resolution.title}</h1>
        </div>
        <p className="mode-badge">Mode: {resolution.mode}</p>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        <button type="button" onClick={() => navigate("/")}>Park View</button>
        <button type="button" onClick={() => navigate("/shell-lab")}>Shell diagnostics</button>
      </nav>
      <main id="main-content" tabIndex={-1}>
        {resolution.kind === "not-found" ? (
          <NotFoundSurface
            pathname={resolution.pathname}
            onSafeRoute={() => navigate(resolution.safePath ?? "/")}
          />
        ) : loadFailure !== undefined ? (
          resolution.feature.requirement === "required" ? (
            <FailureSurface
              code={resolution.feature.failure.diagnosticCode}
              title={resolution.feature.failure.title}
              message={resolution.feature.failure.message}
              onRetry={retry}
              onSafeRoute={() => navigate("/")}
            />
          ) : (
            <OptionalFeatureFailureSurface
              code={resolution.feature.failure.diagnosticCode}
              title={resolution.feature.failure.title}
              message={resolution.feature.failure.message}
              onRetry={retry}
              onSafeRoute={() => navigate("/")}
            />
          )
        ) : loadedFeature === undefined ? (
          <BootSurface />
        ) : (
          <FeatureBoundary
            onError={() => setLoadFailure(new Error("Feature render failed."))}
          >
            {createElement(loadedFeature.render)}
          </FeatureBoundary>
        )}
      </main>
      <ShellControls
        preferences={preferences}
        setPreferences={(patch) => accessibility.setPreferences(patch)}
        persistence={persistence}
        offline={offline}
        offlineState={offlineState}
        activateServiceWorker={async (): Promise<void> => {
          await updateServiceWorker.current?.(true);
        }}
        addHistory={(message) => setEventHistory((items) => [...items, message])}
      />
      <aside className="event-history" aria-labelledby="history-heading">
        <h2 id="history-heading">Shell event history</h2>
        <ol>{eventHistory.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ol>
      </aside>
      <footer>
        <p>Build <code>{BUILD_ID}</code> · Base <code>{basePath}</code></p>
      </footer>
    </div>
  );
}

interface ShellControlsProps {
  readonly preferences: AccessibilityPreferences;
  readonly setPreferences: (patch: Partial<AccessibilityPreferences>) => unknown;
  readonly persistence: PersistencePort;
  readonly offline: OfflineUpdateCoordinator;
  readonly offlineState: OfflineUpdateState;
  readonly activateServiceWorker: () => Promise<void>;
  readonly addHistory: (message: string) => void;
}

function ShellControls({
  preferences,
  setPreferences,
  persistence,
  offline,
  offlineState,
  activateServiceWorker,
  addHistory,
}: ShellControlsProps): React.JSX.Element {
  const [unsafe, setUnsafe] = useState(false);
  const applyUpdate = async (): Promise<void> => {
    const result = await offline.applyUpdate();
    if (result.status === "deferred") {
      addHistory("Update deferred: mutable session state is not checkpointed.");
      return;
    }
    if (result.status === "activated") {
      addHistory("Update activated after a safe checkpoint.");
      await activateServiceWorker();
      return;
    }
    addHistory(`Update ${result.status}: ${"code" in result ? result.code : "unknown"}.`);
  };

  return (
    <section className="shell-controls" aria-labelledby="controls-heading">
      <h2 id="controls-heading">Shell preferences and updates</h2>
      <div className="control-grid">
        <label>
          <input
            type="checkbox"
            checked={preferences.reducedMotion}
            onChange={(event) => setPreferences({ reducedMotion: event.currentTarget.checked })}
          /> Reduced motion
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.highContrast}
            onChange={(event) => setPreferences({ highContrast: event.currentTarget.checked })}
          /> High contrast
        </label>
        <label>
          Text size
          <select
            value={preferences.textScale}
            onChange={(event) => setPreferences({ textScale: Number(event.currentTarget.value) })}
          >
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={unsafe}
            onChange={(event) => {
              const pending = event.currentTarget.checked;
              setUnsafe(pending);
              persistence.markMutableSessionStatePending(pending);
            }}
          /> Mutable session state pending
        </label>
      </div>
      <OfflineStatus state={offlineState} />
      {offlineState.state === "install" ? (
        <button type="button" onClick={() => void offline.install()}>Prepare offline assets</button>
      ) : null}
      {offlineState.state === "update-ready" ? (
        <button type="button" onClick={() => void applyUpdate()}>Apply safe update</button>
      ) : null}
      {offlineState.state === "failure" ? (
        <button type="button" onClick={() => void offline.retry()}>Retry update</button>
      ) : null}
    </section>
  );
}

function describeOfflineState(state: OfflineUpdateState): string {
  switch (state.state) {
    case "install":
      return "Offline assets require first installation.";
    case "offline-ready":
      return `Offline assets ready for ${state.version}.`;
    case "update-ready":
      return `Update ${state.availableVersion} is ready and awaiting a safe checkpoint.`;
    case "failure":
      return `Offline update failure: ${state.failure.code}.`;
  }
}
