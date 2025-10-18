const currencyAliasMap: Record<string, string> = {
    IUSD: 'USD',
    USD: 'USD',
    'US$': 'USD',
    'U$S': 'USD',
    'U$D': 'USD',
    'USD$': 'USD',
    DOLARES: 'USD',
    DÓLARES: 'USD',
    DOLLARS: 'USD',
    UYU: 'UYU',
    'UY$': 'UYU',
    'UY$S': 'UYU',
    '$U': 'UYU',
    PESO: 'UYU',
    PESOS: 'UYU',
}

const sanitizeKey = (value: string) => value.replace(/[^A-Z]/g, '')

export function normalizeCurrencyCode(raw?: string | null, fallback?: string): string | undefined {
    const lookup = (input?: string | null): string | undefined => {
        if (!input) {
            return undefined
        }
        const trimmed = input.trim()
        if (!trimmed) {
            return undefined
        }
        const upper = trimmed.toUpperCase()
        if (currencyAliasMap[upper]) {
            return currencyAliasMap[upper]
        }
        const sanitized = sanitizeKey(upper)
        if (currencyAliasMap[sanitized]) {
            return currencyAliasMap[sanitized]
        }
        return upper
    }

    const resolved = lookup(raw)
    if (resolved) {
        return resolved
    }
    return lookup(fallback)
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
        normalizeCurrencyCode(currency, options.fallbackCurrency) ??
        options.fallbackCurrency
    const language = locale || (typeof window !== 'undefined' ? window.navigator.language : undefined) || 'en-US'
    const baseFormatter = new Intl.NumberFormat(language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
    if (normalizedCurrency) {
        try {
            const formatter = new Intl.NumberFormat(language, {
                style: 'currency',
                currency: normalizedCurrency,
                currencyDisplay: 'symbol',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
            return formatter.format(safeValue)
        } catch {
            // fall through to base formatter
        }
    }
    return baseFormatter.format(safeValue)
}

