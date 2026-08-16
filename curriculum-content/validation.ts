import { createContentRegistry } from "../content-registry/index.ts";
import type { ArtifactRef, ArtifactVersion, ContentPack } from "../content-registry/index.ts";
import { canonicalSerialize, validateFixture } from "../simulation/index.ts";
import { stableHash } from "../trace-replay/index.ts";
import { validateManagerConfiguration, type SchedulingWorker } from "../orchestration/index.ts";
import { CURRICULUM_CONTENT_PACK } from "./pack.ts";
import { CURRICULUM_PHASES } from "./phases.ts";
import type { CurriculumContentPack, CurriculumPackValidation } from "./types.ts";

function refKey(ref: ArtifactRef): string {
  return `${ref.artifactId}@${ref.version}`;
}

function sourceAgreement(artifact: ArtifactVersion): string[] {
  const sourceWords = new Set(artifact.sourceText.toLocaleLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4));
  return artifact.clauses.flatMap((clause) => {
    const clauseWords = clause.sourceText.toLocaleLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
    const overlap = clauseWords.filter((word) => sourceWords.has(word));
    return overlap.length >= Math.min(2, clauseWords.length) ? [] : [`${refKey(artifact)} sourceText has no corresponding claim for clause ${clause.id}`];
  });
}

/** Validates the authored pack and its cross-feature public contracts. */
export function validateCurriculumPack(pack: CurriculumContentPack = CURRICULUM_CONTENT_PACK): CurriculumPackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registry = createContentRegistry();
  const result = registry.loadPack(pack as ContentPack);
  if (!result.ok) errors.push(...result.error.map((item) => `${item.code}: ${item.path}: ${item.message}`));
  for (const artifact of pack.artifacts) errors.push(...sourceAgreement(artifact));
  if (pack.artifacts.filter((item) => item.type === "SKILL" || item.type === "SYSTEM_PROMPT").length < 8) errors.push("MVP requires at least eight Skill/System Prompt artifacts.");
  if ((pack.evals?.length ?? 0) < 12) errors.push("MVP requires at least twelve authored evals.");
  if ((pack.scenarios?.length ?? 0) < 11) errors.push("MVP curriculum requires one scenario for each phase 0 through 10.");
  const phases = pack.phases ?? CURRICULUM_PHASES;
  if (phases.length !== 11 || phases.map((item) => item.phase).join(",") !== "0,1,2,3,4,5,6,7,8,9,10") errors.push("Curriculum phases must cover exactly 0 through 10 in order.");
  const refs = new Set(pack.artifacts.map(refKey));
  for (const phase of phases) {
    for (const ref of phase.availableRefs) if (!refs.has(refKey(ref))) errors.push(`${phase.id} references missing artifact ${refKey(ref)}`);
    for (const ref of phase.availableEvalRefs) if (!(pack.evals ?? []).some((item) => item.id === ref.artifactId && item.version === ref.version)) errors.push(`${phase.id} references missing eval ${refKey(ref)}`);
    if (!phase.recovery.preventsDeadEnd) warnings.push(`${phase.id} has no explicit dead-end recovery flag.`);
  }
  for (const scenario of pack.scenarios ?? []) {
    const fixtureErrors = validateFixture(scenario.fixture);
    if (fixtureErrors.length > 0) errors.push(`${scenario.id} fixture invalid: ${fixtureErrors.map((item) => item.path).join(", ")}`);
    for (const ref of scenario.artifactRefs ?? []) if (!refs.has(refKey(ref))) errors.push(`${scenario.id} references missing artifact ${refKey(ref)}`);
  }
  const managerWorkers: readonly SchedulingWorker[] = [
    { id: "agent.keeper01", role: "KEEPER", contextBudget: 12_000, tools: ["move_to", "observe", "dispense_food", "close_gate", "lock_gate"] },
    { id: "agent.security01", role: "SECURITY", contextBudget: 12_000, tools: ["observe", "alert_security", "evacuate_visitors", "rescue_visitors"] },
    { id: "agent.maintenance01", role: "MAINTENANCE", contextBudget: 12_000, tools: ["observe", "alert_security"] },
  ];
  for (const manager of pack.managerConfigs ?? []) {
    const result = validateManagerConfiguration(manager, managerWorkers, {}, registry);
    if (!result.valid) errors.push(...result.errors.map((item) => `${manager.id}@${manager.version}: ${item.path}: ${item.message}`));
  }
  if (pack.artifacts.some((artifact) => artifact.type === "PROMPT" && artifact.artifactId.endsWith("carnivore-unsafe")) && !pack.artifacts.some((artifact) => artifact.artifactId.endsWith("safe-carnivore-feeding") && artifact.type === "SKILL")) errors.push("Carnivore feeding evolution is incomplete.");
  if (!(pack.evals ?? []).some((item) => item.title === "Gate fails to close")) errors.push("Gate Fails to Close eval is required for the intentional revision failure.");
  if (!(pack.evals ?? []).some((item) => item.title === "Stale enclosure status")) errors.push("Stale-context memory lesson eval is required.");
  if (!(pack.evals ?? []).some((item) => item.title === "Conflicting manager command")) errors.push("Conflicting manager lesson eval is required.");
  if (pack.balance.openingCredits < 2_000 || pack.balance.recovery.floor <= 0 || pack.balance.recovery.assistanceAmount <= 0) errors.push("Economy recovery policy must prevent dead-end saves.");
  const manifestHash = stableHash({ manifest: result.ok ? result.value : undefined, phases, balance: pack.balance });
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)].sort()),
    warnings: Object.freeze([...new Set(warnings)].sort()),
    counts: Object.freeze({ phases: phases.length, artifacts: pack.artifacts.length, skillsAndPolicies: pack.artifacts.filter((item) => item.type === "SKILL" || item.type === "SYSTEM_PROMPT").length, evals: pack.evals?.length ?? 0, scenarios: pack.scenarios?.length ?? 0 }),
    manifestHash,
  });
}

export function assertCurriculumPack(pack: CurriculumContentPack = CURRICULUM_CONTENT_PACK): CurriculumPackValidation {
  const validation = validateCurriculumPack(pack);
  if (!validation.valid) throw new Error(`Curriculum pack validation failed: ${validation.errors.join("; ")}`);
  return validation;
}

export function curriculumManifestHash(pack: CurriculumContentPack = CURRICULUM_CONTENT_PACK): string {
  return stableHash(canonicalSerialize(pack));
}
