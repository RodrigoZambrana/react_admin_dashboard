import { describe, expect, it } from 'vitest'
import { maskEmailAddress, maskEmailList } from '../masking'

describe('PII masking', () => {
  it('masks the local part of email addresses', () => {
    expect(maskEmailAddress('rodrigo@urucortinas.com.uy')).toBe('ro****o@urucortinas.com.uy')
    expect(maskEmailAddress('ab@example.com')).toBe('ab**@example.com')
  })

  it('returns empty string for empty emails and keeps invalid values untouched', () => {
    expect(maskEmailAddress('')).toBe('')
    expect(maskEmailAddress('invalid-email')).toBe('invalid-email')
  })

  it('masks lists of email addresses', () => {
    expect(maskEmailList(['ventas@example.com', 'admin@example.com'])).toEqual([
      've***s@example.com',
      'ad**n@example.com',
    ])
  })
})
