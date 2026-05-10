#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { generateConversationQualityReport } from "./analyze-conversation-quality.mjs";
import {
  loadMonorepoSuiteSummary,
  normalizeManifestProfiles,
  writeMonorepoQaStatusReport,
  repoRoot,
} from "./monorepo-suite-runner.mjs";

const currentFilePath = fileURLToPath(import.meta.url);
const qaRoot = path.join(repoRoot, ".qa");
const runsRoot = path.join(qaRoot, "runs");
const manifestPath = path.join(repoRoot, "tools", "qa", "manifest.json");

function printUsage() {
  console.log(
    [
      "Usage: node tools/qa/run-qa.mjs [--all] [--block <id>] [--repeat <n>] [--include-deferred] [--only-deferred] [--list] [--write-report]",
      "",
      "Options:",
      "  --all                Run every configured block",
      "  --block <id>         Run a specific block (repeatable or comma-separated)",
      "  --repeat <n>         Repeat the selected sequence n times",
      "  --include-deferred   Append deferred blocks to the core release gate selection",
      "  --only-deferred      Run only the deferred profile",
      "  --list               Print available QA blocks and profile membership",
      "  --write-report       Refresh docs/testing/monorepo-qa-status.md",
      "  --help               Show this message",
    ].join("\n"),
  );
}

async function loadManifest() {
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const selectedBlocks = [];
  let runAll = false;
  let listOnly = false;
  let repeat = 1;
  let includeDeferred = false;
  let onlyDeferred = false;
  let writeReport = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") {
      runAll = true;
      continue;
    }
    if (arg === "--list") {
      listOnly = true;
      continue;
    }
    if (arg === "--include-deferred") {
      includeDeferred = true;
      continue;
    }
    if (arg === "--only-deferred") {
      onlyDeferred = true;
      continue;
    }
    if (arg === "--write-report") {
      writeReport = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--repeat") {
      const value = Number(argv[index + 1] ?? "1");
      repeat = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
      index += 1;
      continue;
    }
    if (arg === "--block") {
      const value = String(argv[index + 1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      selectedBlocks.push(...value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--block=")) {
      selectedBlocks.push(
        ...arg
          .slice("--block=".length)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (runAll && onlyDeferred) {
    throw new Error("Cannot combine --all with --only-deferred");
  }
  if (selectedBlocks.length > 0 && (runAll || onlyDeferred || includeDeferred)) {
    throw new Error("Use either explicit --block selection or profile flags, not both");
  }

  return {
    selectedBlocks,
    runAll,
    listOnly,
    repeat,
    includeDeferred,
    onlyDeferred,
    writeReport,
  };
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

function shouldGenerateConversationQualityReport(blocks) {
  return blocks.some((block) => {
    const tags = Array.isArray(block?.tags) ? block.tags.map(String) : [];
    return (
      block?.id === "ai-conversation-quality" ||
      tags.includes("ai") ||
      tags.includes("conversations") ||
      tags.includes("webchat")
    );
  });
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
      resolve({
        exitCode: exitCode ?? 1,
        output: combinedOutput,
      });
    });
  });
}

async function writeRunSnapshot(run) {
  await mkdir(path.join(runsRoot, run.id), { recursive: true });
  await writeFile(path.join(runsRoot, `${run.id}.json`), JSON.stringify(run, null, 2), "utf8");
  await writeFile(path.join(qaRoot, "latest.json"), JSON.stringify(run, null, 2), "utf8");
}

function dedupeBlockIds(ids) {
  return Array.from(
    new Set(
      ids
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );
}

function resolveBlockByIds(manifest, ids) {
  const blockMap = new Map((manifest.blocks ?? []).map((block) => [block.id, block]));
  return ids.map((id) => {
    const block = blockMap.get(id);
    if (!block) {
      throw new Error(`Unknown QA block: ${id}`);
    }
    return block;
  });
}

function buildSelection(manifest, options) {
  const profiles = normalizeManifestProfiles(manifest);
  const coreIds = dedupeBlockIds(profiles.core.blockIds);
  const deferredIds = dedupeBlockIds(profiles.deferred.blockIds);

  if (options.runAll) {
    return {
      mode: "all",
      selectedBlocks: resolveBlockByIds(manifest, [...coreIds, ...deferredIds]),
      selectedCoreBlockIds: coreIds,
      selectedDeferredBlockIds: deferredIds,
      profiles,
    };
  }

  if (options.onlyDeferred) {
    return {
      mode: "deferred",
      selectedBlocks: resolveBlockByIds(manifest, deferredIds),
      selectedCoreBlockIds: [],
      selectedDeferredBlockIds: deferredIds,
      profiles,
    };
  }

  if (options.selectedBlocks.length > 0) {
    const selectedIds = dedupeBlockIds(options.selectedBlocks);
    const selectedCoreBlockIds = selectedIds.filter((id) => coreIds.includes(id));
    const selectedDeferredBlockIds = selectedIds.filter((id) => deferredIds.includes(id));

    return {
      mode: "explicit",
      selectedBlocks: resolveBlockByIds(manifest, selectedIds),
      selectedCoreBlockIds,
      selectedDeferredBlockIds,
      profiles,
    };
  }

  if (options.includeDeferred) {
    return {
      mode: "core-plus-deferred",
      selectedBlocks: resolveBlockByIds(manifest, [...coreIds, ...deferredIds]),
      selectedCoreBlockIds: coreIds,
      selectedDeferredBlockIds: deferredIds,
      profiles,
    };
  }

  return {
    mode: manifest.defaultProfileId === "deferred" ? "deferred" : "core",
    selectedBlocks: resolveBlockByIds(manifest, coreIds),
    selectedCoreBlockIds: coreIds,
    selectedDeferredBlockIds: [],
    profiles,
  };
}

function buildStatusCounts(results) {
  const total = results.length;
  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const running = results.filter((result) => result.status === "running").length;
  const notRun = total - passed - failed - running;

  return { total, passed, failed, running, notRun };
}

function getExecutionStatus(results, selectedCount) {
  if (selectedCount === 0) {
    return "not-selected";
  }
  return results.some((result) => result.status === "failed") ? "failed" : "passed";
}

function printBlockList(manifest) {
  const profiles = normalizeManifestProfiles(manifest);
  const membership = new Map();

  for (const blockId of profiles.core.blockIds) {
    membership.set(blockId, "core");
  }
  for (const blockId of profiles.deferred.blockIds) {
    membership.set(blockId, membership.has(blockId) ? "core+deferred" : "deferred");
  }

  console.log(`default profile: ${profiles.defaultProfileId}\n`);
  console.log(`core (${profiles.core.blockIds.length})\n  ${profiles.core.description}\n`);
  console.log(`deferred (${profiles.deferred.blockIds.length})\n  ${profiles.deferred.description}\n`);

  for (const block of manifest.blocks ?? []) {
    console.log(
      [
        `${block.id} [${membership.get(block.id) ?? "unassigned"}]`,
        `  ${block.name}`,
        `  ${block.description}`,
        `  ${block.cwd}`,
        "",
      ].join("\n"),
    );
  }
}

async function main() {
  const manifest = await loadManifest();
  const options = parseArgs(process.argv.slice(2));

  if (options.listOnly) {
    printBlockList(manifest);
    return;
  }

  const selection = buildSelection(manifest, options);
  const profiles = selection.profiles;
  const gateTierByBlockId = new Map();

  for (const blockId of profiles.core.blockIds) {
    gateTierByBlockId.set(blockId, "core");
  }
  for (const blockId of profiles.deferred.blockIds) {
    if (!gateTierByBlockId.has(blockId)) {
      gateTierByBlockId.set(blockId, "deferred");
    }
  }

  const selectedBlocks = selection.selectedBlocks;
  const runId = `qa-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  await mkdir(runsRoot, { recursive: true });
  await rm(path.join(runsRoot, runId), { recursive: true, force: true });
  await mkdir(path.join(runsRoot, runId), { recursive: true });
  await writeFile(path.join(qaRoot, "manifest.snapshot.json"), JSON.stringify(manifest, null, 2), "utf8");

  const run = {
    id: runId,
    status: "running",
    releaseGateStatus: "running",
    deferredStatus: selection.selectedDeferredBlockIds.length > 0 ? "running" : "not-selected",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    repeat: options.repeat,
    selectionMode: selection.mode,
    selectedBlockIds: selectedBlocks.map((block) => block.id),
    selectedCoreBlockIds: selection.selectedCoreBlockIds,
    selectedDeferredBlockIds: selection.selectedDeferredBlockIds,
    availableCoreBlockIds: profiles.core.blockIds,
    availableDeferredBlockIds: profiles.deferred.blockIds,
    skippedDeferredBlockIds: profiles.deferred.blockIds.filter(
      (blockId) => !selection.selectedDeferredBlockIds.includes(blockId),
    ),
    blocks: [],
    summary: {
      core: { total: selection.selectedCoreBlockIds.length, passed: 0, failed: 0, running: 0, notRun: 0 },
      deferred: {
        total: selection.selectedDeferredBlockIds.length,
        passed: 0,
        failed: 0,
        running: 0,
        notRun: 0,
      },
      selected: { total: selectedBlocks.length, passed: 0, failed: 0, running: 0, notRun: 0 },
    },
  };

  await writeRunSnapshot(run);

  let overallFailed = false;

  for (let attempt = 1; attempt <= options.repeat; attempt += 1) {
    for (const block of selectedBlocks) {
      const steps =
        Array.isArray(block.steps) && block.steps.length > 0
          ? block.steps
          : [{ cwd: block.cwd, command: block.command }];
      const blockStart = Date.now();
      const gateTier = gateTierByBlockId.get(block.id) ?? "deferred";
      const blockResult = {
        id: `${block.id}${options.repeat > 1 ? `#${attempt}` : ""}`,
        blockId: block.id,
        gateTier,
        name: block.name,
        description: block.description,
        kind: block.kind,
        tags: block.tags ?? [],
        estimatedMinutes: block.estimatedMinutes ?? null,
        attempt,
        status: "running",
        startedAt: new Date(blockStart).toISOString(),
        finishedAt: null,
        durationMs: null,
        cwd: block.cwd,
        commandDisplay: null,
        steps: [],
      };

      run.blocks.push(blockResult);
      await writeRunSnapshot(run);

      let blockFailed = false;

      for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        const step = steps[stepIndex];
        const stepCwd = path.resolve(repoRoot, step.cwd);
        const stepCommand = step.command;
        const commandDisplay = formatCommand(stepCommand);
        const logFilePath = path.join(
          runsRoot,
          runId,
          `${blockResult.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-step-${stepIndex + 1}.log`,
        );

        const startedAt = new Date().toISOString();
        const execution = await executeCommand(stepCommand, stepCwd, logFilePath);
        const finishedAt = new Date().toISOString();

        blockResult.commandDisplay = blockResult.commandDisplay ?? commandDisplay;
        blockResult.steps.push({
          index: stepIndex + 1,
          cwd: step.cwd,
          commandDisplay,
          logFile: path.relative(repoRoot, logFilePath),
          startedAt,
          finishedAt,
          exitCode: execution.exitCode,
          status: execution.exitCode === 0 ? "passed" : "failed",
          summary: buildSummary(execution.output, execution.exitCode),
        });

        if (execution.exitCode !== 0) {
          blockFailed = true;
          overallFailed = true;
          break;
        }
      }

      blockResult.finishedAt = new Date().toISOString();
      blockResult.durationMs = Date.now() - blockStart;
      blockResult.status = blockFailed ? "failed" : "passed";
      await writeRunSnapshot(run);
    }
  }

  const coreResults = run.blocks.filter((entry) => entry.gateTier === "core");
  const deferredResults = run.blocks.filter((entry) => entry.gateTier === "deferred");

  run.summary = {
    core: buildStatusCounts(coreResults),
    deferred: buildStatusCounts(deferredResults),
    selected: buildStatusCounts(run.blocks),
  };
  run.releaseGateStatus = getExecutionStatus(coreResults, selection.selectedCoreBlockIds.length);
  run.deferredStatus = getExecutionStatus(deferredResults, selection.selectedDeferredBlockIds.length);
  run.status = overallFailed ? "failed" : "passed";
  run.finishedAt = new Date().toISOString();
  await writeRunSnapshot(run);

  if (shouldGenerateConversationQualityReport(selectedBlocks)) {
    try {
      const report = await generateConversationQualityReport({
        runFilePath: path.join(runsRoot, `${run.id}.json`),
        write: true,
      });
      run.conversationQualityReport = report.artifacts ?? null;
      await writeRunSnapshot(run);
    } catch (error) {
      console.error("Conversation quality report generation failed", error);
    }
  }

  if (options.writeReport) {
    await writeMonorepoQaStatusReport({
      suiteSummary: await loadMonorepoSuiteSummary(),
      qaRun: run,
    });
  }

  console.log(
    JSON.stringify(
      {
        runId,
        status: run.status,
        releaseGateStatus: run.releaseGateStatus,
        deferredStatus: run.deferredStatus,
        selectedBlocks: run.selectedBlockIds.length,
        selectedCoreBlocks: run.selectedCoreBlockIds.length,
        selectedDeferredBlocks: run.selectedDeferredBlockIds.length,
      },
      null,
      2,
    ),
  );

  if (overallFailed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
