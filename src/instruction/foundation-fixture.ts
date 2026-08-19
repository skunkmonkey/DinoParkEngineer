import type { ContentReference } from "../content-registry/public.js";
import type { StableId, WorldCommand } from "../simulation/public.js";
import type { InstructionArtifactData, ResolvedInstructionArtifact } from "./types.js";

const ref = (id: string, version = "1.0.0"): ContentReference => ({ id, version });
const id = (value: string): StableId => value as StableId;

const openGateCommand: WorldCommand = {
  id: id("command:instruction-open-gate"),
  kind: "operate-gate",
  expectedTick: 0,
  actorId: id("robot:alpha"),
  gateId: id("gate:alpha"),
  operation: "open",
  tool: ref("tool:gate-control"),
};

const baseData = (knownTradeoffs: readonly string[]): InstructionArtifactData => ({
  schemaVersion: "1",
  requiredTools: [ref("tool:gate-control")],
  knownTradeoffs,
  clauses: [{
    id: "clause:open-for-feeding",
    type: "action",
    applicability: { operator: "fact-equals", fact: "task.kind", value: "feed" },
    priority: 100,
    requiredFacts: ["task.kind", "gate.position"],
    preconditions: [{ operator: "fact-equals", fact: "gate.position", value: "closed" }],
    postconditions: [{ operator: "fact-equals", fact: "gate.position", value: "open" }],
    conflictGroup: "gate-action",
    conflictResolution: "stop",
    outcome: { kind: "tool-request", command: openGateCommand },
  }],
});

const artifact = (
  identity: string,
  artifactClass: ResolvedInstructionArtifact["class"],
  readableSource: string,
  data: InstructionArtifactData,
  contextCost: number,
  dependencies: readonly ContentReference[] = [],
): ResolvedInstructionArtifact => ({
  reference: ref(identity),
  class: artifactClass,
  readableSource,
  author: "Park Engineering",
  contextCost,
  dependencies,
  requiredTools: data.requiredTools,
  clauses: data.clauses,
  knownTradeoffs: data.knownTradeoffs,
});

export const createInstructionFoundationFixture = (): {
  readonly selfContained: ResolvedInstructionArtifact;
  readonly proseVariant: ResolvedInstructionArtifact;
  readonly modularPrompt: ResolvedInstructionArtifact;
  readonly feedingSkill: ResolvedInstructionArtifact;
  readonly containmentPolicy: ResolvedInstructionArtifact;
  readonly degradedVerification: ResolvedInstructionArtifact;
} => {
  const selfContainedData = baseData(["Higher routine Context cost", "No Skill dependency"]);
  const selfContained = artifact("prompt:self-contained-feeding", "Prompt", "Open the gate only for the assigned feeding route.", selfContainedData, 12);
  const proseVariant = artifact("prompt:self-contained-feeding-prose-variant", "Prompt", "A politely reworded explanation that has no behavioral authority.", selfContainedData, 12);
  const skillData = baseData(["Lower repeated Context cost", "Depends on an exact Skill version"]);
  const feedingSkill = artifact("skill:safe-feeding", "Skill", "Reusable containment-aware feeding steps.", skillData, 5);
  const modularPrompt = artifact("prompt:modular-feeding", "Prompt", "Apply the exact safe-feeding Skill.", { ...skillData, clauses: [{ ...skillData.clauses[0]!, id: "clause:route-feeding-skill", priority: 90 }] }, 3, [ref("skill:safe-feeding")]);
  const containmentPolicy = artifact("policy:containment", "Policy", "Containment must be established with acceptable evidence.", {
    schemaVersion: "1", requiredTools: [ref("tool:gate-observe")], knownTradeoffs: ["Requires verification evidence"], clauses: [{
      id: "clause:verify-containment", type: "verification", applicability: { operator: "fact-equals", fact: "task.stage", value: "verify" }, priority: 200,
      requiredFacts: ["task.stage"], preconditions: [], postconditions: [], conflictGroup: "containment-verification", conflictResolution: "stop",
      outcome: { kind: "complete", reasonCode: "CONTAINMENT_VERIFIED" }, verification: {
        claim: { sourceId: "gate:alpha", field: "position", expected: "closed" }, acceptableSources: ["physical-gate", "gate-sensor"], acceptableReliability: ["direct", "healthy"],
        maxAgeTicks: 1, minimumAgreement: 1, maxRetries: 1, failureOutcome: { kind: "tool-request", command: { ...openGateCommand, id: id("command:instruction-observe-gate"), kind: "observe-gate", tool: ref("tool:gate-observe") } },
      },
    }],
  }, 4);
  const degradedVerification = artifact("verification:gate-closure", "Verification", "Use fresh reliable gate evidence and escalate unresolved disagreement.", {
    schemaVersion: "1", requiredTools: [ref("tool:gate-observe")], knownTradeoffs: ["May stop instead of assuming a degraded reading is correct"], clauses: [{
      ...containmentPolicy.clauses[0]!, id: "clause:degraded-gate-verification", priority: 210,
      verification: { ...containmentPolicy.clauses[0]!.verification!, maxRetries: 0, failureOutcome: { kind: "escalate", reasonCode: "GATE_EVIDENCE_UNRELIABLE", target: "agent:manager" } },
    }],
  }, 3);
  return { selfContained, proseVariant, modularPrompt, feedingSkill, containmentPolicy, degradedVerification };
};
