import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { M2CalculationStrategy } from '../strategies/m2-calculation.strategy'

describe('M2CalculationStrategy', () => {
  const strategy = new M2CalculationStrategy()

  it('supports only the M2 strategy key', () => {
    expect(strategy.supports('M2')).toBe(true)
    expect(strategy.supports('m2')).toBe(true)
    expect(strategy.supports('AREA')).toBe(false)
  })

  it('rounds dimensions and computes the final price deterministically', () => {
    const result = strategy.calculate({
      productId: 10,
      width: 1.234,
      height: 2.345,
      unitPrice: 99.995,
    })

    expect(result).toEqual({
      productId: 10,
      width: 1.23,
      height: 2.35,
      area: 2.89,
      unitPrice: 100,
      totalPrice: 289,
      measurementType: 'M2',
      strategy: 'M2',
    })
  })

  it('rejects invalid dimensions', () => {
    expect(() =>
      strategy.calculate({
        productId: 10,
        width: 0,
        height: 1,
        unitPrice: 100,
      }),
    ).toThrow(BadRequestException)

    expect(() =>
      strategy.calculate({
        productId: 10,
        width: 1,
        height: Number.NaN,
        unitPrice: 100,
      }),
    ).toThrow('Invalid height')
  })
})
