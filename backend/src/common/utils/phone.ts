const DEFAULT_COUNTRY_CODE = '598'

const NON_DIGIT_EXCEPT_PLUS = /[^\d+]/g
const NON_DIGIT = /\D/g
const LEADING_ZEROS = /^0+/

export const normalizePhoneNumber = (
  rawInput?: string | null,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null => {
  const trimmed = rawInput?.trim() ?? ''
  if (!trimmed) {
    return null
  }

  const cleaned = trimmed.replace(NON_DIGIT_EXCEPT_PLUS, '')
  if (!cleaned) {
    return null
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(NON_DIGIT, '')
    return digits ? `+${digits}` : null
  }

  const digitsOnly = cleaned.replace(NON_DIGIT, '')
  if (!digitsOnly) {
    return null
  }

  if (digitsOnly.startsWith(countryCode)) {
    return `+${digitsOnly}`
  }

  const withoutLeadingZeros = digitsOnly.replace(LEADING_ZEROS, '')
  if (!withoutLeadingZeros) {
    return null
  }

  return `+${countryCode}${withoutLeadingZeros}`
}

export const buildPhoneLookupCandidates = (
  rawInput?: string | null,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string[] => {
  const normalized = normalizePhoneNumber(rawInput, countryCode)
  if (!normalized) {
    return []
  }

  const candidates = new Set<string>([normalized, normalized.slice(1)])
  const digits = normalized.slice(1)

  if (digits.startsWith(countryCode)) {
    const national = digits.slice(countryCode.length)
    if (national) {
      candidates.add(national)
      candidates.add(`0${national}`)
    }
  }

  return Array.from(candidates).filter((value) => value.length >= 6)
}
