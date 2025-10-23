export type CurrencyDefinition = {
    code: string
    label: string
    symbol: string
    narrowSymbol?: string
    aliases?: string[]
}

const definitions: CurrencyDefinition[] = [
    {
        code: 'USD',
        label: 'United States Dollar',
        symbol: 'US$',
        aliases: ['US$', 'U$S', 'U$D', 'USD$', 'IUSD', 'DOLLARS', 'DOLARES', 'DÓLARES'],
    },
    {
        code: 'UYU',
        label: 'Uruguayan Peso',
        symbol: '$',
        aliases: ['UY$', 'UY$S', '$U', 'PESO', 'PESOS'],
    },
    { code: 'EUR', label: 'Euro', symbol: '€' },
    { code: 'GBP', label: 'British Pound Sterling', symbol: '£' },
    { code: 'ARS', label: 'Argentine Peso', symbol: '$' },
    { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
    { code: 'CLP', label: 'Chilean Peso', symbol: '$' },
    { code: 'MXN', label: 'Mexican Peso', symbol: '$' },
    { code: 'CAD', label: 'Canadian Dollar', symbol: '$' },
    { code: 'AUD', label: 'Australian Dollar', symbol: '$' },
    { code: 'NZD', label: 'New Zealand Dollar', symbol: '$' },
    { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
    { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
    { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
    { code: 'PEN', label: 'Peruvian Sol', symbol: 'S/' },
    { code: 'COP', label: 'Colombian Peso', symbol: '$' },
    { code: 'PYG', label: 'Paraguayan Guaraní', symbol: '₲' },
    { code: 'BOB', label: 'Boliviano', symbol: 'Bs' },
    { code: 'VES', label: 'Venezuelan Bolívar', symbol: 'Bs.' },
    { code: 'CRC', label: 'Costa Rican Colón', symbol: '₡' },
] as const

export const CURRENCY_DEFINITIONS: readonly CurrencyDefinition[] = definitions

export const CURRENCY_DEFINITION_MAP: ReadonlyMap<string, CurrencyDefinition> = new Map(
    definitions.map((item) => [item.code, item]),
)

export const DEFAULT_CURRENCIES = ['USD', 'UYU'] as const

export function getCurrencyDefinition(code?: string | null): CurrencyDefinition | undefined {
    if (!code) {
        return undefined
    }
    const normalized = String(code).trim().toUpperCase()
    if (!normalized) {
        return undefined
    }
    const direct = CURRENCY_DEFINITION_MAP.get(normalized)
    if (direct) {
        return direct
    }
    for (const item of definitions) {
        if (!item.aliases?.length) {
            continue
        }
        if (item.aliases.some((alias) => alias.toUpperCase() === normalized)) {
            return item
        }
    }
    return undefined
}

export function getCurrencySymbol(code?: string | null): string | undefined {
    return getCurrencyDefinition(code)?.symbol
}

export function isKnownCurrency(code?: string | null): boolean {
    return Boolean(getCurrencyDefinition(code))
}
