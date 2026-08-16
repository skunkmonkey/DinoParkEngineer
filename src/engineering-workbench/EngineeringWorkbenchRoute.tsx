"use client";

import { useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { DataTable, EmptyState, Meter, Panel, StatusBadge, TabPanel, Tabs } from "../platform/public.ts";
import type { ArtifactRef, ArtifactType } from "../../content-registry/index.ts";
import type { AssetDetail, AssetSummary, CommissionOffer, StructuredChoice } from "../../engineering-workbench/index.ts";
import { getActiveEconomyProgressionService } from "../economy-progression/public.ts";
import { getActiveWorkbenchRuntime } from "./runtime.ts";
import { getActivePersistenceRuntime } from "../persistence/public.ts";

function refLabel(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function tone(status: string): "success" | "warning" | "error" | "pending" | "neutral" {
  if (status === "DEPLOYED" || status === "PASSED" || status === "AVAILABLE" || status === "COMPLETED") return "success";
  if (status === "REVIEW" || status === "BUILT" || status === "LOCKED" || status === "STALE" || status === "FAILED") return "warning";
  if (status === "DRAFT" || status === "RETIRED" || status === "BLOCKED" || status === "UNAVAILABLE") return "error";
  return "neutral";
}

function ArtifactTypeLabel({ type }: { readonly type: ArtifactType }) {
  return <StatusBadge label={type.replaceAll("_", " ")} status="neutral" />;
}

function summaryCells(asset: AssetSummary, onSelect: () => void, selected: boolean) {
  return [
    <span key="asset"><button type="button" className={selected ? "foundation-button" : "foundation-button foundation-button--secondary"} onClick={onSelect} aria-label={`Inspect ${asset.title} ${refLabel(asset.ref)}`}>{asset.title}</button><br /><code>{asset.artifactId}</code></span>,
    <ArtifactTypeLabel key="type" type={asset.type} />,
    <span key="version">v{asset.version}</span>,
    <span key="status"><StatusBadge label={asset.status} status={tone(asset.status)} /> {asset.current ? <StatusBadge label="current" status="success" /> : asset.deployed ? <StatusBadge label="historical" status="warning" /> : null}</span>,
    <span key="context">{asset.contextBlocked ? <StatusBadge label={`${asset.contextCost} CU · blocked`} status="error" /> : `${asset.contextCost} CU`}</span>,
    <span key="relationships">{asset.evalCount} / {asset.usedByCount}</span>,
  ];
}

function Detail({ detail, tab, setTab, onOpenRef }: { readonly detail: AssetDetail; readonly tab: string; readonly setTab: (value: string) => void; readonly onOpenRef: (ref: ArtifactRef) => void }) {
  const contextTotal = detail.context.reduce((sum, profile) => sum + profile.totalLoad, 0);
  return <>
    <Panel eyebrow="Exact asset" title={`${detail.title} · v${detail.version}`}>
      <p><ArtifactTypeLabel type={detail.type} /> <StatusBadge label={detail.status} status={tone(detail.status)} /> {detail.current ? <StatusBadge label="active exact ref" status="success" /> : detail.deployed ? <StatusBadge label="historical deployed" status="warning" /> : null}</p>
      <p><strong>Exact ref:</strong> <code>{refLabel(detail.ref)}</code> · authored by <code>{detail.authoredByCapability}</code> · created at game time {detail.createdAtGameTime}</p>
      <p><strong>Applicability:</strong> {detail.applicabilityTags.join(", ") || "none"} · <strong>Tools:</strong> {detail.requiredToolIds.join(", ") || "none"}</p>
      {detail.missingTools.length > 0 ? <p><StatusBadge label="missing tools" status="error" /> {detail.missingTools.join(", ")}</p> : null}
    </Panel>
    <Panel eyebrow="Source and behavior" title="Readable source first; semantics on demand">
      <Tabs idPrefix="workbench-detail" tabs={[{ id: "source", label: "Source" }, { id: "clauses", label: "Semantic clauses" }, { id: "context", label: "Context composition" }]} value={tab} onChange={setTab} />
      <TabPanel idPrefix="workbench-detail" tabId="source" active={tab === "source"}><pre style={{ whiteSpace: "pre-wrap", margin: "1rem 0 0", padding: "1rem", borderRadius: ".6rem", background: "#f0f5ed", lineHeight: 1.55 }} aria-label="Artifact source text"><code>{detail.sourceText}</code></pre></TabPanel>
      <TabPanel idPrefix="workbench-detail" tabId="clauses" active={tab === "clauses"}><ol>{detail.clauses.map((clause) => <li key={clause.id} style={{ margin: ".8rem 0" }}><StatusBadge label={clause.type} status="neutral" /> <strong>{clause.sourceText}</strong>{clause.semanticKey ? <small> · key <code>{clause.semanticKey}</code></small> : null}{clause.behavior.length > 0 ? <ul>{clause.behavior.map((line) => <li key={line}><code>{line}</code></li>)}</ul> : null}</li>)}</ol></TabPanel>
      <TabPanel idPrefix="workbench-detail" tabId="context" active={tab === "context"}><div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>{detail.context.map((profile) => <article key={profile.profileId} className="foundation-card"><p><strong>{profile.profileId}</strong> · {profile.mode} · budget {profile.budget} CU</p><Meter label="Projected context" value={profile.totalLoad} max={profile.budget} detail={`${profile.totalLoad} CU`} />{profile.blocked ? <p><StatusBadge label="BLOCKED_CONTEXT_OVERFLOW" status="error" /></p> : null}<details><summary>{profile.items.length} contributing items</summary><ul>{profile.items.map((item) => <li key={`${item.ref}-${item.kind}`}><code>{item.ref}</code> · {item.kind} · {item.contextCost} CU{item.provenance ? ` · ${item.provenance}` : ""}</li>)}</ul></details>{profile.diagnostics.length > 0 ? <ul>{profile.diagnostics.map((item) => <li key={item}>{item}</li>)}</ul> : null}</article>)}</div><p><strong>Context total:</strong> {contextTotal} CU across {detail.context.length} profile(s). The total is supplied by Context Service; Workbench does not tokenize or infer cost.</p></TabPanel>
    </Panel>
    <Panel eyebrow="Architecture impact" title="Dependencies, consumers, and history">
      <div className="foundation-card"><strong>Direct dependencies</strong><p>{detail.dependencies.map(refLabel).join(", ") || "none"}</p><strong>Transitive dependencies</strong><p>{detail.transitiveDependencies.map(refLabel).join(", ") || "none"}</p><strong>Used by</strong><p>{detail.usedBy.map((ref) => `${ref.artifactId}@${ref.version}${ref.kind ? ` · ${ref.kind}` : ""}`).join(", ") || "No known consumers."}</p></div>
      <DataTable caption="Immutable asset history" columns={[{ id: "asset", label: "Version" }, { id: "status", label: "Status" }, { id: "context", label: "Context" }, { id: "coverage", label: "Coverage / consumers" }]} rows={detail.history.map((item) => [<button type="button" key={refLabel(item.ref)} onClick={() => onOpenRef(item.ref)} aria-label={`Open exact historical version ${refLabel(item.ref)}`}>{refLabel(item.ref)}</button>, <StatusBadge key="status" label={item.status} status={tone(item.status)} />, <span key="context">{item.contextCost} CU</span>, <span key="coverage">{item.evalCount} evals · {item.usedByCount} used-by</span>])} />
      {detail.history.length === 0 ? <p>No historical version exists for this artifact identity.</p> : null}
      {detail.reviews.length > 0 ? <p>Review links: {detail.reviews.map((review) => <a key={review.reviewId} href={review.href} style={{ marginRight: ".7rem" }}>{review.reviewId} · {review.state} · r{review.revision}</a>)}</p> : <p>No Review record is associated with this exact version.</p>}
    </Panel>
    <Panel eyebrow="Eval coverage" title={`${detail.evalCoverage.length} authored case${detail.evalCoverage.length === 1 ? "" : "s"}`}>
      {detail.evalCoverage.length === 0 ? <EmptyState title="No direct eval coverage" summary="This exact version has no authored subject evals. Risk remains visible so the player can choose coverage in Reviews / Deploy." /> : <ul>{detail.evalCoverage.map((entry) => <li key={`${entry.ref.id}@${entry.ref.version}`} style={{ margin: ".7rem 0" }}><StatusBadge label={entry.status} status={tone(entry.status)} /> <strong>{entry.title}</strong> · <code>{entry.ref.id}@{entry.ref.version}</code> · build {entry.buildCostCredits} · run {entry.runCostCredits}<p>{entry.description}</p>{entry.lastResult ? <small>Last result: {entry.lastResult.status} · {entry.lastResult.assertions.filter((assertion) => assertion.passed).length}/{entry.lastResult.assertions.length} assertions passed.</small> : null}</li>)}</ul>}
    </Panel>
  </>;
}

function CommissionCard({ offer, onConfirm, busy, selections, onChoiceChange }: { readonly offer: CommissionOffer; readonly onConfirm: () => void; readonly busy: boolean; readonly selections: Readonly<Record<string, string>>; readonly onChoiceChange: (choiceId: string, optionId: string) => void }) {
  return <article className="foundation-card" style={{ display: "grid", gap: ".45rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}><div><h3 style={{ margin: 0 }}>{offer.output.title}</h3><p style={{ margin: ".25rem 0" }}><code>{refLabel(offer.ref)}</code> · output <code>{refLabel(offer.output)}</code></p></div><StatusBadge label={offer.status} status={tone(offer.status)} /></div>
    <p>{offer.goal}</p><p><strong>Family:</strong> {offer.family ?? offer.output.type} · <strong>Cost:</strong> {offer.costCredits} credits · <strong>Requirement:</strong> {offer.capabilityRequirement ?? "none"} · <strong>Phase:</strong> {offer.requiredPhase ?? "any"}</p>
    {offer.choices.length > 0 ? <fieldset><legend>Structured authored choices</legend>{offer.choices.map((choice) => <label key={choice.id} style={{ display: "grid", gap: ".25rem", margin: ".65rem 0" }}>{choice.label}<select value={selections[choice.id] ?? choice.options[0]?.id ?? ""} onChange={(event) => onChoiceChange(choice.id, event.target.value)}>{choice.options.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.description}</option>)}</select></label>)}</fieldset> : <p>No choices; authored output is fixed.</p>}
    <details><summary>Expected impact</summary><ul>{offer.expectedImpact.sourceChanges.map((item) => <li key={item}>{item}</li>)}{offer.expectedImpact.clauseChanges.map((item) => <li key={item}>{item}</li>)}{offer.expectedImpact.dependencyChanges.map((item) => <li key={item}>{item}</li>)}<li>{offer.expectedImpact.contextNote}</li></ul></details>
    <p><small>{offer.reason}</small></p>
    <button type="button" disabled={offer.status !== "AVAILABLE" || busy} onClick={onConfirm}>{busy ? "Submitting…" : `Confirm commission for ${offer.costCredits} credits`}</button>
  </article>;
}

export function EngineeringWorkbenchRoute({ query }: ShellRouteProps) {
  const runtime = getActiveWorkbenchRuntime();
  const economy = getActiveEconomyProgressionService();
  const persistence = getActivePersistenceRuntime();
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ArtifactType | "ALL">("ALL");
  const [tag, setTag] = useState("ALL");
  const [capability, setCapability] = useState("ALL");
  const [requiredTool, setRequiredTool] = useState("ALL");
  const [deploymentState, setDeploymentState] = useState<"ALL" | "DEPLOYED" | "HISTORICAL" | "REVIEW" | "DRAFT" | "RETIRED">("ALL");
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string>>({});
  const [selectedRef, setSelectedRef] = useState<ArtifactRef | undefined>(() => {
    const artifactId = typeof query.artifact === "string" ? query.artifact : undefined;
    const versionValue = typeof query.version === "string" ? Number(query.version) : undefined;
    return artifactId && typeof versionValue === "number" && Number.isSafeInteger(versionValue) ? { artifactId, version: versionValue } : undefined;
  });
  const [detailTab, setDetailTab] = useState("source");
  const [view, setView] = useState("library");
  const [message, setMessage] = useState("Inspect exact source and architecture before commissioning a change.");
  const [busy, setBusy] = useState(false);
  void revision;

  if (!runtime) return <Panel eyebrow="Engineering Workbench" title="Workbench service unavailable"><p>The public registry/context/economy/review providers have not initialized. Reload after feature providers are ready.</p></Panel>;
  const selected = selectedRef ? runtime.service.getAsset(selectedRef) : undefined;
  const allAssets = runtime.service.listAssets();
  const assets = runtime.service.listAssets({ search, ...(type === "ALL" ? {} : { type }), ...(tag === "ALL" ? {} : { tag }), ...(capability === "ALL" ? {} : { capability }), ...(requiredTool === "ALL" ? {} : { toolId: requiredTool }), ...(deploymentState === "ALL" ? {} : { deploymentState }) });
  const tags = [...new Set(allAssets.flatMap((asset) => asset.applicabilityTags))].sort();
  const capabilitiesInLibrary = [...new Set(allAssets.map((asset) => asset.authoredByCapability))].sort();
  const toolsInLibrary = [...new Set(allAssets.flatMap((asset) => asset.requiredToolIds))].sort();
  const progress = economy?.snapshot();
  const offers = runtime.service.listCommissions(progress);
  const capabilities = runtime.service.capabilities(progress);
  const balance = economy?.balance().amount ?? 0;

  const grouped = (() => {
    const map = new Map<string, number>();
    for (const asset of assets) map.set(asset.type, (map.get(asset.type) ?? 0) + 1);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  const openRef = (ref: ArtifactRef) => { setSelectedRef(ref); setDetailTab("source"); setView("library"); };
  const select = (asset: AssetSummary) => openRef(asset.ref);
  const confirm = async (offer: CommissionOffer) => {
    setBusy(true);
    const choices: readonly StructuredChoice[] = offer.choices.map((choice) => ({ id: choice.id, optionId: choiceSelections[`${refLabel(offer.ref)}:${choice.id}`] ?? choice.options[0]!.id }));
    const tx = `workbench.commission.${offer.ref.artifactId}.${offer.ref.version}`;
    const coordinated = persistence?.workflows
      ? await persistence.workflows.commission(tx, () => { const outcome = runtime.service.commission(offer.ref, choices, tx); if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`); return outcome; })
      : undefined;
    if (coordinated && (!coordinated.ok || !coordinated.value)) { setBusy(false); setMessage(coordinated.error?.message ?? "Commission transaction failed."); return; }
    const result = coordinated?.value ?? runtime.service.commission(offer.ref, choices, tx);
    setBusy(false);
    setMessage(result.ok ? `Commissioned ${refLabel(result.value.proposalRef)} exactly once. Review ${result.value.reviewId} is open; deployed v3 remains unchanged.` : `${result.error.code}: ${result.error.message}${result.error.compensated ? " Credits were compensated." : ""}`);
    setRevision((value) => value + 1);
    if (result.ok) { setSelectedRef(result.value.proposalRef); setView("library"); }
  };

  return <main className="foundation-page" data-revision={revision}>
    <header className="foundation-page__header"><div><p className="foundation-eyebrow">Park Developer / asset control</p><h1>Engineering Workbench</h1><p>Inspect versioned Prompts, Skills, System Prompts, Knowledge, and Tools. Commission authored changes into Review; production remains immutable until the review/deployment workflow activates an exact ref.</p></div><div><StatusBadge label={`${balance} credits`} status="success" /><p><StatusBadge label="No arbitrary prose execution" status="neutral" /></p></div></header>
    <p role="status" aria-live="polite">{message}</p>
    <Panel eyebrow="Workbench views" title="Library, commission, and Park Developer capabilities">
      <Tabs idPrefix="workbench-views" tabs={[{ id: "library", label: "Asset library" }, { id: "commission", label: "Commission catalog" }, { id: "capabilities", label: "Capabilities" }]} value={view} onChange={setView} />
    </Panel>
    <TabPanel idPrefix="workbench-views" tabId="library" active={view === "library"}>
      <Panel eyebrow="Versioned asset library" title={`${assets.length} exact asset${assets.length === 1 ? "" : "s"}`}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "end" }}><label style={{ flex: "1 1 16rem" }}>Search title or ref<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="feeding, context, skill…" /></label><label>Type<select value={type} onChange={(event) => setType(event.target.value as ArtifactType | "ALL")}><option value="ALL">All types</option>{["PROMPT", "SKILL", "SYSTEM_PROMPT", "KNOWLEDGE", "TOOL_DESCRIPTION"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="ALL">All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label><label>Capability<select value={capability} onChange={(event) => setCapability(event.target.value)}><option value="ALL">All capabilities</option>{capabilitiesInLibrary.map((item) => <option key={item}>{item}</option>)}</select></label><label>Required Tool<select value={requiredTool} onChange={(event) => setRequiredTool(event.target.value)}><option value="ALL">All Tools</option>{toolsInLibrary.map((item) => <option key={item}>{item}</option>)}</select></label><label>Deployment state<select value={deploymentState} onChange={(event) => setDeploymentState(event.target.value as typeof deploymentState)}><option value="ALL">All states</option><option value="DEPLOYED">Current deployed</option><option value="HISTORICAL">Historical</option><option value="REVIEW">Review</option><option value="DRAFT">Draft</option><option value="RETIRED">Retired</option></select></label></div>
        <p>{grouped.map(([name, count]) => <span key={name} style={{ marginRight: ".8rem" }}><StatusBadge label={`${name}: ${count}`} status="neutral" /></span>)}</p>
        {assets.length === 0 ? <EmptyState title="No matching assets" summary="Try broader filters. The library never fabricates an asset when a registry version is unavailable." /> : <DataTable caption="Engineering assets" columns={[{ id: "asset", label: "Asset" }, { id: "type", label: "Type" }, { id: "version", label: "Version" }, { id: "status", label: "Status" }, { id: "context", label: "Context" }, { id: "relationships", label: "Evals / used-by" }]} rows={assets.map((asset) => summaryCells(asset, () => select(asset), selected?.ref.artifactId === asset.ref.artifactId && selected?.ref.version === asset.ref.version))} />}
      </Panel>
      {selected ? <Detail detail={selected} tab={detailTab} setTab={setDetailTab} onOpenRef={openRef} /> : <Panel eyebrow="Inspect an exact version" title="Source is the default learning surface"><EmptyState title="Choose an asset" summary="Open a row to inspect source, semantic clauses, Context Service totals, dependencies, Tools, eval coverage, immutable history, and used-by relationships." /></Panel>}
    </TabPanel>
    <TabPanel idPrefix="workbench-views" tabId="commission" active={view === "commission"}>
      <Panel eyebrow="Authored commission catalog" title="Changes enter Review, never production"><p>Recipes are content-defined and versioned. Every source/clause pair is authored together. Confirming a recipe performs one idempotent credit transaction and creates one exact Review proposal.</p><div style={{ display: "grid", gap: "1rem" }}>{offers.map((offer) => <CommissionCard key={refLabel(offer.ref)} offer={offer} selections={Object.fromEntries(offer.choices.map((choice) => [choice.id, choiceSelections[`${refLabel(offer.ref)}:${choice.id}`] ?? choice.options[0]?.id ?? ""]))} onChoiceChange={(choiceId, optionId) => setChoiceSelections((current) => ({ ...current, [`${refLabel(offer.ref)}:${choiceId}`]: optionId }))} onConfirm={() => void confirm(offer)} busy={busy} />)}</div></Panel>
    </TabPanel>
    <TabPanel idPrefix="workbench-views" tabId="capabilities" active={view === "capabilities"}>
      <Panel eyebrow="Single Park Developer" title="Capability levels and unlock reasons"><p>Workbench consumes progression state; it does not purchase or unlock capabilities. There is one Park Developer mechanism—no roster, salaries, candidates, or team management.</p><DataTable caption="Park Developer capability state" columns={[{ id: "capability", label: "Capability" }, { id: "area", label: "Area" }, { id: "state", label: "State" }, { id: "reason", label: "Reason" }]} rows={capabilities.map((capability) => [<strong key="name">{capability.label}</strong>, <span key="area">{capability.area}</span>, <StatusBadge key="state" label={capability.unlocked ? `Unlocked · L${capability.level}` : "Locked"} status={capability.unlocked ? "success" : "warning"} />, <span key="reason">{capability.reason}</span>])} /></Panel>
    </TabPanel>
  </main>;
}
