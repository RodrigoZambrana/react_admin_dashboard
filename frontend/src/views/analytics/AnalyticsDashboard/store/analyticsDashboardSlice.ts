import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import dayjs from 'dayjs'

import {
    apiGetAnalyticsFunnelData,
    apiGetAnalyticsOverviewData,
    type AnalyticsFunnelResponse,
    type AnalyticsOverviewResponse,
} from '@/services/AnalyticsService'
import type { RootState } from '@/store'

import { resolveComparisonRange, resolvePresetRange, type DateRangePreset } from '../utils'

export type AnalyticsDashboardData = {
    overview?: AnalyticsOverviewResponse
    funnel?: AnalyticsFunnelResponse
}

export type AnalyticsDashboardState = {
    startDate: number
    endDate: number
    dateRangePreset: DateRangePreset
    loading: boolean
    dashboardData: AnalyticsDashboardData
}

export const SLICE_NAME = 'analyticsDashboard'

type AnalyticsDashboardRootState = RootState & {
    [SLICE_NAME]: {
        data: AnalyticsDashboardState
    }
}

type AnalyticsQueryState = {
    from: string
    to: string
    compare_from: string
    compare_to: string
}

const toIsoQuery = (value: number) => dayjs.unix(value).toISOString()

const buildQuery = (startDate: number, endDate: number): AnalyticsQueryState => {
    const comparison = resolveComparisonRange(startDate, endDate)
    return {
        from: toIsoQuery(startDate),
        to: toIsoQuery(endDate),
        compare_from: toIsoQuery(comparison.compareFrom),
        compare_to: toIsoQuery(comparison.compareTo),
    }
}

export const getAnalyticsDashboardData = createAsyncThunk<
    AnalyticsDashboardData,
    void,
    { state: AnalyticsDashboardRootState }
>(SLICE_NAME + '/getAnalyticsDashboardData', async (_, { getState }) => {
    const { startDate, endDate } = getState()[SLICE_NAME]?.data ?? {
        startDate: resolvePresetRange('last7Days')[0],
        endDate: resolvePresetRange('last7Days')[1],
    }

    const query = buildQuery(startDate, endDate)
    const [overviewResponse, funnelResponse] = await Promise.all([
        apiGetAnalyticsOverviewData<AnalyticsOverviewResponse, AnalyticsQueryState>(query),
        apiGetAnalyticsFunnelData<AnalyticsFunnelResponse, AnalyticsQueryState>(query),
    ])

    return {
        overview: overviewResponse.data,
        funnel: funnelResponse.data,
    }
})

const defaultRange = resolvePresetRange('last7Days')

const initialState: AnalyticsDashboardState = {
    startDate: defaultRange[0],
    endDate: defaultRange[1],
    dateRangePreset: 'last7Days',
    loading: true,
    dashboardData: {},
}

const analyticsDashboardSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setStartDate: (state, action: PayloadAction<number>) => {
            state.startDate = action.payload
        },
        setEndDate: (state, action: PayloadAction<number>) => {
            state.endDate = action.payload
        },
        setDateRangePreset: (state, action: PayloadAction<DateRangePreset>) => {
            state.dateRangePreset = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getAnalyticsDashboardData.fulfilled, (state, action) => {
                state.dashboardData = action.payload
                state.loading = false
            })
            .addCase(getAnalyticsDashboardData.pending, (state) => {
                state.loading = true
            })
            .addCase(getAnalyticsDashboardData.rejected, (state) => {
                state.loading = false
            })
    },
})

export const { setStartDate, setEndDate, setDateRangePreset } =
    analyticsDashboardSlice.actions

export default analyticsDashboardSlice.reducer

