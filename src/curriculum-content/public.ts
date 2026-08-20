/** Sole downstream import surface for validated deterministic curriculum packages. */
export { createOpeningCurriculumInventory, createOpeningCurriculumPackage, OPENING_CURRICULUM_IDS, OPENING_RUNTIME_ASSET_IDS } from "./opening-package.js";
export {
  arcSchema,
  assetBundleDependencySchema,
  copyCatalogSchema,
  curriculumPackageSchema,
  exactContentReferenceSchema,
  guidanceSchema,
  handbookEntrySchema,
  playtestTagSchema,
  scenarioSchema,
  transferSchema,
  unlockSchema,
} from "./schemas.js";
export { projectGoldenOutcomes, validateCurriculumPackage } from "./validator.js";
export { CurriculumOpeningView } from "./view.js";
export type {
  AssetBundleDependency,
  ContextRouteFixture,
  CurriculumArc,
  CurriculumDiagnostic,
  CurriculumDiagnosticCode,
  CurriculumPackage,
  CurriculumReport,
  CurriculumValidationInventory,
  CurriculumValidationResult,
  ExactContentReference,
  GoldenOutcome,
  GuidanceRecord,
  HandbookEntry,
  OpeningJob,
  OpeningRunContract,
  OpeningSequenceBeat,
  OpeningScenario,
  PlaytestTag,
  TransferCase,
  UnlockRecord,
} from "./types.js";
