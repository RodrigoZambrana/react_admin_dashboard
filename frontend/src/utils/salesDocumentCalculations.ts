import { calculateLineTotal, getDerivedUnitPrice, getEffectiveQuantity, type SalesUnitAwareItem } from './salesUnitCalculation'

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
