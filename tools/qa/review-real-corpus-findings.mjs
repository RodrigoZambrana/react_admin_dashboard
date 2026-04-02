#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { resolveReplayRunDir } from "./real-corpus-artifacts-lib.mjs";

function parseArgs(argv) {
  const options = {
    runDir: null,
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
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: node tools/qa/review-real-corpus-findings.mjs [options]',
          '',
          'Options:',
          '  --run-dir <path>   Replay run directory to review. Default: latest real replay.',
        ].join('\n'),
      )
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function severityRank(value) {
  switch (value) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

function compactText(value, max = 220) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) {
    return normalized
  }
  return `${normalized.slice(0, max - 1)}…`
}

function countBy(items, projector) {
  const output = {}
  for (const item of items) {
    const key = projector(item)
    if (!key) continue
    output[key] = (output[key] || 0) + 1
  }
  return output
}

function sortCountEntries(record) {
  return Object.entries(record || {})
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => ({ key, count }))
}

function buildConversationReview(conversation) {
  const findings = conversation.turns
    .flatMap((turn) =>
      (Array.isArray(turn.findings) ? turn.findings : []).map((finding) => ({
        ...finding,
        responseText: turn.responseText || null,
        currentTurnText: turn.user?.text || null,
      })),
    )
    .sort((left, right) => {
      const severityDiff = severityRank(right.severity) - severityRank(left.severity)
      if (severityDiff !== 0) {
        return severityDiff
      }
      return String(left.turn || '').localeCompare(String(right.turn || ''))
    })

  const categories = countBy(findings, (finding) => finding.taxonomy)
  const layers = countBy(findings, (finding) => finding.likely_layer)
  const severities = countBy(findings, (finding) => finding.severity)
  const goals = countBy(
    conversation.turns.filter((turn) => turn.userGoal),
    (turn) => turn.userGoal,
  )

  return {
    conversationId: conversation.conversationId,
    replayConversationId: conversation.replayConversationId,
    evaluatedTurnCount: conversation.evaluatedTurnCount,
    findingCount: conversation.findingCount,
    failedTurnCount: conversation.failedTurnCount,
    categories,
    layers,
    severities,
    goals,
    findings,
  }
}

function buildSummary({ summary, diagnostic, processedReviews, processedWithoutFindings }) {
  const processedWithFindings = processedReviews.filter((entry) => entry.findingCount > 0)
  const findings = processedReviews.flatMap((entry) => entry.findings)

  return {
    runId: summary.runId,
    generatedAt: new Date().toISOString(),
    totalConversationsInRun: summary.totalConversations,
    totalProcessedConversations: processedReviews.length,
    processedWithFindings: processedWithFindings.length,
    processedWithoutFindings: processedWithoutFindings.length,
    totalEvaluatedTurns: summary.totalEvaluatedTurns,
    totalFindings: findings.length,
    failedTurns: summary.failedTurns,
    countsByCategory: countBy(findings, (finding) => finding.taxonomy),
    countsByLayer: countBy(findings, (finding) => finding.likely_layer),
    countsBySeverity: countBy(findings, (finding) => finding.severity),
    topConversationsByFindingCount: processedReviews
      .filter((entry) => entry.findingCount > 0)
      .sort(
        (left, right) =>
          right.findingCount - left.findingCount ||
          right.failedTurnCount - left.failedTurnCount ||
          right.evaluatedTurnCount - left.evaluatedTurnCount ||
          left.conversationId.localeCompare(right.conversationId),
      )
      .slice(0, 20)
      .map((entry) => ({
        conversationId: entry.conversationId,
        findingCount: entry.findingCount,
        failedTurnCount: entry.failedTurnCount,
        evaluatedTurnCount: entry.evaluatedTurnCount,
        topCategories: sortCountEntries(entry.categories).slice(0, 3),
      })),
    topConversationsByFailureCount: processedReviews
      .filter((entry) => entry.failedTurnCount > 0)
      .sort(
        (left, right) =>
          right.failedTurnCount - left.failedTurnCount ||
          right.findingCount - left.findingCount ||
          left.conversationId.localeCompare(right.conversationId),
      )
      .slice(0, 20)
      .map((entry) => ({
        conversationId: entry.conversationId,
        failedTurnCount: entry.failedTurnCount,
        findingCount: entry.findingCount,
        evaluatedTurnCount: entry.evaluatedTurnCount,
      })),
    topProblems: diagnostic.topProblems || [],
  }
}

function buildSummaryMarkdown(summaryReview) {
  const lines = [
    '# Processed Conversations Findings Summary',
    '',
    `Run ID: ${summaryReview.runId}`,
    `Generated at: ${summaryReview.generatedAt}`,
    '',
    '## Coverage',
    '',
    `- Total conversations in run: ${summaryReview.totalConversationsInRun}.`,
    `- Processed conversations: ${summaryReview.totalProcessedConversations}.`,
    `- Processed with findings: ${summaryReview.processedWithFindings}.`,
    `- Processed without findings: ${summaryReview.processedWithoutFindings}.`,
    `- Evaluated turns: ${summaryReview.totalEvaluatedTurns}.`,
    `- Failed turns: ${summaryReview.failedTurns}.`,
    `- Findings: ${summaryReview.totalFindings}.`,
    '',
    '## Categories',
    '',
    ...sortCountEntries(summaryReview.countsByCategory).map(
      (entry) => `- ${entry.key}: ${entry.count}`,
    ),
    '',
    '## Layers',
    '',
    ...sortCountEntries(summaryReview.countsByLayer).map(
      (entry) => `- ${entry.key}: ${entry.count}`,
    ),
    '',
    '## Top Conversations By Findings',
    '',
    ...summaryReview.topConversationsByFindingCount.map(
      (entry) =>
        `- ${entry.conversationId}: findings=${entry.findingCount}, failed=${entry.failedTurnCount}, turns=${entry.evaluatedTurnCount}, top=${entry.topCategories.map((item) => `${item.key}(${item.count})`).join(', ')}`,
    ),
    '',
    '## Top Conversations By Failed Turns',
    '',
    ...(summaryReview.topConversationsByFailureCount.length
      ? summaryReview.topConversationsByFailureCount.map(
          (entry) =>
            `- ${entry.conversationId}: failed=${entry.failedTurnCount}, findings=${entry.findingCount}, turns=${entry.evaluatedTurnCount}`,
        )
      : ['- No failed turns in processed conversations.']),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function buildConversationMarkdown(processedReviews, processedWithoutFindings) {
  const withFindings = processedReviews
    .filter((entry) => entry.findingCount > 0)
    .sort(
      (left, right) =>
        right.findingCount - left.findingCount ||
        right.failedTurnCount - left.failedTurnCount ||
        right.evaluatedTurnCount - left.evaluatedTurnCount ||
        left.conversationId.localeCompare(right.conversationId),
    )

  const lines = [
    '# Findings By Conversation',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Conversations With Findings',
    '',
  ]

  for (const conversation of withFindings) {
    lines.push(`## ${conversation.conversationId}`)
    lines.push('')
    lines.push(`- Evaluated turns: ${conversation.evaluatedTurnCount}`)
    lines.push(`- Findings: ${conversation.findingCount}`)
    lines.push(`- Failed turns: ${conversation.failedTurnCount}`)
    lines.push(
      `- Categories: ${sortCountEntries(conversation.categories)
        .map((entry) => `${entry.key}(${entry.count})`)
        .join(', ') || 'none'}`,
    )
    lines.push(
      `- Layers: ${sortCountEntries(conversation.layers)
        .map((entry) => `${entry.key}(${entry.count})`)
        .join(', ') || 'none'}`,
    )
    lines.push(
      `- User goals: ${sortCountEntries(conversation.goals)
        .map((entry) => `${entry.key}(${entry.count})`)
        .join(', ') || 'unknown'}`,
    )
    lines.push('')

    for (const finding of conversation.findings) {
      lines.push(`### ${finding.turn}`)
      lines.push('')
      lines.push(`- Severity: ${finding.severity}`)
      lines.push(`- Category: ${finding.taxonomy}`)
      lines.push(`- Likely layer: ${finding.likely_layer}`)
      lines.push(`- Symptom: ${finding.symptom}`)
      lines.push(`- Current response problem: ${finding.current_response_problem}`)
      lines.push(`- User goal: ${finding.user_goal}`)
      lines.push(`- User turn: ${compactText(finding.currentTurnText) || 'n/a'}`)
      lines.push(`- Agent response: ${compactText(finding.responseText) || 'n/a'}`)
      lines.push(`- Root cause hypothesis: ${finding.root_cause_hypothesis}`)
      lines.push(`- Global fix direction: ${finding.global_fix_direction}`)
      lines.push(`- Reject local patch reason: ${finding.reject_local_patch_reason}`)
      lines.push('')
    }
  }

  lines.push('## Processed Conversations Without Findings')
  lines.push('')
  for (const conversation of processedWithoutFindings) {
    lines.push(`- ${conversation.conversationId}: turns=${conversation.evaluatedTurnCount}`)
  }
  lines.push('')

  return `${lines.join('\n')}\n`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const runDir = await resolveReplayRunDir(options.runDir)
  const outputDir = path.join(runDir, 'reviews')
  await mkdir(outputDir, { recursive: true })

  const summary = await readJson(path.join(runDir, 'summary.json'))
  const diagnostic = await readJson(path.join(runDir, 'diagnostic.json'))
  const trace = await readJson(path.join(runDir, 'trace.json'))

  const processedReviews = (trace.conversations || [])
    .filter((conversation) => conversation.evaluatedTurnCount > 0)
    .map(buildConversationReview)

  const processedWithoutFindings = processedReviews
    .filter((entry) => entry.findingCount === 0)
    .sort(
      (left, right) =>
        right.evaluatedTurnCount - left.evaluatedTurnCount ||
        left.conversationId.localeCompare(right.conversationId),
    )
    .map((entry) => ({
      conversationId: entry.conversationId,
      evaluatedTurnCount: entry.evaluatedTurnCount,
    }))

  const summaryReview = buildSummary({
    summary,
    diagnostic,
    processedReviews,
    processedWithoutFindings,
  })

  const byConversation = {
    runId: summary.runId,
    generatedAt: new Date().toISOString(),
    processedConversations: processedReviews,
    processedWithoutFindings,
  }

  await writeFile(
    path.join(outputDir, 'processed-findings-summary.md'),
    buildSummaryMarkdown(summaryReview),
    'utf8',
  )
  await writeFile(
    path.join(outputDir, 'processed-findings-by-conversation.md'),
    buildConversationMarkdown(processedReviews, processedWithoutFindings),
    'utf8',
  )
  await writeFile(
    path.join(outputDir, 'processed-findings-summary.json'),
    `${JSON.stringify(summaryReview, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    path.join(outputDir, 'processed-findings-by-conversation.json'),
    `${JSON.stringify(byConversation, null, 2)}\n`,
    'utf8',
  )

  console.log(
    JSON.stringify(
      {
        runDir,
        outputDir,
        processedConversations: processedReviews.length,
        processedWithFindings: processedReviews.filter((entry) => entry.findingCount > 0).length,
        processedWithoutFindings: processedWithoutFindings.length,
        summaryJsonPath: path.join(outputDir, 'processed-findings-summary.json'),
        summaryMarkdownPath: path.join(outputDir, 'processed-findings-summary.md'),
        byConversationJsonPath: path.join(outputDir, 'processed-findings-by-conversation.json'),
        byConversationMarkdownPath: path.join(outputDir, 'processed-findings-by-conversation.md'),
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
