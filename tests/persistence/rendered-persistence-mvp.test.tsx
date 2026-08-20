import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PersistenceFoundationView } from "../../src/persistence/public.js";

test("persistence view exposes keyboard-native MVP save, recovery, and portable controls", () => {
  const html = renderToStaticMarkup(<PersistenceFoundationView />);

  assert.match(html, /Advanced save tools/);
  assert.match(html, /Browser persistence &amp; recovery/);
  assert.match(html, /Save complete MVP to IndexedDB/);
  assert.match(html, /Autosave safe checkpoint/);
  assert.match(html, /Prepare portable export/);
  assert.match(html, /Test tampered import quarantine/);
  assert.match(html, /Migrate legacy save with backup/);
  assert.match(html, /Try delete without confirmation/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Memory, Evals, Workbench, Reviews, Deployments and revert history/);
});
