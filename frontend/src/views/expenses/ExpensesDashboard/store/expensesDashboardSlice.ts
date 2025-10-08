import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { apiGetExpensesDashboardData } from '@/services/ExpensesService'
import type { RootState } from '@/store'

type Statistic = {
    value: number
    growShrink: number
}

export type DashboardData = {
    statisticData?: {
        total: Statistic
        transactions: Statistic
        recurring: Statistic
    }
    expensesReportData?: {
        series: {
            name: string
            data: number[]
        }[]
        categories: number[]
        granularity?: 'hour' | 'day' | 'month'
    }
    latestExpensesData?: {
        id: string
        date: number
        vendor: string
        statusId: number | null
        statusName: string
        statusColor?: string | null
        paymentMethodId: number | null
        paymentMethodName: string
        paymentReference?: string
        amount: number
        currency?: string | null
    }[]
    expensesByCategoriesData?: {
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

export type ExpensesDashboardState = {
    startDate: number
    endDate: number
    dateRangePreset: DateRangePreset
    loading: boolean
    dashboardData: DashboardData
}

export const SLICE_NAME = 'expensesDashboard'

type ExpensesDashboardRootState = RootState & {
    [SLICE_NAME]: {
        data: ExpensesDashboardState
    }
}

export const getExpensesDashboardData = createAsyncThunk<
    DashboardDataResponse,
    void,
    { state: ExpensesDashboardRootState }
>(SLICE_NAME + '/getExpensesDashboardData', async (_, { getState }) => {
    const {
        startDate,
        endDate,
    } = getState()[SLICE_NAME]?.data ?? {
        startDate: dayjs().startOf('month').unix(),
        endDate: dayjs().endOf('month').unix(),
    }

    const response = await apiGetExpensesDashboardData<
        DashboardDataResponse,
        { startDate: number; endDate: number }
    >({
        startDate,
        endDate,
    })
    return response.data
})

const initialState: ExpensesDashboardState = {
    startDate: dayjs().startOf('month').unix(),
    endDate: dayjs().endOf('month').unix(),
    dateRangePreset: 'thisMonth',
    loading: true,
    dashboardData: {},
}

const expensesDashboardSlice = createSlice({
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
            .addCase(getExpensesDashboardData.fulfilled, (state, action) => {
                state.dashboardData = action.payload
                state.loading = false
            })
            .addCase(getExpensesDashboardData.pending, (state) => {
                state.loading = true
            })
            .addCase(getExpensesDashboardData.rejected, (state) => {
                state.loading = false
            })
    },
})

export const { setStartDate, setEndDate, setDateRangePreset } =
    expensesDashboardSlice.actions

export default expensesDashboardSlice.reducer
