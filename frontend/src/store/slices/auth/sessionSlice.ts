import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SLICE_BASE_NAME } from './constants'

export interface SessionState {
    signedIn: boolean
    token: string | null
    expiresAt: string | null
    initialized: boolean
}

const initialState: SessionState = {
    signedIn: false,
    token: null,
    expiresAt: null,
    initialized: false,
}

const sessionSlice = createSlice({
    name: `${SLICE_BASE_NAME}/session`,
    initialState,
    reducers: {
        signInSuccess(
            state,
            action: PayloadAction<{ token: string; expiresAt?: string | null }>,
        ) {
            state.signedIn = true
            state.token = action.payload.token
            state.expiresAt = action.payload.expiresAt ?? null
            state.initialized = true
        },
        signOutSuccess(state) {
            state.signedIn = false
            state.token = null
            state.expiresAt = null
            state.initialized = true
        },
    },
})

export const { signInSuccess, signOutSuccess } = sessionSlice.actions
export default sessionSlice.reducer
