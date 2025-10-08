import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetCalendarActivityDetails,
    apiCreateCalendarActivityComment,
    apiUpdateCalendarActivityComment,
    apiDeleteCalendarActivityComment,
    type CalendarActivityComment,
} from '@/services/CalendarService'
import type { CalendarEventDto } from '@/services/CustomersService'

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
    customerId?: string | null
    startAt?: string
    endAt?: string
    allDay?: boolean
    eventType?: string
    eventColor?: string
    personalInfo: PersonalInfo
    orders?: ActivityOrder[]
    detail?: string
    attachments?: {
        id: string
        name: string
        type?: string
        size?: number
        url?: string
        content?: string
    }[]
    comments?: CalendarActivityComment[]
    isInternal?: boolean
    address?: {
        street?: string
        number?: string
        corner?: string
        apartment?: string
        city?: string
        country?: string
    }
    sourceEvent?: CalendarEventDto
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

export const addComment = createAsyncThunk(
    SLICE_NAME + '/addComment',
    async (data: { id: string; message: string }) => {
        const comment = await apiCreateCalendarActivityComment(data.id, {
            message: data.message,
        })
        return { activityId: data.id, comment }
    },
)

export const updateComment = createAsyncThunk(
    SLICE_NAME + '/updateComment',
    async (data: { activityId: string; commentId: string; message: string }) => {
        const comment = await apiUpdateCalendarActivityComment(data.commentId, {
            message: data.message,
        })
        return { activityId: data.activityId, comment }
    },
)

export const removeComment = createAsyncThunk(
    SLICE_NAME + '/removeComment',
    async (data: { activityId: string; commentId: string }) => {
        await apiDeleteCalendarActivityComment(data.commentId)
        return { activityId: data.activityId, commentId: data.commentId }
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
            .addCase(addComment.fulfilled, (state, action) => {
                if (state.profileData.id === action.payload.activityId) {
                    const existing = Array.isArray(state.profileData.comments)
                        ? [...state.profileData.comments]
                        : []
                    state.profileData = {
                        ...state.profileData,
                        comments: [...existing, action.payload.comment],
                    }
                }
            })
            .addCase(updateComment.fulfilled, (state, action) => {
                if (state.profileData.id === action.payload.activityId) {
                    const existing = Array.isArray(state.profileData.comments)
                        ? state.profileData.comments
                        : []
                    state.profileData = {
                        ...state.profileData,
                        comments: existing.map((comment) =>
                            comment.id === action.payload.comment.id
                                ? action.payload.comment
                                : comment,
                        ),
                    }
                }
            })
            .addCase(removeComment.fulfilled, (state, action) => {
                if (state.profileData.id === action.payload.activityId) {
                    const existing = Array.isArray(state.profileData.comments)
                        ? state.profileData.comments
                        : []
                    state.profileData = {
                        ...state.profileData,
                        comments: existing.filter(
                            (comment) => comment.id !== action.payload.commentId,
                        ),
                    }
                }
            })
    },
})

export const { updateProfileData } = slice.actions

export default slice.reducer
