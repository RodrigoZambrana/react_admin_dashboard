import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { StorefrontGoogleOAuthService } from '../google-oauth.service'
import type { StorefrontAuthSession } from '../../types'

const mockConfig = (overrides: Record<string, string | undefined> = {}) => {
  const store = new Map<string, string | undefined>(
    Object.entries({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'https://example.com/api/storefront/auth/google/callback',
      STOREFRONT_BASE_URL: 'https://frontend.example',
      ...overrides,
    }),
  )
  return {
    get: vi.fn((key: string) => store.get(key)),
  }
}

const createMockPrisma = () => ({
  storefrontOAuthSession: {
    deleteMany: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  },
})

const createMockStorefrontService = (session: StorefrontAuthSession) => ({
  createSessionForCustomer: vi.fn().mockResolvedValue(session),
})

const createMockSecurityService = () => ({
  reauthenticateWithGoogle: vi.fn().mockResolvedValue({
    token: 'reauth-token',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }),
  reauthenticateWithPassword: vi.fn(),
})

const createMockGoogleConfig = () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({
    google: {
      enabled: true,
      storefrontEnabled: true,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/api/storefront/auth/google/callback',
    },
    recaptcha: {
      admin: { enabled: false, siteKey: null, secretKey: null },
      storefront: { enabled: false, siteKey: null, secretKey: null },
    },
  }),
})

describe('StorefrontGoogleOAuthService', () => {
  const session: StorefrontAuthSession = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    customer: {
      id: 1,
      email: 'buyer@example.com',
      firstName: 'Buyer',
      lastName: 'Example',
      phone: null,
      avatarUrl: null,
      dateOfBirth: null,
      wishlistCount: 0,
      wishlistProductIds: [],
      addresses: [],
    },
  }

  let config: ReturnType<typeof mockConfig>
  let prisma: ReturnType<typeof createMockPrisma>
  let storefront: ReturnType<typeof createMockStorefrontService>
  let security: ReturnType<typeof createMockSecurityService>
  let googleConfig: ReturnType<typeof createMockGoogleConfig>
  let service: StorefrontGoogleOAuthService

  beforeEach(() => {
    config = mockConfig()
    prisma = createMockPrisma()
    storefront = createMockStorefrontService(session)
    security = createMockSecurityService()
    googleConfig = createMockGoogleConfig()
    service = new StorefrontGoogleOAuthService(
      config as any,
      prisma as any,
      storefront as any,
      googleConfig as any,
      security as any,
    )
  })

  it('generates a start URL and persists transient session', async () => {
    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'vitest' },
    } satisfies Partial<FastifyRequest>

    const result = await service.start(undefined, req as FastifyRequest)

    expect(result.url).toContain('client_id=test-client-id')
    expect(result.url).toContain('code_challenge=')
    expect(result.state).toBeDefined()
    expect(prisma.storefrontOAuthSession.create).toHaveBeenCalledTimes(1)
  })

  it('returns error result when session state is missing', async () => {
    const result = await service.complete({ state: null })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.errorCode).toBe('missing_state')
    }
  })

  it('returns error result when OAuth session cannot be found', async () => {
    prisma.storefrontOAuthSession.findUnique.mockResolvedValue(null)
    const result = await service.complete({ state: 'unknown-state', code: 'code' })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.errorCode).toBe('session_not_found')
    }
  })

  it('completes OAuth flow when Google exchange succeeds', async () => {
    prisma.storefrontOAuthSession.findUnique.mockResolvedValue({
      state: 'test-state',
      codeVerifier: 'verifier',
      nonce: 'nonce',
      redirectUri: 'https://example.com/api/storefront/auth/google/callback',
      returnPath: '/account',
      scopes: 'openid email profile',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      purpose: 'login',
      expectedCustomerId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    })

    const tokenResponse = {
      access_token: 'google-access',
      expires_in: 3600,
      scope: 'openid email profile',
      token_type: 'Bearer',
      id_token: 'id-token',
    }

    const idPayload = {
      sub: 'google-sub',
      email: 'buyer@example.com',
      name: 'Buyer Example',
      given_name: 'Buyer',
      family_name: 'Example',
    }

    vi.spyOn(service as any, 'exchangeAuthorizationCode').mockResolvedValue(tokenResponse)
    vi.spyOn(service as any, 'verifyIdToken').mockResolvedValue(idPayload)
    vi.spyOn(service as any, 'linkCustomerAccount').mockImplementation(async () => ({ id: 1 }))

    const result = await service.complete({ state: 'test-state', code: 'auth-code' })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.session).not.toBeNull()
      if (result.session) {
        expect(result.session.accessToken).toBe('access')
      }
      expect(result.returnPath).toBe('/account')
      expect(storefront.createSessionForCustomer).toHaveBeenCalled()
    }

    expect(prisma.storefrontOAuthSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { state: 'test-state' },
        data: expect.objectContaining({ completedAt: expect.any(Date) }),
      }),
    )
  })
})
