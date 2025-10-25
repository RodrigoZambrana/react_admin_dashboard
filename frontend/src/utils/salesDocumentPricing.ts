import { normalizeCurrencyCode } from './currency'
import { convertAmountWithSnapshot, type FxSnapshotLike } from './fxConversion'
import {
    getDerivedUnitPrice,
    getPerUnitMeasurement,
    type SalesUnitAwareItem,
} from './salesUnitCalculation'

const getNumeric = (value: unknown): number | undefined => {
    if (value === null || value === undefined) {
        return undefined
    }
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
}

const coalesceQuantity = (value?: unknown, fallback?: unknown): number | undefined => {
    const primary = getNumeric(value)
    if (primary !== undefined) {
        return primary
    }
    return getNumeric(fallback)
}

const normalizeOrderCurrency = (code?: string | null): string | undefined => {
    if (!code) {
        return undefined
    }
    return normalizeCurrencyCode(code) ?? code.toUpperCase()
}

type MeasurementAware = Pick<
    SalesUnitAwareItem,
    'unitOfMeasure' | 'pricingMethod' | 'customAttributes'
>

type SalesDocumentPriceRow = MeasurementAware & {
    price?: number | string | null
    total?: number | string | null
    quantity?: number | string | null
    qty?: number | string | null
    unitCurrency?: string | null
    unitAmount?: number | string | null
    unitAmountOrderCurrency?: number | string | null
    unitPrice?: number | string | null
    conversionRate?: number | string | null
}

const derivePerMeasurement = (
    value: number | undefined,
    measurement: number | undefined,
): number | undefined => {
    if (value === undefined) {
        return undefined
    }
    if (!measurement || !Number.isFinite(measurement) || measurement <= 0) {
        return value
    }
    return value / measurement
}

export const resolveSalesDocumentUnitAmount = (
    row: SalesDocumentPriceRow,
    orderCurrency?: string,
    fxSnapshot?: FxSnapshotLike | null,
): number => {
    const measurement = getPerUnitMeasurement(row)

    const unitPrice = getNumeric(row.unitPrice)
    if (unitPrice !== undefined) {
        return unitPrice
    }

    const orderUnitAmount = getNumeric(row.unitAmountOrderCurrency)
    if (orderUnitAmount !== undefined) {
        return orderUnitAmount
    }

    const unitAmount = getNumeric(row.unitAmount)
    const normalizedOrderCurrency = normalizeOrderCurrency(orderCurrency)
    const unitCurrency = normalizeCurrencyCode(
        row.unitCurrency,
        normalizedOrderCurrency,
    )
    if (unitAmount !== undefined && unitCurrency && normalizedOrderCurrency) {
        const converted = convertAmountWithSnapshot(
            unitAmount,
            unitCurrency,
            normalizedOrderCurrency,
            fxSnapshot,
        )
        if (converted !== undefined) {
            return converted
        }
        const rate = getNumeric(row.conversionRate)
        if (rate !== undefined) {
            return unitAmount * rate
        }
    }

    const explicitPrice = getNumeric(row.price)
    if (explicitPrice !== undefined) {
        const perMeasurement = derivePerMeasurement(explicitPrice, measurement)
        if (perMeasurement !== undefined) {
            return perMeasurement
        }
    }

    const total = getNumeric(row.total)
    const qty = coalesceQuantity(row.quantity, row.qty)
    if (total !== undefined && qty !== undefined && qty !== 0) {
        const perInstance = total / qty
        const perMeasurement = derivePerMeasurement(perInstance, measurement)
        if (perMeasurement !== undefined) {
            return perMeasurement
        }
    }

    return 0
}

export const computeSalesDocumentDisplayUnitPrice = (
    row: SalesDocumentPriceRow,
    orderCurrency?: string,
    fxSnapshot?: FxSnapshotLike | null,
): number => {
    const baseUnitAmount = resolveSalesDocumentUnitAmount(
        row,
        orderCurrency,
        fxSnapshot,
    )
    return getDerivedUnitPrice({
        unitPrice: baseUnitAmount,
        price: baseUnitAmount,
        qty: row.qty ?? row.quantity,
        unitOfMeasure: row.unitOfMeasure,
        pricingMethod: row.pricingMethod,
        customAttributes: row.customAttributes,
    })
}
