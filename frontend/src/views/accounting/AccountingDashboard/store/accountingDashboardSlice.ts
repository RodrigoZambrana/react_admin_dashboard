import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { apiGetAccountingDashboardData } from '@/services/AccountingService'
import type { RootState } from '@/store'

export type CurrencyBreakdown = {
    IUSD: number
    UYU: number
    OTHER: number
}

export type MonthlyAccountingStat = {
    month: number
    sales: number
    expenses: number
    taxes: number
    netIncome: number
    salesByCurrency: CurrencyBreakdown
    expensesByCurrency: CurrencyBreakdown
    taxesByCurrency: CurrencyBreakdown
    netIncomeByCurrency: CurrencyBreakdown
}

export type CurrencySummary = {
    currency: string
    sales: number
    expenses: number
    taxes: number
    balance: number
    liquidIncome: number
}

export type AccountingDashboardData = {
    range?: {
        start: number
        end: number
        granularity?: 'month'
    }
    monthly?: MonthlyAccountingStat[]
    totals?: {
        sales: number
        expenses: number
        taxes: number
        balance: number
        netIncome: number
        salesByCurrency: CurrencyBreakdown
        expensesByCurrency: CurrencyBreakdown
        taxesByCurrency: CurrencyBreakdown
        balanceByCurrency: CurrencyBreakdown
        netIncomeByCurrency: CurrencyBreakdown
    }
    currencySummary?: CurrencySummary[]
}

type DashboardDataResponse = AccountingDashboardData

export type DateRangePreset =
    | 'today'
    | 'thisWeek'
    | 'thisMonth'
    | 'last15Days'
    | 'thisYear'
    | 'custom'

export type AccountingDashboardState = {
    startDate: number
    endDate: number
    dateRangePreset: DateRangePreset
    loading: boolean
    dashboardData: AccountingDashboardData
}

export const SLICE_NAME = 'accountingDashboard'

type AccountingDashboardRootState = RootState & {
    [SLICE_NAME]: {
        data: AccountingDashboardState
    }
}

export const getAccountingDashboardData = createAsyncThunk<
    DashboardDataResponse,
    void,
    { state: AccountingDashboardRootState }
>(SLICE_NAME + '/getAccountingDashboardData', async (_, { getState }) => {
    const {
        startDate,
        endDate,
    } = getState()[SLICE_NAME]?.data ?? {
        startDate: dayjs().startOf('month').unix(),
        endDate: dayjs().endOf('month').unix(),
    }

    const response = await apiGetAccountingDashboardData<
        DashboardDataResponse,
        { startDate: number; endDate: number }
    >({
        startDate,
        endDate,
    })

    return response.data
})

const initialState: AccountingDashboardState = {
    startDate: dayjs().startOf('month').unix(),
    endDate: dayjs().endOf('month').unix(),
    dateRangePreset: 'thisMonth',
    loading: true,
    dashboardData: {},
}

const accountingDashboardSlice = createSlice({
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
            .addCase(getAccountingDashboardData.fulfilled, (state, action) => {
                state.dashboardData = action.payload ?? {}
                state.loading = false
            })
            .addCase(getAccountingDashboardData.pending, (state) => {
                state.loading = true
            })
            .addCase(getAccountingDashboardData.rejected, (state) => {
                state.loading = false
            })
    },
})

export const { setStartDate, setEndDate, setDateRangePreset } =
    accountingDashboardSlice.actions

export default accountingDashboardSlice.reducer
