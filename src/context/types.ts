import type { ContentReference } from "../content-registry/public.js";
import type { FactValue } from "../instruction/public.js";
import type { CompactHistoryRequest, MemoryExternalizationRule, MemoryLifecyclePorts, MemoryPrincipal, MemoryReference, MemoryRetrievalQuery } from "../memory/public.js";

export type ContextCategory = "Task" | "SystemPrompt" | "Skill" | "Policy" | "Knowledge" | "Memory" | "Tool" | "Message" | "Observation" | "ToolResult" | "TaskHistory" | "IncidentEvidence";
export type ContextLifecycle = "included" | "unavailable-required" | "inapplicable" | "excluded" | "compacted" | "externalized";

export interface ContextItem {
  readonly id: string;
  readonly category: ContextCategory;
  readonly provenance: { readonly source: string; readonly routeId: string };
  readonly sourceVersion: ContentReference;
  readonly cost: number;
  readonly createdTick: number;
  readonly priority: number;
  readonly retentionEligible: boolean;
  readonly pinned: boolean;
  readonly payload: { readonly reference: string; readonly facts: Readonly<Record<string, FactValue>> };
  readonly quality: {
    readonly staleAtTick?: number;
    readonly relevance: "relevant" | "irrelevant";
    readonly duplicateKey?: string;
    readonly conflictKey?: string;
  };
}

export interface ContextRoute {
  readonly id: string;
  readonly itemId: string;
  readonly required: boolean;
  readonly applicable: boolean;
}

export interface ContextManifestEntry {
  readonly item?: ContextItem;
  readonly itemId: string;
  readonly lifecycle: ContextLifecycle;
  readonly reasonCode: string;
}

export interface ContextSegment {
  readonly category: ContextCategory;
  readonly units: number;
}

export interface ContextManifest {
  readonly id: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly decisionTick: number;
  readonly capacity: number;
  readonly used: number;
  readonly segments: readonly ContextSegment[];
  readonly entries: readonly ContextManifestEntry[];
  readonly previousManifestId?: string;
}

export interface ContextDemandPreview {
  readonly demand: number;
  readonly capacity: number;
  readonly excess: number;
  readonly state: "normal" | "constrained" | "critical" | "overflow";
}

export interface ContextDiagnostic {
  readonly code: "CONTEXT_INVALID" | "CONTEXT_DUPLICATE_ID" | "CONTEXT_REQUIRED_UNAVAILABLE" | "CONTEXT_STALE" | "CONTEXT_DUPLICATE" | "CONTEXT_CONFLICT" | "CONTEXT_IRRELEVANT" | "CONTEXT_OVERFLOW_UNRESOLVED";
  readonly kind: "boundary" | "missing" | "stale" | "duplicate" | "conflict" | "irrelevant" | "capacity";
  readonly itemIds: readonly string[];
  readonly message: string;
}

export interface RetentionAudit {
  readonly id: string;
  readonly policy: RetentionPolicy;
  readonly beforeManifestId: string;
  readonly afterManifestId: string;
  readonly excess: number;
  readonly retainedItemIds: readonly string[];
  readonly excludedItemIds: readonly string[];
  readonly compactedItemIds?: readonly string[];
  readonly externalizedItemIds?: readonly string[];
  readonly memoryReferences?: readonly MemoryReference[];
  readonly knownLostDetail?: readonly string[];
  readonly halted: boolean;
  readonly reasonCode: string;
}

export type RetentionPolicy = "Strict" | "KeepNewest" | "PriorityRetention" | "CompactHistory" | "ExternalizeRetrieve";

export interface ContextMemoryIntegration {
  readonly ports: MemoryLifecyclePorts;
  readonly principal: MemoryPrincipal;
  readonly retrievalQuery?: MemoryRetrievalQuery;
  readonly externalizationRule?: MemoryExternalizationRule;
  readonly compactionRequest?: CompactHistoryRequest;
}

export interface RetentionComparisonEntry {
  readonly policy: RetentionPolicy;
  readonly status: "ready" | "halted" | "invalid";
  readonly used: number;
  readonly capacity: number;
  readonly retainedItemIds: readonly string[];
  readonly excludedItemIds: readonly string[];
  readonly transformedItemIds: readonly string[];
  readonly diagnostics: readonly ContextDiagnostic[];
}

export interface ContextFault {
  readonly id: string;
  readonly agentId: string;
  readonly jobId: string;
  readonly decisionTick: number;
  readonly code: "CONTEXT_CAPACITY_STRICT_STOP" | "CONTEXT_RETENTION_CANNOT_FIT";
  readonly excess: number;
}

export interface ContextFaultPort { reportContextFault(fault: ContextFault): void }

export interface ContextAssemblyInput {
  readonly agentId: string;
  readonly jobId: string;
  readonly decisionTick: number;
  readonly capacity: number;
  readonly routes: readonly ContextRoute[];
  readonly availableSources: readonly ContextItem[];
  readonly priorRetained: readonly ContextItem[];
  readonly additions: readonly ContextItem[];
  readonly retentionPolicy: RetentionPolicy;
  readonly memory?: ContextMemoryIntegration;
  readonly faultPort?: ContextFaultPort;
}

export type ContextAssemblyResult =
  | { readonly ok: false; readonly diagnostics: readonly ContextDiagnostic[] }
  | {
      readonly ok: true;
      readonly status: "ready" | "halted";
      readonly beforeRetention: ContextManifest;
      readonly afterRetention: ContextManifest;
      readonly preview: ContextDemandPreview;
      readonly retention?: RetentionAudit;
      readonly fault?: ContextFault;
      readonly diagnostics: readonly ContextDiagnostic[];
    };
