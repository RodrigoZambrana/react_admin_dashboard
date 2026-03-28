import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_BUSINESS_AUTHOR_PATTERNS = [
  /\burucortinas\b/i,
  /\bcentro de ayuda\b/i,
  /\bchat\b/i
];

const ATTACHMENT_EXTENSION_CLASSIFIERS = [
  { type: "audio", extensions: [".opus", ".mp3", ".wav", ".m4a", ".ogg"] },
  { type: "image", extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"] },
  { type: "video", extensions: [".mp4", ".mov", ".avi", ".mkv", ".webm"] },
  { type: "pdf", extensions: [".pdf"] },
  { type: "document", extensions: [".doc", ".docx", ".txt", ".rtf"] },
  { type: "sheet", extensions: [".csv", ".xls", ".xlsx"] }
];

const CLASSIFICATION_LABELS = [
  "quote_request",
  "structured_measurements",
  "technical_advice",
  "appointment_scheduling",
  "support_service",
  "payment_terms",
  "quote_follow_up",
  "outbound_follow_up",
  "abandoned_thread",
  "reengagement_after_gap",
  "operational_thread_switch",
  "system_message_interference",
  "multimodal_audio",
  "multimodal_image",
  "multimodal_pdf",
  "multimodal_document",
  "multimodal_sheet",
  "long_running_thread",
  "auto_reply_present",
  "web_origin_lead",
  "clarification_loop"
];

const GENERAL_RUNTIME_LABELS = new Set([
  "quote_request",
  "structured_measurements",
  "appointment_scheduling",
  "support_service",
  "quote_follow_up",
  "outbound_follow_up",
  "abandoned_thread",
  "reengagement_after_gap",
  "operational_thread_switch",
  "system_message_interference",
  "multimodal_audio",
  "multimodal_image",
  "multimodal_pdf",
  "multimodal_document",
  "multimodal_sheet",
  "long_running_thread",
  "auto_reply_present",
  "web_origin_lead",
  "clarification_loop"
]);

const TENANT_SPECIFIC_LABELS = new Set([
  "technical_advice",
  "payment_terms"
]);

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u200e/g, "")
    .replace(/[^\p{L}\p{N}\s.:/×-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const looksLikePhoneParticipant = (value) =>
  /^\+?\d[\d\s-]+$/.test(String(value || "").trim());

const slugify = (value) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const attachmentTypeFromName = (filename) => {
  const extension = path.extname(String(filename || "")).toLowerCase();
  const match = ATTACHMENT_EXTENSION_CLASSIFIERS.find((entry) =>
    entry.extensions.includes(extension)
  );
  return match?.type ?? "other";
};

const detectAttachmentMentions = (text, archiveEntries = []) => {
  const normalizedText = String(text || "");
  const matches = [];
  for (const entry of archiveEntries) {
    if (entry.kind !== "attachment") {
      continue;
    }
    if (normalizedText.includes(entry.name)) {
      matches.push({
        name: entry.name,
        type: entry.type,
        extension: entry.extension
      });
    }
  }
  return matches;
};

const buildParticipantRoleMap = (participants = []) => {
  const roleMap = new Map();
  const names = Array.from(
    new Set(
      ensureArray(participants)
        .map((entry) => compactText(entry))
        .filter(Boolean)
    )
  );
  const phoneParticipants = names.filter((name) => looksLikePhoneParticipant(name));
  const nonPhoneParticipants = names.filter((name) => !looksLikePhoneParticipant(name));

  if (phoneParticipants.length === 1 && nonPhoneParticipants.length === 1) {
    roleMap.set(nonPhoneParticipants[0], "business");
  }

  for (const name of names) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      continue;
    }
    if (DEFAULT_BUSINESS_AUTHOR_PATTERNS.some((pattern) => pattern.test(normalizedName))) {
      roleMap.set(name, "business");
      continue;
    }
    if (looksLikePhoneParticipant(name)) {
      roleMap.set(name, "customer");
      continue;
    }
    if (!roleMap.has(name)) {
      roleMap.set(name, "customer");
    }
  }

  return roleMap;
};

const detectAuthorRole = (author, participantRoleMap = new Map()) => {
  const normalizedAuthor = normalizeText(author);
  if (!normalizedAuthor) {
    return "system";
  }
  if (DEFAULT_BUSINESS_AUTHOR_PATTERNS.some((pattern) => pattern.test(normalizedAuthor))) {
    return "business";
  }
  if (looksLikePhoneParticipant(author)) {
    return "customer";
  }
  return participantRoleMap.get(compactText(author)) ?? "customer";
};

const parseTimestamp = (datePart, timePart) => {
  const [day, month, year] = String(datePart || "").split("/").map(Number);
  const [hours, minutes] = String(timePart || "").split(":").map(Number);
  if (!day || !month || !year || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString();
};

const parseTranscriptLine = (line) => {
  const match = line.match(
    /^(\d{1,2}\/\d{1,2}\/\d{4}),\s+(\d{1,2}:\d{2})\s+-\s+(.*)$/u
  );
  if (!match) {
    return null;
  }
  return {
    datePart: match[1],
    timePart: match[2],
    payload: match[3]
  };
};

const finalizeTranscriptEntry = (current, archiveEntries, participantRoleMap) => {
  if (!current) {
    return null;
  }

  const text = compactText(current.body.join("\n"));
  const attachments = detectAttachmentMentions(text, archiveEntries);
  const authorRole = current.author
    ? detectAuthorRole(current.author, participantRoleMap)
    : "system";

  return {
    index: current.index,
    timestamp: parseTimestamp(current.datePart, current.timePart),
    rawTimestamp: `${current.datePart}, ${current.timePart}`,
    author: current.author || null,
    authorRole,
    text,
    normalizedText: normalizeText(text),
    kind: current.author ? "message" : "system",
    attachmentRefs: attachments,
    attachmentKinds: Array.from(new Set(attachments.map((entry) => entry.type))),
    lineCount: current.body.length
  };
};

export const parseWhatsAppTranscript = (transcript, archiveEntries = []) => {
  const lines = String(transcript || "").replace(/\r\n/g, "\n").split("\n");
  const rawEntries = [];
  let current = null;

  for (const line of lines) {
    const parsed = parseTranscriptLine(line);
    if (!parsed) {
      if (current) {
        current.body.push(line);
      }
      continue;
    }

    if (current) {
      rawEntries.push(current);
    }

    const authorSplit = parsed.payload.match(/^([^:]+?):\s*(.*)$/u);
    current = {
      index: rawEntries.length + 1,
      datePart: parsed.datePart,
      timePart: parsed.timePart,
      author: authorSplit ? compactText(authorSplit[1]) : null,
      body: [authorSplit ? authorSplit[2] : parsed.payload]
    };
  }

  if (current) {
    rawEntries.push(current);
  }

  const participantNames = Array.from(
    new Set(
      rawEntries
        .map((entry) => entry.author)
        .filter((entry) => typeof entry === "string" && entry.trim())
    )
  );

  const participantRoleMap = buildParticipantRoleMap(participantNames);
  const participants = participantNames.map((name) => ({
    name,
    role: detectAuthorRole(name, participantRoleMap)
  }));

  const entries = rawEntries
    .map((entry) => finalizeTranscriptEntry(entry, archiveEntries, participantRoleMap))
    .filter(Boolean);

  return {
    participants,
    entries
  };
};

const countAttachmentsByType = (entries) => {
  const counts = {};
  for (const entry of entries) {
    for (const attachment of ensureArray(entry.attachmentRefs)) {
      counts[attachment.type] = (counts[attachment.type] ?? 0) + 1;
    }
  }
  return counts;
};

const conversationSpanDays = (entries) => {
  const timestamps = entries
    .map((entry) => (entry.timestamp ? new Date(entry.timestamp).getTime() : null))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length < 2) {
    return 0;
  }
  return Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000);
};

const buildConversationGaps = (entries) => {
  const gaps = [];
  let previous = null;

  for (const entry of entries) {
    const currentTimestamp = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
    if (!Number.isFinite(currentTimestamp)) {
      continue;
    }

    if (previous?.timestamp) {
      const previousTimestamp = new Date(previous.timestamp).getTime();
      if (Number.isFinite(previousTimestamp)) {
        const hours = (currentTimestamp - previousTimestamp) / 3_600_000;
        gaps.push({
          hours,
          fromIndex: previous.index,
          toIndex: entry.index,
          fromAuthorRole: previous.authorRole,
          toAuthorRole: entry.authorRole
        });
      }
    }

    previous = entry;
  }

  return gaps;
};

const hasInterleavedSystemTurn = (entries) =>
  entries.some((entry, index) => {
    if (entry.kind !== "system") {
      return false;
    }

    const previousHuman = [...entries.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.kind === "message");
    const nextHuman = entries
      .slice(index + 1)
      .find((candidate) => candidate.kind === "message");

    return Boolean(previousHuman && nextHuman);
  });

const hasMeasurementPattern = (text) =>
  /\b\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\b/u.test(text);

const conversationSignals = (entries) => {
  const businessTurns = entries.filter((entry) => entry.authorRole === "business");
  const customerTurns = entries.filter((entry) => entry.authorRole === "customer");
  const joinedText = normalizeText(entries.map((entry) => entry.text).join(" "));
  const businessText = normalizeText(businessTurns.map((entry) => entry.text).join(" "));
  const customerText = normalizeText(customerTurns.map((entry) => entry.text).join(" "));
  const attachmentCounts = countAttachmentsByType(entries);
  const gaps = buildConversationGaps(entries);
  const humanTurns = entries.filter((entry) => entry.kind === "message");
  const firstHumanTurn = humanTurns[0] ?? null;
  const lastHumanTurn = humanTurns.at(-1) ?? null;
  const lastCustomerTurn = customerTurns.at(-1) ?? null;

  return {
    attachmentCounts,
    hasQuoteRequest:
      /\b(presupuesto|cotiz|precio|precios|costo|costos)\b/.test(joinedText),
    hasStructuredMeasurements:
      entries.some((entry) => hasMeasurementPattern(entry.text)) ||
      /\bmedidas?\b/.test(joinedText),
    hasTechnicalAdvice:
      /\b(recomendamos|conviene|rectificar|prestacion|prestacion|linea|lineas|serie|mosquitero)\b/.test(
        businessText
      ),
    hasAppointmentScheduling:
      /\b(agendar|agendamos|coordinar|jueves|viernes|lunes|martes|miercoles|miércoles|horario|visita|pasemos a medir|direccion)\b/.test(
        joinedText
      ),
    hasSupportService:
      /\b(service|servicio tecnico|servicio técnico|reparacion|reparación|dejo de funcionar|dejó de funcionar|moverla|acortarla|acortar|ajustar)\b/.test(
        joinedText
      ),
    hasPaymentTerms:
      /\b(formas de pago|metodos de pago|metodos|seña|mercado pago|transferencia|efectivo|saldo)\b/.test(
        businessText
      ),
    hasQuoteFollowUp:
      /\b(que le parecio el presupuesto|no me quedo claro|no me quedó claro|total|presupuesto enviado)\b/.test(
        joinedText
      ),
    hasAutoReply: /\brespuesta automatica\b/.test(joinedText),
    hasWebLead: /\bte contacto desde la web\b/.test(customerText),
    hasClarificationLoop:
      /\b(no me quedo claro|no me quedó claro|aclarar|explicar|opciones)\b/.test(joinedText),
    hasOutboundFollowUp:
      firstHumanTurn?.authorRole === "business" ||
      gaps.some((gap) => gap.hours >= 24 && gap.toAuthorRole === "business"),
    hasAbandonedThread:
      humanTurns.length <= 4 &&
      Boolean(lastHumanTurn) &&
      lastHumanTurn.authorRole === "customer" &&
      !entries.some(
        (entry) =>
          entry.authorRole === "business" &&
          lastCustomerTurn &&
          entry.index > lastCustomerTurn.index
      ),
    hasReengagementAfterGap: gaps.some((gap) => gap.hours >= 24),
    hasOperationalThreadSwitch:
      (/\b(cotiz|presupuesto|precio|medidas?)\b/.test(joinedText) &&
        /\b(agendar|coordinar|visita|instalaci[oó]n|colocaci[oó]n|direcci[oó]n|horario)\b/.test(
          joinedText
        )) ||
      (/\b(service|reparaci[oó]n|ajustar)\b/.test(joinedText) &&
        /\b(coordinar|visita|pasar|agendar)\b/.test(joinedText)),
    hasSystemMessageInterference:
      hasInterleavedSystemTurn(entries) ||
      /\brespuesta automatica\b/.test(joinedText) ||
      (humanTurns.length >= 3 &&
        humanTurns.slice(0, 4).some(
          (entry) =>
            entry.authorRole === "business" &&
            /\b(respuesta automatica|gracias por tu mensaje|fuera de horario|mensaje automatico)\b/i.test(
              entry.text
            )
        )),
    spanDays: conversationSpanDays(entries),
    maxGapHours: gaps.reduce((max, gap) => Math.max(max, gap.hours), 0),
    gaps
  };
};

export const classifyConversationCases = (manifest) => {
  const signals = conversationSignals(manifest.turns);
  const labels = new Set();

  if (signals.hasQuoteRequest) labels.add("quote_request");
  if (signals.hasStructuredMeasurements) labels.add("structured_measurements");
  if (signals.hasTechnicalAdvice) labels.add("technical_advice");
  if (signals.hasAppointmentScheduling) labels.add("appointment_scheduling");
  if (signals.hasSupportService) labels.add("support_service");
  if (signals.hasPaymentTerms) labels.add("payment_terms");
  if (signals.hasQuoteFollowUp) labels.add("quote_follow_up");
  if (signals.hasOutboundFollowUp) labels.add("outbound_follow_up");
  if (signals.hasAbandonedThread) labels.add("abandoned_thread");
  if (signals.hasReengagementAfterGap) labels.add("reengagement_after_gap");
  if (signals.hasOperationalThreadSwitch) labels.add("operational_thread_switch");
  if (signals.hasSystemMessageInterference) labels.add("system_message_interference");
  if (signals.attachmentCounts.audio > 0) labels.add("multimodal_audio");
  if (signals.attachmentCounts.image > 0) labels.add("multimodal_image");
  if (signals.attachmentCounts.pdf > 0) labels.add("multimodal_pdf");
  if (signals.attachmentCounts.document > 0) labels.add("multimodal_document");
  if (signals.attachmentCounts.sheet > 0) labels.add("multimodal_sheet");
  if (signals.spanDays >= 1) labels.add("long_running_thread");
  if (signals.hasAutoReply) labels.add("auto_reply_present");
  if (signals.hasWebLead) labels.add("web_origin_lead");
  if (signals.hasClarificationLoop) labels.add("clarification_loop");

  return CLASSIFICATION_LABELS.filter((label) => labels.has(label));
};

const deriveClassificationScope = (labels = []) => ({
  generalRuntimeLabels: labels.filter((label) => GENERAL_RUNTIME_LABELS.has(label)),
  tenantSpecificLabels: labels.filter((label) => TENANT_SPECIFIC_LABELS.has(label))
});

export const deriveThreadProfile = (turns = [], labels = []) => {
  const humanTurns = turns.filter((turn) => turn.kind === "message");
  const firstHumanTurn = humanTurns[0] ?? null;
  const initiatedBy =
    firstHumanTurn?.authorRole === "business"
      ? "business_initiated"
      : firstHumanTurn?.authorRole === "customer"
        ? "customer_initiated"
        : "unknown";
  const channelInterfered =
    labels.includes("system_message_interference") || labels.includes("auto_reply_present");

  const buckets = [];
  if (initiatedBy !== "unknown") {
    buckets.push(initiatedBy);
  }
  if (channelInterfered) {
    buckets.push("channel_interfered");
  }

  return {
    initiatedBy,
    channelInterfered,
    buckets
  };
};

const findTurnWindow = (turns, predicate, radius = 2) => {
  const index = turns.findIndex(predicate);
  if (index === -1) {
    return null;
  }
  return {
    start: Math.max(0, index - radius),
    end: Math.min(turns.length - 1, index + radius)
  };
};

const sliceTurns = (turns, window) => {
  if (!window) {
    return [];
  }
  return turns.slice(window.start, window.end + 1).map((turn) => ({
    index: turn.index,
    authorRole: turn.authorRole,
    author: turn.author,
    text: turn.text
  }));
};

const buildProposal = ({
  id,
  title,
  category,
  implementationScope,
  priority,
  rationale,
  expectedBehaviors,
  sourceConversationId,
  turns
}) => ({
  id,
  title,
  category,
  implementationScope,
  priority,
  rationale,
  sourceConversationId,
  turnCount: turns.length,
  sampleTurns: turns,
  expectedBehaviors
});

const pushProposalIfValid = (proposals, proposal) => {
  if (!proposal || !Array.isArray(proposal.sampleTurns) || proposal.sampleTurns.length === 0) {
    return;
  }
  proposals.push(proposal);
};

export const proposeRegressionFixtures = (manifest) => {
  const labels = new Set(manifest.classification.labels);
  const turns = manifest.turns;
  const proposals = [];

  if (labels.has("quote_request") && labels.has("structured_measurements")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        turn.authorRole === "customer" &&
        (/presupuesto|cotiz/i.test(turn.text) || hasMeasurementPattern(turn.text)),
      2
    );
    pushProposalIfValid(proposals,
      buildProposal({
        id: `${manifest.conversationId}:quote-structured-measurements`,
        title: "Cotización con medidas estructuradas y recomendación técnica",
        category: "runtime_regression_candidate",
        priority: "high",
        rationale:
          "La conversación real muestra pedido comercial con medidas, recomendación técnica y cierre claro. Sirve para evitar respuestas genéricas o pérdida de contexto en cotizaciones.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "mantener todas las medidas sin colapsarlas en un resumen pobre",
          "pedir solo el dato faltante si la cotización no puede resolverse completa",
          "poder recomendar división técnica o línea adecuada sin perder tono comercial"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("multimodal_audio") || labels.has("multimodal_image")) {
    const window = findTurnWindow(
      turns,
      (turn) => ensureArray(turn.attachmentRefs).length > 0,
      3
    );
    pushProposalIfValid(proposals,
      buildProposal({
        id: `${manifest.conversationId}:multimodal-clarification`,
        title: "Continuidad conversacional con audio e imagen en WhatsApp",
        category: "multimodal_regression_candidate",
        priority: "high",
        rationale:
          "El hilo incluye adjuntos reales con contexto progresivo. Es útil para validar transcript, continuidad y referencia correcta a imágenes/audios sin duplicación ni pérdida de contexto.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "registrar audio/imagen como elementos de mensaje sin perder el texto acompañante",
          "mantener continuidad después de varios adjuntos seguidos",
          "evitar fallback genérico cuando el contexto multimodal ya aporta claridad"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("appointment_scheduling")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        /agendar|agendamos|jueves|direccion|dirección|horario|visita/i.test(turn.text),
      2
    );
    pushProposalIfValid(proposals,
      buildProposal({
        id: `${manifest.conversationId}:schedule-follow-up`,
        title: "Agenda de visita con confirmación y captura de dirección",
        category: "stateful_regression_candidate",
        priority: "high",
        rationale:
          "Sirve para cerrar el gap actual del flujo multi-turno de agenda y confirmación operativa.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "mantener estado pendiente hasta capturar día, franja o dirección",
          "no ejecutar confirmaciones ambiguas fuera de flujo",
          "cerrar la agenda con confirmación clara y sin perder datos previos"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("support_service")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        /service|repar|dejo de funcionar|dejó de funcionar|moverla|acortarla|acortar|ajustar/i.test(
          turn.text
        ),
      2
    );
    pushProposalIfValid(proposals,
      buildProposal({
        id: `${manifest.conversationId}:support-service`,
        title: "Postventa y service sobre producto ya instalado",
        category: "support_regression_candidate",
        priority: "high",
        rationale:
          "La conversación real abre un caso de service o ajuste sobre un producto existente. Debe resolverse como soporte operativo y no como cotización nueva ni como frustración genérica.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "detectar pedidos de service o revisión sin degradarlos a consulta comercial genérica",
          "pedir el dato mínimo útil sobre el producto o el ajuste necesario",
          "poder derivar naturalmente a coordinación de visita si hace falta"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("payment_terms")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        turn.authorRole === "business" &&
        /transferencia|efectivo|mercado pago|seña|saldo/i.test(turn.text),
      2
    );
    pushProposalIfValid(proposals,
      buildProposal({
        id: `${manifest.conversationId}:payment-terms`,
        title: "Condiciones comerciales y medios de pago en contexto de presupuesto",
        category: "knowledge_first_regression_candidate",
        priority: "medium",
        rationale:
          "Aporta wording comercial real para validar que las respuestas de pagos no arrastren contexto equivocado ni devuelvan texto crudo.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "responder medios de pago con wording claro y corto",
          "mantener contexto comercial sin convertirlo en catálogo",
          "separar medios de pago de otras preguntas de producto o agenda"
        ],
        implementationScope: "tenant_specific_knowledge_or_policy"
      })
    );
  }

  if (labels.has("quote_follow_up") || labels.has("clarification_loop")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        /no me quedo claro|no me quedó claro|aclar/i.test(turn.text),
      3
    );
    pushProposalIfValid(proposals,
      buildProposal({
        id: `${manifest.conversationId}:quote-clarification`,
        title: "Aclaración de presupuesto ya emitido sin reiniciar el contexto",
        category: "follow_up_regression_candidate",
        priority: "high",
        rationale:
          "Valida follow-up largo y aclaración de total, accesorios o alcance del presupuesto sin perder el hilo previo.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "retomar el presupuesto previo sin pedir de nuevo toda la información",
          "explicar totales y componentes en texto claro",
          "mantener consistencia entre presupuesto original y aclaración posterior"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("system_message_interference")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        turn.kind === "system" ||
        /\b(respuesta automatica|gracias por tu mensaje|fuera de horario|mensaje automatico)\b/i.test(
          turn.text
        ),
      3
    );
    pushProposalIfValid(
      proposals,
      buildProposal({
        id: `${manifest.conversationId}:system-message-interference`,
        title: "Ruido del canal y respuestas automáticas no deben contaminar el hilo",
        category: "channel_noise_regression_candidate",
        priority: "high",
        rationale:
          "El transcript contiene mensajes de sistema o respuestas automáticas que deben persistirse por auditoría, pero no desviar intención, follow-up ni retrieval.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "persistir mensajes automáticos o de sistema con tipo/origen explícito",
          "excluir ese ruido del razonamiento conversacional",
          "mantener continuidad sobre el último turno humano relevante"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("reengagement_after_gap")) {
    const window = findTurnWindow(
      turns,
      (turn, index) => {
        if (index === 0 || !turn?.timestamp || !turns[index - 1]?.timestamp) {
          return false;
        }
        const gapHours =
          (new Date(turn.timestamp).getTime() -
            new Date(turns[index - 1].timestamp).getTime()) /
          3_600_000;
        return gapHours >= 24;
      },
      3
    );
    pushProposalIfValid(
      proposals,
      buildProposal({
        id: `${manifest.conversationId}:reengagement-after-gap`,
        title: "Reenganche tras silencio prolongado sin reiniciar mal el contexto",
        category: "follow_up_regression_candidate",
        priority: "medium",
        rationale:
          "El hilo se retoma después de una pausa real. Sirve para validar cuándo conviene heredar contexto y cuándo pedir una precisión mínima.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "detectar la pausa temporal y evitar continuidad ciega",
          "retomar el tema solo si el nuevo turno lo referencia de forma clara",
          "pedir el mínimo dato si el hilo quedó ambiguo tras el gap"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("operational_thread_switch")) {
    const window = findTurnWindow(
      turns,
      (turn) =>
        /\b(agendar|coordinar|visita|instalaci[oó]n|colocaci[oó]n|direcci[oó]n|horario)\b/i.test(
          turn.text
        ),
      3
    );
    pushProposalIfValid(
      proposals,
      buildProposal({
        id: `${manifest.conversationId}:operational-thread-switch`,
        title: "Cambio de hilo desde consulta hacia coordinación operativa",
        category: "stateful_regression_candidate",
        priority: "high",
        rationale:
          "La conversación pasa de entender el caso a coordinar ejecución. El runtime debe separar ambos hilos sin mezclar respuesta conceptual con operativa.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "detectar cambio de eje sin perder el tema previo",
          "resolver coordinación operativa con pedidos mínimos y concretos",
          "no seguir contestando como si todavía fuera una consulta general"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("outbound_follow_up")) {
    const window = findTurnWindow(
      turns,
      (turn, index) =>
        turn.authorRole === "business" &&
        (index === 0 ||
          (turns[index - 1]?.timestamp &&
            turn.timestamp &&
            (new Date(turn.timestamp).getTime() -
              new Date(turns[index - 1].timestamp).getTime()) /
              3_600_000 >=
              24)),
      2
    );
    pushProposalIfValid(
      proposals,
      buildProposal({
        id: `${manifest.conversationId}:outbound-follow-up`,
        title: "Follow-up saliente del negocio sin romper el hilo existente",
        category: "follow_up_regression_candidate",
        priority: "medium",
        rationale:
          "Existen conversaciones iniciadas o retomadas por el negocio. Esto exige distinguir respuesta saliente operativa de una consulta nueva del cliente.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "reconocer contacto saliente del negocio como evento distinto de un inbound del cliente",
          "no disparar clasificación de intención del cliente sobre un follow-up saliente",
          "mantener trazabilidad del hilo sin contaminar memoria corta"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  if (labels.has("abandoned_thread")) {
    const window = {
      start: Math.max(0, turns.length - 4),
      end: Math.max(0, turns.length - 1)
    };
    pushProposalIfValid(
      proposals,
      buildProposal({
        id: `${manifest.conversationId}:abandoned-thread`,
        title: "Hilo abandonado o de baja señal debe cerrar con prudencia",
        category: "runtime_regression_candidate",
        priority: "medium",
        rationale:
          "Hay conversaciones muy cortas o inconclusas donde el sistema no debe sobreinferir ni construir un contexto fuerte sobre señal insuficiente.",
        sourceConversationId: manifest.conversationId,
        turns: sliceTurns(turns, window),
        expectedBehaviors: [
          "pedir aclaración mínima en lugar de inventar contexto",
          "no tratar un hilo inconcluso como caso totalmente resuelto",
          "mantener una salida breve y prudente en conversaciones de baja señal"
        ],
        implementationScope: "runtime_general"
      })
    );
  }

  return proposals;
};

const renderMarkdownSummary = (index) => {
  const lines = [
    "# WhatsApp Real Corpus QA",
    "",
    `Generado: ${index.generatedAt}`,
    `Source dir: ${index.sourceDir}`,
    "",
    `Conversaciones procesadas: ${index.summary.totalConversations}`,
    `Mensajes: ${index.summary.totalTurns}`,
    ""
  ];

  lines.push("## Etiquetas detectadas", "");
  for (const [label, count] of Object.entries(index.summary.labelCounts)) {
    lines.push(`- ${label}: ${count}`);
  }

  lines.push("", "## Perfiles de hilo", "");
  for (const [bucket, count] of Object.entries(index.summary.threadProfileCounts || {})) {
    lines.push(`- ${bucket}: ${count}`);
  }

  lines.push("", "## Conversaciones", "");
  for (const conversation of index.conversations) {
    lines.push(`- ${conversation.name}`);
    lines.push(`  id: ${conversation.conversationId}`);
    lines.push(`  turns: ${conversation.turnCount}`);
    lines.push(`  etiquetas: ${conversation.labels.join(", ") || "sin clasificar"}`);
    lines.push(
      `  scope general: ${conversation.scope.generalRuntimeLabels.join(", ") || "sin señales"}`
    );
    lines.push(
      `  scope tenant: ${conversation.scope.tenantSpecificLabels.join(", ") || "sin señales"}`
    );
    lines.push(
      `  perfil: ${conversation.threadProfile?.buckets?.join(", ") || conversation.threadProfile?.initiatedBy || "sin perfil"}`
    );
    lines.push(`  propuestas: ${conversation.proposalCount}`);
  }

  lines.push("", "## Propuestas automáticas", "");
  for (const proposal of index.proposals) {
    lines.push(`- ${proposal.title} [${proposal.priority}]`);
    lines.push(`  conversación: ${proposal.sourceConversationId}`);
    lines.push(`  categoría: ${proposal.category}`);
    lines.push(`  scope: ${proposal.implementationScope}`);
  }

  lines.push("");
  return lines.join("\n");
};

const summarizeIndex = (conversations, proposals) => {
  const labelCounts = {};
  const threadProfileCounts = {
    customer_initiated: 0,
    business_initiated: 0,
    channel_interfered: 0
  };
  let totalTurns = 0;
  for (const conversation of conversations) {
    totalTurns += conversation.turnCount;
    for (const label of conversation.labels) {
      labelCounts[label] = (labelCounts[label] ?? 0) + 1;
    }
    for (const bucket of conversation.threadProfile?.buckets ?? []) {
      threadProfileCounts[bucket] = (threadProfileCounts[bucket] ?? 0) + 1;
    }
  }
  return {
    totalConversations: conversations.length,
    totalTurns,
    totalProposals: proposals.length,
    labelCounts,
    threadProfileCounts
  };
};

export async function listZipEntries(zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath], {
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({
      name: entry,
      extension: path.extname(entry).toLowerCase(),
      type: attachmentTypeFromName(entry),
      kind: entry.toLowerCase().endsWith(".txt") ? "transcript" : "attachment"
    }));
}

export async function readZipEntryText(zipPath, entryName) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, entryName], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  return stdout;
}

const findFirstExtractedTranscript = async (dirPath) => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const sortedEntries = entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of sortedEntries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstExtractedTranscript(fullPath);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) {
      return fullPath;
    }
  }

  return null;
};

const readTranscriptFromExtractedArchive = async (zipPath) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "whatsapp-corpus-"));

  try {
    await execFileAsync("ditto", ["-x", "-k", zipPath, tempDir], {
      maxBuffer: 50 * 1024 * 1024
    });

    const transcriptPath = await findFirstExtractedTranscript(tempDir);
    if (!transcriptPath) {
      throw new Error(`No transcript .txt found after extracting ${zipPath}`);
    }

    return await readFile(transcriptPath, "utf8");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export async function buildConversationManifestFromZip(zipPath) {
  const archiveEntries = await listZipEntries(zipPath);
  const transcriptEntry = archiveEntries.find((entry) => entry.kind === "transcript");
  if (!transcriptEntry) {
    throw new Error(`No transcript .txt found inside ${zipPath}`);
  }

  const zipBuffer = await readFile(zipPath);
  const zipSha1 = createHash("sha1").update(zipBuffer).digest("hex");
  let transcript = "";
  try {
    transcript = await readZipEntryText(zipPath, transcriptEntry.name);
  } catch {
    transcript = await readTranscriptFromExtractedArchive(zipPath);
  }
  const parsed = parseWhatsAppTranscript(transcript, archiveEntries);
  const conversationId = slugify(path.basename(zipPath, ".zip")) || zipSha1.slice(0, 12);

  const manifest = {
    conversationId,
    source: {
      zipPath,
      zipName: path.basename(zipPath),
      zipSha1,
      transcriptName: transcriptEntry.name
    },
    participants: parsed.participants,
    turns: parsed.entries,
    attachments: archiveEntries.filter((entry) => entry.kind === "attachment"),
    stats: {
      turnCount: parsed.entries.length,
      attachmentCount: archiveEntries.filter((entry) => entry.kind === "attachment").length,
      attachmentTypes: countAttachmentsByType(parsed.entries),
      startedAt: parsed.entries[0]?.timestamp ?? null,
      endedAt: parsed.entries.at(-1)?.timestamp ?? null,
      spanDays: conversationSpanDays(parsed.entries),
      maxGapHours: buildConversationGaps(parsed.entries).reduce(
        (max, gap) => Math.max(max, gap.hours),
        0
      )
    }
  };

  const labels = classifyConversationCases(manifest);
  const scope = deriveClassificationScope(labels);
  const threadProfile = deriveThreadProfile(manifest.turns, labels);
  const proposals = proposeRegressionFixtures({
    ...manifest,
    classification: { labels, scope, threadProfile }
  });

  return {
    ...manifest,
    classification: { labels, scope, threadProfile },
    proposals
  };
}

export async function ingestWhatsAppCorpus({
  sourceDir,
  outputDir
}) {
  const resolvedSourceDir = path.resolve(sourceDir);
  const resolvedOutputDir = path.resolve(outputDir);

  try {
    await access(resolvedSourceDir);
  } catch {
    return {
      status: "skipped",
      sourceDir: resolvedSourceDir,
      reason: "source_dir_missing"
    };
  }

  const entries = await readdir(resolvedSourceDir, {
    withFileTypes: true
  });
  const zipFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
    .map((entry) => path.join(resolvedSourceDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  await rm(resolvedOutputDir, { recursive: true, force: true });
  await mkdir(resolvedOutputDir, { recursive: true });
  const manifestsDir = path.join(resolvedOutputDir, "manifests");
  const proposalsDir = path.join(resolvedOutputDir, "proposals");
  await mkdir(manifestsDir, { recursive: true });
  await mkdir(proposalsDir, { recursive: true });

  const conversations = [];
  const proposals = [];

  for (const zipPath of zipFiles) {
    const manifest = await buildConversationManifestFromZip(zipPath);
    const manifestPath = path.join(manifestsDir, `${manifest.conversationId}.json`);
    const proposalPath = path.join(proposalsDir, `${manifest.conversationId}.json`);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    await writeFile(proposalPath, JSON.stringify(manifest.proposals, null, 2), "utf8");

    conversations.push({
      conversationId: manifest.conversationId,
      name: manifest.source.zipName,
      manifestPath,
      proposalPath,
      turnCount: manifest.stats.turnCount,
      labels: manifest.classification.labels,
      scope: manifest.classification.scope,
      threadProfile: manifest.classification.threadProfile,
      proposalCount: manifest.proposals.length,
      startedAt: manifest.stats.startedAt,
      endedAt: manifest.stats.endedAt,
      attachmentTypes: manifest.stats.attachmentTypes
    });

    proposals.push(...manifest.proposals);
  }

  const index = {
    generatedAt: new Date().toISOString(),
    sourceDir: resolvedSourceDir,
    outputDir: resolvedOutputDir,
    conversations,
    proposals,
    summary: summarizeIndex(conversations, proposals)
  };

  await writeFile(path.join(resolvedOutputDir, "index.json"), JSON.stringify(index, null, 2), "utf8");
  await writeFile(path.join(resolvedOutputDir, "summary.md"), renderMarkdownSummary(index), "utf8");

  return {
    status: "ok",
    sourceDir: resolvedSourceDir,
    outputDir: resolvedOutputDir,
    conversations: conversations.length,
    proposals: proposals.length,
    summary: index.summary
  };
}
