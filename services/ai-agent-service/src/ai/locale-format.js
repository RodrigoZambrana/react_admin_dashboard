const DEFAULT_LOCALE = 'es-UY'

export const normalizeChatLocale = (value, fallback = DEFAULT_LOCALE) => {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  const normalized = trimmed.replace('_', '-')
  if (/^[a-z]{2}(?:-[A-Z]{2})?$/i.test(normalized)) {
    if (/^es$/i.test(normalized)) return 'es-UY'
    if (/^en$/i.test(normalized)) return 'en-US'
    return normalized
  }

  return fallback
}

export const localePrefersEnglish = (value) =>
  normalizeChatLocale(value).toLowerCase().startsWith('en')

const ENGLISH_HINT_PATTERNS = [
  /\bhello\b/i,
  /\bhi\b/i,
  /\bprice\b/i,
  /\binstall(?:ation)?\b/i,
  /\bschedule\b/i,
  /\bquote\b/i,
  /\bthanks?\b/i,
  /\bplease\b/i,
  /\bcan you\b/i,
  /\bdo you\b/i,
]

const SPANISH_HINT_PATTERNS = [
  /\bhola\b/i,
  /\bprecio\b/i,
  /\binstalaci[oó]n\b/i,
  /\bcotiz(?:aci[oó]n|ar)\b/i,
  /\bgracias\b/i,
  /\bpuedo\b/i,
  /\bquiero\b/i,
  /\bvisita\b/i,
]

export const inferChatLocaleFromText = (value, fallback = DEFAULT_LOCALE) => {
  const input = typeof value === 'string' ? value.trim() : ''
  if (!input) {
    return fallback
  }

  const englishScore = ENGLISH_HINT_PATTERNS.reduce(
    (sum, pattern) => sum + (pattern.test(input) ? 1 : 0),
    0,
  )
  const spanishScore = SPANISH_HINT_PATTERNS.reduce(
    (sum, pattern) => sum + (pattern.test(input) ? 1 : 0),
    0,
  )

  if (englishScore > spanishScore && englishScore > 0) {
    return 'en-US'
  }

  if (spanishScore > 0) {
    return 'es-UY'
  }

  return fallback
}

export const formatChatNumber = (value, options = {}) => {
  if (!Number.isFinite(Number(value))) {
    return null
  }

  return new Intl.NumberFormat(normalizeChatLocale(options.locale), {
    ...options,
  }).format(Number(value))
}

export const formatChatMoney = (currency, amount, options = {}) => {
  if (!currency || typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null
  }

  return `${String(currency).toUpperCase()} ${formatChatNumber(amount, {
    locale: options.locale,
    minimumFractionDigits:
      typeof options.minimumFractionDigits === 'number'
        ? options.minimumFractionDigits
        : 2,
    maximumFractionDigits:
      typeof options.maximumFractionDigits === 'number'
        ? options.maximumFractionDigits
        : 2,
    useGrouping: options.useGrouping,
  })}`
}

export const formatChatDate = (value, options = {}) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(normalizeChatLocale(options.locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(options.dateOptions || {}),
  }).format(date)
}
