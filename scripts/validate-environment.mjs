import { readFileSync } from "node:fs";

const parseVersion = (label, value) => {
  const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(value);

  if (match === null) {
    throw new Error(`${label} version is not valid semver: ${value}`);
  }

  return match.slice(1).map(Number);
};

const assertMinimumVersion = (label, current, minimum) => {
  const currentParts = parseVersion(label, current);
  const minimumParts = parseVersion(`${label} minimum`, minimum);

  for (let index = 0; index < minimumParts.length; index += 1) {
    if (currentParts[index] > minimumParts[index]) {
      return;
    }

    if (currentParts[index] < minimumParts[index]) {
      throw new Error(`${label} ${current} does not satisfy >=${minimum}`);
    }
  }
};

const readJsonObject = (path) => {
  const value = JSON.parse(readFileSync(path, "utf8"));

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object`);
  }

  return value;
};

const manifest = readJsonObject(new URL("../package.json", import.meta.url));
const lockfile = readJsonObject(
  new URL("../package-lock.json", import.meta.url),
);
const lockfilePackages = lockfile.packages;

if (
  typeof lockfilePackages !== "object" ||
  lockfilePackages === null ||
  Array.isArray(lockfilePackages)
) {
  throw new Error("package-lock.json must define a packages object");
}

const lockfileRoot = lockfilePackages[""];

if (
  typeof lockfileRoot !== "object" ||
  lockfileRoot === null ||
  Array.isArray(lockfileRoot)
) {
  throw new Error("package-lock.json must define its root package");
}

for (const dependencyClass of ["dependencies", "devDependencies"]) {
  const manifestDependencies = manifest[dependencyClass];
  const lockedDependencies = lockfileRoot[dependencyClass];

  if (
    typeof manifestDependencies !== "object" ||
    manifestDependencies === null ||
    Array.isArray(manifestDependencies) ||
    typeof lockedDependencies !== "object" ||
    lockedDependencies === null ||
    Array.isArray(lockedDependencies)
  ) {
    throw new Error(`${dependencyClass} must exist in the manifest and lockfile`);
  }

  if (JSON.stringify(manifestDependencies) !== JSON.stringify(lockedDependencies)) {
    throw new Error(`${dependencyClass} differ between package.json and package-lock.json`);
  }
}

assertMinimumVersion("Node.js", process.versions.node, "22.13.0");

const npmUserAgent = process.env.npm_config_user_agent;
const npmVersion =
  typeof npmUserAgent === "string"
    ? /(?:^|\s)npm\/([^\s]+)/u.exec(npmUserAgent)?.[1]
    : undefined;

if (npmVersion === undefined) {
  throw new Error("npm run validate must provide an npm user agent");
}

assertMinimumVersion("npm", npmVersion, "10.0.0");

console.log(
  `Environment valid: Node.js ${process.versions.node}, npm ${npmVersion}, lockfile v${lockfile.lockfileVersion}`,
);
