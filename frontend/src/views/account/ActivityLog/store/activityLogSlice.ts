import { createSlice, createAsyncThunk, current } from '@reduxjs/toolkit'
import { apiGetAccountLogData } from '@/services/AccountServices'
import {
    LOGIN,
    PASSWORD_CHANGE,
    DEVICE_SIGN_IN,
    PROFILE_UPDATE,
    SECURITY_ALERT,
} from '../constants'

type Event = {
    type: string
    dateTime: number
    userName: string
    userImg?: string
    description?: string
    metadata?: Record<string, string | undefined>
}

type Log = {
    id: string
    date: number
    events: Event[]
}

type Logs = Log[]

type GetAccountLogDataRequest = {
    filter: string[]
    activityIndex: number
}

type GetAccountLogDataResponse = {
    data: Logs
    loadable: boolean
}

export type ActivityLogState = {
    loading: boolean
    loadMoreLoading: boolean
    loadable: boolean
    activityIndex: number
    logs: Logs
    selectedType: string[]
}

export const SLICE_NAME = 'accountActivityLog'

export const getLogs = createAsyncThunk(
    SLICE_NAME + '/getLogs',
    async (data: GetAccountLogDataRequest) => {
        const response = await apiGetAccountLogData<
            GetAccountLogDataResponse,
            GetAccountLogDataRequest
        >(data)
        return response.data
    },
)

export const filterLogs = createAsyncThunk(
    SLICE_NAME + '/filterLogs',
    async (data: GetAccountLogDataRequest) => {
        const response = await apiGetAccountLogData<
            GetAccountLogDataResponse,
            GetAccountLogDataRequest
        >(data)
        return response.data
    },
)

const initialState: ActivityLogState = {
    loading: false,
    loadMoreLoading: false,
    loadable: false,
    activityIndex: 1,
    logs: [],
    selectedType: [
        LOGIN,
        DEVICE_SIGN_IN,
        PROFILE_UPDATE,
        PASSWORD_CHANGE,
        SECURITY_ALERT,
    ],
}

const activityLogSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setActivityIndex: (state, action) => {
            state.activityIndex = action.payload
        },
        setSelected: (state, action) => {
            state.selectedType = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getLogs.fulfilled, (state, action) => {
                const currentState = current(state)
                state.logs = [...currentState.logs, ...action.payload.data]
                state.loadMoreLoading = false
                state.loadable = action.payload.loadable
            })
            .addCase(getLogs.pending, (state) => {
                state.loadMoreLoading = true
            })
            .addCase(filterLogs.fulfilled, (state, action) => {
                state.logs = action.payload.data
                state.loading = false
                state.loadable = action.payload.loadable
            })
            .addCase(filterLogs.pending, (state) => {
                state.loading = true
            })
    },
})

export const { setActivityIndex, setSelected } = activityLogSlice.actions

export default activityLogSlice.reducer
