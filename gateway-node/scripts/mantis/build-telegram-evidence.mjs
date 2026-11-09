// Builds a Mantis evidence manifest + transcript page from telegram QA lane
// output files (telegram-qa-summary.json, telegram-qa-observed-messages.json,
// telegram-qa-report.md).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  EVIDENCE_MANIFEST_FILE_NAME,
  loadEvidenceManifest,
} from "./publish-pr-evidence.mjs";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

export function renderTelegramEvidenceHtml({ summary, observedMessages }) {
  const scenarios = summary?.scenarios ?? [];
  const rows = scenarios
    .map(
      (scenario) =>
        `<li>${escapeHtml(scenario.title ?? scenario.id)} — status: ${escapeHtml(scenario.status)}${scenario.details ? ` — ${escapeHtml(scenario.details)}` : ""}</li>`,
    )
    .join("\n");
  const messages = (observedMessages ?? [])
    .map(
      (message) =>
        `<div class="message"><span>${escapeHtml(message.scenarioTitle ?? message.scenarioId)}: ${escapeHtml(message.text)}</span></div>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Mantis Telegram Live Evidence</title></head>
<body>
<h1>Mantis Telegram Live Evidence</h1>
<ul>
${rows}
</ul>
<section>
${messages}
</section>
</body>
</html>
`;
}

export function buildTelegramEvidenceManifest({
  candidateRef,
  candidateSha,
  scenarioLabel,
  summary,
}) {
  const counts = summary?.counts ?? {};
  const failed = (counts.failed ?? 0) > 0;
  return {
    schemaVersion: 1,
    id: "telegram-live",
    title: "Mantis Telegram Live Evidence",
    summary: summary?.startedAt ? `Ran ${scenariosOf(summary).length} Telegram scenario(s).` : "Ran Telegram QA scenarios.",
    scenario: scenarioLabel,
    comparison: {
      candidate: {
        expected: "Telegram QA scenarios pass",
        ref: candidateRef,
        sha: candidateSha,
        status: failed ? "fail" : "pass",
      },
      pass: !failed,
    },
    artifacts: [],
  };
}

function scenariosOf(summary) {
  return summary?.scenarios ?? [];
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeTelegramEvidence(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      options[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  const outputDir = options["output-dir"];
  const candidateRef = options["candidate-ref"];
  const candidateSha = options["candidate-sha"];
  const scenarioLabel = options["scenario-label"];

  if (!outputDir) {
    throw new Error("writeTelegramEvidence requires --output-dir");
  }

  const summary = readJson(path.join(outputDir, "telegram-qa-summary.json"));
  const observedMessages = readJson(
    path.join(outputDir, "telegram-qa-observed-messages.json"),
  );

  const transcript = renderTelegramEvidenceHtml({ summary, observedMessages });
  const transcriptPath = path.join(outputDir, "telegram-live-transcript.html");
  writeFileSync(transcriptPath, transcript);

  const manifest = buildTelegramEvidenceManifest({
    candidateRef,
    candidateSha,
    scenarioLabel,
    summary,
  });
  manifest.artifacts = [
    { kind: "metadata", label: "Telegram QA summary", lane: "run", path: "telegram-qa-summary.json", targetPath: "summary.json" },
    { kind: "metadata", label: "Observed messages", lane: "run", path: "telegram-qa-observed-messages.json", targetPath: "observed-messages.json" },
    { kind: "motionPreview", label: "Telegram live transcript", lane: "run", path: "telegram-live-transcript.html", targetPath: "telegram-live-transcript.html" },
    { kind: "report", label: "Telegram QA report", lane: "run", path: "telegram-qa-report.md", targetPath: "report.md" },
  ];
  const manifestPath = path.join(outputDir, EVIDENCE_MANIFEST_FILE_NAME);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const copies = [
    ["telegram-qa-summary.json", "summary.json"],
    ["telegram-qa-observed-messages.json", "observed-messages.json"],
    ["telegram-live-transcript.html", "telegram-live-transcript.html"],
    ["telegram-qa-report.md", "report.md"],
  ];
  for (const [source, target] of copies) {
    copyFileSync(path.join(outputDir, source), path.join(outputDir, target));
  }

  const loaded = loadEvidenceManifest(manifestPath);
  return { manifest: loaded, manifestPath, transcriptPath, outputDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = writeTelegramEvidence(process.argv.slice(2));
  process.stdout.write(`Mantis Telegram evidence: ${result.manifestPath}\n`);
}
