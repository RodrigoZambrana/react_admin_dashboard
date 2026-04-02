#!/usr/bin/env node

import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { AiAgentClient } from '../../services/channel-adapter/src/clients/ai-agent.client.js'
import { BackendConversationsClient } from '../../services/channel-adapter/src/clients/backend-conversations.client.js'
import { WhatsappQrAdapter } from '../../services/channel-adapter/src/channels/whatsapp-qr/whatsapp-qr.adapter.js'
import { estimatePendingUtteranceDelay } from '../../services/channel-adapter/src/runtime/pending-utterance-assembler.js'
import { isSystemNoiseMessage } from '../../services/ai-agent-service/src/ai/ingress/system-noise.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

const DEFAULT_CORPUS_DIR = path.join(
  repoRoot,
  '.qa',
  'external-real-conversations',
  'whatsapp',
)
const DEFAULT_OUTPUT_ROOT = path.join(repoRoot, '.qa', 'runs')
const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:4000/api'
const DEFAULT_AI_AGENT_BASE_URL = 'http://127.0.0.1:4100'
const DEFAULT_INTERNAL_TOKEN = 'local-ai-internal-token'
const DEFAULT_TENANT_KEY = 'urucortinas'
const DEFAULT_QUIET_WINDOW_MS = 900
const DEFAULT_MAX_WINDOW_MS = 8000
const DEFAULT_RETRY_ATTEMPTS = 6
const DEFAULT_RETRY_INITIAL_DELAY_MS = 1500
const BACKEND_UNSAFE_PATTERNS = [
  /('|\")\s*or\s+(\d+|true|false|null)/gi,
  /\bUNION\b\s+\bSELECT\b/gi,
  /\bDROP\b\s+\bTABLE\b/gi,
  /\bTRUNCATE\b\s+\bTABLE\b/gi,
  /\bALTER\b\s+\bTABLE\b/gi,
  /\bEXEC(UTE)?\b/gi,
  /\bINSERT\b\s+\bINTO\b/gi,
  /\bDELETE\b\s+\bFROM\b/gi,
  /\bUPDATE\b\s+\bSET\b/gi,
  /--/g,
  /\/\*/g,
  /\*\//g,
  /<[^>]+>/g,
]

const GENERIC_CLARIFICATION_REGEX =
  /\b(no me queda claro|contame un poco m[aá]s|decime un poco m[aá]s|quer[eé]s contarme un poco m[aá]s|no llego a entender|no termino de entender)\b/iu
const GENERIC_CLOSURE_REGEX =
  /\b(cualquier cosa me escrib[ií]s|cuando quieras retomarlo seguimos por ac[aá]|si quer[eé]s seguimos por ac[aá]|quedo atento|quedamos a las [oó]rdenes)\b/iu
const HUMAN_HANDOFF_REGEX =
  /\b(asesor|equipo|un operador|una persona|te contacta|te escribe|contin[uú]a contigo|derivo|derivamos|validaci[oó]n adicional)\b/iu
const MEASUREMENTS_ASK_REGEX =
  /\b(medidas?|ancho por alto|medida aproximada|cu[aá]nto mide|dimensiones?)\b/iu
const QUANTITY_ASK_REGEX = /\b(cu[aá]ntas? unidades|cantidad)\b/iu
const PRODUCT_ASK_REGEX =
  /\b(qu[eé] producto|qu[eé] quer[eé]s cotizar|qu[eé] opci[oó]n buscas|qu[eé] servicio te interesa)\b/iu
const ADDRESS_ASK_REGEX = /\b(direcci[oó]n|zona|ubicaci[oó]n)\b/iu
const DATE_ASK_REGEX =
  /\b(qu[eé]\s+d[ií]a|qu[eé]\s+dia|d[ií]a te queda bien|d[ií]a te sirve)\b/iu
const TIME_ASK_REGEX =
  /\b(horario|a\s+qu[eé]\s+hora|a\s+que\s+hora|hora te queda|hora te sirve)\b/iu
const QUOTE_SIGNAL_REGEX =
  /\b(cotiza|cotizaci[oó]n|presupuesto|medidas?|ancho|alto|cantidad|unidades|precio|roller|screen|blackout|persiana|cortina|abertura|ventana|puerta|mosquitero|vidrio)\b/iu
const SCHEDULE_SIGNAL_REGEX =
  /\b(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo|ma[nñ]ana|pasado ma[nñ]ana|horario|direcci[oó]n|zona|\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/iu
const MEASUREMENT_VALUE_REGEX =
  /\b\d{1,3}(?:[.,]\d{1,2})?\s?(?:x|×|por)\s?\d{1,3}(?:[.,]\d{1,2})?(?:\s?(?:m|mt|mts|cm|cms|mm))?\b/iu
const QUANTITY_VALUE_REGEX =
  /\b(?:son|somos|quiero|necesito|preciso)?\s*(\d{1,3})\s*(?:unidades?|puertas?|ventanas?|cortinas?|aberturas?)\b/iu
const PRODUCT_VALUE_REGEX =
  /\b(?:roller|screen|blackout|persiana|cortina|ventana|abertura|puerta|mosquitero|vidrio)\b/iu

const STOPWORDS = new Set([
  'a',
  'al',
  'algo',
  'con',
  'como',
  'de',
  'del',
  'el',
  'en',
  'es',
  'esta',
  'este',
  'hola',
  'la',
  'las',
  'lo',
  'los',
  'me',
  'necesito',
  'para',
  'pero',
  'por',
  'que',
  'se',
  'si',
  'te',
  'tu',
  'un',
  'una',
  'y',
  'ya',
])

const CATEGORY_TEMPLATES = Object.freeze({
  topic_loss: {
    likelyLayer: 'turn interpretation',
    rootCause:
      'La decisión del turno no está priorizando la evidencia estructural ya presente sobre producto/tópico antes de resolver qué falta pedir.',
    globalFix:
      'Promover un contrato intermedio donde tópico reconocido, variante y señales léxicas persistidas se evalúen antes de caer en pregunta abierta de producto.',
    rejectPatch:
      'Agregar keywords puntuales en runtime sólo tapa el síntoma y no corrige la pérdida de continuidad entre señales, parsing y decisión.',
  },
  measurement_parse_gap: {
    likelyLayer: 'quote context',
    rootCause:
      'Las medidas llegan en el turno pero no terminan consolidadas como evidencia estructural reusable dentro del quote seed.',
    globalFix:
      'Separar extractor de medidas del resolvedor de tópico y persistir measurement items normalizados como source of truth del contexto de cotización.',
    rejectPatch:
      'Una regex puntual por frase no resuelve la variabilidad de formato ni evita que otra capa vuelva a pedir el mismo dato.',
  },
  quote_intake_reopened: {
    likelyLayer: 'resolution readiness',
    rootCause:
      'La evaluación de readiness no está consumiendo de forma consistente los datos ya capturados, por lo que reabre intake aunque el contexto base ya exista.',
    globalFix:
      'Unificar el contrato de quote context entre extracción, memoria y readiness para que los missing fields se calculen sobre evidencia consolidada.',
    rejectPatch:
      'Parchear preguntas o wording no evita que el runtime siga creyendo que faltan datos que ya fueron provistos.',
  },
  generic_fallback_overreach: {
    likelyLayer: 'detectIntent',
    rootCause:
      'La clasificación del turno está degradando a fallback o aclaración genérica aun cuando el mensaje ya trae intención y señales accionables.',
    globalFix:
      'Elevar el peso de evidence-based turn interpretation y separar fallback por falta real de señal frente a fallback por baja confianza del clasificador.',
    rejectPatch:
      'Cambiar frases de fallback deja intacta la decisión equivocada que llevó al sistema a responder genérico.',
  },
  loop_reentry: {
    likelyLayer: 'loop prevention',
    rootCause:
      'La prevención de loop entra tarde o con poca sensibilidad a respuestas repetidas sobre el mismo slot sin avance de estado.',
    globalFix:
      'Hacer que loop prevention lea estado conversacional y slots ya pedidos/resueltos, no sólo similitud superficial del wording.',
    rejectPatch:
      'Retocar una respuesta repetida no elimina la condición estructural que vuelve a generar el loop.',
  },
  handoff_too_early: {
    likelyLayer: 'resolution readiness',
    rootCause:
      'El runtime está marcando derivación o needsHuman antes de agotar la captura estructural que sí está dentro del alcance del chat.',
    globalFix:
      'Rebalancear readiness y policy para diferenciar bloqueo real de casos donde todavía hay progreso estructural posible.',
    rejectPatch:
      'Sacar la palabra asesor del texto no corrige que el contrato de readiness esté cerrando demasiado pronto.',
  },
  shaping_overcompensation: {
    likelyLayer: 'render outcome / wording',
    rootCause:
      'El shaping está intentando compensar una decisión conversacional débil y termina generando una salida prolija pero semánticamente pobre.',
    globalFix:
      'Mover estilo y wording a policy/registry y exigir que el payload previo al shaping llegue con outcome, slots y next step bien definidos.',
    rejectPatch:
      'Parchear wording sólo maquilla el síntoma y deja roto el contrato base upstream.',
  },
  policy_vs_core_leak: {
    likelyLayer: 'render outcome / wording',
    rootCause:
      'Hay boilerplate o wording operativo acoplado al runtime central en vez de resolverse desde policy/registry.',
    globalFix:
      'Extraer wording dependiente de idioma o tenant a un registro de policy y mantener el core sobre contratos estructurales.',
    rejectPatch:
      'Meter otra frase fija en el core profundiza la fuga entre policy y runtime.',
  },
  runtime_error: {
    likelyLayer: 'render outcome / wording',
    rootCause:
      'La corrida no pudo completar el turno por un error operacional del stack local.',
    globalFix:
      'Asegurar preflight de servicios y tolerancia a fallos por turno para que la corrida siga siendo auditable aun con errores parciales.',
    rejectPatch:
      'Ignorar el error deja corridas opacas y no reproducibles.',
  },
})

function parseArgs(argv) {
  const options = {
    corpusDir: DEFAULT_CORPUS_DIR,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    backendBaseUrl: DEFAULT_BACKEND_BASE_URL,
    aiAgentBaseUrl: DEFAULT_AI_AGENT_BASE_URL,
    internalToken: DEFAULT_INTERNAL_TOKEN,
    tenantKey: DEFAULT_TENANT_KEY,
    retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    retryInitialDelayMs: DEFAULT_RETRY_INITIAL_DELAY_MS,
    limitConversations: null,
    limitTurns: null,
    includeReferenceReplies: true,
    resumeRunDir: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--corpus-dir') {
      options.corpusDir = argv[index + 1] ?? options.corpusDir
      index += 1
      continue
    }
    if (arg.startsWith('--corpus-dir=')) {
      options.corpusDir = arg.slice('--corpus-dir='.length)
      continue
    }
    if (arg === '--output-root') {
      options.outputRoot = argv[index + 1] ?? options.outputRoot
      index += 1
      continue
    }
    if (arg.startsWith('--output-root=')) {
      options.outputRoot = arg.slice('--output-root='.length)
      continue
    }
    if (arg === '--backend-base-url') {
      options.backendBaseUrl = argv[index + 1] ?? options.backendBaseUrl
      index += 1
      continue
    }
    if (arg.startsWith('--backend-base-url=')) {
      options.backendBaseUrl = arg.slice('--backend-base-url='.length)
      continue
    }
    if (arg === '--ai-agent-base-url') {
      options.aiAgentBaseUrl = argv[index + 1] ?? options.aiAgentBaseUrl
      index += 1
      continue
    }
    if (arg.startsWith('--ai-agent-base-url=')) {
      options.aiAgentBaseUrl = arg.slice('--ai-agent-base-url='.length)
      continue
    }
    if (arg === '--internal-token') {
      options.internalToken = argv[index + 1] ?? options.internalToken
      index += 1
      continue
    }
    if (arg.startsWith('--internal-token=')) {
      options.internalToken = arg.slice('--internal-token='.length)
      continue
    }
    if (arg === '--tenant-key') {
      options.tenantKey = argv[index + 1] ?? options.tenantKey
      index += 1
      continue
    }
    if (arg.startsWith('--tenant-key=')) {
      options.tenantKey = arg.slice('--tenant-key='.length)
      continue
    }
    if (arg === '--retry-attempts') {
      const parsed = Number(argv[index + 1] ?? '')
      options.retryAttempts =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : options.retryAttempts
      index += 1
      continue
    }
    if (arg.startsWith('--retry-attempts=')) {
      const parsed = Number(arg.slice('--retry-attempts='.length))
      options.retryAttempts =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : options.retryAttempts
      continue
    }
    if (arg === '--retry-initial-delay-ms') {
      const parsed = Number(argv[index + 1] ?? '')
      options.retryInitialDelayMs =
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : options.retryInitialDelayMs
      index += 1
      continue
    }
    if (arg.startsWith('--retry-initial-delay-ms=')) {
      const parsed = Number(arg.slice('--retry-initial-delay-ms='.length))
      options.retryInitialDelayMs =
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : options.retryInitialDelayMs
      continue
    }
    if (arg === '--limit-conversations') {
      const parsed = Number(argv[index + 1] ?? '')
      options.limitConversations =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
      index += 1
      continue
    }
    if (arg.startsWith('--limit-conversations=')) {
      const parsed = Number(arg.slice('--limit-conversations='.length))
      options.limitConversations =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
      continue
    }
    if (arg === '--limit-turns') {
      const parsed = Number(argv[index + 1] ?? '')
      options.limitTurns = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
      index += 1
      continue
    }
    if (arg.startsWith('--limit-turns=')) {
      const parsed = Number(arg.slice('--limit-turns='.length))
      options.limitTurns = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
      continue
    }
    if (arg === '--no-reference-replies') {
      options.includeReferenceReplies = false
      continue
    }
    if (arg === '--resume-run-dir') {
      options.resumeRunDir = argv[index + 1] ?? options.resumeRunDir
      index += 1
      continue
    }
    if (arg.startsWith('--resume-run-dir=')) {
      options.resumeRunDir = arg.slice('--resume-run-dir='.length)
      continue
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: node .qa/bin/replay-real-corpus-run.mjs [options]',
          '',
          'Options:',
          '  --corpus-dir <path>           Corpus root with manifests/ directory.',
          '  --output-root <path>          Base output directory. Default: .qa/runs.',
          '  --backend-base-url <url>      Backend API base URL. Default: http://127.0.0.1:4000/api.',
          '  --ai-agent-base-url <url>     AI agent base URL. Default: http://127.0.0.1:4100.',
          '  --internal-token <token>      Internal token for backend/channel-adapter contracts.',
          '  --tenant-key <slug>           Tenant key used in replay. Default: urucortinas.',
          '  --retry-attempts <n>          Retry attempts for 429/5xx from backend or ai-agent.',
          '  --retry-initial-delay-ms <n>  Initial retry backoff. Default: 1500.',
          '  --limit-conversations <n>     Limit conversations for smoke runs.',
          '  --limit-turns <n>             Limit semantic turns per conversation for smoke runs.',
          '  --no-reference-replies        Omit original business turns from trace output.',
          '  --resume-run-dir <path>       Resume an existing run directory and skip completed conversations.',
        ].join('\n'),
      )
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function shouldRetryReplayError(error) {
  const message = String(error instanceof Error ? error.message : error || '')
  return /\b429\b|RATE\.LIMITED|http_408|http_409|http_425|http_429|http_500|http_502|http_503|http_504/i.test(
    message,
  )
}

function extractRetryDelayMs(error, fallbackDelayMs) {
  const message = String(error instanceof Error ? error.message : error || '')
  const retryAfterMatch = message.match(/"retryAfter"\s*:\s*(\d{1,5})/i)
  if (retryAfterMatch) {
    const retryAfterSeconds = Number(retryAfterMatch[1])
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000
    }
  }
  return fallbackDelayMs
}

async function withReplayRetry(task, options, label) {
  const maxAttempts = Math.max(0, Number(options.retryAttempts || 0))
  let delayMs = Math.max(
    250,
    Number(options.retryInitialDelayMs || DEFAULT_RETRY_INITIAL_DELAY_MS),
  )

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetryReplayError(error)) {
        throw error
      }

      const effectiveDelayMs = Math.max(250, extractRetryDelayMs(error, delayMs))
      console.warn(
        `[corpus-replay] retry ${attempt + 1}/${maxAttempts} after ${label}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      await delay(effectiveDelayMs)
      delayMs = Math.min(Math.max(delayMs * 2, effectiveDelayMs), 60_000)
    }
  }
}

const sanitizeForBackend = (value) => {
  if (typeof value !== 'string') {
    return value
  }

  let sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()

  for (const pattern of BACKEND_UNSAFE_PATTERNS) {
    sanitized = sanitized.replace(pattern, ' ')
  }

  return sanitized.replace(/\s+/g, ' ').trim()
}

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !STOPWORDS.has(entry))
}

function tokenJaccard(left, right) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  if (!leftSet.size && !rightSet.size) {
    return 1
  }
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length
  const union = new Set([...leftSet, ...rightSet]).size
  return union === 0 ? 0 : intersection / union
}

function toAttachmentKind(value) {
  switch (String(value || '').toLowerCase()) {
    case 'image':
      return 'image'
    case 'audio':
      return 'audio'
    case 'video':
      return 'video'
    case 'pdf':
      return 'pdf'
    case 'csv':
      return 'csv'
    case 'xls':
    case 'xlsx':
    case 'sheet':
    case 'excel':
      return 'xlsx'
    case 'doc':
    case 'docx':
    case 'document':
    case 'word':
      return 'docx'
    case 'txt':
    case 'md':
    case 'json':
    case 'text':
      return 'text'
    default:
      return null
  }
}

function isDeletedTurn(turn) {
  return normalizeText(turn?.text) === 'se elimino este mensaje.'
}

function buildTurnAttachments(turn) {
  const refs = Array.isArray(turn?.attachmentRefs) ? turn.attachmentRefs : []
  return refs
    .map((ref, index) => {
      const fileName = typeof ref?.name === 'string' ? ref.name : null
      const extension = fileName?.split('.').pop() || null
      const assetType = toAttachmentKind(ref?.type) || toAttachmentKind(extension)
      if (!assetType) {
        return null
      }
      return {
        id: `${turn.index || 'turn'}-attachment-${index + 1}`,
        assetType,
        fileName,
        textContent: compactText(turn?.text || '') || null,
        metadata: {
          corpusAttachmentPath: typeof ref?.path === 'string' ? ref.path : null,
          corpusAttachmentType: typeof ref?.type === 'string' ? ref.type : null,
        },
      }
    })
    .filter(Boolean)
}

function buildTurnText(turn) {
  const rawText = compactText(turn?.text || '')
  const normalized = normalizeText(rawText)
  const normalizedWithoutBrackets = normalized.replace(/[<>]/g, '').trim()
  if (!rawText || isDeletedTurn(turn)) {
    return ''
  }
  if (isSystemNoiseMessage(rawText)) {
    return ''
  }
  if (normalizedWithoutBrackets === 'multimedia omitido') {
    return ''
  }
  return rawText
}

function isEvaluableCustomerTurn(turn) {
  return (
    turn?.kind === 'message' &&
    turn?.authorRole === 'customer' &&
    (!isDeletedTurn(turn) || buildTurnAttachments(turn).length > 0) &&
    (buildTurnText(turn).length > 0 || buildTurnAttachments(turn).length > 0)
  )
}

function buildAssemblerItems(turns) {
  return turns.map((turn) => {
    const text = buildTurnText(turn)
    const attachments = buildTurnAttachments(turn)
    return {
      text,
      attachments,
      normalized: {
        text,
        attachments,
      },
    }
  })
}

function canMergeSemanticTurn(currentTurns, candidateTurn) {
  if (!currentTurns.length) {
    return false
  }

  const previousTurn = currentTurns.at(-1)
  if (!previousTurn?.timestamp || !candidateTurn?.timestamp) {
    return false
  }

  const previousTimestampMs = Date.parse(previousTurn.timestamp)
  const candidateTimestampMs = Date.parse(candidateTurn.timestamp)
  if (!Number.isFinite(previousTimestampMs) || !Number.isFinite(candidateTimestampMs)) {
    return false
  }

  const diffMs = candidateTimestampMs - previousTimestampMs
  if (diffMs < 0 || diffMs > 60_000) {
    return false
  }

  if (candidateTurn.rawTimestamp === previousTurn.rawTimestamp) {
    return true
  }

  const pendingDelay = estimatePendingUtteranceDelay({
    items: buildAssemblerItems(currentTurns),
    defaultDelayMs: DEFAULT_QUIET_WINDOW_MS,
  })
  return pendingDelay > DEFAULT_QUIET_WINDOW_MS
}

function finalizeTurnGroup(conversationId, sequence, turns) {
  const attachments = turns.flatMap((turn) => buildTurnAttachments(turn))
  const textParts = turns.map((turn) => buildTurnText(turn)).filter(Boolean)
  const text = textParts.join('\n').trim()

  return {
    id: `${conversationId}:semantic-turn-${sequence}`,
    mode: 'semantic',
    text,
    attachments,
    rawInputCount: turns.length,
    rawTurnIndexes: turns.map((turn) => turn.index),
    timestamps: turns.map((turn) => turn.timestamp).filter(Boolean),
    sourceTurns: turns.map((turn) => ({
      index: turn.index,
      timestamp: turn.timestamp || null,
      rawTimestamp: turn.rawTimestamp || null,
      text: buildTurnText(turn),
      attachmentCount: buildTurnAttachments(turn).length,
    })),
  }
}

function buildEvaluatedTurns(manifest) {
  const turns = Array.isArray(manifest?.turns) ? manifest.turns : []
  const groups = []
  let current = []

  for (const turn of turns) {
    if (turn?.kind === 'message' && turn?.authorRole !== 'customer') {
      if (current.length) {
        groups.push(current)
        current = []
      }
      continue
    }

    if (!isEvaluableCustomerTurn(turn)) {
      continue
    }

    if (!current.length) {
      current.push(turn)
      continue
    }

    if (canMergeSemanticTurn(current, turn)) {
      current.push(turn)
      continue
    }

    groups.push(current)
    current = [turn]
  }

  if (current.length) {
    groups.push(current)
  }

  return groups.map((group, index) =>
    finalizeTurnGroup(manifest.conversationId, index + 1, group),
  )
}

function getCustomerDisplayName(manifest) {
  const participants = Array.isArray(manifest?.participants) ? manifest.participants : []
  return (
    participants.find((entry) => entry?.role === 'customer')?.name ||
    manifest?.conversationId ||
    'Customer'
  )
}

function buildConversationUserId(runToken, index) {
  const base = `${runToken}${String(index + 1).padStart(4, '0')}`.replace(/\D+/g, '')
  const trimmed = base.slice(0, 18)
  return trimmed.length >= 7 ? trimmed : `${trimmed}${'0'.repeat(7 - trimmed.length)}`
}

function extractFactsFromUserText(text, facts = {}) {
  const next = {
    ...facts,
  }

  if (!next.address) {
    const addressMatch =
      text.match(
        /\b(?:calle|avenida|av\.?|ruta|camino|bulevar|blvr|esquina|esq|km|kilometro|kilómetro|barrio|zona)\b[^\n]*/iu,
      ) || text.match(/\b[a-záéíóúñ\s]{3,}\s+\d{1,5}\b/iu)
    if (addressMatch) {
      next.address = compactText(addressMatch[0])
    }
  }

  if (!next.date) {
    const dateMatch = text.match(
      /\b(?:lunes|martes|miercoles|mi[eé]rcoles|jueves|viernes|sabado|s[aá]bado|domingo|ma[nñ]ana|pasado ma[nñ]ana|hoy)\b/iu,
    )
    if (dateMatch) {
      next.date = compactText(dateMatch[0])
    }
  }

  if (!next.time) {
    const timeMatch = text.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/iu)
    if (timeMatch) {
      next.time = compactText(timeMatch[0])
    }
  }

  if (!next.dimensions) {
    const measurementMatch = text.match(MEASUREMENT_VALUE_REGEX)
    if (measurementMatch) {
      next.dimensions = compactText(measurementMatch[0])
    }
  }

  if (next.quantity == null) {
    const quantityMatch = text.match(QUANTITY_VALUE_REGEX)
    if (quantityMatch) {
      next.quantity = Number(quantityMatch[1])
    }
  }

  if (!next.product) {
    const productMatch = text.match(PRODUCT_VALUE_REGEX)
    if (productMatch) {
      next.product = compactText(productMatch[0])
    }
  }

  return next
}

function inferUserGoal(turnResult, factsAfterTurn) {
  const audit = turnResult.response?.auditPayload
  const intentKey =
    typeof audit?.intentKey === 'string'
      ? audit.intentKey
      : typeof turnResult.response?.audit?.intentKey === 'string'
        ? turnResult.response.audit.intentKey
        : null
  if (intentKey) {
    return intentKey
  }

  if (factsAfterTurn.date || factsAfterTurn.time || factsAfterTurn.address) {
    return 'customer.schedule_request'
  }
  if (factsAfterTurn.product || factsAfterTurn.dimensions || factsAfterTurn.quantity != null) {
    return 'customer.quote'
  }
  if (QUOTE_SIGNAL_REGEX.test(turnResult.user.text)) {
    return 'customer.quote'
  }
  if (SCHEDULE_SIGNAL_REGEX.test(turnResult.user.text)) {
    return 'customer.schedule_request'
  }
  return 'unknown'
}

function lookupReferenceBusinessTurns(manifest, currentTurn, nextTurn) {
  const turns = Array.isArray(manifest?.turns) ? manifest.turns : []
  const lowerBound = Math.max(...currentTurn.rawTurnIndexes)
  const upperBound = nextTurn ? Math.min(...nextTurn.rawTurnIndexes) : Number.POSITIVE_INFINITY
  return turns
    .filter(
      (turn) =>
        turn.index > lowerBound &&
        turn.index < upperBound &&
        turn.kind === 'message' &&
        turn.authorRole !== 'customer',
    )
    .map((turn) => ({
      index: turn.index,
      timestamp: turn.timestamp || null,
      authorRole: turn.authorRole || null,
      text: buildTurnText(turn),
    }))
    .filter((turn) => turn.text)
}

function severityRank(severity) {
  switch (severity) {
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

function buildFinding({
  category,
  severity,
  conversationId,
  turn,
  symptom,
  userGoal,
  currentResponseProblem,
  evidence,
}) {
  const template = CATEGORY_TEMPLATES[category] || CATEGORY_TEMPLATES.generic_fallback_overreach
  return {
    severity,
    conversationId,
    turn,
    symptom,
    user_goal: userGoal,
    current_response_problem: currentResponseProblem,
    likely_layer: template.likelyLayer,
    evidence,
    root_cause_hypothesis: template.rootCause,
    global_fix_direction: template.globalFix,
    reject_local_patch_reason: template.rejectPatch,
    taxonomy: category,
  }
}

function detectTurnFindings(turnResult, state) {
  const findings = []
  const responseText = compactText(turnResult.responseText)
  const previousResponseText = compactText(state.previousResponseText)
  const responseTokens = tokenize(responseText)
  const previousResponseTokens = tokenize(previousResponseText)
  const responseSimilarity =
    previousResponseText && responseText
      ? tokenJaccard(previousResponseTokens, responseTokens)
      : 0

  const audit = turnResult.response?.auditPayload || turnResult.response?.audit || null
  const missingFields = Array.isArray(
    audit?.turnInterpretation?.conversationContext?.resolutionReadiness?.missingFields,
  )
    ? audit.turnInterpretation.conversationContext.resolutionReadiness.missingFields
    : []
  const needsHuman = turnResult.response?.needsHuman === true
  const currentHasMeasurement = Boolean(turnResult.turnFacts.current.dimensions)
  const currentHasQuantity = turnResult.turnFacts.current.quantity != null
  const currentHasProduct = Boolean(turnResult.turnFacts.current.product)
  const knownHasMeasurement = Boolean(turnResult.turnFacts.after.dimensions)
  const knownHasQuantity = turnResult.turnFacts.after.quantity != null
  const knownHasProduct = Boolean(turnResult.turnFacts.after.product)
  const quoteSignal =
    QUOTE_SIGNAL_REGEX.test(turnResult.user.text) ||
    currentHasMeasurement ||
    currentHasQuantity ||
    currentHasProduct
  const scheduleSignal =
    SCHEDULE_SIGNAL_REGEX.test(turnResult.user.text) ||
    Boolean(turnResult.turnFacts.after.address || turnResult.turnFacts.after.date || turnResult.turnFacts.after.time)

  if (turnResult.error) {
    findings.push(
      buildFinding({
        category: 'runtime_error',
        severity: 'critical',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'El turno no pudo evaluarse por error operacional.',
        userGoal: turnResult.userGoal,
        currentResponseProblem: turnResult.error.message,
        evidence: {
          error: turnResult.error.message,
        },
      }),
    )
    return findings
  }

  if (currentHasMeasurement && MEASUREMENTS_ASK_REGEX.test(responseText)) {
    findings.push(
      buildFinding({
        category: 'measurement_parse_gap',
        severity: 'high',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'El usuario dio medidas en el turno actual y el sistema volvió a pedirlas.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La respuesta no consolida la medida recién provista y reabre el slot de medidas.',
        evidence: {
          currentTurnText: turnResult.user.text,
          extractedMeasurement: turnResult.turnFacts.current.dimensions,
          responseText,
          missingFields,
        },
      }),
    )
  }

  if (!currentHasMeasurement && state.factsBefore.dimensions && MEASUREMENTS_ASK_REGEX.test(responseText)) {
    findings.push(
      buildFinding({
        category: 'quote_intake_reopened',
        severity: 'high',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'El sistema reabre la toma de medidas que ya existían en contexto.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La respuesta vuelve a pedir medidas ya disponibles en el historial de la corrida.',
        evidence: {
          knownMeasurement: state.factsBefore.dimensions,
          responseText,
          missingFields,
        },
      }),
    )
  }

  if (currentHasQuantity && QUANTITY_ASK_REGEX.test(responseText)) {
    findings.push(
      buildFinding({
        category: 'quote_intake_reopened',
        severity: 'medium',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'El usuario dio cantidad y el sistema la vuelve a pedir.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La cantidad no queda consolidada como slot resuelto en el mismo turno.',
        evidence: {
          currentTurnText: turnResult.user.text,
          extractedQuantity: turnResult.turnFacts.current.quantity,
          responseText,
          missingFields,
        },
      }),
    )
  }

  if (!currentHasQuantity && state.factsBefore.quantity != null && QUANTITY_ASK_REGEX.test(responseText)) {
    findings.push(
      buildFinding({
        category: 'quote_intake_reopened',
        severity: 'medium',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'El sistema reabre la cantidad cuando ya estaba provista.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La respuesta vuelve a abrir un slot ya capturado previamente.',
        evidence: {
          knownQuantity: state.factsBefore.quantity,
          responseText,
          missingFields,
        },
      }),
    )
  }

  if (knownHasProduct && PRODUCT_ASK_REGEX.test(responseText)) {
    findings.push(
      buildFinding({
        category: 'topic_loss',
        severity: 'high',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'El sistema pierde el tópico/producto y vuelve a preguntar qué quiere cotizar.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La respuesta retrocede a una pregunta abierta pese a existir evidencia de producto.',
        evidence: {
          knownProduct: turnResult.turnFacts.after.product,
          currentTurnText: turnResult.user.text,
          responseText,
        },
      }),
    )
  }

  if (
    GENERIC_CLARIFICATION_REGEX.test(responseText) &&
    (quoteSignal || scheduleSignal || turnResult.user.text.length >= 24)
  ) {
    findings.push(
      buildFinding({
        category: 'generic_fallback_overreach',
        severity: 'medium',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'La respuesta cae en aclaración genérica aunque el turno trae señal útil.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'Se pierde progresión y la salida no consume la evidencia concreta del turno.',
        evidence: {
          currentTurnText: turnResult.user.text,
          responseText,
          missingFields,
        },
      }),
    )
  }

  if (
    (GENERIC_CLOSURE_REGEX.test(responseText) || responseText.length <= 70) &&
    quoteSignal &&
    missingFields.length > 0 &&
    !MEASUREMENTS_ASK_REGEX.test(responseText) &&
    !QUANTITY_ASK_REGEX.test(responseText) &&
    !PRODUCT_ASK_REGEX.test(responseText)
  ) {
    findings.push(
      buildFinding({
        category: 'shaping_overcompensation',
        severity: 'low',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'La respuesta cierra o suaviza sin avanzar el próximo dato útil.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'El wording compensa con tono amable, pero no resuelve el siguiente paso estructural.',
        evidence: {
          currentTurnText: turnResult.user.text,
          responseText,
          missingFields,
        },
      }),
    )
  }

  if (responseSimilarity >= 0.88 || normalizeText(previousResponseText) === normalizeText(responseText)) {
    findings.push(
      buildFinding({
        category: 'loop_reentry',
        severity: responseSimilarity >= 0.97 ? 'high' : 'medium',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'La salida repite casi lo mismo que el turno agente anterior.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'No hay progreso visible entre respuestas consecutivas del runtime.',
        evidence: {
          previousResponseText,
          responseText,
          similarity: Number(responseSimilarity.toFixed(3)),
        },
      }),
    )
  }

  if ((needsHuman || HUMAN_HANDOFF_REGEX.test(responseText)) && (quoteSignal || scheduleSignal)) {
    findings.push(
      buildFinding({
        category: 'handoff_too_early',
        severity: 'medium',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'La respuesta deriva o insinúa derivación antes de agotar captura estructural.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La conversación se frena con handoff cuando todavía había slots o contexto accionable dentro del alcance del chat.',
        evidence: {
          currentTurnText: turnResult.user.text,
          responseText,
          needsHuman,
          missingFields,
        },
      }),
    )
  }

  if (
    responseText &&
    /si el caso requiere validaci[oó]n adicional|un asesor contin[uú]a con el siguiente paso/iu.test(
      responseText,
    )
  ) {
    findings.push(
      buildFinding({
        category: 'policy_vs_core_leak',
        severity: 'low',
        conversationId: turnResult.conversationId,
        turn: turnResult.semanticTurnId,
        symptom: 'La respuesta expone boilerplate operativo que parece venir del runtime central.',
        userGoal: turnResult.userGoal,
        currentResponseProblem:
          'La salida mezcla contrato base con wording operativo reusable sólo por policy.',
        evidence: {
          responseText,
        },
      }),
    )
  }

  return findings
}

async function loadCorpusManifests(corpusDir, limitConversations = null) {
  const manifestsDir = path.join(corpusDir, 'manifests')
  const names = (await readdir(manifestsDir))
    .filter((entry) => entry.endsWith('.json'))
    .sort()

  const selected = names.slice(0, limitConversations == null ? names.length : limitConversations)
  const manifests = []
  for (const name of selected) {
    const raw = await readFile(path.join(manifestsDir, name), 'utf8')
    manifests.push(JSON.parse(raw))
  }
  return manifests
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function appendJsonl(filePath, value) {
  await appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8')
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function readJsonlIfExists(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

function buildResponseSummary(response) {
  if (!response || typeof response !== 'object') {
    return null
  }

  return {
    finalUserText: typeof response.finalUserText === 'string' ? response.finalUserText : null,
    text: typeof response.text === 'string' ? response.text : null,
    provider: typeof response.provider === 'string' ? response.provider : null,
    model: typeof response.model === 'string' ? response.model : null,
    needsHuman: response.needsHuman === true,
    debugSummary: typeof response.debugSummary === 'string' ? response.debugSummary : null,
    toolCalls: Array.isArray(response.toolCalls) ? response.toolCalls : [],
    grounding:
      response.grounding && typeof response.grounding === 'object' ? response.grounding : null,
    auditPayload:
      response.auditPayload && typeof response.auditPayload === 'object'
        ? response.auditPayload
        : response.audit && typeof response.audit === 'object'
          ? response.audit
          : null,
  }
}

function buildConversationSummariesFromTurnEntries(turnEntries, manifestsById) {
  const latestTurnByKey = new Map()
  for (const turnEntry of turnEntries) {
    const key = `${turnEntry.conversationId}:${turnEntry.semanticTurnId}`
    latestTurnByKey.set(key, turnEntry)
  }

  const grouped = new Map()
  for (const turnEntry of latestTurnByKey.values()) {
    const list = grouped.get(turnEntry.conversationId) || []
    list.push(turnEntry)
    grouped.set(turnEntry.conversationId, list)
  }

  const allConversationIds = new Set([
    ...manifestsById.keys(),
    ...grouped.keys(),
  ])

  return [...allConversationIds]
    .map((conversationId) => {
      const manifest = manifestsById.get(conversationId) || null
      const sortedTurns = (grouped.get(conversationId) || []).sort(
        (left, right) => (left.semanticTurnIndex || 0) - (right.semanticTurnIndex || 0),
      )
      return {
        conversationId,
        replayConversationId: sortedTurns[0]?.replayConversationId || null,
        customerDisplayName: manifest ? getCustomerDisplayName(manifest) : conversationId,
        sourceZip: manifest?.source?.zipName || null,
        evaluatedTurnCount: sortedTurns.length,
        findingCount: sortedTurns.reduce(
          (total, turn) => total + (Array.isArray(turn.findings) ? turn.findings.length : 0),
          0,
        ),
        failedTurnCount: sortedTurns.filter((turn) => turn.error).length,
        turns: sortedTurns,
      }
    })
    .sort((left, right) => left.conversationId.localeCompare(right.conversationId))
}

async function replayConversation({
  manifest,
  manifestIndex,
  runId,
  runToken,
  clients,
  adapter,
  options,
  runDir,
  status,
}) {
  const evaluatedTurns = buildEvaluatedTurns(manifest).slice(
    0,
    options.limitTurns == null ? Number.POSITIVE_INFINITY : options.limitTurns,
  )
  const userId = buildConversationUserId(runToken, manifestIndex)
  const remoteJid = `${userId}@s.whatsapp.net`
  const displayName = getCustomerDisplayName(manifest)
  const turnEntries = []
  const conversationState = {
    previousResponseText: '',
    facts: {},
  }

  for (let turnIndex = 0; turnIndex < evaluatedTurns.length; turnIndex += 1) {
    const semanticTurn = evaluatedTurns[turnIndex]
    const sourceTurns = semanticTurn.rawTurnIndexes
      .map((rawIndex) =>
        (Array.isArray(manifest.turns) ? manifest.turns : []).find((entry) => entry.index === rawIndex),
      )
      .filter(Boolean)
    const items = []
    const ingestedInbound = []
    let projection = null

    for (const sourceTurn of sourceTurns) {
      const attachments = buildTurnAttachments(sourceTurn).map((attachment) => ({
        assetType: attachment.assetType,
        fileName: attachment.fileName || undefined,
        textContent: sanitizeForBackend(attachment.textContent || '') || undefined,
        metadata: attachment.metadata,
      }))
      const normalizedText = buildTurnText(sourceTurn)
      const fallbackText = compactText(sourceTurn?.text || '')
      const rawInboundText =
        normalizedText || (attachments.length > 0 ? fallbackText || '[Adjunto del corpus]' : '')
      const text = sanitizeForBackend(rawInboundText) || ''
      if (!text && attachments.length === 0) {
        continue
      }
      const externalMessageId = `${runId}:${manifest.conversationId}:turn:${sourceTurn.index}`
      const inboundPayload = {
        tenantKey: options.tenantKey,
        channel: 'whatsapp',
        userId,
        inboxAddress: 'qa-real-corpus-replay',
        threadId: remoteJid,
        externalMessageId,
        displayName: sanitizeForBackend(displayName),
        text: text || undefined,
        receivedAt: sourceTurn.timestamp ? new Date(sourceTurn.timestamp) : undefined,
        authorKind: 'customer_human',
        messageKind: text ? 'human_message' : 'attachment_only',
        attachments,
        metadata: {
          transport: 'qa_real_corpus_replay',
          replayRunId: runId,
          corpusConversationId: manifest.conversationId,
          corpusTurnIndex: sourceTurn.index,
          semanticTurnId: semanticTurn.id,
          semanticTurnInputCount: semanticTurn.rawInputCount,
          corpusTimestamp: sourceTurn.timestamp || null,
          corpusRawTimestamp: sourceTurn.rawTimestamp || null,
        },
      }
      try {
        projection = await withReplayRetry(
          () => clients.conversations.ingestInboundMessage(inboundPayload),
          options,
          `ingest:${semanticTurn.id}:${sourceTurn.index}`,
        )
      } catch (error) {
        const details = {
          conversationId: manifest.conversationId,
          semanticTurnId: semanticTurn.id,
          sourceTurnIndex: sourceTurn.index,
          text,
          attachmentCount: attachments.length,
          fallbackText,
        }
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} | ${JSON.stringify(details)}`,
        )
      }

      ingestedInbound.push({
        sourceTurnIndex: sourceTurn.index,
        externalMessageId,
        backendConversationId: projection?.conversationId || null,
      })
      items.push({
        projection,
        text,
        attachments,
        externalUserId: userId,
        remoteJid,
        providerMessageId: externalMessageId,
      })
    }

    const factsBefore = {
      ...conversationState.facts,
    }
    const currentFacts = extractFactsFromUserText(semanticTurn.text, {})
    const factsAfter = extractFactsFromUserText(semanticTurn.text, factsBefore)
    const nextSemanticTurn = evaluatedTurns[turnIndex + 1] || null
    const referenceBusinessTurns = options.includeReferenceReplies
      ? lookupReferenceBusinessTurns(manifest, semanticTurn, nextSemanticTurn)
      : []

    const startedAt = new Date().toISOString()
    const turnStartedMs = Date.now()
    let response = null
    let error = null

    try {
      response = await withReplayRetry(
        () =>
          adapter.processBufferedLiveInbound(items, {
            semanticTurn: {
              id: semanticTurn.id,
              inputCount: semanticTurn.rawInputCount,
              inputs: semanticTurn.sourceTurns.map((entry) => ({
                index: entry.index,
                receivedAt: entry.timestamp,
                text: entry.text,
                attachmentCount: entry.attachmentCount,
              })),
            },
          }),
        options,
        `respond:${semanticTurn.id}`,
      )
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error(String(caught))
    }

    const durationMs = Date.now() - turnStartedMs
    const responseSummary = buildResponseSummary(response)
    const responseText = compactText(
      responseSummary?.finalUserText || responseSummary?.text || '',
    )

    const turnEntry = {
      conversationId: manifest.conversationId,
      replayConversationId: projection?.conversationId || null,
      replayChannel: 'whatsapp',
      replayUserId: userId,
      replayThreadId: remoteJid,
      semanticTurnId: semanticTurn.id,
      semanticTurnIndex: turnIndex + 1,
      startedAt,
      durationMs,
      user: {
        text: semanticTurn.text,
        rawInputCount: semanticTurn.rawInputCount,
        rawTurnIndexes: semanticTurn.rawTurnIndexes,
        timestamps: semanticTurn.timestamps,
        sourceTurns: semanticTurn.sourceTurns,
      },
      ingestedInbound,
      response: responseSummary,
      responseText,
      error: error
        ? {
            message: error.message,
            stack: error.stack || null,
          }
        : null,
      turnFacts: {
        before: factsBefore,
        current: currentFacts,
        after: factsAfter,
      },
      userGoal: 'unknown',
      findings: [],
      referenceBusinessTurns,
    }

    turnEntry.userGoal = inferUserGoal(turnEntry, factsAfter)
    turnEntry.findings = detectTurnFindings(turnEntry, {
      previousResponseText: conversationState.previousResponseText,
      factsBefore,
    })

    conversationState.previousResponseText = responseText || conversationState.previousResponseText
    conversationState.facts = factsAfter
    turnEntries.push(turnEntry)
    status.completedTurns += 1
    status.findings += turnEntry.findings.length
    if (turnEntry.error) {
      status.failedTurns += 1
    }
    await appendJsonl(path.join(runDir, 'turns.jsonl'), turnEntry)
  }

  const conversationEntry = {
    conversationId: manifest.conversationId,
    replayConversationId: turnEntries[0]?.replayConversationId || null,
    customerDisplayName: displayName,
    sourceZip: manifest?.source?.zipName || null,
    evaluatedTurnCount: turnEntries.length,
    findingCount: turnEntries.reduce((total, turn) => total + turn.findings.length, 0),
    failedTurnCount: turnEntries.filter((turn) => turn.error).length,
    turns: turnEntries,
  }

  await appendJsonl(path.join(runDir, 'conversations.jsonl'), {
    conversationId: conversationEntry.conversationId,
    replayConversationId: conversationEntry.replayConversationId,
    evaluatedTurnCount: conversationEntry.evaluatedTurnCount,
    findingCount: conversationEntry.findingCount,
    failedTurnCount: conversationEntry.failedTurnCount,
  })
  status.completedConversations += 1
  return conversationEntry
}

function summarizeFindings(conversations) {
  const findings = conversations.flatMap((conversation) =>
    conversation.turns.flatMap((turn) => turn.findings),
  )

  const countsByCategory = {}
  const countsByLayer = {}
  const countsBySeverity = {}

  for (const finding of findings) {
    countsByCategory[finding.taxonomy] = (countsByCategory[finding.taxonomy] || 0) + 1
    countsByLayer[finding.likely_layer] = (countsByLayer[finding.likely_layer] || 0) + 1
    countsBySeverity[finding.severity] = (countsBySeverity[finding.severity] || 0) + 1
  }

  const topCategories = Object.entries(countsByCategory)
    .sort((left, right) => right[1] - left[1])
    .map(([category, count]) => ({
      category,
      count,
      template: CATEGORY_TEMPLATES[category] || null,
      sampleFindings: findings
        .filter((entry) => entry.taxonomy === category)
        .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
        .slice(0, 3),
    }))

  const topLayers = Object.entries(countsByLayer)
    .sort((left, right) => right[1] - left[1])
    .map(([layer, count]) => ({ layer, count }))

  const topProblems = topCategories.slice(0, 5).map((entry) => ({
    category: entry.category,
    count: entry.count,
    likely_layer: entry.template?.likelyLayer || null,
    root_cause_hypothesis: entry.template?.rootCause || null,
    global_fix_direction: entry.template?.globalFix || null,
    reject_local_patch_reason: entry.template?.rejectPatch || null,
    evidence: entry.sampleFindings.map((finding) => ({
      conversationId: finding.conversationId,
      turn: finding.turn,
      severity: finding.severity,
      symptom: finding.symptom,
      current_response_problem: finding.current_response_problem,
    })),
  }))

  const risksOfLocalPatching = [
    'Se siguen abriendo slots ya resueltos porque el problema vive en quote context/readiness y no en la frase final.',
    'Aumenta la fuga de idioma y tenant al runtime central si el arreglo es meter wording puntual en core.',
    'La revisión manual se vuelve opaca porque cada corrida sigue dejando sólo métricas agregadas y no evidencia por turno.',
  ]

  const nextIteration =
    findings.length === 0
      ? 'rerun_de_validacion'
      : topCategories.some((entry) =>
            ['measurement_parse_gap', 'quote_intake_reopened', 'topic_loss'].includes(entry.category),
          )
        ? 'implementacion'
        : 'analisis_adicional'

  return {
    totalFindings: findings.length,
    countsByCategory,
    countsByLayer,
    countsBySeverity,
    topCategories,
    topLayers,
    topProblems,
    risksOfLocalPatching,
    nextIteration,
    findings,
  }
}

function buildExecutiveSummary({ runId, options, conversations, findingsSummary, status }) {
  const totalTurns = conversations.reduce(
    (total, conversation) => total + conversation.evaluatedTurnCount,
    0,
  )
  const totalFailures = conversations.reduce(
    (total, conversation) => total + conversation.failedTurnCount,
    0,
  )

  const topCategories = findingsSummary.topCategories.slice(0, 5).map((entry) => ({
    category: entry.category,
    count: entry.count,
    likely_layer: entry.template?.likelyLayer || null,
  }))

  return {
    runId,
    generatedAt: new Date().toISOString(),
    corpusDir: options.corpusDir,
    outputRoot: options.outputRoot,
    backendBaseUrl: options.backendBaseUrl,
    aiAgentBaseUrl: options.aiAgentBaseUrl,
    tenantKey: options.tenantKey,
    totalConversations: conversations.length,
    totalEvaluatedTurns: totalTurns,
    totalFindings: findingsSummary.totalFindings,
    failedTurns: totalFailures,
    completedConversations: status.completedConversations,
    completedTurns: status.completedTurns,
    topCategories,
    topLayers: findingsSummary.topLayers.slice(0, 5),
    nextIteration: findingsSummary.nextIteration,
  }
}

function buildTraceMarkdown({ runId, conversations, summary }) {
  const lines = [
    '# Real Corpus Replay Trace',
    '',
    `Run ID: ${runId}`,
    `Generated at: ${summary.generatedAt}`,
    `Conversations: ${summary.totalConversations}`,
    `Evaluated turns: ${summary.totalEvaluatedTurns}`,
    `Findings: ${summary.totalFindings}`,
    '',
  ]

  for (const conversation of conversations) {
    lines.push(`## ${conversation.conversationId}`)
    lines.push('')
    lines.push(`- Replay conversation: ${conversation.replayConversationId || 'n/a'}`)
    lines.push(`- Customer: ${conversation.customerDisplayName}`)
    lines.push(`- Evaluated turns: ${conversation.evaluatedTurnCount}`)
    lines.push(`- Findings: ${conversation.findingCount}`)
    lines.push('')

    for (const turn of conversation.turns) {
      lines.push(`### ${turn.semanticTurnId}`)
      lines.push('')
      lines.push(`User goal: ${turn.userGoal}`)
      lines.push(`Raw turns: ${turn.user.rawTurnIndexes.join(', ')}`)
      lines.push(`User:`)
      lines.push(turn.user.text || '(sin texto)')
      lines.push('')
      lines.push(`Agent:`)
      lines.push(turn.responseText || (turn.error ? `(error) ${turn.error.message}` : '(sin respuesta)'))
      lines.push('')

      if (turn.response?.auditPayload) {
        const audit = turn.response.auditPayload
        const intentKey = typeof audit.intentKey === 'string' ? audit.intentKey : 'n/a'
        const answerMode =
          audit?.turnInterpretation?.conversationContext?.resolutionReadiness?.answerMode || 'n/a'
        lines.push(`Audit: intent=${intentKey} ; answerMode=${answerMode}`)
        lines.push('')
      }

      if (turn.referenceBusinessTurns.length) {
        lines.push('Reference corpus replies:')
        for (const reply of turn.referenceBusinessTurns) {
          lines.push(`- [${reply.index}] ${reply.text}`)
        }
        lines.push('')
      }

      if (turn.findings.length) {
        lines.push('Findings:')
        for (const finding of turn.findings) {
          lines.push(
            `- [${finding.severity}] ${finding.taxonomy}: ${finding.current_response_problem}`,
          )
        }
        lines.push('')
      }
    }
  }

  return `${lines.join('\n')}\n`
}

function buildDiagnosticMarkdown({ runId, summary, findingsSummary }) {
  const lines = [
    '# Real Corpus Replay Diagnostic',
    '',
    `Run ID: ${runId}`,
    `Generated at: ${summary.generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Conversations replayed: ${summary.totalConversations}.`,
    `- Evaluated turns: ${summary.totalEvaluatedTurns}.`,
    `- Total findings: ${summary.totalFindings}.`,
    `- Failed turns: ${summary.failedTurns}.`,
    `- Recommended next iteration: ${summary.nextIteration}.`,
    '',
    '## Top Structural Problems',
    '',
  ]

  for (const problem of findingsSummary.topProblems) {
    lines.push(`### ${problem.category} (${problem.count})`)
    lines.push('')
    lines.push(`Likely layer: ${problem.likely_layer || 'n/a'}`)
    lines.push(`Root cause hypothesis: ${problem.root_cause_hypothesis || 'n/a'}`)
    lines.push(`Global fix direction: ${problem.global_fix_direction || 'n/a'}`)
    lines.push(`Reject local patch reason: ${problem.reject_local_patch_reason || 'n/a'}`)
    lines.push('')
    if (problem.evidence.length) {
      lines.push('Evidence:')
      for (const evidence of problem.evidence) {
        lines.push(
          `- ${evidence.conversationId} / ${evidence.turn} / ${evidence.severity}: ${evidence.current_response_problem}`,
        )
      }
      lines.push('')
    }
  }

  lines.push('## Risks Of Local Patching')
  lines.push('')
  for (const risk of findingsSummary.risksOfLocalPatching) {
    lines.push(`- ${risk}`)
  }
  lines.push('')
  lines.push('## Recommendation')
  lines.push('')
  lines.push(`- ${summary.nextIteration}`)
  lines.push('')

  return `${lines.join('\n')}\n`
}

function humanizeGoal(userGoal) {
  switch (userGoal) {
    case 'customer.quote':
      return 'cotización'
    case 'customer.schedule_request':
      return 'coordinación o agenda'
    case 'customer.support_request':
      return 'soporte o postventa'
    case 'customer.product_info':
      return 'información de producto'
    default:
      return 'consulta general'
  }
}

function buildReadableConversationSummary(conversation) {
  if (!conversation.evaluatedTurnCount) {
    return 'La conversación no tiene turnos evaluables en el corpus normalizado, por lo que no generó replay ni hallazgos.'
  }

  const goalCounts = {}
  const findingCounts = {}
  for (const turn of conversation.turns) {
    goalCounts[turn.userGoal] = (goalCounts[turn.userGoal] || 0) + 1
    for (const finding of Array.isArray(turn.findings) ? turn.findings : []) {
      findingCounts[finding.taxonomy] = (findingCounts[finding.taxonomy] || 0) + 1
    }
  }

  const dominantGoal =
    Object.entries(goalCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || 'unknown'
  const dominantFinding =
    Object.entries(findingCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || null

  const parts = [
    `La conversación gira principalmente alrededor de ${humanizeGoal(dominantGoal)}.`,
    `En esta corrida el chat generó ${conversation.evaluatedTurnCount} respuestas.`,
  ]
  if (conversation.findingCount > 0) {
    parts.push(
      `Se detectaron ${conversation.findingCount} hallazgos${
        dominantFinding ? `, con predominio de ${dominantFinding}.` : '.'
      }`,
    )
  } else {
    parts.push('No se detectaron hallazgos en esta conversación.')
  }
  return parts.join(' ')
}

function buildReadableMarkdown({ runId, conversations, summary }) {
  const lines = [
    '# Real Corpus Replay Readable View',
    '',
    `Run ID: ${runId}`,
    `Generated at: ${summary.generatedAt}`,
    `Conversations: ${summary.totalConversations}`,
    `Evaluated turns: ${summary.totalEvaluatedTurns}`,
    '',
  ]

  for (const conversation of conversations) {
    lines.push(`## ${conversation.conversationId}`)
    lines.push('')
    lines.push(buildReadableConversationSummary(conversation))
    lines.push('')

    if (!conversation.evaluatedTurnCount) {
      continue
    }

    for (const turn of conversation.turns) {
      lines.push(`Cliente: ${turn.user.text || '(sin texto)'}`)
      lines.push(
        `Chat: ${turn.responseText || (turn.error ? `[error] ${turn.error.message}` : '(sin respuesta)')}`,
      )
      if (turn.referenceBusinessTurns.length) {
        lines.push(
          `Referencia real: ${turn.referenceBusinessTurns.map((entry) => entry.text).join(' / ')}`,
        )
      }
      if (turn.findings.length) {
        lines.push(
          `Se detecta: ${turn.findings
            .map((finding) => `${finding.taxonomy} (${finding.severity})`)
            .join(', ')}`,
        )
      }
      lines.push('')
    }
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const manifests = await loadCorpusManifests(options.corpusDir, options.limitConversations)
  const manifestsById = new Map(manifests.map((manifest) => [manifest.conversationId, manifest]))
  let generatedAt = new Date().toISOString()
  let runToken = generatedAt.replace(/\D+/g, '').slice(0, 14)
  let runId = `real-corpus-replay-${generatedAt.replace(/[:.]/g, '-')}`
  let runDir = path.join(options.outputRoot, runId)
  let status = {
    runId,
    generatedAt,
    totalConversations: manifests.length,
    completedConversations: 0,
    completedTurns: 0,
    failedTurns: 0,
    findings: 0,
  }

  if (options.resumeRunDir) {
    runDir = path.resolve(options.resumeRunDir)
    const existingRun = await readJsonIfExists(path.join(runDir, 'run.json'))
    const existingStatus = await readJsonIfExists(path.join(runDir, 'status.json'))
    if (!existingRun) {
      throw new Error(`resume_run_missing:${runDir}`)
    }
    runId = existingRun.runId || path.basename(runDir)
    generatedAt = existingRun.generatedAt || generatedAt
    runToken = generatedAt.replace(/\D+/g, '').slice(0, 14)
    status = existingStatus || {
      runId,
      generatedAt,
      totalConversations: manifests.length,
      completedConversations: 0,
      completedTurns: 0,
      failedTurns: 0,
      findings: 0,
    }
  } else {
    await mkdir(runDir, { recursive: true })
  }

  const clients = {
    conversations: new BackendConversationsClient({
      backendBaseUrl: options.backendBaseUrl,
      internalToken: options.internalToken,
    }),
    ai: new AiAgentClient({
      aiAgentBaseUrl: options.aiAgentBaseUrl,
    }),
  }

  const adapter = new WhatsappQrAdapter(
    clients,
    {
      clientSlug: options.tenantKey,
      whatsappRuntimeDir: path.join(runDir, 'whatsapp-runtime'),
    },
    {
      quietWindowMs: DEFAULT_QUIET_WINDOW_MS,
      maxWindowMs: DEFAULT_MAX_WINDOW_MS,
    },
  )

  if (!options.resumeRunDir) {
    await writeJson(path.join(runDir, 'run.json'), {
      runId,
      generatedAt,
      options,
      corpusConversationCount: manifests.length,
    })
    await writeJson(path.join(runDir, 'status.json'), status)
    await writeFile(path.join(runDir, 'turns.jsonl'), '', 'utf8')
    await writeFile(path.join(runDir, 'conversations.jsonl'), '', 'utf8')
  }

  const completedConversationEntries = await readJsonlIfExists(
    path.join(runDir, 'conversations.jsonl'),
  )
  const completedConversationIds = new Set(
    completedConversationEntries.map((entry) => entry.conversationId),
  )

  for (let manifestIndex = 0; manifestIndex < manifests.length; manifestIndex += 1) {
    const manifest = manifests[manifestIndex]
    if (completedConversationIds.has(manifest.conversationId)) {
      continue
    }
    const conversation = await replayConversation({
      manifest,
      manifestIndex,
      runId,
      runToken,
      clients,
      adapter,
      options,
      runDir,
      status,
    })
    await writeJson(path.join(runDir, 'status.json'), status)
    console.log(
      [
        `conversation=${manifestIndex + 1}/${manifests.length}`,
        `id=${manifest.conversationId}`,
        `turns=${conversation.evaluatedTurnCount}`,
        `findings=${conversation.findingCount}`,
        `failed=${conversation.failedTurnCount}`,
      ].join(' '),
    )
  }

  const turnEntries = await readJsonlIfExists(path.join(runDir, 'turns.jsonl'))
  const conversations = buildConversationSummariesFromTurnEntries(turnEntries, manifestsById)
  const findingsSummary = summarizeFindings(conversations)
  const summary = buildExecutiveSummary({
    runId,
    options,
    conversations,
    findingsSummary,
    status,
  })
  const traceJson = {
    runId,
    generatedAt,
    options,
    summary,
    conversations,
  }
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
    nextIteration: findingsSummary.nextIteration,
  }

  await writeJson(path.join(runDir, 'trace.json'), traceJson)
  await writeFile(path.join(runDir, 'trace.md'), buildTraceMarkdown({ runId, conversations, summary }), 'utf8')
  await writeFile(
    path.join(runDir, 'readable.md'),
    buildReadableMarkdown({ runId, conversations, summary }),
    'utf8',
  )
  await writeJson(path.join(runDir, 'diagnostic.json'), diagnosticJson)
  await writeFile(
    path.join(runDir, 'diagnostic.md'),
    buildDiagnosticMarkdown({ runId, summary, findingsSummary }),
    'utf8',
  )
  await writeJson(path.join(runDir, 'summary.json'), summary)
  await writeJson(path.join(options.outputRoot, 'latest-real-corpus-replay.json'), {
    runId,
    runDir,
    generatedAt,
    summaryPath: path.join(runDir, 'summary.json'),
    traceJsonPath: path.join(runDir, 'trace.json'),
    traceMarkdownPath: path.join(runDir, 'trace.md'),
    readableMarkdownPath: path.join(runDir, 'readable.md'),
    diagnosticJsonPath: path.join(runDir, 'diagnostic.json'),
    diagnosticMarkdownPath: path.join(runDir, 'diagnostic.md'),
    statusPath: path.join(runDir, 'status.json'),
    turnsJsonlPath: path.join(runDir, 'turns.jsonl'),
  })

  console.log(`run_id=${runId}`)
  console.log(`run_dir=${runDir}`)
  console.log(`trace_json=${path.join(runDir, 'trace.json')}`)
  console.log(`trace_md=${path.join(runDir, 'trace.md')}`)
  console.log(`diagnostic_json=${path.join(runDir, 'diagnostic.json')}`)
  console.log(`diagnostic_md=${path.join(runDir, 'diagnostic.md')}`)
}

export {
  appendJsonl,
  buildConversationSummariesFromTurnEntries,
  buildDiagnosticMarkdown,
  buildEvaluatedTurns,
  buildExecutiveSummary,
  buildReadableMarkdown,
  buildResponseSummary,
  buildTraceMarkdown,
  detectTurnFindings,
  extractFactsFromUserText,
  getCustomerDisplayName,
  inferUserGoal,
  loadCorpusManifests,
  lookupReferenceBusinessTurns,
  parseArgs,
  readJsonIfExists,
  readJsonlIfExists,
  replayConversation,
  summarizeFindings,
  writeJson,
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exitCode = 1
  })
}
