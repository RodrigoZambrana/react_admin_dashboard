import { describe, expect, it, vi } from 'vitest'

import { RolesGuard } from '../roles.guard'

function createContext(user?: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as any
    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext())).toBe(true)
  })

  it('rejects requests without a user for guarded routes', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['ADMIN']),
    } as any
    const guard = new RolesGuard(reflector)

    expect(() => guard.canActivate(createContext())).toThrow()
  })

  it('allows access when the user has one of the required roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['ADMIN', 'OPS']),
    } as any
    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext({ role: 'ADMIN' }))).toBe(true)
  })
})
