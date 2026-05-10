#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
export const repoRoot = path.resolve(path.dirname(currentFilePath), "..", "..");
export const qaRoot = path.join(repoRoot, ".qa");
const reportsRoot = path.join(qaRoot, "monorepo-runs");
const docsDir = path.join(repoRoot, "docs", "testing");
export const monorepoStatusPath = path.join(docsDir, "monorepo-qa-status.md");
export const monorepoSummaryPath = path.join(qaRoot, "monorepo-suite-latest.json");
const qaLatestRunPath = path.join(qaRoot, "latest.json");
const manifestPath = path.join(repoRoot, "tools", "qa", "manifest.json");

const suites = {
  integrity: [
    { workspace: "backend", script: "test:integrity" },
    { workspace: "frontend", script: "test:integrity" },
    { workspace: "ecommerce", script: "test:integrity" },
    { workspace: "services/channel-adapter", script: "test:integrity" },
  ],
  smoke: [
    { workspace: "backend", script: "test:smoke" },
    { workspace: "frontend", script: "test:smoke" },
    { workspace: "ecommerce", script: "test:smoke" },
  ],
  coverage: [
    { workspace: "backend", script: "test:coverage" },
    { workspace: "frontend", script: "test:coverage" },
    { workspace: "ecommerce", script: "test:coverage" },
  ],
};

function printUsage() {
  console.log(
    [
      "Usage: node tools/qa/monorepo-suite-runner.mjs --suite <integrity|smoke|coverage> [--include-deferred] [--write-report]",
      "",
      "Options:",
      "  --suite <name>        Select which core suite to run",
      "  --include-deferred    Include deferred workspace inventory in the report",
      "  --write-report        Write docs/testing/monorepo-qa-status.md",
      "  --help                Show this message",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    suite: "integrity",
    includeDeferred: false,
    writeReport: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--suite") {
      options.suite = String(argv[index + 1] ?? "").trim() || "integrity";
      index += 1;
      continue;
    }
    if (arg.startsWith("--suite=")) {
      options.suite = arg.slice("--suite=".length).trim() || "integrity";
      continue;
    }
    if (arg === "--include-deferred") {
      options.includeDeferred = true;
      continue;
    }
    if (arg === "--write-report") {
      options.writeReport = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Object.hasOwn(suites, options.suite)) {
    throw new Error(`Unknown suite: ${options.suite}`);
  }

  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function formatCommand(command) {
  return command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function buildSummary(output, exitCode) {
  const trimmed = output.trim();
  if (!trimmed) {
    return exitCode === 0 ? "Completed without output." : "Failed without captured output.";
  }
  return trimmed.split(/\r?\n/).slice(-8).join("\n");
}

async function executeCommand(command, cwd, logFilePath) {
  return new Promise((resolve) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let combinedOutput = "";
    const append = (chunk) => {
      combinedOutput += chunk.toString();
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    child.on("close", async (exitCode) => {
      await writeFile(logFilePath, combinedOutput, "utf8");
      resolve({ exitCode: exitCode ?? 1, output: combinedOutput });
    });
  });
}

async function runWorkspaceStep(runId, suiteName, workspaceStep, stepIndex) {
  const workspaceRoot = path.join(repoRoot, workspaceStep.workspace);
  const pkgPath = path.join(workspaceRoot, "package.json");
  const packageJson = await readJson(pkgPath);
  const script = workspaceStep.script;

  if (!(packageJson.scripts && packageJson.scripts[script])) {
    return {
      workspace: workspaceStep.workspace,
      script,
      status: "missing-script",
      exitCode: 1,
      commandDisplay: `npm run ${script}`,
      logFile: null,
      startedAt: null,
      finishedAt: null,
      summary: `Missing script ${script} in ${workspaceStep.workspace}/package.json`,
    };
  }

  const command = ["npm", "run", script];
  const logFilePath = path.join(
    reportsRoot,
    runId,
    `${suiteName}-${workspaceStep.workspace.replace(/\//g, "_")}-step-${stepIndex + 1}.log`,
  );
  const startedAt = new Date().toISOString();
  const execution = await executeCommand(command, workspaceRoot, logFilePath);
  const finishedAt = new Date().toISOString();

  return {
    workspace: workspaceStep.workspace,
    script,
    status: execution.exitCode === 0 ? "passed" : "failed",
    exitCode: execution.exitCode,
    commandDisplay: formatCommand(command),
    logFile: path.relative(repoRoot, logFilePath),
    startedAt,
    finishedAt,
    summary: buildSummary(execution.output, execution.exitCode),
  };
}

export async function loadQaManifest() {
  return readJson(manifestPath);
}

function normalizeProfileIds(ids) {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeManifestProfiles(manifest) {
  const profiles = manifest?.profiles ?? {};
  const coreBlockIds = normalizeProfileIds(
    profiles.core?.blockIds ?? manifest?.defaultBlockIds ?? [],
  );
  const deferredBlockIds = normalizeProfileIds(profiles.deferred?.blockIds ?? []);
  const allProfileIds = new Set([...coreBlockIds, ...deferredBlockIds]);

  const extras = (manifest?.blocks ?? [])
    .map((block) => block?.id)
    .filter((id) => id && !allProfileIds.has(id));

  return {
    defaultProfileId: manifest?.defaultProfileId === "deferred" ? "deferred" : "core",
    core: {
      id: "core",
      description:
        profiles.core?.description ??
        "Blocking release gate for multi-workspace suites and QA blocks.",
      blockIds: coreBlockIds,
    },
    deferred: {
      id: "deferred",
      description:
        profiles.deferred?.description ??
        "Deferred, non-blocking QA coverage that should remain visible but outside the release gate.",
      blockIds: [...deferredBlockIds, ...extras],
    },
  };
}

function normalizeSuiteResult(value) {
  if (!value || typeof value !== "object" || !value.suite) {
    return null;
  }

  return {
    runId: value.runId ?? null,
    suite: value.suite,
    status: value.status ?? "unknown",
    startedAt: value.startedAt ?? null,
    finishedAt: value.finishedAt ?? null,
    coreResults: Array.isArray(value.coreResults) ? value.coreResults : [],
    deferredWorkspaceInventory: Array.isArray(value.deferredWorkspaceInventory)
      ? value.deferredWorkspaceInventory
      : [],
    gaps: Array.isArray(value.gaps) ? value.gaps : [],
    includeDeferred: Boolean(value.includeDeferred),
  };
}

function createEmptySuiteSummary() {
  return {
    updatedAt: null,
    latestSuite: null,
    suites: {},
  };
}

export async function loadMonorepoSuiteSummary() {
  const raw = await readJsonIfExists(monorepoSummaryPath);
  if (!raw) {
    return createEmptySuiteSummary();
  }

  if (raw.suites && typeof raw.suites === "object") {
    const normalizedSuites = {};
    for (const [suiteName, result] of Object.entries(raw.suites)) {
      const normalizedResult = normalizeSuiteResult(result);
      if (normalizedResult) {
        normalizedSuites[suiteName] = normalizedResult;
      }
    }

    return {
      updatedAt: raw.updatedAt ?? null,
      latestSuite: raw.latestSuite ?? null,
      suites: normalizedSuites,
    };
  }

  const singleResult = normalizeSuiteResult(raw);
  if (!singleResult) {
    return createEmptySuiteSummary();
  }

  return {
    updatedAt: singleResult.finishedAt ?? singleResult.startedAt ?? null,
    latestSuite: singleResult.suite,
    suites: {
      [singleResult.suite]: singleResult,
    },
  };
}

export async function loadLatestQaRun() {
  return readJsonIfExists(qaLatestRunPath);
}

export async function buildDeferredWorkspaceInventory(includeDeferred = false) {
  const candidates = ["ai-platform", "ai-platform/backend", "ai-platform/frontend"];
  const inventory = [];

  for (const workspace of candidates) {
    const pkgPath = path.join(repoRoot, workspace, "package.json");
    if (!existsSync(pkgPath)) {
      inventory.push({ workspace, status: "missing", reason: "package.json not found" });
      continue;
    }

    const packageJson = await readJson(pkgPath);
    inventory.push({
      workspace,
      status: includeDeferred ? "included" : "deferred",
      scripts: Object.keys(packageJson.scripts ?? {}),
    });
  }

  return inventory;
}

function formatTimestamp(value) {
  return value ?? "n/a";
}

function formatCountSummary(summary) {
  const parts = [];
  if (typeof summary?.passed === "number") {
    parts.push(`passed ${summary.passed}/${summary.total}`);
  }
  if (typeof summary?.failed === "number" && summary.failed > 0) {
    parts.push(`failed ${summary.failed}`);
  }
  if (typeof summary?.notRun === "number" && summary.notRun > 0) {
    parts.push(`not-run ${summary.notRun}`);
  }
  return parts.join(" :: ");
}

function buildReleaseVerdict(suiteSummary, qaRun) {
  const integrityStatus = suiteSummary.suites.integrity?.status ?? "not-run";
  const smokeStatus = suiteSummary.suites.smoke?.status ?? "not-run";
  const qaGateStatus = getQaReleaseGateStatus(qaRun);

  if (integrityStatus === "failed" || smokeStatus === "failed" || qaGateStatus === "failed") {
    return "failed";
  }

  if (integrityStatus === "passed" && smokeStatus === "passed" && qaGateStatus === "passed") {
    return "passed";
  }

  return "incomplete";
}

function buildDeferredBlockStatusMap(manifest, qaRun) {
  const blockMap = new Map((manifest.blocks ?? []).map((block) => [block.id, block]));
  const profiles = normalizeManifestProfiles(manifest);
  const deferredResultsById = new Map(
    (qaRun?.blocks ?? [])
      .filter((block) => block.gateTier === "deferred")
      .map((block) => [block.blockId, block]),
  );

  return profiles.deferred.blockIds.map((blockId) => {
    const block = blockMap.get(blockId);
    const result = deferredResultsById.get(blockId);
    if (result) {
      return {
        blockId,
        name: block?.name ?? blockId,
        status: result.status,
        commandDisplay: result.commandDisplay,
      };
    }

    return {
      blockId,
      name: block?.name ?? blockId,
      status: "not-run",
      commandDisplay: null,
    };
  });
}

function getQaTierResults(qaRun, profiles, tier) {
  return (qaRun?.blocks ?? []).filter((block) => {
    if (block.gateTier) {
      return block.gateTier === tier;
    }
    const source = tier === "core" ? profiles.core.blockIds : profiles.deferred.blockIds;
    return source.includes(block.blockId);
  });
}

function getQaReleaseGateStatus(qaRun, profiles = { core: { blockIds: [] }, deferred: { blockIds: [] } }) {
  if (!qaRun) {
    return "not-run";
  }
  if (qaRun.releaseGateStatus) {
    return qaRun.releaseGateStatus;
  }

  const coreResults = getQaTierResults(qaRun, profiles, "core");
  if (coreResults.length === 0) {
    return "not-run";
  }
  return coreResults.some((block) => block.status === "failed") ? "failed" : "passed";
}

function getQaDeferredStatus(qaRun, profiles = { core: { blockIds: [] }, deferred: { blockIds: [] } }) {
  if (!qaRun) {
    return "not-run";
  }
  if (qaRun.deferredStatus) {
    return qaRun.deferredStatus;
  }

  const deferredResults = getQaTierResults(qaRun, profiles, "deferred");
  if (deferredResults.length === 0) {
    return "not-selected";
  }
  return deferredResults.some((block) => block.status === "failed") ? "failed" : "passed";
}

export async function writeMonorepoQaStatusReport({ suiteSummary, qaRun } = {}) {
  const manifest = await loadQaManifest();
  const profiles = normalizeManifestProfiles(manifest);
  const effectiveSuiteSummary = suiteSummary ?? (await loadMonorepoSuiteSummary());
  const effectiveQaRun = qaRun ?? (await loadLatestQaRun());
  const deferredWorkspaceInventory = await buildDeferredWorkspaceInventory(false);
  const releaseVerdict = buildReleaseVerdict(effectiveSuiteSummary, effectiveQaRun);
  const qaReleaseGateStatus = getQaReleaseGateStatus(effectiveQaRun, profiles);
  const qaDeferredStatus = getQaDeferredStatus(effectiveQaRun, profiles);
  const qaCoreResults = getQaTierResults(effectiveQaRun, profiles, "core");
  const lines = [
    "# Monorepo QA Status",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Release signal",
    `- verdict :: ${releaseVerdict}`,
    `- test:integrity :: ${effectiveSuiteSummary.suites.integrity?.status ?? "not-run"} :: updated ${formatTimestamp(effectiveSuiteSummary.suites.integrity?.finishedAt)}`,
    `- test:smoke :: ${effectiveSuiteSummary.suites.smoke?.status ?? "not-run"} :: updated ${formatTimestamp(effectiveSuiteSummary.suites.smoke?.finishedAt)}`,
    `- run-qa core :: ${qaReleaseGateStatus} :: updated ${formatTimestamp(effectiveQaRun?.finishedAt)}`,
    `- run-qa deferred :: ${qaDeferredStatus} :: ${formatCountSummary(effectiveQaRun?.summary?.deferred) || "not selected"}`,
    "",
    "## Monorepo suites",
  ];

  for (const suiteName of ["integrity", "smoke", "coverage"]) {
    const suiteResult = effectiveSuiteSummary.suites[suiteName];
    if (!suiteResult) {
      lines.push(`- ${suiteName} :: not-run`);
      continue;
    }

    lines.push(
      `- ${suiteName} :: ${suiteResult.status} :: run ${suiteResult.runId ?? "n/a"} :: updated ${formatTimestamp(suiteResult.finishedAt)}`,
    );
    for (const entry of suiteResult.coreResults) {
      lines.push(
        `- ${suiteName} :: ${entry.workspace} :: ${entry.script} :: ${entry.status} :: ${entry.exitCode}`,
      );
    }
    if (suiteResult.gaps.length === 0) {
      lines.push(`- ${suiteName} :: gaps :: none`);
    } else {
      for (const gap of suiteResult.gaps) {
        lines.push(`- ${suiteName} :: gap :: ${gap}`);
      }
    }
  }

  lines.push("", "## QA release gate");
  if (!effectiveQaRun) {
    lines.push("- run-qa :: not-run");
  } else {
    lines.push(
      `- run-qa :: ${effectiveQaRun.status} :: release-gate ${qaReleaseGateStatus} :: selected ${effectiveQaRun.selectedBlockIds.length} blocks`,
    );
    lines.push(
      `- run-qa :: profiles :: core ${profiles.core.blockIds.length} :: deferred ${profiles.deferred.blockIds.length}`,
    );
    for (const block of qaCoreResults) {
      lines.push(
        `- core :: ${block.blockId} :: ${block.status} :: ${block.commandDisplay ?? "multi-step"} :: ${block.durationMs ?? 0}ms`,
      );
    }
    if (qaCoreResults.length === 0) {
      lines.push("- core :: none selected");
    }
  }

  lines.push("", "## Deferred QA coverage");
  for (const entry of buildDeferredBlockStatusMap(manifest, effectiveQaRun)) {
    lines.push(
      `- deferred :: ${entry.blockId} :: ${entry.status}${entry.commandDisplay ? ` :: ${entry.commandDisplay}` : ""}`,
    );
  }

  lines.push("", "## Deferred workspace inventory");
  for (const entry of deferredWorkspaceInventory) {
    const scripts = Array.isArray(entry.scripts) && entry.scripts.length > 0 ? entry.scripts.join(", ") : "none";
    lines.push(
      `- ${entry.workspace} :: ${entry.status}${entry.reason ? ` :: ${entry.reason}` : ` :: scripts ${scripts}`}`,
    );
  }

  await mkdir(docsDir, { recursive: true });
  await writeFile(monorepoStatusPath, lines.join("\n"), "utf8");
}

async function persistSuiteResult(result) {
  const existingSummary = await loadMonorepoSuiteSummary();
  const suiteSummary = {
    updatedAt: result.finishedAt,
    latestSuite: result.suite,
    suites: {
      ...existingSummary.suites,
      [result.suite]: result,
    },
  };

  await mkdir(qaRoot, { recursive: true });
  await writeFile(monorepoSummaryPath, JSON.stringify(suiteSummary, null, 2), "utf8");

  return suiteSummary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runId = `monorepo-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runRoot = path.join(reportsRoot, runId);
  const startedAt = new Date().toISOString();

  await mkdir(runRoot, { recursive: true });

  const coreSteps = suites[options.suite];
  const coreResults = [];
  const gaps = [];
  let failed = false;

  for (let index = 0; index < coreSteps.length; index += 1) {
    const step = coreSteps[index];
    const result = await runWorkspaceStep(runId, options.suite, step, index);
    coreResults.push(result);
    if (result.status !== "passed") {
      if (result.status === "missing-script") {
        gaps.push(`${result.workspace} missing ${result.script}`);
      }
      failed = true;
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  const deferredWorkspaceInventory = await buildDeferredWorkspaceInventory(options.includeDeferred);
  const result = {
    runId,
    suite: options.suite,
    status: failed ? "failed" : "passed",
    startedAt,
    finishedAt,
    includeDeferred: options.includeDeferred,
    coreResults,
    deferredWorkspaceInventory,
    gaps,
  };

  const suiteSummary = await persistSuiteResult(result);

  if (options.writeReport) {
    await writeMonorepoQaStatusReport({
      suiteSummary,
      qaRun: await loadLatestQaRun(),
    });
  }

  console.log(
    JSON.stringify(
      {
        runId,
        suite: result.suite,
        status: result.status,
        executedSteps: result.coreResults.length,
        failedSteps: result.coreResults.filter((entry) => entry.status !== "passed").length,
      },
      null,
      2,
    ),
  );

  if (failed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
