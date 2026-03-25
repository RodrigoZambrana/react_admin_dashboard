export type OrderAddressInput = {
  line1?: string | null
  line2?: string | null
  department?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}

export type OrderAddressPayload = {
  line1?: string | null
  line2?: string | null
  department?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  lines: string[]
}

export const sanitizeAddressValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export const normalizeCountryLabel = (country?: string | null): string | null => {
  const normalized = sanitizeAddressValue(country)
  if (!normalized) {
    return null
  }

  const upper = normalized.toUpperCase()
  const predefined: Record<string, string> = {
    UY: 'Uruguay',
    URUGUAY: 'Uruguay',
    AR: 'Argentina',
    ARGENTINA: 'Argentina',
    BR: 'Brasil',
    BRASIL: 'Brasil',
    BRAZIL: 'Brasil',
    CL: 'Chile',
    CHILE: 'Chile',
    PY: 'Paraguay',
    PARAGUAY: 'Paraguay',
    PE: 'Perú',
    PERU: 'Perú',
    'PERÚ': 'Perú',
    BO: 'Bolivia',
    BOLIVIA: 'Bolivia',
    CO: 'Colombia',
    COLOMBIA: 'Colombia',
    MX: 'México',
    MEXICO: 'México',
    'MÉXICO': 'México',
    ES: 'España',
    ESPANA: 'España',
    'ESPAÑA': 'España',
    SPAIN: 'España',
  }

  return predefined[upper] ?? normalized
}

export const buildAddressLines = (params: OrderAddressInput): string[] => {
  const line1 = sanitizeAddressValue(params.line1)
  const line2 = sanitizeAddressValue(params.line2)
  const department = sanitizeAddressValue(params.department)
  const neighborhood = sanitizeAddressValue(params.neighborhood)
  const city = sanitizeAddressValue(params.city)
  const state = sanitizeAddressValue(params.state) ?? department
  const zip = sanitizeAddressValue(params.zip)
  const country = normalizeCountryLabel(params.country)

  const lines: string[] = []
  const firstLine = [line1, line2].filter((segment): segment is string => Boolean(segment)).join(' ').trim()
  if (firstLine) {
    lines.push(firstLine)
  }

  const locationLead = [city, neighborhood].filter((segment): segment is string => Boolean(segment)).join(', ').trim()
  const cityState = [locationLead || null, state].filter((segment): segment is string => Boolean(segment)).join(', ').trim()
  const locationLine = [cityState || null, zip].filter((segment): segment is string => Boolean(segment)).join(' ').trim()
  if (locationLine) {
    lines.push(locationLine)
  }

  if (country) {
    lines.push(country)
  }

  return lines
}

export const buildAddressPayload = (params: OrderAddressInput): OrderAddressPayload | null => {
  const lines = buildAddressLines(params)
  if (lines.length === 0) {
    return null
  }

  return {
    line1: sanitizeAddressValue(params.line1),
    line2: sanitizeAddressValue(params.line2),
    department: sanitizeAddressValue(params.department),
    neighborhood: sanitizeAddressValue(params.neighborhood),
    city: sanitizeAddressValue(params.city),
    state: sanitizeAddressValue(params.state) ?? sanitizeAddressValue(params.department),
    zip: sanitizeAddressValue(params.zip),
    country: normalizeCountryLabel(params.country),
    lines,
  }
}
