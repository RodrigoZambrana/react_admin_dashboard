import { describe, expect, it } from 'vitest'

import { buildAddressLines, buildAddressPayload, normalizeCountryLabel } from '../address'

describe('order address helpers', () => {
  it('normalizes common country labels and ISO codes', () => {
    expect(normalizeCountryLabel('UY')).toBe('Uruguay')
    expect(normalizeCountryLabel('uruguay')).toBe('Uruguay')
    expect(normalizeCountryLabel('MEXICO')).toBe('México')
  })

  it('builds structured address lines including department, neighborhood and country', () => {
    expect(
      buildAddressLines({
        line1: 'Norberto Ortiz 4086',
        line2: 'Apto 2',
        city: 'Montevideo',
        department: 'Montevideo',
        neighborhood: 'Aguada',
        zip: '11000',
        country: 'UY',
      }),
    ).toEqual([
      'Norberto Ortiz 4086 Apto 2',
      'Montevideo, Aguada, Montevideo 11000',
      'Uruguay',
    ])
  })

  it('returns null payload when no meaningful address data exists', () => {
    expect(buildAddressPayload({})).toBeNull()
  })
})
