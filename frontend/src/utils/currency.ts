import {
    CURRENCY_DEFINITIONS,
    DEFAULT_CURRENCIES,
    getCurrencyDefinition as sharedGetCurrencyDefinition,
    getCurrencySymbol as sharedGetCurrencySymbol,
    type CurrencyDefinition,
} from '../../../shared/currency'

const sanitizeKey = (value: string) => value.replace(/[^A-Z]/g, '')

const buildAliasMap = () => {
    const map = new Map<string, string>()
    const register = (target: string, code: string) => {
        const upper = target.trim().toUpperCase()
        if (!upper) {
            return
        }
        map.set(upper, code)
        const sanitized = sanitizeKey(upper)
        if (sanitized && sanitized !== upper) {
            map.set(sanitized, code)
        }
    }
    CURRENCY_DEFINITIONS.forEach((definition) => {
        register(definition.code, definition.code)
        if (definition.symbol) {
            register(definition.symbol, definition.code)
        }
        if (definition.narrowSymbol) {
            register(definition.narrowSymbol, definition.code)
        }
        definition.aliases?.forEach((alias) => {
            register(alias, definition.code)
        })
    })
    return map
}

const currencyAliasMap = buildAliasMap()

const resolveDefinition = (input?: string | null): CurrencyDefinition | undefined => {
    if (input === null || input === undefined) {
        return undefined
    }
    const trimmed = String(input).trim()
    if (!trimmed) {
        return undefined
    }
    const direct = sharedGetCurrencyDefinition(trimmed)
    if (direct) {
        return direct
    }
    const upper = trimmed.toUpperCase()
    const alias = currencyAliasMap.get(upper)
    if (alias) {
        return sharedGetCurrencyDefinition(alias) ?? { code: alias, label: alias, symbol: alias }
    }
    const sanitized = sanitizeKey(upper)
    if (sanitized) {
        const sanitizedAlias = currencyAliasMap.get(sanitized)
        if (sanitizedAlias) {
            return sharedGetCurrencyDefinition(sanitizedAlias) ?? {
                code: sanitizedAlias,
                label: sanitizedAlias,
                symbol: sanitizedAlias,
            }
        }
        const sanitizedDefinition = sharedGetCurrencyDefinition(sanitized)
        if (sanitizedDefinition) {
            return sanitizedDefinition
        }
    }
    return undefined
}

export const STANDARD_FALLBACK_CURRENCIES = [...DEFAULT_CURRENCIES]

export function getCurrencyDefinition(code?: string | null): CurrencyDefinition | undefined {
    return resolveDefinition(code)
}

export function getCurrencySymbol(code?: string | null): string | undefined {
    return sharedGetCurrencySymbol(code) ?? resolveDefinition(code)?.symbol
}

export function formatCurrencyOptionLabel(code: string, label?: string, symbol?: string): string {
    const definition = resolveDefinition(code)
    const resolvedLabel = label ?? definition?.label
    const resolvedSymbol = symbol ?? definition?.symbol
    const segments: string[] = [code.toUpperCase()]
    if (resolvedLabel) {
        const trimmed = resolvedLabel.trim()
        if (trimmed && trimmed.toUpperCase() !== code.toUpperCase()) {
            segments.push(trimmed)
        }
    }
    const suffix = resolvedSymbol?.trim()
    return suffix ? `${segments.join(' · ')} (${suffix})` : segments.join(' · ')
}

export function normalizeCurrencyCode(raw?: string | null, fallback?: string): string | undefined {
    const lookup = (input?: string | null): string | undefined => {
        const definition = resolveDefinition(input)
        if (definition) {
            return definition.code
        }
        if (!input) {
            return undefined
        }
        const trimmed = String(input).trim()
        if (!trimmed) {
            return undefined
        }
        const upper = trimmed.toUpperCase()
        if (/^[A-Z]{3,5}$/.test(upper)) {
            return upper
        }
        const sanitized = sanitizeKey(upper)
        if (sanitized && /^[A-Z]{3,5}$/.test(sanitized)) {
            return sanitized
        }
        return undefined
    }

    return lookup(raw) ?? lookup(fallback)
}

export function formatCurrency(
    value?: number,
    currency?: string,
    locale?: string,
    options: { fallbackCurrency?: string } = {},
): string {
    const numeric = Number(value ?? 0)
    const safeValue = Number.isFinite(numeric) ? numeric : 0
    const normalizedCurrency =
        normalizeCurrencyCode(currency, options.fallbackCurrency) ?? options.fallbackCurrency
    const language =
        locale ||
        (typeof window !== 'undefined' ? window.navigator.language : undefined) ||
        'en-US'

    const numberFormatter = new Intl.NumberFormat(language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    if (normalizedCurrency) {
        const symbolFromDefinition = getCurrencySymbol(normalizedCurrency)
        let resolvedSymbol = symbolFromDefinition
        try {
            const currencyFormatter = new Intl.NumberFormat(language, {
                style: 'currency',
                currency: normalizedCurrency,
                currencyDisplay: 'symbol',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
            if (!resolvedSymbol && typeof currencyFormatter.formatToParts === 'function') {
                const parts = currencyFormatter.formatToParts(0)
                resolvedSymbol =
                    parts.find((part) => part.type === 'currency')?.value ?? undefined
            }
        } catch {
            // ignore and fall back
        }

        const absoluteFormatted = numberFormatter.format(Math.abs(safeValue))
        const valueWithSign = safeValue < 0 ? `-${absoluteFormatted}` : absoluteFormatted
        const printableSymbol = (resolvedSymbol || normalizedCurrency || '').trim()
        if (printableSymbol) {
            return `${printableSymbol} ${valueWithSign}`.trim()
        }
        return valueWithSign.trim()
    }

    const absoluteFormatted = numberFormatter.format(Math.abs(safeValue))
    const valueWithSign = safeValue < 0 ? `-${absoluteFormatted}` : absoluteFormatted
    return valueWithSign.trim()
}
