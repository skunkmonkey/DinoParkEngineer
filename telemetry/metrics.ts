import type { SanitizedTelemetryEvent, TelemetryEventType } from "./types.ts";

export type LearningMetricId =
  | "duplicateContextPerJob"
  | "severity3PlusEvalCoverage"
  | "deploymentsWithEvalRun"
  | "contextUtilizationDistribution"
  | "interventionsPer10Jobs"
  | "uncoveredIncidentToRegression";

export interface LearningMetricResult<T = number | Readonly<Record<string, number>>> {
  readonly id: LearningMetricId;
  readonly version: 1;
  readonly numerator: number;
  readonly denominator: number;
  readonly eligiblePopulation: string;
  readonly missingDataHandling: string;
  readonly value: T;
}

export interface LearningMetricDefinition<T = number | Readonly<Record<string, number>>> {
  readonly id: LearningMetricId;
  readonly version: 1;
  readonly numerator: string;
  readonly denominator: string;
  readonly eligiblePopulation: string;
  readonly missingDataHandling: string;
  readonly compute: (events: readonly SanitizedTelemetryEvent[]) => LearningMetricResult<T>;
}

function payload(event: SanitizedTelemetryEvent): Readonly<Record<string, unknown>> {
  return event.payload as Readonly<Record<string, unknown>>;
}
function numberOf(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function booleanOf(value: unknown): boolean | undefined { return typeof value === "boolean" ? value : undefined; }
function stringOf(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function stableIdOf(value: unknown): string | undefined {
  const token = stringOf(value);
  return token && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/.test(token) && !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(token) ? token : undefined;
}
function eventsOf(events: readonly SanitizedTelemetryEvent[], ...types: TelemetryEventType[]): readonly SanitizedTelemetryEvent[] {
  const set = new Set(types);
  return events.filter((event) => set.has(event.type));
}

const duplicateContextPerJob: LearningMetricDefinition<number> = {
  id: "duplicateContextPerJob",
  version: 1,
  numerator: "sum duplicateCu from context snapshots/job outcomes",
  denominator: "eligible jobs with a context summary or outcome",
  eligiblePopulation: "jobs with an observed duplicate-context measure",
  missingDataHandling: "exclude records without jobId/duplicateCu; keep one authoritative observation per job and prefer ACTUAL context",
  compute: (events) => {
    const byJob = new Map<string, { readonly value: number; readonly priority: number; readonly order: number }>();
    eventsOf(events, "CONTEXT_SNAPSHOT", "CONTEXT_SUMMARY", "JOB_OUTCOME").forEach((event, order) => {
      const jobId = stableIdOf(payload(event).jobId);
      const value = numberOf(payload(event).duplicateCu ?? payload(event).duplicateContextCu);
      if (!jobId || value === undefined) return;
      const mode = stringOf(payload(event).mode);
      const priority = mode === "ACTUAL" ? 3 : event.type === "CONTEXT_SNAPSHOT" || event.type === "CONTEXT_SUMMARY" ? mode === "PROJECTED" ? 1 : 2 : 0;
      const current = byJob.get(jobId);
      if (!current || priority > current.priority || (priority === current.priority && order > current.order)) byJob.set(jobId, { value, priority, order });
    });
    const numerator = [...byJob.values()].reduce((sum, record) => sum + record.value, 0);
    const denominator = byJob.size;
    return result(duplicateContextPerJob, numerator, denominator, denominator === 0 ? 0 : numerator / denominator);
  },
};

const severity3PlusEvalCoverage: LearningMetricDefinition<number> = {
  id: "severity3PlusEvalCoverage",
  version: 1,
  numerator: "severity >= 3 eligible paths with at least one eval run",
  denominator: "severity >= 3 eligible paths",
  eligiblePopulation: "incident, job-outcome, and eval paths carrying severity >= 3",
  missingDataHandling: "unknown severity is excluded; selection alone is not coverage; only EVAL_RUN is run evidence",
  compute: (events) => {
    const candidates = events.filter((event) => {
      const severity = numberOf(payload(event).severity);
      return severity !== undefined && severity >= 3 && ["INCIDENT", "JOB_OUTCOME", "EVAL_RUN", "EVAL_SELECTION"].includes(event.type);
    });
    const keyByPath = (event: SanitizedTelemetryEvent): string => stringOf(payload(event).incidentId) ?? stringOf(payload(event).jobId) ?? stringOf(payload(event).evalId) ?? event.eventId;
    const paths = new Map<string, { covered: boolean }>();
    for (const event of candidates) {
      const key = keyByPath(event);
      paths.set(key, { covered: paths.get(key)?.covered ?? false });
    }
    for (const event of eventsOf(events, "EVAL_RUN")) {
      const key = keyByPath(event);
      if (paths.has(key)) paths.set(key, { covered: true });
    }
    const denominator = paths.size;
    const numerator = [...paths.values()].filter((path) => path.covered).length;
    return result(severity3PlusEvalCoverage, numerator, denominator, denominator === 0 ? 0 : numerator / denominator);
  },
};

const deploymentsWithEvalRun: LearningMetricDefinition<number> = {
  id: "deploymentsWithEvalRun",
  version: 1,
  numerator: "deployments with evalRunCount > 0 or an explicit eval run",
  denominator: "all eligible deployments",
  eligiblePopulation: "DEPLOY events",
  missingDataHandling: "missing evalRunCount is treated as zero",
  compute: (events) => {
    const deployments = eventsOf(events, "DEPLOY");
    const numerator = deployments.filter((event) => (numberOf(payload(event).evalRunCount) ?? 0) > 0 || booleanOf(payload(event).evalRun) === true || booleanOf(payload(event).hasEvalRun) === true).length;
    return result(deploymentsWithEvalRun, numerator, deployments.length, deployments.length === 0 ? 0 : numerator / deployments.length);
  },
};

const contextUtilizationDistribution: LearningMetricDefinition<Readonly<Record<string, number>>> = {
  id: "contextUtilizationDistribution",
  version: 1,
  numerator: "count of context records in each utilization bucket",
  denominator: "eligible context snapshots with budget and load",
  eligiblePopulation: "CONTEXT_SNAPSHOT/CONTEXT_SUMMARY records with finite budget > 0 and totalLoad > 0",
  missingDataHandling: "exclude utilization-only, missing, zero, or negative budget/load records; preserve zero-count buckets",
  compute: (events) => {
    const distribution = { under25: 0, from25To50: 0, from50To75: 0, from75To100: 0, over100: 0 };
    const records = eventsOf(events, "CONTEXT_SNAPSHOT", "CONTEXT_SUMMARY").filter((event) => (numberOf(payload(event).budget) ?? 0) > 0 && (numberOf(payload(event).totalLoad) ?? 0) > 0);
    for (const event of records) {
      const ratio = (numberOf(payload(event).totalLoad) ?? 0) / (numberOf(payload(event).budget) ?? 1);
      if (ratio < 0.25) distribution.under25 += 1;
      else if (ratio < 0.5) distribution.from25To50 += 1;
      else if (ratio < 0.75) distribution.from50To75 += 1;
      else if (ratio <= 1) distribution.from75To100 += 1;
      else distribution.over100 += 1;
    }
    const denominator = records.length;
    return result(contextUtilizationDistribution, denominator, denominator, Object.freeze(distribution));
  },
};

const interventionsPer10Jobs: LearningMetricDefinition<number> = {
  id: "interventionsPer10Jobs",
  version: 1,
  numerator: "manual intervention events",
  denominator: "completed/observed job outcomes",
  eligiblePopulation: "MANUAL_INTERVENTION and JOB_OUTCOME records",
  missingDataHandling: "count each valid intervention event; return 0 when no jobs",
  compute: (events) => {
    const interventions = eventsOf(events, "MANUAL_INTERVENTION").reduce((sum, event) => sum + (numberOf(payload(event).count) ?? 1), 0);
    const jobs = eventsOf(events, "JOB_OUTCOME").length;
    return result(interventionsPer10Jobs, interventions, jobs, jobs === 0 ? 0 : interventions / jobs * 10);
  },
};

const uncoveredIncidentToRegression: LearningMetricDefinition<number> = {
  id: "uncoveredIncidentToRegression",
  version: 1,
  numerator: "uncovered incidents associated with a later incident-linked eval build/run or refactor",
  denominator: "uncovered incidents",
  eligiblePopulation: "INCIDENT records marked uncovered or lacking coverage",
  missingDataHandling: "exclude incidents without a valid incidentId; deduplicate incident ids; unmatched incidents remain failures",
  compute: (events) => {
    const incidentsById = new Map<string, SanitizedTelemetryEvent>();
    eventsOf(events, "INCIDENT").forEach((event) => {
      const value = payload(event).uncovered;
      const incidentId = stableIdOf(payload(event).incidentId);
      if (incidentId && (value === true || value === undefined) && !incidentsById.has(incidentId)) incidentsById.set(incidentId, event);
    });
    const converted = [...incidentsById.entries()].filter(([incidentId, incident]) => {
      return events.some((candidate) => {
        const candidatePayload = payload(candidate);
        return ["EVAL_BUILD", "EVAL_RUN"].includes(candidate.type)
          && candidate.logicalTime >= incident.logicalTime
          && (stableIdOf(candidatePayload.incidentId) ?? stableIdOf(candidatePayload.fromIncidentId)) === incidentId
          && (candidate.type !== "EVAL_BUILD" || booleanOf(candidatePayload.built) !== false);
      });
    }).length;
    const denominator = incidentsById.size;
    return result(uncoveredIncidentToRegression, converted, denominator, denominator === 0 ? 0 : converted / denominator);
  },
};

function result<T>(definition: LearningMetricDefinition<T>, numerator: number, denominator: number, value: T): LearningMetricResult<T> {
  return Object.freeze({ id: definition.id, version: 1 as const, numerator, denominator, eligiblePopulation: definition.eligiblePopulation, missingDataHandling: definition.missingDataHandling, value });
}

export const LEARNING_METRIC_DEFINITIONS = Object.freeze({
  duplicateContextPerJob,
  severity3PlusEvalCoverage,
  deploymentsWithEvalRun,
  contextUtilizationDistribution,
  interventionsPer10Jobs,
  uncoveredIncidentToRegression,
});

export function computeLearningMetrics(events: readonly SanitizedTelemetryEvent[]): Readonly<Record<LearningMetricId, LearningMetricResult>> {
  return Object.freeze({
    duplicateContextPerJob: duplicateContextPerJob.compute(events),
    severity3PlusEvalCoverage: severity3PlusEvalCoverage.compute(events),
    deploymentsWithEvalRun: deploymentsWithEvalRun.compute(events),
    contextUtilizationDistribution: contextUtilizationDistribution.compute(events),
    interventionsPer10Jobs: interventionsPer10Jobs.compute(events),
    uncoveredIncidentToRegression: uncoveredIncidentToRegression.compute(events),
  });
}

export const calculateLearningMetrics = computeLearningMetrics;
