// Builds paired Telegram Desktop GIF evidence (baseline/candidate lanes) for
// PR comments: copies each lane's cropped session GIF + report into the
// output dir and writes a Mantis manifest.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  EVIDENCE_MANIFEST_FILE_NAME,
  loadEvidenceManifest,
} from "./publish-pr-evidence.mjs";

const GIF_TARGET_PATH = "telegram-desktop-proof.gif";
const DEFAULT_EXPECTED = "visual proof captured";

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      options[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return options;
}

function readLaneSummary(laneOutputDir) {
  return JSON.parse(
    readFileSync(path.join(laneOutputDir, "telegram-user-crabbox-session-summary.json"), "utf8"),
  );
}

export function writeTelegramDesktopProofEvidence(args) {
  const options = parseArgs(args);
  const outputDir = options["output-dir"];
  if (!outputDir) {
    throw new Error("writeTelegramDesktopProofEvidence requires --output-dir");
  }

  const lanes = [
    {
      lane: "baseline",
      repoRoot: options["baseline-repo-root"],
      laneOutputDir: options["baseline-output-dir"],
      ref: options["baseline-ref"],
      sha: options["baseline-sha"],
    },
    {
      lane: "candidate",
      repoRoot: options["candidate-repo-root"],
      laneOutputDir: options["candidate-output-dir"],
      ref: options["candidate-ref"],
      sha: options["candidate-sha"],
    },
  ];

  const artifacts = [];
  const comparison = { pass: true };
  for (const { lane, repoRoot, laneOutputDir, ref, sha } of lanes) {
    const summary = readLaneSummary(laneOutputDir);
    const gifSource = path.resolve(repoRoot, summary.artifacts.previewGifCropped);
    const gifDir = path.join(outputDir, lane);
    mkdirSync(gifDir, { recursive: true });
    const gifTarget = path.join(gifDir, GIF_TARGET_PATH);
    copyFileSync(gifSource, gifTarget);

    const status = summary.status ?? "pass";
    comparison[lane] = {
      expected: `${lane} ${DEFAULT_EXPECTED}`,
      ref,
      sha,
      status,
    };
    if (status !== "pass") comparison.pass = false;

    artifacts.push({
      alt: `${lane === "baseline" ? "Baseline" : "Candidate"} Telegram Desktop chat`,
      kind: "timeline",
      label: `${lane === "baseline" ? "Baseline" : "Candidate"} Telegram Desktop proof`,
      lane,
      path: gifTarget,
      targetPath: `${lane}/${GIF_TARGET_PATH}`,
    });

    const reportSource = path.resolve(repoRoot, summary.report);
    const reportTarget = path.join(gifDir, "telegram-desktop-proof-report.md");
    copyFileSync(reportSource, reportTarget);
    artifacts.push({
      kind: "report",
      label: `${lane} proof report`,
      lane,
      path: reportTarget,
      targetPath: `${lane}/telegram-desktop-proof-report.md`,
    });
  }

  const manifest = {
    schemaVersion: 1,
    id: "telegram-desktop-proof",
    title: "Mantis Telegram Desktop Proof",
    summary: "Native Telegram Desktop sessions captured baseline and candidate proof GIFs.",
    scenario: options["scenario-label"] ?? "telegram-desktop-proof",
    comparison,
    artifacts,
  };

  const manifestPath = path.join(outputDir, EVIDENCE_MANIFEST_FILE_NAME);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifest: loadEvidenceManifest(manifestPath), manifestPath, outputDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = writeTelegramDesktopProofEvidence(process.argv.slice(2));
  process.stdout.write(`Mantis Telegram Desktop proof evidence: ${result.manifestPath}\n`);
}
