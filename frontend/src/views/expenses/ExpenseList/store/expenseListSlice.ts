import {
    createSlice,
    createAsyncThunk,
    current,
    PayloadAction,
} from '@reduxjs/toolkit'
import { apiGetExpenses, apiDeleteExpenses } from '@/services/ExpensesService'
import type { TableQueries } from '@/@types/common'

type Expense = {
    id: string
    date: number
    vendor: string
    categoryId?: number | null
    categoryName: string
    statusId?: number | null
    statusName: string
    statusColor?: string | null
    paymentMethodId?: number | null
    paymentMethodName: string
    paymentReference?: string
    amount: number
    note?: string
    currency?: string | null
}

type Expenses = Expense[]

type GetExpensesResponse = {
    data: Expenses
    total: number
}

export type ExpensesListState = {
    loading: boolean
    expenses: Expenses
    tableData: TableQueries
    deleteMode: 'single' | 'batch' | ''
    selectedRows: string[]
    selectedRow: string
}

export const SLICE_NAME = 'expensesList'

export const getExpensesList = createAsyncThunk(
    SLICE_NAME + '/getExpensesList',
    async (data: TableQueries) => {
        const response = await apiGetExpenses<GetExpensesResponse, TableQueries>(
            data,
        )
        return response.data
    },
)

export const deleteExpenses = async (data: { id: string | string[] }) => {
    const response = await apiDeleteExpenses<boolean, { id: string | string[] }>(
        data,
    )
    return response.data
}

const initialState: ExpensesListState = {
    loading: false,
    expenses: [],
    tableData: {
        total: 0,
        pageIndex: 1,
        pageSize: 50,
        query: '',
        sort: {
            order: '',
            key: '',
        },
    },
    selectedRows: [],
    selectedRow: '',
    deleteMode: '',
}

const expenseListSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setExpenses: (state, action) => {
            state.expenses = action.payload
        },
        setTableData: (state, action) => {
            state.tableData = action.payload
        },
        setSelectedRows: (state, action) => {
            state.selectedRows = action.payload
        },
        setSelectedRow: (state, action) => {
            state.selectedRow = action.payload
        },
        addRowItem: (state, { payload }) => {
            const currentState = current(state)
            if (!currentState.selectedRows.includes(payload)) {
                state.selectedRows = [...currentState.selectedRows, ...payload]
            }
        },
        removeRowItem: (state, { payload }: PayloadAction<string>) => {
            const currentState = current(state)
            if (currentState.selectedRows.includes(payload)) {
                state.selectedRows = currentState.selectedRows.filter(
                    (id) => id !== payload,
                )
            }
        },
        setDeleteMode: (state, action) => {
            state.deleteMode = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getExpensesList.fulfilled, (state, action) => {
                state.expenses = action.payload.data
                state.tableData.total = action.payload.total
                state.loading = false
            })
            .addCase(getExpensesList.pending, (state) => {
                state.loading = true
            })
    },
})

export const {
    setExpenses,
    setTableData,
    setSelectedRows,
    setSelectedRow,
    addRowItem,
    removeRowItem,
    setDeleteMode,
} = expenseListSlice.actions

export default expenseListSlice.reducer
