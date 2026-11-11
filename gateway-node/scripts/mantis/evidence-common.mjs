/**
 * Shared helpers for the Mantis evidence scripts.
 *
 * A Mantis evidence manifest is the contract between the QA run that produces
 * the artifacts and the PR comment that publishes them. It lists the files
 * that make up the evidence, the baseline/candidate comparison, and enough
 * metadata for the comment renderer to stay generic.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const EVIDENCE_MANIFEST_FILENAME = "mantis-evidence.json";
export const EVIDENCE_SCHEMA_VERSION = 1;

/** Artifact kinds that are rendered inline as images in the PR comment. */
const INLINE_IMAGE_KINDS = new Set([
  "timeline",
  "desktopScreenshot",
  "screenshot",
  "image",
  "motionPreview",
]);

const CONTENT_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".json", "application/json"],
  [".md", "text/markdown; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);

export function contentTypeFor(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeMarkdown(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function isInside(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Read a manifest from disk and normalise it:
 * - artifact paths must stay inside the manifest directory
 * - artifacts whose file is gone are dropped (optional visual proof)
 * - the manifest itself is appended as the last artifact
 */
export function loadEvidenceManifest(manifestPath) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const manifestDir = path.dirname(resolvedManifestPath);
  const raw = JSON.parse(readFileSync(resolvedManifestPath, "utf8"));

  const artifacts = [];
  for (const artifact of raw.artifacts ?? []) {
    const relativePath = typeof artifact.path === "string" ? artifact.path : "";
    const resolvedArtifactPath = path.resolve(manifestDir, relativePath);
    if (!isInside(manifestDir, resolvedArtifactPath)) {
      throw new Error(`artifact path escapes manifest directory: ${relativePath}`);
    }
    if (!existsSync(resolvedArtifactPath) || !statSync(resolvedArtifactPath).isFile()) {
      // Optional visual proof is allowed to be missing (the run failed before
      // the screenshot was taken); the manifest still describes the run.
      continue;
    }
    artifacts.push({ ...artifact, path: relativePath });
  }

  artifacts.push({
    kind: "metadata",
    label: "Mantis evidence manifest",
    lane: "run",
    path: path.basename(resolvedManifestPath),
    targetPath: EVIDENCE_MANIFEST_FILENAME,
  });

  return {
    ...raw,
    artifacts,
    manifestDir: manifestDir,
  };
}

export function artifactSourcePath(manifest, artifact) {
  const manifestDir = manifest.manifestDir ?? process.cwd();
  return path.resolve(manifestDir, artifact.path);
}

export function isInlineImageArtifact(artifact) {
  return INLINE_IMAGE_KINDS.has(String(artifact.kind ?? ""));
}

export function manifestVisualArtifacts(manifest) {
  return (manifest.artifacts ?? []).filter(isInlineImageArtifact);
}

export function manifestLinkArtifacts(manifest) {
  return (manifest.artifacts ?? []).filter(
    (artifact) =>
      !isInlineImageArtifact(artifact) &&
      artifact.kind !== "metadata" &&
      artifact.kind !== "report",
  );
}

/**
 * A capture-infrastructure failure is not a product regression: the run never
 * produced comparable evidence, so the PR comment would only add noise.
 */
export function isCaptureInfrastructureFailure(summary) {
  const text = String(summary ?? "").toLowerCase();
  return (
    text.includes("could not capture") ||
    text.includes("capture infrastructure") ||
    text.includes("logged-out welcome screen") ||
    text.includes("logged out welcome screen")
  );
}

export function comparisonLane(comparison, lane) {
  const value = comparison?.[lane];
  return value && typeof value === "object" ? value : undefined;
}

export function describeLane(comparison, lane) {
  const entry = comparisonLane(comparison, lane);
  if (!entry) {
    return undefined;
  }
  const status = entry.status ?? "unknown";
  const sha = entry.sha ? ` at \`${entry.sha}\`` : "";
  const expected = entry.expected ? `, ${entry.expected}` : "";
  const laneLabel = lane === "baseline" ? "Baseline" : "Candidate";
  return `- ${laneLabel}: \`${status}\`${sha}${expected}`;
}

export function writeManifestFile(manifestPath, manifest) {
  const serializable = { ...manifest };
  delete serializable.manifestDir;
  writeFileSync(manifestPath, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");
  return manifestPath;
}
