import { describe, expect, it, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { UsersController } from '../users.controller'

const createController = (policyOverrides: Record<string, unknown> = {}) =>
  new UsersController(
    {} as any,
    {
      assertCanAccessUserManagement: vi.fn(async (user) => {
        if (user?.role === 'ADMIN') {
          throw new ForbiddenException('users.access.denied')
        }
      }),
      getUserManagementPolicySnapshot: vi.fn(async () => ({
        canAccessUserManagement: true,
        canManageUserCapabilities: false,
        allowedUserManagementRoles: ['SUPERADMIN', 'OPS'],
        allowedCapabilityManagementRoles: ['SUPERADMIN'],
        userManagementPolicySource: 'database',
        capabilityManagementPolicySource: 'environment',
      })),
      ...policyOverrides,
    } as any,
  )

describe('UsersController capability catalog policy', () => {
  it('rejects access when the actor is outside the configured roles', async () => {
    const controller = createController()

    await expect(
      controller.capabilityCatalog({
        user: {
          role: 'ADMIN',
          authority: ['ADMIN'],
        },
      } as any),
    ).rejects.toThrow(ForbiddenException)
  })

  it('returns redacted capability catalog when the actor cannot manage capabilities', async () => {
    const controller = createController()

    const response = await controller.capabilityCatalog({
      user: {
        role: 'OPS',
        authority: ['OPS'],
      },
    } as any)

    expect(response.accessPolicy).toMatchObject({
      canAccessUserManagement: true,
      canManageUserCapabilities: false,
      userManagementPolicySource: 'database',
      capabilityManagementPolicySource: 'environment',
    })
    expect(response.capabilities).toEqual([])
    expect(response.groups).toEqual([])
  })
})
