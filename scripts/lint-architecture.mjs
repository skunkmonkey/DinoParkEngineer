import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceExtensions = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);
const importExtensions = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const sourceRoots = ["src", "app", "tests"]
  .map((directory) => resolve(repositoryRoot, directory))
  .filter((directory) => existsSync(directory));

const toPosix = (path) => path.split(sep).join("/");

const isWithin = (candidate, parent) => {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
};

const walk = (directory) => {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(entryPath));
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
};

const sourceFiles = sourceRoots.flatMap(walk).sort((left, right) =>
  toPosix(relative(repositoryRoot, left)).localeCompare(
    toPosix(relative(repositoryRoot, right)),
    "en",
    { sensitivity: "variant" },
  ),
);

const srcRoot = resolve(repositoryRoot, "src");
const packageRoots = existsSync(srcRoot)
  ? readdirSync(srcRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !new Set(["shell", "styles"]).has(entry.name),
      )
      .map((entry) => resolve(srcRoot, entry.name))
  : [];

const pathSegments = (path) => {
  const relativePath = relative(repositoryRoot, path);
  return relativePath === "" ? [] : relativePath.split(sep);
};

/**
 * Resolve a path using directory entries rather than the host filesystem's
 * case rules. This makes the check meaningful on case-insensitive macOS and
 * Windows volumes as well as on Linux CI.
 */
const resolveWithExactCasing = (candidate) => {
  if (!isWithin(candidate, repositoryRoot)) {
    return { path: null, caseMismatch: false };
  }

  let current = repositoryRoot;
  let caseMismatch = false;

  for (const segment of pathSegments(candidate)) {
    let entries;

    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return { path: null, caseMismatch };
    }

    const exactEntry = entries.find((entry) => entry.name === segment);

    if (exactEntry !== undefined) {
      current = resolve(current, exactEntry.name);
      continue;
    }

    const insensitiveEntry = entries.find(
      (entry) => entry.name.toLocaleLowerCase("en-US") === segment.toLocaleLowerCase("en-US"),
    );

    if (insensitiveEntry === undefined) {
      return { path: null, caseMismatch };
    }

    caseMismatch = true;
    current = resolve(current, insensitiveEntry.name);
  }

  return { path: current, caseMismatch };
};

const resolveImportTarget = (importer, specifier) => {
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0];
  let requestedPath;

  if (cleanSpecifier.startsWith("@/")) {
    requestedPath = resolve(repositoryRoot, "src", cleanSpecifier.slice(2));
  } else if (cleanSpecifier.startsWith(".")) {
    requestedPath = resolve(dirname(importer), cleanSpecifier);
  } else {
    return { path: null, caseMismatch: false };
  }

  const candidates = [requestedPath];

  if (extname(requestedPath) === "") {
    candidates.push(...importExtensions.map((extension) => `${requestedPath}${extension}`));
    candidates.push(
      ...importExtensions.map((extension) => resolve(requestedPath, `index${extension}`)),
    );
  }

  let caseMismatch = false;

  for (const candidate of candidates) {
    const result = resolveWithExactCasing(candidate);

    if (result.path !== null && lstatSync(result.path).isFile()) {
      return { path: result.path, caseMismatch: result.caseMismatch };
    }

    caseMismatch ||= result.caseMismatch;
  }

  return { path: null, caseMismatch };
};

const importPatterns = [
  /\bimport\s+(?:type\s+)?[\s\S]*?\sfrom\s*["']([^"']+)["']/gu,
  /\bimport\s*["']([^"']+)["']/gu,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  /\bexport\s+(?:type\s+)?[\s\S]*?\sfrom\s*["']([^"']+)["']/gu,
];

const readImports = (source) => {
  const specifiers = new Set();

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];

      if (specifier !== undefined) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers].sort();
};

const diagnostics = [];
const shellRoot = resolve(repositoryRoot, "src/shell");
const shellPublic = resolve(shellRoot, "public.ts");

const assignmentOperators = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

const importedRuntimeBindings = (sourceFile) => {
  const bindings = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.name !== undefined) bindings.add(clause.name.text);
    const named = clause?.namedBindings;
    if (named !== undefined && ts.isNamespaceImport(named)) {
      bindings.add(named.name.text);
    } else if (named !== undefined) {
      for (const element of named.elements) {
        if (!element.isTypeOnly) bindings.add(element.name.text);
      }
    }
  }
  return bindings;
};

const assignmentRoot = (expression) => {
  let current = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
};

const findImportedMutation = (path, source) => {
  if (extname(path) !== ".tsx") return [];
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imported = importedRuntimeBindings(sourceFile);
  const lines = [];
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      assignmentOperators.has(node.operatorToken.kind)
    ) {
      const root = assignmentRoot(node.left);
      if (root !== undefined && imported.has(root)) {
        lines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return lines;
};

for (const importer of sourceFiles) {
  const source = readFileSync(importer, "utf8");

  for (const line of findImportedMutation(importer, source)) {
    diagnostics.push(
      `${toPosix(relative(repositoryRoot, importer))}:${line}: UI code must issue commands instead of mutating an imported projection or service`,
    );
  }

  for (const specifier of readImports(source)) {
    const target = resolveImportTarget(importer, specifier);

    if (target.caseMismatch) {
      diagnostics.push(
        `${toPosix(relative(repositoryRoot, importer))}: import '${specifier}' does not match on-disk casing`,
      );
    }

    if (
      target.path !== null &&
      isWithin(target.path, shellRoot) &&
      !isWithin(importer, shellRoot) &&
      resolve(target.path) !== shellPublic
    ) {
      diagnostics.push(
        `${toPosix(relative(repositoryRoot, importer))}: shell consumers must import src/shell/public.ts, not '${specifier}'`,
      );
    }

    const owningPackage =
      target.path === null
        ? undefined
        : packageRoots.find((packageRoot) => isWithin(target.path, packageRoot));

    if (
      owningPackage !== undefined &&
      !isWithin(importer, owningPackage) &&
      toPosix(relative(owningPackage, target.path)) !== "public.ts"
    ) {
      diagnostics.push(
        `${toPosix(relative(repositoryRoot, importer))}: cross-package imports must use ${toPosix(relative(repositoryRoot, owningPackage))}/public.ts, not '${specifier}'`,
      );
    }
  }
}

if (diagnostics.length > 0) {
  console.error("Architecture validation failed:");
  for (const diagnostic of diagnostics.sort()) {
    console.error(`- ${diagnostic}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Architecture validation passed: checked ${sourceFiles.length} source file${
      sourceFiles.length === 1 ? "" : "s"
    } with case-sensitive import, public-boundary, and UI command-only rules.`,
  );
}
