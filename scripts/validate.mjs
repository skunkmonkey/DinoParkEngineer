import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

// Keep the environment gate as a standalone command so existing users can
// still run `node scripts/validate-environment.mjs` directly.
run(process.execPath, [resolve(repositoryRoot, "scripts/validate-environment.mjs")]);

for (const script of [
  "typecheck",
  "lint",
  "lint:architecture",
  "test:shell",
  "test",
  "build",
]) {
  run(npmExecutable, ["run", script]);
}

console.log(
  "Validation passed: environment, typecheck, lint, architecture, shell tests, all tests, and build.",
);
