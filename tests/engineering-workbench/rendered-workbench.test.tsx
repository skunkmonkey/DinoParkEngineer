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
  assert.match(html, /Executable clauses/u);
  assert.match(html, /Semantic comparison/u);
  assert.match(html, /Include current gate maintenance in Worker Agent Context/u);
  assert.match(html, /Create minimum Context fix/u);
  assert.match(html, /Park Developer capabilities/u);
  assert.match(html, /Engineering Handbook/u);
  assert.match(html, /Return to North Paddock/u);
  assert.match(html, /Advanced causal details/u);
});
