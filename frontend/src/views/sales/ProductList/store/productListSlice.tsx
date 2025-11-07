import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetSalesProducts,
    apiDeleteSalesProducts,
} from '@/services/SalesService'
import type { TableQueries } from '@/@types/common'
import type { SalesUnit } from '@/constants/product.constant'
import type { ProductMode } from '@/views/sales/ProductForm/types'

type Product = {
    id: string
    name: string
    productCode: string
    img: string
    category: string
    salePrice: number
    costPrice: number
    stock: number
    status: number
    brand?: string
    vendor?: string
    permanentStock?: boolean
    currency?: string
    unitOfMeasure?: SalesUnit
    specifications?: string
    serieSummary?: string
    widthSummary?: string
    heightSummary?: string
    colorSummary?: string
    glassSummary?: string
    mosquiteroAvailable?: boolean
    monoblockAvailable?: boolean
    shutterMaterialSummary?: string
    parametricSku?: string
}

type Products = Product[]

type GetSalesProductsResponse = {
    data: Products
    total: number
}

type FilterQueries = {
    name: string
    category: string[]
    status: number[]
    productStatus: number
    currency: string[]
    mode?: ProductMode | ProductMode[] | 'all'
}

export type SalesProductListState = {
    loading: boolean
    deleteConfirmation: boolean
    bulkDeleteConfirmation: boolean
    selectedProduct: string
    selectedProductIds: string[]
    tableData: TableQueries
    filterData: FilterQueries
    productList: Product[]
}

type GetSalesProductsRequest = TableQueries & { filterData?: FilterQueries }

export const SLICE_NAME = 'salesProductList'

export const getProducts = createAsyncThunk(
    SLICE_NAME + '/getProducts',
    async (data: GetSalesProductsRequest) => {
        const response = await apiGetSalesProducts<
            GetSalesProductsResponse,
            GetSalesProductsRequest
        >(data)
        return response.data
    },
)

export const deleteProduct = async (data: { id: string | string[] }) => {
    const response = await apiDeleteSalesProducts<
        boolean,
        { id: string | string[] }
    >(data)
    return response.data
}

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

const initialState: SalesProductListState = {
    loading: false,
    deleteConfirmation: false,
    bulkDeleteConfirmation: false,
    selectedProduct: '',
    selectedProductIds: [],
    productList: [],
    tableData: initialTableData,
    filterData: {
        name: '',
        category: ['bags', 'cloths', 'devices', 'shoes', 'watches'],
        status: [0, 1, 2],
        productStatus: 0,
        currency: [],
        mode: undefined,
    },
}

const productListSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updateProductList: (state, action) => {
            state.productList = action.payload
        },
        setTableData: (state, action) => {
            state.tableData = action.payload
        },
        setFilterData: (state, action) => {
            state.filterData = action.payload
        },
        toggleDeleteConfirmation: (state, action) => {
            state.deleteConfirmation = action.payload
        },
        toggleBulkDeleteConfirmation: (state, action) => {
            state.bulkDeleteConfirmation = action.payload
        },
        setSelectedProduct: (state, action) => {
            state.selectedProduct = action.payload
        },
        setSelectedProducts: (state, action) => {
            state.selectedProductIds = action.payload
        },
    },
   extraReducers: (builder) => {
       builder
            .addCase(getProducts.fulfilled, (state, action) => {
                state.productList = action.payload.data.map((item) => ({
                    ...item,
                    productCode: (() => {
                        const explicit = typeof (item as any).productCode === 'string' ? (item as any).productCode.trim() : ''
                        const fallback = typeof (item as any).parametricSku === 'string' ? (item as any).parametricSku.trim() : ''
                        return explicit || fallback || ''
                    })(),
                    salePrice: Number((item as any).salePrice ?? 0),
                    costPrice: Number((item as any).costPrice ?? 0),
                    widthSummary: (item as any).widthSummary ?? '',
                    heightSummary: (item as any).heightSummary ?? '',
                    serieSummary: (item as any).serieSummary ?? '',
                    colorSummary: (item as any).colorSummary ?? '',
                    glassSummary: (item as any).glassSummary ?? '',
                    mosquiteroAvailable: Boolean((item as any).mosquiteroAvailable),
                    monoblockAvailable: Boolean((item as any).monoblockAvailable),
                    shutterMaterialSummary: (item as any).shutterMaterialSummary ?? '',
                    parametricSku: (item as any).parametricSku ?? '',
                }))
                const availableIds = new Set(
                    state.productList.map((item) => String(item.id)),
                )
                state.selectedProductIds = state.selectedProductIds.filter((id) =>
                    availableIds.has(id),
                )
                state.tableData.total = action.payload.total
                state.loading = false
            })
            .addCase(getProducts.pending, (state) => {
                state.loading = true
            })
    },
})

export const {
    updateProductList,
    setTableData,
    setFilterData,
    toggleDeleteConfirmation,
    setSelectedProduct,
    toggleBulkDeleteConfirmation,
    setSelectedProducts,
} = productListSlice.actions

export default productListSlice.reducer
