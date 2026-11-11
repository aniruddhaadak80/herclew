#!/usr/bin/env node
/**
 * Build the Mantis evidence for a Telegram live QA run.
 *
 * The Telegram QA lane writes a summary, the observed messages and a report
 * into its output directory. This script turns those into the evidence
 * manifest plus a redacted HTML transcript that can be linked from a PR
 * comment.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EVIDENCE_SCHEMA_VERSION, escapeHtml, writeManifestFile } from "./evidence-common.mjs";

const SUMMARY_FILENAME = "telegram-qa-summary.json";
const OBSERVED_MESSAGES_FILENAME = "telegram-qa-observed-messages.json";
const REPORT_FILENAME = "telegram-qa-report.md";
const TRANSCRIPT_FILENAME = "telegram-live-transcript.html";

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

function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Render the redacted transcript page for a Telegram QA run.
 */
export function renderTelegramEvidenceHtml(params) {
  const summary = params?.summary ?? {};
  const observedMessages = Array.isArray(params?.observedMessages) ? params.observedMessages : [];
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : [];
  const counts = summary.counts ?? {};

  const lines = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>Mantis Telegram Live Evidence</title>",
    "</head>",
    "<body>",
    "<h1>Mantis Telegram Live Evidence</h1>",
    `<p>scenarios: ${escapeHtml(counts.total ?? scenarios.length)}, passed: ${escapeHtml(
      counts.passed ?? 0,
    )}, failed: ${escapeHtml(counts.failed ?? 0)}</p>`,
  ];

  for (const scenario of scenarios) {
    lines.push("<section>");
    lines.push(`<h2>${escapeHtml(scenario.title ?? scenario.id ?? "scenario")}</h2>`);
    lines.push(`<p>status: ${escapeHtml(scenario.status ?? "unknown")}</p>`);
    if (scenario.details) {
      lines.push(`<p>${escapeHtml(scenario.details)}</p>`);
    }
    lines.push("</section>");
  }

  lines.push("<section>");
  lines.push("<h2>Observed messages</h2>");
  for (const message of observedMessages) {
    const sender = message.senderIsBot ? "bot" : "user";
    const scenario = message.scenarioTitle ?? message.scenarioId ?? "";
    lines.push("<article>");
    lines.push(`<p>${escapeHtml(sender)}${scenario ? ` · ${escapeHtml(scenario)}` : ""}</p>`);
    lines.push(`<pre>${escapeHtml(message.text ?? "")}</pre>`);
    const buttons = Array.isArray(message.inlineButtons) ? message.inlineButtons : [];
    if (buttons.length > 0) {
      lines.push(`<p>buttons: ${escapeHtml(buttons.join(", "))}</p>`);
    }
    lines.push("</article>");
  }
  lines.push("</section>");
  lines.push("</body>");
  lines.push("</html>");

  return `${lines.join("\n")}\n`;
}

/**
 * Build the evidence manifest for a Telegram live QA run.
 */
export function buildTelegramEvidenceManifest(params) {
  const summary = params?.summary ?? {};
  const counts = summary.counts ?? {};
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : [];
  const failedScenarios = scenarios.filter((scenario) => scenario.status === "fail");
  const failed = Number(counts.failed ?? failedScenarios.length) > 0;
  const scenarioLabel = params?.scenarioLabel ?? "telegram-live";

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "telegram-live",
    title: "Mantis Telegram Live QA",
    summary:
      params?.summaryText ??
      `Mantis reran the Telegram live scenario (${counts.passed ?? 0}/${counts.total ?? scenarios.length} passed).`,
    scenario: scenarioLabel,
    comparison: {
      baseline: {
        expected: "no Telegram baseline captured for live QA",
        status: "skipped",
      },
      candidate: {
        expected: failed ? "every Telegram scenario passes" : "the Telegram live scenario passes",
        sha: params?.candidateSha,
        status: failed ? "fail" : "pass",
      },
      pass: !failed,
    },
    artifacts: [
      {
        kind: "metadata",
        label: "Telegram QA summary",
        lane: "run",
        path: "summary.json",
        targetPath: "summary.json",
      },
      {
        kind: "metadata",
        label: "Telegram observed messages",
        lane: "run",
        path: "observed-messages.json",
        targetPath: "observed-messages.json",
      },
      {
        alt: "Telegram live transcript",
        kind: "motionPreview",
        label: "Telegram live transcript",
        lane: "candidate",
        path: TRANSCRIPT_FILENAME,
        targetPath: TRANSCRIPT_FILENAME,
      },
      {
        kind: "report",
        label: "Telegram QA report",
        lane: "run",
        path: "report.md",
        targetPath: "report.md",
      },
    ],
  };
}

/**
 * Read the Telegram QA output directory and write the evidence files.
 */
export function writeTelegramEvidence(argv) {
  const options = parseArgs(argv);
  const outputDir = path.resolve(String(options["output-dir"] ?? ""));
  if (!options["output-dir"]) {
    throw new Error("Missing --output-dir");
  }

  const summary = readJsonIfPresent(path.join(outputDir, SUMMARY_FILENAME)) ?? {};
  const observedMessages =
    readJsonIfPresent(path.join(outputDir, OBSERVED_MESSAGES_FILENAME)) ?? [];
  let report = "";
  try {
    report = readFileSync(path.join(outputDir, REPORT_FILENAME), "utf8");
  } catch {
    report = "";
  }

  writeFileSync(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    path.join(outputDir, "observed-messages.json"),
    `${JSON.stringify(observedMessages, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(path.join(outputDir, "report.md"), report, "utf8");

  const transcriptPath = path.join(outputDir, TRANSCRIPT_FILENAME);
  writeFileSync(transcriptPath, renderTelegramEvidenceHtml({ observedMessages, summary }), "utf8");

  const manifest = buildTelegramEvidenceManifest({
    candidateRef: options["candidate-ref"],
    candidateSha: options["candidate-sha"],
    scenarioLabel: options["scenario-label"],
    summary,
  });
  const manifestPath = path.join(outputDir, "mantis-evidence.json");
  writeManifestFile(manifestPath, manifest);

  return { manifest, manifestPath, transcriptPath };
}
