import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { IncidentResponseView } from "../../src/incident-response/public.js";

test("Incident Response renders a persistent accessible plan and native controls", () => {
  const html = renderToStaticMarkup(<IncidentResponseView />);
  assert.match(html, /External stabilization · Production paused/u);
  assert.match(html, /Incident Response plan/u);
  assert.match(html, /Immediate risk/u);
  assert.match(html, /Capabilities and limitations/u);
  assert.match(html, /Try stale activation/u);
  assert.match(html, /Activate Incident Response/u);
  assert.match(html, /Advance one response tick/u);
  assert.match(html, /Run to stabilization/u);
  assert.match(html, /role="status"/u);
  assert.match(html, /not color alone/u);
});
