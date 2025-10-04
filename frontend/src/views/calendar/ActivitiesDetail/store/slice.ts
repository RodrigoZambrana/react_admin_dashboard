import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGetCalendarActivityDetails } from '@/services/CalendarService'

export const SLICE_NAME = 'calendarActivityDetails'

type PersonalInfo = {
    location: string
    title: string
    birthday: string
    phoneNumber: string
    phoneNumbers?: string[]
    facebook: string
    twitter: string
    pinterest: string
    linkedIn: string
}

export type ActivityOrder = {
    id: string
    status: string
    amount: number
    date: number
}

export type ActivityEntity = {
    id: string
    name: string
    firstName?: string
    lastName?: string
    email: string
    img: string
    role: string
    lastOnline: number
    status: string
    phoneNumber?: string
    phoneNumbers?: string[]
    personalInfo: PersonalInfo
    orders?: ActivityOrder[]
    detail?: string
    attachments?: {
        id: string
        name: string
        type?: string
        size?: number
        url?: string
    }[]
    comments?: {
        id: string
        message: string
        createdAt: string
        author?: string
    }[]
    isInternal?: boolean
}

type GetActivityDetailsResponse = ActivityEntity

type GetActivityRequest = { id: string }

export type ActivityDetailState = {
    loading: boolean
    profileData: Partial<ActivityEntity>
    ordersData: ActivityOrder[]
    editActivityDialog: boolean
}

export const getActivity = createAsyncThunk(
    SLICE_NAME + '/getActivity',
    async (data: GetActivityRequest) => {
        const response = await apiGetCalendarActivityDetails(data)
        return response as GetActivityDetailsResponse
    },
)

const initialState: ActivityDetailState = {
    loading: true,
    profileData: {},
    ordersData: [],
    editActivityDialog: false,
}

const slice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updateProfileData: (state, action) => {
            state.profileData = action.payload
        },
        openEditActivityDialog: (state) => {
            state.editActivityDialog = true
        },
        closeEditActivityDialog: (state) => {
            state.editActivityDialog = false
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getActivity.fulfilled, (state, action) => {
                state.loading = false
                state.profileData = action.payload
                state.ordersData = []
            })
            .addCase(getActivity.pending, (state) => {
                state.loading = true
            })
    },
})

export const {
    updateProfileData,
    openEditActivityDialog,
    closeEditActivityDialog,
} = slice.actions

export default slice.reducer
