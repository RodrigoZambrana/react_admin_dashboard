#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import { exportRealChatRemediationResources } from "./real-chat-remediation-resource-export-lib.mjs";

function printUsage() {
  console.log(
    [
      "Usage: node tools/qa/export-real-chat-remediation-resources.mjs [options]",
      "",
      "Exports remediation loop packs in extended JSON, plain text, and readable markdown.",
      "",
      "Options:",
      "  --loop-run-dir <path>   Remediation loop run directory.",
      "  --output-dir <path>     Optional export directory. Default: <loop-run-dir>/resource-exports.",
      "  --help                  Show this message."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const options = {
    loopRunDir: null,
    outputDir: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--loop-run-dir") {
      options.loopRunDir = argv[index + 1] ?? options.loopRunDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--loop-run-dir=")) {
      options.loopRunDir = arg.slice("--loop-run-dir=".length);
      continue;
    }
    if (arg === "--output-dir") {
      options.outputDir = argv[index + 1] ?? options.outputDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--output-dir=")) {
      options.outputDir = arg.slice("--output-dir=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.loopRunDir) {
    throw new Error("loop_run_dir_required");
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await exportRealChatRemediationResources({
    loopRunDir: path.resolve(options.loopRunDir),
    outputDir: options.outputDir ? path.resolve(options.outputDir) : null
  });

  console.log(`resource_exports=${result.outputDir}`);
  console.log(`resource_index=${path.join(result.outputDir, "index.json")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
