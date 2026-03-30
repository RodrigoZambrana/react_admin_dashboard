#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const DEFAULT_CORPUS_DIR = path.join(
  repoRoot,
  '.qa',
  'external-real-conversations',
  'whatsapp',
)
const DEFAULT_OUTPUT_DIR = path.join(DEFAULT_CORPUS_DIR, 'generated')
const DEFAULT_CATEGORY_ORDER = [
  'runtime_regression_candidate',
  'stateful_regression_candidate',
  'knowledge_first_regression_candidate',
  'multimodal_regression_candidate',
  'support_regression_candidate',
  'follow_up_regression_candidate',
]

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const slugify = (value) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

const hashSeed = (value) => {
  let hash = 1779033703
  for (const char of String(value || 'seed')) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  return hash >>> 0
}

const mulberry32 = (seed) => () => {
  let next = (seed += 0x6d2b79f5)
  next = Math.imul(next ^ (next >>> 15), next | 1)
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
  return ((next ^ (next >>> 14)) >>> 0) / 4294967296
}

const pickOne = (items, random) =>
  Array.isArray(items) && items.length
    ? items[Math.floor(random() * items.length)]
    : null

const parseArgs = (argv) => {
  const options = {
    corpusDir: DEFAULT_CORPUS_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    count: 16,
    seed: new Date().toISOString().slice(0, 10),
    mode: 'mixed',
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
    if (arg === '--output-dir') {
      options.outputDir = argv[index + 1] ?? options.outputDir
      index += 1
      continue
    }
    if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length)
      continue
    }
    if (arg === '--count') {
      options.count = Number(argv[index + 1] ?? options.count) || options.count
      index += 1
      continue
    }
    if (arg.startsWith('--count=')) {
      options.count = Number(arg.slice('--count='.length)) || options.count
      continue
    }
    if (arg === '--seed') {
      options.seed = argv[index + 1] ?? options.seed
      index += 1
      continue
    }
    if (arg.startsWith('--seed=')) {
      options.seed = arg.slice('--seed='.length)
      continue
    }
    if (arg === '--mode') {
      options.mode = argv[index + 1] ?? options.mode
      index += 1
      continue
    }
    if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length)
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

const loadCorpusIndex = async (corpusDir) => {
  const filePath = path.join(corpusDir, 'index.json')
  return JSON.parse(await readFile(filePath, 'utf8'))
}

const isAttachmentLikeText = (text) =>
  /\b(archivo adjunto|img-|wa\d+\.(jpg|jpeg|png|pdf|opus|mp3)|<multimedia omitido>)\b/i.test(
    String(text || ''),
  )

const isUsefulCustomerTurn = (turn) => {
  if (turn?.authorRole !== 'customer') {
    return false
  }
  const text = compact(turn?.text || '')
  if (!text) {
    return false
  }
  if (/^se elimin[oó] este mensaje\.?$/i.test(text)) {
    return false
  }
  return true
}

const extractCustomerTurns = (proposal) => {
  const turns = Array.isArray(proposal?.sampleTurns)
    ? proposal.sampleTurns.filter(isUsefulCustomerTurn).map((turn) => compact(turn.text))
    : []

  const deduped = []
  for (const turn of turns) {
    if (deduped.at(-1) !== turn) {
      deduped.push(turn)
    }
  }

  if (proposal?.category === 'multimodal_regression_candidate') {
    return deduped.slice(0, 4)
  }

  return deduped.filter((turn) => !/^<multimedia omitido>$/i.test(turn)).slice(0, 4)
}

const inferTopicLabel = (turns = []) => {
  const text = normalize(turns.join(' '))
  if (/\broller\b/.test(text)) {
    return 'roller'
  }
  if (/\bblackout\b/.test(text)) {
    return 'blackout'
  }
  if (/\bscreen\b/.test(text)) {
    return 'screen'
  }
  if (/\bpersian/.test(text) || /\bestera\b/.test(text)) {
    return 'persianas'
  }
  if (/\babertur|\bdvh\b|\bventana\b|\bpuerta\b/.test(text)) {
    return 'aberturas'
  }
  if (/\bcortin/.test(text)) {
    return 'cortinas'
  }
  return null
}

const buildSyntheticTurn = (proposal, turns, random) => {
  const fullText = normalize(turns.join(' '))
  const category = proposal?.category

  if (category === 'knowledge_first_regression_candidate') {
    return pickOne(
      ['¿Aceptan débito?', '¿Y con transferencia?', '¿Se puede pagar con tarjeta?'],
      random,
    )
  }

  if (category === 'support_regression_candidate') {
    return pickOne(
      [
        'Si hace falta, ¿pueden venir a verlo?',
        '¿Cómo coordinamos una visita?',
        'Si querés, les paso dirección para revisarlo.',
      ],
      random,
    )
  }

  if (category === 'stateful_regression_candidate') {
    if (!/\bdireccion|dirección|avenida|calle|ruta|zona\b/.test(fullText)) {
      return 'Es en avenida italia 1428. A las 14 estoy en casa. Mi teléfono es 099123456.'
    }
    if (!/\blunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las\b/.test(fullText)) {
      return pickOne(['Puedo el lunes.', 'Me sirve mañana de tarde.', 'A las 15:30 me queda bien.'], random)
    }
    return pickOne(['¿A qué hora podrían pasar?', '¿Les sirve ese horario?'], random)
  }

  if (category === 'multimodal_regression_candidate') {
    return pickOne(
      ['¿Sirve esa?', 'Si hace falta, te mando otra foto.', '¿Con eso ya se entiende?'],
      random,
    )
  }

  if (
    category === 'runtime_regression_candidate' &&
    /\b(roller|persian|estera|abertur|ventana|puerta|dvh|screen|blackout|cortin)\b/.test(
      fullText,
    )
  ) {
    return pickOne(
      ['¿Incluye instalación?', '¿Qué medios de pago aceptan?', '¿Lo traen a domicilio?'],
      random,
    )
  }

  if (category === 'follow_up_regression_candidate') {
    return pickOne(
      ['Hola, retomo esto.', 'Seguimos con esto.', '¿Cómo seguimos con eso?'],
      random,
    )
  }

  return null
}

const buildExpected = (turn, proposal, allTurns) => {
  const normalizedTurn = normalize(turn)
  const topicLabel = inferTopicLabel(allTurns)
  const supportLikeTurn =
    /\b(service|repar|revisi|cambiar|acortar|mover|motor|cinta|enrollador|mantenimiento)\b/.test(
      normalizedTurn,
    )
  const quoteClarificationLikeTurn =
    /\b(presupuesto|cotizacion|cotización|total|final|aclar|detalle|detall)\b/.test(
      normalizedTurn,
    )
  const include = []
  const avoid = []

  if (
    /\b(medios de pago|pagar|pago|tarjeta|tarjetas|debito|débito|transferencia|efectivo|cuotas)\b/.test(
      normalizedTurn,
    )
  ) {
    include.push('efectivo|transferencia|tarjetas?')
    if (topicLabel) {
      avoid.push(topicLabel)
    }
  }

  if (
    /\b(comprobante|transferi|transferencia|giro|ya hice el pago|pague|pague|adjunto)\b/.test(
      normalizedTurn,
    ) ||
    (isAttachmentLikeText(turn) &&
      allTurns.some((entry) =>
        /\b(comprobante|transfer|pago|giro)\b/i.test(String(entry || '')),
      ))
  ) {
    include.push('comprobante|acredit|seguimiento|asesor')
    avoid.push('presupuesto|cotiz|precio|medios de pago')
  }

  if (
    /\b(coordinar|visita|venir|pasar|direccion|dirección|zona|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las|horario)\b/.test(
      normalizedTurn,
    )
  ) {
    include.push('coordinar|visita|direcci[oó]n|d[ií]a|horario|agendada|coordinada|contacto')
    if (!/\b(roller|blackout|screen|persian|abertur|ventana|puerta|dvh)\b/.test(normalizedTurn)) {
      avoid.push('blackout|screen|catalogo|catálogo')
    }
  }

  if (
    !quoteClarificationLikeTurn &&
    /\b(service|repar|revisi|cambiar|acortar|mover|motor|cinta|enrollador)\b/.test(
      normalizedTurn,
    )
  ) {
    include.push('service|revisi[oó]n|foto|zona|direcci[oó]n|coordinar')
    avoid.push('medidas aproximadas|cu[aá]ntas unidades')
  }

  if (
    /\b(\d+[,.]\d+\s*x\s*\d+[,.]\d+|roller|blackout|screen|persian|estera|abertur|ventana|puerta|dvh)\b/.test(
      normalizedTurn,
    )
  ) {
    if (topicLabel && !supportLikeTurn) {
      include.push(topicLabel)
    }
    avoid.push('no pude completar')
  }

  if (isAttachmentLikeText(turn)) {
    avoid.push('no pude completar|no entend')
  }

  return {
    notes: Array.isArray(proposal?.expectedBehaviors)
      ? proposal.expectedBehaviors.join(' | ')
      : null,
    include,
    avoid,
  }
}

const scenarioFromProposal = ({ proposal, random, includeSynthetic = true }) => {
  const extractedTurns = extractCustomerTurns(proposal)
  if (!extractedTurns.length) {
    return null
  }

  const turns = [...extractedTurns]
  const syntheticTurn = includeSynthetic ? buildSyntheticTurn(proposal, turns, random) : null
  if (syntheticTurn && !turns.includes(syntheticTurn)) {
    turns.push(syntheticTurn)
  }

  const scenarioTurns = turns.slice(0, 5).map((turn) => ({
    user: turn,
    expected: buildExpected(turn, proposal, turns),
  }))

  return {
    id: `${slugify(proposal.id || proposal.title)}-${Math.round(random() * 1000)}`,
    title: proposal.title,
    notes: [
      `Categoría: ${proposal.category}.`,
      `Conversación fuente: ${proposal.sourceConversationId}.`,
      proposal.rationale ? `Rationale: ${proposal.rationale}` : null,
      syntheticTurn ? `Incluye follow-up sintético: ${syntheticTurn}` : null,
    ]
      .filter(Boolean)
      .join(' '),
    turns: scenarioTurns,
  }
}

const selectProposals = ({ proposals, count, random, mode }) => {
  const priorityRank = { high: 0, medium: 1, low: 2 }
  const filtered = proposals
    .filter((proposal) =>
      DEFAULT_CATEGORY_ORDER.includes(String(proposal?.category || '')),
    )
    .sort((left, right) => {
      const byPriority =
        (priorityRank[left?.priority] ?? 99) - (priorityRank[right?.priority] ?? 99)
      if (byPriority !== 0) {
        return byPriority
      }
      return String(left?.id || '').localeCompare(String(right?.id || ''))
    })

  const grouped = new Map(
    DEFAULT_CATEGORY_ORDER.map((category) => [
      category,
      filtered.filter((proposal) => proposal.category === category),
    ]),
  )

  const selected = []
  const usedIds = new Set()

  if (mode === 'category_focus') {
    for (const category of DEFAULT_CATEGORY_ORDER) {
      const entries = grouped.get(category) || []
      if (!entries.length) {
        continue
      }
      const pick = entries[Math.floor(random() * entries.length)]
      if (!usedIds.has(pick.id)) {
        selected.push(pick)
        usedIds.add(pick.id)
      }
    }
  }

  while (selected.length < count) {
    let addedInRound = false
    for (const category of DEFAULT_CATEGORY_ORDER) {
      const entries = (grouped.get(category) || []).filter((entry) => !usedIds.has(entry.id))
      if (!entries.length) {
        continue
      }
      const pick = entries[Math.floor(random() * entries.length)]
      selected.push(pick)
      usedIds.add(pick.id)
      addedInRound = true
      if (selected.length >= count) {
        break
      }
    }
    if (!addedInRound) {
      break
    }
  }

  return selected.slice(0, count)
}

export const buildProposalDerivedRealSet = async ({
  corpusDir = DEFAULT_CORPUS_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
  count = 16,
  seed = new Date().toISOString().slice(0, 10),
  mode = 'mixed',
} = {}) => {
  const index = await loadCorpusIndex(corpusDir)
  const random = mulberry32(hashSeed(seed))
  const selected = selectProposals({
    proposals: Array.isArray(index?.proposals) ? index.proposals : [],
    count,
    random,
    mode,
  })

  const scenarios = selected
    .map((proposal) =>
      scenarioFromProposal({
        proposal,
        random,
        includeSynthetic: true,
      }),
    )
    .filter(Boolean)

  const now = new Date().toISOString().slice(0, 10)
  const fileName = `proposal-derived-real-set-${mode}-${now}.json`
  const outputPath = path.join(outputDir, fileName)
  await mkdir(outputDir, { recursive: true })
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        name: `proposal-derived-real-set-${mode}-${now}`,
        description:
          'Set derivado automáticamente de proposals del corpus real de WhatsApp, con follow-ups sintéticos controlados para re-prueba.',
        seed,
        sourceSummary: index?.summary || null,
        scenarios,
      },
      null,
      2,
    ),
    'utf8',
  )

  return {
    outputPath,
    scenarios: scenarios.length,
    seed,
    mode,
  }
}

const shouldRunAsScript = () =>
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname)

if (shouldRunAsScript()) {
  const options = parseArgs(process.argv.slice(2))
  buildProposalDerivedRealSet(options)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((error) => {
      console.error(
        JSON.stringify(
          {
            status: 'failed',
            error: error?.message || String(error),
          },
          null,
          2,
        ),
      )
      process.exit(1)
    })
}
