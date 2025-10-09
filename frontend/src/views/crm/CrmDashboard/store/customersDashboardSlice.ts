import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGetCustomersDashboardData } from '@/services/CustomersService'

export type Statistic = {
    key: string
    label: string
    value: number
    growShrink: number
}

export type LeadRegion = {
    name: string
    value: number
}

export type Lead = {
    id: number
    name: string
    avatar: string
    status: number
    createdTime: number
    email: string
    assignee: string
}

export type Emails = {
    precent: number
    opened: number
    unopen: number
    total: number
}

export type DashboardData = {
    statisticData: Statistic[]
    leadByRegionData: LeadRegion[]
    recentLeadsData: Lead[]
    emailSentData: {
        precent: number
        opened: number
        unopen: number
        total: number
    }
}

type CustomersDashboardDataResponse = DashboardData

export type CustomersDashboardState = {
    loading: boolean
    dashboardData: Partial<DashboardData>
}

export const SLICE_NAME = 'customersDashboard'

export const getCustomersDashboardData = createAsyncThunk(
    'customersDashboard/data/getCustomersDashboardData',
    async () => {
        const response =
            await apiGetCustomersDashboardData<CustomersDashboardDataResponse>()
        return response.data
    },
)

const initialState: CustomersDashboardState = {
    loading: true,
    dashboardData: {},
}

const customersDashboardSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(getCustomersDashboardData.fulfilled, (state, action) => {
                state.dashboardData = action.payload
                state.loading = false
            })
            .addCase(getCustomersDashboardData.pending, (state) => {
                state.loading = true
            })
    },
})

export default customersDashboardSlice.reducer
