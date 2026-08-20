import { fingerprint } from "../content-registry/public.js";
import { curriculumPackageSchema } from "./schemas.js";
import type {
  CurriculumDiagnostic,
  CurriculumPackage,
  CurriculumReport,
  CurriculumValidationInventory,
  CurriculumValidationResult,
  ExactContentReference,
  GoldenOutcome,
} from "./types.js";

const identity = (reference: Pick<ExactContentReference, "id" | "version">): string => `${reference.id}@${reference.version}`;
const diagnostic = (code: CurriculumDiagnostic["code"], path: string, message: string): CurriculumDiagnostic => ({ code, path, message });
const lexicalCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const collectReferences = (pkg: CurriculumPackage): readonly { readonly path: string; readonly reference: ExactContentReference }[] => {
  const collected: { path: string; reference: ExactContentReference }[] = [];
  const add = (path: string, references: readonly ExactContentReference[]): void => references.forEach((reference, index) => collected.push({ path: `${path}[${index}]`, reference }));
  add("dependencies", pkg.dependencies);
  pkg.scenarios.forEach((scenario, scenarioIndex) => {
    add(`scenarios[${scenarioIndex}].exactReferences`, scenario.exactReferences);
    scenario.jobs.forEach((job, jobIndex) => {
      add(`scenarios[${scenarioIndex}].jobs[${jobIndex}].task`, [job.task]);
      add(`scenarios[${scenarioIndex}].jobs[${jobIndex}].artifactVersions`, job.artifactVersions);
    });
    add(`scenarios[${scenarioIndex}].contextRoutes`, scenario.contextRoutes.map((route) => route.item));
    add(`scenarios[${scenarioIndex}].incident.responsibleArtifact`, [scenario.incident.responsibleArtifact]);
    add(`scenarios[${scenarioIndex}].workbench`, [scenario.workbench.freeEval, scenario.workbench.candidate, scenario.workbench.review, scenario.workbench.deployment, scenario.workbench.reward]);
  });
  pkg.unlocks.forEach((unlock, index) => add(`unlocks[${index}].grants`, unlock.grants));
  pkg.transfers.forEach((transfer, index) => add(`transfers[${index}].scenario`, [transfer.scenario]));
  pkg.transfers.forEach((transfer, index) => add(`transfers[${index}].fixture`, [transfer.fixture.task, transfer.fixture.speciesKnowledge, transfer.fixture.missingContextRoute.item, transfer.fixture.revisedContextRoute.item]));
  return collected;
};

const validateFingerprint = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  const { fingerprint: supplied, ...unsigned } = pkg;
  const expected = fingerprint(unsigned);
  if (supplied !== expected) diagnostics.push(diagnostic("CURRICULUM_FINGERPRINT_MISMATCH", "fingerprint", `Expected ${expected}, received ${supplied}.`));
};

const validateReferences = (pkg: CurriculumPackage, inventory: CurriculumValidationInventory, diagnostics: CurriculumDiagnostic[]): void => {
  for (const entry of collectReferences(pkg)) {
    const available = inventory.exactReferences.get(identity(entry.reference));
    if (available === undefined) {
      diagnostics.push(diagnostic("CURRICULUM_REFERENCE_MISSING", entry.path, `Exact reference ${identity(entry.reference)} is unavailable.`));
    } else if (available.expectedClass !== entry.reference.expectedClass || available.expectedSchemaVersion !== entry.reference.expectedSchemaVersion) {
      diagnostics.push(diagnostic("CURRICULUM_REFERENCE_MISSING", entry.path, `Exact reference ${identity(entry.reference)} expects ${entry.reference.expectedClass} schema ${entry.reference.expectedSchemaVersion}, but inventory provides ${available.expectedClass} schema ${available.expectedSchemaVersion}.`));
    }
  }
};

const validateEntities = (pkg: CurriculumPackage, inventory: CurriculumValidationInventory, diagnostics: CurriculumDiagnostic[]): void => {
  pkg.scenarios.forEach((scenario, scenarioIndex) => {
    const ids = [
      scenario.entities.hungryDinosaurId, scenario.entities.secondDinosaurId, scenario.entities.workerAgentId, scenario.entities.visitorConvoyId,
      scenario.entities.firstEnclosureId, scenario.entities.secondEnclosureId, scenario.entities.secondGateId,
      ...scenario.jobs.map((job) => job.targetId), ...scenario.jobs.flatMap((job) => job.assignedAgentId === undefined ? [] : [job.assignedAgentId]),
      ...scenario.incident.affectedEntityIds,
    ];
    for (const id of new Set(ids)) if (!inventory.entityIds.has(id)) diagnostics.push(diagnostic("CURRICULUM_ENTITY_MISSING", `scenarios[${scenarioIndex}].entities`, `Entity ${id} is unavailable.`));
  });
  pkg.transfers.forEach((transfer, transferIndex) => {
    const ids = [transfer.fixture.speciesId, transfer.fixture.dinosaurId, transfer.fixture.enclosureId, transfer.fixture.gateId, transfer.fixture.maintenanceSourceId];
    for (const id of ids) if (!inventory.entityIds.has(id)) diagnostics.push(diagnostic("CURRICULUM_ENTITY_MISSING", `transfers[${transferIndex}].fixture`, `Transfer entity ${id} is unavailable.`));
  });
};

const validateAssets = (pkg: CurriculumPackage, inventory: CurriculumValidationInventory, diagnostics: CurriculumDiagnostic[]): void => {
  const declaredBundles = new Set(pkg.assetBundles.map((bundle) => `${bundle.bundleId}@${bundle.bundleVersion}`));
  pkg.scenarios.forEach((scenario, index) => {
    const key = `${scenario.assetDependency.bundleId}@${scenario.assetDependency.bundleVersion}`;
    if (!declaredBundles.has(key)) diagnostics.push(diagnostic("CURRICULUM_ASSET_BUNDLE_MISSING", `scenarios[${index}].assetDependency`, `Scenario bundle ${key} is not declared by its curriculum package.`));
  });
  const dependencies = [...pkg.assetBundles, ...pkg.scenarios.map((scenario) => scenario.assetDependency)];
  dependencies.forEach((bundle, bundleIndex) => {
    const key = `${bundle.bundleId}@${bundle.bundleVersion}`;
    const available = inventory.assetBundles.get(key);
    if (available === undefined) {
      diagnostics.push(diagnostic("CURRICULUM_ASSET_BUNDLE_MISSING", `assetBundles[${bundleIndex}]`, `Approved runtime bundle ${key} is unavailable.`));
      return;
    }
    bundle.requiredAssets.forEach((asset, assetIndex) => {
      if (!available.has(identity(asset))) diagnostics.push(diagnostic("CURRICULUM_ASSET_MISSING", `assetBundles[${bundleIndex}].requiredAssets[${assetIndex}]`, `Required runtime asset ${identity(asset)} is absent from ${key}.`));
    });
  });
};

const validateUnlocks = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  const unlockIds = new Set(pkg.unlocks.map((unlock) => unlock.id));
  const reached = new Set(pkg.unlocks.filter((unlock) => unlock.prerequisites.length === 0).map((unlock) => unlock.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const unlock of pkg.unlocks) if (!reached.has(unlock.id) && unlock.prerequisites.every((id) => reached.has(id))) { reached.add(unlock.id); changed = true; }
  }
  pkg.unlocks.forEach((unlock, index) => {
    const missing = unlock.prerequisites.filter((id) => !unlockIds.has(id));
    if (missing.length > 0) diagnostics.push(diagnostic("CURRICULUM_UNLOCK_UNREACHABLE", `unlocks[${index}].prerequisites`, `Unknown prerequisite unlocks: ${missing.join(", ")}.`));
    if (!reached.has(unlock.id)) diagnostics.push(diagnostic("CURRICULUM_UNLOCK_CYCLE", `unlocks[${index}]`, `Unlock ${unlock.id} is circular or unreachable from a root unlock.`));
  });
};

const validateLinksAndCopy = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  const scenarioIds = new Set(pkg.scenarios.map((scenario) => scenario.id));
  const guidanceIds = new Set(pkg.guidance.map((guidance) => guidance.id));
  const transferIds = new Set(pkg.transfers.map((transfer) => transfer.id));
  const playtestIds = new Set(pkg.playtestTags.map((tag) => tag.id));
  const handbookIds = new Set(pkg.handbook.map((entry) => entry.id));
  const unlockIds = new Set(pkg.unlocks.map((unlock) => unlock.id));
  pkg.arcs.forEach((arc, index) => {
    if (arc.scenarioIds.some((id) => !scenarioIds.has(id)) || !transferIds.has(arc.transferCaseId) || arc.playtestTagIds.some((id) => !playtestIds.has(id))) {
      diagnostics.push(diagnostic("CURRICULUM_TRANSFER_MISSING", `arcs[${index}]`, `Arc ${arc.id} has an unresolved scenario, transfer, or playtest link.`));
    }
  });
  const requiredCopy = new Set<string>();
  pkg.guidance.forEach((guidance, index) => {
    guidance.copyIds.forEach((id) => requiredCopy.add(id));
    if (!guidance.worldCue || !guidance.affordanceEmphasis || !guidance.accessibilityEquivalent) diagnostics.push(diagnostic("CURRICULUM_ACCESSIBILITY_MISSING", `guidance[${index}]`, `Guidance ${guidance.id} lacks an accessible equivalent.`));
  });
  pkg.handbook.forEach((entry, index) => {
    [entry.definitionCopyId, entry.visualGrammarCopyId, entry.encounteredExampleCopyId].forEach((id) => requiredCopy.add(id));
    if (!unlockIds.has(entry.unlockId)) diagnostics.push(diagnostic("CURRICULUM_UNLOCK_UNREACHABLE", `handbook[${index}].unlockId`, `Handbook entry ${entry.id} names an unknown unlock.`));
  });
  pkg.scenarios.forEach((scenario, index) => {
    scenario.guidanceIds.forEach((id) => { if (!guidanceIds.has(id)) diagnostics.push(diagnostic("CURRICULUM_ACCESSIBILITY_MISSING", `scenarios[${index}].guidanceIds`, `Guidance ${id} is unavailable.`)); });
    [scenario.incident.expectedCopyId, scenario.incident.observedCopyId, scenario.incident.consequenceCopyId, scenario.incident.immediateGapCopyId].forEach((id) => requiredCopy.add(id));
    scenario.workbench.choices.forEach((choice) => requiredCopy.add(choice.labelCopyId));
    if (!handbookIds.has(scenario.workbench.handbookEntryId)) diagnostics.push(diagnostic("CURRICULUM_REFERENCE_MISSING", `scenarios[${index}].workbench.handbookEntryId`, `Handbook entry ${scenario.workbench.handbookEntryId} is unavailable.`));
  });
  for (const copyId of requiredCopy) if (pkg.copy[copyId] === undefined) diagnostics.push(diagnostic("CURRICULUM_COPY_MISSING", `copy.${copyId}`, `Required copy ${copyId} is unavailable.`));
};

const validateOpeningGoldens = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  pkg.scenarios.forEach((scenario, index) => {
    const ordered = [...scenario.goldenOutcomes].sort((left, right) => left.order - right.order || lexicalCompare(left.id, right.id));
    const results = ordered.map((outcome) => outcome.result);
    const expected = ["feeding-succeeded", "near-miss-stabilized", "eval-passed", "feeding-succeeded", "park-opened"];
    if (ordered.some((outcome) => outcome.fatalities > 0)) diagnostics.push(diagnostic("CURRICULUM_FATAL_ONBOARDING", `scenarios[${index}].goldenOutcomes`, "Opening content cannot include a fatal outcome."));
    if (ordered.some((outcome, order) => outcome.order !== order) || results.join("|") !== expected.join("|") || ordered.some((outcome) => outcome.fatalities !== 0 || outcome.injuries !== 0 || !outcome.recoverable)) {
      diagnostics.push(diagnostic("CURRICULUM_GOLDEN_INVALID", `scenarios[${index}].goldenOutcomes`, "Opening golden outcomes must be ordered first success, recoverable near miss, free Eval pass, successful rerun, and park opening with no casualties."));
    }
    const missingRoute = scenario.contextRoutes.find((route) => route.item.id === "content:maintenance-policy" && !route.routed);
    const revisedRoute = scenario.contextRoutes.find((route) => route.item.id === "content:maintenance-policy" && route.routed);
    const nearMissJob = scenario.jobs.find((job) => job.expectedOutcomeId === "outcome:near-miss");
    const rerunJob = scenario.jobs.find((job) => job.expectedOutcomeId === "outcome:rerun-success");
    if (scenario.entities.secondGateAutomaticCloser !== "disabled-for-maintenance" || missingRoute === undefined || revisedRoute === undefined || nearMissJob?.contextRouteIds.includes(missingRoute.id) === true || rerunJob?.contextRouteIds.includes(revisedRoute.id) !== true) {
      diagnostics.push(diagnostic("CURRICULUM_GOLDEN_INVALID", `scenarios[${index}].contextRoutes`, "The near miss must omit maintenance state while the revised rerun routes it explicitly."));
    }
  });
};

const validateOpeningRun = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  const contract = pkg.openingRun;
  const targets = contract.beats.map((beat) => beat.targetCumulativeSeconds);
  const strictlyIncreasing = targets.every((target, index) => index === 0 || target > (targets[index - 1] ?? 0));
  if (contract.targetHumanSeconds !== 300 || contract.timingAcceptance !== "human-playtest-required" || !strictlyIncreasing || targets.at(-1) !== contract.targetHumanSeconds) {
    diagnostics.push(diagnostic("CURRICULUM_OPENING_TIMING_INVALID", "openingRun", "The authored opening must target five minutes with increasing beats ending at 300 seconds; human playtesting remains the acceptance gate."));
  }
  const success = pkg.copy[contract.successCopyId];
  if (success === undefined || !/park|visitor|contain|feeding|open/u.test(success.toLowerCase()) || /lesson|curriculum|grade|course|learning complete/u.test(success.toLowerCase())) {
    diagnostics.push(diagnostic("CURRICULUM_SUCCESS_COPY_INVALID", "openingRun.successCopyId", "Opening success copy must state a concrete park improvement without lesson-completion or grading language."));
  }
};

const validateTransfer = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  const opening = pkg.scenarios[0];
  const guidanceIds = new Set(pkg.guidance.map((guidance) => guidance.id));
  pkg.transfers.forEach((transfer, index) => {
    const fixture = transfer.fixture;
    const changedIdentity = opening !== undefined && fixture.dinosaurId !== opening.entities.hungryDinosaurId && fixture.dinosaurId !== opening.entities.secondDinosaurId && fixture.enclosureId !== opening.entities.firstEnclosureId && fixture.enclosureId !== opening.entities.secondEnclosureId && fixture.gateId !== opening.entities.secondGateId;
    const routesEquivalent = fixture.missingContextRoute.item.id === fixture.revisedContextRoute.item.id && !fixture.missingContextRoute.routed && fixture.missingContextRoute.unavailableReason === "not-routed" && fixture.revisedContextRoute.routed;
    const openingGuidanceWithheld = opening !== undefined && opening.guidanceIds.length > 0 && opening.guidanceIds.every((id) => transfer.withheldGuidanceIds.includes(id));
    const successObservable = transfer.successEventId === transfer.observableSuccess.eventId && transfer.observableSuccess.requiredActionIds.length > 0 && new Set(transfer.observableSuccess.requiredActionIds).size === transfer.observableSuccess.requiredActionIds.length;
    const assistanceIsDelayed = transfer.delayedAssistance.availableAfterEventId !== transfer.successEventId && guidanceIds.has(transfer.delayedAssistance.guidanceId) && !transfer.withheldGuidanceIds.includes(transfer.delayedAssistance.guidanceId);
    if (!changedIdentity || !routesEquivalent || transfer.openingGuidanceDisabled !== true || !openingGuidanceWithheld || !successObservable || !assistanceIsDelayed) {
      diagnostics.push(diagnostic("CURRICULUM_TRANSFER_INVALID", `transfers[${index}]`, "Transfer must use novel species/enclosure identities, reproduce the missing-context boundary, disable opening guidance, expose action-based success, and delay optional assistance."));
    }
  });
};

const validateHandbookUnlock = (pkg: CurriculumPackage, diagnostics: CurriculumDiagnostic[]): void => {
  const unlocks = new Map(pkg.unlocks.map((unlock) => [unlock.id, unlock]));
  pkg.handbook.forEach((entry, index) => {
    const unlock = unlocks.get(entry.unlockId);
    if (unlock === undefined || unlock.triggerEventId !== "outcome:near-miss" || !unlock.grants.some((grant) => grant.id === entry.id && grant.expectedClass === "HandbookEntry")) {
      diagnostics.push(diagnostic("CURRICULUM_HANDBOOK_UNLOCK_INVALID", `handbook[${index}].unlockId`, "The first relevant Handbook entry must unlock from the experienced opening incident and remain outside Agent Context."));
    }
  });
};

const reportFor = (pkg: CurriculumPackage): CurriculumReport => ({
  identity: `${pkg.packageId}@${pkg.packageVersion}`,
  fingerprint: pkg.fingerprint,
  arcIds: pkg.arcs.map((arc) => arc.id),
  scenarioIds: pkg.scenarios.map((scenario) => `${scenario.id}@${scenario.version}`),
  openingChain: [...pkg.scenarios[0]!.goldenOutcomes].sort((left, right) => left.order - right.order).map((outcome) => `${outcome.id}:${outcome.result}`),
  assetBundleIdentities: pkg.assetBundles.map((bundle) => `${bundle.bundleId}@${bundle.bundleVersion}`),
  timingTargetSeconds: pkg.openingRun.targetHumanSeconds,
  transferSuccessEvents: pkg.transfers.map((transfer) => transfer.observableSuccess.eventId),
});

export const validateCurriculumPackage = (input: unknown, inventory: CurriculumValidationInventory): CurriculumValidationResult => {
  const parsed = curriculumPackageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, diagnostics: parsed.error.issues.map((issue) => diagnostic("CURRICULUM_INVALID", issue.path.join("."), issue.message)) };
  const pkg: CurriculumPackage = parsed.data;
  const diagnostics: CurriculumDiagnostic[] = [];
  validateFingerprint(pkg, diagnostics);
  validateReferences(pkg, inventory, diagnostics);
  validateEntities(pkg, inventory, diagnostics);
  validateAssets(pkg, inventory, diagnostics);
  validateUnlocks(pkg, diagnostics);
  validateLinksAndCopy(pkg, diagnostics);
  validateOpeningGoldens(pkg, diagnostics);
  validateOpeningRun(pkg, diagnostics);
  validateTransfer(pkg, diagnostics);
  validateHandbookUnlock(pkg, diagnostics);
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, package: structuredClone(pkg), report: reportFor(pkg) };
};

export const projectGoldenOutcomes = (pkg: CurriculumPackage, scenarioId: string): readonly GoldenOutcome[] => {
  const scenario = pkg.scenarios.find((candidate) => candidate.id === scenarioId);
  return scenario === undefined ? [] : structuredClone([...scenario.goldenOutcomes].sort((left, right) => left.order - right.order || lexicalCompare(left.id, right.id)));
};
