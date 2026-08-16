import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("../src/engineering-workbench/EngineeringWorkbenchRoute.tsx", import.meta.url), "utf8");
const platformModuleSource = await readFile(new URL("../src/platform/module.ts", import.meta.url), "utf8");
const workbenchModuleSource = await readFile(new URL("../src/engineering-workbench/module.ts", import.meta.url), "utf8");

test("Workbench production UI exposes labelled filters and structured authored choices", () => {
  for (const label of ["Tag", "Capability", "Required Tool", "Deployment state"]) assert.match(routeSource, new RegExp(`>${label}<select`));
  assert.match(routeSource, /<fieldset><legend>Structured authored choices<\/legend>/);
  assert.match(routeSource, /aria-live="polite"/);
  assert.doesNotMatch(routeSource, /<textarea/i, "arbitrary prose input must not be exposed");
});

test("history opens exact refs and DataTable receives cells instead of nested table rows", () => {
  assert.match(routeSource, /onClick=\{\(\) => onOpenRef\(item\.ref\)\}/);
  assert.match(routeSource, /summaryCells\(asset,/);
  assert.doesNotMatch(routeSource, /function SummaryRow/);
  assert.doesNotMatch(routeSource, /onClick=\{\(\) => undefined\}/);
});

test("domain features own primary routes while the platform provider remains registered", () => {
  assert.match(platformModuleSource, /exclude: \["park", "agents", "engineering", "evals", "reviews", "progress"\]/);
  assert.match(platformModuleSource, /providers:/, "platform presentation provider must remain available");
  assert.match(workbenchModuleSource, /path: "\/engineering"/);
});
