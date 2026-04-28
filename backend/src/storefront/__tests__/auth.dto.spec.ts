import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { StorefrontRegisterDto } from '../dto/auth.dto'

function validate(payload: unknown) {
  const instance = plainToInstance(StorefrontRegisterDto, payload)
  return { instance, errors: validateSync(instance, { whitelist: true, forbidUnknownValues: true }) }
}

describe('StorefrontRegisterDto', () => {
  it('rejects whitespace-only names and password-only spaces', () => {
    const { errors } = validate({
      email: 'buyer@example.com',
      firstName: '   ',
      lastName: '  ',
      phone: 'abc',
      password: '        ',
      locale: 'es',
    })

    const properties = errors.map((error) => error.property)
    expect(properties).toEqual(expect.arrayContaining(['firstName', 'lastName', 'password', 'phone']))
  })

  it('normalizes blank optional email to an omitted value', () => {
    const { instance, errors } = validate({
      email: '   ',
      firstName: 'Ana',
      lastName: 'Perez',
      phone: '+59899112233',
      password: 'Storefront@2024',
      locale: 'es',
    })

    expect(errors).toHaveLength(0)
    expect(instance.email).toBeUndefined()
  })
})
