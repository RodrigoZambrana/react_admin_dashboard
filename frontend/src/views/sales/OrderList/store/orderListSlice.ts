import {
    createSlice,
    createAsyncThunk,
    current,
    PayloadAction,
} from '@reduxjs/toolkit'
import {
    apiGetSalesOrders,
    apiDeleteSalesOrders,
} from '@/services/SalesService'
import type { TableQueries } from '@/@types/common'
import type { SalesDocumentResource } from '@/services/SalesService'

type Order = {
    id: string
    date: number
    customer: string
    status: number
    paymentMehod: string
    paymentIdendifier: string
    totalAmount: number
    orderCurrency?: string
}

type Orders = Order[]

type GetSalesOrdersResponse = {
    data: Orders
    total: number
}

export type SalesTableQueries = TableQueries & {
    resource: SalesDocumentResource
}

export type SalesOrderListState = {
    loading: boolean
    orderList: Orders
    tableData: SalesTableQueries
    deleteMode: 'single' | 'batch' | ''
    selectedRows: string[]
    selectedRow: string
    currentResource: SalesDocumentResource
}

export const SLICE_NAME = 'salesOrderList'

export const getOrders = createAsyncThunk(
    SLICE_NAME + '/getOrders',
    async (data: TableQueries & { resource?: SalesDocumentResource }) => {
        const pageIndex =
            typeof data.pageIndex === 'number' && !Number.isNaN(data.pageIndex)
                ? data.pageIndex
                : 1
        const pageSize =
            typeof data.pageSize === 'number' && !Number.isNaN(data.pageSize)
                ? data.pageSize
                : 50

        const params: Record<string, unknown> = {
            pageIndex,
            pageSize,
        }

        if (typeof data.query === 'string') {
            params.query = data.query
        }

        const sort = data.sort
        if (sort) {
            params.sort = sort
            if (sort.key !== undefined && sort.key !== '') {
                params.sortKey = sort.key
            }
            if (sort.order === 'asc' || sort.order === 'desc') {
                params.sortOrder = sort.order
            }
        }

        const resource: SalesDocumentResource = data.resource ?? 'orders'

        const response = await apiGetSalesOrders<
            GetSalesOrdersResponse,
            Record<string, unknown>
        >(params, resource)
        return {
            resource,
            ...response.data,
        }
    },
)

export const deleteOrders = async (
    data: { id: string | string[] },
    resource: SalesDocumentResource,
) => {
    const response = await apiDeleteSalesOrders<
        boolean,
        { id: string | string[] }
    >(data, resource)
    return response.data
}

export const initialState: SalesOrderListState = {
    loading: false,
    orderList: [],
    tableData: {
        total: 0,
        pageIndex: 1,
        pageSize: 50,
        query: '',
        sort: {
            order: '',
            key: '',
        },
        resource: 'orders',
    },
    selectedRows: [],
    selectedRow: '',
    deleteMode: '',
    currentResource: 'orders',
}

const orderListSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setOrderList: (state, action) => {
            state.orderList = action.payload
        },
        setTableData: (state, action) => {
            state.tableData = {
                ...state.tableData,
                ...action.payload,
            }
            if (action.payload.resource) {
                state.currentResource = action.payload.resource
            }
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
            .addCase(getOrders.fulfilled, (state, action) => {
                state.orderList = action.payload.data
                state.tableData.total = action.payload.total
                state.tableData.resource = action.payload.resource
                state.currentResource = action.payload.resource
                state.loading = false
            })
            .addCase(getOrders.pending, (state) => {
                state.loading = true
            })
    },
})

export const {
    setOrderList,
    setTableData,
    setSelectedRows,
    setSelectedRow,
    addRowItem,
    removeRowItem,
    setDeleteMode,
} = orderListSlice.actions

export default orderListSlice.reducer
