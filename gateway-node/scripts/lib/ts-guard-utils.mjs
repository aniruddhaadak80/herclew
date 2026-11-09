import { existsSync, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let tsCache;

function getTypeScript() {
  tsCache ??= require("typescript");
  return tsCache;
}

const baseTestSuffixes = [".test.ts", ".test-utils.ts", ".test-harness.ts", ".e2e-harness.ts"];

export function resolveRepoRoot(importMetaUrl) {
  // Walk up from the caller's directory until we find the repo root:
  // the nearest ancestor containing the host (openclaw) package.json
  // whose ancestry includes a .git marker. Extensions ship their own
  // @openclaw/* package.jsons, so a bare package.json match would stop
  // at extensions/<name>; the host package name disambiguates.
  // Nested checkouts put the .git dir one level above the host root.
  const { root } = path.parse(path.dirname(fileURLToPath(importMetaUrl)));
  let dir = path.dirname(fileURLToPath(importMetaUrl));
  let packageRoot = null;
  let current = dir;
  while (current !== root) {
    const pkgPath = path.join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const name = require(pkgPath).name;
        if (name === "openclaw") {
          if (!packageRoot) {
            packageRoot = current;
          }
          break;
        }
      } catch {
        // fall through to the next ancestor
      }
    }
    current = path.dirname(current);
  }
  if (packageRoot) {
    let ancestor = path.dirname(packageRoot);
    while (ancestor !== root) {
      if (existsSync(path.join(ancestor, ".git"))) {
        return packageRoot;
      }
      ancestor = path.dirname(ancestor);
    }
  }
  dir = path.dirname(fileURLToPath(importMetaUrl));
  while (dir !== root) {
    if (existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback: two levels up (original behavior).
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..", "..");
}

export function resolveSourceRoots(repoRoot, relativeRoots) {
  return relativeRoots.map((root) => path.join(repoRoot, ...root.split("/").filter(Boolean)));
}

function isTestLikeTypeScriptFile(filePath, options = {}) {
  const extraTestSuffixes = options.extraTestSuffixes ?? [];
  return [...baseTestSuffixes, ...extraTestSuffixes].some((suffix) => filePath.endsWith(suffix));
}

export async function collectTypeScriptFiles(targetPath, options = {}) {
  const includeTests = options.includeTests ?? false;
  const extraTestSuffixes = options.extraTestSuffixes ?? [];
  const skipNodeModules = options.skipNodeModules ?? true;
  const ignoreMissing = options.ignoreMissing ?? false;

  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch (error) {
    if (
      ignoreMissing &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  if (stat.isFile()) {
    if (!targetPath.endsWith(".ts")) {
      return [];
    }
    if (!includeTests && isTestLikeTypeScriptFile(targetPath, { extraTestSuffixes })) {
      return [];
    }
    return [targetPath];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (skipNodeModules && entry.name === "node_modules") {
        continue;
      }
      out.push(...(await collectTypeScriptFiles(entryPath, options)));
      continue;
    }
    if (!entry.isFile() || !entryPath.endsWith(".ts")) {
      continue;
    }
    if (!includeTests && isTestLikeTypeScriptFile(entryPath, { extraTestSuffixes })) {
      continue;
    }
    out.push(entryPath);
  }
  return out;
}

export async function collectTypeScriptFilesFromRoots(sourceRoots, options = {}) {
  return (
    await Promise.all(
      sourceRoots.map(
        async (root) =>
          await collectTypeScriptFiles(root, {
            ignoreMissing: true,
            ...options,
          }),
      ),
    )
  ).flat();
}

export async function collectFileViolations(params) {
  const files = await collectTypeScriptFilesFromRoots(params.sourceRoots, {
    extraTestSuffixes: params.extraTestSuffixes,
  });

  const violations = [];
  for (const filePath of files) {
    if (params.skipFile?.(filePath)) {
      continue;
    }
    const content = await fs.readFile(filePath, "utf8");
    const fileViolations = params.findViolations(content, filePath);
    for (const violation of fileViolations) {
      violations.push({
        path: path.relative(params.repoRoot, filePath),
        ...violation,
      });
    }
  }
  return violations;
}

export function toLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function getPropertyNameText(name) {
  const ts = getTypeScript();
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

export function unwrapExpression(expression) {
  const ts = getTypeScript();
  let current = expression;
  while (true) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

export function collectCallExpressionLines(ts, sourceFile, resolveLineNode) {
  const lines = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const lineNode = resolveLineNode(node);
      if (lineNode) {
        lines.push(toLine(sourceFile, lineNode));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return lines;
}

function isDirectExecution(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === fileURLToPath(importMetaUrl);
}

export function runAsScript(importMetaUrl, main) {
  if (!isDirectExecution(importMetaUrl)) {
    return;
  }
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
