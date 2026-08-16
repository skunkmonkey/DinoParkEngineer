import { analyzeContext } from "./assembler.ts";
import type { ContextFinding, ContextService, ContextSnapshot, ContextUsageEvidence } from "./types.ts";

/** Pure facade for callers that only need profiler findings. */
export function createContextAnalyzer(): Pick<ContextService, "analyze"> {
  return { analyze: analyzeContext };
}

export { analyzeContext };
export type { ContextFinding, ContextSnapshot, ContextUsageEvidence };

