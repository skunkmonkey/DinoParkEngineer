export * from "./types.ts";
export * from "./review.ts";
export * from "./deployment.ts";
export * from "./fixtures.ts";

import { createReviewService } from "./review.ts";
import { createDeploymentService } from "./deployment.ts";

/** Composed headless boundary used by the production route and adapter tests. */
export function createReviewDeploymentService(options: import("./types.ts").ReviewServiceOptions & { readonly deployment?: Omit<import("./types.ts").DeploymentServiceOptions, "reviews"> } = {}): import("./types.ts").ReviewDeploymentRuntime {
  const reviews = createReviewService(options);
  const deployments = createDeploymentService({ ...(options.deployment ?? {}), registry: options.registry, reviews, initialActiveRefs: options.initialActiveRefs });
  return Object.freeze({ reviews, deployments });
}
