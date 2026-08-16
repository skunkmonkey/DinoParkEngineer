import { canonicalSerialize, deepClone, deepFreeze } from "../simulation/index.ts";
import { createOrchestrationService, type OrchestrationRuntimeOptions } from "./runtime.ts";
import type { OrchestrationReplayManifest, OrchestrationReplayResult } from "./types.ts";

function freeze<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

function firstDifference(expected: readonly unknown[], actual: readonly unknown[]) {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const left = expected[index];
    const right = actual[index];
    if (canonicalSerialize(left) !== canonicalSerialize(right)) return { index, expected: left, actual: right, message: `Orchestration event ${index} differs from the pinned replay.` };
  }
  return undefined;
}

export function replayOrchestration(manifest: OrchestrationReplayManifest, options: Omit<OrchestrationRuntimeOptions, "workers" | "configs" | "initialManager"> = {}): OrchestrationReplayResult {
  if (!manifest || manifest.schemaVersion !== 1 || !manifest.manager || !Array.isArray(manifest.workers) || !Array.isArray(manifest.requests)) return freeze({ status: "UNAVAILABLE", isolated: true, events: [], canonical: "[]", unavailableReason: "Unsupported or incomplete orchestration manifest." });
  const jobs = new Map((manifest.jobs ?? []).map((job) => [job.id, job]));
  const outcomes = [...(manifest.assignmentOutcomes ?? [])];
  let requestIndex = 0;
  let currentLogicalTime = manifest.activationLogicalTime ?? 0;
  const runtime = createOrchestrationService({
    ...options,
    workers: manifest.workers,
    initialManager: manifest.manager,
    jobLookup: (jobId) => jobs.get(jobId),
    jobList: manifest.jobListAvailable ? () => [...(manifest.queuedJobsByRequest?.[requestIndex] ?? [])] : undefined,
    jobs: manifest.jobPortAvailable ? {
      assign: (jobId, workerId, commandId) => {
        const index = outcomes.findIndex((outcome) => outcome.jobId === jobId && outcome.workerId === workerId && outcome.commandId === commandId);
        if (index < 0) return { ok: manifest.assignmentOutcomes === undefined };
        const [outcome] = outcomes.splice(index, 1);
        return { ok: outcome!.accepted };
      },
    } : undefined,
    logicalTime: () => currentLogicalTime,
  });
  for (const request of manifest.requests) {
    currentLogicalTime = manifest.requestLogicalTimes?.[requestIndex] ?? currentLogicalTime;
    runtime.handle(request);
    requestIndex += 1;
  }
  const events = runtime.events(manifest.manager.managerId ?? manifest.manager.id);
  const canonical = canonicalSerialize(events);
  if (manifest.expectedCanonical !== undefined && manifest.expectedCanonical !== canonical) {
    const expectedEvents = manifest.expectedEvents ?? [];
    return freeze({ status: "DIVERGED", isolated: true, events, canonical, firstDifference: firstDifference(expectedEvents, events) ?? { message: "Canonical orchestration event stream differs from the pinned expected canonical." } });
  }
  if (manifest.expectedEvents) {
    const difference = firstDifference(manifest.expectedEvents, events);
    if (difference) return freeze({ status: "DIVERGED", isolated: true, events, canonical, firstDifference: difference });
  }
  if (manifest.expectedAssignments) {
    const assignmentDifference = firstDifference(manifest.expectedAssignments, runtime.assignments(manifest.manager.managerId ?? manifest.manager.id));
    if (assignmentDifference) return freeze({ status: "DIVERGED", isolated: true, events, canonical, firstDifference: { ...assignmentDifference, message: `Assignment state differs: ${assignmentDifference.message}` } });
  }
  if (manifest.jobPortAvailable && outcomes.length > 0) return freeze({ status: "DIVERGED", isolated: true, events, canonical, firstDifference: { message: `${outcomes.length} pinned assignment outcome(s) were not consumed during replay.` } });
  return freeze({ status: "EXACT", isolated: true, events, canonical });
}

export const createOrchestrationReplayService = () => Object.freeze({ replay: replayOrchestration });
