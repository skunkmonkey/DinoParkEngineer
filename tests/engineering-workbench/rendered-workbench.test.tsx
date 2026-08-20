import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EngineeringWorkbench } from "../../src/engineering-workbench/public.js";

test("Workbench renders paused framing, causal anchor, exact inspection, composition, and Handbook separation", () => {
  const html = renderToStaticMarkup(<EngineeringWorkbench />);
  assert.match(html, /Workbench · Production paused/u);
  assert.match(html, /incident:opening-near-miss/u);
  assert.match(html, /Readable prose · inspectable, not executable/u);
  assert.match(html, /EXECUTABLE CLAUSES/u);
  assert.match(html, /Semantic comparison/u);
  assert.match(html, /Include <code>context:maintenance-policy/u);
  assert.match(html, /Commission minimum context fix/u);
  assert.match(html, /There are no candidates, hiring, salaries, replacement, or developer teams/u);
  assert.match(html, /cannot enter Agent Context/u);
  assert.match(html, /Return to the exact park incident/u);
});
