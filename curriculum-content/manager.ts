import type { ManagerConfig } from "../orchestration/index.ts";
import { deepFreeze } from "../simulation/index.ts";
import { CURRICULUM_ARTIFACT_REFS } from "./artifacts.ts";

/** Reviewable Manager configurations used by phases 9–10. The two versions
 * keep the safety-first routing policy stable while adding capacity only
 * after the conflict and escalation lesson has been completed. */
export const CURRICULUM_MANAGER_CONFIGS: readonly ManagerConfig[] = deepFreeze([
  {
    id: "manager.curriculum.park",
    managerId: "manager.curriculum.park",
    version: 1,
    configurationVersion: 1,
    status: "DEPLOYED",
    missionPromptRef: CURRICULUM_ARTIFACT_REFS.managerAuthority,
    workerIds: ["agent.keeper01", "agent.security01"],
    workerPool: ["agent.keeper01", "agent.security01"],
    maxWorkers: 2,
    maxConcurrentWorkers: 2,
    maxTier: 2,
    contextBudget: 12_000,
    artifactRefs: [CURRICULUM_ARTIFACT_REFS.managerConfigV1, CURRICULUM_ARTIFACT_REFS.managerAuthority, CURRICULUM_ARTIFACT_REFS.containmentPolicy, CURRICULUM_ARTIFACT_REFS.workerReporting],
    rules: [
      { id: "rule.curriculum.safety", priority: 100, taskTypes: ["SECURITY", "EVACUATE", "RESCUE", "CONTAINMENT"] },
      { id: "rule.curriculum.feeding", priority: 20, taskTypes: ["FEED"] },
    ],
    priorityPolicy: { safetyIncidents: 400, containment: 300, animalHealth: 200, guestThroughput: 100, routine: 0, safetyFloor: 2 },
    authority: { canAssign: true, canDispatchSecurity: true, maxEscalationSeverity: 4 },
    routingPolicies: [
      { id: "route.curriculum.safety", priority: 100, taskTypes: ["SECURITY", "EVACUATE", "RESCUE", "CONTAINMENT"], workerRoles: ["SECURITY"], artifactRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy] },
      { id: "route.curriculum.care", priority: 20, taskTypes: ["FEED"], workerRoles: ["KEEPER"], artifactRefs: [CURRICULUM_ARTIFACT_REFS.managerAuthority] },
    ],
    escalation: { severityThreshold: 2, fallbackAttempts: 1, dispatchRoles: ["SECURITY"], immediate: true },
    reporting: { routineBatchSize: 5, exceptionImmediate: true, includeTraceLinks: true },
  },
  {
    id: "manager.curriculum.park",
    managerId: "manager.curriculum.park",
    version: 2,
    configurationVersion: 2,
    status: "REVIEW",
    missionPromptRef: CURRICULUM_ARTIFACT_REFS.managerAuthority,
    workerIds: ["agent.keeper01", "agent.security01", "agent.maintenance01"],
    workerPool: ["agent.keeper01", "agent.security01", "agent.maintenance01"],
    maxWorkers: 3,
    maxConcurrentWorkers: 3,
    maxTier: 3,
    contextBudget: 14_000,
    artifactRefs: [CURRICULUM_ARTIFACT_REFS.managerConfigV2, CURRICULUM_ARTIFACT_REFS.managerAuthority, CURRICULUM_ARTIFACT_REFS.containmentPolicy, CURRICULUM_ARTIFACT_REFS.workerReporting, CURRICULUM_ARTIFACT_REFS.maintenanceFallback],
    rules: [
      { id: "rule.curriculum.v2.safety", priority: 100, taskTypes: ["SECURITY", "EVACUATE", "RESCUE", "CONTAINMENT"] },
      { id: "rule.curriculum.v2.maintenance", priority: 80, taskTypes: ["MAINTENANCE"], roles: ["MAINTENANCE"], requiredToolIds: ["observe"] },
      { id: "rule.curriculum.v2.feeding", priority: 20, taskTypes: ["FEED"], roles: ["KEEPER"] },
    ],
    priorityPolicy: { safetyIncidents: 400, containment: 300, animalHealth: 200, guestThroughput: 100, routine: 0, safetyFloor: 2 },
    authority: { canAssign: true, canDispatchSecurity: true, maxEscalationSeverity: 4 },
    routingPolicies: [
      { id: "route.curriculum.v2.safety", priority: 100, taskTypes: ["SECURITY", "EVACUATE", "RESCUE", "CONTAINMENT"], workerRoles: ["SECURITY"], artifactRefs: [CURRICULUM_ARTIFACT_REFS.containmentPolicy] },
      { id: "route.curriculum.v2.maintenance", priority: 80, taskTypes: ["MAINTENANCE"], workerRoles: ["MAINTENANCE"], knowledgeRefs: [CURRICULUM_ARTIFACT_REFS.gateKnowledge], artifactRefs: [CURRICULUM_ARTIFACT_REFS.maintenanceFallback] },
      { id: "route.curriculum.v2.care", priority: 20, taskTypes: ["FEED"], workerRoles: ["KEEPER"], artifactRefs: [CURRICULUM_ARTIFACT_REFS.managerAuthority] },
    ],
    escalation: { severityThreshold: 2, fallbackAttempts: 1, dispatchRoles: ["SECURITY"], immediate: true },
    reporting: { routineBatchSize: 5, exceptionImmediate: true, includeTraceLinks: true },
  },
] as ManagerConfig[]);
