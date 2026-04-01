const DEFAULT_QUIET_WINDOW_MS = 900
const DEFAULT_MAX_WINDOW_MS = 2600

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const FRAGMENTARY_CONTINUATION_REGEX =
  /^(?:de|del|con|sin|para|por|en|y|o|pero|si|sí)\b/iu

const QUOTE_SLOT_FRAGMENT_REGEX =
  /^(?:\d+(?:[.,]\d+)?\s*(?:x|por)\s*\d+(?:[.,]\d+)?(?:\s*(?:cm|cms|m|mt|mts|mm))?|\d+\s*(?:unidad(?:es)?|unid(?:ades)?|u)\b)/iu

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildDescriptorFragmentRegex = (descriptorTerms = []) => {
  const terms = (Array.isArray(descriptorTerms) ? descriptorTerms : [])
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim())
    .sort((left, right) => right.length - left.length)

  if (!terms.length) {
    return null
  }

  return new RegExp(`\\b(?:${terms.map((entry) => escapeRegex(entry)).join('|')})\\b`, 'iu')
}

const looksLikeFragmentaryContinuation = (normalizedText, descriptorTerms = []) => {
  if (!normalizedText) {
    return false
  }

  if (/[?¿]$/.test(normalizedText)) {
    return false
  }

  if (FRAGMENTARY_CONTINUATION_REGEX.test(normalizedText)) {
    return true
  }

  if (QUOTE_SLOT_FRAGMENT_REGEX.test(normalizedText)) {
    return true
  }

  const words = normalizedText.split(/\s+/u).filter(Boolean)
  const descriptorRegex = buildDescriptorFragmentRegex(descriptorTerms)
  if (words.length <= 4 && descriptorRegex?.test(normalizedText)) {
    return true
  }

  return false
}

export const estimateInboundCompletionDelay = ({
  text = '',
  attachments = [],
  defaultDelayMs = DEFAULT_QUIET_WINDOW_MS,
  descriptorTerms = [],
} = {}) => {
  const normalizedText = normalizeText(text)
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0

  if (!normalizedText) {
    return hasAttachments ? 350 : defaultDelayMs
  }

  if (looksLikeFragmentaryContinuation(normalizedText, descriptorTerms)) {
    return Math.max(defaultDelayMs + 500, 1700)
  }

  if (/[.!?…]$/.test(normalizedText) && normalizedText.length >= 50) {
    return 350
  }

  if (
    /(?:\b(de|con|para|porque|por|y|o|que|si|pero)\s*|[:,-])$/i.test(
      normalizedText,
    )
  ) {
    return Math.max(defaultDelayMs + 300, 1500)
  }

  if (normalizedText.length <= 24) {
    return Math.max(defaultDelayMs, 1300)
  }

  if (!/[.!?…]$/.test(normalizedText) && normalizedText.length <= 120) {
    return Math.max(defaultDelayMs - 200, 1000)
  }

  return defaultDelayMs
}

export class InboundTurnCoalescer {
  constructor({
    quietWindowMs = DEFAULT_QUIET_WINDOW_MS,
    maxWindowMs = DEFAULT_MAX_WINDOW_MS,
  } = {}) {
    this.quietWindowMs = Math.max(100, Number(quietWindowMs) || DEFAULT_QUIET_WINDOW_MS)
    this.maxWindowMs = Math.max(this.quietWindowMs, Number(maxWindowMs) || DEFAULT_MAX_WINDOW_MS)
    this.pending = new Map()
  }

  enqueue(key, item, flushHandler, options = {}) {
    if (!key || typeof flushHandler !== 'function') {
      return Promise.resolve(flushHandler ? flushHandler([item]) : null)
    }

    const flushDelayMs = Math.max(
      100,
      Number(options.flushDelayMs) || this.quietWindowMs,
    )

    let entry = this.pending.get(key)
    if (!entry) {
      entry = {
        items: [],
        waiters: [],
        flushHandler,
        flushDelayMs,
        createdAt: Date.now(),
        timer: null,
        flushing: false,
      }
      this.pending.set(key, entry)
    }

    entry.items.push(item)
    entry.flushDelayMs = flushDelayMs

    const promise = new Promise((resolve, reject) => {
      entry.waiters.push({ resolve, reject })
    })

    this.scheduleFlush(key, entry)
    return promise
  }

  scheduleFlush(key, entry) {
    if (entry.timer) {
      clearTimeout(entry.timer)
    }

    const elapsedMs = Date.now() - entry.createdAt
    const remainingMs = Math.max(0, this.maxWindowMs - elapsedMs)
    const delayMs = Math.max(0, Math.min(entry.flushDelayMs, remainingMs))

    if (delayMs === 0) {
      void this.flush(key)
      return
    }

    entry.timer = setTimeout(() => {
      void this.flush(key)
    }, delayMs)
  }

  async flush(key) {
    const entry = this.pending.get(key)
    if (!entry || entry.flushing) {
      return
    }

    entry.flushing = true
    if (entry.timer) {
      clearTimeout(entry.timer)
    }

    this.pending.delete(key)
    const items = entry.items.slice()
    const waiters = entry.waiters.slice()

    try {
      const result = await entry.flushHandler(items)
      waiters.forEach((waiter) => waiter.resolve(result))
    } catch (error) {
      waiters.forEach((waiter) => waiter.reject(error))
    }
  }
}
