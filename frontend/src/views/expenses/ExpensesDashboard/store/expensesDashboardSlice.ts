import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { apiGetExpensesDashboardData } from '@/services/ExpensesService'

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
        categories: string[]
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
    }[]
    expensesByCategoriesData?: {
        labels: string[]
        data: number[]
    }
}

type DashboardDataResponse = DashboardData

export type ExpensesDashboardState = {
    startDate: number
    endDate: number
    loading: boolean
    dashboardData: DashboardData
}

export const SLICE_NAME = 'expensesDashboard'

export const getExpensesDashboardData = createAsyncThunk(
    SLICE_NAME + '/getExpensesDashboardData',
    async () => {
        const response = await apiGetExpensesDashboardData<DashboardDataResponse>()
        return response.data
    },
)

const initialState: ExpensesDashboardState = {
    startDate: dayjs(
        dayjs().subtract(3, 'month').format('DD-MMM-YYYY, hh:mm A'),
    ).unix(),
    endDate: dayjs(new Date()).unix(),
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
    },
})

export const { setStartDate, setEndDate } = expensesDashboardSlice.actions

export default expensesDashboardSlice.reducer
