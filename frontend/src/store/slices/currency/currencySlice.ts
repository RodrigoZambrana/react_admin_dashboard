import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import {
    getStandardFallbackCurrencies,
    type CurrencyCatalogPayload,
    type CurrencyDefinition,
} from '@/utils/currency'

export type CurrencyCode = string

export type CurrencyOption = {
    value: CurrencyCode
    label: string
}

export type ExchangeRateMap = Record<CurrencyCode, number>

export type BaseCurrencySnapshot = {
    base: CurrencyCode
    rates: ExchangeRateMap
    currencies: CurrencyCode[]
    options: CurrencyOption[]
    fetchedAt: number
}

export type CurrencyCatalogState = {
    definitions: CurrencyDefinition[]
    defaultCodes: CurrencyCode[]
    loaded: boolean
}

export type CurrencyState = {
    code: CurrencyCode
    available: CurrencyCode[]
    loaded: boolean
    exchangeSnapshot: BaseCurrencySnapshot | null
    exchangeLoading: boolean
    exchangeError?: string
    catalog: CurrencyCatalogState
}

const DEFAULT_FALLBACK = Array.from(new Set<CurrencyCode>(['UYU', 'USD', ...getStandardFallbackCurrencies()]))

const initialState: CurrencyState = {
    code: DEFAULT_FALLBACK[0] ?? 'UYU',
    available: DEFAULT_FALLBACK,
    loaded: false,
    exchangeSnapshot: null,
    exchangeLoading: false,
    exchangeError: undefined,
    catalog: {
        definitions: [],
        defaultCodes: getStandardFallbackCurrencies(),
        loaded: false,
    },
}

const normalizeList = (codes: CurrencyCode[], fallback: CurrencyCode[]): CurrencyCode[] => {
    const sanitized = codes
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => /^[A-Z]{3,5}$/.test(item))
    if (sanitized.length) {
        return Array.from(new Set(sanitized))
    }
    return fallback
}

export const currencySlice = createSlice({
    name: 'currency',
    initialState,
    reducers: {
        setCurrency: (state, action: PayloadAction<CurrencyCode>) => {
            state.code = action.payload
        },
        setCurrencyCatalog: (state, action: PayloadAction<CurrencyCatalogPayload>) => {
            const fallback = normalizeList(action.payload.defaults, DEFAULT_FALLBACK)
            state.catalog = {
                definitions: Array.isArray(action.payload.definitions)
                    ? action.payload.definitions
                    : [],
                defaultCodes: fallback,
                loaded: true,
            }
            if (!state.loaded) {
                state.available = fallback
                state.code = state.available[0] ?? state.code
            }
        },
        setAvailableCurrencies: (state, action: PayloadAction<CurrencyCode[]>) => {
            const fallback = state.catalog.loaded
                ? state.catalog.defaultCodes
                : DEFAULT_FALLBACK
            const normalized = normalizeList(action.payload, fallback)
            state.available = normalized
            if (!state.available.includes(state.code)) {
                state.code = state.available[0]
            }
            state.loaded = true
        },
        setExchangeSnapshot: (state, action: PayloadAction<BaseCurrencySnapshot | null>) => {
            state.exchangeSnapshot = action.payload
            state.exchangeLoading = false
            state.exchangeError = undefined
        },
        setExchangeLoading: (state, action: PayloadAction<boolean>) => {
            state.exchangeLoading = action.payload
            if (action.payload) {
                state.exchangeError = undefined
            }
        },
        setExchangeError: (state, action: PayloadAction<string | undefined>) => {
            state.exchangeError = action.payload
            state.exchangeLoading = false
        },
    },
})

export const {
    setCurrency,
    setCurrencyCatalog,
    setAvailableCurrencies,
    setExchangeSnapshot,
    setExchangeLoading,
    setExchangeError,
} = currencySlice.actions

export default currencySlice.reducer
