import React, { useMemo, useState } from "react";

import { createOpeningCurriculumInventory, createOpeningCurriculumPackage } from "./opening-package.js";
import { validateCurriculumPackage } from "./validator.js";

type TransferStep = "unattempted" | "observed" | "inspected" | "routed" | "succeeded";

export function CurriculumOpeningView(): React.JSX.Element {
  const validated = useMemo(() => validateCurriculumPackage(createOpeningCurriculumPackage(), createOpeningCurriculumInventory()), []);
  const [incidentSeen, setIncidentSeen] = useState(false);
  const [transferStep, setTransferStep] = useState<TransferStep>("unattempted");
  const [assistance, setAssistance] = useState(false);
  if (!validated.ok) return <section role="alert" className="feature-card">Opening content failed exact validation. Core park state was not changed.</section>;
  const pkg = validated.package;
  const transfer = pkg.transfers[0]!;
  const handbook = pkg.handbook[0]!;
  const delayedGuidance = pkg.guidance.find((entry) => entry.id === transfer.delayedAssistance.guidanceId);
  const status = transferStep === "succeeded"
    ? `Transfer succeeded: ${transfer.observableSuccess.eventId}. Bramble was fed safely after the Gamma maintenance record entered Context.`
    : transferStep === "routed" ? "Gamma maintenance Context is routed. Rerun the feeding to produce observable success."
      : transferStep === "inspected" ? "Inspection confirmed content:gamma-maintenance-note was unavailable. Choose whether to route it."
        : transferStep === "observed" ? "Transfer attempt paused safely: Gamma maintenance Context was not routed. Optional delayed assistance is now available."
          : "Transfer has not started. Opening click-by-click guidance is disabled.";

  return <section className="curriculum-experience" aria-labelledby="curriculum-heading">
    <header className="player-mode-frame"><div><p className="eyebrow">Scenarios · Production paused</p><h2 id="curriculum-heading">Practice on a new paddock</h2><p>Apply the maintenance-context lesson without opening guidance.</p></div><div className="player-mode-mark" aria-label="Current mode: curriculum opening and transfer"><span aria-hidden="true">◇</span><span>SCENARIO</span></div></header>

    <section className="feature-card" aria-labelledby="opening-run-heading">
      <h3 id="opening-run-heading">Opening recap</h3>
      <ol>{pkg.openingRun.beats.map((beat) => <li key={beat.id}>{beat.action}</li>)}</ol>
      <p className="inspector-success"><strong>Concrete opening result:</strong> {pkg.copy[pkg.openingRun.successCopyId]}</p>
      <button type="button" disabled={incidentSeen} onClick={() => setIncidentSeen(true)}>Record the opening near miss</button>
      {incidentSeen ? <article aria-labelledby="handbook-unlock-heading"><h4 id="handbook-unlock-heading">Handbook unlocked: {handbook.term}</h4><p>{pkg.copy[handbook.definitionCopyId]}</p><p><strong>Your example:</strong> {pkg.copy[handbook.encounteredExampleCopyId]}</p><details><summary>Advanced details</summary><p>Outside Agent Context: yes · trigger <code>outcome:near-miss</code>.</p></details></article> : <p>Handbook entry locked until the near miss is experienced.</p>}
    </section>

    <section className="feature-card" aria-labelledby="transfer-heading">
      <h3 id="transfer-heading">Novel missing-Context transfer: Bramble at Gamma enclosure</h3>
      <dl className="status-grid"><div><dt>Dinosaur</dt><dd>Bramble</dd></div><div><dt>Location</dt><dd>Gamma Paddock</dd></div><div><dt>Changed condition</dt><dd>Gate maintenance</dd></div><div><dt>Guidance</dt><dd>Optional after the first attempt</dd></div></dl>
      <div className="button-row">
        <button type="button" disabled={transferStep !== "unattempted"} onClick={() => setTransferStep("observed")}>Attempt transfer without opening guidance</button>
        <button type="button" disabled={transferStep !== "observed"} onClick={() => setTransferStep("inspected")}>Inspect Gamma transfer Context</button>
        <button type="button" disabled={transferStep !== "inspected"} onClick={() => setTransferStep("routed")}>Route Gamma maintenance note</button>
        <button type="button" disabled={transferStep !== "routed"} onClick={() => setTransferStep("succeeded")}>Rerun Gamma feeding</button>
      </div>
      <button type="button" disabled={transferStep === "unattempted" || assistance} onClick={() => setAssistance(true)}>Show optional delayed transfer hint</button>
      {assistance ? <p className="safe-state"><strong>Optional hint:</strong> {delayedGuidance?.conciseHint} No reward changed.</p> : null}
      <p role="status" aria-live="polite">{status}</p>
      <p>Success means {transfer.observableSuccess.result}, no injuries, and no fatalities.</p><details><summary>Advanced scenario details</summary><dl className="inspector-details"><div><dt>Species</dt><dd><code>{transfer.fixture.speciesId}</code></dd></div><div><dt>Dinosaur / enclosure</dt><dd><code>{transfer.fixture.dinosaurId}</code> · <code>{transfer.fixture.enclosureId}</code></dd></div><div><dt>Gate / source</dt><dd><code>{transfer.fixture.gateId}</code> · <code>{transfer.fixture.maintenanceSourceId}</code></dd></div></dl></details>
    </section>
  </section>;
}
