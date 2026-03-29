export type ProductMode = 'simple' | 'variable' | 'parametric'

export type ProductAttributeType = 'COLOR' | 'SIZE' | 'MATERIAL'

export type ProductRelationType =
    | 'RELATED'
    | 'FREQUENTLY_BOUGHT_TOGETHER'
    | 'SUGGESTED_ADD_ON'
    | 'INSTALLATION_ADD_ON'

export type ProductAttributeValue = {
    id?: number
    key: string
    label: string
    value?: string
    colorHex?: string
    imageUrl?: string
    imageAlt?: string
    sortOrder: number
}

export type ProductAttribute = {
    id?: number
    type: ProductAttributeType
    name: string
    sortOrder?: number
    values: ProductAttributeValue[]
}

export type ProductVariantAttribute = {
    attribute: ProductAttributeType
    valueKey: string
    label?: string
    value?: string
    colorHex?: string
    imageUrl?: string
    imageAlt?: string
    optionValueId?: number
}

export type ProductVariantImage = {
    id: string
    name?: string
    img: string
}

export type ProductVariant = {
    id?: number
    key: string
    sku?: string
    barcode?: string
    label?: string
    salePrice?: number | null
    costPrice?: number | null
    stock?: number | null
    permanentStock?: boolean | null
    isActive: boolean
    inheritSalePrice: boolean
    inheritCostPrice: boolean
    inheritStock: boolean
    inheritSku: boolean
    inheritImages: boolean
    attributes: ProductVariantAttribute[]
    images: ProductVariantImage[]
}

export type ProductRelation = {
    id: number
    type: ProductRelationType
    sortOrder?: number
    isActive?: boolean
    name?: string | null
    productCode?: string | null
    productType?: string | null
}
