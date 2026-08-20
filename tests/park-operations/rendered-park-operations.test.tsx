import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ParkPlaceholder } from "../../src/park/public.js";

test("Park View leads with the opening operation while exact pins stay inspectable", () => {
  const html = renderToStaticMarkup(<ParkPlaceholder />);
  assert.match(html, /Dawn Valley/u); assert.match(html, /Current objective/u); assert.match(html, /Feed hungry Tria/u);
  assert.match(html, /Send Robot Alpha/u); assert.match(html, /required before opening/u); assert.match(html, /Park time controls/u);
  assert.match(html, /Inspect evidence/u); assert.match(html, /task:feed-triceratops@1.0.0/u); assert.match(html, /park:safe-feeding@1.0.0/u);
  assert.match(html, /Park log/u); assert.doesNotMatch(html, /Pre-opening operations|Try unavailable Agent|Visual grammar/u);
  assert.match(html, /role="status"/u); assert.match(html, /<button/u);
});
