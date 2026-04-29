import { describe, expect, it, vi } from 'vitest'
import { UserStatus } from '@prisma/client'
import { PhoneAuthService } from '../phone-auth.service'
import { hashOtpValue } from '../otp/otp.utils'

function createService() {
  const prisma: any = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    otpCode: {
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    securityEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops as Array<Promise<unknown>>)
      }
      if (typeof ops === 'function') {
        return ops(prisma)
      }
      return undefined
    }),
  }

  const config = {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'AUTH_OTP_LENGTH':
          return '4'
        case 'AUTH_OTP_TTL_MS':
          return String(5 * 60 * 1000)
        case 'AUTH_OTP_MAX_ATTEMPTS':
          return '5'
        case 'AUTH_OTP_SECRET':
          return 'unit-test-secret'
        case 'STOREFRONT_BASE_URL':
          return 'http://localhost:3000'
        default:
          return undefined
      }
    }),
  } as any

  const email = {
    sendPasswordReset: vi.fn(),
  } as any

  const smsProvider = {
    sendSms: vi.fn(),
  }

  const smsProviderFactory = {
    getProvider: vi.fn(() => smsProvider),
  } as any

  const smsTemplates = {
    render: vi.fn(() => 'OTP message'),
  } as any

  const rateLimit = {
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  } as any

  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as any

  return {
    service: new PhoneAuthService(prisma, config, email, smsProviderFactory, smsTemplates, rateLimit, audit),
    prisma,
    email,
    smsProvider,
    smsProviderFactory,
    smsTemplates,
    rateLimit,
    audit,
  }
}

describe('PhoneAuthService', () => {
  it('registers a pending user and issues an OTP with a five minute expiry', async () => {
    const { service, prisma, smsProvider, audit } = createService()
    prisma.user.findFirst.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({
      id: 11,
      phone: '+59899112233',
      status: UserStatus.PENDING_VERIFICATION,
      email: 'phone-59899112233@noemail.local',
    })
    prisma.otpCode.create.mockResolvedValue({
      id: 1,
    })

    const result = await service.register({
      phone: '+598 99 112 233',
      password: 'ValidPass1!',
    })

    expect(result.status).toBe(UserStatus.PENDING_VERIFICATION)
    expect(prisma.user.create).toHaveBeenCalled()
    expect(prisma.otpCode.create).toHaveBeenCalled()
    expect(smsProvider.sendSms).toHaveBeenCalledTimes(1)
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ACCOUNT_REGISTERED', channel: 'sms' }),
    )

    const createCall = prisma.otpCode.create.mock.calls[0]?.[0]
    const expiresAt = createCall?.data?.expiresAt as Date
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60 * 1000)
    expect(expiresAt.getTime() - Date.now()).toBeLessThan(6 * 60 * 1000)
  })

  it('activates the user after a successful verification OTP match', async () => {
    const { service, prisma, audit } = createService()
    const secret = 'unit-test-secret'
    const code = '1234'
    const hash = hashOtpValue(code, secret)

    prisma.user.findFirst.mockResolvedValue({
      id: 21,
      phone: '+59899112233',
      status: UserStatus.PENDING_VERIFICATION,
      email: 'phone-59899112233@noemail.local',
    })
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 31,
      userId: 21,
      codeHash: hash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      type: 'VERIFICATION',
    })
    prisma.otpCode.update.mockResolvedValue({})
    prisma.user.update.mockResolvedValue({})

    const result = await service.verifyOtp({
      phone: '+598 99 112 233',
      code,
    })

    expect(result.status).toBe(UserStatus.ACTIVE)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21 },
        data: { status: UserStatus.ACTIVE },
      }),
    )
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'OTP_VERIFIED', channel: 'verification' }),
    )
  })
})

