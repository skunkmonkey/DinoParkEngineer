import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".mjs"]);
const IMPORT_PATTERN = /(?:from\s+|import\s*\()(["'])((?:\.\.?\/|@\/)[^"']+)\1/g;

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

export async function findArchitectureViolations(projectRoot) {
  const sourceRoot = join(projectRoot, "src");
  const packages = new Set(
    (await readdir(sourceRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const publicPackages = new Set();
  for (const packageName of packages) {
    try {
      await readFile(join(sourceRoot, packageName, "public.ts"));
      publicPackages.add(packageName);
    } catch {
      // Directories without a public entry are implementation support, not feature packages.
    }
  }

  const violations = [];
  for (const file of await walk(sourceRoot)) {
    const sourcePackage = relative(sourceRoot, file).split(/[\\/]/)[0];
    if (!publicPackages.has(sourcePackage)) continue;
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(IMPORT_PATTERN)) {
      const specifier = match[2];
      if (!specifier) continue;
      const target = normalize(specifier.startsWith("@/")
        ? resolve(sourceRoot, specifier.slice(2))
        : resolve(dirname(file), specifier));
      const targetRelative = relative(sourceRoot, target);
      if (targetRelative.startsWith("..")) continue;
      const targetPackage = targetRelative.split(/[\\/]/)[0];
      if (targetPackage === sourcePackage || !publicPackages.has(targetPackage)) continue;
      const targetWithinPackage = targetRelative.split(/[\\/]/).slice(1).join("/");
      if (targetWithinPackage !== "public.ts" && targetWithinPackage !== "public") {
        violations.push(`${relative(projectRoot, file)} imports private path ${specifier}; import src/${targetPackage}/public.ts instead.`);
      }
    }
  }
  return violations.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const violations = await findArchitectureViolations(projectRoot);
  if (violations.length > 0) {
    for (const violation of violations) process.stderr.write(`${violation}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Architecture boundaries passed.\n");
  }
}
