"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { DataTable, EmptyState, Meter, Panel, SeverityBadge, SemanticStatusBadge, StatusBadge, TabPanel, Tabs, NotificationRegion } from "../ui/components.tsx";
import { formatContextUnits, formatCredits, formatGameTime } from "../shared/formatters/game.ts";
import { PRIMARY_DESTINATIONS, destinationById, destinationForRoute } from "./destinations.ts";
import type { PrimaryDestination } from "./types.ts";
import { getActivePresentationRegistry } from "./presentationRegistry.ts";
import { SimulationControls } from "./SimulationControls.tsx";
import { useDisplayPreferences } from "./preferences.ts";
import { CANONICAL_GLOSSARY } from "./glossary.ts";
import { getActiveTelemetryClient, TelemetryPrivacyPanel } from "../telemetry/public.ts";
import styles from "./ProductFrame.module.css";

const TELEMETRY_CONSENT_KEY = "dino-park-engineer:telemetry-consent";

function readTelemetryConsent(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(TELEMETRY_CONSENT_KEY) !== "disabled"; } catch { return true; }
}

export function ProductFrameRoute({ route, navigate }: ShellRouteProps) {
  const destination = destinationForRoute(route.id);
  return <ProductFrame destinationId={destination.id} routeKey={route.id} navigate={navigate} />;
}

export function ProductFrame({
  destinationId,
  routeKey,
  navigate,
  heading,
  lede,
  children,
}: {
  readonly destinationId: PrimaryDestination;
  readonly routeKey: string;
  readonly navigate: (href: string) => void;
  readonly heading?: string;
  readonly lede?: string;
  readonly children?: ReactNode;
}) {
  const destination = destinationById(destinationId);
  const mainRef = useRef<HTMLElement>(null);
  const telemetry = getActiveTelemetryClient();
  const { preferences, setReducedMotion } = useDisplayPreferences();
  const [telemetryEnabled, setTelemetryEnabled] = useState(readTelemetryConsent);
  const [telemetryPendingCount, setTelemetryPendingCount] = useState(() => telemetry.inspectQueue().entries.length);
  const [telemetryInspection, setTelemetryInspection] = useState<readonly { readonly eventId: string; readonly type: string; readonly logicalTime: number }[] | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [parkTab, setParkTab] = useState("overview");
  const registry = getActivePresentationRegistry();

  useEffect(() => {
    mainRef.current?.focus();
  }, [routeKey]);

  useEffect(() => {
    if (!registry) return;
    return registry.subscribe(() => setRegistryVersion((version) => version + 1));
  }, [registry]);

  useEffect(() => {
    telemetry.setOptionalEnabled(telemetryEnabled);
    const refresh = () => setTelemetryPendingCount(telemetry.inspectQueue().entries.length);
    refresh();
    return telemetry.subscribe(refresh);
  }, [telemetry, telemetryEnabled]);

  const notifications = registry?.getNotifications() ?? [];
  const simulationPort = registry?.getSimulationControlPort() ?? null;
  void registryVersion;

  return (
    <div className={`${styles.frame} ${preferences.reducedMotion ? styles.reducedMotion : ""}`}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <p className={styles.brandKicker}>DINO PARK / ENGINEER</p>
          <p className={styles.brandTitle}>Operations console</p>
        </div>
        <div className={styles.headerMeta}>
          <StatusBadge label="Frame ready" status="success" />
          <span className={styles.buildLabel}>Deterministic core · local</span>
        </div>
      </header>

      <nav className={styles.navigation} aria-label="Primary navigation">
        <div className={styles.desktopNav}>
          {PRIMARY_DESTINATIONS.map((item) => (
            <a
              key={item.id}
              href={item.path}
              className={item.id === destination.id ? styles.navLinkActive : styles.navLink}
              aria-current={item.id === destination.id ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.path);
              }}
            >
              <span className={styles.navIcon} aria-hidden="true">{item.iconLabel.slice(0, 1)}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
        <div className={styles.mobileNav}>
          <button type="button" className={styles.mobileNavTrigger} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>
            <span>Navigate</span><span aria-hidden="true">{mobileMenuOpen ? "−" : "+"}</span>
          </button>
          {mobileMenuOpen ? (
            <div className={styles.mobileNavMenu}>
              {PRIMARY_DESTINATIONS.map((item) => (
                <a key={item.id} href={item.path} className={item.id === destination.id ? styles.navLinkActive : styles.navLink} aria-current={item.id === destination.id ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate(item.path); setMobileMenuOpen(false); }}>
                  <span className={styles.navIcon} aria-hidden="true">{item.iconLabel.slice(0, 1)}</span><span>{item.label}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </nav>

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Global controls and preferences">
          <SimulationControls port={simulationPort} />
          <div className={styles.preferenceBlock}>
            <p className="foundation-eyebrow">Display</p>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
              <span>Reduced motion</span>
            </label>
            <p className={styles.sidebarHint}>Saved on this device. Gameplay state is never stored here.</p>
          </div>
          <div className={styles.preferenceBlock}>
            <TelemetryPrivacyPanel
              enabled={telemetryEnabled}
              pendingCount={telemetryPendingCount}
              inspectedEvents={telemetryInspection}
              onEnabledChange={(enabled) => {
                setTelemetryEnabled(enabled);
                telemetry.setOptionalEnabled(enabled);
                try { window.localStorage.setItem(TELEMETRY_CONSENT_KEY, enabled ? "enabled" : "disabled"); } catch { /* best-effort privacy preference */ }
              }}
              onInspectQueue={() => {
                const snapshot = telemetry.inspectQueue();
                setTelemetryPendingCount(snapshot.entries.length);
                setTelemetryInspection(Object.freeze(snapshot.entries.map(({ event }) => Object.freeze({ eventId: event.eventId, type: event.type, logicalTime: event.logicalTime }))));
              }}
              onClearQueue={() => {
                telemetry.clearQueue();
                setTelemetryPendingCount(0);
                setTelemetryInspection(Object.freeze([]));
              }}
            />
          </div>
          <details className={styles.glossary}>
            <summary>Terminology help</summary>
            <dl>
              {CANONICAL_GLOSSARY.map((entry) => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>)}
            </dl>
          </details>
        </aside>

        <main ref={mainRef} id="main-content" className={styles.main} tabIndex={-1} aria-labelledby="destination-heading">
          <div className={styles.contentHeading}>
            <div>
              <p className="foundation-eyebrow">Destination / {destination.order.toString().padStart(2, "0")}</p>
              <h1 id="destination-heading">{heading ?? destination.label}</h1>
              <p className={styles.lede}>{lede ?? (destination.id === "park" ? "Operate a safer dinosaur park by engineering the systems behind autonomous work." : "This destination is registered in the product frame and waiting for its feature module.")}</p>
            </div>
            <div className={styles.headingStatus}><StatusBadge label="No external model required" status="success" /><span>{formatGameTime(0)}</span></div>
          </div>

          {children ?? (destination.id === "park" ? <ParkHome tab={parkTab} onTabChange={setParkTab} /> : <DestinationPlaceholder destination={destination.label} />)}
        </main>
      </div>

      <NotificationRegion notifications={notifications} />
      <footer className={styles.footer}><span>Platform Foundation</span><span>·</span><span>Presentation only · world state belongs to downstream features</span></footer>
    </div>
  );
}

function ParkHome({ tab, onTabChange }: { readonly tab: string; readonly onTabChange: (tab: string) => void }) {
  return (
    <div className={styles.contentGrid}>
      <Panel eyebrow="Command surface" title="Park operations, ready for integration" className={styles.heroPanel}>
        <div className={styles.heroPanelBody}>
          <div>
            <p className={styles.heroTitle}>Engineer reliable autonomy.</p>
            <p className={styles.panelCopy}>The Park Operations feature will connect live jobs, dinosaurs, visitors, and incidents here. Until then, this frame stays honest and provides the controls every destination shares.</p>
          </div>
          <div className={styles.schematic} aria-label="Park schematic placeholder" role="img">
            <span className={styles.schematicLabel}>PARK SCHEMATIC</span>
            <span className={`${styles.schematicNode} ${styles.schematicNodeOne}`}>A</span>
            <span className={`${styles.schematicNode} ${styles.schematicNodeTwo}`}>B</span>
            <span className={`${styles.schematicNode} ${styles.schematicNodeThree}`}>C</span>
            <span className={styles.schematicLine} />
          </div>
        </div>
        <div className={styles.heroSignals}>
          <div><StatusBadge label="Awaiting provider" status="warning" /><span>Simulation state</span></div>
          <div><StatusBadge label="No data loaded" status="neutral" /><span>World snapshot</span></div>
          <div><StatusBadge label="Ready" status="success" /><span>Navigation shell</span></div>
        </div>
      </Panel>

      <Panel eyebrow="Shared vocabulary" title="Inspect the system surface">
        <Tabs idPrefix="park-inspection" tabs={[{ id: "overview", label: "Overview" }, { id: "concepts", label: "Concepts" }]} value={tab} onChange={onTabChange} />
        <TabPanel idPrefix="park-inspection" tabId="overview" active={tab === "overview"}>
          <div className={styles.metricStack}>
            <Meter label="Foundation surface" value={6} max={6} detail="6 destinations" />
            <Meter label="Simulation connection" value={0} max={1} detail="Optional" />
            <Meter label="Context display" value={0} max={1} detail="Downstream" />
          </div>
        </TabPanel>
        <TabPanel idPrefix="park-inspection" tabId="concepts" active={tab === "concepts"}>
          <ul className={styles.conceptList}>
            <li><strong>Prompt</strong><span>Task-specific instruction for one job.</span></li>
            <li><strong>Skill</strong><span>Reusable behavior that can be evaluated and deployed.</span></li>
            <li><strong>Manager Agent</strong><span>Delegates work with explicit authority and reporting rules.</span></li>
          </ul>
        </TabPanel>
      </Panel>

      <Panel eyebrow="Operational view" title="No live jobs yet">
        <DataTable caption="Park job queue" columns={[{ id: "job", label: "Job" }, { id: "owner", label: "Owner" }, { id: "state", label: "State" }]} rows={[[<span key="job">Awaiting Park Operations</span>, <span key="owner">—</span>, <StatusBadge key="state" label="Not connected" status="neutral" />]]} />
        <p className={styles.tableNote}>When a feature registers its route and provider, this table can consume its public presentation ports without changing the frame.</p>
      </Panel>

      <Panel eyebrow="Engineering economics" title="Context is visible by design">
        <div className={styles.creditCallout}><span>Example display contract</span><strong>{formatContextUnits(5200)} / 8.0k budget</strong><span>{formatCredits(12480)} park credits</span></div>
        <p className={styles.panelCopy}>These are formatter examples only; Platform Foundation never owns gameplay state or balances.</p>
        <div className={styles.presentationExamples} aria-label="Status presentation examples">
          <SeverityBadge severity={2} />
          <SemanticStatusBadge status="passed" />
          <SemanticStatusBadge status="failed" />
          <SemanticStatusBadge status="stale" />
          <SemanticStatusBadge status="conflict" />
          <SemanticStatusBadge status="blocked" />
        </div>
      </Panel>
    </div>
  );
}

function DestinationPlaceholder({ destination }: { readonly destination: string }) {
  return (
    <Panel eyebrow="Feature module" title={`${destination} is ready to connect`}>
      <EmptyState title="No feature module registered yet" summary="This destination is reachable, keyboard accessible, and refresh safe. It will show real data only after its owning feature registers a route module through Application Shell." />
    </Panel>
  );
}
