#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  appendJsonl,
  buildConversationSummariesFromTurnEntries,
  buildDiagnosticMarkdown,
  buildEvaluatedTurns,
  buildExecutiveSummary,
  buildReadableMarkdown,
  buildTraceMarkdown,
  detectTurnFindings,
  extractFactsFromUserText,
  getCustomerDisplayName,
  inferUserGoal,
  loadCorpusManifests,
  lookupReferenceBusinessTurns,
  readJsonIfExists,
  readJsonlIfExists,
  summarizeFindings,
  writeJson
} from "./replay-real-corpus-run.mjs";
import {
  DEFAULT_REAL_CORPUS_MANIFESTS_DIR,
  DEFAULT_REAL_CORPUS_RUNS_DIR,
  buildReplayTranscriptConversation,
  cleanMessageText,
  writeTranscriptFiles
} from "./real-corpus-artifacts-lib.mjs";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:4000/api";
const DEFAULT_TENANT_KEY = "urucortinas";
const DEFAULT_PAGE = "/shop";
const DEFAULT_LOCALE = "es-UY";
const DEFAULT_CURRENCY = "UYU";
const DEFAULT_SCOPE = "customer_public";
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_REPLY_TIMEOUT_MS = 35_000;
const DEFAULT_RETRY_ATTEMPTS = 6;
const DEFAULT_RETRY_INITIAL_DELAY_MS = 1_500;

function parseArgs(argv) {
  const options = {
    corpusDir: path.dirname(DEFAULT_REAL_CORPUS_MANIFESTS_DIR),
    outputRoot: DEFAULT_REAL_CORPUS_RUNS_DIR,
    backendBaseUrl: DEFAULT_BACKEND_BASE_URL,
    tenantKey: DEFAULT_TENANT_KEY,
    page: DEFAULT_PAGE,
    locale: DEFAULT_LOCALE,
    currency: DEFAULT_CURRENCY,
    scope: DEFAULT_SCOPE,
    limitConversations: null,
    limitTurns: null,
    includeReferenceReplies: true,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    replyTimeoutMs: DEFAULT_REPLY_TIMEOUT_MS,
    retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    retryInitialDelayMs: DEFAULT_RETRY_INITIAL_DELAY_MS,
    resumeRunDir: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--corpus-dir") {
      options.corpusDir = argv[index + 1] ?? options.corpusDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--corpus-dir=")) {
      options.corpusDir = arg.slice("--corpus-dir=".length);
      continue;
    }
    if (arg === "--output-root") {
      options.outputRoot = argv[index + 1] ?? options.outputRoot;
      index += 1;
      continue;
    }
    if (arg.startsWith("--output-root=")) {
      options.outputRoot = arg.slice("--output-root=".length);
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
    if (arg === "--poll-interval-ms") {
      const parsed = Number(argv[index + 1] ?? "");
      options.pollIntervalMs =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.pollIntervalMs;
      index += 1;
      continue;
    }
    if (arg.startsWith("--poll-interval-ms=")) {
      const parsed = Number(arg.slice("--poll-interval-ms=".length));
      options.pollIntervalMs =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.pollIntervalMs;
      continue;
    }
    if (arg === "--reply-timeout-ms") {
      const parsed = Number(argv[index + 1] ?? "");
      options.replyTimeoutMs =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.replyTimeoutMs;
      index += 1;
      continue;
    }
    if (arg.startsWith("--reply-timeout-ms=")) {
      const parsed = Number(arg.slice("--reply-timeout-ms=".length));
      options.replyTimeoutMs =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.replyTimeoutMs;
      continue;
    }
    if (arg === "--retry-attempts") {
      const parsed = Number(argv[index + 1] ?? "");
      options.retryAttempts =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : options.retryAttempts;
      index += 1;
      continue;
    }
    if (arg.startsWith("--retry-attempts=")) {
      const parsed = Number(arg.slice("--retry-attempts=".length));
      options.retryAttempts =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : options.retryAttempts;
      continue;
    }
    if (arg === "--retry-initial-delay-ms") {
      const parsed = Number(argv[index + 1] ?? "");
      options.retryInitialDelayMs =
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : options.retryInitialDelayMs;
      index += 1;
      continue;
    }
    if (arg.startsWith("--retry-initial-delay-ms=")) {
      const parsed = Number(arg.slice("--retry-initial-delay-ms=".length));
      options.retryInitialDelayMs =
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : options.retryInitialDelayMs;
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
    if (arg === "--no-reference-replies") {
      options.includeReferenceReplies = false;
      continue;
    }
    if (arg === "--resume-run-dir") {
      options.resumeRunDir = argv[index + 1] ?? options.resumeRunDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--resume-run-dir=")) {
      options.resumeRunDir = arg.slice("--resume-run-dir=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node tools/qa/replay-real-corpus-webchat-run.mjs [options]",
          "",
          "Options:",
          "  --corpus-dir <path>           Corpus root with manifests/ directory.",
          "  --output-root <path>          Base output directory. Default: .qa/runs.",
          "  --backend-base-url <url>      Backend API base URL. Default: http://127.0.0.1:4000/api.",
          "  --tenant-key <slug>           Tenant key used in replay. Default: urucortinas.",
          "  --page <path>                 Page metadata sent by storefront webchat. Default: /shop.",
          "  --scope <scope>               customer_public | customer_authenticated.",
          "  --poll-interval-ms <n>        Session polling cadence. Default: 500.",
          "  --reply-timeout-ms <n>        Max wait per turn for site reply. Default: 35000.",
          "  --retry-attempts <n>          Retry attempts for 429/5xx from the live chat.",
          "  --retry-initial-delay-ms <n>  Initial retry backoff. Default: 1500.",
          "  --limit-conversations <n>     Limit conversations for smoke runs.",
          "  --limit-turns <n>             Limit semantic turns per conversation for smoke runs.",
          "  --no-reference-replies        Omit original business turns from trace output.",
          "  --resume-run-dir <path>       Resume a partial run directory and skip completed conversations."
        ].join("\n")
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryWebchatError(error) {
  const message = String(error instanceof Error ? error.message : error || "");
  return /http_429|http_408|http_409|http_425|http_500|http_502|http_503|http_504/i.test(
    message
  );
}

async function withWebchatRetry(task, options, label) {
  const maxAttempts = Math.max(0, Number(options.retryAttempts || 0));
  let delayMs = Math.max(
    250,
    Number(options.retryInitialDelayMs || DEFAULT_RETRY_INITIAL_DELAY_MS)
  );

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetryWebchatError(error)) {
        throw error;
      }

      console.warn(
        `[webchat-replay] retry ${attempt + 1}/${maxAttempts} after ${label}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await delay(delayMs);
      delayMs = Math.min(delayMs * 2, 20_000);
    }
  }
}

async function parseResponse(response) {
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;
  if (!response.ok) {
    throw new Error(payload?.message || `http_${response.status}`);
  }
  return payload;
}

function buildWebchatGuestId(executionToken, manifestIndex) {
  return `qa-real-webchat-${executionToken}-${String(manifestIndex + 1).padStart(4, "0")}`;
}

function toWebchatAttachment(attachment) {
  return {
    assetType: typeof attachment?.assetType === "string" ? attachment.assetType : undefined,
    fileName: typeof attachment?.fileName === "string" ? attachment.fileName : undefined,
    textContent:
      typeof attachment?.textContent === "string" ? cleanMessageText(attachment.textContent) : undefined,
    metadata:
      attachment?.metadata && typeof attachment.metadata === "object"
        ? attachment.metadata
        : undefined
  };
}

async function createWebchatSession({ backendBaseUrl, tenantKey, guestId, displayName, email, page, locale }) {
  const response = await fetch(`${backendBaseUrl.replace(/\/$/, "")}/conversations/webchat/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      tenantKey,
      guestId,
      name: displayName,
      email,
      locale,
      page,
      authenticated: false
    })
  });

  return parseResponse(response);
}

async function getWebchatSession({ backendBaseUrl, conversationId, guestId }) {
  const base = backendBaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/conversations/webchat/session/${conversationId}`);
  if (guestId) {
    url.searchParams.set("guestId", guestId);
  }
  const response = await fetch(url, {
    method: "GET"
  });
  return parseResponse(response);
}

async function dispatchWebchatMessage({
  backendBaseUrl,
  tenantKey,
  conversationId,
  guestId,
  scope,
  text,
  locale,
  currency,
  page,
  attachments
}) {
  const response = await fetch(`${backendBaseUrl.replace(/\/$/, "")}/conversations/webchat/dispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      tenantKey,
      conversationId,
      guestId,
      userId: guestId,
      scope,
      text,
      locale,
      currency,
      attachments,
      metadata: {
        page
      }
    })
  });

  return parseResponse(response);
}

function collectAgentReply(messages, baselineCount) {
  const newMessages = (Array.isArray(messages) ? messages : []).slice(baselineCount);
  if (!newMessages.length) {
    return null;
  }

  const customerIndex = newMessages.findLastIndex((message) => message?.role === "customer");
  if (customerIndex < 0) {
    return null;
  }

  const agentMessages = [];
  for (let index = customerIndex + 1; index < newMessages.length; index += 1) {
    const message = newMessages[index];
    if (message?.role !== "agent") {
      if (agentMessages.length > 0) {
        break;
      }
      continue;
    }
    agentMessages.push(message);
  }

  if (!agentMessages.length) {
    return null;
  }

  return {
    customerMessage: newMessages[customerIndex] || null,
    agentMessages,
    text: agentMessages
      .map((message) => cleanMessageText(message?.text || ""))
      .filter(Boolean)
      .join("\n")
      .trim()
  };
}

async function waitForAgentReply({
  backendBaseUrl,
  conversationId,
  guestId,
  baselineCount,
  pollIntervalMs,
  replyTimeoutMs,
  options
}) {
  const startedAt = Date.now();
  let polls = 0;

  while (Date.now() - startedAt <= replyTimeoutMs) {
    const session = await withWebchatRetry(
      () =>
        getWebchatSession({
          backendBaseUrl,
          conversationId,
          guestId
        }),
      options,
      `poll-session:${conversationId}`
    );
    polls += 1;

    const reply = collectAgentReply(session.messages, baselineCount);
    if (reply && reply.text) {
      return {
        session,
        reply,
        polls,
        waitedMs: Date.now() - startedAt
      };
    }

    await delay(pollIntervalMs);
  }

  throw new Error(`webchat_reply_timeout:${replyTimeoutMs}ms`);
}

function buildWebchatResponseSummary({ replyText, session }) {
  const audit = session?.aiState?.audit && typeof session.aiState.audit === "object"
    ? session.aiState.audit
    : null;
  const aiState = session?.aiState && typeof session.aiState === "object"
    ? session.aiState
    : null;

  return {
    finalUserText: replyText || null,
    text: replyText || null,
    provider:
      typeof aiState?.provider === "string"
        ? aiState.provider
        : typeof audit?.provider === "string"
          ? audit.provider
          : null,
    model:
      typeof aiState?.model === "string"
        ? aiState.model
        : typeof audit?.model === "string"
          ? audit.model
          : null,
    needsHuman: session?.needsHuman === true,
    debugSummary:
      typeof audit?.detail === "string" && audit.detail.trim() ? audit.detail.trim() : null,
    toolCalls: [],
    grounding: null,
    auditPayload: audit
  };
}

async function replayConversationViaWebchat({
  manifest,
  manifestIndex,
  runId,
  executionToken,
  options,
  runDir,
  status
}) {
  const evaluatedTurns = buildEvaluatedTurns(manifest).slice(
    0,
    options.limitTurns == null ? Number.POSITIVE_INFINITY : options.limitTurns
  );
  const guestId = buildWebchatGuestId(executionToken, manifestIndex);
  const displayName = getCustomerDisplayName(manifest);
  const email = `${guestId}@qa-real-corpus.local`;
  const session = await withWebchatRetry(
    () =>
      createWebchatSession({
        backendBaseUrl: options.backendBaseUrl,
        tenantKey: options.tenantKey,
        guestId,
        displayName,
        email,
        page: options.page,
        locale: options.locale
      }),
    options,
    `create-session:${manifest.conversationId}`
  );

  const turnEntries = [];
  const conversationState = {
    previousResponseText: "",
    facts: {}
  };

  for (let turnIndex = 0; turnIndex < evaluatedTurns.length; turnIndex += 1) {
    const semanticTurn = evaluatedTurns[turnIndex];
    const factsBefore = {
      ...conversationState.facts
    };
    const currentFacts = extractFactsFromUserText(semanticTurn.text, {});
    const factsAfter = extractFactsFromUserText(semanticTurn.text, factsBefore);
    const nextSemanticTurn = evaluatedTurns[turnIndex + 1] || null;
    const referenceBusinessTurns = options.includeReferenceReplies
      ? lookupReferenceBusinessTurns(manifest, semanticTurn, nextSemanticTurn)
      : [];

    const startedAt = new Date().toISOString();
    const turnStartedMs = Date.now();
    let responseSummary = null;
    let responseText = "";
    let error = null;
    let dispatch = null;
    let responseSession = null;
    let responseMessages = [];
    let baselineCount = 0;

    try {
      const sessionBefore = await withWebchatRetry(
        () =>
          getWebchatSession({
            backendBaseUrl: options.backendBaseUrl,
            conversationId: session.conversationId,
            guestId
          }),
        options,
        `get-session-before:${semanticTurn.id}`
      );
      baselineCount = Array.isArray(sessionBefore.messages) ? sessionBefore.messages.length : 0;

      dispatch = await withWebchatRetry(
        () =>
          dispatchWebchatMessage({
            backendBaseUrl: options.backendBaseUrl,
            tenantKey: options.tenantKey,
            conversationId: session.conversationId,
            guestId,
            scope: options.scope,
            text: semanticTurn.text,
            locale: options.locale,
            currency: options.currency,
            page: options.page,
            attachments: semanticTurn.attachments.map(toWebchatAttachment)
          }),
        options,
        `dispatch:${semanticTurn.id}`
      );

      const replyResult = await waitForAgentReply({
        backendBaseUrl: options.backendBaseUrl,
        conversationId: session.conversationId,
        guestId,
        baselineCount,
        pollIntervalMs: options.pollIntervalMs,
        replyTimeoutMs: options.replyTimeoutMs,
        options
      });

      responseSession = replyResult.session;
      responseMessages = replyResult.reply.agentMessages;
      responseText = replyResult.reply.text;
      responseSummary = buildWebchatResponseSummary({
        replyText: responseText,
        session: responseSession
      });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error(String(caught));
    }

    const durationMs = Date.now() - turnStartedMs;

    const turnEntry = {
      conversationId: manifest.conversationId,
      replayConversationId: session.conversationId,
      replayChannel: "webchat",
      replayUserId: guestId,
      replayThreadId: session.conversationId,
      semanticTurnId: semanticTurn.id,
      semanticTurnIndex: turnIndex + 1,
      startedAt,
      durationMs,
      user: {
        text: semanticTurn.text,
        rawInputCount: semanticTurn.rawInputCount,
        rawTurnIndexes: semanticTurn.rawTurnIndexes,
        timestamps: semanticTurn.timestamps,
        sourceTurns: semanticTurn.sourceTurns
      },
      ingestedInbound: [
        {
          conversationId: session.conversationId,
          guestId,
          baselineMessageCount: baselineCount,
          dispatchStatus: dispatch?.status ?? null,
          queued: dispatch?.queued === true
        }
      ],
      response: responseSummary,
      responseText,
      error: error
        ? {
            message: error.message,
            stack: error.stack || null
          }
        : null,
      turnFacts: {
        before: factsBefore,
        current: currentFacts,
        after: factsAfter
      },
      userGoal: "unknown",
      findings: [],
      referenceBusinessTurns,
      webchat: {
        sessionId: session.conversationId,
        guestId,
        dispatch,
        needsHuman: responseSession?.needsHuman === true,
        controlMode: responseSession?.controlMode ?? null,
        aiState: responseSession?.aiState ?? null,
        responseMessageIds: responseMessages.map((message) => message?.id).filter(Boolean)
      }
    };

    turnEntry.userGoal = inferUserGoal(turnEntry, factsAfter);
    turnEntry.findings = detectTurnFindings(turnEntry, {
      previousResponseText: conversationState.previousResponseText,
      factsBefore
    });

    if (responseText) {
      conversationState.previousResponseText = responseText;
    }
    conversationState.facts = factsAfter;
    turnEntries.push(turnEntry);
    status.completedTurns += 1;
    status.findings += turnEntry.findings.length;
    if (turnEntry.error) {
      status.failedTurns += 1;
    }
    await appendJsonl(path.join(runDir, "turns.jsonl"), turnEntry);
  }

  const conversationEntry = {
    conversationId: manifest.conversationId,
    replayConversationId: session.conversationId,
    customerDisplayName: displayName,
    sourceZip: manifest?.source?.zipName || null,
    evaluatedTurnCount: turnEntries.length,
    findingCount: turnEntries.reduce((total, turn) => total + turn.findings.length, 0),
    failedTurnCount: turnEntries.filter((turn) => turn.error).length,
    turns: turnEntries
  };

  await appendJsonl(path.join(runDir, "conversations.jsonl"), {
    conversationId: conversationEntry.conversationId,
    replayConversationId: conversationEntry.replayConversationId,
    evaluatedTurnCount: conversationEntry.evaluatedTurnCount,
    findingCount: conversationEntry.findingCount,
    failedTurnCount: conversationEntry.failedTurnCount
  });
  status.completedConversations += 1;
  return conversationEntry;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifests = await loadCorpusManifests(options.corpusDir, options.limitConversations);
  const manifestsById = new Map(manifests.map((manifest) => [manifest.conversationId, manifest]));
  let generatedAt = new Date().toISOString();
  const executionToken = Date.now().toString().slice(-10);
  let runId = `real-corpus-webchat-replay-${generatedAt.replace(/[:.]/g, "-")}`;
  let runDir = path.join(options.outputRoot, runId);
  let status = {
    runId,
    generatedAt,
    totalConversations: manifests.length,
    completedConversations: 0,
    completedTurns: 0,
    failedTurns: 0,
    findings: 0
  };

  if (options.resumeRunDir) {
    runDir = path.resolve(options.resumeRunDir);
    const existingRun = await readJsonIfExists(path.join(runDir, "run.json"));
    const existingStatus = await readJsonIfExists(path.join(runDir, "status.json"));
    if (!existingRun) {
      throw new Error(`resume_run_missing:${runDir}`);
    }
    runId = existingRun.runId || path.basename(runDir);
    generatedAt = existingRun.generatedAt || generatedAt;
    status = existingStatus || status;
  } else {
    await mkdir(runDir, { recursive: true });
    await writeJson(path.join(runDir, "run.json"), {
      runId,
      generatedAt,
      mode: "webchat_site",
      options,
      corpusConversationCount: manifests.length
    });
    await writeJson(path.join(runDir, "status.json"), status);
    await writeFile(path.join(runDir, "turns.jsonl"), "", "utf8");
    await writeFile(path.join(runDir, "conversations.jsonl"), "", "utf8");
  }

  const completedConversationEntries = await readJsonlIfExists(path.join(runDir, "conversations.jsonl"));
  const completedConversationIds = new Set(
    completedConversationEntries.map((entry) => entry.conversationId)
  );

  for (let manifestIndex = 0; manifestIndex < manifests.length; manifestIndex += 1) {
    const manifest = manifests[manifestIndex];
    if (completedConversationIds.has(manifest.conversationId)) {
      continue;
    }
    const conversation = await replayConversationViaWebchat({
      manifest,
      manifestIndex,
      runId,
      executionToken,
      options,
      runDir,
      status
    });
    await writeJson(path.join(runDir, "status.json"), status);
    console.log(
      [
        `conversation=${manifestIndex + 1}/${manifests.length}`,
        `id=${manifest.conversationId}`,
        `turns=${conversation.evaluatedTurnCount}`,
        `findings=${conversation.findingCount}`,
        `failed=${conversation.failedTurnCount}`
      ].join(" ")
    );
  }

  const turnEntries = await readJsonlIfExists(path.join(runDir, "turns.jsonl"));
  const conversations = buildConversationSummariesFromTurnEntries(turnEntries, manifestsById);
  const findingsSummary = summarizeFindings(conversations);
  const summary = buildExecutiveSummary({
    runId,
    options: {
      ...options,
      aiAgentBaseUrl: null
    },
    conversations,
    findingsSummary,
    status
  });
  const traceJson = {
    runId,
    generatedAt,
    options,
    summary,
    conversations
  };
  const diagnosticJson = {
    runId,
    generatedAt,
    summary,
    topProblems: findingsSummary.topProblems,
    countsByCategory: findingsSummary.countsByCategory,
    countsByLayer: findingsSummary.countsByLayer,
    countsBySeverity: findingsSummary.countsBySeverity,
    findings: findingsSummary.findings,
    risksOfLocalPatching: findingsSummary.risksOfLocalPatching,
    nextIteration: findingsSummary.nextIteration
  };

  await writeJson(path.join(runDir, "trace.json"), traceJson);
  await writeFile(
    path.join(runDir, "trace.md"),
    buildTraceMarkdown({ runId, conversations, summary }),
    "utf8"
  );
  await writeFile(
    path.join(runDir, "readable.md"),
    buildReadableMarkdown({ runId, conversations, summary }),
    "utf8"
  );
  await writeJson(path.join(runDir, "diagnostic.json"), diagnosticJson);
  await writeFile(
    path.join(runDir, "diagnostic.md"),
    buildDiagnosticMarkdown({ runId, summary, findingsSummary }),
    "utf8"
  );
  await writeJson(path.join(runDir, "summary.json"), summary);

  const replayTranscriptExport = await writeTranscriptFiles(
    conversations.map((conversation) =>
      buildReplayTranscriptConversation(conversation, {
        customerLabel: "Cliente",
        agentLabel: "Chat"
      })
    ),
    {
      outputDir: path.join(runDir, "plain-replayed-transcripts"),
      combinedFileName: "all-conversations-client-chat.txt"
    }
  );
  await writeJson(
    path.join(runDir, "plain-replayed-transcripts", "export-stats.json"),
    replayTranscriptExport.stats
  );

  await writeJson(path.join(options.outputRoot, "latest-real-corpus-webchat-replay.json"), {
    runId,
    runDir,
    generatedAt,
    summaryPath: path.join(runDir, "summary.json"),
    traceJsonPath: path.join(runDir, "trace.json"),
    traceMarkdownPath: path.join(runDir, "trace.md"),
    readableMarkdownPath: path.join(runDir, "readable.md"),
    diagnosticJsonPath: path.join(runDir, "diagnostic.json"),
    diagnosticMarkdownPath: path.join(runDir, "diagnostic.md"),
    statusPath: path.join(runDir, "status.json"),
    turnsJsonlPath: path.join(runDir, "turns.jsonl"),
    replayedTranscriptPath: replayTranscriptExport.combinedPath
  });

  console.log(`run_id=${runId}`);
  console.log(`run_dir=${runDir}`);
  console.log(`trace_json=${path.join(runDir, "trace.json")}`);
  console.log(`diagnostic_json=${path.join(runDir, "diagnostic.json")}`);
  console.log(`replayed_transcripts=${replayTranscriptExport.combinedPath}`);
}

export {
  buildWebchatGuestId,
  buildWebchatResponseSummary,
  collectAgentReply,
  createWebchatSession,
  dispatchWebchatMessage,
  getWebchatSession,
  parseArgs,
  parseResponse,
  replayConversationViaWebchat,
  waitForAgentReply,
  withWebchatRetry
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
