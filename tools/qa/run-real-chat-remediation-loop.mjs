#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_REAL_CORPUS_MANIFESTS_DIR,
  DEFAULT_REAL_CORPUS_RUNS_DIR,
  REPO_ROOT,
  readJson,
  writeJson
} from "./real-corpus-artifacts-lib.mjs";
import { buildProposalDerivedRealSet } from "./build-proposal-derived-real-set.mjs";
import {
  buildProbePlaybookFromDerivedRealSet,
  mergeProbePlaybooks
} from "./corpus-derived-probe-playbook-lib.mjs";
import {
  buildLoopIterationMarkdown,
  buildLoopIterationReport,
  normalizeBaseline
} from "./real-chat-remediation-loop-lib.mjs";
import { exportRealChatRemediationResources } from "./real-chat-remediation-resource-export-lib.mjs";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:4000/api";
const DEFAULT_AI_PLATFORM_BASE_URL = "http://127.0.0.1:4110";
const DEFAULT_INTERNAL_TOKEN = "local-ai-internal-token";
const DEFAULT_TENANT_KEY = "urucortinas";
const DEFAULT_PAGE = "/shop";
const DEFAULT_SCOPE = "customer_public";
const DEFAULT_PROBE_ITERATIONS = 1;

function printUsage() {
  console.log(
    [
      "Usage: node tools/qa/run-real-chat-remediation-loop.mjs [options]",
      "",
      "Runs one explicit remediation iteration over the real chat:",
      "replay real corpus -> analyze findings -> derive live probes from corpus -> run live probes -> build structural plan and delta -> prepare rerun.",
      "",
      "Options:",
      "  --output-root <path>             Base output directory. Default: .qa/runs.",
      "  --corpus-dir <path>              Corpus root with manifests/. Default: .qa/external-real-conversations/whatsapp.",
      "  --backend-base-url <url>         Backend API base URL. Default: http://127.0.0.1:4000/api.",
      "  --ai-platform-base-url <url>     AI platform health URL root. Default: http://127.0.0.1:4110.",
      "  --internal-token <token>         Internal token for backend AI endpoints.",
      "  --tenant-key <slug>              Tenant key. Default: urucortinas.",
      "  --page <path>                    Page metadata for the storefront chat. Default: /shop.",
      "  --scope <scope>                  customer_public | customer_authenticated.",
      "  --playbook-path <path>           Optional live-probe playbook override. If omitted, probes are derived from the real corpus for this iteration.",
      "  --scenario-ids <csv>             Run only selected probe scenario ids.",
      "  --tags <csv>                     Run only probe scenarios matching tags.",
      "  --probe-iterations <n>           Repeat each probe scenario n times. Default: 1.",
      "  --derived-count <n>              Number of corpus-derived probe scenarios. Default: 16.",
      "  --derived-mode <mode>            mixed | category_focus. Default: mixed.",
      "  --derived-seed <seed>            Seed for corpus-derived scenario generation. Default: current date.",
      "  --limit-conversations <n>        Limit replayed conversations.",
      "  --limit-turns <n>                Limit turns per replayed conversation.",
      "  --limit-scenarios <n>            Limit expanded probe scenarios.",
      "  --baseline-loop-dir <path>       Previous remediation loop directory to compare against.",
      "  --baseline-replay-run-dir <path> Replay run directory to compare against.",
      "  --baseline-probe-run-dir <path>  Probe run directory to compare against.",
      "  --structural-plan-path <path>    Structural remediation plan JSON used only for workstream mapping.",
      "  --iteration-label <text>         Optional human label for this iteration.",
      "  --help                           Show this message."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const options = {
    outputRoot: DEFAULT_REAL_CORPUS_RUNS_DIR,
    corpusDir: path.dirname(DEFAULT_REAL_CORPUS_MANIFESTS_DIR),
    backendBaseUrl: DEFAULT_BACKEND_BASE_URL,
    aiPlatformBaseUrl: DEFAULT_AI_PLATFORM_BASE_URL,
    internalToken: DEFAULT_INTERNAL_TOKEN,
    tenantKey: DEFAULT_TENANT_KEY,
    page: DEFAULT_PAGE,
    scope: DEFAULT_SCOPE,
    playbookPath: null,
    scenarioIds: "",
    tags: "",
    probeIterations: DEFAULT_PROBE_ITERATIONS,
    derivedCount: 16,
    derivedMode: "mixed",
    derivedSeed: new Date().toISOString().slice(0, 10),
    limitConversations: null,
    limitTurns: null,
    limitScenarios: null,
    baselineLoopDir: null,
    baselineReplayRunDir: null,
    baselineProbeRunDir: null,
    structuralPlanPath: null,
    iterationLabel: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output-root") {
      options.outputRoot = argv[index + 1] ?? options.outputRoot;
      index += 1;
      continue;
    }
    if (arg.startsWith("--output-root=")) {
      options.outputRoot = arg.slice("--output-root=".length);
      continue;
    }
    if (arg === "--corpus-dir") {
      options.corpusDir = argv[index + 1] ?? options.corpusDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--corpus-dir=")) {
      options.corpusDir = arg.slice("--corpus-dir=".length);
      continue;
    }
    if (arg === "--backend-base-url") {
      options.backendBaseUrl = argv[index + 1] ?? options.backendBaseUrl;
      index += 1;
      continue;
    }
    if (arg.startsWith("--backend-base-url=")) {
      options.backendBaseUrl = arg.slice("--backend-base-url=".length);
      continue;
    }
    if (arg === "--ai-platform-base-url") {
      options.aiPlatformBaseUrl = argv[index + 1] ?? options.aiPlatformBaseUrl;
      index += 1;
      continue;
    }
    if (arg.startsWith("--ai-platform-base-url=")) {
      options.aiPlatformBaseUrl = arg.slice("--ai-platform-base-url=".length);
      continue;
    }
    if (arg === "--internal-token") {
      options.internalToken = argv[index + 1] ?? options.internalToken;
      index += 1;
      continue;
    }
    if (arg.startsWith("--internal-token=")) {
      options.internalToken = arg.slice("--internal-token=".length);
      continue;
    }
    if (arg === "--tenant-key") {
      options.tenantKey = argv[index + 1] ?? options.tenantKey;
      index += 1;
      continue;
    }
    if (arg.startsWith("--tenant-key=")) {
      options.tenantKey = arg.slice("--tenant-key=".length);
      continue;
    }
    if (arg === "--page") {
      options.page = argv[index + 1] ?? options.page;
      index += 1;
      continue;
    }
    if (arg.startsWith("--page=")) {
      options.page = arg.slice("--page=".length);
      continue;
    }
    if (arg === "--scope") {
      options.scope = argv[index + 1] ?? options.scope;
      index += 1;
      continue;
    }
    if (arg.startsWith("--scope=")) {
      options.scope = arg.slice("--scope=".length);
      continue;
    }
    if (arg === "--playbook-path") {
      options.playbookPath = argv[index + 1] ?? options.playbookPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--playbook-path=")) {
      options.playbookPath = arg.slice("--playbook-path=".length);
      continue;
    }
    if (arg === "--scenario-ids") {
      options.scenarioIds = argv[index + 1] ?? options.scenarioIds;
      index += 1;
      continue;
    }
    if (arg.startsWith("--scenario-ids=")) {
      options.scenarioIds = arg.slice("--scenario-ids=".length);
      continue;
    }
    if (arg === "--tags") {
      options.tags = argv[index + 1] ?? options.tags;
      index += 1;
      continue;
    }
    if (arg.startsWith("--tags=")) {
      options.tags = arg.slice("--tags=".length);
      continue;
    }
    if (arg === "--probe-iterations") {
      const parsed = Number(argv[index + 1] ?? "");
      options.probeIterations =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.probeIterations;
      index += 1;
      continue;
    }
    if (arg.startsWith("--probe-iterations=")) {
      const parsed = Number(arg.slice("--probe-iterations=".length));
      options.probeIterations =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.probeIterations;
      continue;
    }
    if (arg === "--derived-count") {
      const parsed = Number(argv[index + 1] ?? "");
      options.derivedCount =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.derivedCount;
      index += 1;
      continue;
    }
    if (arg.startsWith("--derived-count=")) {
      const parsed = Number(arg.slice("--derived-count=".length));
      options.derivedCount =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.derivedCount;
      continue;
    }
    if (arg === "--derived-mode") {
      options.derivedMode = argv[index + 1] ?? options.derivedMode;
      index += 1;
      continue;
    }
    if (arg.startsWith("--derived-mode=")) {
      options.derivedMode = arg.slice("--derived-mode=".length);
      continue;
    }
    if (arg === "--derived-seed") {
      options.derivedSeed = argv[index + 1] ?? options.derivedSeed;
      index += 1;
      continue;
    }
    if (arg.startsWith("--derived-seed=")) {
      options.derivedSeed = arg.slice("--derived-seed=".length);
      continue;
    }
    if (arg === "--limit-conversations") {
      const parsed = Number(argv[index + 1] ?? "");
      options.limitConversations =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit-conversations=")) {
      const parsed = Number(arg.slice("--limit-conversations=".length));
      options.limitConversations =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
      continue;
    }
    if (arg === "--limit-turns") {
      const parsed = Number(argv[index + 1] ?? "");
      options.limitTurns = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit-turns=")) {
      const parsed = Number(arg.slice("--limit-turns=".length));
      options.limitTurns = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
      continue;
    }
    if (arg === "--limit-scenarios") {
      const parsed = Number(argv[index + 1] ?? "");
      options.limitScenarios =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit-scenarios=")) {
      const parsed = Number(arg.slice("--limit-scenarios=".length));
      options.limitScenarios =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
      continue;
    }
    if (arg === "--baseline-loop-dir") {
      options.baselineLoopDir = argv[index + 1] ?? options.baselineLoopDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline-loop-dir=")) {
      options.baselineLoopDir = arg.slice("--baseline-loop-dir=".length);
      continue;
    }
    if (arg === "--baseline-replay-run-dir") {
      options.baselineReplayRunDir = argv[index + 1] ?? options.baselineReplayRunDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline-replay-run-dir=")) {
      options.baselineReplayRunDir = arg.slice("--baseline-replay-run-dir=".length);
      continue;
    }
    if (arg === "--baseline-probe-run-dir") {
      options.baselineProbeRunDir = argv[index + 1] ?? options.baselineProbeRunDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline-probe-run-dir=")) {
      options.baselineProbeRunDir = arg.slice("--baseline-probe-run-dir=".length);
      continue;
    }
    if (arg === "--structural-plan-path") {
      options.structuralPlanPath = argv[index + 1] ?? options.structuralPlanPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--structural-plan-path=")) {
      options.structuralPlanPath = arg.slice("--structural-plan-path=".length);
      continue;
    }
    if (arg === "--iteration-label") {
      options.iterationLabel = argv[index + 1] ?? options.iterationLabel;
      index += 1;
      continue;
    }
    if (arg.startsWith("--iteration-label=")) {
      options.iterationLabel = arg.slice("--iteration-label=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function toNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatCommand(command) {
  return command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

async function executeCommand(command, { cwd, logFilePath }) {
  return new Promise((resolve) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";

    const append = (chunk, stream) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);
    };

    child.stdout.on("data", (chunk) => append(chunk, process.stdout));
    child.stderr.on("data", (chunk) => append(chunk, process.stderr));

    child.on("close", async (exitCode) => {
      await writeFile(logFilePath, output, "utf8");
      resolve({
        exitCode: exitCode ?? 1,
        output,
        logFilePath
      });
    });
  });
}

function parseKeyValueLines(output) {
  const result = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = /^([a-z0-9_]+)=(.+)$/i.exec(line.trim());
    if (!match) {
      continue;
    }
    result[match[1]] = match[2];
  }
  return result;
}

async function findLatestMatchingFile(rootDir, matcher) {
  const queue = [rootDir];
  const candidates = [];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!matcher.test(entry.name)) {
        continue;
      }
      const entryStat = await stat(absolutePath);
      candidates.push({
        path: absolutePath,
        mtimeMs: entryStat.mtimeMs
      });
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
  return candidates[0]?.path || null;
}

async function loadStructuralPlan(explicitPath) {
  const planPath =
    explicitPath ||
    (await findLatestMatchingFile(
      path.join(REPO_ROOT, ".qa", "runs"),
      /^structural-remediation-loop-plan-.*\.json$/u
    ));

  if (!planPath) {
    return null;
  }

  return {
    ...(await readJson(planPath)),
    path: planPath
  };
}

async function loadBaselineFromLoopDir(loopDir) {
  if (!loopDir) {
    return null;
  }

  const iterationReportPath = path.join(path.resolve(loopDir), "iteration-report.json");
  return readJson(iterationReportPath);
}

async function loadLoopRunMetadata(loopDir) {
  if (!loopDir) {
    return null;
  }

  const runPath = path.join(path.resolve(loopDir), "run.json");
  return readJson(runPath);
}

async function loadRunArtifacts(runDir) {
  if (!runDir) {
    return null;
  }
  const absoluteRunDir = path.resolve(runDir);
  return {
    summary: await readJson(path.join(absoluteRunDir, "summary.json")),
    diagnostic: await readJson(path.join(absoluteRunDir, "diagnostic.json"))
  };
}

function buildReplayCommand(options) {
  const command = [
    "node",
    "tools/qa/replay-real-corpus-webchat-run.mjs",
    "--output-root",
    options.outputRoot,
    "--corpus-dir",
    options.corpusDir,
    "--backend-base-url",
    options.backendBaseUrl,
    "--tenant-key",
    options.tenantKey,
    "--page",
    options.page,
    "--scope",
    options.scope
  ];

  if (options.limitConversations) {
    command.push("--limit-conversations", String(options.limitConversations));
  }
  if (options.limitTurns) {
    command.push("--limit-turns", String(options.limitTurns));
  }

  return command;
}

function buildReviewCommand(replayRunDir) {
  return [
    "node",
    "tools/qa/review-real-corpus-findings.mjs",
    "--run-dir",
    replayRunDir
  ];
}

function buildProbeCommand(options) {
  const command = [
    "node",
    "tools/qa/run-live-webchat-probe-loop.mjs",
    "--output-root",
    options.outputRoot,
    "--backend-base-url",
    options.backendBaseUrl,
    "--ai-platform-base-url",
    options.aiPlatformBaseUrl,
    "--internal-token",
    options.internalToken,
    "--tenant-key",
    options.tenantKey,
    "--page",
    options.page,
    "--scope",
    options.scope,
    "--iterations",
    String(options.probeIterations)
  ];

  if (options.playbookPath) {
    command.push("--playbook-path", options.playbookPath);
  }
  if (options.scenarioIds) {
    command.push("--scenario-ids", options.scenarioIds);
  }
  if (options.tags) {
    command.push("--tags", options.tags);
  }
  if (options.limitScenarios) {
    command.push("--limit-scenarios", String(options.limitScenarios));
  }

  return command;
}

async function runStep({ label, command, runDir, status, statusPath }) {
  const logFilePath = path.join(runDir, `${label}.log`);
  status.stage = label;
  status[`started_${label}`] = new Date().toISOString();
  await writeJson(statusPath, status);

  const execution = await executeCommand(command, {
    cwd: REPO_ROOT,
    logFilePath
  });

  status[`finished_${label}`] = new Date().toISOString();
  status.logs = {
    ...(status.logs || {}),
    [label]: logFilePath
  };

  if (execution.exitCode !== 0) {
    status.status = "failed";
    status.failedStage = label;
    status.failedCommand = formatCommand(command);
    await writeJson(statusPath, status);
    throw new Error(`command_failed:${label}`);
  }

  await writeJson(statusPath, status);
  return execution;
}

function buildRerunCommand(options, loopRunDir) {
  const command = [
    "node",
    "tools/qa/run-real-chat-remediation-loop.mjs",
    "--output-root",
    options.outputRoot,
    "--corpus-dir",
    options.corpusDir,
    "--backend-base-url",
    options.backendBaseUrl,
    "--ai-platform-base-url",
    options.aiPlatformBaseUrl,
    "--internal-token",
    options.internalToken,
    "--tenant-key",
    options.tenantKey,
    "--page",
    options.page,
    "--scope",
    options.scope,
    "--probe-iterations",
    String(options.probeIterations),
    "--baseline-loop-dir",
    loopRunDir
  ];

  if (options.playbookPath) {
    command.push("--playbook-path", options.playbookPath);
  }
  if (options.derivedCount) {
    command.push("--derived-count", String(options.derivedCount));
  }
  if (options.derivedMode) {
    command.push("--derived-mode", options.derivedMode);
  }
  if (options.derivedSeed) {
    command.push("--derived-seed", options.derivedSeed);
  }
  if (options.scenarioIds) {
    command.push("--scenario-ids", options.scenarioIds);
  }
  if (options.tags) {
    command.push("--tags", options.tags);
  }
  if (options.limitConversations) {
    command.push("--limit-conversations", String(options.limitConversations));
  }
  if (options.limitTurns) {
    command.push("--limit-turns", String(options.limitTurns));
  }
  if (options.limitScenarios) {
    command.push("--limit-scenarios", String(options.limitScenarios));
  }
  if (options.structuralPlanPath) {
    command.push("--structural-plan-path", options.structuralPlanPath);
  }

  return formatCommand(command);
}

function buildBacklogMarkdown(report) {
  const lines = [
    "# Structural Backlog",
    "",
    `Loop run ID: ${report.loopRunId}`,
    `Iteration: ${report.iteration}`,
    `Status: ${report.status}`,
    "",
    "## Recommended Scope",
    "",
    `- ${report.recommendedScope.join(", ") || "No workstreams prioritized."}`,
    "",
    "## Prioritized Workstreams",
    ""
  ];

  for (const workstream of report.prioritizedWorkstreams) {
    lines.push(`### ${workstream.id} ${workstream.name}`);
    lines.push("");
    lines.push(`- Priority: ${workstream.priority}`);
    lines.push(`- Score: ${workstream.score}`);
    lines.push(
      `- Evidence: ${workstream.evidenceCategories.map((entry) => `${entry.category}(${entry.count})`).join(", ")}`
    );
    if (workstream.implementation.length > 0) {
      lines.push("- Implementation focus:");
      for (const item of workstream.implementation) {
        lines.push(`  - ${item}`);
      }
    }
    lines.push("");
  }

  lines.push("## Next Rerun");
  lines.push("");
  lines.push(`- \`${report.commands.rerun}\``);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const loopRunId = `real-chat-remediation-loop-${generatedAt.replace(/[:.]/g, "-")}`;
  const runDir = path.join(options.outputRoot, loopRunId);
  const statusPath = path.join(runDir, "status.json");

  await mkdir(runDir, { recursive: true });

  const structuralPlan = await loadStructuralPlan(options.structuralPlanPath);
  const baselineLoopReport = await loadBaselineFromLoopDir(options.baselineLoopDir);
  const baselineLoopRun = await loadLoopRunMetadata(options.baselineLoopDir);
  const baselineReplayArtifacts = await loadRunArtifacts(options.baselineReplayRunDir);
  const baselineProbeArtifacts = await loadRunArtifacts(options.baselineProbeRunDir);

  const iteration = toNumber(baselineLoopReport?.iteration) > 0
    ? toNumber(baselineLoopReport.iteration) + 1
    : 1;

  const status = {
    loopRunId,
    generatedAt,
    iteration,
    iterationLabel: options.iterationLabel,
    status: "running",
    stage: "initializing",
    logs: {}
  };
  await writeJson(statusPath, status);

  const replayCommand = buildReplayCommand(options);
  const replayExecution = await runStep({
    label: "replay",
    command: replayCommand,
    runDir,
    status,
    statusPath
  });
  const replayPointers = parseKeyValueLines(replayExecution.output);
  const replayRunDir = replayPointers.run_dir;
  if (!replayRunDir) {
    throw new Error("replay_run_dir_missing");
  }

  const reviewCommand = buildReviewCommand(replayRunDir);
  const reviewExecution = await runStep({
    label: "review",
    command: reviewCommand,
    runDir,
    status,
    statusPath
  });
  const reviewPointers = JSON.parse(reviewExecution.output);

  let effectivePlaybookPath = options.playbookPath;
  let derivedSetResult = null;
  let carriedPlaybook = null;
  let currentDerivedPlaybook = null;
  let basePlaybook = null;
  let regressionPlaybook = null;
  let carriedPlaybookPath = null;
  let currentDerivedPlaybookPath = null;
  let basePlaybookPath = null;
  let regressionPlaybookPath = null;
  let effectiveDerivedPlaybook = null;

  if (!effectivePlaybookPath) {
    const derivedOutputDir = path.join(runDir, "corpus-derived-probes");
    await mkdir(derivedOutputDir, { recursive: true });
    if (baselineLoopRun?.generatedProbePlaybookPath) {
      carriedPlaybookPath = path.resolve(baselineLoopRun.generatedProbePlaybookPath);
      carriedPlaybook = await readJson(carriedPlaybookPath);
      await writeJson(path.join(derivedOutputDir, "carried-forward-playbook.json"), carriedPlaybook);
    }

    derivedSetResult = await buildProposalDerivedRealSet({
      corpusDir: options.corpusDir,
      outputDir: derivedOutputDir,
      count: options.derivedCount,
      seed: options.derivedSeed,
      mode: options.derivedMode
    });
    const derivedSet = await readJson(derivedSetResult.outputPath);
    currentDerivedPlaybook = buildProbePlaybookFromDerivedRealSet(derivedSet, {
      tenantKey: options.tenantKey,
      page: options.page,
      scope: options.scope
    });
    currentDerivedPlaybookPath = path.join(derivedOutputDir, "current-corpus-derived-playbook.json");
    await writeJson(currentDerivedPlaybookPath, currentDerivedPlaybook);

    if (baselineLoopRun?.baseProbePlaybookPath) {
      basePlaybook = await readJson(path.resolve(baselineLoopRun.baseProbePlaybookPath));
    } else {
      basePlaybook = currentDerivedPlaybook;
    }
    basePlaybookPath = path.join(derivedOutputDir, "base-pack.json");
    await writeJson(basePlaybookPath, basePlaybook);

    if (baselineLoopRun?.regressionProbePlaybookPath) {
      regressionPlaybook = await readJson(path.resolve(baselineLoopRun.regressionProbePlaybookPath));
    } else {
      regressionPlaybook = carriedPlaybook;
    }

    regressionPlaybook = mergeProbePlaybooks(regressionPlaybook, currentDerivedPlaybook);
    regressionPlaybookPath = path.join(derivedOutputDir, "regression-pack.json");
    await writeJson(regressionPlaybookPath, regressionPlaybook);

    await writeJson(path.join(derivedOutputDir, "new-findings-pack.json"), currentDerivedPlaybook);

    effectiveDerivedPlaybook = mergeProbePlaybooks(basePlaybook, regressionPlaybook);
    effectivePlaybookPath = path.join(derivedOutputDir, "live-webchat-probe-playbook.json");
    await writeJson(effectivePlaybookPath, effectiveDerivedPlaybook);
  }

  const probeCommand = buildProbeCommand({
    ...options,
    playbookPath: effectivePlaybookPath
  });
  const probeExecution = await runStep({
    label: "probe",
    command: probeCommand,
    runDir,
    status,
    statusPath
  });
  const probePointers = parseKeyValueLines(probeExecution.output);
  const probeRunDir = probePointers.run_dir;
  if (!probeRunDir) {
    throw new Error("probe_run_dir_missing");
  }

  const replaySummary = await readJson(path.join(replayRunDir, "summary.json"));
  const replayDiagnostic = await readJson(path.join(replayRunDir, "diagnostic.json"));
  const reviewSummary = await readJson(path.join(reviewPointers.summaryJsonPath));
  const reviewByConversation = await readJson(path.join(reviewPointers.byConversationJsonPath));
  const probeSummary = await readJson(path.join(probeRunDir, "summary.json"));
  const probeDiagnostic = await readJson(path.join(probeRunDir, "diagnostic.json"));
  const probeActionPlan = await readJson(path.join(probeRunDir, "action-plan.json"));
  const providerAudit = await readJson(path.join(probeRunDir, "provider-audit.json"));

  const baseline = normalizeBaseline({
    baselineLoopReport,
    baselineReplaySummary: baselineReplayArtifacts?.summary || null,
    baselineReplayDiagnostic: baselineReplayArtifacts?.diagnostic || null,
    baselineProbeSummary: baselineProbeArtifacts?.summary || null,
    baselineProbeDiagnostic: baselineProbeArtifacts?.diagnostic || null
  });

  const rerunCommand = buildRerunCommand(options, runDir);
  const report = buildLoopIterationReport({
    loopRunId,
    generatedAt,
    iteration,
    iterationLabel: options.iterationLabel,
    replay: {
      runDir: replayRunDir,
      summary: replaySummary,
      diagnostic: replayDiagnostic
    },
    review: {
      outputDir: reviewPointers.outputDir,
      summary: reviewSummary,
      byConversation: reviewByConversation
    },
    probe: {
      runDir: probeRunDir,
      summary: probeSummary,
      diagnostic: probeDiagnostic,
      actionPlan: probeActionPlan,
      providerAudit
    },
    structuralPlan,
    baseline,
    commands: {
      replay: formatCommand(replayCommand),
      review: formatCommand(reviewCommand),
      probe: formatCommand(probeCommand),
      rerun: rerunCommand
    }
  });

  await writeJson(path.join(runDir, "iteration-report.json"), report);
  await writeFile(
    path.join(runDir, "iteration-report.md"),
    buildLoopIterationMarkdown(report),
    "utf8"
  );
  await writeJson(path.join(runDir, "delta-vs-baseline.json"), report.deltaVsBaseline);
  await writeFile(
    path.join(runDir, "delta-vs-baseline.md"),
    buildLoopIterationMarkdown({
      ...report,
      explicitLoop: report.explicitLoop,
      prioritizedWorkstreams: [],
      recommendedScope: [],
      nextAction: report.nextAction
    }),
    "utf8"
  );
  await writeJson(path.join(runDir, "structural-backlog.json"), {
    loopRunId,
    iteration,
    recommendedScope: report.recommendedScope,
    prioritizedWorkstreams: report.prioritizedWorkstreams,
    nextAction: report.nextAction,
    rerunCommand: report.commands.rerun
  });
  await writeFile(
    path.join(runDir, "structural-backlog.md"),
    buildBacklogMarkdown(report),
    "utf8"
  );
  await writeJson(path.join(runDir, "run.json"), {
    loopRunId,
    generatedAt,
    iteration,
    iterationLabel: options.iterationLabel,
    options,
    structuralPlanPath: structuralPlan?.path || null,
    generatedProbeSource: options.playbookPath ? "explicit_playbook" : "corpus_derived",
    generatedProbeSetPath: derivedSetResult?.outputPath || null,
    generatedProbePlaybookPath: effectivePlaybookPath || null,
    baseProbePlaybookPath: basePlaybookPath,
    regressionProbePlaybookPath: regressionPlaybookPath,
    carriedProbePlaybookPath: carriedPlaybookPath,
    currentCorpusDerivedPlaybookPath: currentDerivedPlaybookPath,
    probePackStats: options.playbookPath
      ? null
      : {
          baseScenarios: Array.isArray(basePlaybook?.scenarios) ? basePlaybook.scenarios.length : 0,
          carriedScenarios: Array.isArray(carriedPlaybook?.scenarios) ? carriedPlaybook.scenarios.length : 0,
          currentDerivedScenarios: Array.isArray(currentDerivedPlaybook?.scenarios)
            ? currentDerivedPlaybook.scenarios.length
            : 0,
          regressionScenarios: Array.isArray(regressionPlaybook?.scenarios)
            ? regressionPlaybook.scenarios.length
            : 0,
          effectiveScenarios: Array.isArray(effectiveDerivedPlaybook?.scenarios)
            ? effectiveDerivedPlaybook.scenarios.length
            : 0
        },
    replayRunDir,
    probeRunDir,
    reviewOutputDir: reviewPointers.outputDir || null
  });

  const resourceExports = await exportRealChatRemediationResources({
    loopRunDir: runDir
  });
  await writeJson(path.join(runDir, "resource-exports.json"), resourceExports);

  await writeJson(path.join(options.outputRoot, "latest-real-chat-remediation-loop.json"), {
    loopRunId,
    runDir,
    generatedAt,
    iteration,
    status: report.status,
    iterationReportJsonPath: path.join(runDir, "iteration-report.json"),
    iterationReportMarkdownPath: path.join(runDir, "iteration-report.md"),
    structuralBacklogJsonPath: path.join(runDir, "structural-backlog.json"),
    structuralBacklogMarkdownPath: path.join(runDir, "structural-backlog.md"),
    deltaJsonPath: path.join(runDir, "delta-vs-baseline.json"),
    deltaMarkdownPath: path.join(runDir, "delta-vs-baseline.md"),
    resourceExportsJsonPath: path.join(runDir, "resource-exports.json"),
    replayRunDir,
    probeRunDir
  });

  status.status = "completed";
  status.stage = "completed";
  status.finishedAt = new Date().toISOString();
  await writeJson(statusPath, status);

  console.log(`loop_run_id=${loopRunId}`);
  console.log(`loop_run_dir=${runDir}`);
  console.log(`iteration_report=${path.join(runDir, "iteration-report.json")}`);
  console.log(`structural_backlog=${path.join(runDir, "structural-backlog.json")}`);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
