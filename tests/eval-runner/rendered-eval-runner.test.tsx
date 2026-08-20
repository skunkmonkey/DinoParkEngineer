import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EvalRunnerView } from "../../src/eval-runner/public.js";

test("Eval Runner renders persistent SIMULATION framing and semantic controls", () => {
  const html = renderToStaticMarkup(<EvalRunnerView />);
  assert.match(html, /SIMULATION/u);
  assert.match(html, /Production world, Economy, and Persistence remain unchanged/u);
  assert.match(html, /eval:opening-maintenance-context@1\.0\.0/u);
  assert.match(html, /Risk \/ category/u);
  assert.match(html, /Estimated run cost/u);
  assert.match(html, /Previous results/u);
  assert.match(html, /Run selected Eval/u);
  assert.match(html, /No reliability probability is implied/u);
  assert.match(html, /<input[^>]+type="checkbox"/u);
  assert.match(html, /<button/u);
});
