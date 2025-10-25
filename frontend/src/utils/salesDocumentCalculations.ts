import { normalizeCurrencyCode } from './currency'
import {
    calculateLineTotal,
    getDerivedUnitPrice,
    getEffectiveQuantity,
    resolveSalesUnit,
    type SalesUnitAwareItem,
} from './salesUnitCalculation'

export type SalesDocumentMode = 'order' | 'budget'

export type SalesDocumentRoundFunction = (value: number) => number

export interface SalesDocumentLineComputation {
    unitPriceRaw: number
    unitPrice: number
    lineTotalRaw: number
    lineTotal: number
    effectiveQuantity: number
}

export interface SalesDocumentSummary {
    subTotal: number
    deliveryFees: number
    total: number
    tax: number
}

export interface SalesDocumentSummaryComputation extends SalesDocumentSummary {
    lines: SalesDocumentLineComputation[]
}

const sanitizeNumber = (value: unknown, fallback = 0): number => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const applyRound = (value: number, round?: SalesDocumentRoundFunction) => {
    if (!Number.isFinite(value)) {
        return 0
    }
    return round ? round(value) : value
}

const cloneCustomAttributes = (value: unknown): Record<string, unknown> | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
    }
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) {
        return undefined
    }
    return entries.reduce<Record<string, unknown>>((accumulator, [key, entryValue]) => {
        accumulator[key] = entryValue
        return accumulator
    }, {})
}

export const mapSalesDocumentItemsForComputation = (
    rawItems: unknown,
): SalesUnitAwareItem[] => {
    if (!Array.isArray(rawItems)) {
        return []
    }
    return rawItems.map((rawItem) => {
        const candidate = rawItem as Record<string, unknown>
        const qty = sanitizeNumber(candidate?.qty ?? (candidate as any)?.quantity ?? 0, 0)
        const resolvedUnit = resolveSalesUnit(
            (candidate?.pricingMethodSnapshot as string | undefined) ?? undefined,
            (typeof candidate?.pricingMethod === 'string' && candidate.pricingMethod) ||
                (typeof candidate?.unitOfMeasure === 'string' && candidate.unitOfMeasure) ||
                undefined,
        )
        const priceForCalculation = sanitizeNumber(
            candidate?.unitAmountOrderCurrency ??
                candidate?.price ??
                candidate?.unitAmount ??
                candidate?.unitPrice ??
                0,
            0,
        )
        const customAttributes = cloneCustomAttributes(candidate?.customAttributes)
        return {
            price: priceForCalculation,
            unitPrice: priceForCalculation,
            qty,
            unitOfMeasure: resolvedUnit,
            pricingMethod: resolvedUnit,
            customAttributes,
        }
    })
}

export const detectSalesDocumentCurrency = (
    rawItems: unknown,
    fallback?: string | null,
): string | undefined => {
    const normalizedFallback = normalizeCurrencyCode(fallback ?? undefined)
    if (Array.isArray(rawItems)) {
        for (const raw of rawItems) {
            if (!raw || typeof raw !== 'object') {
                continue
            }
            const candidate =
                normalizeCurrencyCode((raw as any)?.unitCurrency, normalizedFallback) ||
                normalizeCurrencyCode((raw as any)?.product?.currency, normalizedFallback) ||
                normalizeCurrencyCode((raw as any)?.currency, normalizedFallback)
            if (candidate) {
                return candidate
            }
        }
    }
    return normalizedFallback ?? undefined
}

export const createSalesDocumentRounder = (
    mode: SalesDocumentMode | string | undefined,
): SalesDocumentRoundFunction => {
    if (mode === 'budget') {
        return (value: number) => {
            const numeric = Number(value)
            if (!Number.isFinite(numeric)) {
                return 0
            }
            return Math.ceil(numeric)
        }
    }
    return (value: number) => {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) {
            return 0
        }
        return Math.round((numeric + Number.EPSILON) * 100) / 100
    }
}

export const computeSalesDocumentLine = (
    item: SalesUnitAwareItem,
    round?: SalesDocumentRoundFunction,
): SalesDocumentLineComputation => {
    const unitPriceRaw = getDerivedUnitPrice(item)
    const lineTotalRaw = calculateLineTotal(item)
    return {
        unitPriceRaw,
        unitPrice: applyRound(unitPriceRaw, round),
        lineTotalRaw,
        lineTotal: applyRound(lineTotalRaw, round),
        effectiveQuantity: getEffectiveQuantity(item),
    }
}

export const computeSalesDocumentSummary = (
    items: SalesUnitAwareItem[],
    options: {
        mode?: SalesDocumentMode | string
        round?: SalesDocumentRoundFunction
        deliveryFees?: unknown
        taxRate?: unknown
        fallbackTaxAmount?: unknown
    } = {},
): SalesDocumentSummaryComputation => {
    const { mode, round, deliveryFees, taxRate, fallbackTaxAmount } = options
    const roundFn = round
    const lines = items.map((item) => computeSalesDocumentLine(item, roundFn))

    const lineTotalsForAggregation =
        mode === 'budget'
            ? lines.map((line) => line.lineTotal)
            : lines.map((line) => line.lineTotalRaw)

    const subTotalBase = lineTotalsForAggregation.reduce(
        (accumulator, value) => accumulator + sanitizeNumber(value, 0),
        0,
    )

    const subTotal =
        mode === 'budget' ? subTotalBase : applyRound(subTotalBase, roundFn)

    const deliveryFeesRaw = sanitizeNumber(deliveryFees, 0)
    const deliveryFeesValue = applyRound(deliveryFeesRaw, roundFn)

    const totalBase = subTotal + deliveryFeesValue
    const total = applyRound(totalBase, roundFn)

    const normalizedTaxRate = Number(taxRate)
    let tax: number
    if (Number.isFinite(normalizedTaxRate) && normalizedTaxRate > 0) {
        const computed = subTotal * (normalizedTaxRate / (100 + normalizedTaxRate))
        tax = applyRound(computed, roundFn)
    } else {
        const fallbackTax = sanitizeNumber(fallbackTaxAmount, 0)
        tax = applyRound(fallbackTax, roundFn)
    }

    return {
        lines,
        subTotal,
        deliveryFees: deliveryFeesValue,
        total,
        tax,
    }
}
