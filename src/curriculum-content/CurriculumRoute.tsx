"use client";

import { useState } from "react";
import type { ShellRouteProps } from "../shell/public.ts";
import { Panel, StatusBadge } from "../platform/public.ts";
import { getActiveCurriculumRuntime } from "./runtime.ts";

export function CurriculumRoute({ navigate }: ShellRouteProps) {
  const runtime = getActiveCurriculumRuntime();
  const [revision, setRevision] = useState(0);
  if (!runtime) return <Panel eyebrow="Curriculum" title="Curriculum unavailable"><p>The authored MVP pack is still loading. Reload after providers initialize.</p></Panel>;
  const workflow = runtime.workflow;
  const progress = workflow.state();
  const selected = runtime.pack.phases.find((item) => item.phase === progress.phase) ?? runtime.pack.phases[0];
  const refresh = () => setRevision((value) => value + 1);
  const act = (action: () => unknown) => { action(); refresh(); };
  const actAsync = async (action: () => Promise<unknown>) => { await action(); refresh(); };
  const firstRunStatuses = progress.firstRun?.results.map((result) => `${result.ref.id}: ${result.status}`) ?? [];
  const passingStatuses = progress.passingRun?.results.map((result) => `${result.ref.id}: ${result.status}`) ?? [];

  return (
    <div style={{ display: "grid", gap: "1rem" }} data-curriculum-revision={revision}>
      <Panel eyebrow="MVP Curriculum" title="Operate the park by engineering the system">
        <p>Progression teaches Prompt → Skill → System Prompt → Context → Evals → Review → Memory → Agents → Manager. Objectives unlock phases in order; locked phases cannot be entered directly.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }} aria-label="Curriculum phases">
          {runtime.pack.phases.map((item) => <button type="button" key={item.phase} onClick={() => act(() => workflow.enterPhase(item.phase))} aria-pressed={progress.phase === item.phase} disabled={item.phase > progress.maxUnlockedPhase}>{item.phase}. {item.title}{item.phase > progress.maxUnlockedPhase ? " · locked" : ""}</button>)}
        </div>
      </Panel>

      {selected ? <Panel eyebrow={`Phase ${selected.phase}`} title={selected.title}>
        <p><strong>Pressure:</strong> {selected.pressure}</p>
        <p><strong>Lesson:</strong> {selected.lesson}</p>
        <p><strong>Objective:</strong> {selected.objectives[0]?.description}</p>
        <p><strong>Recovery:</strong> {selected.recovery.label} · {selected.recovery.preventsDeadEnd ? "Available" : "Unavailable"}</p>
        <p><button type="button" disabled={!progress.objectiveReady} onClick={() => act(workflow.completeCurrentObjective)}>Complete evidenced objective and unlock next phase</button></p>
      </Panel> : null}

      <Panel eyebrow="First vertical slice" title="Run the complete engineering loop">
        <p>Every control below calls the production Trace, Workbench commission, Review, Eval, Economy, deployment, and replay services. Disabled controls show the enforced order.</p>
        <ol>
          <li><button type="button" disabled={progress.maxUnlockedPhase < 1} onClick={() => act(workflow.runUnsafe)}>Accept and run unsafe Rex job</button> {progress.productionJobId ? <><StatusBadge status="error" label={progress.productionJobStatus ?? "INCIDENT"} /> <code>{progress.productionJobId}</code></> : null}</li>
          <li><button type="button" disabled={!progress.unsafeTraceId} onClick={() => act(workflow.inspectTrace)}>Inspect missing postcondition</button> {progress.unsafeTraceId ? <><button type="button" onClick={() => navigate(`/traces/${progress.unsafeTraceId}`)}>Open production trace</button> <span>Production incident <code>{progress.productionIncidentId}</code> · trace <code>{progress.productionTraceId}</code></span></> : null}</li>
          <li><button type="button" disabled={!progress.traceInspected} onClick={() => act(workflow.commission)}>Commission safe-feeding Skill</button> {progress.commissionedRef ? <code>{progress.commissionedRef.artifactId}@{progress.commissionedRef.version}</code> : null}</li>
          <li><button type="button" disabled={!progress.reviewId} onClick={() => act(workflow.inspectReview)}>Inspect review and select three Evals</button> {progress.reviewId ? <button type="button" onClick={() => navigate(`/reviews?review=${encodeURIComponent(progress.reviewId!)}`)}>Open review</button> : null}</li>
          <li><button type="button" disabled={!progress.reviewAnalyzed} onClick={() => act(workflow.buildStarterEvals)}>Build three starter Evals</button> <span>{progress.builtEvalRefs.length}/3 built</span></li>
          <li><button type="button" disabled={progress.builtEvalRefs.length !== 3} onClick={() => void actAsync(workflow.runIntentionalFailure)}>Run intentional v1 failure</button>{firstRunStatuses.length > 0 ? <ul>{firstRunStatuses.map((status) => <li key={status}>{status}</li>)}</ul> : null}</li>
          <li><button type="button" disabled={!progress.firstRun?.results.some((result) => result.status === "FAILED")} onClick={() => act(workflow.revise)}>Revise with gate-jam escalation</button> {progress.revisionRef ? <code>{progress.revisionRef.artifactId}@{progress.revisionRef.version}</code> : null}</li>
          <li><button type="button" disabled={!progress.revisionRef} onClick={() => void actAsync(workflow.runRevision)}>Rerun revised suite</button>{passingStatuses.length > 0 ? <ul>{passingStatuses.map((status) => <li key={status}>{status}</li>)}</ul> : null}</li>
          <li><button type="button" disabled={!progress.passingRun?.results.every((result) => result.status === "PASSED")} onClick={() => act(workflow.deploy)}>Deploy exact passing revision</button> {progress.deployedRef ? <StatusBadge status="success" label={`DEPLOYED v${progress.deployedRef.version}`} /> : null}</li>
          <li><button type="button" disabled={!progress.deployedRef} onClick={() => void actAsync(workflow.replaySafe)}>Rerun same production Rex job and replay</button> {progress.productionRerunJobId ? <><StatusBadge status={progress.productionRerunStatus === "SUCCEEDED" && progress.replay?.status === "EXACT" ? "success" : "error"} label={`${progress.productionRerunStatus} · ${progress.replay?.status}`} /> job <code>{progress.productionRerunJobId}</code> · trace <code>{progress.productionRerunTraceId}</code></> : null}</li>
        </ol>
        <p role="status" aria-live="polite">{progress.message}</p>
      </Panel>

      <Panel eyebrow="Advanced progression" title="Memory, workers, Manager, and scale">
        <p>These evidence-producing lessons unlock phases 8–10 in order; their buttons remain unavailable until the prior objective is complete.</p>
        <ol>
          <li><button type="button" disabled={progress.phase !== 7} onClick={() => act(workflow.runMemoryLesson)}>Diagnose stale and conflicting memory</button> {progress.memoryLesson ? <StatusBadge status={progress.memoryLesson.directObservationWins ? "success" : "error"} label="Fresh observation wins" /> : null}</li>
          <li><button type="button" disabled={progress.phase !== 8} onClick={() => act(workflow.runParallelLesson)}>Run coordinated worker simulation</button> {progress.parallelLesson ? <span>{progress.parallelLesson.lateRuns.length} safe runs</span> : null}</li>
          <li><button type="button" disabled={progress.phase !== 9} onClick={() => act(workflow.runManagerLesson)}>Evaluate authored Manager configuration</button> {progress.managerLesson ? <StatusBadge status={progress.managerLesson.passed && progress.managerLesson.exact ? "success" : "error"} label={progress.managerLesson.configRef} /> : null}</li>
          <li><button type="button" disabled={progress.phase !== 10} onClick={() => act(workflow.runScaleLesson)}>Compare scaled intervention runs</button> {progress.scaleLesson ? <span>{progress.scaleLesson.earlyInterventions} → {progress.scaleLesson.lateInterventions} interventions</span> : null}</li>
        </ol>
      </Panel>

      <Panel eyebrow="Measured learning" title="Context and scale comparisons">
        <p>Centralized policy: {runtime.acceptance.policyRefactor.duplicatedLoad} CU duplicated → {runtime.acceptance.policyRefactor.refactoredLoad} CU using the Context Minimizer and one System Prompt.</p>
        <p>Simulated interventions: {runtime.acceptance.scaleComparison.earlyInterventions} early → {runtime.acceptance.scaleComparison.lateInterventions} at phase 10 across three deterministic runs.</p>
        <p><button type="button" onClick={() => navigate("/")}>Open Park</button> <button type="button" onClick={() => navigate("/evals")}>Open Evals</button> <StatusBadge status={runtime.acceptance.valid ? "success" : "error"} label={runtime.acceptance.valid ? "Pack validated" : "Pack blocked"} /></p>
      </Panel>
    </div>
  );
}
