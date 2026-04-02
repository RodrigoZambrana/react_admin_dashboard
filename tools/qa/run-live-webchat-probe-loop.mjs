#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  appendJsonl,
  buildConversationSummariesFromTurnEntries,
  buildDiagnosticMarkdown,
  buildExecutiveSummary,
  buildReadableMarkdown,
  buildTraceMarkdown,
  detectTurnFindings,
  extractFactsFromUserText,
  readJsonlIfExists,
  summarizeFindings,
  writeJson
} from "./replay-real-corpus-run.mjs";
import {
  DEFAULT_REAL_CORPUS_RUNS_DIR,
  buildReplayTranscriptConversation,
  writeTranscriptFiles
} from "./real-corpus-artifacts-lib.mjs";
import {
  buildDefaultProbePlaybook,
  buildProbeActionPlan,
  buildProbeActionPlanMarkdown,
  buildProbeKnowledgeDictionary,
  evaluateProbeExpectations,
  expandProbePlaybook,
  loadProbePlaybook,
  mergeFindings
} from "./webchat-probe-lib.mjs";
import {
  buildWebchatResponseSummary,
  createWebchatSession,
  dispatchWebchatMessage,
  getWebchatSession,
  waitForAgentReply,
  withWebchatRetry
} from "./replay-real-corpus-webchat-run.mjs";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:4000/api";
const DEFAULT_AI_AGENT_BASE_URL = "http://127.0.0.1:4100";
const DEFAULT_INTERNAL_TOKEN = "local-ai-internal-token";
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
    outputRoot: DEFAULT_REAL_CORPUS_RUNS_DIR,
    backendBaseUrl: DEFAULT_BACKEND_BASE_URL,
    aiAgentBaseUrl: DEFAULT_AI_AGENT_BASE_URL,
    internalToken: DEFAULT_INTERNAL_TOKEN,
    tenantKey: DEFAULT_TENANT_KEY,
    page: DEFAULT_PAGE,
    locale: DEFAULT_LOCALE,
    currency: DEFAULT_CURRENCY,
    scope: DEFAULT_SCOPE,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    replyTimeoutMs: DEFAULT_REPLY_TIMEOUT_MS,
    retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    retryInitialDelayMs: DEFAULT_RETRY_INITIAL_DELAY_MS,
    playbookPath: null,
    scenarioIds: "",
    tags: "",
    iterations: 1,
    limitScenarios: null
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
    if (arg === "--backend-base-url") {
      options.backendBaseUrl = argv[index + 1] ?? options.backendBaseUrl;
      index += 1;
      continue;
    }
    if (arg.startsWith("--backend-base-url=")) {
      options.backendBaseUrl = arg.slice("--backend-base-url=".length);
      continue;
    }
    if (arg === "--ai-agent-base-url") {
      options.aiAgentBaseUrl = argv[index + 1] ?? options.aiAgentBaseUrl;
      index += 1;
      continue;
    }
    if (arg.startsWith("--ai-agent-base-url=")) {
      options.aiAgentBaseUrl = arg.slice("--ai-agent-base-url=".length);
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
    if (arg === "--iterations") {
      const parsed = Number(argv[index + 1] ?? "");
      options.iterations = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
      index += 1;
      continue;
    }
    if (arg.startsWith("--iterations=")) {
      const parsed = Number(arg.slice("--iterations=".length));
      options.iterations = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
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
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node tools/qa/run-live-webchat-probe-loop.mjs [options]",
          "",
          "Options:",
          "  --output-root <path>          Base output directory. Default: .qa/runs.",
          "  --backend-base-url <url>      Backend API base URL. Default: http://127.0.0.1:4000/api.",
          "  --ai-agent-base-url <url>     AI agent health URL root. Default: http://127.0.0.1:4100.",
          "  --internal-token <token>      Internal token for backend AI endpoints.",
          "  --tenant-key <slug>           Tenant key used in probes. Default: urucortinas.",
          "  --page <path>                 Page metadata sent by storefront webchat. Default: /shop.",
          "  --scope <scope>               customer_public | customer_authenticated.",
          "  --playbook-path <path>        Optional JSON playbook override.",
          "  --scenario-ids <csv>          Run only selected scenario ids.",
          "  --tags <csv>                  Run only scenarios matching any tag.",
          "  --iterations <n>              Repeat each scenario n times. Default: 1.",
          "  --limit-scenarios <n>         Limit expanded scenarios for smoke runs.",
          "  --poll-interval-ms <n>        Session polling cadence. Default: 500.",
          "  --reply-timeout-ms <n>        Max wait per turn for site reply. Default: 35000."
        ].join("\n")
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function parseJsonResponse(response) {
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;
  if (!response.ok) {
    throw new Error(payload?.message || `http_${response.status}`);
  }
  return payload;
}

async function fetchAiAgentHealth(baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { method: "GET" });
  return parseJsonResponse(response);
}

async function fetchInternalJson(baseUrl, route, internalToken) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${route}`, {
    method: "GET",
    headers: {
      "x-ai-internal-token": internalToken
    }
  });
  return parseJsonResponse(response);
}

async function buildPreflight(options) {
  const [aiAgentHealth, runtimeConfig, topicTaxonomy, quoteProfiles] = await Promise.all([
    fetchAiAgentHealth(options.aiAgentBaseUrl),
    fetchInternalJson(
      options.backendBaseUrl,
      "/ai/runtime-config/internal",
      options.internalToken
    ),
    fetchInternalJson(
      options.backendBaseUrl,
      `/ai/knowledge/topic-taxonomy?tenantKey=${encodeURIComponent(
        options.tenantKey
      )}&scope=${encodeURIComponent(options.scope)}`,
      options.internalToken
    ),
    fetchInternalJson(
      options.backendBaseUrl,
      `/ai/knowledge/quote-profiles?tenantKey=${encodeURIComponent(
        options.tenantKey
      )}&scope=${encodeURIComponent(options.scope)}`,
      options.internalToken
    )
  ]);

  return {
    generatedAt: new Date().toISOString(),
    aiAgentHealth,
    runtimeConfig,
    topicTaxonomy,
    quoteProfiles
  };
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildGuestId(runToken, scenarioIndex) {
  return `qa-live-probe-${runToken}-${String(scenarioIndex + 1).padStart(4, "0")}`;
}

function buildSyntheticSourceTurns(step, stepIndex) {
  return [
    {
      index: stepIndex + 1,
      timestamp: null,
      rawTimestamp: null,
      text: step.text,
      attachmentCount: 0
    }
  ];
}

function summarizeProviderParticipation(turnEntries, preflight) {
  const stages = {};
  const providers = {};
  const models = {};
  const evidence = [];

  let turnsWithAudit = 0;
  let turnsWithoutAudit = 0;
  let turnsWithProviderMetadata = 0;
  let llmResponseTurns = 0;
  let deterministicTurns = 0;

  for (const turn of turnEntries) {
    const audit = turn.response?.auditPayload ?? null;
    const stage = typeof audit?.stage === "string" ? audit.stage : "missing";
    stages[stage] = (stages[stage] || 0) + 1;

    if (audit) {
      turnsWithAudit += 1;
    } else {
      turnsWithoutAudit += 1;
    }

    if (stage === "llm_response") {
      llmResponseTurns += 1;
    }
    if (stage === "deterministic_decision") {
      deterministicTurns += 1;
    }

    const provider =
      typeof turn.response?.provider === "string"
        ? turn.response.provider
        : typeof preflight?.aiAgentHealth?.provider === "string"
          ? preflight.aiAgentHealth.provider
          : typeof preflight?.runtimeConfig?.provider === "string"
            ? preflight.runtimeConfig.provider
            : null;
    const model =
      typeof turn.response?.model === "string"
        ? turn.response.model
        : typeof preflight?.aiAgentHealth?.model === "string"
          ? preflight.aiAgentHealth.model
          : typeof preflight?.runtimeConfig?.model === "string"
            ? preflight.runtimeConfig.model
            : null;

    if (turn.response?.provider || turn.response?.model) {
      turnsWithProviderMetadata += 1;
    }

    if (provider) {
      providers[provider] = (providers[provider] || 0) + 1;
    }
    if (model) {
      models[model] = (models[model] || 0) + 1;
    }

    if (evidence.length < 20) {
      evidence.push({
        conversationId: turn.conversationId,
        turn: turn.semanticTurnId,
        stage,
        provider,
        model,
        responseText: compactText(turn.responseText).slice(0, 180)
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    configuredProvider:
      typeof preflight?.runtimeConfig?.provider === "string"
        ? preflight.runtimeConfig.provider
        : typeof preflight?.aiAgentHealth?.provider === "string"
          ? preflight.aiAgentHealth.provider
          : null,
    configuredModel:
      typeof preflight?.runtimeConfig?.model === "string"
        ? preflight.runtimeConfig.model
        : typeof preflight?.aiAgentHealth?.model === "string"
          ? preflight.aiAgentHealth.model
          : null,
    runtimeEnabled: preflight?.runtimeConfig?.enabled === true,
    totalTurns: turnEntries.length,
    turnsWithAudit,
    turnsWithoutAudit,
    turnsWithProviderMetadata,
    llmResponseTurns,
    deterministicTurns,
    stages,
    providers,
    models,
    evidence
  };
}

function buildProviderAuditMarkdown(audit) {
  const lines = [
    "# Live Webchat Provider Audit",
    "",
    `Generated at: ${audit.generatedAt}`,
    `Runtime enabled: ${audit.runtimeEnabled ? "yes" : "no"}`,
    `Configured provider: ${audit.configuredProvider || "n/a"}`,
    `Configured model: ${audit.configuredModel || "n/a"}`,
    `Total turns: ${audit.totalTurns}`,
    `Turns with audit: ${audit.turnsWithAudit}`,
    `Turns without audit: ${audit.turnsWithoutAudit}`,
    `Turns with provider/model metadata: ${audit.turnsWithProviderMetadata}`,
    `LLM response turns: ${audit.llmResponseTurns}`,
    `Deterministic turns: ${audit.deterministicTurns}`,
    "",
    "## Stage Counts",
    ""
  ];

  for (const [stage, count] of Object.entries(audit.stages)) {
    lines.push(`- ${stage}: ${count}`);
  }

  lines.push("");
  lines.push("## Evidence");
  lines.push("");
  for (const item of audit.evidence) {
    lines.push(
      `- ${item.conversationId} / ${item.turn} / stage=${item.stage} / provider=${item.provider || "n/a"} / model=${item.model || "n/a"} / ${item.responseText || "(sin respuesta)"}`
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function runScenario({
  scenario,
  scenarioIndex,
  options,
  runDir,
  runToken,
  dictionary,
  status
}) {
  const guestId = buildGuestId(runToken, scenarioIndex);
  const session = await withWebchatRetry(
    () =>
      createWebchatSession({
        backendBaseUrl: options.backendBaseUrl,
        tenantKey: options.tenantKey,
        guestId,
        displayName: `QA Probe ${scenarioIndex + 1}`,
        email: `${guestId}@qa-live-probes.local`,
        page: scenario.settings?.page || options.page,
        locale: scenario.settings?.locale || options.locale
      }),
    options,
    `create-session:${scenario.id}`
  );

  const turnEntries = [];
  const conversationState = {
    previousResponseText: "",
    facts: {}
  };

  for (let stepIndex = 0; stepIndex < scenario.steps.length; stepIndex += 1) {
    const step = scenario.steps[stepIndex];
    const factsBefore = { ...conversationState.facts };
    const currentFacts = extractFactsFromUserText(step.text, {});
    const factsAfter = extractFactsFromUserText(step.text, factsBefore);
    const startedAt = new Date().toISOString();
    const turnStartedMs = Date.now();
    let responseSummary = null;
    let responseText = "";
    let error = null;
    let dispatch = null;
    let baselineCount = 0;
    let responseSession = null;

    try {
      const sessionBefore = await withWebchatRetry(
        () =>
          getWebchatSession({
            backendBaseUrl: options.backendBaseUrl,
            conversationId: session.conversationId,
            guestId
          }),
        options,
        `get-session-before:${scenario.id}:${stepIndex + 1}`
      );
      baselineCount = Array.isArray(sessionBefore.messages) ? sessionBefore.messages.length : 0;

      dispatch = await withWebchatRetry(
        () =>
          dispatchWebchatMessage({
            backendBaseUrl: options.backendBaseUrl,
            tenantKey: options.tenantKey,
            conversationId: session.conversationId,
            guestId,
            scope: scenario.settings?.scope || options.scope,
            text: step.text,
            locale: scenario.settings?.locale || options.locale,
            currency: scenario.settings?.currency || options.currency,
            page: scenario.settings?.page || options.page,
            attachments: []
          }),
        options,
        `dispatch:${scenario.id}:${stepIndex + 1}`
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
      conversationId: scenario.id,
      replayConversationId: session.conversationId,
      replayChannel: "webchat",
      replayUserId: guestId,
      replayThreadId: session.conversationId,
      semanticTurnId: `${scenario.id}:step-${stepIndex + 1}`,
      semanticTurnIndex: stepIndex + 1,
      startedAt,
      durationMs,
      user: {
        text: step.text,
        rawInputCount: 1,
        rawTurnIndexes: [stepIndex + 1],
        timestamps: [],
        sourceTurns: buildSyntheticSourceTurns(step, stepIndex)
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
      userGoal: scenario.goal || "unknown",
      findings: [],
      referenceBusinessTurns: [],
      probe: {
        scenarioId: scenario.scenarioId,
        title: scenario.title,
        focus: scenario.focus,
        tags: scenario.tags,
        variables: scenario.variables,
        stepIndex: stepIndex + 1
      },
      webchat: responseSession
        ? {
            sessionId: responseSession.sessionId || responseSession.conversationId || session.conversationId,
            guestId,
            needsHuman: responseSession.needsHuman === true,
            controlMode: responseSession.controlMode || null,
            aiState: responseSession.aiState || null
          }
        : {
            sessionId: session.conversationId,
            guestId
          }
    };

    const heuristicFindings = detectTurnFindings(turnEntry, {
      previousResponseText: conversationState.previousResponseText,
      factsBefore
    });
    const expectationResult = evaluateProbeExpectations({
      scenario,
      step,
      turnEntry,
      previousResponseText: conversationState.previousResponseText,
      dictionary
    });
    turnEntry.expectation = expectationResult;
    turnEntry.findings = mergeFindings(heuristicFindings, expectationResult.findings);

    conversationState.previousResponseText = responseText || conversationState.previousResponseText;
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
    conversationId: scenario.id,
    scenarioId: scenario.scenarioId,
    replayConversationId: session.conversationId,
    customerDisplayName: scenario.title,
    sourceZip: null,
    evaluatedTurnCount: turnEntries.length,
    findingCount: turnEntries.reduce((total, turn) => total + turn.findings.length, 0),
    failedTurnCount: turnEntries.filter((turn) => turn.error).length,
    turns: turnEntries
  };

  status.completedConversations += 1;
  await appendJsonl(path.join(runDir, "conversations.jsonl"), conversationEntry);
  return conversationEntry;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const runId = `live-webchat-probe-loop-${generatedAt.replace(/[:.]/g, "-")}`;
  const runDir = path.join(options.outputRoot, runId);
  const runToken = generatedAt.replace(/\D/g, "").slice(-10);

  await mkdir(runDir, { recursive: true });

  const preflight = await buildPreflight(options);
  const playbook = await loadProbePlaybook(options.playbookPath);
  const expandedPlaybook = expandProbePlaybook(playbook, {
    scenarioIds: options.scenarioIds,
    tags: options.tags,
    iterations: options.iterations,
    limitScenarios: options.limitScenarios
  });
  const dictionary = buildProbeKnowledgeDictionary({
    runtimeConfig: preflight.runtimeConfig,
    topicTaxonomy: preflight.topicTaxonomy,
    quoteProfiles: preflight.quoteProfiles
  });

  const status = {
    runId,
    generatedAt,
    playbookId: expandedPlaybook.playbookId,
    scenarioCount: expandedPlaybook.scenarios.length,
    completedConversations: 0,
    completedTurns: 0,
    failedTurns: 0,
    findings: 0
  };

  await writeJson(path.join(runDir, "status.json"), status);
  await writeJson(path.join(runDir, "preflight.json"), preflight);
  await writeJson(path.join(runDir, "playbook.json"), playbook);
  await writeJson(path.join(runDir, "playbook-expanded.json"), expandedPlaybook);
  await writeJson(path.join(runDir, "knowledge-dictionary.json"), dictionary);

  for (let scenarioIndex = 0; scenarioIndex < expandedPlaybook.scenarios.length; scenarioIndex += 1) {
    const scenario = expandedPlaybook.scenarios[scenarioIndex];
    const conversation = await runScenario({
      scenario,
      scenarioIndex,
      options,
      runDir,
      runToken,
      dictionary,
      status
    });
    await writeJson(path.join(runDir, "status.json"), status);
    console.log(
      [
        `scenario=${scenarioIndex + 1}/${expandedPlaybook.scenarios.length}`,
        `id=${scenario.id}`,
        `turns=${conversation.evaluatedTurnCount}`,
        `findings=${conversation.findingCount}`,
        `failed=${conversation.failedTurnCount}`
      ].join(" ")
    );
  }

  const turnEntriesPath = path.join(runDir, "turns.jsonl");
  const rawTurns = await readJsonlIfExists(turnEntriesPath);
  const conversations = buildConversationSummariesFromTurnEntries(rawTurns, new Map());
  const findingsSummary = summarizeFindings(conversations);
  const summary = buildExecutiveSummary({
    runId,
    options: {
      ...options,
      corpusDir: null
    },
    conversations,
    findingsSummary,
    status
  });
  const providerAudit = summarizeProviderParticipation(rawTurns, preflight);
  const actionPlan = buildProbeActionPlan({
    runId,
    summary,
    findingsSummary,
    playbookSummary: {
      playbookId: expandedPlaybook.playbookId,
      scenarioCount: expandedPlaybook.scenarios.length
    }
  });

  const traceJson = {
    runId,
    generatedAt,
    options,
    preflight,
    summary,
    providerAudit,
    playbook: expandedPlaybook,
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

  await writeJson(path.join(runDir, "summary.json"), summary);
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
  await writeJson(path.join(runDir, "provider-audit.json"), providerAudit);
  await writeFile(
    path.join(runDir, "provider-audit.md"),
    buildProviderAuditMarkdown(providerAudit),
    "utf8"
  );
  await writeJson(path.join(runDir, "action-plan.json"), actionPlan);
  await writeFile(
    path.join(runDir, "action-plan.md"),
    buildProbeActionPlanMarkdown(actionPlan),
    "utf8"
  );

  const transcriptExport = await writeTranscriptFiles(
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
    transcriptExport.stats
  );

  await writeJson(path.join(options.outputRoot, "latest-live-webchat-probe-loop.json"), {
    runId,
    runDir,
    generatedAt,
    summaryPath: path.join(runDir, "summary.json"),
    traceJsonPath: path.join(runDir, "trace.json"),
    readableMarkdownPath: path.join(runDir, "readable.md"),
    diagnosticJsonPath: path.join(runDir, "diagnostic.json"),
    providerAuditJsonPath: path.join(runDir, "provider-audit.json"),
    actionPlanJsonPath: path.join(runDir, "action-plan.json"),
    replayedTranscriptPath: transcriptExport.combinedPath
  });

  console.log(`run_id=${runId}`);
  console.log(`run_dir=${runDir}`);
  console.log(`provider_audit=${path.join(runDir, "provider-audit.json")}`);
  console.log(`diagnostic_json=${path.join(runDir, "diagnostic.json")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
