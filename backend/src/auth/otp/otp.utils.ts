import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'

export const normalizeIdentifier = (value?: string | null): string => {
  return (value ?? '').trim().toLowerCase()
}

export const generateOtpCode = (length: number): string => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('OTP length must be a positive integer')
  }
  const upperBound = 10 ** length
  const numeric = randomInt(0, upperBound)
  return numeric.toString().padStart(length, '0')
}

export const generateRecoveryToken = (bytes = 32): string => {
  return randomBytes(bytes).toString('hex')
}

export const hashOtpValue = (value: string, secret: string): string => {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export const compareHashedOtpValue = (value: string, hash: string, secret: string): boolean => {
  const candidate = Buffer.from(hashOtpValue(value, secret), 'hex')
  const stored = Buffer.from(hash, 'hex')
  if (candidate.length !== stored.length) {
    return false
  }
  return timingSafeEqual(candidate, stored)
}

export const maskPhoneNumber = (phone: string): string => {
  if (!phone) {
    return phone
  }
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) {
    return '*'.repeat(Math.max(0, digits.length))
  }
  const suffix = digits.slice(-4)
  return `${'*'.repeat(digits.length - 4)}${suffix}`
}
