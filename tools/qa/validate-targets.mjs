#!/usr/bin/env node

import process from "node:process";
import path from "node:path";
import { extractTargetTokens, fileContainsSkipMarker, inspectPathToken, repoRoot } from "./validation-utils.mjs";

function printUsage() {
  console.log(
    [
      "Usage: node tools/qa/validate-targets.mjs [--cwd <dir>] <target...>",
      "",
      "Options:",
      "  --cwd <dir>   Base working directory for relative targets",
      "  --help        Show this message",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  let cwd = process.cwd();
  const targets = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--cwd") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--cwd requires a value");
      }
      cwd = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--cwd=")) {
      cwd = path.resolve(process.cwd(), arg.slice("--cwd=".length));
      continue;
    }
    targets.push(arg);
  }

  return { cwd, targets };
}

function validateTargets(cwd, targets) {
  const issues = [];
  const matches = [];

  for (const target of targets) {
    const inspection = inspectPathToken(cwd, target);
    const resolved = inspection.matches;
    matches.push({
      target,
      kind: inspection.kind,
      matches: resolved.map((entry) => path.relative(repoRoot, entry)),
    });
    if (inspection.kind === "directory" || inspection.kind === "non-file") {
      issues.push({
        target,
        cwd: path.relative(repoRoot, cwd) || ".",
        issue: "invalid-target-type",
        targetType: inspection.kind,
      });
      continue;
    }

    if (resolved.length === 0) {
      issues.push({ target, cwd: path.relative(repoRoot, cwd) || ".", issue: "missing-target" });
      continue;
    }

    const skippedFiles = resolved.filter((filePath) => fileContainsSkipMarker(filePath));
    if (skippedFiles.length > 0) {
      issues.push({
        target,
        cwd: path.relative(repoRoot, cwd) || ".",
        issue: "skip-marker",
        files: skippedFiles.map((filePath) => path.relative(repoRoot, filePath)),
      });
    }
  }

  return { issues, matches };
}

function main() {
  const { cwd, targets } = parseArgs(process.argv.slice(2));
  const extractedTargets = targets.flatMap((target) => extractTargetTokens(target)).filter(Boolean);
  const uniqueTargets = Array.from(new Set(extractedTargets.length > 0 ? extractedTargets : targets));
  const result = validateTargets(cwd, uniqueTargets);

  console.log(JSON.stringify({ cwd: path.relative(repoRoot, cwd) || ".", ...result }, null, 2));

  if (result.issues.length > 0) {
    process.exitCode = 1;
  }
}

main();
