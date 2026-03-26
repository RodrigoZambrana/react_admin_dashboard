import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserManagementPolicyService } from '../user-management-policy'

const ORIGINAL_USER_MANAGEMENT_ALLOWED_ROLES =
  process.env.USER_MANAGEMENT_ALLOWED_ROLES
const ORIGINAL_USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES =
  process.env.USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES

afterEach(() => {
  if (ORIGINAL_USER_MANAGEMENT_ALLOWED_ROLES === undefined) {
    delete process.env.USER_MANAGEMENT_ALLOWED_ROLES
  } else {
    process.env.USER_MANAGEMENT_ALLOWED_ROLES =
      ORIGINAL_USER_MANAGEMENT_ALLOWED_ROLES
  }

  if (ORIGINAL_USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES === undefined) {
    delete process.env.USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES
  } else {
    process.env.USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES =
      ORIGINAL_USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES
  }
})

const createService = (records: Record<string, string | undefined> = {}) =>
  new UserManagementPolicyService({
    systemConfig: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        records[where.key] === undefined ? null : { value: records[where.key] },
      ),
    },
  } as any)

describe('user management policy', () => {
  it('falls back to env/defaults when no database policy exists', async () => {
    delete process.env.USER_MANAGEMENT_ALLOWED_ROLES
    delete process.env.USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES

    const service = createService()

    await expect(service.getUserManagementAllowedRoles()).resolves.toEqual({
      roles: ['SUPERADMIN', 'ADMIN'],
      source: 'environment',
    })
    await expect(service.getUserCapabilityManagementAllowedRoles()).resolves.toEqual({
      roles: ['SUPERADMIN', 'ADMIN'],
      source: 'environment',
    })
  })

  it('prefers database policy and reports database as source', async () => {
    process.env.USER_MANAGEMENT_ALLOWED_ROLES = 'SUPERADMIN'
    process.env.USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES = 'SUPERADMIN'

    const service = createService({
      'auth:userManagementAllowedRoles': JSON.stringify(['OPS', 'ADMIN']),
      'auth:userCapabilityManagementAllowedRoles': 'ADMIN',
    })

    await expect(service.getUserManagementPolicySnapshot({
      role: 'OPS',
      authority: ['OPS'],
    })).resolves.toMatchObject({
      canAccessUserManagement: true,
      canManageUserCapabilities: false,
      allowedUserManagementRoles: ['OPS', 'ADMIN'],
      allowedCapabilityManagementRoles: ['ADMIN'],
      userManagementPolicySource: 'database',
      capabilityManagementPolicySource: 'database',
    })
  })
})
