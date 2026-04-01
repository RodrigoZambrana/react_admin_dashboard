#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { estimatePendingUtteranceDelay } from "../../services/channel-adapter/src/runtime/pending-utterance-assembler.js";
import { isSystemNoiseMessage } from "../../services/ai-agent-service/src/ai/ingress/system-noise.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const DEFAULT_CORPUS_DIR = path.join(
  repoRoot,
  ".qa",
  "external-real-conversations",
  "whatsapp"
);
const DEFAULT_PLAYBOOK_PATH = path.join(
  os.homedir(),
  "Downloads",
  "knowledge-inputs",
  "customer-response-playbook.md"
);
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, ".qa", "runs");
const DEFAULT_BASELINE_HEAD = "3f65677cea6902e7f2c8fdc34039da1555111de4";
const DEFAULT_BASELINE_ROOT = path.join(repoRoot, ".tmp", "baseline-3f65677");
const QUOTE_FIELD_KEYS = new Set([
  "measurements",
  "measurement_items",
  "quantity",
  "series",
  "glass",
  "color",
  "material"
]);

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stopwords = new Set([
  "a",
  "al",
  "algo",
  "ante",
  "con",
  "como",
  "cuál",
  "cuáles",
  "de",
  "del",
  "el",
  "ella",
  "en",
  "es",
  "esta",
  "este",
  "esto",
  "hola",
  "la",
  "las",
  "le",
  "lo",
  "los",
  "me",
  "mi",
  "mis",
  "necesito",
  "o",
  "para",
  "pero",
  "por",
  "que",
  "qué",
  "se",
  "si",
  "sí",
  "su",
  "sus",
  "te",
  "tu",
  "tus",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
  "yo"
]);

const naturalityPenaltyWeights = {
  empty_response: 0.55,
  repeated_reply: 0.2,
  looping_reply: 0.18,
  generic_short_reply: 0.12,
  no_progression: 0.18,
  weak_context_link: 0.12
};

function parseArgs(argv) {
  const options = {
    currentRoot: repoRoot,
    currentMode: "semantic",
    baselineRoot: DEFAULT_BASELINE_ROOT,
    baselineMode: "raw",
    baselineHead: DEFAULT_BASELINE_HEAD,
    corpusDir: DEFAULT_CORPUS_DIR,
    playbookPath: DEFAULT_PLAYBOOK_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    includeBaseline: true,
    limit: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--current-root") {
      options.currentRoot = argv[index + 1] ?? options.currentRoot;
      index += 1;
      continue;
    }
    if (arg.startsWith("--current-root=")) {
      options.currentRoot = arg.slice("--current-root=".length);
      continue;
    }
    if (arg === "--current-mode") {
      options.currentMode = argv[index + 1] ?? options.currentMode;
      index += 1;
      continue;
    }
    if (arg.startsWith("--current-mode=")) {
      options.currentMode = arg.slice("--current-mode=".length);
      continue;
    }
    if (arg === "--baseline-root") {
      options.baselineRoot = argv[index + 1] ?? options.baselineRoot;
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline-root=")) {
      options.baselineRoot = arg.slice("--baseline-root=".length);
      continue;
    }
    if (arg === "--baseline-mode") {
      options.baselineMode = argv[index + 1] ?? options.baselineMode;
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline-mode=")) {
      options.baselineMode = arg.slice("--baseline-mode=".length);
      continue;
    }
    if (arg === "--baseline-head") {
      options.baselineHead = argv[index + 1] ?? options.baselineHead;
      index += 1;
      continue;
    }
    if (arg.startsWith("--baseline-head=")) {
      options.baselineHead = arg.slice("--baseline-head=".length);
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
    if (arg === "--playbook-path") {
      options.playbookPath = argv[index + 1] ?? options.playbookPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--playbook-path=")) {
      options.playbookPath = arg.slice("--playbook-path=".length);
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
    if (arg === "--limit") {
      const value = Number(argv[index + 1] ?? "");
      options.limit = Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      options.limit = Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
      continue;
    }
    if (arg === "--current-only") {
      options.includeBaseline = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node tools/qa/evaluate-conversational-closure-corpus.mjs [options]",
          "",
          "Options:",
          "  --current-root <path>    Repo root to evaluate as current.",
          "  --current-mode <mode>    Evaluated turn mode for current: raw|semantic.",
          "  --baseline-root <path>   Repo root for the frozen baseline.",
          "  --baseline-mode <mode>   Evaluated turn mode for the baseline: raw|semantic.",
          "  --baseline-head <sha>    Frozen baseline commit head for metadata.",
          "  --corpus-dir <path>      Corpus root with manifests/ directory.",
          "  --playbook-path <path>   Playbook markdown used by the simulation runtime.",
          "  --output-dir <path>      Output directory for json/md reports.",
          "  --limit <n>              Limit manifests for faster smoke runs.",
          "  --current-only           Skip baseline evaluation and only run current."
        ].join("\n")
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["raw", "semantic"].includes(options.currentMode)) {
    throw new Error(`invalid_current_mode:${options.currentMode}`);
  }
  if (!["raw", "semantic"].includes(options.baselineMode)) {
    throw new Error(`invalid_baseline_mode:${options.baselineMode}`);
  }

  return options;
}

async function loadCorpusManifests(corpusDir, limit = null) {
  const manifestsDir = path.join(corpusDir, "manifests");
  const entries = await readdir(manifestsDir);
  const manifestNames = entries
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .slice(0, limit == null ? entries.length : limit);

  const manifests = [];
  for (const name of manifestNames) {
    const filePath = path.join(manifestsDir, name);
    const raw = await readFile(filePath, "utf8");
    manifests.push(JSON.parse(raw));
  }
  return manifests;
}

function toAttachmentKind(value) {
  switch (String(value || "").toLowerCase()) {
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "pdf":
    case "document":
    case "sheet":
      return "document";
    default:
      return "document";
  }
}

function isDeletedTurn(turn) {
  return normalizeText(turn?.text) === "se elimino este mensaje.";
}

function buildTurnAttachments(turn) {
  const refs = Array.isArray(turn?.attachmentRefs) ? turn.attachmentRefs : [];
  return refs.map((ref, index) => ({
    id: `${turn.index || "turn"}-attachment-${index + 1}`,
    kind: toAttachmentKind(ref?.type),
    fileName: typeof ref?.name === "string" ? ref.name : null
  }));
}

function buildTurnText(turn) {
  const rawText = compactText(turn?.text || "");
  const normalized = normalizeText(rawText);
  if (!rawText || isDeletedTurn(turn)) {
    return "";
  }
  if (isSystemNoiseMessage(rawText)) {
    return "";
  }
  if (
    normalized === "multimedia omitido" &&
    Array.isArray(turn?.attachmentRefs) &&
    turn.attachmentRefs.length > 0
  ) {
    return "";
  }
  return rawText;
}

function isEvaluableCustomerTurn(turn) {
  return (
    turn?.kind === "message" &&
    turn?.authorRole === "customer" &&
    (!isDeletedTurn(turn) || buildTurnAttachments(turn).length > 0) &&
    (buildTurnText(turn).length > 0 || buildTurnAttachments(turn).length > 0)
  );
}

function buildAssemblerItems(turns) {
  return turns.map((turn) => {
    const text = buildTurnText(turn);
    const attachments = buildTurnAttachments(turn);
    return {
      text,
      attachments,
      normalized: {
        text,
        attachments
      }
    };
  });
}

function canMergeSemanticTurn(currentTurns, candidateTurn) {
  if (!currentTurns.length) {
    return false;
  }

  const previousTurn = currentTurns.at(-1);
  if (!previousTurn?.timestamp || !candidateTurn?.timestamp) {
    return false;
  }

  const previousTimestampMs = Date.parse(previousTurn.timestamp);
  const candidateTimestampMs = Date.parse(candidateTurn.timestamp);
  if (!Number.isFinite(previousTimestampMs) || !Number.isFinite(candidateTimestampMs)) {
    return false;
  }

  const diffMs = candidateTimestampMs - previousTimestampMs;
  if (diffMs < 0 || diffMs > 60_000) {
    return false;
  }

  if (candidateTurn.rawTimestamp === previousTurn.rawTimestamp) {
    return true;
  }

  const pendingDelay = estimatePendingUtteranceDelay({
    items: buildAssemblerItems(currentTurns),
    defaultDelayMs: 900
  });
  return pendingDelay > 900;
}

function finalizeTurnGroup(conversationId, mode, sequence, turns) {
  const attachments = turns.flatMap((turn) => buildTurnAttachments(turn));
  const textParts = turns
    .map((turn) => buildTurnText(turn))
    .filter(Boolean);
  const text = textParts.join("\n").trim();

  return {
    id: `${conversationId}:${mode}-turn-${sequence}`,
    mode,
    text,
    attachments,
    rawInputCount: turns.length,
    rawTurnIndexes: turns.map((turn) => turn.index),
    timestamps: turns.map((turn) => turn.timestamp).filter(Boolean),
    sourceTurns: turns.map((turn) => ({
      index: turn.index,
      timestamp: turn.timestamp || null,
      text: buildTurnText(turn),
      attachmentCount: buildTurnAttachments(turn).length
    }))
  };
}

function buildEvaluatedTurns(manifest, mode) {
  const turns = Array.isArray(manifest?.turns) ? manifest.turns : [];
  const evaluableCustomerTurns = turns.filter(isEvaluableCustomerTurn);

  if (mode === "raw") {
    return evaluableCustomerTurns.map((turn, index) =>
      finalizeTurnGroup(manifest.conversationId, mode, index + 1, [turn])
    );
  }

  const groups = [];
  let current = [];

  for (const turn of turns) {
    if (turn?.kind === "message" && turn?.authorRole !== "customer") {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      continue;
    }

    if (!isEvaluableCustomerTurn(turn)) {
      continue;
    }

    if (!current.length) {
      current.push(turn);
      continue;
    }

    if (canMergeSemanticTurn(current, turn)) {
      current.push(turn);
      continue;
    }

    groups.push(current);
    current = [turn];
  }

  if (current.length) {
    groups.push(current);
  }

  return groups.map((group, index) =>
    finalizeTurnGroup(manifest.conversationId, mode, index + 1, group)
  );
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !stopwords.has(entry));
}

function tokenJaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) {
    return 1;
  }
  const intersection = Array.from(leftSet).filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreExternalNaturality({
  responseText,
  currentUserText,
  previousAssistantText
}) {
  const normalizedResponse = normalizeText(responseText);
  const normalizedPreviousAssistant = normalizeText(previousAssistantText);
  const responseTokens = tokenize(responseText);
  const userTokens = tokenize(currentUserText);
  const previousAssistantTokens = tokenize(previousAssistantText);
  const penalties = [];

  if (!normalizedResponse) {
    penalties.push("empty_response");
  }

  if (normalizedResponse && normalizedResponse === normalizedPreviousAssistant) {
    penalties.push("repeated_reply");
  }

  if (
    normalizedResponse &&
    normalizedPreviousAssistant &&
    tokenJaccard(responseTokens, previousAssistantTokens) >= 0.78
  ) {
    penalties.push("looping_reply");
  }

  if (normalizedResponse && normalizedResponse.length <= 20 && responseTokens.length <= 3) {
    penalties.push("generic_short_reply");
  }

  const responseNovelTokens = responseTokens.filter(
    (token) => !previousAssistantTokens.includes(token)
  );
  if (
    normalizedResponse &&
    previousAssistantTokens.length > 0 &&
    responseNovelTokens.length <= 2
  ) {
    penalties.push("no_progression");
  }

  const userOverlap = userTokens.filter((token) => responseTokens.includes(token)).length;
  if (userTokens.length >= 2 && normalizedResponse && userOverlap === 0) {
    penalties.push("weak_context_link");
  }

  const uniquePenalties = Array.from(new Set(penalties));
  const totalPenalty = uniquePenalties.reduce(
    (sum, penalty) => sum + (naturalityPenaltyWeights[penalty] ?? 0),
    0
  );
  const score = Math.max(0, Number((1 - totalPenalty).toFixed(4)));
  return {
    score,
    penalties: uniquePenalties
  };
}

function detectDirectPrice(text) {
  return /(?:\b(?:usd|uyu)\b|\$\s*\d|\d+(?:[.,]\d{2})\s*(?:usd|uyu))/iu.test(
    String(text || "")
  );
}

function getResolutionReadiness(response) {
  return (
    response?.auditPayload?.turnInterpretation?.conversationContext?.resolutionReadiness ||
    response?.audit?.turnInterpretation?.conversationContext?.resolutionReadiness ||
    null
  );
}

function getAuditValue(response, key) {
  if (
    response?.auditPayload &&
    Object.prototype.hasOwnProperty.call(response.auditPayload, key)
  ) {
    return response.auditPayload[key];
  }
  if (response?.audit && Object.prototype.hasOwnProperty.call(response.audit, key)) {
    return response.audit[key];
  }
  return null;
}

function safeRate(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(6));
}

function buildMetricValue(entries, projector) {
  const values = entries
    .map(projector)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!values.length) {
    return null;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6));
}

async function loadSimulationModule(targetRoot) {
  const moduleUrl = pathToFileURL(
    path.join(targetRoot, "tools", "qa", "generate-simulated-runtime-conversations.mjs")
  ).href;
  return import(moduleUrl);
}

async function evaluateTarget({
  label,
  targetRoot,
  mode,
  manifests,
  playbookContent
}) {
  const simulationModule = await loadSimulationModule(targetRoot);
  if (typeof simulationModule.createSimulationRuntime !== "function") {
    throw new Error(`simulation_runtime_missing:${label}`);
  }

  const { runtime, providerCalls } = await simulationModule.createSimulationRuntime({
    playbookContent,
    rewriteEnabled: true
  });

  const turnResults = [];
  let previousAssistantText = "";
  let rawCustomerTurns = 0;
  let burstTurnCount = 0;

  for (const manifest of manifests) {
    const evaluatedTurns = buildEvaluatedTurns(manifest, mode);
    rawCustomerTurns += manifest.turns.filter(isEvaluableCustomerTurn).length;
    burstTurnCount += evaluatedTurns.filter((turn) => turn.rawInputCount > 1).length;
    previousAssistantText = "";

    for (const turn of evaluatedTurns) {
      const providerCallsBefore = providerCalls.length;
      const response = await runtime.respond({
        conversationId: `${label}:${manifest.conversationId}`,
        scope: "customer_public",
        tenantKey: "urucortinas",
        text: turn.text,
        attachments: turn.attachments,
        metadata: {
          semanticTurnId: turn.id
        }
      });
      const providerCallsAfter = providerCalls.length;

      const responseText = compactText(response?.finalUserText || response?.text || "");
      const readiness = getResolutionReadiness(response);
      const missingFields = Array.isArray(readiness?.missingFields)
        ? readiness.missingFields.filter((entry) => typeof entry === "string")
        : [];
      const readinessLane =
        typeof readiness?.lane === "string" ? readiness.lane : null;
      const effectiveAnswerModeRaw = getAuditValue(response, "effectiveAnswerMode");
      const answerMode =
        typeof effectiveAnswerModeRaw === "string"
          ? effectiveAnswerModeRaw
          : typeof readiness?.answerMode === "string"
            ? readiness.answerMode
            : null;
      const knowledgeGrounded =
        getAuditValue(response, "knowledgeGrounded") === true ||
        response?.grounding?.grounded === true;
      const knowledgeRetrieved =
        getAuditValue(response, "knowledgeRetrieved") === true ||
        (Array.isArray(response?.sources) && response.sources.length > 0);
      const runtimeNaturalityScoreRaw = getAuditValue(response, "naturalityScore");
      const runtimeNaturalityScore =
        typeof runtimeNaturalityScoreRaw === "number" && Number.isFinite(runtimeNaturalityScoreRaw)
          ? runtimeNaturalityScoreRaw
          : null;
      const externalNaturality = scoreExternalNaturality({
        responseText,
        currentUserText: turn.text,
        previousAssistantText
      });
      const providerCallCount = providerCallsAfter - providerCallsBefore;
      const decisionSourceRaw = getAuditValue(response, "decisionSource");
      const decisionSource =
        typeof decisionSourceRaw === "string"
          ? decisionSourceRaw
          : typeof response?.auditPayload?.decisionTrace?.conversation?.decisionSource === "string"
            ? response.auditPayload.decisionTrace.conversation.decisionSource
            : null;
      const waitForMore =
        getAuditValue(response, "waitForMore") === true || readiness?.waitForMore === true;
      const quoteLikeTurn =
        readinessLane === "quote" ||
        missingFields.some((field) => QUOTE_FIELD_KEYS.has(field)) ||
        ["ask_quote_field", "inform_then_guide_quote", "guide_quote_exploration"].includes(
          answerMode || ""
        );
      const prematureQuote =
        quoteLikeTurn &&
        missingFields.length > 0 &&
        (detectDirectPrice(responseText) || answerMode === "execute_flow");
      const groundedInfoFirstViolation =
        quoteLikeTurn &&
        knowledgeGrounded &&
        missingFields.length > 0 &&
        answerMode !== "inform_then_guide_quote";

      turnResults.push({
        target: label,
        repoRoot: targetRoot,
        mode,
        conversationId: manifest.conversationId,
        semanticTurnId: turn.id,
        rawInputCount: turn.rawInputCount,
        rawTurnIndexes: turn.rawTurnIndexes,
        providerCallCount,
        responseText,
        responseTextLength: responseText.length,
        waitForMore,
        readinessLane,
        missingFields,
        answerMode,
        quoteLikeTurn,
        knowledgeRetrieved,
        knowledgeGrounded,
        retrievedOnly: knowledgeRetrieved && !knowledgeGrounded,
        prematureQuote,
        groundedInfoFirstViolation,
        decisionSource,
        responseMode:
          typeof getAuditValue(response, "responseMode") === "string"
            ? getAuditValue(response, "responseMode")
            : null,
        runtimeNaturalityScore,
        externalNaturalityScore: externalNaturality.score,
        externalNaturalityPenalties: externalNaturality.penalties
      });

      previousAssistantText = responseText;
    }
  }

  const turnsWithIncompleteQuote = turnResults.filter(
    (entry) => entry.quoteLikeTurn && entry.missingFields.length > 0
  );
  const turnsWithRuntimeNaturality = turnResults.filter(
    (entry) => typeof entry.runtimeNaturalityScore === "number"
  );
  const runtimeNaturalityScale =
    turnsWithRuntimeNaturality.some((entry) => entry.runtimeNaturalityScore > 1) ? 100 : 1;

  const summary = {
    label,
    repoRoot: targetRoot,
    mode,
    totalConversations: manifests.length,
    rawCustomerTurns,
    evaluatedTurns: turnResults.length,
    semanticBurstTurns: burstTurnCount,
    responsePerRawCustomerTurn: Number(
      safeRate(turnResults.length, rawCustomerTurns).toFixed(6)
    ),
    responseCompressionRate: Number(
      (1 - safeRate(turnResults.length, rawCustomerTurns)).toFixed(6)
    ),
    totalProviderCalls: turnResults.reduce(
      (sum, entry) => sum + entry.providerCallCount,
      0
    ),
    providerCallsPerEvaluatedTurn: Number(
      safeRate(
        turnResults.reduce((sum, entry) => sum + entry.providerCallCount, 0),
        turnResults.length
      ).toFixed(6)
    ),
    providerCallsPerRawCustomerTurn: Number(
      safeRate(
        turnResults.reduce((sum, entry) => sum + entry.providerCallCount, 0),
        rawCustomerTurns
      ).toFixed(6)
    ),
    multiAiCallTurnRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.providerCallCount > 1).length,
        turnResults.length
      ).toFixed(6)
    ),
    waitForMoreRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.waitForMore).length,
        turnResults.length
      ).toFixed(6)
    ),
    retrievedRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.knowledgeRetrieved).length,
        turnResults.length
      ).toFixed(6)
    ),
    groundedRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.knowledgeGrounded).length,
        turnResults.length
      ).toFixed(6)
    ),
    retrievedOnlyRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.retrievedOnly).length,
        turnResults.length
      ).toFixed(6)
    ),
    prematureQuoteRate: Number(
      safeRate(
        turnsWithIncompleteQuote.filter((entry) => entry.prematureQuote).length,
        turnsWithIncompleteQuote.length
      ).toFixed(6)
    ),
    groundedInfoFirstViolationRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.groundedInfoFirstViolation).length,
        turnResults.filter(
          (entry) =>
            entry.quoteLikeTurn && entry.knowledgeGrounded && entry.missingFields.length > 0
        ).length
      ).toFixed(6)
    ),
    externalNaturalityAverage: buildMetricValue(
      turnResults,
      (entry) => entry.externalNaturalityScore
    ),
    lowExternalNaturalityRate: Number(
      safeRate(
        turnResults.filter((entry) => entry.externalNaturalityScore < 0.7).length,
        turnResults.length
      ).toFixed(6)
    ),
    runtimeNaturalityAverage: buildMetricValue(
      turnsWithRuntimeNaturality,
      (entry) => entry.runtimeNaturalityScore
    ),
    lowRuntimeNaturalityRate: Number(
      safeRate(
        turnsWithRuntimeNaturality.filter(
          (entry) => entry.runtimeNaturalityScore < runtimeNaturalityScale * 0.7
        ).length,
        turnsWithRuntimeNaturality.length
      ).toFixed(6)
    ),
    answerModeCounts: turnResults.reduce((counts, entry) => {
      const key = entry.answerMode || "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    violationSamples: {
      multiAiCalls: turnResults
        .filter((entry) => entry.providerCallCount > 1)
        .slice(0, 10)
        .map((entry) => ({
          conversationId: entry.conversationId,
          semanticTurnId: entry.semanticTurnId,
          providerCallCount: entry.providerCallCount
        })),
      prematureQuote: turnResults
        .filter((entry) => entry.prematureQuote)
        .slice(0, 10)
        .map((entry) => ({
          conversationId: entry.conversationId,
          semanticTurnId: entry.semanticTurnId,
          missingFields: entry.missingFields,
          answerMode: entry.answerMode,
          responseText: entry.responseText
        })),
      retrievedOnly: turnResults
        .filter((entry) => entry.retrievedOnly)
        .slice(0, 10)
        .map((entry) => ({
          conversationId: entry.conversationId,
          semanticTurnId: entry.semanticTurnId,
          answerMode: entry.answerMode,
          decisionSource: entry.decisionSource,
          readinessLane: entry.readinessLane,
          responseText: entry.responseText
        })),
      groundedInfoFirst: turnResults
        .filter((entry) => entry.groundedInfoFirstViolation)
        .slice(0, 10)
        .map((entry) => ({
          conversationId: entry.conversationId,
          semanticTurnId: entry.semanticTurnId,
          missingFields: entry.missingFields,
          answerMode: entry.answerMode,
          responseText: entry.responseText
        })),
      lowNaturality: turnResults
        .filter((entry) => entry.externalNaturalityScore < 0.7)
        .slice(0, 10)
        .map((entry) => ({
          conversationId: entry.conversationId,
          semanticTurnId: entry.semanticTurnId,
          externalNaturalityScore: entry.externalNaturalityScore,
          penalties: entry.externalNaturalityPenalties,
          responseText: entry.responseText
        }))
    }
  };

  return {
    summary,
    turnResults
  };
}

function buildDiff(currentSummary, baselineSummary) {
  if (!currentSummary || !baselineSummary) {
    return null;
  }

  const compare = (key, direction = "lower_is_better") => {
    const current = currentSummary[key];
    const baseline = baselineSummary[key];
    if (
      typeof current !== "number" ||
      !Number.isFinite(current) ||
      typeof baseline !== "number" ||
      !Number.isFinite(baseline)
    ) {
      return null;
    }
    const delta = Number((current - baseline).toFixed(6));
    const improved =
      direction === "higher_is_better" ? current > baseline : current < baseline;
    return {
      current,
      baseline,
      delta,
      improved
    };
  };

  return {
    fragmentation: compare("responsePerRawCustomerTurn", "lower_is_better"),
    aiCallsPerRawCustomerTurn: compare(
      "providerCallsPerRawCustomerTurn",
      "lower_is_better"
    ),
    aiCallsPerEvaluatedTurn: compare(
      "providerCallsPerEvaluatedTurn",
      "lower_is_better"
    ),
    groundedRate: compare("groundedRate", "higher_is_better"),
    retrievedOnlyRate: compare("retrievedOnlyRate", "lower_is_better"),
    prematureQuoteRate: compare("prematureQuoteRate", "lower_is_better"),
    groundedInfoFirstViolationRate: compare(
      "groundedInfoFirstViolationRate",
      "lower_is_better"
    ),
    externalNaturalityAverage: compare(
      "externalNaturalityAverage",
      "higher_is_better"
    ),
    lowExternalNaturalityRate: compare(
      "lowExternalNaturalityRate",
      "lower_is_better"
    ),
    runtimeNaturalityAverage: compare(
      "runtimeNaturalityAverage",
      "higher_is_better"
    )
  };
}

function buildMarkdown({ generatedAt, options, baselineResult, currentResult, diff }) {
  const lines = [
    "# Conversational Closure Corpus Evaluation",
    "",
    `Generated at: ${generatedAt}`,
    `Corpus: ${options.corpusDir}`,
    `Playbook: ${options.playbookPath}`,
    `Current: ${options.currentRoot} (${options.currentMode})`
  ];

  if (baselineResult) {
    lines.push(
      `Baseline: ${options.baselineRoot} (${options.baselineMode}) @ ${options.baselineHead}`
    );
  }

  lines.push("", "## Current Summary", "");

  const currentSummary = currentResult.summary;
  lines.push(`- Conversations: ${currentSummary.totalConversations}`);
  lines.push(`- Raw customer turns: ${currentSummary.rawCustomerTurns}`);
  lines.push(`- Evaluated turns: ${currentSummary.evaluatedTurns}`);
  lines.push(
    `- Fragmentation (responses/raw customer turns): ${currentSummary.responsePerRawCustomerTurn}`
  );
  lines.push(
    `- AI calls per raw customer turn: ${currentSummary.providerCallsPerRawCustomerTurn}`
  );
  lines.push(
    `- AI calls per evaluated turn: ${currentSummary.providerCallsPerEvaluatedTurn}`
  );
  lines.push(`- Grounded rate: ${currentSummary.groundedRate}`);
  lines.push(`- Retrieved-only rate: ${currentSummary.retrievedOnlyRate}`);
  lines.push(`- Premature quote rate: ${currentSummary.prematureQuoteRate}`);
  lines.push(
    `- External naturality average: ${
      currentSummary.externalNaturalityAverage == null
        ? "n/a"
        : currentSummary.externalNaturalityAverage
    }`
  );
  lines.push(
    `- Runtime naturality average: ${
      currentSummary.runtimeNaturalityAverage == null
        ? "n/a"
        : currentSummary.runtimeNaturalityAverage
    }`
  );

  if (baselineResult) {
    const baselineSummary = baselineResult.summary;
    lines.push("", "## Baseline Summary", "");
    lines.push(`- Conversations: ${baselineSummary.totalConversations}`);
    lines.push(`- Raw customer turns: ${baselineSummary.rawCustomerTurns}`);
    lines.push(`- Evaluated turns: ${baselineSummary.evaluatedTurns}`);
    lines.push(
      `- Fragmentation (responses/raw customer turns): ${baselineSummary.responsePerRawCustomerTurn}`
    );
    lines.push(
      `- AI calls per raw customer turn: ${baselineSummary.providerCallsPerRawCustomerTurn}`
    );
    lines.push(
      `- AI calls per evaluated turn: ${baselineSummary.providerCallsPerEvaluatedTurn}`
    );
    lines.push(`- Grounded rate: ${baselineSummary.groundedRate}`);
    lines.push(`- Retrieved-only rate: ${baselineSummary.retrievedOnlyRate}`);
    lines.push(`- Premature quote rate: ${baselineSummary.prematureQuoteRate}`);
    lines.push(
      `- External naturality average: ${
        baselineSummary.externalNaturalityAverage == null
          ? "n/a"
          : baselineSummary.externalNaturalityAverage
      }`
    );
    lines.push(
      `- Runtime naturality average: ${
        baselineSummary.runtimeNaturalityAverage == null
          ? "n/a"
          : baselineSummary.runtimeNaturalityAverage
      }`
    );
  }

  if (diff) {
    lines.push("", "## Diff", "");
    for (const [label, value] of Object.entries(diff)) {
      if (!value) {
        continue;
      }
      lines.push(
        `- ${label}: baseline=${value.baseline} current=${value.current} delta=${
          value.delta >= 0 ? "+" : ""
        }${value.delta} improved=${value.improved}`
      );
    }
  }

  lines.push("", "## Current Violations", "");
  lines.push(
    `- multiAiCalls: ${currentSummary.violationSamples.multiAiCalls.length} sample(s)`
  );
  lines.push(
    `- prematureQuote: ${currentSummary.violationSamples.prematureQuote.length} sample(s)`
  );
  lines.push(
    `- groundedInfoFirst: ${currentSummary.violationSamples.groundedInfoFirst.length} sample(s)`
  );
  lines.push(
    `- lowNaturality: ${currentSummary.violationSamples.lowNaturality.length} sample(s)`
  );

  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifests = await loadCorpusManifests(options.corpusDir, options.limit);
  const playbookContent = await readFile(options.playbookPath, "utf8");

  const currentResult = await evaluateTarget({
    label: "current",
    targetRoot: options.currentRoot,
    mode: options.currentMode,
    manifests,
    playbookContent
  });

  let baselineResult = null;
  if (options.includeBaseline) {
    baselineResult = await evaluateTarget({
      label: "baseline",
      targetRoot: options.baselineRoot,
      mode: options.baselineMode,
      manifests,
      playbookContent
    });
  }

  const generatedAt = new Date().toISOString();
  const runId = `closure-corpus-${generatedAt.replace(/[:.]/g, "-")}`;
  const diff = buildDiff(currentResult.summary, baselineResult?.summary ?? null);

  const payload = {
    generatedAt,
    runId,
    options,
    current: currentResult.summary,
    baseline: baselineResult?.summary ?? null,
    diff,
    currentViolationSamples: currentResult.summary.violationSamples,
    baselineViolationSamples: baselineResult?.summary?.violationSamples ?? null
  };

  await mkdir(options.outputDir, { recursive: true });
  const jsonPath = path.join(options.outputDir, `${runId}.closure-corpus.json`);
  const markdownPath = path.join(options.outputDir, `${runId}.closure-corpus.md`);
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(
    markdownPath,
    buildMarkdown({
      generatedAt,
      options,
      baselineResult,
      currentResult,
      diff
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        status: "ok",
        runId,
        jsonPath,
        markdownPath,
        current: currentResult.summary,
        baseline: baselineResult?.summary ?? null,
        diff
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
        error: error?.stack || error?.message || String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
