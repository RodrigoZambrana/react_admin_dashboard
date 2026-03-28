#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  conversationQualityCoverageAreas,
  conversationQualityPatterns,
} from "./conversation-quality-patterns.mjs";

const thisFile = fileURLToPath(import.meta.url);
const qaRoot = path.resolve(path.dirname(thisFile), "..", "..", ".qa");
const runsRoot = path.join(qaRoot, "runs");

function parseArgs(argv) {
  let run = null;
  let latest = false;
  let write = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--latest") {
      latest = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--run") {
      run = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--run=")) {
      run = arg.slice("--run=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { run, latest, write };
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function resolveRunFile(input) {
  if (!input || input === "latest") {
    return path.join(qaRoot, "latest.json");
  }

  if (input.endsWith(".json") && input.includes(path.sep)) {
    return input;
  }

  return path.join(runsRoot, `${input}.json`);
}

function isConversationalBlock(block) {
  const tags = Array.isArray(block?.tags) ? block.tags.map(String) : [];
  return (
    block?.blockId === "ai-conversation-quality" ||
    tags.includes("ai") ||
    tags.includes("conversations") ||
    tags.includes("webchat") ||
    tags.includes("admin")
  );
}

function detectPattern(title) {
  const normalized = String(title || "").trim();
  for (const pattern of conversationQualityPatterns) {
    if (pattern.matchers.some((matcher) => matcher.test(normalized))) {
      return pattern;
    }
  }
  return conversationQualityPatterns.at(-1);
}

function pushCase(target, entry) {
  if (!entry?.title) {
    return;
  }
  target.push(entry);
}

function extractCasesFromNodeLog(logText, context) {
  const lines = String(logText || "").split(/\r?\n/);
  const cases = [];
  for (const line of lines) {
    const match = line.match(/^(ok|not ok)\s+\d+\s+-\s+(.+)$/);
    if (!match) {
      continue;
    }
    pushCase(cases, {
      title: match[2].trim(),
      status: match[1] === "ok" ? "passed" : "failed",
      source: "node_test",
      ...context,
    });
  }
  return cases;
}

function extractCasesFromPlaywrightLog(logText, context) {
  const lines = String(logText || "").split(/\r?\n/);
  const cases = [];
  for (const line of lines) {
    const match = line.match(
      /^\s*([✓✔✘x])\s+\d+\s+\[[^\]]+\]\s+›\s+(.+?)\s+›\s+(.+?)\s+\([^)]+\)\s*$/,
    );
    if (!match) {
      continue;
    }
    pushCase(cases, {
      title: `${match[2].trim()} › ${match[3].trim()}`,
      status: match[1] === "✘" || match[1] === "x" ? "failed" : "passed",
      source: "playwright",
      ...context,
    });
  }
  return cases;
}

function extractCasesFromVitestLog(logText, context) {
  const lines = String(logText || "").split(/\r?\n/);
  const cases = [];
  for (const line of lines) {
    const match = line.match(/^\s*([✓×])\s+(.+?)\s*$/);
    if (!match) {
      continue;
    }
    if (/^\d+\s+(passed|failed)/i.test(match[2])) {
      continue;
    }
    pushCase(cases, {
      title: match[2].trim(),
      status: match[1] === "×" ? "failed" : "passed",
      source: "vitest",
      ...context,
    });
  }
  return cases;
}

async function extractStepCases(runDir, block, step) {
  const logPath = path.resolve(qaRoot, "..", step.logFile);
  const logText = await readFile(logPath, "utf8").catch(() => "");
  const context = {
    blockId: block.blockId,
    blockName: block.name,
    stepIndex: step.index,
    logFile: step.logFile,
  };
  const extracted = [
    ...extractCasesFromNodeLog(logText, context),
    ...extractCasesFromPlaywrightLog(logText, context),
    ...extractCasesFromVitestLog(logText, context),
  ];

  if (extracted.length > 0) {
    return extracted;
  }

  return [
    {
      title: step.commandDisplay,
      status: step.status === "failed" ? "failed" : "passed",
      source: "step_summary",
      ...context,
    },
  ];
}

function buildCoverage(cases) {
  const byArea = new Map(
    conversationQualityCoverageAreas.map((area) => [
      area.id,
      {
        ...area,
        total: 0,
        passed: 0,
        failed: 0,
        samples: [],
      },
    ]),
  );

  for (const entry of cases) {
    const pattern = detectPattern(entry.title);
    const target = byArea.get(pattern.id);
    if (!target) {
      continue;
    }
    target.total += 1;
    if (entry.status === "failed") {
      target.failed += 1;
    } else {
      target.passed += 1;
    }
    if (target.samples.length < 3) {
      target.samples.push(entry.title);
    }
  }

  return Array.from(byArea.values()).filter((entry) => entry.total > 0);
}

function buildFailurePatterns(cases) {
  const failures = cases.filter((entry) => entry.status === "failed");
  const grouped = new Map();

  for (const entry of failures) {
    const pattern = detectPattern(entry.title);
    const key = `${pattern.id}:${pattern.bucket}:${pattern.fixType}`;
    const current =
      grouped.get(key) ??
      {
        areaId: pattern.id,
        label: pattern.label,
        bucket: pattern.bucket,
        fixType: pattern.fixType,
        layer: pattern.layer,
        severity: pattern.severity,
        recommendation: pattern.recommendation,
        count: 0,
        tests: [],
        blocks: new Set(),
      };
    current.count += 1;
    current.tests.push(entry.title);
    current.blocks.add(entry.blockId);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      blocks: Array.from(entry.blocks),
      tests: entry.tests.slice(0, 8),
    }))
    .sort((left, right) => {
      const severityRank = { P0: 0, P1: 1, P2: 2 };
      if ((severityRank[left.severity] ?? 99) !== (severityRank[right.severity] ?? 99)) {
        return (severityRank[left.severity] ?? 99) - (severityRank[right.severity] ?? 99);
      }
      return right.count - left.count;
    });
}

function buildNextActions(failurePatterns, coverage) {
  if (failurePatterns.length > 0) {
    return failurePatterns.slice(0, 5).map((entry, index) => ({
      priority: index + 1,
      areaId: entry.areaId,
      label: entry.label,
      layer: entry.layer,
      fixType: entry.fixType,
      recommendation: entry.recommendation,
    }));
  }

  const uncoveredCriticalAreas = conversationQualityCoverageAreas
    .filter((area) => area.severity !== "P2")
    .filter((area) => !coverage.some((entry) => entry.id === area.id))
    .slice(0, 5);

  return uncoveredCriticalAreas.map((entry, index) => ({
    priority: index + 1,
    areaId: entry.id,
    label: entry.label,
    layer: entry.layer,
    fixType: "regression_test_only",
    recommendation: `No hubo fallos detectados en esta corrida, pero falta cobertura explícita sobre ${entry.label}. Conviene agregar regresiones o E2E visibles para esta capa.`,
  }));
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push(`# Conversation Quality Report`);
  lines.push("");
  lines.push(`- Run: \`${report.runId}\``);
  lines.push(`- Status: \`${report.status}\``);
  lines.push(`- Generated at: \`${report.generatedAt}\``);
  lines.push(`- Conversational blocks: ${report.summary.conversationalBlocks}`);
  lines.push(`- Cases parsed: ${report.summary.totalCases}`);
  lines.push(`- Failing cases: ${report.summary.failedCases}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  if (report.failurePatterns.length === 0) {
    lines.push("- No failing conversational patterns were detected in this run.");
  } else {
    for (const entry of report.failurePatterns) {
      lines.push(
        `- [${entry.severity}] ${entry.label}: ${entry.count} case(s) · bucket=\`${entry.bucket}\` · layer=\`${entry.layer}\` · fix=\`${entry.fixType}\``,
      );
    }
  }
  lines.push("");

  lines.push("## Coverage");
  lines.push("");
  for (const entry of report.coverage) {
    lines.push(
      `- ${entry.label}: ${entry.total} case(s) · passed=${entry.passed} · failed=${entry.failed}`,
    );
  }
  lines.push("");

  lines.push("## Next Actions");
  lines.push("");
  for (const action of report.nextActions) {
    lines.push(
      `${action.priority}. ${action.label} · layer=\`${action.layer}\` · ${action.recommendation}`,
    );
  }
  lines.push("");

  if (report.failurePatterns.length > 0) {
    lines.push("## Failing Evidence");
    lines.push("");
    for (const entry of report.failurePatterns) {
      lines.push(`### ${entry.label}`);
      lines.push("");
      lines.push(`- Bucket: \`${entry.bucket}\``);
      lines.push(`- Fix type: \`${entry.fixType}\``);
      lines.push(`- Blocks: ${entry.blocks.join(", ")}`);
      for (const testTitle of entry.tests) {
        lines.push(`- ${testTitle}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export async function generateConversationQualityReport({
  runFilePath,
  write = false,
} = {}) {
  const resolvedRunFilePath = await resolveRunFile(runFilePath);
  const run = await loadJson(resolvedRunFilePath);
  const runDir = path.dirname(resolvedRunFilePath);
  const conversationalBlocks = (Array.isArray(run.blocks) ? run.blocks : []).filter(
    isConversationalBlock,
  );

  const cases = [];
  for (const block of conversationalBlocks) {
    for (const step of Array.isArray(block.steps) ? block.steps : []) {
      const extracted = await extractStepCases(runDir, block, step);
      cases.push(...extracted);
    }
  }

  const coverage = buildCoverage(cases);
  const failurePatterns = buildFailurePatterns(cases);
  const report = {
    runId: run.id,
    status: run.status,
    generatedAt: new Date().toISOString(),
    sourceRun: path.relative(path.join(qaRoot, ".."), resolvedRunFilePath),
    summary: {
      conversationalBlocks: conversationalBlocks.length,
      totalCases: cases.length,
      failedCases: cases.filter((entry) => entry.status === "failed").length,
      coveredAreas: coverage.length,
      failingAreas: failurePatterns.length,
    },
    coverage,
    failurePatterns,
    nextActions: buildNextActions(failurePatterns, coverage),
  };

  if (write) {
    const jsonPath = path.join(runDir, `${run.id}.conversation-quality.json`);
    const mdPath = path.join(runDir, `${run.id}.conversation-quality.md`);
    await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
    await writeFile(mdPath, buildMarkdownReport(report), "utf8");
    await writeFile(
      path.join(qaRoot, "latest.conversation-quality.json"),
      JSON.stringify(report, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(qaRoot, "latest.conversation-quality.md"),
      buildMarkdownReport(report),
      "utf8",
    );
    report.artifacts = {
      json: path.relative(path.join(qaRoot, ".."), jsonPath),
      markdown: path.relative(path.join(qaRoot, ".."), mdPath),
    };
  }

  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await generateConversationQualityReport({
    runFilePath: args.latest ? null : args.run,
    write: args.write,
  });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
