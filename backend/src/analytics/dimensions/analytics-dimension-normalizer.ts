export const CANONICAL_DIMENSION_KEYS = [
  'date',
  'source',
  'channel',
  'campaign',
  'device',
  'country',
  'landing_page',
] as const

export type CanonicalDimensionKey = (typeof CANONICAL_DIMENSION_KEYS)[number]

const normalizeScalar = (value: unknown, key?: string | null) => {
  if (value === null || value === undefined || value === '') {
    return 'null'
  }

  if (key === 'date') {
    const date = value instanceof Date ? value : new Date(String(value))
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10)
    }
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).trim().toLowerCase()
}

export const normalizeCanonicalDimensions = (dimensions: Record<string, unknown>) => {
  const normalized: Record<string, string> = {}

  for (const key of CANONICAL_DIMENSION_KEYS) {
    normalized[key] = normalizeScalar(dimensions[key], key)
  }

  const extraKeys = Object.keys(dimensions)
    .filter((key) => !CANONICAL_DIMENSION_KEYS.includes(key as CanonicalDimensionKey))
    .sort((left, right) => left.localeCompare(right))

  for (const key of extraKeys) {
    normalized[key] = normalizeScalar(dimensions[key], key)
  }

  return normalized
}

export const serializeCanonicalDimensions = (dimensions: Record<string, unknown>) => {
  const normalized = normalizeCanonicalDimensions(dimensions)
  return Object.entries(normalized)
    .map(([key, value]) => `${key}=${value}`)
    .join('|')
}

