/** Public production boundary for authored MVP curriculum and scenario content. */
export * from "../../curriculum-content/index.ts";
export { CurriculumRoute } from "./CurriculumRoute.tsx";
export { curriculumContentModule } from "./module.ts";
export { createCurriculumCatalogProvider, createCurriculumProvider, getActiveCurriculumRuntime, setActiveCurriculumRuntime } from "./runtime.ts";
export type { CurriculumCatalogRuntime, CurriculumProviderDependencies, CurriculumRuntime } from "./runtime.ts";
