import { canonicalSerialize } from "../simulation/index.ts";
import type { ArtifactVersion } from "../content-registry/index.ts";
import type { ContextToolInput, WorkingStateInput } from "./types.ts";

/** Fixed defaults are intentionally small, explicit, and independent of a tokenizer. */
export const DEFAULT_TOOL_CONTEXT_COST = 32;
export const DEFAULT_WORKING_STATE_CONTEXT_COST = 64;

let encoder: TextEncoder | undefined;

function utf8ByteLength(value: string): number {
  // TextEncoder is available in browsers and Node 22.  The fallback keeps the
  // headless module usable in older test harnesses without changing semantics.
  if (typeof TextEncoder !== "undefined") {
    encoder ??= new TextEncoder();
    return encoder.encode(value).byteLength;
  }
  return unescape(encodeURIComponent(value)).length;
}

/** Context Units are exact UTF-8 bytes divided into four-byte units. */
export function textContextUnits(value: string): number {
  return Math.ceil(utf8ByteLength(value) / 4);
}

export const calculateTextCU = textContextUnits;
export const textToContextUnits = textContextUnits;
export const calculateContextUnits = textContextUnits;
export const calculateTextUnits = textContextUnits;

/** Cost for an authored artifact's human-readable source and clause fragments. */
export function artifactContextUnits(artifact: ArtifactVersion, includeClauseText = true): number {
  const sourceCost = textContextUnits(artifact.sourceText);
  if (!includeClauseText) return sourceCost;
  return sourceCost + artifact.clauses.reduce((sum, clause) => sum + textContextUnits(clause.sourceText), 0);
}

export const calculateArtifactCU = artifactContextUnits;

export interface ContextCostModel {
  readonly text: (value: string) => number;
  readonly artifact: (artifact: ArtifactVersion, includeClauseText?: boolean) => number;
  readonly tool: (tool: string | ContextToolInput) => number;
  readonly workingState: (state: WorkingStateInput) => number;
}

export function createContextCostModel(): ContextCostModel {
  return { text: textContextUnits, artifact: artifactContextUnits, tool: toolContextUnits, workingState: workingStateContextUnits };
}

export function toolContextUnits(tool: string | ContextToolInput): number {
  if (typeof tool === "string") return DEFAULT_TOOL_CONTEXT_COST;
  if (tool.contextCost !== undefined) return tool.contextCost;
  if (tool.description !== undefined || tool.title !== undefined) {
    return textContextUnits(`${tool.title ?? tool.id}\n${tool.description ?? ""}`);
  }
  return DEFAULT_TOOL_CONTEXT_COST;
}

export function workingStateContextUnits(state: WorkingStateInput): number {
  if (state.contextCost !== undefined) return state.contextCost;
  if (state.content !== undefined) return textContextUnits(state.content);
  if (state.facts !== undefined || state.observations !== undefined) {
    return textContextUnits(canonicalSerialize({ facts: state.facts ?? null, observations: state.observations ?? null }));
  }
  return DEFAULT_WORKING_STATE_CONTEXT_COST;
}

export function assertContextCost(value: number, label = "contextCost"): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer`);
  return value;
}
