import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { STANDARD_FALLBACK_CURRENCIES } from '@/utils/currency'

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

export type CurrencyState = {
    code: CurrencyCode
    available: CurrencyCode[]
    loaded: boolean
    exchangeSnapshot: BaseCurrencySnapshot | null
    exchangeLoading: boolean
    exchangeError?: string
}

const fallbackCurrencies: CurrencyCode[] = Array.from(
    new Set<CurrencyCode>(['UYU', 'USD', ...STANDARD_FALLBACK_CURRENCIES]),
)

const initialState: CurrencyState = {
    code: 'UYU',
    available: fallbackCurrencies,
    loaded: false,
    exchangeSnapshot: null,
    exchangeLoading: false,
    exchangeError: undefined,
}

export const currencySlice = createSlice({
    name: 'currency',
    initialState,
    reducers: {
        setCurrency: (state, action: PayloadAction<CurrencyCode>) => {
            state.code = action.payload
        },
        setAvailableCurrencies: (state, action: PayloadAction<CurrencyCode[]>) => {
            const sanitized = action.payload
                .map((item) => String(item || '').trim().toUpperCase())
                .filter((item) => /^[A-Z]{3,5}$/.test(item))
            state.available = sanitized.length ? sanitized : fallbackCurrencies
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
    setAvailableCurrencies,
    setExchangeSnapshot,
    setExchangeLoading,
    setExchangeError,
} = currencySlice.actions

export default currencySlice.reducer
