import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { apiGetSalesDashboardData } from '@/services/SalesService'
import type { RootState } from '@/store'

type Statistic = {
    value: number
    growShrink: number
}

export type DashboardData = {
    statisticData?: {
        orders?: Statistic
        revenue?: Statistic
        netIncome?: Statistic
    }
    salesReportData?: {
        series: {
            name: string
            data: number[]
        }[]
        categories: number[]
        granularity?: 'hour' | 'day' | 'month'
    }
    topProductsData?: {
        id: string
        name: string
        img: string
        sold: number
    }[]
    latestOrderData?: {
        id: string
        date: number
        customer: string
        status: number
        paymentMehod: string
        paymentIdendifier: string
        totalAmount: number
    }[]
    salesByCategoriesData?: {
        labels: string[]
        data: number[]
    }
}

type DashboardDataResponse = DashboardData

export type DateRangePreset =
    | 'today'
    | 'thisWeek'
    | 'thisMonth'
    | 'last15Days'
    | 'thisYear'
    | 'custom'

export type SalesDashboardState = {
    startDate: number
    endDate: number
    dateRangePreset: DateRangePreset
    loading: boolean
    dashboardData: DashboardData
}

export const SLICE_NAME = 'salesDashboard'

type SalesDashboardRootState = RootState & {
    [SLICE_NAME]: {
        data: SalesDashboardState
    }
}

export const getSalesDashboardData = createAsyncThunk<
    DashboardDataResponse,
    void,
    { state: SalesDashboardRootState }
>(SLICE_NAME + '/getSalesDashboardData', async (_, { getState }) => {
    const {
        startDate,
        endDate,
    } = getState()[SLICE_NAME]?.data ?? {
        startDate: dayjs().startOf('month').unix(),
        endDate: dayjs().endOf('month').unix(),
    }

    const response = await apiGetSalesDashboardData<
        DashboardDataResponse,
        { startDate: number; endDate: number }
    >({
        startDate,
        endDate,
    })
    return response.data
})

const initialState: SalesDashboardState = {
    startDate: dayjs().startOf('month').unix(),
    endDate: dayjs().endOf('month').unix(),
    dateRangePreset: 'thisMonth',
    loading: true,
    dashboardData: {},
}

const salesDashboardSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setStartDate: (state, action: PayloadAction<number>) => {
            state.startDate = action.payload
        },
        setEndDate: (state, action: PayloadAction<number>) => {
            state.endDate = action.payload
        },
        setDateRangePreset: (
            state,
            action: PayloadAction<DateRangePreset>,
        ) => {
            state.dateRangePreset = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getSalesDashboardData.fulfilled, (state, action) => {
                state.dashboardData = action.payload
                state.loading = false
            })
            .addCase(getSalesDashboardData.pending, (state) => {
                state.loading = true
            })
            .addCase(getSalesDashboardData.rejected, (state) => {
                state.loading = false
            })
    },
})

export const { setStartDate, setEndDate, setDateRangePreset } =
    salesDashboardSlice.actions

export default salesDashboardSlice.reducer
