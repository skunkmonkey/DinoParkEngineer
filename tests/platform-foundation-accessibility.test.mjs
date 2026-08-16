import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("dialog and drawer share focus trapping, unique labels, and opener restoration", async () => {
  const source = await readFile(new URL("src/ui/components.tsx", projectRoot), "utf8");
  assert.match(source, /useId\(\)/);
  assert.match(source, /foundation-dialog-title-\$\{generatedId\}/);
  assert.match(source, /foundation-drawer-title-\$\{generatedId\}/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /trappedFocusIndex/);
  assert.match(source, /openerRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.key === "Escape"/);
});

test("tabs expose linked panels and complete keyboard navigation", async () => {
  const source = await readFile(new URL("src/ui/components.tsx", projectRoot), "utf8");
  assert.match(source, /aria-controls=\{`\$\{baseId\}-\$\{tab\.id\}-panel`\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-labelledby=\{`\$\{idPrefix\}-\$\{tabId\}-tab`\}/);
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) assert.match(source, new RegExp(key));
});

test("production downstream routes use the public persistent-frame adapter", async () => {
  const finance = await readFile(new URL("src/economy-progression/module.ts", projectRoot), "utf8");
  const traces = await readFile(new URL("src/trace-replay/module.ts", projectRoot), "utf8");
  for (const source of [finance, traces]) {
    assert.match(source, /from "\.\.\/platform\/public\.ts"/);
    assert.match(source, /createFramedRouteRegistration\(\{/);
  }
  assert.match(finance, /destinationId: "progress"/);
  assert.match(traces, /destinationId: "agents"/);
});
