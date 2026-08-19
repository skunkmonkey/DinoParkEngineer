import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scope = process.argv[2];
const testsRoot = resolve(repositoryRoot, "tests", scope ?? "");
const testExtensions = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);

const collectTests = (directory) => {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    return [];
  }

  const tests = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      tests.push(...collectTests(path));
    } else if (entry.isFile() && testExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      tests.push(path);
    }
  }

  return tests.sort();
};

const tests = collectTests(testsRoot);

if (tests.length === 0) {
  console.log(`No JavaScript tests found under tests/${scope ?? ""}; nothing to run.`);
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error !== undefined) {
  throw result.error;
}

process.exit(result.status ?? 1);
