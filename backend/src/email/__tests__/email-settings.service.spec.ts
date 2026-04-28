import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailCategory } from '@prisma/client'
import { EmailSettingsService } from '../email-settings.service'

const createPrisma = () => ({
  emailSetting: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
})

const createConfig = (overrides: Record<string, string | undefined> = {}) => ({
  get: vi.fn((key: string) => overrides[key]),
})

const createSecureConfig = () => ({
  getJson: vi.fn().mockResolvedValue(null),
  setJson: vi.fn(),
})

describe('EmailSettingsService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let config: ReturnType<typeof createConfig>
  let secureConfig: ReturnType<typeof createSecureConfig>
  let service: EmailSettingsService

  beforeEach(() => {
    prisma = createPrisma()
    config = createConfig({
      EMAIL_FROM_DEFAULT: 'no-reply@example.com',
      EMAIL_FROM_NAME_DEFAULT: 'Sistema Administrativo',
      EMAIL_PROVIDER: 'DEV',
      EMAIL_CUSTOMER_DELIVERY_ENABLED: 'true',
      EMAIL_ADMIN_DELIVERY_ENABLED: 'true',
    })
    secureConfig = createSecureConfig()
    service = new EmailSettingsService(prisma as any, config as any, secureConfig as any)
  })

  it('returns an explicit empty email provider state when no secure config is stored', async () => {
    const result = await service.getEmailProviderConfig()

    expect(result.provider).toBe('DEV')
    expect(result.smtp).toBeNull()
    expect(result.fromAddress).toBe('no-reply@example.com')
    expect(result.fromName).toBe('Sistema Administrativo')
  })

  it('materializes category settings from the active provider defaults when records are missing', async () => {
    prisma.emailSetting.findUnique.mockResolvedValue(null)
    prisma.emailSetting.create.mockImplementation(async ({ data }: any) => ({
      id: 1,
      category: data.category,
      fromAddress: data.fromAddress,
      fromName: data.fromName,
      adminRecipients: [],
      cc: [],
      bcc: [],
      enabled: true,
      updatedAt: new Date('2026-04-27T10:00:00.000Z'),
    }))

    const result = await service.getCategorySettings(EmailCategory.ORDERS)

    expect(prisma.emailSetting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: EmailCategory.ORDERS,
          fromAddress: 'no-reply@example.com',
          fromName: 'Sistema Administrativo',
        }),
      }),
    )
    expect(result.enabled).toBe(true)
    expect(result.fromAddress).toBe('no-reply@example.com')
  })
})
