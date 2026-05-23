import os

skills = [
    # Core-Agent Skills
    ("core-agent/skills/devops/daemon-watchdog", "daemon-watchdog", "24/7 system health monitoring, auto-restart crashed services, and multi-channel alerting (Discord, Slack, email)."),
    ("core-agent/skills/devops/auto-deploy", "auto-deploy", "Automated CI/CD pipeline \u2014 watch git branches, run tests on push, deploy on green."),
    ("core-agent/skills/devops/cron-templates", "cron-templates", "Pre-built cron job templates for common automation patterns."),
    ("core-agent/skills/devops/infra-as-code", "infra-as-code", "Generate and manage Terraform/Pulumi infrastructure configurations."),
    ("core-agent/skills/productivity/auto-reporter", "auto-reporter", "Automated daily/weekly summary reports from agent activity, repository metrics, and task completion."),
    ("core-agent/skills/productivity/meeting-notes", "meeting-notes", "Process meeting transcripts into structured action items, decisions, and summaries."),
    ("core-agent/skills/research/auto-monitor", "auto-monitor", "Monitor RSS feeds, arXiv, HackerNews, GitHub trending for topics of interest on cron schedule."),
    ("core-agent/skills/research/paper-summarizer", "paper-summarizer", "Summarize academic papers into structured briefs with key findings, methodology, and implications."),
    ("core-agent/skills/software-development/code-review-agent", "code-review-agent", "Multi-file code review with security, performance, and style analysis."),
    ("core-agent/skills/software-development/repo-analyzer", "repo-analyzer", "Deep codebase analysis \u2014 dependency graphs, complexity metrics, dead code detection, architecture visualization."),
    ("core-agent/skills/software-development/migration-assistant", "migration-assistant", "Framework and language migration helper (JS\u2192TS, Python2\u21923, React class\u2192hooks, etc.)."),
    ("core-agent/skills/creative/presentation-builder", "presentation-builder", "Generate slide decks from text outlines with professional layouts and visuals."),
    ("core-agent/skills/mlops/model-benchmark", "model-benchmark", "Benchmark LLM performance across tasks \u2014 latency, quality, cost comparison."),
    ("core-agent/skills/security/vuln-scanner", "vuln-scanner", "Scan codebases for known vulnerabilities using OSV, CVE, and GHSA databases."),
    ("core-agent/skills/data-science/data-pipeline", "data-pipeline", "Build and manage ETL data pipelines with scheduling and monitoring."),
    
    # Gateway-Node Skills
    ("gateway-node/skills/automation/daemon-watchdog", "daemon-watchdog-gw", "Gateway-side 24/7 system monitoring with TypeScript-native health checks and multi-channel alerts."),
    ("gateway-node/skills/automation/cron-templates", "cron-templates-gw", "Gateway-side pre-built cron job templates for TypeScript automation."),
    ("gateway-node/skills/automation/workflow-engine", "workflow-engine", "Visual workflow builder \u2014 chain skills together into automated multi-step pipelines with conditional branching."),
    ("gateway-node/skills/communication/multi-channel-broadcast", "multi-channel-broadcast", "Send messages to multiple channels (Slack, Discord, Telegram, email) simultaneously with template support."),
    ("gateway-node/skills/data-tools/data-viz", "data-viz", "Generate charts and visualizations from structured data using D3.js and Chart.js."),
    ("gateway-node/skills/productivity/calendar-sync", "calendar-sync", "Sync and manage calendars across Google Calendar, Outlook, and Apple Calendar.")
]

template = """---
name: {name}
description: {desc}
---

# {name}

{desc}

## Overview
This skill provides automated workflows for {name}.

## Instructions
1. Review the requirements and configuration options.
2. Provide necessary inputs and set parameters.
3. The skill will automatically execute the required steps.
4. Review the generated output and apply as needed.

## Configuration
Configure the necessary settings to run this skill effectively.
"""

base_dir = r"C:\Users\ANIRUDDHA\.gemini\antigravity\scratch\herclew"

for path, name, desc in skills:
    full_path = os.path.join(base_dir, path)
    os.makedirs(full_path, exist_ok=True)
    skill_file = os.path.join(full_path, "SKILL.md")
    with open(skill_file, "w", encoding="utf-8") as f:
        f.write(template.format(name=name, desc=desc))
    print(f"Created: {skill_file}")
