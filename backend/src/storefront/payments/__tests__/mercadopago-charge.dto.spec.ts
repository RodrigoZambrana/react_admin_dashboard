import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { MercadoPagoChargeDto } from '../../dto/mercadopago-charge.dto'

function validate(payload: unknown) {
  const instance = plainToInstance(MercadoPagoChargeDto, payload)
  return {
    instance,
    errors: validateSync(instance, { whitelist: true, forbidUnknownValues: true }),
  }
}

describe('MercadoPagoChargeDto', () => {
  it('rejects malformed payer emails', () => {
    const { errors } = validate({
      currency: 'UYU',
      token: 'tok_test',
      transactionAmount: 100,
      installments: 3,
      paymentMethodId: 'visa',
      payer: {
        email: 'bad@@example',
      },
    })

    expect(errors.some((error) => error.property === 'payer')).toBe(true)
  })

  it('rejects zero or negative amounts and installments', () => {
    const { errors } = validate({
      currency: 'UYU',
      token: 'tok_test',
      transactionAmount: 0,
      installments: 0,
      paymentMethodId: 'visa',
      payer: {
        email: 'buyer@example.com',
      },
    })

    const properties = errors.map((error) => error.property)
    expect(properties).toEqual(expect.arrayContaining(['transactionAmount', 'installments']))
  })

  it('rejects empty payment method ids', () => {
    const { errors } = validate({
      currency: 'UYU',
      token: 'tok_test',
      transactionAmount: 100,
      installments: 3,
      paymentMethodId: '   ',
      payer: {
        email: 'buyer@example.com',
      },
    })

    expect(errors.some((error) => error.property === 'paymentMethodId')).toBe(true)
  })
})
