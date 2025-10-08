import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetCrmCustomers,
    apPutCrmCustomer,
    apiGetCrmCustomersStatistic,
} from '@/services/CrmService'
import type { TableQueries } from '@/@types/common'

type PersonalInfo = {
    location: string
    phoneNumber: string
    phoneNumbers?: string[]
    facebook: string
    twitter: string
    pinterest: string
    linkedIn: string
}

type OrderHistory = {
    id: string
    item: string
    status: string
    amount: number
    date: number
}

type PaymentMethod = {
    cardHolderName: string
    cardType: string
    expMonth: string
    expYear: string
    last4Number: string
    primary: boolean
}

type Subscription = {
    plan: string
    status: string
    billing: string
    nextPaymentDate: number
    amount: number
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
    statusId?: number | string | null
    statusName?: string
    phoneNumber?: string
    phoneNumbers?: string[]
    personalInfo: PersonalInfo
    orderHistory: OrderHistory[]
    paymentMethod: PaymentMethod[]
    subscription: Subscription[]
    addresses?: Array<{
        street?: string
        number?: string
        corner?: string
        apartment?: string
        city?: string
        country?: string
        countryCode?: string
        isPrimary?: boolean
        comments?: string
    }>
}

type Statistic = {
    value: number
    growShrink?: number
}

type CustomerStatistic = {
    totalCustomers: Statistic
    activeCustomers: Statistic
    newCustomers: Statistic
}

type Filter = {
    statusId: string | number | null
}

type GetCrmCustomersResponse = {
    data: Customer[]
    total: number
}

type GetCrmCustomersStatisticResponse = CustomerStatistic

export type CustomersState = {
    loading: boolean
    statisticLoading: boolean
    customerList: Customer[]
    statisticData: Partial<CustomerStatistic>
    tableData: TableQueries
    filterData: Filter
    drawerOpen: boolean
    selectedCustomer: Partial<Customer>
}

export const SLICE_NAME = 'crmCustomers'

export const getCustomerStatistic = createAsyncThunk(
    'crmCustomers/data/getCustomerStatistic',
    async () => {
        const response =
            await apiGetCrmCustomersStatistic<GetCrmCustomersStatisticResponse>()
        return response.data
    },
)

export const getCustomers = createAsyncThunk(
    'crmCustomers/data/getCustomers',
    async (data: TableQueries & { filterData?: Filter }) => {
        const response = await apiGetCrmCustomers<
            GetCrmCustomersResponse,
            TableQueries
        >(data)
        return response.data
    },
)

export const putCustomer = createAsyncThunk(
    'crmCustomers/data/putCustomer',
    async (data: Customer) => {
        const response = await apPutCrmCustomer(data)
        return response.data
    },
)

export const initialTableData: TableQueries = {
    total: 0,
    pageIndex: 1,
    pageSize: 50,
    query: '',
    sort: {
        order: '',
        key: '',
    },
}

export const initialFilterData: Filter = {
    statusId: null,
}

const initialState: CustomersState = {
    loading: false,
    statisticLoading: false,
    customerList: [],
    statisticData: {},
    tableData: initialTableData,
    filterData: initialFilterData,
    drawerOpen: false,
    selectedCustomer: {},
}

const customersSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        setTableData: (state, action) => {
            state.tableData = action.payload
        },
        setCustomerList: (state, action) => {
            state.customerList = action.payload
        },
        setFilterData: (state, action) => {
            state.filterData = action.payload
        },
        setSelectedCustomer: (state, action) => {
            state.selectedCustomer = action.payload
        },
        setDrawerOpen: (state) => {
            state.drawerOpen = true
        },
        setDrawerClose: (state) => {
            state.drawerOpen = false
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getCustomers.fulfilled, (state, action) => {
                state.customerList = action.payload.data
                state.tableData.total = action.payload.total
                state.loading = false
            })
            .addCase(getCustomers.pending, (state) => {
                state.loading = true
            })
            .addCase(getCustomerStatistic.fulfilled, (state, action) => {
                state.statisticData = action.payload
                state.statisticLoading = false
            })
            .addCase(getCustomerStatistic.pending, (state) => {
                state.statisticLoading = true
            })
    },
})

export const {
    setTableData,
    setCustomerList,
    setFilterData,
    setSelectedCustomer,
    setDrawerOpen,
    setDrawerClose,
} = customersSlice.actions

export default customersSlice.reducer
