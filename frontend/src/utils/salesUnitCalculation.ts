import { DEFAULT_SALES_UNIT, SALES_UNIT_VALUES, type SalesUnit } from '@/constants/product.constant'

type CustomAttributes = Record<string, unknown> | null | undefined

export type SalesUnitAwareItem = {
    qty?: number | string | null
    price?: number | string | null
    unitPrice?: number | string | null
    unitOfMeasure?: string | null
    pricingMethod?: string | null
    customAttributes?: CustomAttributes
}

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value)

const coerceNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined) {
        return undefined
    }
    if (isFiniteNumber(value)) {
        return value
    }
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
}

const readAttributeNumber = (
    attrs: CustomAttributes,
    key: string,
): number | undefined => {
    if (!attrs || typeof attrs !== 'object') {
        return undefined
    }
    const variations = [key, key.toLowerCase(), key.toUpperCase()]
    for (const candidate of variations) {
        if (candidate in attrs) {
            const numeric = coerceNumber(
                (attrs as Record<string, unknown>)[candidate],
            )
            if (numeric !== undefined) {
                return numeric
            }
        }
    }
    return undefined
}

export const resolveSalesUnit = (
    unit?: string | null,
    fallback?: string | null,
): SalesUnit => {
    const candidates = [unit, fallback, DEFAULT_SALES_UNIT]
    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim().toUpperCase()
        if (SALES_UNIT_VALUES.includes(normalized as SalesUnit)) {
            return normalized as SalesUnit
        }
    }
    return DEFAULT_SALES_UNIT
}

const computeMeasurementFactor = (
    unit: SalesUnit,
    attrs: CustomAttributes,
): number | undefined => {
    if (unit === 'UNIT') {
        return 1
    }
    if (unit === 'SQUARE_METER') {
        const width = readAttributeNumber(attrs, 'width')
        const height = readAttributeNumber(attrs, 'height')
        if (width === undefined || height === undefined) {
            return undefined
        }
        return width * height
    }
    if (unit === 'LINEAR_METER') {
        const length = readAttributeNumber(attrs, 'length')
        if (length === undefined) {
            return undefined
        }
        return length
    }
    return undefined
}

export const getEffectiveQuantity = (
    item: SalesUnitAwareItem,
): number => {
    const rawQty = coerceNumber(item.qty)
    const unit = resolveSalesUnit(item.unitOfMeasure, item.pricingMethod)
    if (unit === 'UNIT') {
        if (rawQty === undefined) {
            return 0
        }
        return Math.max(Number(rawQty), 0)
    }
    const perUnit = computeMeasurementFactor(unit, item.customAttributes)
    if (perUnit === undefined) {
        return 0
    }
    const multiplier =
        rawQty === undefined || Number.isNaN(Number(rawQty))
            ? 1
            : Math.max(Number(rawQty), 0)
    const quantity = perUnit * multiplier
    return Number.isFinite(quantity) ? quantity : 0
}

const resolveBaseUnitPrice = (
    item: SalesUnitAwareItem,
): number | undefined => {
    const unitPrice = coerceNumber(item.unitPrice)
    if (unitPrice !== undefined) {
        return unitPrice
    }
    return coerceNumber(item.price)
}

export const getDerivedUnitPrice = (
    item: SalesUnitAwareItem,
): number => {
    const basePrice = resolveBaseUnitPrice(item)
    if (basePrice === undefined) {
        return 0
    }
    const unit = resolveSalesUnit(item.unitOfMeasure, item.pricingMethod)
    if (unit === 'UNIT') {
        return basePrice
    }
    const measurement = computeMeasurementFactor(unit, item.customAttributes)
    if (measurement === undefined) {
        return 0
    }
    return basePrice * Number(measurement)
}

export const calculateLineTotal = (
    item: SalesUnitAwareItem,
): number => {
    const derivedPrice = getDerivedUnitPrice(item)
    if (!Number.isFinite(derivedPrice)) {
        return 0
    }
    const qty = coerceNumber(item.qty)
    const multiplier =
        qty === undefined || Number.isNaN(Number(qty))
            ? 1
            : Math.max(Number(qty), 0)
    const total = derivedPrice * multiplier
    return Number.isFinite(total) ? total : 0
}

export const getPerUnitMeasurement = (
    item: SalesUnitAwareItem,
): number | undefined => {
    const unit = resolveSalesUnit(item.unitOfMeasure, item.pricingMethod)
    const measurement = computeMeasurementFactor(unit, item.customAttributes)
    if (!Number.isFinite(measurement)) {
        return undefined
    }
    return Number(measurement)
}
