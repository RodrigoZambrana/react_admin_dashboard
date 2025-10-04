import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetCrmCustomerDetails,
    apiDeleteCrmCustomer,
    apPutCrmCustomer,
} from '@/services/CrmService'

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
    addresses?: Array<{
        street?: string
        number?: string
        corner?: string
        apartment?: string
        city?: string
        country?: string
        countryCode?: string
        isPrimary?: boolean
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
    editCustomerDetailDialog: boolean
}

export const getCustomer = createAsyncThunk(
    SLICE_NAME + '/getCustomer',
    async (data: GetCrmCustomerDetailsRequest) => {
        const response = await apiGetCrmCustomerDetails<
            GetCrmCustomerDetailsResponse,
            GetCrmCustomerDetailsRequest
        >(data)
        return response.data
    },
)

export const deleteCustomer = createAsyncThunk(
    SLICE_NAME + '/deleteCustomer',
    async (data: DeleteCrmCustomerRequest) => {
        const response = await apiDeleteCrmCustomer<
            DeleteCrmCustomerResponse,
            DeleteCrmCustomerRequest
        >(data)
        return response.data
    },
)

export const putCustomer = createAsyncThunk(
    SLICE_NAME + '/putCustomer',
    async (data: Customer) => {
        const response = await apPutCrmCustomer(data)
        return response.data
    },
)

const initialState: CustomerDetailState = {
    loading: true,
    profileData: {},
    ordersData: [],
    editCustomerDetailDialog: false,
}

const customerDetailSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updateProfileData: (state, action) => {
            state.profileData = action.payload
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
            })
            .addCase(getCustomer.pending, (state) => {
                state.loading = true
            })
    },
})

export const {
    updateProfileData,
    openEditCustomerDetailDialog,
    closeEditCustomerDetailDialog,
} = customerDetailSlice.actions

export default customerDetailSlice.reducer
