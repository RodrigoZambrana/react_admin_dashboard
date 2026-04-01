#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const DEFAULT_TRACE_PATH = path.join(
  repoRoot,
  ".qa",
  "runs",
  "2026-03-31T20-05-15-553Z.closure-corpus.semantic-turn-trace.txt"
);
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, ".qa", "runs");

const STOPWORDS = new Set([
  "a",
  "al",
  "algo",
  "con",
  "como",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "hola",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "necesito",
  "para",
  "pero",
  "por",
  "que",
  "se",
  "si",
  "te",
  "tu",
  "un",
  "una",
  "y",
  "ya",
]);

const LIGHT_USER_REGEX =
  /^(?:ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro)(?:\s+(?:ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro))*$/iu;
const GENERIC_CLARIFICATION_REGEX =
  /\b(no me queda claro|contame un poco mas|contame un poco más|que necesit[aá]s resolver exactamente|quer[eé]s contarme un poco mas|quer[eé]s contarme un poco m[aá]s|decime un poco mas|decime un poco m[aá]s)\b/iu;
const GENERIC_CLOSURE_REGEX =
  /\b(cuando quieras retomarlo seguimos por aca|cuando quieras retomarlo seguimos por acá|si quer[eé]s seguimos por ac[aá]|cualquier cosa me escrib[ií]s|si quer[eé]s seguimos con tu consulta)\b/iu;
const ADDRESS_ASK_REGEX = /\b(direcci[oó]n|zona|ubicaci[oó]n)\b/iu;
const DATE_ASK_REGEX = /\b(qu[eé]\s+d[ií]a|qu[eé]\s+dia|d[ií]a te queda bien|d[ií]a te sirve|qu[eé]\s+d[ií]a te sirve)\b/iu;
const TIME_ASK_REGEX = /\b(horario|a\s+qu[eé]\s+hora|a\s+que\s+hora|hora te queda|hora te sirve)\b/iu;
const MEASUREMENTS_ASK_REGEX =
  /\b(medidas?|ancho por alto|medida aproximada|cu[aá]nto mide|dimensiones?)\b/iu;
const QUANTITY_ASK_REGEX = /\b(cu[aá]ntas? unidades|cantidad)\b/iu;
const PRODUCT_ASK_REGEX = /\b(qu[eé] producto|qu[eé] quer[eé]s cotizar|qu[eé] opci[oó]n buscas|qu[eé] servicio te interesa)\b/iu;
const SCHEDULE_SIGNAL_REGEX =
  /\b(lunes|martes|miercoles|mi[eé]rcoles|jueves|viernes|sabado|s[aá]bado|domingo|ma[nñ]ana|pasado ma[nñ]ana|9am|10am|11am|12am|1pm|2pm|3pm|4pm|5pm|6pm|\d{1,2}(?::\d{2})?\s?(?:am|pm)|horario|direcci[oó]n|zona)\b/iu;
const QUOTE_SIGNAL_REGEX =
  /\b(cotiza|cotizaci[oó]n|presupuesto|medidas?|ancho|alto|cantidad|unidades|precio)\b/iu;
const ATTACHMENT_REGEX = /<multimedia omitido>|archivo adjunto/iu;

function parseArgs(argv) {
  const options = {
    tracePath: DEFAULT_TRACE_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--trace-path") {
      options.tracePath = argv[index + 1] ?? options.tracePath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--trace-path=")) {
      options.tracePath = arg.slice("--trace-path=".length);
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
          "Usage: node tools/qa/audit-semantic-turn-trace.mjs [options]",
          "",
          "Options:",
          "  --trace-path <path>   Semantic turn trace file to audit.",
          "  --output-dir <path>   Directory where the audit report will be written.",
        ].join("\n")
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const tokenize = (value) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !STOPWORDS.has(entry));

const tokenJaccard = (left, right) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) {
    return 1;
  }
  const intersection = Array.from(leftSet).filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const buildIssue = (code, reason) => ({ code, reason });

function extractHistoryFactsFromUserText(text, facts) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return facts;
  }

  const next = { ...facts };

  if (!next.address) {
    const addressMatch =
      text.match(
        /\b(?:calle|avenida|av\.?|ruta|camino|bulevar|blvr|esquina|esq|km|kilometro|kilómetro|barrio|zona)\b[^\n]*/iu
      ) ||
      text.match(/\b[a-záéíóúñ\s]{3,}\s+\d{1,5}\b/iu);
    if (addressMatch) {
      next.address = compactText(addressMatch[0]);
    }
  }

  if (!next.date) {
    const dateMatch = text.match(
      /\b(?:lunes|martes|miercoles|mi[eé]rcoles|jueves|viernes|sabado|s[aá]bado|domingo|ma[nñ]ana|pasado ma[nñ]ana|hoy)\b/iu
    );
    if (dateMatch) {
      next.date = compactText(dateMatch[0]);
    }
  }

  if (!next.time) {
    const timeMatch = text.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/iu);
    if (timeMatch) {
      next.time = compactText(timeMatch[0]);
    }
  }

  if (!next.dimensions) {
    const measurementsMatch = text.match(
      /\b\d{1,2}(?:[.,]\d{1,2})?\s?[x×]\s?\d{1,2}(?:[.,]\d{1,2})?(?:\s?(?:m|mt|mts|cm))?\b/iu
    );
    if (measurementsMatch) {
      next.dimensions = compactText(measurementsMatch[0]);
    }
  }

  if (next.quantity == null) {
    const quantityMatch = text.match(/\b(?:son|somos|quiero|necesito|preciso)?\s*(\d{1,3})\s*(?:unidades?|puertas?|ventanas?|cortinas?)\b/iu);
    if (quantityMatch) {
      next.quantity = Number(quantityMatch[1]);
    }
  }

  if (!next.product) {
    const productMatch = text.match(
      /\b(?:roller|screen|blackout|persiana|cortina|ventana|abertura|puerta|mosquitero|vidrio)\b/iu
    );
    if (productMatch) {
      next.product = compactText(productMatch[0]);
    }
  }

  return next;
}

function parseTrace(raw) {
  const lines = raw.split(/\r?\n/);
  const conversations = [];
  let currentConversation = null;
  let currentTurn = null;

  const flushTurn = () => {
    if (currentConversation && currentTurn) {
      currentConversation.turns.push(currentTurn);
    }
    currentTurn = null;
  };

  const flushConversation = () => {
    flushTurn();
    if (currentConversation) {
      conversations.push(currentConversation);
    }
    currentConversation = null;
  };

  for (const line of lines) {
    const conversationMatch = line.match(/^===== (.+) =====$/u);
    if (conversationMatch) {
      flushConversation();
      currentConversation = {
        conversationId: conversationMatch[1],
        turns: [],
      };
      continue;
    }

    const turnMatch = line.match(/^(.+?:semantic-turn-\d+) raw=(\d+)$/u);
    if (turnMatch) {
      flushTurn();
      currentTurn = {
        semanticTurnId: turnMatch[1],
        rawInputCount: Number(turnMatch[2]),
        user: "",
        bot: "",
        intent: null,
        mode: null,
        contract: null,
        knowledgeNeed: null,
      };
      continue;
    }

    if (!currentTurn) {
      continue;
    }

    if (line.startsWith("USER: ")) {
      currentTurn.user = line.slice("USER: ".length).trim();
      continue;
    }
    if (line.startsWith("BOT: ")) {
      currentTurn.bot = line.slice("BOT: ".length).trim();
      continue;
    }
    if (line.startsWith("INTENT: ")) {
      const parts = line.split("|").map((entry) => entry.trim());
      currentTurn.intent = parts[0]?.replace(/^INTENT:\s*/u, "") || null;
      currentTurn.mode = parts[1]?.replace(/^MODE:\s*/u, "") || null;
      currentTurn.contract = parts[2]?.replace(/^CONTRACT:\s*/u, "") || null;
      currentTurn.knowledgeNeed = parts[3]?.replace(/^KNEED:\s*/u, "") || null;
    }
  }

  flushConversation();
  return conversations;
}

function auditConversation(conversation) {
  const issues = [];
  let previousBot = "";
  let previousIssues = [];
  let facts = {
    address: null,
    date: null,
    time: null,
    product: null,
    dimensions: null,
    quantity: null,
  };

  for (const turn of conversation.turns) {
    facts = extractHistoryFactsFromUserText(turn.user, facts);
    const turnIssues = [];
    const bot = compactText(turn.bot);
    const user = compactText(turn.user);
    const normalizedBot = normalizeText(bot);
    const normalizedPrevBot = normalizeText(previousBot);
    const botTokens = tokenize(bot);
    const prevBotTokens = tokenize(previousBot);
    const userTokens = tokenize(user);
    const newTokens = botTokens.filter((token) => !prevBotTokens.includes(token));
    const asksAddress = ADDRESS_ASK_REGEX.test(bot);
    const asksDate = DATE_ASK_REGEX.test(bot);
    const asksTime = TIME_ASK_REGEX.test(bot);
    const asksMeasurements = MEASUREMENTS_ASK_REGEX.test(bot);
    const asksQuantity = QUANTITY_ASK_REGEX.test(bot);
    const asksProduct = PRODUCT_ASK_REGEX.test(bot);

    if (normalizedBot && normalizedBot === normalizedPrevBot) {
      turnIssues.push(
        buildIssue("repeated_reply", "La respuesta repite exactamente la salida previa.")
      );
    } else if (
      botTokens.length > 0 &&
      prevBotTokens.length > 0 &&
      tokenJaccard(botTokens, prevBotTokens) >= 0.78
    ) {
      turnIssues.push(
        buildIssue("looping_reply", "La respuesta reaprovecha casi la misma estructura del turno anterior.")
      );
    }

    if (botTokens.length > 0 && prevBotTokens.length > 0 && newTokens.length === 0) {
      turnIssues.push(
        buildIssue("no_progression", "La respuesta no agrega información ni avanza el flujo.")
      );
    }

    if (userTokens.length >= 2 && botTokens.length > 0) {
      const overlap = userTokens.filter((token) => botTokens.includes(token)).length;
      if (overlap === 0 && !GENERIC_CLOSURE_REGEX.test(bot)) {
        turnIssues.push(
          buildIssue("weak_context_link", "La respuesta no reutiliza señales relevantes del mensaje actual.")
        );
      }
    }

    if (facts.address && asksAddress) {
      turnIssues.push(
        buildIssue("asks_known_data", "Pide dirección aunque ya aparece en el historial.")
      );
    }
    if (facts.date && asksDate) {
      turnIssues.push(
        buildIssue("asks_known_data", "Pide día aunque ya aparece en el historial.")
      );
    }
    if (facts.time && asksTime) {
      turnIssues.push(
        buildIssue("asks_known_data", "Pide horario aunque ya aparece en el historial.")
      );
    }
    if (facts.dimensions && asksMeasurements) {
      turnIssues.push(
        buildIssue("asks_known_data", "Pide medidas aunque ya aparecen en el historial.")
      );
    }
    if (facts.quantity != null && asksQuantity) {
      turnIssues.push(
        buildIssue("asks_known_data", "Pide cantidad aunque ya aparece en el historial.")
      );
    }
    if (facts.product && asksProduct) {
      turnIssues.push(
        buildIssue("asks_known_data", "Pide producto aunque ya aparece en el historial.")
      );
    }

    if (GENERIC_CLOSURE_REGEX.test(bot) && previousIssues.some((issue) => issue.code === "repeated_reply")) {
      turnIssues.push(
        buildIssue("closure_loop", "Reitera una salida de cierre en lugar de resolver o cerrar definitivamente.")
      );
    }

    if (
      turn.intent === "customer.schedule_request" &&
      SCHEDULE_SIGNAL_REGEX.test(user) &&
      (GENERIC_CLARIFICATION_REGEX.test(bot) || DATE_ASK_REGEX.test(bot) || TIME_ASK_REGEX.test(bot))
    ) {
      turnIssues.push(
        buildIssue("schedule_loop", "El turno trae contexto de agenda, pero la respuesta reinicia o aclara de más.")
      );
    }

    if (
      turn.intent === "customer.quote" &&
      QUOTE_SIGNAL_REGEX.test(user) &&
      (asksMeasurements || asksQuantity || asksProduct) &&
      (facts.dimensions || facts.quantity != null || facts.product)
    ) {
      turnIssues.push(
        buildIssue("quote_loop", "La respuesta vuelve a pedir datos de cotización ya entregados.")
      );
    }

    if (GENERIC_CLOSURE_REGEX.test(bot) || GENERIC_CLARIFICATION_REGEX.test(bot)) {
      if (!LIGHT_USER_REGEX.test(user) && !ATTACHMENT_REGEX.test(user)) {
        turnIssues.push(
          buildIssue("fallback_empty", "Responde con un fallback genérico sin un siguiente paso concreto.")
        );
      }
    }

    if (
      /\b(cotizaci[oó]n|presupuesto)\s+de\s+(dos|uno|una|eso|esto)\b/iu.test(bot) ||
      /\bde para\b/iu.test(bot)
    ) {
      turnIssues.push(
        buildIssue("garbage_subject", "Arma un sujeto artificial o contaminado a partir del input.")
      );
    }

    if (
      LIGHT_USER_REGEX.test(user) &&
      !GENERIC_CLOSURE_REGEX.test(bot) &&
      (asksAddress ||
        asksDate ||
        asksTime ||
        asksMeasurements ||
        asksQuantity ||
        asksProduct ||
        GENERIC_CLARIFICATION_REGEX.test(bot))
    ) {
      turnIssues.push(
        buildIssue("small_talk_reopens_flow", "Un mensaje liviano reabre un flujo que ya estaba cerrado o encaminado.")
      );
    }

    if (
      previousBot &&
      previousIssues.some((issue) => issue.code === "schedule_loop" || issue.code === "quote_loop") &&
      (turnIssues.some((issue) => issue.code === "asks_known_data") ||
        turnIssues.some((issue) => issue.code === "schedule_loop") ||
        turnIssues.some((issue) => issue.code === "quote_loop"))
    ) {
      turnIssues.push(
        buildIssue("context_loss", "El bot pierde continuidad y vuelve a un estado anterior del flujo.")
      );
    }

    if (turnIssues.length > 0) {
      issues.push({
        conversationId: conversation.conversationId,
        semanticTurnId: turn.semanticTurnId,
        rawInputCount: turn.rawInputCount,
        intent: turn.intent,
        mode: turn.mode,
        contract: turn.contract,
        knowledgeNeed: turn.knowledgeNeed,
        user: turn.user,
        bot: turn.bot,
        issues: turnIssues,
      });
    }

    previousBot = bot;
    previousIssues = turnIssues;
  }

  return issues;
}

function summarizeIssues(issueEntries) {
  const clusters = new Map();
  for (const entry of issueEntries) {
    for (const issue of entry.issues) {
      if (!clusters.has(issue.code)) {
        clusters.set(issue.code, {
          count: 0,
          reason: issue.reason,
          samples: [],
        });
      }
      const cluster = clusters.get(issue.code);
      cluster.count += 1;
      if (cluster.samples.length < 12) {
        cluster.samples.push({
          conversationId: entry.conversationId,
          semanticTurnId: entry.semanticTurnId,
          user: entry.user,
          bot: entry.bot,
          intent: entry.intent,
          mode: entry.mode,
          contract: entry.contract,
        });
      }
    }
  }

  return Array.from(clusters.entries())
    .map(([code, value]) => ({ code, ...value }))
    .sort((left, right) => right.count - left.count);
}

function buildMarkdown({ tracePath, issues, clusters }) {
  const lines = [
    "# Semantic Turn Trace Audit",
    "",
    `Trace: ${tracePath}`,
    `Flagged turns: ${issues.length}`,
    "",
    "## Clusters",
    "",
  ];

  for (const cluster of clusters) {
    lines.push(`- ${cluster.code}: ${cluster.count} turn(s)`);
  }

  lines.push("", "## Samples", "");

  for (const cluster of clusters) {
    lines.push(`### ${cluster.code}`, "");
    lines.push(cluster.reason, "");
    for (const sample of cluster.samples.slice(0, 8)) {
      lines.push(`- ${sample.semanticTurnId}`);
      lines.push(`  USER: ${sample.user}`);
      lines.push(`  BOT: ${sample.bot}`);
      lines.push(
        `  INTENT: ${sample.intent || "n/a"} | MODE: ${sample.mode || "n/a"} | CONTRACT: ${sample.contract || "n/a"}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readFile(options.tracePath, "utf8");
  const conversations = parseTrace(raw);
  const issues = conversations.flatMap((conversation) => auditConversation(conversation));
  const clusters = summarizeIssues(issues);
  const generatedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = `${generatedAt}.semantic-turn-trace-audit`;
  const jsonPath = path.join(options.outputDir, `${runId}.json`);
  const mdPath = path.join(options.outputDir, `${runId}.md`);

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tracePath: options.tracePath,
        totalConversations: conversations.length,
        totalFlaggedTurns: issues.length,
        clusters,
        issues,
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(mdPath, buildMarkdown({ tracePath: options.tracePath, issues, clusters }), "utf8");

  console.log(
    JSON.stringify(
      {
        jsonPath,
        mdPath,
        totalConversations: conversations.length,
        totalFlaggedTurns: issues.length,
        topClusters: clusters.slice(0, 10),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
