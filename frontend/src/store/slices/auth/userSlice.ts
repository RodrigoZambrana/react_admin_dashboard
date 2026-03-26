import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SLICE_BASE_NAME } from './constants'

export type UserState = {
    avatar?: string
    displayName?: string
    email?: string
    authority?: string[]
    name?: string
    lastName?: string
    capabilityGroups?: string[]
    directCapabilities?: string[]
    capabilityEnvelope?: string[]
    capabilitySource?: string
    userManagementPolicy?: {
        canAccessUserManagement: boolean
        canManageUserCapabilities: boolean
        allowedUserManagementRoles: string[]
        allowedCapabilityManagementRoles: string[]
        userManagementPolicySource?: 'database' | 'environment'
        capabilityManagementPolicySource?: 'database' | 'environment'
    }
}

const initialState: UserState = {
    avatar: '',
    displayName: '',
    email: '',
    authority: [],
    name: '',
    lastName: '',
    capabilityGroups: [],
    directCapabilities: [],
    capabilityEnvelope: [],
    capabilitySource: '',
    userManagementPolicy: {
        canAccessUserManagement: false,
        canManageUserCapabilities: false,
        allowedUserManagementRoles: [],
        allowedCapabilityManagementRoles: [],
        userManagementPolicySource: 'environment',
        capabilityManagementPolicySource: 'environment',
    },
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
            state.capabilityGroups = (action.payload?.capabilityGroups ?? []).map(
                (entry) => entry?.trim?.() ?? '',
            )
            state.capabilityGroups = state.capabilityGroups.filter(Boolean)
            state.directCapabilities = (
                action.payload?.directCapabilities ?? []
            ).map((entry) => entry?.trim?.() ?? '')
            state.directCapabilities = state.directCapabilities.filter(Boolean)
            state.capabilityEnvelope = (
                action.payload?.capabilityEnvelope ?? []
            ).map((entry) => entry?.trim?.() ?? '')
            state.capabilityEnvelope = state.capabilityEnvelope.filter(Boolean)
            state.capabilitySource = action.payload?.capabilitySource?.trim?.() ?? ''
            state.userManagementPolicy = {
                canAccessUserManagement:
                    action.payload?.userManagementPolicy?.canAccessUserManagement ??
                    false,
                canManageUserCapabilities:
                    action.payload?.userManagementPolicy?.canManageUserCapabilities ??
                    false,
                allowedUserManagementRoles: (
                    action.payload?.userManagementPolicy
                        ?.allowedUserManagementRoles ?? []
                )
                    .map((entry) => entry?.trim?.() ?? '')
                    .filter(Boolean),
                allowedCapabilityManagementRoles: (
                    action.payload?.userManagementPolicy
                        ?.allowedCapabilityManagementRoles ?? []
                )
                    .map((entry) => entry?.trim?.() ?? '')
                    .filter(Boolean),
                userManagementPolicySource:
                    action.payload?.userManagementPolicy
                        ?.userManagementPolicySource ?? 'environment',
                capabilityManagementPolicySource:
                    action.payload?.userManagementPolicy
                        ?.capabilityManagementPolicySource ?? 'environment',
            }
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
