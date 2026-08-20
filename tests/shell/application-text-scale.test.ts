import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

test("application text scale is defined once at the root and cannot be shadowed by a feature", () => {
  const tokens = read("../../src/styles/tokens.css");
  const globalCss = read("../../src/styles/global.css");
  const appShell = read("../../src/app-shell.tsx");

  assert.match(tokens, /--dpe-player-font-scale:\s*1;/u);
  assert.match(globalCss, /font-size:\s*calc\(var\(--dpe-font-size\) \* var\(--dpe-player-font-scale\)\)/u);
  assert.equal((globalCss.match(/--dpe-player-font-scale\s*:/gu) ?? []).length, 0);
  assert.match(appShell, /setProperty\("--dpe-player-font-scale", String\(preferences\.textScale\)\)/u);
  assert.doesNotMatch(globalCss, /\.player-experience\s*\{[^}]*--dpe-player-font-scale/isu);
});
