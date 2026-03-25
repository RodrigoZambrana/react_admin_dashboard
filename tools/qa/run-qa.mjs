#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const qaRoot = path.join(repoRoot, ".qa");
const runsRoot = path.join(qaRoot, "runs");
const manifestPath = path.join(repoRoot, "tools", "qa", "manifest.json");

function printUsage() {
  console.log(
    [
      "Usage: node tools/qa/run-qa.mjs [--all] [--block <id>] [--repeat <n>] [--list]",
      "",
      "Options:",
      "  --all           Run all configured blocks",
      "  --block <id>    Run a specific block (repeatable or comma-separated)",
      "  --repeat <n>    Repeat the selected sequence n times",
      "  --list          Print available QA blocks",
      "  --help          Show this message"
    ].join("\n")
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
          .filter(Boolean)
      );
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    selectedBlocks,
    runAll,
    listOnly,
    repeat
  };
}

function resolveSelectedBlocks(manifest, options) {
  if (options.runAll) {
    return manifest.blocks;
  }

  if (options.selectedBlocks.length > 0) {
    const blockMap = new Map(manifest.blocks.map((block) => [block.id, block]));
    return options.selectedBlocks.map((id) => {
      const match = blockMap.get(id);
      if (!match) {
        throw new Error(`Unknown QA block: ${id}`);
      }
      return match;
    });
  }

  const defaultIds = new Set(manifest.defaultBlockIds ?? []);
  return manifest.blocks.filter((block) => defaultIds.has(block.id));
}

function formatCommand(command) {
  return command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function buildSummary(output, exitCode) {
  const trimmed = output.trim();
  if (!trimmed) {
    return exitCode === 0 ? "Completed without output." : "Failed without captured output.";
  }
  const lines = trimmed.split(/\r?\n/).slice(-8);
  return lines.join("\n");
}

async function executeCommand(command, cwd, logFilePath) {
  return new Promise((resolve) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let combinedOutput = "";

    const append = (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    child.on("close", async (exitCode) => {
      await writeFile(logFilePath, combinedOutput, "utf8");
      resolve({
        exitCode: exitCode ?? 1,
        output: combinedOutput
      });
    });
  });
}

async function writeRunSnapshot(run) {
  await mkdir(path.join(runsRoot, run.id), { recursive: true });
  await writeFile(path.join(runsRoot, `${run.id}.json`), JSON.stringify(run, null, 2), "utf8");
  await writeFile(path.join(qaRoot, "latest.json"), JSON.stringify(run, null, 2), "utf8");
}

async function main() {
  const manifest = await loadManifest();
  const options = parseArgs(process.argv.slice(2));

  if (options.listOnly) {
    manifest.blocks.forEach((block) => {
      console.log(`${block.id}\n  ${block.name}\n  ${block.description}\n  ${block.cwd}\n`);
    });
    return;
  }

  const selectedBlocks = resolveSelectedBlocks(manifest, options);
  const runId = `qa-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  await mkdir(runsRoot, { recursive: true });
  await rm(path.join(runsRoot, runId), { recursive: true, force: true });
  await mkdir(path.join(runsRoot, runId), { recursive: true });
  await writeFile(path.join(qaRoot, "manifest.snapshot.json"), JSON.stringify(manifest, null, 2), "utf8");

  const run = {
    id: runId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    repeat: options.repeat,
    selectedBlockIds: selectedBlocks.map((block) => block.id),
    blocks: []
  };

  await writeRunSnapshot(run);

  let overallFailed = false;

  for (let attempt = 1; attempt <= options.repeat; attempt += 1) {
    for (const block of selectedBlocks) {
      const steps = Array.isArray(block.steps) && block.steps.length > 0 ? block.steps : [{ cwd: block.cwd, command: block.command }];
      const blockStart = Date.now();
      const blockResult = {
        id: `${block.id}${options.repeat > 1 ? `#${attempt}` : ""}`,
        blockId: block.id,
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
        steps: []
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
          `${blockResult.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-step-${stepIndex + 1}.log`
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
          summary: buildSummary(execution.output, execution.exitCode)
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

  run.status = overallFailed ? "failed" : "passed";
  run.finishedAt = new Date().toISOString();
  await writeRunSnapshot(run);

  console.log(JSON.stringify({ runId, status: run.status, blocks: run.blocks.length }, null, 2));

  if (overallFailed) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
