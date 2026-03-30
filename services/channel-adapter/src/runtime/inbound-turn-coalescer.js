const DEFAULT_QUIET_WINDOW_MS = 900
const DEFAULT_MAX_WINDOW_MS = 2600

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

export const estimateInboundCompletionDelay = ({
  text = '',
  attachments = [],
  defaultDelayMs = DEFAULT_QUIET_WINDOW_MS,
} = {}) => {
  const normalizedText = normalizeText(text)
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0

  if (!normalizedText) {
    return hasAttachments ? 350 : defaultDelayMs
  }

  if (/[.!?…]$/.test(normalizedText) && normalizedText.length >= 50) {
    return 350
  }

  if (
    /(?:\b(de|con|para|porque|por|y|o|que|si|pero)\s*|[:,-])$/i.test(
      normalizedText,
    )
  ) {
    return 1200
  }

  if (normalizedText.length <= 24) {
    return 1100
  }

  if (!/[.!?…]$/.test(normalizedText) && normalizedText.length <= 120) {
    return 850
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
