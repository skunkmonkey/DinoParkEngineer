/** The sole downstream import surface for finite, inspectable Agent Context. */
export { assembleContext, contextFacts } from "./engine.js";
export { createContextFoundationFixture } from "./foundation-fixture.js";
export { contextAssemblyInputSchema, contextCategorySchema, contextItemSchema, contextRouteSchema } from "./schemas.js";
export type { ContextAssemblyInput, ContextAssemblyResult, ContextCategory, ContextDemandPreview, ContextDiagnostic, ContextFault, ContextFaultPort, ContextItem, ContextLifecycle, ContextManifest, ContextManifestEntry, ContextRoute, ContextSegment, RetentionAudit } from "./types.js";
