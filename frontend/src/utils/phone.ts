import { countryList } from '@/constants/countries.constant'

export const DEFAULT_DIAL_CODE = '+598'

export type DialOption = {
    label: string
    value: string
    shortLabel: string
}

const sanitizeDialCode = (dialCode: unknown): string | null => {
    if (typeof dialCode !== 'string') {
        return null
    }
    const digits = dialCode.replace(/\D/g, '')
    if (!digits) {
        return null
    }
    return `+${digits}`
}

const sanitizedCountryDialList = countryList
    .map((country) => {
        const sanitizedDial = sanitizeDialCode(country.dialCode)
        if (!sanitizedDial) {
            return null
        }
        return {
            ...country,
            dialCode: sanitizedDial,
        }
    })
    .filter((country): country is { label: string; dialCode: string; value: string } => Boolean(country))

const uniqueDialCodes = Array.from(
    new Set(sanitizedCountryDialList.map((country) => country.dialCode)),
)

const dialCodesByLengthDesc = uniqueDialCodes
    .slice()
    .sort((a, b) => b.length - a.length)

const DEFAULT_DIAL = sanitizeDialCode(DEFAULT_DIAL_CODE) ?? '+598'

export const countryDialOptions: DialOption[] = sanitizedCountryDialList
    .map((country) => ({
        label: `${country.label} (${country.dialCode})`,
        value: country.dialCode,
        shortLabel: country.dialCode,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

export const resolveDialCode = (
    value: string,
    fallbackDialCode: string = DEFAULT_DIAL,
): string => {
    const trimmed = value.trim()
    if (!trimmed) {
        return fallbackDialCode
    }
    let normalized = trimmed.replace(/[^\d+]+/g, '')
    if (normalized.startsWith('00')) {
        normalized = `+${normalized.slice(2)}`
    }
    if (!normalized.startsWith('+')) {
        normalized = `+${normalized}`
    }
    const digitsOnly = normalized.slice(1).replace(/\D/g, '')
    if (!digitsOnly) {
        return fallbackDialCode
    }
    const normalizedCandidate = `+${digitsOnly}`
    const matched = dialCodesByLengthDesc.find((dial) =>
        normalizedCandidate.startsWith(dial),
    )
    if (matched) {
        return matched
    }
    const fallbackDigits = fallbackDialCode.replace(/\D/g, '')
    if (digitsOnly.startsWith(fallbackDigits)) {
        return `+${fallbackDigits}`
    }
    return fallbackDialCode
}

export const composePhoneNumber = (
    dialCodeInput: string,
    nationalNumberInput: string,
    fallbackDialCode: string = DEFAULT_DIAL,
): string => {
    const sanitizedDial =
        sanitizeDialCode(dialCodeInput) ?? sanitizeDialCode(fallbackDialCode) ?? fallbackDialCode
    const digits = (nationalNumberInput || '').replace(/\D/g, '')
    const trimmedDigits = digits.replace(/^0+/, '')
    if (!trimmedDigits) {
        return sanitizedDial
    }
    return `${sanitizedDial}${trimmedDigits}`
}

export const splitPhoneNumber = (
    input: string | null | undefined,
    fallbackDialCode: string = DEFAULT_DIAL,
): { dialCode: string; nationalNumber: string } => {
    const value = typeof input === 'string' ? input.trim() : ''
    if (!value) {
        return { dialCode: fallbackDialCode, nationalNumber: '' }
    }
    const dialCode = resolveDialCode(value, fallbackDialCode)
    const normalized = value.startsWith('+') || value.startsWith('00')
        ? value
        : `${dialCode}${value}`
    const sanitized = normalized
        .replace(/[^\d+]+/g, '')
        .replace(/^00/, '+')
    const remainder = sanitized.startsWith(dialCode)
        ? sanitized.slice(dialCode.length)
        : sanitized.startsWith('+')
        ? sanitized.slice(1)
        : sanitized
    const nationalNumber = remainder.replace(/^0+/, '')
    return { dialCode, nationalNumber }
}

export const normalizePhoneNumber = (
    input: string | null | undefined,
    fallbackDialCode: string = DEFAULT_DIAL,
): string => {
    const { dialCode, nationalNumber } = splitPhoneNumber(input, fallbackDialCode)
    if (!nationalNumber) {
        return ''
    }
    return `${dialCode}${nationalNumber}`
}

export const normalizePhoneNumberList = (
    values: Array<string | null | undefined>,
    fallbackDialCode: string = DEFAULT_DIAL,
): string[] => {
    const normalized = values
        .map((value) => normalizePhoneNumber(value, fallbackDialCode))
        .filter((value) => value.length > 0)
    return Array.from(new Set(normalized))
}

export const hasDialCodeOnly = (value: string, fallbackDialCode: string = DEFAULT_DIAL) => {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (!normalized) {
        return true
    }
    const dialCode = resolveDialCode(normalized, fallbackDialCode)
    const sanitized = normalized.replace(/[^\d+]+/g, '').replace(/^00/, '+')
    if (!sanitized.startsWith(dialCode)) {
        return false
    }
    const remainder = sanitized.slice(dialCode.length).replace(/\D/g, '')
    return remainder.length === 0
}
