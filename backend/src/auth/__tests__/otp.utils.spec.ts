import { describe, expect, it } from 'vitest'
import {
  compareHashedOtpValue,
  generateOtpCode,
  hashOtpValue,
} from '../otp/otp.utils'

describe('otp utils', () => {
  it('generates secure OTPs with the expected length', () => {
    const otp = generateOtpCode(4)
    expect(otp).toMatch(/^\d{4}$/)
  })

  it('hashes and verifies OTP values with the configured secret', () => {
    const secret = 'test-secret'
    const hash = hashOtpValue('1234', secret)
    expect(compareHashedOtpValue('1234', hash, secret)).toBe(true)
    expect(compareHashedOtpValue('1235', hash, secret)).toBe(false)
  })
})

