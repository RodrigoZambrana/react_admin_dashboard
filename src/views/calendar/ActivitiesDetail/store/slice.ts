import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGetCalendarActivityDetails } from '@/services/CalendarService'

export const SLICE_NAME = 'calendarActivityDetails'

type PersonalInfo = {
    location: string
    title: string
    birthday: string
    phoneNumber: string
    facebook: string
    twitter: string
    pinterest: string
    linkedIn: string
}

export type OrderHistory = {
    id: string
    item: string
    status: string
    amount: number
    date: number
}

export type PaymentMethod = {
    cardHolderName: string
    cardType: string
    expMonth: string
    expYear: string
    last4Number: string
    primary: boolean
}

export type Subscription = {
    plan: string
    status: string
    billing: string
    nextPaymentDate: number
    amount: number
}

export type ActivityEntity = {
    id: string
    name: string
    email: string
    img: string
    role: string
    lastOnline: number
    status: string
    personalInfo: PersonalInfo
}

type GetActivityDetailsResponse = ActivityEntity & {
    orderHistory?: OrderHistory[]
    paymentMethod?: PaymentMethod[]
    subscription?: Subscription[]
}

type GetActivityRequest = { id: string }

// eslint-disable-next-line @typescript-eslint/ban-types
type DeleteResponse = {}

type DeleteRequest = { id: string }

export type ActivityDetailState = {
    loading: boolean
    profileData: Partial<ActivityEntity>
    subscriptionData: Subscription[]
    paymentHistoryData: OrderHistory[]
    paymentMethodData: PaymentMethod[]
    deletePaymentMethodDialog: boolean
    editPaymentMethodDialog: boolean
    editActivityDialog: boolean
    selectedCard: Partial<PaymentMethod>
}

export const getActivity = createAsyncThunk(
    SLICE_NAME + '/getActivity',
    async (data: GetActivityRequest) => {
        const response = await apiGetCalendarActivityDetails<
            GetActivityDetailsResponse,
            GetActivityRequest
        >(data)
        return response.data
    },
)

// delete/update not implemented for calendar activities in mock yet

const initialState: ActivityDetailState = {
    loading: true,
    profileData: {},
    subscriptionData: [],
    paymentHistoryData: [],
    paymentMethodData: [],
    deletePaymentMethodDialog: false,
    editPaymentMethodDialog: false,
    editActivityDialog: false,
    selectedCard: {},
}

const slice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updatePaymentMethodData: (state, action) => {
            state.paymentMethodData = action.payload
        },
        updateProfileData: (state, action) => {
            state.profileData = action.payload
        },
        openDeletePaymentMethodDialog: (state) => {
            state.deletePaymentMethodDialog = true
        },
        closeDeletePaymentMethodDialog: (state) => {
            state.deletePaymentMethodDialog = false
        },
        openEditPaymentMethodDialog: (state) => {
            state.editPaymentMethodDialog = true
        },
        closeEditPaymentMethodDialog: (state) => {
            state.editPaymentMethodDialog = false
        },
        openEditActivityDialog: (state) => {
            state.editActivityDialog = true
        },
        closeEditActivityDialog: (state) => {
            state.editActivityDialog = false
        },
        updateSelectedCard: (state, action) => {
            state.selectedCard = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getActivity.fulfilled, (state, action) => {
                state.loading = false
                state.profileData = action.payload
                state.subscriptionData = action.payload?.subscription || []
                state.paymentHistoryData = action.payload?.orderHistory || []
                state.paymentMethodData = action.payload?.paymentMethod || []
            })
            .addCase(getActivity.pending, (state) => {
                state.loading = true
            })
    },
})

export const {
    updatePaymentMethodData,
    updateProfileData,
    openDeletePaymentMethodDialog,
    closeDeletePaymentMethodDialog,
    openEditPaymentMethodDialog,
    closeEditPaymentMethodDialog,
    openEditActivityDialog,
    closeEditActivityDialog,
    updateSelectedCard,
} = slice.actions

export default slice.reducer
