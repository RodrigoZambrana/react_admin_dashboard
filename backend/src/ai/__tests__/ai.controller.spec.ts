import { describe, expect, it, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { AiController } from '../ai.controller'

const createController = () => {
  const ai = {
    createOrder: vi.fn().mockResolvedValue({ ok: true }),
    listProducts: vi.fn().mockResolvedValue({ items: [] }),
  } as any

  const config = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'AI_INTERNAL_TOKEN') {
        return 'test-token'
      }
      return null
    }),
  } as any

  const knowledge = {} as any

  return {
    controller: new AiController(ai, config, knowledge),
    ai,
  }
}

describe('AiController internal role enforcement', () => {
  it('rejects write tools when the role is missing', async () => {
    const { controller } = createController()

    expect(() =>
      controller.createOrder({} as any, undefined, 'test-token'),
    ).toThrow(ForbiddenException)
  })

  it('rejects write tools when the role is not allowed', async () => {
    const { controller } = createController()

    expect(() =>
      controller.createOrder({} as any, 'customer_public', 'test-token'),
    ).toThrow(ForbiddenException)
  })

  it('allows a permitted role to execute the tool', async () => {
    const { controller, ai } = createController()

    await expect(
      controller.createOrder({ customerId: 5 } as any, 'admin_operations', 'test-token'),
    ).resolves.toEqual({ ok: true })

    expect(ai.createOrder).toHaveBeenCalledWith({ customerId: 5 })
  })

  it('allows read-only search tools for customer_public when configured', async () => {
    const { controller, ai } = createController()

    await expect(
      controller.listProducts({ search: 'roller' } as any, 'customer_public', 'test-token'),
    ).resolves.toEqual({ items: [] })

    expect(ai.listProducts).toHaveBeenCalledWith({ search: 'roller' })
  })
})
