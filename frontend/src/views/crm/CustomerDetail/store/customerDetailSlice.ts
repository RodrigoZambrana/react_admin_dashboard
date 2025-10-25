import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetCustomerDetails,
    apiDeleteCustomer,
    apiUpsertCustomer,
} from '@/services/CustomersService'

export const SLICE_NAME = 'crmCustomerDetails'

type PersonalInfo = {
    location: string
    phoneNumber: string
    phoneNumbers?: string[]
    facebook: string
    twitter: string
    pinterest: string
    linkedIn: string
}

export type CustomerOrder = {
    id: string
    status: string
    statusCode?: number | null
    amount: number
    date: number
    currency?: string
}

export type CustomerBudget = CustomerOrder

export type CustomerActivity = {
    id: string
    title: string
    type?: string
    color?: string | null
    startDate: number
    endDate?: number | null
    allDay?: boolean
    location?: string
    description?: string
}

export type Customer = {
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
    orders?: CustomerOrder[]
    budgets?: CustomerBudget[]
    activities?: CustomerActivity[]
    addresses?: Array<{
        street?: string
        number?: string
        corner?: string
        apartment?: string
        city?: string
        country?: string
        countryCode?: string
        isPrimary?: boolean
        comments?: string
    }>
}

type GetCrmCustomerDetailsResponse = Customer

type GetCrmCustomerDetailsRequest = { id: string }

// eslint-disable-next-line @typescript-eslint/ban-types
type DeleteCrmCustomerResponse = {}

type DeleteCrmCustomerRequest = { id: string }

export type CustomerDetailState = {
    loading: boolean
    profileData: Partial<Customer>
    ordersData: CustomerOrder[]
    budgetsData: CustomerBudget[]
    activitiesData: CustomerActivity[]
    editCustomerDetailDialog: boolean
    error?: string | null
}

export const getCustomer = createAsyncThunk(
    SLICE_NAME + '/getCustomer',
    async (data: GetCrmCustomerDetailsRequest) => {
        const response = await apiGetCustomerDetails<
            GetCrmCustomerDetailsResponse,
            GetCrmCustomerDetailsRequest
        >(data)
        return response.data
    },
)

export const deleteCustomer = createAsyncThunk(
    SLICE_NAME + '/deleteCustomer',
    async (data: DeleteCrmCustomerRequest) => {
        const response = await apiDeleteCustomer<
            DeleteCrmCustomerResponse,
            DeleteCrmCustomerRequest
        >(data)
        return response.data
    },
)

export const putCustomer = createAsyncThunk(
    SLICE_NAME + '/putCustomer',
    async (data: Customer) => {
        const response = await apiUpsertCustomer(data)
        return response.data
    },
)

const initialState: CustomerDetailState = {
    loading: true,
    profileData: {},
    ordersData: [],
    budgetsData: [],
    activitiesData: [],
    editCustomerDetailDialog: false,
    error: null,
}

const customerDetailSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updateProfileData: (state, action) => {
            state.profileData = action.payload
            if (Array.isArray(action.payload?.activities)) {
                state.activitiesData = action.payload.activities
            }
            if (Array.isArray(action.payload?.budgets)) {
                state.budgetsData = action.payload.budgets
            }
            if (Array.isArray(action.payload?.orders)) {
                state.ordersData = action.payload.orders
            }
        },
        openEditCustomerDetailDialog: (state) => {
            state.editCustomerDetailDialog = true
        },
        closeEditCustomerDetailDialog: (state) => {
            state.editCustomerDetailDialog = false
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getCustomer.fulfilled, (state, action) => {
                state.loading = false
                state.profileData = action.payload
                state.ordersData = action.payload?.orders || []
                state.budgetsData = action.payload?.budgets || []
                state.activitiesData = action.payload?.activities || []
                state.error = null
            })
            .addCase(getCustomer.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(getCustomer.rejected, (state, action) => {
                state.loading = false
                state.profileData = {}
                state.ordersData = []
                state.budgetsData = []
                state.activitiesData = []
                state.error = action.error?.message || 'Failed to load customer'
            })
    },
})

export const {
    updateProfileData,
    openEditCustomerDetailDialog,
    closeEditCustomerDetailDialog,
} = customerDetailSlice.actions

export default customerDetailSlice.reducer
