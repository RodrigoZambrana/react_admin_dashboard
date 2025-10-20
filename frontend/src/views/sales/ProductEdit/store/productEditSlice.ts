import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetSalesProduct,
    apiPutSalesProduct,
    apiDeleteSalesProducts,
} from '@/services/SalesService'
import type { SalesUnit } from '@/constants/product.constant'

type ProductData = {
    id?: number
    name?: string
    productCode?: string
    img?: string
    imgList?: {
        id: string
        name: string
        img: string
    }[]
    category?: string
    categoryId?: number
    salePrice?: number
    costPrice?: number
    stock?: number
    status?: number
    bulkDiscountPrice?: number
    description?: string
    tags?: string[]
    brand?: string
    vendor?: string
    permanentStock?: boolean
    currency?: string
    unitOfMeasure?: SalesUnit
}

export type SalesProductEditState = {
    loading: boolean
    productData: ProductData
}

type GetSalesProductResponse = ProductData

export const SLICE_NAME = 'salesProductEdit'

export const getProduct = createAsyncThunk(
    SLICE_NAME + '/getProducts',
    async (data: { id: string }) => {
        const response = await apiGetSalesProduct<
            GetSalesProductResponse,
            { id: string }
        >(data)
        return response.data
    },
)

export const updateProduct = async <T, U extends Record<string, unknown>>(
    data: U,
) => {
    const payload: any = { ...data }
    // Ensure id is number for backend validation
    if (payload.id !== undefined) payload.id = Number(payload.id)
    // Normalize numeric fields if present
    const numericKeys = [
        'salePrice',
        'costPrice',
        'stock',
        'bulkDiscountPrice',
        'categoryId',
    ]
    for (const k of numericKeys) {
        if (payload[k] !== undefined && payload[k] !== null && payload[k] !== '') {
            payload[k] = Number(payload[k])
        } else if (payload[k] === '') {
            delete payload[k]
        }
    }
    delete payload.status
    const response = await apiPutSalesProduct<T, U>(payload)
    return response.data
}

export const deleteProduct = async <T, U extends Record<string, unknown>>(
    data: U,
) => {
    const response = await apiDeleteSalesProducts<T, U>(data)
    return response.data
}

const initialState: SalesProductEditState = {
    loading: true,
    productData: {},
}

const productEditSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(getProduct.fulfilled, (state, action) => {
                const payload = action.payload as ProductData
                state.productData = {
                    ...payload,
                    salePrice: Number((payload as any).salePrice ?? (payload as any).price ?? 0),
                    costPrice: Number((payload as any).costPrice ?? (payload as any).costPerItem ?? 0),
                }
                state.loading = false
            })
            .addCase(getProduct.pending, (state) => {
                state.loading = true
            })
    },
})

export default productEditSlice.reducer
