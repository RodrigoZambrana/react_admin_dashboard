import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiGetSalesProduct,
    apiPutSalesProduct,
    apiDeleteSalesProducts,
} from '@/services/SalesService'
import type { SalesUnit } from '@/constants/product.constant'
import type {
    ProductAttribute,
    ProductVariant,
    ProductMode,
} from '@/views/sales/ProductForm/types'
import type {
    ParametricConfiguratorDraft,
    ParametricManualConfigResponse,
} from '@/views/sales/ProductForm/parametricTypes'
import { mapManualConfigResponseToDraft } from '@/views/sales/ProductForm/parametricTypes'

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
    specifications?: string
    tags?: string[]
    brand?: string
    vendor?: string
    permanentStock?: boolean
    currency?: string
    unitOfMeasure?: SalesUnit
    mode?: ProductMode
    attributes?: ProductAttribute[]
    variants?: ProductVariant[]
    parametricDraft?: ParametricConfiguratorDraft | null
}

export type SalesProductEditState = {
    loading: boolean
    productData: ProductData
}

type GetSalesProductResponse = ProductData

export const SLICE_NAME = 'salesProductEdit'

const fallbackMode = (value: unknown): ProductMode => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (normalized === 'variable') {
            return 'variable'
        }
        if (normalized === 'parametric') {
            return 'parametric'
        }
    }
    return 'simple'
}

const mapApiProductToState = (payload: Record<string, unknown>): ProductData => {
    const mode = fallbackMode(payload.mode)
    const attributes = Array.isArray(payload.attributes)
        ? (payload.attributes as Record<string, unknown>[]).map((attr) => {
              const type = (attr.type as ProductAttribute['type']) ?? 'COLOR'
              const name = typeof attr.name === 'string' ? attr.name : type === 'COLOR' ? 'Color' : type === 'SIZE' ? 'Talle' : 'Material'
              const values = Array.isArray(attr.values)
                  ? (attr.values as Record<string, unknown>[]).map((value, index) => ({
                        id: typeof value.id === 'number' ? value.id : undefined,
                        key: typeof value.key === 'string' ? value.key : `${type.toLowerCase()}-${index + 1}`,
                        label:
                            typeof value.label === 'string'
                                ? value.label
                                : typeof value.value === 'string'
                                ? value.value
                                : `Opción ${index + 1}`,
                        value: typeof value.value === 'string' ? value.value : undefined,
                        colorHex: typeof value.colorHex === 'string' ? value.colorHex : undefined,
                        imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined,
                        imageAlt: typeof value.imageAlt === 'string' ? value.imageAlt : undefined,
                        sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : index,
                    }))
                  : []
              values.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              return {
                  id: typeof attr.id === 'number' ? attr.id : undefined,
                  type,
                  name,
                  sortOrder: typeof attr.sortOrder === 'number' ? attr.sortOrder : undefined,
                  values,
              }
          })
        : []

    attributes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const variants = Array.isArray(payload.variants)
        ? (payload.variants as Record<string, unknown>[]).map((variant, idx) => {
              const attributesPayload = Array.isArray(variant.attributes)
                  ? (variant.attributes as Record<string, unknown>[]).map((entry) => ({
                        attribute: (entry.attribute as ProductAttribute['type']) ?? 'COLOR',
                        valueKey: typeof entry.valueKey === 'string' ? entry.valueKey : '',
                        label: typeof entry.label === 'string' ? entry.label : undefined,
                        value: typeof entry.value === 'string' ? entry.value : undefined,
                        colorHex: typeof entry.colorHex === 'string' ? entry.colorHex : undefined,
                        imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : undefined,
                        imageAlt: typeof entry.imageAlt === 'string' ? entry.imageAlt : undefined,
                        optionValueId: typeof entry.optionValueId === 'number' ? entry.optionValueId : undefined,
                    }))
                  : []

              const images = Array.isArray(variant.images)
                  ? (variant.images as Record<string, unknown>[]).map((image, imageIndex) => ({
                        id: String(image.id ?? `${variant.id ?? 'new'}-${imageIndex}`),
                        name: typeof image.name === 'string' ? image.name : undefined,
                        img: typeof image.img === 'string' ? image.img : '',
                    }))
                  : []

              return {
                  id: typeof variant.id === 'number' ? variant.id : undefined,
                  key: typeof variant.key === 'string' ? variant.key : `variant-${idx + 1}`,
                  sku: typeof variant.sku === 'string' ? variant.sku : undefined,
                  barcode: typeof variant.barcode === 'string' ? variant.barcode : undefined,
                  label: typeof variant.label === 'string' ? variant.label : undefined,
                  salePrice:
                      variant.salePrice === null || variant.salePrice === undefined
                          ? null
                          : Number(variant.salePrice),
                  costPrice:
                      variant.costPrice === null || variant.costPrice === undefined
                          ? null
                          : Number(variant.costPrice),
                  stock:
                      variant.stock === null || variant.stock === undefined
                          ? null
                          : Number(variant.stock),
                  permanentStock:
                      variant.permanentStock === null || variant.permanentStock === undefined
                          ? null
                          : Boolean(variant.permanentStock),
                  isActive: variant.isActive === undefined ? true : Boolean(variant.isActive),
                  inheritSalePrice: variant.inheritSalePrice === undefined ? true : Boolean(variant.inheritSalePrice),
                  inheritCostPrice:
                      variant.inheritCostPrice === undefined ? true : Boolean(variant.inheritCostPrice),
                  inheritStock: variant.inheritStock === undefined ? true : Boolean(variant.inheritStock),
                  inheritSku: variant.inheritSku === undefined ? true : Boolean(variant.inheritSku),
                  inheritImages: variant.inheritImages === undefined ? true : Boolean(variant.inheritImages),
                  attributes: attributesPayload,
                  images,
              }
          })
        : []

    const imgList = Array.isArray(payload.imgList)
        ? (payload.imgList as Record<string, unknown>[]).map((img, index) => ({
              id: String(img.id ?? index),
              name: typeof img.name === 'string' ? img.name : undefined,
              img: typeof img.img === 'string' ? img.img : '',
          }))
        : []
    const manualConfigResponse = payload.parametricManualConfig as ParametricManualConfigResponse | undefined
    const parametricDraft = manualConfigResponse
        ? { manualConfig: mapManualConfigResponseToDraft(manualConfigResponse) }
        : undefined

    return {
        id: typeof payload.id === 'number' ? payload.id : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        productCode: typeof payload.productCode === 'string' ? payload.productCode : undefined,
        img: typeof payload.img === 'string' ? payload.img : undefined,
        imgList,
        category: typeof payload.category === 'string' ? payload.category : undefined,
        categoryId: typeof payload.categoryId === 'number' ? payload.categoryId : undefined,
        salePrice: Number((payload as any).salePrice ?? (payload as any).price ?? 0),
        costPrice: Number((payload as any).costPrice ?? (payload as any).costPerItem ?? 0),
        stock: typeof payload.stock === 'number' ? payload.stock : undefined,
        status: typeof payload.status === 'number' ? payload.status : undefined,
        bulkDiscountPrice: typeof payload.bulkDiscountPrice === 'number' ? payload.bulkDiscountPrice : undefined,
        description: typeof payload.description === 'string' ? payload.description : undefined,
        specifications: typeof payload.specifications === 'string' ? payload.specifications : undefined,
        tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : undefined,
        brand: typeof payload.brand === 'string' ? payload.brand : undefined,
        vendor: typeof payload.vendor === 'string' ? payload.vendor : undefined,
        permanentStock:
            payload.permanentStock === undefined || payload.permanentStock === null
                ? undefined
                : Boolean(payload.permanentStock),
        currency: typeof payload.currency === 'string' ? payload.currency : undefined,
        unitOfMeasure: payload.unitOfMeasure as SalesUnit | undefined,
        published:
            payload.published === undefined || payload.published === null
                ? undefined
                : Boolean(payload.published),
        mode,
        attributes,
        variants,
        parametricDraft,
    }
}

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
                const payload = action.payload as Record<string, unknown>
                state.productData = mapApiProductToState(payload)
                state.loading = false
            })
            .addCase(getProduct.pending, (state) => {
                state.loading = true
            })
    },
})

export default productEditSlice.reducer
