import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveRepoRoot } from "../../scripts/lib/ts-guard-utils.mjs";

/**
 * Regression tests for resolveRepoRoot().
 *
 * The original implementation went up exactly two levels from the caller's
 * import.meta.url, which broke for scripts at scripts/*.mjs (one level below
 * root) — it overshot to the repo's parent directory.
 *
 * This repository is a monorepo: the git checkout root sits one level above
 * the package root, so the workspace root is the nearest ancestor that holds
 * both package.json and pnpm-workspace.yaml. Every caller depth has to land
 * on that same directory, otherwise the ts-guard source roots ("src",
 * "extensions", ...) resolve to paths that do not exist.
 */
describe("resolveRepoRoot", () => {
  it("resolves correctly from a scripts/lib/*.mjs path (two levels below root)", () => {
    const fakeUrl = pathToFileURL(path.resolve("scripts", "lib", "some-guard-utils.mjs")).href;
    const root = resolveRepoRoot(fakeUrl);

    expect(existsSync(path.join(root, "package.json"))).toBe(true);
    expect(existsSync(path.join(root, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("resolves correctly from a scripts/*.mjs path (one level below root)", () => {
    const fakeUrl = pathToFileURL(path.resolve("scripts", "check-no-raw-channel-fetch.mjs")).href;
    const root = resolveRepoRoot(fakeUrl);

    expect(existsSync(path.join(root, "package.json"))).toBe(true);
    expect(existsSync(path.join(root, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("resolves correctly from a deeply nested extension path", () => {
    const fakeUrl = pathToFileURL(
      path.resolve("extensions", "qqbot", "src", "utils", "hypothetical.mjs"),
    ).href;
    const root = resolveRepoRoot(fakeUrl);

    expect(existsSync(path.join(root, "package.json"))).toBe(true);
    expect(existsSync(path.join(root, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("all caller depths resolve to the same root", () => {
    const fromLib = resolveRepoRoot(pathToFileURL(path.resolve("scripts", "lib", "a.mjs")).href);
    const fromScripts = resolveRepoRoot(pathToFileURL(path.resolve("scripts", "b.mjs")).href);
    const fromExtension = resolveRepoRoot(
      pathToFileURL(path.resolve("extensions", "qqbot", "c.mjs")).href,
    );

    expect(fromLib).toBe(fromScripts);
    expect(fromScripts).toBe(fromExtension);
  });
});
