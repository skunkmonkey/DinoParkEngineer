import type { ArtifactCandidate } from "../engineering-workbench/public.js";
import { runOpeningMaintenanceContextEval } from "../eval-runner/public.js";
import { createInstructionFoundationFixture } from "../instruction/public.js";
import { createReviewDeployment } from "./engine.js";

export const REVIEW_DEPLOYMENT_FOUNDATION_SLOT = Object.freeze({ slot: "feeding", scope: "park" });

export const createReviewDeploymentFoundationFixture = () => {
  const instruction = createInstructionFoundationFixture();
  const candidateArtifact = {
    ...instruction.selfContained,
    reference: { id: instruction.selfContained.reference.id, version: "2.0.0" },
    readableSource: "Before feeding, include exact gate maintenance Context and verify containment.",
    contextCost: 14,
    dependencies: [{ id: "knowledge:gate-maintenance", version: "1.0.0" }],
  };
  const candidate: ArtifactCandidate = {
    id: "candidate:opening-context-fix", reference: candidateArtifact.reference,
    baseVersion: instruction.selfContained.reference, requestId: "work:opening-context-fix",
    goal: "Route maintenance Context before feeding", readableSource: candidateArtifact.readableSource,
    clauses: candidateArtifact.clauses, contextRoutes: ["route:gate-maintenance"],
    changeSummary: ["Adds the exact maintenance Context dependency before gate action."], productionAffected: false,
  };
  const service = createReviewDeployment();
  const opened = service.createChangeRequest({ id: "review:opening-context-fix", author: "Park Developer Ada", goal: candidate.goal, baseVersion: instruction.selfContained.reference, candidate, baseArtifact: instruction.selfContained, candidateArtifact, createdTick: 10, expectedEffect: "Gate maintenance state becomes available before the feeding decision." });
  if (!opened.ok) throw new Error(opened.diagnostics[0]?.message ?? "Review fixture failed.");
  const result = runOpeningMaintenanceContextEval({ candidate: { reference: candidate.reference, artifactReferences: [candidate.reference], artifacts: [candidateArtifact] } });
  service.selectEvals({ reviewId: opened.value.id, caseReferences: [result.caseReference], tick: 11 });
  return { service, reviewId: opened.value.id, result, candidate, candidateArtifact, baseArtifact: instruction.selfContained };
};

