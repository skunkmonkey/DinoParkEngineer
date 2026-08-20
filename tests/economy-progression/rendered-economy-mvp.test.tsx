import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EconomyProgressionView } from "../../src/economy-progression/public.js";

test("economy MVP view exposes explainable settlement, intentional progression, and expressive reward controls", () => {
  const html = renderToStaticMarkup(<EconomyProgressionView />);
  assert.match(html, /Settle first full park day/);
  assert.match(html, /Experience missing-context pressure/);
  assert.match(html, /Purchase Context Optimization/);
  assert.match(html, /active only after you choose to purchase/u);
  assert.match(html, /Purchase Dinosaur Plushie/);
  assert.match(html, /Park decoration/);
  assert.match(html, /Advanced details/);
  assert.match(html, /aria-live="polite"/);
});
