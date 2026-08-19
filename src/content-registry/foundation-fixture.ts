import { fingerprintCatalogPackage } from "./canonical.js";
import { createContentRegistry } from "./registry.js";
import { promptDataSchema } from "./schemas.js";
import type { CatalogPackage, ContentRecord, ContentReference, ContentRegistry } from "./types.js";

export const CONTENT_REGISTRY_FOUNDATION_REFERENCES = Object.freeze({
  policy: Object.freeze({ id: "park:containment-policy", version: "1.0.0" }),
  skill: Object.freeze({ id: "park:safe-feeding", version: "1.0.0" }),
  prompt: Object.freeze({ id: "park:feed-triceratops", version: "1.0.0" }),
  hiddenPrompt: Object.freeze({ id: "park:feed-triceratops", version: "2.0.0" }),
}) satisfies Readonly<Record<"policy" | "skill" | "prompt" | "hiddenPrompt", ContentReference>>;

const policyRecord: ContentRecord = {
  ...CONTENT_REGISTRY_FOUNDATION_REFERENCES.policy,
  class: "Policy",
  schemaVersion: "1",
  displayName: "Containment Policy",
  author: "Park Safety",
  provenance: { source: "built-in", path: "content/policies/containment.json", author: "Park Safety" },
  contextCost: 3,
  dependencies: [],
  tags: ["containment", "safety"],
  availability: "available",
  data: { purpose: "Keep enclosure boundaries secure.", tradeoffs: ["Requires verification"] },
};

const skillRecord: ContentRecord = {
  ...CONTENT_REGISTRY_FOUNDATION_REFERENCES.skill,
  class: "Skill",
  schemaVersion: "1",
  displayName: "Safe Feeding",
  author: "Park Operations",
  provenance: { source: "built-in", path: "content/skills/safe-feeding.json", author: "Park Operations" },
  contextCost: 5,
  dependencies: [{ ...CONTENT_REGISTRY_FOUNDATION_REFERENCES.policy, expectedClass: "Policy", expectedSchemaVersion: "1" }],
  tags: ["feeding", "safety"],
  availability: "available",
  data: { purpose: "Feed while preserving containment.", tradeoffs: ["More tool steps"] },
};

const promptRecord: ContentRecord = {
  ...CONTENT_REGISTRY_FOUNDATION_REFERENCES.prompt,
  class: "Prompt",
  schemaVersion: "1",
  displayName: "Feed the Triceratops",
  author: "Park Developer",
  provenance: { source: "built-in", path: "content/prompts/feed-triceratops.json", author: "Park Developer", license: "CC-BY-4.0" },
  contextCost: 8,
  dependencies: [CONTENT_REGISTRY_FOUNDATION_REFERENCES.policy, CONTENT_REGISTRY_FOUNDATION_REFERENCES.skill],
  tags: ["feeding", "starter"],
  availability: "available",
  readableSource: "Bait the dinosaur away from the gate, feed it, restore containment, and verify the gate.",
  data: { purpose: "Safely feed the Triceratops.", tradeoffs: ["Uses containment context"] },
};

const hiddenPromptRecord: ContentRecord = {
  ...promptRecord,
  ...CONTENT_REGISTRY_FOUNDATION_REFERENCES.hiddenPrompt,
  displayName: "Feed the Triceratops (revised)",
  availability: "hidden",
  readableSource: "Verify containment before and after feeding, and escalate any conflicting evidence.",
  data: { purpose: "Safely feed with stronger verification.", tradeoffs: ["Uses additional verification context"] },
};

const signPackage = (value: Omit<CatalogPackage, "fingerprint">): CatalogPackage => ({
  ...value,
  fingerprint: fingerprintCatalogPackage(value),
});

const basePackage = signPackage({
  packageId: "park:base-content",
  packageVersion: "1.0.0",
  registrySchemaVersion: "1",
  requirement: "required",
  entries: [policyRecord, skillRecord, promptRecord],
});

const historyPackage = signPackage({
  packageId: "park:content-history",
  packageVersion: "1.0.0",
  registrySchemaVersion: "1",
  requirement: "required",
  entries: [hiddenPromptRecord],
});

/** Creates the deterministic app fixture used by registry inspector scenarios. */
export const createContentRegistryFoundationFixture = (): ContentRegistry => {
  const registry = createContentRegistry({
    registrySchemaVersion: "1",
    classDefinitions: ["Policy", "Prompt", "Skill"].map((contentClass) => ({
      class: contentClass,
      schemaVersion: "1",
      schema: promptDataSchema,
    })),
  });
  const loaded = registry.loadPackages([basePackage, historyPackage]);
  if (loaded.status !== "ready" || loaded.diagnostics.length > 0) {
    throw new Error("The built-in Content Registry foundation fixture is invalid.");
  }
  return loaded.registry;
};

/** Returns a correctly signed optional package whose record fails boundary validation. */
export const createInvalidContentRegistryFoundationPackage = (): CatalogPackage =>
  signPackage({
    packageId: "park:invalid-inspector-fixture",
    packageVersion: "1.0.0",
    registrySchemaVersion: "1",
    requirement: "optional",
    entries: [{ ...promptRecord, id: "not-namespaced", extra: "unknown-field" }],
  });
