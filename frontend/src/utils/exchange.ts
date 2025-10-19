import { normalizeCurrencyCode } from './currency'
import type {
    BaseCurrencySnapshot,
    CurrencyCode,
    CurrencyOption,
    ExchangeRateMap,
} from '@/store/slices/currency/currencySlice'

export type CurrencyOptionPayload = {
    code?: string
    label?: string
    symbol?: string
}

export type ExchangeRatePayload = {
    quote?: string
    rate?: number
}

export type SystemConfigExchangePayload = {
    currencyBase?: string
    currencies?: string[]
    currencyOptions?: CurrencyOptionPayload[]
    exchangeRates?: ExchangeRatePayload[]
}

export type ExchangeSnapshotOptions = {
    fallbackBase: CurrencyCode
    fallbackCurrencies: CurrencyCode[]
    fallbackOptions?: CurrencyOption[]
}

export const buildCurrencyOptionLabel = (
    code: string,
    text?: string,
    symbol?: string,
): string => {
    const parts: string[] = []
    const normalized = String(code || '').trim().toUpperCase()
    if (normalized) {
        parts.push(normalized)
    }
    const trimmedText = String(text || '').trim()
    if (trimmedText) {
        parts.push(trimmedText)
    }
    const baseLabel = parts.join(' · ') || normalized || trimmedText
    const suffix = String(symbol || '').trim()
    return suffix ? `${baseLabel} (${suffix})` : baseLabel
}

export const ensureCurrencyPresence = (
    list: Array<string | undefined | null>,
    baseCode: CurrencyCode,
): CurrencyCode[] => {
    const normalizedBase =
        normalizeCurrencyCode(baseCode, baseCode) || (baseCode as CurrencyCode)
    const normalized = list
        .map((code) => normalizeCurrencyCode(code, normalizedBase))
        .filter((code): code is CurrencyCode => Boolean(code))
    if (!normalized.includes(normalizedBase)) {
        normalized.unshift(normalizedBase)
    }
    return Array.from(new Set(normalized))
}

const ensureOptionsPresence = (
    currencies: CurrencyCode[],
    source: CurrencyOption[],
): CurrencyOption[] => {
    const optionMap = new Map<CurrencyCode, CurrencyOption>()
    source.forEach((option) => {
        if (!option?.value) {
            return
        }
        const value = String(option.value || '').trim().toUpperCase() as CurrencyCode
        optionMap.set(value, {
            value,
            label: option.label || value,
        })
    })
    currencies.forEach((code) => {
        if (!optionMap.has(code)) {
            optionMap.set(code, {
                value: code,
                label: code,
            })
        }
    })
    return Array.from(optionMap.values())
}

export const createExchangeSnapshot = (
    payload: SystemConfigExchangePayload | undefined,
    options: ExchangeSnapshotOptions,
): BaseCurrencySnapshot => {
    const fallbackBase =
        normalizeCurrencyCode(options.fallbackBase, options.fallbackBase) ||
        options.fallbackBase
    const rawBase = normalizeCurrencyCode(
        payload?.currencyBase,
        fallbackBase,
    ) as CurrencyCode | undefined
    const base = rawBase || fallbackBase

    const fallbackCurrencies = ensureCurrencyPresence(
        options.fallbackCurrencies,
        base,
    )
    const configuredCurrencies = ensureCurrencyPresence(
        Array.isArray(payload?.currencies) ? payload?.currencies : [],
        base,
    )
    const currencies = ensureCurrencyPresence(
        [...configuredCurrencies, ...fallbackCurrencies],
        base,
    )

    const optionSource: CurrencyOption[] = Array.isArray(payload?.currencyOptions)
        ? payload!.currencyOptions
              .map((item) => {
                  const code = normalizeCurrencyCode(item?.code, base)
                  if (!code) {
                      return null
                  }
                  return {
                      value: code,
                      label: buildCurrencyOptionLabel(code, item?.label, item?.symbol),
                  }
              })
              .filter((item): item is CurrencyOption => Boolean(item))
        : options.fallbackOptions ||
          fallbackCurrencies.map((code) => ({
              value: code,
              label: buildCurrencyOptionLabel(code),
          }))

    const rates: ExchangeRateMap = {
        [base]: 1,
    }
    if (Array.isArray(payload?.exchangeRates)) {
        payload?.exchangeRates.forEach((entry) => {
            const quote = normalizeCurrencyCode(entry?.quote, base)
            const numericRate = Number(entry?.rate)
            if (!quote || quote === base) {
                return
            }
            if (!Number.isFinite(numericRate) || numericRate <= 0) {
                return
            }
            rates[quote as CurrencyCode] = numericRate
        })
    }

    currencies.forEach((code) => {
        if (rates[code] === undefined) {
            rates[code] = code === base ? 1 : 0
        }
    })

    const optionsList = ensureOptionsPresence(currencies, optionSource)

    return {
        base,
        rates,
        currencies,
        options: optionsList,
        fetchedAt: Date.now(),
    }
}
