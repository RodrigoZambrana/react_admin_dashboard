#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import os from "node:os";
import { ingestWhatsAppCorpus } from "./whatsapp-corpus-lib.mjs";
import { generateWhatsAppResponsePlaybook } from "./generate-whatsapp-response-playbook.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const defaultSourceCandidates = [
  process.env.QA_WHATSAPP_SOURCE_DIR,
  "/Users/rodrigo/Downloads/whatsapp"
].filter(Boolean);

function parseArgs(argv) {
  const options = {
    sourceDir: defaultSourceCandidates[0] ?? null,
    outputDir: path.join(repoRoot, ".qa", "external-real-conversations", "whatsapp"),
    playbookOutputPath: path.join(
      os.homedir(),
      "Downloads",
      "knowledge-inputs",
      "customer-response-playbook.md"
    ),
    playbookMetadataPath: path.join(
      os.homedir(),
      "Downloads",
      "knowledge-inputs",
      "customer-response-playbook.meta.json"
    )
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source-dir") {
      options.sourceDir = argv[index + 1] ?? options.sourceDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--source-dir=")) {
      options.sourceDir = arg.slice("--source-dir=".length);
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
      console.log(
        [
          "Usage: node tools/qa/ingest-whatsapp-real-corpus.mjs [--source-dir <path>] [--output-dir <path>] [--playbook-output-path <path>]",
          "",
          "Scans a folder of WhatsApp export .zip files, builds normalized manifests,",
          "classifies conversation types, proposes regression fixtures and generates",
          "a response playbook artifact in .qa outputs."
        ].join("\n")
      );
      process.exit(0);
    }
    if (arg === "--playbook-output-path") {
      options.playbookOutputPath = argv[index + 1] ?? options.playbookOutputPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--playbook-output-path=")) {
      options.playbookOutputPath = arg.slice("--playbook-output-path=".length);
      continue;
    }
    if (arg === "--playbook-metadata-path") {
      options.playbookMetadataPath = argv[index + 1] ?? options.playbookMetadataPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--playbook-metadata-path=")) {
      options.playbookMetadataPath = arg.slice("--playbook-metadata-path=".length);
      continue;
    }
    if (arg === "--no-playbook-metadata") {
      options.playbookMetadataPath = null;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.sourceDir) {
    console.log(
      JSON.stringify(
        {
          status: "skipped",
          reason: "source_dir_missing",
          sourceDir: null
        },
        null,
        2
      )
    );
    return;
  }

  const result = await ingestWhatsAppCorpus(options);
  const playbook = await generateWhatsAppResponsePlaybook({
    corpusDir: options.outputDir,
    outputPath: options.playbookOutputPath,
    metadataPath: options.playbookMetadataPath
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        generatedPlaybook: {
          outputPath: playbook.outputPath,
          metadataPath: options.playbookMetadataPath,
          conversations: playbook.conversations,
          turns: playbook.turns
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: error?.message || String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
