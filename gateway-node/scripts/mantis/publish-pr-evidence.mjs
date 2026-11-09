// Publishes Mantis evidence manifests as PR comments and to R2-compatible
// object storage. Used by the mantis evidence builders and the mantis
// workflows. Manifests are plain JSON: { schemaVersion, id, title, summary,
// scenario, comparison { baseline, candidate, pass }, artifacts [] }.
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const EVIDENCE_MANIFEST_FILE_NAME = "mantis-evidence.json";
export const EVIDENCE_INDEX_FILE_NAME = "index.json";

const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/u;

function isPathEscapingBase(baseDir, candidate) {
  const normalized = path.normalize(candidate);
  if (normalized === baseDir) return false;
  if (path.isAbsolute(normalized) && !normalized.startsWith(baseDir + path.sep)) {
    return true;
  }
  return !normalized.startsWith(baseDir + path.sep);
}

function resolveArtifactPath(baseDir, artifactPath) {
  const resolved = path.resolve(baseDir, artifactPath);
  if (isPathEscapingBase(baseDir, resolved)) {
    throw new Error(`Mantis evidence artifact path escapes manifest directory: ${artifactPath}`);
  }
  return resolved;
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function loadEvidenceManifest(manifestPath) {
  const baseDir = path.dirname(path.resolve(manifestPath));
  const manifest = readJsonFile(manifestPath);

  const artifacts = [];
  for (const artifact of manifest.artifacts ?? []) {
    const resolved = resolveArtifactPath(baseDir, artifact.path ?? "");
    // Optional visual artifacts may legitimately be absent on failed runs.
    if (artifact.required === false && !existsFile(resolved)) {
      continue;
    }
    artifacts.push(artifact);
  }
  artifacts.push({
    kind: "metadata",
    label: "Mantis evidence manifest",
    lane: "run",
    path: EVIDENCE_MANIFEST_FILE_NAME,
    targetPath: EVIDENCE_MANIFEST_FILE_NAME,
  });
  return { ...manifest, artifacts, manifestDir: baseDir };
}

function existsFile(filePath) {
  try {
    return readFileSync(filePath).length >= 0;
  } catch {
    return false;
  }
}

function laneOf(artifact) {
  return artifact.lane ?? "run";
}

function isVisualKind(kind) {
  return kind !== "motionClip" && kind !== "metadata" && kind !== "report";
}

export function renderEvidenceComment({
  artifactUrl,
  manifest,
  marker,
  rawBase,
  runUrl,
  treeUrl,
}) {
  const lines = [];
  lines.push(marker);
  lines.push("");
  lines.push(`## ${manifest.title ?? "Mantis Evidence"}`);
  lines.push("");
  lines.push(`Summary: ${manifest.summary ?? ""}`);
  lines.push("");

  const baseline = manifest.comparison?.baseline;
  const candidate = manifest.comparison?.candidate;
  const pass = manifest.comparison?.pass;

  if (baseline && candidate) {
    lines.push(
      `- Baseline: \`${baseline.status}\` at \`${baseline.sha ?? "unknown"}\`, expected ${baseline.expected}`,
    );
    lines.push(
      `- Candidate: \`${candidate.status}\` at \`${candidate.sha ?? "unknown"}\`, expected ${candidate.expected}`,
    );
  } else if (candidate) {
    lines.push(
      `- Candidate: \`${candidate.status}\` at \`${candidate.sha ?? "unknown"}\`, expected ${candidate.expected}`,
    );
  }
  lines.push(`- Overall: \`${pass}\``);
  if (artifactUrl) {
    lines.push(`- Artifact: ${artifactUrl}`);
  }
  if (runUrl) {
    lines.push(`- Run: ${runUrl}`);
  }
  lines.push("");

  const visualByLane = new Map();
  const links = [];
  for (const artifact of manifest.artifacts ?? []) {
    if (artifact.kind === "motionClip") {
      links.push(`[${artifact.label}](${rawBase}/${artifact.targetPath})`);
      continue;
    }
    if (!isVisualKind(artifact.kind)) continue;
    const lane = laneOf(artifact);
    if (!visualByLane.has(lane)) {
      visualByLane.set(lane, artifact);
    }
  }

  const lanes = ["baseline", "candidate"].filter((lane) => visualByLane.has(lane));
  if (lanes.length > 0) {
    lines.push('<table width="100%">');
    const headerRow = lanes
      .map((lane) => {
        const laneExpected =
          lane === "baseline" ? baseline?.expected : candidate?.expected;
        const title = lane === "baseline" ? "Baseline" : "Candidate";
        return `<th width="50%">${laneExpected ? `${title} ${laneExpected}` : title}</th>`;
      })
      .join("");
    lines.push(`<tr>${headerRow}</tr>`);
    const mediaRow = lanes
      .map((lane) => {
        const artifact = visualByLane.get(lane);
        const alt = artifact.alt ?? artifact.label ?? lane;
        return `<td width="50%" align="center"><img src="${rawBase}/${artifact.targetPath}" width="100%" alt="${alt}"></td>`;
      })
      .join("");
    lines.push(`<tr>${mediaRow}</tr>`);
    lines.push("</table>");
    lines.push("");
  }

  for (const link of links) {
    lines.push(link);
  }
  if (links.length > 0) {
    lines.push("");
  }

  if (treeUrl) {
    lines.push(`Raw QA files: ${treeUrl}`);
  }

  return lines.join("\n");
}

export function shouldPublishPrComment(manifest, { requestSource }) {
  return requestSource === "issue_comment" && manifest.comparison?.pass === true;
}

function contentTypeFor(targetPath) {
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".md") return "text/markdown";
  return "application/json";
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function signKey(secret, dateStamp, region) {
  let key = hmac(`AWS4${secret}`, dateStamp);
  key = hmac(key, region);
  key = hmac(key, "s3");
  return hmac(key, "aws4_request");
}

async function putObject({ fetchImpl, endpoint, bucket, key, body, contentType, accessKeyId, secretAccessKey, region, date }) {
  const url = `${endpoint}/${bucket}/${key}`;
  const amzDate = date.toISOString().replace(/[:-]|\.[0-9]{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const host = new URL(url).host;
  const canonicalUri = `/${bucket}/${key}`;
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signKey(secretAccessKey, dateStamp, region))
    .update(stringToSign)
    .digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetchImpl(url, {
    method: "PUT",
    body,
    headers: {
      "content-type": contentType,
      "x-amz-date": amzDate,
      authorization,
    },
  });
}

export async function publishArtifactFiles({
  artifactRoot,
  fetchImpl,
  manifest,
  manifestDir,
  storageConfig,
  manifestPath,
}) {
  const baseDir =
    manifestDir ?? manifest?.manifestDir ?? (manifestPath ? path.dirname(path.resolve(manifestPath)) : process.cwd());
  const { accessKeyId, bucket, endpoint, publicBaseUrl, region, secretAccessKey } = storageConfig;
  const date = new Date();
  const rawBase = `${publicBaseUrl}/${artifactRoot}`;

  for (const artifact of manifest.artifacts ?? []) {
    if (artifact.targetPath === EVIDENCE_MANIFEST_FILE_NAME) continue;
    const filePath = resolveArtifactPath(baseDir, artifact.path);
    await putObject({
      fetchImpl,
      endpoint,
      bucket,
      key: `${artifactRoot}/${artifact.targetPath}`,
      body: readFileSync(filePath),
      contentType: contentTypeFor(artifact.targetPath),
      accessKeyId,
      secretAccessKey,
      region,
      date,
    });
  }

  const manifestBody = readFileSync(path.join(baseDir, EVIDENCE_MANIFEST_FILE_NAME));
  await putObject({
    fetchImpl,
    endpoint,
    bucket,
    key: `${artifactRoot}/${EVIDENCE_MANIFEST_FILE_NAME}`,
    body: manifestBody,
    contentType: "application/json",
    accessKeyId,
    secretAccessKey,
    region,
    date,
  });

  const indexEntries = (manifest.artifacts ?? []).map((artifact) => ({
    targetPath: artifact.targetPath,
    url: `${rawBase}/${artifact.targetPath}`,
  }));
  indexEntries.push({
    targetPath: EVIDENCE_MANIFEST_FILE_NAME,
    url: `${rawBase}/${EVIDENCE_MANIFEST_FILE_NAME}`,
  });
  await putObject({
    fetchImpl,
    endpoint,
    bucket,
    key: `${artifactRoot}/${EVIDENCE_INDEX_FILE_NAME}`,
    body: Buffer.from(JSON.stringify({ files: indexEntries }, null, 2)),
    contentType: "application/json",
    accessKeyId,
    secretAccessKey,
    region,
    date,
  });

  return {
    artifactRoot,
    rawBase,
    treeUrl: `${rawBase}/${EVIDENCE_INDEX_FILE_NAME}`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [manifestPath] = process.argv.slice(2);
  const manifest = loadEvidenceManifest(manifestPath ?? "mantis-evidence.json");
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
