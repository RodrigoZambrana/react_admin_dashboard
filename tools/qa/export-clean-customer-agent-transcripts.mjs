#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { readdir } from "node:fs/promises"

import {
  DEFAULT_REAL_CORPUS_MANIFESTS_DIR,
  buildCorpusTranscriptConversation,
  readJson,
  resolveReplayRunDir,
  writeJson,
  writeTranscriptFiles
} from "./real-corpus-artifacts-lib.mjs";

const DEFAULT_CORPUS_DIR = DEFAULT_REAL_CORPUS_MANIFESTS_DIR

function parseArgs(argv) {
  const options = {
    runDir: null,
    corpusDir: DEFAULT_CORPUS_DIR,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--run-dir') {
      options.runDir = argv[index + 1] ?? options.runDir
      index += 1
      continue
    }

    if (arg.startsWith('--run-dir=')) {
      options.runDir = arg.slice('--run-dir='.length)
      continue
    }

    if (arg === '--corpus-dir') {
      options.corpusDir = argv[index + 1] ?? options.corpusDir
      index += 1
      continue
    }

    if (arg.startsWith('--corpus-dir=')) {
      options.corpusDir = arg.slice('--corpus-dir='.length)
      continue
    }

    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: node tools/qa/export-clean-customer-agent-transcripts.mjs [options]',
          '',
          'Options:',
          '  --run-dir <path>     Replay run directory where exports will be written. Default: latest real replay.',
          '  --corpus-dir <path>  Directory with normalized manifest JSON files.',
        ].join('\n'),
      )
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const runDir = await resolveReplayRunDir(options.runDir)
  const corpusDir = path.resolve(options.corpusDir)
  const outputDir = path.join(runDir, 'plain-transcripts')

  const manifestFiles = (await readdir(corpusDir))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))

  const conversations = []

  for (const fileName of manifestFiles) {
    const manifestPath = path.join(corpusDir, fileName)
    const manifest = await readJson(manifestPath)
    conversations.push(buildCorpusTranscriptConversation(manifest))
  }

  const transcriptExport = await writeTranscriptFiles(conversations, {
    outputDir,
    combinedFileName: 'all-conversations-client-agent.txt',
  })
  const statsPath = path.join(outputDir, 'export-stats.json')
  await writeJson(statsPath, transcriptExport.stats)

  console.log(
    JSON.stringify(
      {
        runDir,
        corpusDir,
        outputDir,
        combinedPath: transcriptExport.combinedPath,
        perConversationDir: transcriptExport.perConversationDir,
        statsPath,
        stats: transcriptExport.stats,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
