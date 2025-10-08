import { describe, expect, it } from 'vitest'
import {
  SALE_MARKUP,
  calculateOrderLineTotals,
  costPriceFromSale,
  derivePricingFromLegacyPrice,
  roundCurrency,
  salePriceFromCost,
} from './pricing'

describe('pricing helpers', () => {
  it('derives sale price with 30% markup for legacy records', () => {
    const legacyPrice = 100
    const { costPrice, salePrice } = derivePricingFromLegacyPrice(legacyPrice)
    expect(costPrice).toBe(100)
    expect(salePrice).toBe(roundCurrency(legacyPrice * SALE_MARKUP))
  })

  it('rounds sale price generated from cost to two decimals', () => {
    const cost = 75.55
    expect(salePriceFromCost(cost)).toBe(98.22)
  })

  it('calculates cost price from sale value', () => {
    const sale = 260
    expect(costPriceFromSale(sale)).toBe(200)
  })

  it('computes order line totals using sale minus cost per item', () => {
    const line = calculateOrderLineTotals({
      price: 150,
      qty: 2,
      product: { costPrice: 80 },
    })
    expect(line.saleTotal).toBe(300)
    expect(line.costTotal).toBe(160)
  })

  it('uses product sale price when line price is missing', () => {
    const line = calculateOrderLineTotals({
      qty: 3,
      product: { salePrice: 90, costPrice: 40 },
    })
    expect(line.saleTotal).toBe(270)
    expect(line.costTotal).toBe(120)
  })
})
