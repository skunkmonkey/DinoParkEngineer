import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ParkPlaceholder } from "../../src/park/public.js";

test("Park View exposes the pre-opening job, exact pins, native controls, and persistent semantic evidence", () => {
  const html = renderToStaticMarkup(<ParkPlaceholder />);
  assert.match(html, /Pre-opening operations/u); assert.match(html, /Park operations status/u); assert.match(html, /pre-opening/u);
  assert.match(html, /Feed Tria/u); assert.match(html, /Required before opening/u); assert.match(html, /job:schedule-morning-feed-day-1-tick-0/u);
  assert.match(html, /Assign Robot Alpha/u); assert.match(html, /Try unavailable Agent/u); assert.match(html, /Inspect pinned production versions/u);
  assert.match(html, /task:feed-triceratops@1.0.0/u); assert.match(html, /park:safe-feeding@1.0.0/u); assert.match(html, /Persistent operations history/u);
  assert.match(html, /role="status"/u); assert.match(html, /<button/u);
});
