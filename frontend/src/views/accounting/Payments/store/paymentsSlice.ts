import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { apiGetPayments } from '@/services/AccountingService'
import type { TableQueries } from '@/@types/common'

export type PaymentStatus = 'REGISTERED' | 'CONFIRMED' | 'FAILED'
export type PaymentType = 'DEPOSIT' | 'BALANCE' | 'REFUND'

export type Payment = {
    id: number
    orderId: number
    amount: number
    currency: string
    type: PaymentType
    status: PaymentStatus
    reference: string | null
    method: string | null
    paymentMethodId: number | null
    date: string
    notes: string | null
    order: {
        id: number
        customerId: number
        customerName: string | null
        grandTotal: number
        currency: string
        status: {
            id: number
            code: number
            name: string
        } | null
    } | null
}

type PaymentListResponse = {
    data: Payment[]
    total: number
}

export type PaymentsTableState = TableQueries & {
    status?: PaymentStatus | ''
    type?: PaymentType | ''
}

export type PaymentsState = {
    loading: boolean
    payments: Payment[]
    tableData: PaymentsTableState
    dialogOpen: boolean
    dialogMode: 'create' | 'edit'
    dialogPaymentId: number | null
    deleteDialogOpen: boolean
    deletePaymentId: number | null
}

export const SLICE_NAME = 'accountingPayments'

export const getPayments = createAsyncThunk(
    `${SLICE_NAME}/getPayments`,
    async (tableData: PaymentsTableState) => {
        const pageIndex =
            typeof tableData.pageIndex === 'number' && tableData.pageIndex > 0
                ? tableData.pageIndex
                : 1
        const pageSize =
            typeof tableData.pageSize === 'number' && tableData.pageSize > 0
                ? tableData.pageSize
                : 25

        const params: Record<string, unknown> = {
            pageIndex,
            pageSize,
        }

        if (tableData.query && tableData.query.trim().length) {
            params.query = tableData.query.trim()
        }

        if (tableData.status) {
            params.status = tableData.status
        }

        if (tableData.type) {
            params.type = tableData.type
        }

        if (tableData.sort && tableData.sort.key) {
            const { key, order } = tableData.sort
            const normalizedOrder = order === 'asc' || order === 'desc' ? order : ''
            if (normalizedOrder) {
                const normalizedKey = String(key).toLowerCase()
                const acceptedKeys: Record<string, string> = {
                    date: 'date',
                    amount: 'amount',
                    status: 'status',
                    type: 'type',
                    order: 'order',
                }
                const sortKey = acceptedKeys[normalizedKey] ?? null
                if (sortKey) {
                    params.sortKey = sortKey
                    params.sortOrder = normalizedOrder
                }
            }
        }

        const response = await apiGetPayments<PaymentListResponse, typeof params>(params)
        return response.data
    },
)

const initialState: PaymentsState = {
    loading: false,
    payments: [],
    tableData: {
        total: 0,
        pageIndex: 1,
        pageSize: 25,
        query: '',
        sort: {
            order: '',
            key: '',
        },
        status: '',
        type: '',
    },
    dialogOpen: false,
    dialogMode: 'create',
    dialogPaymentId: null,
    deleteDialogOpen: false,
    deletePaymentId: null,
}

const paymentsSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setTableData: (state, action: PayloadAction<PaymentsTableState>) => {
            state.tableData = action.payload
        },
        setPayments: (state, action: PayloadAction<Payment[]>) => {
            state.payments = action.payload
        },
        togglePaymentDialog: (
            state,
            action: PayloadAction<{ open: boolean; mode?: 'create' | 'edit'; paymentId?: number | null }>,
        ) => {
            state.dialogOpen = action.payload.open
            state.dialogMode = action.payload.mode ?? 'create'
            state.dialogPaymentId = action.payload.paymentId ?? null
        },
        toggleDeleteDialog: (
            state,
            action: PayloadAction<{ open: boolean; paymentId?: number | null }>,
        ) => {
            state.deleteDialogOpen = action.payload.open
            state.deletePaymentId = action.payload.paymentId ?? null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getPayments.pending, (state) => {
                state.loading = true
            })
            .addCase(getPayments.fulfilled, (state, action) => {
                const payload = action.payload
                state.loading = false
                state.payments = payload.data
                state.tableData.total = payload.total
            })
            .addCase(getPayments.rejected, (state) => {
                state.loading = false
                state.payments = []
                state.tableData.total = 0
            })
    },
})

export const {
    setTableData,
    setPayments,
    togglePaymentDialog,
    toggleDeleteDialog,
} = paymentsSlice.actions

export default paymentsSlice.reducer
