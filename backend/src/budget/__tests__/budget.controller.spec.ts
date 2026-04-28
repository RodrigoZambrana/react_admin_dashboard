import { describe, expect, it, vi } from 'vitest'

import { BudgetController } from '../budget.controller'

describe('BudgetController', () => {
  it('delegates every route to the calculator service', async () => {
    const calculator = {
      listProducts: vi.fn().mockResolvedValue(['products']),
      calculate: vi.fn().mockResolvedValue({ result: 'calculate' }),
      addToCart: vi.fn().mockResolvedValue({ result: 'addToCart' }),
      summarize: vi.fn().mockResolvedValue({ result: 'summary' }),
      saveLead: vi.fn().mockResolvedValue({ result: 'lead' }),
    }
    const controller = new BudgetController(calculator as any)

    expect(await controller.listProducts()).toEqual(['products'])
    expect(await controller.calculate({} as any)).toEqual({ result: 'calculate' })
    expect(await controller.addToCart({} as any)).toEqual({ result: 'addToCart' })
    expect(await controller.summarize({} as any)).toEqual({ result: 'summary' })
    expect(await controller.createLead({} as any)).toEqual({ result: 'lead' })

    expect(calculator.listProducts).toHaveBeenCalledTimes(1)
    expect(calculator.calculate).toHaveBeenCalledTimes(1)
    expect(calculator.addToCart).toHaveBeenCalledTimes(1)
    expect(calculator.summarize).toHaveBeenCalledTimes(1)
    expect(calculator.saveLead).toHaveBeenCalledTimes(1)
  })
})
