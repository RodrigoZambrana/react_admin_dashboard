import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SLICE_BASE_NAME } from './constants'

export type UserState = {
    avatar?: string
    displayName?: string
    email?: string
    authority?: string[]
    name?: string
    lastName?: string
}

const initialState: UserState = {
    avatar: '',
    displayName: '',
    email: '',
    authority: [],
    name: '',
    lastName: '',
}

const userSlice = createSlice({
    name: `${SLICE_BASE_NAME}/user`,
    initialState,
    reducers: {
        setUser(state, action: PayloadAction<UserState>) {
            state.avatar = action.payload?.avatar ?? ''
            const normalizedEmail = action.payload?.email?.trim?.() ?? ''
            state.email = normalizedEmail
            state.authority = (action.payload?.authority ?? []).map((role) =>
                role?.toUpperCase?.() ?? '',
            )
            state.authority = state.authority.filter((role) => role)
            state.name = action.payload?.name?.trim?.() ?? ''
            state.lastName = action.payload?.lastName?.trim?.() ?? ''
            const fullName = [state.name, state.lastName]
                .map((part) => part?.trim?.() ?? '')
                .filter(Boolean)
                .join(' ')
            state.displayName =
                action.payload?.displayName ??
                (fullName || normalizedEmail || '')
        },
    },
})

export const { setUser } = userSlice.actions
export default userSlice.reducer
