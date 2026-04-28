import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bcrypt from 'bcrypt'

import { AuthService } from '../auth.service'

const originalJwtSecret = process.env.JWT_SECRET

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET
  } else {
    process.env.JWT_SECRET = originalJwtSecret
  }
})

function createService() {
  const prisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  } as any
  const jwt = {
    sign: vi.fn(),
    verifyAsync: vi.fn(),
  } as any
  const googleConfig = {
    getEffectiveConfig: vi.fn(),
  } as any
  const userManagementPolicy = {
    getUserManagementPolicySnapshot: vi.fn().mockResolvedValue({
      canAccessUserManagement: true,
      canManageUserCapabilities: true,
      allowedUserManagementRoles: ['SUPERADMIN', 'ADMIN'],
      allowedCapabilityManagementRoles: ['SUPERADMIN', 'ADMIN'],
      userManagementPolicySource: 'database',
      capabilityManagementPolicySource: 'database',
    }),
  } as any

  return {
    service: new AuthService(prisma, jwt, googleConfig, userManagementPolicy),
    prisma,
    jwt,
    googleConfig,
    userManagementPolicy,
  }
}

describe('AuthService', () => {
  it('rejects validation when the identifier is blank', async () => {
    const { service } = createService()

    await expect(service.validateUser('   ', 'ValidPass1!')).rejects.toThrow('Invalid credentials')
  })

  it('rejects validation when credentials do not match a user', async () => {
    const { service, prisma } = createService()
    prisma.user.findFirst.mockResolvedValue(null)

    await expect(service.validateUser('buyer@example.com', 'ValidPass1!')).rejects.toThrow(
      'Invalid credentials',
    )
  })

  it('rejects validation when the password is wrong', async () => {
    const { service, prisma } = createService()
    const hashed = await bcrypt.hash('ValidPass1!', 10)
    prisma.user.findFirst.mockResolvedValue({
      id: 1,
      email: 'buyer@example.com',
      passwordHash: hashed,
    })

    await expect(service.validateUser('buyer@example.com', 'WrongPass1!')).rejects.toThrow(
      'Invalid credentials',
    )
  })

  it('returns null for sessions with invalid scope', async () => {
    const { service, jwt } = createService()
    jwt.verifyAsync.mockResolvedValue({
      sub: 1,
      scope: 'storefront',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })

    await expect(service.resolveSession('token')).resolves.toBeNull()
  })

  it('returns null for sessions with an invalid subject', async () => {
    const { service, jwt } = createService()
    jwt.verifyAsync.mockResolvedValue({
      sub: 'abc',
      scope: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })

    await expect(service.resolveSession('token')).resolves.toBeNull()
  })

  it('returns null when the token cannot be verified', async () => {
    const { service, jwt } = createService()
    jwt.verifyAsync.mockRejectedValue(new Error('invalid token'))

    await expect(service.resolveSession('broken-token')).resolves.toBeNull()
  })
})
