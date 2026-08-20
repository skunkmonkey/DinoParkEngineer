import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CurriculumOpeningView } from "../../src/curriculum-content/public.js";

test("curriculum view exposes the exact opening and keyboard-native novel transfer", () => {
  const html = renderToStaticMarkup(<CurriculumOpeningView />);
  assert.match(html, /Opening recap/);
  assert.match(html, /Concrete opening result/);
  assert.match(html, /Record the opening near miss/);
  assert.match(html, /Bramble at Gamma enclosure/);
  assert.match(html, /Guidance/);
  assert.match(html, /Optional after the first attempt/);
  assert.match(html, /Advanced scenario details/);
  assert.match(html, /Show optional delayed transfer hint/);
  assert.match(html, /aria-live="polite"/);
});
