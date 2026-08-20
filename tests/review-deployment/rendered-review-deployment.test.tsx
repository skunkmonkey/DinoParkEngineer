import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewDeploymentView } from "../../src/review-deployment/public.js";

test("review surface keeps exact evidence, non-color status, and keyboard-native decisions visible", () => {
  const html = renderToStaticMarkup(<ReviewDeploymentView />);
  assert.match(html, /Review \/ Deployment · Production paused/u);
  assert.match(html, /aria-label="Park status"/u);
  assert.match(html, /Safe Feeding Prompt v2/u);
  assert.doesNotMatch(html, /<dd><code>prompt:self-contained-feeding@2\.0\.0/u);
  assert.match(html, /Readable and behavioral diff/u);
  assert.match(html, /Context delta/u);
  assert.match(html, /Evidence states remain explicit/u);
  assert.match(html, /Attach executed Eval/u);
  assert.match(html, /I explicitly accept non-mandatory failed, interrupted, or omitted evidence/u);
  assert.match(html, /Request changes/u);
  assert.match(html, /Retain production/u);
  assert.match(html, /Confirm and deploy reviewed version/u);
  assert.match(html, /Revert with new deployment/u);
  assert.match(html, /role="status"/u);
  assert.match(html, /<button/u);
});
