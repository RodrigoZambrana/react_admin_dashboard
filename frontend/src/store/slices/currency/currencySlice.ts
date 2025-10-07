import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type CurrencyCode = string

export type CurrencyState = {
    code: CurrencyCode
    available: CurrencyCode[]
    loaded: boolean
}

const fallbackCurrencies: CurrencyCode[] = ['UYU', 'USD']

const initialState: CurrencyState = {
    code: 'UYU',
    available: fallbackCurrencies,
    loaded: false,
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
    },
})

export const { setCurrency, setAvailableCurrencies } = currencySlice.actions

export default currencySlice.reducer
