import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FoundationLab } from "../../src/foundation-lab/public.js";

test("foundation lab renders persistent semantic equivalents and keyboard-native controls", () => {
  const html = renderToStaticMarkup(<FoundationLab />);
  assert.match(html, /Exact Content Registry inspection/u);
  assert.match(html, /Registry-loaded world projection/u);
  assert.match(html, /Gate physical state/u);
  assert.match(html, /Gate sensor/u);
  assert.match(html, /Invalid optional package diagnostics/u);
  assert.match(html, /Persistent foundation evidence/u);
  assert.match(html, /Run safe feeding/u);
  assert.match(html, /Try rejected stale command/u);
  assert.match(html, /Verify replay and pinned history/u);
  assert.match(html, /<button/u);
  assert.match(html, /role="status"/u);
});
