import { estimateInboundCompletionDelay } from './inbound-turn-coalescer.js'
import { getStaticTenantVocabulary } from '../../../shared/tenant-policy/index.js'

const DEFAULT_PENDING_UTTERANCE_DELAY_MS = 900
const DEFAULT_PENDING_UTTERANCE_MAX_WINDOW_MS = 8000

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const extractItemText = (item = null) =>
  item?.normalized?.text ?? item?.text ?? ''

const extractItemAttachments = (item = null) => {
  if (Array.isArray(item?.normalized?.attachments)) {
    return item.normalized.attachments
  }
  if (Array.isArray(item?.attachments)) {
    return item.attachments
  }
  return []
}

const buildCombinedText = (items = []) =>
  items
    .map((item) => normalizeText(extractItemText(item)))
    .filter(Boolean)
    .join(' ')
    .trim()

const resolveTenantFragmentDescriptors = (items = []) => {
  const tenantKey = [...(Array.isArray(items) ? items : [])]
    .reverse()
    .map((item) =>
      typeof item?.normalized?.tenantKey === 'string'
        ? item.normalized.tenantKey.trim()
        : typeof item?.tenantKey === 'string'
          ? item.tenantKey.trim()
          : '',
    )
    .find(Boolean)

  return (getStaticTenantVocabulary(tenantKey)?.fragmentDescriptors ?? [])
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim())
}

const QUANTITY_REFERENCE_REGEX =
  /\b(?:\d+\s*(?:u|unidad(?:es)?|unid(?:ades)?)|un[ao]s?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/iu
const MEASUREMENT_REFERENCE_REGEX =
  /\b\d+(?:[.,]\d+)?\s*(?:x|por)\s*\d+(?:[.,]\d+)?(?:\s*(?:cm|cms|m|mt|mts|mm))?\b/iu
const TRAILING_THOUGHT_REGEX =
  /(?:\b(de|con|para|porque|por|y|o|que|si|sí|pero|aunque)\s*|[:,-]\s*)$/u

export const estimatePendingUtteranceDelay = ({
  items = [],
  defaultDelayMs = DEFAULT_PENDING_UTTERANCE_DELAY_MS,
} = {}) => {
  const normalizedDefaultDelayMs = Math.max(
    0,
    Number(defaultDelayMs) || DEFAULT_PENDING_UTTERANCE_DELAY_MS,
  )
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : []
  const lastItem = normalizedItems.at(-1)
  const latestText = extractItemText(lastItem)
  const latestAttachments = extractItemAttachments(lastItem)
  const descriptorTerms = resolveTenantFragmentDescriptors(normalizedItems)

  if (!lastItem) {
    return normalizedDefaultDelayMs
  }

  if (normalizedItems.length === 1) {
    return estimateInboundCompletionDelay({
      text: latestText,
      attachments: latestAttachments,
      defaultDelayMs: normalizedDefaultDelayMs,
      descriptorTerms,
    })
  }

  const combinedText = buildCombinedText(normalizedItems)
  const tokenCount = normalizeText(combinedText).split(/\s+/u).filter(Boolean).length
  const hasAttachments = normalizedItems.some(
    (item) => extractItemAttachments(item).length > 0,
  )
  const hasMeasurements = MEASUREMENT_REFERENCE_REGEX.test(combinedText)
  const hasQuantityReference = QUANTITY_REFERENCE_REGEX.test(combinedText)
  const looksCompleteEnough =
    hasAttachments ||
    hasMeasurements ||
    (hasQuantityReference && tokenCount >= 4) ||
    tokenCount >= 4

  if (looksCompleteEnough && !TRAILING_THOUGHT_REGEX.test(combinedText)) {
    return Math.max(0, Math.min(normalizedDefaultDelayMs, 250))
  }

  return estimateInboundCompletionDelay({
    text: latestText,
    attachments: latestAttachments,
    defaultDelayMs: normalizedDefaultDelayMs,
    descriptorTerms,
  })
}

const buildSemanticTurn = ({ key, entry, closedAt }) => ({
  id: entry.id,
  key,
  turnStart: new Date(entry.createdAt).toISOString(),
  turnClose: closedAt,
  inputCount: entry.items.length,
  inputs: entry.items.map((item, index) => ({
    index,
    receivedAt:
      typeof item?.receivedAt === 'string' ? item.receivedAt : closedAt,
    text: normalizeText(extractItemText(item)),
    attachmentCount: extractItemAttachments(item).length,
  })),
})

export class PendingUtteranceAssembler {
  constructor({
    defaultDelayMs = DEFAULT_PENDING_UTTERANCE_DELAY_MS,
    maxWindowMs = DEFAULT_PENDING_UTTERANCE_MAX_WINDOW_MS,
  } = {}) {
    this.defaultDelayMs = Math.max(
      0,
      Number(defaultDelayMs) || DEFAULT_PENDING_UTTERANCE_DELAY_MS,
    )
    this.maxWindowMs = Math.max(
      this.defaultDelayMs,
      Number(maxWindowMs) || DEFAULT_PENDING_UTTERANCE_MAX_WINDOW_MS,
    )
    this.pending = new Map()
    this.activeEvaluations = new Map()
    this.sequence = 0
  }

  enqueue(key, item, flushHandler, options = {}) {
    if (!key || typeof flushHandler !== 'function') {
      return Promise.resolve(flushHandler ? flushHandler([item]) : null)
    }

    const now = Date.now()
    let entry = this.pending.get(key)
    if (!entry) {
      entry = {
        id: `semantic-turn-${this.sequence + 1}`,
        items: [],
        waiters: [],
        flushHandler,
        createdAt: now,
        updatedAt: now,
        timer: null,
        closing: false,
        stabilizationDelayMs: this.defaultDelayMs,
        maxWindowMs: this.maxWindowMs,
      }
      this.sequence += 1
      this.pending.set(key, entry)
    }

    const activeEvaluation = this.activeEvaluations.get(key)
    if (activeEvaluation) {
      activeEvaluation.canceled = true
    }

    entry.items.push(item)
    entry.flushHandler = flushHandler
    entry.updatedAt = now
    entry.stabilizationDelayMs = Math.max(
      0,
      Number(options.stabilizationDelayMs) ||
        estimatePendingUtteranceDelay({
          items: entry.items,
          defaultDelayMs: this.defaultDelayMs,
        }),
    )
    entry.maxWindowMs = Math.max(
      this.maxWindowMs,
      entry.stabilizationDelayMs,
      Number(options.maxWindowMs) || 0,
    )

    const promise = new Promise((resolve, reject) => {
      entry.waiters.push({ resolve, reject })
    })

    this.scheduleClose(key, entry)
    return promise
  }

  scheduleClose(key, entry) {
    if (entry.timer) {
      clearTimeout(entry.timer)
    }

    const elapsedMs = Date.now() - entry.createdAt
    const remainingWindowMs = Math.max(0, entry.maxWindowMs - elapsedMs)
    const delayMs =
      remainingWindowMs === 0
        ? 0
        : Math.max(0, Math.min(entry.stabilizationDelayMs, remainingWindowMs))

    if (delayMs === 0) {
      void this.close(key, entry.id)
      return
    }

    entry.timer = setTimeout(() => {
      void this.close(key, entry.id)
    }, delayMs)
  }

  async close(key, entryId) {
    const entry = this.pending.get(key)
    if (!entry || entry.closing || entry.id !== entryId) {
      return
    }

    entry.closing = true
    if (entry.timer) {
      clearTimeout(entry.timer)
    }
    this.pending.delete(key)

    const waiters = entry.waiters.slice()
    const items = entry.items.slice()
    const closedAt = new Date().toISOString()
    const semanticTurn = buildSemanticTurn({
      key,
      entry,
      closedAt,
    })
    const evaluation = {
      canceled: false,
      semanticTurnId: semanticTurn.id,
    }
    this.activeEvaluations.set(key, evaluation)

    try {
      const result = await entry.flushHandler(items, {
        semanticTurn,
        evaluation,
      })
      waiters.forEach((waiter) => waiter.resolve(result))
    } catch (error) {
      waiters.forEach((waiter) => waiter.reject(error))
    } finally {
      if (this.activeEvaluations.get(key) === evaluation) {
        this.activeEvaluations.delete(key)
      }
    }
  }
}
