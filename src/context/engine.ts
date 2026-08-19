import type { FactValue } from "../instruction/public.js";
import { contextAssemblyInputSchema } from "./schemas.js";
import type { ContextAssemblyInput, ContextAssemblyResult, ContextCategory, ContextDiagnostic, ContextFault, ContextItem, ContextManifest, ContextManifestEntry, ContextSegment, RetentionAudit, RetentionComparisonEntry, RetentionPolicy } from "./types.js";

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const cloneFreeze = <T>(value: T): T => { const clone = structuredClone(value); const freeze = (entry: unknown): void => { if (entry !== null && typeof entry === "object") { Object.freeze(entry); for (const child of Object.values(entry)) freeze(child); } }; freeze(clone); return clone; };
const diagnostic = (code: ContextDiagnostic["code"], kind: ContextDiagnostic["kind"], itemIds: readonly string[], message: string): ContextDiagnostic => ({ code, kind, itemIds: [...itemIds].sort(lexical), message });
const categoryOrder: readonly ContextCategory[] = ["Task", "SystemPrompt", "Skill", "Policy", "Knowledge", "Memory", "Tool", "Message", "Observation", "ToolResult", "TaskHistory", "IncidentEvidence"];
const uniqueItems = (items: readonly ContextItem[]): ContextItem[] => [...items].sort((a, b) => lexical(a.id, b.id));
const includedItems = (entries: readonly ContextManifestEntry[]): ContextItem[] => entries.flatMap((entry) => entry.lifecycle === "included" && entry.item !== undefined ? [entry.item] : []);
const includedIds = (entries: readonly ContextManifestEntry[]): string[] => entries.filter((entry) => entry.lifecycle === "included").map((entry) => entry.itemId).sort(lexical);

const retrievedMemoryItems = (input: ContextAssemblyInput): readonly ContextItem[] => {
  if (input.memory?.retrievalQuery === undefined) return [];
  const result = input.memory.ports.retrieve(input.memory.retrievalQuery);
  if (!result.ok) return [];
  return result.selected.flatMap((record) => record.entry === undefined ? [] : [{
    id: record.entry.id,
    category: "Memory" as const,
    provenance: { source: `memory:${record.entry.storeId}`, routeId: `route:${record.entry.id.split(":")[1] ?? "memory"}` },
    sourceVersion: { id: record.entry.id, version: record.entry.version },
    cost: record.entry.contextCost,
    createdTick: input.decisionTick,
    priority: record.entry.priority,
    retentionEligible: true,
    pinned: false,
    payload: { reference: `${record.entry.id}@${record.entry.version}`, facts: record.entry.facts },
    quality: { relevance: "relevant" as const, ...(record.entry.staleAtTick === undefined ? {} : { staleAtTick: record.entry.staleAtTick }), ...(record.entry.duplicateKey === undefined ? {} : { duplicateKey: record.entry.duplicateKey }), ...(record.entry.conflictKey === undefined ? {} : { conflictKey: record.entry.conflictKey }) },
  }]);
};

const manifest = (input: ContextAssemblyInput, suffix: "before" | "after", entries: readonly ContextManifestEntry[], previousManifestId?: string): ContextManifest => {
  const included = entries.filter((entry) => entry.lifecycle === "included" && entry.item !== undefined).map((entry) => entry.item!);
  const used = included.reduce((sum, item) => sum + item.cost, 0);
  const segments: ContextSegment[] = categoryOrder.map((category) => ({ category, units: included.filter((item) => item.category === category).reduce((sum, item) => sum + item.cost, 0) })).filter((entry) => entry.units > 0);
  return cloneFreeze({ id: `context:${input.agentId.split(":")[1] ?? "agent"}-${input.jobId.split(":")[1] ?? "job"}-${input.decisionTick}-${suffix}`, agentId: input.agentId, jobId: input.jobId, decisionTick: input.decisionTick, capacity: input.capacity, used, segments, entries, previousManifestId });
};

const qualityDiagnostics = (items: readonly ContextItem[], tick: number): ContextDiagnostic[] => {
  const output: ContextDiagnostic[] = [];
  for (const item of items) {
    if (item.quality.staleAtTick !== undefined && item.quality.staleAtTick <= tick) output.push(diagnostic("CONTEXT_STALE", "stale", [item.id], `${item.id} is stale at decision tick ${tick}.`));
    if (item.quality.relevance === "irrelevant") output.push(diagnostic("CONTEXT_IRRELEVANT", "irrelevant", [item.id], `${item.id} is routed but marked irrelevant.`));
  }
  for (const [field, code, kind] of [["duplicateKey", "CONTEXT_DUPLICATE", "duplicate"], ["conflictKey", "CONTEXT_CONFLICT", "conflict"]] as const) {
    const groups = new Map<string, string[]>();
    for (const item of items) { const value = item.quality[field]; if (value !== undefined) groups.set(value, [...(groups.get(value) ?? []), item.id]); }
    for (const ids of groups.values()) if (ids.length > 1) output.push(diagnostic(code, kind, ids, `${kind} context items share an explicit diagnostic key.`));
  }
  return output.sort((a, b) => lexical(`${a.kind}:${a.itemIds.join(",")}`, `${b.kind}:${b.itemIds.join(",")}`));
};

const beforeEntries = (input: ContextAssemblyInput): ContextManifestEntry[] => {
  const available = new Map(uniqueItems(input.availableSources).map((item) => [item.id, item]));
  const entries: ContextManifestEntry[] = [];
  for (const route of [...input.routes].sort((a, b) => lexical(a.id, b.id))) {
    if (!route.applicable) { entries.push({ itemId: route.itemId, item: available.get(route.itemId), lifecycle: "inapplicable", reasonCode: "ROUTE_NOT_APPLICABLE" }); continue; }
    const item = available.get(route.itemId);
    if (item === undefined) { entries.push({ itemId: route.itemId, lifecycle: route.required ? "unavailable-required" : "inapplicable", reasonCode: route.required ? "REQUIRED_SOURCE_UNAVAILABLE" : "OPTIONAL_SOURCE_UNAVAILABLE" }); continue; }
    entries.push({ itemId: item.id, item, lifecycle: "included", reasonCode: "ROUTED_SOURCE_INCLUDED" });
  }
  const routed = new Set(entries.map((entry) => entry.itemId));
  for (const item of uniqueItems([...input.priorRetained, ...input.additions])) {
    if (routed.has(item.id)) continue;
    entries.push({ itemId: item.id, item, lifecycle: item.createdTick <= input.decisionTick ? "included" : "inapplicable", reasonCode: item.createdTick <= input.decisionTick ? "DECISION_BOUNDARY_ADDITION" : "FUTURE_ADDITION_NOT_APPLIED" });
  }
  return entries.sort((a, b) => lexical(a.itemId, b.itemId));
};

export const assembleContext = (rawInput: ContextAssemblyInput): ContextAssemblyResult => {
  const parsed = contextAssemblyInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, diagnostics: cloneFreeze(parsed.error.issues.map((issue) => diagnostic("CONTEXT_INVALID", "boundary", [], `${issue.path.map(String).join(".") || "$"}: ${issue.message}`))) };
  const retrieved = retrievedMemoryItems(rawInput);
  const input: ContextAssemblyInput = retrieved.length === 0 ? rawInput : { ...rawInput, additions: [...rawInput.additions, ...retrieved] };
  const routeIds = input.routes.map((route) => route.id);
  const duplicatedRouteIds = [...new Set(routeIds.filter((routeId, index) => routeIds.indexOf(routeId) !== index))].sort(lexical);
  const routedItemIds = input.routes.map((route) => route.itemId);
  const duplicatedRoutedItems = [...new Set(routedItemIds.filter((itemId, index) => routedItemIds.indexOf(itemId) !== index))].sort(lexical);
  if (duplicatedRouteIds.length > 0 || duplicatedRoutedItems.length > 0) return { ok: false, diagnostics: [diagnostic("CONTEXT_DUPLICATE_ID", "boundary", [...duplicatedRouteIds, ...duplicatedRoutedItems], "Route IDs and routed item IDs must be unique within one assembly.")] };
  const allItemIds = [...input.availableSources, ...input.priorRetained, ...input.additions].map((item) => item.id);
  const duplicateIds = [...new Set(allItemIds.filter((itemId, index) => allItemIds.indexOf(itemId) !== index))].sort(lexical);
  if (duplicateIds.length > 0) return { ok: false, diagnostics: [diagnostic("CONTEXT_DUPLICATE_ID", "boundary", duplicateIds, "Context item IDs must be unique across assembly inputs.")] };
  const initialEntries = beforeEntries(input);
  const before = manifest(input, "before", initialEntries);
  const excess = Math.max(0, before.used - input.capacity);
  const ratio = input.capacity === 0 ? (before.used === 0 ? 0 : Number.POSITIVE_INFINITY) : before.used / input.capacity;
  const preview = cloneFreeze({ demand: before.used, capacity: input.capacity, excess, state: excess > 0 ? "overflow" as const : ratio >= 0.9 ? "critical" as const : ratio >= 0.7 ? "constrained" as const : "normal" as const });
  const included = includedItems(initialEntries);
  const diagnostics = [...initialEntries.filter((entry) => entry.lifecycle === "unavailable-required").map((entry) => diagnostic("CONTEXT_REQUIRED_UNAVAILABLE", "missing", [entry.itemId], `${entry.itemId} was required by an applicable route but unavailable.`)), ...qualityDiagnostics(included, input.decisionTick)];
  if (excess === 0) return cloneFreeze({ ok: true, status: "ready", beforeRetention: before, afterRetention: manifest(input, "after", initialEntries, before.id), preview, diagnostics });

  if (input.retentionPolicy === "Strict") {
    const priorIds = new Set(input.priorRetained.map((item) => item.id));
    const afterEntries = initialEntries.map((entry) => entry.lifecycle !== "included" || !priorIds.has(entry.itemId) ? { ...entry, lifecycle: entry.lifecycle === "included" ? "excluded" as const : entry.lifecycle, reasonCode: entry.lifecycle === "included" ? "STRICT_REFUSED_OVERFLOW_SNAPSHOT" : entry.reasonCode } : entry);
    const after = manifest(input, "after", afterEntries, before.id);
    const fault: ContextFault = { id: `fault:context-${input.decisionTick}`, agentId: input.agentId, jobId: input.jobId, decisionTick: input.decisionTick, code: "CONTEXT_CAPACITY_STRICT_STOP", excess };
    const audit: RetentionAudit = { id: `retention:strict-${input.decisionTick}`, policy: "Strict", beforeManifestId: before.id, afterManifestId: after.id, excess, retainedItemIds: after.entries.filter((entry) => entry.lifecycle === "included").map((entry) => entry.itemId), excludedItemIds: after.entries.filter((entry) => entry.lifecycle === "excluded").map((entry) => entry.itemId), halted: true, reasonCode: "STRICT_HALT_AND_SIGNAL" };
    input.faultPort?.reportContextFault(cloneFreeze(fault));
    return cloneFreeze({ ok: true, status: "halted", beforeRetention: before, afterRetention: after, preview, retention: audit, fault, diagnostics });
  }

  let afterEntries: ContextManifestEntry[] = [...initialEntries];
  const excluded = new Set<string>();
  const compacted = new Set<string>();
  const externalized = new Set<string>();
  const memoryReferences: { readonly id: string; readonly version: string }[] = [];
  let knownLostDetail: readonly string[] = [];
  let remaining = before.used;

  if (input.retentionPolicy === "CompactHistory") {
    const request = input.memory?.compactionRequest;
    const compactedResult = request === undefined ? undefined : input.memory?.ports.compactHistory(request);
    if (compactedResult?.ok === true) {
      const exactSources = new Set(compactedResult.sourceEntries.map((entry) => `${entry.id}@${entry.version}`));
      const history = included.filter((item) => item.category === "TaskHistory" && item.retentionEligible && !item.pinned && exactSources.has(`${item.id}@${item.sourceVersion.version}`)).sort((a, b) => a.createdTick - b.createdTick || lexical(a.id, b.id));
      for (const item of history) compacted.add(item.id);
      const summary = compactedResult.summary;
      const summaryItem: ContextItem = {
        id: summary.id,
        category: "Memory",
        provenance: { source: `memory:${summary.storeId}`, routeId: `route:${summary.id.split(":")[1] ?? "summary"}` },
        sourceVersion: { id: summary.id, version: summary.version },
        cost: summary.contextCost,
        createdTick: input.decisionTick,
        priority: Math.max(0, ...history.map((item) => item.priority)),
        retentionEligible: true,
        pinned: false,
        payload: { reference: `${summary.id}@${summary.version}`, facts: summary.facts },
        quality: { relevance: "relevant" },
      };
      if (history.length > 0) {
        afterEntries = initialEntries.map((entry) => compacted.has(entry.itemId) ? { ...entry, lifecycle: "compacted" as const, reasonCode: "COMPACT_HISTORY_SOURCE_REPLACED" } : entry);
        afterEntries.push({ itemId: summaryItem.id, item: summaryItem, lifecycle: "included", reasonCode: "COMPACT_HISTORY_SUMMARY_INCLUDED" });
        memoryReferences.push({ id: summary.id, version: summary.version });
        knownLostDetail = compactedResult.lostDetailClasses;
        remaining = includedItems(afterEntries).reduce((sum, item) => sum + item.cost, 0);
      }
    }
  } else if (input.retentionPolicy === "ExternalizeRetrieve") {
    const rule = input.memory?.externalizationRule;
    const candidates = included.filter((item) => item.retentionEligible && !item.pinned).sort((a, b) => a.createdTick - b.createdTick || lexical(a.id, b.id));
    if (rule !== undefined && input.memory !== undefined) {
      for (const item of candidates) {
        if (remaining <= input.capacity) break;
        const result = input.memory.ports.externalize({ contextItem: item, rule, createdTick: input.decisionTick, principal: input.memory.principal, sourceManifestId: before.id });
        if (!result.ok) continue;
        externalized.add(item.id);
        memoryReferences.push({ id: result.entry.id, version: result.entry.version });
        remaining -= item.cost;
      }
      afterEntries = initialEntries.map((entry) => externalized.has(entry.itemId) ? { ...entry, lifecycle: "externalized" as const, reasonCode: "EXTERNALIZE_RETRIEVE_STORED" } : entry);
    }
  } else {
    const evictable = included.filter((item) => item.retentionEligible && !item.pinned).sort((a, b) => input.retentionPolicy === "PriorityRetention"
      ? a.priority - b.priority || a.createdTick - b.createdTick || lexical(a.id, b.id)
      : a.createdTick - b.createdTick || lexical(a.id, b.id));
    for (const item of evictable) { if (remaining <= input.capacity) break; excluded.add(item.id); remaining -= item.cost; }
    const reasonCode = input.retentionPolicy === "PriorityRetention" ? "PRIORITY_RETENTION_LOWEST_PRIORITY" : "KEEP_NEWEST_OLDEST_ELIGIBLE";
    afterEntries = initialEntries.map((entry) => excluded.has(entry.itemId) ? { ...entry, lifecycle: "excluded" as const, reasonCode } : entry);
  }
  afterEntries.sort((a, b) => lexical(a.itemId, b.itemId));
  const after = manifest(input, "after", afterEntries, before.id);
  const halted = after.used > input.capacity;
  const fault: ContextFault | undefined = halted ? { id: `fault:context-${input.decisionTick}`, agentId: input.agentId, jobId: input.jobId, decisionTick: input.decisionTick, code: "CONTEXT_RETENTION_CANNOT_FIT", excess: after.used - input.capacity } : undefined;
  const policySlug = input.retentionPolicy.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase();
  const transformed = [...compacted, ...externalized].sort(lexical);
  const audit: RetentionAudit = { id: `retention:${policySlug}-${input.decisionTick}`, policy: input.retentionPolicy, beforeManifestId: before.id, afterManifestId: after.id, excess, retainedItemIds: includedIds(after.entries), excludedItemIds: [...excluded].sort(lexical), ...(compacted.size === 0 ? {} : { compactedItemIds: [...compacted].sort(lexical) }), ...(externalized.size === 0 ? {} : { externalizedItemIds: [...externalized].sort(lexical) }), ...(memoryReferences.length === 0 ? {} : { memoryReferences: memoryReferences.sort((a, b) => lexical(`${a.id}@${a.version}`, `${b.id}@${b.version}`)) }), ...(knownLostDetail.length === 0 ? {} : { knownLostDetail: [...knownLostDetail] }), halted, reasonCode: halted ? `${input.retentionPolicy.toUpperCase()}_CANNOT_FIT` : `${input.retentionPolicy.toUpperCase()}_APPLIED` };
  if (fault !== undefined) input.faultPort?.reportContextFault(cloneFreeze(fault));
  return cloneFreeze({ ok: true, status: halted ? "halted" : "ready", beforeRetention: before, afterRetention: after, preview, retention: audit, fault, diagnostics: halted ? [...diagnostics, diagnostic("CONTEXT_OVERFLOW_UNRESOLVED", "capacity", [...audit.retainedItemIds, ...transformed], `${input.retentionPolicy} could not fit pinned or ineligible Context.`)] : diagnostics });
};

export const compareRetentionResults = (results: Readonly<Record<RetentionPolicy, ContextAssemblyResult>>): readonly RetentionComparisonEntry[] => cloneFreeze((Object.keys(results) as RetentionPolicy[]).sort(lexical).map((policy) => {
  const result = results[policy];
  if (!result.ok) return { policy, status: "invalid" as const, used: 0, capacity: 0, retainedItemIds: [], excludedItemIds: [], transformedItemIds: [], diagnostics: result.diagnostics };
  return {
    policy,
    status: result.status,
    used: result.afterRetention.used,
    capacity: result.afterRetention.capacity,
    retainedItemIds: includedIds(result.afterRetention.entries),
    excludedItemIds: result.retention?.excludedItemIds ?? [],
    transformedItemIds: [...(result.retention?.compactedItemIds ?? []), ...(result.retention?.externalizedItemIds ?? [])].sort(lexical),
    diagnostics: result.diagnostics,
  };
}));

export const contextFacts = (manifestValue: ContextManifest): Readonly<Record<string, FactValue>> => {
  if (manifestValue.used > manifestValue.capacity) throw new RangeError("Cannot continue from an over-capacity Context manifest without a recorded Retention Policy result.");
  const facts: Record<string, FactValue> = {};
  for (const entry of manifestValue.entries.filter((candidate) => candidate.lifecycle === "included" && candidate.item !== undefined).sort((a, b) => lexical(a.itemId, b.itemId))) {
    for (const [fact, value] of Object.entries(entry.item!.payload.facts).sort(([left], [right]) => lexical(left, right))) {
      if (Object.hasOwn(facts, fact) && facts[fact] !== value) throw new TypeError(`Conflicting Context fact ${fact} cannot be silently selected.`);
      facts[fact] = value;
    }
  }
  return cloneFreeze(facts);
};
