import { Prisma } from '@prisma/client'

export const SALE_MARKUP = 1.3

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    const numeric = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

export function roundCurrency(value: Prisma.Decimal.Value): number {
  try {
    const decimal = new Prisma.Decimal(value ?? 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    return Number(decimal.toString())
  } catch (error) {
    return 0
  }
}

export function salePriceFromCost(cost: number): number {
  return roundCurrency(cost * SALE_MARKUP)
}

export function costPriceFromSale(sale: number): number {
  if (!Number.isFinite(sale)) return 0
  return roundCurrency(sale / SALE_MARKUP)
}

export function derivePricingFromLegacyPrice(legacyPrice: number) {
  const costPrice = roundCurrency(Number.isFinite(legacyPrice) ? legacyPrice : 0)
  const salePrice = salePriceFromCost(costPrice)
  return { costPrice, salePrice }
}

export type OrderLineInput = {
  qty?: number | null
  price?: unknown
  product?: {
    salePrice?: unknown
    costPrice?: unknown
  } | null
}

export function calculateOrderLineTotals(input: OrderLineInput) {
  const quantityRaw = Number(input.qty ?? 0)
  const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0
  const saleUnit =
    input.price !== null && input.price !== undefined
      ? decimalToNumber(input.price)
      : decimalToNumber(input.product?.salePrice)
  const costUnit = decimalToNumber(input.product?.costPrice)
  const saleTotal = roundCurrency(quantity * saleUnit)
  const costTotal = roundCurrency(quantity * costUnit)
  return { saleTotal, costTotal }
}
