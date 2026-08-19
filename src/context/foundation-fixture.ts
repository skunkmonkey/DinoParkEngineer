import type { ContentReference } from "../content-registry/public.js";
import type { ContextAssemblyInput, ContextItem, ContextRoute } from "./types.js";

const ref = (id: string): ContentReference => ({ id, version: "1.0.0" });
const item = (id: string, category: ContextItem["category"], cost: number, createdTick: number, facts: ContextItem["payload"]["facts"], options: Partial<Pick<ContextItem, "pinned" | "retentionEligible" | "priority">> = {}): ContextItem => ({
  id, category, provenance: { source: "foundation-fixture", routeId: `route:${id.split(":")[1] ?? "item"}` }, sourceVersion: ref(id.replace("context", "content")), cost, createdTick, priority: options.priority ?? 0, retentionEligible: options.retentionEligible ?? true, pinned: options.pinned ?? false, payload: { reference: `${id}-payload`, facts }, quality: { relevance: "relevant" },
});
const route = (entry: ContextItem, required = true): ContextRoute => ({ id: entry.provenance.routeId, itemId: entry.id, required, applicable: true });

export const createContextFoundationFixture = (): {
  readonly items: readonly ContextItem[];
  readonly base: ContextAssemblyInput;
  readonly missingMaintenance: ContextAssemblyInput;
  readonly strictOverflow: ContextAssemblyInput;
  readonly keepNewest: ContextAssemblyInput;
} => {
  const task = item("context:feeding-task", "Task", 3, 0, { "task.kind": "feed", "gate.position": "closed" }, { pinned: true, retentionEligible: false, priority: 100 });
  const prompt = item("context:feeding-prompt", "Skill", 5, 0, {}, { pinned: true, retentionEligible: false, priority: 90 });
  const policy = item("context:maintenance-policy", "Policy", 4, 0, { "gate.maintenance": "closer-disabled" }, { priority: 80 });
  const tool = item("context:gate-tool", "Tool", 2, 0, {}, { pinned: true, retentionEligible: false, priority: 70 });
  const knowledge = item("context:species-knowledge", "Knowledge", 2, 0, { "dinosaur.species": "Triceratops" }, { priority: 20 });
  const observation = item("context:gate-observation", "Observation", 3, 1, { "gate.observed": "closed" });
  const result = item("context:tool-result", "ToolResult", 3, 2, { "tool.last-result": "accepted" });
  const message = item("context:manager-message", "Message", 2, 3, { "message.priority": "routine" });
  const history = item("context:task-history", "TaskHistory", 3, 4, { "history.last-step": "gate-opened" });
  const incident = item("context:incident-evidence", "IncidentEvidence", 2, 4, { "incident.active": false });
  const items = [knowledge, policy, prompt, task, tool];
  const baseCommon = { agentId: "agent:worker-alpha", jobId: "job:feeding-alpha", capacity: 20, decisionTick: 0, routes: items.map((entry) => route(entry)), availableSources: items, priorRetained: [], additions: [], retentionPolicy: "Strict" as const };
  return {
    items,
    base: baseCommon,
    missingMaintenance: { ...baseCommon, routes: items.map((entry) => route(entry)), availableSources: items.filter((entry) => entry.id !== policy.id) },
    strictOverflow: { ...baseCommon, decisionTick: 4, additions: [observation, result, message, history, incident], retentionPolicy: "Strict" },
    keepNewest: { ...baseCommon, capacity: 18, decisionTick: 4, additions: [observation, result, message, history, incident], retentionPolicy: "KeepNewest" },
  };
};
