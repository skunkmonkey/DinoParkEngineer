import { deepClone, deepFreeze } from "../simulation/index.ts";
import type { OperationsJob } from "./types.ts";

export interface JobRepository {
  get(id: string): OperationsJob | undefined;
  list(): readonly OperationsJob[];
  queue(agentId: string): readonly OperationsJob[];
  put(job: OperationsJob): void;
  remove(id: string): boolean;
}

export function createJobRepository(initial: readonly OperationsJob[] = []): JobRepository {
  const records = new Map(initial.map((job) => [job.id, deepFreeze(deepClone(job))]));
  return {
    get: (id) => {
      const job = records.get(id);
      return job ? deepFreeze(deepClone(job)) : undefined;
    },
    list: () => deepFreeze([...records.values()].map((job) => deepClone(job)).sort((a, b) => b.priority - a.priority || a.dueTime - b.dueTime || a.id.localeCompare(b.id))),
    queue: (agentId) => deepFreeze([...records.values()].filter((job) => job.assignedAgentId === agentId && (job.status === "QUEUED" || job.status === "RUNNING" || job.status === "PAUSED")).map((job) => deepClone(job)).sort((a, b) => b.priority - a.priority || a.dueTime - b.dueTime || a.id.localeCompare(b.id))),
    put: (job) => records.set(job.id, deepFreeze(deepClone(job))),
    remove: (id) => records.delete(id),
  };
}
