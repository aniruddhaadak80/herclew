#!/usr/bin/env node
/**
 * Publish the Mantis evidence manifest as a PR comment.
 *
 * The manifest describes the artifacts that were captured for a baseline and
 * a candidate lane. This script renders them into a single comment that the
 * Mantis workflows can post, and can upload the raw files to an
 * S3-compatible object store so the comment can link to them.
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EVIDENCE_MANIFEST_FILENAME,
  EVIDENCE_SCHEMA_VERSION,
  artifactSourcePath,
  comparisonLane,
  describeLane,
  escapeMarkdown,
  isCaptureInfrastructureFailure,
  loadEvidenceManifest,
  manifestLinkArtifacts,
  manifestVisualArtifacts,
  writeManifestFile,
} from "./evidence-common.mjs";

export { loadEvidenceManifest };

const LANES = ["baseline", "candidate"];

/**
 * Render the PR comment for an evidence manifest.
 */
export function renderEvidenceComment(params) {
  const manifest = params?.manifest ?? {};
  const rawBase = trimTrailingSlash(params?.rawBase ?? "");
  const lines = [];

  if (params?.marker) {
    lines.push(String(params.marker));
  }
  lines.push(`## ${manifest.title ?? "Mantis QA Evidence"}`);
  if (manifest.summary) {
    lines.push(`Summary: ${manifest.summary}`);
  }
  if (manifest.scenario) {
    lines.push(`Scenario: \`${manifest.scenario}\``);
  }
  for (const lane of LANES) {
    const description = describeLane(manifest.comparison, lane);
    if (description) {
      lines.push(description);
    }
  }
  lines.push(`- Overall: \`${Boolean(manifest.comparison?.pass)}\``);
  if (params?.runUrl) {
    lines.push(`- Run: ${params.runUrl}`);
  }
  if (params?.artifactUrl) {
    lines.push(`- Artifact: ${params.artifactUrl}`);
  }
  if (params?.treeUrl) {
    lines.push(`Raw QA files: ${params.treeUrl}`);
  }

  const visualArtifacts = manifestVisualArtifacts(manifest);
  const laneArtifacts = new Map();
  for (const artifact of visualArtifacts) {
    const lane = artifact.lane === "baseline" ? "baseline" : "candidate";
    if (!laneArtifacts.has(lane)) {
      laneArtifacts.set(lane, []);
    }
    laneArtifacts.get(lane).push(artifact);
  }
  if (laneArtifacts.size > 0) {
    lines.push("");
    lines.push('<table width="100%">');
    lines.push("<tr>");
    for (const lane of LANES) {
      const artifacts = laneArtifacts.get(lane) ?? [];
      const label = artifacts[0]?.label ?? (lane === "baseline" ? "Baseline" : "Candidate");
      lines.push(`<th width="50%">${escapeMarkdown(label)}</th>`);
    }
    lines.push("</tr>");
    lines.push("<tr>");
    for (const lane of LANES) {
      const artifacts = laneArtifacts.get(lane) ?? [];
      const artifact = artifacts[0];
      if (!artifact) {
        lines.push('<td width="50%" align="center">no visual evidence</td>');
        continue;
      }
      const url = artifactUrl(rawBase, artifact);
      const alt = escapeMarkdown(artifact.alt ?? artifact.label ?? "");
      lines.push(
        `<td width="50%" align="center"><img src="${url}" width="100%" alt="${alt}" /></td>`,
      );
    }
    lines.push("</tr>");
    lines.push("</table>");
  }

  for (const artifact of manifestLinkArtifacts(manifest)) {
    const url = artifactUrl(rawBase, artifact);
    lines.push(`[${escapeMarkdown(artifact.label ?? artifact.targetPath)}](${url})`);
  }

  return `${lines.join("\n")}\n`;
}

function artifactUrl(rawBase, artifact) {
  const targetPath = String(artifact.targetPath ?? artifact.path ?? "");
  if (!rawBase) {
    return targetPath;
  }
  return `${rawBase}/${targetPath}`;
}

function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/u, "");
}

/**
 * Should this manifest be posted as a PR comment?
 *
 * A manual issue-comment request always publishes unless the run failed to
 * capture evidence at all. An automatic pull_request_target run only
 * publishes when there is visual proof to show.
 */
export function shouldPublishPrComment(manifest, params) {
  const requestSource = params?.requestSource;
  if (isCaptureInfrastructureFailure(manifest?.summary)) {
    return false;
  }
  if (manifest?.comparison?.pass === false) {
    return false;
  }
  if (requestSource === "issue_comment") {
    return true;
  }
  return manifestVisualArtifacts(manifest ?? {}).length > 0;
}

/**
 * Upload every manifest artifact to an S3-compatible object store and
 * return the public URLs for the uploaded tree.
 */
export async function publishArtifactFiles(params) {
  const manifest = params?.manifest ?? {};
  const storageConfig = params?.storageConfig ?? {};
  const fetchImpl = params?.fetchImpl ?? fetch;
  const artifactRoot = trimTrailingSlash(String(params?.artifactRoot ?? ""));
  const publicBaseUrl = trimTrailingSlash(String(storageConfig.publicBaseUrl ?? ""));
  const endpoint = trimTrailingSlash(String(storageConfig.endpoint ?? ""));
  const bucket = String(storageConfig.bucket ?? "");
  const rawBase = publicBaseUrl ? `${publicBaseUrl}/${artifactRoot}` : artifactRoot;
  const treeUrl = `${rawBase}/index.json`;

  const index = { artifacts: [] };
  for (const artifact of manifest.artifacts ?? []) {
    // The manifest itself is uploaded once, below, together with the index.
    if (artifact.targetPath === EVIDENCE_MANIFEST_FILENAME) {
      continue;
    }
    const sourcePath = artifactSourcePath(manifest, artifact);
    let body;
    try {
      body = readFileSync(sourcePath);
    } catch {
      continue;
    }
    const targetPath = String(artifact.targetPath ?? artifact.path ?? "");
    const url = `${endpoint}/${bucket}/${artifactRoot}/${targetPath}`;
    await putObject({
      body,
      contentType: contentTypeForTarget(targetPath),
      fetchImpl,
      storageConfig,
      url,
    });
    index.artifacts.push({
      kind: artifact.kind ?? "metadata",
      label: artifact.label ?? targetPath,
      targetPath,
      url: `${rawBase}/${targetPath}`,
    });
  }

  const manifestBody = Buffer.from(
    `${JSON.stringify(stripInternalFields(manifest), null, 2)}\n`,
    "utf8",
  );
  const manifestTarget = "mantis-evidence.json";
  await putObject({
    body: manifestBody,
    contentType: "application/json",
    fetchImpl,
    storageConfig,
    url: `${endpoint}/${bucket}/${artifactRoot}/${manifestTarget}`,
  });
  index.artifacts.push({
    kind: "metadata",
    label: "Mantis evidence manifest",
    targetPath: manifestTarget,
    url: `${rawBase}/${manifestTarget}`,
  });

  const indexBody = Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8");
  await putObject({
    body: indexBody,
    contentType: "application/json",
    fetchImpl,
    storageConfig,
    url: `${endpoint}/${bucket}/${artifactRoot}/index.json`,
  });

  return { artifactRoot, rawBase, treeUrl };
}

function stripInternalFields(manifest) {
  const serializable = { ...manifest };
  delete serializable.manifestDir;
  return serializable;
}

function contentTypeForTarget(targetPath) {
  const extension = path.extname(targetPath).toLowerCase();
  const types = new Map([
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".gif", "image/gif"],
    [".webp", "image/webp"],
    [".mp4", "video/mp4"],
    [".webm", "video/webm"],
    [".json", "application/json"],
    [".md", "text/markdown; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".txt", "text/plain; charset=utf-8"],
  ]);
  return types.get(extension) ?? "application/octet-stream";
}

async function putObject(params) {
  const { body, contentType, fetchImpl, storageConfig, url } = params;
  const headers = {
    "content-type": contentType,
    ...signRequest({
      body,
      contentType,
      method: "PUT",
      storageConfig,
      url,
    }),
  };
  const response = await fetchImpl(new URL(url), {
    body,
    headers,
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`failed to upload ${url}: ${response.status}`);
  }
}

/**
 * Minimal AWS SigV4 signing for S3-compatible object stores.
 */
function signRequest(params) {
  const { body, contentType, method, storageConfig, url } = params;
  const target = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/gu, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = String(storageConfig.region ?? "auto");
  const service = "s3";
  const accessKeyId = String(storageConfig.accessKeyId ?? "");
  const secretAccessKey = String(storageConfig.secretAccessKey ?? "");

  const canonicalHeaders = `content-type:${contentType}\nhost:${target.host}\nx-amz-content-sha256:${sha256Hex(body)}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    target.pathname,
    target.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    sha256Hex(body),
  ].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    "x-amz-content-sha256": sha256Hex(body),
    "x-amz-date": amzDate,
  };
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

export function buildEmptyManifest(overrides) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    ...overrides,
  };
}

export { comparisonLane, writeManifestFile };
