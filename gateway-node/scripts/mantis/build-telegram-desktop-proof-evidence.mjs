#!/usr/bin/env node
/**
 * Build the Mantis evidence for a Telegram Desktop proof run.
 *
 * The proof lane captures a GIF of the Telegram Desktop chat pane for the
 * baseline and for the candidate. This script pairs both lanes into a single
 * evidence manifest so the PR comment can show them side by side.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { EVIDENCE_SCHEMA_VERSION, writeManifestFile } from "./evidence-common.mjs";

const SUMMARY_FILENAME = "telegram-user-crabbox-session-summary.json";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function readLaneSummary(repoRoot, outputDir) {
  const summaryPath = path.join(outputDir, SUMMARY_FILENAME);
  if (!existsSync(summaryPath)) {
    return { artifacts: {}, status: "unknown" };
  }
  try {
    return JSON.parse(readFileSync(summaryPath, "utf8"));
  } catch {
    return { artifacts: {}, status: "unknown" };
  }
}

function resolveRepoFile(repoRoot, relativePath) {
  if (!relativePath) {
    return undefined;
  }
  const candidate = path.resolve(repoRoot, relativePath);
  return existsSync(candidate) ? candidate : undefined;
}

/**
 * Write the paired baseline/candidate proof evidence.
 */
export function writeTelegramDesktopProofEvidence(argv) {
  const options = parseArgs(argv);
  const outputDir = path.resolve(String(options["output-dir"] ?? ""));
  if (!options["output-dir"]) {
    throw new Error("Missing --output-dir");
  }
  const scenarioLabel = String(options["scenario-label"] ?? "telegram-desktop-proof");

  const lanes = [
    {
      key: "baseline",
      repoRoot: String(options["baseline-repo-root"] ?? ""),
      outputDir: String(options["baseline-output-dir"] ?? ""),
      ref: options["baseline-ref"],
      sha: options["baseline-sha"],
    },
    {
      key: "candidate",
      repoRoot: String(options["candidate-repo-root"] ?? ""),
      outputDir: String(options["candidate-output-dir"] ?? ""),
      ref: options["candidate-ref"],
      sha: options["candidate-sha"],
    },
  ];

  const artifacts = [];
  const comparison = { pass: true };

  for (const lane of lanes) {
    const repoRoot = path.resolve(lane.repoRoot);
    const laneOutputDir = path.resolve(lane.outputDir);
    const summary = readLaneSummary(repoRoot, laneOutputDir);
    const status = summary.status === "pass" ? "pass" : "fail";
    const laneDir = path.join(outputDir, lane.key);
    mkdirSync(laneDir, { recursive: true });

    const gifSource = resolveRepoFile(repoRoot, summary.artifacts?.previewGifCropped);
    if (gifSource) {
      const gifName = `${scenarioLabel}.gif`;
      copyFileSync(gifSource, path.join(laneDir, gifName));
      artifacts.push({
        alt: `${lane.key} Telegram Desktop proof`,
        kind: "motionPreview",
        label: `${lane.key === "baseline" ? "Baseline" : "Candidate"} Telegram Desktop proof`,
        lane: lane.key,
        path: `${lane.key}/${gifName}`,
        targetPath: `${lane.key}/${gifName}`,
      });
    }

    const screenshotSource = resolveRepoFile(repoRoot, summary.artifacts?.screenshot);
    if (screenshotSource) {
      const screenshotName = `${scenarioLabel}.png`;
      copyFileSync(screenshotSource, path.join(laneDir, screenshotName));
      artifacts.push({
        alt: `${lane.key} Telegram Desktop screenshot`,
        kind: "screenshot",
        label: `${lane.key === "baseline" ? "Baseline" : "Candidate"} Telegram Desktop screenshot`,
        lane: lane.key,
        path: `${lane.key}/${screenshotName}`,
        targetPath: `${lane.key}/${screenshotName}`,
      });
    }

    comparison[lane.key] = {
      expected: `expected ${lane.key} visual proof captured`,
      ref: lane.ref,
      sha: lane.sha,
      status,
    };
    if (status !== "pass") {
      comparison.pass = false;
    }
  }

  const manifest = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "telegram-desktop-proof",
    title: "Mantis Telegram Desktop Proof",
    summary: `Mantis captured the Telegram Desktop proof for ${scenarioLabel}.`,
    scenario: scenarioLabel,
    comparison,
    artifacts,
  };

  const manifestPath = path.join(outputDir, "mantis-evidence.json");
  writeManifestFile(manifestPath, manifest);

  return { manifest, manifestPath, outputDir };
}
