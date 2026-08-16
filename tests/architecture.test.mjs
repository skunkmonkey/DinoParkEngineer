import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { findArchitectureViolations } from "../scripts/check-architecture.mjs";

test("feature packages import other feature packages through public entries only", async () => {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  assert.deepEqual(await findArchitectureViolations(projectRoot), []);
});

test("feature discovery has no central per-feature import list", async () => {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const registration = await readFile(resolve(projectRoot, "src/features/registration.ts"), "utf8");
  assert.match(registration, /import\.meta\.glob/);
  assert.doesNotMatch(registration, /from\s+["']\.\.\/(?:platform|simulation|content|economy)\//);
});

test("vinext lifecycle scripts use the cross-platform Node launcher", async () => {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const packageJson = JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.dev, "node scripts/run-vinext.mjs dev");
  assert.equal(packageJson.scripts.build, "node scripts/run-vinext.mjs build");
  assert.equal(packageJson.scripts.start, "node scripts/run-vinext.mjs start");
  for (const command of [packageJson.scripts.dev, packageJson.scripts.build, packageJson.scripts.start]) {
    assert.doesNotMatch(command, /^WRANGLER_LOG_PATH=/);
  }
  const launcher = await readFile(resolve(projectRoot, "scripts/run-vinext.mjs"), "utf8");
  assert.match(launcher, /WRANGLER_LOG_PATH/);
  assert.match(launcher, /process\.execPath/);
});

test("architecture guard rejects a private cross-feature import", async () => {
  const fixtureRoot = await mkdtemp(resolve(tmpdir(), "dino-shell-architecture-"));
  try {
    await mkdir(resolve(fixtureRoot, "src/alpha"), { recursive: true });
    await mkdir(resolve(fixtureRoot, "src/beta"), { recursive: true });
    await writeFile(resolve(fixtureRoot, "src/alpha/public.ts"), "export {};\n");
    await writeFile(resolve(fixtureRoot, "src/beta/public.ts"), "export {};\n");
    await writeFile(resolve(fixtureRoot, "src/beta/private.ts"), "export const privateValue = 1;\n");
    await writeFile(resolve(fixtureRoot, "src/alpha/consumer.ts"), 'import { privateValue } from "../beta/private.ts";\nvoid privateValue;\n');
    const violations = await findArchitectureViolations(fixtureRoot);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /imports private path/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
