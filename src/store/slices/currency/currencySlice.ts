import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type CurrencyCode = 'UYU' | 'USD'

export type CurrencyState = {
    code: CurrencyCode
}

const initialState: CurrencyState = {
    code: 'UYU',
}

export const currencySlice = createSlice({
    name: 'currency',
    initialState,
    reducers: {
        setCurrency: (state, action: PayloadAction<CurrencyCode>) => {
            state.code = action.payload
        },
    },
})

export const { setCurrency } = currencySlice.actions

export default currencySlice.reducer

